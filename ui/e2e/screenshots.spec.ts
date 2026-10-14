// The README screenshots (docs/images/{en,fr}), compared against the committed images.
// Read-only: it only signs in, so it needs a fixture no journey has touched.
import type { Page } from "@playwright/test";
import { expect, test, token } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.locator("#registry-admin-token").fill(token);
  await page.keyboard.press("Enter");
  await page.getByText("QA Chat", { exact: true }).first().waitFor();
});

// The pointer rests where the last click left it, which would paint a hover state.
const capture = async (page: Page, name: string, options?: { scale: "device" }) => {
  await page.mouse.move(0, 0);
  await expect(page).toHaveScreenshot(name, options);
};

test("catalogue grid", async ({ page }) => {
  await capture(page, "catalogue-grid.png");
});

const label = {
  en: { table: "Table", square: "Square", medium: "Medium", options: "View options" },
  fr: { table: "Tableau", square: "Carré", medium: "Moyen", options: "Options d’affichage" },
};

// Basic mode folds the layout controls into View options (#85); the popover closes before the capture, except for
// the display-options shot, which illustrates it open.
const pick = async (page: Page, language: "en" | "fr", ...radios: string[]) => {
  await page.getByRole("button", { name: label[language].options, exact: true }).click();
  for (const name of radios) await page.getByRole("radio", { name }).click();
  await page.keyboard.press("Escape");
};

test("catalogue table", async ({ page, language }) => {
  await pick(page, language, label[language].table);
  await capture(page, "catalogue-table.png");
});

test("display options", async ({ page, language }) => {
  // The shot illustrates the popover itself (#110): it stays open, the choices just made selected.
  await page.getByRole("button", { name: label[language].options, exact: true }).click();
  for (const name of [label[language].square, label[language].medium]) await page.getByRole("radio", { name }).click();
  await capture(page, "display-options.png");
});

test("model card", async ({ page }) => {
  await page
    .getByRole("button", { name: /QA Chat/ })
    .first()
    .click();
  await page.locator('[data-slot="sheet-content"]').waitFor();
  await capture(page, "model-card.png");
});

test("key composer", async ({ page, language }) => {
  await page.goto(`/?lang=${language}#/keys/vk-qa-dev`);
  await page.getByRole("heading", { level: 1, name: "QA Development Key" }).waitFor();
  // The key page opens read-first; the composer is behind Edit selection.
  await page
    .getByRole("button", { name: language === "fr" ? "Modifier la sélection" : "Edit selection", exact: true })
    .click();
  await capture(page, "key-composer.png");
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 2 });
  test("catalogue", async ({ page }) => {
    await capture(page, "mobile.png", { scale: "device" });
  });
});
