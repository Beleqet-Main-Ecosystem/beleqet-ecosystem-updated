/**
 * Auth API for the beleqet-jobs-nextjs web frontend.
 *
 * Core domain types (AuthUser, LoginDto, RegisterDto) are imported from
 * @beleqet/common to stay aligned with the backend DTOs.
 */

import axios from 'axios';
import type {
  AuthUser,
  AuthResponse,
  LoginDto,
  RegisterDto,
} from '@beleqet/common';

// Re-export so app code can import from a single place.
export type { AuthUser, LoginDto, RegisterDto };

// ── Backwards-compat aliases (old names used in existing components) ──────────

/** @deprecated Use LoginDto from @beleqet/common */
export type LoginInput = LoginDto;
/** @deprecated Use RegisterDto from @beleqet/common */
export type RegisterInput = RegisterDto;

// ── Internal API client ───────────────────────────────────────────────────────

const authApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1',
  timeout: 10000,
});

const TOKEN_KEY = 'beleqet_token';
const REFRESH_KEY = 'beleqet_refresh';
const USER_KEY = 'beleqet_user';

// ── Storage helpers ───────────────────────────────────────────────────────────

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function persist(token: string, user: AuthUser, refreshToken?: string | null): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await authApi.post<AuthResponse>('/auth/refresh', { refreshToken });
    persist(data.accessToken, data.user, data.refreshToken);
    return data.accessToken;
  } catch {
    clearAuth();
    return null;
  }
}

/**
 * Wrapper around `fetch` that injects the Bearer token and transparently
 * retries once after a 401 using the stored refresh token.
 */
export async function authenticatedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response = await fetch(input, { ...init, headers });
  if (response.status !== 401) return response;

  const refreshedToken = await refreshAccessToken();
  if (!refreshedToken) return response;

  headers.set('Authorization', `Bearer ${refreshedToken}`);
  response = await fetch(input, { ...init, headers });
  return response;
}

// ── Error helper ──────────────────────────────────────────────────────────────

function messageFrom(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    if (error.code === 'ECONNABORTED' || !error.response)
      return 'Cannot reach the server. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

// ── Auth API functions ────────────────────────────────────────────────────────

/**
 * Register a new account.
 * Persists tokens to localStorage on success.
 */
export async function registerUser(input: RegisterDto): Promise<AuthUser> {
  try {
    const { data } = await authApi.post<AuthResponse>('/auth/register', input);
    persist(data.accessToken, data.user, data.refreshToken);
    return data.user;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

/**
 * Authenticate with email + password.
 * Persists tokens to localStorage on success.
 */
export async function loginUser(input: LoginDto): Promise<AuthUser> {
  try {
    const { data } = await authApi.post<AuthResponse>('/auth/login', input);
    persist(data.accessToken, data.user, data.refreshToken);
    return data.user;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}
