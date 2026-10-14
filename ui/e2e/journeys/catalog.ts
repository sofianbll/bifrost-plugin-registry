import type { Locator } from "@playwright/test";
import { expect, test, expectNoBasicJargon, skipTour } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function catalogOverviewJourneys({ page, button, scope, groupModels, searchModels, nav }: JourneyContext) {
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
    await expect(badges("QA Shared")).toHaveText(["no datasheet"]);
    // Their creator is guessed from the single subscription serving them: one more badge.
    for (const name of ["qa-sonnet", "qa-codex-mini", "qa-flash"])
      await expect(badges(name)).toHaveText(["no datasheet", "inferred creator"]);
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
}

export async function catalogBrowsingJourneys({
  nav,
  button,
  sheet,
  closeSheet,
  page,
  catalogReads,
  setExpert,
  scope,
  api,
  baseURL,
  browser,
  errors,
  searchModels,
  cardActions,
  duplicates,
}: JourneyContext) {
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
}
