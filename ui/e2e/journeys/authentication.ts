import { token, expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function authenticationJourney({ page, button, shot, groupModels }: JourneyContext) {
  await test.step("authentication and catalog", async () => {
    await page.getByLabel("Admin token", { exact: true }).fill("invalid-fixture-token");
    await button("Sign in").click();
    await page.getByRole("alert").filter({ hasText: "Invalid" }).waitFor();
    await page.getByLabel("Admin token", { exact: true }).fill(token);
    await button("Sign in").click();
    await button("Open QA Chat details").waitFor();
    await shot("after-catalog-light");
    // Browsing by subscription is the default (#85); Basic shows search, Filters and View options only.
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Claude 5",
      "Codex 3",
      "Google 2",
      "Synthetic Provider 3",
    ]);
    for (const name of ["Creator", "Serving provider", "Group models by", "Sort models by"])
      await expect(page.getByRole("combobox", { name, exact: true }), `${name} is in Filters`).toHaveCount(0);
    for (const name of ["Grid", "Table", "Rectangle", "Square"])
      await expect(page.getByRole("radio", { name, exact: true }), `${name} is in View options`).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Filters|View options)$/ })).toHaveText([
      "Filters",
      "View options",
    ]);
    await groupModels("No grouping");
  });
}

export async function logoutJourney({ button, shot, page }: JourneyContext) {
  await test.step("dark theme and logout clear secrets and workspace", async () => {
    await button("Use dark theme").click();
    await shot("after-catalog-dark-mobile");
    await expect(page.locator("html")).toHaveAttribute("class", "dark");
    await button("Sign out").click();
    await button("Sign in").waitFor();
    await expect(page.getByText("QA Code", { exact: true })).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        [...Object.values(localStorage), ...Object.values(sessionStorage)].some(v => v.includes("sk-bf-")),
      ),
    ).toBe(false);
  });
}
