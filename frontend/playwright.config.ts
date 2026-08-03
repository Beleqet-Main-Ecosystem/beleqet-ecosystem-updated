import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'notifications.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: 'npx next dev -p 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    cwd: __dirname,
    timeout: 60000,
  },
});
