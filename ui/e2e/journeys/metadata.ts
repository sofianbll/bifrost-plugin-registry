import { expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function metadataJourney({ nav, button, page, api }: JourneyContext) {
  await test.step("metadata correction uses visible dialog and persists", async () => {
    // "Sources & References" is now Settings > Open catalog data.
    await nav("Settings").click();
    await button("Open catalog data").click();
    // A refresh button names its source as the card above does, not by its raw id ("bifrost", "models.dev").
    await expect(button("Refresh Bifrost")).toBeVisible();
    await expect(button("Refresh Models.dev")).toBeVisible();
    await page.getByRole("button").filter({ hasText: "synthetic-provider/qa-chat" }).first().click();
    await button("Edit field").click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.locator("input").fill("QA metadata corrected");
    await dialog.getByRole("button", { name: "Save shared correction" }).click();
    await dialog.waitFor({ state: "hidden" });
    const catalog = await api("catalog");
    expect(catalog.accesses.find((a: { model: string }) => a.model === "qa-chat").fields.name.value).toBe(
      "QA metadata corrected",
    );
  });
}
