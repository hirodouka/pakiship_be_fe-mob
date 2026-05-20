import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { SessionPayload } from "../common/session/session.types";
import { SupabaseService } from "../supabase/supabase.service";

type OwnedParcelRow = {
  id: string;
  tracking_number: string | null;
  assigned_driver_id: string | null;
};

type HubRecordRow = {
  hub_id: string | null;
};

type ServiceSelectionRow = {
  hub_id: string | null;
};

type ExistingReviewRow = {
  id: string;
};

type SubmitFeedbackInput = {
  trackingNumber: string;
  rating: number;
  review?: string;
  tags?: string[];
};

function normalizeTrackingNumber(value: string) {
  return value.trim().toUpperCase();
}

function sanitizeReview(value?: string) {
  const review = value?.trim() ?? "";

  if (review.length > 500) {
    throw new BadRequestException("Review must be 500 characters or fewer.");
  }

  return review.length > 0 ? review : null;
}

function sanitizeTags(value?: string[]) {
  return [...new Set((value ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .slice(0, 8))];
}

@Injectable()
export class CustomerFeedbackService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private async findOwnedParcel(userId: string, trackingNumber: string) {
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("id, tracking_number, assigned_driver_id")
      .eq("user_id", userId)
      .eq("tracking_number", trackingNumber)
      .limit(1)
      .maybeSingle<OwnedParcelRow>();

    if (error) {
      throw new InternalServerErrorException("Unable to validate your parcel feedback.");
    }

    if (!data) {
      throw new NotFoundException("Tracking number not found in your parcel history.");
    }

    return data;
  }

  private async findHubIdForParcelDraft(draftId: string) {
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("parcel_hub_records")
      .select("hub_id")
      .eq("parcel_draft_id", draftId)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle<HubRecordRow>();

    if (error) {
      throw new InternalServerErrorException("Unable to resolve the operator hub for this parcel.");
    }

    if (data?.hub_id) {
      return data.hub_id;
    }

    const serviceSelection = await this.findSelectedHubIdForParcelDraft(draftId);
    return serviceSelection;
  }

  private async findSelectedHubIdForParcelDraft(draftId: string) {
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("parcel_drafts")
      .select("drop_off_point_id")
      .eq("id", draftId)
      .limit(1)
      .maybeSingle<{ drop_off_point_id: string | null }>();

    if (error) {
      throw new InternalServerErrorException("Unable to resolve the selected hub for this parcel.");
    }

    return data?.drop_off_point_id ?? null;
  }

  private async findExistingFeedback(draftId: string, userId: string) {
    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("parcel_reviews")
      .select("id")
      .eq("parcel_draft_id", draftId)
      .eq("customer_user_id", userId)
      .limit(1)
      .maybeSingle<ExistingReviewRow>();

    if (error) {
      throw new InternalServerErrorException("Unable to validate existing parcel feedback.");
    }

    return data ?? null;
  }

  async getMyReviews(session: SessionPayload) {
    if (session.role !== "customer") {
      throw new ForbiddenException("Only customers can access their parcel feedback.");
    }

    const admin = this.supabaseService.createAdminClient();
    const { data, error } = await admin
      .schema("parcel")
      .from("parcel_reviews")
      .select("id, tracking_number, rating, review_text, tags, created_at, updated_at")
      .eq("customer_user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw new InternalServerErrorException("Unable to retrieve your parcel feedback.");
    }

    return (data ?? []).map((row) => ({
      reviewId: row.id as string,
      trackingNumber: row.tracking_number as string,
      rating: row.rating as number,
      review: row.review_text as string | null,
      tags: row.tags as string[],
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  async submitFeedback(session: SessionPayload, input: SubmitFeedbackInput) {
    console.log(`[CustomerFeedback] Submitting feedback for ${input.trackingNumber} by ${session.userId}`);
    if (session.role !== "customer") {
      throw new ForbiddenException("Only customers can submit parcel feedback.");
    }

    const trackingNumber = normalizeTrackingNumber(input.trackingNumber);
    if (!trackingNumber) {
      throw new BadRequestException("Tracking number is required.");
    }

    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestException("Rating must be a whole number from 1 to 5.");
    }

    const review = sanitizeReview(input.review);
    const tags = sanitizeTags(input.tags);
    const ownedParcel = await this.findOwnedParcel(session.userId, trackingNumber);
    const hubId = await this.findHubIdForParcelDraft(ownedParcel.id);
    const existingFeedback = await this.findExistingFeedback(ownedParcel.id, session.userId);
    const admin = this.supabaseService.createAdminClient();
    const timestamp = new Date().toISOString();
    const payload = {
      parcel_draft_id: ownedParcel.id,
      tracking_number: ownedParcel.tracking_number ?? trackingNumber,
      customer_user_id: session.userId,
      reviewer_id: session.userId,
      hub_id: hubId,
      rating: input.rating,
      review_text: review,
      tags,
      updated_at: timestamp,
    };
    const result = existingFeedback
      ? await admin
          .schema("parcel")
          .from("parcel_reviews")
          .update(payload)
          .eq("id", existingFeedback.id)
          .select("id")
          .single()
      : await admin
          .schema("parcel")
          .from("parcel_reviews")
          .insert({
            ...payload,
            created_at: timestamp,
          })
          .select("id")
          .single();

    if (result.error || !result.data) {
      console.error('[CustomerFeedback] Submission failed:', result.error);
      throw new InternalServerErrorException("Unable to submit parcel feedback right now.");
    }
    
    // Update driver_jobs rating if a driver was assigned
    if (ownedParcel.assigned_driver_id) {
      await admin
        .schema("driver").from("driver_jobs")
        .update({ rating: input.rating })
        .eq("parcel_draft_id", ownedParcel.id)
        .eq("driver_user_id", ownedParcel.assigned_driver_id);
    }

    return {
      message: existingFeedback ? "Feedback updated successfully." : "Feedback submitted successfully.",
      reviewId: result.data.id,
      trackingNumber,
      rating: input.rating,
      review,
      tags,
    };
  }
}
