import { expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function focusJourney({ nav, button, page, sheet, scope, keyCard }: JourneyContext) {
  await test.step("focus returns to what opened a sheet or a dialog, on Escape and on Cancel (final fixes)", async () => {
    // PRODUCT.md: focus is returned after sheets and dialogs. They open from state, not from a Radix Trigger, so Radix
    // has nothing to refocus: the shared Sheet and Dialog hand the focus back to the element that had it on opening.
    // The Help sheet, opened by the "?" button, and a model sheet, opened by its card's "Open <model> details".
    await nav("My models").click();
    const help = button("Help for My models");
    const helpSheet = page.getByRole("dialog", { name: "Help", exact: true });
    await help.click();
    await helpSheet.waitFor();
    await page.keyboard.press("Escape");
    await expect(helpSheet).toBeHidden();
    await expect(help, "Escape returns the focus to the Help button").toBeFocused();
    await help.click();
    await helpSheet.getByRole("button", { name: "Close", exact: true }).click();
    await expect(help, "Close returns the focus to the Help button").toBeFocused();
    const openChat = button("Open QA Chat details");
    await openChat.click();
    await sheet().getByRole("button", { name: "Edit", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await expect(sheet()).toBeHidden();
    await expect(openChat, "Escape returns the focus to the card's Open button").toBeFocused();
    // A card to register leaves the sheet with Cancel (the saved card's X is Close, tried above).
    await scope(/^To add/).click();
    const openUnregistered = button("Open QA Unregistered details");
    await openUnregistered.click();
    await button("Cancel").click();
    await expect(sheet()).toBeHidden();
    await expect(openUnregistered, "Cancel returns the focus to the tile that opened the sheet").toBeFocused();
    await scope(/^In Registry/).click();
    // The adoption dialog, opened from "Adopt this key" on an unadopted key's page (a read-only preview, nothing is adopted);
    // the page stays on that key, where the next step starts from.
    await page.evaluate(() => {
      location.hash = "#/keys";
    });
    await keyCard("QA Google Key").getByRole("button", { name: "Adopt · QA Google Key", exact: true }).click();
    const adopt = button("Adopt this key");
    const adoption = page.getByRole("dialog", { name: "Adopt this key", exact: true });
    const leaveAdoption = [
      ["Escape", () => page.keyboard.press("Escape")],
      ["Cancel", () => adoption.getByRole("button", { name: "Cancel", exact: true }).click()],
    ] as const;
    for (const [how, leave] of leaveAdoption) {
      await adopt.click();
      await expect(adoption.getByRole("button", { name: "Adopt", exact: true })).toBeVisible();
      await leave();
      await expect(adoption).toBeHidden();
      await expect(adopt, `${how} returns the focus to "Adopt this key"`).toBeFocused();
    }
  });
}
