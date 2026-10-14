import { token, expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function tourJourney({
  page,
  button,
  nav,
  catalogReads,
  withinViewport,
  setExpert,
  scope,
  groupModels,
}: JourneyContext) {
  await test.step('the tour is offered once and can be dismissed; "?" opens help beside the page and relaunches it (#96)', async () => {
    const signIn = async () => {
      await page.getByLabel("Admin token", { exact: true }).fill(token);
      await button("Sign in").click();
      await button("Open QA Chat details").waitFor();
    };
    const offer = page.getByRole("region", { name: "Guided tour", exact: true });
    const stepCard = (title: string) => page.getByRole("dialog", { name: title, exact: true });
    const helpPanel = page.getByRole("dialog", { name: "Help", exact: true });
    const startFromHelp = async () => {
      await button("Help for My models").click();
      await helpPanel.getByRole("button", { name: "Start the tour", exact: true }).click();
    };
    const remembered = () => page.evaluate(() => localStorage.getItem("bifrost-registry.tour.v1"));
    // A first visit is offered the tour inline (it covers nothing), on My models only: the other pages stay
    // as they are, and a phone shows no banner at all (it would push the first card down).
    await expect(offer).toContainText("New here?");
    expect(await remembered()).toBeNull();
    for (const [link, heading] of [
      ["Groups", "Groups"],
      ["Virtual keys", "Virtual keys"],
      ["Settings", "Settings"],
    ])
      await test.step(`no tour offer above ${heading}`, async () => {
        await nav(link).click();
        await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
        await expect(offer, `the offer is not repeated above ${heading}`).toHaveCount(0);
      });
    await nav("My models").click();
    await expect(offer).toBeVisible();
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(offer, "a phone shows no tour banner").toBeHidden();
    await page.setViewportSize({ width: 1440, height: 950 });
    await expect(offer).toBeVisible();
    await offer.getByRole("button", { name: "Not now", exact: true }).focus();
    await page.keyboard.press("Escape");
    await expect(offer).toHaveCount(0);
    expect(await remembered()).not.toBeNull();
    // After a reload it is not offered again. (The reload read the catalogue once more: keep the count of the load that follows.)
    await page.reload();
    await signIn();
    await expect(offer).toHaveCount(0);
    await expect.poll(() => catalogReads.length).toBe(2);
    catalogReads.shift();
    // "?" opens the help in a side panel on this page: the address does not change and the page stays behind it.
    const address = page.url();
    await button("Help for My models").click();
    await expect(helpPanel).toBeVisible();
    await withinViewport(helpPanel);
    expect(page.url(), "Help opens beside the page").toBe(address);
    // The page's own title (h1) stays rendered behind the panel; the panel's title is an h2.
    await expect(page.locator("h1", { hasText: "My models" })).toBeVisible();
    for (const phrase of [
      "Adopting a key",
      "Ready to adopt",
      "Keep [provider] in Bifrost",
      "Remove these models from the key in Bifrost",
      "Replace “all providers” by the explicit list",
      "Replace “all models” by the models saved in Registry",
      "preview and confirm",
      "kept in Bifrost",
      "inferred creator",
      "Associate a datasheet",
      "Add to card",
      "no datasheet",
    ])
      await expect(helpPanel).toContainText(phrase);
    await expect(helpPanel, "The help speaks of the key, not of an endpoint").not.toContainText("/v1/models");
    // As many numbered steps as the tour, then the words the panel uses.
    await expect(helpPanel.getByRole("listitem").filter({ has: page.locator('[data-slot="badge"]') })).toHaveCount(4);
    // #101: the glossary says "Checked with Bifrost" (never "Readback"), explains access and subscription/provider, and
    // leaves the common model ID to Expert; its example is no real provider.
    for (const term of [
      "Access",
      "Subscription, provider",
      "Datasheet",
      "Inferred creator",
      "Kept in Bifrost",
      "Checked with Bifrost",
      "Adopt",
    ])
      await expect(helpPanel.getByRole("term").filter({ hasText: term })).toHaveCount(1);
    await expect(helpPanel.getByRole("term").filter({ hasText: "Common model ID" })).toHaveCount(0);
    await expect(helpPanel).not.toContainText("Readback");
    await expect(helpPanel).not.toContainText("Mistral");
    // Expert's glossary adds the one word only Expert meets. (The switch sits behind the panel: close it, toggle, reopen.)
    await page.keyboard.press("Escape");
    await expect(helpPanel).toHaveCount(0);
    await setExpert(true);
    await button("Help for My models").click();
    await expect(helpPanel.getByRole("term").filter({ hasText: "Common model ID" })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(helpPanel).toHaveCount(0);
    await setExpert(false);
    await button("Help for My models").click();
    await expect(helpPanel).toBeVisible();
    // Starting the tour closes the panel and puts the focus on the tour card; the page stays usable under it.
    await helpPanel.getByRole("button", { name: "Start the tour", exact: true }).click();
    await expect(helpPanel).toHaveCount(0);
    await expect(stepCard("My models")).toContainText("Step 1 of 4");
    await expect(stepCard("My models")).toBeFocused();
    await expect(page.locator("[data-tour-ring]"), "The ring around what the step points at is drawn").toHaveCSS(
      "outline-style",
      "solid",
    );
    await scope(/^To add/).click();
    await expect(scope(/^To add/)).toBeChecked();
    await scope(/^In Registry/).click();
    // Moving about by hand does not make the tour pull the person back or skip ahead.
    await nav("Virtual keys").click();
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/#\/keys$/);
    await expect(stepCard("My models")).toBeVisible();
    await nav("My models").click();
    // Next and Back move between the pages; each step waits for the page it points at.
    await button("Next").click();
    await expect(stepCard("Groups")).toContainText("Step 2 of 4");
    await expect(page).toHaveURL(/#\/groups$/);
    await button("Back").click();
    await expect(stepCard("My models")).toBeVisible();
    await expect(page).toHaveURL(/#\/models$/);
    await button("Next").click();
    await expect(stepCard("Groups")).toBeVisible();
    await button("Next").click();
    await expect(stepCard("Virtual keys")).toBeVisible();
    await expect(page).toHaveURL(/#\/keys$/);
    await button("Next").click();
    await expect(stepCard("Adopting a key")).toContainText("Step 4 of 4");
    await expect(
      page.locator('[data-tour="adoption"]'),
      "The step points at a key that still needs adopting",
    ).toHaveCount(1);
    // Done gives the page back: where the tour started, with the focus back on "?".
    await button("Done").click();
    await expect(stepCard("Adopting a key")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/models$/);
    await expect(button("Help for My models")).toBeFocused();
    // Relaunched from "?" at any time; Escape leaves it from another page and restores the first one.
    await startFromHelp();
    await expect(stepCard("My models")).toBeVisible();
    await button("Next").click();
    await expect(stepCard("Groups")).toBeVisible();
    await button("Next").click();
    await expect(stepCard("Virtual keys")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(stepCard("Virtual keys")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/models$/);
    await expect(page.getByRole("heading", { name: "My models", level: 1 })).toBeVisible();
    // Step 1 speaks of registered cards: started from To add, the tour brings In Registry back, so its ring sits on a
    // saved card and not on a tile to register.
    await scope(/^To add/).click();
    await startFromHelp();
    await expect(scope(/^In Registry/)).toBeChecked();
    await expect(page.locator('[data-tour="first-model"]').getByRole("button", { name: /^Register/ })).toHaveCount(0);
    await expect(page.locator('[data-tour="first-model"]')).toHaveCount(1);
    await button("Skip the tour").click();
    // A step whose anchor is not on the page is skipped, never waited on forever.
    await page.evaluate(() => {
      const set = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name: string, value: string) {
        if (name === "data-tour" && /^(groups|first-group)$/.test(value)) return;
        set.call(this, name, value);
      };
      Object.assign(window, {
        restoreAnchors: () => {
          Element.prototype.setAttribute = set;
        },
      });
    });
    await startFromHelp();
    await expect(stepCard("My models")).toBeVisible();
    await button("Next").click();
    await expect(stepCard("Virtual keys")).toContainText("Step 3 of 4");
    await button("Skip the tour").click();
    await expect(page).toHaveURL(/#\/models$/);
    await page.evaluate(() => (window as unknown as { restoreAnchors: () => void }).restoreAnchors());
    // On a phone the card and the panel fit the screen.
    await page.setViewportSize({ width: 375, height: 812 });
    await button("Help for My models").click();
    await withinViewport(helpPanel);
    await helpPanel.getByRole("button", { name: "Start the tour", exact: true }).click();
    await withinViewport(stepCard("My models"));
    await button("Close the tour").click();
    await expect(stepCard("My models")).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 950 });
    if (await page.getByRole("heading", { level: 2 }).count()) await groupModels("No grouping"); // a new sign-in opens grouped again
  });
}
