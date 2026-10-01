// The README screenshots (docs/images/{en,fr}), compared against the committed images.
// Read-only: it only signs in, so it needs a fixture no journey has touched.
import type { Page } from '@playwright/test';
import { expect, test, token } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.locator('#registry-admin-token').fill(token);
  await page.keyboard.press('Enter');
  await page.getByText('QA Chat', { exact: true }).first().waitFor();
});

// The pointer rests where the last click left it, which would paint a hover state.
const capture = async (page: Page, name: string, options?: { scale: 'device' }) => {
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name, options);
};

test('catalogue grid', async ({ page }) => {
  await capture(page, 'catalogue-grid.png');
});

const label = { en: { table: 'Table', square: 'Square', medium: 'Medium' }, fr: { table: 'Tableau', square: 'Carré', medium: 'Moyen' } };

test('catalogue table', async ({ page, language }) => {
  await page.getByRole('radio', { name: label[language].table }).click();
  await capture(page, 'catalogue-table.png');
});

test('display options', async ({ page, language }) => {
  await page.getByRole('radio', { name: label[language].square }).click();
  await page.getByRole('radio', { name: label[language].medium }).click();
  await capture(page, 'display-options.png');
});

test('model card', async ({ page }) => {
  await page.getByRole('button', { name: /QA Chat/ }).first().click();
  await page.locator('[data-slot="sheet-content"]').waitFor();
  await capture(page, 'model-card.png');
});

test('key composer', async ({ page, language }) => {
  await page.goto(`/?lang=${language}#/keys/vk-qa-dev`);
  await page.getByRole('heading', { level: 2, name: 'QA Development Key' }).waitFor();
  await capture(page, 'key-composer.png');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 2 });
  test('catalogue', async ({ page }) => {
    await capture(page, 'mobile.png', { scale: 'device' });
  });
});
