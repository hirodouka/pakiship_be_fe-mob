import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  forwardRef,
} from "@nestjs/common";
import type { SessionPayload } from "../common/session/session.types";
import { ParcelDraftsRepository } from "./parcel-drafts.repository";
import {
  ALLOWED_SERVICES,
  DEFAULT_ITEMS_PAGE_SIZE,
  MAX_ITEM_QUANTITY,
  MAX_ITEMS_PAGE_SIZE,
  MAX_ITEMS_PER_REQUEST,
} from "./parcel-drafts.constants";
import { CustomerNotificationsService } from "../customer-notifications/customer-notifications.service";
import { SupabaseService } from "../supabase/supabase.service";
import { DriverDashboardService } from "../driver-dashboard/driver-dashboard.service";
import { DropOffPointsService } from "../drop-off-points/drop-off-points.service";
import { GoogleMapsService } from "../google-maps/google-maps.service";
import { PaymentService } from "../payment/payment.service";

const PHONE_REGEX = /^09\d{9}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


type DraftItemInput = {
  size?: unknown;
  weight?: unknown;
  itemType?: unknown;
  deliveryGuarantee?: unknown;
  quantity?: unknown;
  photoName?: unknown;
};

type SelectedDropOffPoint = {
  id: string;
  name: string | null;
  address: string | null;
};

function asNonEmptyString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function parsePositiveInteger(value: unknown, fallback = 1) {
  const number = Number(value ?? fallback);
  if (!Number.isInteger(number) || number < 1) {
    return null;
  }

  return number;
}

function createTrackingNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hex = Math.floor(Math.random() * 0x100000000)
    .toString(16)
    .padStart(8, "0")
    .substring(0, 8)
    .toUpperCase();
  return `PKS-${year}${month}${day}-${hex}`;
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getHistoryStatus(item: any) {
  const status = item.status;
  const label = item.tracking_progress_label;
  const driverId = item.assigned_driver_id;

  if (label) {
    return {
      label,
      isLive: status !== "delivered" && status !== "cancelled",
      bucket: (status === "delivered" || status === "cancelled") ? "completed" : "active" as const,
    };
  }

  if (status === "submitted" || status === "draft") {
    return {
      label: status === "submitted" ? (driverId ? "Confirmed" : "Finding Driver") : "Draft",
      isLive: status === "submitted",
      bucket: "active" as const,
    };
  }

  if (status === "delivered") {
    return {
      label: "Delivered",
      isLive: false,
      bucket: "completed" as const,
    };
  }

  return {
    label: "Cancelled",
    isLive: false,
    bucket: "completed" as const,
  };
}

function getHistoryType(items: Array<{ item_type?: string | null; delivery_guarantee?: string | null }>) {
  const firstItem = items[0];
  if (!firstItem) return "Parcel Delivery";
  if (firstItem.delivery_guarantee) {
    return `${String(firstItem.delivery_guarantee).charAt(0).toUpperCase()}${String(
      firstItem.delivery_guarantee,
    ).slice(1)} Delivery`;
  }
  if (firstItem.item_type) {
    return String(firstItem.item_type);
  }
  return "Parcel Delivery";
}

function hashAddressSeed(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 10000;
  }

  return hash;
}


function normalizeDropOffPoint(value: unknown): SelectedDropOffPoint | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const point = value as Record<string, unknown>;
  const id = asNonEmptyString(point.id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: asNonEmptyString(point.name),
    address: asNonEmptyString(point.address),
  };
}

function asUuidOrNull(value?: string | null) {
  return value && UUID_PATTERN.test(value) ? value : null;
}

@Injectable()
export class ParcelDraftsService {
  constructor(
    private readonly repository: ParcelDraftsRepository,
    private readonly customerNotificationsService: CustomerNotificationsService,
    private readonly supabaseService: SupabaseService,
    private readonly googleMapsService: GoogleMapsService,
    private readonly dropOffPointsService: DropOffPointsService,
    private readonly paymentService: PaymentService,
    @Inject(forwardRef(() => DriverDashboardService))
    private readonly driverDashboardService: DriverDashboardService,
  ) {}

  private calculatePrice(serviceId: string, distanceKm: number, packageSize: string, totalParcels: number): number {
    const safeDistance = isNaN(distanceKm) || distanceKm < 0 ? 0 : distanceKm;
    
    // Financial Constants (₱)
    const SURGE_PRICE = 20.00;
    const DISCOUNT_RATE = 0.10;
    const VAT_RATE = 0.12;

    let baseRate = 0;
    let distanceFee = 0;
    let isRelay = false;

    // 1. Identify Service Mode and Base Rates
    const sid = serviceId.toLowerCase();
    if (sid.includes('share')) {
      // Relay Mode (PUV)
      baseRate = 30.00;
      isRelay = true;
    } else if (sid.includes('express')) {
      // Direct Mode (Motorcycle)
      baseRate = 50.00;
      distanceFee = safeDistance * 10.00;
    } else if (sid.includes('business')) {
      // Direct Mode (Sedan/SUV)
      baseRate = 100.00;
      distanceFee = safeDistance * 15.00;
    } else {
      // Fallback/Default
      baseRate = 50.00;
      distanceFee = safeDistance * 10.00;
    }

    // 2. Compute Raw Total (Base + Distance + Surge)
    // For Relay, distance fee is N/A (0)
    const rawTotal = baseRate + distanceFee + SURGE_PRICE;

    // 3. Apply Discount (10%)
    const discountedTotal = rawTotal * (1 - DISCOUNT_RATE);

    // 4. Apply VAT (12%)
    const finalPrice = discountedTotal * (1 + VAT_RATE);

    console.log(`[PricingEngine] Mode: ${isRelay ? 'Relay' : 'Direct'}, Base: ₱${baseRate}, Dist: ${safeDistance}km (₱${distanceFee}), Raw: ₱${rawTotal}, Final: ₱${finalPrice.toFixed(2)}`);

    return Math.round(finalPrice);
  }

