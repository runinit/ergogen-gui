import { expect, test } from '@playwright/test';
import { createDraft, openExport } from './utils/studio';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';

test('shows the Offline App control in native Settings', async ({ page }) => {
  await page.goto('./new');
  await createDraft(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  const settings = page.getByRole('dialog', { name: 'Project settings' });
  await expect(settings).toBeVisible();
  await expect(
    settings.getByText('Offline App', { exact: true })
  ).toBeVisible();
  await expect(
    settings.locator(
      '[data-testid="pwa-unavailable-button"], [data-testid="pwa-install-button"], [data-testid="pwa-installed-button"]'
    )
  ).toHaveCount(1);
});

test('uploads an SVG outline and generates its output', async ({ page }) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        'schema: ergogen/v1\nlayout: {}\ndesigns:\n  regions:\n    svg:\n      outline: uploaded_outline\n  profiles:\n    board:\n      from: regions.svg\n'
      );
    },
    { key: CONFIG_LOCAL_STORAGE_KEY }
  );
  await page.goto('./');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();

  await page.getByText('Advanced libraries', { exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Project settings' });
  await library.getByTestId('tab-outlines').click();
  const chooser = page.waitForEvent('filechooser');
  await library.getByTestId('load-outline-files').click();
  await (
    await chooser
  ).setFiles({
    name: 'uploaded_outline.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M 0 0 L 10 0 L 10 10 Z"/></svg>'
    ),
  });

  await expect(
    library.getByText('uploaded_outline', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close settings' }).click();
  await openExport(page);
  await expect(
    page.getByRole('button', { name: 'uploaded_outline · SVG', exact: true })
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Download PCB and outlines ZIP' })
  ).toBeEnabled();
});
