import { studio, openCase } from './utils/studio';
import { expect, test } from '@playwright/test';
import BHK from '../src/examples/bhk';

const TIMEOUT = 120000;
test.setTimeout(TIMEOUT);
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 412, height: 915 },
]) {
  test(`edits BHK gaskets with pan and zoom at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript((source) => {
      const prefix = location.pathname.startsWith('/ergogen-gui-preview/')
        ? 'preview:'
        : '';
      localStorage.setItem(prefix + 'ergogen:config', JSON.stringify(source));
    }, BHK.value);
    await page.goto('./');
    await expect(studio(page)).toBeVisible();
    await openCase(page);
    const dialog = page.getByRole('region', { name: 'Case designer' });
    if (viewport.width < 600) {
      await dialog
        .getByRole('button', { name: 'Assembly tree', exact: true })
        .click();
    }
    await dialog.getByRole('button', { name: 'Mounting', exact: true }).click();
    await dialog
      .getByLabel('Mounting system', { exact: true })
      .selectOption('gasket');
    const plan = dialog.getByLabel('Interactive mounting plan');
    const pads = plan.getByRole('button', { name: /^gasket / });
    await expect(pads.first()).toBeVisible({ timeout: TIMEOUT });
    await expect
      .poll(() =>
        pads.evaluateAll((nodes) =>
          nodes.some((node) => {
            const angle = Number(
              node.getAttribute('transform')?.match(/rotate\(([^)]+)\)/)?.[1] ||
                0
            );
            return Math.abs(angle % 90) > 1;
          })
        )
      )
      .toBe(true);
    await expect(
      dialog.getByText('Calculating mounting plan…', { exact: true })
    ).toHaveCount(0, { timeout: TIMEOUT });
    // The narrow inspector must close before interacting with the plan.
    if (viewport.width < 600) {
      await dialog
        .getByRole('button', { name: 'Inspector', exact: true })
        .click();
    }
    await plan.scrollIntoViewIfNeeded();
    const originalView = await plan.getAttribute('viewBox');
    if (viewport.width < 600) {
      const client = await page.context().newCDPSession(page);
      await client.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
      });
      const area = (await plan.boundingBox())!;
      const x = area.x + area.width / 2,
        y = area.y + area.height / 2;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { x: x - 25, y, id: 1 },
          { x: x + 25, y, id: 2 },
        ],
      });
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: x - 50, y, id: 1 },
          { x: x + 50, y, id: 2 },
        ],
      });
      await expect(plan).not.toHaveAttribute('viewBox', originalView!);
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await expect(plan).not.toHaveAttribute('viewBox', originalView!);
      await expect(dialog.getByRole('tooltip')).toHaveCount(0);
      await client.send('Emulation.setTouchEmulationEnabled', {
        enabled: false,
      });
      await client.detach();
      await dialog
        .getByRole('button', { name: 'Fit plan', exact: true })
        .click();
    }

    await plan.scrollIntoViewIfNeeded();
    const wheelArea = (await plan.boundingBox())!;
    await page.mouse.move(
      wheelArea.x + wheelArea.width / 2,
      wheelArea.y + wheelArea.height / 2
    );
    await page.mouse.wheel(0, -120);
    await expect(plan).not.toHaveAttribute('viewBox', originalView!);
    expect((await plan.boundingBox())!.y).toBeCloseTo(wheelArea.y, 0);
    await dialog.getByRole('button', { name: 'Fit plan', exact: true }).click();
    await dialog.getByRole('button', { name: 'Zoom in mounting plan' }).click();
    await expect(plan).not.toHaveAttribute('viewBox', originalView!);
    await dialog.getByRole('button', { name: 'Pan', exact: true }).click();
    await plan.scrollIntoViewIfNeeded();
    const box = (await plan.boundingBox())!;
    const zoomed = await plan.getAttribute('viewBox');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 30,
      box.y + box.height / 2 + 15,
      { steps: 5 }
    );
    await page.mouse.up();
    await expect(plan).not.toHaveAttribute('viewBox', zoomed!);
    await dialog.getByRole('button', { name: 'Fit plan', exact: true }).click();
    await expect(plan).toHaveAttribute('viewBox', originalView!);
    await dialog.getByRole('button', { name: 'Select', exact: true }).click();
    const pad = pads.first();
    const name = (await pad.getAttribute('aria-label'))!;
    const before = (await pad.getAttribute('transform'))!;
    await pad.scrollIntoViewIfNeeded();
    const position = (await pad.boundingBox())!;
    await page.mouse.move(
      position.x + position.width / 2,
      position.y + position.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(
      position.x + position.width / 2 + 10,
      position.y + position.height / 2 + 10,
      { steps: 5 }
    );
    await expect(dialog.getByRole('tooltip')).toHaveCount(0);
    await page.mouse.up();
    const moved = plan.getByRole('button', { name, exact: true });
    await expect(moved).toHaveAttribute('data-owner', 'manual', {
      timeout: TIMEOUT,
    });
    await expect(moved).not.toHaveAttribute('transform', before);
    const editor = dialog.getByRole('dialog', { name: /^Edit / });
    expect((await editor.boundingBox())!.y).toBeGreaterThanOrEqual(
      (await plan.boundingBox())!.y + (await plan.boundingBox())!.height
    );
    await page
      .getByRole('button', { name: 'Undo project edit', exact: true })
      .click();
    await expect(
      plan.getByRole('button', { name, exact: true })
    ).toHaveAttribute('transform', before, { timeout: TIMEOUT });
    const count = await pads.count();
    await dialog
      .getByRole('button', { name: 'Add gasket', exact: true })
      .click();
    await plan.scrollIntoViewIfNeeded();
    const edgePoint = await plan
      .locator('polyline[stroke="transparent"]')
      .evaluateAll((elements) => {
        const edges = elements
          .map((element) => {
            const points = (element.getAttribute('points') || '')
              .split(' ')
              .map((pair) => pair.split(',').map(Number));
            const a = points[0],
              b = points[points.length - 1];
            return {
              element,
              a,
              b,
              length: Math.hypot(b[0] - a[0], b[1] - a[1]),
            };
          })
          .sort((a, b) => b.length - a.length);
        const { element, a, b } = edges[0];
        const point = new DOMPoint(
          a[0] * 0.75 + b[0] * 0.25,
          a[1] * 0.75 + b[1] * 0.25
        ).matrixTransform((element as SVGGraphicsElement).getScreenCTM()!);
        return { x: point.x, y: point.y };
      });
    await page.mouse.click(edgePoint.x, edgePoint.y);
    await expect(pads).toHaveCount(count + 1, { timeout: TIMEOUT });
    await dialog
      .getByRole('dialog', { name: /^Edit / })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(pads).toHaveCount(count, { timeout: TIMEOUT });
    if (viewport.width < 600) {
      await dialog
        .getByRole('button', { name: 'Assembly tree', exact: true })
        .click();
    }
    await dialog.getByRole('button', { name: 'Review', exact: true }).click();
    await expect(dialog.getByText(/rigid ledge clamps/)).toHaveCount(0);
    if (viewport.width < 600) {
      await dialog
        .getByRole('button', { name: 'Inspector', exact: true })
        .click();
    }
    await plan.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.screenshot({
      path: test.info().outputPath(`bhk-gaskets-${viewport.width}.png`),
      fullPage: true,
    });
  });
}
