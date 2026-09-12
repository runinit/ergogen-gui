import { resolve } from 'ergogen/src/native/layout';
import { test, expect } from '@playwright/test';
import { parse } from 'yaml';
import { compileSetup, defaultSetup } from '../src/utils/designSetup';
import { addCluster, addOutline, setValue } from '../src/utils/studioSource';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';
import { readSource } from './utils/studio';

const TIMEOUT = 120000;
const ANALYSIS_DELAY = 800;
test.setTimeout(TIMEOUT);
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 390, height: 844 },
]) {
  test(`docked or drawer inspector and batched resizing at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    let source = compileSetup({
      ...defaultSetup(),
      columns: 7,
      rows: 5,
      diode: false,
    });
    source = addCluster(source, 'thumbs', 'columns', { columns: 2, rows: 2 });
    source = setValue(source, ['layout', 'clusters', 'thumbs', 'placement'], {
      at: [95.25, -38.1, 0],
    });
    source = addOutline(source, 'main', resolve(parse(source)), 'replace');
    await page.addInitScript(
      ({ key, source, delay }) => {
        localStorage.setItem(key, JSON.stringify(source));
        // Delay worker deliveries, keeping rapid edits ahead of background analysis.
        const descriptor = Object.getOwnPropertyDescriptor(
          Worker.prototype,
          'onmessage'
        )!;
        Object.defineProperty(Worker.prototype, 'onmessage', {
          configurable: true,
          get: descriptor.get,
          set(handler) {
            descriptor.set!.call(
              this,
              handler &&
                ((event: MessageEvent) =>
                  setTimeout(() => handler.call(this, event), delay))
            );
          },
        });
      },
      { key: CONFIG_LOCAL_STORAGE_KEY, source, delay: ANALYSIS_DELAY }
    );
    await page.goto('./');
    const key = page.locator('[data-object="fingers_c1_r1"]');
    await expect(key).toBeVisible({ timeout: TIMEOUT });
    const trigger = page.getByRole('button', {
      name: 'Inspector',
      exact: true,
    });
    const panel = page.getByRole('complementary', { name: 'Design inspector' });
    const canvas = page.getByRole('group', {
      name: 'Interactive board layout',
    });
    await page
      .getByRole('button', { name: 'Select Columns', exact: true })
      .click();
    await key.focus();
    await key.press('Enter');
    await expect(trigger).toHaveAttribute(
      'aria-expanded',
      viewport.width > 1050 ? 'true' : 'false'
    );
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    const camera = await canvas.getAttribute('viewBox');
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(panel).toBeVisible();
    const size = panel.getByLabel('Selection key size', { exact: true });
    for (const value of ['mx-1.5', 'mx-1', 'mx-1.5']) {
      await size.selectOption(value);
    }
    await expect
      .poll(
        async () =>
          parse(await readSource(page)).layout.objects.fingers_c1_r1.envelopes
            .keycap.size
      )
      .toEqual([27.525, 18]);
    await expect(canvas).toHaveAttribute('viewBox', camera!);
    await trigger.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(panel).toBeHidden();
    await trigger.click();
    await expect(size).toBeVisible();
    if (viewport.width <= 1050) {
      await panel.getByRole('button', { name: 'Browse objects' }).click();
    }
    await expect(
      panel.getByRole('button', { name: 'Add', exact: true })
    ).toBeVisible();
    await expect(
      panel.getByRole('button', { name: 'Parameters', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: /Layout (resolved|solved)/ })
    ).toBeVisible({ timeout: TIMEOUT });
    if (viewport.width <= 1050) {
      await panel.getByRole('button', { name: 'Edit properties' }).click();
    }
    await panel.evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.screenshot({
      path: `test-results/inspector-${viewport.width}.png`,
      fullPage: true,
    });
    await trigger.click();
    await page.screenshot({
      path: `test-results/inspector-canvas-${viewport.width}.png`,
      fullPage: true,
    });
    const saved = await readSource(page);
    expect(parse(saved).layout.objects.fingers_c2_r1).toEqual(
      parse(source).layout.objects.fingers_c2_r1
    );
    expect(parse(saved).layout.clusters.thumbs.placement).toEqual({
      at: [95.25, -38.1, 0],
    });
    await page
      .getByRole('button', { name: 'Undo project edit', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          parse(await readSource(page)).layout.objects.fingers_c1_r1.envelopes
            .keycap.size
      )
      .toEqual([18, 18]);
    await page
      .getByRole('button', { name: 'Redo project edit', exact: true })
      .click();
    await expect.poll(() => readSource(page)).toBe(saved);
  });
}
