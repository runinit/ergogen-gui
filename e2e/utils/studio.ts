import { expect, Page } from '@playwright/test';

export const studio = (page: Page) =>
  page.getByRole('region', { name: 'Board Studio' });

export async function openCode(page: Page) {
  await expect(studio(page)).toBeVisible();
  if (!(await page.getByLabel('Project YAML', { exact: true }).count())) {
    await page.getByRole('button', { name: 'Code', exact: true }).click();
  }
  await expect(page.getByLabel('Project YAML', { exact: true })).toBeVisible();
  await page.waitForFunction(
    () =>
      !!(
        window as Window & { monaco?: { editor: { getModels(): unknown[] } } }
      ).monaco?.editor.getModels().length
  );
}

// Inspect the portable saved source, including edits made while Code is closed.
export const readSource = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const prefix = location.pathname.startsWith('/ergogen-gui-preview/')
      ? 'preview:'
      : '';
    const saved = JSON.parse(
      localStorage.getItem(prefix + 'ergogen:multi-config') || 'null'
    );
    return (
      saved?.configs?.find(
        (config: { id: string; config: string }) =>
          config.id === saved.activeConfigId
      )?.config ??
      JSON.parse(localStorage.getItem(prefix + 'ergogen:config') || '""')
    );
  });

export async function openCase(page: Page) {
  await studio(page)
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'Case', exact: true })
    .click();
  const designer = page.getByRole('region', { name: 'Case designer' });
  await expect(designer).toBeVisible();
  return designer;
}

export async function openLibrary(page: Page) {
  await studio(page)
    .getByRole('navigation', { name: 'Design workflow' })
    .getByRole('button', { name: 'Components', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Part library', exact: true })
    .last()
    .click();
  await expect(page.getByLabel('Import footprint files')).toBeAttached();
  return studio(page);
}

export async function createDraft(page: Page) {
  await page
    .getByRole('button', { name: 'New native design', exact: true })
    .click();
  await page.getByRole('button', { name: 'Create draft', exact: true }).click();
  await expect(studio(page)).toBeVisible();
}
