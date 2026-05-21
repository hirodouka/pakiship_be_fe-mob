import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import type { SessionPayload } from "../common/session/session.types";
import { SupabaseService } from "../supabase/supabase.service";
import { ProfileRepository } from "./profile.repository";
import type { UpdateProfileInput } from "./profile.types";

function asTrimmedString(value: unknown) {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

function asOptionalArrayOfStrings(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => String(item)).filter(Boolean);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-11);
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly profileRepository: ProfileRepository,
    private readonly supabaseService: SupabaseService,
  ) {}

  async getMyProfile(session: SessionPayload) {
    const { data, error } = await this.profileRepository.findByUserId(session.userId);
    if (error || !data) {
      throw new NotFoundException("Profile not found.");
    }

    return {
      profile: this.profileRepository.mapProfileRow(data),
    };
  }

  async updateMyProfile(session: SessionPayload, body: Record<string, unknown>) {
    const current = await this.profileRepository.findByUserId(session.userId);
    if (current.error || !current.data) {
      throw new NotFoundException("Profile not found.");
    }

    const patch: UpdateProfileInput = {};
    const fullName = asTrimmedString(body.fullName);
    const email = asTrimmedString(body.email);
    const phone = asTrimmedString(body.phone);
    const dob = asTrimmedString(body.dob);
    const address = asTrimmedString(body.address);
    const city = asTrimmedString(body.city);
    const province = asTrimmedString(body.province);
    const currentProfile = this.profileRepository.mapProfileRow(current.data);

    if ("fullName" in body) {
      if (!fullName) throw new BadRequestException("Full name cannot be empty.");
      patch.fullName = fullName;
    }
    if ("email" in body) {
      if (!email) throw new BadRequestException("Email cannot be empty.");
      patch.email = normalizeEmail(email);
    }
    if ("phone" in body) {
      if (!phone) throw new BadRequestException("Phone cannot be empty.");
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone.length !== 11) {
        throw new BadRequestException("Phone must contain 11 digits.");
      }
      patch.phone = normalizedPhone;
    }
    if ("dob" in body) {
      if (!dob) throw new BadRequestException("Date of birth cannot be empty.");
      patch.dob = dob;
    }
    if ("address" in body) {
      if (!address) throw new BadRequestException("Address cannot be empty.");
      patch.address = address;
    }
    if ("city" in body) {
      if (!city) throw new BadRequestException("City cannot be empty.");
      patch.city = city;
    }
    if ("province" in body) {
      if (!province) throw new BadRequestException("Province cannot be empty.");
      patch.province = province;
    }
    if ("profilePhotoUrl" in body) {
      patch.profilePhotoUrl = body.profilePhotoUrl ? String(body.profilePhotoUrl) : null;
    }

    const documents = asOptionalArrayOfStrings(body.documents);
    if (documents) {
      patch.documents = documents;
    }

    if (patch.email || patch.phone) {
      const duplicate = await this.profileRepository.findPotentialDuplicate(
        session.userId,
        patch.email,
        patch.phone,
      );

      if (duplicate.error) {
        throw new InternalServerErrorException("Unable to validate profile uniqueness.");
      }

      if (duplicate.data && duplicate.data.length > 0) {
        throw new ConflictException("Another profile already uses that email or phone.");
      }
    }

    const admin = this.supabaseService.createAdminClient();
    const nextEmail = patch.email;
    const emailChanged = Boolean(nextEmail && nextEmail !== currentProfile.email);

    if (emailChanged) {
      const authUpdate = await admin.auth.admin.updateUserById(session.userId, {
        email: nextEmail,
        email_confirm: true,
      });

      if (authUpdate.error) {
        throw new InternalServerErrorException("Unable to update auth email.");
      }
    }

    const { data, error } = await this.profileRepository.updateByUserId(session.userId, patch);
    if (error || !data) {
      if (emailChanged) {
        await admin.auth.admin.updateUserById(session.userId, {
          email: currentProfile.email,
          email_confirm: true,
        });
      }
      throw new InternalServerErrorException("Unable to update profile.");
    }

    return {
      profile: this.profileRepository.mapProfileRow(data),
      message: "Profile updated successfully.",
    };
  }
}
