import { studio, openCase, openExport, openLibrary } from './utils/studio';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';
import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { parse, parseDocument } from 'yaml';
import BHK from '../src/examples/bhk';
import { createCase, editCase } from '../src/utils/enclosureSource';
const fixture = 'e2e/fixtures/footprint-library/';
const footprintName = 'C_0603_1608Metric';
const base = `# Preserve project intent
schema: ergogen/v1
parts:
  capacitor:
    revision: "1"
    envelopes:
      body: {size: [2, 2], height: [0, 1]}
    footprints:
      capacitor:
        what: diode # preserve this comment
        params: {from: GND, to: SIGNAL}
layout:
  layers:
    electronics: {surface: pcb.board.top}
  objects:
    U1: {kind: component, part: capacitor, pcb: board, layer: electronics, placement: {at: [0, 0, 0]}}
    U2: {kind: component, part: capacitor, pcb: board, layer: electronics, placement: {at: [19, 0, 0]}}
    U3: {kind: component, part: capacitor, pcb: board, layer: electronics, placement: {at: [0, 19, 0]}}
    U4: {kind: component, part: capacitor, pcb: board, layer: electronics, placement: {at: [19, 19, 0]}}
designs:
  regions:
    board: {shape: {size: [65, 65]}}
  profiles:
    board: {from: regions.board}
pcbs:
  board: {profile: profiles.board}
`;
let source = createCase(base, 'case');
source = editCase(source, 'case', ['mounting'], '');
source = editCase(source, 'case', ['internal_radius'], 0);
for (const part of ['bottom', 'top', 'plate']) {
  source = editCase(source, 'case', ['manufacturing', part], {
    process: 'fdm',
    material: 'PETG',
    nozzle: 0.4,
    layer: 0.2,
    orientation: 'interior-up',
    build: [220, 220, 250],
    supports: 'allowed',
  });
}
const open = async (page: Page) => {
  await page.setViewportSize({ width: 1487, height: 1058 });
  await page.addInitScript(
    ({ source, key }) => localStorage.setItem(key, JSON.stringify(source)),
    { source, key: CONFIG_LOCAL_STORAGE_KEY }
  );
  await page.goto('./');
  await expect(studio(page)).toBeVisible();
  await openLibrary(page);
  return studio(page);
};
test.setTimeout(240000);
test.use({ actionTimeout: 15000 });
test('imports a KiCad bundle, aligns models, links placements, and exports a portable project', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let dialog = await open(page);
  const zip = new JSZip();
  zip.file(
    `capacitors.pretty/${footprintName}.kicad_mod`,
    readFileSync(`${fixture}${footprintName}.kicad_mod`)
  );
  zip.file(
    `models/${footprintName}.step`,
    readFileSync(`${fixture}${footprintName}.step`)
  );
  await dialog.getByLabel('Import footprint files').setInputFiles({
    name: 'capacitors.zip',
    mimeType: 'application/zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  await dialog
    .getByRole('button', { name: 'Prepare selected', exact: true })
    .click();
  await dialog
    .getByRole('button', {
      name: `Review capacitors.pretty/${footprintName}.kicad_mod`,
      exact: true,
    })
    .click({ timeout: 90000 });
  await expect(dialog.getByLabel('Active model')).toContainText(footprintName, {
    timeout: 90000,
  });
  await dialog
    .getByRole('button', { name: 'Pads & nets', exact: true })
    .click();
  await dialog.getByLabel('Pad 1 net parameter').fill('from');
  await dialog.getByLabel('Pad 2 net parameter').fill('to');
  await dialog.getByRole('button', { name: '3D models', exact: true }).click();
  await dialog
    .getByRole('spinbutton', { name: 'Model offset Z', exact: true })
    .fill('1');
  await dialog
    .getByRole('button', { name: 'Save footprint', exact: true })
    .click();
  await expect(dialog.getByText(/Saved revision 1/)).toBeVisible();
  await dialog.getByLabel('Footprint declaration').selectOption('0');
  await dialog
    .getByRole('button', { name: 'Link selected declaration' })
    .click();
  await expect(
    dialog.getByText('4 linked placements · 1 projects')
  ).toBeVisible();
  await dialog.getByText('Parameters & source', { exact: true }).click();
  const exportingFootprint = page.waitForEvent('download');
  await dialog
    .getByRole('button', { name: 'Export footprint ZIP', exact: true })
    .click();
  await (await exportingFootprint).saveAs('test-results/footprint-library.zip');
  await dialog
    .getByRole('button', { name: 'Preview in case', exact: true })
    .click();
  dialog = page.getByRole('region', { name: 'Case designer' });
  await expect(
    dialog.getByRole('treeitem', { name: 'capacitor (4)', exact: true })
  ).toBeVisible({ timeout: 30000 });
  await dialog.getByRole('button', { name: 'Layout', exact: true }).click();
  await dialog
    .getByLabel('Mounting system', { exact: true })
    .selectOption('gasket');
  await expect(
    dialog.getByLabel('Mounting system', { exact: true })
  ).toHaveValue('gasket');
  await expect(
    dialog.getByLabel('Mounting system', { exact: true })
  ).toHaveValue('gasket');
  await page
    .getByRole('button', { name: 'Generate project', exact: true })
    .click();
  await expect(
    dialog.getByText(
      /Current geometry|Generation needs attention. Open Review for grouped findings./,
      {}
    )
  ).toBeVisible({ timeout: 90000 });
  if (await dialog.getByRole('alert').count()) {
    await dialog.getByRole('button', { name: 'Review', exact: true }).click();
    throw new Error(
      await dialog.getByRole('region', { name: 'Grouped findings' }).innerText()
    );
  }
  await expect(
    dialog.getByRole('status').filter({ hasText: /Current geometry/ })
  ).toBeVisible({ timeout: 90000 });
  await dialog.getByRole('button', { name: 'assembled', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true'
  );
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  const exportView = await openExport(page);
  await exportView
    .getByRole('checkbox', { name: /I reviewed dimensions/ })
    .check();
  await expect(
    exportView.getByRole('button', { name: 'Download case ZIP', exact: true })
  ).toBeEnabled();
  const downloading = page.waitForEvent('download');
  await exportView
    .getByRole('button', { name: 'Download case ZIP', exact: true })
    .click();
  const download = await downloading;
  await download.saveAs('test-results/cad-portable-project.zip');
  const exported = await JSZip.loadAsync(
    readFileSync('test-results/cad-portable-project.zip')
  );
  const manifest = JSON.parse(
    await exported.file('footprint-library.json')!.async('string')
  );
  expect(manifest.entries).toHaveLength(1);
  expect(manifest.entries[0].models[0].offset[2]).toBe(1);
  const config = await exported.file('config.yaml')!.async('string');
  expect(config).toContain('# preserve this comment');
  expect(config).toContain('from: GND');
  expect(
    await exported.file('outputs/pcbs/board.kicad_pcb')!.async('string')
  ).toContain('${KIPRJMOD}/models/');
  expect(
    Object.keys(exported.files).some(
      (path) =>
        path.startsWith('outputs/pcbs/models/') && path.endsWith('.step')
    )
  ).toBe(true);
  // A fresh browser profile adopts the ZIP snapshot and can generate without a network.
  const offlineContext = await browser.newContext();
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(new URL('./import', page.url()).href);
  await offlinePage.evaluate(() => navigator.serviceWorker.ready);
  await offlinePage.reload();
  await expect(offlinePage.getByTestId('welcome-page-wrapper')).toBeVisible();
  await offlineContext.setOffline(true);
  try {
    await offlinePage
      .getByTestId('local-file-input')
      .setInputFiles('test-results/cad-portable-project.zip');
    await expect(studio(offlinePage)).toBeVisible();
    await openCase(offlinePage);
    const reopened = offlinePage.getByRole('region', { name: 'Case designer' });
    await offlinePage
      .getByRole('button', { name: 'Generate project', exact: true })
      .click();
    await expect(
      reopened.getByRole('status').filter({ hasText: /Current geometry/ })
    ).toBeVisible({ timeout: 90000 });
    await openLibrary(offlinePage);
    await studio(offlinePage)
      .getByRole('button', {
        name: `${manifest.entries[0].name} · r1`,
        exact: true,
      })
      .click();
    await expect(
      studio(offlinePage).getByRole('spinbutton', {
        name: 'Model offset Z',
        exact: true,
      })
    ).toHaveValue('1');
  } finally {
    await offlineContext.close();
  }
  expect(errors).toEqual([]);
});

test('assigns a model to a native BHK controller and exports the object binding', async ({
  page,
}) => {
  const config = parseDocument(BHK.value);

  await page.setViewportSize({ width: 1487, height: 1058 });
  await page.addInitScript(
    ({ source, key }) => localStorage.setItem(key, JSON.stringify(source)),
    { source: config.toString(), key: CONFIG_LOCAL_STORAGE_KEY }
  );
  await page.goto('./');
  await expect(studio(page)).toBeVisible();
  await openCase(page);
  const dialog = page.getByRole('region', { name: 'Case designer' });
  await dialog
    .getByRole('treeitem', { name: 'controller (1)', exact: true })
    .click();
  await dialog
    .getByLabel('Upload 3D models')
    .setInputFiles(`${fixture}${footprintName}.step`);
  await expect(dialog.getByLabel('Active model')).toContainText(footprintName, {
    timeout: 90000,
  });
  await expect(
    dialog.getByRole('button', { name: 'Replace', exact: true })
  ).toBeEnabled();
  await dialog
    .getByRole('button', { name: 'Manufacturing', exact: true })
    .click();
  for (const part of ['bottom', 'top', 'plate']) {
    await dialog
      .getByLabel(`${part} process`, { exact: true })
      .selectOption('fdm');
  }
  await dialog
    .getByRole('treeitem', { name: 'controller (1)', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Generate project', exact: true })
    .click();
  await expect(
    dialog.getByRole('status').filter({ hasText: /Current geometry/ })
  ).toBeVisible({ timeout: 90000 });
  await dialog.getByRole('button', { name: 'exploded', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true'
  );
  await expect(dialog.getByLabel('Model alignment inset')).toBeVisible();
  await page.setViewportSize({ width: 1487, height: 1058 });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'test-results/cad-bhk-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await dialog
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'test-results/cad-bhk-narrow.png' });
  await page.setViewportSize({ width: 1487, height: 1058 });
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  const exportView = await openExport(page);
  await exportView
    .getByRole('checkbox', { name: /I reviewed dimensions/ })
    .check();
  const download = page.waitForEvent('download');
  await exportView
    .getByRole('button', { name: 'Download case ZIP', exact: true })
    .click();
  await (await download).saveAs('test-results/cad-bhk-project.zip');
  const zip = await JSZip.loadAsync(
    readFileSync('test-results/cad-bhk-project.zip')
  );
  const source = parse(await zip.file('config.yaml')!.async('string'));
  expect(
    Object.values(source.layout.objects).filter(
      (item) => (item as { models?: unknown }).models
    )
  ).toHaveLength(1);
  expect(zip.file('outputs/pcbs/bhk_pcb.kicad_pcb')).not.toBeNull();
});
