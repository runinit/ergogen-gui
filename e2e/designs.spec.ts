import grid from './fixtures/native-grid';
import { test as base, expect, Page, Browser } from '@playwright/test';

type EditorWindow = Window & {
  monaco: {
    editor: {
      getModels(): {
        getValue(): string;
        setValue(value: string): void;
        undo(): void;
        redo(): void;
      }[];
    };
  };
};

// Workspace QA attaches to its disposable browser; CI uses the normal fixture.
const test = process.env.WORKSPACE_CDP_ENDPOINT
  ? base.extend<{ page: Page }, { workspaceBrowser: Browser }>({
      workspaceBrowser: [
        async ({ playwright }, use) => {
          const browser = await playwright.chromium.connectOverCDP(
            process.env.WORKSPACE_CDP_ENDPOINT!
          );
          try {
            await use(browser);
          } finally {
            await browser.close();
          }
        },
        { scope: 'worker' },
      ],
      page: async ({ workspaceBrowser, baseURL }, use) => {
        const context = await workspaceBrowser.newContext({
          baseURL,
          viewport: { width: 1500, height: 900 },
        });
        const page = await context.newPage();
        try {
          await use(page);
        } finally {
          await context.close();
        }
      },
    })
  : base;

const source = `${grid}
designs:
  regions:
    keys: {select: {kind: key}, envelope: pcb, close: 2}
  boundaries:
    body: {from: regions.keys, clearance: 3} # keep
  profiles:
    pcb: {from: boundaries.body}
  sketches:
    test:
      points:
        origin: {at: [0, 0], fixed: true}
        tip: {at: [pitch, 3]}
      geometry:
        edge: {type: line, points: [origin, tip], construction: true}
      constraints:
        level: {type: horizontal, line: edge}
        length: {type: distance, points: [origin, tip], value: 20}
  assemblies:
    tray: {preset: tray, profile: profiles.pcb, lid: 2}
`;
const readSource = (page: Page) =>
  page.evaluate(
    () =>
      (window as EditorWindow).monaco.editor.getModels()[0].getValue() as string
  );
const generate = async (page: Page) => {
  await page.getByRole('button', { name: /Generate/ }).click();
  await expect(page.getByRole('button', { name: /Generate/ })).toBeEnabled();
};

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript((config) => {
    localStorage.setItem(
      location.pathname.startsWith('/ergogen-gui-preview/')
        ? 'preview:ergogen:multi-config'
        : 'ergogen:multi-config',
      JSON.stringify({
        version: 2,
        activeConfigId: 'design-test',
        configs: [
          {
            id: 'design-test',
            name: 'Design test',
            config,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })
    );
  }, source);
  await page.goto(baseURL || '/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('config-editor')).toBeVisible();
  await generate(page);
  await page.getByRole('button', { name: 'Open design editor' }).click();
  await page.getByRole('button', { name: 'Sketches', exact: true }).click();
  await expect(
    page
      .getByLabel('Design feature')
      .locator('option', { hasText: 'boundaries.body' })
  ).toBeAttached();
});

test('edits YAML through undo/redo and retains the preview on a broken reference', async ({
  page,
}) => {
  await page.getByLabel('Design feature').selectOption('boundaries.body');
  const before = await readSource(page);
  await page.getByLabel('Design clearance').fill('4');
  await page.getByLabel('Design clearance').blur();
  await expect
    .poll(() => readSource(page))
    .toBe(before.replace('clearance: 3', 'clearance: "4"'));
  await page.evaluate(() =>
    (window as EditorWindow).monaco.editor.getModels()[0].undo()
  );
  await expect.poll(() => readSource(page)).toBe(before);
  await page.evaluate(() =>
    (window as EditorWindow).monaco.editor.getModels()[0].redo()
  );
  await expect.poll(() => readSource(page)).toContain('clearance: "4"');
  await generate(page);
  const path = await page
    .getByLabel('Design canvas')
    .locator('path')
    .first()
    .getAttribute('d');
  await page.evaluate(() => {
    const model = (window as EditorWindow).monaco.editor.getModels()[0];
    model.setValue(
      model.getValue().replace('from: regions.keys', 'from: regions.missing')
    );
  });
  await generate(page);
  await expect(
    page.getByRole('status').filter({ hasText: 'Preview stale —' })
  ).toContainText('regions.missing');
  await expect(
    page.getByLabel('Design canvas').locator('path').first()
  ).toHaveAttribute('d', path!);
  await expect(
    page.getByRole('button', {
      name: 'Download archive of all generated files',
    })
  ).toBeDisabled();
});

test('constrained dragging preserves formulas and hard dimensions', async ({
  page,
}) => {
  await page.getByLabel('Design feature').selectOption('sketches.test');
  await expect(
    page.getByLabel('Dimension length', { exact: true }).first()
  ).toBeAttached();
  const handle = page.getByLabel('Drag tip');
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 45, box.y - 20, { steps: 5 });
  await page.mouse.up();
  await expect.poll(() => readSource(page)).toContain('(pitch) +');
  await expect(
    page.getByLabel('Design canvas').getByLabel('Dimension length')
  ).toHaveText(/20.00 mm/);
  const dimension = page.getByRole('textbox', {
    name: 'Dimension length',
    exact: true,
  });
  await dimension.fill('24');
  await dimension.blur();
  await expect(
    page.getByLabel('Design canvas').getByLabel('Dimension length')
  ).toHaveText(/24.00 mm/);
});

test('renders assembled and exploded STL parts', async ({ page }) => {
  await page.getByLabel('Assembly', { exact: true }).selectOption('tray');
  const canvas = page.getByLabel('3D assembly preview').locator('canvas');
  await expect(canvas).toBeVisible();
  await page.getByLabel('Exploded', { exact: true }).check();
  await expect(page.getByLabel('Exploded', { exact: true })).toBeChecked();
  await page.getByLabel('Part', { exact: true }).selectOption('tray_lid');
  await expect(canvas).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('assembly.png') });
});
