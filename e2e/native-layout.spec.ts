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
const source = (page: Page) =>
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
  await expect(page.getByTestId('config-editor')).toBeVisible();
  await page.waitForFunction(
    () => !!(window as unknown as { monaco?: unknown }).monaco
  );
};
const openLayout = async (page: Page) => {
  await page
    .getByRole('button', { name: 'Open design editor', exact: true })
    .first()
    .click();
  await expect(page.getByLabel('Layout object')).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: /objects ·/ })
  ).toBeVisible({ timeout: TIMEOUT });
};

test('edits local key overrides, preserves arrangements, and enforces locks', async ({
  page,
}) => {
  await load(page, Columns.value);
  await openLayout(page);
  await page.getByLabel('Layout object').selectOption('outer_home');
  await page.getByLabel('Layout X', { exact: true }).fill('5');
  await page.getByLabel('Layout X', { exact: true }).press('Tab');
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
  await expect(page.getByLabel('Layout X', { exact: true })).toBeDisabled();
  await page.screenshot({
    path: test.info().outputPath('native-layout-top.png'),
  });
  await page.getByLabel('Locked', { exact: true }).uncheck();
  await expect(page.getByLabel('Layout X', { exact: true })).toBeEnabled();
  await expect(
    page.getByRole('status').filter({ hasText: /objects ·/ })
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
  await page.evaluate(() =>
    (
      window as unknown as {
        monaco: { editor: { getModels(): { undo(): void }[] } };
      }
    ).monaco.editor
      .getModels()[0]
      .undo()
  );
  await expect.poll(() => source(page)).toBe(beforeMove);
  await expect(page.getByLabel('Layout X', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel('Layout X', { exact: true })).toBeEnabled();
  await expect(
    page.getByRole('status').filter({ hasText: /objects ·/ })
  ).toBeVisible();
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
  await expect(page.getByLabel('Layout X', { exact: true })).toHaveValue(
    String(Number(movedX.toFixed(4)))
  );
  await expect(page.getByLabel('Layout X', { exact: true })).toBeEnabled();
  await page.evaluate(() =>
    (
      window as unknown as {
        monaco: { editor: { getModels(): { undo(): void }[] } };
      }
    ).monaco.editor
      .getModels()[0]
      .undo()
  );
  await expect.poll(() => source(page)).toBe(beforeMove);
});

test('shows independent floor and PCB layers in side view and generates their assembly', async ({
  page,
}) => {
  await load(page, Stack.value);
  await openLayout(page);
  await page
    .getByRole('combobox', { name: 'View', exact: true })
    .selectOption('side');
  await page.getByLabel('Layout object').selectOption('battery');
  await expect(page.getByLabel('Mounting layer', { exact: true })).toHaveValue(
    'floor'
  );
  await expect(page.getByLabel('Layout Z', { exact: true })).toHaveValue('2.5');
  await page.getByLabel('Layout object').selectOption('screen');
  await expect(page.getByLabel('Mounting layer', { exact: true })).toHaveValue(
    'switches'
  );
  await expect(page.getByLabel('Layout Z', { exact: true })).toHaveValue(
    '12.6'
  );
  await page.screenshot({
    path: test.info().outputPath('native-layout-side.png'),
  });
  await page
    .getByRole('button', { name: 'Create / edit case', exact: true })
    .first()
    .click();
  const dialog = page.getByRole('dialog', { name: 'Case designer' });
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
