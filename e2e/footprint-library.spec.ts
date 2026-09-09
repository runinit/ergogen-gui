import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { parse, parseDocument } from 'yaml';
import BHK from '../src/examples/bhk';
import { createCase, editCase } from '../src/utils/enclosureSource';
const fixture = 'e2e/fixtures/footprint-library/';
const footprintName = 'C_0603_1608Metric';
const base = `# Preserve project intent
points:
  zones:
    keys:
      columns: {left: {}, right: {}}
      rows: {home: {}, top: {}}
outlines:
  board: [{what: rectangle, size: [65, 65]}]
pcbs:
  board:
    outlines: {edge: {outline: board}}
    footprints:
      capacitor:
        what: diode # preserve this comment
        where: true
        params: {from: GND, to: SIGNAL}
`;
let source = createCase(base, 'case');
source = editCase(source, 'case', ['mounting'], '');
source = editCase(source, 'case', ['internal_radius'], 0);
source = source.replace(
  'case_keys:\n      where: true',
  'case_keys:\n      outline: board'
);
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
    (source) => localStorage.setItem('ergogen:config', JSON.stringify(source)),
    source
  );
  await page.goto('./');
  await expect(page.getByTestId('config-editor')).toBeVisible();
  await page
    .getByRole('button', { name: 'Footprint library', exact: true })
    .click();
  return page.getByRole('dialog', { name: 'Case designer' });
};
test.setTimeout(240000);
test.use({ actionTimeout: 15000 });
test('imports a KiCad bundle, aligns models, links placements, and exports a portable project', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const dialog = await open(page);
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
  await expect(dialog.getByLabel('Active model')).toContainText(footprintName);
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
  await expect(
    dialog.getByRole('treeitem', { name: `${footprintName} (4)`, exact: true })
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
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText(
      /Generated current draft|Generation needs attention. Open Review for grouped findings./,
      { exact: true }
    )
  ).toBeVisible({ timeout: 90000 });
  if (await dialog.getByRole('alert').count()) {
    await dialog.getByRole('button', { name: 'Review', exact: true }).click();
    throw new Error(
      await dialog.getByRole('region', { name: 'Grouped findings' }).innerText()
    );
  }
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: 90000 });
  await dialog.getByRole('button', { name: 'assembled', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true'
  );
  await dialog
    .getByRole('treeitem', { name: `${footprintName} (4)`, exact: true })
    .click();
  await expect(
    dialog.getByLabel('Component footprint', { exact: true })
  ).toHaveValue('U1');
  await expect(dialog.getByLabel('Model alignment inset')).toBeVisible();
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox', { name: /I reviewed dimensions/ }).check();
  await expect(
    dialog.getByRole('button', { name: 'Download ZIP', exact: true })
  ).toBeEnabled();
  const downloading = page.waitForEvent('download');
  await dialog
    .getByRole('button', { name: 'Download ZIP', exact: true })
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
  // Saving a library revision reaches both projects; a manual placement keeps its override.
  await dialog
    .getByRole('button', { name: 'Apply design', exact: true })
    .click();
  const originalName = await page.getByTitle('Click to rename').innerText();
  await page
    .getByRole('button', { name: 'Duplicate configuration', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Create / edit case', exact: true })
    .click();
  let current = page.getByRole('dialog', { name: 'Case designer' });
  await current
    .getByRole('treeitem', { name: `${footprintName} (4)`, exact: true })
    .click();
  await current
    .getByRole('checkbox', {
      name: 'Apply dimensions and manual model assignments to matching footprints',
    })
    .uncheck();
  await current
    .getByRole('spinbutton', { name: 'Model offset Z', exact: true })
    .fill('3');
  await current.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    current.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: 90000 });
  await current.getByRole('button', { name: 'Review', exact: true }).click();
  await current
    .getByRole('checkbox', { name: /I reviewed dimensions/ })
    .check();
  await current
    .getByRole('button', { name: 'Apply design', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Footprint library', exact: true })
    .click();
  current = page.getByRole('dialog', { name: 'Case designer' });
  await current
    .getByRole('button', {
      name: `${manifest.entries[0].name} · r1`,
      exact: true,
    })
    .click();
  await current
    .getByRole('spinbutton', { name: 'Model offset Z', exact: true })
    .fill('2');
  await expect(
    current.getByText('8 linked placements · 2 projects', { exact: true })
  ).toBeVisible();
  await current
    .getByRole('button', { name: 'Save footprint', exact: true })
    .click();
  await expect(current.getByText(/Saved revision 2/)).toBeVisible();
  const nameHeading = current.getByRole('heading', {
    name: manifest.entries[0].name,
    exact: true,
  });
  expect(
    await nameHeading.evaluate((node) => node.scrollWidth <= node.clientWidth)
  ).toBe(true);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'test-results/cad-footprint-library.png' });
  await current.getByRole('tab', { name: 'YAML', exact: true }).click();
  const instanceSource = await current.getByLabel(/Project YAML/).inputValue();
  expect(
    parse(instanceSource).designs.assemblies.case.board.models.U1[0].offset[2]
  ).toBe(3);
  await current.getByRole('tab', { name: 'Case', exact: true }).click();
  await current
    .getByRole('treeitem', { name: `${footprintName} (4)`, exact: true })
    .click();
  await expect(
    current.getByRole('spinbutton', { name: 'Model offset Z', exact: true })
  ).toHaveValue('3');
  await current.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page
    .getByRole('button', { name: 'Show navigation panel', exact: true })
    .click();
  await page.getByRole('button', { name: originalName, exact: true }).click();
  await page
    .getByRole('button', { name: 'Create / edit case', exact: true })
    .click();
  current = page.getByRole('dialog', { name: 'Case designer' });
  await current
    .getByRole('treeitem', { name: `${footprintName} (4)`, exact: true })
    .click();
  await expect(
    current.getByRole('spinbutton', { name: 'Model offset Z', exact: true })
  ).toHaveValue('2');
  await current.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    current.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: 90000 });
  await current.getByRole('button', { name: 'assembled', exact: true }).click();
  await page.setViewportSize({ width: 1487, height: 1058 });
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'test-results/cad-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    current.getByRole('button', { name: 'Assembly tree', exact: true })
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/cad-narrow-inspector.png' });
  await current
    .getByRole('button', { name: 'Close inspector', exact: true })
    .click();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: 'test-results/cad-narrow.png' });
  await current
    .getByRole('tab', { name: 'Footprint library', exact: true })
    .click();
  await current.getByRole('button', { name: 'Catalog', exact: true }).click();
  await current
    .getByRole('button', {
      name: `${manifest.entries[0].name} · r2`,
      exact: true,
    })
    .click();
  await current
    .getByRole('button', { name: 'Close inspector', exact: true })
    .press('Escape');
  await expect(
    current.getByRole('button', { name: 'Inspector', exact: true })
  ).toBeFocused();
  await page.setViewportSize({ width: 1487, height: 1058 });
  // A fresh browser profile adopts the ZIP snapshot and can generate without a network.
  const offlineContext = await browser.newContext();
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto(new URL('./new', page.url()).href);
  await offlinePage.evaluate(() => navigator.serviceWorker.ready);
  await offlinePage.reload();
  await expect(offlinePage.getByTestId('welcome-page-wrapper')).toBeVisible();
  await offlineContext.setOffline(true);
  try {
    await offlinePage
      .getByTestId('local-file-input')
      .setInputFiles('test-results/cad-portable-project.zip');
    await expect(offlinePage.getByTestId('config-editor')).toBeVisible();
    await offlinePage
      .getByRole('button', { name: 'Create / edit case', exact: true })
      .click();
    const reopened = offlinePage.getByRole('dialog', { name: 'Case designer' });
    await reopened
      .getByRole('button', { name: 'Generate', exact: true })
      .click();
    await expect(
      reopened.getByText('Generated current draft', { exact: true })
    ).toBeVisible({ timeout: 90000 });
    await reopened
      .getByRole('tab', { name: 'Footprint library', exact: true })
      .click();
    await reopened
      .getByRole('button', {
        name: `${manifest.entries[0].name} · r1`,
        exact: true,
      })
      .click();
    await expect(
      reopened.getByRole('spinbutton', { name: 'Model offset Z', exact: true })
    ).toHaveValue('1');
  } finally {
    await offlineContext.close();
  }
  expect(errors).toEqual([]);
});

