import { expect, test as base } from '@playwright/test';

export type Options = { language: 'en' | 'fr' };

export const token = process.env.QA_FIXTURE_ADMIN_TOKEN || 'qa-fixture-admin-token-only-1234567890';

// The app takes its language from ?lang=, so Playwright's `locale` does not drive it: this option
// does. Time is frozen for any new Date(). `pageErrors` collects uncaught page errors from before
// the first navigation, so load-time errors are not missed.
export const test = base.extend<Options & { pageErrors: string[] }>({
  language: ['en', { option: true }],
  pageErrors: async ({}, use) => use([]),
  page: async ({ page, language, pageErrors }, use) => {
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-09-25T12:00:00Z'));
    await page.goto(`/?lang=${language}`);
    await use(page);
  },
});

export { expect };
