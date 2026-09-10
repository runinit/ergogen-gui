import { studio } from './utils/studio';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const GENERATION_TIMEOUT_MS = 120000;
test.setTimeout(GENERATION_TIMEOUT_MS * 3);

test('loads the BHK example and regenerates it offline', async ({
  page,
  context,
}) => {
  const logs: string[] = [];
  page.on('console', (message) => logs.push(message.text()));
  page.on('pageerror', (error) => logs.push(String(error)));
  await page.goto('./new');
  await expect(
    page.getByLabel('Load BHK gasket enclosure example', { exact: true })
  ).toHaveCount(0);
  await page.getByLabel('Load BHK example', { exact: true }).click();
  await expect(studio(page)).toBeVisible();
  const exportPage = () =>
    page
      .getByRole('navigation', { name: 'Design workflow' })
      .getByRole('button', { name: 'Export', exact: true })
      .click();
  await exportPage();
  const downloadButton = page.getByRole('button', {
    name: 'bhk_pcb · KiCad PCB',
    exact: true,
  });
  await expect(downloadButton).toBeVisible({ timeout: GENERATION_TIMEOUT_MS });
  const getBoard = async () => {
    const pending = page.waitForEvent('download');
    await downloadButton.click();
    const download = await pending;
    return readFileSync((await download.path())!, 'utf8');
  };
  for (const outline of ['bhk']) {
    await expect(
      page.getByRole('button', { name: `${outline} · DXF`, exact: true })
    ).toBeVisible();
  }
  await page
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'Layout', exact: true })
    .click();
  await expect(
    page.getByRole('group', { name: 'Interactive board layout' })
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('bhk-native-outline.png'),
  });
  await exportPage();
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
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'PCB', exact: true })
    .click();
  await page.getByRole('button', { name: 'KiCad PCB', exact: true }).click();
  await expect(page.locator('kicanvas-embed canvas').first()).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('bhk.png') });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  try {
    await page.reload();
    await exportPage();
    await expect(downloadButton).toBeVisible({
      timeout: GENERATION_TIMEOUT_MS,
    });
    expect(await getBoard()).toEqual(board);
  } finally {
    await test.info().attach('browser-log', {
      body: logs.join('\n'),
      contentType: 'text/plain',
    });
    await context.setOffline(false);
  }
});
