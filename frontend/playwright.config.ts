import { defineConfig } from '@playwright/test';

/**
 * Runs against a live API. Needs an admin account: ADMIN_EMAIL / ADMIN_PASSWORD
 * (CI creates one with create-admin.js). API_URL defaults to the local API.
 */
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api/v1';
const PORT = Number(process.env.PORT ?? 3002);

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  use: { baseURL: process.env.BASE_URL ?? `http://127.0.0.1:${PORT}`, headless: true,
    viewport: { width: 1280, height: 800 },
    // PW_CHANNEL=chrome uses the installed Chrome instead of a downloaded Chromium.
    channel: process.env.PW_CHANNEL || undefined,
  },
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${PORT}`,
        url: `http://127.0.0.1:${PORT}/login`,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { NEXT_PUBLIC_API_URL: API_URL },
      },
});
