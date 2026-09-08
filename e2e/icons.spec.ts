import { expect, test } from '@playwright/test';

test('hosts fonts locally, including the PCB viewer', async ({ page }) => {
  const externalFonts: string[] = [];
  page.on('request', (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) {
      externalFonts.push(request.url());
    }
  });

  await page.goto('./new');
  await page.evaluate(() => customElements.whenDefined('kicanvas-embed'));
  await page.evaluate(() => document.fonts.ready);
  expect(externalFonts).toEqual([]);
});

test('renders icons when the browser cannot use web fonts', async ({
  page,
}) => {
  await page.route(
    /fonts\.(googleapis|gstatic)\.com|\.(woff2?|ttf)(\?|$)/,
    (route) => route.abort()
  );
  await page.goto('./new');
  const navigation = page.getByRole('button', {
    name: 'Show navigation panel',
  });
  await expect(navigation).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const icon = navigation.locator('.material-symbols-outlined');
  const bounds = await icon.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(bounds!.height * 1.5);
  await navigation.click();
  await page.screenshot({
    path: test.info().outputPath('no-fonts.png'),
    animations: 'disabled',
  });
});

test('renders menu icons with external fonts blocked', async ({ page }) => {
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.abort()
  );
  await page.goto('./new');
  await page.evaluate(() => document.fonts.ready);

  const navigation = page.getByRole('button', {
    name: 'Show navigation panel',
  });
  const icon = navigation.locator('.material-symbols-outlined');
  const size = await icon.boundingBox();
  expect(size).not.toBeNull();
  expect(size!.width).toBeLessThanOrEqual(size!.height * 1.5);

  const provider = page.getByRole('button', {
    name: 'Repository provider source',
  });
  await provider.click();
  await page.getByText('Codeberg', { exact: true }).click();
  await page.screenshot({
    path: test.info().outputPath('welcome.png'),
    animations: 'disabled',
  });
  await page.getByText('Empty Configuration', { exact: true }).click();
  await expect(page.getByTestId('config-editor')).toBeVisible();
  await navigation.click();
  const icons = page.locator('.material-symbols-outlined:visible');
  for (const item of await icons.all()) {
    const bounds = await item.boundingBox();
    expect(bounds!.width, await item.textContent()).toBeLessThanOrEqual(
      bounds!.height * 1.5
    );
  }
  await page.screenshot({
    path: test.info().outputPath('sidebar.png'),
    animations: 'disabled',
  });
});

test('loads the bundled icon font offline', async ({ page, context }) => {
  await page.goto('./new');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const icon = page
    .getByRole('button', { name: 'Show navigation panel' })
    .locator('.material-symbols-outlined');
  await expect(icon).toBeVisible();
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(icon).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const offline = await icon.boundingBox();
    expect(offline!.width).toBeLessThanOrEqual(offline!.height * 1.5);
  } finally {
    await context.setOffline(false);
  }
});
