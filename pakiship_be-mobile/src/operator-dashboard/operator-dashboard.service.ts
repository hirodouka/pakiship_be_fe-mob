import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { SessionPayload } from "../common/session/session.types";
import { CustomerNotificationsService } from "../customer-notifications/customer-notifications.service";
import { ParcelDraftsRepository } from "../parcel-drafts/parcel-drafts.repository";
import { SupabaseService } from "../supabase/supabase.service";

type HubAssignmentRow = {
  hub_id: string;
  drop_off_points?: { name: string | null; max_capacity: number | null } | null;
};

type MonetaryRow = {
  amount: number | string | null;
};

type ParcelDraftLookupRow = {
  id: string;
  tracking_number: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  receiver_phone: string | null;
  pickup_address: string | null;
  delivery_address: string | null;
  distance_text: string | null;
  service_id: string | null;
  service_price: number | string | null;
  drop_off_point_id: string | null;
  drop_off_point_name: string | null;
  drop_off_point_address: string | null;
  status: string;
  user_id: string | null;
  created_at: string;
  parcel_draft_items?: Array<{
    id: string;
    size: string | null;
    quantity: number | null;
    item_type: string | null;
  }> | null;
};

type ParcelHubRecordRow = {
  id: string;
  hub_id: string;
  status: string;
  storage_location: string | null;
  received_at: string | null;
  picked_up_at: string | null;
  // Note: dispatched_at column is missing in the database schema
  parcel_drafts?: ParcelDraftLookupRow | ParcelDraftLookupRow[] | null;
};

