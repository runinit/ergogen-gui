import { expect, test } from '@playwright/test';

test('reloads the application offline under the deployment path', async ({
  page,
  context,
}) => {
  await page.goto('./new');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByTestId('welcome-page-wrapper')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller))
    )
    .toBe(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.getByTestId('welcome-page-wrapper')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});

test('ignores a stale dependency cache after upgrading', async ({ page }) => {
  await page.goto('./new');
  await page.evaluate(async () => {
    const cache = await caches.open('public-dependencies-v1');
    await cache.put(
      new URL('dependencies/kicanvas.js', document.baseURI),
      new Response('window.staleViewer = true;')
    );
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.addScriptTag({
    url: new URL(
      'dependencies/kicanvas.js?v=kicad10-unconnected-pads-1',
      page.url()
    ).href,
  });
  const viewer = await page.evaluate(async () => {
    await customElements.whenDefined('kicanvas-embed');
    return {
      stale: Boolean(
        (window as Window & { staleViewer?: boolean }).staleViewer
      ),
      source: await fetch(
        new URL('dependencies/kicanvas.js', document.baseURI)
      ).then((response) => response.text()),
    };
  });
  expect(viewer.stale).toBe(false);
  expect(viewer.source).not.toContain('window.staleViewer = true');
});

if (process.env.BHK_INPUT) {
  test('regenerates BHK and downloads identical bytes offline', async ({
    page,
    context,
  }) => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const input = process.env.BHK_INPUT!;
    const config = readFileSync(`${input}/config.yaml`, 'utf8');
    const injection = readdirSync(`${input}/footprints/bhkfp`).map((file) => [
      'footprint',
      `bhkfp/${file.replace(/\.js$/, '')}`,
      readFileSync(`${input}/footprints/bhkfp/${file}`, 'utf8'),
    ]);
    await page.goto('./new');
    await page.evaluate(
      ({ config, injection }) => {
        localStorage.clear();
        localStorage.setItem(
          location.pathname.startsWith('/ergogen-gui-preview/')
            ? 'preview:ergogen:config'
            : 'ergogen:config',
          JSON.stringify(config)
        );
        localStorage.setItem(
          location.pathname.startsWith('/ergogen-gui-preview/')
            ? 'preview:ergogen:injection'
            : 'ergogen:injection',
          JSON.stringify(injection)
        );
      },
      { config, injection }
    );
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto('./');
    const downloadButton = page.getByTestId(
      'downloads-container-bhk_pcb-kicad_pcb-download'
    );
    await expect(downloadButton).toBeVisible();
    const getBytes = async () => {
      const pending = page.waitForEvent('download');
      await downloadButton.click();
      const download = await pending;
      return readFileSync((await download.path())!);
    };
    const online = await getBytes();
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(downloadButton).toBeVisible();
      expect(await getBytes()).toEqual(online);
      await page
        .getByTestId('downloads-container-bhk_pcb-kicad_pcb-preview')
        .click();
      await expect(page.locator('kicanvas-embed canvas').first()).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
}
