import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.beleqetjobs.com/api/v1';

export type TmaUserRole = 'JOB_SEEKER' | 'EMPLOYER';

export interface TmaLoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: TmaUserRole;
    firstName?: string;
    lastName?: string;
  };
}

export interface TmaLinkResponse {
  success: boolean;
  telegramId: string;
}

/**
 * Authenticates (or auto-provisions) a user via Telegram initData.
 *
 * The backend verifies the HMAC-SHA256 signature of `initData` against
 * `TELEGRAM_BOT_TOKEN` and enforces a 24-hour expiry before issuing JWT
 * tokens.  No password or email required — fully passwordless inside TMA.
 *
 * Store the returned tokens in your auth storage (Zustand / localStorage)
 * exactly as you would tokens from the standard email/password login flow.
 *
 * @param initData  - Raw query string from `window.Telegram.WebApp.initData`
 * @param role      - Preferred role for new account provisioning (optional)
 * @returns JWT token pair + user object
 *
 * @throws AxiosError with backend error details on invalid/expired initData
 */
export async function tmaLogin(
  initData: string,
  role?: TmaUserRole,
): Promise<TmaLoginResponse> {
  const response = await axios.post<TmaLoginResponse>(
    `${API_BASE}/telegram/tma-login`,
    { initData, role },
  );
  return response.data;
}

/**
 * Links the current authenticated web session to a Telegram identity.
 *
 * Call this when a logged-in web user opens the TMA for the first time and
 * wants to associate their existing account with their Telegram ID.
 *
 * @param initData    - Raw query string from `window.Telegram.WebApp.initData`
 * @param bearerToken - JWT access token of the currently logged-in user
 * @returns Success confirmation with the linked telegramId
 */
export async function tmaLink(
  initData: string,
  bearerToken: string,
): Promise<TmaLinkResponse> {
  const response = await axios.post<TmaLinkResponse>(
    `${API_BASE}/telegram/tma-link`,
    { initData },
    { headers: { Authorization: `Bearer ${bearerToken}` } },
  );
  return response.data;
}
