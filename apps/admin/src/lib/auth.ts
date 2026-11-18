/**
 * Admin sign-in. The session lives on the admin origin only, so nothing on the public
 * website can read it. Same API and token flow as the website (beleqet-jobs-nextjs/lib/auth.ts).
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

export type AdminUser = { id: string; email: string; firstName: string; lastName: string; role: string };

type Tokens = { accessToken: string; refreshToken?: string; user: AdminUser };
export type LoginResult = { status: 'signed-in'; user: AdminUser } | { status: 'needs-code'; tempToken: string };

const TOKEN_KEY = 'beleqet_admin_token';
const REFRESH_KEY = 'beleqet_admin_refresh';
const USER_KEY = 'beleqet_admin_user';

/** Thrown when an account signs in fine but is not an administrator. */
export class NotAdminError extends Error {}

export function getToken(): string | null {
  return typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as AdminUser | null;
    return user?.role === 'ADMIN' ? user : null;
  } catch {
    return null;
  }
}

function persist({ accessToken, refreshToken, user }: Tokens): AdminUser {
  if (user.role !== 'ADMIN') {
    clearAuth();
    throw new NotAdminError();
  }
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  return user;
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { message?: string | string[] }).message;
    throw new Error(Array.isArray(message) ? message.join(', ') : message || `Request failed (${response.status})`);
  }
  return data as T;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const data = await post<Tokens | { requires2fa: true; tempToken: string } | { requiresEmailVerification: true }>(
    '/auth/login',
    { email, password },
  );
  // Only new self-service accounts are asked to confirm their email; administrators never are.
  if ('requiresEmailVerification' in data) throw new NotAdminError();
  if ('requires2fa' in data && data.requires2fa) return { status: 'needs-code', tempToken: data.tempToken };
  return { status: 'signed-in', user: persist(data as Tokens) };
}

/** Finish a two-step sign-in with a 6-digit app code or a backup code. */
export async function completeTwoFactor(tempToken: string, code: string, kind: 'app' | 'backup'): Promise<AdminUser> {
  const data = await post<Tokens>(
    kind === 'app' ? '/auth/2fa/verify' : '/auth/2fa/backup-code',
    kind === 'app' ? { tempToken, code } : { tempToken, backupCode: code },
  );
  return persist(data);
}

/** Swap the refresh token for a new access token; signs out when it has expired. */
export async function refreshSession(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    return persist(await post<Tokens>('/auth/refresh', { refreshToken })) && getToken();
  } catch {
    clearAuth();
    return null;
  }
}

/** Ends the session on the server too, so a copied refresh token stops working. */
export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
  }
  clearAuth();
}
