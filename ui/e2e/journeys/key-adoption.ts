import { expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function keyAdoptionPreviewJourneys({
  button,
  emptyShelf,
  keyCard,
  page,
  keyFilters,
  shot,
  scope,
  groupModels,
  nav,
  editSelection,
  composerStep,
  keyChanges,
  api,
}: JourneyContext) {
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
      ["QA Disabled Key", "Blocked", "Cannot be adopted as is"],
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
      "See what blocks it · QA Disabled Key",
      "See what blocks it · QA Hermes Key",
      "See what blocks it · QA Kept Key",
      "See what blocks it · QA Mistral Key",
      "See what blocks it · QA To Add Key",
      "See what blocks it · QA Wildcard Key",
      "Open · QA Unmanaged Key",
    ]);
    await page.getByRole("button", { name: "Empty 1", exact: true }).click();
    await expect(page.getByText("13 of 13 keys shown, 1 in a collapsed shelf", { exact: true })).toBeVisible();
    await emptyShelf();
    // The Keys page triages by readiness; managed keys are their own bucket. Basic keeps the filters in "Filters".
    const readiness = page.getByRole("combobox", { name: "Filter by readiness", exact: true });
    await keyFilters();
    await readiness.click();
    await expect(page.getByRole("option")).toHaveText([
      "All adoption states",
      "Ready to adopt (2)",
      "Blocked (8)",
      "Empty (1)",
      "Managed (2)",
    ]);
    await page.getByRole("option", { name: "Blocked (8)", exact: true }).click();
    await expect(page.getByText("8 of 13 keys shown", { exact: true })).toBeVisible();
    await expect(keyCard("QA Mistral Key")).toHaveCount(1);
    await expect(keyCard("QA Codex Key")).toHaveCount(0);
    await keyFilters();
    await readiness.click();
    await page.getByRole("option", { name: "Ready to adopt (2)", exact: true }).click();
    await expect(page.getByText("2 of 13 keys shown", { exact: true })).toBeVisible();
    await expect(keyCard("QA Google Key")).toHaveCount(1);
    await keyFilters();
    await readiness.click();
    await page.getByRole("option", { name: "Empty (1)", exact: true }).click();
    await expect(keyCard("QA Unmanaged Key")).toHaveCount(1);
    await expect(page.getByText("1 of 13 keys shown", { exact: true })).toBeVisible();
    await keyFilters();
    await readiness.click();
    await page.getByRole("option", { name: "All adoption states", exact: true }).click();
    await expect(page.getByText("13 of 13 keys shown", { exact: true })).toBeVisible();
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

    // Final critique, P1: a key disabled or expired in Bifrost has no choice to make, so it is no decision.
    // The fixture carries one (vk-qa-disabled, #110): the journey is real, no mocked preview.
    await button("All virtual keys").click();
    await keyCard("QA Disabled Key")
      .getByRole("button", { name: "See what blocks it · QA Disabled Key", exact: true })
      .click();
    await button("Adopt this key").click();
    const before = dialog.getByRole("region", { name: "Before adopting", exact: true });
    await expect(before.getByRole("heading", { name: "Nothing to decide yet", exact: true })).toBeVisible();
    await expect(before).toContainText("This key is disabled or expired in Bifrost.");
    await expect(before).toContainText("Enable or renew this key in Bifrost, then press Refresh preview.");
    // No count of decisions anywhere, no numbered list, no button that would settle it; the footer says why Adopt is off.
    await expect(dialog).not.toContainText("decision");
    await expect(dialog).not.toContainText("decided");
    await expect(dialog.locator("ol")).toHaveCount(0);
    await expect(before.getByRole("button")).toHaveCount(0);
    await expect(dialog.getByText("Enable or renew the key in Bifrost first", { exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
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
}

export async function keptProviderJourneys({
  nav,
  keyCard,
  button,
  page,
  shot,
  editSelection,
  composerStep,
  api,
  keyChanges,
}: JourneyContext) {
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
    // #110: the page already checked the key with Bifrost on open.
    const ledger = page.getByRole("region", { name: /^This key can call/ });
    await expect(ledger).toHaveAccessibleName("This key can call 6 models");
    await expect(ledger.getByRole("listitem").filter({ hasText: "QA Shared" })).toContainText("via Claude, Codex");
    await expect(ledger.getByRole("listitem").filter({ hasText: "qa-mistral-large" })).toContainText("via Mistral");
    await expect(ledger).toContainText("Kept in Bifrost: Codex, Mistral.");
    await editSelection();
    await composerStep("Review").click();
    await button("Check again").click();
    // #110: the page may already read "Verified" from the check on open; the toast marks this check.
    await page
      .getByText(/^Verified with Bifrost/)
      .first()
      .waitFor();
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
    // Claude allows every model in Bifrost: the total is open ("at least"). #110: the page checked the key
    // with Bifrost as it opened, no click, no fold.
    const ledger = page.getByRole("region", { name: /^This key can call/ });
    await expect(ledger).toHaveAccessibleName("This key can call at least 1 model");
    await expect(ledger.getByRole("listitem").filter({ hasText: "All models Bifrost allows" })).toContainText(
      "via Claude",
    );
    await expect(ledger.getByRole("listitem").filter({ hasText: "via Codex" })).toHaveCount(1);
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
    await page
      .getByText(/^Verified with Bifrost/)
      .first()
      .waitFor();
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
    // #110: opening the page checks the key at once; the kept route Bifrost does not list is the difference (ADR 0001).
    await expect(ledger).toHaveAccessibleName("This key can call 2 models");
    await expect(ledger.getByText(/^Technical check · Verified .* · 1 difference$/)).toBeVisible();
    await ledger.getByText(/^Technical check/).click();
    await expect(ledger.getByRole("button", { name: "Check again", exact: true })).toBeVisible();
    await expect(ledger.getByRole("button", { name: "Check with Bifrost", exact: true })).toHaveCount(0);
    await expect(
      ledger.getByRole("listitem").filter({ hasText: "Google: Bifrost does not list this one" }),
    ).toContainText("qa-ghost");
    await expect(ledger.getByRole("listitem").filter({ hasText: "via Google" })).toHaveCount(1);
    await expect(ledger).toContainText("Kept in Bifrost: Google.");
    // Final critique: the difference explains itself, as a tooltip on the summary and as a hidden sentence it is described by.
    const explanation = "Bifrost confirmed this key. 1 permission kept in Bifrost is not listed by Bifrost.";
    const verdict = ledger.getByText(/^Technical check · Verified .* · 1 difference$/);
    await expect(verdict).toHaveAttribute("title", explanation);
    await expect(verdict).toHaveAccessibleDescription(explanation);
    // A kept route is Bifrost's: Registry's own check still reads verified, with no missing route.
    const key = (await api("workspace")).data.keys.find((k: { id: string }) => k.id === "vk-qa-kept");
    expect(key.publication.state).toBe("verified");
    expect(key.publication.missing).toEqual([]);
    expect(key.publication.actual).not.toContain("Google/qa-ghost");
    // The editor reads the same check as the page, and says why "selected" sits below the page total (ADR 0001).
    await editSelection();
    await composerStep("Review").click();
    await expect(page.getByText("Verified · 1 difference", { exact: true })).toBeVisible();
    await expect(page.getByText("Verified · 1 difference", { exact: true })).toHaveAccessibleDescription(explanation);
    await expect(page.getByText("1 model selected · 0 groups", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "Kept in Bifrost: Google. Registry does not change these permissions; Edit selection counts only the models you choose there.",
        { exact: true },
      ),
    ).toBeVisible();
    await button("All virtual keys").click();
    await expect(keyCard("QA Kept Key")).toContainText("2 models · Verified · 1 difference");
    const chip = keyCard("QA Kept Key").getByText("Verified · 1 difference", { exact: true });
    await expect(chip).toHaveAttribute("title", explanation);
    await expect(chip).toHaveAccessibleDescription(explanation);
  });
}
