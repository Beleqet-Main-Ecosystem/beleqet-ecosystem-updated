import { expect, test } from '@playwright/test';

const testUser = {
  email: 'e2e+resume@beleqet.test',
  password: 'E2eTest123!',
  firstName: 'E2E',
  lastName: 'Resume',
  role: 'JOB_SEEKER',
};

const resumePath = './e2e/fixtures/sample-resume.pdf';

test.describe('Resume Brain flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('First name').fill(testUser.firstName);
    await page.getByLabel('Last name').fill(testUser.lastName);
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill(testUser.password);
    await page.getByRole('button', { name: /create account|register/i }).click();
    await expect(page).toHaveURL(/.*profile/);
  });

  test('uploads and confirms a resume through Resume Brain', async ({ page }) => {
    await page.goto('/resume-brain');
    await expect(page.locator('text=Resume Brain')).toBeVisible();

    const fileInput = page.locator('input[type=file]');
    await expect(fileInput).toHaveCount(1);
    await fileInput.setInputFiles(resumePath);

    await page.getByRole('checkbox', { name: /consent/i }).check();
    await page.getByRole('button', { name: /upload/i }).click();

    await expect(page.locator('text=parsed successfully')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /confirm & autofill profile/i }).click();

    await expect(page.locator('text=Profile updated successfully.')).toBeVisible({
      timeout: 20000,
    });
  });
});
