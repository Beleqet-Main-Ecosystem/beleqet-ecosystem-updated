// e2e/auth.spec.ts

import { test, expect } from '@playwright/test';

/**
 * End-to-End test suite for Authentication flows.
 * @group e2e
 * @description Simulates real browser user journeys.
 */
test.describe('Authentication Flow', () => {
  /**
   * Test case: Successful login.
   * Verifies redirection and presence of user dashboard.
   */
  test('should login and redirect to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@beleqet.com');
    await page.fill('input[name="password"]', 'validPassword123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('.user-name')).toContainText('John');
  });

  /**
   * Test case: Input validation.
   * Ensures invalid email triggers error messages (class-validator on frontend/backend).
   */
  test('should show validation errors for invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button[type="submit"]');
    await expect(page.locator('.error-message')).toBeVisible();
  });
});