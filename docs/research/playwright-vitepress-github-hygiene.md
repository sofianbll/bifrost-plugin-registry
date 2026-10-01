# Playwright E2E, generated screenshots, VitePress docs site and GitHub hygiene

Research note for `sofianbll/bifrost-plugin-registry`. **Date checked for every source below: 2026-10-01.**

Method: primary sources only (playwright.dev, vitepress.dev, docs.github.com, official action READMEs and source on github.com, the npm registry for versions). Pages were fetched raw and read; no blog or tutorial was used. Nothing in the repository or in GitHub settings was changed; GitHub state was read with `GET` calls through `gh api`. Anything not confirmed by a primary source is tagged **UNCONFIRMED** and collected at the end. Tags: `[Xn]` = source in the index of that section, `[repo]` = observed in this checkout, `[gh-api]` = read-only API call on 2026-10-01.

## 0. Repository facts the answers depend on

- `[repo]` CI is `.github/workflows/ci.yml`: jobs `go`, `ui`, `scripts`; actions pinned to full SHAs; `permissions: contents: read`; `persist-credentials: false`; concurrency cancel. No e2e job, no Pages, no CodeQL, no `dependabot.yml`, no `CODEOWNERS`, no `release.yml`.
- `[repo]` `tests/ux_journeys.cjs` (253 lines) uses the `playwright` **library** with a home-made `check()` runner: 17 `check()` blocks plus a final "no JavaScript errors" assertion (= the 18/18 in `STATUS.md`). One shared page, stateful and destructive, hard-coded `http://127.0.0.1:4174`, run by hand against `go run ./tests/ui-fixture`. It is not wired to CI or the Makefile.
- `[repo]` `tests/browser_smoke.py` (144 lines, Python Playwright) drives the legacy embedded UI (`internal/admin/web`, ids `#admin-token`, `#login-form`) and is referenced by no workflow, Makefile or doc. Probably stale (UNCONFIRMED).
- `[repo]` Fixture `tests/ui-fixture/main.go`: listens on a **hard-coded** `127.0.0.1:4174`; seed data and registry live in memory/temp dir and are fresh at every start; admin token is a public QA constant (env override `QA_FIXTURE_ADMIN_TOKEN`); serves `ui/dist` from disk (not embedded), so `npm --prefix ui run build` must run first; traps SIGINT/SIGTERM and removes its temp dir on exit.
- `[repo]` UI levers for determinism: language comes from `?lang=fr|en` (`ui/src/app/App.tsx:505`), **not** from `navigator.language`; theme is the `dark` class on `<html>`, initialised from the class and flipped by a button (`App.tsx:134-135`), **not** from `prefers-color-scheme`; some dates use `toLocaleString()` with no locale (`ReferenceCatalogBrowser.tsx:24`, `Laboratory.tsx`), others with explicit `fr-FR`/`en-US`; `new Date()` is used at `App.tsx:232`; fonts are self-hosted Geist woff2 with `font-display: swap` (`ui/src/globals.css`).
- `[repo]` Docs: 9 files / 623 lines in `docs/*.md`, one language per file (English, except `RELEASE.md` in French); 40 Markdown files under `docs/` once `design/`, `reviews/`, `archive/`, `agents/` are counted. User docs link outside `docs/` (`../STATUS.md`, `../reports/**`, `../configs/**`). Screenshots: six PNG per language in `docs/images/{en,fr}/` (1.7 MB total), used by `README.md` / `README.fr.md`.
- `[gh-api]` Repo is public, MIT, owned by a personal account. No rulesets; `main` not protected; all three merge methods allowed. Private vulnerability reporting: **enabled**. CodeQL default setup: `not-configured` (detected languages: actions, go, javascript-typescript, python). Secret scanning, push protection, Dependabot security updates: `disabled`; `GET /vulnerability-alerts` returns 404 (documented as "not enabled" [D22]). Pages: not configured. Actions: default token `read`, `can_approve_pull_request_reviews: false`, `sha_pinning_required: false`.

---

## A. Playwright E2E in CI against the local fixture server

Sources: [A1] https://playwright.dev/docs/ci-intro · [A2] https://playwright.dev/docs/ci · [A3] https://playwright.dev/docs/best-practices · [A4] https://playwright.dev/docs/test-sharding · [A5] https://playwright.dev/docs/test-retries · [A6] https://playwright.dev/docs/trace-viewer-intro · [A7] https://playwright.dev/docs/api/class-testoptions · [A8] https://playwright.dev/docs/api/class-testconfig · [A9] https://playwright.dev/docs/test-webserver · [A10] https://playwright.dev/docs/test-projects · [A11] https://playwright.dev/docs/test-parameterize · [A12] https://playwright.dev/docs/emulation · [A13] https://playwright.dev/docs/library · [A14] https://playwright.dev/docs/browsers · [A15] https://playwright.dev/docs/intro · [A16] https://playwright.dev/docs/release-notes · [A17] https://registry.npmjs.org/@playwright/test · [A18] https://playwright.dev/docs/test-cli · [A19] https://docs.github.com/en/actions/reference/runners/github-hosted-runners · [A20] https://github.com/actions/upload-artifact (README) · [A21] https://playwright.dev/docs/test-parallel · all checked 2026-10-01.

