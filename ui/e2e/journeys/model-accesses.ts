import type { Locator } from "@playwright/test";
import { expect, skipTour, test, expectNoBasicJargon } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function accessRemovalJourney({
  api,
  page,
  sheet,
  button,
  closeSheet,
  shot,
}: Pick<JourneyContext, "api" | "page" | "sheet" | "button" | "closeSheet" | "shot">) {
  await test.step("access settings stage removal without retargeting; Cancel and Keep preserve access identities", async () => {
    const original = (await api("workspace")).data.models.find((model: { id: string }) => model.id === "qa-shared");
    const open = async () => {
      await button("Open QA Shared details").first().click();
      await sheet().getByRole("tab", { name: "Access", exact: true }).click();
      await button("Edit accesses").click();
    };
    const dialog = page.getByRole("dialog", { name: "Edit provider access", exact: true });
    for (const index of [1, 0]) {
      if (index === 0) await page.setViewportSize({ width: 375, height: 812 });
      await open();
      const access = original.accesses[index];
      const opener = sheet().getByRole("button", { name: `Access settings for ${access.provider}`, exact: true });
      await opener.click();
      await dialog.getByRole("button", { name: "Remove access", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(dialog.getByRole("button", { name: "Keep changes", exact: true })).toBeEnabled();
      await expect(dialog.getByRole("button", { name: "Keep changes", exact: true })).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await shot(`access-removal-${index === 0 ? "mobile" : "desktop"}`);
      await expect(
        dialog.getByRole("combobox", { name: "Access status", exact: true }),
        "no remaining access becomes the edit target",
      ).toHaveCount(0);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(opener).toBeFocused();
      await button("Review").click();
      await expect(button("Save model")).toBeDisabled();
      await button("Back").click();
      await sheet().getByRole("button", { name: "1. Accesses", exact: true }).click();
      await opener.click();
      await dialog.getByRole("button", { name: "Remove access", exact: true }).click();
      await expect(dialog.getByRole("button", { name: "Keep changes", exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeHidden();
      expect(
        await sheet().evaluate(el => el.contains(document.activeElement)),
        "focus returns to the editor after its opener is removed",
      ).toBe(true);
      const remaining = original.accesses[1 - index];
      await sheet()
        .getByRole("button", { name: `Access settings for ${remaining.provider}`, exact: true })
        .click();
      await expect(dialog.getByRole("button", { name: "Remove access", exact: true })).toBeDisabled();
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      await button("Review").click();
      await expect(sheet().getByText(`Access removed: ${access.provider}`, { exact: true })).toBeVisible();
      if (index === 1) {
        const write = page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/workspace"));
        await button("Save model").click();
        expect(
          (await write).postDataJSON().data.models.find((model: { id: string }) => model.id === "qa-shared").accesses,
        ).toEqual([remaining]);
        await sheet().waitFor({ state: "hidden" });
        expect(
          (await api("workspace")).data.models.find((model: { id: string }) => model.id === "qa-shared").accesses,
        ).toEqual([remaining]);
        // Restore the synthetic fixture through the same editor for the following journeys.
        await open();
        await sheet()
          .getByRole("button", { name: new RegExp(`^Add ${access.provider}`) })
          .click();
        await button("Review").click();
        await button("Save model").click();
        await sheet().waitFor({ state: "hidden" });
      } else {
        await button("Cancel").click();
        await button("Discard draft").click();
        await closeSheet();
        await sheet().waitFor({ state: "hidden" });
      }
    }
    await page.setViewportSize({ width: 1440, height: 950 });
  });
}

export async function addToCardJourney({
  sheet,
  page,
  scope,
  searchModels,
  button,
  closeSheet,
  baseURL,
  browser,
  errors,
  api,
  workspace,
}: JourneyContext) {
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
}

export async function modelAccessJourneys({
  api,
  page,
  button,
  sheet,
  closeSheet,
  setExpert,
  sweepCardTabs,
  baseURL,
  browser,
  errors,
  shot,
}: JourneyContext) {
  await accessRemovalJourney({ api, page, sheet, button, closeSheet, shot });
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
    await expect(
      part(sheet(), /^Also available/),
      "#110: Basic names an offered access by its provider, not the raw native ID",
    ).not.toContainText("anthropic/qa-opus");
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
        await expect(sheet().getByText("Datasheet", { exact: true }).first(), "Basic says datasheet").toBeVisible();
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
    await expect(dialog.getByRole("combobox", { name: "Datasheet for this access", exact: true })).toBeVisible();
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
}
