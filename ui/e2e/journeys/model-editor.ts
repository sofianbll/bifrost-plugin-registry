import { expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function modelDraftJourney({ button, page, sheet, closeSheet }: JourneyContext) {
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
}

export async function modelEditorJourneys({
  searchModels,
  button,
  sheet,
  page,
  cardSteps,
  scope,
  closeSheet,
}: JourneyContext) {
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
    // #110: the spy syncs on open too — the view shows Accesses, so the active step is 1, not the last clicked.
    await expect(
      sheet().getByRole("navigation", { name: "Steps" }).locator('[aria-current="step"]'),
      "the active step follows the view from the start",
    ).toHaveText(/^1\. /);
    // #101: Review sits far below the top of the one scroll, so the footer button has to bring it into view.
    const reviewHeading = sheet().getByRole("heading", { name: "Review before saving", exact: true });
    await expect(reviewHeading, "the review starts below the first screen").not.toBeInViewport();
    // Final fixes: only the editor's own container scrolls to a step. The sheet shell (overflow hidden) never does, or
    // its Close button and stepper would leave the screen while the footer already shows the next step.
    const journeyScroller = sheet().locator("[data-journey-scroll]");
    const expectShellStill = async (where: string) => {
      // Smooth scrolling is asynchronous: wait until neither the shell nor the editor's container moves any more.
      await page.evaluate(
        () =>
          new Promise<void>(resolve => {
            const tops = () =>
              [...document.querySelectorAll('[data-slot="sheet-content"], [data-journey-scroll]')]
                .map(el => el.scrollTop)
                .join();
            let last = tops();
            let still = 0;
            const frame = () => {
              const now = tops();
              still = now === last ? still + 1 : 0;
              last = now;
              if (still >= 15) resolve();
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          }),
      );
      expect(await sheet().evaluate(el => el.scrollTop), `${where}: the sheet shell never scrolls`).toBe(0);
      await expect(
        sheet().getByRole("button", { name: "Close", exact: true }),
        `${where}: Close stays on screen`,
      ).toBeInViewport({ ratio: 1 });
      await expect(
        sheet().getByRole("navigation", { name: "Steps" }),
        `${where}: the stepper stays on screen`,
      ).toBeInViewport({ ratio: 1 });
    };
    await button("Review").click();
    await expect(reviewHeading, "the footer Review button scrolls to the review").toBeInViewport();
    await expect(reviewHeading, "and moves focus to its heading").toBeFocused();
    await expectShellStill("Edit, Review");
    expect(
      await journeyScroller.evaluate(el => el.scrollTop),
      "the editor's own container did the scrolling",
    ).toBeGreaterThan(0);
    await expect(button("Save model")).toBeDisabled();
    await expect(sheet().getByText("No changes", { exact: true })).toBeVisible();
    // #110: the active step follows the scroll (scroll-spy), and Back brings the previous section into view.
    const steps = sheet().getByRole("navigation", { name: "Steps" });
    await expect(steps.locator('[aria-current="step"]'), "the spy marks Review once it fills the view").toHaveText(
      /^3\. /,
    );
    await button("Back").click();
    await expect(steps.locator('[aria-current="step"]')).toHaveText(/^2\. /);
    await expect(
      sheet().getByRole("textbox", { name: "Display name *", exact: true }),
      "Back reveals Model details",
    ).toBeInViewport();
    await expectShellStill("Edit, Back");
    await journeyScroller.evaluate(el => el.scrollTo({ top: el.scrollHeight }));
    await expect(steps.locator('[aria-current="step"]'), "a plain scroll moves the active step too").toHaveText(
      /^3\. /,
    );
    await button("Cancel").click();
    await expect(button("Edit")).toBeVisible();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    // Register, Expert: "Next: model details", then Review. The heading reads "Review before registering".
    await scope(/^To add/).click();
    await button("Open QA Unregistered details").click();
    // Playwright scrolls a target it clicks into view, the shell included, so let the sheet finish sliding in first.
    await page.waitForFunction(() => document.getAnimations().length === 0);
    await button("Next: model details").click();
    await button("Review").click();
    const registerReview = sheet().locator("#model-review-heading");
    await expect(registerReview).toContainText("Review before registering");
    await expect(registerReview, "Register: Review brings its heading into view").toBeInViewport();
    await expect(registerReview, "and focuses it").toBeFocused();
    await expectShellStill("Register, Review");
    await expect(button("Register")).toBeVisible();
    await button("Back").click();
    await expect(steps.locator('[aria-current="step"]')).toHaveText(/^2\. /);
    await expectShellStill("Register, Back");
    await button("Cancel").click();
    await sheet().waitFor({ state: "hidden" });
    await scope(/^In Registry/).click();
    await expert.click();
  });
}