### A.1 Version and platform
- `@playwright/test` `latest` is **1.63.0** (published 2026-09-04); `next` is a 1.64 alpha; `engines.node >= 20` [A17]. The docs list Node latest 22.x/24.x/26.x and Ubuntu 22.04/24.04/26.04 as supported [A15]. The repo's Node 22.23.1 and `ubuntu-24.04` runner are inside that support matrix.
- Public-repo standard Linux runners (`ubuntu-24.04`) have 4 vCPU / 16 GB and are free and unlimited for public repositories [A19].

### A.2 Official GitHub Actions recipe
- Workflow shape: checkout, setup-node, `npm ci`, `npx playwright install --with-deps`, `npx playwright test`, then `actions/upload-artifact` of `playwright-report/` with `if: ${{ !cancelled() }}` and `retention-days: 30` [A1].
- The docs' samples use `checkout@v6` / `upload-artifact@v4`; current releases are checkout v7.0.1, setup-node v7.0.0, upload-artifact v7.0.1 (GitHub releases API, 2026-10-01). The samples lag; the repo already pins newer SHAs.
- Artifacts: names must be unique per run; default retention is 90 days, `retention-days` shortens it [A20]. Playwright warns that traces, HTML reports and logs can contain sensitive data [A1]. Here the token and data are synthetic public constants `[repo]`, but keep that true.

### A.3 Browser install and caching
- Install only what is used: `npx playwright install chromium --with-deps` [A3]. When no `channel` is set, tests run on the separate headless shell and `--only-shell` skips the full Chromium download [A14].
- Caching browser binaries is **not recommended** by Playwright: restore time is comparable to download time and Linux OS dependencies are not cacheable. If cached anyway, key it on the Playwright version [A2].
- Playwright's Docker image `mcr.microsoft.com/playwright:v1.63.0-noble` is the documented containerised option; use `--init` and `--ipc=host` with Chromium [A2][B6].

### A.4 Retries, traces, workers
- Retries default to 0. Docs' default template uses `retries: process.env.CI ? 2 : 0` with `trace: 'on-first-retry'` [A6]. Tests that pass on retry are reported "flaky"; `failOnFlakyTests` (v1.52) / `--fail-on-flaky-tests` turns that into a failure [A5][A8][A18]. `forbidOnly: !!process.env.CI` rejects stray `test.only` [A8].
- Trace modes include `on-first-retry`, `retain-on-failure`, `retain-on-failure-and-retries`; `screenshot: 'only-on-failure'` is separate [A7].
- Workers: Playwright recommends `workers: 1` on CI for stability, and sharding for scale [A2]. Default locally is 50% of cores [A18].
- Failed tests discard the worker and its browser; with retries enabled the retry starts a fresh worker [A5]. Serial groups (`test.describe.configure({ mode: 'serial' })`) retry together, but the docs say isolated tests are usually better [A5].

### A.5 Sharding
- `--shard=x/y` plus a GitHub matrix (`shardIndex`, `shardTotal`), `blob` reporter per shard, then a `merge-reports` job (`needs`, `if: ${{ !cancelled() }}`, `download-artifact` with `merge-multiple`) producing one HTML report [A4]. `fullyParallel: true` balances shards by test, otherwise by file [A4].
- Not warranted here: the whole suite is ~18 sequential journeys on one 4 vCPU runner. Sharding would also need an aggregator job for the ruleset (see D.1).

### A.6 Local server (`webServer`)
- Options: `command`, `url` (ready on 2xx/3xx/400-403), `timeout` (default 60 s), `reuseExistingServer` (docs: `!process.env.CI`), `cwd`, `env`, `stdout` (default `ignore`) / `stderr` (default `pipe`), `wait`, `gracefulShutdown`, array form for several servers [A8][A9].
- Without `gracefulShutdown` the **process group is SIGKILLed**; with `{ signal: 'SIGTERM', timeout: ... }` it gets SIGTERM first [A8]. The fixture traps SIGTERM and cleans its temp dir `[repo]`, so set `gracefulShutdown`. Set `stdout: 'pipe'` on CI to keep fixture logs.
- The server starts once per `playwright test` invocation, so two invocations give two fresh in-memory fixtures (inference from [A9]). Because the fixture port is hard-coded `[repo]` and journeys are destructive, run the journeys and the read-only screenshot projects as **separate invocations**, or add an env override for the listen address (a code change, out of scope here).

### A.7 Projects for viewport / locale / theme
- Documented knobs in `use`: `viewport`, `deviceScaleFactor` (default 1), `locale` (affects `navigator.language`, `Accept-Language`, number/date formatting), `timezoneId` (default: system TZ), `colorScheme`, and a standalone `reducedMotion` (new in 1.63) [A7][A12][A16]. `test.use()` overrides per file or `describe` [A12].
- Custom matrix axes: declare an option fixture (`base.extend({ language: ['en', { option: true }] })`) and set it per project (`use: { language: 'fr' }`) [A11]. Projects also support `testMatch`, `grep`, `retries`, `dependencies`, `teardown`; `--project` selects [A10].
- **Repo-specific:** Playwright's `locale` and `colorScheme` do not drive this app `[repo]`. Make `language` and `theme` option fixtures that navigate with `?lang=` and toggle the `dark` class (button or `classList`), and still pin `locale` + `timezoneId` because some dates use the default locale.
- Proposed matrix (design, not from the docs): `journeys` (1440x950, en, light; the destructive suite; the existing script also switches to 390x844 and to dark mid-run), `docs-en`, `docs-fr` (read-only screenshot specs; `test.use({ viewport: ... })` per view for the 1440 px and 400 px images). Avoid a full viewport x language x theme cross product for journeys.

