import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import BHK from '../src/examples/enclosure-bhk';
import BHKLayout from '../src/examples/bhk';

const source =
  '# Keep the original layout\nunits: {pitch: 19}\npoints:\n  zones:\n    keys:\n      columns: {left: {}, right: {}}\n      rows: {home: {}, top: {}}\n';
const saved = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as {
        monaco: { editor: { getModels(): { getValue(): string }[] } };
      }
    ).monaco.editor
      .getModels()[0]
      .getValue()
  );
const load = async (page: Page, config: string) => {
  await page.addInitScript((config) => {
    const preview = location.pathname.startsWith('/ergogen-gui-preview/');
    localStorage.setItem(
      preview ? 'preview:ergogen:config' : 'ergogen:config',
      JSON.stringify(config)
    );
    if (preview) {
      localStorage.setItem('ergogen:config', 'production-sentinel');
    }
  }, config);
  await page.goto('./');
  await expect(page.getByTestId('config-editor')).toBeVisible();
  await page.waitForFunction(
    () => !!(window as unknown as { monaco?: unknown }).monaco
  );
  await page.evaluate(() => navigator.serviceWorker.ready);
};
const open = async (page: Page) => {
  await page
    .getByRole('button', { name: 'Create / edit case', exact: true })
    .first()
    .click();
  return page.getByRole('dialog', { name: 'Case designer' });
};
const ready = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: 'Case designer' });
  await expect(
    dialog.getByRole('button', { name: 'bottom', exact: true })
  ).toBeVisible({ timeout: 90000 });
  await expect(dialog.getByText('Updating geometry…')).not.toBeVisible({
    timeout: 90000,
  });
  await expect(dialog.getByRole('alert')).toHaveCount(0);
};

test.setTimeout(180000);

test('creates a full gasket case through forms, exports and applies one undo step', async ({
  page,
}) => {
  await load(page, source);
  const original = await saved(page);
  let dialog = await open(page);
  await ready(page);
  await dialog.getByRole('button', { name: 'Enclosure', exact: true }).click();
  await dialog.getByLabel('Wall thickness (mm)').fill('4');
  await dialog.getByLabel('Wall thickness (mm)').press('Tab');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toBe(original);

  dialog = await open(page);
  await ready(page);
  await dialog
    .getByRole('button', { name: 'Manufacturing', exact: true })
    .click();
  for (const part of ['bottom', 'top', 'plate']) {
    await dialog
      .getByLabel(`${part} process`, { exact: true })
      .selectOption('fdm');
  }
  await dialog.getByRole('button', { name: 'Mounting', exact: true }).click();
  await dialog.getByLabel('Mounting system').selectOption('gasket');
  await dialog
    .getByRole('button', { name: /^Add gasket_/ })
    .first()
    .click();
  await ready(page);
  await dialog.getByRole('button', { name: 'Hardware', exact: true }).click();
  await dialog
    .getByRole('button', { name: /^Add mount_/ })
    .first()
    .click();
  await ready(page);
  await dialog.getByRole('button', { name: 'section', exact: true }).click();
  await dialog.getByLabel('Suspension travel').fill('0.1');
  await dialog.getByLabel('Lateral travel').fill('0.05');
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  await expect(
    dialog.getByRole('button', { name: 'Apply design' })
  ).toBeEnabled({ timeout: 90000 });
  const downloading = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download ZIP' }).click();
  const download = await downloading;
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const names = Object.keys(zip.files);
  const assembly = names.find((name) => name.endsWith('/case_assembly.step'));
  expect(assembly).toBeTruthy();
  expect(await zip.file(assembly!)!.async('string')).toContain(
    'MANIFOLD_SOLID_BREP'
  );
  expect(names.some((name) => name.endsWith('/case_plate.dxf'))).toBe(true);
  await dialog.getByRole('button', { name: 'Apply design' }).click();
  await expect(dialog).not.toBeVisible();
  expect(await saved(page)).toContain('# Keep the original layout');
  expect(await saved(page)).toContain('mounting: gasket');
  await page.evaluate(() =>
    (
      window as unknown as {
        monaco: { editor: { getModels(): { undo(): void }[] } };
      }
    ).monaco.editor
      .getModels()[0]
      .undo()
  );
  await expect.poll(() => saved(page)).toBe(original);
});

