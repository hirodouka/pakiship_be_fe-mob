import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
import { TribeClient } from "@implementsprint/sdk";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { SessionPayload, UserRole } from "../common/session/session.types";
import {
  buildOtpAuthUri,
  createTwoFactorChallengeToken,
  generateTwoFactorSecret,
  readTwoFactorChallengeToken,
  verifyTotpToken,
} from "./two-factor.util";

type SignupInput = {
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  password: string;
  role: UserRole;
  address: string;
  city: string;
  province: string;
  documents?: string[];
};

function isUserRole(value: string): boolean {
  return (
    value === "customer" ||
    value === "driver" ||
    value === "operator" ||
    value === "parcel_sender"
  );
}

function normalizeRole(role: string): UserRole {
  if (role === "parcel_sender") return "customer";
  return role as UserRole;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "").slice(-10);
}

function getPhoneLookupVariants(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return [];

  return Array.from(new Set([
    normalized,
    `0${normalized}`,
    `+63${normalized}`,
    `63${normalized}`,
  ]));
}

function toE164PhilippinePhone(phone: string) {
  const normalized = normalizePhone(phone);
  return normalized ? `+63${normalized}` : "";
}

function getRedirectPath(role: UserRole) {
  if (role === "driver") return "/driver/home";
  if (role === "operator") return "/operator/home";
  return "/customer/home";
}

const PASSWORD_REGEX = /^(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
const RESET_OTP_PREFIX = "local";
const RESET_OTP_TTL_MS = 10 * 60 * 1000;

function isMissingProfileColumnError(message?: string | null) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("city") ||
      normalized.includes("province") ||
      normalized.includes("documents"))
  );
}

function createResetCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function createResetOtpId() {
  return `reset_${randomBytes(16).toString("hex")}`;
}

