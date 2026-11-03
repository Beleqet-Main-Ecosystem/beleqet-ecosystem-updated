import { expect, test, type Page } from '@playwright/test';

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api/v1';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const PAGES = ['dashboard', 'reports', 'companies', 'disputes', 'payments', 'listings', 'users', 'messages', 'broadcast', 'plans', 'subscriptions', 'fraud', 'audit', 'emails'];

test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Set ADMIN_EMAIL and ADMIN_PASSWORD to run the admin tests');

/** A fresh job-seeker account made through the public sign-up. */
async function signUp(page: Page, tag: string) {
  const email = `e2e.admin-${tag}.${Date.now()}@beleqet.demo`;
  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: { email, password: 'Password123!', firstName: 'Target', lastName: tag, role: 'JOB_SEEKER' },
  });
  expect(response.ok()).toBeTruthy();
  return email;
}

/** Deletes a test account through the admin API, so test runs leave nothing behind. */
async function removeAccount(page: Page, email: string) {
  const login = await page.request.post(`${API_URL}/auth/login`, { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  const headers = { Authorization: `Bearer ${(await login.json()).accessToken}` };
  const found = await page.request.get(`${API_URL}/admin/users?search=${encodeURIComponent(email)}`, { headers });
  for (const user of (await found.json()).data ?? []) await page.request.delete(`${API_URL}/admin/users/${user.id}`, { headers });
}

async function signIn(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  if (email === ADMIN_EMAIL) await expect(page).toHaveURL(/dashboard/);
}

test('sign-up refuses the admin role', async ({ page }) => {
  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: { email: `e2e.admin-escalate.${Date.now()}@beleqet.demo`, password: 'Password123!', firstName: 'No', lastName: 'Admin', role: 'ADMIN' },
  });
  expect(response.status()).toBe(400);
});

test('a non-admin account cannot sign in here', async ({ page }) => {
  const email = await signUp(page, 'seeker');
  await signIn(page, email, 'Password123!');
  await expect(page.getByText("This account isn't an administrator.")).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('every page opens without errors, on desktop and on a phone', async ({ page }) => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  page.on('response', (r) => r.url().startsWith(API_URL) && r.status() >= 500 && failures.push(`${r.status()} ${r.url()}`));

  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    for (const name of PAGES) {
      await page.goto(`/${name}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Loading…')).toHaveCount(0, { timeout: 15_000 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${name} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
  expect(failures).toEqual([]);
});

test('old admin addresses still work', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin/manual-payments');
  await expect(page).toHaveURL(/\/payments$/);
});

test('role changes, suspension and deletion all ask first', async ({ page }) => {
  const email = await signUp(page, 'target');
  await signIn(page);
  await page.goto('/users');
  await page.getByPlaceholder('Search by name or email').fill(email);
  const row = page.locator(`[data-user="${email}"]`);
  await expect(row).toBeVisible();

  await row.getByRole('combobox').selectOption('ADMIN');
  await expect(page.getByRole('alertdialog')).toContainText('administrator');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(row.getByRole('combobox')).toHaveValue('JOB_SEEKER');

  await row.getByRole('combobox').selectOption('EMPLOYER');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Change role' }).click();
  await expect(page.getByRole('status')).toContainText('is now Employer');

  await row.getByRole('button', { name: 'Suspend' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Suspend' }).click();
  await expect(row.getByText('Suspended').first()).toBeVisible();
  await row.getByRole('button', { name: 'Reactivate' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivate' }).click();

  await row.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('status')).toContainText('Account deleted');
});

test('your own row cannot be demoted, suspended or deleted', async ({ page }) => {
  await signIn(page);
  await page.goto('/users');
  await page.getByPlaceholder('Search by name or email').fill(ADMIN_EMAIL);
  const mine = page.locator(`[data-user="${ADMIN_EMAIL}"]`);
  await expect(mine.getByText('You', { exact: true })).toBeVisible();
  await expect(mine.getByRole('combobox')).toBeDisabled();
  await expect(mine.getByRole('button', { name: 'Suspend' })).toBeDisabled();
  await expect(mine.getByRole('button', { name: 'Delete' })).toBeDisabled();
});