const PH_TIMEZONE_OFFSET_HOURS = 8;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function startOfPhilippineDay(now = new Date()) {
  const shifted = new Date(now.getTime() + PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
}

function startOfPhilippineWeek(now = new Date()) {
  const dayStart = startOfPhilippineDay(now);
  const shifted = new Date(dayStart.getTime() + PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
  const dayOfWeek = shifted.getUTCDay();
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  shifted.setUTCDate(shifted.getUTCDate() - diffToMonday);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
}

function startOfPhilippineMonth(now = new Date()) {
  const shifted = new Date(now.getTime() + PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
  shifted.setUTCDate(1);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - PH_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}

function sumAmounts(rows: MonetaryRow[] | null | undefined) {
  return (rows ?? []).reduce((total, row) => {
    const amount = Number(row.amount ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function formatTimeLabel(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function mapParcelStatus(value: string) {
  if (value === "picked_up") return "picked-up";
  return value;
}

function mapParcelStatusToDatabase(value: string) {
  if (value === "picked-up") return "picked_up";
  return value;
}

function getDraftRelation(value: ParcelHubRecordRow["parcel_drafts"]) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function formatHubParcelRow(row: ParcelHubRecordRow) {
  const draft = getDraftRelation(row.parcel_drafts);
  const firstItem = Array.isArray(draft?.parcel_draft_items)
    ? draft.parcel_draft_items[0]
    : null;
  return {
    id: row.id,
    trackingNumber: draft?.tracking_number ?? row.id,
    sender: draft?.sender_name ?? "Unknown Sender",
    recipient: draft?.receiver_name ?? "Unknown Recipient",
    recipientPhone: draft?.receiver_phone ?? null,
    pickupAddress: draft?.pickup_address ?? null,
    deliveryAddress: draft?.delivery_address ?? null,
    packageSize: firstItem?.size ?? "Small",
    serviceId: draft?.service_id ?? null,
    status: mapParcelStatus(row.status),
    arrivalTime: formatTimeLabel(row.received_at),
    pickupTime: formatTimeLabel(row.picked_up_at),
    // dispatched_at column is missing in DB
    storageLocation: row.storage_location,
    draftId: draft?.id ?? null,
    customerId: draft?.user_id ?? null,
  };
}

function formatRelayBookingRows(
  rows: Array<{
    id: string;
    tracking_number?: string | null;
    pickup_address?: string | null;
    delivery_address?: string | null;
    status?: string | null;
    created_at?: string | null;
    sender_name?: string | null;
    sender_phone?: string | null;
    receiver_name?: string | null;
    receiver_phone?: string | null;
    service_id?: string | null;
    delivery_mode?: string | null;
    is_bulk?: boolean | null;
    drop_off_point_id?: string | null;
    drop_off_point_name?: string | null;
    drop_off_point_address?: string | null;
    tracking_current_location?: string | null;
    tracking_progress_label?: string | null;
    tracking_progress_percentage?: number | string | null;
    parcel_draft_items?: Array<{ quantity?: number | null; item_type?: string | null }> | null;
  }>,
) {
  return rows.map((row) => ({
    draftId: row.id,
    trackingNumber: row.tracking_number,
    pickupAddress: row.pickup_address,
    deliveryAddress: row.delivery_address,
    senderName: row.sender_name,
    senderPhone: row.sender_phone,
    receiverName: row.receiver_name,
    receiverPhone: row.receiver_phone,
    status: row.status,
    serviceId: row.service_id,
    deliveryMode: row.delivery_mode,
    isBulk: Boolean(row.is_bulk),
    totalParcels: (row.parcel_draft_items ?? []).reduce(
      (sum, item) => sum + Number(item.quantity ?? 0),
      0,
    ),
    currentLocation: row.tracking_current_location ?? row.pickup_address,
    progressLabel: row.tracking_progress_label ?? "Awaiting operator processing",
    progressPercentage: Number(row.tracking_progress_percentage ?? 0),
    dropOffPoint: row.drop_off_point_id
      ? { id: row.drop_off_point_id, name: row.drop_off_point_name, address: row.drop_off_point_address }
      : null,
    createdAt: row.created_at,
  }));
}

const TRACKING_PROGRESS_MAP = {
  incoming: {
    currentLocation: "Drop-off point receiving area",
    progressLabel: "Parcel received at drop-off point",
    progressPercentage: 40,
  },
  stored: {
    currentLocation: "Drop-off point storage shelf",
    progressLabel: "Parcel stored at drop-off point",
    progressPercentage: 55,
  },
  "picked-up": {
    currentLocation: "Picked up by recipient",
    progressLabel: "Parcel picked up by recipient",
    progressPercentage: 100,
  },
  dispatched: {
    currentLocation: "Dispatched from drop-off point",
    progressLabel: "Parcel dispatched from drop-off point",
    progressPercentage: 80,
  },
} as const;

@Injectable()
export class OperatorDashboardService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly parcelDraftsRepository: ParcelDraftsRepository,
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  private ensureOperator(session: SessionPayload) {
    if (session.role !== "operator") {
      throw new ForbiddenException("Only operators can access this dashboard.");
    }
  }

  private async findActiveHubId(operatorUserId: string): Promise<string | null> {
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("operator_hub_assignments")
      .select("hub_id")
      .eq("operator_user_id", operatorUserId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle<HubAssignmentRow>();
    if (error) throw new InternalServerErrorException("Unable to load operator hub assignment.");
    const assignedHubId = data?.hub_id?.trim();
    return assignedHubId || null;
  }

  async getActiveHubId(session: SessionPayload) {
    return this.requireActiveHubId(session);
  }

  private async requireActiveHubId(session: SessionPayload) {
    this.ensureOperator(session);
    const hubId = await this.findActiveHubId(session.userId);
    if (!hubId) throw new BadRequestException("This operator is not assigned to a hub.");
    return hubId;
  }

  private async listHubParcelRows(hubId: string): Promise<ParcelHubRecordRow[]> {
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select(`
        id, hub_id, status, storage_location, received_at, picked_up_at,
        parcel_drafts (
          id, user_id, tracking_number, sender_name, receiver_name, receiver_phone,
          pickup_address, delivery_address, distance_text, service_id, service_price,
          drop_off_point_id, drop_off_point_name, drop_off_point_address, status,
          parcel_draft_items ( id, size, quantity, item_type )
        )
      `)
      .eq("hub_id", hubId)
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error("[listHubParcelRows] DB error:", error.message, error.details, error.hint);
      throw new InternalServerErrorException("Unable to load hub parcels.");
    }
    return (data ?? []) as ParcelHubRecordRow[];
  }

  private async loadKpiMetrics(hubId: string, dayStart: Date) {
    const admin = this.supabaseService.createAdminClient();
    const dayEnd = addDays(dayStart, 1);
    const [incomingRecords, storedResult, pickedUpResult, customersResult, selectionsResult] = await Promise.all([
      admin.schema("parcel").from("parcel_hub_records").select("id", { count: "exact", head: true })
        .eq("hub_id", hubId).gte("received_at", dayStart.toISOString()).lt("received_at", dayEnd.toISOString()),
      admin.schema("parcel").from("parcel_hub_records").select("id", { count: "exact", head: true })
        .eq("hub_id", hubId).eq("status", "stored"),
      admin.schema("parcel").from("parcel_hub_records").select("id", { count: "exact", head: true })
        .eq("hub_id", hubId).gte("picked_up_at", dayStart.toISOString()).lt("picked_up_at", dayEnd.toISOString()),
      admin.schema("parcel").from("parcel_hub_records").select("parcel_drafts(user_id)")
        .eq("hub_id", hubId).gte("received_at", dayStart.toISOString()).lt("received_at", dayEnd.toISOString()),
      admin.schema("parcel").from("parcel_service_selections").select("parcel_draft_id")
        .eq("hub_id", hubId),
    ]);

    if (incomingRecords.error || storedResult.error || pickedUpResult.error || customersResult.error || selectionsResult.error) {
      throw new InternalServerErrorException("Unable to load dashboard metrics.");
    }

    // Filter selections to only those not yet received
    const { data: hubRecordIds } = await admin.schema("parcel").from("parcel_hub_records").select("parcel_draft_id").eq("hub_id", hubId);
    const receivedIds = new Set(hubRecordIds?.map(r => (r as any).parcel_draft_id).filter(Boolean) || []);
    
    const trueIncomingCount = (selectionsResult.data ?? [])
      .filter(s => !receivedIds.has(s.parcel_draft_id)).length;

    const uniqueCustomers = new Set(
      (customersResult.data ?? []).map((row: any) => row.parcel_drafts?.user_id ?? null).filter(Boolean),
    ).size;

    return {
      incomingToday: trueIncomingCount,
      currentlyStored: storedResult.count ?? 0,
      pickedUpToday: pickedUpResult.count ?? 0,
      customersServed: uniqueCustomers,
    };
  }

  private async loadEarningsMetrics(operatorUserId: string, hubId: string, weekStart: Date, monthStart: Date) {
    if (!isUuid(hubId)) {
      return { totalEarned: 0, weeklyIncrease: 0, incentives: 0, bonusesEarned: 0 };
    }

    const admin = this.supabaseService.createAdminClient();
    const [monthlyResult, weeklyResult, incentivesResult] = await Promise.all([
      admin.schema("routing").from("operator_earnings").select("amount").eq("hub_id", hubId).gte("earned_at", monthStart.toISOString()),
      admin.schema("routing").from("operator_earnings").select("amount").eq("hub_id", hubId).gte("earned_at", weekStart.toISOString()),
      admin.schema("routing").from("operator_incentives").select("amount", { count: "exact" }).eq("hub_id", hubId).gte("awarded_at", monthStart.toISOString()),
    ]);
    if (monthlyResult.error || weeklyResult.error || incentivesResult.error) {
      // Tables may not exist yet — return zeros gracefully instead of crashing
      console.warn("[loadEarningsMetrics] Earnings tables not found or error, returning zeros:", {
        monthly: monthlyResult.error?.message,
        weekly: weeklyResult.error?.message,
        incentives: incentivesResult.error?.message,
      });
      return { totalEarned: 0, weeklyIncrease: 0, incentives: 0, bonusesEarned: 0 };
    }
    return {
      totalEarned: sumAmounts(monthlyResult.data as MonetaryRow[]),
      weeklyIncrease: sumAmounts(weeklyResult.data as MonetaryRow[]),
      incentives: sumAmounts(incentivesResult.data as MonetaryRow[]),
      bonusesEarned: incentivesResult.count ?? 0,
    };
  }

  async getDashboard(session: SessionPayload) {
    this.ensureOperator(session);
    const now = new Date();
    const hubId = await this.findActiveHubId(session.userId);
    if (!hubId) {
      return {
        kpis: { incomingToday: 0, currentlyStored: 0, pickedUpToday: 0, customersServed: 0 },
        earnings: { totalEarned: 0, weeklyIncrease: 0, incentives: 0, bonusesEarned: 0 },
        meta: { currency: "PHP", timeframe: "month_to_date", hubId: null, note: "No hub assigned" },
      };
    }
    const [kpis, earnings] = await Promise.all([
      this.loadKpiMetrics(hubId, startOfPhilippineDay(now)),
      this.loadEarningsMetrics(session.userId, hubId, startOfPhilippineWeek(now), startOfPhilippineMonth(now)),
    ]);
    return { kpis, earnings, meta: { currency: "PHP", timeframe: "month_to_date", hubId } };
  }

  async getParcels(session: SessionPayload) {
    const hubId = await this.requireActiveHubId(session);
    const admin = this.supabaseService.createAdminClient();
    
    // 1. Get existing hub records (received/stored/etc)
    const hubRows = await this.listHubParcelRows(hubId);
    const receivedParcelIds = new Set(hubRows.map(r => getDraftRelation(r.parcel_drafts)?.id).filter(Boolean));

    // 2. Get incoming parcels from service selections. hub_id is text here, so it supports slug hub ids.
    const { data: selections, error: selectionsError } = await admin
      .schema("parcel")
      .from("parcel_service_selections")
      .select("parcel_draft_id")
      .eq("hub_id", hubId);

    if (selectionsError) {
      console.error("[getParcels] failed to query pending service selections:", selectionsError.message);
    }

    const selectedDraftIds = (selections ?? [])
      .map((selection) => selection.parcel_draft_id)
      .filter((draftId): draftId is string => Boolean(draftId) && !receivedParcelIds.has(draftId));

    let drafts: any[] = [];
    if (selectedDraftIds.length > 0) {
      const draftsResult = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("*, parcel_draft_items(*)")
        .in("id", selectedDraftIds)
        .eq("status", "submitted");

      if (draftsResult.error) {
        console.error("[getParcels] failed to query pending drafts:", draftsResult.error.message);
      } else {
        drafts = draftsResult.data ?? [];
      }
    }

    const incomingParcels = drafts
      .filter(draft => !receivedParcelIds.has(draft.id))
      .map(draft => {
        const firstItem = Array.isArray(draft?.parcel_draft_items) ? draft.parcel_draft_items[0] : null;
        
        return {
          id: `incoming-${draft.id}`,
          trackingNumber: draft.tracking_number,
          sender: draft.sender_name || "Unknown Sender",
          recipient: draft.receiver_name || "Unknown Recipient",
          recipientPhone: draft.receiver_phone || null,
          pickupAddress: draft.pickup_address || null,
          deliveryAddress: draft.delivery_address || null,
          packageSize: firstItem?.size || "Small",
          serviceId: draft.service_id || "pakishare",
          status: "incoming",
          statusLabel: "Incoming",
          timeLabel: "In Transit",
          arrivalTime: formatTimeLabel(draft.created_at),
          storageLocation: null,
          draftId: draft.id,
          customerId: draft.user_id || null,
        };
      });

    const existingParcels = hubRows.map(formatHubParcelRow);
    
    return { 
      parcels: [...incomingParcels, ...existingParcels], 
      meta: { hubId } 
    };
  }

  async getReports(session: SessionPayload) {
    const hubId = await this.requireActiveHubId(session);
    const rows = await this.listHubParcelRows(hubId);
    const lostRows = rows.filter((row) => {
      const draft = getDraftRelation(row.parcel_drafts);
      return draft?.status === "lost";
    });
    return {
      reports: lostRows.map((row) => {
        const draft = getDraftRelation(row.parcel_drafts);
        return {
          id: row.id,
          trackingNumber: draft?.tracking_number ?? row.id,
          sender: draft?.sender_name ?? "Unknown",
          recipient: draft?.receiver_name ?? "Unknown",
          status: mapParcelStatus(row.status),
          reportedAt: row.received_at,
        };
      }),
      meta: { hubId },
    };
  }

  async registerManualEntry(session: SessionPayload, trackingNumber: string) {
    this.ensureOperator(session);
    const normalized = trackingNumber.trim();
    if (!normalized) throw new BadRequestException("Tracking number is required.");
    const hubId = await this.findActiveHubId(session.userId);
    if (!hubId) throw new BadRequestException("This operator is not assigned to a hub.");
    const admin = this.supabaseService.createAdminClient();

    const { data: draft, error: draftError } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("id, tracking_number, sender_name, receiver_name, user_id, status, drop_off_point_id")
      .eq("tracking_number", normalized)
      .eq("status", "submitted")
      .maybeSingle<ParcelDraftLookupRow>();
    if (draftError) throw new InternalServerErrorException("Unable to validate the tracking number.");
    if (!draft) throw new NotFoundException("No submitted parcel found for that tracking number.");

    const { data: existing, error: existingError } = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select("id, hub_id, status, storage_location, received_at")
      .eq("parcel_draft_id", draft.id)
      .maybeSingle();
    if (existingError) throw new InternalServerErrorException("Unable to check existing hub records.");

    if (existing) {
      if (existing.hub_id !== hubId) throw new BadRequestException("This parcel is already registered at a different hub.");
      return {
        parcel: {
          id: existing.id,
          trackingNumber: draft.tracking_number ?? normalized,
          sender: draft.sender_name ?? "Unknown Sender",
          recipient: draft.receiver_name ?? "Unknown Recipient",
          status: mapParcelStatus(existing.status),
          arrivalTime: formatTimeLabel(existing.received_at),
          storageLocation: existing.storage_location,
          alreadyRegistered: true,
        },
      };
    }

    const nowIso = new Date().toISOString();
    const { data: created, error: createError } = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .insert({ parcel_draft_id: draft.id, hub_id: hubId, operator_user_id: session.userId, status: "incoming", received_at: nowIso })
      .select("id, hub_id, status, storage_location, received_at")
      .single();
    if (createError || !created) throw new InternalServerErrorException("Unable to register the parcel at this hub.");

    await admin.schema("parcel").from("parcel_drafts").update({
      tracking_current_location: "Drop-off point receiving area",
      tracking_progress_label: "Parcel received at drop-off point",
      tracking_progress_percentage: 40,
      updated_at: nowIso,
    }).eq("id", draft.id);

    if (draft.user_id) {
      await this.customerNotificationsService.createNotification(
        draft.user_id, "delivery", "Parcel received at hub",
        `Your parcel ${normalized} has been received at the drop-off point.`,
      );
    }

    return {
      parcel: {
        id: created.id,
        trackingNumber: draft.tracking_number ?? normalized,
        sender: draft.sender_name ?? "Unknown Sender",
        recipient: draft.receiver_name ?? "Unknown Recipient",
        status: mapParcelStatus(created.status),
        arrivalTime: formatTimeLabel(created.received_at),
        storageLocation: created.storage_location,
        alreadyRegistered: false,
      },
    };
  }

  async updateParcelStatus(session: SessionPayload, recordId: string, nextStatus: string) {
    const hubId = await this.requireActiveHubId(session);
    const normalized = nextStatus.trim();
    const supported = new Set(["incoming", "stored", "picked-up", "dispatched"]);
    if (!supported.has(normalized)) {
      throw new BadRequestException("Unsupported parcel status. Use: incoming, stored, picked-up, or dispatched.");
    }
    const admin = this.supabaseService.createAdminClient();

    const cleanRecordId = recordId.startsWith("incoming-")
      ? recordId.replace("incoming-", "")
      : recordId;

    let finalRecord = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select(`
        id, hub_id, status, storage_location, received_at, picked_up_at,
        parcel_drafts (
          id, user_id, tracking_number, sender_name, receiver_name, receiver_phone,
          pickup_address, delivery_address, distance_text, service_id, service_price,
          drop_off_point_id, drop_off_point_name, drop_off_point_address, status,
          parcel_draft_items ( id, size, quantity, item_type )
        )
      `)
      .eq("id", cleanRecordId)
      .eq("hub_id", hubId)
      .maybeSingle<ParcelHubRecordRow>()
      .then(res => {
        if (res.error) throw new InternalServerErrorException("Unable to load the parcel record.");
        return res.data;
      });

    if (!finalRecord) {
      const { data: draft, error: draftError } = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("id, status, service_id, drop_off_point_id, tracking_number")
        .eq("id", cleanRecordId)
        .maybeSingle();

      if (draftError) {
        throw new InternalServerErrorException("Unable to load the parcel draft details.");
      }

      if (draft && draft.drop_off_point_id === hubId) {
        const nowIso = new Date().toISOString();
        const dbStatus = mapParcelStatusToDatabase(normalized);
        const { data: created, error: createError } = await admin
          .schema("parcel")
          .from("parcel_hub_records")
          .insert({
            parcel_draft_id: draft.id,
            hub_id: hubId,
            operator_user_id: session.userId,
            status: dbStatus,
            received_at: nowIso,
            picked_up_at: dbStatus === "picked_up" ? nowIso : null,
          })
          .select(`
            id, hub_id, status, storage_location, received_at, picked_up_at,
            parcel_drafts (
              id, user_id, tracking_number, sender_name, receiver_name, receiver_phone,
              pickup_address, delivery_address, distance_text, service_id, service_price,
              drop_off_point_id, drop_off_point_name, drop_off_point_address, status,
              parcel_draft_items ( id, size, quantity, item_type )
            )
          `)
          .single<ParcelHubRecordRow>();

        if (createError || !created) {
          throw new InternalServerErrorException("Unable to automatically register this parcel at the hub.");
        }

        finalRecord = created;
      }
    }

    if (!finalRecord) throw new NotFoundException("Parcel record not found at this hub.");

    const draft = getDraftRelation(finalRecord.parcel_drafts);
    const nowIso = new Date().toISOString();
    const dbStatus = mapParcelStatusToDatabase(normalized);
    const recordPatch: Record<string, unknown> = { status: dbStatus, updated_at: nowIso };
    if (dbStatus === "picked_up") recordPatch.picked_up_at = nowIso;

    const { error: updateError } = await admin
      .schema("parcel")
      .from("parcel_hub_records").update(recordPatch).eq("id", finalRecord.id).eq("hub_id", hubId);
    if (updateError) throw new InternalServerErrorException("Unable to update parcel status.");

    const progress = TRACKING_PROGRESS_MAP[normalized as keyof typeof TRACKING_PROGRESS_MAP];
    if (draft?.id) {
      const draftPatch: Record<string, unknown> = {
        tracking_current_location: normalized === "stored"
          ? (finalRecord.storage_location ?? "Drop-off point storage shelf")
          : progress.currentLocation,
        tracking_progress_label: progress.progressLabel,
        tracking_progress_percentage: progress.progressPercentage,
        updated_at: nowIso,
      };
      if (normalized === "picked-up") draftPatch.status = "delivered";
      await admin.schema("parcel").from("parcel_drafts").update(draftPatch).eq("id", draft.id);
    }

    if (draft?.user_id) {
      const notifMessages: Record<string, string> = {
        incoming: `Your parcel ${draft.tracking_number ?? ""} has been received at the drop-off point.`,
        stored: `Your parcel ${draft.tracking_number ?? ""} is now stored safely at the hub.`,
        "picked-up": `Your parcel ${draft.tracking_number ?? ""} has been picked up successfully.`,
        dispatched: `Your parcel ${draft.tracking_number ?? ""} has been dispatched from the hub for delivery.`,
      };
      await this.customerNotificationsService.createNotification(
        draft.user_id, "delivery", progress.progressLabel,
        notifMessages[normalized] ?? progress.progressLabel,
      );
    }

    const refreshed = await this.listHubParcelRows(hubId);
    const updated = refreshed.find((r) => r.id === finalRecord.id);
    if (!updated) throw new InternalServerErrorException("Unable to load the updated parcel record.");
    return { parcel: formatHubParcelRow(updated) };
  }

  async dispatchToDriver(session: SessionPayload, recordId: string) {
    const hubId = await this.requireActiveHubId(session);
    const admin = this.supabaseService.createAdminClient();

    const { data: record, error: recordError } = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select(`
        id, hub_id, status,
        parcel_drafts (
          id, user_id, tracking_number, sender_name, sender_phone,
          receiver_name, receiver_phone, pickup_address, delivery_address,
          distance_text, service_id, service_price, drop_off_point_name,
          drop_off_point_address, status, is_bulk,
          parcel_draft_items ( id, size, quantity, item_type )
        )
      `)
      .eq("id", recordId)
      .eq("hub_id", hubId)
      .maybeSingle<ParcelHubRecordRow>();
    if (recordError) throw new InternalServerErrorException("Unable to load the parcel record.");
    if (!record) throw new NotFoundException("Parcel record not found at this hub.");

    const draft = getDraftRelation(record.parcel_drafts);
    if (!draft) throw new NotFoundException("Parcel draft not found.");
    if (!["incoming", "stored"].includes(record.status)) {
      throw new BadRequestException("Only parcels with status incoming or stored can be dispatched.");
    }

    const { data: existingJob } = await admin
      .schema("driver").from("driver_jobs").select("id, status").eq("parcel_draft_id", draft.id).maybeSingle();
    if (existingJob) throw new BadRequestException("A driver job already exists for this parcel.");

    const nowIso = new Date().toISOString();
    const firstItem = Array.isArray(draft.parcel_draft_items) ? draft.parcel_draft_items[0] : null;
    const packageSize = firstItem?.size ?? "Small";
    const servicePrice = Number(draft.service_price ?? 0);
    const earnings = servicePrice > 0 ? Math.round(servicePrice * 0.7) : 85;

    const { data: profile } = await admin
      .schema("account")
      .from("profiles").select("full_name").eq("id", draft.user_id ?? "").maybeSingle();
    const customerName = profile?.full_name ?? draft.sender_name ?? "Customer";

    const { error: jobError } = await admin.schema("driver").from("driver_jobs").insert({
      job_number: draft.tracking_number ?? `JOB-${Math.floor(Math.random() * 100000)}`,
      parcel_draft_id: draft.id,
      customer_user_id: draft.user_id,
      customer_name: customerName,
      customer_phone: draft.receiver_phone ?? null,
      pickup_address: draft.drop_off_point_address ?? draft.pickup_address,
      dropoff_address: draft.delivery_address,
      distance_text: draft.distance_text,
      earnings_amount: earnings,
      hub_id: hubId,
      status: "available",
      parcel_status: null,
      package_size: packageSize,
      package_description: firstItem?.item_type ?? "Standard Parcel",
      special_instructions: `PakiShare dispatch from hub: ${draft.drop_off_point_name ?? hubId}`,
      created_at: nowIso,
      updated_at: nowIso,
    });
    if (jobError) throw new InternalServerErrorException(`Unable to create driver job: ${jobError.message}`);

    await admin.schema("parcel").from("parcel_hub_records")
      .update({ status: "dispatched", updated_at: nowIso }).eq("id", recordId);

    await admin.schema("parcel").from("parcel_drafts").update({
      tracking_current_location: `Dispatched from ${draft.drop_off_point_name ?? "hub"}`,
      tracking_progress_label: "Parcel dispatched from drop-off point",
      tracking_progress_percentage: 80,
      updated_at: nowIso,
    }).eq("id", draft.id);

    if (draft.user_id) {
      await this.customerNotificationsService.createNotification(
        draft.user_id, "delivery", "Parcel dispatched for delivery",
        `Your parcel ${draft.tracking_number ?? ""} has been dispatched from the hub and a driver will be assigned shortly.`,
      );
    }

    return {
      dispatched: true,
      trackingNumber: draft.tracking_number,
      message: "Driver job created. A driver will pick up the parcel from the hub.",
    };
  }

  async reportLostParcel(session: SessionPayload, trackingNumber: string, details: string) {
    await this.requireActiveHubId(session);
    const normalized = trackingNumber.trim();
    if (!normalized) throw new BadRequestException("Tracking number is required.");
    const admin = this.supabaseService.createAdminClient();

    const { data: draftRecord, error: draftError } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("id, user_id, tracking_number, tracking_progress_percentage")
      .eq("tracking_number", normalized)
      .maybeSingle<ParcelDraftLookupRow>();
    if (draftError) throw new InternalServerErrorException("Unable to load the parcel for reporting.");
    if (!draftRecord) throw new NotFoundException("No parcel found for that tracking number.");

    const label = details.trim()
      ? `Lost parcel reported: ${details.trim()}`
      : "Lost parcel reported by operator";
    const nowIso = new Date().toISOString();

    await admin.schema("parcel").from("parcel_drafts").update({
      status: "lost",
      tracking_progress_label: label,
      updated_at: nowIso,
    }).eq("id", draftRecord.id);

    if (draftRecord.user_id) {
      await this.customerNotificationsService.createNotification(
        draftRecord.user_id, "delivery", "Lost parcel report submitted",
        `A report was filed for parcel ${normalized}. Our team is now investigating.`,
      );
    }

    return { report: { trackingNumber: normalized, details: label, reportedAt: nowIso } };
  }

  async getRelayBookings(session: SessionPayload) {
    const hubId = await this.requireActiveHubId(session);
    const result = await this.parcelDraftsRepository.listRelayBookingsForHub(hubId);
    if (result.error) throw new InternalServerErrorException("Unable to load relay bookings.");
    return { bookings: formatRelayBookingRows(result.data ?? []), meta: { hubId } };
  }

  async updateRelayBookingStatus(
    session: SessionPayload,
    draftId: string,
    input: { currentLocation?: unknown; progressLabel?: unknown; progressPercentage?: unknown },
  ) {
    this.ensureOperator(session);
    const booking = await this.parcelDraftsRepository.findRelayBookingById(draftId);
    if (booking.error || !booking.data) throw new NotFoundException("Relay booking not found.");

    const currentLocation = String(input.currentLocation ?? booking.data.tracking_current_location ?? "Drop-off point").trim();
    const progressLabel = String(input.progressLabel ?? booking.data.tracking_progress_label ?? "Parcel received at drop-off point").trim();
    const progressPercentage = Number(input.progressPercentage ?? booking.data.tracking_progress_percentage ?? 50);

    if (!currentLocation || !progressLabel) throw new BadRequestException("Current location and progress label are required.");
    if (!Number.isFinite(progressPercentage) || progressPercentage < 0 || progressPercentage > 100) {
      throw new BadRequestException("Progress percentage must be between 0 and 100.");
    }

    const updateResult = await this.parcelDraftsRepository.updateRelayBookingTracking(draftId, {
      tracking_current_location: currentLocation,
      tracking_progress_label: progressLabel,
      tracking_progress_percentage: progressPercentage,
    });
    if (updateResult.error || !updateResult.data) throw new InternalServerErrorException("Unable to update relay booking status.");

    await this.customerNotificationsService.createNotification(
      booking.data.user_id, "delivery", "Parcel status updated",
      `${progressLabel}. Current location: ${currentLocation}.`,
    );

    return {
      draftId,
      trackingNumber: updateResult.data.tracking_number,
      currentLocation: updateResult.data.tracking_current_location,
      progressLabel: updateResult.data.tracking_progress_label,
      progressPercentage: Number(updateResult.data.tracking_progress_percentage ?? 0),
    };
  }
}
