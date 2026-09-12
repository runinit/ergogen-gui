import { defineConfig, devices } from '@playwright/test';

const deploymentPath =
  process.env.GITHUB_REPOSITORY === 'runinit/ergogen-gui-preview'
    ? '/ergogen-gui-preview/'
    : '/ergogen-gui/';
process.env.REACT_APP_DEPLOYMENT_CHANNEL =
  process.env.GITHUB_REPOSITORY === 'runinit/ergogen-gui-preview'
    ? 'preview'
    : 'production';
const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
const baseURL = `http://127.0.0.1:${port}${deploymentPath}`;

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
    command: `pnpm exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120 * 1000,
  },
});