  private async createRouteEstimate(pickupAddress: string, deliveryAddress: string) {
    try {
      const matrix = await this.googleMapsService.getDistanceMatrix(pickupAddress, deliveryAddress);
      const element = matrix?.rows?.[0]?.elements?.[0];

      if (element?.status === 'OK') {
        const distanceKm = element.distance.value / 1000;
        const durationMinutes = Math.ceil(element.duration.value / 60);

        return {
          distanceKm,
          durationMinutes,
          distanceText: element.distance.text,
          durationText: element.duration.text,
        };
      }
    } catch (error) {
      console.error('Distance Matrix API failed, falling back to estimate:', error);
    }

    // Fallback to legacy mock logic if API fails
    const combinedSeed = hashAddressSeed(
      `${pickupAddress.toLowerCase()}::${deliveryAddress.toLowerCase()}`,
    );
    const baseDistance = 2 + (combinedSeed % 240) / 10;
    const distanceKm = Math.max(1.5, Number(baseDistance.toFixed(1)));
    const durationMinutes = Math.max(12, Math.round(distanceKm * 4.5 + 8));

    return {
      distanceKm,
      durationMinutes,
      distanceText: `${distanceKm.toFixed(1)} km`,
      durationText:
        durationMinutes >= 60
          ? `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} mins`
          : `${durationMinutes} mins`,
    };
  }

  async estimateRoute(user: SessionPayload, body: Record<string, unknown>) {
    if (!user?.userId) {
      throw new BadRequestException("Authenticated user is required.");
    }

    const pickupAddress = asNonEmptyString(
      (body.pickupLocation as { address?: unknown } | undefined)?.address,
    );
    const deliveryAddress = asNonEmptyString(
      (body.deliveryLocation as { address?: unknown } | undefined)?.address,
    );

    if (!pickupAddress || !deliveryAddress) {
      throw new BadRequestException("Pickup and delivery locations are required.");
    }

    return {
      pickupAddress,
      deliveryAddress,
      ...(await this.createRouteEstimate(pickupAddress, deliveryAddress)),
    };
  }

  async getRoute(user: SessionPayload, body: Record<string, unknown>) {
    const origin = asNonEmptyString(body.origin);
    const destination = asNonEmptyString(body.destination);

    if (!origin || !destination) {
      throw new BadRequestException("Origin and destination are required.");
    }

    const data = await this.googleMapsService.getDirections(origin, destination);
    if (data.status !== 'OK') {
      throw new InternalServerErrorException(`Directions API failed: ${data.status}`);
    }

    const route = data.routes[0];
    const polyline = route.overview_polyline.points;
    const distance = route.legs[0].distance.value / 1000;
    const duration = route.legs[0].duration.value / 60;

    return {
      polyline,
      distance,
      duration,
    };
  }

