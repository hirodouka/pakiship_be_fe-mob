import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { SupabaseService } from "../supabase/supabase.service";
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

function getRedirectPath(role: UserRole) {
  if (role === "driver") return "/driver/home";
  if (role === "operator") return "/operator/home";
  return "/customer/home";
}

const PASSWORD_REGEX = /^(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;

function isMissingProfileColumnError(message?: string | null) {
  const normalized = String(message ?? "").toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("city") ||
      normalized.includes("province") ||
      normalized.includes("documents"))
  );
}

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

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
      .select("email")
      .eq(identifierColumn, normalizedIdentifier);

    if (normalizedRole) {
      query = query.eq("role", normalizedRole);
    }

    const { data: profileRow, error: profileError } = await query.maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException("Unable to prepare your password reset right now.");
    }

    if (!profileRow?.email) {
      return {
        success: true,
        message: "If an account matches those details, a reset link has been sent to its email address.",
      };
    }

    const redirectTo = `${origin.replace(/\/$/, "")}/reset-password`;
    const resetResult = await admin.auth.resetPasswordForEmail(profileRow.email, {
      redirectTo,
    });

    if (resetResult.error) {
      throw new InternalServerErrorException(
        resetResult.error.message || "Unable to send the password reset email right now.",
      );
    }

    return {
      success: true,
      email: profileRow.email,
      message: "Password reset email sent.",
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
      .select("id, full_name, email, phone, role, two_factor_enabled")
      .eq(identifierColumn, normalizedIdentifier);

    if (normalizedRole) {
      query = query.eq("role", normalizedRole);
    }

    const { data: profileRow, error: profileError } = await query.maybeSingle();

    if (profileError || !profileRow) {
      console.error('--- SIGNIN ERROR: Profile Not Found ---');
      console.error('Identifier:', normalizedIdentifier);
      console.error('Role:', normalizedRole);
      console.error('Error:', profileError);
      throw new UnauthorizedException("Invalid credentials. (Account not found in the new schema)");
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: profileRow.email,
      password,
    });

    if (authError || !authData.user) {
      console.error('--- SIGNIN ERROR: Supabase Auth Failed ---');
      console.error('Email:', profileRow.email);
      console.error('Auth Error:', authError?.message);
      throw new UnauthorizedException("Invalid credentials for the selected role. (Password mismatch)");
    }

    const session = {
      userId: profileRow.id,
      role: profileRow.role as UserRole,
      fullName: profileRow.full_name,
    } satisfies SessionPayload;

    if (profileRow.two_factor_enabled) {
      const userResponse = await admin.auth.admin.getUserById(profileRow.id);
      const secret = userResponse.data.user?.user_metadata?.two_factor_secret;

      if (typeof secret === "string" && secret.length > 0) {
        return {
          requiresTwoFactor: true as const,
          challengeToken: createTwoFactorChallengeToken(session),
          user: {
            id: profileRow.id,
            fullName: profileRow.full_name,
            role: profileRow.role as UserRole,
          },
          redirectPath: getRedirectPath(profileRow.role as UserRole),
        };
      }
    }

    return {
      user: {
        id: profileRow.id,
        fullName: profileRow.full_name,
        role: profileRow.role as UserRole,
      },
      redirectPath: getRedirectPath(profileRow.role as UserRole),
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