test('reopens the BHK enclosure offline without touching production storage', async ({
  page,
  context,
}) => {
  await load(page, BHK.value);
  let dialog = await open(page);
  await ready(page);
  await dialog.getByRole('button', { name: 'section', exact: true }).click();
  await page.screenshot({
    path: 'test-results/bhk-enclosure-section.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'part', exact: true }).click();
  await dialog.getByRole('button', { name: 'bottom', exact: true }).click();
  await page.screenshot({
    path: 'test-results/bhk-enclosure-bottom.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const key of keys.filter((key) => key.startsWith('design-wasm-'))) {
      const entries = await (await caches.open(key)).keys();
      if (entries.some((entry) => entry.url.endsWith('.wasm'))) {
        return true;
      }
    }
    return false;
  });
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByTestId('config-editor')).toBeVisible();
    dialog = await open(page);
    await ready(page);
    if (new URL(page.url()).pathname.startsWith('/ergogen-gui-preview/')) {
      expect(
        await page.evaluate(() => localStorage.getItem('ergogen:config'))
      ).toBe('production-sentinel');
    }
  } finally {
    await context.setOffline(false);
  }
});

test('configures machinable shells and rounded plate cutouts through forms', async ({
  page,
}) => {
  await load(page, source);
  const dialog = await open(page);
  await ready(page);
  await dialog.getByLabel('Switch cutout corner radius (mm)').fill('1');
  await dialog.getByLabel('Switch cutout corner radius (mm)').press('Tab');
  await dialog.getByRole('button', { name: 'Enclosure', exact: true }).click();
  await dialog.getByLabel('Internal corner radius (mm)').fill('2');
  await dialog.getByLabel('Internal corner radius (mm)').press('Tab');
  await dialog
    .getByRole('button', { name: 'Manufacturing', exact: true })
    .click();
  for (const part of ['bottom', 'top', 'plate']) {
    await dialog
      .getByLabel(`${part} process`, { exact: true })
      .selectOption('cnc');
  }
  await dialog.getByLabel('plate cutter diameter (mm)').fill('2');
  await dialog.getByLabel('plate cutter diameter (mm)').press('Tab');
  await dialog.getByLabel('plate minimum wall (mm)').fill('1');
  await dialog.getByLabel('plate minimum wall (mm)').press('Tab');
  await ready(page);
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  await expect(
    dialog.getByRole('button', { name: 'Apply design' })
  ).toBeEnabled({ timeout: 90000 });
  await dialog.getByRole('button', { name: 'Apply design' }).click();
  expect(await saved(page)).toContain('corner_radius: 1');
  expect(await saved(page)).toContain('process: cnc');
});

test('repairs a disconnected BHK boundary without losing point selections', async ({
  page,
}) => {
  await load(page, BHKLayout.value);
  await expect(
    page.getByTestId('downloads-container-bhk_pcb-kicad_pcb-download')
  ).toBeVisible({ timeout: 30000 });
  const original = await saved(page);
  const dialog = await open(page);
  await expect(dialog.getByRole('alert')).toContainText(
    'Expected one connected region; found 2',
    { timeout: 90000 }
  );
  await expect(
    dialog.getByText('Showing the last valid geometry.')
  ).not.toBeVisible();
  await expect(dialog.getByLabel('Board profile', { exact: true })).toHaveValue(
    'profiles.case_board'
  );
  const points = dialog.getByRole('group', { name: 'Included layout points' });
  const first = points.getByLabel('matrix_c1_r4', { exact: true });
  const second = points.getByLabel('matrix_c1_r3', { exact: true });
  const total = await points.getByRole('checkbox', { checked: true }).count();
  await first.uncheck();
  await expect(first).not.toBeChecked();
  await expect(second).toBeChecked();
  await expect(points.getByRole('checkbox', { checked: true })).toHaveCount(
    total - 1
  );
  await first.check();
  await expect(points.getByRole('checkbox', { checked: true })).toHaveCount(
    total
  );
  const cutouts = dialog.getByRole('group', {
    name: 'Points with switch cutouts',
  });
  await cutouts.getByLabel('matrix_c1_r4', { exact: true }).uncheck();
  await expect(
    cutouts.getByLabel('matrix_c1_r3', { exact: true })
  ).toBeChecked();
  await expect(first).toBeChecked();
  // The PCB outline includes keys; helper points are not switch cutouts.
  for (const box of await cutouts.getByRole('checkbox').all()) {
    const label = await box.locator('..').innerText();
    if (!/^(matrix|thumbfan)_/.test(label.trim())) {
      await box.uncheck();
    }
  }
  await dialog.getByLabel('Existing board outline').selectOption('bhk');
  await ready(page);
  await page.screenshot({
    path: 'test-results/bhk-boundary-recovered.png',
    fullPage: true,
  });
  await dialog.getByLabel('New case name').fill('test');
  await dialog.getByRole('button', { name: 'Add case', exact: true }).click();
  await expect(dialog.getByLabel('Case', { exact: true })).toHaveValue('test');
  for (const box of await cutouts.getByRole('checkbox').all()) {
    const label = await box.locator('..').innerText();
    if (!/^(matrix|thumbfan)_/.test(label.trim())) {
      await box.uncheck();
    }
  }
  await dialog.getByLabel('Existing board outline').selectOption('bhk');
  await ready(page);
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toBe(original);
});