  async reverseGeocode(user: SessionPayload, body: Record<string, unknown>) {
    const lat = Number(body.lat);
    const lng = Number(body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      throw new BadRequestException("Latitude and longitude are required.");
    }

    const data = await this.googleMapsService.getReverseGeocode(lat, lng);
    if (data.status !== 'OK') {
      return { address: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
    }

    return {
      address: data.results[0]?.formatted_address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    };
  }

  async getAvailableHubs(user: SessionPayload, lat?: number, lng?: number) {
    if (!user?.userId) {
      throw new BadRequestException("Authenticated user is required.");
    }

    const result = await this.dropOffPointsService.listNearby();

    return {
      hubs: (result.points || []).map((h) => ({
        id: h.id,
        name: h.name,
        address: h.address,
        distance: h.distance,
        status: h.status,
        capacity: h.capacity,
      })),
    };
  }

  private async saveSelectedService(
    draftId: string,
    serviceId: string,
    servicePrice: number,
    dropOffPoint: SelectedDropOffPoint | null,
  ) {
    const admin = this.supabaseService.createAdminClient();

    const { error } = await admin
      .schema("parcel")
      .from("parcel_service_selections")
      .upsert(
        {
          parcel_draft_id: draftId,
          service_id: serviceId,
          service_price: servicePrice,
          hub_id: dropOffPoint?.id ?? null,
          hub_name: dropOffPoint?.name ?? null,
          hub_address: dropOffPoint?.address ?? null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "parcel_draft_id",
        },
      );

    if (error) {
      console.error('--- SUPABASE ERROR [saveSelectedService] ---');
      console.error('Code:', error.code);
      console.error('Message:', error.message);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
      console.error('Payload:', { draftId, serviceId, servicePrice, hubId: dropOffPoint?.id });
      throw new InternalServerErrorException(`Database error: ${error.message}`);
    }
  }

  private async ensureSelectedService(
    draftId: string,
    serviceId: string,
    servicePrice: number,
    dropOffPoint: SelectedDropOffPoint | null,
  ) {
    if (serviceId !== "pakishare") return;

    const admin = this.supabaseService.createAdminClient();
    const existing = await admin
      .schema("parcel")
      .from("parcel_service_selections")
      .select("parcel_draft_id")
      .eq("parcel_draft_id", draftId)
      .maybeSingle();

    if (existing.data) return;
    if (existing.error) {
      console.warn("[ensureSelectedService] Unable to inspect service selection:", existing.error.message);
    }

    let selectedHub = dropOffPoint;
    if (!selectedHub?.id) {
      const { data: hub, error: hubError } = await admin
        .schema("parcel")
        .from("drop_off_points")
        .select("id, name, address")
        .eq("is_active", true)
        .neq("status", "Closed")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (hubError) {
        console.warn("[ensureSelectedService] Unable to load default hub:", hubError.message);
      }

      if (hub) {
        selectedHub = {
          id: hub.id,
          name: hub.name,
          address: hub.address,
        };
      }
    }

    if (selectedHub?.id) {
      await this.saveSelectedService(draftId, serviceId, servicePrice, selectedHub);
    }
  }

  async saveRouteDetails(user: SessionPayload, body: Record<string, unknown>) {
    const draftId = body.draftId ? String(body.draftId) : null;
    const pickupAddress = asNonEmptyString(
      (body.pickupLocation as { address?: unknown } | undefined)?.address,
    );
    const deliveryAddress = asNonEmptyString(
      (body.deliveryLocation as { address?: unknown } | undefined)?.address,
    );

    if (!pickupAddress || !deliveryAddress) {
      throw new BadRequestException("Pickup and delivery locations are required.");
    }

    console.log('Saving route details for draft:', draftId);
    const estimate = await this.createRouteEstimate(pickupAddress, deliveryAddress);
    console.log('Estimate calculated:', estimate);
    
    // Validate distance from body. If it contains "undefined", use estimate.
    const bodyDistance = asNonEmptyString(body.distance);
    const savedDistance = (bodyDistance && !bodyDistance.includes('undefined')) 
      ? bodyDistance 
      : estimate.distanceText;
    
    const bodyDuration = asNonEmptyString(body.duration);
    const savedDuration = (bodyDuration && !bodyDuration.includes('undefined')) 
      ? bodyDuration 
      : estimate.durationText;

    console.log('Attempting to save draft to DB:', { draftId, userId: user.userId });
    const { data, error } = await this.repository.saveStepOneDraft(draftId, user.userId, {
      pickup_address: pickupAddress,
      pickup_details: asNonEmptyString(
        (body.pickupLocation as { details?: unknown } | undefined)?.details,
      ),
      pickup_lat: Number((body.pickupLocation as any)?.lat) || estimate.distanceKm > 0 ? Number((body.pickupLocation as any)?.lat) : null,
      pickup_lng: Number((body.pickupLocation as any)?.lng) || estimate.distanceKm > 0 ? Number((body.pickupLocation as any)?.lng) : null,
      delivery_address: deliveryAddress,
      delivery_details: asNonEmptyString(
        (body.deliveryLocation as { details?: unknown } | undefined)?.details,
      ),
      delivery_lat: Number((body.deliveryLocation as any)?.lat) || null,
      delivery_lng: Number((body.deliveryLocation as any)?.lng) || null,
      distance_text: savedDistance,
      duration_text: savedDuration,
      step_completed: 1,
      status: "draft",
    });

    if (error || !data) {
      console.error('Save Step 1 Error:', JSON.stringify(error, null, 2));
      throw new InternalServerErrorException(
        draftId ? `Unable to update parcel draft. (DB error: ${error?.message})` : `Unable to create parcel draft. (DB error: ${error?.message})`,
      );
    }

    return {
      draftId: data.id,
      distance: savedDistance,
      duration: savedDuration,
      distanceKm: estimate.distanceKm,
      durationMinutes: estimate.durationMinutes,
    };
  }

  async getDraftDetails(user: SessionPayload, draftId: string, itemsLimit?: number) {
    const limit = Math.min(
      Math.max(itemsLimit ?? DEFAULT_ITEMS_PAGE_SIZE, 1),
      MAX_ITEMS_PAGE_SIZE,
    );
    const { data, error, itemCount, itemPageSize } = await this.repository.findOwnedDraftWithItems(
      draftId,
      user.userId,
      limit,
    );

    if (error || !data) {
      throw new NotFoundException("Parcel draft not found.");
    }

    const items = (data.parcel_draft_items ?? []).map((item) => ({
      id: item.id,
      size: item.size,
      weight: item.weight_text,
      itemType: item.item_type,
      deliveryGuarantee: item.delivery_guarantee,
      quantity: item.quantity,
      photoName: item.photo_name,
    }));

    return {
      draft: {
        id: data.id,
        pickupLocation: {
          address: data.pickup_address,
          details: data.pickup_details,
        },
        deliveryLocation: {
          address: data.delivery_address,
          details: data.delivery_details,
        },
        distance: data.distance_text,
        duration: data.duration_text,
        stepCompleted: data.step_completed,
        status: data.status,
        trackingNumber: data.tracking_number,
        items,
      },
      pagination: {
        totalItems: itemCount,
        itemsReturned: items.length,
        limit: itemPageSize,
        hasMore: itemCount > items.length,
      },
    };
  }

  async getDraftItemsPage(user: SessionPayload, draftId: string, limit?: number, offset?: number) {
    const requestedLimit = Math.min(
      Math.max(limit ?? DEFAULT_ITEMS_PAGE_SIZE, 1),
      MAX_ITEMS_PAGE_SIZE,
    );
    const safeOffset = Math.max(offset ?? 0, 0);
    const { data, error, totalCount } = await this.repository.listOwnedDraftItemsWithCount(
      draftId,
      user.userId,
      requestedLimit,
      safeOffset,
    );

    if (error || !data) {
      throw new NotFoundException("Parcel draft not found.");
    }

    return {
      items: data.map((item: { id: string; size: string; weight_text: string; item_type: string; delivery_guarantee: string; quantity: number; photo_name: string | null }) => ({
        id: item.id,
        size: item.size,
        weight: item.weight_text,
        itemType: item.item_type,
        deliveryGuarantee: item.delivery_guarantee,
        quantity: item.quantity,
        photoName: item.photo_name,
      })),
      pagination: {
        totalItems: totalCount,
        limit: requestedLimit,
        offset: safeOffset,
        hasMore: safeOffset + data.length < totalCount,
      },
    };
  }

  private normalizeDraftItemInput(input: DraftItemInput) {
    const size = asNonEmptyString(input.size);
    const weight = asNonEmptyString(input.weight);
    const itemType = asNonEmptyString(input.itemType);
    const deliveryGuarantee = asNonEmptyString(input.deliveryGuarantee);
    const quantity = parsePositiveInteger(input.quantity, 1);

    if (!size || !weight || !itemType || !deliveryGuarantee) {
      throw new BadRequestException("Parcel details are incomplete.");
    }

    if (!quantity || quantity > MAX_ITEM_QUANTITY) {
      throw new BadRequestException(`Quantity must be between 1 and ${MAX_ITEM_QUANTITY}.`);
    }

    return {
      size,
      weight_text: weight,
      item_type: itemType,
      delivery_guarantee: deliveryGuarantee,
      quantity,
      photo_name: asNonEmptyString(input.photoName),
    };
  }

  async addDraftItems(user: SessionPayload, draftId: string, body: Record<string, unknown>) {
    const ownedDraft = await this.repository.findOwnedDraftSummary(draftId, user.userId);
    if (ownedDraft.error || !ownedDraft.data) {
      throw new NotFoundException("Parcel draft not found.");
    }

    const rawItems = Array.isArray(body.items) ? body.items : [body];
    if (rawItems.length < 1 || rawItems.length > MAX_ITEMS_PER_REQUEST) {
      throw new BadRequestException(
        `You can submit between 1 and ${MAX_ITEMS_PER_REQUEST} items per request.`,
      );
    }

    const normalizedItems = rawItems.map((rawItem) => ({
      parcel_draft_id: draftId,
      ...this.normalizeDraftItemInput((rawItem ?? {}) as DraftItemInput),
    }));

    const { data, error } = await this.repository.createDraftItems(normalizedItems);
    if (error || !data) {
      throw new InternalServerErrorException("Unable to save parcel item.");
    }

    const stepResult = await this.repository.updateOwnedDraftState(draftId, user.userId, {
      step_completed: 3,
    });

    if (stepResult.error) {
      throw new InternalServerErrorException("Unable to update parcel draft progress.");
    }

    return {
      itemId: data[0]?.id ?? null,
      itemIds: data.map((item) => item.id),
      createdCount: data.length,
    };
  }

  async updateDraftItem(
    user: SessionPayload,
    draftId: string,
    itemId: string,
    body: Record<string, unknown>,
  ) {
    const quantity = parsePositiveInteger(body.quantity);
    if (!quantity || quantity > MAX_ITEM_QUANTITY) {
      throw new BadRequestException(`Quantity must be between 1 and ${MAX_ITEM_QUANTITY}.`);
    }

    const ownedItem = await this.repository.findOwnedDraftItem(draftId, itemId, user.userId);
    if (ownedItem.error || !ownedItem.data) {
      throw new NotFoundException("Parcel item not found.");
    }

    const updateResult = await this.repository.updateDraftItemQuantity(draftId, itemId, quantity);
    if (updateResult.error) {
      throw new InternalServerErrorException("Unable to update parcel quantity.");
    }

    const stepResult = await this.repository.updateOwnedDraftState(draftId, user.userId, {
      step_completed: 3,
    });
    if (stepResult.error) {
      throw new InternalServerErrorException("Unable to update parcel draft progress.");
    }

    return { itemId, quantity };
  }

  async removeDraftItem(user: SessionPayload, draftId: string, itemId: string) {
    const ownedItem = await this.repository.findOwnedDraftItem(draftId, itemId, user.userId);
    if (ownedItem.error || !ownedItem.data) {
      throw new NotFoundException("Parcel item not found.");
    }

    const deleteResult = await this.repository.deleteDraftItem(draftId, itemId);
    if (deleteResult.error) {
      throw new InternalServerErrorException("Unable to remove parcel item.");
    }

    const stepResult = await this.repository.updateOwnedDraftState(draftId, user.userId, {
      step_completed: 3,
    });
    if (stepResult.error) {
      throw new InternalServerErrorException("Unable to update parcel draft progress.");
    }

    return { itemId };
  }

  async selectDraftService(user: SessionPayload, draftId: string, body: Record<string, unknown>) {
    const rawServiceId = String(body.serviceId ?? "");
    const serviceMap: Record<string, string> = {
      'share': 'pakishare',
      'express': 'PakiExpress',
      'business': 'pakibusiness'
    };
    const serviceId = serviceMap[rawServiceId] || rawServiceId;
    const servicePrice = Number(body.servicePrice ?? 0);
    const dropOffPoint = normalizeDropOffPoint(body.dropOffPoint);

    if (!ALLOWED_SERVICES.has(serviceId)) {
      throw new BadRequestException("Please select a valid delivery service.");
    }

    if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
      throw new BadRequestException("Service pricing is invalid.");
    }

    if ((serviceId === "pakishare" || serviceId === "share") && !dropOffPoint?.id) {
      throw new BadRequestException("PakiShare requires a drop-off hub selection.");
    }

    console.log(`[selectDraftService] Looking up draft ${draftId} for user ${user.userId}`);
    const { data: draft, itemCount, error: draftError } = await this.repository.findOwnedDraftWithItems(draftId, user.userId);
    
    if (draftError || !draft) {
      console.error('--- DRAFT NOT FOUND ---');
      console.error('Error:', draftError);
      console.error('DraftId:', draftId);
      console.error('UserId:', user.userId);
      throw new NotFoundException(`Parcel draft not found or access denied. (DB error: ${draftError?.message})`);
    }
    console.log(`[selectDraftService] Found draft. Items: ${itemCount}. Status: ${draft.status}`);

    const rawDistance = draft.distance_text ?? '0';
    const distanceKm = parseFloat(rawDistance.replace(/[^\d.]/g, '')) || 0;
    const firstItem = draft.parcel_draft_items?.[0];
    const packageSize = firstItem?.size ?? 'small';
    const totalParcels = itemCount;

    // Use backend-calculated price if frontend price is suspiciously different
    const calculatedPrice = this.calculatePrice(serviceId, distanceKm, packageSize, totalParcels);
    
    // We allow some flexibility or trust the frontend price if it's within range, 
    // but here we ensure we save the most accurate one or the one we just calculated.
    const finalPrice = servicePrice > 0 ? servicePrice : calculatedPrice;

    const updateResult = await this.repository.updateOwnedDraftState(draftId, user.userId, {
      step_completed: 4,
      status: "draft",
      service_id: serviceId,
      service_price: finalPrice,
      delivery_mode: serviceId === 'pakishare' ? 'relay' : 'direct',
      drop_off_point_id: asUuidOrNull(dropOffPoint?.id),
      drop_off_point_name: dropOffPoint?.name ?? null,
      drop_off_point_address: dropOffPoint?.address ?? null,
      is_bulk: false,
    });
    if (updateResult.error) {
      console.error('--- SUPABASE ERROR [selectDraftService - updateOwnedDraftState] ---');
      console.error('Error:', updateResult.error);
      throw new InternalServerErrorException(`Draft update failed: ${updateResult.error.message}`);
    }

    await this.saveSelectedService(
      draftId,
      serviceId,
      finalPrice,
      serviceId === "pakishare" ? dropOffPoint : null,
    );

    return {
      draftId,
      stepCompleted: 4,
      status: "draft",
      service: {
        id: serviceId,
        price: finalPrice,
        dropOffPoint,
      },
    };
  }

