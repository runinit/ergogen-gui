import { test, expect } from '@playwright/test';
import Columns from '../src/examples/columns';
import Stack from '../src/examples/physical-stack';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';
import {
  studio,
  openCase,
  openExport,
  openLibrary,
  readSource,
} from './utils/studio';

test.setTimeout(120000);

test('keeps navigation, selection and camera through Settings without editing source', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, source }) => localStorage.setItem(key, JSON.stringify(source)),
    { key: CONFIG_LOCAL_STORAGE_KEY, source: Columns.value }
  );
  await page.goto('./');
  const workflow = studio(page).getByRole('navigation', {
    name: 'Design workflow',
  });
  await expect(
    workflow.getByRole('button', { name: /^(Design|PCB|Case|Export)$/ })
  ).toHaveText(['Design', 'PCB', 'Case', 'Export']);
  await expect(
    page.getByRole('button', { name: 'Select outer_home', exact: true })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Select outer_home', exact: true })
    .click();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const canvas = page.getByRole('group', { name: 'Interactive board layout' });
  const camera = await canvas.getAttribute('viewBox');
  const before = await readSource(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Project settings' });
  await expect(settings).toBeVisible();
  await expect(page.getByRole('banner')).toHaveCount(0);
  await expect(
    settings.getByText('Footprint code', { exact: true })
  ).toHaveCount(0);
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await expect(
    page.getByRole('button', { name: 'Settings', exact: true })
  ).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Select outer_home', exact: true })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('viewBox', camera!);
  expect(await readSource(page)).toBe(before);

  await workflow.getByRole('button', { name: 'Case', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Create case', exact: true })
  ).toBeVisible();
  expect(await readSource(page)).toBe(before);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await settings.press('Escape');
  await expect(
    workflow.getByRole('button', { name: 'Case', exact: true })
  ).toHaveAttribute('aria-current', 'step');
  expect(await readSource(page)).toBe(before);

  await page.setViewportSize({ width: 390, height: 844 });
  await workflow.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download YAML' })
  ).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('export-narrow.png') });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(
    settings.getByRole('button', { name: 'Close settings' })
  ).toBeInViewport();
  await page.screenshot({
    path: test.info().outputPath('settings-narrow.png'),
  });
  await settings.getByRole('button', { name: 'Close settings' }).click();
  await workflow.getByRole('button', { name: 'Design', exact: true }).click();
  await page.screenshot({ path: test.info().outputPath('design-narrow.png') });
});

test('retains generated case outputs across Code, library and Export', async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, source }) => localStorage.setItem(key, JSON.stringify(source)),
    { key: CONFIG_LOCAL_STORAGE_KEY, source: Stack.value }
  );
  await page.goto('./');
  let designer = await openCase(page);
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
  await expect(generate).toBeEnabled({ timeout: 90000 });
  await expect(
    designer.getByRole('button', { name: 'Generate', exact: true })
  ).toHaveCount(0);
  await generate.click();
  await expect(
    designer.getByRole('status').filter({ hasText: /Current geometry/ })
  ).toBeVisible({ timeout: 90000 });
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await expect(
    designer.getByRole('status').filter({ hasText: /Current geometry/ })
  ).toBeVisible();

  await openLibrary(page);
  const outputs = await openExport(page);
  await outputs
    .getByRole('checkbox', { name: /I reviewed dimensions/ })
    .check();
  await expect(
    outputs.getByRole('button', { name: 'Download case ZIP' })
  ).toBeEnabled();
  await outputs
    .getByRole('button', { name: 'Review case and manufacturing' })
    .click();
  designer = page.getByRole('region', { name: 'Case designer' });
  await expect(
    designer.getByRole('status').filter({ hasText: /Current geometry/ })
  ).toBeVisible();
  await designer
    .getByRole('button', { name: 'assembled', exact: true })
    .click();
  await expect(designer.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true'
  );
  await designer
    .getByRole('button', { name: 'Enclosure', exact: true })
    .click();
  await designer.getByLabel('Wall thickness (mm)', { exact: true }).fill('3.2');
  await designer
    .getByLabel('Wall thickness (mm)', { exact: true })
    .press('Tab');
  await openExport(page);
  await expect(
    outputs.getByRole('button', { name: 'Download case ZIP' })
  ).toBeDisabled();
  await expect(
    outputs.getByRole('button', { name: 'Download PCB and outlines ZIP' })
  ).toBeEnabled({ timeout: 90000 });
});
