import { expect, test } from '@playwright/test';
import { createDraft, readSource, studio } from './utils/studio';
import { MULTI_CONFIG_STORAGE_KEY } from '../src/context/constants';

test('opens native Board Studio on a fresh root route', async ({ page }) => {
  await page.goto('./');
  await createDraft(page);
  await expect(page).toHaveURL(/.*\/$/);
});

test('opens native Board Studio directly at /new', async ({ page }) => {
  await page.goto('./new');
  await createDraft(page);
  await expect(page).toHaveURL(/.*\/$/);
});

test('restores a saved native project at the root route', async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 2,
        activeConfigId: 'saved',
        configs: [
          {
            id: 'saved',
            name: 'Saved',
            config: 'schema: ergogen/v1\nlayout: {}',
          },
        ],
      })
    );
  }, MULTI_CONFIG_STORAGE_KEY);
  await page.goto('./');
  await expect(studio(page)).toBeVisible();
  await expect(readSource(page)).resolves.toContain('layout:');
});

test('creates a second project while retaining the first', async ({ page }) => {
  await page.goto('./');
  await createDraft(page);
  const first = await readSource(page);
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await createDraft(page);
  await expect(page).toHaveURL(/.*\/$/);
  await page.reload();
  await expect(studio(page)).toBeVisible();
  expect(await readSource(page)).toBe(first);
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    MULTI_CONFIG_STORAGE_KEY
  );
  expect(saved.configs).toHaveLength(2);
  expect(
    new Set(saved.configs.map((item: { id: string }) => item.id)).size
  ).toBe(2);
});

test('keeps legacy points sources in the legacy editor', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ergogen:config', JSON.stringify('points: {}'));
  });
  await page.goto('./');
  await expect(page.getByTestId('config-editor')).toBeVisible();
});

test('loads examples from /import into native Studio', async ({ page }) => {
  await page.goto('./import');
  await page.getByText('Starter', { exact: true }).click();
  await expect(page).toHaveURL(/.*\/$/);
  await expect(studio(page)).toBeVisible();
});
