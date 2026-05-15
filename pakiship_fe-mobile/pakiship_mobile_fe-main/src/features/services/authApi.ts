import { runtimeConfig } from '@config/runtime';
import type { AuthResponse, LoginRequest, SignupRequest } from '../types/authTypes';

type ForgotPasswordRequest = {
  email: string;
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

  forgotPassword(input: ForgotPasswordRequest): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({
        email: input.email.trim().toLowerCase(),
      }),
    });
  },
  
  logout(): Promise<{ message: string }> {
    return request<{ message: string }>('/auth/logout', {
      method: 'POST',
    });
  },
};
