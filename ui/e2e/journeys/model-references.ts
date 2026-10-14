import type { Locator } from "@playwright/test";
import { expect, test, token } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function modelReferenceJourneys({
  button,
  page,
  sheet,
  closeSheet,
  scope,
  searchModels,
  nav,
  keyCard,
  setExpert,
  api,
  sweepCardTabs,
  shot,
  headers,
  groupModels,
}: JourneyContext) {
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

  await test.step("cards without a reference: inferred creator, override, clear, Associate a datasheet", async () => {
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
      await expect(card(name).locator("[data-attention]")).toHaveText(["no datasheet", "inferred creator"]);
      await expect(card(name).getByText(unknownFacts, { exact: true })).toBeVisible();
      await expect(card(name).getByText("? → ?")).toHaveCount(0);
      const associate = card(name).getByRole("button", { name: `Associate a datasheet · ${name}`, exact: true });
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
    await expect(card("QA Shared").locator("[data-attention]")).toHaveText(["no datasheet"]);
    await expect(card("QA Opus").locator("[data-attention]")).toHaveText(["+1 available"]);
    await expect(card("QA Opus").getByRole("button", { name: /^Associate a datasheet/ })).toHaveCount(0);
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
    await expect(card("qa-codex-mini").locator("[data-attention]")).toHaveText(["no datasheet"]);
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
    await card("qa-flash").getByRole("button", { name: "Associate a datasheet · qa-flash", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Associate a datasheet" });
    const search = dialog.getByRole("textbox", { name: "Search datasheets", exact: true });
    await expect(search).toHaveValue("qa-flash"); // starts from the native name
    await expect(dialog.getByText("No datasheet matches. Try fewer words.")).toBeVisible();
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
    await expect(flash.getByRole("button", { name: /^Associate a datasheet/ })).toHaveCount(0);
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
    await expect(card("qa-flash").locator("[data-attention]")).toHaveText(["no datasheet", "inferred creator"]);
    await expect(card("qa-codex-mini").locator("[data-attention]")).toHaveText(["no datasheet", "inferred creator"]);
  });
}
