// The 18 browser journeys of the UX audit (docs/reviews/2026-09-25-ux-audit.md), expressed
// against the current UI: the September 25 script no longer matched it (renamed controls, the
// model, group and key editors became steps). Each journey keeps its claim; comments say where
// the control changed.
// Scope: real Registry HTTP server + production React build; synthetic Bifrost, no native ABI
// or provider inference qualification. The journeys share one page and are destructive, so this
// is one test of sequential steps run against a fresh fixture (see playwright.config.ts).
import type { Locator, Page } from "@playwright/test";
import { expect, expectNoBasicJargon, skipTour, test, token } from "./fixtures";

// The first visit is part of the journeys (#96): the guided tour is offered, then remembered.
test.use({ tourSeen: false });

test("UX journeys", async ({ page, pageErrors: errors, browser, baseURL }, testInfo) => {
  const headers = { Authorization: `Bearer ${token}` };
  const api = async (path: string) => {
    const r = await page.request.get(`/api/${path}`, { headers });
    expect(r.status()).toBe(200);
    return r.json();
  };
  // Reference catalogue reads made by the page (the API helper's own reads are not page requests).
  const catalogReads: string[] = [];
  page.on("request", r => {
    if (r.method() === "GET" && new URL(r.url()).pathname === "/api/catalog") catalogReads.push(r.url());
  });
  const button = (name: string) => page.getByRole("button", { name, exact: true });
  const scope = (name: RegExp) => page.getByRole("radio", { name });
  const searchModels = () => page.getByRole("textbox", { name: "Search models", exact: true });
  const nav = (name: string) => page.getByRole("link", { name, exact: true });
  const sheet = () => page.locator('[data-slot="sheet-content"]');
  // A saved card opens read-first: the sheet's own X closes it (Cancel only leaves the editor).
  const closeSheet = () => sheet().getByRole("button", { name: "Close", exact: true }).click();
  const cardSteps = () => sheet().getByRole("navigation", { name: "Steps" }).getByRole("listitem");
  const keyCard = (name: string) =>
    page.locator('[data-slot="card"]').filter({ has: page.getByText(name, { exact: true }) });
  // Spec #85 round 2: the Keys page shelves empty keys (collapsed) and, in Basic, folds its filters into "Filters (n)".
  const emptyShelf = async () => {
    const shelf = page.getByRole("button", { name: /^(Empty|Vides) \d+$/ });
    if ((await shelf.getAttribute("aria-expanded")) === "false") await shelf.click();
  };
  const keyFilters = async () => {
    const filters = page.getByRole("button", { name: /^(Filters|Filtres)( \(\d+\))?$/ });
    if ((await filters.count()) && (await filters.getAttribute("aria-expanded")) !== "true") await filters.click();
  };
  const composerStep = (label: string) =>
    page
      .getByRole("list", { name: "Key composition steps" })
      .getByRole("button", { name: new RegExp(`^\\d ${label}`) });
  const keyHeading = () => page.getByRole("heading", { name: "QA Development Key", exact: true });
  const keyChanges = () => page.getByRole("region", { name: "Changes before publishing" });
  const editSelection = () => button("Edit selection").click();
  const keyAction = async (name: string) => {
    await button("More actions").click();
    await page.getByRole("menuitem", { name, exact: true }).click();
  };
  const openDevelopmentKey = async () => {
    await keyCard("QA Development Key").getByRole("button", { name: "Open · QA Development Key", exact: true }).click();
    await keyHeading().waitFor();
  };
  const shot = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ animations: "disabled" }), contentType: "image/png" });
  // Accessible names of the card actions in the first card grid, read from the accessibility tree.
  const cardActions = async (on: Page) =>
    [
      ...(await on.locator('[data-slot="card"]').first().locator("xpath=..").ariaSnapshot()).matchAll(
        /- button "((?:[^"\\]|\\.)*)"/g,
      ),
    ].map(match => match[1]);
  const duplicates = (names: string[]) => names.filter((name, index) => names.indexOf(name) !== index);
  // Models opens grouped by serving provider, a card under each provider serving it (#85). Basic keeps the
  // grouping in Filters; Expert keeps the toolbar inline. Steps that count one tile per card browse flat.
  const groupModels = async (option: string) => {
    const grouping = page.getByRole("combobox", { name: "Group models by", exact: true });
    const folded = !(await grouping.isVisible());
    if (folded) await page.getByRole("button", { name: /^Filters/ }).click();
    await grouping.click();
    await page.getByRole("option", { name: option, exact: true }).click();
    if (!folded) return;
    await page.getByRole("heading", { level: 1 }).click(); // a click outside closes Filters
    await expect(page.locator('[data-slot="popover-content"]')).toHaveCount(0);
  };
  const expertSwitch = () => page.getByRole("switch", { name: "Expert mode", exact: true });
  const setExpert = async (on: boolean) => {
    if ((await expertSwitch().getAttribute("aria-checked")) !== String(on)) await expertSwitch().click();
  };
  // Basic, an opened card: no tab shows a technical term; in the editor a tab holds the one "Edit details"
  // (the Access tab also "Edit accesses", the way to its step), not a button per part, access and value.
  const sweepCardTabs = async (where: string, editing = false) => {
    for (const tab of ["Overview", "Properties", "Sources", "Access"]) {
      await sheet().getByRole("tab", { name: tab, exact: true }).click();
      await expectNoBasicJargon(page, `${where}, ${tab} tab`);
      const expected = editing
        ? tab === "Access"
          ? ["Edit details", "Edit accesses"]
          : ["Edit details"]
        : tab === "Access"
          ? ["Edit accesses", "Edit"]
          : ["Edit"];
      await expect(sheet().getByRole("button", { name: /^Edit/ }), `${where}, ${tab} tab: its edit buttons`).toHaveText(
        expected,
      );
    }
  };
  const withinViewport = async (locator: Locator) => {
    await page.waitForFunction(
      el => {
        const r = (el as Element).getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          r.x >= 0 &&
          r.y >= 0 &&
          r.right <= innerWidth + 1 &&
          r.bottom <= innerHeight + 1
        );
      },
      await locator.elementHandle(),
      { timeout: 2000 },
    );
    const box = await locator.boundingBox();
    const view = page.viewportSize()!;
    expect(
      box && box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1,
      JSON.stringify(box),
    ).toBeTruthy();
  };

  const workspace = await api("workspace");
  expect(workspace.connection.version, "This destructive QA is restricted to the synthetic fixture").toBe(
    "2.2.6-fixture",
  );

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
      "Associate a reference",
      "Add to card",
      "no reference",
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
      "Reference",
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

  await test.step("a capability summary keeps the focus on its trigger: Tab moves on to the next card", async () => {
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation", exact: true })
        .getByRole("link", { name: "My models", exact: true }),
    ).toBeVisible();
    const cards = page.locator('[data-slot="card"]');
    const summary = cards.first().getByRole("button", { name: / · Input: / });
    const popover = page.locator('[data-slot="popover-content"]');
    // Focusing the summary previews the panel; Tab leaves it for the next control instead of cycling inside it.
    await summary.focus();
    await expect(popover).toBeVisible();
    const next = cards.nth(1).getByRole("button", { name: /^Open .* details$/ });
    let presses = 0;
    while (presses < 8 && !(await next.evaluate(el => el === document.activeElement))) {
      await page.keyboard.press("Tab");
      presses += 1;
    }
    await expect(next, `The second card's title is reached in ${presses} Tab presses`).toBeFocused();
    // Escape closes the panel and gives the focus back; Enter opens the full panel.
    await summary.focus();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(summary).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(popover).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(summary).toBeFocused();
  });

  await test.step("My models opens on the saved cards; the rest waits in To add", async () => {
    // 12 saved cards, one tile each (QA Opus and QA Opus Fast share a reference); 69 discovered
    // models are not saved, 66 of them from the openrouter aggregator.
    const opens = page.getByRole("button", { name: /^Open .* details$/ });
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });
    await expect(scope(/^In Registry/)).toHaveAccessibleName("In Registry (12)");
    await expect(scope(/^In Registry/)).toBeChecked();
    await expect(scope(/^To add/)).toHaveAccessibleName("To add (69)");
    await expect(opens).toHaveCount(12);
    // A card wears a badge only when something needs attention: an ordinary saved card wears none.
    const badges = (name: string) => card(name).locator("[data-attention]");
    await expect(badges("QA Chat")).toHaveCount(0);
    await expect(page.locator('[data-slot="card"]').filter({ hasText: /\b(Saved|Not saved|Partial)\b/ })).toHaveCount(
      0,
    );
    // openrouter's anthropic/qa-opus is available beside QA Opus, never added. QA Opus Fast shares the
    // reference but is another model, and anthropic/qa-opus-pro is a variant: neither is offered.
    await expect(badges("QA Opus")).toHaveText(["+1 available"]);
    await expect(badges("QA Opus Fast")).toHaveCount(0);
    // Cards without a Models.dev reference say so once, QA Shared (two subscriptions) included.
    await expect(badges("QA Shared")).toHaveText(["no reference"]);
    // Their creator is guessed from the single subscription serving them: one more badge.
    for (const name of ["qa-sonnet", "qa-codex-mini", "qa-flash"])
      await expect(badges(name)).toHaveText(["no reference", "inferred creator"]);
    await expect(page.locator("[data-attention]")).toHaveCount(8);
    // Said once per tile: "+1 available" is the badge, not also a count in the Accesses button.
    await expect(
      card("QA Opus").getByRole("button", { name: /^Accesses/ }),
      "the Accesses button does not repeat +1 available",
    ).toHaveAccessibleName("Accesses · 1 · QA Opus");
    await expectNoBasicJargon(page, "My models");
    await scope(/^To add/).click();
    // To add is organised by subscription: the aggregator waits on a collapsed shelf, so the
    // subscriptions come first (sections are sorted, a count is the whole list, not the page).
    await groupModels("Group by provider");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Google 1",
      "Synthetic Provider 1",
      "Typesafe 1",
      "OpenRouter 66",
    ]);
    await expect(page.getByText("69 models · 3 shown, 66 in collapsed shelves", { exact: true })).toBeVisible();
    await expect(opens).toHaveCount(3);
    const shelf = page.getByRole("button", { name: "OpenRouter 66", exact: true });
    await expect(shelf).toHaveAttribute("aria-expanded", "false");
    await shelf.focus(); // the shelf opens from the keyboard
    await page.keyboard.press("Enter");
    await expect(shelf).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("69 models · 63 shown, 6 behind “Show more”", { exact: true })).toBeVisible(); // a shelf shows its first 60
    await expect(opens).toHaveCount(63); // a first page of 60 in the shelf
    await button("Show more (6)").click();
    await expect(opens).toHaveCount(69);
    await shelf.press("Space");
    await expect(opens).toHaveCount(3);
    await searchModels().fill("qa-opus"); // a search opens the shelves: its results are not hidden
    // Exact IDs: the variant keeps its own; the access sharing QA Opus' reference shows its native ID.
    await expect(opens).toHaveText(["QA Opus", "QA Opus Latest"]); // sorted by name; the aggregator ID reads as a name
    await expect(card("QA Opus Latest")).toContainText("~anthropic/qa-opus-latest");
    await expect(card("QA Opus")).toContainText("anthropic/qa-opus");
    // Two saved cards share this reference, one is this model: the tile offers that card, never "Partial" or "Not saved".
    await expect(card("QA Opus").locator("[data-attention]")).toHaveText(["Add to QA Opus"]);
    await expect(card("QA Opus Latest").locator("[data-attention]")).toHaveCount(0);
    await searchModels().fill(":batch");
    await expect(opens).toHaveText(["QA Codex (batch)"]);
    await expect(card("QA Codex (batch)")).toContainText("openai/qa-codex:batch");
    await expect(
      card("QA Codex (batch)").getByRole("button", { name: "Register · QA Codex (batch)", exact: true }),
      "#101: a tile to register says it can be registered",
    ).toBeVisible();
    await expect(card("QA Codex (batch)").locator("[data-attention]")).toHaveCount(0);
    await expect(page.locator('[data-slot="card"]').filter({ hasText: /\b(Saved|Not saved|Partial)\b/ })).toHaveCount(
      0,
    );
    await searchModels().fill("");
    // Settings counts the same scopes.
    await nav("Settings").click();
    await expect(page.getByText("In Registry (12) · To add (69)", { exact: true })).toBeVisible();
    await expectNoBasicJargon(page, "Settings");
    await nav("My models").click();
    await scope(/^In Registry/).click();
    await groupModels("No grouping");
    await button("Open QA Chat details").waitFor();
  });

  await test.step("Add to card opens the saved card with the access offered, nothing added", async () => {
    const part = (heading: RegExp) => sheet().getByRole("heading", { name: heading }).locator("..");
    let writes = 0;
    page.on("request", r => {
      if (r.method() === "PUT" && r.url().endsWith("/api/workspace")) writes++;
    });
    await scope(/^To add/).click();
    await searchModels().fill("qa-opus");
    await expect(page.getByRole("button", { name: /^Open .* details$/ })).toHaveText(["QA Opus", "QA Opus Latest"]);
    // openrouter's anthropic/qa-opus fits QA Opus alone (QA Opus Fast is another model): the card opens, no choice.
    await button("Add to card · QA Opus").click();
    await expect(page.getByText("Add to which card?")).toHaveCount(0);
    await expect(sheet().locator('[data-slot="sheet-title"]')).toHaveText("QA Opus");
    // It opens on the accesses: the saved one is in the card, openrouter's is offered and not added.
    await expect(part(/^Also available/)).toContainText(/openrouter/i);
    await expect(
      sheet().getByRole("heading", { name: "Also available · 1", exact: true }),
      'the count the tile shows as "+1 available"',
    ).toBeVisible();
    await expect(sheet().getByRole("button", { name: /^Add openrouter/i })).toBeVisible();
    await expect(part(/^Also available/)).not.toContainText("Claude");
    // The sections are tabs: the selected one is announced, arrow keys and Home/End move between them.
    const tab = (name: string) => sheet().getByRole("tab", { name, exact: true });
    await expect(tab("Access")).toHaveAttribute("aria-selected", "true");
    await tab("Access").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab("Properties")).toHaveAttribute("aria-selected", "true");
    await expect(tab("Properties")).toBeFocused();
    await expect(
      sheet().getByText("Values come from Models.dev unless you corrected them.", { exact: true }),
    ).toBeVisible();
    await page.keyboard.press("End");
    await expect(tab("Sources")).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Home");
    await expect(tab("Overview")).toHaveAttribute("aria-selected", "true");
    // Overview teaches something even without a description: who serves the model, and what else could.
    await expect(sheet().getByRole("tabpanel")).toContainText(/Served by.*1 more available/);
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    expect(writes, "Opening the card adds nothing").toBe(0);
    // Two cards hold the model (QA Opus Fast replaced by a copy of QA Opus in a mocked workspace): choose the card.
    const duo = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    await skipTour(duo);
    duo.on("pageerror", e => errors.push(e.message));
    const catalog = await api("catalog");
    const opus = workspace.data.models.find((m: { id: string }) => m.id === "qa-opus");
    const clone = {
      ...opus,
      id: "qa-opus-copy",
      name: "QA Opus Copy",
      accesses: opus.accesses.map((a: { id: string }) => ({ ...a, id: "Claude/qa-opus-copy" })),
    };
    await duo.route("**/api/workspace", r =>
      r.fulfill({
        json: {
          ...workspace,
          data: {
            ...workspace.data,
            models: [...workspace.data.models.filter((m: { id: string }) => m.id !== "qa-opus-fast"), clone],
          },
        },
      }),
    );
    await duo.route("**/api/catalog", r => r.fulfill({ json: catalog }));
    await duo.goto("/");
    await duo.getByRole("radio", { name: /^To add/ }).click();
    await duo.getByRole("textbox", { name: "Search models", exact: true }).fill("qa-opus");
    await duo
      .getByRole("button", { name: /^Add to card · QA Opus/ })
      .first()
      .click();
    const dialog = duo.getByRole("dialog");
    await expect(dialog).toContainText("Add to which card?");
    await dialog.getByRole("button", { name: /^QA Opus Copy/ }).waitFor();
    // Only saved cards are offered: nothing opens a draft over a saved card's ID (a manual access is the other way in).
    await expect(dialog.getByRole("button", { name: /separate|distincte/i })).toHaveCount(0);
    await dialog.getByRole("button", { name: /^QA Opus · qa-opus$/ }).click();
    await expect(duo.locator('[data-slot="sheet-content"] [data-slot="sheet-title"]')).toHaveText("QA Opus");
    await duo.close();
    // One card holds the reference (QA Opus Fast removed from a mocked workspace): the tile names it and opens it, no choice.
    const solo = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    await skipTour(solo);
    solo.on("pageerror", e => errors.push(e.message));
    await solo.route("**/api/workspace", r =>
      r.fulfill({
        json: {
          ...workspace,
          data: {
            ...workspace.data,
            models: workspace.data.models.filter((m: { id: string }) => m.id !== "qa-opus-fast"),
          },
        },
      }),
    );
    await solo.route("**/api/catalog", r => r.fulfill({ json: catalog }));
    await solo.goto("/");
    await solo.getByRole("radio", { name: /^To add/ }).click();
    await solo.getByRole("textbox", { name: "Search models", exact: true }).fill("qa-opus");
    // The tile joins Claude (qa-opus-fast is no longer saved) and OpenRouter: it sits under each; take the first.
    const tile = solo
      .locator('[data-slot="card"]')
      .filter({ has: solo.getByRole("button", { name: "Open QA Opus details", exact: true }) })
      .first();
    await expect(tile.locator("[data-attention]")).toHaveText(["Add to QA Opus"]);
    await tile.getByRole("button", { name: "Add to card · QA Opus", exact: true }).click();
    const soloSheet = solo.locator('[data-slot="sheet-content"]');
    await expect(soloSheet.locator('[data-slot="sheet-title"]')).toHaveText("QA Opus");
    await expect(soloSheet.getByRole("heading", { name: /^Also available/ }).locator("..")).toContainText(
      /openrouter/i,
    );
    await solo.close();
    await searchModels().fill("");
    await scope(/^In Registry/).click();
    await button("Open QA Chat details").waitFor();
  });

  await test.step("the reference catalogue loads once per Registry revision", async () => {
    await nav("Groups").click();
    await nav("My models").click();
    await button("Open QA Chat details").click();
    await sheet().getByRole("tab", { name: "Access", exact: true }).waitFor();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    // Settings and the catalog data page read the same catalogue.
    await nav("Settings").click();
    await button("Catalog sources").click();
    await page.getByText(/^Models\.dev describes \d+ models?\. Your Bifrost providers serve \d+ models?\./).waitFor();
    await button("Appearance").click();
    await button("General").click();
    await button("Open catalog data").first().click();
    await page.getByRole("heading", { name: "Catalog data", exact: true }).waitFor();
    await page.getByText("synthetic-provider/qa-chat", { exact: true }).first().waitFor();
    await nav("My models").click();
    await button("Open QA Chat details").waitFor();
    expect(
      catalogReads,
      "No refetch when returning to My models, opening a card, Settings or catalog data",
    ).toHaveLength(1);
  });

  await test.step("browsing by subscription: whole-list sections, sort, To add shelves, the logo choice, a stable count", async () => {
    const opens = page.getByRole("button", { name: /^Open .* details$/ });
    const headings = page.getByRole("heading", { level: 2 });
    const grouping = page.getByRole("combobox", { name: "Group models by", exact: true });
    const sorting = page.getByRole("combobox", { name: "Sort models by", exact: true });
    const choose = async (box: Locator, option: string) => {
      await box.click();
      await page.getByRole("option", { name: option, exact: true }).click();
    };
    const section = (name: string) =>
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(`^${name} \\d+$`) }) });
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });

    // Expert keeps the whole toolbar inline (Basic folds it into Filters and View options).
    await setExpert(true);
    // A card served by two subscriptions sits under each, and the totals count it once.
    await choose(grouping, "Group by provider");
    await expect(headings).toHaveText(["Claude 5", "Codex 3", "Google 2", "Synthetic Provider 3"]);
    await expect(section("Claude").getByRole("button", { name: "Open QA Shared details", exact: true })).toBeVisible();
    await expect(section("Codex").getByRole("button", { name: "Open QA Shared details", exact: true })).toBeVisible();
    await expect(
      page.getByText("12 models shown · a model served by several providers is counted once", { exact: true }),
    ).toBeVisible();
    // Sorted sections, sorted cards inside: the sort control orders both.
    await expect(sorting).toHaveText("Sort by name");
    await expect(opens).toHaveText([
      "QA Haiku",
      "QA Opus",
      "QA Opus Fast",
      "QA Shared",
      "qa-sonnet",
      "QA Codex",
      "QA Shared",
      "qa-codex-mini",
      "QA Gemini",
      "qa-flash",
      "QA Chat",
      "QA Code",
      "QA Vision",
    ]);
    await choose(sorting, "Recently added");
    await expect(opens).toHaveText([
      "QA Shared",
      "qa-sonnet",
      "QA Opus Fast",
      "QA Haiku",
      "QA Opus",
      "QA Shared",
      "qa-codex-mini",
      "QA Codex",
      "qa-flash",
      "QA Gemini",
      "QA Vision",
      "QA Chat",
      "QA Code",
    ]);
    await choose(grouping, "No grouping");
    await expect(opens).toHaveText([
      "QA Shared",
      "qa-flash",
      "qa-sonnet",
      "QA Gemini",
      "qa-codex-mini",
      "QA Codex",
      "QA Opus Fast",
      "QA Haiku",
      "QA Opus",
      "QA Vision",
      "QA Chat",
      "QA Code",
    ]);
    await choose(sorting, "Sort by creator"); // inferred creators count; QA Shared (two base types) has none and goes last
    await expect(opens).toHaveText([
      "QA Haiku",
      "QA Opus",
      "QA Opus Fast",
      "qa-sonnet",
      "QA Chat",
      "QA Code",
      "QA Vision",
      "QA Gemini",
      "qa-flash",
      "QA Codex",
      "qa-codex-mini",
      "QA Shared",
    ]);
    await choose(sorting, "Sort by provider");
    await expect(opens).toHaveText([
      "QA Haiku",
      "QA Opus",
      "QA Opus Fast",
      "QA Shared",
      "qa-sonnet",
      "QA Codex",
      "qa-codex-mini",
      "QA Gemini",
      "qa-flash",
      "QA Chat",
      "QA Code",
      "QA Vision",
    ]);
    await choose(sorting, "Sort by name");
    await expect(opens.first()).toHaveText("QA Chat");
    // To add has no date to sort by: it offers no "Recently added".
    await scope(/^To add/).click();
    await sorting.click();
    await expect(page.getByRole("option")).toHaveText([
      "Default order",
      "Sort by name",
      "Sort by creator",
      "Sort by provider",
    ]);
    await page.keyboard.press("Escape");
    await scope(/^In Registry/).click();

    // The primary logo is chosen in the page's View options and stored as the same preference.
    const logoChoice = (name: string) => page.getByRole("radio", { name, exact: true });
    const storedLogo = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem("registry-prototype-view") || "{}").logo);
    expect(await storedLogo()).not.toBe("provider");
    await button("View options").click();
    await expect(logoChoice("Creator")).toBeChecked();
    await logoChoice("Provider").click();
    await page.keyboard.press("Escape");
    await expect(card("QA Opus").getByRole("img", { name: "Claude", exact: true })).toHaveCount(2); // header and footer
    await expect(card("QA Opus").getByRole("img", { name: "Anthropic", exact: true })).toHaveCount(0);
    expect(await storedLogo()).toBe("provider");
    await nav("Settings").click();
    await button("Appearance").click();
    await page.getByRole("button", { name: "View options", exact: true }).click();
    await expect(logoChoice("Provider"), "Settings reads the same preference").toBeChecked();
    await logoChoice("Creator").click();
    await nav("My models").click();
    expect(await storedLogo()).toBe("creator");
    await expect(card("QA Opus").getByRole("img", { name: "Anthropic", exact: true })).toHaveCount(1);

    // The To add count counts tiles before and after the catalogue arrives, even where several
    // discovered models share one reference (a twin of QA Hunyuan joins its tile).
    const current = await api("workspace");
    const hunyuan = current.discovery.find((model: { accesses: { nativeModel?: string }[] }) =>
      model.accesses.some(access => access.nativeModel === "tencent/qa-hunyuan"),
    );
    const twin = structuredClone(hunyuan);
    twin.id = "qa-hunyuan-twin";
    twin.accesses = twin.accesses.map((access: { id: string; nativeModel: string }) => ({
      ...access,
      id: `openrouter/${twin.id}`,
      nativeModel: "tencent/qa-hunyuan-twin",
    }));
    const full = await api("catalog");
    const linked = full.accesses.find((access: { id: string }) => access.id === "openrouter/tencent/qa-hunyuan");
    const stable = {
      workspace: { ...current, discovery: [...current.discovery, twin] },
      catalog: {
        ...full,
        accesses: [
          ...full.accesses,
          { ...structuredClone(linked), id: "openrouter/tencent/qa-hunyuan-twin", model: "tencent/qa-hunyuan-twin" },
        ],
      },
    };
    const loading = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    await skipTour(loading);
    loading.setDefaultTimeout(10_000);
    loading.on("pageerror", e => errors.push(e.message));
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    await loading.route("**/api/workspace", r => r.fulfill({ json: stable.workspace }));
    await loading.route("**/api/catalog", async r => {
      await held;
      await r.fulfill({ json: stable.catalog });
    });
    await loading.goto("/");
    await expect(loading.getByRole("status", { name: "Loading model cards…" })).toBeVisible();
    await expect(
      loading.getByText("Loading models…", { exact: true }),
      "said in words, not only a skeleton",
    ).toBeVisible();
    const toAdd = loading.getByRole("radio", { name: /^To add/ });
    await expect(toAdd, "before the catalogue: the tiles, not the 70 discovered models").toHaveAccessibleName(
      "To add (69)",
    );
    release();
    await expect(loading.getByRole("status", { name: "Loading model cards…" })).toBeHidden();
    await expect(toAdd).toHaveAccessibleName("To add (69)");
    await loading.close();
  });

  await test.step("scope, search, filters and grouping survive leaving the page", async () => {
    const grouping = page.getByRole("combobox", { name: "Group models by", exact: true });
    await scope(/^To add/).click();
    await searchModels().fill("qwen");
    await grouping.click();
    await page.getByRole("option", { name: "Group by creator", exact: true }).click();
    await nav("Virtual keys").click();
    await nav("My models").click();
    await expect(scope(/^To add/)).toBeChecked();
    await expect(searchModels()).toHaveValue("qwen");
    await expect(grouping).toHaveText("Group by creator");
    await expect(page.getByRole("heading", { name: /^Creator not identified/ })).toBeVisible();
    // Each scope keeps its own filters: a To add search never empties In Registry.
    await scope(/^In Registry/).click();
    await expect(searchModels()).toHaveValue("");
    await expect(page.getByRole("button", { name: /^Open .* details$/ })).toHaveCount(12);
    await scope(/^To add/).click();
    await expect(searchModels()).toHaveValue("qwen");
    await grouping.click();
    await page.getByRole("option", { name: "No grouping", exact: true }).click();
    await button("Clear all").click();
    await scope(/^In Registry/).click();
  });

  await test.step("More filters closes like the other popovers; card actions have unique names", async () => {
    const more = page.getByRole("button", { name: /^More filters/ });
    const output = page.getByRole("combobox", { name: "Output", exact: true });
    await more.click();
    await expect(output).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(output).toBeHidden();
    await expect(more, "Escape returns focus to the trigger").toBeFocused();
    // A filter chosen inside keeps the panel open; a click outside closes it.
    await more.click();
    await output.click();
    await page.getByRole("option", { name: "Text", exact: true }).click();
    await expect(more).toHaveAccessibleName("More filters (1)");
    await expect(output).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(output).toBeHidden();
    await button("Clear all").click();
    // Every card action names its card: no two "Accesses · 1" or identical summaries.
    const names = await cardActions(page);
    expect(names).toEqual(expect.arrayContaining(["Open QA Chat details", "Accesses · 1 · QA Chat"]));
    expect(duplicates(names), "In Registry").toEqual([]);
    await scope(/^To add/).click();
    expect(duplicates(await cardActions(page)), "To add").toEqual([]);
    await scope(/^In Registry/).click();
    // Key cards too: each Adopt/See what blocks it/Open names its key.
    await nav("Virtual keys").click();
    // The first grid is the managed shelf (spec #85 round 2); the To adopt shelf follows.
    const keyActions = await cardActions(page);
    expect(keyActions).toEqual(expect.arrayContaining(["Open · QA Development Key", "Open · QA Visual Key"]));
    expect(duplicates(keyActions), "Virtual keys").toEqual([]);
    await nav("My models").click();
    // The legend shows the glyphs it explains.
    const legend = page.getByLabel("Capability state legend", { exact: true });
    await expect(legend.locator("svg").first()).toBeVisible();
    await expect(legend).toContainText("?");
  });

  await test.step("creators come from Models.dev references", async () => {
    // Subscription cards were saved from discovery: slug name, creator "Unknown", no modalities.
    // They show the reference name over the common ID, and the creator from the reference
    // namespace (anthropic/… has a Models.dev provider record, tencent/… does not).
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });
    await expect(card("QA Opus")).toContainText("Anthropic · qa-claude");
    await expect(card("QA Opus").getByText("qa-opus", { exact: true })).toBeVisible();
    await expect(card("QA Opus").getByText("? → ?")).toHaveCount(0);
    await expect(card("QA Shared")).toContainText("Creator not identified"); // no reference, two subscriptions: nothing to infer
    // The card sheet names it the same way, its common ID below.
    await button("Open QA Opus details").click();
    await expect(sheet().locator('[data-slot="sheet-title"]')).toHaveText("QA Opus");
    await expect(sheet().locator('[data-slot="sheet-description"]')).toContainText("qa-opus");
    await expect(sheet().getByRole("heading", { name: "QA Opus", exact: true }), "The name shows once").toHaveCount(1);
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    const creators = page.getByRole("combobox", { name: "Creator", exact: true });
    await creators.click();
    // Counts are the models of the current scope: saved cards here, discovered ones in To add.
    await expect(page.getByRole("option")).toHaveText([
      "Creator: all",
      "Anthropic (4)",
      "Fixture Labs (3)",
      "Google (2)",
      "OpenAI (2)",
      "Creator not identified (1)",
    ]);
    await page.keyboard.press("Escape");
    await scope(/^To add/).click();
    await creators.click();
    await expect(page.getByRole("option")).toHaveText([
      "Creator: all",
      "Anthropic (3)",
      "DeepSeek (1)",
      "Fixture Labs (1)",
      "Google (1)",
      "Meituan (1)",
      "OpenAI (1)",
      "Tencent (1)",
      "Typesafe (1)",
      "Creator not identified (60)",
    ]); // ~anthropic/qa-opus-latest and openai/qa-codex:batch: inferred from their vendor namespace
    await page.getByRole("option", { name: "Tencent (1)", exact: true }).click();
    await expect(page.getByRole("button", { name: /^Open .* details$/ })).toHaveText(["QA Hunyuan"]);
    await expect(card("QA Hunyuan")).toContainText("Tencent · qa-hunyuan");
    await button("Clear all").click();
    await scope(/^In Registry/).click();
    // The card sheet names a missing creator the same way, in its field and in Review.
    await button("Open QA Shared details").click();
    await button("Edit").click();
    await sheet().getByRole("button", { name: "Edit Registry details", exact: true }).click();
    const creatorField = page
      .getByRole("dialog", { name: "Edit Registry details" })
      .getByRole("combobox", { name: "Creator", exact: true });
    await expect(creatorField).toHaveValue("");
    await expect(creatorField).toHaveAttribute("placeholder", "Creator not identified");
    await creatorField.fill("QA Labs");
    await button("Keep changes").click();
    await button("Review").click();
    await sheet().getByText("Creator: Creator not identified → QA Labs", { exact: true }).waitFor();
    await button("Cancel").click();
    await button("Discard draft").click();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    await button("Open QA Chat details").waitFor();
  });

  await test.step("creator and provider marks resolve to real logos; grouping names match", async () => {
    // Claude, Codex and Google are custom providers with base types anthropic, openai, gemini.
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });
    const marks = (scope: Locator, name: string) => scope.getByRole("img", { name, exact: true });
    const logo = (scope: Locator, name: string) =>
      expect(marks(scope, name).first().locator("svg, img"), `${name} shows a logo, not initials`).toHaveCount(1);
    // Creator logos (default): normalized creator names against the full icon set, initials last.
    await logo(card("QA Opus"), "Anthropic");
    await logo(card("QA Codex"), "OpenAI");
    await logo(card("QA Gemini"), "Google");
    await expect(marks(card("QA Chat"), "Fixture Labs")).toHaveText("FI");
    await expect(marks(card("QA Shared"), "Creator not identified")).toHaveText("?");
    await logo(card("qa-codex-mini"), "OpenAI"); // inferred from its Codex subscription
    // Serving providers in the footer: custom ones through their base type, one display name.
    for (const [model, provider] of [
      ["QA Opus", "Claude"],
      ["QA Codex", "Codex"],
      ["QA Gemini", "Google"],
    ])
      await logo(card(model), provider);
    await button("Use dark theme").click();
    await expect(
      marks(card("QA Opus"), "Anthropic").locator("svg"),
      "black marks turn light on the dark theme",
    ).toHaveCSS("filter", /invert\(1\)/);
    await button("Use light theme").click();

    const group = async (by: string) => {
      await page.getByRole("combobox", { name: "Group models by", exact: true }).click();
      await page.getByRole("option", { name: by, exact: true }).click();
    };
    const section = (name: string) =>
      page
        .locator("section")
        .filter({ has: page.getByRole("heading", { level: 2, name: new RegExp(`^${name} \\d+$`) }) });
    const sectionNames = async () =>
      (await page.getByRole("heading", { level: 2 }).allTextContents()).map(text => text.replace(/\s*\d+$/, "")).sort();
    await group("Group by provider");
    await section("Claude").waitFor();
    expect(await sectionNames()).toEqual(["Claude", "Codex", "Google", "Synthetic Provider"]); // saved cards; OpenRouter waits in To add
    await expect(
      section("Claude").getByRole("button", { name: "Open QA Opus details", exact: true }),
      "a saved card sits under its own access, not a matching one",
    ).toBeVisible();
    await group("Group by creator");
    await section("Anthropic").waitFor();
    await expect(section("Anthropic").getByRole("button", { name: "Open QA Opus details", exact: true })).toBeVisible();
    await group("No grouping");
    // The aggregator's models wait in To add, with the same creator and provider marks.
    await scope(/^To add/).click();
    await searchModels().fill("qa-reasoner");
    await logo(card("QA Reasoner"), "DeepSeek");
    await logo(card("QA Reasoner"), "OpenRouter");
    await searchModels().fill("");
    await scope(/^In Registry/).click();

    // Provider logos: the card's own serving providers replace the creator mark.
    await nav("Settings").click();
    await button("Appearance").click();
    await logo(
      page.locator("section").filter({ has: page.getByRole("heading", { name: "Claude", exact: true }) }),
      "Claude",
    );
    await button("View options").click();
    await page.getByRole("radio", { name: "Provider", exact: true }).click(); // the primary logo is part of View options
    await page.keyboard.press("Escape");
    await nav("My models").click();
    await expect(marks(card("QA Opus"), "Claude")).toHaveCount(2); // header and footer
    await expect(marks(card("QA Opus"), "Anthropic")).toHaveCount(0);
    await logo(card("QA Opus"), "Claude");
    await nav("Settings").click();
    await button("Appearance").click();
    await button("View options").click();
    await page.getByRole("radio", { name: "Creator", exact: true }).click();
    await page.keyboard.press("Escape");
    await nav("My models").click();

    // Keys show the same marks and display names.
    await nav("Virtual keys").click();
    await logo(keyCard("QA Claude Key"), "Claude");
    await expect(keyCard("QA Claude Key")).toContainText("all models of Claude");
    await nav("My models").click();
    await button("Open QA Chat details").waitFor();
    await setExpert(false);
  });

  await test.step("cards without a reference: inferred creator, override, clear, Associate a reference", async () => {
    // qa-codex-mini, qa-sonnet and qa-flash have no reference and one subscription each (Codex →
    // openai, Claude → anthropic, Google → gemini); QA Shared spans two, so nothing is guessed.
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });
    // The tile says the facts are unknown and offers the action once, in its footer; the opened card, which has no such button, adds what to do.
    const unknownFacts = "Facts unknown";
    const sheetUnknownFacts = "Facts unknown — associate a reference";
    const modelOf = async (id: string) => (await api("workspace")).data.models.find((m: { id: string }) => m.id === id);
    const writes = () => page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/workspace"));
    for (const [name, creator] of [
      ["qa-codex-mini", "OpenAI"],
      ["qa-sonnet", "Anthropic"],
      ["qa-flash", "Google"],
    ]) {
      await expect(card(name)).toContainText(creator);
      await expect(card(name).locator("[data-attention]")).toHaveText(["no reference", "inferred creator"]);
      await expect(card(name).getByText(unknownFacts, { exact: true })).toBeVisible();
      await expect(card(name).getByText("? → ?")).toHaveCount(0);
      const associate = card(name).getByRole("button", { name: `Associate a reference · ${name}`, exact: true });
      await expect(associate).toBeVisible();
      // The action is as light as the other card buttons, not a second title: no heavier than 500.
      expect(await associate.evaluate(el => getComputedStyle(el).fontWeight), "Associate is not at title weight").toBe(
        "500",
      );
      expect(
        await associate.evaluate(el => getComputedStyle(el).borderTopWidth),
        "Associate is an outline button",
      ).toBe("1px");
    }
    await expect(card("QA Shared").locator("[data-attention]")).toHaveText(["no reference"]);
    await expect(card("QA Opus").locator("[data-attention]")).toHaveText(["+1 available"]);
    await expect(card("QA Opus").getByRole("button", { name: /^Associate a reference/ })).toHaveCount(0);
    expect(await modelOf("qa-sonnet")).toMatchObject({ creator: "Anthropic", creatorSource: "inferred" });
    expect(await modelOf("qa-opus")).toMatchObject({ creatorSource: "reference" });

    // Override: the sheet shows the guess as such; a typed creator replaces it and loses the mark.
    await button("Open qa-codex-mini details").click();
    await expect(sheet().getByText("inferred", { exact: true }).first()).toBeVisible(); // read-first: the guess is shown as such
    // The sheet says what the tile says about unknown facts, not a bare "? → ?".
    await sheet().getByRole("tab", { name: "Properties", exact: true }).click();
    await expect(sheet().getByText(sheetUnknownFacts, { exact: true })).toBeVisible();
    await expect(sheet().getByText("? → ?")).toHaveCount(0);
    await sheet().getByRole("tab", { name: "Overview", exact: true }).click();
    await button("Edit").click();
    // Basic edits the card through one "Edit details" button, not one per part and per value.
    await sweepCardTabs("the edit view of a card", true);
    await sheet().getByRole("button", { name: "Edit details", exact: true }).click();
    const creatorField = page
      .getByRole("dialog", { name: "Edit details" })
      .getByRole("combobox", { name: "Creator", exact: true });
    await expect(
      page.getByRole("dialog", { name: "Edit details" }).getByRole("combobox", { name: "Family", exact: true }),
      "Basic does not edit the family",
    ).toHaveCount(0);
    await expect(creatorField).toHaveValue("OpenAI");
    await creatorField.fill("QA Labs");
    await button("Keep changes").click();
    await button("Review").click();
    await sheet().getByText("Creator: OpenAI → QA Labs", { exact: true }).waitFor();
    let write = writes();
    await button("Save model").click();
    expect(
      (await write).postDataJSON().data.models.find((m: { id: string }) => m.id === "qa-codex-mini"),
    ).toMatchObject({ creator: "QA Labs", creatorSource: "manual" });
    await sheet().waitFor({ state: "hidden" });
    await expect(card("qa-codex-mini")).toContainText("QA Labs");
    await expect(card("qa-codex-mini").locator("[data-attention]")).toHaveText(["no reference"]);
    // Saving one card does not turn the other guesses into stored values.
    expect(await modelOf("qa-codex-mini")).toMatchObject({ creator: "QA Labs", creatorSource: "manual" });
    expect(await modelOf("qa-sonnet")).toMatchObject({ creator: "Anthropic", creatorSource: "inferred" });

    // Clear: an emptied creator stays empty, the guess does not come back.
    await button("Open qa-codex-mini details").click();
    await button("Edit").click();
    await sheet().getByRole("button", { name: "Edit details", exact: true }).click();
    await creatorField.fill("");
    await button("Keep changes").click();
    await button("Review").click();
    await sheet().getByText("Creator: QA Labs → Creator not identified", { exact: true }).waitFor();
    write = writes();
    await button("Save model").click();
    await write;
    await sheet().waitFor({ state: "hidden" });
    await expect(card("qa-codex-mini")).toContainText("Creator not identified");
    await expect(card("qa-codex-mini")).not.toContainText("OpenAI");
    expect(await modelOf("qa-codex-mini")).toMatchObject({ creatorSource: "manual" });
    expect((await modelOf("qa-codex-mini")).creator).toMatch(/^(Unknown)?$/);

    // Associate: search the references, save the correspondence with the card, read its facts.
    await card("qa-flash").getByRole("button", { name: "Associate a reference · qa-flash", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Associate a reference" });
    const search = dialog.getByRole("textbox", { name: "Search references", exact: true });
    await expect(search).toHaveValue("qa-flash"); // starts from the native name
    await expect(dialog.getByText("No reference matches. Try fewer words.")).toBeVisible();
    await search.fill("gemini");
    write = writes();
    await dialog.getByRole("button", { name: /^QA Gemini/ }).click();
    const sent = (await write).postDataJSON();
    expect(
      sent.data.models
        .find((m: { id: string }) => m.id === "qa-flash")
        .accesses.map((a: { referenceId: string }) => a.referenceId),
    ).toEqual(["google/qa-gemini"]);
    await dialog.waitFor({ state: "hidden" });
    const flash = card("QA Gemini (qa-flash)"); // the reference names it; QA Gemini keeps its own name
    await expect(flash).toContainText("Google");
    await expect(flash.locator("[data-attention]")).toHaveCount(0);
    await expect(flash.getByText(unknownFacts, { exact: true })).toHaveCount(0);
    await expect(flash.getByRole("button", { name: /Input: Text, Image; Output: Text/ })).toBeVisible();
    await expect(flash.getByRole("button", { name: /^Associate a reference/ })).toHaveCount(0);
    expect(await modelOf("qa-flash")).toMatchObject({ creator: "Google", creatorSource: "reference" });
    expect((await modelOf("qa-flash")).accesses[0].referenceId).toBe("google/qa-gemini");
    await shot("cards-without-reference");

    // Put the fixture back for the steps that follow: the guesses return, the reference goes.
    const current = await api("workspace");
    const models = current.data.models.map((m: { id: string; accesses: { referenceId?: string }[] }) =>
      m.id === "qa-codex-mini"
        ? { ...m, creator: "Unknown", creatorSource: undefined }
        : m.id === "qa-flash"
          ? {
              ...m,
              creator: "Unknown",
              creatorSource: undefined,
              accesses: m.accesses.map(a => ({ ...a, referenceId: "" })),
            }
          : m,
    );
    const restored = await page.request.put("/api/workspace", {
      headers: { ...headers, "If-Match": current.revision },
      data: { data: { ...current.data, models } },
    });
    expect(restored.status()).toBe(200);
    await page.reload();
    await page.getByLabel("Admin token", { exact: true }).fill(token);
    await button("Sign in").click();
    await button("Open QA Chat details").waitFor();
    await groupModels("No grouping"); // a reload opens grouped by provider again
    await expect(card("qa-flash").locator("[data-attention]")).toHaveText(["no reference", "inferred creator"]);
    await expect(card("qa-codex-mini").locator("[data-attention]")).toHaveText(["no reference", "inferred creator"]);
  });

  await test.step("model cancel protects draft; focus stays in editor", async () => {
    await button("Open QA Chat details").click();
    await button("Edit").click();
    await page.getByRole("textbox", { name: "Display name *", exact: true }).fill("QA draft preserved");
    expect(await sheet().evaluate(el => el.contains(document.activeElement))).toBe(true);
    await button("Cancel").click();
    await page.getByRole("heading", { name: "Discard changes?" }).waitFor();
    await button("Keep editing").click();
    await expect(page.getByRole("textbox", { name: "Display name *", exact: true })).toHaveValue("QA draft preserved");
    await button("Cancel").click();
    await button("Discard draft").click();
    await expect(button("Edit"), "Cancel returns to the read view").toBeVisible();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
  });

  await test.step("unchanged discovery closes without false discard warning", async () => {
    await scope(/^To add/).click(); // a discovered model now waits in To add
    await button("Open QA Unregistered details").click(); // was "Review & add"
    await expect(cardSteps(), "A new card goes straight to the editor, in the same step order as an edit").toHaveText([
      "1. Accesses",
      "2. Model details",
      "3. Review",
    ]);
    await button("Cancel").click();
    await sheet().waitFor({ state: "hidden" });
    await expect(page.getByRole("heading", { name: "Discard changes?" })).toHaveCount(0);
  });

  await test.step("registering from To add preselects the operations Bifrost declares", async () => {
    // Google/qa-image declares mode image_generation in its Bifrost parameters datasheet.
    await searchModels().fill("qa-image");
    await button("Open QA Image details").click();
    const inCard = sheet()
      .getByRole("heading", { name: /^In this card/ })
      .locator("..");
    // Basic reads the preselected request types in one line; Change opens the full list.
    await expect(inCard).toContainText("Requests: Image generation · Change");
    await expect(inCard, "#100: Basic names the access by its provider alone").toContainText("Google");
    await expect(inCard).not.toContainText("qa-image");
    await expect(inCard.getByRole("checkbox")).toHaveCount(0);
    await inCard.getByRole("button", { name: "Change requests for Google", exact: true }).click();
    await expect(inCard.getByRole("checkbox", { name: /^Image generation/ })).toBeChecked();
    await expect(inCard.getByRole("checkbox", { name: /^Chat Completions/ })).not.toBeChecked();
    await expect(sheet().locator('[data-slot="sheet-title"]'), "#101: one verb for registering").toHaveText(
      "Register a model",
    );
    await button("Next: model details").click();
    // #101: creating a card says "registering"; the edit flow above keeps "saving".
    await expect(sheet()).toContainText("Preview before registering");
    await button("Review").click();
    await expect(sheet().locator("#editor-journey-step-2")).toContainText("Review before registering");
    // #100: Review opens on one plain sentence of consequence; Basic shows no Registry ID or endpoint before the fold.
    const review = sheet().locator("#editor-journey-step-2");
    await expect(review).toContainText(
      "You’re registering QA Image from your Google subscription. It appears in My models; no key can use it until you add it to one.",
    );
    const technical = review.locator("details").filter({ has: page.getByText("Technical details", { exact: true }) });
    await expect(technical).not.toHaveAttribute("open");
    for (const jargon of [
      "Google/qa-image",
      "images/generations",
      "Registry ID",
      "Registry exposed ID",
      "Registry endpoints",
      "Documentary record",
      "Selected operations define",
    ])
      await expect(review.getByText(jargon).first(), `${jargon} waits behind the fold`).toBeHidden();
    await expectNoBasicJargon(page, "the Register review, fold closed");
    await technical.getByText("Technical details", { exact: true }).click();
    await expect(technical).toContainText("Registry exposed ID: Google/qa-image");
    await expect(technical).toContainText("Registry endpoints: images/generations");
    const write = page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/workspace"));
    await button("Register").click();
    const saved = (await write).postDataJSON().data.models.find((m: { id: string }) => m.id === "qa-image");
    expect(saved.accesses.map((a: { id: string; endpoints: string[] }) => [a.id, a.endpoints])).toEqual([
      ["Google/qa-image", ["images/generations"]],
    ]);
    await sheet().waitFor({ state: "hidden" });
    await expect(scope(/^To add/)).toHaveAccessibleName("To add (68)");
    await searchModels().fill("");
    await scope(/^In Registry/).click();
    await expect(scope(/^In Registry/)).toHaveAccessibleName("In Registry (13)");
    await expect(
      page
        .locator('[data-slot="card"]')
        .filter({ has: button("Open QA Image details") })
        .locator("[data-attention]"),
    ).toHaveCount(0);
  });

  await test.step("Basic registers under a Call name of its own, and its errors speak plainly", async () => {
    // Owner decision: Basic keeps the name applications use to call the model when registering; the family and the
    // "Common model ID" fold stay Expert's. The errors below are the ones a person meets before the card is valid.
    await scope(/^To add/).click();
    await searchModels().fill("qa-unregistered");
    await button("Open QA Unregistered details").click();
    const callName = sheet().getByRole("textbox", { name: "Call name", exact: true });
    await expect(callName, "prefilled with the proposed value").toHaveValue("qa-unregistered");
    await expect(sheet().getByText("The name applications use to call this model", { exact: true })).toBeVisible();
    await expect(sheet().getByText("Common model ID"), "Expert's field keeps its own name").toHaveCount(0);
    await expect(sheet().getByRole("combobox", { name: /ID/ }), "no catalogue search for the ID in Basic").toHaveCount(
      0,
    );
    await expectNoBasicJargon(page, "the Call name field");
    // No request type chosen: Review sends the person back to the access, in words that name no endpoint.
    const inCard = sheet()
      .getByRole("heading", { name: /^In this card/ })
      .locator("..");
    await inCard.getByRole("button", { name: /^Change requests for / }).click();
    for (const type of [/^Chat Completions/, /^Responses/])
      await inCard.getByRole("checkbox", { name: type }).uncheck();
    await button("Next: model details").click();
    await button("Review").click();
    const noRequestType = "Choose at least one request type for every access.";
    await expect(
      page.getByText(noRequestType, { exact: true }),
      "the banner says request type, not endpoint",
    ).toBeVisible();
    await expectNoBasicJargon(page, "the registration error, no request type");
    const accessDialog = page.getByRole("dialog", { name: "Edit provider access" });
    await accessDialog.getByRole("checkbox", { name: /^Responses/ }).check();
    await expect(accessDialog.getByRole("alert")).toHaveCount(0);
    await accessDialog.getByRole("button", { name: "Keep changes", exact: true }).click();
    // The call name is checked as Expert's common ID is: a bad one keeps Next off and says what is allowed.
    await callName.fill("QA Unregistered");
    await expect(callName).toHaveAttribute("aria-invalid", "true");
    await expect(sheet().getByText(/^Use lowercase letters, digits, dots, hyphens or underscores/)).toBeVisible();
    await expect(
      sheet().getByText("Choose a valid call name and at least one complete access to prepare the card."),
    ).toBeVisible();
    await expect(button("Next: model details")).toBeDisabled();
    await sheet().getByRole("button", { name: "3. Review", exact: true }).click();
    await expect(sheet().getByRole("alert").filter({ hasText: "Enter a valid call name." })).toBeVisible();
    await expectNoBasicJargon(page, "the registration error, bad call name");
    await callName.fill("qa-call-name");
    await expect(sheet().getByText("Enter a valid call name."), "fixing the name clears its banner").toHaveCount(0);
    await button("Next: model details").click();
    await button("Review").click();
    const review = sheet().locator("#editor-journey-step-2");
    await expect(review).toContainText(
      "You’re registering QA Unregistered from your Synthetic Provider subscription. It appears in My models; no key can use it until you add it to one.",
    );
    await expectNoBasicJargon(page, "the Review of a chosen call name, fold closed");
    const write = page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/workspace"));
    await button("Register").click();
    const saved = (await write).postDataJSON().data.models.find((m: { id: string }) => m.id === "qa-call-name");
    expect(
      saved.accesses.map((a: { id: string; nativeModel: string }) => [a.id, a.nativeModel]),
      "the chosen call name is the common ID; the access still calls the native model",
    ).toEqual([["synthetic-provider/qa-call-name", "qa-unregistered"]]);
    await sheet().waitFor({ state: "hidden" });
    // Put the fixture back for the steps that follow: delete the card, and QA Unregistered returns to To add.
    await scope(/^In Registry/).click();
    await searchModels().fill("qa-call-name");
    await button("Open QA Unregistered details").click();
    await button("More actions").click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    await sheet().waitFor({ state: "hidden" });
    await searchModels().fill("");
    await expect(scope(/^In Registry/)).toHaveAccessibleName("In Registry (13)");
  });

  await test.step("a saved card opens read-first: Edit and Cancel, one step order, No changes, Delete in a menu", async () => {
    await searchModels().fill("qa-image");
    await button("Open QA Image details").click();
    // Read view: the name once as the title, the common ID under it, details to read, nothing to change.
    await expect(sheet().locator('[data-slot="sheet-title"]')).toHaveText("QA Image");
    await expect(
      sheet().locator('[data-slot="sheet-description"]'),
      "Basic names the card by its title: the common ID is Expert's",
    ).toHaveCount(0);
    await expect(sheet().getByText("qa-image", { exact: true }), "no ID in Basic's header").toHaveCount(0);
    await expect(sheet().getByRole("heading", { name: "QA Image", exact: true })).toHaveCount(1);
    await expect(sheet().getByRole("textbox", { name: "Display name *", exact: true })).toHaveCount(0);
    await expect(sheet().getByRole("navigation", { name: "Steps" })).toHaveCount(0);
    await expect(button("Save model")).toHaveCount(0);
    await expect(button("Delete"), "Delete is not an always-visible button").toHaveCount(0);
    await sheet().getByRole("tab", { name: "Access", exact: true }).click();
    await expect(
      sheet().getByRole("tabpanel").getByText("qa-image"),
      "#100: Basic names the access by its provider alone, the native ID is not before the fold",
    ).toHaveCount(0);
    await expect(sheet().getByRole("checkbox"), "Looking never risks changing: no editable control").toHaveCount(0);
    await expect(
      sheet().getByText("Native model ID", { exact: true }),
      "Each access is described once, on its own card",
    ).toHaveCount(0);
    await expect(sheet().getByText("Provider access", { exact: true })).toHaveCount(1);
    await sheet().getByRole("tab", { name: "Overview", exact: true }).click();
    // Delete lives in the "..." menu; Escape closes the menu, not the sheet.
    await button("More actions").click();
    await expect(page.getByRole("menuitem", { name: "Delete", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menuitem")).toHaveCount(0);
    await expect(sheet()).toBeVisible();
    // The focus is back on "...", so a second Escape closes the sheet.
    await expect(button("More actions")).toBeFocused();
    await page.keyboard.press("Escape");
    await sheet().waitFor({ state: "hidden" });
    await button("Open QA Image details").click();
    // Edit enters the editor on Model details; the steps keep the creation order.
    await button("Edit").click();
    await expect(cardSteps()).toHaveText(["1. Accesses", "2. Model details", "3. Review"]);
    await expect(sheet().getByRole("button", { name: "2. Model details", exact: true })).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(sheet().getByRole("textbox", { name: "Display name *", exact: true })).toBeVisible();
    await expect(button("Delete")).toHaveCount(0);
    // The Accesses step and Review do not repeat the title or the common ID under the sheet header.
    await sheet().getByRole("button", { name: "1. Accesses", exact: true }).click();
    await expect(sheet().getByText("QA Image", { exact: true })).toHaveCount(1);
    await expect(sheet().getByText(/^Common model ID/), "Basic shows no common ID, in the header or here").toHaveCount(
      0,
    );
    await sheet().getByRole("button", { name: "2. Model details", exact: true }).click();
    // Nothing changed: Save is off and says why.
    await button("Review").click();
    await expect(sheet().getByText("QA Image", { exact: true })).toHaveCount(1);
    await expect(button("Save model")).toBeDisabled();
    await expect(sheet().getByText("No changes", { exact: true })).toBeVisible();
    await sheet().getByRole("button", { name: "2. Model details", exact: true }).click();
    await page.getByRole("textbox", { name: "Display name *", exact: true }).fill("QA Image renamed");
    await button("Review").click();
    await expect(button("Save model")).toBeEnabled();
    await expect(sheet().getByText("No changes", { exact: true })).toHaveCount(0);
    // Cancel asks before dropping the change, then returns to the read view.
    await button("Cancel").click();
    await button("Discard draft").click();
    await expect(button("Edit")).toBeVisible();
    await expect(sheet().locator('[data-slot="sheet-title"]')).toHaveText("QA Image");
    await button("Edit").click();
    await button("Cancel").click();
    await expect(button("Edit"), "Cancel without a change needs no confirmation").toBeVisible();
    await expect(page.getByRole("heading", { name: "Discard changes?" })).toHaveCount(0);
    // Delete asks first; keeping leaves the card, deleting writes the workspace without it.
    await button("More actions").click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await page.getByRole("heading", { name: "Delete QA Image?" }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(sheet().locator('[data-slot="sheet-title"]')).toHaveText("QA Image");
    await button("More actions").click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const removal = page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/workspace"));
    await page.getByRole("dialog").getByRole("button", { name: "Delete", exact: true }).click();
    expect((await removal).postDataJSON().data.models.map((m: { id: string }) => m.id)).not.toContain("qa-image");
    await sheet().waitFor({ state: "hidden" });
    await searchModels().fill("");
    await expect(scope(/^In Registry/)).toHaveAccessibleName("In Registry (12)");
  });

  await test.step("Expert mode: the read view first, then every step at once in the same order", async () => {
    const expert = page.getByRole("switch", { name: "Expert mode", exact: true });
    // The accessible name contains the visible label (WCAG 2.5.3): "Expert" is on screen, "Expert mode" is announced.
    const visibleLabel = (await page.locator("label").filter({ has: expert }).innerText()).trim();
    expect(visibleLabel).toBe("Expert");
    expect(await expert.getAttribute("aria-label")).toContain(visibleLabel);
    // Targets are at least 24 × 24 CSS px (WCAG 2.5.8): the Expert switch and the "?" button.
    for (const target of [expert, button("Help for My models")]) {
      const box = (await target.boundingBox())!;
      expect(Math.min(box.width, box.height), JSON.stringify(box)).toBeGreaterThanOrEqual(24);
    }
    await expert.click();
    await button("Open QA Chat details").click();
    await expect(
      sheet().getByRole("navigation", { name: "Steps" }),
      "The read view has no steps, Expert or not",
    ).toHaveCount(0);
    await expect(sheet().locator("#editor-journey-summary")).toHaveCount(0);
    await button("Edit").click();
    await expect(
      sheet()
        .locator('[id^="editor-journey-step-"]')
        .evaluateAll(parts => parts.map(part => part.id)),
    ).resolves.toEqual(["editor-journey-step-0", "editor-journey-step-1", "editor-journey-step-2"]);
    await expect(sheet().locator("#editor-journey-step-0")).toContainText("In this card");
    await expect(sheet().locator("#editor-journey-step-0"), "#100: Expert still shows the native ID").toContainText(
      "qa-chat",
    );
    await expect(sheet().locator("#editor-journey-step-2")).toContainText("Review before saving");
    // Expert opens the technical fold of Review; the edit flow says what saving changes, in plain words.
    await expect(sheet().locator("#editor-journey-step-2").locator("details")).toHaveAttribute("open");
    // #101: with nothing changed the sentence says so, instead of "You’re saving changes" above "No changes".
    await expect(sheet().locator("#editor-journey-step-2")).toContainText("No changes to save for QA Chat yet.");
    await expect(sheet().locator("#editor-journey-step-2")).not.toContainText("You’re saving changes");
    await expect(sheet().locator("#editor-journey-summary")).toBeVisible();
    await expect(sheet().getByRole("textbox", { name: "Display name *", exact: true })).toBeVisible();
    // #101: Review sits far below the top of the one scroll, so the footer button has to bring it into view.
    const reviewHeading = sheet().getByRole("heading", { name: "Review before saving", exact: true });
    await expect(reviewHeading, "the review starts below the first screen").not.toBeInViewport();
    await button("Review").click();
    await expect(reviewHeading, "the footer Review button scrolls to the review").toBeInViewport();
    await expect(reviewHeading, "and moves focus to its heading").toBeFocused();
    await expect(button("Save model")).toBeDisabled();
    await expect(sheet().getByText("No changes", { exact: true })).toBeVisible();
    await button("Cancel").click();
    await expect(button("Edit")).toBeVisible();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    await expert.click();
  });

  await test.step("a decisions-only model is identified and preselects decisions; aggregator IDs drop the vendor", async () => {
    await scope(/^To add/).click();
    // Models.dev has no typesafe provider record, yet the access links to the reference typesafe/qa-jev.
    await searchModels().fill("qa-jev");
    const jev = page.locator('[data-slot="card"]').filter({ has: button("Open QA Jev details") });
    await expect(
      jev.getByRole("img", { name: "Typesafe", exact: true }).first(),
      "the creator comes from the reference namespace",
    ).toHaveText("TY");
    await button("Open QA Jev details").click();
    const inCard = sheet()
      .getByRole("heading", { name: /^In this card/ })
      .locator("..");
    await expect(inCard).toContainText("Requests: Decisions · Change");
    await inCard.getByRole("button", { name: /^Change requests for / }).click();
    await expect(inCard.getByRole("checkbox", { name: /^Decisions/ })).toBeChecked();
    await expect(inCard.getByRole("checkbox", { name: /^Chat Completions/ })).not.toBeChecked();
    await button("Cancel").click();
    await sheet().waitFor({ state: "hidden" });
    // The aggregator's deepseek/qa-reasoner proposes the model's own name, like the direct providers' IDs.
    await searchModels().fill("qa-reasoner");
    await button("Open QA Reasoner details").click();
    await expect(
      sheet().locator("summary", { hasText: "Common model ID" }),
      "Basic does not offer the common ID fold: it has the Call name field instead",
    ).toHaveCount(0);
    await expect(sheet().getByRole("textbox", { name: "Call name", exact: true })).toHaveValue("qa-reasoner");
    await button("Cancel").click();
    await sheet().waitFor({ state: "hidden" });
    await setExpert(true);
    await button("Open QA Reasoner details").click();
    const commonId = sheet().locator("summary", { hasText: "Common model ID" });
    await expect(commonId, "Expert changes the common ID here").toContainText("qa-reasoner");
    await expect(commonId).not.toContainText("deepseek");
    await expect(
      sheet().getByRole("textbox", { name: "Call name", exact: true }),
      "Expert has no Call name",
    ).toHaveCount(0);
    await button("Cancel").click();
    await sheet().waitFor({ state: "hidden" });
    await setExpert(false);
    await searchModels().fill("");
    await scope(/^In Registry/).click();
  });

  await test.step("saved card keeps its own accesses; matching ones are offered, never merged", async () => {
    // Claude/qa-opus is saved; openrouter's anthropic/qa-opus shares its reference and is not.
    const before = (await api("workspace")).data.models;
    const openOpus = page.getByRole("button", { name: /^Open qa[- ]opus details$/i });
    const card = page.locator('[data-slot="card"]').filter({ has: openOpus });
    const part = (scope: Locator, heading: RegExp) => scope.getByRole("heading", { name: heading }).locator("..");
    await expect(card.getByLabel("Access providers").getByLabel(/openrouter/i)).toHaveCount(0);
    await card.getByRole("button", { name: /^Accesses/ }).click();
    const popover = page.locator('[data-slot="popover-content"]');
    await expect(part(popover, /^In this card/)).toContainText("Claude");
    await expect(part(popover, /^In this card/)).not.toContainText(/openrouter/i);
    await expect(part(popover, /^Available, not in this card/)).toContainText(/openrouter/i);
    await expect(part(popover, /^Available, not in this card/), "QA Opus Fast holds its own access").not.toContainText(
      "qa-opus-fast",
    );
    await expect(part(popover, /^Available, not in this card/)).toContainText(
      /Input price \$4\/M.*Output price \$20\/M/,
    );
    // openrouter's anthropic/qa-opus-pro shares the reference but is a variant, not the same model.
    await expect(
      part(popover, /^Available, not in this card/),
      "A variant sharing the reference is not offered",
    ).not.toContainText("qa-opus-pro");
    await expect(popover, "Facts are readable, not raw parameter JSON").not.toContainText('{"');
    await page.keyboard.press("Escape");
    await button("View options").click(); // Basic keeps the view choice in View options
    await page.getByRole("radio", { name: "Table", exact: true }).click();
    await page.keyboard.press("Escape");
    const row = page.getByRole("row").filter({ has: page.getByRole("button", { name: /^Open qa[- ]opus details$/i }) });
    await expect(row.locator("[data-attention]"), "the table says +1 available once, as a badge").toHaveText([
      "+1 available",
    ]);
    await expect(row).not.toContainText("not in this card");
    await expect(row.getByText(/openrouter/i)).toHaveCount(0);
    await button("View options").click(); // Basic keeps the view choice in View options
    await page.getByRole("radio", { name: "Grid", exact: true }).click();
    await page.keyboard.press("Escape");

    // Re-saving after a rename writes exactly the saved accesses.
    await openOpus.click();
    await button("Edit").click();
    await page.getByRole("textbox", { name: "Display name *", exact: true }).fill("QA Opus saved");
    await button("Review").click();
    await sheet()
      .getByText(/Display name: .* → QA Opus saved/)
      .waitFor();
    await expect(sheet().getByText(/^Access (added|removed)/)).toHaveCount(0);
    const write = page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/workspace"));
    await button("Save model").click();
    const payload = (await write).postDataJSON();
    await sheet().waitFor({ state: "hidden" });
    const accessIds = (models: { id: string; accesses: { id: string; nativeModel: string }[] }[]) =>
      models.map(m => [m.id, m.accesses.map(a => `${a.id}=${a.nativeModel}`)]);
    expect(accessIds(payload.data.models), "The write contains no access the user did not choose").toEqual(
      accessIds(before),
    );
    expect(payload.data.models.find((m: { id: string }) => m.id === "qa-opus").name).toBe("QA Opus saved");

    // The card sheet offers the matching access; adding and removing are explicit and reviewed.
    await page.getByRole("button", { name: "Open QA Opus saved details", exact: true }).click();
    await sheet().getByRole("tab", { name: "Access", exact: true }).click();
    await expect(part(sheet(), /^Also available/)).toContainText(/openrouter/i);
    await button("Edit accesses").click();
    await expect(part(sheet(), /^In this card/)).toContainText("Claude");
    await expect(
      part(sheet(), /^In this card/),
      "#100: one access per provider, no native ID in Basic",
    ).not.toContainText("qa-opus");
    await expect(part(sheet(), /^In this card/)).not.toContainText(/openrouter/i);
    await expect(part(sheet(), /^Also available/)).toContainText(/Input price \$4\/M.*Output price \$20\/M/);
    await expect(part(sheet(), /^Also available/), "An access saved in another card is not offered").not.toContainText(
      "qa-opus-fast",
    );
    await expect(
      part(sheet(), /^Also available/),
      'A "-pro" variant sharing the reference is not the same model',
    ).not.toContainText("qa-opus-pro");
    await expect(sheet().getByRole("button", { name: /^Add openrouter/i })).toHaveCount(1);
    await sheet()
      .getByRole("button", { name: /^Remove Claude/ })
      .click();
    await expect(part(sheet(), /^Also available/), "A removed saved access can be added back").toContainText("Claude");
    await sheet()
      .getByRole("button", { name: /^Add openrouter/i })
      .click();
    await expect(part(sheet(), /^Also available/)).not.toContainText(/openrouter/i);
    // Preselected from the native chat mode declared by Bifrost: a chat model answers both text request types.
    await expect(part(sheet(), /^In this card/)).toContainText(/Requests: Chat Completions, Responses · Change/i);
    await expect(part(sheet(), /^In this card/), "#100: still one access per provider after the add").not.toContainText(
      "qa-opus",
    );
    await button("Review").click();
    // #100: Basic words an added or removed access by its provider alone; the native ID waits in the fold.
    await sheet()
      .getByText(/^Access added: openrouter$/i)
      .waitFor();
    await sheet()
      .getByText(/^Access removed: Claude$/)
      .waitFor();
    await button("Cancel").click();
    await button("Discard draft").click();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    // Taking an access off and adding it back returns it last: the card is as saved, so Review and Save agree.
    await page.getByRole("button", { name: "Open QA Shared details", exact: true }).click();
    await sheet().getByRole("tab", { name: "Access", exact: true }).click();
    await button("Edit accesses").click();
    await sheet()
      .getByRole("button", { name: /^Remove Claude/ })
      .click();
    await sheet()
      .getByRole("button", { name: /^Add Claude/i })
      .click();
    await button("Review").click();
    await expect(sheet().getByText("No changes to the Registry model card.")).toBeVisible();
    await expect(button("Save model")).toBeDisabled();
    await button("Cancel").click();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
  });

  await test.step("the edit Review words changes plainly; request types and IDs wait in the technical fold", async () => {
    // #100, edit flow. Basic reads "Requests changed for Claude" and "Access added: OpenRouter"; the exact
    // request types and native IDs sit in the "Technical details" fold, which Expert opens.
    for (const expertOn of [false, true]) {
      await setExpert(expertOn);
      await page.getByRole("button", { name: "Open QA Opus saved details", exact: true }).click();
      if (!expertOn) {
        // Basic: ~5 facts and no technical term on any tab, read or edited; the technical facts are Expert's below.
        await sweepCardTabs("QA Opus saved, reading");
        await sheet().getByRole("tab", { name: "Properties", exact: true }).click();
        await expect(
          sheet().getByText("Inherited from model"),
          "provenance is said once, not on every value",
        ).toHaveCount(0);
        await expect(
          sheet().getByRole("columnheader"),
          "Basic lists the card's own values, no column per provider",
        ).toHaveCount(0);
        await expect(sheet().getByText("Values come from Models.dev unless you corrected them.")).toHaveCount(1);
        await expect(sheet().getByText("Context length", { exact: true })).toBeVisible();
        await sheet().getByRole("tab", { name: "Sources", exact: true }).click();
        await expect(sheet().getByText("Reference", { exact: true }).first(), "Basic says reference").toBeVisible();
        await sheet().getByRole("tab", { name: "Overview", exact: true }).click();
        await button("Edit").click();
        await sweepCardTabs("QA Opus saved, editing", true);
        await button("Cancel").click();
      } else {
        // Expert keeps every technical fact and every edit button.
        await sheet().getByRole("tab", { name: "Properties", exact: true }).click();
        await expect(sheet().getByRole("columnheader", { name: "Claude" })).toHaveCount(1);
        await expect(
          sheet()
            .getByText(/^Inherited from model/)
            .locator("visible=true")
            .first(),
        ).toBeVisible();
        await sheet().getByRole("tab", { name: "Sources", exact: true }).click();
        await expect(sheet().getByText("Documentary record", { exact: true }).first()).toBeVisible();
        await expect(sheet().getByText("Document ID", { exact: true }).first()).toBeVisible();
      }
      // #100: the Access and Sources tabs name the access by its provider in Basic; Expert shows the native ID.
      for (const tab of ["Sources", "Access"]) {
        await sheet().getByRole("tab", { name: tab, exact: true }).click();
        await expect(
          sheet().getByRole("tabpanel").getByText("qa-opus", { exact: true }),
          `${tab} tab, ${expertOn ? "Expert" : "Basic"}`,
        ).toHaveCount(expertOn ? 1 : 0);
      }
      if (expertOn) await sheet().getByRole("tab", { name: "Overview", exact: true }).click();
      await button(expertOn ? "Edit" : "Edit accesses").click();
      const inCard = sheet()
        .getByRole("heading", { name: /^In this card/ })
        .locator("..");
      if (!expertOn) await inCard.getByRole("button", { name: "Change requests for Claude", exact: true }).click();
      await inCard.getByRole("checkbox", { name: /^Responses/ }).uncheck();
      await sheet()
        .getByRole("button", { name: /^Add openrouter/i })
        .click();
      if (expertOn) {
        await expect(inCard.getByText("qa-opus", { exact: true }), "Expert: Claude's native ID").toHaveCount(1);
        await expect(inCard.getByText("anthropic/qa-opus", { exact: true }), "Expert: OpenRouter's").toHaveCount(1);
      } else await expect(inCard, "Basic: one access per provider, no native ID").not.toContainText("qa-opus");
      await button("Review").click();
      const review = sheet().locator("#editor-journey-step-2");
      const changes = review.getByRole("heading", { name: "Proposed changes" }).locator("..");
      const technical = review.locator("details").filter({ has: page.getByText("Technical details", { exact: true }) });
      await expect(changes).toContainText("Access added: OpenRouter");
      await expect(changes).toContainText("Requests changed for Claude");
      if (!expertOn) await expectNoBasicJargon(page, "the edit Review, fold closed");
      for (const jargon of ["works with", "Chat", "Responses", "chat/completions", "qa-opus", "Registry ID"])
        await expect(
          changes,
          `${jargon} is not in Proposed changes (${expertOn ? "Expert" : "Basic"})`,
        ).not.toContainText(jargon);
      if (expertOn) await expect(technical).toHaveAttribute("open");
      else {
        await expect(technical).not.toHaveAttribute("open");
        await technical.getByText("Technical details", { exact: true }).click();
      }
      await expect(technical.getByText("Technical changes", { exact: true })).toBeVisible();
      await expect(technical).toContainText("Access added: OpenRouter · anthropic/qa-opus");
      await expect(technical).toContainText(
        "Endpoints for Claude · qa-opus: chat/completions, responses → chat/completions",
      );
      await button("Cancel").click();
      await button("Discard draft").click();
      await closeSheet();
      await sheet().waitFor({ state: "hidden" });
    }
    await setExpert(false);
  });

  await test.step("Basic corrects a numeric value in Edit details and an access's settings in Edit accesses", async () => {
    // Expert is hidden under 1280 px, so Basic keeps every correction: the card's values in the one "Edit details"
    // dialog, an access's own in its settings, in plain words and without a button per value.
    const writes = () => page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/workspace"));
    const editDetails = async () => {
      await page.getByRole("button", { name: "Open QA Opus saved details", exact: true }).click();
      await button("Edit").click();
      await sheet().getByRole("button", { name: "Edit details", exact: true }).click();
      return page.getByRole("dialog", { name: "Edit details" });
    };
    const correct = async (value: string) => {
      const dialog = await editDetails();
      const context = dialog.getByRole("spinbutton", { name: /^Context length/ });
      await context.fill(value);
      await dialog.getByRole("button", { name: "Keep changes", exact: true }).click();
      await button("Review").click();
      const write = writes();
      await button("Save model").click();
      return (await write).postDataJSON();
    };
    let dialog = await editDetails();
    const context = dialog.getByRole("spinbutton", { name: /^Context length/ });
    await expect(context, "the shown value is the card's").toHaveValue("131072");
    // Expert's safeguards, in plain words: nothing to revert or preview before a value is changed.
    const preview = dialog.getByRole("heading", { name: "Correction preview", exact: true });
    const revert = dialog.getByRole("button", { name: "Revert to inherited · Context length", exact: true });
    await expect(preview).toHaveCount(0);
    await expect(revert).toHaveCount(0);
    for (const name of [/^Maximum output/, /^Input price/, /^Output price/])
      await expect(dialog.getByRole("spinbutton", { name }), `${name} is corrected here too`).toBeVisible();
    for (const name of [/^Tool calling(?! evidence)/, /^Structured output(?! evidence)/])
      await expect(dialog.getByRole("combobox", { name }), `${name} is corrected here too`).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Family", exact: true }), "Basic has no family").toHaveCount(0);
    await expectNoBasicJargon(page, "the Edit details dialog");
    // A value that is not a whole number is refused beside the field and keeps the dialog open.
    await context.fill("12.5");
    await expect(dialog.getByRole("alert")).toContainText("Enter a nonnegative whole number.");
    await expect(dialog.getByRole("button", { name: "Keep changes", exact: true })).toBeDisabled();
    await expect(preview, "no preview of a value that cannot be read").toHaveCount(0);
    await context.fill("131072"); // back to what is shown: nothing to keep, no error
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(preview.locator("..")).toContainText("No change");
    // Change Context length: the preview names the accesses it reaches before anything is kept.
    await context.fill("200000");
    const reach = preview.locator("..");
    await expect(reach).toContainText(/Applies to \d+ accesse?s?: /);
    await expect(reach).toContainText(/131,?072 → 200,?000/);
    await expect(reach).not.toContainText("No change");
    await expectNoBasicJargon(page, "the Correction preview");
    // Revert puts the original value back and the preview says nothing moves.
    await revert.click();
    await expect(context).toHaveValue("131072");
    await expect(revert).toHaveCount(0);
    await expect(preview.locator("..")).toContainText("No change");
    await expect(preview.locator("..")).not.toContainText("Applies to");
    await context.fill("200000");
    await dialog.getByRole("button", { name: "Keep changes", exact: true }).click();
    await expect(sheet().getByText(/Correction added to the draft/)).toBeVisible();
    // Reverting the correction kept in this draft restores the original: nothing is added, and the notice says so.
    await sheet().getByRole("button", { name: "Edit details", exact: true }).click();
    await expect(context).toHaveValue("200000");
    await revert.click();
    await expect(context).toHaveValue("131072");
    await dialog.getByRole("button", { name: "Keep changes", exact: true }).click();
    await expect(sheet().getByText("No change: back to the original value.", { exact: true })).toBeVisible();
    await expect(sheet().getByText(/Correction added to the draft/)).toHaveCount(0);
    await sheet().getByRole("button", { name: "Edit details", exact: true }).click();
    await context.fill("200000");
    await dialog.getByRole("button", { name: "Keep changes", exact: true }).click();
    await expect(sheet().getByText(/Correction added to the draft/)).toBeVisible();
    await button("Review").click();
    const review = sheet().locator("#editor-journey-step-2");
    await expect(review).toContainText("Catalog corrections saved with this model");
    await expect(review.getByRole("listitem").filter({ hasText: "Context length" })).toContainText(/200,?000/);
    await expectNoBasicJargon(page, "the Review of a corrected value");
    const write = writes();
    await button("Save model").click();
    expect((await write).postDataJSON().catalogOverrides).toEqual([
      expect.objectContaining({ target: "reference", id: "anthropic/qa-opus", field: "context_length", value: 200000 }),
    ]);
    await sheet().waitFor({ state: "hidden" });
    // The corrected value is read back as corrected, in Properties: one word for it.
    await page.getByRole("button", { name: "Open QA Opus saved details", exact: true }).click();
    await sheet().getByRole("tab", { name: "Properties", exact: true }).click();
    await expect(sheet().getByText("corrected", { exact: true })).toHaveCount(1);
    await expect(sheet().getByText(/customi[sz]ed/i)).toHaveCount(0);
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    // Put the fixture back for the steps that follow.
    expect((await correct("131072")).catalogOverrides).toEqual([
      expect.objectContaining({ target: "reference", field: "context_length", value: 131072 }),
    ]);
    await sheet().waitFor({ state: "hidden" });

    // An access's settings: reached from "Edit accesses", with its own values, without its IDs or route.
    await page.getByRole("button", { name: "Open QA Opus saved details", exact: true }).click();
    await sheet().getByRole("tab", { name: "Access", exact: true }).click();
    await button("Edit accesses").click();
    await sheet().getByRole("button", { name: "Access settings for Claude", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Edit provider access" });
    await expect(dialog.getByRole("combobox", { name: "Reference for this access", exact: true })).toBeVisible();
    await expect(dialog.getByText("Values for this access", { exact: true })).toBeVisible();
    for (const name of ["Model at this provider *", "Registry exposed ID"])
      await expect(
        dialog.getByRole("textbox", { name, exact: true }),
        `${name} is Expert's for a found access`,
      ).toHaveCount(0);
    await expectNoBasicJargon(page, "an access's settings");
    await dialog.getByRole("spinbutton", { name: /^Context length/ }).fill("65536");
    await expect(dialog.getByRole("heading", { name: "Correction preview", exact: true }).locator("..")).toContainText(
      /Applies to 1 access: Claude/,
    );
    await expect(
      dialog.getByRole("button", { name: "Revert to inherited · Context length", exact: true }),
    ).toBeVisible();
    await expectNoBasicJargon(page, "an access's Correction preview");
    await dialog.getByRole("button", { name: "Keep changes", exact: true }).click();
    await button("Review").click();
    await expect(
      sheet().locator("#editor-journey-step-2").getByRole("listitem").filter({ hasText: "provider access" }),
      "the access's own correction is listed apart from the card's",
    ).toContainText(/Context length/);
    await button("Cancel").click();
    await button("Discard draft").click();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
  });

  await test.step("Basic keeps the native IDs of a provider the card holds twice, and only those", async () => {
    // #100. The fixture saves no card with two accesses of one provider, so a mocked workspace gives QA Shared
    // (Claude and Codex, one each) a second Claude access. Claude's two rows need their native IDs to be told
    // apart; Codex's single row stays a provider name.
    const live = await api("workspace");
    const catalog = await api("catalog");
    const twin = { ...live.data.models.find((m: { id: string }) => m.id === "qa-shared").accesses[0] };
    expect(twin.provider).toBe("Claude");
    twin.id = "Claude/qa-shared-fast";
    twin.nativeModel = "qa-shared-fast";
    const twice = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    await skipTour(twice);
    twice.on("pageerror", e => errors.push(e.message));
    await twice.route("**/api/workspace", r =>
      r.fulfill({
        json: {
          ...live,
          data: {
            ...live.data,
            models: live.data.models.map((m: { id: string; accesses: unknown[] }) =>
              m.id === "qa-shared" ? { ...m, accesses: [...m.accesses, twin] } : m,
            ),
          },
        },
      }),
    );
    await twice.route("**/api/catalog", r => r.fulfill({ json: catalog }));
    await twice.goto("/");
    await twice.getByRole("button", { name: "Open QA Shared details", exact: true }).first().click();
    const twiceSheet = twice.locator('[data-slot="sheet-content"]');
    await twiceSheet.getByRole("tab", { name: "Access", exact: true }).click();
    const accessCards = twiceSheet
      .getByRole("tabpanel")
      .locator("div.rounded-sm.border")
      .filter({ has: twice.getByText("Provider access", { exact: true }) });
    await expect(accessCards).toHaveCount(3);
    const claudeCards = accessCards.filter({ hasText: "Claude" });
    await expect(claudeCards).toHaveCount(2);
    await expect(
      claudeCards.getByText("qa-shared", { exact: true }),
      "Claude's first row keeps its native ID",
    ).toHaveCount(1);
    await expect(claudeCards.getByText("qa-shared-fast", { exact: true }), "and so does its twin").toHaveCount(1);
    await expect(accessCards.filter({ hasText: "Codex" }), "Codex is held once: the provider alone").not.toContainText(
      "qa-shared",
    );
    await twiceSheet.getByRole("button", { name: "Edit accesses", exact: true }).click();
    // Two accesses of one provider get two accessible names: the native model tells them apart, as on screen.
    for (const [prefix, names] of [
      ["Access settings for", ["Claude · qa-shared", "Claude · qa-shared-fast", "Codex"]],
      ["Change requests for", ["Claude · qa-shared", "Claude · qa-shared-fast", "Codex"]],
    ] as const) {
      const labels = await twiceSheet
        .getByRole("button", { name: new RegExp(`^${prefix}`) })
        .evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label")));
      expect(labels.sort(), `${prefix}: one name per access`).toEqual(names.map(name => `${prefix} ${name}`).sort());
    }
    const inCard = twiceSheet.getByRole("heading", { name: /^In this card/ }).locator("..");
    await expect(inCard.getByText("qa-shared", { exact: true })).toHaveCount(1);
    await expect(inCard.getByText("qa-shared-fast", { exact: true })).toHaveCount(1);
    await expect(inCard.locator("p").filter({ has: twice.locator("strong", { hasText: "Codex" }) })).not.toContainText(
      "qa-shared",
    );
    await twice.close();
  });

  await test.step("custom provider derives exposed ID and validation stays beside Save", async () => {
    // "Add model > Advanced: custom model" is now "Register a model > Advanced: enter an access
    // manually"; the access form keeps its Save action (Keep changes) disabled beside the error.
    await button("Register a model").click();
    await button("Advanced: enter an access manually").click();
    await page.getByRole("combobox", { name: "Search a model or enter its ID *", exact: true }).fill("qa-custom");
    await button("Enter access manually").click();
    const dialog = page.getByRole("dialog", { name: "Edit provider access" });
    await dialog.getByRole("combobox", { name: "Provider in Bifrost *", exact: true }).fill("synthetic-provider");
    await dialog.getByRole("textbox", { name: "Model at this provider *", exact: true }).fill("qa-custom");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("textbox", { name: "Registry exposed ID", exact: true })).toHaveValue(
      "synthetic-provider/qa-custom",
    );
    await expect(dialog.getByRole("textbox", { name: "Registry exposed ID", exact: true })).toHaveAttribute(
      "readonly",
      "",
    );
    await expect(button("Keep changes")).toBeDisabled();
    await dialog.getByRole("alert").waitFor();
    await withinViewport(dialog.getByRole("alert"));
    await shot("after-editor-validation");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await button("Cancel").click();
    await button("Discard draft").click();
    await sheet().waitFor({ state: "hidden" });
    await scope(/^In Registry/).click();
  });

  await test.step("group filter retains hidden selections and cancel protects draft", async () => {
    // Creating a group is now a three-step sheet: Details, Models, Review.
    await nav("Groups").click();
    await button("Create group").click();
    // Critique round 5: the sheet says "publishing", as its last button does, and "Required" is a neutral hint, not
    // an error, until the name is left empty.
    await expect(sheet()).toContainText("Review the key impact before publishing.");
    const groupName = page.getByRole("textbox", { name: "Group name *", exact: true });
    await expect(groupName).not.toHaveAttribute("aria-invalid", "true");
    await expect(sheet().getByText("Required", { exact: true })).not.toHaveClass(/destructive/);
    await page.getByRole("textbox", { name: "Description", exact: true }).click(); // leaves the empty name
    await expect(groupName).toHaveAttribute("aria-invalid", "true");
    await expect(sheet().getByText("Enter a group name.", { exact: true })).toBeVisible();
    await groupName.fill("QA Browser Group");
    await expect(groupName).not.toHaveAttribute("aria-invalid", "true");
    await button("Continue").click();
    await page.getByRole("checkbox", { name: "Select QA Code", exact: true }).check();
    // qa-haiku was saved with its common ID as name: the list reads its reference name, the ID below.
    await expect(
      page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByRole("checkbox", { name: "Select QA Haiku", exact: true }) }),
    ).toContainText("qa-haiku");
    await page.getByRole("textbox", { name: "Search models", exact: true }).fill("vision");
    await page.getByRole("checkbox", { name: "Select QA Vision", exact: true }).check();
    await page.getByText(/2 total selected/).waitFor();
    await button("Cancel").click();
    await button("Keep editing").click();
    await button("Previous").click();
    await expect(page.getByRole("textbox", { name: "Group name *", exact: true })).toHaveValue("QA Browser Group");
    await button("Continue").click();
    await button("Continue").click();
    await button("Publish group").click();
    await sheet().waitFor({ state: "hidden" });
    const group = (await api("workspace")).data.groups.find((g: { name: string }) => g.name === "QA Browser Group");
    expect(group.members.sort()).toEqual(["qa-code", "qa-vision"]);
  });

  await test.step("key origin and exclusion publish with independent readback", async () => {
    // The composer is three steps (Models, Groups, Review); publication lives in Review. The
    // origin is shown in the access menu, the exclusion as a card checkbox.
    await nav("Virtual keys").click();
    await expect(keyCard("QA Development Key")).toContainText("2 models ·");
    await openDevelopmentKey();
    // #69: the key page names the key once and offers one way back.
    expect((await page.locator("body").innerText()).split("QA Development Key").length - 1).toBe(1);
    await expect(page.getByRole("button", { name: /^(All virtual keys|Virtual keys|Back)$/ })).toHaveCount(1);
    // Spec #85: a managed key opens read-first on what it can call today, grouped by subscription; the
    // 59-card editor waits behind Edit selection, and the rare actions wait in More actions.
    // Round 2 and #99: one ledger, "This key can call N models", one row per model with the subscriptions that serve
    // it; what Bifrost allows (story 36) and the IDs it lists wait in one "Technical check" fold.
    // Critique round 5: Bifrost was not asked yet, so the headline is provisional and the first check sits beside it.
    const ledger = page.getByRole("region", { name: "This key can call 2 models · not checked yet", exact: true });
    await expect(ledger.getByRole("listitem")).toHaveCount(2);
    await expect(ledger).toContainText("via Synthetic Provider");
    await expect(ledger.getByText(/^Bifrost allows today · /)).toBeHidden();
    await expect(
      ledger.getByRole("button", { name: "Check with Bifrost", exact: true }),
      "the first check is visible with the technical fold closed",
    ).toBeVisible();
    await ledger.getByText(/^Technical check · /).click();
    await expect(ledger.getByText(/^Bifrost allows today · /)).toBeVisible();
    // One check button, named for the first check: not duplicated in the fold, never "Read again".
    await expect(ledger.getByRole("button", { name: /^Check/ })).toHaveText(["Check with Bifrost"]);
    await expect(ledger.getByRole("button", { name: "Read again", exact: true })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Key composition steps" })).toHaveCount(0);
    await button("More actions").click();
    await expect(page.getByRole("menuitem")).toHaveText(["Rename", "Disable", "Re-link the Bifrost key"]);
    await page.keyboard.press("Escape");
    await editSelection();
    // Basic (critique round 2): the folded Models toolbar, grouped by subscription, one sticky selection line.
    for (const name of ["View", "Card shape", "Grid density"])
      await expect(page.getByRole("group", { name, exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "More filters", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: /^Synthetic Provider \d+$/ })).toBeVisible();
    await expect(page.getByText(/models shown|provider accesses selected|visible selected/)).toHaveCount(0);
    await expect(page.getByText("2 models selected · 1 group", { exact: true })).toBeVisible();
    await button("Filters").click();
    await expect(page.getByRole("combobox", { name: "Serving provider", exact: true })).toBeVisible();
    await expect(page.getByText(/^Select all \d+ visible models$/)).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("checkbox", { name: "Show selected only (2)", exact: true }).check();
    await expect(page.getByRole("checkbox", { name: /^Add to this key: / })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Exclude from this key: QA Code", exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: "Show selected only (2)", exact: true }).uncheck();
    await button("Accesses · 1 · QA Code").click();
    await page.getByText("Inherited · QA Development", { exact: true }).waitFor();
    await page.keyboard.press("Escape");
    await composerStep("Review").click();
    await expect(button("Publish changes")).toBeDisabled();
    await expect(
      page.getByText("Unpublished draft", { exact: true }),
      "No draft changes despite absent readback",
    ).toHaveCount(0);
    await expect(keyChanges()).toContainText("No change.");
    await composerStep("Models").click();
    await page.getByRole("checkbox", { name: "Exclude from this key: QA Code", exact: true }).click();
    await composerStep("Review").click();
    await page.getByRole("heading", { name: "Local exclusions" }).waitFor();
    // #69: Review diffs the draft against a labelled baseline; nothing is read back yet.
    await expect(keyChanges().getByText("Compared with the last published plan", { exact: true })).toBeVisible();
    await expect(keyChanges().getByRole("list", { name: "Will lose" })).toContainText("synthetic-provider/qa-code");
    await expect(keyChanges().getByRole("list", { name: "Will gain" })).toHaveCount(0);
    await button("Publish changes").click();
    await page.getByText("Verified", { exact: true }).waitFor();
    const keys = (await api("workspace")).data.keys;
    const key = (id: string) => keys.find((k: { id: string }) => k.id === id);
    expect(key("vk-qa-dev").policy.excluded).toEqual(["qa-code"]);
    expect(key("vk-qa-dev").publication.actual).toEqual(["synthetic-provider/qa-chat"]);
    expect(key("vk-qa-visual").policy.groups).toEqual(["qa-visual"]);
    await shot("after-key-published");
  });

  await test.step("key draft navigation guard", async () => {
    await button("Restore QA Code").click();
    await button("All virtual keys").click();
    await page.getByRole("heading", { name: "Discard key draft?" }).waitFor();
    await button("Keep editing").click();
    await keyHeading().waitFor();
    // Cancel leaves the editor for the read-first page, after the same confirmation.
    await button("Cancel").click();
    await button("Discard changes").click();
    await expect(page.getByRole("region", { name: /^This key can call/ })).toBeVisible();
    await expect(page.getByText("Unpublished draft", { exact: true })).toHaveCount(0);
  });

  await test.step("browser Back and Forward preserve navigation and draft guard", async () => {
    await button("All virtual keys").click();
    await openDevelopmentKey();
    await editSelection();
    await composerStep("Review").click();
    await button("Restore QA Code").click();
    await page.goBack();
    await button("Keep editing").click();
    await keyHeading().waitFor();
    await button("Discard draft").click();
    await button("All virtual keys").click();
    await page.goBack();
    await keyHeading().waitFor();
    await page.goForward();
    await page.getByLabel("Search keys", { exact: true }).waitFor();
    await openDevelopmentKey();
  });

  await test.step("disabled key distinguishes retained selection from usable access", async () => {
    // The banner now says the saved selection is shown for review; the "no model access" wording is gone.
    await keyAction("Disable");
    await page.getByText("This key is disabled. Its saved model selection is shown for review.").waitFor();
    const keys = (await api("workspace")).data.keys;
    expect(keys.find((k: { id: string }) => k.id === "vk-qa-dev").active).toBe(false);
    await keyAction("Enable");
    await expect(page.getByText("This key is disabled. Its saved model selection is shown for review.")).toHaveCount(0);
    await editSelection();
    await composerStep("Review").click();
    await page.getByText("Verified", { exact: true }).waitFor();
  });

  await test.step("publication failure retains key draft and recovery action", async () => {
    await button("Restore QA Code").click();
    // #69: once read back, the verified readback is the baseline.
    await expect(keyChanges().getByText("Compared with what Bifrost last confirmed", { exact: true })).toBeVisible();
    await expect(keyChanges().getByRole("list", { name: "Will gain" })).toContainText("synthetic-provider/qa-code");
    await page.route("**/api/workspace", route =>
      route.request().method() === "PUT"
        ? route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Synthetic unavailable response" }),
          })
        : route.continue(),
    );
    await button("Publish changes").click();
    await page.getByRole("alert").filter({ hasText: "Synthetic unavailable" }).first().waitFor();
    await expect(button("Publish changes")).toBeEnabled();
    await page.unroute("**/api/workspace");
    await button("Discard draft").click();
  });

  await test.step("keys show adoption readiness; the dialog explains each blocker per provider", async () => {
    // #87: ready, blocked (and by what) or empty on every unmanaged card instead of one uniform badge.
    await button("All virtual keys").click();
    const cards: [string, string, string][] = [
      ["QA Codex Key", "Ready to adopt", ""],
      ["QA Google Key", "Ready to adopt", ""],
      [
        "QA Mistral Key",
        "Blocked",
        "Mistral · disabled in Bifrost · 3 models; Codex · 1 model also allowed through Claude",
      ],
      ["QA Hermes Key", "Blocked", "Mistral · disabled in Bifrost · 2 models"],
      ["QA To Add Key", "Blocked", "Synthetic Provider · 1 model to add"],
      ["QA All Providers Key", "Blocked", "Every provider allowed"],
      ["QA Claude Key", "Blocked", "Claude · all models allowed"],
      ["QA Wildcard Key", "Blocked", "Claude · all models allowed"],
      ["QA Kept Key", "Blocked", "Google: Bifrost doesn’t show 1 model"],
      ["QA Unmanaged Key", "Empty", ""],
    ];
    await emptyShelf();
    for (const [name, verdict, reason] of cards) {
      await expect(keyCard(name), name).toContainText(verdict);
      if (reason) await expect(keyCard(name), name).toContainText(reason);
    }
    await expect(page.getByText("Adoption needed")).toHaveCount(0);
    await expect(keyCard("QA Development Key")).toContainText("Active");
    // The default order opens on managed keys, then the worklist: ready, then blocked; by name inside each.
    // Empty keys wait in their own shelf (opened above; collapsed by default).
    await expect(page.getByRole("button", { name: /^(Adopt|See what blocks it|Open) · / })).toHaveText([
      "Open · QA Development Key",
      "Open · QA Visual Key",
      "Adopt · QA Codex Key",
      "Adopt · QA Google Key",
      "See what blocks it · QA All Providers Key",
      "See what blocks it · QA Claude Key",
      "See what blocks it · QA Hermes Key",
      "See what blocks it · QA Kept Key",
      "See what blocks it · QA Mistral Key",
      "See what blocks it · QA To Add Key",
      "See what blocks it · QA Wildcard Key",
      "Open · QA Unmanaged Key",
    ]);
    await page.getByRole("button", { name: "Empty 1", exact: true }).click();
    await expect(page.getByText("12 of 12 keys shown, 1 in a collapsed shelf", { exact: true })).toBeVisible();
    await emptyShelf();
    // The Keys page triages by readiness; managed keys are their own bucket. Basic keeps the filters in "Filters".
    const readiness = page.getByRole("combobox", { name: "Filter by readiness", exact: true });
    await keyFilters();
    await readiness.click();
    await expect(page.getByRole("option")).toHaveText([
      "All adoption states",
      "Ready to adopt (2)",
      "Blocked (7)",
      "Empty (1)",
      "Managed (2)",
    ]);
    await page.getByRole("option", { name: "Blocked (7)", exact: true }).click();
    await expect(page.getByText("7 of 12 keys shown", { exact: true })).toBeVisible();
    await expect(keyCard("QA Mistral Key")).toHaveCount(1);
    await expect(keyCard("QA Codex Key")).toHaveCount(0);
    await keyFilters();
    await readiness.click();
    await page.getByRole("option", { name: "Ready to adopt (2)", exact: true }).click();
    await expect(page.getByText("2 of 12 keys shown", { exact: true })).toBeVisible();
    await expect(keyCard("QA Google Key")).toHaveCount(1);
    await keyFilters();
    await readiness.click();
    await page.getByRole("option", { name: "Empty (1)", exact: true }).click();
    await expect(keyCard("QA Unmanaged Key")).toHaveCount(1);
    await expect(page.getByText("1 of 12 keys shown", { exact: true })).toBeVisible();
    await keyFilters();
    await readiness.click();
    await page.getByRole("option", { name: "All adoption states", exact: true }).click();
    await expect(page.getByText("12 of 12 keys shown", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); // closes Filters
    await shot("after-keys-readiness");

    // Blocked by models Bifrost does not list (a disabled provider): counts per provider, names behind a
    // disclosure, and no way to "add" what nothing can add. The key page shows counts, not an ID wall.
    await keyCard("QA Mistral Key")
      .getByRole("button", { name: "See what blocks it · QA Mistral Key", exact: true })
      .click();
    const allowed = page.getByRole("list", { name: "Bifrost allows today" });
    await expect(allowed).toContainText("Mistral · 3 models");
    await expect(allowed).toContainText("Claude · 3 models");
    await expect(allowed).toContainText("Codex · 1 model");
    await expect(page.getByText("qa-mistral-large", { exact: false })).toBeHidden();
    await allowed.getByText("Mistral · 3 models", { exact: true }).click();
    await expect(allowed.getByText(/qa-mistral-large/)).toBeVisible();
    await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
    await button("Adopt this key").click();
    const dialog = page.getByRole("dialog");
    // Spec #85: the dialog opens on the decisions, one numbered row per provider, each with its choices.
    // Critique round 2: Bifrost reports Mistral disabled, so the dialog keeps it in Bifrost from the start (undoable);
    // it counts as decided, and the progress sits next to Adopt. #101: the heading counts that row too ("2 decisions
    // · 1 already made"), so it agrees with the footer ("1 of 2 decided").
    const decisions = dialog.getByRole("region", { name: "2 decisions before adopting · 1 already made", exact: true });
    await expect(
      decisions.getByRole("heading", { name: "2 decisions before adopting · 1 already made", exact: true }),
    ).toBeInViewport();
    await expect(decisions).toContainText("Each one is required to adopt the key.");
    await expect(decisions.locator("ol > li")).toHaveCount(1);
    const keptMistral = dialog.getByRole("region", { name: "Kept in Bifrost" });
    await expect(keptMistral).toContainText("Mistral is disabled in Bifrost, so Registry leaves it as is.");
    await expect(
      keptMistral.getByRole("button", { name: "Stop keeping Mistral in Bifrost", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("1 of 2 decided", { exact: true })).toBeVisible();
    await expect(dialog).not.toContainText("read back");
    await expect(dialog).not.toContainText("Needs attention");
    // Critique round 5: the intro is accurate about what changes Bifrost, and a decision names its models in its line,
    // with no "Show model names" to open.
    await expect(dialog).toContainText(
      "Adopting itself changes nothing in Bifrost; the options marked “Changes Bifrost” do.",
    );
    await expect(dialog).not.toContainText("Show model names");
    await expect(decisions).toContainText("Model: qa-shared");
    await expect(dialog.getByText("qa-shared", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^Show in To add/ })).toHaveCount(0);
    // One model allowed through Claude and Codex: either provider can stay in Bifrost.
    // #100, #101: in plain words, with the two choices labelled by outcome.
    await expect(decisions).toContainText("1 model is allowed through Codex and Claude.");
    await expect(decisions).toContainText(
      "Registry uses one subscription per model: choose the one to use, and Bifrost keeps handling the other for this key.",
    );
    // Each choice is a button with a selected state (aria-pressed); none is chosen yet.
    for (const name of ["Use Claude for this model", "Use Codex for this model"])
      await expect(dialog.getByRole("button", { name, exact: true, pressed: false })).toBeVisible();
    for (const jargon of ["native", "readback", "cannot hold"]) await expect(dialog).not.toContainText(jargon);
    // What Registry would manage waits behind a disclosure.
    await expect(dialog.getByText("Accesses Registry will manage (3)", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Claude/qa-haiku", { exact: true })).toBeHidden();
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    // Critique round 5: Cancel stays available while the preview loads (seconds on a real gateway); the dialog closes.
    let release!: () => void;
    const slow = new Promise<void>(resolve => (release = resolve));
    await page.route("**/api/keys/adopt", async route => {
      await slow;
      await route.continue().catch(() => {});
    });
    await button("Adopt this key").click();
    await expect(dialog.getByText("Loading preview… this can take a few seconds.", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeEnabled();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    release();
    await page.unroute("**/api/keys/adopt");

    // A phone (375 px): the longest dialog does not scroll sideways, and its footer buttons stack at full width.
    await button("All virtual keys").click();
    await keyCard("QA Hermes Key")
      .getByRole("button", { name: "See what blocks it · QA Hermes Key", exact: true })
      .click();
    await page.setViewportSize({ width: 375, height: 812 });
    await button("Adopt this key").click();
    // Its only decision is made from the start (Mistral is disabled, so kept in Bifrost); the dialog is the only
    // scroll container, and its footer keeps Cancel and Adopt in reach while it scrolls.
    await expect(dialog.getByText("Ready to adopt", { exact: true })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Stop keeping Mistral in Bifrost", exact: true })).toBeInViewport();
    await expect(dialog.getByText("1 of 1 decided", { exact: true })).toBeInViewport();
    // Every disclosure open (earlier notifications rest over the dialog's last lines on a phone, so not by clicks).
    await dialog.locator("details").evaluateAll(all =>
      all.forEach(details => {
        (details as HTMLDetailsElement).open = true;
      }),
    );
    expect(await dialog.evaluate(el => el.scrollHeight > el.clientHeight), "The open dialog scrolls").toBe(true);
    for (const name of ["Cancel", "Adopt"])
      await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport();
    await dialog.evaluate(el => {
      el.scrollTop = el.scrollHeight / 3;
    });
    for (const name of ["Cancel", "Adopt"])
      await expect(dialog.getByRole("button", { name, exact: true }), `${name} stays in reach`).toBeInViewport();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth), "The dialog fits 375 px").toBe(true);
    expect(
      await dialog.evaluate(
        el =>
          [...el.querySelectorAll("*")].filter(child => ["auto", "scroll"].includes(getComputedStyle(child).overflowY))
            .length,
      ),
      "No scroll area inside the dialog",
    ).toBe(0);
    const dialogBox = (await dialog.boundingBox())!;
    const [cancelBox, adoptBox] = [
      (await dialog.getByRole("button", { name: "Cancel", exact: true }).boundingBox())!,
      (await dialog.getByRole("button", { name: "Adopt", exact: true }).boundingBox())!,
    ];
    expect(cancelBox.width + adoptBox.width, "Cancel and Adopt share the footer width").toBeGreaterThan(
      dialogBox.width * 0.75,
    );
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 950 });

    // Discovered by Bifrost but without a Registry card: the dialog leads to To add, filtered on that model.
    await button("All virtual keys").click();
    await keyCard("QA To Add Key")
      .getByRole("button", { name: "See what blocks it · QA To Add Key", exact: true })
      .click();
    await button("Adopt this key").click();
    // Models to add are no decision: they are listed apart, before adopting.
    await expect(dialog.getByRole("region", { name: "Before adopting" })).toContainText(
      "Before adopting: register 1 Synthetic Provider model",
    );
    await expect(dialog).not.toContainText("decision");
    await expect(dialog).toContainText("Registry has no card for them yet");
    await expect(dialog).toContainText("Model: qa-unregistered");
    // Adopt is off until that model is registered: the footer says why and what is next, beside no decision count.
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
    await expect(dialog.getByText("Register 1 Synthetic Provider model first", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: /^Show in To add/ }).click();
    await expect(dialog).toHaveCount(0);
    await expect(scope(/^To add/)).toBeChecked();
    await expect(page.getByRole("button", { name: /^Key models: 1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Open .* details$/ })).toHaveText(["QA Unregistered"]);
    // The filter is an ordinary chip: clearing it shows the whole shelf again, by subscription.
    await page.getByRole("button", { name: "Clear all", exact: true }).click();
    await groupModels("Group by provider");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Google 1",
      "Synthetic Provider 1",
      "Typesafe 1",
      "OpenRouter 66",
    ]);
    await groupModels("No grouping");
    await scope(/^In Registry/).click();

    // A key that allows nothing says so instead of listing blockers.
    await nav("Virtual keys").click();
    await emptyShelf();
    await keyCard("QA Unmanaged Key").getByRole("button", { name: "Open · QA Unmanaged Key", exact: true }).click();
    await expect(page.getByText("Empty", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Add models to this key in Bifrost first", { exact: true }),
      "A plain sentence, not a button that leads nowhere",
    ).toBeVisible();
    await expect(button("Adopt this key")).toHaveCount(0);
    // A key whose selection cannot be made yet shows the blockers, not two empty lists.
    await button("All virtual keys").click();
    await keyCard("QA Claude Key")
      .getByRole("button", { name: "See what blocks it · QA Claude Key", exact: true })
      .click();
    await button("Adopt this key").click();
    await expect(dialog).toContainText(
      "This key allows every Claude model, including future ones, so Registry can’t copy it as is.",
    );
    await expect(dialog.getByRole("button", { name: "Keep Claude in Bifrost", exact: true })).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: /^Replace “all models” by the models saved in Registry/ }),
    ).toBeVisible();
    await expect(dialog).not.toContainText("review a key that lists its models one by one");
    await expect(dialog).not.toContainText("dynamic model list");
    await expect(dialog.getByText(/^Accesses Registry will manage/)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  });

  await test.step("unmanaged key opens on adoption; the composer follows adoption", async () => {
    // #69: each card says what Bifrost allows today. An unmanaged key starts with adoption as its
    // single primary action: nothing to compose, nothing published, until the key is adopted.
    await button("All virtual keys").click();
    await emptyShelf();
    await expect(keyCard("QA All Providers Key")).toContainText("All providers");
    await expect(keyCard("QA Claude Key")).toContainText("1 provider · all models of Claude");
    await expect(keyCard("QA Unmanaged Key")).toContainText("No provider");
    await expect(keyCard("QA Codex Key")).toContainText("1 provider · 2 models");
    await keyCard("QA Unmanaged Key").getByRole("button", { name: "Open · QA Unmanaged Key", exact: true }).click();
    await expect(page.getByText("Synthetic unmanaged client · Bifrost key · not adopted yet")).toBeVisible();
    await expect(button("Adopt this key")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Key composition steps" })).toHaveCount(0);
    await expect(button("Publish changes")).toHaveCount(0);
    await expect(page.getByText("Unpublished draft", { exact: true })).toHaveCount(0);
    await shot("after-unmanaged-key");
    await button("All virtual keys").click();
    await keyCard("QA Codex Key").getByRole("button", { name: "Adopt · QA Codex Key", exact: true }).click();
    await expect(page.getByRole("list", { name: "Bifrost allows today" })).toContainText("Codex · 2 models");
    await page
      .getByRole("list", { name: "Bifrost allows today" })
      .getByText("Codex · 2 models", { exact: true })
      .click();
    await expect(page.getByRole("list", { name: "Bifrost allows today" })).toContainText("qa-codex, qa-codex-mini");
    await button("Adopt this key").click();
    await page.getByRole("dialog").getByRole("button", { name: "Adopt", exact: true }).click();
    await editSelection();
    await composerStep("Review").click();
    await expect(keyChanges()).toContainText("No change.");
    expect((await api("workspace")).data.keys.find((k: { id: string }) => k.id === "vk-qa-codex").managed).toBe(true);
  });

  await test.step("search recovery clears filter instead of starting creation", async () => {
    // The empty result no longer has a recovery button: it is a message, and clearing the field recovers.
    await button("All virtual keys").click();
    await page.getByLabel("Search keys").fill("nothing-matches-qa");
    await page.getByText("No keys match these filters.").waitFor();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByLabel("Search keys").fill("");
    await page.getByText("QA Development Key", { exact: true }).first().waitFor();
  });

  await test.step("key creation secret has a clipboard denial fallback", async () => {
    await button("Create key").click();
    await page.getByLabel("Key name", { exact: true }).fill("QA Browser Key");
    await page.getByRole("dialog").getByRole("button", { name: "Create key", exact: true }).click();
    await page.getByLabel("Virtual key secret", { exact: true }).waitFor();
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("denied");
          },
        },
      }),
    );
    await button("Copy secret").click();
    await page.getByRole("alert").filter({ hasText: "Ctrl+C or Cmd+C" }).waitFor();
    const input = page.getByLabel("Virtual key secret", { exact: true });
    expect(
      await input.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart! === el.value.length),
    ).toBe(true);
    await button("Done").click();
    await input.waitFor({ state: "hidden" });
    await expect(input).toHaveCount(0);
    // Critique round 5: a key with no client shows no raw ID under its name in Basic.
    await expect(page.getByRole("heading", { name: "QA Browser Key", level: 1 })).toBeVisible();
    await expect(page.getByText(/vk-qa-created-/)).toHaveCount(0);
  });

  await test.step("metadata correction uses visible dialog and persists", async () => {
    // "Sources & References" is now Settings > Open catalog data.
    await nav("Settings").click();
    await button("Open catalog data").click();
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

  await test.step("one language per UI: the English UI shows no French, the French UI no English", async () => {
    // Sentinels: UI words of the other language, in visible text and accessible names. Fixture data
    // is English in both UIs ("QA Development Key", "Synthetic … client", "QA Opus saved", "Synthetic
    // Provider"), so the English sentinels avoid its words; proper names (Registry, Bifrost, Models.dev)
    // are shared.
    const sentinels = {
      en: /[àâçéèêëîïôûùœ«»]|\b(Oui|Non|Autre|[Ii]nconnue?|nouveau|Fournisseur|[Ff]iche)\b/,
      fr: /\b(Unknown|unknown|Yes|No|Other|Saved|Partial|Loading|Search|Creator|(?<!Synthetic )Provider|Reference|Model|Models(?!\.dev)|Native|Workspace|Catalog|Access|Accesses|Capabilities|Modalities|Series|Tasks|Settings|Show|View|Create|Delete|Name|Review|Cancel|Save|Open|Edit|Declared|declared|Configured|available|[Dd]etails|Input|Output|[Pp]rice|the|and|with|of)\b/,
    };
    const sweep = async (language: "en" | "fr", where: string) => {
      const text = await page.evaluate(() =>
        [
          document.body.innerText,
          ...[...document.querySelectorAll("[aria-label], [title], [placeholder]")].flatMap(el =>
            ["aria-label", "title", "placeholder"].map(name => el.getAttribute(name) || ""),
          ),
        ].join("\n"),
      );
      expect
        .soft(
          text.split("\n").filter(line => sentinels[language].test(line)),
          `${where} in ${language === "en" ? "English" : "French"}`,
        )
        .toEqual([]);
    };
    const tour = async (language: "en" | "fr") => {
      const t = (english: string, french: string) => (language === "fr" ? french : english);
      const open = (name: string) =>
        page.getByRole("button", { name: t(`Open ${name} details`, `Ouvrir la fiche ${name}`), exact: true });
      const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: open(name) });
      const popover = page.locator('[data-slot="popover-content"]');
      const accesses = async (name: string) => {
        await card(name)
          .getByRole("button", { name: new RegExp(`^${t("Accesses", "Accès")}`) })
          .click();
        await popover
          .getByText(t("Access IDs, matching and sources", "Identifiants, correspondances et sources"), { exact: true })
          .click();
      };
      await nav(t("My models", "Mes modèles")).click();
      await sweep(language, "My models");
      // The switch is announced as "Expert mode" / "Mode Expert", which contains the "Expert" it shows (WCAG 2.5.3).
      await expect(page.getByRole("switch", { name: t("Expert mode", "Mode Expert"), exact: true })).toBeVisible();
      // #96: the help panel and the tour read in one language too, and the help covers adoption.
      await button(t("Help for My models", "Aide pour Mes modèles")).click();
      const help = page.getByRole("dialog", { name: t("Help", "Aide"), exact: true });
      await expect(help).toContainText(t("Keep [provider] in Bifrost", "Garder [fournisseur] dans Bifrost"));
      await sweep(language, "Help panel");
      await help.getByRole("button", { name: t("Start the tour", "Commencer la visite"), exact: true }).click();
      for (const [i, name] of [
        t("My models", "Mes modèles"),
        t("Groups", "Groupes"),
        t("Virtual keys", "Clés virtuelles"),
        t("Adopting a key", "Adopter une clé"),
      ].entries()) {
        await expect(page.getByRole("dialog", { name, exact: true })).toBeVisible();
        await sweep(language, `Tour step ${i + 1}`);
        if (i < 3) await button(t("Next", "Suivant")).click();
      }
      await button(t("Done", "Terminé")).click();
      // "+1 available" agrees with its count ("+1 disponible", never "+1 disponibles") and is said once, by the badge.
      await expect(card("QA Opus saved").locator("[data-attention]")).toHaveText(
        language === "fr" ? "+1 disponible" : "+1 available",
      );
      await expect(
        card("QA Opus saved").getByRole("button", { name: new RegExp(`^${t("Accesses", "Accès")}`) }),
      ).toHaveAccessibleName(`${t("Accesses", "Accès")} · 1 · QA Opus saved`);
      await accesses("QA Opus saved");
      await sweep(language, "Accesses popover of a saved card");
      await page.keyboard.press("Escape");
      const view = async (name: string) => {
        await button(t("View options", "Options d’affichage")).click();
        await page.getByRole("radio", { name, exact: true }).click();
        await page.keyboard.press("Escape");
      };
      await view(t("Table", "Tableau"));
      await sweep(language, "My models as a table");
      await view(t("Grid", "Grille"));
      // Prices follow the UI language without float noise: Bifrost's 2e-7 per token reads 0.2 per million.
      await scope(new RegExp(`^${t("To add", "À ajouter")}`)).click();
      await page
        .getByRole("textbox", { name: t("Search models", "Rechercher des modèles"), exact: true })
        .fill("qa-opus");
      await expect(card("QA Opus").locator("[data-attention]")).toHaveText(
        t("Add to QA Opus saved", "Ajouter à QA Opus saved"),
      );
      await expect(
        card("QA Opus").getByRole("button", { name: new RegExp(`^${t("Add to card", "Ajouter à la fiche")}`) }),
      ).toBeVisible();
      await sweep(language, "A model to add that fits saved cards");
      await page
        .getByRole("textbox", { name: t("Search models", "Rechercher des modèles"), exact: true })
        .fill("qa-reasoner");
      await accesses("QA Reasoner");
      await expect(popover).toContainText(language === "fr" ? /Prix entrée 0,2\s\$\/M/ : /Input price \$0\.2\/M/);
      await expect(popover).not.toContainText("0.19999");
      await sweep(language, "Accesses popover of a model to add");
      await page.keyboard.press("Escape");
      // #100: registering ends on one plain sentence of consequence, IDs folded away, in both languages.
      await open("QA Reasoner").click();
      // The Call name field and its hint read in one language too.
      await expect(sheet().getByRole("textbox", { name: t("Call name", "Nom d’appel"), exact: true })).toHaveValue(
        "qa-reasoner",
      );
      await expect(
        sheet().getByText(
          t(
            "The name applications use to call this model",
            "Le nom que les applications utilisent pour appeler ce modèle",
          ),
          { exact: true },
        ),
      ).toBeVisible();
      await sweep(language, "Register accesses step");
      await button(t("Next: model details", "Suivant : fiche modèle")).click();
      await button(t("Review", "Vérifier")).click();
      await expect(sheet().locator("#editor-journey-step-2")).toContainText(
        language === "fr"
          ? /Vous enregistrez QA Reasoner depuis (votre abonnement|vos abonnements) .+\. Il apparaîtra dans Mes modèles ; aucune clé ne pourra l’utiliser tant que vous ne l’aurez pas ajouté à une clé\./
          : /You’re registering QA Reasoner from your .+ subscriptions?\. It appears in My models; no key can use it until you add it to one\./,
      );
      await expect(sheet().getByText(t("Technical details", "Détails techniques"), { exact: true })).toBeVisible();
      await expect(
        sheet().getByText(t("Registry exposed ID", "ID exposé Registry"), { exact: false }).first(),
      ).toBeHidden();
      await sweep(language, "Register review");
      await button(t("Cancel", "Annuler")).click();
      await sheet().waitFor({ state: "hidden" });
      await page.getByRole("textbox", { name: t("Search models", "Rechercher des modèles"), exact: true }).fill("");
      await scope(new RegExp(`^${t("In Registry", "Dans Registry")}`)).click();
      // The card sheet: every tab, the access chooser and Review.
      await open("QA Opus saved").click();
      for (const tab of [
        t("Overview", "Vue d’ensemble"),
        t("Properties", "Propriétés"),
        t("Sources", "Sources"),
        t("Access", "Accès"),
      ]) {
        await sheet().getByRole("tab", { name: tab, exact: true }).click();
        await sweep(language, `Card sheet, ${tab} tab`);
      }
      await button(t("More actions", "Plus d’actions")).click();
      await sweep(language, "Card actions menu");
      await page.keyboard.press("Escape");
      await button(t("Edit accesses", "Modifier les accès")).click();
      await sweep(language, "Access chooser");
      await button(t("Review", "Vérifier")).click();
      await expect(sheet().locator("#editor-journey-step-2")).toContainText(
        t("No changes to save for QA Opus saved yet.", "Rien à enregistrer pour QA Opus saved pour le moment."),
      );
      await sweep(language, "Card review (nothing to save)");
      await page.keyboard.press("Escape");
      await sheet().waitFor({ state: "hidden" });
      await nav(t("Groups", "Groupes")).click();
      await sweep(language, "Groups");
      await button(t("Edit group", "Modifier le groupe")).first().click();
      await expect(sheet()).toContainText(
        t("Review the key impact before publishing.", "Vérifiez l’impact sur les clés avant la publication."),
      );
      await sweep(language, "Group sheet");
      await page.keyboard.press("Escape");
      await sheet().waitFor({ state: "hidden" });
      await nav(t("Virtual keys", "Clés virtuelles")).click();
      await sweep(language, "Virtual keys");
      // The adoption dialog reads the reasons Bifrost sends in plain words (a key allowed every provider blocks this one).
      await keyCard("QA All Providers Key")
        .getByRole("button", {
          name: t("See what blocks it · QA All Providers Key", "Voir ce qui bloque · QA All Providers Key"),
          exact: true,
        })
        .click();
      await button(t("Adopt this key", "Adopter cette clé")).click();
      await expect(page.getByRole("dialog")).toContainText(
        t(
          "allows every provider, including ones added later",
          "autorise tous les fournisseurs, y compris ceux ajoutés plus tard",
        ),
      );
      await expect(page.getByRole("dialog")).not.toContainText("allow_all_providers");
      await sweep(language, "Adoption dialog");
      // #93: the native edit offered here (and for the Mistral key below) reads in one language too; Cancel writes nothing.
      const nativeEdit = async (action: string, title: string, where: string) => {
        await page
          .getByRole("dialog")
          .getByRole("button", { name: new RegExp(`^${action}`) })
          .click();
        const edit = page.getByRole("dialog", { name: title, exact: true });
        await expect(edit.getByRole("list", { name: t("Allowed afterwards", "Autorisé ensuite") })).toBeVisible();
        await sweep(language, where);
        await edit.getByRole("button", { name: t("Cancel", "Annuler"), exact: true }).click();
        await expect(edit).toHaveCount(0);
      };
      await nativeEdit(
        t("Replace “all providers” by the explicit list", "Remplacer « tous les fournisseurs » par la liste explicite"),
        t("Replace “all providers” on the key", "Remplacer « tous les fournisseurs » sur la clé"),
        "Native edit preview of the all-providers key",
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("Cancel", "Annuler"), exact: true })
        .click();
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      // #87: readiness filter, per-provider permission counts and the grouped blockers (models Bifrost
      // does not list, models to add) read in one language too.
      await keyFilters();
      await page
        .getByRole("combobox", { name: t("Filter by readiness", "Filtrer par état d’adoption"), exact: true })
        .click();
      await sweep(language, "Readiness filter");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape"); // closes Filters
      await emptyShelf();
      // An empty key asks for models in Bifrost; a key allowing every model of a provider says why it cannot be adopted.
      await keyCard("QA Unmanaged Key")
        .getByRole("button", { name: t("Open · QA Unmanaged Key", "Ouvrir · QA Unmanaged Key"), exact: true })
        .click();
      await expect(
        page.getByText(
          t("Add models to this key in Bifrost first", "Ajoutez d’abord des modèles à cette clé dans Bifrost"),
          { exact: true },
        ),
      ).toBeVisible();
      await sweep(language, "Key page of the empty key");
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      await keyCard("QA Claude Key")
        .getByRole("button", {
          name: t("See what blocks it · QA Claude Key", "Voir ce qui bloque · QA Claude Key"),
          exact: true,
        })
        .click();
      await button(t("Adopt this key", "Adopter cette clé")).click();
      await sweep(language, "Adoption dialog of the all-models key");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("Cancel", "Annuler"), exact: true })
        .click();
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      for (const name of ["QA Mistral Key", "QA Hermes Key", "QA To Add Key"]) {
        await keyCard(name)
          .getByRole("button", { name: t(`See what blocks it · ${name}`, `Voir ce qui bloque · ${name}`), exact: true })
          .click();
        await page
          .getByRole("list", { name: t("Bifrost allows today", "Bifrost autorise aujourd’hui") })
          .locator("summary")
          .first()
          .click();
        await sweep(language, `Key page of ${name}`);
        await button(t("Adopt this key", "Adopter cette clé")).click();
        // The intro and the models are said in the dialog's own language, with nothing to open.
        await expect(page.getByRole("dialog")).toContainText(
          t(
            "Adopting itself changes nothing in Bifrost; the options marked “Changes Bifrost” do.",
            "Adopter ne change rien dans Bifrost en soi ; les options marquées « Modifie Bifrost » le font.",
          ),
        );
        await expect(page.getByRole("dialog")).not.toContainText(
          t("Show model names", "Afficher les noms des modèles"),
        );
        await sweep(language, `Adoption dialog of ${name}`);
        // Mistral is disabled in Bifrost, so it starts kept (swept above); undoing it shows the offers.
        if (name !== "QA To Add Key") {
          await page
            .getByRole("dialog")
            .getByRole("button", {
              name: t("Stop keeping Mistral in Bifrost", "Ne plus garder Mistral dans Bifrost"),
              exact: true,
            })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: t("Keep Mistral in Bifrost", "Garder Mistral dans Bifrost"), exact: true })
            .waitFor();
          // #100: the blockers read as plain sentences in both languages.
          if (name === "QA Mistral Key")
            await expect(page.getByRole("dialog")).toContainText(
              t(
                "So Bifrost shows none of its models, and Registry can’t manage the 3 models this key allows.",
                "Bifrost ne montre donc aucun de ses modèles : Registry ne peut pas gérer les 3 modèles que cette clé autorise.",
              ),
            );
          if (name === "QA Mistral Key")
            await expect(page.getByRole("dialog")).toContainText(
              t("1 model is allowed through Codex and Claude.", "1 modèle est autorisé via Codex et Claude."),
            );
          if (name === "QA Mistral Key")
            await expect(page.getByRole("dialog")).toContainText(t("Model: qa-shared", "Modèle : qa-shared"));
          if (name === "QA Mistral Key")
            await expect(
              page.getByRole("dialog").getByRole("button", {
                name: t("Use Codex for this model", "Utiliser Codex pour ce modèle"),
                exact: true,
              }),
            ).toBeVisible();
          await sweep(language, `Adoption dialog of ${name}, provider not kept`);
        }
        if (name === "QA Hermes Key")
          await nativeEdit(
            t("Remove these models from the key in Bifrost", "Retirer ces modèles de la clé dans Bifrost"),
            t("Remove models from the key in Bifrost", "Retirer des modèles de la clé dans Bifrost"),
            "Native edit preview of the Hermes key",
          );
        await page
          .getByRole("dialog")
          .getByRole("button", { name: t("Cancel", "Annuler"), exact: true })
          .click();
        await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      }
      // A key Bifrost was never asked about: the headline says so, in both languages, and the first check is beside it.
      await keyCard("QA Visual Key")
        .getByRole("button", { name: t("Open · QA Visual Key", "Ouvrir · QA Visual Key"), exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: t(/^This key can call .* · not checked yet$/, /^Cette clé peut appeler .* · pas encore vérifiée$/),
          level: 2,
        }),
      ).toBeVisible();
      await expect(button(t("Check with Bifrost", "Vérifier avec Bifrost"))).toBeVisible();
      await sweep(language, "Key page, not checked yet");
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      await keyCard("QA Development Key")
        .getByRole("button", { name: t("Open · QA Development Key", "Ouvrir · QA Development Key"), exact: true })
        .click();
      await sweep(language, "Key page");
      await button(t("More actions", "Plus d’actions")).click();
      await expect(
        page.getByRole("menuitem", {
          name: t("Re-link the Bifrost key", "Relier à nouveau la clé Bifrost"),
          exact: true,
        }),
      ).toBeVisible();
      await sweep(language, "Key actions menu");
      await page.keyboard.press("Escape");
      await button(t("Edit selection", "Modifier la sélection")).click();
      await sweep(language, "Key editor");
      await page
        .getByRole("list", { name: t("Key composition steps", "Étapes de composition de la clé") })
        .getByRole("button", { name: new RegExp(`^\\d ${t("Review", "Vérifier")}`) })
        .click();
      await sweep(language, "Key review");
      await nav(t("Settings", "Réglages")).click();
      for (const section of [
        t("General", "Général"),
        t("Appearance", "Affichage"),
        t("Catalog sources", "Sources"),
        t("Connection", "Connexion"),
        t("AI assistance", "Assistance"),
        t("Help", "Aide"),
      ]) {
        await button(section).click();
        await sweep(language, `Settings, ${section}`);
      }
      await button(t("Open catalog data", "Ouvrir les données du catalogue")).click();
      await page.getByRole("button").filter({ hasText: "synthetic-provider/qa-chat" }).first().click();
      await sweep(language, "Catalog data");
    };
    await tour("en");
    await page.getByRole("combobox", { name: "Language: English", exact: true }).click();
    await page.getByRole("option", { name: "Français", exact: true }).click();
    await tour("fr");
    const bare = await page.context().newPage();
    await bare.goto("/");
    await expect(bare.locator("html")).toHaveAttribute("lang", "fr");
    await bare.goto("/?lang=en");
    await expect(bare.locator("html")).toHaveAttribute("lang", "en");
    await bare.close();
    await page.getByRole("combobox", { name: "Langue : français", exact: true }).click();
    await page.getByRole("option", { name: "English", exact: true }).click();
  });

  await test.step("adoption keeps a provider native: the rest of the key is adopted and reads Verified", async () => {
    // #92, the Hermes case: Mistral is disabled in Bifrost, so its models can never become cards. Keeping the
    // provider native adopts the rest; Registry leaves Mistral's permissions alone and the readback expects them.
    await nav("Virtual keys").click();
    await keyCard("QA Mistral Key")
      .getByRole("button", { name: "See what blocks it · QA Mistral Key", exact: true })
      .click();
    await button("Adopt this key").click();
    const dialog = page.getByRole("dialog");
    // Disabled in Bifrost, Mistral starts kept there; what is kept is stated, and the collision is still to decide.
    const kept = dialog.getByRole("region", { name: "Kept in Bifrost" });
    await expect(kept).toContainText("Mistral · 3 models kept in Bifrost");
    await expect(kept).toContainText("Registry will not manage or change Mistral’s permissions");
    await expect(
      dialog.getByRole("heading", { name: "2 decisions before adopting · 1 already made", exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("1 of 2 decided", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
    // The collision is resolved inline: using Claude for qa-shared keeps Codex in Bifrost.
    await dialog.getByRole("button", { name: "Use Claude for this model", exact: true }).click();
    await expect(kept).toContainText("Codex kept in Bifrost");
    await expect(dialog).toContainText("Ready to adopt");
    await expect(dialog.getByText("2 of 2 decided", { exact: true })).toBeVisible();
    await expect(dialog).not.toContainText("decision");
    await dialog.getByText("Accesses Registry will manage (3)", { exact: true }).click();
    await expect(dialog.getByText("Claude/qa-shared", { exact: true }).first()).toBeVisible();
    await expect(dialog.getByText("mistral/qa-mistral-large", { exact: true })).toBeVisible();
    // The choice can be undone, and made again.
    await dialog.getByRole("button", { name: "Stop keeping Mistral in Bifrost", exact: true }).click();
    await expect(
      dialog.getByRole("region", { name: "2 decisions before adopting · 1 already made", exact: true }),
    ).toContainText("Mistral is disabled in Bifrost");
    await expect(dialog.getByText("1 of 2 decided", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Keep Mistral in Bifrost", exact: true }).click();
    await expect(kept).toContainText("Mistral · 3 models kept in Bifrost");
    await shot("after-keep-native-preview");
    const apply = page.waitForRequest(
      r => r.method() === "POST" && r.url().endsWith("/api/keys/adopt") && r.postDataJSON().phase === "apply",
    );
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    expect((await apply).postDataJSON()).toMatchObject({
      keyId: "vk-qa-mistral",
      operation: "adopt",
      phase: "apply",
      keepNative: ["Codex", "mistral"],
    });
    // The managed key counts every model it can call once, kept providers included, on its page and on its card
    // (#99): three Claude models through Registry, QA Shared also through Codex, and Mistral's three kept models.
    const ledger = page.getByRole("region", { name: /^This key can call/ });
    await expect(ledger).toHaveAccessibleName("This key can call 6 models · not checked yet");
    await expect(ledger.getByRole("listitem").filter({ hasText: "QA Shared" })).toContainText("via Claude, Codex");
    await expect(ledger.getByRole("listitem").filter({ hasText: "qa-mistral-large" })).toContainText("via Mistral");
    await expect(ledger).toContainText("Kept in Bifrost: Codex, Mistral.");
    await editSelection();
    await composerStep("Review").click();
    await button("Check with Bifrost").click();
    await page.getByText("Verified", { exact: true }).first().waitFor();
    // The check lists Mistral's routes, but they are Bifrost's: Review must not announce their removal.
    await expect(page.getByRole("region", { name: "Changes before publishing" })).toContainText("No change.");
    await expect(page.getByRole("list", { name: "Will lose" })).toHaveCount(0);
    const key = (await api("workspace")).data.keys.find((k: { id: string }) => k.id === "vk-qa-mistral");
    expect(key.managed).toBe(true);
    expect(key.policy.keptNative).toEqual(["Codex", "mistral"]);
    expect(key.publication.state).toBe("verified");
    expect(key.publication.expected).toEqual([
      "Claude/qa-haiku",
      "Claude/qa-shared",
      "Claude/qa-sonnet",
      "Codex/qa-shared",
      "mistral/qa-mistral-code",
      "mistral/qa-mistral-large",
      "mistral/qa-mistral-small",
    ]);
    // Registry never rewrote Bifrost's permissions for the kept provider.
    expect(key.permissions.providers.find((p: { provider: string }) => p.provider === "mistral").models).toEqual([
      "qa-mistral-large",
      "qa-mistral-small",
      "qa-mistral-code",
    ]);
    await button("All virtual keys").click();
    await expect(keyCard("QA Mistral Key")).toContainText("6 models · Verified");
    await shot("after-keep-native-key-card");
  });

  await test.step("a provider allowing every model is kept in Bifrost: the rest of the key is adopted and reads Verified", async () => {
    const writes = (await (await page.request.get("/__fixture/native-writes")).json()).length;
    await nav("Virtual keys").click();
    await keyCard("QA Wildcard Key")
      .getByRole("button", { name: "See what blocks it · QA Wildcard Key", exact: true })
      .click();
    await button("Adopt this key").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(
      "This key allows every Claude model, including future ones, so Registry can’t copy it as is.",
    );
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
    await dialog.getByRole("button", { name: "Keep Claude in Bifrost", exact: true }).click();
    await expect(dialog.getByRole("region", { name: "Kept in Bifrost" })).toContainText(
      "Claude · all models kept in Bifrost",
    );
    await expect(dialog).toContainText("Ready to adopt");
    await expect(dialog.getByText("Accesses Registry will manage (1)", { exact: true })).toBeVisible();
    const apply = page.waitForRequest(
      r => r.method() === "POST" && r.url().endsWith("/api/keys/adopt") && r.postDataJSON().phase === "apply",
    );
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    expect((await apply).postDataJSON()).toMatchObject({
      keyId: "vk-qa-wildcard",
      operation: "adopt",
      phase: "apply",
      keepNative: ["Claude"],
    });
    // Claude allows every model in Bifrost: the total is open ("at least").
    const ledger = page.getByRole("region", { name: /^This key can call/ });
    await expect(ledger).toHaveAccessibleName("This key can call at least 1 model · not checked yet");
    await expect(ledger.getByRole("listitem").filter({ hasText: "All models Bifrost allows" })).toContainText(
      "via Claude",
    );
    await expect(ledger.getByRole("listitem").filter({ hasText: "via Codex" })).toHaveCount(1);
    // The read-first page checks the key with Bifrost without opening the editor or the technical fold.
    await button("Check with Bifrost").click();
    await expect(ledger.getByText(/^Technical check · Verified /)).toBeVisible();
    const key = (await api("workspace")).data.keys.find((k: { id: string }) => k.id === "vk-qa-wildcard");
    expect(key.managed).toBe(true);
    expect(key.policy.keptNative).toEqual(["Claude"]);
    expect(key.publication.state).toBe("verified");
    // Registry never rewrote Bifrost's "*" for Claude: no native write at all.
    expect(key.permissions.providers.find((p: { provider: string }) => p.provider === "Claude").allModels).toBe(true);
    expect((await (await page.request.get("/__fixture/native-writes")).json()).length).toBe(writes);

    // The live Hermes case (spec #85, fix round 1): a Registry route named like the kept provider
    // (Claude/qa-haiku while Claude stays in Bifrost) is Registry's. Published and verified, Review shows
    // no change; a later change lists only itself, never the verified route as "Will gain".
    await editSelection();
    await page.getByRole("checkbox", { name: "Add to this key: QA Haiku", exact: true }).click();
    await composerStep("Review").click();
    await button("Publish changes").click();
    await expect(button("Publish changes")).toBeDisabled();
    await button("Check again").click();
    await page.getByText("Verified", { exact: true }).first().waitFor();
    expect(
      (await api("workspace")).data.keys.find((k: { id: string }) => k.id === "vk-qa-wildcard").publication.actual,
    ).toContain("Claude/qa-haiku");
    await expect(keyChanges()).toContainText("Compared with what Bifrost last confirmed");
    await expect(keyChanges()).toContainText("No change.");
    await composerStep("Models").click();
    await page.getByRole("checkbox", { name: "Add to this key: qa-sonnet", exact: true }).click();
    await composerStep("Review").click();
    await expect(keyChanges().getByRole("list", { name: "Will gain" })).toContainText("Claude/qa-sonnet");
    await expect(keyChanges().getByRole("list", { name: "Will gain" })).not.toContainText("Claude/qa-haiku");
    await button("Discard draft").click();
    await button("All virtual keys").click();
  });

  await test.step("a kept model Bifrost does not list is flagged, not counted, and reads as a difference (#99)", async () => {
    // The live Hermes shape: Google allows qa-gemini and qa-ghost on this key but does not serve qa-ghost, so it
    // blocks adoption until Google is kept in Bifrost; Bifrost's /v1/models then leaves Google/qa-ghost out.
    await nav("Virtual keys").click();
    await keyCard("QA Kept Key").getByRole("button", { name: "See what blocks it · QA Kept Key", exact: true }).click();
    await button("Adopt this key").click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Keep Google in Bifrost", exact: true }).click();
    await expect(dialog).toContainText("Ready to adopt");
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    const ledger = page.getByRole("region", { name: /^This key can call/ });
    await ledger.getByText(/^Technical check · /).click();
    // Adopted but never checked: the first check is named, beside the headline; once done it checks again (#99).
    await expect(ledger.getByRole("button", { name: "Check again", exact: true })).toHaveCount(0);
    await button("Check with Bifrost").click();
    await expect(ledger.getByText(/^Technical check · Verified .* · 1 difference$/)).toBeVisible();
    await expect(ledger.getByRole("button", { name: "Check again", exact: true })).toBeVisible();
    await expect(ledger.getByRole("button", { name: "Check with Bifrost", exact: true })).toHaveCount(0);
    await expect(ledger).toHaveAccessibleName("This key can call 2 models");
    await expect(
      ledger.getByRole("listitem").filter({ hasText: "Google: Bifrost does not list this one" }),
    ).toContainText("qa-ghost");
    await expect(ledger.getByRole("listitem").filter({ hasText: "via Google" })).toHaveCount(1);
    await expect(ledger).toContainText("Kept in Bifrost: Google.");
    // A kept route is Bifrost's: Registry's own check still reads verified, with no missing route.
    const key = (await api("workspace")).data.keys.find((k: { id: string }) => k.id === "vk-qa-kept");
    expect(key.publication.state).toBe("verified");
    expect(key.publication.missing).toEqual([]);
    expect(key.publication.actual).not.toContain("Google/qa-ghost");
    await button("All virtual keys").click();
    await expect(keyCard("QA Kept Key")).toContainText("2 models · Verified · 1 difference");
  });

  await test.step("a blocked key loses what Registry cannot represent only after a preview and a confirmation, then it is adopted (#93)", async () => {
    // The fixture records every native key update exactly as the panel sent it.
    const nativeWrites = async (): Promise<{ keyId: string; body: Record<string, unknown> }[]> =>
      (await page.request.get("/__fixture/native-writes")).json();
    const nativeKey = async (id: string) => (await api("workspace")).data.keys.find((k: { id: string }) => k.id === id);
    const written = (await nativeWrites()).length;
    const dialog = page.getByRole("dialog");
    const lines = (edit: Locator, name: string) => edit.getByRole("list", { name, exact: true });
    await nav("Virtual keys").click();

    // Models Bifrost does not list (Mistral is disabled): the dialog offers to remove them, with the consequence stated.
    await keyCard("QA Hermes Key")
      .getByRole("button", { name: "See what blocks it · QA Hermes Key", exact: true })
      .click();
    await button("Adopt this key").click();
    // Mistral starts kept in Bifrost (it is disabled there); stopping that offers the native edit instead.
    await dialog.getByRole("button", { name: "Stop keeping Mistral in Bifrost", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
    await expect(dialog).toContainText("Changes the key in Bifrost once you confirm a preview");
    // What changes Bifrost is tagged; keeping the provider in Bifrost is not.
    await expect(dialog.getByText("Changes Bifrost", { exact: true })).toHaveCount(1);
    await dialog.getByRole("button", { name: /^Remove these models from the key in Bifrost/ }).click();
    const edit = page.getByRole("dialog", { name: "Remove models from the key in Bifrost", exact: true });
    await expect(edit).toContainText("This changes the key in Bifrost, not only in Registry.");
    await expect(edit).toContainText("Requests that use these models will be refused.");
    await expect(lines(edit, "Allowed today")).toContainText("Mistral · 2 models");
    await expect(lines(edit, "Allowed afterwards")).toContainText("Claude · 2 models");
    await expect(lines(edit, "Allowed afterwards")).not.toContainText("Mistral");
    await lines(edit, "Removed from the key").getByText("Mistral · 2 models", { exact: true }).click();
    await expect(lines(edit, "Removed from the key")).toContainText("qa-mistral-large, qa-mistral-small");
    // Nothing is written before the confirmation, and Cancel keeps it that way.
    expect(await nativeWrites()).toHaveLength(written);
    await edit.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(edit).toHaveCount(0);
    expect(
      (await nativeKey("vk-qa-hermes")).permissions.providers.map((p: { provider: string }) => p.provider),
    ).toEqual(["mistral", "Claude"]);
    expect(await nativeWrites()).toHaveLength(written);

    await dialog.getByRole("button", { name: /^Remove these models from the key in Bifrost/ }).click();
    const confirmation = page.waitForRequest(
      r =>
        r.method() === "POST" && r.url().endsWith("/api/keys/native-permissions") && r.postDataJSON().phase === "apply",
    );
    await edit.getByRole("button", { name: "Confirm: remove 2 models", exact: true }).click();
    expect((await confirmation).postDataJSON()).toEqual({
      keyId: "vk-qa-hermes",
      operation: "remove-models",
      provider: "mistral",
      phase: "apply",
      previewToken: expect.any(String),
      confirm: true,
    });
    await expect(edit.getByRole("status")).toContainText("Done. 2 models removed from the key in Bifrost.");
    await expect(lines(edit, "Allowed now")).toContainText("Claude · 2 models");
    // The whole key was reposted from its read-back: only the Mistral row is gone.
    const writes = await nativeWrites();
    expect(writes).toHaveLength(written + 1);
    expect(writes[written]).toEqual({
      keyId: "vk-qa-hermes",
      body: {
        name: "QA Hermes Key",
        description: "Synthetic Hermes client",
        is_active: true,
        allow_all_providers: false,
        provider_configs: [
          {
            id: expect.any(Number),
            provider: "Claude",
            weight: null,
            allowed_models: ["qa-haiku", "qa-opus"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
        ],
      },
    });
    await edit.getByRole("button", { name: "Back to adoption", exact: true }).click();
    // The readiness refreshed behind the dialog: the key can be adopted now.
    await expect(dialog).not.toContainText("before adopting");
    await expect(dialog.getByRole("button", { name: /^Remove these models/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const hermes = await nativeKey("vk-qa-hermes");
    expect(hermes.managed).toBe(true);
    expect([...hermes.policy.added].sort()).toEqual(["qa-haiku", "qa-opus"]);
    expect(await nativeWrites()).toHaveLength(written + 1);

    // "All providers": the dialog offers the explicit list; the preview names what stops being allowed.
    await button("All virtual keys").click();
    await keyCard("QA All Providers Key")
      .getByRole("button", { name: "See what blocks it · QA All Providers Key", exact: true })
      .click();
    await button("Adopt this key").click();
    await expect(dialog).toContainText("This key allows every provider, including ones added later");
    await expect(dialog.getByRole("button", { name: /^Remove these models/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Replace “all providers” by the explicit list", exact: true }).click();
    const replace = page.getByRole("dialog", { name: "Replace “all providers” on the key", exact: true });
    await expect(replace).toContainText(
      "Providers added to Bifrost later are not allowed until you add them to the key.",
    );
    await expect(lines(replace, "Allowed today")).toContainText("All providers");
    const afterwards = lines(replace, "Allowed afterwards");
    await expect(afterwards.locator("summary")).toHaveText([
      "Claude · 5 models",
      "Codex · 2 models",
      "Google · 2 models",
      "Synthetic Provider · 3 models",
    ]);
    // Disabled Mistral is not a provider the key can reach today. Left out: qa-shared at Codex (Claude serves it first: one access per model),
    // qa-image (its card was deleted above) and the models without a card.
    await expect(lines(replace, "Removed from the key").locator("summary")).toHaveText([
      "Codex · 1 model",
      "Google · 1 model",
      /^OpenRouter · \d+ models$/,
      "Synthetic Provider · 1 model",
      "Typesafe · 1 model",
    ]);
    expect(await nativeWrites()).toHaveLength(written + 1);
    const replacement = page.waitForRequest(
      r =>
        r.method() === "POST" && r.url().endsWith("/api/keys/native-permissions") && r.postDataJSON().phase === "apply",
    );
    await replace.getByRole("button", { name: "Confirm: replace “all providers”", exact: true }).click();
    expect((await replacement).postDataJSON()).toMatchObject({
      keyId: "vk-qa-all-providers",
      operation: "replace-all-providers",
      phase: "apply",
      confirm: true,
    });
    await expect(replace.getByRole("status")).toContainText("Done. The key no longer allows every provider");
    expect((await nativeWrites())[written + 1]).toEqual({
      keyId: "vk-qa-all-providers",
      body: {
        name: "QA All Providers Key",
        description: "Synthetic client allowed every provider",
        is_active: true,
        allow_all_providers: false,
        provider_configs: [
          {
            provider: "Claude",
            weight: null,
            allowed_models: ["qa-haiku", "qa-opus", "qa-opus-fast", "qa-shared", "qa-sonnet"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
          {
            provider: "Codex",
            weight: null,
            allowed_models: ["qa-codex", "qa-codex-mini"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
          {
            provider: "Google",
            weight: null,
            allowed_models: ["qa-flash", "qa-gemini"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
          {
            provider: "synthetic-provider",
            weight: null,
            allowed_models: ["qa-chat", "qa-code", "qa-vision"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
        ],
      },
    });
    await replace.getByRole("button", { name: "Back to adoption", exact: true }).click();
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await nativeKey("vk-qa-all-providers")).managed).toBe(true);
    expect(await nativeWrites()).toHaveLength(written + 2);

    // Every model of Claude ("*"): the dialog offers the models saved in Registry instead; Bifrost is written
    // only after the confirmation, and the key is then adopted.
    await button("All virtual keys").click();
    await keyCard("QA Claude Key")
      .getByRole("button", { name: "See what blocks it · QA Claude Key", exact: true })
      .click();
    await button("Adopt this key").click();
    await dialog.getByRole("button", { name: /^Replace “all models” by the models saved in Registry/ }).click();
    const narrow = page.getByRole("dialog", { name: "Replace “all models” of Claude on the key", exact: true });
    await expect(narrow).toContainText("Claude stops allowing every model");
    await expect(narrow).toContainText("Models Claude adds later are not allowed until you add them to the key.");
    await expect(lines(narrow, "Allowed today")).toContainText("Claude · all models");
    await expect(lines(narrow, "Allowed afterwards").locator("summary")).toHaveText(["Claude · 5 models"]);
    // Every Claude model has a card: nothing is left out, and the row (with its limits) stays.
    await expect(lines(narrow, "Removed from the key")).toHaveCount(0);
    await expect(narrow).not.toContainText("budgets");
    expect(await nativeWrites()).toHaveLength(written + 2);
    const narrowing = page.waitForRequest(
      r =>
        r.method() === "POST" && r.url().endsWith("/api/keys/native-permissions") && r.postDataJSON().phase === "apply",
    );
    await narrow.getByRole("button", { name: "Confirm: replace “all models”", exact: true }).click();
    expect((await narrowing).postDataJSON()).toEqual({
      keyId: "vk-qa-claude",
      operation: "replace-all-models",
      provider: "Claude",
      phase: "apply",
      previewToken: expect.any(String),
      confirm: true,
    });
    await expect(narrow.getByRole("status")).toContainText("Done. Claude no longer allows every model");
    expect((await nativeWrites())[written + 2]).toEqual({
      keyId: "vk-qa-claude",
      body: {
        name: "QA Claude Key",
        description: "Synthetic Claude client",
        is_active: true,
        allow_all_providers: false,
        provider_configs: [
          {
            id: expect.any(Number),
            provider: "Claude",
            weight: null,
            allowed_models: ["qa-haiku", "qa-opus", "qa-opus-fast", "qa-shared", "qa-sonnet"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
        ],
      },
    });
    await narrow.getByRole("button", { name: "Back to adoption", exact: true }).click();
    await expect(dialog).not.toContainText("before adopting");
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await nativeKey("vk-qa-claude")).managed).toBe(true);
    expect(await nativeWrites()).toHaveLength(written + 3);
    await button("All virtual keys").click();
  });

  await test.step("mobile sheet, footer, focus and metadata detail fit viewport", async () => {
    await nav("Groups").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await button("Create group").click();
    await withinViewport(sheet());
    // The primary action is Continue (Publish group is on the last step); a disabled button does
    // not receive pointer events, so enable it before checking that nothing covers it.
    await page.getByRole("textbox", { name: "Group name *", exact: true }).fill("QA Mobile Group");
    await withinViewport(button("Continue"));
    for (const target of [
      sheet().getByRole("heading", { name: "Create group", exact: true }),
      sheet().getByRole("button", { name: "Close", exact: true }),
      button("Continue"),
    ]) {
      expect(
        await target.evaluate(el => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return el === hit || el.contains(hit);
        }),
        "Toast must not cover the mobile title, close control or primary action",
      ).toBe(true);
    }
    expect(await sheet().evaluate(el => el.contains(document.activeElement))).toBe(true);
    await shot("after-mobile-group");
    await button("Cancel").click();
    await button("Discard changes").click();
    await sheet().waitFor({ state: "hidden" });
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav("My models").click();
    await page
      .getByRole("button", { name: /^Open .* details$/ })
      .first()
      .click(); // QA Chat was renamed by the metadata correction
    await page.setViewportSize({ width: 390, height: 620 });
    await withinViewport(sheet());
    await withinViewport(button("Edit"));
    await button("Edit").click();
    await withinViewport(button("Review")); // was Save model
    await shot("after-mobile-editor");
    await button("Cancel").click();
    await closeSheet();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav("Settings").click();
    await button("Open catalog data").click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button").filter({ hasText: "synthetic-provider/qa-code" }).first().click();
    await withinViewport(button("Back to list"));
    await button("Edit field").click();
    await withinViewport(page.getByRole("dialog"));
    await shot("after-mobile-metadata");
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav("My models").click();
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await test.step("a phone folds the view controls and shows the first card; no gateway dead end", async () => {
    // Wide, in Expert: View, Shape and Density sit in the toolbar, density with its column count.
    await page.setViewportSize({ width: 1440, height: 950 });
    await setExpert(true);
    await expect(page.getByRole("radio", { name: "Small · 4 columns", exact: true })).toBeVisible();
    await setExpert(false);
    // Live mode has no gateway inventory, so Settings offers no way to it.
    await nav("Settings").click();
    await expect(button("Open catalog data")).toBeVisible();
    await expect(button("View gateway")).toHaveCount(0);
    await button("Help").click();
    await expect(page.getByText("Need the gateway details?")).toBeVisible();
    await expect(page.getByText("Keep [provider] in Bifrost"), "Settings shows the same help").toBeVisible();
    await expect(button("Start the tour")).toBeVisible();
    await expect(button("View gateway")).toHaveCount(0);
    // Connection speaks plainly; the variable names wait behind "For the administrator".
    await button("Connection").click();
    await expect(page.getByText(/REGISTRY_BIFROST_AUTH/)).toBeHidden();
    await page.getByText("For the administrator", { exact: true }).click();
    await expect(page.getByText(/REGISTRY_BIFROST_AUTH/)).toBeVisible();
    await nav("My models").click();
    // 375 px: one column, so the controls fold into View options and density loses its counts.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator(".content-container").evaluate(el => el.scrollTo(0, 0));
    const helpBox = (await button("Help for My models").boundingBox())!;
    expect(Math.min(helpBox.width, helpBox.height), JSON.stringify(helpBox)).toBeGreaterThanOrEqual(24);
    const titleBox = (await page
      .getByRole("button", { name: /^Open .* details$/ })
      .first()
      .boundingBox())!;
    expect(titleBox.height, `a card title is a 24 px target: ${JSON.stringify(titleBox)}`).toBeGreaterThanOrEqual(24);
    // A first visit on a phone gets no tour banner (it would push the first card down); "?" still starts the tour.
    const first = await browser.newPage({ baseURL, viewport: { width: 375, height: 812 } });
    first.on("pageerror", e => errors.push(e.message));
    await first.goto("/?lang=en");
    await first.getByLabel("Admin token", { exact: true }).fill(token);
    await first.getByRole("button", { name: "Sign in", exact: true }).click();
    await first
      .getByRole("button", { name: /^Open .* details$/ })
      .first()
      .waitFor();
    await expect(first.getByRole("region", { name: "Guided tour", exact: true }), "no banner on a phone").toBeHidden();
    await expect(
      first.getByRole("button", { name: /^Open .* details$/ }).first(),
      "the first card is in the first screen",
    ).toBeInViewport();
    await first.getByRole("button", { name: "Help for My models", exact: true }).click();
    await expect(
      first.getByRole("dialog", { name: "Help", exact: true }).getByRole("button", { name: "Start the tour" }),
      "the help sheet starts the tour",
    ).toBeVisible();
    await first.close();
    await expect(page.getByRole("radio", { name: "Table", exact: true })).toHaveCount(0);
    await withinViewport(page.getByRole("button", { name: /^Open .* details$/ }).first());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await shot("after-mobile-catalogue-375");
    await button("View options").click();
    for (const name of ["Grid", "Table", "Rectangle", "Square", "Small", "Medium", "Large"])
      await expect(page.getByRole("radio", { name, exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("radio", { name: "Small", exact: true })).toHaveCount(0);
    // An empty Groups page: one Create, no search or view toolbar.
    const empty = await browser.newPage({ baseURL, viewport: { width: 375, height: 812 } });
    await skipTour(empty);
    empty.on("pageerror", e => errors.push(e.message));
    const catalog = await api("catalog");
    await empty.route("**/api/workspace", r =>
      r.fulfill({ json: { ...workspace, data: { ...workspace.data, groups: [] } } }),
    );
    await empty.route("**/api/catalog", r => r.fulfill({ json: catalog }));
    await empty.goto("/#/groups");
    await empty.getByText("No groups yet", { exact: true }).waitFor();
    await expect(empty.getByRole("button", { name: "Create group", exact: true })).toHaveCount(1);
    await expect(empty.getByRole("textbox", { name: "Search groups", exact: true })).toHaveCount(0);
    await expect(empty.getByRole("button", { name: "View options", exact: true })).toHaveCount(0);
    const create = await empty.getByRole("button", { name: "Create group", exact: true }).boundingBox();
    expect(create && create.y >= 0 && create.y + create.height <= 812, JSON.stringify(create)).toBeTruthy();
    await testInfo.attach("after-mobile-empty-groups", {
      body: await empty.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    await empty.close();
    // #101: with nothing discovered or registered, the first-run card offers the same verb as the toolbar.
    const none = await browser.newPage({ baseURL, viewport: { width: 375, height: 812 } });
    await skipTour(none);
    none.on("pageerror", e => errors.push(e.message));
    await none.route("**/api/workspace", r =>
      r.fulfill({ json: { ...workspace, discovery: [], data: { ...workspace.data, models: [] } } }),
    );
    await none.route("**/api/catalog", r => r.fulfill({ json: catalog }));
    await none.goto("/");
    await none.getByText("Build your model catalog", { exact: true }).waitFor();
    await expect(
      none
        .locator('[data-slot="card"]')
        .filter({ hasText: "Build your model catalog" })
        .getByRole("button", { name: "Register a model", exact: true }),
    ).toBeVisible();
    await expect(none.getByRole("button", { name: /^Add model/ })).toHaveCount(0);
    await none.close();
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await test.step("a phone folds the filters into Filters (n); selected toggles stand out; view controls and the page title appear once", async () => {
    // Colours as painted: one canvas pixel turns oklch()/color-mix() into sRGB, and a translucent surface is composited over its parents.
    const contrastOf = (toggle: Locator) =>
      toggle.evaluate(on => {
        const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
        const rgba = (css: string) => {
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = "#000";
          ctx.fillStyle = css;
          ctx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
          return [r, g, b, a / 255];
        };
        const over = (top: number[], below: number[]) =>
          [0, 1, 2].map(i => top[i] * top[3] + below[i] * (1 - top[3])).concat(1);
        const luminance = ([r, g, b]: number[]) =>
          [r, g, b]
            .map(c => {
              const v = c / 255;
              return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            })
            .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const ratio = (a: number[], b: number[]) => {
          const [x, y] = [luminance(a), luminance(b)];
          return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
        };
        const surface = (el: Element) => {
          const parents: Element[] = [];
          for (let n = el.parentElement; n; n = n.parentElement) parents.push(n);
          return parents.reduceRight(
            (below, n) => over(rgba(getComputedStyle(n).backgroundColor), below),
            getComputedStyle(document.documentElement).colorScheme === "dark" ? [18, 18, 18, 1] : [255, 255, 255, 1],
          );
        }; // the canvas the UA paints behind a transparent page
        const style = getComputedStyle(on);
        const behind = surface(on),
          fill = over(rgba(style.backgroundColor), behind),
          outline = over(rgba(style.outlineColor), behind);
        const off = [...on.parentElement!.querySelectorAll('[data-state="off"]')][0];
        return {
          state: on.getAttribute("data-state"),
          outlineStyle: style.outlineStyle,
          outlineWidth: parseFloat(style.outlineWidth),
          outlineVsSurface: ratio(outline, behind),
          outlineVsFill: ratio(outline, fill),
          textVsFill: ratio(rgba(style.color), fill),
          idleText: off ? ratio(rgba(getComputedStyle(off).color), surface(off)) : 0,
        };
      });
    const expectSelectedStandsOut = async (toggle: Locator, label: string) => {
      const c = await contrastOf(toggle);
      expect(c.state, label).toBe("on");
      expect([c.outlineStyle, c.outlineWidth], `${label} outline`).toEqual(["solid", expect.any(Number)]);
      expect(c.outlineWidth, `${label} outline width`).toBeGreaterThanOrEqual(1);
      expect(c.outlineVsSurface, `${label} outline on its surface: ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(3);
      expect(c.outlineVsFill, `${label} outline on its fill: ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(3);
      expect(c.textVsFill, `${label} selected text: ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(4.5);
      expect(c.idleText, `${label} unselected text: ${JSON.stringify(c)}`).toBeGreaterThanOrEqual(4.5);
      expect(c.textVsFill, `${label} selected text is stronger than the unselected one`).toBeGreaterThan(c.idleText);
    };
    const selectedToggles = async (theme: string) => {
      await page.waitForFunction(() => document.getAnimations().length === 0); // colours transition for a moment after a theme switch
      await expectSelectedStandsOut(scope(/^In Registry/), `${theme} scope`);
      await expectSelectedStandsOut(page.getByRole("radio", { name: "Grid", exact: true }), `${theme} View`);
      await expectSelectedStandsOut(page.getByRole("radio", { name: "Rectangle", exact: true }), `${theme} Shape`);
      await expectSelectedStandsOut(
        page.getByRole("radio", { name: "Small · 4 columns", exact: true }),
        `${theme} Density`,
      );
      await button("View options").click();
      await expectSelectedStandsOut(page.getByRole("radio", { name: "Creator", exact: true }), `${theme} Primary logo`);
      await page.keyboard.press("Escape");
    };

    // Wide: the page title shows once (the topbar no longer repeats it) and View/Shape/Density sit in the toolbar only.
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav("My models").click();
    await scope(/^In Registry/).waitFor();
    await setExpert(true); // Basic folds the toolbar at every width (checked at sign-in); Expert keeps it inline
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("My models");
    await expect(page.locator("header").first()).not.toContainText("My models");
    await expect(page.getByRole("button", { name: /^Filters/ }), "wide toolbars keep their filters inline").toHaveCount(
      0,
    );
    await expect(page.getByRole("combobox", { name: "Creator", exact: true })).toBeVisible();
    for (const name of ["Grid", "Table", "Rectangle", "Square", "Small · 4 columns"])
      await expect(page.getByRole("radio", { name, exact: true })).toHaveCount(1);
    await button("View options").click();
    for (const name of ["Grid", "Table", "Rectangle", "Square", "Small · 4 columns"])
      await expect(page.getByRole("radio", { name, exact: true }), `${name} is not offered twice`).toHaveCount(1);
    await expect(
      page.getByRole("radio", { name: "Provider", exact: true }),
      "View options keeps what the toolbar does not",
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await selectedToggles("light");
    await button("Use dark theme").click();
    await expect(page.locator("html")).toHaveAttribute("class", "dark");
    await selectedToggles("dark");
    await button("Use light theme").click();
    await expect(page.locator("html")).not.toHaveAttribute("class", "dark");
    // Other pages carry their own title too, once.
    await nav("Groups").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Groups");
    await expect(page.locator("header").first()).not.toContainText("Groups");
    await nav("Virtual keys").click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Virtual keys");
    await expect(page.locator("header").first()).not.toContainText("Virtual keys");
    await nav("My models").click();

    await setExpert(false);
    // 375 px: search stays, every filter folds into one Filters control, and the first card is in the first screen.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator(".content-container").evaluate(el => el.scrollTo(0, 0));
    const filters = page.getByRole("button", { name: /^Filters/ });
    await expect(searchModels()).toBeVisible();
    await expect(filters).toHaveCount(1);
    await expect(filters).toHaveAccessibleName("Filters");
    for (const name of [
      "Creator",
      "Serving provider",
      "Usage / task",
      "Group models by",
      "Sort models by",
      "Input",
      "Output",
      "Capability",
    ])
      await expect(page.getByRole("combobox", { name, exact: true }), `${name} is folded`).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^More filters/ })).toHaveCount(0);
    await withinViewport(page.getByRole("button", { name: /^Open .* details$/ }).first());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await shot("after-mobile-filters-375");
    // The keyboard opens it, every control is inside, a choice shows in the count, Escape closes it and gives the focus back.
    await filters.focus();
    await page.keyboard.press("Enter");
    for (const name of [
      "Creator",
      "Serving provider",
      "Usage / task",
      "Group models by",
      "Sort models by",
      "Input",
      "Output",
      "Capability",
    ])
      await expect(page.getByRole("combobox", { name, exact: true }), name).toBeVisible();
    const opens = page.getByRole("button", { name: /^Open .* details$/ });
    const total = await opens.count();
    await page.getByRole("combobox", { name: "Creator", exact: true }).click();
    const creator = (await page.getByRole("option").allTextContents())[1]; // "<name> (n)"
    await page.getByRole("option", { name: creator, exact: true }).click();
    await expect(filters).toHaveAccessibleName("Filters (1)");
    await expect(
      page.getByRole("combobox", { name: "Output", exact: true }),
      "a choice keeps the panel open",
    ).toBeVisible();
    await page.getByRole("combobox", { name: "Sort models by", exact: true }).click();
    await page.getByRole("option", { name: "Sort by creator", exact: true }).click();
    await expect(filters, "sorting is not a filter").toHaveAccessibleName("Filters (1)");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("combobox", { name: "Output", exact: true })).toBeHidden();
    await expect(filters, "Escape returns focus to the trigger").toBeFocused();
    await expect(opens).toHaveCount(Number(creator.match(/\((\d+)\)$/)![1]));
    await button("Clear all").click();
    await expect(filters).toHaveAccessibleName("Filters");
    await expect(opens).toHaveCount(total);
    await filters.click();
    await page.getByRole("combobox", { name: "Sort models by", exact: true }).click();
    await page.getByRole("option", { name: "Sort by name", exact: true }).click(); // the Models page default again
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 950 });
  });

  await test.step("View options never clips a control; on a phone the header and card controls are touch targets (adapt)", async () => {
    // WCAG 2.5.8: every interactive element is at least 24 px wide and high; under the project's sm (40rem) the named
    // controls reach the standard control height of 2.25rem (36 px), by padding and min-height only.
    const expectMinTarget = async (target: Locator, min: number, label = "") => {
      const box = (await target.boundingBox())!;
      expect(box, `${label} is on the page`).not.toBeNull();
      expect([box.width >= min, box.height >= min], `${label} is at least ${min} px: ${JSON.stringify(box)}`).toEqual([
        true,
        true,
      ]);
    };
    // Basic folds the density segment into View options at every width: each radio, drawn or not, lies inside the popover.
    const expectNothingClipped = async (on: Page, where: string) => {
      await on.getByRole("button", { name: /^(View options|Options d’affichage)$/ }).click();
      const popover = on.locator('[data-slot="popover-content"]');
      await popover.getByRole("radio").first().waitFor();
      await on.waitForFunction(() => document.getAnimations().length === 0); // the popover zooms in for a moment
      const frame = (await popover.boundingBox())!;
      const radios = await popover.getByRole("radio").all();
      expect(radios.length, `${where}: View, Shape, Density and Logo segments`).toBe(9);
      for (const radio of radios) {
        const box = (await radio.boundingBox())!;
        const name = await radio.evaluate(el => el.textContent?.trim().replace(/\s+/g, " "));
        expect(
          [box.x >= frame.x - 0.5, box.x + box.width <= frame.x + frame.width + 0.5],
          `${where}: ${name} lies inside the popover ${JSON.stringify({ box, frame })}`,
        ).toEqual([true, true]);
        expect(
          await radio.evaluate(el => el.scrollWidth <= el.clientWidth),
          `${where}: ${name} shows all its text`,
        ).toBe(true);
      }
      expect(
        await popover.evaluate(el => el.scrollWidth <= el.clientWidth),
        `${where}: the popover does not scroll`,
      ).toBe(true);
      await on.keyboard.press("Escape");
      await expect(popover).toHaveCount(0);
    };
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav("My models").click();
    await setExpert(false);
    await expectNothingClipped(page, "English at 1440 px");
    // The count stays in the name and the tooltip of each density segment, not in its drawn label.
    await button("View options").click();
    for (const [size, columns] of [
      ["Small", 4],
      ["Medium", 3],
      ["Large", 2],
    ] as const) {
      const segment = page.getByRole("radio", { name: `${size} · ${columns} columns`, exact: true });
      await expect(segment).toHaveAttribute("title", `${size} · ${columns} columns on a wide screen`);
      expect((await segment.boundingBox())!.width, `${size} is a short segment`).toBeLessThan(100);
    }
    await page.keyboard.press("Escape");
    const french = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    await skipTour(french);
    french.on("pageerror", e => errors.push(e.message));
    await french.goto("/?lang=fr");
    await french.getByLabel("Jeton administrateur", { exact: true }).fill(token);
    await french.getByRole("button", { name: "Se connecter", exact: true }).click();
    await french
      .getByRole("button", { name: /^Ouvrir la fiche / })
      .first()
      .waitFor();
    await expectNothingClipped(french, "French at 1440 px");
    await french.close();

    // Desktop keeps its size: the Help button stays 24 px and the Filters button stays compact (32 px).
    const desktopHelp = (await button("Help for My models").boundingBox())!;
    expect([desktopHelp.width, desktopHelp.height], "Help keeps its desktop size").toEqual([24, 24]);
    expect((await page.getByRole("button", { name: /^Filters/ }).boundingBox())!.height, "Filters stays compact").toBe(
      32,
    );

    // 375 px: the named controls are 36 px, and every interactive element of the header is at least 24 px.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator(".content-container").evaluate(el => el.scrollTo(0, 0));
    await expectMinTarget(button("Help for My models"), 36, "Help");
    await expectMinTarget(
      page.locator("header").getByRole("button", { name: "Toggle sidebar", exact: true }),
      36,
      "Sidebar toggle",
    );
    await expectMinTarget(page.getByRole("button", { name: /^Filters/ }), 36, "Filters");
    await expectMinTarget(button("View options"), 36, "View options");
    await expectMinTarget(page.getByRole("button", { name: /^Open .* details$/ }).first(), 36, "Open details");
    for (const control of await page
      .locator("header")
      .locator("a, button, [role=combobox], [role=switch], input")
      .all())
      if (await control.isVisible()) await expectMinTarget(control, 24, "A header control");
    await expectNothingClipped(page, "English at 375 px");
    // A key's Technical check disclosure is a touch target too: all disclosures share one rule.
    await page.evaluate(() => {
      location.hash = "#/keys";
    });
    await openDevelopmentKey();
    await expectMinTarget(
      page.locator("summary").filter({ hasText: /^Technical check/ }),
      36,
      "The Technical check disclosure",
    );
    await page.evaluate(() => {
      location.hash = "#/models";
    });
    await page.setViewportSize({ width: 1440, height: 950 });
  });

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

  await test.step("large catalogs remain reachable and metadata failure keeps model editing", async () => {
    const stress = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    await skipTour(stress);
    stress.setDefaultTimeout(10_000);
    stress.on("pageerror", e => errors.push(e.message));
    const catalog = await api("catalog");
    // qa-1 shares qa-0's display name: their card actions must still be told apart.
    const models = Array.from({ length: 65 }, (_, i) => ({
      ...structuredClone(workspace.data.models[0]),
      id: `qa-${i}`,
      name: `QA Model ${i === 1 ? 0 : i}`,
      accesses: [
        {
          provider: "synthetic-provider",
          id: `synthetic-provider/qa-${i}`,
          nativeModel: `qa-${i}`,
          status: "Configured",
          route: "Direct provider",
        },
      ],
    }));
    const large = { ...workspace, data: { ...workspace.data, models }, discovery: [] };
    const references = models.map(m => ({
      ...structuredClone(catalog.references[0]),
      id: `fixture/${m.id}`,
      fields: { name: { value: m.name, source: "fixture", kind: "declared" } },
    }));
    const accesses = models.map(m => ({
      id: `synthetic-provider/${m.id}`,
      provider: "synthetic-provider",
      model: m.id,
      referenceId: `fixture/${m.id}`,
      configured: true,
      fields: {},
      overrides: {},
    }));
    await stress.route("**/api/workspace", r => r.fulfill({ json: large }));
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    await stress.route("**/api/catalog", async r => {
      await held;
      await r.fulfill({ json: { ...catalog, references, accesses } });
    });
    await stress.goto("/");
    await expect(
      stress.getByRole("status", { name: "Loading model cards…" }),
      "A skeleton holds the place of the cards",
    ).toBeVisible();
    const registry = stress.getByRole("radio", { name: /^In Registry/ });
    await expect(registry, "The saved-card count does not wait for the catalogue").toHaveAccessibleName(
      "In Registry (65)",
    );
    release();
    await stress.getByRole("button", { name: /Show more/ }).waitFor();
    await expect(registry).toHaveAccessibleName("In Registry (65)");
    await stress.getByRole("button", { name: /Show more/ }).click();
    await expect(stress.getByRole("button", { name: /^Open .* details$/ })).toHaveCount(65);
    const shared = await cardActions(stress);
    expect(shared).toEqual(
      expect.arrayContaining(["Open QA Model 0 (qa-0) details", "Open QA Model 0 (qa-1) details"]),
    );
    expect(duplicates(shared), "Cards sharing a display name").toEqual([]);
    await stress.getByRole("link", { name: "Settings", exact: true }).click();
    await stress.getByRole("button", { name: "Open catalog data", exact: true }).click();
    await stress.getByRole("button", { name: /Show more/ }).click();
    await stress.getByText("Showing 65 of 65 matching entries.", { exact: false }).waitFor();
    await stress.unroute("**/api/catalog");
    await stress.route("**/api/catalog", r =>
      r.fulfill({ status: 503, json: { error: "Synthetic metadata offline" } }),
    );
    await stress.getByRole("link", { name: "My models", exact: true }).click();
    await stress.reload(); // the catalogue is read once per revision: a failure shows on the next load
    await stress.getByText(/Model details unavailable/).waitFor();
    const fallback = await cardActions(stress);
    expect(fallback).toEqual(expect.arrayContaining(["View details · QA Model 0 (qa-1)"]));
    expect(duplicates(fallback), "Fallback cards sharing a display name").toEqual([]);
    await stress
      .getByRole("button", { name: /^View details/ })
      .first()
      .click();
    await stress.locator('[data-slot="sheet-content"]').getByRole("button", { name: "Edit", exact: true }).waitFor(); // read-first; was Save model
    await stress.close();
  });

  await test.step("no browser JavaScript errors", async () => {
    expect(errors).toEqual([]);
  });
});
