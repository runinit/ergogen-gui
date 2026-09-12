import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import NativeStack from '../src/examples/physical-stack';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';
import { studio, openCode, openCase, openExport } from './utils/studio';

const TIMEOUT = 120000;
test.setTimeout(TIMEOUT);
test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    ({ config, key }) => localStorage.setItem(key, JSON.stringify(config)),
    { config: NativeStack.value, key: CONFIG_LOCAL_STORAGE_KEY }
  );
  await page.goto('./');
  await expect(studio(page)).toBeVisible();
});

test('loads the physical stack source and export controls', async ({
  page,
}) => {
  await openCode(page);
  await page
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'Export', exact: true })
    .click();
  await expect(
    page.getByRole('button', {
      name: 'Download PCB and outlines ZIP',
      exact: true,
    })
  ).toBeEnabled({ timeout: TIMEOUT });
});

test('downloads the physical stack board outline', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'Export', exact: true })
    .click();
  const button = page.getByRole('button', { name: / · DXF$/ }).first();
  await expect(button).toBeEnabled({ timeout: TIMEOUT });
  const pending = page.waitForEvent('download');
  await button.click();
  const download = await pending;
  expect(readFileSync((await download.path())!, 'utf8')).toContain('SECTION');
});

test('renders the physical stack KiCad PCB', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'PCB', exact: true })
    .click();
  await page.getByRole('button', { name: 'KiCad PCB', exact: true }).click();
  await expect(page.locator('kicanvas-embed canvas').first()).toBeVisible({
    timeout: TIMEOUT,
  });
  await expect(page.getByText(/PCB preview unavailable/)).toHaveCount(0);
});

test('generates distinct physical stack STL parts and previews them', async ({
  page,
}) => {
  const designer = await openCase(page);
  await designer
    .getByRole('button', { name: 'Manufacturing', exact: true })
    .click();
  for (const part of ['bottom', 'top', 'plate']) {
    await designer
      .getByLabel(`${part} process`, { exact: true })
      .selectOption('fdm');
  }
  const generate = page.getByRole('button', {
    name: 'Generate project',
    exact: true,
  });
  await expect(generate).toBeEnabled({ timeout: TIMEOUT });
  await generate.click();
  await expect(
    designer.getByRole('status').filter({ hasText: /Current geometry/ })
  ).toBeVisible({ timeout: TIMEOUT });
  await designer.getByRole('button', { name: 'part', exact: true }).click();
  for (const name of ['bottom', 'plate']) {
    await designer.getByRole('button', { name, exact: true }).click();
    await expect(designer.getByLabel('3D assembly preview')).toHaveAttribute(
      'data-rendered',
      'true'
    );
  }
  await designer.getByRole('button', { name: 'Review', exact: true }).click();
  const exportView = await openExport(page);
  await exportView
    .getByRole('checkbox', { name: /I reviewed dimensions/ })
    .check();
  const download = exportView.getByRole('button', {
    name: 'Download case ZIP',
    exact: true,
  });
  await expect(download).toBeEnabled();
  const pending = page.waitForEvent('download');
  await download.click();
  const archive = await JSZip.loadAsync(
    readFileSync((await (await pending).path())!)
  );
  const stls = Object.keys(archive.files).filter((name) =>
    /_(bottom|plate)\.stl$/.test(name)
  );
  expect(stls).toHaveLength(2);
  const parts = await Promise.all(
    stls.map((name) => archive.file(name)!.async('uint8array'))
  );
  expect(parts[0].length).toBeGreaterThan(84);
  expect(parts[1].length).toBeGreaterThan(84);
  expect(parts[0]).not.toEqual(parts[1]);
});