  async completeBooking(user: SessionPayload, draftId: string, body: Record<string, unknown>) {
    let senderName = asNonEmptyString(body.senderName) || "";
    const senderPhone = String(body.senderPhone ?? "").trim();

    const admin = this.supabaseService.createAdminClient();
    const { data: profile } = await admin
      .schema("account")
      .from("profiles")
      .select("full_name")
      .eq("id", user.userId)
      .maybeSingle();

    const realName = profile?.full_name || "Customer";
    const isGenericSender = !senderName || senderName.toLowerCase() === 'me' || senderName.toLowerCase().includes('customer') || senderName.toLowerCase().includes('test');
    if (isGenericSender) {
      senderName = realName;
    }
    const receiverName = asNonEmptyString(body.receiverName);
    const receiverPhone = String(body.receiverPhone ?? "").trim();
    const paymentMethod = asNonEmptyString(body.paymentMethod);
    const selectedService = asNonEmptyString(body.selectedService);
    const servicePrice = Number(body.servicePrice ?? 0);
    const totalParcels = Number(body.totalParcels ?? 0);
    const distance = asNonEmptyString(body.distance) ?? "";
    const duration = asNonEmptyString(body.duration) ?? "";
    const dropOffPoint = normalizeDropOffPoint(body.dropOffPoint);

    if (!senderName || !receiverName) {
      throw new BadRequestException("Sender and receiver names are required.");
    }

    if (!PHONE_REGEX.test(senderPhone) || !PHONE_REGEX.test(receiverPhone)) {
      throw new BadRequestException("Phone numbers must use the 09XXXXXXXXX format.");
    }

    if (!paymentMethod) {
      throw new BadRequestException("Please select a payment method before continuing.");
    }

    if (!selectedService || !Number.isFinite(servicePrice) || servicePrice <= 0) {
      throw new BadRequestException("Delivery service details are incomplete.");
    }

    const ownedDraft = await this.repository.findOwnedDraftSummary(draftId, user.userId);
    if (ownedDraft.error || !ownedDraft.data) {
      throw new NotFoundException("Parcel draft not found.");
    }

    const trackingNumber = ownedDraft.data.tracking_number || createTrackingNumber();

    const serviceMap: Record<string, string> = {
      'share': 'pakishare',
      'express': 'PakiExpress',
      'business': 'pakibusiness'
    };
    const serviceId = serviceMap[selectedService] || selectedService;

    if (paymentMethod === "wallet" || paymentMethod === "securepay" || paymentMethod === "bank") {
      console.log(`[completeBooking] E-Wallet selected! Initiating APICenter checkout for ${servicePrice}...`);
      const checkout = await this.paymentService.createEwalletCheckout(draftId, servicePrice);
      console.log(`[completeBooking] APICenter checkout generated:`, checkout.redirectUrl);
      
      const updateResult = await this.repository.updateOwnedDraftState(draftId, user.userId, {
        step_completed: 5,
        status: "submitted",
        tracking_number: trackingNumber,
        sender_name: senderName,
        sender_phone: senderPhone,
        receiver_name: receiverName,
        receiver_phone: receiverPhone,
        service_id: serviceId,
        service_price: servicePrice,
        delivery_mode: serviceId === 'pakishare' ? 'relay' : 'direct',
        tracking_progress_label: 'Booking Confirmed',
        tracking_progress_percentage: 20,
        tracking_current_location: 'Awaiting Driver',
      });

      if (
        !updateResult.error &&
        updateResult.data &&
        updateResult.data.tracking_number === trackingNumber
      ) {
        await this.ensureSelectedService(draftId, serviceId, servicePrice, dropOffPoint);

        try {
          await this.customerNotificationsService.createNotification(
            user.userId,
            "delivery",
            "Parcel booking confirmed",
            `Your parcel for ${receiverName} is booked. Tracking No. ${trackingNumber}.`,
          );

          const admin = this.supabaseService.createAdminClient();
          await admin
            .schema("parcel").from("parcel_activity_logs")
            .insert({
              user_id: user.userId,
              activity_type: "booking",
              title: "Parcel booking confirmed",
              description: `You booked a parcel for ${receiverName}. Tracking No. ${trackingNumber}.`,
            });
        } catch (err) {
          console.warn('[completeBooking] Post-booking updates failed (non-critical):', err.message);
        }

        // Create a job for drivers for direct bookings only
        console.log(`[completeBooking] Inspecting draft for driver job creation: ${draftId}`);
        const { data: fullDraft } = await admin
          .schema("parcel")
          .from("parcel_drafts")
          .select("*")
          .eq("id", draftId)
          .eq("user_id", user.userId)
          .single();
        
        if (fullDraft) {
          const isRelay = fullDraft.delivery_mode === 'relay' || String(fullDraft.service_id).toLowerCase().includes('share');
          if (isRelay) {
            console.log(`[completeBooking] Relay/PakiShare booking detected (${fullDraft.tracking_number}). Skipping driver job creation until hub operator dispatch.`);
          } else {
            const { data: items } = await admin
              .schema("parcel")
              .from("parcel_draft_items")
              .select("*")
              .eq("parcel_draft_id", draftId);

            console.log(`[completeBooking] Found direct draft with tracking: ${fullDraft.tracking_number}. Calling createJobFromDraft...`);
            try {
              await this.driverDashboardService.createJobFromDraft(
                fullDraft,
                items || []
              );
              console.log(`[completeBooking] Driver job created successfully.`);
            } catch (err) {
              console.error(`[completeBooking] Error in createJobFromDraft:`, err);
            }
          }
        }
      }

      return {
        draftId,
        trackingNumber,
        stepCompleted: 5,
        status: "submitted",
        checkoutUrl: checkout.redirectUrl, // SDK returns redirectUrl
        message: "Redirecting to payment...",
        booking: {
          senderName,
          senderPhone,
          receiverName,
          receiverPhone,
          paymentMethod,
          selectedService,
          servicePrice,
        }
      };
    }

    const updateResult = await this.repository.updateOwnedDraftState(draftId, user.userId, {
      step_completed: 5,
      status: "submitted",
      tracking_number: trackingNumber,
      sender_name: senderName,
      sender_phone: senderPhone,
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      service_id: serviceId,
      service_price: servicePrice,
      delivery_mode: serviceId === 'pakishare' ? 'relay' : 'direct',
      tracking_progress_label: 'Booking Confirmed',
      tracking_progress_percentage: 20,
      tracking_current_location: 'Awaiting Driver',
    });
    if (
      updateResult.error ||
      !updateResult.data ||
      updateResult.data.tracking_number !== trackingNumber
    ) {
      throw new InternalServerErrorException("Unable to complete booking right now.");
    }

    await this.ensureSelectedService(draftId, serviceId, servicePrice, dropOffPoint);

    try {
      await this.customerNotificationsService.createNotification(
        user.userId,
        "delivery",
        "Parcel booking confirmed",
        `Your parcel for ${receiverName} is booked. Tracking No. ${trackingNumber}.`,
      );

      const admin = this.supabaseService.createAdminClient();
      await admin
        .schema("parcel").from("parcel_activity_logs")
        .insert({
          user_id: user.userId,
          activity_type: "booking",
          title: "Parcel booking confirmed",
          description: `You booked a parcel for ${receiverName}. Tracking No. ${trackingNumber}.`,
        });
    } catch (err) {
      console.warn('[completeBooking] Post-booking updates failed (non-critical):', err.message);
    }

    // Create a job for drivers for direct bookings only
    console.log(`[completeBooking] Inspecting draft for driver job creation: ${draftId}`);
    const { data: fullDraft } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", user.userId)
      .single();
    
    if (fullDraft) {
      const isRelay = fullDraft.delivery_mode === 'relay' || String(fullDraft.service_id).toLowerCase().includes('share');
      if (isRelay) {
        console.log(`[completeBooking] Relay/PakiShare booking detected (${fullDraft.tracking_number}). Skipping driver job creation until hub operator dispatch.`);
      } else {
        const { data: items } = await admin
          .schema("parcel")
          .from("parcel_draft_items")
          .select("*")
          .eq("parcel_draft_id", draftId);

        console.log(`[completeBooking] Found direct draft with tracking: ${fullDraft.tracking_number}. Calling createJobFromDraft...`);
        try {
          await this.driverDashboardService.createJobFromDraft(
            fullDraft,
            items || []
          );
          console.log(`[completeBooking] Driver job created successfully.`);
        } catch (err) {
          console.error(`[completeBooking] Error in createJobFromDraft:`, err);
        }
      }
    } else {
      console.error(`[completeBooking] Could not find full draft to check for job.`);
    }

    return {
      draftId,
      trackingNumber,
      stepCompleted: 5,
      status: "submitted",
      booking: {
        senderName,
        senderPhone,
        receiverName,
        receiverPhone,
        paymentMethod,
        selectedService,
        servicePrice,
        totalParcels,
        distance,
        duration,
      },
    };
  }

