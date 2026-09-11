import { test, expect } from '@playwright/test';
import { createDraft, openCode } from './utils/studio';

test('switches mobile layout panels and opens YAML', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('./new');
  await createDraft(page);
  await expect(
    page.getByRole('group', { name: 'Interactive board layout' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Objects', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Object tree' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Close objects', exact: true })
    .click();
  await page.getByRole('button', { name: 'Inspector', exact: true }).click();
  await expect(
    page.getByRole('complementary', { name: 'Design inspector' })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await openCode(page);
  await page
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'Export', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Download YAML', exact: true })
  ).toBeVisible();
  await expect(page.getByLabel('Project YAML', { exact: true })).toHaveCount(0);
});
