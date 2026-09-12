import { test, expect } from '@playwright/test';
import { createDraft, openCode, readSource } from './utils/studio';

test('creates a matrix draft and previews its PCB', async ({ page }) => {
  await page.goto('./new');
  await createDraft(page);
  await page.getByRole('button', { name: 'Add matrix', exact: true }).click();
  await page.getByLabel('New item name').fill('fingers');
  await page.getByLabel('New matrix columns').fill('5');
  await page.getByLabel('New matrix rows').fill('4');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('group', { name: 'Interactive board layout' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Select fingers_c\d+_r\d+$/ })
  ).toHaveCount(20);
  await openCode(page);
  expect(await readSource(page)).toContain('schema: ergogen/v1');
  await page
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'PCB', exact: true })
    .click();
  await page.getByRole('button', { name: 'KiCad PCB', exact: true }).click();
  await expect(page.locator('kicanvas-embed canvas').first()).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText(/PCB preview unavailable/)).toHaveCount(0);
  await expect(page.locator('kicanvas-source')).toBeHidden();
});
