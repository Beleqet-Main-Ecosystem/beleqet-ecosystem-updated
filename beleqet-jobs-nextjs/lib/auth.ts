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
/** Set when someone unticks "Keep me signed in". */
const SESSION_ONLY_KEY = 'beleqet_session_only';
/** Browser-session cookie: shared by all tabs, gone when the browser closes. */
const SESSION_COOKIE = 'beleqet_session';

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
  if (typeof document !== 'undefined') {
    document.cookie = `beleqet_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`;
    document.cookie = `beleqet_user=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=2592000; SameSite=Lax`;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  if (typeof document !== 'undefined') {
    document.cookie = 'beleqet_token=; path=/; max-age=0; SameSite=Lax';
    document.cookie = 'beleqet_user=; path=/; max-age=0; SameSite=Lax';
  }
}

/** Records the sign-in choice. Unticked means signing out when the browser closes. */
export function setKeepSignedIn(keep: boolean): void {
  if (keep) {
    localStorage.removeItem(SESSION_ONLY_KEY);
    return;
  }
  localStorage.setItem(SESSION_ONLY_KEY, '1');
  document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

/** Call on load: ends a "not kept" session once its browser session is over. */
export function enforceKeepSignedIn(): void {
  if (localStorage.getItem(SESSION_ONLY_KEY) && !document.cookie.includes(`${SESSION_COOKIE}=1`)) {
    localStorage.removeItem(SESSION_ONLY_KEY);
    clearAuth();
  }
}

// ── Token refresh ─────────────────────────────────────────────────────────────

/**
 * Fired when the server no longer accepts the stored session (expired, signed out elsewhere, or
 * the account is gone), so the page stops acting signed in instead of failing request after request.
 */
export const SESSION_ENDED_EVENT = 'beleqet:session-ended';

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const { data } = await authApi.post<AuthResponse>('/auth/refresh', { refreshToken });
    persist(data.accessToken, data.user, data.refreshToken);
    return data.accessToken;
  } catch (error) {
    // No connection says nothing about the session: keep it for when the connection is back.
    if (axios.isAxiosError(error) && !error.response) return null;
    clearAuth();
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SESSION_ENDED_EVENT));
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

/** Sign-up, and sign-in for a new account, wait for the 6-digit code emailed to the address. */
export type EmailCodeChallenge = { status: 'needs-email-code'; verificationToken: string; email: string };
type ChallengeResponse = { requiresEmailVerification: true; verificationToken: string; email: string };

const challengeFrom = (data: ChallengeResponse): EmailCodeChallenge => ({
  status: 'needs-email-code',
  verificationToken: data.verificationToken,
  email: data.email,
});

/**
 * Register a new account. The API emails a 6-digit code and signs the account in only once the
 * code is entered (verifyEmailCode).
 */
