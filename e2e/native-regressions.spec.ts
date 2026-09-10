import { studio, openCase } from './utils/studio';
import { expect, test, Page } from '@playwright/test';
import { stringify } from 'yaml';
import {
  CONFIG_LOCAL_STORAGE_KEY,
  MULTI_CONFIG_STORAGE_KEY,
} from '../src/context/constants';
import { storageKey } from '../src/utils/storageKey';
import JSZip from 'jszip';
import { readFileSync } from 'node:fs';

const TIMEOUT = 120000;
test.setTimeout(TIMEOUT);
const board =
  '(kicad_pcb (general (thickness 1.6)) (gr_rect (start -40 -30) (end 40 30) (layer "Edge.Cuts")))';
const assembly = {
  preset: 'enclosure',
  profile: 'profiles.board',
  mounting: 'bottom',
  wall: 3,
  floor: 2,
  height: 24,
  bezel: 10,
  ledge: { width: 2, thickness: 2 },
};
const load = async (page: Page, config: unknown) => {
  await page.addInitScript(
    ({ source, key, multiKey, settingsKey }) => {
      localStorage.setItem(key, JSON.stringify(source));
      const timestamp = new Date().toISOString();
      localStorage.setItem(
        multiKey,
        JSON.stringify({
          version: 2,
          activeConfigId: 'regression',
          configs: [
            {
              id: 'regression',
              name: 'Native regression',
              config: source,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
        })
      );
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
      source: stringify(config),
      key: CONFIG_LOCAL_STORAGE_KEY,
      multiKey: MULTI_CONFIG_STORAGE_KEY,
      settingsKey: storageKey('ergogen:settings'),
    }
  );
  await page.goto('./');
  await expect(studio(page)).toBeVisible();
  await openCase(page);
  return page.getByRole('region', { name: 'Case designer' });
};

test('retains height blockers after cached mounting changes', async ({
  page,
}) => {
  const dialog = await load(page, {
    schema: 'ergogen/v1',
    layout: {
      layers: {
        floor: { surface: 'case.keyboard.floor', assembly: 'keyboard' },
      },
      objects: {
        battery: {
          kind: 'component',
          layer: 'floor',
          envelopes: { body: { size: [10, 8], height: [0, 40] } },
        },
      },
    },
    designs: {
      regions: { board: { shape: { size: [80, 60] } } },
      profiles: { board: { from: 'regions.board' } },
      assemblies: {
        keyboard: { ...assembly, board: { source: 'generated', name: 'main' } },
      },
    },
    pcbs: { main: { profile: 'profiles.board' } },
  });
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  const blocker = dialog
    .getByText(/battery exceeds the declared case height/)
    .first();
  await expect(blocker).toBeVisible({ timeout: TIMEOUT });
  await dialog.getByRole('button', { name: 'Mounting', exact: true }).click();
  const count = dialog.getByLabel('Mount / gasket count', { exact: true });
  await count.fill('4');
  await count.press('Tab');
  await expect(count).toHaveValue('4');
  await expect(
    dialog.getByText('Calculating mounting plan…', { exact: true })
  ).toHaveCount(0, { timeout: TIMEOUT });
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await expect(blocker).toBeVisible({ timeout: TIMEOUT });
  await dialog.getByRole('checkbox').check();
  for (const name of ['Download ZIP']) {
    await expect(
      dialog.getByRole('button', { name, exact: true })
    ).toBeDisabled();
  }
});

test('generates imported PCB with a native battery and shell opening', async ({
  page,
}) => {
  await page.goto('./new');
  await page.evaluate(
    async ({ name, source }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(name);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('assets');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('assets', 'readwrite');
          tx.objectStore('assets').put(source, 'board.kicad_pcb');
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    },
    { name: storageKey('ergogen-case-assets'), source: board }
  );
  const dialog = await load(page, {
    schema: 'ergogen/v1',
    layout: {
      layers: {
        floor: { surface: 'case.keyboard.floor', assembly: 'keyboard' },
      },
      objects: {
        battery: {
          kind: 'component',
          layer: 'floor',
          placement: { at: [-10, 0, 0.2] },
          envelopes: { body: { size: [10, 8], height: [0, 2] } },
        },
        port: {
          kind: 'component',
          layer: 'floor',
          placement: { at: [47, 0, 1] },
          envelopes: { service: { size: [20, 6], height: [0, 4] } },
        },
      },
    },
    designs: {
      assemblies: {
        keyboard: {
          ...assembly,
          profile: 'profiles.__pcb_keyboard',
          board: { source: 'asset', name: 'board.kicad_pcb' },
        },
      },
    },
  });
  await dialog
    .getByRole('button', { name: 'Manufacturing', exact: true })
    .click();
  for (const part of ['bottom', 'top', 'plate']) {
    await dialog
      .getByLabel(`${part} process`, { exact: true })
      .selectOption('fdm');
  }
  await expect(
    dialog.getByRole('button', { name: 'Generate', exact: true })
  ).toBeEnabled({ timeout: TIMEOUT });
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: TIMEOUT });
  await dialog.getByRole('button', { name: 'exploded', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true',
    { timeout: TIMEOUT }
  );
  await page.screenshot({
    path: test.info().outputPath('imported-native-assembly.png'),
  });
  await dialog.getByRole('button', { name: 'part', exact: true }).click();
  await dialog.getByRole('button', { name: 'bottom', exact: true }).click();
  const canvas = await dialog
    .getByLabel('3D assembly preview')
    .locator('canvas')
    .boundingBox();
  expect(canvas).not.toBeNull();
  await page.mouse.move(
    canvas!.x + canvas!.width * 0.8,
    canvas!.y + canvas!.height * 0.6
  );
  await page.mouse.down();
  await page.mouse.move(
    canvas!.x + canvas!.width * 0.8,
    canvas!.y + canvas!.height * 0.52,
    { steps: 20 }
  );
  await page.mouse.up();
  // Let the camera fit and orbit settle before recording the cut wall.
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: test.info().outputPath('imported-native-opening.png'),
  });
  await dialog
    .getByLabel('Inspect part', { exact: true })
    .selectOption('keyboard_components_native_battery');
  await expect(
    dialog.getByRole('treeitem', { name: 'battery', exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath('imported-native-battery.png'),
  });
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  const downloaded = page.waitForEvent('download');
  await dialog
    .getByRole('button', { name: 'Download ZIP', exact: true })
    .click();
  const archive = await JSZip.loadAsync(
    readFileSync((await (await downloaded).path())!)
  );
  expect(
    Object.keys(archive.files).some(
      (name) =>
        name.includes('components_native_battery') && name.endsWith('.stl')
    )
  ).toBe(true);
});
