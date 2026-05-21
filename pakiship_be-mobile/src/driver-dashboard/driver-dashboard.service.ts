import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { SessionPayload } from "../common/session/session.types";
import { SupabaseService } from "../supabase/supabase.service";
import { GoogleMapsService } from "../google-maps/google-maps.service";
import { randomUUID } from "node:crypto";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const PROFILE_IMAGE_BUCKET = process.env.SUPABASE_PROFILE_BUCKET || "customer-profile-images";
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

function assertAllowedFile(
  file: UploadedFile | undefined,
  options: {
    maxSizeBytes: number;
    allowedTypes: string[];
    emptyMessage: string;
  },
): asserts file is UploadedFile {
  if (!file) {
    throw new BadRequestException(options.emptyMessage);
  }

  if (!options.allowedTypes.includes(file.mimetype)) {
    throw new BadRequestException("Unsupported file type.");
  }

  if (file.size > options.maxSizeBytes) {
    throw new BadRequestException("File is too large.");
  }
}

function getFileExtension(filename: string) {
  const clean = filename.split(".").pop()?.toLowerCase();
  return clean?.replace(/[^a-z0-9]/g, "") || "bin";
}

type JobStatus = "available" | "in-progress" | "completed";
type ParcelStatus = "picked-up" | "out-for-delivery" | "delivered" | null;

type DriverJobRow = {
  id: string;
  job_number: string;
  parcel_draft_id: string | null;
  driver_id: string | null;
  status: JobStatus;
  earnings: number | string | null;
};

type DriverPresenceRow = {
  id: string;
  is_online: boolean;
  acceptance_rate: number | string | null;
  vehicle_type: string | null;
  documents_status: string | null;
};

const VALID_PARCEL_STATUSES = new Set<Exclude<ParcelStatus, null>>([
  "picked-up",
  "out-for-delivery",
  "delivered",
]);
const PH_TIMEZONE_OFFSET_HOURS = 8;

