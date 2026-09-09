import { test, expect } from '@playwright/test';
import fs from 'fs';
import crypto from 'crypto';
import { makeShooter } from './utils/screenshots';
import NativeStack from '../src/examples/physical-stack';
import { CONFIG_LOCAL_STORAGE_KEY } from '../src/context/constants';

test.describe('Ergogen Configuration Processing', () => {
  test.setTimeout(120000);
  const hashFile = async (filePath: string): Promise<string> => {
    const buffer = await fs.promises.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  };

  test('loads native physical stack configuration from local storage and displays outputs', async ({
    page,
  }) => {
    const shoot = makeShooter(page, test.info());
    // Set native physical stack config directly in local storage
    await page.addInitScript(
      ({ config, key }) => {
        localStorage.setItem(key, JSON.stringify(config));
      },
      { config: NativeStack.value, key: CONFIG_LOCAL_STORAGE_KEY }
    );

    // Navigate to the main page
    await page.goto('./');

    // Wait for the page to load with the config
    await shoot('before-haveURL-root');
    await expect(page).toHaveURL(/.*\/$/);
    await shoot('after-haveURL-root');

    // Wait for the editor to be visible
    await shoot('before-config-editor-visible');
    await expect(page.getByTestId('config-editor')).toBeVisible({
      timeout: 60000,
    });
    await shoot('after-config-editor-visible');

    // Wait for the downloads section to be visible
    const downloadsSection = page.getByTestId('downloads-container');
    await shoot('before-downloads-section-visible');
    await expect(downloadsSection).toBeVisible({ timeout: 60000 });
    await shoot('after-downloads-section-visible');
  });
  test('loads native physical stack demo.dxf preview', async ({ page }) => {
    const shoot = makeShooter(page, test.info());
    // Set native physical stack config directly in local storage
    await page.addInitScript(
      ({ config, key }) => {
        localStorage.setItem(key, JSON.stringify(config));
      },
      { config: NativeStack.value, key: CONFIG_LOCAL_STORAGE_KEY }
    );

    // Navigate to the main page
    await page.goto('./');

    // Test DXF preview (demo output)
    const demoDxfRow = page.getByTestId('downloads-container-demo-dxf');
    await shoot('before-demo-dxf-row-visible');
    await expect(demoDxfRow).toBeVisible({ timeout: 60000 });
    await shoot('after-demo-dxf-row-visible');

    const dxfPreviewButton = page.getByTestId(
      'downloads-container-demo-dxf-preview'
    );
    await shoot('before-dxf-preview-button-visible');
    await expect(dxfPreviewButton).toBeVisible();
    await shoot('after-dxf-preview-button-visible');

    // Click to preview the DXF
    await dxfPreviewButton.click();
    const dxfFilePreview = page.getByTestId('demo.svg-file-preview');
    await shoot('before-dxf-file-preview-visible');
    await expect(dxfFilePreview).toBeVisible({ timeout: 60000 });
    await shoot('after-dxf-file-preview-visible');
  });
  test('loads native physical stack KiCad PCB', async ({ page }) => {
    const shoot = makeShooter(page, test.info());
    // Set native physical stack config directly in local storage
    await page.addInitScript(
      ({ config, key }) => {
        localStorage.setItem(key, JSON.stringify(config));
      },
      { config: NativeStack.value, key: CONFIG_LOCAL_STORAGE_KEY }
    );

    // Navigate to the main page
    await page.goto('./');

    // Test KiCad PCB preview (main.kicad_pcb output)
    const pcbRow = page.getByTestId('downloads-container-main-kicad_pcb');
    await shoot('before-pcb-row-visible');
    await expect(pcbRow).toBeVisible({ timeout: 60000 });
    await shoot('after-pcb-row-visible');

    const pcbPreviewButton = page.getByTestId(
      'downloads-container-main-kicad_pcb-preview'
    );
    await shoot('before-pcb-preview-button-visible');
    await expect(pcbPreviewButton).toBeVisible();
    await shoot('after-pcb-preview-button-visible');

    // Click to preview the KiCad PCB
    await pcbPreviewButton.click();
    const pcbFilePreview = page.getByTestId('pcbs.main-file-preview');
    await shoot('before-pcb-file-preview-visible');
    await expect(pcbFilePreview).toBeVisible({ timeout: 60000 });
    await shoot('after-pcb-file-preview-visible');
  });
  test('loads native physical stack STL previews', async ({ page }) => {
    const shoot = makeShooter(page, test.info());
    // Set native physical stack config directly in local storage
    await page.addInitScript(
      ({ config, key }) => {
        localStorage.setItem(key, JSON.stringify(config));
        localStorage.setItem(
          location.pathname.startsWith('/ergogen-gui-preview/')
            ? 'preview:ergogen:config:stlPreview'
            : 'ergogen:config:stlPreview',
          'true'
        );
      },
      { config: NativeStack.value, key: CONFIG_LOCAL_STORAGE_KEY }
    );

    // Navigate to the main page
    await page.goto('./');

    // Wait for both STL files to appear (both keyboard_plate and keyboard_bottom)
    const stlRowMountingPlate = page.getByTestId(
      'downloads-container-keyboard_plate-stl'
    );
    await shoot('before-stl-row-mounting-plate-visible');
    await expect(stlRowMountingPlate).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-row-mounting-plate-visible');

    const stlRowPrototype = page.getByTestId(
      'downloads-container-keyboard_bottom-stl'
    );
    await shoot('before-stl-row-keyboard_bottom-visible');
    await expect(stlRowPrototype).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-row-keyboard_bottom-visible');

    // Wait for STL generation to complete (download button should appear)
    const stlDownloadButtonPlate = page.getByTestId(
      'downloads-container-keyboard_plate-stl-download'
    );
    await shoot('before-stl-download-button-plate-visible');
    await expect(stlDownloadButtonPlate).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-download-button-plate-visible');

    const stlPreviewButtonPrototype = page.getByTestId(
      'downloads-container-keyboard_bottom-stl-download'
    );
    await shoot('before-stl-download-button-keyboard_bottom-visible');
    await expect(stlPreviewButtonPrototype).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-download-button-keyboard_bottom-visible');

    // Click to preview the keyboard_plate STL
    const stlPreviewButtonPlate = page.getByTestId(
      'downloads-container-keyboard_plate-stl-preview'
    );
    await shoot('before-stl-preview-button-plate-visible');
    await expect(stlPreviewButtonPlate).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-preview-button-plate-visible');

    await stlPreviewButtonPlate.click();
    const stlFilePreviewPlate = page.getByTestId(
      'solids.keyboard_plate.stl-file-preview'
    );
    await shoot('before-stl-file-preview-plate-visible');
    await expect(stlFilePreviewPlate).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-file-preview-plate-visible');

    // Click to preview the keyboard_bottom STL
    const stlPreviewButtonProto = page.getByTestId(
      'downloads-container-keyboard_bottom-stl-preview'
    );
    await shoot('before-stl-preview-button-proto-visible');
    await expect(stlPreviewButtonProto).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-preview-button-proto-visible');
    await stlPreviewButtonProto.click();
    const stlFilePreviewProto = page.getByTestId(
      'solids.keyboard_bottom.stl-file-preview'
    );
    await shoot('before-stl-file-preview-proto-visible');
    await expect(stlFilePreviewProto).toBeVisible({ timeout: 60000 });
    await shoot('after-stl-file-preview-proto-visible');

    // Download both STL files and ensure they are different
    const [downloadPlate] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByTestId('downloads-container-keyboard_plate-stl-download')
        .click(),
    ]);
    const platePath = test.info().outputPath('keyboard_plate.stl');
    await downloadPlate.saveAs(platePath);

    const [downloadProto] = await Promise.all([
      page.waitForEvent('download'),
      page
        .getByTestId('downloads-container-keyboard_bottom-stl-download')
        .click(),
    ]);
    const protoPath = test.info().outputPath('keyboard_bottom.stl');
    await downloadProto.saveAs(protoPath);

    // Basic sanity: files exist and non-empty
    const plateStat = await fs.promises.stat(platePath);
    const protoStat = await fs.promises.stat(protoPath);
    expect(plateStat.size).toBeGreaterThan(0);
    expect(protoStat.size).toBeGreaterThan(0);

    // Hash and compare to verify they are different
    const [plateHash, protoHash] = await Promise.all([
      hashFile(platePath),
      hashFile(protoPath),
    ]);
    expect(plateHash).not.toBe(protoHash);
  });
});