### A.8 Migrate the `.cjs` / `.py` journeys to `@playwright/test`?
- Playwright states that for end-to-end testing you will normally want `@playwright/test`, not the `playwright` library, which is the automation API without a runner [A13]. `ux_journeys.cjs` re-implements runner features by hand (`check()`, PASS output, failure screenshot, JSON report) `[repo]`; all of them (retries, traces, HTML/GitHub reporters, `webServer`, sharding, snapshot assertions) come with the runner.
- Recommendation: **yes for `ux_journeys.cjs`, staged.** Step 1: port as one `mode: 'serial'` spec (keeps shared-state semantics; retries rerun the whole group [A5]) with `assert` -> `expect`, `check` -> `test.step`, `pageerror` -> an `afterEach`/fixture assertion. Step 2: split into isolated tests as time allows. Keep the `.cjs` until the port matches 18/18, then delete it.
- `browser_smoke.py`: keep out of the migration unless the legacy embedded UI is still shipped (UNCONFIRMED); the Python bindings are a separate package and not part of the `@playwright/test` runner.
- Where to install: `ui/package.json` (already has the lockfile, `npm ci`, Dependabot target) versus a new `e2e/` package. Both work; this is a repo decision, not a docs question. `npm ci` followed by an explicit `npx playwright install` is the documented flow [A1]; whether `npm ci` alone downloads browsers is not stated on the pages read (UNCONFIRMED).

---

## B. Screenshots generated from the E2E run, and drift detection

Sources: [B1] https://playwright.dev/docs/test-snapshots · [B2] https://playwright.dev/docs/api/class-pageassertions · [B3] https://playwright.dev/docs/api/class-page#page-screenshot · [B4] https://playwright.dev/docs/api/class-testproject#test-project-snapshot-path-template · [B5] https://playwright.dev/docs/clock · [B6] https://playwright.dev/docs/docker · [B7] https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow · [B8] https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository · plus [A4][A7][A8][A18]; all checked 2026-10-01.

### B.1 Determinism levers (documented)

| Concern | Mechanism | Notes |
| --- | --- | --- |
| Viewport / DPR | `use.viewport`, `deviceScaleFactor` (default 1); `test.use` per describe [A7][A12] | `page.screenshot` defaults `scale: "device"`, `toHaveScreenshot` defaults `scale: "css"` [B2][B3]. Keep DPR 1 and set `scale` explicitly. |
| Locale | `locale`, `timezoneId` [A7] | Not enough alone: the app reads `?lang=` `[repo]`. |
| Theme | `colorScheme` emulation [A12] | App ignores it `[repo]`; set the class/toggle in the spec. |
| Frozen data | The fixture seed is synthetic and in-memory `[repo]`; mask volatile regions with `mask` / `maskColor`; hide with `stylePath` (`toHaveScreenshot`) or `style` (`page.screenshot`), both pierce Shadow DOM [B2][B3] | Per-start fresh state means screenshot specs must not run after destructive journeys (A.6). |
| Frozen time | `page.clock.setFixedTime(date)` or `page.clock.install({ time })` [B5] | Needed for `new Date()` (`App.tsx:232`) and default-locale date strings. |
| Animations | `toHaveScreenshot` defaults to `animations: "disabled"` and `caret: "hide"`; `page.screenshot` defaults to `animations: "allow"` [B2][B3]. Disabled = finite animations fast-forwarded, infinite ones cancelled. `reducedMotion: 'reduce'` is a separate emulation [A7] | The existing `shot()` already passes `animations:'disabled'` `[repo]`. Docs cover CSS animations/transitions and Web Animations only; timer-driven UI (e.g. toast auto-dismiss) is not covered (UNCONFIRMED for this app). |
| Stability | `toHaveScreenshot` re-captures until two consecutive screenshots match, then compares [B1][B2] | A permanently moving element never settles; mask it. |
| Fonts / OS | Docs warn rendering varies with host OS, version, headless mode, hardware; generate and compare in the same environment; snapshot names carry browser + platform [B1] | Fonts are self-hosted `[repo]`, but anti-aliasing and fallback glyphs (emoji) still vary by OS. Linux CI (or the Docker image [B6]) should be the single generator. |

### B.2 Drift detection: three designs

| Design | How | Pros | Cons |
| --- | --- | --- | --- |
| 1. `toHaveScreenshot` project whose baselines **are** the docs images | `snapshotPathTemplate` / `expect.toHaveScreenshot.pathTemplate` such as `docs/images/{projectName}/{arg}{ext}` with projects named `en` / `fr` [A8][B4]; PR CI sets `updateSnapshots: 'none'`; regenerate with `-u` (no value = `changed`, so only drifted files are rewritten; `all` rewrites everything) [A8][A18] | One source of truth for README, site and test; pixel tolerance (`threshold` default 0.2, `maxDiffPixels`, `maxDiffPixelRatio`, unset by default) [B2]; failure report holds actual/expected/diff (blob/HTML report keeps screenshot diffs [A4]) | Baselines must come from the same OS as CI; a template without `{platform}` means a local macOS run will fail against Linux-made PNGs (this is a feature, but surprising). Tolerance values are a judgment call, not from the docs. |
| 2. Plain `page.screenshot({ path })` project, then `git diff --exit-code docs/images` | Writes files; CI fails if bytes changed | Simple | Byte-identical PNGs across runs/Chromium versions are not guaranteed by the docs (UNCONFIRMED); no tolerance; no diff image. |
| 3. Hybrid (recommended) | Design 1 on pull requests (compare only); a manual `workflow_dispatch` job on `ubuntu-24.04` runs `-u` and uploads `docs/images` as an artifact for a human to commit | Keeps CI read-only and the ruleset intact | One manual hop. |