  async getTrackingDetails(trackingNumber: string) {
    const { data, error } = await this.repository.findDraftByTrackingNumber(
      trackingNumber.trim(),
    );

    if (error || !data) {
      throw new NotFoundException("Parcel not found for that tracking number.");
    }

    const createdTime = new Date(data.created_at);
    const updatedTime = new Date(data.updated_at);

    // Hydration: Fetch driver job for live status and driver details
    let assignedDriver = null;
    let jobDetails = null;
    
    try {
      // Find the active job for this tracking number
      const { data: job, error: jobError } = await this.supabaseService.createAdminClient()
        .schema("driver").from("driver_jobs")
        .select(`
          id,
          status,
          parcel_status,
          updated_at,
          customer_name,
          driver_user_id,
          accepted_at,
          picked_up_at,
          delivered_at
        `)
        .eq("job_number", data.tracking_number)
        .maybeSingle();

      if (job) {
        jobDetails = job;
        const driverId = job.driver_user_id;
        if (driverId) {
          const summary = await this.driverDashboardService.getInternalSummary(driverId);
          if (summary) {
            assignedDriver = {
              name: summary.name,
              phone: summary.phone,
              vehicleType: summary.vehicleType,
              plateNumber: summary.plateNumber,
              location: summary.location,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[getTrackingDetails] Failed to fetch job details:', err.message);
    }

    const assignedDriverId = jobDetails?.driver_user_id || (data as any).assigned_driver_id;

    let statusLabel = 
      data.status === "submitted" ? "Booking Confirmed" : 
      data.status === "delivered" ? "Parcel Delivered" : 
      data.status === "cancelled" ? "Cancelled" : 
      data.status === "lost" ? "Lost" : 
      data.status;

    // Use job status if available for more granular tracking
    if (jobDetails) {
      const s = jobDetails.status?.toLowerCase();
      const ps = jobDetails.parcel_status?.toLowerCase();

      if (s === "completed" || s === "delivered" || ps === "delivered") {
        statusLabel = "Parcel Delivered";
      } else if (ps === "picked-up" || ps === "picked_up" || ps === "out-for-delivery" || ps === "out_for_delivery" || s === "in_transit" || s === "out-for-delivery") {
        statusLabel = "In Transit";
      } else if (s === "in-progress" || s === "accepted" || s === "confirmed") {
        statusLabel = "Preparing for Pickup";
      }
    }

    return {
      trackingNumber: data.tracking_number,
      status: statusLabel,
      origin: data.pickup_address,
      pickupLocation: {
        lat: (data as any).pickup_lat,
        lng: (data as any).pickup_lng,
        address: data.pickup_address,
      },
      destination: data.delivery_address,
      deliveryLocation: {
        lat: (data as any).delivery_lat,
        lng: (data as any).delivery_lng,
        address: data.delivery_address,
      },
      estimatedDelivery: data.status === "delivered" ? "Arrived" : (data.duration_text || "Calculating..."),
      distance: data.distance_text || "Calculating...",
      assignedDriverId: assignedDriverId || null,
      assignedDriver: assignedDriver || (assignedDriverId ? {
        name: data.status === "delivered" ? "Completed by Driver" : "Assigning driver",
        phone: "Unavailable",
        vehicleType: "Pending dispatch",
        plateNumber: "TBD",
        location: null,
      } : null),
      timeline: [
        {
          status: "Booking Confirmed",
          location: data.pickup_address,
          timestamp: createdTime.toLocaleTimeString("en-PH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          completed: true,
        },
        {
          status: "Preparing for Pickup",
          location: data.pickup_address,
          timestamp: updatedTime.toLocaleTimeString("en-PH", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          completed: !!jobDetails || ["submitted", "delivered"].includes(data.status),
        },
        {
          status: "In Transit",
          location: data.delivery_address,
          timestamp: jobDetails?.updated_at && ["picked-up", "picked_up", "out-for-delivery", "out_for_delivery", "completed", "delivered"].includes(jobDetails?.parcel_status?.toLowerCase())
            ? new Date(jobDetails.updated_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
            : "Pending",
          completed: ["picked-up", "picked_up", "out-for-delivery", "out_for_delivery", "completed", "delivered"].includes(jobDetails?.parcel_status?.toLowerCase()) || ["completed", "delivered"].includes(jobDetails?.status?.toLowerCase()) || data.status === "delivered",
        },
        {
          status: "Delivered",
          location: data.delivery_address,
          timestamp: jobDetails?.delivered_at 
            ? new Date(jobDetails.delivered_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
            : "Pending",
          completed: ["completed", "delivered"].includes(jobDetails?.status?.toLowerCase()) || data.status === "delivered" || jobDetails?.parcel_status?.toLowerCase() === "delivered",
        },
      ],
    };
  }

  async getHistory(user: SessionPayload) {
    const { data, error } = await this.repository.listOwnedHistory(user.userId);

    if (error) {
      throw new InternalServerErrorException("Unable to load parcel history right now.");
    }

    return {
      transactions: (data ?? []).map((draft) => {
        const items = draft.parcel_draft_items ?? [];
        const totalParcels = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
        const historyStatus = getHistoryStatus(draft);

        return {
          id: draft.tracking_number || draft.id,
          draftId: draft.id,
          trackingNumber: draft.tracking_number,
          date: formatHistoryDate(draft.created_at),
          createdAt: draft.created_at,
          from: draft.pickup_address,
          to: draft.delivery_address,
          status: historyStatus.label,
          rawStatus: draft.status,
          type: getHistoryType(items),
          isLive: historyStatus.isLive,
          bucket: historyStatus.bucket,
          amount: null,
          distance: draft.distance_text,
          duration: draft.duration_text,
          totalParcels,
        };
      }),
    };
  }

  async getHistoryDetails(user: SessionPayload, trackingNumber: string) {
    const { data, error } = await this.repository.findOwnedHistoryByTrackingNumber(
      user.userId,
      trackingNumber.trim(),
    );

    if (error || !data) {
      throw new NotFoundException("Parcel history record not found.");
    }

    const items = data.parcel_draft_items ?? [];
    const totalParcels = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
    const firstItem = items[0];
    const historyStatus = getHistoryStatus(data);

    return {
      transaction: {
        id: data.tracking_number || data.id,
        trackingNumber: data.tracking_number,
        date: formatHistoryDate(data.created_at),
        createdAt: data.created_at,
        from: data.pickup_address,
        to: data.delivery_address,
        status: historyStatus.label,
        rawStatus: data.status,
        type: getHistoryType(items),
        isLive: historyStatus.isLive,
        amount: null,
        distance: data.distance_text,
        duration: data.duration_text,
        totalParcels,
      },
      details: {
        sender: {
          name: data.sender_name || "Not available",
          phone: data.sender_phone || "Not available",
          address: data.pickup_address,
        },
        receiver: {
          name: data.receiver_name || "Not available",
          phone: data.receiver_phone || "Not available",
          address: data.delivery_address,
        },
        parcel: {
          weight: firstItem?.weight_text || "Not available",
          dimensions: "Not stored yet",
          description:
            items.length > 0
              ? items
                  .map((item) => `${item.item_type || "Parcel"} x${item.quantity ?? 1}`)
                  .join(", ")
              : "No parcel items found",
          specialInstructions:
            firstItem?.delivery_guarantee
              ? `${firstItem.delivery_guarantee} handling`
              : "Standard handling",
          totalParcels,
        },
        driver: historyStatus.isLive
          ? {
              name: "Assigning driver",
              phone: "Unavailable",
              vehicle: "Pending dispatch",
              rating: null,
            }
          : null,
        timeline: [
          {
            status: "Booking Created",
            time: formatHistoryDate(data.created_at),
            location: data.pickup_address,
            completed: true,
          },
          {
            status: historyStatus.label,
            time: formatHistoryDate(data.updated_at),
            location: data.delivery_address,
            completed: true,
          },
        ],
      },
    };
  }

  async cancelBooking(session: SessionPayload, id: string) {
    const admin = this.supabaseService.createAdminClient();
    
    // 1. Fetch the booking to verify ownership and current status
    const { data: booking, error: fetchErr } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("id, status, tracking_number")
      .eq("id", id)
      .eq("user_id", session.userId)
      .maybeSingle();

    if (fetchErr || !booking) {
      throw new NotFoundException("Booking not found.");
    }

    if (booking.status === "cancelled") {
      return { status: "cancelled", message: "Booking is already cancelled." };
    }

    // 2. Update the status to 'cancelled' in parcel.parcel_drafts
    const { error: updateErr } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .update({ status: "cancelled", tracking_progress_label: "Cancelled" })
      .eq("id", id);

    if (updateErr) {
      throw new InternalServerErrorException("Failed to cancel the booking.");
    }

    // 3. Log the activity to partner.activity_logs
    await this.supabaseService.logActivity(
      session.userId,
      "BOOKING_CANCELLED",
      "Booking",
      id,
      (fullName) => `Booking ${booking.tracking_number} cancelled by "${fullName}"`,
    );

    // 4. Create notification
    await this.customerNotificationsService.createNotification(
      session.userId,
      "system",
      "Booking Cancelled",
      `Your booking ${booking.tracking_number} has been cancelled successfully.`,
    );

    // 5. Delete associated driver jobs
    await admin
      .schema("public")
      .from("driver_jobs")
      .delete()
      .eq("parcel_draft_id", id);

    return { status: "cancelled", message: "Booking cancelled successfully." };
  }

  async confirmPayment(user: SessionPayload, draftId: string, body: Record<string, unknown>) {
    const admin = this.supabaseService.createAdminClient();
    const { data: draft, error } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", user.userId)
      .single();

    if (error || !draft) {
      throw new NotFoundException("Parcel draft not found.");
    }

    if (draft.status !== "pending_payment") {
      return {
        success: true,
        status: draft.status || "submitted",
        trackingNumber: draft.tracking_number,
      };
    }

    const trackingNumber = draft.tracking_number || createTrackingNumber();

    const updateResult = await this.repository.updateOwnedDraftState(draftId, user.userId, {
      step_completed: 5,
      status: "submitted",
      tracking_number: trackingNumber,
      tracking_progress_label: 'Booking Confirmed',
      tracking_progress_percentage: 20,
      tracking_current_location: 'Awaiting Driver',
    });

    if (updateResult.error || !updateResult.data) {
      throw new InternalServerErrorException("Unable to confirm payment.");
    }

    const receiverName = draft.receiver_name || "Recipient";

    try {
      await this.customerNotificationsService.createNotification(
        user.userId,
        "delivery",
        "Parcel booking confirmed",
        `Your parcel for ${receiverName} is booked. Tracking No. ${trackingNumber}.`,
      );

      await admin
        .schema("parcel").from("parcel_activity_logs")
        .insert({
          user_id: user.userId,
          activity_type: "booking",
          title: "Parcel booking confirmed",
          description: `You booked a parcel for ${receiverName}. Tracking No. ${trackingNumber}.`,
        });
    } catch (err) {
      console.warn('[confirmPayment] Post-booking updates failed (non-critical):', err.message);
    }

    // Create a job for drivers for direct bookings only
    console.log(`[confirmPayment] Inspecting draft for driver job creation: ${draftId}`);
    const { data: fullDraft } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("*")
      .eq("id", draftId)
      .eq("user_id", user.userId)
      .single();

    if (fullDraft) {
      const isRelay = fullDraft.delivery_mode === 'relay' || String(fullDraft.service_id).toLowerCase().includes('share');
      if (isRelay) {
        console.log(`[confirmPayment] Relay/PakiShare booking detected (${fullDraft.tracking_number}). Skipping driver job creation until hub operator dispatch.`);
      } else {
        const { data: items } = await admin
          .schema("parcel")
          .from("parcel_draft_items")
          .select("*")
          .eq("parcel_draft_id", draftId);

        try {
          await this.driverDashboardService.createJobFromDraft(
            fullDraft,
            items || []
          );
          console.log(`[confirmPayment] Driver job created successfully.`);
        } catch (err) {
          console.error(`[confirmPayment] Error in createJobFromDraft:`, err);
        }
      }
    }

    return {
      success: true,
      status: "submitted",
      trackingNumber,
    };
  }
}
