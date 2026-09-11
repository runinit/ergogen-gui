import { studio, openCase, readSource } from './utils/studio';
import {
  CONFIG_LOCAL_STORAGE_KEY,
  MULTI_CONFIG_STORAGE_KEY,
} from '../src/context/constants';
import { storageKey } from '../src/utils/storageKey';
import { expect, test, Page } from '@playwright/test';
import Stack from '../src/examples/physical-stack';
import Columns from '../src/examples/columns';
import { parse } from 'yaml';
import { compileSetup, defaultSetup } from '../src/utils/designSetup';
import { setupBaseline } from '../src/utils/setupRepair';
import { setValue } from '../src/utils/studioSource';

const TIMEOUT = 120000;
test.setTimeout(TIMEOUT);
const source = readSource;
const load = async (page: Page, config: string) => {
  await page.addInitScript(
    ({ config, configKey, multiKey, settingsKey }) => {
      localStorage.setItem(configKey, JSON.stringify(config));
      if (config.startsWith('schema: ergogen/v1')) {
        const id = 'native-test';
        const timestamp = new Date().toISOString();
        localStorage.setItem(
          multiKey,
          JSON.stringify({
            version: 2,
            activeConfigId: id,
            configs: [
              {
                id,
                name: 'Native layout',
                config,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
            ],
          })
        );
      }
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          autoGen: false,
          autoGen3D: false,
          debug: true,
          sendUsageMetrics: false,
        })
      );
    },
    {
      config,
      configKey: CONFIG_LOCAL_STORAGE_KEY,
      multiKey: MULTI_CONFIG_STORAGE_KEY,
      settingsKey: storageKey('ergogen:settings'),
    }
  );
  await page.goto('./');
  await expect(
    config.includes('ergogen/v1')
      ? studio(page)
      : page.getByTestId('config-editor')
  ).toBeVisible();
};
const openLayout = async (page: Page) => {
  await expect(studio(page)).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Interactive board layout' })
  ).toBeVisible();
};

