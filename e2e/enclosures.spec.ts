import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import gasketCase from './fixtures/gasket-case';
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
const choose = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: 'Case designer' });
  await dialog.getByRole('button', { name: 'Layout', exact: true }).click();
  if (await dialog.getByLabel('Switch family', { exact: true }).count()) {
    await dialog
      .getByLabel('Switch family', { exact: true })
      .selectOption('mx');
  }
  await dialog
    .getByLabel('Mounting system', { exact: true })
    .selectOption('gasket');
  await expect(
    dialog.getByRole('button', { name: /^gasket gasket_/ }).first()
  ).toBeVisible({ timeout: 30000 });
};
const ready = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: 'Case designer' });
  await expect(
    dialog.getByRole('button', { name: 'Generate', exact: true })
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: 90000 });
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'assembled', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true'
  );
};

test.setTimeout(180000);

test('creates a full gasket case through forms, exports and applies one undo step', async ({
  page,
}) => {
  await load(page, source);
  const original = await saved(page);
  let dialog = await open(page);
  await choose(page);
  await dialog.getByRole('button', { name: 'Enclosure', exact: true }).click();
  await dialog.getByLabel('Wall thickness (mm)', { exact: true }).fill('4');
  await dialog.getByLabel('Wall thickness (mm)', { exact: true }).press('Tab');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toBe(original);

  dialog = await open(page);
  await choose(page);
  await dialog
    .getByRole('button', { name: 'Manufacturing', exact: true })
    .click();
  for (const part of ['bottom', 'top', 'plate']) {
    await dialog
      .getByLabel(`${part} process`, { exact: true })
      .selectOption('fdm');
  }
  await ready(page);
  await dialog.getByRole('button', { name: 'section', exact: true }).click();
  await dialog
    .locator('summary')
    .filter({ hasText: 'Preview displacement' })
    .click();
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

test('reopens a gasket enclosure offline without touching production storage', async ({
  page,
  context,
}) => {
  await load(page, gasketCase);
  let dialog = await open(page);
  await ready(page);
  await dialog.getByRole('button', { name: 'section', exact: true }).click();
  await page.screenshot({
    path: 'test-results/gasket-enclosure-section.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'part', exact: true }).click();
  await dialog.getByRole('button', { name: 'bottom', exact: true }).click();
  await page.screenshot({
    path: 'test-results/gasket-enclosure-bottom.png',
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

test('uses the supplier CNC preset with explicit corner relief', async ({
  page,
}) => {
  await load(page, source);
  const dialog = await open(page);
  await choose(page);
  await ready(page);
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  await expect(
    dialog.getByRole('button', { name: 'Apply design', exact: true })
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Apply design', exact: true })
    .click();
  await expect.poll(() => saved(page)).toContain('corner_relief: 0.5');
  expect(await saved(page)).toContain('supplier: jlccnc-6061-2026-09');
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
  await dialog.getByLabel('Board source', { exact: true }).selectOption('');
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(
    dialog.getByText('The case boundary contains separate bodies.', {
      exact: true,
    })
  ).toBeVisible({ timeout: 30000 });
  await expect(
    dialog.getByText('Showing the last valid geometry.')
  ).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Layout', exact: true }).click();
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
  await dialog
    .getByLabel('Existing board outline', { exact: true })
    .selectOption('bhk');
  await expect(dialog.getByLabel('Interactive mounting plan')).toBeVisible();
  await expect(
    dialog.getByText('The case boundary contains separate bodies.', {
      exact: true,
    })
  ).not.toBeVisible();
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
  await dialog
    .getByLabel('Existing board outline', { exact: true })
    .selectOption('bhk');
  await expect(dialog.getByLabel('Interactive mounting plan')).toBeVisible();
  await expect(
    dialog.getByText('The case boundary contains separate bodies.', {
      exact: true,
    })
  ).not.toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toBe(original);
});

test('inspects BHK in every 3D view and selects a gasket in 3D', async ({
  page,
}) => {
  const config = readFileSync(
    '../ergogen/docs/examples/enclosure-bhk-gasket.yaml',
    'utf8'
  );
  await load(page, config);
  const dialog = await open(page);
  await ready(page);
  for (const view of ['assembled', 'section', 'exploded', 'part']) {
    await dialog.getByRole('button', { name: view, exact: true }).click();
    if (view === 'part') {
      await dialog.getByRole('button', { name: 'bottom', exact: true }).click();
    }
    await page.mouse.move(5, 5);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    );
    await page.screenshot({ path: `test-results/bhk-guided-${view}.png` });
  }
  const select = dialog.getByLabel('Inspect part', { exact: true });
  const gasket = await select
    .locator('option')
    .evaluateAll((options) =>
      options
        .map((o) => (o as HTMLOptionElement).value)
        .find((value) => value.includes('gasket_') && value.includes('lower'))
    );
  expect(gasket).toBeTruthy();
  await select.selectOption(gasket!);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  const canvas = dialog.getByLabel('3D assembly preview').locator('canvas');
  await canvas.click();
  await expect(dialog.getByLabel('3D assembly preview')).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: 'Mounting', exact: true })
  ).toBeVisible();
  const id = gasket!
    .slice(gasket!.indexOf('_gasket_') + '_gasket_'.length)
    .replace(/_(lower|upper)$/, '');
  await expect(
    dialog.getByRole('treeitem', { name: id, exact: true })
  ).toHaveAttribute('aria-selected', 'true');
});
