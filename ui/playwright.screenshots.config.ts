import { defineConfig } from '@playwright/test';
import { e2e } from './playwright.config';
import type { Options } from './e2e/fixtures';

const base = e2e('screenshots');

// The baselines are the images the READMEs embed (docs/images/{en,fr}, no platform suffix), so only
// Linux may compare or rewrite them: the e2e workflow or a Linux container (docs/images/README.md).
if (process.platform !== 'linux') throw new Error(`docs/images baselines are Linux-only; this host is ${process.platform}. Run the E2E workflow or a Linux container.`);

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
