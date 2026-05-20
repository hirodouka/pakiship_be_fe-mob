import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import {
  DEFAULT_ITEMS_PAGE_SIZE,
  MAX_ITEMS_PAGE_SIZE,
} from "./parcel-drafts.constants";

@Injectable()
export class ParcelDraftsRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async findOwnedDraftSummary(draftId: string, userId: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select("id, user_id, status, tracking_number")
      .eq("id", draftId)
      .eq("user_id", userId)
      .single();
  }

  async saveStepOneDraft(
    draftId: string | null,
    userId: string,
    payload: Record<string, unknown>,
  ) {
    const supabase = this.supabaseService.createAdminClient();
    const validColumns = [
      "id",
      "user_id",
      "tracking_number",
      "pickup_address",
      "delivery_address",
      "sender_name",
      "sender_phone",
      "receiver_name",
      "receiver_phone",
      "service_id",
      "service_price",
      "delivery_mode",
      "assigned_driver_id",
      "status",
      "drop_off_point_id",
      "tracking_progress_percentage",
      "is_bulk",
      "drop_off_point_name",
      "drop_off_point_address",
      "drop_off_point_distance_text",
      "drop_off_point_status",
      "drop_off_point_capacity"
    ];

    const cleanedPayload: Record<string, unknown> = {
      user_id: userId,
    };
    for (const key of Object.keys(payload)) {
      if (validColumns.includes(key)) {
        cleanedPayload[key] = payload[key];
      }
    }

    if (draftId) {
      return supabase
        .schema("parcel")
        .from("parcel_drafts")
        .update(cleanedPayload)
        .eq("id", draftId)
        .eq("user_id", userId)
        .select("id")
        .single();
    }

    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .insert(cleanedPayload)
      .select("id")
      .single();
  }

  async findOwnedDraftWithItems(
    draftId: string,
    userId: string,
    itemsLimit = DEFAULT_ITEMS_PAGE_SIZE,
  ) {
    const cappedLimit = Math.min(Math.max(itemsLimit, 1), MAX_ITEMS_PAGE_SIZE);
    const supabase = this.supabaseService.createAdminClient();

    // 1. Fetch the draft itself
    const draftResult = await supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(`
          id,
          pickup_address,
          delivery_address,
          status,
          tracking_number,
          user_id
      `)
      .eq("id", draftId)
      .eq("user_id", userId)
      .single();

    if (draftResult.error || !draftResult.data) {
      return { data: null, error: draftResult.error, itemCount: 0, itemPageSize: cappedLimit };
    }

    // 2. Fetch the items separately (Bypasses relationship cache issues)
    const itemsResult = await supabase
      .schema("parcel")
      .from("parcel_draft_items")
      .select(`
          id,
          size,
          weight_text,
          item_type,
          delivery_guarantee,
          quantity,
          photo_url
      `)
      .eq("parcel_draft_id", draftId)
      .order("id", { ascending: true })
      .limit(cappedLimit);

    const countResult = await supabase
      .schema("parcel")
      .from("parcel_draft_items")
      .select("id", { count: "exact", head: true })
      .eq("parcel_draft_id", draftId);

    // 3. Combine them manually
    const combinedData = {
      ...draftResult.data,
      parcel_draft_items: itemsResult.data || []
    };

    return {
      data: combinedData,
      error: itemsResult.error,
      itemCount: countResult.count ?? 0,
      itemPageSize: cappedLimit,
    };
  }

  async listOwnedDraftItemsWithCount(
    draftId: string,
    userId: string,
    limit = DEFAULT_ITEMS_PAGE_SIZE,
    offset = 0,
  ) {
    const cappedLimit = Math.min(Math.max(limit, 1), MAX_ITEMS_PAGE_SIZE);
    const safeOffset = Math.max(offset, 0);
    const supabase = this.supabaseService.createAdminClient();

    const { data: draft, error: draftError } = await supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select("id")
      .eq("id", draftId)
      .eq("user_id", userId)
      .single();

    if (draftError || !draft) {
      return { data: null, error: draftError ?? new Error("Draft not found"), totalCount: 0 };
    }

    const { data, error, count } = await supabase
      .schema("parcel")
      .from("parcel_draft_items")
      .select(
        "id, size, weight_text, item_type, delivery_guarantee, quantity, photo_url",
        { count: "exact" },
      )
      .eq("parcel_draft_id", draftId)
      .order("id", { ascending: true })
      .range(safeOffset, safeOffset + cappedLimit - 1);

    return { data, error, totalCount: count ?? 0, limit: cappedLimit, offset: safeOffset };
  }

  async findOwnedDraftItem(draftId: string, itemId: string, userId: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_draft_items")
      .select(`
        id,
        quantity,
        parcel_drafts!inner (
          id,
          user_id
        )
      `)
      .eq("id", itemId)
      .eq("parcel_draft_id", draftId)
      .eq("parcel_drafts.user_id", userId)
      .single();
  }

  async createDraftItems(items: Record<string, unknown>[]) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase.schema("parcel").from("parcel_draft_items").insert(items).select("id");
  }

  async updateDraftItemQuantity(draftId: string, itemId: string, quantity: number) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_draft_items")
      .update({ quantity })
      .eq("id", itemId)
      .eq("parcel_draft_id", draftId);
  }

  async deleteDraftItem(draftId: string, itemId: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_draft_items")
      .delete()
      .eq("id", itemId)
      .eq("parcel_draft_id", draftId);
  }

  async updateOwnedDraftState(
    draftId: string,
    userId: string,
    patch: Record<string, unknown>,
  ) {
    const supabase = this.supabaseService.createAdminClient();
    const validColumns = [
      "id",
      "user_id",
      "tracking_number",
      "pickup_address",
      "delivery_address",
      "sender_name",
      "sender_phone",
      "receiver_name",
      "receiver_phone",
      "service_id",
      "service_price",
      "delivery_mode",
      "assigned_driver_id",
      "status",
      "drop_off_point_id",
      "tracking_progress_percentage",
      "is_bulk",
      "drop_off_point_name",
      "drop_off_point_address",
      "drop_off_point_distance_text",
      "drop_off_point_status",
      "drop_off_point_capacity"
    ];

    const cleanedPatch: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      if (validColumns.includes(key)) {
        cleanedPatch[key] = patch[key];
      }
    }

    if (Object.keys(cleanedPatch).length === 0) {
      return supabase
        .schema("parcel")
        .from("parcel_drafts")
        .select("id, status, tracking_number")
        .eq("id", draftId)
        .eq("user_id", userId)
        .single();
    }

    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .update(cleanedPatch)
      .eq("id", draftId)
      .eq("user_id", userId)
      .select("id, status, tracking_number")
      .single();
  }

  async findOwnedSubmittedDraftByTrackingNumber(userId: string, trackingNumber: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(
        `
          id,
          tracking_number,
          pickup_address,
          delivery_address,
          status,
          sender_name,
          sender_phone,
          receiver_name,
          receiver_phone,
          assigned_driver_id,
          created_at,
          updated_at
        `,
      )
      .eq("user_id", userId)
      .eq("tracking_number", trackingNumber)
      .in("status", ["submitted", "delivered", "cancelled", "lost"])
      .single();
  }

  async listOwnedHistory(userId: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(
        `
          id,
          tracking_number,
          pickup_address,
          delivery_address,
          status,
          sender_name,
          sender_phone,
          receiver_name,
          receiver_phone,
          created_at,
          updated_at,
          tracking_progress_label,
          assigned_driver_id,
          parcel_draft_items (
            id,
            item_type,
            delivery_guarantee,
            quantity,
            weight_text
          )
        `,
      )
      .eq("user_id", userId)
      .in("status", ["submitted", "cancelled", "delivered"])
      .order("created_at", { ascending: false });
  }

  async findOwnedHistoryByTrackingNumber(userId: string, trackingNumber: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(
        `
          id,
          tracking_number,
          pickup_address,
          delivery_address,
          status,
          sender_name,
          sender_phone,
          receiver_name,
          receiver_phone,
          created_at,
          updated_at,
          tracking_progress_label,
          assigned_driver_id,
          parcel_draft_items (
            id,
            item_type,
            delivery_guarantee,
            quantity,
            weight_text
          )
        `,
      )
      .eq("user_id", userId)
      .eq("tracking_number", trackingNumber)
      .single();
  }

  async findDraftByTrackingNumber(trackingNumber: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(
        `
          id,
          tracking_number,
          pickup_address,
          delivery_address,
          status,
          sender_name,
          sender_phone,
          receiver_name,
          receiver_phone,
          assigned_driver_id,
          user_id,
          created_at,
          updated_at
        `,
      )
      .eq("tracking_number", trackingNumber)
      .maybeSingle();
  }

  async listRelayBookingsForHub(hubId: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(
        `
          id,
          tracking_number,
          pickup_address,
          delivery_address,
          status,
          created_at,
          updated_at,
          sender_name,
          sender_phone,
          receiver_name,
          receiver_phone,
          service_id,
          delivery_mode,
          is_bulk,
          drop_off_point_id,
          drop_off_point_name,
          drop_off_point_address,
          drop_off_point_distance_text,
          drop_off_point_status,
          drop_off_point_capacity,
          tracking_current_location,
          tracking_progress_label,
          tracking_progress_percentage,
          parcel_draft_items (
            id,
            item_type,
            quantity,
            weight_text
          )
        `,
      )
      .eq("service_id", "pakishare")
      .eq("drop_off_point_id", hubId)
      .in("status", ["draft", "submitted"])
      .order("updated_at", { ascending: false });
  }

  async listRecentRelayBookings(limit = 10) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(
        `
          id,
          tracking_number,
          pickup_address,
          delivery_address,
          status,
          created_at,
          updated_at,
          sender_name,
          sender_phone,
          receiver_name,
          receiver_phone,
          service_id,
          delivery_mode,
          is_bulk,
          drop_off_point_id,
          drop_off_point_name,
          drop_off_point_address,
          drop_off_point_distance_text,
          drop_off_point_status,
          drop_off_point_capacity,
          tracking_current_location,
          tracking_progress_label,
          tracking_progress_percentage,
          parcel_draft_items (
            id,
            item_type,
            quantity,
            weight_text
          )
        `,
      )
      .eq("service_id", "pakishare")
      .in("status", ["draft", "submitted"])
      .order("updated_at", { ascending: false })
      .limit(limit);
  }

  async findRelayBookingById(draftId: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .select(
        `
          id,
          user_id,
          tracking_number,
          status,
          service_id,
          delivery_mode,
          drop_off_point_id,
          tracking_current_location,
          tracking_progress_label,
          tracking_progress_percentage,
          receiver_name
        `,
      )
      .eq("id", draftId)
      .eq("service_id", "pakishare")
      .maybeSingle();
  }

  async updateRelayBookingTracking(draftId: string, patch: Record<string, unknown>) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase
      .schema("parcel")
      .from("parcel_drafts")
      .update(patch)
      .eq("id", draftId)
      .eq("service_id", "pakishare")
      .select(
        "id, tracking_number, tracking_current_location, tracking_progress_label, tracking_progress_percentage",
      )
      .single();
  }
}
