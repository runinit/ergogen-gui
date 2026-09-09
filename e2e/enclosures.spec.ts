import { parse } from 'yaml';
import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import gasketCase from './fixtures/gasket-case';
import BHKLayout from '../src/examples/bhk';

import source from './fixtures/native-grid';
const GEOMETRY_TIMEOUT = 90000;
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
  ).toBeEnabled({ timeout: GEOMETRY_TIMEOUT });
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: GEOMETRY_TIMEOUT });
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
  expect(parse(await saved(page)).designs.assemblies.case.mounting).toBe(
    'gasket'
  );
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
  await expect
    .poll(() => saved(page))
    .toContain('supplier: jlccnc-6061-2026-09');
});

test('keeps the native BHK boundary and limits switch selections to typed keys', async ({
  page,
}) => {
  await load(page, BHKLayout.value);
  const original = await saved(page);
  const dialog = await open(page);
  await expect(dialog.getByLabel('Board profile', { exact: true })).toHaveValue(
    'profiles.bhk'
  );
  const cutouts = dialog.getByRole('group', {
    name: 'Points with switch cutouts',
  });
  if (await cutouts.count()) {
    await expect(cutouts.getByRole('checkbox')).toHaveCount(33);
  }
  await expect(dialog.getByLabel('Interactive mounting plan')).toBeVisible({
    timeout: 30000,
  });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await saved(page)).toBe(original);
});

test('inspects a native gasket case in every 3D view and selects a gasket in 3D', async ({
  page,
}) => {
  await load(page, gasketCase);
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

test('generates BHK CNC relief from the process controls', async ({
  page,
}, testInfo) => {
  await load(page, BHKLayout.value);
  const dialog = await open(page);
  await dialog
    .getByRole('button', { name: 'Manufacturing', exact: true })
    .click();
  await expect(dialog.getByText(/CNC adds corner relief/)).toBeVisible();
  for (const part of ['bottom', 'top', 'plate']) {
    await dialog
      .getByLabel(`${part} process`, { exact: true })
      .selectOption('cnc');
  }
  await expect(
    dialog.getByLabel('plate cutter diameter (mm)', { exact: true })
  ).toHaveValue('1');
  await ready(page);
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(dialog.getByText(/Added cutter relief/).first()).toBeVisible();
  await expect(
    dialog.getByText(
      /smaller than the cutter|still cannot fit the cutter|relief would/
    )
  ).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: /Review 0 blockers/ })
  ).toBeVisible();
  await dialog.getByText('Generated current draft', { exact: true }).click();
  await dialog
    .getByText(/Added cutter relief/)
    .first()
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath('bhk-cnc-relief.png'),
    fullPage: true,
  });
});
