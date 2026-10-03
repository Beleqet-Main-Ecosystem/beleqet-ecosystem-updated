/**
 * E2E — Step-Up Authentication (API-level) + Admin Login UI (browser-level)
 *
 * Step-up flow (backend):
 *   1. POST /auth/register          → access token
 *   2. POST /auth/2fa/enroll        → { secret, enrollmentToken }
 *   3. POST /auth/2fa/confirm       → activates 2FA
 *   4. POST /auth/2fa/challenge     → { stepUpToken }  (challenge JWT, purpose=2fa_step_up_challenge)
 *   5. POST /auth/2fa/step-up       → { stepUpToken }  (verified JWT, purpose=2fa_step_up)
 *
 * These tests prove the *real HTTP layer* — no mocks.
 */
import { test, expect } from '@playwright/test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const speakeasy = require('speakeasy') as {
  totp: (opts: { secret: string; encoding: string }) => string;
};

const API = 'http://127.0.0.1:4000/api/v1';

// ── Types ───────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  password: string;
  accessToken: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

function randomEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
}

function generateTOTP(secret: string): string {
  return speakeasy.totp({ secret, encoding: 'base32' });
}

async function registerUser(email: string, password: string): Promise<User> {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName: 'Test', lastName: 'User' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Register failed: ${JSON.stringify(data)}`);
  return { id: data.user?.id, email, password, accessToken: data.accessToken };
}

async function enroll2FA(
  accessToken: string,
): Promise<{ secret: string; enrollmentToken: string; provisioningUri: string }> {
  const res = await fetch(`${API}/auth/2fa/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Enroll failed: ${JSON.stringify(data)}`);
  return data;
}

async function confirm2FA(
  accessToken: string,
  enrollmentToken: string,
  code: string,
): Promise<void> {
  const res = await fetch(`${API}/auth/2fa/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ enrollmentToken, code }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Confirm 2FA failed: ${JSON.stringify(data)}`);
  }
}

/** Request a step-up challenge token (purpose=2fa_step_up_challenge). */
async function requestChallenge(accessToken: string): Promise<string> {
  const res = await fetch(`${API}/auth/2fa/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ action: 'sensitive_action' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Challenge failed: ${JSON.stringify(data)}`);
  return data.stepUpToken;
}

/** Exchange a challenge token + TOTP code for a verified step-up token. */
async function completeStepUp(challengeToken: string, code: string): Promise<string> {
  const res = await fetch(`${API}/auth/2fa/step-up`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepUpToken: challengeToken, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Step-up failed: ${JSON.stringify(data)}`);
  return data.stepUpToken;
}

/** Wait until the start of the next 30-second TOTP window (+2s buffer). */
async function waitForNextTotpWindow(): Promise<void> {
  const secsUntilNext = 30 - (Math.floor(Date.now() / 1000) % 30) + 2;
  await new Promise((r) => setTimeout(r, secsUntilNext * 1000));
}

// ── Suite 1: 2FA enrollment & step-up token full flow ──────────────

