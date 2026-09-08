import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const GENERATION_TIMEOUT_MS = 30000;
test.setTimeout(GENERATION_TIMEOUT_MS * 3);

test('loads the BHK example and regenerates it offline', async ({
  page,
  context,
}) => {
  await page.goto('./new');
  await expect(
    page.getByLabel('Load BHK gasket enclosure example', { exact: true })
  ).toHaveCount(0);
  await page.getByLabel('Load BHK example', { exact: true }).click();
  const downloadButton = page.getByTestId(
    'downloads-container-bhk_pcb-kicad_pcb-download'
  );
  await expect(downloadButton).toBeVisible({ timeout: GENERATION_TIMEOUT_MS });
  const getBoard = async () => {
    const pending = page.waitForEvent('download');
    await downloadButton.click();
    const download = await pending;
    return readFileSync((await download.path())!, 'utf8');
  };
  for (const outline of ['bhk', 'bhk_plate', 'bhk_auto', 'preview']) {
    await expect(
      page.getByTestId(`downloads-container-${outline}-dxf-download`)
    ).toBeVisible();
  }
  await page.getByTestId('downloads-container-preview-dxf-preview').click();
  await expect(
    page.getByLabel(/^SVG preview for outlines\.preview\.svg/)
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('bhk-original-outline.png'),
  });
  const board = await getBoard();
  expect(board).toContain('THQWGD001C');
  expect(board).toContain('Capacitor_0603');
  await page
    .getByTestId('downloads-container-bhk_pcb-kicad_pcb-preview')
    .click();
  await expect(page.locator('kicanvas-embed canvas').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('bhk.png') });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(downloadButton).toBeVisible({
      timeout: GENERATION_TIMEOUT_MS,
    });
    expect(await getBoard()).toEqual(board);
  } finally {
    await context.setOffline(false);
  }
});