export async function registerUser(input: RegisterDto): Promise<EmailCodeChallenge | { status: 'signed-in'; user: AuthUser }> {
  try {
    const { data } = await authApi.post<AuthResponse | ChallengeResponse>('/auth/register', input);
    if ('requiresEmailVerification' in data) return challengeFrom(data);
    persist(data.accessToken, data.user, data.refreshToken);
    return { status: 'signed-in', user: data.user };
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

/** Confirms the email with the emailed code; signs in (or asks for the two-step code). */
export async function verifyEmailCode(verificationToken: string, code: string): Promise<LoginResult> {
  try {
    const { data } = await authApi.post<AuthResponse | { requires2fa: true; tempToken: string }>('/auth/verify-email-code', { verificationToken, code });
    if ('requires2fa' in data && data.requires2fa) return { status: 'needs-code', tempToken: data.tempToken };
    const auth = data as AuthResponse;
    persist(auth.accessToken, auth.user, auth.refreshToken);
    return { status: 'signed-in', user: auth.user };
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

/** Emails a new code; the API sends at most one a minute (sent is false otherwise). */
export async function resendEmailCode(verificationToken: string): Promise<{ sent: boolean; alreadyVerified: boolean }> {
  try {
    const { data } = await authApi.post<{ sent: boolean; alreadyVerified: boolean }>('/auth/resend-verification-code', { verificationToken });
    return data;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

/**
 * Result of a password sign-in: signed in, or a code is needed first: the two-step code
 * (authenticator app) or, for a new account, the code emailed to confirm the address.
 */
export type LoginResult =
  | { status: 'signed-in'; user: AuthUser }
  | { status: 'needs-code'; tempToken: string }
  | EmailCodeChallenge;

/**
 * Authenticate with email + password.
 * Persists tokens on success; accounts with two-step verification get a
 * temporary token to finish with `completeTwoFactor`.
 */
export async function loginUser(input: LoginDto): Promise<LoginResult> {
  try {
    const { data } = await authApi.post<AuthResponse | ChallengeResponse | { requires2fa: true; tempToken: string }>('/auth/login', input);
    if ('requiresEmailVerification' in data) return challengeFrom(data);
    if ('requires2fa' in data && data.requires2fa) return { status: 'needs-code', tempToken: data.tempToken };
    const auth = data as AuthResponse;
    persist(auth.accessToken, auth.user, auth.refreshToken);
    return { status: 'signed-in', user: auth.user };
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

/** Finish a two-step sign-in with a 6-digit app code or a 10-character backup code. */
export async function completeTwoFactor(tempToken: string, code: string, kind: 'app' | 'backup'): Promise<AuthUser> {
  try {
    const { data } = await authApi.post<AuthResponse>(
      kind === 'app' ? '/auth/2fa/verify' : '/auth/2fa/backup-code',
      kind === 'app' ? { tempToken, code } : { tempToken, backupCode: code },
    );
    persist(data.accessToken, data.user, data.refreshToken);
    return data.user;
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

/** A Telegram account with no Beleqet account: it registers in the bot (accounts aren't made here). */
export type TelegramSignInResult = LoginResult | { status: 'not-registered' };

function telegramNotRegistered(error: unknown): boolean {
  return axios.isAxiosError(error) && (error.response?.data as { errorCode?: string } | undefined)?.errorCode === 'ERR_TELEGRAM_NOT_REGISTERED';
}

/**
 * Sign in from a Telegram Mini App with Telegram's signed launch data, no password. Someone
 * without an account stays a guest; two-step sign-in still asks for its code.
 */
export async function signInWithTelegram(initData: string): Promise<TelegramSignInResult> {
  try {
    const { data } = await authApi.post<AuthResponse | { requires2fa: true; tempToken: string }>('/telegram/tma-login', { initData });
    if ('requires2fa' in data && data.requires2fa) return { status: 'needs-code', tempToken: data.tempToken };
    const auth = data as AuthResponse;
    persist(auth.accessToken, auth.user, auth.refreshToken);
    return { status: 'signed-in', user: auth.user };
  } catch (error) {
    if (telegramNotRegistered(error)) return { status: 'not-registered' };
    throw new Error(messageFrom(error));
  }
}

/**
 * "Sign in with Telegram" with the details Telegram's login popup returned: accounts linked to
 * that Telegram only. Two-step sign-in still asks for its code.
 */
export async function signInWithTelegramLogin(data: Record<string, string | number>): Promise<TelegramSignInResult> {
  try {
    const { data: answer } = await authApi.post<AuthResponse | { requires2fa: true; tempToken: string }>('/telegram/login', { data });
    if ('requires2fa' in answer && answer.requires2fa) return { status: 'needs-code', tempToken: answer.tempToken };
    const auth = answer as AuthResponse;
    persist(auth.accessToken, auth.user, auth.refreshToken);
    return { status: 'signed-in', user: auth.user };
  } catch (error) {
    if (telegramNotRegistered(error)) return { status: 'not-registered' };
    throw new Error(messageFrom(error));
  }
}

/** Telegram-only accounts have an internal address that is never shown or emailed. */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || /@(beleqet\.internal|tme\.beleqet\.local)$/i.test(email);
}

/** Always resolves the same way whether or not the email exists, like the API. */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await authApi.post('/auth/forgot-password', { email });
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  try {
    await authApi.post('/auth/reset-password', { token, newPassword });
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

export async function verifyEmail(token: string): Promise<void> {
  try {
    await authApi.post('/auth/verify-email', { token });
  } catch (error) {
    throw new Error(messageFrom(error));
  }
}

// ── Google and LinkedIn sign-in ───────────────────────────────────────────────

/** Where to go after a provider sign-in; the API's redirect can't carry it. */
export const OAUTH_NEXT_KEY = 'beleqet_oauth_next';
/** A two-step challenge from a provider sign-in, picked up by the sign-in page. */
export const OAUTH_TWO_FACTOR_KEY = 'beleqet_oauth_2fa';

export function oauthStartUrl(provider: 'google' | 'linkedin'): string {
  return `${authApi.defaults.baseURL}/auth/${provider}`;
}

/** Store the session the API handed back after Google or LinkedIn. */
export async function completeOAuth(accessToken: string, refreshToken: string): Promise<AuthUser> {
  const { data } = await authApi.get<AuthUser>('/users/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
  const user = { id: data.id, email: data.email, firstName: data.firstName, lastName: data.lastName, role: data.role } as AuthUser;
  persist(accessToken, user, refreshToken);
  return user;
}
