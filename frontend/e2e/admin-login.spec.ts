import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:4000/api/v1';

function randomEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
}

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
