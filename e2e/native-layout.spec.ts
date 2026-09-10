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
  await page.getByRole('button', { name: 'Move', exact: true }).click();
  const box = (await key.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 18,
    box.y + box.height / 2 - 12,
    { steps: 4 }
  );
  await page.mouse.up();
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
    .click();
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
    dialog.getByRole('button', { name: 'Generate', exact: true })
  ).toBeEnabled({ timeout: TIMEOUT });
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
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
