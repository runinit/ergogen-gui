import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const board = `(kicad_pcb (version 20260206) (generator "test")
 (general (thickness 1.6)) (paper "A4")
 (layers (0 "F.Cu" signal) (2 "B.Cu" signal) (44 "Edge.Cuts" user))
 (footprint "test" (layer "F.Cu") (at 0 0)
  (pad "1" smd rect (at 0 0) (size 2 2) (layers "F.Cu") (net "123")))
 (segment (start 0 0) (end 5 0) (width 0.3) (layer "F.Cu") (net "123"))
 (gr_rect (start -3 -3) (end 8 3) (stroke (width 0.1) (type default)) (layer "Edge.Cuts")))`;

test('viewer reports malformed input then loads a native board', async ({
  page,
}) => {
  await page.goto('./');
  await page.addScriptTag({
    url: new URL(
      'dependencies/kicanvas.js?v=kicad10-unconnected-pads-1',
      page.url()
    ).href,
  });
  await page.evaluate(() => customElements.whenDefined('kicanvas-embed'));
  for (const [source, expected] of [
    ['(kicad_pcb (', 'error'],
    [board, 'load'],
  ]) {
    const result = await page.evaluate(async (pcb) => {
      document.querySelector('#release-viewer')?.remove();
      const viewer = document.createElement('kicanvas-embed');
      viewer.id = 'release-viewer';
      viewer.setAttribute('controls', 'full');
      const source = document.createElement('kicanvas-source');
      source.setAttribute('type', 'board');
      source.textContent = pcb;
      viewer.append(source);
      const result = new Promise<string>((resolve) => {
        viewer.addEventListener('kicanvas:load', () => resolve('load'), {
          once: true,
        });
        viewer.addEventListener('kicanvas:error', () => resolve('error'), {
          once: true,
        });
      });
      document.body.append(viewer);
      return result;
    }, source);
    expect(result).toBe(expected);
  }
  await expect(page.locator('#release-viewer canvas').first()).toBeVisible();
  await page.locator('#release-viewer kc-ui-focus-overlay').click();
  await page
    .locator('#release-viewer')
    .getByRole('button', { name: 'hub', exact: true })
    .click();
  await page.locator('#release-viewer kc-board-viewer').evaluate((element) => {
    const viewer = (
      element as HTMLElement & {
        viewer: { highlight_net: (net: number) => void };
      }
    ).viewer;
    const original = viewer.highlight_net.bind(viewer);
    viewer.highlight_net = (net: number) => {
      (window as Window & { selectedNet?: number }).selectedNet = net;
      original(net);
    };
  });
  await page.locator('#release-viewer kc-ui-menu-item[name="0"]').click();
  expect(
    await page.evaluate(
      () => (window as Window & { selectedNet?: number }).selectedNet
    )
  ).toBe(0);
});

test('viewer reports unavailable WebGL', async ({ page }) => {
  await page.goto('./');
  await page.addScriptTag({
    url: new URL(
      'dependencies/kicanvas.js?v=kicad10-unconnected-pads-1',
      page.url()
    ).href,
  });
  await page.evaluate(() => customElements.whenDefined('kicanvas-embed'));
  const result = await page.evaluate(async (pcb) => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
    const viewer = document.createElement('kicanvas-embed');
    const source = document.createElement('kicanvas-source');
    source.setAttribute('type', 'board');
    source.textContent = pcb;
    viewer.append(source);
    const result = new Promise<string>((resolve) => {
      viewer.addEventListener('kicanvas:load', () => resolve('load'), {
        once: true,
      });
      viewer.addEventListener('kicanvas:error', () => resolve('error'), {
        once: true,
      });
    });
    document.body.append(viewer);
    return result;
  }, board);
  expect(result).toBe('error');
});

if (process.env.BHK_PCB) {
  test('loads the BHK acceptance board', async ({ page }) => {
    await page.goto('./');
    await page.addScriptTag({
      url: new URL(
        'dependencies/kicanvas.js?v=kicad10-unconnected-pads-1',
        page.url()
      ).href,
    });
    await page.evaluate(() => customElements.whenDefined('kicanvas-embed'));
    const pcb = readFileSync(process.env.BHK_PCB!, 'utf8');
    const result = await page.evaluate(async (pcb) => {
      const viewer = document.createElement('kicanvas-embed');
      viewer.setAttribute('controls', 'full');
      const source = document.createElement('kicanvas-source');
      source.setAttribute('type', 'board');
      source.textContent = pcb;
      viewer.append(source);
      const result = new Promise<string>((resolve) => {
        viewer.addEventListener('kicanvas:load', () => resolve('load'), {
          once: true,
        });
        viewer.addEventListener(
          'kicanvas:error',
          (event) => resolve(JSON.stringify((event as CustomEvent).detail)),
          { once: true }
        );
      });
      document.body.replaceChildren(viewer);
      return result;
    }, pcb);
    expect(result).toBe('load');
    await expect(page.locator('canvas').first()).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('bhk.png') });
  });
}
