import { defineConfig } from '@playwright/test';
import { e2e } from './playwright.config';
import type { Options } from './e2e/fixtures';

const base = e2e('screenshots');

// The baselines are the images the READMEs embed, so they live in docs/images/{en,fr} and carry
// no platform suffix: generate them on Linux only (the e2e workflow does, see docs/images/README.md).
export default defineConfig<Options>({
  ...base,
  testMatch: 'screenshots.spec.ts',
  use: { ...base.use, viewport: { width: 1440, height: 900 } },
  expect: {
    ...base.expect,
    // Runs are bit-identical on one host; the slack only absorbs anti-aliasing noise between hosts,
    // while a changed label (hundreds of pixels) still fails.
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixels: 100 },
  },
  projects: (['en', 'fr'] as const).map(language => ({
    name: language,
    use: { language },
    snapshotPathTemplate: `../docs/images/${language}/{arg}{ext}`,
  })),
});