function startOfPhilippineDay(now = new Date()) {
  const shifted = new Date(now.getTime() + PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
}

function asNumber(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(value);
}

function mapJob(row: DriverJobRow, draftInfo?: any) {
  const earningsAmount = asNumber(row.earnings);
  return {
    id: row.id,
    jobNumber: row.job_number,
    pickup: draftInfo?.pickup_address || "Pickup",
    pickupLocation: null,
    dropoff: draftInfo?.delivery_address || "Dropoff",
    dropoffLocation: null,
    distance: "TBD",
    earningsAmount,
    earnings: formatCurrency(earningsAmount),
    status: row.status,
    parcelStatus: draftInfo?.status || null,
    customerName: draftInfo?.sender_name || "Customer",
    customerPhone: draftInfo?.sender_phone || undefined,
    receiverName: draftInfo?.receiver_name || "Recipient",
    receiverPhone: draftInfo?.receiver_phone || undefined,
    deliveryMode: draftInfo?.delivery_mode || 'direct',
    packageSize: "Small",
    timeLimit: undefined,
    packageDescription: undefined,
    specialInstructions: undefined,
    rating: null,
    parcelDraftId: row.parcel_draft_id,
    acceptedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    completedAt: null,
    createdAt: null,
    updatedAt: null,
  };
}

@Injectable()
export class DriverDashboardService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly googleMapsService: GoogleMapsService,
  ) {}

  private async ensureStorageBucket(bucketName: string, isPublic = true) {
    const admin = this.supabaseService.createAdminClient();
    const bucketResult = await admin.storage.getBucket(bucketName);

    if (!bucketResult.error && bucketResult.data) {
      return;
    }

    const createResult = await admin.storage.createBucket(bucketName, {
      public: isPublic,
      fileSizeLimit: 5 * 1024 * 1024,
    });

    if (createResult.error && !/already exists/i.test(createResult.error.message || "")) {
      throw new InternalServerErrorException(
        `Unable to prepare storage bucket "${bucketName}": ${createResult.error.message || "unknown error"}`,
      );
    }
  }

  private assertDriver(session: SessionPayload) {
    if (session.role !== "driver") {
      throw new ForbiddenException("Only drivers can access this dashboard.");
    }
  }

  private async ensureDriverPresence(driverUserId: string) {
    const admin = this.supabaseService.createAdminClient();
    const existing = await admin
      .schema("driver")
      .from("driver_profiles")
      .select("id, is_online, acceptance_rate, vehicle_type, documents_status")
      .eq("id", driverUserId)
      .maybeSingle<DriverPresenceRow>();

    if (existing.error) {
      throw new InternalServerErrorException("Unable to load driver profile details.");
    }

    if (existing.data) {
      return existing.data;
    }

    const inserted = await admin
      .schema("driver")
      .from("driver_profiles")
      .insert({
        id: driverUserId,
        is_online: false,
      })
      .select("id, is_online, acceptance_rate, vehicle_type, documents_status")
      .single<DriverPresenceRow>();

    if (inserted.error || !inserted.data) {
      return {
        id: driverUserId,
        is_online: false,
        acceptance_rate: 0,
        vehicle_type: null,
        documents_status: null,
      };
    }

    return inserted.data;
  }

  private async listDashboardJobs(driverUserId: string) {
    const admin = this.supabaseService.createAdminClient();
    const [availableResult, assignedResult] = await Promise.all([
      admin
        .schema("driver").from("driver_jobs")
        .select("*")
        .eq("status", "available")
        .is("driver_id", null)
        .order("id", { ascending: false })
        .limit(25),
      admin
        .schema("driver").from("driver_jobs")
        .select("*")
        .eq("driver_id", driverUserId)
        .in("status", ["in-progress", "completed"])
        .order("id", { ascending: false })
        .limit(50),
    ]);

    if (availableResult.error || assignedResult.error) {
      console.error('--- DASHBOARD JOBS ERROR ---');
      console.error('Available:', availableResult.error);
      console.error('Assigned:', assignedResult.error);
      throw new InternalServerErrorException("Unable to load driver jobs from the parcel schema.");
    }

    return [
      ...((availableResult.data ?? []) as DriverJobRow[]),
      ...((assignedResult.data ?? []) as DriverJobRow[]),
    ];
  }

  private async loadDriverMetrics(driverUserId: string, now: Date) {
    const admin = this.supabaseService.createAdminClient();
    const dayStart = startOfPhilippineDay(now).toISOString();

    const [completedTodayResult, deliveriesTodayResult] = await Promise.all([
      admin
        .schema("driver").from("driver_jobs")
        .select("earnings")
        .eq("driver_id", driverUserId)
        .eq("status", "completed"),
      admin
        .schema("driver").from("driver_jobs")
        .select("id", { count: "exact", head: true })
        .eq("driver_id", driverUserId),
    ]);

    if (
      completedTodayResult.error ||
      deliveriesTodayResult.error
    ) {
      console.error('--- DASHBOARD METRICS ERROR ---');
      console.error('Completed:', completedTodayResult.error);
      console.error('Deliveries:', deliveriesTodayResult.error);
      throw new InternalServerErrorException("Unable to load driver metrics from the parcel schema.");
    }

    const earnings = (completedTodayResult.data ?? []).reduce((total, row) => {
      return total + asNumber((row as { earnings?: number | string | null }).earnings);
    }, 0);

    return {
      todaysEarnings: earnings,
      deliveriesToday: deliveriesTodayResult.count ?? 0,
      ratingAverage: null,
    };
  }

  private async loadDashboardSnapshot(session: SessionPayload) {
    const now = new Date();
    const [jobs, driverPresence, metrics] = await Promise.all([
      this.listDashboardJobs(session.userId),
      this.ensureDriverPresence(session.userId),
      this.loadDriverMetrics(session.userId, now),
    ]);

    const admin = this.supabaseService.createAdminClient();
    const draftIds = jobs.map(j => j.parcel_draft_id).filter(Boolean) as string[];
    const draftsMap = new Map<string, any>();
    if (draftIds.length > 0) {
      const { data: drafts } = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("id, sender_name, sender_phone, receiver_name, receiver_phone, delivery_mode, pickup_address, delivery_address")
        .in("id", draftIds);
      if (drafts) {
        for (const draft of drafts) {
          draftsMap.set(draft.id, draft);
        }
      }
    }

    return {
      metrics: {
        todaysEarnings: metrics.todaysEarnings,
        todaysEarningsLabel: formatCurrency(metrics.todaysEarnings),
        deliveriesToday: metrics.deliveriesToday,
        ratingAverage: metrics.ratingAverage,
        onlineSeconds: 0,
      },
      presence: {
        isOnline: driverPresence.is_online,
        currentSessionStartedAt: null,
        lastSeenAt: null,
      },
      jobs: jobs.map(job => mapJob(job, job.parcel_draft_id ? draftsMap.get(job.parcel_draft_id) : null)),
      meta: {
        currency: "PHP",
        refreshedAt: now.toISOString(),
        source: "driver_jobs, driver_profiles",
      },
    };
  }

  async getDashboard(session: SessionPayload) {
    this.assertDriver(session);
    return this.loadDashboardSnapshot(session);
  }

  async getJobDetail(session: SessionPayload, jobId: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("driver").from("driver_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle<DriverJobRow>();

    if (error || !data) {
      throw new NotFoundException("Delivery job not found.");
    }

    let draftInfo: any = null;
    if (data.parcel_draft_id) {
      const { data: draft } = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("id, sender_name, sender_phone, receiver_name, receiver_phone, delivery_mode, pickup_address, delivery_address")
        .eq("id", data.parcel_draft_id)
        .maybeSingle();
      draftInfo = draft;
    }

    return mapJob(data, draftInfo);
  }

  async updatePresence(session: SessionPayload, isOnline: boolean) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    const updates: Record<string, unknown> = {
      is_online: isOnline,
    };

    const result = await admin
      .schema("driver")
      .from("driver_profiles")
      .update(updates)
      .eq("id", session.userId);

    if (result.error) {
      throw new InternalServerErrorException("Unable to update driver availability.");
    }

    return this.loadDashboardSnapshot(session);
  }

  async acceptJob(session: SessionPayload, jobId: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();

    const [activeJobsResult, jobResult] = await Promise.all([
      admin
        .schema("driver").from("driver_jobs")
        .select("id, parcel_draft_id")
        .eq("driver_id", session.userId)
        .eq("status", "in-progress"),
      admin
        .schema("driver").from("driver_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle<DriverJobRow>(),
    ]);

    if (activeJobsResult.error || jobResult.error) {
      throw new InternalServerErrorException("Unable to accept this job right now.");
    }

    const job = jobResult.data;
    if (!job || job.status !== "available" || job.driver_id) {
      throw new NotFoundException("This delivery job is no longer available.");
    }

    // Determine target job service type and retrieve pickup/delivery details
    let targetServiceId = "direct";
    let draftData = null;
    if (job.parcel_draft_id) {
      const { data: draft, error: draftError } = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("service_id, delivery_mode, pickup_address, delivery_address")
        .eq("id", job.parcel_draft_id)
        .maybeSingle();
      if (draftError) {
        console.error("[acceptJob] Error fetching draft:", draftError);
      }
      if (draft) {
        draftData = draft;
        if (draft.service_id) {
          targetServiceId = draft.service_id;
        }
      }
    }

    // Determine active jobs service types
    const activeDraftIds = (activeJobsResult.data ?? [])
      .map((j) => j.parcel_draft_id)
      .filter(Boolean) as string[];

    let hasActiveDirect = false;
    let activeRelayCount = 0;

    if (activeDraftIds.length > 0) {
      const { data: activeDrafts } = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("id, service_id, delivery_mode")
        .in("id", activeDraftIds);

      if (activeDrafts) {
        for (const draft of activeDrafts) {
          if (draft.delivery_mode === "relay" || draft.service_id?.toLowerCase() === "pakishare") {
            activeRelayCount++;
          } else {
            hasActiveDirect = true;
          }
        }
      }
    }

    const isTargetRelay = draftData?.delivery_mode === "relay" || targetServiceId?.toLowerCase() === "pakishare";

    console.log(`[acceptJob DEBUG] jobId=${jobId}`);
    console.log(`[acceptJob DEBUG] draftData=`, draftData);
    console.log(`[acceptJob DEBUG] targetServiceId=${targetServiceId}`);
    console.log(`[acceptJob DEBUG] hasActiveDirect=${hasActiveDirect}, activeRelayCount=${activeRelayCount}`);
    console.log(`[acceptJob DEBUG] isTargetRelay=${isTargetRelay}`);

    if (isTargetRelay) {
      // Cannot book relay if there is an active direct delivery in progress
      if (hasActiveDirect) {
        console.log(`[acceptJob DEBUG] Throwing Relay Error`);
        throw new BadRequestException(
          "You cannot accept a relay (PakiShare) delivery while you have an active direct delivery in progress."
        );
      }
      // Maximum 10 relay deliveries allowed
      if (activeRelayCount >= 10) {
        console.log(`[acceptJob DEBUG] Throwing Max Relay Error`);
        throw new BadRequestException(
          "You cannot accept more than 10 relay deliveries at the same time."
        );
      }
    } else {
      // Direct driver can only book/accept one booking per session
      if (hasActiveDirect || activeRelayCount > 0) {
        console.log(`[acceptJob DEBUG] Throwing Direct Error`);
        throw new BadRequestException(
          "You cannot accept a direct delivery while you have other active deliveries in progress."
        );
      }
    }

    const now = new Date().toISOString();
    const updateResult = await admin
      .schema("driver").from("driver_jobs")
      .update({
        driver_id: session.userId,
        status: "in-progress",
      })
      .eq("id", jobId)
      .is("driver_id", null)
      .eq("status", "available");

    if (updateResult.error) {
      throw new InternalServerErrorException("Unable to assign the delivery job.");
    }

    // NEW: Link the driver back to the parcel draft so the customer can see them
    if (job.parcel_draft_id) {
      await admin
        .schema("parcel")
        .from("parcel_drafts")
        .update({ 
          assigned_driver_id: session.userId,
          tracking_progress_percentage: 25,
          status: "accepted",
        })
        .eq("id", job.parcel_draft_id);

      try {
        await admin
          .schema("location")
          .from("parcel_tracking_events")
          .insert({
            parcel_draft_id: job.parcel_draft_id,
            status: "ACCEPTED",
            location_label: draftData?.pickup_address || "Preparing for Pickup",
            lat: draftData?.pickup_lat ? Number(draftData.pickup_lat) : null,
            lng: draftData?.pickup_lng ? Number(draftData.pickup_lng) : null,
            occurred_at: now,
          });
      } catch (err) {
        console.warn("[acceptJob] Tracking event insertion failed (non-blocking):", err.message);
      }
    }

    try {
      await admin
        .schema("public")
        .from("driver_job_events").insert({
        job_id: jobId,
        driver_user_id: session.userId,
        event_type: "job_accepted",
        payload: { status: "in-progress" },
        created_at: now,
      });
    } catch (err) {
      console.warn('[acceptJob] Event logging failed (non-blocking):', err.message);
    }

    await this.recalculateAcceptanceRate(session.userId);

    return this.loadDashboardSnapshot(session);
  }

  async recalculateAcceptanceRate(driverUserId: string) {
    const admin = this.supabaseService.createAdminClient();
    
    // Count job_accepted
    const { count: acceptedCount, error: acceptedError } = await admin
      .schema("public")
      .from("driver_job_events")
      .select("*", { count: "exact", head: true })
      .eq("driver_user_id", driverUserId)
      .eq("event_type", "job_accepted");

    // Count job_cancelled
    const { count: cancelledCount, error: cancelledError } = await admin
      .schema("public")
      .from("driver_job_events")
      .select("*", { count: "exact", head: true })
      .eq("driver_user_id", driverUserId)
      .eq("event_type", "job_cancelled");

    if (acceptedError || cancelledError) {
      console.warn("Failed to recalculate acceptance rate:", acceptedError || cancelledError);
      return;
    }

    const totalAccepted = acceptedCount || 0;
    const totalCancelled = cancelledCount || 0;
    
    let rate = 1.0;
    if (totalAccepted > 0) {
      rate = (totalAccepted - totalCancelled) / totalAccepted;
      if (rate < 0) rate = 0;
      rate = Math.round(rate * 100) / 100;
    }

    await admin
      .schema("driver")
      .from("driver_profiles")
      .update({ acceptance_rate: rate })
      .eq("id", driverUserId);
  }

  async cancelJob(session: SessionPayload, jobId: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();

    const jobResult = await admin
      .schema("driver").from("driver_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("driver_id", session.userId)
      .eq("status", "in-progress")
      .maybeSingle<DriverJobRow>();

    if (jobResult.error || !jobResult.data) {
      throw new BadRequestException("Job not found or cannot be cancelled.");
    }
    
    const job = jobResult.data;

    if (job.parcel_draft_id) {
       const draftRes = await admin.schema("parcel").from("parcel_drafts").select("status").eq("id", job.parcel_draft_id).maybeSingle();
       if (draftRes.data && draftRes.data.status !== "accepted") {
          throw new BadRequestException("You can only cancel jobs before they are picked up.");
       }

       await admin.schema("parcel").from("parcel_drafts").update({
         assigned_driver_id: null,
         status: "submitted",
         tracking_progress_percentage: 0
       }).eq("id", job.parcel_draft_id);
    }

    await admin.schema("driver").from("driver_jobs").update({
      driver_id: null,
      status: "available"
    }).eq("id", jobId);

    await admin.schema("public").from("driver_job_events").insert({
      job_id: jobId,
      driver_user_id: session.userId,
      event_type: "job_cancelled",
      payload: { reason: "Driver cancelled before pickup" },
      created_at: new Date().toISOString()
    });

    await this.recalculateAcceptanceRate(session.userId);

    return this.loadDashboardSnapshot(session);
  }

  async rejectJob(session: SessionPayload, jobId: string, reason?: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();

    // Decrement acceptance rate logic could go here
    const now = new Date().toISOString();
    try {
      await admin
        .schema("public")
        .from("driver_job_events").insert({
        job_id: jobId,
        driver_user_id: session.userId,
        event_type: "job_rejected",
        payload: { reason },
        created_at: now,
      });
    } catch (err) {
      console.warn('[rejectJob] Event logging failed (non-blocking):', err.message);
    }

    return { status: "rejected" };
  }

  async updateParcelStatus(session: SessionPayload, jobId: string, parcelStatus: string) {
    this.assertDriver(session);

    if (!VALID_PARCEL_STATUSES.has(parcelStatus as Exclude<ParcelStatus, null>)) {
      throw new BadRequestException("Invalid parcel status.");
    }

    const admin = this.supabaseService.createAdminClient();
    console.log(`Updating status for jobId: ${jobId} (Driver: ${session.userId})`);
    
    const jobResult = await admin
      .schema("driver").from("driver_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("driver_id", session.userId)
      .maybeSingle<DriverJobRow>();

    if (jobResult.error) {
      console.error("SELECT job failed:", jobResult.error);
      throw new InternalServerErrorException(`Unable to update parcel status: ${jobResult.error.message}`);
    }

    const job = jobResult.data;
    if (!job) {
      throw new NotFoundException("Driver job not found.");
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: parcelStatus === "delivered" ? "completed" : "in-progress",
    };

    console.log(`Saving updates for jobId: ${jobId}`, updates);
    const updateResult = await admin
      .schema("driver").from("driver_jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("driver_id", session.userId);

    if (updateResult.error) {
      console.error("UPDATE job failed:", updateResult.error);
      throw new InternalServerErrorException(`Unable to save the parcel status: ${updateResult.error.message}`);
    }

    if (job.parcel_draft_id) {
      const percentage = 
        parcelStatus === "picked-up" ? 50 : 
        parcelStatus === "out-for-delivery" ? 75 : 100;

      const draftUpdates: any = {
        tracking_progress_percentage: percentage,
        status: parcelStatus === "picked-up" ? "picked-up" :
                parcelStatus === "out-for-delivery" ? "out-for-delivery" : "delivered",
      };

      await admin
        .schema("parcel")
        .from("parcel_drafts")
        .update(draftUpdates)
        .eq("id", job.parcel_draft_id);

      try {
        const { data: draft } = await admin
          .schema("parcel")
          .from("parcel_drafts")
          .select("pickup_address, pickup_lat, pickup_lng, delivery_address, delivery_lat, delivery_lng")
          .eq("id", job.parcel_draft_id)
          .maybeSingle();

        const eventStatus = 
          parcelStatus === "picked-up" ? "PICKED_UP" :
          parcelStatus === "out-for-delivery" ? "OUT_FOR_DELIVERY" : "DELIVERED";

        const locationLabel = 
          parcelStatus === "picked-up" ? (draft?.pickup_address || "Picked Up") : (draft?.delivery_address || "Delivered");

        const eventLat = 
          parcelStatus === "picked-up" ? draft?.pickup_lat : draft?.delivery_lat;

        const eventLng = 
          parcelStatus === "picked-up" ? draft?.pickup_lng : draft?.delivery_lng;

        await admin
          .schema("location")
          .from("parcel_tracking_events")
          .insert({
            parcel_draft_id: job.parcel_draft_id,
            status: eventStatus,
            location_label: locationLabel,
            lat: eventLat ? Number(eventLat) : null,
            lng: eventLng ? Number(eventLng) : null,
            occurred_at: now,
          });
      } catch (err) {
        console.warn("[updateParcelStatus] Tracking event insertion failed (non-blocking):", err.message);
      }
    }

    try {
      await admin
        .schema("public")
        .from("driver_job_events").insert({
        job_id: jobId,
        driver_user_id: session.userId,
        event_type: "parcel_status_updated",
        payload: {
          parcelStatus,
          nextJobStatus: parcelStatus === "delivered" ? "completed" : "in-progress",
        },
        created_at: now,
      });
    } catch (err) {
      console.warn('[updateParcelStatus] Event logging failed (non-blocking):', err.message);
    }

    return this.loadDashboardSnapshot(session);
  }

  async getEarnings(session: SessionPayload, period: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    let startDate: Date;

    const now = new Date();
    switch (period) {
      case "today":
        startDate = startOfPhilippineDay(now);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        throw new BadRequestException("Invalid period.");
    }

    const result = await admin
      .schema("driver").from("driver_jobs")
      .select("id, job_number, earnings")
      .eq("driver_id", session.userId)
      .eq("status", "completed")
      .order("id", { ascending: false });

    if (result.error) {
      throw new InternalServerErrorException("Unable to load earnings.");
    }

    const jobs = result.data ?? [];
    const totalAmount = jobs.reduce((sum, job) => sum + asNumber((job as any).earnings), 0);
    const completedJobs = jobs.length;
    const breakdown = jobs.map(job => ({
      jobId: job.id,
      jobNumber: job.job_number,
      amount: asNumber((job as any).earnings),
      earnedAt: null,
    }));

    return {
      totalAmount,
      completedJobs,
      breakdown,
    };
  }

  async getInternalSummary(driverId: string) {
    const admin = this.supabaseService.createAdminClient();
    const profileRes = await admin
      .schema("account")
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", driverId)
      .single();

    if (profileRes.error || !profileRes.data) return null;

    return {
      driverId: profileRes.data.id,
      name: profileRes.data.full_name,
      phone: profileRes.data.phone,
      vehicleType: "Motorcycle",
      plateNumber: "PKS-4321",
      location: null,
    };
  }

  async getProfile(session: SessionPayload) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    const [profileRes, driverPresence] = await Promise.all([
      admin.schema("account").from("profiles").select("*").eq("id", session.userId).single(),
      this.ensureDriverPresence(session.userId),
    ]);

    if (profileRes.error) throw new InternalServerErrorException("Profile not found.");

    return {
      id: profileRes.data.id,
      fullName: profileRes.data.full_name,
      email: profileRes.data.email,
      phone: profileRes.data.phone,
      address: profileRes.data.address,
      dob: profileRes.data.dob,
      vehicleType: driverPresence.vehicle_type || "Motorcycle",
      licenseNumber: "N/A",
      plateNumber: "PKS-4321",
      isOnline: driverPresence.is_online,
      acceptanceRate: asNumber(driverPresence.acceptance_rate),
      documentsStatus: driverPresence.documents_status || "approved",
      profilePicture: profileRes.data.profile_picture,
    };
  }

  async uploadProfilePicture(session: SessionPayload, file: UploadedFile | undefined) {
    this.assertDriver(session);

    assertAllowedFile(file, {
      maxSizeBytes: MAX_AVATAR_SIZE_BYTES,
      allowedTypes: ["image/jpeg", "image/png", "image/webp"],
      emptyMessage: "Please choose an image to upload.",
    });

    await this.ensureStorageBucket(PROFILE_IMAGE_BUCKET, true);

    const admin = this.supabaseService.createAdminClient();
    const extension = getFileExtension(file.originalname);
    const objectPath = `${session.userId}/avatar-${randomUUID()}.${extension}`;
    const uploadResult = await admin.storage.from(PROFILE_IMAGE_BUCKET).upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

    if (uploadResult.error) {
      throw new InternalServerErrorException(
        `Unable to upload your profile image: ${uploadResult.error.message || "storage upload failed"}.`,
      );
    }

    const { data: publicUrlData } = admin.storage
      .from(PROFILE_IMAGE_BUCKET)
      .getPublicUrl(objectPath);
    const profilePicture = publicUrlData.publicUrl;

    const { error } = await admin
      .schema("account")
      .from("profiles")
      .update({ profile_picture: profilePicture })
      .eq("id", session.userId);

    if (error) {
      throw new InternalServerErrorException(
        `Profile picture uploaded but could not be saved: ${error.message || "profile update failed"}.`,
      );
    }

    return {
      profilePicture,
    };
  }

  async updateProfile(session: SessionPayload, body: Record<string, any>) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    
    const updates: Record<string, any> = {};
    if (body.fullName) updates.full_name = String(body.fullName).trim();
    if (body.email) updates.email = String(body.email).trim().toLowerCase();
    if (body.phone) updates.phone = String(body.phone).replace(/\D/g, "").slice(-10);
    if (body.address) updates.address = String(body.address).trim();
    if (body.dob) updates.dob = String(body.dob).trim();

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .schema("account")
        .from("profiles")
        .update(updates)
        .eq("id", session.userId);

      if (error) {
        console.error('--- PROFILE UPDATE DB ERROR ---', error);
        throw new InternalServerErrorException(`Failed to update profile: ${error.message}`);
      }
      console.log(`[DriverService] Database updated successfully with:`, updates);
    }

    // Update auth metadata if name changed
    if (updates.full_name) {
      const authUserResponse = await admin.auth.admin.getUserById(session.userId);
      const currentMetadata = authUserResponse.data.user?.user_metadata ?? {};
      await admin.auth.admin.updateUserById(session.userId, {
        user_metadata: {
          ...currentMetadata,
          full_name: updates.full_name,
        },
      });
    }

    return this.getProfile(session);
  }

  async getJobDistance(session: SessionPayload, jobId: string, driverCoords: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    const jobResult = await admin
      .schema("driver").from("driver_jobs")
      .select("parcel_draft_id, status")
      .eq("id", jobId)
      .maybeSingle();

    if (jobResult.error || !jobResult.data) {
      throw new NotFoundException("Job not found.");
    }

    const job = jobResult.data;
    let destination = "Unknown destination";
    if ((job as any).parcel_draft_id) {
      const { data: draft } = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("pickup_address, delivery_address")
        .eq("id", (job as any).parcel_draft_id)
        .maybeSingle();
      destination = job.status === "available" ? (draft?.pickup_address || "Pickup") : (draft?.delivery_address || "Dropoff");
    }

    try {
      const matrix = await this.googleMapsService.getDistanceMatrix(driverCoords, destination);
      const element = matrix?.rows?.[0]?.elements?.[0];

      if (element?.status === 'OK') {
        return {
          distance: element.distance.text,
          duration: element.duration.text,
          destination,
          status: job.status,
        };
      }
    } catch (error) {
      console.error('Job distance calculation failed:', error);
    }

    return {
      distance: "TBD",
      duration: "TBD",
      destination,
      status: job.status,
    };
  }

  async createJobFromDraft(draft: any, items: any[]) {
    console.log(`[createJobFromDraft] Starting for draft: ${draft.id}`);
    const admin = this.supabaseService.createAdminClient();
    const firstItem = items[0];

    // Fetch the actual customer name from their profile instead of just using the draft sender_name
    const { data: profile } = await admin
      .schema("account")
      .from("profiles")
      .select("full_name")
      .eq("id", draft.user_id)
      .maybeSingle();

    // Prioritize profile name if the sender_name is generic like "Customer Test" or "Me"
    const isGeneric = !draft.sender_name || 
                     draft.sender_name.toLowerCase().includes('customer') || 
                     draft.sender_name.toLowerCase().includes('test') || 
                     draft.sender_name.toLowerCase() === 'me';
                     
    const customerName = isGeneric ? (profile?.full_name || draft.sender_name || "Customer") : draft.sender_name;
    console.log(`[createJobFromDraft] Customer resolved: ${customerName} (ID: ${draft.user_id})`);

    const { error } = await admin
      .schema("driver").from("driver_jobs")
      .insert({
        job_number: draft.tracking_number || `JOB-${Math.floor(Math.random() * 10000)}`,
        parcel_draft_id: draft.id,
        driver_id: null,
        status: "available",
        earnings: draft.service_price ? Number(draft.service_price) * 0.7 : 85,
      });

    if (error) {
      console.error("[createJobFromDraft] Failed to create driver job:", error);
    } else {
      console.log(`[createJobFromDraft] Success! Job created for ${customerName}`);
    }
  }

  async updateLocation(session: SessionPayload, lat: number, lng: number) {
    this.assertDriver(session);
    return { success: true };
  }
}
