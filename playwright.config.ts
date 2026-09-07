import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3000/ergogen-gui/';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'list' : 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm exec vite preview --host 127.0.0.1 --port 3000 --strictPort',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