test.describe('Step-Up Auth — API integration (2FA enrolled)', () => {
  let user: User;
  let secret: string;

  test.beforeAll(async () => {
    user = await registerUser(randomEmail(), 'Password123!');
    const enrollment = await enroll2FA(user.accessToken);
    secret = enrollment.secret;
    const code = generateTOTP(secret);
    await confirm2FA(user.accessToken, enrollment.enrollmentToken, code);
    // Wait for the enroll code's TOTP window to expire (avoids replay rejection)
    await waitForNextTotpWindow();
  });

  test('POST /auth/2fa/challenge returns a stepUpToken (challenge JWT)', async () => {
    const challengeToken = await requestChallenge(user.accessToken);
    expect(typeof challengeToken).toBe('string');
    expect(challengeToken.length).toBeGreaterThan(20);
  });

  test('POST /auth/2fa/step-up with valid TOTP returns a verified stepUpToken', async () => {
    const challengeToken = await requestChallenge(user.accessToken);
    await waitForNextTotpWindow();
    const code = generateTOTP(secret);
    const verifiedToken = await completeStepUp(challengeToken, code);
    expect(typeof verifiedToken).toBe('string');
    expect(verifiedToken.length).toBeGreaterThan(20);
  });

  test('POST /auth/2fa/step-up with wrong TOTP code returns 401', async () => {
    const challengeToken = await requestChallenge(user.accessToken);
    const res = await fetch(`${API}/auth/2fa/step-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepUpToken: challengeToken, code: '000000' }),
    });
    expect(res.status).toBe(401);
  });

  test('POST /auth/2fa/step-up with an invalid challenge token returns 401', async () => {
    const res = await fetch(`${API}/auth/2fa/step-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepUpToken: 'not-a-valid-jwt', code: '123456' }),
    });
    expect(res.status).toBe(401);
  });

  test('Sensitive endpoint (wallet withdraw) blocked without x-step-up-token header', async () => {
    // Without a step-up token the StepUpGuard should return 401 or 403 for 2FA-enrolled users
    const res = await fetch(`${API}/wallet/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
      body: JSON.stringify({ amount: 100, currency: 'ETB', method: 'CHAPA', accountRef: '0912345678' }),
    });
    expect([401, 403]).toContain(res.status);
  });

  test('Sensitive endpoint passes step-up guard when verified token provided', async () => {
    test.setTimeout(180_000); // two TOTP window waits (~32s each) + request overhead
    await waitForNextTotpWindow();
    const challengeToken = await requestChallenge(user.accessToken);
    await waitForNextTotpWindow();
    const code = generateTOTP(secret);
    const verifiedStepUpToken = await completeStepUp(challengeToken, code);

    // Provide the verified step-up token — guard passes, business logic runs
    const res = await fetch(`${API}/wallet/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.accessToken}`,
        'x-step-up-token': verifiedStepUpToken,
      },
      body: JSON.stringify({ amount: 100, currency: 'ETB', method: 'CHAPA', accountRef: '0912345678' }),
    });
    // Step-up guard passes → business layer error (empty wallet) = 400/404/422, NOT 401/403
    expect([200, 201, 400, 404, 422]).toContain(res.status);
    expect([401, 403]).not.toContain(res.status);
  });

});

// ── Suite 2: No 2FA enrolled → guard bypassed ──────────────────────

test.describe('Step-Up Auth — API integration (no 2FA)', () => {
  let user: User;

  test.beforeAll(async () => {
    user = await registerUser(randomEmail(), 'Password123!');
  });

  test('POST /auth/2fa/challenge still returns a token for users without 2FA', async () => {
    // The challenge endpoint issues a JWT regardless of 2FA enrollment status.
    // Enrollment check happens at /auth/2fa/step-up when the TOTP code is verified.
    const res = await fetch(`${API}/auth/2fa/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
      body: JSON.stringify({ action: 'sensitive_action' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.stepUpToken).toBe('string');
  });

  test('Sensitive endpoint allows through without step-up when 2FA is not enrolled', async () => {
    const res = await fetch(`${API}/wallet/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
      body: JSON.stringify({ amount: 50, currency: 'ETB', method: 'CHAPA', accountRef: '0912345678' }),
    });
    // Guard bypassed (no 2FA) → business layer error (empty wallet) = 400/404/422
    expect([200, 201, 400, 404, 422]).toContain(res.status);
    expect([401, 403]).not.toContain(res.status);
  });
});

// ── Suite 3: Admin login UI (browser) ──────────────────────────────

test.describe('Admin login UI — browser flow', () => {
  test('Login page has email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Invalid credentials show an error, do not redirect', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', `nonexistent_${randomEmail()}`);
    await page.fill('input[type="password"]', 'WrongPass999!');
    await page.click('button[type="submit"]');
    // Should surface an error message (not navigate away)
    await expect(page.locator('text=/invalid|incorrect|wrong|error|unauthorized/i')).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/login/);
  });

  test('Valid credentials redirect to /admin/dashboard', async ({ page }) => {
    const email = randomEmail();
    // Register via API so we have valid credentials
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'Password123!', firstName: 'E2E', lastName: 'User', role: 'ADMIN' }),
    });
    if (!res.ok) throw new Error(`Register failed: ${await res.text()}`);

    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 20000 });
    await expect(page).toHaveURL(/admin\/dashboard/);
  });
});
