import { test, expect } from '@playwright/test';

const API = 'http://localhost:4000/api/v1';

interface User {
  id: string;
  email: string;
  password: string;
  accessToken: string;
}

interface EnrollmentData {
  provisioningUri: string;
  enrollmentToken: string;
  secret: string;
}

// ── Helpers ────────────────────────────────────────────────────────

async function registerUser(email: string, password: string): Promise<User> {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName: 'Test', lastName: 'User' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Register failed: ${data.message}`);
  return { id: data.user?.id, email, password, accessToken: data.accessToken };
}

async function enroll2FA(user: User): Promise<EnrollmentData> {
  const res = await fetch(`${API}/auth/2fa/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Enroll failed: ${data.message}`);
  return data;
}

async function confirm2FA(user: User, enrollmentToken: string, code: string): Promise<void> {
  const res = await fetch(`${API}/auth/2fa/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.accessToken}` },
    body: JSON.stringify({ enrollmentToken, code }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Confirm 2FA failed: ${data.message}`);
  }
}

import * as otplib from 'otplib';
const totpGenerate = (otplib as any).default?.generate || otplib.generate;

async function getTOTP(secret: string, epochOffset = 0): Promise<string> {
  return totpGenerate({ secret, epoch: Math.floor(Date.now() / 1000) + epochOffset });
}

function randomEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
}

async function createWallet(user: User): Promise<void> {
  const res = await fetch(`${API}/wallet`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`Create wallet failed: ${data.message}`);
  }
}

// ── Tests ──────────────────────────────────────────────────────────

test.describe('Sensitive action flows with 2FA step-up', () => {
  let user: User;
  let secret: string;

  test.beforeEach(async () => {
    user = await registerUser(randomEmail(), 'Password123!');
    const enrollment = await enroll2FA(user);
    secret = enrollment.secret;
    const confirmCode = await getTOTP(secret);
    await confirm2FA(user, enrollment.enrollmentToken, confirmCode);
    // Wait for the TOTP time-step to roll over so the next generated code
    // is in a different 30-second window, avoiding Redis replay detection.
    await new Promise((r) => setTimeout(r, 31000));
  });

  async function fillStepUpCode(page: any, secret: string) {
    const code = await getTOTP(secret);
    const digitInputs = page.locator('input[aria-label^="Digit"]');
    const digits = code.split('');
    for (let i = 0; i < digits.length; i++) {
      await digitInputs.nth(i).fill(digits[i]);
    }
  }

  test('Wallet withdrawal — step-up modal appears', async ({ page }) => {
    await createWallet(user);

    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('accessToken', token), user.accessToken);
    await page.reload();

    await page.click('button:has-text("Wallet")');
    await page.fill('input[type="number"]', '100');
    await page.locator('select').selectOption('CHAPA');
    await page.fill('input[placeholder="Phone number or account ID"]', '0911000000');
    await page.click('button:has-text("Withdraw")');

    await expect(page.locator('text=Confirm Withdrawal')).toBeVisible({ timeout: 15000 });

    await fillStepUpCode(page, secret);

    await page.click('button:has-text("Verify")');
  });

  test('Password change — step-up modal appears, verify, and retry succeeds', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('accessToken', token), user.accessToken);
    await page.reload();

    await page.click('button:has-text("Password")');

    const pwInputs = page.locator('input[type="password"]');
    await pwInputs.nth(0).fill('Password123!');
    await pwInputs.nth(1).fill('NewPassword456!');
    await pwInputs.nth(2).fill('NewPassword456!');
    await page.click('button:has-text("Change Password")');

    await expect(page.locator('text=Confirm Password Change')).toBeVisible({ timeout: 15000 });

    await fillStepUpCode(page, secret);

    await page.click('button:has-text("Verify")');

    await expect(page.locator('text=Password changed successfully')).toBeVisible({ timeout: 10000 });
  });

  test('Email change — step-up modal appears, verify, and retry succeeds', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('accessToken', token), user.accessToken);
    await page.reload();

    await page.click('button:has-text("Email")');

    await page.fill('input[type="password"]', 'Password123!');
    await page.fill('input[type="email"]', `new_${randomEmail()}`);
    await page.click('button:has-text("Change Email")');

    await expect(page.locator('text=Confirm Email Change')).toBeVisible({ timeout: 15000 });

    await fillStepUpCode(page, secret);

    await page.click('button:has-text("Verify")');

    await expect(page.locator('text=check your inbox')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Sensitive action flows WITHOUT 2FA — no step-up', () => {
  let user: User;

  test.beforeEach(async () => {
    user = await registerUser(randomEmail(), 'Password123!');
  });

  test('Wallet withdrawal — no step-up prompt (2FA not enabled)', async ({ page }) => {
    await createWallet(user);

    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('accessToken', token), user.accessToken);
    await page.reload();

    await page.click('button:has-text("Wallet")');
    await page.fill('input[type="number"]', '50');
    await page.locator('select').selectOption('CHAPA');
    await page.fill('input[placeholder="Phone number or account ID"]', '0911000000');
    await page.click('button:has-text("Withdraw")');

    // StepUpGuard now checks whether 2FA is enabled — since this user
    // has no 2FA, the guard passes and the withdrawal fails on balance.
    await expect(page.locator('text=Confirm Withdrawal')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Insufficient available')).toBeVisible({ timeout: 10000 });
  });

  test('Password change — no step-up prompt', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('accessToken', token), user.accessToken);
    await page.reload();

    await page.click('button:has-text("Password")');
    const pwInputs2 = page.locator('input[type="password"]');
    await pwInputs2.nth(0).fill('Password123!');
    await pwInputs2.nth(1).fill('NewPassword789!');
    await pwInputs2.nth(2).fill('NewPassword789!');
    await page.click('button:has-text("Change Password")');

    await expect(page.locator('text=Confirm Password Change')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Password changed successfully')).toBeVisible({ timeout: 10000 });
  });

  test('Email change — no step-up prompt', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((token) => localStorage.setItem('accessToken', token), user.accessToken);
    await page.reload();

    await page.click('button:has-text("Email")');
    await page.fill('input[type="password"]', 'Password123!');
    await page.fill('input[type="email"]', `new_${randomEmail()}`);
    await page.click('button:has-text("Change Email")');

    await expect(page.locator('text=Confirm Email Change')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=verification link')).toBeVisible({ timeout: 10000 });
  });
});
