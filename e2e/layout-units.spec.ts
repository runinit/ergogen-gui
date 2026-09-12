import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
import { test, expect } from '@playwright/test';
import { parse } from 'yaml';
import { readSource, studio, openInspector, openExport } from './utils/studio';
import { createBoard } from '../src/utils/boardDefaults';
import { addCluster, setValue } from '../src/utils/studioSource';
import { defaultSetup } from '../src/utils/designSetup';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';

test.setTimeout(120000);
const capture = (name: string) => `docs/design-qa/layout-usability/${name}.png`;

test('sets up an empty board, edits stagger, inserts and aligns an encoder', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./new');
  await page
    .getByRole('button', { name: 'New native design', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Design setup panel' })
  ).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Interactive board layout' })
  ).toBeVisible();
  await page.getByLabel('Horizontal pitch · u', { exact: true }).fill('19');
  await page.getByLabel('Horizontal pitch · u', { exact: true }).press('Enter');
  await page.getByLabel('Vertical pitch · v', { exact: true }).fill('17');
  await page.getByLabel('Vertical pitch · v', { exact: true }).press('Enter');
  await expect(
    page.getByRole('status').filter({ hasText: 'Layout resolved' })
  ).toBeVisible();
  await page.screenshot({ path: capture('desktop-setup') });
  await page.getByRole('tab', { name: 'Key assembly', exact: true }).click();
  await expect(
    page
      .getByRole('img', { name: 'Key assembly footprint editor' })
      .locator('polygon')
      .first()
  ).toBeVisible();
  await page.screenshot({ path: capture('desktop-assembly') });
  await page
    .getByRole('button', { name: 'Generate sample', exact: true })
    .click();
  const sample = page.getByRole('button', { name: 'Download KiCad sample' });
  await expect(sample).toBeEnabled({ timeout: 60000 });
  const downloaded = page.waitForEvent('download');
  await sample.click();
  await (await downloaded).saveAs('/tmp/layout-usability-pcb-sample.zip');
  await page.getByRole('tab', { name: 'Stackup', exact: true }).click();
  await page.getByRole('button', { name: 'Plate foam', exact: true }).click();
  await expect(page.getByText(/2.4 mm remaining space/)).toBeVisible();
  await page.screenshot({ path: capture('desktop-stack') });
  await page.getByRole('button', { name: 'Apply setup', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Design setup panel' })
  ).toBeHidden();
  let data = parse(await readSource(page));
  expect(data.layout.objects).toEqual({});
  expect(data.units).toMatchObject({ u: 19, v: 17 });
  await page.getByRole('button', { name: 'Add matrix', exact: true }).click();
  await page.getByLabel('New item name').fill('fingers');
  await page.getByLabel('New matrix columns').fill('3');
  await page.getByLabel('New matrix rows').fill('2');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const key = page.locator('[data-object="fingers_c2_r1"]');
  await expect(key).toBeVisible({ timeout: 60000 });
  await page
    .getByRole('button', { name: 'Select Columns', exact: true })
    .click();
  await key.click();
  const stagger = page.getByLabel('Column stagger', { exact: true });
  await expect(stagger).toBeVisible();
  await stagger.fill('0.5v');
  await stagger.press('Enter');
  await expect
    .poll(
      async () =>
        parse(await readSource(page)).layout.clusters.fingers.arrangement
          .stagger.c2
    )
    .toBe('0.5v');
  await page
    .getByRole('button', { name: 'Snap increment 0.125u', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Increase Column stagger', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        parse(await readSource(page)).layout.clusters.fingers.arrangement
          .stagger.c2
    )
    .toBe('(0.5v) + 0.125v');
  await expect(
    page.getByRole('status').filter({ hasText: 'Layout resolved' })
  ).toBeVisible();
  await page.screenshot({ path: capture('desktop-stagger') });
  const panel = await openInspector(page);
  await panel.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('New item kind').selectOption('component');
  await page.getByLabel('Component catalogue').selectOption('encoder');
  await page.getByLabel('New item name').fill('encoder');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('[data-object="encoder"]')).toBeVisible({
    timeout: 60000,
  });
  await page
    .getByRole('button', { name: 'Align vertically', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Align to Column 2 · fingers', exact: true })
    .click();
  await expect
    .poll(
      async () =>
        Object.values(parse(await readSource(page)).layout.constraints || {})
          .length
    )
    .toBe(1);
  await page.screenshot({ path: capture('desktop-alignment') });
  data = parse(await readSource(page));
  expect(Object.values(data.layout.constraints)[0]).toMatchObject({
    type: 'aligned',
    axis: 'y',
    refs: ['encoder.center', 'columns.fingers.c2'],
  });
  await page.getByRole('button', { name: /Remove relationship/ }).click();
  await expect
    .poll(
      async () =>
        Object.keys(parse(await readSource(page)).layout.constraints || {})
          .length
    )
    .toBe(0);
  expect(errors).toEqual([]);
});

for (const width of [320, 390]) {
  test(`keeps setup and the layout usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(
      ({ key, source }) => localStorage.setItem(key, JSON.stringify(source)),
      { key: CONFIG_LOCAL_STORAGE_KEY, source: createBoard() }
    );
    await page.goto('./');
    await expect(
      page.getByRole('region', { name: 'Design setup panel' })
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Layout resolved' })
    ).toBeVisible();
    await page.screenshot({ path: capture(`mobile-${width}-setup`) });
    await page.getByRole('tab', { name: 'Key assembly', exact: true }).click();
    await expect(
      page
        .getByRole('img', { name: 'Key assembly footprint editor' })
        .locator('polygon')
        .first()
    ).toBeVisible();
    await page.screenshot({ path: capture(`mobile-${width}-assembly`) });
    await page.getByRole('tab', { name: 'Stackup', exact: true }).click();
    await page.screenshot({ path: capture(`mobile-${width}-stack`) });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      )
    ).toBe(true);
    await page
      .getByRole('button', { name: 'Apply setup', exact: true })
      .click();
    const close = page.getByRole('button', {
      name: 'Close inspector',
      exact: true,
    });
    if (await close.isVisible()) {
      await close.click();
    }
    await expect(studio(page)).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Layout resolved' })
    ).toBeVisible();
    await page.screenshot({ path: capture(`mobile-${width}-canvas`) });
  });
}

test('snaps a component to a column center and optionally keeps the alignment', async ({
  page,
}) => {
  let source = addCluster(
    createBoard({ ...defaultSetup(), diode: false, pitch: 19 }),
    'fingers',
    'columns',
    { columns: 2, rows: 2 }
  );
  source = setValue(source, ['meta', 'studio', 'openSetup'], false);
  source = setValue(source, ['layout', 'objects', 'encoder'], {
    kind: 'component',
    pcb: 'main',
    layer: 'main',
    placement: { at: [33, 60, 0] },
    envelopes: { body: { size: [12, 12], height: [0, 10], at: [2, 0, 0] } },
  });
  await page.addInitScript(
    ({ key, source }) => localStorage.setItem(key, JSON.stringify(source)),
    { key: CONFIG_LOCAL_STORAGE_KEY, source }
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await expect(
    page.getByRole('status').filter({ hasText: 'Layout resolved' })
  ).toBeVisible();
  await openExport(page);
  await expect(
    page.getByRole('button', { name: 'main · KiCad PCB' })
  ).toBeEnabled();
  await studio(page)
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'Design', exact: true })
    .click();
  const points = await page
    .getByRole('group', { name: 'Interactive board layout' })
    .evaluate((svg) => {
      const matrix = (svg as SVGSVGElement).getScreenCTM()!;
      return [
        [35, -60],
        [19, -60],
      ].map(([x, y]) => {
        const point = new DOMPoint(x, y).matrixTransform(matrix);
        return { x: point.x, y: point.y };
      });
    });
  await page.mouse.move(points[0].x, points[0].y);
  await page.mouse.down();
  await page.mouse.move(points[1].x, points[1].y, { steps: 12 });
  await page.mouse.up();
  const keep = page.getByRole('button', { name: /Keep aligned · Column 2/ });
  await expect(keep).toBeVisible();
  const temporary = parse(await readSource(page));
  expect(Object.keys(temporary.layout.constraints || {})).toHaveLength(0);
  await keep.click();
  await expect
    .poll(
      async () =>
        Object.values(parse(await readSource(page)).layout.constraints || {})
          .length
    )
    .toBe(1);
});

test('exports fitting material separately from an interfering layer', async ({
  page,
}) => {
  let source = addCluster(
    createBoard({ ...defaultSetup(), diode: false }),
    'fingers',
    'columns',
    { columns: 2, rows: 2 }
  );
  source = setValue(source, ['meta', 'studio', 'openSetup'], false);
  source = setValue(source, ['designs', 'stackups', 'main', 'layers'], {
    foam: {
      label: 'Plate foam',
      material: 'foam',
      lower: 'pcb.top',
      upper: 'plate.bottom',
      thickness: 3,
    },
    silicone: {
      label: 'Silicone sheet',
      material: 'silicone',
      lower: 'pcb.top',
      upper: 'plate.bottom',
      thickness: 4,
    },
  });
  await page.addInitScript(
    ({ key, source }) => localStorage.setItem(key, JSON.stringify(source)),
    { key: CONFIG_LOCAL_STORAGE_KEY, source }
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await expect(
    page.getByRole('status').filter({ hasText: 'Layout resolved' })
  ).toBeVisible();
  await openExport(page);
  const foam = page.getByRole('button', { name: 'Download Plate foam DXF' });
  await expect(foam).toBeEnabled({ timeout: 60000 });
  await expect(
    page.getByRole('button', { name: 'Download Silicone sheet DXF' })
  ).toBeDisabled();
  const downloaded = page.waitForEvent('download');
  await foam.click();
  await (await downloaded).saveAs('/tmp/layout-plate-foam.dxf');
  await expect(
    page.getByRole('button', { name: 'main · KiCad PCB' })
  ).toBeEnabled();
  await page.screenshot({ path: capture('desktop-material-export') });
  const bundle = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Download PCB and outlines ZIP', exact: true })
    .click();
  await (await bundle).saveAs('/tmp/layout-materials.zip');
  const zip = await JSZip.loadAsync(
    await readFile('/tmp/layout-materials.zip')
  );
  const metadata = JSON.parse(
    await zip.file('outputs/material-layers.json')!.async('string')
  );
  expect(metadata.units).toBe('mm');
  expect(metadata.stackups.main.layers.foam).toMatchObject({
    stock: 3,
    installed: 3,
    status: 'ready',
  });
  expect(metadata.stackups.main.layers.silicone.status).toBe('interference');
  expect(zip.file('outputs/outlines/main_foam.dxf')).not.toBeNull();
});

test('shows named material layers and gap fit in setup', async ({ page }) => {
  let source = addCluster(
    createBoard({ ...defaultSetup(), diode: false }),
    'keys',
    'columns',
    { columns: 2, rows: 2 }
  );
  source = setValue(source, ['designs', 'stackups', 'main', 'layers'], {
    foam: {
      label: 'Plate foam',
      material: 'foam',
      lower: 'pcb.top',
      upper: 'plate.bottom',
      thickness: 1,
    },
    silicone: {
      label: 'Silicone sheet',
      material: 'silicone',
      lower: 'pcb.top',
      upper: 'plate.bottom',
      thickness: 1,
    },
    gasket: {
      label: 'Gasket pads',
      material: 'gasket',
      lower: 'pcb.top',
      upper: 'plate.bottom',
      thickness: 1,
    },
  });
  await page.addInitScript(
    ({ key, source }) => localStorage.setItem(key, JSON.stringify(source)),
    { key: CONFIG_LOCAL_STORAGE_KEY, source }
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await page.getByRole('tab', { name: 'Stackup', exact: true }).click();
  await expect(
    page.getByRole('button', {
      name: /Silicone sheet · silicone · 1 mm · Fits gap/,
    })
  ).toBeVisible();
  await page.screenshot({ path: capture('desktop-material-section') });
});
