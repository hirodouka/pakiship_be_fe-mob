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
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  distance_text: string | null;
  earnings_amount: number | string | null;
  status: JobStatus;
  parcel_status: ParcelStatus;
  customer_name: string;
  package_size: "Small" | "Medium" | "Large";
  time_limit_text: string | null;
  customer_phone: string | null;
  package_description: string | null;
  special_instructions: string | null;
  rating: number | string | null;
  parcel_draft_id: string | null;
  driver_user_id: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type DriverSessionRow = {
  driver_user_id: string;
  is_online: boolean;
  current_session_started_at: string | null;
  accumulated_online_seconds: number | null;
  last_seen_at: string | null;
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

function computeOnlineSeconds(session: DriverSessionRow | null, now = new Date()) {
  if (!session) return 0;

  const baseSeconds = Math.max(0, session.accumulated_online_seconds ?? 0);
  if (!session.is_online || !session.current_session_started_at) {
    return baseSeconds;
  }

  const sessionStart = new Date(session.current_session_started_at);
  if (Number.isNaN(sessionStart.getTime())) {
    return baseSeconds;
  }

  const liveSeconds = Math.max(0, Math.floor((now.getTime() - sessionStart.getTime()) / 1000));
  return baseSeconds + liveSeconds;
}

function mapJob(row: DriverJobRow) {
  const earningsAmount = asNumber(row.earnings_amount);
  return {
    id: row.id,
    jobNumber: row.job_number,
    pickup: row.pickup_address,
    pickupLocation: row.pickup_lat ? { lat: row.pickup_lat, lng: row.pickup_lng, address: row.pickup_address } : null,
    dropoff: row.dropoff_address,
    dropoffLocation: row.dropoff_lat ? { lat: row.dropoff_lat, lng: row.dropoff_lng, address: row.dropoff_address } : null,
    distance: row.distance_text || "TBD",
    earningsAmount,
    earnings: formatCurrency(earningsAmount),
    status: row.status,
    parcelStatus: row.parcel_status,
    customerName: row.customer_name,
    packageSize: row.package_size,
    timeLimit: row.time_limit_text || undefined,
    customerPhone: row.customer_phone || undefined,
    packageDescription: row.package_description || undefined,
    specialInstructions: row.special_instructions || undefined,
    rating: row.rating === null ? null : asNumber(row.rating),
    parcelDraftId: row.parcel_draft_id,
    acceptedAt: row.accepted_at,
    pickedUpAt: row.picked_up_at,
    deliveredAt: row.delivered_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

  private async ensureDriverSession(driverUserId: string) {
    const admin = this.supabaseService.createAdminClient();
    const existing = await admin
      .schema("parcel")
      .from("driver_sessions")
      .select(
        "driver_user_id, is_online, current_session_started_at, accumulated_online_seconds, last_seen_at",
      )
      .eq("driver_user_id", driverUserId)
      .maybeSingle<DriverSessionRow>();

    if (existing.error) {
      throw new InternalServerErrorException("Unable to load driver session details.");
    }

    if (existing.data) {
      return existing.data;
    }

    const inserted = await admin
      .schema("parcel")
      .from("driver_sessions")
      .insert({
        driver_user_id: driverUserId,
        is_online: false,
        accumulated_online_seconds: 0,
        last_seen_at: new Date().toISOString(),
      })
      .select(
        "driver_user_id, is_online, current_session_started_at, accumulated_online_seconds, last_seen_at",
      )
      .single<DriverSessionRow>();

    if (inserted.error || !inserted.data) {
      throw new InternalServerErrorException("Unable to initialize driver session details.");
    }

    return inserted.data;
  }

  private async listDashboardJobs(driverUserId: string) {
    const admin = this.supabaseService.createAdminClient();
    const [availableResult, assignedResult] = await Promise.all([
      admin
        .schema("parcel")
        .from("driver_jobs")
        .select("*")
        .eq("status", "available")
        .is("driver_user_id", null)
        .order("created_at", { ascending: false })
        .limit(25),
      admin
        .schema("parcel")
        .from("driver_jobs")
        .select("*")
        .eq("driver_user_id", driverUserId)
        .in("status", ["in-progress", "completed"])
        .order("updated_at", { ascending: false })
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

    const [completedTodayResult, deliveriesTodayResult, ratingsResult] = await Promise.all([
      admin
        .schema("parcel")
        .from("driver_jobs")
        .select("earnings_amount")
        .eq("driver_user_id", driverUserId)
        .eq("status", "completed")
        .gte("completed_at", dayStart),
      admin
        .schema("parcel")
        .from("driver_jobs")
        .select("id", { count: "exact", head: true })
        .eq("driver_user_id", driverUserId)
        .or(`accepted_at.gte.${dayStart},completed_at.gte.${dayStart}`),
      admin
        .schema("parcel")
        .from("driver_jobs")
        .select("rating")
        .eq("driver_user_id", driverUserId)
        .eq("status", "completed")
        .not("rating", "is", null),
    ]);

    if (
      completedTodayResult.error ||
      deliveriesTodayResult.error ||
      ratingsResult.error
    ) {
      console.error('--- DASHBOARD METRICS ERROR ---');
      console.error('Completed:', completedTodayResult.error);
      console.error('Deliveries:', deliveriesTodayResult.error);
      console.error('Ratings:', ratingsResult.error);
      throw new InternalServerErrorException("Unable to load driver metrics from the parcel schema.");
    }

    const earnings = (completedTodayResult.data ?? []).reduce((total, row) => {
      return total + asNumber((row as { earnings_amount?: number | string | null }).earnings_amount);
    }, 0);

    const ratingValues = (ratingsResult.data ?? [])
      .map((row) => asNumber((row as { rating?: number | string | null }).rating))
      .filter((value) => value > 0);

    const ratingAverage =
      ratingValues.length > 0
        ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
        : null;

    return {
      todaysEarnings: earnings,
      deliveriesToday: deliveriesTodayResult.count ?? 0,
      ratingAverage,
    };
  }

  private async loadDashboardSnapshot(session: SessionPayload) {
    const now = new Date();
    const [jobs, driverSession, metrics] = await Promise.all([
      this.listDashboardJobs(session.userId),
      this.ensureDriverSession(session.userId),
      this.loadDriverMetrics(session.userId, now),
    ]);

    return {
      metrics: {
        todaysEarnings: metrics.todaysEarnings,
        todaysEarningsLabel: formatCurrency(metrics.todaysEarnings),
        deliveriesToday: metrics.deliveriesToday,
        ratingAverage: metrics.ratingAverage,
        onlineSeconds: computeOnlineSeconds(driverSession, now),
      },
      presence: {
        isOnline: driverSession.is_online,
        currentSessionStartedAt: driverSession.current_session_started_at,
        lastSeenAt: driverSession.last_seen_at,
      },
      jobs: jobs.map(mapJob),
      meta: {
        currency: "PHP",
        refreshedAt: now.toISOString(),
        source: "driver_jobs, driver_sessions",
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
      .schema("parcel")
      .from("driver_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle<DriverJobRow>();

    if (error || !data) {
      throw new NotFoundException("Delivery job not found.");
    }

    return mapJob(data);
  }

  async updatePresence(session: SessionPayload, isOnline: boolean) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    const current = await this.ensureDriverSession(session.userId);
    const now = new Date();
    const updates: Record<string, unknown> = {
      is_online: isOnline,
      last_seen_at: now.toISOString(),
    };

    if (isOnline && !current.is_online) {
      updates.current_session_started_at = now.toISOString();
    }

    if (!isOnline && current.is_online) {
      updates.accumulated_online_seconds = computeOnlineSeconds(current, now);
      updates.current_session_started_at = null;
    }

    const result = await admin
      .schema("parcel")
      .from("driver_sessions")
      .update(updates)
      .eq("driver_user_id", session.userId);

    if (result.error) {
      throw new InternalServerErrorException("Unable to update driver availability.");
    }

    return this.loadDashboardSnapshot(session);
  }

  async acceptJob(session: SessionPayload, jobId: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();

    const [activeJobResult, jobResult] = await Promise.all([
      admin
        .schema("parcel")
        .from("driver_jobs")
        .select("id", { count: "exact", head: true })
        .eq("driver_user_id", session.userId)
        .eq("status", "in-progress"),
      admin
        .schema("parcel")
        .from("driver_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle<DriverJobRow>(),
    ]);

    if (activeJobResult.error || jobResult.error) {
      throw new InternalServerErrorException("Unable to accept this job right now.");
    }

    if ((activeJobResult.count ?? 0) > 0) {
      throw new BadRequestException("Complete your active delivery before accepting a new one.");
    }

    const job = jobResult.data;
    if (!job || job.status !== "available" || job.driver_user_id) {
      throw new NotFoundException("This delivery job is no longer available.");
    }

    const now = new Date().toISOString();
    const updateResult = await admin
      .schema("parcel")
      .from("driver_jobs")
      .update({
        driver_user_id: session.userId,
        status: "in-progress",
        accepted_at: now,
        updated_at: now,
      })
      .eq("id", jobId)
      .is("driver_user_id", null)
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
          tracking_progress_label: "Confirmed",
          tracking_progress_percentage: 25,
          updated_at: now
        })
        .eq("id", job.parcel_draft_id);
    }

    await admin
      .schema("parcel")
      .from("driver_job_events").insert({
      job_id: jobId,
      driver_user_id: session.userId,
      event_type: "job_accepted",
      payload: { status: "in-progress" },
      created_at: now,
    });

    return this.loadDashboardSnapshot(session);
  }

  async rejectJob(session: SessionPayload, jobId: string, reason?: string) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();

    // Decrement acceptance rate logic could go here
    const now = new Date().toISOString();
    await admin
      .schema("parcel")
      .from("driver_job_events").insert({
      job_id: jobId,
      driver_user_id: session.userId,
      event_type: "job_rejected",
      payload: { reason },
      created_at: now,
    });

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
      .schema("parcel")
      .from("driver_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("driver_user_id", session.userId)
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
      parcel_status: parcelStatus,
      updated_at: now,
    };

    if (parcelStatus === "picked-up") {
      updates.picked_up_at = now;
    }

    if (parcelStatus === "delivered") {
      updates.status = "completed";
      updates.delivered_at = now;
      updates.completed_at = now;
    }

    console.log(`Saving updates for jobId: ${jobId}`, updates);
    const updateResult = await admin
      .schema("parcel")
      .from("driver_jobs")
      .update(updates)
      .eq("id", jobId)
      .eq("driver_user_id", session.userId);

    if (updateResult.error) {
      console.error("UPDATE job failed:", updateResult.error);
      throw new InternalServerErrorException(`Unable to save the parcel status: ${updateResult.error.message}`);
    }

    if (job.parcel_draft_id) {
      const label =
        parcelStatus === "picked-up"
          ? "Picked Up"
          : parcelStatus === "out-for-delivery"
            ? "Out for Delivery"
            : "Delivered";
            
      const percentage = 
        parcelStatus === "picked-up" ? 50 : 
        parcelStatus === "out-for-delivery" ? 75 : 100;

      const draftUpdates: any = {
        tracking_progress_label: label,
        tracking_progress_percentage: percentage,
        updated_at: now,
      };

      if (parcelStatus === "delivered") {
        draftUpdates.status = "delivered";
      }

      await admin
        .schema("parcel")
        .from("parcel_drafts")
        .update(draftUpdates)
        .eq("id", job.parcel_draft_id);
    }

    await admin
      .schema("parcel")
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
      .schema("parcel")
      .from("driver_jobs")
      .select("id, job_number, earnings_amount, completed_at")
      .eq("driver_user_id", session.userId)
      .eq("status", "completed")
      .gte("completed_at", startDate.toISOString())
      .order("completed_at", { ascending: false });

    if (result.error) {
      throw new InternalServerErrorException("Unable to load earnings.");
    }

    const jobs = result.data ?? [];
    const totalAmount = jobs.reduce((sum, job) => sum + asNumber(job.earnings_amount), 0);
    const completedJobs = jobs.length;
    const breakdown = jobs.map(job => ({
      jobId: job.id,
      jobNumber: job.job_number,
      amount: asNumber(job.earnings_amount),
      earnedAt: job.completed_at,
    }));

    return {
      totalAmount,
      completedJobs,
      breakdown,
    };
  }

  async getInternalSummary(driverId: string) {
    const admin = this.supabaseService.createAdminClient();
    const [profileRes, sessionRes] = await Promise.all([
      admin
        .schema("account")
        .from("profiles")
        .select("id, full_name, phone, vehicle_type, plate_number")
        .eq("id", driverId)
        .single(),
      admin
        .schema("parcel")
        .from("driver_sessions")
        .select("last_latitude, last_longitude, last_located_at")
        .eq("user_id", driverId)
        .maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) return null;

    return {
      driverId: profileRes.data.id,
      name: profileRes.data.full_name,
      phone: profileRes.data.phone,
      vehicleType: profileRes.data.vehicle_type,
      plateNumber: profileRes.data.plate_number,
      location: sessionRes.data ? {
        lat: sessionRes.data.last_latitude,
        lng: sessionRes.data.last_longitude,
        timestamp: sessionRes.data.last_located_at,
      } : null,
    };
  }

  async getProfile(session: SessionPayload) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    const [profileRes, sessionRes, eventsRes] = await Promise.all([
      admin.schema("account").from("profiles").select("*").eq("id", session.userId).single(),
      this.ensureDriverSession(session.userId),
      admin
        .schema("parcel")
        .from("driver_job_events")
        .select("event_type")
        .eq("driver_user_id", session.userId),
    ]);

    if (profileRes.error) throw new InternalServerErrorException("Profile not found.");

    const events = eventsRes.data ?? [];
    const accepted = events.filter((e) => e.event_type === "job_accepted").length;
    const rejected = events.filter((e) => e.event_type === "job_rejected").length;

    let acceptanceRate = 1.0;
    if (accepted + rejected > 0) {
      acceptanceRate = accepted / (accepted + rejected);
    }

    return {
      id: profileRes.data.id,
      fullName: profileRes.data.full_name,
      email: profileRes.data.email,
      phone: profileRes.data.phone,
      address: profileRes.data.address,
      dob: profileRes.data.dob,
      vehicleType: profileRes.data.vehicle_type,
      licenseNumber: profileRes.data.license_number,
      plateNumber: profileRes.data.plate_number,
      isOnline: sessionRes.is_online,
      acceptanceRate,
      documentsStatus: "approved",
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
      .schema("parcel")
      .from("driver_jobs")
      .select("pickup_address, dropoff_address, status, picked_up_at")
      .eq("id", jobId)
      .maybeSingle();

    if (jobResult.error || !jobResult.data) {
      throw new NotFoundException("Job not found.");
    }

    const job = jobResult.data;
    // If job is available or in-progress but not picked up, distance is to pickup.
    // If job is picked up (in-progress), distance is to dropoff.
    const destination = (job.status === "available" || !job.picked_up_at)
      ? job.pickup_address 
      : job.dropoff_address;

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
      .schema("parcel")
      .from("driver_jobs")
      .insert({
        job_number: draft.tracking_number || `JOB-${Math.floor(Math.random() * 10000)}`,
        pickup_address: draft.pickup_address,
        pickup_lat: draft.pickup_lat,
        pickup_lng: draft.pickup_lng,
        dropoff_address: draft.delivery_address,
        dropoff_lat: draft.delivery_lat,
        dropoff_lng: draft.delivery_lng,
        distance_text: draft.distance_text,
        earnings_amount: draft.service_price ? Number(draft.service_price) * 0.7 : 85,
        status: "available",
        parcel_status: null,
        customer_user_id: draft.user_id,
        customer_name: customerName,
        customer_phone: draft.sender_phone,
        package_size: draft.is_bulk ? "Large" : "Small",
        package_description: "Standard Parcel",
        special_instructions: draft.pickup_details,
        parcel_draft_id: draft.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error("[createJobFromDraft] Failed to create driver job:", error);
    } else {
      console.log(`[createJobFromDraft] Success! Job created for ${customerName}`);
    }
  }

  async updateLocation(session: SessionPayload, lat: number, lng: number) {
    this.assertDriver(session);
    const admin = this.supabaseService.createAdminClient();
    
    const { error } = await admin
      .schema("parcel")
      .from("driver_sessions")
      .update({
        last_latitude: lat,
        last_longitude: lng,
        last_located_at: new Date().toISOString(),
      })
      .eq("user_id", session.userId)
      .eq("is_online", true);

    if (error) {
      // If no online session exists, we don't throw an error, just log it.
      console.log(`[DriverService] Location update skipped: No active online session for ${session.userId}`);
    }

    return { success: true };
  }
}
