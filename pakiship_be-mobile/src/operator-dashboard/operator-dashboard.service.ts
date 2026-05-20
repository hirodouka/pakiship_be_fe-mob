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
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
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

    const [
      receivedTodayResult,
      storedResult,
      pickedUpResult,
      customersResult,
      allSelectionsResult,
      hubRecordDraftIds,
    ] = await Promise.all([
      // Parcels physically received at hub today (received_at set when operator scans)
      admin.schema("parcel").from("parcel_hub_records")
        .select("id", { count: "exact", head: true })
        .eq("hub_id", hubId)
        .gte("received_at", dayStart.toISOString())
        .lt("received_at", dayEnd.toISOString()),

      // Currently stored at hub (any time, not just today)
      admin.schema("parcel").from("parcel_hub_records")
        .select("id", { count: "exact", head: true })
        .eq("hub_id", hubId)
        .eq("status", "stored"),

      // Picked up today
      admin.schema("parcel").from("parcel_hub_records")
        .select("id", { count: "exact", head: true })
        .eq("hub_id", hubId)
        .gte("picked_up_at", dayStart.toISOString())
        .lt("picked_up_at", dayEnd.toISOString()),

      // Unique customers served today (received parcels)
      admin.schema("parcel").from("parcel_hub_records")
        .select("parcel_drafts(user_id)")
        .eq("hub_id", hubId)
        .gte("received_at", dayStart.toISOString())
        .lt("received_at", dayEnd.toISOString()),

      // All bookings assigned to this hub (for incoming count)
      admin.schema("parcel").from("parcel_service_selections")
        .select("parcel_draft_id")
        .eq("hub_id", hubId),

      // Draft IDs already in hub records (already received)
      admin.schema("parcel").from("parcel_hub_records")
        .select("parcel_draft_id")
        .eq("hub_id", hubId),
    ]);

    if (
      receivedTodayResult.error || storedResult.error ||
      pickedUpResult.error || customersResult.error
    ) {
      console.error("[loadKpiMetrics] DB error:", {
        received: receivedTodayResult.error?.message,
        stored: storedResult.error?.message,
        pickedUp: pickedUpResult.error?.message,
        customers: customersResult.error?.message,
      });
      throw new InternalServerErrorException("Unable to load dashboard metrics.");
    }

    // Incoming = bookings assigned to this hub that haven't been received yet
    const receivedDraftIds = new Set(
      (hubRecordDraftIds.data ?? [])
        .map((r: any) => r.parcel_draft_id)
        .filter(Boolean)
    );
    const trueIncomingCount = (allSelectionsResult.data ?? [])
      .filter((s) => !receivedDraftIds.has(s.parcel_draft_id)).length;

    const uniqueCustomers = new Set(
      (customersResult.data ?? [])
        .map((row: any) => row.parcel_drafts?.user_id ?? null)
        .filter(Boolean),
    ).size;

    return {
      incomingToday: trueIncomingCount,
      currentlyStored: storedResult.count ?? 0,
      pickedUpToday: pickedUpResult.count ?? 0,
      customersServed: uniqueCustomers,
      receivedToday: receivedTodayResult.count ?? 0,
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

  private async draftBelongsToHub(draftId: string, draftDropOffPointId: string | null, hubId: string) {
    // Direct match on drop_off_point_id
    if (draftDropOffPointId === hubId) return true;

    const admin = this.supabaseService.createAdminClient();

    // Look up the hub's name/slug so we can match even if the customer stored a slug
    const { data: hubRow } = await admin
      .schema("location")
      .from("drop_off_points")
      .select("id, name")
      .eq("id", hubId)
      .maybeSingle();

    // Check parcel_service_selections by UUID hub_id
    const { data: byUuid } = await admin
      .schema("parcel")
      .from("parcel_service_selections")
      .select("parcel_draft_id")
      .eq("parcel_draft_id", draftId)
      .eq("hub_id", hubId)
      .maybeSingle();

    if (byUuid) return true;

    // Also check if the draft's drop_off_point_id matches the hub UUID (already done above)
    // or if the parcel_service_selections row has any hub_id that resolves to this hub
    if (hubRow) {
      // Try matching by hub name slug (some bookings store name-based IDs)
      const slugId = hubRow.name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      if (slugId && draftDropOffPointId === slugId) return true;

      const { data: bySlug } = await admin
        .schema("parcel")
        .from("parcel_service_selections")
        .select("parcel_draft_id")
        .eq("parcel_draft_id", draftId)
        .eq("hub_id", slugId ?? "")
        .maybeSingle();

      if (bySlug) return true;
    }

    // Last resort: the draft is assigned to this hub's drop_off_point_id at all
    // (parcel_service_selections may store the hub UUID under a different column)
    const { data: anySelection } = await admin
      .schema("parcel")
      .from("parcel_service_selections")
      .select("hub_id")
      .eq("parcel_draft_id", draftId)
      .maybeSingle();

    if (anySelection?.hub_id) {
      // Resolve the stored hub_id to a UUID and compare
      const { data: resolvedHub } = await admin
        .schema("location")
        .from("drop_off_points")
        .select("id")
        .or(`id.eq.${anySelection.hub_id},name.ilike.${anySelection.hub_id}`)
        .maybeSingle();

      if (resolvedHub?.id === hubId) return true;
    }

    return false;
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

    const { data: existingRows, error: existingError } = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select("id, hub_id, status, storage_location, received_at")
      .eq("parcel_draft_id", draft.id)
      .limit(1);
    if (existingError) throw new InternalServerErrorException("Unable to check existing hub records.");

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

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

    // Try insert with operator_user_id first; fall back without it if the column doesn't exist
    let created: any = null;
    let createError: any = null;

    const insertWithOperator = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .insert({ parcel_draft_id: draft.id, hub_id: hubId, operator_user_id: session.userId, status: "incoming", received_at: nowIso })
      .select("id, hub_id, status, storage_location, received_at")
      .single();

    if (insertWithOperator.error) {
      console.warn("[registerManualEntry] Insert with operator_user_id failed:", insertWithOperator.error.message, insertWithOperator.error.details, insertWithOperator.error.hint);

      // Retry without operator_user_id in case the column doesn't exist in this DB
      const insertWithout = await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .insert({ parcel_draft_id: draft.id, hub_id: hubId, status: "incoming", received_at: nowIso })
        .select("id, hub_id, status, storage_location, received_at")
        .single();

      created = insertWithout.data;
      createError = insertWithout.error;

      if (createError) {
        console.error("[registerManualEntry] Fallback insert also failed:", createError.message, createError.details, createError.hint, "| draft.id:", draft.id, "| hubId:", hubId);
      }
    } else {
      created = insertWithOperator.data;
    }

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

    if (!cleanRecordId || cleanRecordId === "null" || cleanRecordId === "undefined" || !cleanRecordId.trim()) {
      throw new BadRequestException("Invalid record ID provided.");
    }

    console.log(`[updateParcelStatus] START recordId="${recordId}" clean="${cleanRecordId}" hub="${hubId}" status="${normalized}"`);

    const selectClause = `
      id, hub_id, status, storage_location, received_at, picked_up_at,
      parcel_drafts (
        id, user_id, tracking_number, sender_name, receiver_name, receiver_phone,
        pickup_address, delivery_address, distance_text, service_id, service_price,
        drop_off_point_id, drop_off_point_name, drop_off_point_address, status,
        parcel_draft_items ( id, size, quantity, item_type )
      )
    `;

    // First try: look up by hub record UUID
    let finalRecord = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select(selectClause)
      .eq("id", cleanRecordId)
      .eq("hub_id", hubId)
      .limit(1)
      .then(res => {
        if (res.error) throw new InternalServerErrorException("Unable to load the parcel record.");
        return res.data && res.data.length > 0 ? res.data[0] : null;
      });

    console.log(`[updateParcelStatus] lookup by record id: ${finalRecord ? "FOUND" : "not found"}`);

    // Second try: cleanRecordId might be a draft ID (from "incoming-<draftId>" prefix)
    if (!finalRecord) {
      const byDraftId = await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .select(selectClause)
        .eq("parcel_draft_id", cleanRecordId)
        .eq("hub_id", hubId)
        .limit(1);

      if (!byDraftId.error && byDraftId.data && byDraftId.data.length > 0) {
        finalRecord = byDraftId.data[0];
        console.log(`[updateParcelStatus] lookup by parcel_draft_id: FOUND`);
      } else {
        console.log(`[updateParcelStatus] lookup by parcel_draft_id: not found err=${byDraftId.error?.message}`);
      }
    }

    if (!finalRecord) {
      const { data: draft, error: draftError } = await admin
        .schema("parcel")
        .from("parcel_drafts")
        .select("id, status, service_id, drop_off_point_id, tracking_number")
        .eq("id", cleanRecordId)
        .maybeSingle();

      console.log(`[updateParcelStatus] draft lookup: ${draft ? `FOUND status=${draft.status} drop_off_point_id=${draft.drop_off_point_id}` : `not found err=${draftError?.message}`}`);

      if (draftError) {
        throw new InternalServerErrorException("Unable to load the parcel draft details.");
      }

      // If the draft exists and is submitted, trust that it belongs to this hub
      if (draft && draft.status === "submitted") {
        const nowIso = new Date().toISOString();
        const dbStatus = mapParcelStatusToDatabase(normalized);

        console.log(`[updateParcelStatus] auto-creating hub record for draft=${draft.id} hub=${hubId} status=${dbStatus}`);

        // Try insert with operator_user_id; fall back without it if the column doesn't exist
        let created: ParcelHubRecordRow | null = null;

        const insertPayloadFull = {
          parcel_draft_id: draft.id,
          hub_id: hubId,
          operator_user_id: session.userId,
          status: dbStatus,
          received_at: nowIso,
          picked_up_at: dbStatus === "picked_up" ? nowIso : null,
        };

        const withOperator = await admin
          .schema("parcel")
          .from("parcel_hub_records")
          .insert(insertPayloadFull)
          .select(selectClause)
          .single<ParcelHubRecordRow>();

        if (withOperator.error) {
          console.warn("[updateParcelStatus] Insert with operator_user_id failed:", withOperator.error.message, withOperator.error.details);
          const { operator_user_id: _omit, ...insertPayloadSlim } = insertPayloadFull;
          const withoutOperator = await admin
            .schema("parcel")
            .from("parcel_hub_records")
            .insert(insertPayloadSlim)
            .select(selectClause)
            .single<ParcelHubRecordRow>();

          if (withoutOperator.error || !withoutOperator.data) {
            console.error("[updateParcelStatus] Fallback insert failed:", withoutOperator.error?.message, withoutOperator.error?.details, withoutOperator.error?.hint);
            throw new InternalServerErrorException("Unable to automatically register this parcel at the hub.");
          }
          created = withoutOperator.data;
        } else {
          created = withOperator.data;
        }

        if (!created) {
          throw new InternalServerErrorException("Unable to automatically register this parcel at the hub.");
        }

        finalRecord = created as unknown as typeof finalRecord;
      } else {
        console.log(`[updateParcelStatus] draft not found or not submitted: draft=${JSON.stringify(draft)}`);
      }
    }

    if (!finalRecord) {
      console.error(`[updateParcelStatus] FINAL: no record found for recordId="${recordId}" cleanRecordId="${cleanRecordId}" hubId="${hubId}"`);
      throw new NotFoundException("Parcel record not found at this hub.");
    }

    const draft = getDraftRelation(finalRecord.parcel_drafts as any);
    const nowIso = new Date().toISOString();
    const dbStatus = mapParcelStatusToDatabase(normalized);
    const recordPatch: Record<string, unknown> = { status: dbStatus, updated_at: nowIso };
    if (dbStatus === "picked_up") recordPatch.picked_up_at = nowIso;

    // Build the update query — use parcel_draft_id when the record has no id (null PK)
    const draftIdForUpdate = draft?.id ?? cleanRecordId;
    let updateQuery = admin
      .schema("parcel")
      .from("parcel_hub_records")
      .update(recordPatch)
      .eq("hub_id", hubId);

    if (finalRecord.id) {
      updateQuery = updateQuery.eq("id", finalRecord.id);
    } else {
      // Row has no id — match by parcel_draft_id instead
      console.log(`[updateParcelStatus] record has null id, updating by parcel_draft_id="${draftIdForUpdate}"`);
      updateQuery = updateQuery.eq("parcel_draft_id", draftIdForUpdate);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      console.error("[updateParcelStatus] failed to update parcel_hub_records", {
        recordId: finalRecord.id,
        cleanRecordId,
        hubId,
        dbStatus,
        recordPatch,
        error: updateError,
      });
      throw new InternalServerErrorException(
        `Unable to update parcel status. ${updateError.message}`,
      );
    }

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

    // Refresh — re-query the specific record directly instead of scanning all hub rows
    let refreshQuery = admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select(selectClause)
      .eq("hub_id", hubId);

    if (finalRecord.id) {
      refreshQuery = refreshQuery.eq("id", finalRecord.id);
    } else {
      refreshQuery = refreshQuery.eq("parcel_draft_id", draftIdForUpdate);
    }

    const { data: updatedRows } = await refreshQuery.limit(1);
    const updatedRow = updatedRows && updatedRows.length > 0 ? updatedRows[0] : null;

    if (!updatedRow) {
      // Return the in-memory record if the refresh query fails
      return { parcel: formatHubParcelRow({ ...finalRecord, status: dbStatus } as unknown as ParcelHubRecordRow) };
    }
    return { parcel: formatHubParcelRow(updatedRow as unknown as ParcelHubRecordRow) };
  }

  async dispatchToDriver(session: SessionPayload, recordId: string) {
    const hubId = await this.requireActiveHubId(session);
    const admin = this.supabaseService.createAdminClient();

    const cleanRecordId = recordId.startsWith("incoming-")
      ? recordId.replace("incoming-", "")
      : recordId;

    if (!cleanRecordId || cleanRecordId === "null" || cleanRecordId === "undefined" || !cleanRecordId.trim()) {
      throw new BadRequestException("Invalid record ID provided.");
    }

    const selectClause = `
      id, hub_id, status,
      parcel_drafts (
        id, user_id, tracking_number, sender_name, sender_phone,
        receiver_name, receiver_phone, pickup_address, delivery_address,
        distance_text, service_id, service_price, drop_off_point_name,
        drop_off_point_address, status, is_bulk,
        pickup_lat, pickup_lng, delivery_lat, delivery_lng,
        parcel_draft_items ( id, size, quantity, item_type )
      )
    `;

    console.log(`[dispatchToDriver] Lookup recordId="${recordId}" cleanRecordId="${cleanRecordId}" hubId="${hubId}"`);

    // 1. Try lookup by record ID
    let record: ParcelHubRecordRow | null = null;
    let recordError: any = null;

    if (cleanRecordId && cleanRecordId !== "null" && cleanRecordId !== "undefined" && cleanRecordId.trim()) {
      const byIdResult = await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .select(selectClause)
        .eq("id", cleanRecordId)
        .eq("hub_id", hubId)
        .limit(1);

      if (byIdResult.error) {
        recordError = byIdResult.error;
      } else if (byIdResult.data && byIdResult.data.length > 0) {
        record = byIdResult.data[0] as unknown as ParcelHubRecordRow;
      }
    }

    // 2. Try fallback lookup by draft ID
    if (!record && !recordError) {
      console.log(`[dispatchToDriver] Record not found by ID, trying fallback by parcel_draft_id="${cleanRecordId}"`);
      const byDraftResult = await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .select(selectClause)
        .eq("parcel_draft_id", cleanRecordId)
        .eq("hub_id", hubId)
        .limit(1);

      if (byDraftResult.error) {
        recordError = byDraftResult.error;
      } else if (byDraftResult.data && byDraftResult.data.length > 0) {
        record = byDraftResult.data[0] as unknown as ParcelHubRecordRow;
      }
    }

    if (recordError) {
      console.error("[dispatchToDriver] DB error:", recordError.message, recordError.details, recordError.hint);
      throw new InternalServerErrorException(`Unable to load the parcel record. ${recordError.message}`);
    }
    if (!record) {
      console.error(`[dispatchToDriver] Record not found in DB for cleanRecordId="${cleanRecordId}" hubId="${hubId}"`);
      throw new NotFoundException("Parcel record not found at this hub.");
    }

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
    
    // Map S, M, L size abbreviations to Small, Medium, Large to satisfy driver_jobs CHECK constraints
    let packageSize = "Small";
    const rawSize = String(firstItem?.size ?? "Small").trim().toUpperCase();
    if (rawSize === "S" || rawSize === "SMALL") {
      packageSize = "Small";
    } else if (rawSize === "M" || rawSize === "MEDIUM") {
      packageSize = "Medium";
    } else if (rawSize === "L" || rawSize === "LARGE") {
      packageSize = "Large";
    } else {
      packageSize = "Small"; // fallback
    }
    const servicePrice = Number(draft.service_price ?? 0);
    const earnings = servicePrice > 0 ? Math.round(servicePrice * 0.7) : 85;

    const { data: profile } = await admin
      .schema("account")
      .from("profiles").select("full_name").eq("id", draft.user_id ?? "").maybeSingle();
    const customerName = profile?.full_name ?? draft.sender_name ?? "Customer";

    const { data: hubRecord } = await admin
      .schema("location")
      .from("drop_off_points")
      .select("name, address, lat, lng")
      .eq("id", hubId)
      .maybeSingle();

    const hubAddress = hubRecord?.address ?? draft.drop_off_point_address ?? draft.pickup_address;
    const hubName = hubRecord?.name ?? draft.drop_off_point_name ?? "hub";
    const hubLat = hubRecord?.lat ? Number(hubRecord.lat) : draft.pickup_lat;
    const hubLng = hubRecord?.lng ? Number(hubRecord.lng) : draft.pickup_lng;

    const { error: jobError } = await admin.schema("driver").from("driver_jobs").insert({
      job_number: draft.tracking_number ?? `JOB-${Math.floor(Math.random() * 100000)}`,
      parcel_draft_id: draft.id,
      status: "available",
      earnings: earnings,
    });
    if (jobError) throw new InternalServerErrorException(`Unable to create driver job: ${jobError.message}`);

    let updateQuery = admin.schema("parcel").from("parcel_hub_records")
      .update({ status: "dispatched", updated_at: nowIso })
      .eq("hub_id", hubId);

    if (record.id) {
      updateQuery = updateQuery.eq("id", record.id);
    } else {
      updateQuery = updateQuery.eq("parcel_draft_id", draft.id);
    }

    const { error: updateError } = await updateQuery;
    if (updateError) {
      console.error("[dispatchToDriver] Failed to update status in parcel_hub_records:", updateError.message, updateError.details);
    }

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
