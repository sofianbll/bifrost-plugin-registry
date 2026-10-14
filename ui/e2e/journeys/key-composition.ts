import type { Route } from "@playwright/test";
import { expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function keyCompositionJourneys({
  nav,
  keyCard,
  openDevelopmentKey,
  page,
  button,
  editSelection,
  composerStep,
  keyChanges,
  api,
  shot,
  keyHeading,
  keyAction,
}: JourneyContext) {
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
    // Critique round 5 and #110: opening the page reads what Bifrost lists for the key (a read, not a write), so
    // the headline is already checked; the check button lives in the fold, named "Check again".
    const ledger = page.getByRole("region", { name: "This key can call 2 models", exact: true });
    await expect(ledger.getByRole("listitem")).toHaveCount(2);
    await expect(ledger).toContainText("via Synthetic Provider");
    await expect(ledger.getByText(/^Bifrost allows today · /)).toBeHidden();
    await expect(ledger.getByText(/^Technical check · Verified /)).toBeVisible();
    await ledger.getByText(/^Technical check/).click();
    await expect(ledger.getByText(/^Bifrost allows today · /)).toBeVisible();
    // One check button, checking again: not duplicated, never "Read again".
    await expect(ledger.getByRole("button", { name: /^Check/ })).toHaveText(["Check again"]);
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
    await expect(page.getByText("Unpublished draft", { exact: true }), "No draft changes on opening").toHaveCount(0);
    await expect(keyChanges()).toContainText("No change.");
    await composerStep("Models").click();
    await page.getByRole("checkbox", { name: "Exclude from this key: QA Code", exact: true }).click();
    await composerStep("Review").click();
    await page.getByRole("heading", { name: "Local exclusions" }).waitFor();
    // #69: Review diffs the draft against a labelled baseline; #110: the page already read the key back on open.
    await expect(keyChanges().getByText("Compared with what Bifrost last confirmed", { exact: true })).toBeVisible();
    await expect(keyChanges().getByRole("list", { name: "Will lose" })).toContainText("synthetic-provider/qa-code");
    await expect(keyChanges().getByRole("list", { name: "Will gain" })).toHaveCount(0);
    await button("Publish changes").click();
    // #110: "Verified" alone already shows on the auto-checked page; the publish toast is the fresh signal.
    await page.getByText("Published and verified with Bifrost.", { exact: true }).waitFor();
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
}

export async function keyCreationJourneys({ button, page }: JourneyContext) {
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
    // "Required" is a neutral hint until the name is left empty, as in the group sheet.
    const keyName = page.getByLabel("Key name", { exact: true });
    await expect(keyName).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("dialog").getByText("Required", { exact: true })).not.toHaveClass(/destructive/);
    await page.getByLabel("Client name", { exact: true }).click(); // leaves the empty name
    await expect(keyName).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("dialog").getByText("Enter a key name.", { exact: true })).toBeVisible();
    await keyName.fill("QA Browser Key");
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
}

export async function readbackFailureJourney({
  page,
  nav,
  keyCard,
  editSelection,
  composerStep,
  button,
}: JourneyContext) {
  await test.step("a check that fails after publishing names the key, not its id", async () => {
    // Bifrost cannot be reached for the check that follows a publish: the warning says which key, by its name.
    const unreachable = (route: Route) => route.fulfill({ status: 502, json: { error: "Bifrost unreachable" } });
    await page.route("**/api/keys/vk-qa-kept/readback", unreachable);
    await nav("Virtual keys").click();
    await keyCard("QA Kept Key").getByRole("button", { name: "Open · QA Kept Key", exact: true }).click();
    await editSelection();
    await page.getByRole("checkbox", { name: "Add to this key: QA Haiku", exact: true }).click();
    await composerStep("Review").click();
    await button("Publish changes").click();
    await expect(page.getByText("QA Kept Key: Bifrost unreachable", { exact: true })).toBeVisible();
    await expect(page.getByText(/vk-qa-kept:/)).toHaveCount(0);
    // Put the key back as it was, then check once Bifrost answers again.
    await page.getByRole("button", { name: "Remove QA Haiku from this key", exact: true }).click();
    await button("Publish changes").click();
    await expect(button("Publish changes")).toBeDisabled();
    await page.unroute("**/api/keys/vk-qa-kept/readback", unreachable);
    await button("Check again").click();
    await expect(page.getByText("Verified · 1 difference", { exact: true })).toBeVisible();
    await button("All virtual keys").click();
  });
}
