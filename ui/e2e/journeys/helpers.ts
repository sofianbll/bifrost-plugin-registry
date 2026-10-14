import type { Browser, Locator, Page, TestInfo } from "@playwright/test";
import { expect, expectNoBasicJargon, token } from "../fixtures";

export async function createJourneyContext(
  { page, browser, baseURL, errors }: { page: Page; browser: Browser; baseURL: string | undefined; errors: string[] },
  testInfo: TestInfo,
) {
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

  // A target is at least `min` px wide and high (WCAG 2.5.8: 24 px; the named phone controls 36 px).
  const expectMinTarget = async (target: Locator, min: number, label = "") => {
    const box = (await target.boundingBox())!;
    expect(box, `${label} is on the page`).not.toBeNull();
    expect([box.width >= min, box.height >= min], `${label} is at least ${min} px: ${JSON.stringify(box)}`).toEqual([
      true,
      true,
    ]);
  };

  const workspace = await api("workspace");
  expect(workspace.connection.version, "This destructive QA is restricted to the synthetic fixture").toBe(
    "2.2.6-fixture",
  );

  return {
    page,
    browser,
    baseURL,
    errors,
    testInfo,
    headers,
    api,
    catalogReads,
    button,
    scope,
    searchModels,
    nav,
    sheet,
    closeSheet,
    cardSteps,
    keyCard,
    emptyShelf,
    keyFilters,
    composerStep,
    keyHeading,
    keyChanges,
    editSelection,
    keyAction,
    openDevelopmentKey,
    shot,
    cardActions,
    duplicates,
    groupModels,
    expertSwitch,
    setExpert,
    sweepCardTabs,
    withinViewport,
    expectMinTarget,
    workspace,
  };
}

export type JourneyContext = Awaited<ReturnType<typeof createJourneyContext>>;
