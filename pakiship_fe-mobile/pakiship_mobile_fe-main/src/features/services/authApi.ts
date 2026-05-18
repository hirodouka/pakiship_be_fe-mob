import { runtimeConfig } from '@config/runtime';
import type { AuthResponse, LoginRequest, SignupRequest } from '../types/authTypes';

type ForgotPasswordRequest = {
  emailOrMobile: string;
};

const normalizePhone = (value: string) => value.replace(/\D/g, '');

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'any',
        ...(init.headers ?? {}),
      },
      ...init,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Cannot reach the server at ${runtimeConfig.apiBaseUrl}. Make sure the backend is running on port 4000 and your device can reach this computer.`,
      );
    }

    throw error;
  }

  const payload = (await response.json().catch(() => null)) as
    | { message?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? 'Request failed.');
  }

  return payload as T;
}

export const authApi = {
  signup(input: SignupRequest): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        email: input.email.trim().toLowerCase(),
        mobile: normalizePhone(input.mobile),
      }),
    });
  },

  login(input: LoginRequest): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        emailOrMobile: input.emailOrMobile.includes('@')
          ? input.emailOrMobile.trim().toLowerCase()
          : normalizePhone(input.emailOrMobile),
      }),
    });
  },

  forgotPassword(
    input: ForgotPasswordRequest,
  ): Promise<{ success: boolean; method: 'email' | 'sms'; otpId?: string; message: string }> {
    const isEmail = input.emailOrMobile.includes('@');
    const normalizedInput = isEmail
      ? input.emailOrMobile.trim().toLowerCase()
      : normalizePhone(input.emailOrMobile);

    return request<{ success: boolean; method: 'email' | 'sms'; otpId?: string; message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedInput,
        identifier: normalizedInput,
      }),
    });
  },

  resetPasswordWithOtp(input: {
    emailOrMobile: string;
    code: string;
    newPassword: string;
    otpId?: string;
  }): Promise<{ success: boolean; message: string }> {
    const isEmail = input.emailOrMobile.includes('@');
    const normalizedInput = isEmail
      ? input.emailOrMobile.trim().toLowerCase()
      : normalizePhone(input.emailOrMobile);

    return request<{ success: boolean; message: string }>('/auth/reset-password/otp', {
      method: 'POST',
      body: JSON.stringify({
        identifier: normalizedInput,
        code: input.code.trim(),
        newPassword: input.newPassword,
        otpId: input.otpId,
      }),
    });
  },
  
  logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  },

  setupTwoFactor(): Promise<{ secret: string; otpauthUri: string }> {
    return request<{ secret: string; otpauthUri: string }>('/auth/two-factor/setup', {
      method: 'POST',
    });
  },

  enableTwoFactor(code: string): Promise<{ success: boolean; twoFactorEnabled: boolean }> {
    return request<{ success: boolean; twoFactorEnabled: boolean }>('/auth/two-factor/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  disableTwoFactor(code: string): Promise<{ success: boolean; twoFactorEnabled: boolean }> {
    return request<{ success: boolean; twoFactorEnabled: boolean }>('/auth/two-factor/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  verifyTwoFactor(challengeToken: string, code: string): Promise<AuthResponse> {
    return request<AuthResponse>('/auth/login/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ challengeToken, code }),
    });
  },
};
