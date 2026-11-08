/**
 * Sign-in, sign-up and account calls. Same flows as the website's lib/auth.ts:
 * a password sign-in may need the emailed code (new accounts) or the two-step code first.
 */
import type { AuthResponse, AuthUser, UserRole } from '@beleqet/common';
import { apiClient, persistTokens, REFRESH_TOKEN_KEY } from './client';
import { get, send } from '../lib/api';
import { toApiError } from '../lib/api-error';
import * as SecureStore from 'expo-secure-store';

export type { AuthUser, UserRole };

/** The signed-in user, with whether the email is confirmed (from /users/profile). */
export type Me = AuthUser & { emailVerified?: boolean; createdAt?: string };

export type SignInResult =
  | { status: 'signed-in'; user: Me }
  | { status: 'needs-code'; tempToken: string }
  | { status: 'needs-email-code'; verificationToken: string; email: string };

type Challenge = { requiresEmailVerification: true; verificationToken: string; email: string };
type TwoFactor = { requires2fa: true; tempToken: string };

async function finish(data: AuthResponse | Challenge | TwoFactor): Promise<SignInResult> {
  if ('requiresEmailVerification' in data) {
    return { status: 'needs-email-code', verificationToken: data.verificationToken, email: data.email };
  }
  if ('requires2fa' in data && data.requires2fa) return { status: 'needs-code', tempToken: data.tempToken };
  const auth = data as AuthResponse;
  await persistTokens(auth.accessToken, auth.refreshToken);
  return { status: 'signed-in', user: await fetchMe().catch(() => auth.user) };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  try {
    const { data } = await apiClient.post<T>(path, body);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export async function signIn(email: string, password: string): Promise<SignInResult> {
  return finish(await post('/auth/login', { email: email.trim().toLowerCase(), password }));
}

export type SignupRole = 'JOB_SEEKER' | 'FREELANCER' | 'EMPLOYER';

export async function register(input: { email: string; password: string; firstName: string; lastName: string; role: SignupRole }): Promise<SignInResult> {
  return finish(await post('/auth/register', { ...input, email: input.email.trim().toLowerCase() }));
}

/** Confirms the email with the 6-digit code; signs in (or asks for the two-step code). */
export async function verifyEmailCode(verificationToken: string, code: string): Promise<SignInResult> {
  return finish(await post('/auth/verify-email-code', { verificationToken, code }));
}

/** Emails a new code; the API sends at most one a minute (sent is false otherwise). */
export function resendEmailCode(verificationToken: string) {
  return post<{ sent: boolean; alreadyVerified: boolean }>('/auth/resend-verification-code', { verificationToken });
}

/** Finishes a two-step sign-in with an app code or a backup code. */
export async function completeTwoFactor(tempToken: string, code: string, kind: 'app' | 'backup'): Promise<SignInResult> {
  const data = await post<AuthResponse>(
    kind === 'app' ? '/auth/2fa/verify' : '/auth/2fa/backup-code',
    kind === 'app' ? { tempToken, code } : { tempToken, backupCode: code },
  );
  return finish(data);
}

/** Resolves the same way whether or not the email exists, like the API. */
export function requestPasswordReset(email: string) {
  return post('/auth/forgot-password', { email: email.trim().toLowerCase() });
}

export function resetPassword(token: string, newPassword: string) {
  return post('/auth/reset-password', { token, newPassword });
}

/** Sends a new confirmation link to a signed-in user whose email isn't confirmed. */
export function resendVerification() {
  return send('POST', '/auth/resend-verification');
}

/** Signs in with the tokens Google or LinkedIn handed back. */
export async function completeOAuth(accessToken: string, refreshToken: string): Promise<Me> {
  await persistTokens(accessToken, refreshToken);
  return fetchMe();
}

export async function fetchMe(): Promise<Me> {
  return get<Me>('/users/profile');
}

/** Ends the session on the server too (revokes refresh tokens); failures don't block signing out. */
export async function serverLogout(): Promise<void> {
  const refresh = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
  if (!refresh) return;
  await send('POST', '/auth/logout').catch(() => undefined);
}
