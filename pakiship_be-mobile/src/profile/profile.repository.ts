import { Injectable } from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import type { BaseProfile, UpdateProfileInput } from "./profile.types";

type ProfileRow = Record<string, any>;

@Injectable()
export class ProfileRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  findByUserId(userId: string) {
    const supabase = this.supabaseService.createAdminClient();
    return supabase.schema("account").from("profiles").select("*").eq("id", userId).maybeSingle();
  }

  findPotentialDuplicate(userId: string, email?: string, phone?: string) {
    const supabase = this.supabaseService.createAdminClient();
    let query = supabase.schema("account").from("profiles").select("id");

    if (email && phone) {
      query = query.or(`email.eq.${email},phone.eq.${phone}`);
    } else if (email) {
      query = query.eq("email", email);
    } else if (phone) {
      query = query.eq("phone", phone);
    }

    return query.neq("id", userId).limit(1);
  }

  updateByUserId(userId: string, input: UpdateProfileInput) {
    const supabase = this.supabaseService.createAdminClient();
    const updatePayload: Record<string, unknown> = {};

    if (input.fullName !== undefined) updatePayload.full_name = input.fullName;
    if (input.email !== undefined) updatePayload.email = input.email;
    if (input.phone !== undefined) updatePayload.phone = input.phone;
    if (input.dob !== undefined) updatePayload.dob = input.dob;
    if (input.address !== undefined) updatePayload.address = input.address;
    if (input.city !== undefined) updatePayload.city = input.city;
    if (input.province !== undefined) updatePayload.province = input.province;
    if (input.documents !== undefined) updatePayload.documents = input.documents;
    if (input.profilePhotoUrl !== undefined) updatePayload.profile_picture = input.profilePhotoUrl;

    return supabase
      .schema("account").from("profiles")
      .update(updatePayload)
      .eq("id", userId)
      .select("*")
      .single();
  }

  mapProfileRow(row: ProfileRow): BaseProfile {
    return {
      id: row.id,
      fullName: row.full_name ?? "",
      email: row.email ?? "",
      phone: row.phone ?? null,
      dob: row.dob ?? null,
      role: row.role,
      address: row.address ?? null,
      city: row.city ?? null,
      province: row.province ?? null,
      documents: Array.isArray(row.documents) ? row.documents.map((item: unknown) => String(item)) : [],
      profilePhotoUrl: row.profile_picture ?? null,
      createdAt: row.created_at ?? null,
    };
  }
}