### B.3 Committing images from CI
- Events raised by `GITHUB_TOKEN` do not start new workflow runs, except PR events, which start runs in an **approval-required** state until a writer approves them [B7]. A bot PR with regenerated images therefore needs a manual approval before its required checks run unless a PAT/GitHub App token is used [B7].
- PR creation by Actions is governed by "Allow GitHub Actions to create and approve pull requests" [B8]; it is currently off `[gh-api]`. A direct push to `main` from CI would also collide with a required-PR ruleset (inference). Hence design 3 (artifact, human PR).

### B.4 Practical consequences
- First Linux regeneration will rewrite all 12 PNGs (they were captured on an unspecified platform; `docs/images/README.md` does not say) `[repo]`. Expect one large binary diff (about 1.7 MB).
- Pin Playwright to an exact version: a Chromium bump can legitimately move pixels (docs warn about version-dependent rendering [B1]). Group Playwright in Dependabot so the bump PR fails visibly and is regenerated deliberately.
- Update `docs/images/README.md` (it documents the manual capture procedure) when the project replaces it.

---

## C. VitePress docs site on GitHub Pages

Sources: [C1] https://vitepress.dev/guide/getting-started · [C2] https://vuejs.github.io/vitepress/v1/guide/getting-started · [C3] https://registry.npmjs.org/vitepress (+ `/2.0.0-alpha.20`, `/1.6.4`) · [C4] https://github.com/vuejs/vitepress/releases and https://github.com/vuejs/vitepress/blob/main/CHANGELOG.md · [C5] https://vitepress.dev/guide/i18n · [C6] https://vitepress.dev/guide/deploy and https://vuejs.github.io/vitepress/v1/guide/deploy · [C7] https://vitepress.dev/reference/default-theme-search · [C8] https://vitepress.dev/guide/asset-handling · [C9] https://vitepress.dev/guide/routing · [C10] https://vitepress.dev/reference/site-config · [C11] https://github.com/vuejs/vitepress/blob/main/src/node/markdownToVue.ts and `.../markdown/plugins/link.ts` · [C12] https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages · [C13] https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits · [C14] https://docs.github.com/en/get-started/learning-about-github/githubs-plans · [C15] https://github.com/actions/upload-pages-artifact (README, `action.yml`, releases) · [C16] https://github.com/actions/deploy-pages (README) · [C17] https://github.com/lycheeverse/lychee-action (README) · [C18] https://vitepress.dev/reference/default-theme-last-updated and https://vitepress.dev/reference/default-theme-edit-link · [C19] https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site; all checked 2026-10-01.

### C.1 Current version (read this before choosing)
- npm `latest` = **1.6.4**, published 2025-08-05, depends on `vite ^5.4.14`. npm `next` = **2.0.0-alpha.20**, published 2026-09-04, depends on `vite ^8.2.1`, `vue ^3.5.41`, `shiki ^4.4.3` [C3].
- The default vitepress.dev docs now describe v2: install is `vitepress@next`, Node.js 22+ required, with a version switcher to 1.6.4 [C1]. The v1 docs live under `/vitepress/v1/` and require Node 18+ [C2]. v2 alphas have shipped roughly monthly since 2025-11; GitHub marks `v2.0.0-alpha.20` as the latest release (not flagged prerelease) [C4]. No stable 2.0 date was found (UNCONFIRMED).
- v2 alphas carry breaking changes (for example `markdown.image.lazyLoading` renamed `lazyLoad` and `cjkFriendly` removed in alpha.19) [C4]. VitePress is ESM-only [C1].
- Repo angle: `ui/` uses Vite 8.0.16 and Node 22.23.1 `[repo]`, which matches v2's requirements, whereas v1.6.4 would pull Vite 5. Either way, keep the site in its own `package.json` (separate lockfile) so the UI's Vite is not constrained, and pin an exact version. Decision for the maintainer: stable-but-old 1.6.4, or alpha.20 aligned with the live docs.