test('edits local key overrides, preserves arrangements, and enforces locks', async ({
  page,
}) => {
  await load(page, Columns.value);
  await openLayout(page);
  await page
    .getByRole('button', { name: 'Select Objects', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Select outer_home', exact: true })
    .click();
  await page.getByLabel('X', { exact: true }).fill('5');
  await page.getByLabel('X', { exact: true }).press('Tab');
  await expect
    .poll(
      async () =>
        parse(await source(page)).layout.objects.outer_home.placement?.override
          ?.at?.[0]
    )
    .toBe(5);
  expect(parse(await source(page)).layout.clusters).toEqual(
    parse(Columns.value).layout.clusters
  );
  await expect(page.getByLabel('Locked', { exact: true })).toBeEnabled();
  await page.getByLabel('Locked', { exact: true }).check();
  await expect(page.getByLabel('X', { exact: true })).toBeDisabled();
  await page.screenshot({
    path: test.info().outputPath('native-layout-top.png'),
  });
  await page.getByLabel('Locked', { exact: true }).uncheck();
  await expect(page.getByLabel('X', { exact: true })).toBeEnabled();
  await expect(
    page.getByRole('status').filter({ hasText: /Layout resolved/ })
  ).toBeVisible();
  const beforeMove = await source(page);
  const key = page.getByRole('button', {
    name: 'Select outer_home',
    exact: true,
  });
  await key.focus();
  await key.press('ArrowRight');
  await expect
    .poll(
      async () =>
        parse(await source(page)).layout.objects.outer_home.placement.override
          .at[0]
    )
    .toBe(6);
  await page.getByRole('button', { name: 'Undo project edit' }).click();
  await expect.poll(() => source(page)).toBe(beforeMove);
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel('X', { exact: true })).toBeEnabled();
  await expect(
    page.getByRole('status').filter({ hasText: /Layout resolved/ })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Select Objects', exact: true })
    .click();
  // This test exercises free placement, independent of spacing constraints.
  await page.keyboard.down('Alt');
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 18,
    box.y + box.height / 2 - 12,
    { steps: 4 }
  );
  await page.mouse.up();
  await page.keyboard.up('Alt');
  await expect.poll(() => source(page)).not.toBe(beforeMove);
  const movedX = parse(await source(page)).layout.objects.outer_home.placement
    .override.at[0];
  await expect(page.getByLabel('X', { exact: true })).toHaveValue(
    String(movedX)
  );
  await expect(page.getByLabel('X', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo project edit' }).click();
  await expect.poll(() => source(page)).toBe(beforeMove);
});

test('shows independent floor and PCB layers in side view and generates their assembly', async ({
  page,
}) => {
  await load(page, Stack.value);
  await openLayout(page);
  await page.getByRole('button', { name: 'Side', exact: true }).click();
  await page
    .getByRole('button', { name: 'Select battery', exact: true })
    .click();
  await expect(page.getByLabel('Mounting layer', { exact: true })).toHaveValue(
    'floor'
  );
  await expect(page.getByText('= 2.5 mm', { exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: 'Select screen', exact: true })
    .press('Enter');
  await expect(page.getByLabel('Mounting layer', { exact: true })).toHaveValue(
    'switches'
  );
  await expect(page.getByText('= 12.6 mm', { exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('native-layout-side.png'),
  });
  await openCase(page);
  const dialog = page.getByRole('region', { name: 'Case designer' });
  await expect(
    page.getByRole('button', { name: 'Generate project', exact: true })
  ).toBeEnabled({ timeout: TIMEOUT });
  await page
    .getByRole('button', { name: 'Generate project', exact: true })
    .click();
  await expect(
    dialog.getByRole('status').filter({ hasText: /Current geometry/ })
  ).toBeVisible({ timeout: TIMEOUT });
  await dialog.getByRole('button', { name: 'assembled', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true',
    { timeout: TIMEOUT }
  );
  await page.screenshot({
    path: test.info().outputPath('native-stack-assembly.png'),
  });
  await expect(
    dialog.getByRole('treeitem', { name: 'battery (1)', exact: true })
  ).toBeVisible();
  await expect(
    dialog.getByText(/Current geometry · 7 components/)
  ).toBeVisible();
});

test('preserves a legacy source while rejecting generation', async ({
  page,
}) => {
  const legacy = '# Preserve this source\npoints: {zones: {key: {}}}\n';
  await load(page, legacy);
  await expect(
    page.getByText(/This engine accepts schema: ergogen\/v1 only/).first()
  ).toBeVisible({ timeout: TIMEOUT });
  expect(await source(page)).toBe(legacy);
  await expect(
    page.getByTestId('downloads-container-main-kicad_pcb-download')
  ).toHaveCount(0);
});

test('moves an alias from its existing offset and restores the alias with undo', async ({
  page,
}) => {
  const original = `schema: ergogen/v1
layout:
  objects:
    original: &key {kind: key, envelopes: {pcb: {size: [18, 18]}}, placement: {override: {at: [10, 0, 0]}}}
    copy: *key # preserve alias
`;
  await load(page, original);
  await openLayout(page);
  await page.getByRole('button', { name: 'Select copy', exact: true }).click();
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('10');
  await page.getByLabel('X', { exact: true }).fill('12');
  await page.getByLabel('X', { exact: true }).press('Tab');
  await expect
    .poll(
      async () =>
        parse(await source(page)).layout.objects.copy.placement.override.at[0]
    )
    .toBe(12);
  await expect(page.getByLabel('X', { exact: true })).toHaveValue('12');
  await expect(page.getByLabel('X', { exact: true })).toBeEnabled();
  expect(
    parse(await source(page)).layout.objects.original.placement.override.at[0]
  ).toBe(10);
  await page.getByRole('button', { name: 'Undo project edit' }).click();
  await expect.poll(() => source(page)).toBe(original);
});

test('grows an onboarding matrix and adds an owned thumb assembly', async ({
  page,
}) => {
  await load(
    page,
    compileSetup({ ...defaultSetup(), columns: 2, rows: 1, led: true })
  );
  await page
    .getByRole('button', { name: 'fingers 2 keys', exact: true })
    .click();
  await page.getByLabel('Matrix columns').fill('3');
  await page.getByLabel('Matrix columns').press('Tab');
  await expect
    .poll(
      async () =>
        parse(await source(page)).layout.objects.fingers_c3_r1_diode?.footprints
          .main.params.to
    )
    .toBe('R1');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByLabel('New item kind').selectOption('arc');
  await page.getByLabel('New item name').fill('thumbs');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'thumbs 3 keys', exact: true })
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        parse(await source(page)).layout.objects.thumbs_0_led?.properties.owner
    )
    .toBe('thumbs_0');
  await expect(
    page.getByRole('status').filter({ hasText: /Layout resolved/ })
  ).toBeVisible({ timeout: TIMEOUT });
  await page.screenshot({
    path: test.info().outputPath('onboarding-growth.png'),
  });
});
test('cancels, confirms and undoes removal of an edited column', async ({
  page,
}) => {
  const initial = setValue(
    compileSetup({ ...defaultSetup(), columns: 2, rows: 1, led: true }),
    ['layout', 'objects', 'fingers_c2_r1', 'placement'],
    { override: { at: [2, 0, 0] } }
  );
  await load(page, initial);
  await page
    .getByRole('button', { name: 'fingers 2 keys', exact: true })
    .click();
  const columns = page.getByLabel('Matrix columns');
  await columns.fill('1');
  await columns.press('Tab');
  const review = page.getByRole('dialog', { name: 'Review matrix resize' });
  await expect(review).toBeVisible();
  expect(await source(page)).toBe(initial);
  await review.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(columns).toHaveValue('2');
  expect(await source(page)).toBe(initial);
  await columns.fill('1');
  await columns.press('Tab');
  await page.screenshot({ path: test.info().outputPath('resize-review.png') });
  await review.getByRole('button', { name: 'Remove keys and resize' }).click();
  await expect
    .poll(async () => parse(await source(page)).layout.objects.fingers_c2_r1)
    .toBeUndefined();
  expect(
    parse(await source(page)).layout.objects.fingers_c2_r1_led
  ).toBeUndefined();
  await page.getByRole('button', { name: 'Undo project edit' }).click();
  await expect.poll(() => source(page)).toBe(initial);
});
test('repairs a published setup draft on a narrow screen without touching custom nets', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const initial = setValue(
    setupBaseline({ ...defaultSetup(), columns: 2, rows: 1, led: true }, 1),
    [
      'layout',
      'objects',
      'fingers_c2_r1_led',
      'footprints',
      'main',
      'params',
      'P4',
    ],
    'CUSTOM'
  );
  await load(page, initial);
  await expect
    .poll(async () => parse(await source(page)).meta.studio.setupRevision)
    .toBe(2);
  const doc = parse(await source(page));
  expect(doc.layout.objects.fingers_c1_r1_led.footprints.main.params.P4).toBe(
    'LED_DATA'
  );
  expect(doc.layout.objects.fingers_c2_r1_led.footprints.main.params.P4).toBe(
    'CUSTOM'
  );
  expect(doc.designs.regions.main.envelope).toBe('keycap');
  await page.reload();
  await expect(studio(page)).toBeVisible();
  expect(
    parse(await source(page)).layout.objects.fingers_c2_r1_led.footprints.main
      .params.P4
  ).toBe('CUSTOM');
});
