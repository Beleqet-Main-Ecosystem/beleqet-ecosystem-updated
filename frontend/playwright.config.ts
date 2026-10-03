import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3002',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chrome',
      use: {
        // Use the system-installed Google Chrome to avoid downloading browser binaries
        channel: 'chrome',
      },
    },
  ],
  webServer: {
    command: 'npx next dev -p 3002',
    url: 'http://127.0.0.1:3002',
    reuseExistingServer: true,
    cwd: __dirname,
    timeout: 60000,
  },
});
