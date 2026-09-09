import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

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
  for (const outline of ['bhk', 'bhk_plate']) {
    await expect(
      page.getByTestId(`downloads-container-${outline}-dxf-download`)
    ).toBeVisible();
  }
  await page.getByTestId('downloads-container-bhk-dxf-preview').click();
  await expect(
    page.getByLabel(/^SVG preview for outlines\.bhk\.svg/)
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('bhk-native-outline.png'),
  });
  const board = await getBoard();
  expect(board).toContain('THQWGD001C');
  expect(board).toContain('Capacitor_0603');
  const engineRequire = createRequire(`${process.cwd()}/package.json`);
  const inventory = engineRequire('ergogen/src/designs/board-inventory').read(
    board
  );
  const geometry = engineRequire('ergogen/src/designs/geometry');
  expect(
    inventory.pads.every(
      (pad: { model: unknown; approximate: boolean }) =>
        !pad.approximate && geometry.contains(inventory.model, pad.model)
    )
  ).toBe(true);
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
