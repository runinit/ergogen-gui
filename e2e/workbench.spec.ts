import { test, expect } from '@playwright/test';
import columns from '../src/examples/columns';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';
import { openLibrary } from './utils/studio';

test('keeps mobile library actions out of the desktop editor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(
    ({ key, source }) => {
      localStorage.setItem(key, JSON.stringify(source));
    },
    { key: CONFIG_LOCAL_STORAGE_KEY, source: columns.value }
  );
  await page.goto('./');
  await openLibrary(page);
  await expect(
    page.getByRole('button', { name: 'Catalog', exact: true })
  ).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Close catalog', exact: true })
  ).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Close inspector', exact: true })
  ).toBeHidden();
});

test('retains an edited bundled part when browsing other parts', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(
    ({ key, source }) => {
      localStorage.setItem(key, JSON.stringify(source));
    },
    { key: CONFIG_LOCAL_STORAGE_KEY, source: columns.value }
  );
  await page.goto('./');
  await openLibrary(page);
  const capacitor = page.getByRole('button', { name: /^bhkfp\/cap_0603/ });
  await capacitor.click();
  const offset = page.getByRole('spinbutton', {
    name: 'Model offset X',
    exact: true,
  });
  await offset.fill('4');
  await offset.blur();
  await page
    .getByRole('button', { name: /^ceoloide\/diode_tht_sod123/ })
    .click();
  await capacitor.click();
  await expect(offset).toHaveValue('4');
  await page
    .getByRole('button', { name: 'Undo footprint edit', exact: true })
    .click();
  await expect(offset).toHaveValue('0');
});

test('retains the part editor draft when returning from board editing', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(
    ({ key, source }) => {
      localStorage.setItem(key, JSON.stringify(source));
    },
    { key: CONFIG_LOCAL_STORAGE_KEY, source: columns.value }
  );
  await page.goto('./');
  await openLibrary(page);
  await page.getByRole('button', { name: /^bhkfp\/cap_0603/ }).click();
  const offset = page.getByRole('spinbutton', {
    name: 'Model offset X',
    exact: true,
  });
  await offset.fill('4');
  await offset.blur();
  await page
    .getByRole('button', { name: 'Back to design', exact: true })
    .click();
  await page.getByRole('button', { name: 'Part library', exact: true }).click();
  await expect(offset).toHaveValue('4');
});

for (const width of [320, 390]) {
  test(`uses complete mobile drawers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(
      ({ key, source }) => localStorage.setItem(key, JSON.stringify(source)),
      { key: CONFIG_LOCAL_STORAGE_KEY, source: columns.value }
    );
    await page.goto('./');
    await page.getByRole('button', { name: 'Inspector', exact: true }).click();
    const board = page.getByRole('complementary', { name: 'Design inspector' });
    await expect(board).toBeVisible();
    expect((await board.boundingBox())?.width).toBeCloseTo(width);
    await expect(board.getByLabel('Current selection')).toBeVisible();
    await board.getByRole('button', { name: 'Close inspector' }).click();
    await openLibrary(page);
    await page.getByRole('button', { name: 'Catalog', exact: true }).click();
    const catalog = page.getByRole('complementary', {
      name: 'Footprint library catalog',
    });
    expect((await catalog.boundingBox())?.width).toBeCloseTo(width);
    await catalog
      .getByRole('button', { name: /^ceoloide\/battery_connector_molex/ })
      .click();
    const inspector = page.getByRole('complementary', {
      name: 'Footprint inspector',
    });
    expect((await inspector.boundingBox())?.width).toBeCloseTo(width);
    const heading = inspector.getByRole('heading', { level: 2 });
    await expect(heading).toBeInViewport();
    const bounds = await heading.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await expect(
      inspector.getByRole('button', { name: 'Close inspector' })
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBe(width);
    for (const name of [
      'Projects',
      'Undo project edit',
      'Redo project edit',
      'Code',
      'Generate project',
      'Settings',
    ]) {
      await expect(
        page.getByRole('button', { name, exact: true })
      ).toBeInViewport();
    }
  });
}
