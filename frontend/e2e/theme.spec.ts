import { test, expect } from '@playwright/test';

test.describe('Theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('shows the theme toggle button in the sidebar', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /select theme/i });
    await expect(toggle).toBeVisible();
  });

  test('opens the theme dropdown on click', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /select theme/i });
    await toggle.click();

    const listbox = page.getByRole('listbox', { name: /theme/i });
    await expect(listbox).toBeVisible();
  });

  test('switches to dark mode when Dark is selected', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /select theme/i });
    await toggle.click();

    await page.getByRole('option', { name: /dark/i }).click();

    // After clicking, the dark class should be applied to the html element
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('switches back to light mode', async ({ page }) => {
    // First switch to dark
    await page.getByRole('button', { name: /select theme/i }).click();
    await page.getByRole('option', { name: /dark/i }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Then switch to light
    await page.getByRole('button', { name: /select theme/i }).click();
    await page.getByRole('option', { name: /light/i }).click();

    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('closes the dropdown when clicking outside', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /select theme/i });
    await toggle.click();
    await expect(page.getByRole('listbox')).toBeVisible();

    // Click on the sidebar background to close
    await page.locator('.sidebar').first().click({ position: { x: 0, y: 0 } });
    await expect(page.getByRole('listbox')).not.toBeVisible();
  });
});
