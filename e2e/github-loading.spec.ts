import { studio, openLibrary } from './utils/studio';
import { test, expect } from '@playwright/test';
import { makeShooter } from './utils/screenshots';
import { mockGitHubNetworkRequests } from './utils/githubMocks';

test.describe('GitHub Loading', () => {
  test.beforeEach(async ({ page }) => {
    await mockGitHubNetworkRequests(page);
  });
  test('should load config and footprints from ceoloide/mr_useful', async ({
    page,
  }) => {
    const shoot = makeShooter(page, test.info());

    // Listen for console logs to verify our instrumentation
    const logs: string[] = [];
    const rateLimitLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('[GitHub]')) {
        logs.push(text);
      }
      if (text.startsWith('[GitHub Rate Limit]')) {
        rateLimitLogs.push(text);
        console.log(text); // Also output rate limit info
      }
    });

    // Navigate to the welcome page
    await page.goto('./import');
    await shoot('before-github-input');

    // Find the GitHub input and load button
    const githubInput = page.getByTestId('repo-input');
    const loadButton = page.getByTestId('repo-load-button');

    // Enter the repository URL
    await githubInput.fill('ceoloide/mr_useful');
    await shoot('after-github-input-filled');

    // Hold the response while checking loading feedback; fast mocks can finish first.
    let releaseConfig!: () => void;
    const configPending = new Promise<void>((resolve) => {
      releaseConfig = resolve;
    });
    await page.route(
      /raw\.githubusercontent\.com\/.*mr_useful.*config\.ya?ml$/,
      async (route) => {
        await configPending;
        await route.fallback();
      }
    );
    await loadButton.click();
    await shoot('after-load-button-clicked');

    // Verify loading bar appears during GitHub loading
    const loadingBar = page.getByTestId('loading-bar');
    await expect(loadingBar).toBeVisible({ timeout: 5000 });
    await shoot('loading-bar-visible');
    releaseConfig();

    // Wait for the config to be loaded (should navigate to home)
    await expect(page).toHaveURL(/.*\/$/, { timeout: 30000 });
    await shoot('after-navigation-to-home');

    // Verify config editor is visible
    await expect(studio(page)).toBeVisible({
      timeout: 10000,
    });
    await shoot('config-editor-visible');

    await openLibrary(page);
    const library = studio(page);
    await expect(
      library.getByRole('button', {
        name: 'ceoloide/logo_mr_useful · Project',
        exact: true,
      })
    ).toBeVisible();
    await shoot('footprints-loaded');
  });

  test.skip('should load config with URL parameter and footprints', async ({
    page,
  }) => {
    const shoot = makeShooter(page, test.info());

    // Listen for console logs
    const logs: string[] = [];
    const rateLimitLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('[GitHub]')) {
        logs.push(text);
        console.log(text);
      }
      if (text.startsWith('[GitHub Rate Limit]')) {
        rateLimitLogs.push(text);
        console.log(text);
      }
    });

    // Navigate directly with the github URL parameter
    await page.goto('./?github=ceoloide/mr_useful');
    await shoot('loaded-with-url-param');

    // Wait for config to be loaded and editor to be visible
    await expect(studio(page)).toBeVisible({
      timeout: 5000,
    });
    await shoot('config-editor-visible-url-param');

    // Wait for logs
    await page.waitForTimeout(2000);

    // Verify GitHub activity in logs
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((log) => log.includes('Starting fetch'))).toBe(true);
    expect(logs.some((log) => log.includes('Loaded footprint'))).toBe(true);

    // Open settings to verify footprints
    const settingsButton = page.getByTestId('settings-button');
    await settingsButton.click();
    await shoot('settings-opened-url-param');

    await expect(page.getByTestId('injections-container')).toBeVisible({
      timeout: 5000,
    });

    const footprintRows = page.locator(
      '[data-testid^="injections-container-"]'
    );
    const count = await footprintRows.count();

    console.log(`Found ${count} footprint(s) from URL param`);
    expect(count).toBeGreaterThan(0);
    await shoot('footprints-loaded-url-param');

    console.log('\n=== All GitHub Logs (URL Param) ===');
    logs.forEach((log) => console.log(log));
    console.log('=== End GitHub Logs ===\n');

    // Output rate limit logs if any
    if (rateLimitLogs.length > 0) {
      console.log('\n=== Rate Limit Logs (URL Param) ===');
      rateLimitLogs.forEach((log) => console.log(log));
      console.log('=== End Rate Limit Logs ===\n');
    }
  });

  test('should accumulate footprints from sequential loads and reset conflict dialog', async ({
    page,
  }) => {
    const shoot = makeShooter(page, test.info());
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.startsWith('[GitHub Rate Limit]')) {
        console.log(text);
      }
    });

    // Navigate to the welcome page
    await page.goto('./import');

    // Find the GitHub input and load button
    const githubInput = page.getByTestId('repo-input');
    const loadButton = page.getByTestId('repo-load-button');

    // Load first repository
    await githubInput.fill(
      'https://github.com/unspecworks/gamma-omega/blob/main/original/ergogen/config.yaml'
    );
    await loadButton.click();
    await shoot('first-repo-loading');

    // Wait for the config to be loaded
    await expect(page).toHaveURL(/.*\/$/, { timeout: 30000 });
    await shoot('first-repo-loaded');

    // Wait for config editor to be visible
    await expect(studio(page)).toBeVisible({
      timeout: 10000,
    });

    await openLibrary(page);
    const library = studio(page);
    await expect(
      library.getByRole('button', {
        name: 'unspecworks/pico_oneside · Project',
        exact: true,
      })
    ).toBeVisible();
    await shoot('unspecworks-footprint-present');
    await library
      .getByRole('button', { name: 'Back to design', exact: true })
      .click();

    // Navigate back to welcome page
    const newConfigButton = page.getByRole('button', {
      name: 'Import',
      exact: true,
    });
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await newConfigButton.click();
    await expect(page).toHaveURL(/.*\/import/, { timeout: 5000 });
    await shoot('back-to-welcome');

    // Load second repository
    await githubInput.fill('ceoloide/mr_useful');
    await loadButton.click();
    await shoot('second-repo-loading');

    await expect(page.getByTestId('conflict-dialog-box')).toBeVisible();
    await page.getByTestId('conflict-dialog-skip').click();

    await expect(page).toHaveURL(/.*\/$/, { timeout: 10000 });
    await shoot('second-repo-loaded');

    await openLibrary(page);
    await expect(
      library.getByRole('button', {
        name: 'ceoloide/logo_mr_useful · Project',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      library.getByRole('button', {
        name: 'unspecworks/pico_oneside · Project',
        exact: true,
      })
    ).toBeVisible();
    await library
      .getByRole('button', { name: 'Back to design', exact: true })
      .click();

    // Reload an existing footprint to exercise conflict choices and reset.
    await page.route('**/mr_useful_footprints/**/logo_mr_useful.js', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: 'module.exports = { params: { designator: "UPDATED" }, body: "" };',
      })
    );
    for (const choice of ['skip', 'overwrite']) {
      await page.getByRole('button', { name: 'Projects', exact: true }).click();
      await newConfigButton.click();
      await githubInput.fill('ceoloide/mr_useful');
      await loadButton.click();
      const conflict = page.getByTestId('conflict-dialog-box');
      await expect(conflict).toBeVisible();
      const applyToAll = page.getByTestId('conflict-dialog-apply-to-all');
      await expect(applyToAll).not.toBeChecked();
      await conflict.locator('[role="checkbox"]').click();
      await expect(applyToAll).toBeChecked();
      await page.getByTestId(`conflict-dialog-${choice}`).click();
      await expect(conflict).toBeHidden();
      await expect(page).toHaveURL(/.*\/$/);
    }
  });
});
