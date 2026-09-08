import { test, expect, Page } from '@playwright/test';
const source =
  'points:\n  zones:\n    keys:\n      columns: {left: {}, right: {}, far: {}}\n      rows: {home: {}, top: {}}\n';
const open = async (page: Page) => {
  await page.addInitScript(
    (source) =>
      localStorage.setItem(
        location.pathname.startsWith('/ergogen-gui-preview/')
          ? 'preview:ergogen:config'
          : 'ergogen:config',
        JSON.stringify(source)
      ),
    source
  );
  await page.goto('./');
  await expect(page.getByTestId('config-editor')).toBeVisible();
  await page
    .getByRole('button', { name: 'Create / edit case', exact: true })
    .first()
    .click();
  return page.getByRole('dialog', { name: 'Case designer' });
};
test.setTimeout(120000);
test('plans gasket mounting before solids and only generates explicitly', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const dialog = await open(page);
  await expect(
    dialog.getByLabel('Mounting system', { exact: true })
  ).toHaveValue('');
  await expect(
    dialog.getByLabel('Board profile 2D preview', { exact: true })
  ).toBeVisible();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveCount(0);
  await dialog.getByLabel('Switch family', { exact: true }).selectOption('mx');
  await dialog
    .getByLabel('Mounting system', { exact: true })
    .selectOption('gasket');
  await expect(
    dialog.getByRole('button', { name: /^gasket gasket_/ }).first()
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: /^mount case_mount_/ }).first()
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Enclosure', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Help: Shell split height (mm)', exact: true })
    .click();
  await expect(
    dialog.getByRole('tooltip').filter({ hasText: 'Height of the joint' })
  ).toBeVisible();
  const help = dialog
    .getByRole('tooltip')
    .filter({ hasText: 'Height of the joint' });
  expect(
    await help.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return (
        document
          .elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
          ?.closest('[role="tooltip"]') === element
      );
    })
  ).toBe(true);
  await dialog.getByLabel('Wall thickness (mm)', { exact: true }).fill('3.2');
  await dialog.getByLabel('Wall thickness (mm)', { exact: true }).press('Tab');
  await expect(dialog.getByLabel('3D assembly preview')).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: 'Generate', exact: true })
  ).toBeEnabled();
  await page.mouse.move(5, 5);
  await page.screenshot({
    path: 'test-results/guided-plan.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Generating…', exact: true })
  ).not.toBeVisible({ timeout: 90000 });
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'assembled', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true'
  );
  await page.mouse.move(5, 5);
  await page.screenshot({
    path: 'test-results/guided-assembly.png',
    fullPage: true,
  });
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  await expect(
    dialog.getByRole('button', { name: 'Apply design', exact: true })
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test('edits contacts with the keyboard and preserves manual ownership during redistribution', async ({
  page,
}) => {
  const dialog = await open(page);
  await dialog.getByLabel('Switch family', { exact: true }).selectOption('mx');
  await dialog
    .getByLabel('Mounting system', { exact: true })
    .selectOption('gasket');
  const contact = dialog
    .getByRole('button', { name: /^gasket gasket_/ })
    .first();
  await expect(contact).toBeVisible();
  const name = await contact.getAttribute('aria-label');
  await contact.focus();
  await contact.press('Enter');
  await expect(
    dialog.getByRole('dialog', { name: /^Edit gasket_/ })
  ).toBeVisible();
  await dialog
    .getByRole('dialog', { name: /^Edit gasket_/ })
    .getByLabel('Contact length (mm)', { exact: true })
    .fill('9');
  await dialog
    .getByRole('dialog', { name: /^Edit gasket_/ })
    .getByLabel('Contact length (mm)', { exact: true })
    .press('Tab');
  await dialog.getByRole('button', { name: 'Close feature editor' }).click();
  await dialog.getByRole('button', { name: 'Mounting', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Redistribute automatic mounts' })
    .click();
  await dialog.getByRole('button', { name: name!, exact: true }).click();
  await expect(
    dialog
      .getByRole('dialog', { name: /^Edit gasket_/ })
      .getByLabel('Contact length (mm)', { exact: true })
  ).toHaveValue('9');
  await dialog.getByRole('button', { name: 'Close feature editor' }).click();
  await dialog.getByRole('button', { name: name!, exact: true }).focus();
  await dialog
    .getByRole('button', { name: name!, exact: true })
    .press('Delete');
  await expect(
    dialog.getByRole('button', { name: name!, exact: true })
  ).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: name!, exact: true })
  ).toBeVisible();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveCount(0);
});

