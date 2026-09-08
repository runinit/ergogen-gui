import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('loads the BHK example and regenerates it offline', async ({
  page,
  context,
}) => {
  await page.goto('./new');
  await page.getByLabel('Load BHK example', { exact: true }).click();
  const downloadButton = page.getByTestId(
    'downloads-container-bhk_pcb-kicad_pcb-download'
  );
  await expect(downloadButton).toBeVisible();
  const getBoard = async () => {
    const pending = page.waitForEvent('download');
    await downloadButton.click();
    const download = await pending;
    return readFileSync((await download.path())!, 'utf8');
  };
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
    await expect(downloadButton).toBeVisible();
    expect(await getBoard()).toEqual(board);
  } finally {
    await context.setOffline(false);
  }
});
