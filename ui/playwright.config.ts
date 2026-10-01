import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import type { Options } from './e2e/fixtures';

const url = 'http://127.0.0.1:4174';

// The synthetic fixture is destructive and listens on a fixed port, so the journeys and the
// screenshots are two configs run as two invocations: each one starts a fresh fixture.
export const e2e = (suite: string): PlaywrightTestConfig<Options> => ({
  testDir: './e2e',
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  expect: { timeout: 10_000 },
  outputDir: `../dist/checks/e2e/${suite}/results`,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never', outputFolder: `../dist/checks/e2e/${suite}/report` }]]
    : 'list',
  use: {
    baseURL: url,
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1440, height: 950 },
    actionTimeout: 10_000,
    trace: 'on-first-retry',
  },
  webServer: {
    // The fixture reads ui/dist and writes dist/checks relative to the repository root, and
    // exec makes it the process Playwright signals (go run would swallow the SIGTERM).
    command: 'go build -o dist/checks/ui-fixture ./tests/ui-fixture && exec dist/checks/ui-fixture',
    cwd: '..',
    url,
    timeout: 120_000,
    stdout: 'pipe',
    gracefulShutdown: { signal: 'SIGTERM', timeout: 5_000 }, // lets the fixture remove its temp registry
  },
});

const base = e2e('journeys');

export default defineConfig<Options>({
  ...base,
  testMatch: 'journeys.spec.ts',
  timeout: 180_000, // one test, many steps
  // The journeys mutate the fixture: a retry would start from the state the failed run left.
  retries: 0,
  use: { ...base.use, trace: 'retain-on-failure' },
});