### C.2 i18n (en / fr)
- Layout: root language in `docs/`, other languages in `docs/fr/`; config `locales: { root: { label: 'English', lang: 'en' }, fr: { label: 'Francais', lang: 'fr', link: '/fr/' } }`. Per-locale overrides: `lang`, `dir`, `title`, `titleTemplate`, `description`, `head`, `themeConfig` (shallow-merged, so nav/sidebar/footer go per locale) [C5].
- VitePress does not redirect `/` to a language by default for the "separate directory per locale" layout [C5].
- Local search is localised through `themeConfig.search.options.locales[...].translations` [C7].
- Per-locale Markdown strings (container titles, copy-button text) exist only on the v2 docs page; the v1 i18n page (https://vuejs.github.io/vitepress/v1/guide/i18n, checked 2026-10-01) does not have that section [C5].
- Repo angle `[repo]`: current docs are one language per file, so a French site means writing or mirroring French pages (README.fr.md and `RELEASE.md` already exist). The set to publish is the 9 user/ops pages, not the 40 internal notes.

### C.3 Deploy to GitHub Pages with the official actions
- Official sample (v2 docs [C6]): `on: push: branches: [main]` + `workflow_dispatch`; `permissions: contents: read, pages: write, id-token: write`; `concurrency: group: pages, cancel-in-progress: false`; job `build` = checkout (`fetch-depth: 0`), setup-node (node 24, `cache: npm`), `actions/cache` on `docs/.vitepress/cache`, `actions/configure-pages`, `npm ci`, `npm run docs:build`, `actions/upload-pages-artifact` with `path: docs/.vitepress/dist`; job `deploy` = `needs: build`, `environment: github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`, `actions/deploy-pages`. Repository Settings > Pages > Source must be **GitHub Actions** [C6]. That setting is a manual step; it was not touched.
- The samples reference `checkout@v5`, `configure-pages@v4`, `upload-pages-artifact@v3`, `deploy-pages@v4` [C6]; GitHub's own Pages page references `configure-pages@v5`, `upload-pages-artifact@v4`, `deploy-pages@v4` [C12]; current releases are configure-pages v6.0.0 (2026-03-25), upload-pages-artifact v5.0.0 (2026-04-10), deploy-pages v5.0.1 (2026-09-01) (releases API, 2026-10-01). Pin full SHAs and let Dependabot move them.
- `deploy-pages` needs `pages: write` and `id-token: write` and an `environment`; the artifact must be named `github-pages` and be a single tar under 1 GB recommended (10 GB hard) with no symlinks/hardlinks [C12][C15][C16].
- `upload-pages-artifact` >= v4 excludes dotfiles (`include-hidden-files` input added in v5, default false). `action.yml` runs `tar --directory "$INPUT_PATH" ... --exclude=.[^/]*`, so `path: docs/.vitepress/dist` is not itself excluded; only dotfiles inside the output would be [C15]. VitePress emits none by default (verify on first deploy).
- Cost and limits: Pages is available on public repos with GitHub Free [C12][C14]; standard runners are free for public repos and Pages [D23]. Limits: site <= 1 GB, 10-minute deployment timeout, 100 GB/month soft bandwidth; the 10 builds/hour soft limit does not apply to custom-workflow builds [C13]. A Pages site is public [C19]. Commercial/SaaS use of Pages is disallowed by the usage policy [C13].
- Run the site **build** on every pull request (no `paths:` filter; see D.1) and the **deploy** only on `main`.

### C.4 Base path for a project page
- Default `base` is `/`. For `https://<user>.github.io/<repo>/` set `base: '/<repo>/'` [C6]. Here: `https://sofianbll.github.io/bifrost-plugin-registry/` -> `base: '/bifrost-plugin-registry/'`. A custom domain later returns it to `/`.
- Static assets referenced from Markdown or from `public/` by root-absolute path are rewritten with the base automatically; only dynamically built paths need `withBase` [C8]. Internal Markdown links also get the base [C9]. GitHub Pages serves `/foo` -> `/foo.html`, so `cleanUrls: true` is safe there [C9].
- v2 alpha.20 adds a relocatable `base: './'` mode [C6][C4]; not needed.

### C.5 Built-in local search
- `themeConfig: { search: { provider: 'local' } }` gives in-browser fuzzy full-text search (minisearch); `search: false` frontmatter excludes a page; Algolia and Pagefind-style plugins are alternatives [C7]. No server and no key needed. Search document ids exclude `base` [C7].

### C.6 Referencing generated screenshots
- Recommended: relative URLs (`![x](./images/en/catalogue-grid.png)`); Vite processes them, copies referenced assets with hashed names, inlines images under 4 kB, and never copies unreferenced ones [C8]. Alternatively place files in `public/` and use root-absolute paths [C8].
- Because the images already live in `docs/images/{en,fr}` and `docs/` can be the VitePress root `[repo]`, a page `docs/USER-GUIDE.md` can use `./images/en/...` and the same Markdown renders on GitHub; a French page in `docs/fr/` uses `../images/fr/...`.
- Linked non-image files (PDF, JSON reports) are not treated as assets and are not copied [C8]; link to GitHub blob URLs instead.

### C.7 Link checking
- Builds **fail on dead links by default**; `ignoreDeadLinks` accepts `true`, `'localhostLinks'`, exact strings, RegExp or a function [C10]. Reading the source: collected links are checked against known pages and `public/`; external `https://` URLs are not collected (only `localhost` ones are), and links to non-HTML/MD files are skipped [C11]. So VitePress checks **internal** links only.
- Repo angle `[repo]`: with `srcDir` = `docs/`, links such as `../STATUS.md` or `../SECURITY.md` point outside the source tree and will be reported as dead (inferred from reading [C11]; not run); `../reports/**/*.json` links are skipped because they are not Markdown/HTML. Options: rewrite them to GitHub blob URLs, add an `ignoreDeadLinks` RegExp for `^\.\./`, or use a dedicated site directory containing only the published pages. Use `srcExclude` for `design/**`, `reviews/**`, `archive/**`, `agents/**` [C10].
- External links: `lycheeverse/lychee-action` (latest v2.9.0, 2026-07-09). Its README example runs on a daily schedule and opens an issue; options include `fail`, `args`, caching; a token avoids GitHub API rate limits [C17]. Keep it scheduled and non-required, since external sites flap.
- Optional niceties: `lastUpdated` uses `git log` per file, so checkout needs `fetch-depth: 0`; `editLink.pattern` can point to `https://github.com/sofianbll/bifrost-plugin-registry/edit/main/docs/:path` [C18].

---

## D. GitHub hygiene for a public OSS repo (free tier, minimal config)

Sources: [D1] https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets · [D2] .../managing-rulesets/available-rules-for-rulesets · [D3] .../managing-rulesets/creating-rulesets-for-a-repository · [D4] https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks · [D5] https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/approving-a-pull-request-with-required-reviews · [D6] https://docs.github.com/en/code-security/getting-started/github-security-features · [D7] https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference · [D8] https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates · [D9] https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot · [D10] https://github.com/dependabot/dependabot-core/blob/main/github_actions/lib/dependabot/github_actions/update_checker.rb · [D11] https://docs.github.com/en/code-security/concepts/code-scanning/setup-types · [D12] https://docs.github.com/en/code-security/code-scanning/enabling-code-scanning/configuring-default-setup-for-code-scanning · [D13] https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning · [D14] https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection · [D15] https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/configuring-private-vulnerability-reporting-for-a-repository · [D16] https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository · [D17] https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes · [D18] https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners · [D19] https://github.com/ossf/scorecard-action (README) · [D20] https://github.com/ossf/scorecard/blob/main/docs/checks.md · [D21] https://docs.github.com/en/actions/reference/security/secure-use · [D22] https://docs.github.com/en/rest/repos/repos (check vulnerability alerts) · [D23] https://docs.github.com/en/billing/concepts/product-billing/github-actions; all checked 2026-10-01.

### D.0 Free for public repositories? (summary)

| Feature | Free on public repo? | Current state `[gh-api]` | Source |
| --- | --- | --- | --- |
| Rulesets / protected branches | Yes (rulesets: public repos on Free; protected branches likewise) | none | [D1][D4] |
| Dependabot alerts, security updates, version updates | Yes, all plans | alerts + security updates off; no `dependabot.yml` | [D6] |
| CodeQL code scanning (default setup) | Yes, public repos | not configured | [D6][D12] |
| Secret scanning + push protection | Yes for public repos per feature table; see D.4 for wording gaps | disabled | [D6][D13][D14] |
| Private vulnerability reporting, security policy, advisories | Yes | PVR on; `SECURITY.md` present | [D6][D15][D16] |
| Automatically generated release notes (`release.yml`) | Yes (repo feature) | none | [D17] |
| CODEOWNERS | Yes (code owners can be defined in public repos on GitHub Free) | none | [D18] |
| OpenSSF Scorecard action | Yes, free for public repos | none | [D19] |
| Artifact attestations (optional) | Yes on public repos | none | [D6] |

### D.1 Rulesets / branch protection for `main`
- Rulesets and classic branch protection coexist; all applicable rules apply and the strictest wins; a ruleset has no priority; owner/admin bypass is an explicit **bypass list** (roles, teams, Apps, Dependabot), optionally "for pull requests only" [D1][D3]. The about-rulesets page lists two enforcement statuses, Active and Disabled; an "Evaluate" mode is mentioned only next to metadata restrictions, so its availability on the Free plan is UNCONFIRMED [D1][D3].
- Relevant rules [D2]: restrict deletions and block force pushes (both on by default); require a pull request (approvals optional); require status checks (type the check name; "up to date" is the strict variant and costs extra builds); require linear history (needs squash or rebase merge allowed; all three are allowed now `[gh-api]`).
- Solo-maintainer trap: authors cannot approve their own PR [D5], so requiring >= 1 approval (or code-owner review) deadlocks a single maintainer unless an admin bypass is set. Require a PR with **0** approvals, or add yourself to the bypass list "for pull requests only" [D3].
- Required-check gotchas [D4]: a check must have succeeded in the repository within the last 7 days to be selectable; it must come from an eligible event (`push`, `pull_request`, ...), not `workflow_dispatch`; a required workflow skipped by `paths:`/branch filters stays Pending and blocks merging, so **do not path-filter required workflows**; a job skipped because a `needs` job failed may not block, so use an aggregator job with `if: always()` for matrix/sharded jobs; success includes `skipped`/`neutral`. Required names are the job names (`go`, `ui`, `scripts` today `[repo]`).
- Scorecard's Branch-Protection tiers (3/10 force-push + deletion; 6/10 PR + 1 reviewer; 8/10 status checks; 9/10 two reviewers or code owners; 10/10 admin enforcement) show what a solo repo can and cannot reach [D20].

### D.2 Dependabot (gomod, npm in `ui/`, github-actions)
- Config file `.github/dependabot.yml`, `version: 2`, per ecosystem `package-ecosystem`, `directory` (or `directories`), `schedule.interval` [D7][D8]. Needed entries: `gomod` at `/` (single `go.mod`), `npm` at `/ui` (single `package.json`), `github-actions` at `/` (covers `.github/workflows`) [D9] `[repo]`. A VitePress `package.json` would need a fourth entry. Python scripts have no manifest, so no `pip` entry.
- Noise control: `groups` (per-rule PRs; unmatched deps stay individual), `open-pull-requests-limit` (default 5; not applied to security updates), `cooldown`. A 3-day cooldown applies to version updates **by default** even when unconfigured [D7].
- Default label `dependencies` is created automatically, plus an ecosystem label when several ecosystems are configured [D7]; useful for `release.yml` (D.6).
- Dependabot's handling of actions pinned to commit SHAs with a trailing version comment (as in `ci.yml` `[repo]`) is visible in `dependabot-core` source (it resolves the tag equivalent to a pinned ref and can bump SHA-pinned refs) [D10], but the docs.github.com pages read do not state it (UNCONFIRMED in docs).
- Alerts and security updates are separate switches from `dependabot.yml` and are off now `[gh-api]` [D6].

### D.3 CodeQL default setup (Go, JS/TS)
- Settings > Advanced Security > Code Security > CodeQL analysis > Set up > Default; languages and query suite are auto-chosen and editable; free on public repos; no workflow file is committed [D12].
- Triggers: pushes to the default or protected branches, pull requests against them (fork PRs excluded), and a weekly schedule; the weekly run is disabled after 6 months without pushes/PRs [D11].
- API shows detected languages `actions, go, javascript-typescript, python` for this repo `[gh-api]`. If every language fails analysis, default setup stays enabled but scans nothing [D12]. Build mode for Go under default setup is not stated on the pages read (default setup uses no-build for C/C++, C#, Java, Rust and autobuild where no-build is unsupported) (UNCONFIRMED for Go). The Go code here is one module and `ui/dist` is read at runtime, not embedded `[repo]`, so a plain `go build ./...` has no UI prerequisite.
- Do not make "CodeQL" a required check initially; add it once names appear and are stable (D.1).

### D.4 Secret scanning and push protection
- Docs: secret scanning on public repos "runs automatically for free" [D13]; the feature table lists secret scanning and push protection as available for public repos by default [D6]. The push-protection page says repository push protection is disabled by default and enabled by an admin, and also says it requires GitHub Secret Protection [D14]. `[gh-api]` reports both as `disabled` for this repo. The wording is inconsistent: verify the toggles in Settings > Advanced Security (UNCONFIRMED which switches are available to a personal-account public repo).
- Push protection **for users** is on by default and blocks the user's pushes of detected secrets to public repos [D14]. Repository-level push protection also blocks UI commits, web uploads and API requests; bypass needs write access plus a reason and creates an alert [D14].

### D.5 Private vulnerability reporting and `SECURITY.md`
- PVR toggle: Settings > Advanced Security > Private vulnerability reporting; researchers then see "Report a vulnerability" on the Advisories page; admins are notified if watching all activity or "Security alerts" [D15]. `[gh-api]` shows it already enabled and `SECURITY.md` already links `.../security/advisories/new` `[repo]`. Remaining check: the owner account actually watches the repo with Security alerts so reports are not missed [D15]. A security policy file is free on all plans [D6][D16].

### D.6 `.github/release.yml`
- Keys: `changelog.exclude.labels`, `changelog.exclude.authors`, `changelog.categories[].title`, `.labels` (use `*` as catch-all), per-category `exclude`. The docs' own example separates Dependabot PRs via the `dependencies` label [D17].
- Fit `[gh-api]`: labels `bug`, `enhancement`, `documentation`, `accessibility` already exist; releases so far (`v0.3.0-rc.1` to `rc.4`) carry hand-written titles. The file only shapes GitHub's "Generate release notes" output; it is optional and cheap.

### D.7 CODEOWNERS
- Location `.github/`, repo root or `docs/`; owners need write access; owners are auto-requested on matching PRs (not on drafts); "require code owner review" is an optional rule [D18][D2]. With a single maintainer the file adds little and the required-review variant deadlocks (D.1). Add it when a second maintainer exists; Scorecard credits code-owner review only at the 9/10 tier [D20].

### D.8 OpenSSF Scorecard
- `ossf/scorecard-action` (latest v2.4.4, 2026-07-23; CLI v5.5.0, 2026-04-23) is free on public repos; supported triggers `push` and `schedule` (default branch), `pull_request` experimental; `publish_results: true` needs `id-token: write` (job level) and imposes workflow restrictions (no top-level env/defaults or write permissions; job steps limited to checkout, upload-artifact, upload-sarif, scorecard, harden-runner) [D19]. Results feed a badge and the code-scanning dashboard [D19].
- Checks list includes Branch-Protection, Code-Review, Dependency-Update-Tool, Pinned-Dependencies, Token-Permissions, SAST, Security-Policy, Vulnerabilities, Signed-Releases, Fuzzing, CII-Best-Practices [D20]. Expect: Pinned-Dependencies and Token-Permissions already healthy from `ci.yml` `[repo]`; Dependency-Update-Tool, SAST, Branch-Protection improve with D.1-D.3; Code-Review stays low for a solo maintainer (human changes without approval cost points; bot-only recent changes are inconclusive) [D20].
- Optional hardening related to the same finding: the repo-level Actions policy "require actions pinned to a full-length SHA" exists (currently off `[gh-api]`); when on, every action including GitHub's own must be SHA-pinned, reusable workflows may still use tags [D21][B8].

---

## Minimal recommended setup

1. Playwright: add `@playwright/test@1.63.0` (exact) as a devDependency (in `ui/` or a new `e2e/`); config with `webServer: { command: 'go run ./tests/ui-fixture', url: 'http://127.0.0.1:4174', reuseExistingServer: false, stdout: 'pipe', gracefulShutdown: { signal: 'SIGTERM', timeout: 3000 } }`.
2. Config defaults on CI: `workers: 1`, `retries: 2`, `trace: 'on-first-retry'`, `forbidOnly`, `failOnFlakyTests`, reporters `github` + `html`; pin `locale`, `timezoneId`, `viewport`, `deviceScaleFactor: 1`.
3. Projects: `journeys` (destructive, run alone) and `docs-en` / `docs-fr` (read-only screenshots); run them as two `playwright test --project=...` invocations so each gets a fresh fixture.
4. Port `tests/ux_journeys.cjs` to one serial spec (option fixtures `language` -> `?lang=`, `theme` -> `dark` class; `page.clock.setFixedTime`); delete the `.cjs` at 18/18 parity; decide `browser_smoke.py` separately.
5. New CI job `e2e` in `ci.yml` (no `paths:` filter): setup-go, setup-node, `npm ci`, build `ui/dist`, `npx playwright install --with-deps chromium`, run both invocations, upload report and `test-results` with `if: ${{ !cancelled() }}`, `retention-days: 14`; no browser cache.
6. Screenshots: `toHaveScreenshot` with path template `docs/images/{projectName}/{arg}{ext}`; PR CI `updateSnapshots: 'none'`; a manual `workflow_dispatch` job runs `-u` on `ubuntu-24.04` and uploads `docs/images`; a human commits (one-time rewrite of the 12 PNGs).
7. VitePress: separate `package.json`, exact pin (1.6.4 stable or 2.0.0-alpha.20), `locales` root en + `fr`, `base: '/bifrost-plugin-registry/'`, `search.provider: 'local'`, `srcExclude` for internal folders, fix or rewrite the `../` links.
8. Pages: build job on every PR, deploy job on `main` with the official actions pinned by SHA and `pages: write` / `id-token: write`; then set Settings > Pages > Source = GitHub Actions (manual).
9. Links: VitePress dead-link check on PRs (internal only); lychee on a weekly schedule, not required.
10. Ruleset on `main`: require PR (0 approvals), required checks `go`, `ui`, `scripts`, `e2e`, `docs-build`, block force pushes, restrict deletions, optional linear history; no `paths:` on required workflows.
11. `.github/dependabot.yml`: `gomod /`, `npm /ui` (+ site dir), `github-actions /`, weekly, grouped.
12. Settings toggles: Dependabot alerts + security updates, CodeQL default setup, secret scanning + push protection; PVR already on.
13. `.github/release.yml` mapping existing labels plus `dependencies`; skip CODEOWNERS until a second maintainer; Scorecard workflow last, optional.

## Unconfirmed / risks

- **Evaluate enforcement mode** on the Free plan: docs only mention it beside metadata restrictions (D.1).
- **Secret scanning / push protection availability**: docs say "automatic" and "public by default", the API says `disabled`, and the push-protection page says it needs Secret Protection. Verify in the UI before relying on it (D.4).
- **CodeQL Go build mode** under default setup is not stated; a failing Go analysis would leave default setup enabled but idle (D.3).
- **Dependabot on SHA-pinned actions**: evidenced only in `dependabot-core` source, not in docs.github.com (D.2). The 3-day default cooldown is documented but easy to miss.
- **Snapshot path outside `testDir`**: docs say `snapshotPathTemplate` resolves relative to the config dir [B4], but writing into `docs/images/` was not executed (no browser download was made for this note).
- **Pixel stability**: docs warn of OS/version/headless dependence [B1]; whether PNG bytes are identical across runs or Chromium bumps is not documented. Tolerance values (`maxDiffPixelRatio`) are a judgment call.
- **`animations: 'disabled'`** is documented for CSS animations/transitions/Web Animations only; JS-timer UI (toasts) may still flicker.
- **Process tree on `go run`**: the docs say the process group is signalled [A8]; behaviour with `go run` as parent and the fixture's SIGTERM handler was not tested. Building the binary first avoids the question.
- **Fixed fixture port 4174** forces sequential invocations; parallel projects or shards in one job would collide until the fixture accepts a listen address.
- **VitePress version choice**: stable 1.6.4 is 14 months old on Vite 5; 2.0.0-alpha.20 matches Vite 8/Node 22 and the live docs but is pre-release with breaking changes between alphas; no 2.0 stable date found.
- **Docs layout**: srcDir `docs/` would publish internal notes and flag `../` links as dead; French content must be written (no per-language docs exist today).
- **Doc staleness**: official samples reference older action majors than the latest releases (A.2, C.3); copy structure, not versions.
- **Pages deploy details**: dotfile exclusion in `upload-pages-artifact` was read from `action.yml`, not exercised; first deploy should be checked. Pages source must be flipped by hand.
- **Bot-created PRs** (regenerated screenshots, Dependabot) run with a read-only token and, for `GITHUB_TOKEN`-created PRs, wait for manual workflow approval [B7]; the repo setting for Actions-created PRs is off.
- **Public artifacts/logs**: traces and HTML reports may expose data [A1]; today the fixture token and data are public synthetic constants `[repo]`; keep real tokens out of the E2E path.
- **Required-check names** are job ids (`go`, `ui`, `scripts`); confirm the exact strings in the ruleset picker after a first green run (7-day rule, D.1).
- **Whether `npm ci` alone downloads browsers**, and whether `browser_smoke.py`'s legacy UI is still shipped, are not established by the sources read.
- Solo-maintainer scores (Scorecard Code-Review, Branch-Protection tiers 2, 4, 5) will stay low by design; do not trade the maintainer's ability to merge for score.