test('inspects and exports BHK with a model assigned to all matching capacitors', async ({
  page,
}) => {
  const config = parseDocument(BHK.value);
  config.set('designs', parse(readFileSync(`${fixture}bhk-case.yaml`, 'utf8')));
  await page.setViewportSize({ width: 1487, height: 1058 });
  await page.addInitScript(
    (source) => localStorage.setItem('ergogen:config', JSON.stringify(source)),
    config.toString()
  );
  await page.goto('./');
  await expect(page.getByTestId('config-editor')).toBeVisible();
  await page
    .getByRole('button', { name: 'Create / edit case', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Case designer' });
  await dialog
    .getByRole('treeitem', { name: 'Capacitor_0603 (33)', exact: true })
    .click();
  await dialog.getByRole('button', { name: 'Replace', exact: true }).click();
  await dialog
    .getByLabel('Upload 3D models')
    .setInputFiles(`${fixture}${footprintName}.step`);
  await expect(dialog.getByLabel('Active model')).toContainText(footprintName);
  await expect(
    dialog.getByRole('button', { name: 'Replace', exact: true })
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
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
  await dialog.getByRole('checkbox', { name: /I reviewed dimensions/ }).check();
  const download = page.waitForEvent('download');
  await dialog
    .getByRole('button', { name: 'Download ZIP', exact: true })
    .click();
  await (await download).saveAs('test-results/cad-bhk-project.zip');
  const zip = await JSZip.loadAsync(
    readFileSync('test-results/cad-bhk-project.zip')
  );
  const source = parse(await zip.file('config.yaml')!.async('string'));
  expect(Object.keys(source.designs.assemblies.case.board.models)).toHaveLength(
    33
  );
  expect(zip.file('outputs/pcbs/bhk_pcb.kicad_pcb')).not.toBeNull();
});
