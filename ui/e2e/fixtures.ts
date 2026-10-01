import { expect, test as base } from '@playwright/test';

export type Options = { language: 'en' | 'fr'; theme: 'light' | 'dark' };

export const token = process.env.QA_FIXTURE_ADMIN_TOKEN || 'qa-fixture-admin-token-only-1234567890';

// The app takes its language from ?lang= and its theme from the html.dark class, so Playwright's
// `locale` and `colorScheme` do not drive it: these options do. Time is frozen for any new Date().
export const test = base.extend<Options>({
  language: ['en', { option: true }],
  theme: ['light', { option: true }],
  page: async ({ page, language, theme }, use) => {
    await page.clock.setFixedTime(new Date('2026-09-25T12:00:00Z'));
    // <html> does not exist yet when init scripts run; the class must be there before React mounts.
    if (theme === 'dark') await page.addInitScript(() => document.addEventListener('readystatechange', () => document.documentElement.classList.add('dark'), { once: true }));
    await page.goto(`/?lang=${language}`);
    await use(page);
  },
});

export { expect };
