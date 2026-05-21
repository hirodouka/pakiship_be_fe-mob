import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import type { SessionPayload } from "../common/session/session.types";
import { SupabaseService } from "../supabase/supabase.service";
import { CustomerNotificationsService } from "../customer-notifications/customer-notifications.service";

type PreferencePatch = {
  emailNotifications?: boolean;
  smsUpdates?: boolean;
  autoExtend?: boolean;
};

type ReviewInput = {
  trackingNumber: string;
  rating: number;
  review?: string;
  tags?: string[];
};

function ensureCustomer(session: SessionPayload) {
  if (session.role !== "customer") {
    throw new ForbiddenException("Only customers can access this resource.");
  }
}

function asString(value: unknown) {
  return String(value ?? "").trim();
}

function parseBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function parsePreferences(raw: unknown) {
  const source = (raw ?? {}) as PreferencePatch;
  return {
    emailNotifications: parseBoolean(source.emailNotifications),
    smsUpdates: parseBoolean(source.smsUpdates),
    autoExtend: parseBoolean(source.autoExtend),
  };
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "Just now";

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Just now";

  const diffMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;

  if (diffMs < hour) {
    const mins = Math.max(1, Math.floor(diffMs / minute));
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  }

  const hours = Math.max(1, Math.floor(diffMs / hour));
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function normalizeTags(input: unknown) {
  const tags = Array.isArray(input) ? input : [];
  return tags
    .map((tag) => asString(tag))
    .filter((tag) => tag.length > 0)
    .slice(0, 10);
}

function isActiveDraftStatus(status: string | null | undefined) {
  const normalized = asString(status).toLowerCase();
  return !["", "draft", "pending_payment", "delivered", "cancelled", "lost"].includes(normalized);
}

function getActiveDeliveryLabel(item: {
  status: string;
  assigned_driver_id: string | null;
}) {
  const normalized = asString(item.status).toLowerCase();
  if (normalized === "submitted") {
    return item.assigned_driver_id ? "Confirmed" : "Finding Driver";
  }

  if (["accepted", "confirmed", "in-progress"].includes(normalized)) {
    return "Preparing for Pickup";
  }

  if (
    [
      "picked-up",
      "picked_up",
      "out-for-delivery",
      "out_for_delivery",
      "in_transit",
    ].includes(normalized)
  ) {
    return "In Transit";
  }

  return "In Transit";
}

@Injectable()
export class CustomerDashboardService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly customerNotificationsService: CustomerNotificationsService,
  ) {}

  async getActiveDeliveries(session: SessionPayload, query: { search?: unknown; status?: unknown }) {
    ensureCustomer(session);

    const search = asString(query.search).toLowerCase();
    const statusFilter = asString(query.status).toLowerCase();
    const admin = this.supabaseService.createAdminClient();
    const { data: drafts, error } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("id, tracking_number, pickup_address, delivery_address, status, assigned_driver_id")
      .eq("user_id", session.userId)
      .in("status", ["submitted", "accepted", "confirmed", "in-progress", "picked-up", "picked_up", "out-for-delivery", "out_for_delivery", "in_transit"])
      .limit(20);

    if (error) {
      console.error("[customer-dashboard] active deliveries query failed:", error);
      throw new InternalServerErrorException("Unable to load active deliveries right now.");
    }

    const draftIds = (drafts ?? []).map((d) => d.id);
    const itemsMap = new Map<string, string>();
    const eventsMap = new Map<string, string>();
    if (draftIds.length > 0) {
      const [itemsResult, eventsResult] = await Promise.all([
        admin
          .schema("parcel")
          .from("parcel_draft_items")
          .select("parcel_draft_id, created_at")
          .in("parcel_draft_id", draftIds),
        admin
          .schema("location")
          .from("parcel_tracking_events")
          .select("parcel_draft_id, status")
          .in("parcel_draft_id", draftIds)
          .order("occurred_at", { ascending: true })
      ]);

      if (!itemsResult.error && itemsResult.data) {
        for (const item of itemsResult.data) {
          if (item.parcel_draft_id && item.created_at && !itemsMap.has(item.parcel_draft_id)) {
            itemsMap.set(item.parcel_draft_id, item.created_at);
          }
        }
      }

      if (!eventsResult.error && eventsResult.data) {
        for (const ev of eventsResult.data) {
          if (ev.parcel_draft_id && ev.status) {
            eventsMap.set(ev.parcel_draft_id, ev.status);
          }
        }
      }
    }

    const deliveries = (drafts ?? [])
      .filter((item) => isActiveDraftStatus(item.status))
      .map((item) => {
        const createdAt = itemsMap.get(item.id) ?? null;
        const latestEventStatus = eventsMap.get(item.id);
        
        let statusLabel = "";
        if (latestEventStatus) {
           const ev = latestEventStatus.toUpperCase();
           if (ev === "PICKED_UP") statusLabel = "Picked Up";
           else if (ev === "OUT_FOR_DELIVERY") statusLabel = "Out for Delivery";
           else if (ev === "DELIVERED") statusLabel = "Delivered";
           else if (ev === "ACCEPTED") statusLabel = "Preparing for Pickup";
           else statusLabel = latestEventStatus;
        } else {
           statusLabel = getActiveDeliveryLabel({
             status: item.status,
             assigned_driver_id: item.assigned_driver_id,
           });
        }

        return {
          id: item.tracking_number || item.id,
          trackingNumber: item.tracking_number || item.id,
          from: item.pickup_address || "Unknown origin",
          to: item.delivery_address || "Unknown destination",
          status: statusLabel,
          isLive: true,
          rawStatus: latestEventStatus || item.status,
          updatedAt: null,
          timeLabel: formatRelativeTime(createdAt),
          _createdAtSortValue: createdAt ? new Date(createdAt).getTime() : 0,
        };
      })
      .sort((a, b) => b._createdAtSortValue - a._createdAtSortValue);

    const filtered = deliveries.filter((item) => {
      const normalizedStatus = item.status.toLowerCase().replace(/\s+/g, "");
      const matchesStatus = !statusFilter || statusFilter === "all" || normalizedStatus === statusFilter;
      const haystack = `${item.trackingNumber} ${item.from} ${item.to}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      return matchesStatus && matchesSearch;
    });

    return {
      deliveries: filtered,
      summary: {
        totalActive: filtered.length,
        inTransit: filtered.length,
        outForDelivery: 0,
      },
    };
  }

  async getAnnouncements(session: SessionPayload) {
    ensureCustomer(session);

    const admin = this.supabaseService.createAdminClient();
    const nowTs = Date.now();
    const { data, error } = await admin
      .schema("account")
      .from("customer_announcements")
      .select("id, type, title, message, is_pinned, starts_at, ends_at, created_at")
      .eq("is_active", true)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return {
        announcements: [
          {
            id: "maint-001",
            type: "system",
            title: "Scheduled Maintenance",
            message: "System will be offline on March 15, 2:00 AM - 4:00 AM PHT.",
            isPinned: true,
          },
        ],
      };
    }

    return {
      announcements: (data ?? [])
        .filter((item) => {
          const startsAt = item.starts_at ? new Date(item.starts_at).getTime() : null;
          const endsAt = item.ends_at ? new Date(item.ends_at).getTime() : null;
          const startsOk = startsAt === null || (!Number.isNaN(startsAt) && startsAt <= nowTs);
          const endsOk = endsAt === null || (!Number.isNaN(endsAt) && endsAt >= nowTs);
          return startsOk && endsOk;
        })
        .map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          message: item.message,
          isPinned: Boolean(item.is_pinned),
        })),
    };
  }

  async submitReview(session: SessionPayload, input: ReviewInput) {
    ensureCustomer(session);

    const trackingNumber = asString(input.trackingNumber);
    const rating = Number(input.rating);
    const review = asString(input.review);
    const tags = normalizeTags(input.tags);

    if (!trackingNumber) {
      throw new BadRequestException("Tracking number is required.");
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException("Rating must be between 1 and 5.");
    }

    if (review.length > 500) {
      throw new BadRequestException("Review must be 500 characters or less.");
    }

    const admin = this.supabaseService.createAdminClient();
    const ownedBooking = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("id, assigned_driver_id").eq("user_id", session.userId).eq("tracking_number", trackingNumber).eq("status", "submitted").maybeSingle() as any;

    if (ownedBooking.error || !ownedBooking.data) {
      throw new BadRequestException("Tracking number not found in your completed bookings.");
    }

    const insertResult = await admin
      .schema("parcel")
      .from("parcel_reviews")
      .insert({
        parcel_draft_id: ownedBooking.data.id,
        tracking_number: trackingNumber,
        customer_user_id: session.userId,
        rating,
        review_text: review || null,
        tags,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id, tracking_number, rating, review_text, tags, created_at")
      .single();

    if (insertResult.error || !insertResult.data) {
      throw new InternalServerErrorException("Unable to submit your review right now.");
    }

    // Update driver_jobs rating if a driver was assigned
    if (ownedBooking.data.assigned_driver_id) {
      try {
        await admin
          .schema("driver")
          .from("driver_jobs")
          .update({ rating } as any)
          .eq("parcel_draft_id", ownedBooking.data.id)
          .eq("driver_id", ownedBooking.data.assigned_driver_id);
      } catch (err) {
        console.warn('[submitReview] Non-critical driver job rating update failed:', err.message);
      }
    }

    try {
      await admin
        .schema("parcel").from("parcel_activity_logs")
        .insert({
        user_id: session.userId,
        activity_type: "review",
        title: "Review submitted",
        description: `You submitted feedback for ${trackingNumber}.`,
      });
    } catch (err) {
      console.warn('[submitReview] Non-critical activity logging failed:', err.message);
    }

    await this.customerNotificationsService.createNotification(
      session.userId,
      "system",
      "Thanks for your feedback",
      `Your review for ${trackingNumber} has been saved.`,
    );

    return {
      review: {
        id: insertResult.data.id,
        trackingNumber: insertResult.data.tracking_number,
        rating: insertResult.data.rating,
        review: insertResult.data.review_text,
        tags: insertResult.data.tags ?? [],
        createdAt: insertResult.data.created_at,
      },
    };
  }

  async getRecentReviews(session: SessionPayload, limitInput?: unknown) {
    ensureCustomer(session);

    const limit = Math.min(Math.max(Number(limitInput) || 5, 1), 20);
    const admin = this.supabaseService.createAdminClient();
    const result = await admin
      .schema("parcel").from("parcel_reviews").select("id, tracking_number, rating, review_text, tags, created_at").eq("customer_user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (result.error) {
      return { reviews: [] };
    }

    return {
      reviews: (result.data ?? []).map((item) => ({
        id: item.id,
        trackingNumber: item.tracking_number,
        rating: item.rating,
        review: item.review_text,
        tags: item.tags ?? [],
        createdAt: item.created_at,
      })),
    };
  }

  async getPreferences(session: SessionPayload) {
    ensureCustomer(session);

    const admin = this.supabaseService.createAdminClient();
    const authUser = await admin.auth.admin.getUserById(session.userId);
    const metadata = authUser.data.user?.user_metadata ?? {};

    return {
      preferences: parsePreferences(metadata.preferences),
    };
  }

  async updatePreferences(session: SessionPayload, patch: PreferencePatch) {
    ensureCustomer(session);

    const admin = this.supabaseService.createAdminClient();
    const authUser = await admin.auth.admin.getUserById(session.userId);
    const metadata = authUser.data.user?.user_metadata ?? {};
    const current = parsePreferences(metadata.preferences);

    const preferences = {
      ...current,
      ...(typeof patch.emailNotifications === "boolean"
        ? { emailNotifications: patch.emailNotifications }
        : {}),
      ...(typeof patch.smsUpdates === "boolean" ? { smsUpdates: patch.smsUpdates } : {}),
      ...(typeof patch.autoExtend === "boolean" ? { autoExtend: patch.autoExtend } : {}),
    };

    const updateResult = await admin.auth.admin.updateUserById(session.userId, {
      user_metadata: {
        ...metadata,
        preferences,
      },
    });

    if (updateResult.error) {
      throw new InternalServerErrorException("Unable to save preferences right now.");
    }

    return { preferences };
  }
}