function hashResetCode(otpId: string, code: string) {
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET || "pakiship-dev-secret"}:${otpId}:${code}`)
    .digest("hex");
}

function encodeResetOtpReference(otpId: string, code: string) {
  return `${RESET_OTP_PREFIX}:${otpId}:${hashResetCode(otpId, code)}`;
}

function parseResetOtpReference(value?: string | null) {
  const [prefix, otpId, hash] = String(value ?? "").split(":");
  if (prefix !== RESET_OTP_PREFIX || !otpId || !hash) return null;
  return { otpId, hash };
}

function matchesResetCode(expectedHash: string, otpId: string, code: string) {
  const actualHash = hashResetCode(otpId, code);
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(actualHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

@Injectable()
export class AuthService {
  private readonly tribeClient: TribeClient;

  constructor(private readonly supabaseService: SupabaseService) {
    this.tribeClient = new TribeClient({
      gatewayUrl: process.env.APICENTER_URL || "https://api-center-test.itsandbox.site",
      tribeId: process.env.APICENTER_TRIBE_ID || "pakiapps",
      secret: process.env.APICENTER_TRIBE_SECRET || "",
    });
  }

  async changePassword(
    session: SessionPayload,
    currentPassword: string,
    newPassword: string,
  ) {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException("Current and new passwords are required.");
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      throw new BadRequestException(
        "New password must be at least 8 characters and include a number and special character.",
      );
    }

    const admin = this.supabaseService.createAdminClient();
    const supabase = this.supabaseService.createServerClient();

    const { data: profile, error: profileError } = await admin
      .schema("account").from("profiles")
      .select("email")
      .eq("id", session.userId)
      .single();

    if (profileError || !profile?.email) {
      throw new NotFoundException("Profile not found.");
    }

    const signInResult = await supabase.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });

    if (signInResult.error || !signInResult.data.user) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const passwordUpdatedAt = new Date().toISOString();
    const updateAuthResult = await admin.auth.admin.updateUserById(session.userId, {
      password: newPassword,
    });

    if (updateAuthResult.error) {
      throw new InternalServerErrorException("Unable to update your password right now.");
    }

    const { error } = await admin
      .schema("account").from("profiles")
      .update({ password_updated_at: passwordUpdatedAt })
      .eq("id", session.userId);

    if (error) {
      throw new InternalServerErrorException("Password updated but profile security details could not be saved.");
    }

    await this.supabaseService.logActivity(
      session.userId,
      "USER_PASSWORD_UPDATED",
      "User",
      session.userId,
      (fullName) => `Password updated for "${fullName}"`,
    );

    return {
      success: true,
      passwordUpdatedAt,
    };
  }

  async setupTwoFactor(session: SessionPayload) {
    const admin = this.supabaseService.createAdminClient();
    const [profileResponse, authUserResponse] = await Promise.all([
      admin
        .schema("account").from("profiles")
        .select("email, two_factor_enabled")
        .eq("id", session.userId)
        .single(),
      admin.auth.admin.getUserById(session.userId),
    ]);

    const profile = profileResponse.data;
    const currentMetadata = authUserResponse.data.user?.user_metadata ?? {};

    if (profileResponse.error || !profile?.email) {
      throw new NotFoundException("Profile not found.");
    }

    if (profile.two_factor_enabled) {
      throw new BadRequestException("Two-factor authentication is already enabled.");
    }

    const secret = generateTwoFactorSecret();
    const authUpdate = await admin.auth.admin.updateUserById(session.userId, {
      user_metadata: {
        ...currentMetadata,
        two_factor_pending_secret: secret,
      },
    });

    if (authUpdate.error) {
      throw new InternalServerErrorException("Unable to prepare two-factor authentication.");
    }

    await this.supabaseService.logActivity(
      session.userId,
      "USER_2FA_SETUP",
      "User",
      session.userId,
      (fullName) => `2FA setup initiated for "${fullName}"`,
    );

    return {
      secret,
      otpauthUri: buildOtpAuthUri(secret, profile.email),
    };
  }

  async enableTwoFactor(session: SessionPayload, code: string) {
    const admin = this.supabaseService.createAdminClient();
    const userResponse = await admin.auth.admin.getUserById(session.userId);
    const metadata = userResponse.data.user?.user_metadata ?? {};
    const pendingSecret = metadata.two_factor_pending_secret;

    if (typeof pendingSecret !== "string" || pendingSecret.length === 0) {
      throw new BadRequestException("Start the two-factor setup first.");
    }

    if (!verifyTotpToken(pendingSecret, code)) {
      throw new UnauthorizedException("Invalid authenticator code.");
    }

    const authUpdate = await admin.auth.admin.updateUserById(session.userId, {
      user_metadata: {
        ...metadata,
        two_factor_secret: pendingSecret,
        two_factor_pending_secret: null,
      },
    });

    if (authUpdate.error) {
      throw new InternalServerErrorException("Unable to enable two-factor authentication.");
    }

    const { error } = await admin
      .schema("account").from("profiles")
      .update({ two_factor_enabled: true })
      .eq("id", session.userId);

    if (error) {
      throw new InternalServerErrorException("Two-factor authentication enabled but profile could not be updated.");
    }

    await this.supabaseService.logActivity(
      session.userId,
      "USER_2FA_ENABLED",
      "User",
      session.userId,
      (fullName) => `2FA activated for "${fullName}"`,
    );

    return {
      success: true,
      twoFactorEnabled: true,
    };
  }

  async disableTwoFactor(session: SessionPayload, code: string) {
    const admin = this.supabaseService.createAdminClient();
    const userResponse = await admin.auth.admin.getUserById(session.userId);
    const metadata = userResponse.data.user?.user_metadata ?? {};
    const secret = metadata.two_factor_secret;

    if (typeof secret !== "string" || secret.length === 0) {
      throw new BadRequestException("Two-factor authentication is not enabled.");
    }

    if (!verifyTotpToken(secret, code)) {
      throw new UnauthorizedException("Invalid authenticator code.");
    }

    const authUpdate = await admin.auth.admin.updateUserById(session.userId, {
      user_metadata: {
        ...metadata,
        two_factor_secret: null,
        two_factor_pending_secret: null,
      },
    });

    if (authUpdate.error) {
      throw new InternalServerErrorException("Unable to disable two-factor authentication.");
    }

    const { error } = await admin
      .schema("account").from("profiles")
      .update({ two_factor_enabled: false })
      .eq("id", session.userId);

    if (error) {
      throw new InternalServerErrorException("Two-factor authentication disabled but profile could not be updated.");
    }

    await this.supabaseService.logActivity(
      session.userId,
      "USER_2FA_DISABLED",
      "User",
      session.userId,
      (fullName) => `2FA deactivated for "${fullName}"`,
    );

    return {
      success: true,
      twoFactorEnabled: false,
    };
  }

  async sendPasswordReset(role: UserRole | undefined, identifier: string, origin: string) {
    if (role && !isUserRole(role)) {
      throw new BadRequestException("Please select a valid role before resetting your password.");
    }

    const normalizedRole = role ? normalizeRole(role) : undefined;

    const admin = this.supabaseService.createAdminClient();
    const normalizedIdentifier = identifier.includes("@")
      ? normalizeEmail(identifier)
      : normalizePhone(identifier);
    const identifierColumn = identifier.includes("@") ? "email" : "phone";

    let query = admin
      .schema("account").from("profiles")
      .select("id, email, phone");

    if (identifierColumn === "email") {
      query = query.eq("email", normalizedIdentifier);
    } else {
      query = query.in("phone", getPhoneLookupVariants(identifier));
    }

    if (normalizedRole) {
      query = query.eq("role", normalizedRole);
    }

    const { data: profileRow, error: profileError } = await query.maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException("Unable to prepare your password reset right now.");
    }

    if (!profileRow) {
      // Return a generic success message to prevent account enumeration
      return {
        success: true,
        message: "If an account matches those details, a verification code has been sent.",
      };
    }

    let targetValue = "";
    let channelValue: "sms" | "email" = "email";

    if (identifierColumn === "email") {
      targetValue = profileRow.email;
      channelValue = "email";
    } else {
      targetValue = toE164PhilippinePhone(profileRow.phone || normalizedIdentifier);
      channelValue = "sms";
    }

    const resetCode = createResetCode();
    const otpId = createResetOtpId();
    const expiry = new Date(Date.now() + RESET_OTP_TTL_MS).toISOString();

    console.log(`[Password Reset] Sending reset code to target: ${targetValue} via channel: ${channelValue}`);

    try {
      await this.tribeClient.authenticate();
      if (channelValue === "email") {
        await this.tribeClient.emailSend({
          to: [{ email: targetValue }],
          subject: "Your PakiShip password reset code",
          text: `Your PakiShip password reset code is ${resetCode}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
          html: `
            <p>Your PakiShip password reset code is:</p>
            <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${resetCode}</p>
            <p>This code expires in 10 minutes.</p>
            <p>If you did not request this, you can ignore this email.</p>
          `,
          metadata: { purpose: "password_reset", otpId },
        });
      } else {
        await this.tribeClient.smsSend({
          to: targetValue,
          message: `Your PakiShip password reset code is ${resetCode}. It expires in 10 minutes.`,
          metadata: { purpose: "password_reset", otpId },
        });
      }

      console.log("[Password Reset] Reset code delivery requested:", {
        otpId,
        expiresAt: expiry,
        channel: channelValue,
        target: targetValue,
      });
    } catch (sdkError) {
      console.error("[Password Reset] Reset code delivery failed:", sdkError);
      throw new InternalServerErrorException("Unable to send verification code. Please try again later.");
    }

    const { error: updateError } = await admin
      .schema("account").from("profiles")
      .update({
        password_reset_otp: encodeResetOtpReference(otpId, resetCode),
        password_reset_expiry: expiry,
      })
      .eq("id", profileRow.id);

    if (updateError) {
      console.error("[Password Reset] Failed to store OTP reference in database:", updateError);
      throw new InternalServerErrorException("Unable to store password reset request.");
    }

    return {
      success: true,
      otpId,
      method: channelValue,
      message: `A verification code has been sent via ${channelValue === "sms" ? "SMS" : "Email"}.`,
    };
  }

  async resetPasswordWithOtp(body: { identifier: string; code: string; newPassword: string; otpId?: string }) {
    const { identifier, code, newPassword, otpId } = body;
    if (!identifier || !code || !newPassword) {
      throw new BadRequestException("Identifier, OTP code, and new password are required.");
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      throw new BadRequestException(
        "New password must be at least 8 characters and include a number and special character.",
      );
    }

    const admin = this.supabaseService.createAdminClient();
    const normalizedIdentifier = identifier.includes("@")
      ? normalizeEmail(identifier)
      : normalizePhone(identifier);
    const identifierColumn = identifier.includes("@") ? "email" : "phone";

    // 1. Find the user profile
    let profileQuery = admin
      .schema("account").from("profiles")
      .select("id, password_reset_otp, password_reset_expiry");

    if (identifierColumn === "email") {
      profileQuery = profileQuery.eq("email", normalizedIdentifier);
    } else {
      profileQuery = profileQuery.in("phone", getPhoneLookupVariants(identifier));
    }

    const { data: profileRow, error: profileError } = await profileQuery.maybeSingle();

    if (profileError || !profileRow) {
      throw new NotFoundException("Profile not found.");
    }

    const resetReference = parseResetOtpReference(profileRow.password_reset_otp);
    if (!resetReference) {
      throw new BadRequestException("No active OTP request found for this account.");
    }

    if (otpId && otpId !== resetReference.otpId) {
      throw new UnauthorizedException("Invalid or expired OTP code.");
    }

    const expiryDate = new Date(profileRow.password_reset_expiry ?? "");
    if (!profileRow.password_reset_expiry || Number.isNaN(expiryDate.getTime()) || expiryDate.getTime() < Date.now()) {
      throw new UnauthorizedException("Invalid or expired OTP code.");
    }

    if (!matchesResetCode(resetReference.hash, resetReference.otpId, code.trim())) {
      throw new UnauthorizedException("Invalid or expired OTP code.");
    }

    // 3. Update password in Supabase Auth via admin API
    const updateResult = await admin.auth.admin.updateUserById(profileRow.id, {
      password: newPassword,
    });

    if (updateResult.error) {
      console.error("[OTP Verify] Password update failed:", updateResult.error);
      throw new InternalServerErrorException(
        updateResult.error.message || "Unable to update password.",
      );
    }

    // 4. Clear OTP details in profile
    const passwordUpdatedAt = new Date().toISOString();
    await admin
      .schema("account").from("profiles")
      .update({
        password_updated_at: passwordUpdatedAt,
        password_reset_otp: null,
        password_reset_expiry: null,
      })
      .eq("id", profileRow.id);

    return {
      success: true,
      message: "Password reset successfully. You can now log in.",
    };
  }

  async createUser(input: SignupInput) {
    if (!isUserRole(input.role)) {
      throw new BadRequestException("Please select a valid account role.");
    }

    const role = normalizeRole(input.role);

    const admin = this.supabaseService.createAdminClient();
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);

    const { data: duplicateProfiles, error: duplicateError } = await admin
      .schema("account").from("profiles")
      .select("id")
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1);

    if (duplicateError) {
      throw new InternalServerErrorException("Unable to validate account uniqueness.");
    }

    if (duplicateProfiles && duplicateProfiles.length > 0) {
      throw new ConflictException("An account with that email or mobile number already exists.");
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: input.password,
      email_confirm: true,
      user_metadata: {
        full_name: input.fullName.trim(),
        role,
      },
    });

    if (authError || !authData.user) {
      throw new BadRequestException(authError?.message || "Unable to create auth account.");
    }

    const profile = {
      id: authData.user.id,
      fullName: input.fullName.trim(),
      email,
      phone,
      dob: input.dob,
      role,
      address: input.address.trim(),
      city: input.city.trim(),
      province: input.province.trim(),
      documents: input.documents ?? [],
      createdAt: new Date().toISOString(),
    };

    const profileInsertPayload = {
      id: profile.id,
      full_name: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      dob: profile.dob,
      role,
      address: profile.address,
      city: profile.city,
      province: profile.province,
      documents: profile.documents,
      created_at: profile.createdAt,
    };

    let { error: profileError } = await admin.schema("account").from("profiles").upsert(profileInsertPayload);

    if (profileError) {
      console.error(`[Signup] Profile insert failed for ${profile.id}:`, profileError.message);
    }
    
    if (profileError && isMissingProfileColumnError(profileError.message)) {
      profileError = (
        await admin.schema("account").from("profiles").upsert({
          id: profile.id,
          full_name: profile.fullName,
          email: profile.email,
          phone: profile.phone,
          dob: profile.dob,
          role,
          address: profile.address,
          created_at: profile.createdAt,
        })
      ).error;
    }

    if (profileError) {
      await admin.auth.admin.deleteUser(profile.id);
      throw new InternalServerErrorException(profileError.message || "Profile could not be saved.");
    }

    return {
      user: {
        id: profile.id,
        fullName: profile.fullName,
        role: profile.role,
      },
      redirectPath: getRedirectPath(role),
      session: {
        userId: profile.id,
        role,
        fullName: profile.fullName,
      } satisfies SessionPayload,
    };
  }

  async signIn(identifier: string, password: string, role?: UserRole) {
    if (role && !isUserRole(role)) {
      throw new BadRequestException("Please select a valid role before logging in.");
    }

    const normalizedRole = role ? normalizeRole(role) : undefined;

    const admin = this.supabaseService.createAdminClient();
    const supabase = this.supabaseService.createServerClient();

    const normalizedIdentifier = identifier.includes("@")
      ? normalizeEmail(identifier)
      : normalizePhone(identifier);

    const identifierColumn = identifier.includes("@") ? "email" : "phone";

    let query = admin
      .schema("account").from("profiles")
      .select("id, full_name, email, phone, role, two_factor_enabled");

    if (identifierColumn === "email") {
      query = query.eq("email", normalizedIdentifier);
    } else {
      query = query.in("phone", getPhoneLookupVariants(identifier));
    }

    if (normalizedRole) {
      query = query.eq("role", normalizedRole);
    }

    const { data: profileRows, error: profileError } = await query;

    if (profileError || !profileRows || profileRows.length === 0) {
      console.error('--- SIGNIN ERROR: Profile Not Found ---');
      console.error('Identifier:', normalizedIdentifier);
      console.error('Role:', normalizedRole);
      console.error('Error:', profileError);
      throw new UnauthorizedException("Invalid credentials. (Account not found in the new schema)");
    }

    let authData: any = null;
    let authError: any = null;
    let matchedProfileRow: any = null;

    // Loop through all matching profiles and verify credentials via Supabase
    for (const row of profileRows) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: row.email,
        password,
      });

      if (data && data.user && !error) {
        authData = data;
        matchedProfileRow = row;
        break;
      } else {
        authError = error;
      }
    }

    if (!authData || !matchedProfileRow) {
      console.error('--- SIGNIN ERROR: Supabase Auth Failed ---');
      console.error('Emails tried:', profileRows.map(r => r.email));
      console.error('Last Auth Error:', authError?.message);
      throw new UnauthorizedException("Invalid credentials for the selected role. (Password mismatch)");
    }

    const session = {
      userId: matchedProfileRow.id,
      role: matchedProfileRow.role as UserRole,
      fullName: matchedProfileRow.full_name,
    } satisfies SessionPayload;

    if (matchedProfileRow.two_factor_enabled) {
      const userResponse = await admin.auth.admin.getUserById(matchedProfileRow.id);
      const secret = userResponse.data.user?.user_metadata?.two_factor_secret;

      if (typeof secret === "string" && secret.length > 0) {
        return {
          requiresTwoFactor: true as const,
          challengeToken: createTwoFactorChallengeToken(session),
          user: {
            id: matchedProfileRow.id,
            fullName: matchedProfileRow.full_name,
            role: matchedProfileRow.role as UserRole,
          },
          redirectPath: getRedirectPath(matchedProfileRow.role as UserRole),
        };
      }
    }

    await this.supabaseService.logActivity(
      matchedProfileRow.id,
      "USER_LOGIN",
      "User",
      matchedProfileRow.id,
      `${matchedProfileRow.role || "customer"} login`,
    );

    return {
      user: {
        id: matchedProfileRow.id,
        fullName: matchedProfileRow.full_name,
        role: matchedProfileRow.role as UserRole,
      },
      redirectPath: getRedirectPath(matchedProfileRow.role as UserRole),
      session,
    };
  }

  async verifyTwoFactorLogin(challengeToken: string, code: string) {
    const session = readTwoFactorChallengeToken(challengeToken);
    if (!session) {
      throw new UnauthorizedException("Your verification session has expired. Please log in again.");
    }

    const admin = this.supabaseService.createAdminClient();
    const userResponse = await admin.auth.admin.getUserById(session.userId);
    const metadata = userResponse.data.user?.user_metadata ?? {};
    const secret = metadata.two_factor_secret;

    if (typeof secret !== "string" || !verifyTotpToken(secret, code)) {
      throw new UnauthorizedException("Invalid authenticator code.");
    }

    await this.supabaseService.logActivity(
      session.userId,
      "USER_LOGIN",
      "User",
      session.userId,
      `${session.role || "customer"} login`,
    );

    return {
      user: {
        id: session.userId,
        fullName: session.fullName,
        role: session.role,
      },
      redirectPath: getRedirectPath(session.role),
      session: {
        userId: session.userId,
        fullName: session.fullName,
        role: session.role,
      } satisfies SessionPayload,
    };
  }
}
