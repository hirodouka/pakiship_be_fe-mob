import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { SessionAuthGuard } from "../common/session/session-auth.guard";
import type { SessionPayload } from "../common/session/session.types";
import { SupabaseService } from "../supabase/supabase.service";
import { OperatorDashboardService } from "./operator-dashboard.service";

function getSessionUser(request: Request) {
  return (request as Request & { user: SessionPayload }).user;
}

const OPERATOR_PROFILE_BUCKET = "operator-profile-images";
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

@Controller("pakiship/mobile/operator")
@UseGuards(SessionAuthGuard)
export class OperatorMobileController {
  constructor(
    private readonly operatorDashboardService: OperatorDashboardService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * List all available hubs the operator can be assigned to.
   */
  @Get("hubs")
  async listHubs(@Req() request: Request) {
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("drop_off_points")
      .select("id, name, address, landmark, status, capacity, max_capacity")
      .eq("is_active", true)
      .neq("status", "Closed")
      .order("name", { ascending: true });

    if (error) {
      throw new InternalServerErrorException("Unable to load hubs.");
    }

    return { hubs: data ?? [] };
  }

  /**
   * Change the operator's active hub assignment.
   * Deactivates the current assignment and creates a new one.
   */
  @Patch("hub-assignment")
  async changeHub(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const session = getSessionUser(request);
    const hubId = String(body.hubId ?? "").trim();

    if (!hubId) throw new BadRequestException("Hub ID is required.");

    const admin = this.supabaseService.createAdminClient();

    // Verify the hub exists and is active
    const { data: hub, error: hubError } = await admin
      .schema("parcel")
      .from("drop_off_points")
      .select("id, name, address")
      .eq("id", hubId)
      .eq("is_active", true)
      .maybeSingle();

    if (hubError || !hub) {
      throw new BadRequestException("Hub not found or unavailable.");
    }

    // Delete all current assignments (clean slate)
    await admin
      .schema("parcel")
      .from("operator_hub_assignments")
      .delete()
      .eq("operator_user_id", session.userId);

    // Insert fresh assignment
    const { error: insertError } = await admin
      .schema("parcel")
      .from("operator_hub_assignments")
      .insert({
        operator_user_id: session.userId,
        hub_id: hubId,
        is_active: true,
        assigned_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      throw new InternalServerErrorException(`Failed to assign hub: ${insertError.message}`);
    }

    return {
      assignedHub: {
        id: hub.id,
        name: hub.name,
        address: hub.address,
      },
    };
  }

  /**
   * Register a parcel by tracking number (manual entry from mobile).
   */
  @Post("manual-entry")
  async manualEntry(@Req() request: Request, @Body() body: Record<string, unknown>) {
    return this.operatorDashboardService.registerManualEntry(
      getSessionUser(request),
      String(body.trackingNumber ?? ""),
    );
  }

  /**
   * Hub summary — KPIs + hub info for the operator's home screen.
   */
  @Get("hub-summary")
  async getHubSummary(@Req() request: Request) {
    const session = getSessionUser(request);
    const dashboard = await this.operatorDashboardService.getDashboard(session);

    const admin = this.supabaseService.createAdminClient();
    const { data: assignment } = await admin
      .schema("parcel")
      .from("operator_hub_assignments")
      .select("hub_id")
      .eq("operator_user_id", session.userId)
      .eq("is_active", true)
      .maybeSingle();

    let hubName = "Unassigned Hub";
    let hubAddress = null;
    let maxCapacity = 100;

    if (assignment?.hub_id) {
      const { data: hub } = await admin
        .schema("parcel")
        .from("drop_off_points")
        .select("name, address, max_capacity")
        .eq("id", assignment.hub_id)
        .maybeSingle();
      
      if (hub) {
        hubName = hub.name;
        maxCapacity = hub.max_capacity ?? 100;
        hubAddress = hub.address;
      }
    }

    const currentStored = dashboard.kpis.currentlyStored;
    const capacityPct = Math.min(100, Math.round((currentStored / maxCapacity) * 100));

    return {
      hubId: assignment?.hub_id ?? null,
      hubName,
      hubAddress: hubAddress || "Taguig City, Metro Manila",
      capacityPercentage: capacityPct,
      maxCapacity,
      currentlyStored: currentStored,
      kpis: dashboard.kpis,
      earnings: dashboard.earnings,
    };
  }

  /**
   * Operator profile.
   */
  @Get("profile")
  async getProfile(@Req() request: Request) {
    const session = getSessionUser(request);
    const admin = this.supabaseService.createAdminClient();

    const [profileResult, assignmentResult] = await Promise.all([
      admin
        .schema("account")
        .from("profiles")
        .select("id, full_name, email, phone, profile_picture")
        .eq("id", session.userId)
        .single(),
      admin
        .schema("parcel")
        .from("operator_hub_assignments")
        .select("hub_id, drop_off_points(name, address)")
        .eq("operator_user_id", session.userId)
        .eq("is_active", true)
        .maybeSingle<any>(),
    ]);

    if (profileResult.error || !profileResult.data) {
      throw new InternalServerErrorException("Unable to load operator profile.");
    }

    const profile = profileResult.data;
    let assignedHub = null;

    if (assignmentResult.data?.hub_id) {
      const { data: hubData } = await admin
        .schema("parcel")
        .from("drop_off_points")
        .select("id, name, address")
        .eq("id", assignmentResult.data.hub_id)
        .maybeSingle();
      
      if (hubData) {
        assignedHub = {
          id: hubData.id,
          name: hubData.name,
          address: hubData.address,
        };
      }
    }

    return {
      id: profile.id,
      fullName: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      profilePicture: profile.profile_picture ?? null,
      assignedHub,
    };
  }

  /**
   * Update operator profile (name, email, phone).
   */
  @Patch("profile")
  async updateProfile(@Req() request: Request, @Body() body: Record<string, unknown>) {
    const session = getSessionUser(request);
    const admin = this.supabaseService.createAdminClient();

    const updates: Record<string, unknown> = {};
    if (body.fullName && typeof body.fullName === "string") updates.full_name = body.fullName.trim();
    if (body.email && typeof body.email === "string") updates.email = body.email.trim().toLowerCase();
    if (body.phone && typeof body.phone === "string") updates.phone = body.phone.replace(/\D/g, "").slice(-10);

    if (Object.keys(updates).length === 0) {
      throw new BadRequestException("No fields to update.");
    }

    const { error } = await admin
      .schema("account")
      .from("profiles")
      .update(updates)
      .eq("id", session.userId);

    if (error) {
      throw new InternalServerErrorException(`Failed to update profile: ${error.message}`);
    }

    // Sync full_name to auth metadata so it shows everywhere
    if (updates.full_name) {
      const authUser = await admin.auth.admin.getUserById(session.userId);
      const currentMeta = authUser.data.user?.user_metadata ?? {};
      await admin.auth.admin.updateUserById(session.userId, {
        user_metadata: { ...currentMeta, full_name: updates.full_name },
      });
    }

    return this.getProfile(request);
  }

  /**
   * Upload operator profile picture.
   */
  @Post("profile/upload-avatar")
  @UseInterceptors(FileInterceptor("file"))
  async uploadAvatar(
    @Req() request: Request,
    @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    const session = getSessionUser(request);

    if (!file) throw new BadRequestException("Please choose an image to upload.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      throw new BadRequestException("Unsupported file type. Use JPEG, PNG, or WebP.");
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new BadRequestException("File is too large. Maximum size is 5 MB.");
    }

    const admin = this.supabaseService.createAdminClient();

    const bucketResult = await admin.storage.getBucket(OPERATOR_PROFILE_BUCKET);
    if (bucketResult.error) {
      await admin.storage.createBucket(OPERATOR_PROFILE_BUCKET, { public: true });
    }

    const ext = file.originalname.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "jpg";
    const objectPath = `${session.userId}/avatar-${randomUUID()}.${ext}`;

    const uploadResult = await admin.storage
      .from(OPERATOR_PROFILE_BUCKET)
      .upload(objectPath, file.buffer, { contentType: file.mimetype, upsert: true });

    if (uploadResult.error) {
      throw new InternalServerErrorException(`Upload failed: ${uploadResult.error.message}`);
    }

    const { data: urlData } = admin.storage.from(OPERATOR_PROFILE_BUCKET).getPublicUrl(objectPath);

    const { error: updateError } = await admin
      .schema("account")
      .from("profiles")
      .update({ profile_picture: urlData.publicUrl })
      .eq("id", session.userId);

    if (updateError) {
      throw new InternalServerErrorException("Image uploaded but profile could not be updated.");
    }

    return { profilePicture: urlData.publicUrl };
  }

  /**
   * List all parcels currently at this operator's hub.
   * Includes parcels in all statuses: incoming, stored, picked-up, dispatched.
   */
  @Get("pending-parcels")
  async getPendingParcels(@Req() request: Request, @Query("status") status?: string) {
    const session = getSessionUser(request);
    const { parcels, meta } = await this.operatorDashboardService.getParcels(session);

    const filtered = status
      ? parcels.filter((p) => p.status === status)
      : parcels;

    return { parcels: filtered, meta };
  }

  /**
   * Receive a parcel at the hub by its hub record ID.
   * Transitions status from incoming → stored and sets a storage location.
   */
  @Post("receive/:recordId")
  async receiveParcel(
    @Req() request: Request,
    @Param("recordId") recordId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const session = getSessionUser(request);
    const storageLocation = body.storageLocation ? String(body.storageLocation).trim() : null;

    // First mark as stored
    const result = await this.operatorDashboardService.updateParcelStatus(
      session,
      recordId,
      "stored",
    );

    // Optionally set storage location
    if (storageLocation && result.parcel.id) {
      const admin = this.supabaseService.createAdminClient();
      await admin
        .schema("parcel")
        .from("parcel_hub_records")
        .update({ storage_location: storageLocation })
        .eq("id", recordId);

      result.parcel.storageLocation = storageLocation;
    }

    return result;
  }

  /**
   * Dispatch a stored parcel to a driver for last-mile delivery.
   * Creates a driver_jobs record so drivers can see and accept the job.
   */
  @Post("dispatch/:recordId")
  async dispatchParcel(@Req() request: Request, @Param("recordId") recordId: string) {
    return this.operatorDashboardService.dispatchToDriver(getSessionUser(request), recordId);
  }

  /**
   * Mark a parcel as picked up directly by the customer at the hub.
   */
  @Patch("parcel-records/:recordId/pickup")
  async markPickedUp(@Req() request: Request, @Param("recordId") recordId: string) {
    return this.operatorDashboardService.updateParcelStatus(
      getSessionUser(request),
      recordId,
      "picked-up",
    );
  }
}
