// In-memory store for the verified step-up token.
// Not localStorage — the token is short-lived (15 min) and sensitive.
let _stepUpToken: string | null = null;

export function getStepUpToken(): string | null {
  return _stepUpToken;
}

export function setStepUpToken(token: string | null) {
  _stepUpToken = token;
}

export function clearStepUpToken() {
  _stepUpToken = null;
}

// ── Challenge & Verify ────────────────────────────────────────────

/** Request an action-scoped challenge token from POST /auth/2fa/challenge. */
export async function requestChallenge(
  apiBaseUrl: string,
  accessToken: string,
  action: string,
  resourceId?: string,
): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/auth/2fa/challenge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action, resourceId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to get challenge token');
  }
  const data = await res.json();
  return data.stepUpToken;
}

/** Verify a challenge token + TOTP code via POST /auth/2fa/step-up.
 *  Returns the verified step-up token and stores it in memory. */
export async function verifyStepUp(
  apiBaseUrl: string,
  challengeToken: string,
  code: string,
  action?: string,
  resourceId?: string,
): Promise<string> {
  const res = await fetch(`${apiBaseUrl}/auth/2fa/step-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepUpToken: challengeToken, code, action, resourceId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Step-up verification failed');
  }
  const data = await res.json();
  _stepUpToken = data.stepUpToken;
  return data.stepUpToken;
}

// ── Sensitive Request with Auto Step-Up ───────────────────────────

export type ResponseLike = { status: number; data: any };

/** Make a sensitive API request. If the initial call returns 401 with
 *  `requiresStepUp: true`, this function automatically:
 *    1. Extracts the challenge token from the error.
 *    2. Calls `onCodeRequest()` to get the TOTP code from the user.
 *    3. Verifies via `/step-up`.
 *    4. Retries the original request with `x-step-up-token` header.
 *
 *  Usage for wallet withdraw, escrow release, etc.:
 *
 *    const result = await executeSensitiveRequest(
 *      (headers) => api.post('/wallet/withdraw', { amount: 100 }, { headers }),
 *      '/api/v1',
 *      accessToken,
 *      () => showModalAndWaitForCode(),   // returns the user's 6-digit code
 *    );
 */
export async function executeSensitiveRequest(
  requestFn: (headers: Record<string, string>) => Promise<ResponseLike>,
  apiBaseUrl: string,
  accessToken: string,
  onCodeRequest: () => Promise<string>,
  action?: string,
  resourceId?: string,
): Promise<ResponseLike> {
  // 1. Initial request — access token only
  const result = await requestFn({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  });

  // 2. If step-up required, attempt the full flow
  if (result.status === 401 && result.data?.requiresStepUp) {
    const challengeToken = result.data.stepUpToken;
    if (!challengeToken) {
      throw new Error('Step-up required but no challenge token returned');
    }

    // 3. Get TOTP code from user (via StepUpModal or similar)
    const code = await onCodeRequest();

    // 4. Verify via /step-up
    const stepUpToken = await verifyStepUp(
      apiBaseUrl,
      challengeToken,
      code,
      action,
      resourceId,
    );

    // 5. Retry with x-step-up-token
    return requestFn({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'x-step-up-token': stepUpToken,
    });
  }

  return result;
}

// ── Helper: build standard headers ────────────────────────────────

export interface ApiHeaders {
  'Content-Type': string;
  Authorization?: string;
  'x-step-up-token'?: string;
}

export function buildHeaders(accessToken?: string): ApiHeaders {
  const headers: ApiHeaders = { 'Content-Type': 'application/json' };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  const stored = getStepUpToken();
  if (stored) {
    headers['x-step-up-token'] = stored;
  }
  return headers;
}
