import type { Page } from "@playwright/test";
import { expect, test as base } from "@playwright/test";

export type Options = { language: "en" | "fr"; tourSeen: boolean };

export const token = process.env.QA_FIXTURE_ADMIN_TOKEN || "qa-fixture-admin-token-only-1234567890";

// The guided tour is offered once per browser (localStorage). A browser context starts empty, so
// every page would be offered it: mark it seen before the first navigation, except where the
// first visit itself is under test (`tourSeen: false`).
export const skipTour = (page: Page) =>
  page.addInitScript(() => {
    try {
      localStorage.setItem("bifrost-registry.tour.v1", "1");
    } catch {
      /* the app then offers nothing either */
    }
  });

// The app takes its language from ?lang=, so Playwright's `locale` does not drive it: this option
// does. Time is frozen for any new Date(). `pageErrors` collects uncaught page errors from before
// the first navigation, so load-time errors are not missed.
export const test = base.extend<Options & { pageErrors: string[] }>({
  language: ["en", { option: true }],
  tourSeen: [true, { option: true }],
  pageErrors: async ({}, use) => use([]),
  page: async ({ page, language, tourSeen, pageErrors }, use) => {
    page.on("pageerror", e => pageErrors.push(e.message));
    if (tourSeen) await skipTour(page);
    await page.clock.setFixedTime(new Date("2026-09-25T12:00:00Z"));
    await page.goto(`/?lang=${language}`);
    await use(page);
  },
});

// Words Basic must never show (PRODUCT.md: identifiers and endpoint names belong to Expert and folded technical
// details). One list, so a term another view leaks is added here once and every Basic step then checks it.
export const BASIC_FORBIDDEN_TERMS = [
  "Common model ID",
  "Family:",
  "Documentary record",
  "Mapping chosen in Registry",
  "Document ID",
  "Registry ID",
  "chat/completions",
  "/v1/",
  "Review binding",
  "Readback",
] as const;

// Fails when the visible text of the page (a closed fold shows none) holds a forbidden term. Call it in Basic
// steps only: it refuses to run with the Expert switch on.
export const expectNoBasicJargon = async (page: Page, where = "") => {
  const expert = page.locator("#expert-mode");
  if (await expert.count()) expect(await expert.getAttribute("aria-checked"), "Basic is on").not.toBe("true");
  const text = await page.evaluate(() => document.body.innerText);
  expect(
    BASIC_FORBIDDEN_TERMS.filter(term => text.includes(term)),
    `Basic shows no technical term${where ? ` (${where})` : ""}`,
  ).toEqual([]);
};

export { expect };
