import { test, expect } from '@playwright/test';
import { makeShooter } from './utils/screenshots';

test('minimal test: page loads and has welcome text', async ({ page }) => {
  const shoot = makeShooter(page, test.info());
  await page.goto('./import');
  const welcome = page.getByText('Import project', { exact: true });
  await shoot('before-welcome-visible');
  await expect(welcome).toBeVisible();
  await shoot('after-welcome-visible');
});
