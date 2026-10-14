import type { Locator, Page } from "@playwright/test";
import { expect, test, token, skipTour } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function responsiveJourneys({
  nav,
  page,
  button,
  sheet,
  withinViewport,
  shot,
  closeSheet,
  setExpert,
  baseURL,
  browser,
  errors,
  api,
  workspace,
  testInfo,
  scope,
  searchModels,
  expectMinTarget,
  openDevelopmentKey,
}: JourneyContext) {
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
    // The width slider and the full-screen toggle only exist from sm up: a phone's sheet already fills the screen.
    await page
      .getByRole("button", { name: /^Open .* details$/ })
      .first()
      .click();
    await expect(sheet()).toBeVisible();
    await expect(sheet().getByRole("button", { name: "Expand panel to full screen", exact: true })).toBeHidden();
    await expect(sheet().getByRole("slider", { name: "Panel width", exact: true })).toBeHidden();
    await page.keyboard.press("Escape");
    await sheet().waitFor({ state: "hidden" });
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
          // The popover pads its content by 16 px: a segment must stay clear of the frame by at least half of it,
          // so a font that renders a pixel wider (Linux in CI) cannot push one out.
          [box.x >= frame.x + 8, box.x + box.width <= frame.x + frame.width - 8],
          `${where}: ${name} lies inside the popover with room to spare ${JSON.stringify({ box, frame })}`,
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
    // Links set in running text are targets too (final fixes): "Advanced: enter an access manually" on To add and each
    // "Change" of a request line in a card's sheet (QA Shared holds a Claude and a Codex access).
    await scope(/^To add/).click();
    await expectMinTarget(button("Advanced: enter an access manually"), 24, "Advanced: enter an access manually");
    await scope(/^In Registry/).click();
    await searchModels().fill("qa-shared");
    await button("Open QA Shared details").first().click();
    await sheet().getByRole("tab", { name: "Access", exact: true }).click();
    await button("Edit accesses").click();
    const changeRequests = sheet().getByRole("button", { name: /^Change requests for / });
    await expect(changeRequests).toHaveCount(2);
    for (const change of await changeRequests.all())
      await expectMinTarget(change, 24, (await change.getAttribute("aria-label")) ?? "Change requests");
    await button("Cancel").click();
    await closeSheet();
    await sheet().waitFor({ state: "hidden" });
    await searchModels().fill("");
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
}
