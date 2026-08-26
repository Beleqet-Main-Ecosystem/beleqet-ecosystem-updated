/** Auth API — login, register, refresh, profile fetch. */

import { z } from 'zod';
import { apiClient, persistTokens } from './client';

// ── Schemas ───────────────────────────────────────────────────────────────────

export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['JOB_SEEKER', 'EMPLOYER', 'FREELANCER', 'ADMIN']),
  avatarUrl: z.string().nullish(),
  phone: z.string().nullish(),
  bio: z.string().nullish(),
  location: z.string().nullish(),
  isEmailVerified: z.boolean().nullish(),
});

export type AuthUser = z.infer<typeof userSchema>;

const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullish(),
  user: userSchema,
});

// ── Input types ───────────────────────────────────────────────────────────────

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'JOB_SEEKER' | 'EMPLOYER' | 'FREELANCER';
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const data = (error as { response?: { data?: { message?: string | string[] } } }).response?.data;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }
  return 'Something went wrong. Please try again.';
}

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Authenticate with email + password.
 * Persists tokens to SecureStore on success.
 */
export async function loginUser(input: LoginInput): Promise<AuthUser> {
  try {
    const { data } = await apiClient.post('/auth/login', input);
    const parsed = authResponseSchema.parse(data);
    await persistTokens(parsed.accessToken, parsed.refreshToken);
    return parsed.user;
  } catch (error) {
    throw new Error(extractMessage(error));
  }
}

/**
 * Create a new account.
 * Persists tokens to SecureStore on success.
 */
export async function registerUser(input: RegisterInput): Promise<AuthUser> {
  try {
    const { data } = await apiClient.post('/auth/register', input);
    const parsed = authResponseSchema.parse(data);
    await persistTokens(parsed.accessToken, parsed.refreshToken);
    return parsed.user;
  } catch (error) {
    throw new Error(extractMessage(error));
  }
}

/**
 * Fetch the currently authenticated user's profile.
 * Returns null if the token is absent or invalid.
 */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await apiClient.get('/auth/me');
    return userSchema.parse(data);
  } catch {
    return null;
  }
}

/**
 * Update own profile fields (partial update).
 */
export async function updateProfile(
  input: Partial<Pick<AuthUser, 'firstName' | 'lastName' | 'phone' | 'bio' | 'location'>>,
): Promise<AuthUser> {
  try {
    const { data } = await apiClient.patch('/auth/me', input);
    return userSchema.parse(data);
  } catch (error) {
    throw new Error(extractMessage(error));
  }
}
