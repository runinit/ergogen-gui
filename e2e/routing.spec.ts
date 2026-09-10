import { createDraft, openCode, readSource, studio } from './utils/studio';
import { test, expect } from '@playwright/test';
import { makeShooter } from './utils/screenshots';
import Absolem from '../src/examples/starter';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';

test.describe('Routing and Welcome Page', () => {
  test('new user is redirected to /new', async ({ page }) => {
    const shoot = makeShooter(page, test.info());
    await page.goto('./');
    await shoot('before-redirect-to-new');
    await expect(page).toHaveURL(/.*\/new/);
    await expect(page.getByText('Ergogen Web UI')).toBeVisible();
    await shoot('after-redirect-to-new');
  });

  test('existing user is routed to /', async ({ page }) => {
    const shoot = makeShooter(page, test.info());
    // Simulate existing user by setting a value in local storage
    await page.addInitScript((CONFIG_LOCAL_STORAGE_KEY) => {
      localStorage.setItem(
        CONFIG_LOCAL_STORAGE_KEY,
        JSON.stringify('some config')
      );
    }, CONFIG_LOCAL_STORAGE_KEY);
    await page.goto('./');
    await shoot('before-existing-user-routed-home');
    await expect(page).toHaveURL(/.*\/$/);
    await expect(page.getByTestId('config-editor')).toBeVisible();
    await shoot('after-existing-user-routed-home');
  });

  test('"Add" (new config) button requires existing config', async ({
    page,
  }) => {
    const shoot = makeShooter(page, test.info());
    await page.goto('./');
    // With no config, the "New Design" button should not be visible on the main page
    const btn = page.getByTestId('new-config-button');
    await shoot('before-new-config-btn-not-visible');
    await expect(btn).not.toBeVisible();
    await shoot('after-new-config-btn-not-visible');
  });

  test('"Add" (new config) button navigates to /new', async ({ page }) => {
    const shoot = makeShooter(page, test.info());
    // The header button that starts a new config on the home page
    const newConfigButton = page.getByRole('button', {
      name: 'New',
      exact: true,
    });

    // 1. Set a valid config in local storage
    await page.addInitScript(
      ({ config, key }) => {
        localStorage.setItem(key, JSON.stringify(config));
      },
      { config: Absolem.value, key: CONFIG_LOCAL_STORAGE_KEY }
    );
    await page.goto('./');

    // 2. Now the button should be visible, click it
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await shoot('before-new-config-button-visible');
    await expect(newConfigButton).toBeVisible();
    await shoot('after-new-config-button-visible');
    await newConfigButton.click();

    // 3. Assert navigation to the /new page
    await shoot('before-url-new-and-welcome');
    await expect(page).toHaveURL(/.*\/new/);
    await expect(page.getByText('Ergogen Web UI')).toBeVisible();
    await shoot('after-url-new-and-welcome');
  });

  test('clicking "New native design" creates a native starter and navigates to /', async ({
    page,
  }) => {
    const shoot = makeShooter(page, test.info());
    await page.goto('./new');
    await createDraft(page);
    await openCode(page);
    await shoot('before-empty-config-url-and-editor');
    await expect(page).toHaveURL(/.*\/$/);
    await expect(
      page.getByLabel('Project YAML', { exact: true })
    ).toBeVisible();
    await shoot('after-empty-config-url-and-editor');

    await expect(async () => {
      const editorContent = await page.locator('.monaco-editor').textContent();
      expect(editorContent).toContain('schema:');
    }).toPass();
  });

  test('clicking an example loads the config and navigates to /', async ({
    page,
  }) => {
    const shoot = makeShooter(page, test.info());
    await page.goto('./new');
    await page.getByText(Absolem.label).click();
    await shoot('before-example-url-and-editor');
    await expect(page).toHaveURL(/.*\/$/);
    await openCode(page);
    await shoot('after-example-url-and-editor');

    // Verify the config was stored by checking localStorage rather than Monaco's DOM text,
    // which renders whitespace differently and is flaky to assert on.
    await page.reload();
    await expect(studio(page)).toBeVisible();
    expect(await readSource(page)).toContain('meta:');
    expect(await readSource(page)).toContain('schema:');
  });
});
