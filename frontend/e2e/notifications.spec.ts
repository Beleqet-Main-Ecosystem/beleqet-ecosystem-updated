import { test, expect } from '@playwright/test';

const API = 'http://127.0.0.1:4000/api/v1';

interface User {
  id: string;
  email: string;
  password: string;
  accessToken: string;
}

function randomEmail(): string {
  return `test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
}

async function registerUser(email: string, password: string): Promise<User> {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName: 'Notify', lastName: 'Tester' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Register failed: ${data.message}`);
  return { id: data.user?.id, email, password, accessToken: data.accessToken || data.access_token };
}

async function createNotification(accessToken: string, title: string, body: string): Promise<void> {
  const res = await fetch(`${API}/admin/notifications/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ title, body }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    // Non-admin users can't broadcast; seed via the DB or ignore
    console.warn('Broadcast failed (expected for non-admin):', data.message);
  }
}

async function loginAsAdmin(): Promise<User | null> {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@beleqet.com', password: 'Admin123!' }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.user?.id, email: 'admin@beleqet.com', password: 'Admin123!', accessToken: data.accessToken || data.access_token };
  } catch {
    return null;
  }
}

async function loginAsUser(user: User): Promise<void> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  const data = await res.json();
  user.accessToken = data.accessToken || data.access_token;
}

// ── Tests ──────────────────────────────────────────────────────────

test.describe('Notification Bell dropdown', () => {
  let user: User;

  test.beforeEach(async ({ page }) => {
    user = await registerUser(randomEmail(), 'Password123!');
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  });

  test('Notification bell is visible in the sidebar', async ({ page }) => {
    const bell = page.locator('.notif-bell-btn');
    await expect(bell).toBeVisible();
  });

  test('Bell shows no badge when there are no notifications', async ({ page }) => {
    const badge = page.locator('.notif-bell-badge');
    await expect(badge).not.toBeVisible();
  });

  test('Clicking bell opens the dropdown panel', async ({ page }) => {
    await page.click('.notif-bell-btn');
    const dropdown = page.locator('.notif-dropdown');
    await expect(dropdown).toBeVisible();
    await expect(page.locator('.notif-dropdown-title')).toHaveText('Notifications');
  });

  test('Dropdown shows empty state when no notifications exist', async ({ page }) => {
    await page.click('.notif-bell-btn');
    await expect(page.locator('.notif-dropdown-empty')).toBeVisible();
    await expect(page.locator('.notif-dropdown-empty')).toHaveText('No notifications yet');
  });

  test('Clicking outside closes the dropdown', async ({ page }) => {
    await page.click('.notif-bell-btn');
    await expect(page.locator('.notif-dropdown')).toBeVisible();
    await page.click('.page-header-title');
    await expect(page.locator('.notif-dropdown')).not.toBeVisible();
  });
});

test.describe('Notifications full page', () => {
  let user: User;

  test.beforeEach(async ({ page }) => {
    user = await registerUser(randomEmail(), 'Password123!');
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  });

  test('Navigating to notifications page via sidebar', async ({ page }) => {
    await page.click('a[href="/admin/notifications"]');
    await expect(page).toHaveURL(/.*\/admin\/notifications/);
    await expect(page.locator('.page-header-title')).toHaveText('Notifications');
  });

  test('Notifications page shows empty state when no notifications', async ({ page }) => {
    await page.goto('/admin/notifications');
    await expect(page.locator('.notif-empty-state')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.notif-empty-state h3')).toHaveText('No notifications');
  });

  test('Notifications page shows unread count in subtitle when empty', async ({ page }) => {
    await page.goto('/admin/notifications');
    await expect(page.locator('.page-header-subtitle')).toHaveText('All caught up', { timeout: 10000 });
  });
});

test.describe('Notification Settings page', () => {
  let user: User;

  test.beforeEach(async ({ page }) => {
    user = await registerUser(randomEmail(), 'Password123!');
    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });
  });

  test('Navigating to notification settings via sidebar', async ({ page }) => {
    await page.click('a[href="/admin/settings/notifications"]');
    await expect(page).toHaveURL(/.*\/admin\/settings\/notifications/);
    await expect(page.locator('.page-header-title')).toHaveText('Notification Settings');
  });

  test('Settings page shows all channel toggles', async ({ page }) => {
    await page.goto('/admin/settings/notifications');
    await expect(page.locator('.notif-channel-label').nth(0)).toHaveText('In-App Notifications', { timeout: 10000 });
    await expect(page.locator('.notif-channel-label').nth(1)).toHaveText('Email Notifications');
    await expect(page.locator('.notif-channel-label').nth(2)).toHaveText('Telegram Notifications');
    await expect(page.locator('.notif-channel-label').nth(3)).toHaveText('Push Notifications');
    await expect(page.locator('.notif-channel-label').nth(4)).toHaveText('SMS Notifications');
  });

  test('Toggling a channel switch updates its visual state', async ({ page }) => {
    await page.goto('/admin/settings/notifications');
    // Wait for preferences to load
    await page.waitForSelector('.notif-toggle', { timeout: 10000 });

    const firstToggle = page.locator('.notif-toggle').first();
    const initialState = await firstToggle.evaluate((el) => el.classList.contains('notif-toggle--on'));

    await firstToggle.click();

    const newState = await firstToggle.evaluate((el) => el.classList.contains('notif-toggle--on'));
    expect(newState).toBe(!initialState);
  });

  test('Language selector shows English and Amharic options', async ({ page }) => {
    await page.goto('/admin/settings/notifications');
    await expect(page.locator('.notif-lang-btn').nth(0)).toHaveText('English', { timeout: 10000 });
    await expect(page.locator('.notif-lang-btn').nth(1)).toHaveText('Amharic');
  });

  test('Save button is visible and clickable', async ({ page }) => {
    await page.goto('/admin/settings/notifications');
    const saveBtn = page.locator('button:has-text("Save changes")');
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await expect(saveBtn).toBeEnabled();
  });
});

test.describe('Admin broadcast creates notification visible to user', () => {
  let admin: User | null;
  let regularUser: User;

  test.beforeEach(async () => {
    admin = await loginAsAdmin();
    regularUser = await registerUser(randomEmail(), 'Password123!');
  });

  test('Notification created by admin broadcast appears in user bell', async ({ page }) => {
    if (!admin) {
      test.skip();
      return;
    }

    // Broadcast a notification to all users
    await createNotification(admin.accessToken, 'Test Broadcast', 'This is a test notification from admin');

    // Log in as regular user
    await page.goto('/login');
    await page.fill('input[type="email"]', regularUser.email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/dashboard', { timeout: 10000 });

    // Open bell and check for the notification
    await page.click('.notif-bell-btn');
    await expect(page.locator('.notif-dropdown')).toBeVisible();

    // Wait for polling to pick up the notification (up to 20s)
    await expect(page.locator('.notif-item-title').first()).toHaveText('Test Broadcast', { timeout: 20000 });
  });
});
