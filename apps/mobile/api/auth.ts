/**
 * Auth API — login, register, refresh, profile fetch.
 *
 * Types are imported from @beleqet/common so mobile and web
 * stay in sync with the backend DTOs automatically.
 */

import type {
  AuthUser,
  AuthResponse,
  LoginDto,
  RegisterDto,
  JwtPayload,
} from '@beleqet/common';
import { apiClient, persistTokens } from './client';

// Re-export so consumers can import from a single place.
export type { AuthUser, LoginDto, RegisterDto };

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return 'Something went wrong. Please try again.';
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Response when 2FA is required before full authentication.
 */
export interface TwoFactorRequired {
  requires2fa: true;
  tempToken: string;
  factorId: string;
}

/**
 * Authenticate with email + password.
 * Persists tokens to SecureStore on success.
 * Returns a TwoFactorRequired object if the account has 2FA enabled.
 */
export async function loginUser(input: LoginDto): Promise<AuthUser | TwoFactorRequired> {
  try {
    const { data } = await apiClient.post<AuthResponse | TwoFactorRequired>('/auth/login', input);

    // Handle 2FA challenge response
    if ('requires2fa' in data && data.requires2fa) {
      return data as TwoFactorRequired;
    }

    const authData = data as AuthResponse;
    await persistTokens(authData.accessToken, authData.refreshToken);
    return authData.user;
  } catch (error) {
    throw new Error(extractMessage(error));
  }
}

/**
 * Create a new account.
 * Persists tokens to SecureStore on success.
 */
export async function registerUser(input: RegisterDto): Promise<AuthUser> {
  try {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', input);
    await persistTokens(data.accessToken, data.refreshToken);
    return data.user;
  } catch (error) {
    throw new Error(extractMessage(error));
  }
}

/**
 * Request password reset email.
 */
export async function requestPasswordReset(email: string): Promise<{ message?: string }> {
  try {
    const { data } = await apiClient.post<{ message?: string }>('/auth/forgot-password', { email });
    return data;
  } catch (error) {
    throw new Error(extractMessage(error));
  }
}

/**
 * Fetch the full authenticated user profile from `GET /users/profile`.
 *
 * NOTE: `GET /auth/me` only returns the JWT payload { userId, email, role }.
 * Use `GET /users/profile` for the full AuthUser shape.
 */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await apiClient.get<AuthUser>('/users/profile');
    return data;
  } catch {
    return null;
  }
}

/**
 * Fetch the minimal JWT payload from `GET /auth/me`.
 * Contains only { userId, email, role }.
 */
export async function fetchJwtPayload(): Promise<JwtPayload | null> {
  try {
    const { data } = await apiClient.get<JwtPayload>('/auth/me');
    return data;
  } catch {
    return null;
  }
}

/**
 * Update own profile fields (partial update).
 */
export async function updateProfile(
  input: Partial<Pick<AuthUser, 'firstName' | 'lastName' | 'phone' | 'bio' | 'location' | 'avatarUrl' | 'skills' | 'headline'>>,
): Promise<AuthUser> {
  try {
    const { data } = await apiClient.patch<AuthUser>('/users/profile', input);
    return data;
  } catch (error) {
    throw new Error(extractMessage(error));
  }
}