test('exports a middle frame and rejects an outdated result', async ({
  page,
}) => {
  const dialog = await open(page);
  await dialog.getByLabel('Switch family', { exact: true }).selectOption('mx');
  await dialog
    .getByLabel('Enclosure construction', { exact: true })
    .selectOption('midframe');
  await dialog
    .getByLabel('Mounting system', { exact: true })
    .selectOption('gasket');
  await expect(
    dialog.getByRole('button', { name: /^gasket gasket_/ }).first()
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Generate', exact: true })
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: 90000 });
  await dialog.getByRole('button', { name: 'exploded', exact: true }).click();
  await expect(dialog.getByLabel('3D assembly preview')).toHaveAttribute(
    'data-rendered',
    'true'
  );
  await expect(
    dialog.getByRole('button', { name: 'middle', exact: true })
  ).toBeVisible();
  await page.mouse.move(5, 5);
  await page.screenshot({ path: 'test-results/guided-middle.png' });
  await dialog.getByRole('button', { name: 'Enclosure', exact: true }).click();
  await dialog.getByLabel('Wall thickness (mm)', { exact: true }).fill('3.1');
  await dialog.getByLabel('Wall thickness (mm)', { exact: true }).press('Tab');
  await expect(
    dialog.getByText('Changes not generated', { exact: true })
  ).toBeVisible();
  await expect(dialog.getByLabel('3D assembly preview')).toBeVisible();
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  await expect(
    dialog.getByRole('button', { name: 'Apply design', exact: true })
  ).toBeDisabled();
});

test('imports an STL for a PCB component and packages its KiCad model association', async ({
  page,
}) => {
  const dialog = await open(page);
  await dialog
    .getByLabel('Import KiCad PCB', { exact: true })
    .setInputFiles('e2e/fixtures/imported-controller.kicad_pcb');
  await dialog
    .getByLabel('Mounting system', { exact: true })
    .selectOption('gasket');
  await dialog.getByRole('button', { name: 'Components', exact: true }).click();
  await expect(dialog.getByText(/U1.*needs dimensions/)).toBeVisible();
  const { BoxGeometry, Mesh } = await import('three');
  const { STLExporter } = await import('three-stdlib');
  const mesh = new Mesh(new BoxGeometry(4, 4, 4).translate(0, 0, 2));
  const stl = new STLExporter().parse(mesh);
  await dialog
    .getByLabel('Import models or project ZIP', { exact: true })
    .setInputFiles({
      name: 'controller.stl',
      mimeType: 'model/stl',
      buffer: Buffer.from(stl),
    });
  const choices = dialog.getByLabel('Component footprint', { exact: true });
  await choices.selectOption({ index: 1 });
  await dialog
    .getByRole('button', { name: 'Associate model and update envelope' })
    .click();
  await expect(dialog.getByText(/U1.*envelope available/)).toBeVisible({
    timeout: 30000,
  });
  await expect(
    dialog.getByRole('button', { name: 'Generate', exact: true })
  ).toBeEnabled();
  await dialog.getByRole('button', { name: 'Generate', exact: true }).click();
  await expect(
    dialog.getByText('Generated current draft', { exact: true })
  ).toBeVisible({ timeout: 90000 });
  await dialog.getByRole('button', { name: 'Review', exact: true }).click();
  await dialog.getByRole('checkbox').check();
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download ZIP' }).click();
  const download = await downloadPromise;
  await download.saveAs('test-results/guided-model-project.zip');
  const { readFileSync } = await import('node:fs');
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(
    readFileSync('test-results/guided-model-project.zip')
  );
  const pcb = await zip
    .file('outputs/pcbs/imported-controller.kicad_pcb')!
    .async('string');
  expect(pcb).toContain('${KIPRJMOD}/models/controller.wrl');
  expect(zip.file('outputs/pcbs/models/controller.wrl')).not.toBeNull();
  await dialog
    .getByRole('button', { name: 'Apply design', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page
    .getByRole('button', { name: 'Create / edit case', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Components', exact: true }).click();
  await expect(page.getByText(/U1.*envelope available/)).toBeVisible();
});

test('drags a gasket without generating and can undo the move', async ({
  page,
}) => {
  const dialog = await open(page);
  await dialog.getByLabel('Switch family', { exact: true }).selectOption('mx');
  await dialog
    .getByLabel('Mounting system', { exact: true })
    .selectOption('gasket');
  const contact = dialog
    .getByRole('button', { name: /^gasket gasket_/ })
    .first();
  await expect(contact).toBeVisible({ timeout: 30000 });
  const id = await contact.getAttribute('aria-label');
  const before = await contact.getAttribute('transform');
  const box = (await contact.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 12,
    box.y + box.height / 2 + 8,
    { steps: 5 }
  );
  await page.mouse.up();
  const moved = dialog.getByRole('button', { name: id!, exact: true });
  await expect(moved).toHaveAttribute('data-owner', 'manual');
  await expect(moved).not.toHaveAttribute('transform', before!);
  await dialog.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(moved).toHaveAttribute('transform', before!);
  await expect(dialog.getByLabel('3D assembly preview')).toHaveCount(0);
});
