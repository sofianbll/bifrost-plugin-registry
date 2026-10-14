import { expect, test, expectNoBasicJargon } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function modelRegistrationJourneys({
  scope,
  button,
  cardSteps,
  sheet,
  page,
  searchModels,
}: JourneyContext) {
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
    // An emptied display name is a prompt until the field is left; it reads as an error only then.
    const displayName = sheet().getByRole("textbox", { name: "Display name *", exact: true });
    await displayName.fill("");
    await expect(displayName).not.toHaveAttribute("aria-invalid", "true");
    await displayName.blur();
    await expect(displayName).toHaveAttribute("aria-invalid", "true");
    await displayName.fill("QA Unregistered");
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
}

export async function decisionsModelJourney({ scope, searchModels, button, page, sheet, setExpert }: JourneyContext) {
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
}

export async function customProviderJourney({ button, sheet, page, withinViewport, shot, scope }: JourneyContext) {
  await test.step("custom provider derives exposed ID and validation stays beside Save", async () => {
    // "Add model > Advanced: custom model" is now "Register a model > Advanced: enter an access
    // manually"; the access form keeps its Save action (Keep changes) disabled beside the error.
    await button("Register a model").click();
    await button("Advanced: enter an access manually").click();
    // Nothing is typed yet: what is missing is a prompt, not an error; once something is typed, it is one.
    const missing = sheet().getByText(
      "Choose a valid call name and at least one complete access to prepare the card.",
      {
        exact: true,
      },
    );
    await expect(missing).not.toHaveClass(/destructive/);
    await page.getByRole("combobox", { name: "Search a model or enter its ID *", exact: true }).fill("qa-custom");
    await expect(missing).toHaveClass(/destructive/);
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
}
