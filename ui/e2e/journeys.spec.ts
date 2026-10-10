// The 18 browser journeys of the UX audit (docs/reviews/2026-09-25-ux-audit.md), expressed
// against the current UI: the September 25 script no longer matched it (renamed controls, the
// model, group and key editors became steps). Each journey keeps its claim; comments say where
// the control changed.
// Scope: real Registry HTTP server + production React build; synthetic Bifrost, no native ABI
// or provider inference qualification. The journeys share one page and are destructive, so this
// is one test of sequential steps run against a fresh fixture (see playwright.config.ts).
import type { Locator } from '@playwright/test';
import { expect, test, token } from './fixtures';

test('UX journeys', async ({ page, pageErrors: errors, browser, baseURL }, testInfo) => {
  const headers = { Authorization: `Bearer ${token}` };
  const api = async (path: string) => {
    const r = await page.request.get(`/api/${path}`, { headers });
    expect(r.status()).toBe(200);
    return r.json();
  };
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const nav = (name: string) => page.getByRole('link', { name, exact: true });
  const sheet = () => page.locator('[data-slot="sheet-content"]');
  const keyCard = (name: string) => page.locator('[data-slot="card"]').filter({ has: page.getByText(name, { exact: true }) });
  const composerStep = (label: string) => page.getByRole('list', { name: 'Key composition steps' }).getByRole('button', { name: new RegExp(`^\\d ${label}`) });
  const keyHeading = () => page.getByRole('heading', { name: 'QA Development Key', exact: true });
  const keyChanges = () => page.getByRole('region', { name: 'Changes before publishing' });
  const openDevelopmentKey = async () => {
    await keyCard('QA Development Key').getByRole('button', { name: 'Open', exact: true }).click();
    await keyHeading().waitFor();
  };
  const shot = async (name: string) => testInfo.attach(name, { body: await page.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
  const withinViewport = async (locator: Locator) => {
    await page.waitForFunction(el => {
      const r = (el as Element).getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    }, await locator.elementHandle(), { timeout: 2000 });
    const box = await locator.boundingBox();
    const view = page.viewportSize()!;
    expect(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1, JSON.stringify(box)).toBeTruthy();
  };

  const workspace = await api('workspace');
  expect(workspace.connection.version, 'This destructive QA is restricted to the synthetic fixture').toBe('2.2.6-fixture');

  await test.step('authentication and catalog', async () => {
    await page.getByLabel('Admin token', { exact: true }).fill('invalid-fixture-token');
    await button('Sign in').click();
    await page.getByRole('alert').filter({ hasText: 'Invalid' }).waitFor();
    await page.getByLabel('Admin token', { exact: true }).fill(token);
    await button('Sign in').click();
    await button('Open QA Chat details').waitFor();
    await shot('after-catalog-light');
  });

  await test.step('creators come from Models.dev references', async () => {
    // Subscription cards were saved from discovery: slug name, creator "Unknown", no modalities.
    // They show the reference name over the common ID, and the creator from the reference
    // namespace (anthropic/… has a Models.dev provider record, tencent/… does not).
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });
    await expect(card('QA Opus')).toContainText('Anthropic · qa-claude');
    await expect(card('QA Opus').getByText('qa-opus', { exact: true })).toBeVisible();
    await expect(card('QA Opus').getByText('? → ?')).toHaveCount(0);
    await expect(card('qa-codex-mini')).toContainText('Creator not identified'); // no reference
    await page.getByRole('combobox', { name: 'Creator', exact: true }).click();
    // Counts are models, saved and discovered (#70 splits them into scopes).
    await expect(page.getByRole('option')).toHaveText(['Creator: all', 'Anthropic (3)', 'DeepSeek (1)', 'Fixture Labs (4)', 'Google (2)', 'Meituan (1)', 'OpenAI (1)', 'Tencent (1)', 'Creator not identified (63)']);
    await page.getByRole('option', { name: 'Tencent (1)', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Open .* details$/ })).toHaveText(['QA Hunyuan']);
    await expect(card('QA Hunyuan')).toContainText('Tencent · qa-hunyuan');
    await button('Clear all').click();
    await button('Open QA Chat details').waitFor();
  });

  await test.step('model cancel protects draft; focus stays in editor', async () => {
    await button('Open QA Chat details').click();
    await page.getByRole('textbox', { name: 'Display name *', exact: true }).fill('QA draft preserved');
    expect(await sheet().evaluate(el => el.contains(document.activeElement))).toBe(true);
    await button('Cancel').click();
    await page.getByRole('heading', { name: 'Discard changes?' }).waitFor();
    await button('Keep editing').click();
    await expect(page.getByRole('textbox', { name: 'Display name *', exact: true })).toHaveValue('QA draft preserved');
    await button('Cancel').click();
    await button('Discard draft').click();
    await sheet().waitFor({ state: 'hidden' });
  });

  await test.step('unchanged discovery closes without false discard warning', async () => {
    await button('Open QA Unregistered details').click(); // was "Review & add"
    await button('Cancel').click();
    await sheet().waitFor({ state: 'hidden' });
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toHaveCount(0);
  });

  await test.step('saved card keeps its own accesses; matching ones are offered, never merged', async () => {
    // Claude/qa-opus is saved; openrouter's anthropic/qa-opus shares its reference and is not.
    const before = (await api('workspace')).data.models;
    const openOpus = page.getByRole('button', { name: /^Open qa[- ]opus details$/i });
    const card = page.locator('[data-slot="card"]').filter({ has: openOpus });
    const part = (scope: Locator, heading: RegExp) => scope.getByRole('heading', { name: heading }).locator('..');
    await expect(card.getByLabel('Access providers').getByLabel(/openrouter/i)).toHaveCount(0);
    await card.getByRole('button', { name: /^Accesses/ }).click();
    const popover = page.locator('[data-slot="popover-content"]');
    await expect(part(popover, /^In this card/)).toContainText('Claude');
    await expect(part(popover, /^In this card/)).not.toContainText(/openrouter/i);
    await expect(part(popover, /^Available, not in this card/)).toContainText(/openrouter/i);
    await expect(part(popover, /^Available, not in this card/)).toContainText(/Input 4\b.*Output 20\b/);
    await expect(popover, 'Facts are readable, not raw parameter JSON').not.toContainText('{"');
    await page.keyboard.press('Escape');
    await page.getByRole('radio', { name: 'Table', exact: true }).click();
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: /^Open qa[- ]opus details$/i }) });
    await expect(row).toContainText('1 available, not in this card');
    await expect(row.getByText(/openrouter/i)).toHaveCount(0);
    await page.getByRole('radio', { name: 'Grid', exact: true }).click();

    // Re-saving after a rename writes exactly the saved accesses.
    await openOpus.click();
    await page.getByRole('textbox', { name: 'Display name *', exact: true }).fill('QA Opus saved');
    await button('Review').click();
    await sheet().getByText(/Display name : .* → QA Opus saved/).waitFor();
    await expect(sheet().getByText(/^Access (added|removed)/)).toHaveCount(0);
    const write = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/api/workspace'));
    await button('Save model').click();
    const payload = (await write).postDataJSON();
    await sheet().waitFor({ state: 'hidden' });
    const accessIds = (models: { id: string; accesses: { id: string; nativeModel: string }[] }[]) => models.map(m => [m.id, m.accesses.map(a => `${a.id}=${a.nativeModel}`)]);
    expect(accessIds(payload.data.models), 'The write contains no access the user did not choose').toEqual(accessIds(before));
    expect(payload.data.models.find((m: { id: string }) => m.id === 'qa-opus').name).toBe('QA Opus saved');

    // The card sheet offers the matching access; adding and removing are explicit and reviewed.
    await page.getByRole('button', { name: 'Open QA Opus saved details', exact: true }).click();
    await sheet().getByRole('button', { name: 'Access', exact: true }).click();
    await expect(part(sheet(), /^Also available/)).toContainText(/openrouter/i);
    await button('Edit accesses').click();
    await expect(part(sheet(), /^In this card/)).toContainText('qa-opus');
    await expect(part(sheet(), /^In this card/)).not.toContainText(/openrouter/i);
    await expect(part(sheet(), /^Also available/)).toContainText(/Input price 4\b.*Output price 20\b/);
    await sheet().getByRole('button', { name: /^Remove Claude/ }).click();
    await expect(part(sheet(), /^Also available/), 'A removed saved access can be added back').toContainText('Claude');
    await sheet().getByRole('button', { name: /^Add openrouter/i }).click();
    await expect(part(sheet(), /^Also available/)).not.toContainText(/openrouter/i);
    await part(sheet(), /^In this card/).getByRole('checkbox', { name: /Chat Completions/ }).check();
    await button('Review').click();
    await sheet().getByText(/^Access added : openrouter · anthropic\/qa-opus$/i).waitFor();
    await sheet().getByText(/^Access removed : Claude · qa-opus$/).waitFor();
    await button('Cancel').click();
    await button('Discard draft').click();
    await sheet().waitFor({ state: 'hidden' });
  });

  await test.step('custom provider derives exposed ID and validation stays beside Save', async () => {
    // "Add model > Advanced: custom model" is now "Register a model > Advanced: enter an access
    // manually"; the access form keeps its Save action (Keep changes) disabled beside the error.
    await button('Register a model').click();
    await button('Advanced: enter an access manually').click();
    await page.getByRole('combobox', { name: 'Search a model or enter its ID *', exact: true }).fill('qa-custom');
    await button('Enter access manually').click();
    const dialog = page.getByRole('dialog', { name: 'Edit provider access' });
    await dialog.getByRole('combobox', { name: 'Provider in Bifrost *', exact: true }).fill('synthetic-provider');
    await dialog.getByRole('textbox', { name: 'Model at this provider *', exact: true }).fill('qa-custom');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('textbox', { name: 'Registry exposed ID', exact: true })).toHaveValue('synthetic-provider/qa-custom');
    await expect(dialog.getByRole('textbox', { name: 'Registry exposed ID', exact: true })).toHaveAttribute('readonly', '');
    await expect(button('Keep changes')).toBeDisabled();
    await dialog.getByRole('alert').waitFor();
    await withinViewport(dialog.getByRole('alert'));
    await shot('after-editor-validation');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await button('Cancel').click();
    await button('Discard draft').click();
    await sheet().waitFor({ state: 'hidden' });
  });

  await test.step('group filter retains hidden selections and cancel protects draft', async () => {
    // Creating a group is now a three-step sheet: Details, Models, Review.
    await nav('Groups').click();
    await button('Create group').click();
    await page.getByRole('textbox', { name: 'Group name *', exact: true }).fill('QA Browser Group');
    await button('Continue').click();
    await page.getByRole('checkbox', { name: 'Select QA Code', exact: true }).check();
    await page.getByRole('textbox', { name: 'Search models', exact: true }).fill('vision');
    await page.getByRole('checkbox', { name: 'Select QA Vision', exact: true }).check();
    await page.getByText(/2 total selected/).waitFor();
    await button('Cancel').click();
    await button('Keep editing').click();
    await button('Previous').click();
    await expect(page.getByRole('textbox', { name: 'Group name *', exact: true })).toHaveValue('QA Browser Group');
    await button('Continue').click();
    await button('Continue').click();
    await button('Publish group').click();
    await sheet().waitFor({ state: 'hidden' });
    const group = (await api('workspace')).data.groups.find((g: { name: string }) => g.name === 'QA Browser Group');
    expect(group.members.sort()).toEqual(['qa-code', 'qa-vision']);
  });

  await test.step('key origin and exclusion publish with independent readback', async () => {
    // The composer is three steps (Models, Groups, Review); publication lives in Review. The
    // origin is shown in the access menu, the exclusion as a card checkbox.
    await nav('Virtual keys').click();
    await expect(keyCard('QA Development Key')).toContainText('Bifrost allows · 1 provider · 2 models');
    await openDevelopmentKey();
    // #69: the key page names the key once and offers one way back.
    expect((await page.locator('body').innerText()).split('QA Development Key').length - 1).toBe(1);
    await expect(page.getByRole('button', { name: /^(All virtual keys|Virtual keys|Back)$/ })).toHaveCount(1);
    await button('1 provider accesses for QA Code').click();
    await page.getByText('Inherited · QA Development', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await composerStep('Review').click();
    await expect(button('Publish changes')).toBeDisabled();
    await expect(page.getByText('Unpublished draft', { exact: true }), 'No draft changes despite absent readback').toHaveCount(0);
    await expect(keyChanges()).toContainText('No change.');
    await composerStep('Models').click();
    await page.getByRole('checkbox', { name: 'Exclude from this key: QA Code', exact: true }).click();
    await composerStep('Review').click();
    await page.getByRole('heading', { name: 'Local exclusions' }).waitFor();
    // #69: Review diffs the draft against a labelled baseline; nothing is read back yet.
    await expect(keyChanges().getByText('Compared with the last published plan', { exact: true })).toBeVisible();
    await expect(keyChanges().getByRole('list', { name: 'Will lose' })).toContainText('synthetic-provider/qa-code');
    await expect(keyChanges().getByRole('list', { name: 'Will gain' })).toHaveCount(0);
    await button('Publish changes').click();
    await page.getByText('Verified', { exact: true }).waitFor();
    const keys = (await api('workspace')).data.keys;
    const key = (id: string) => keys.find((k: { id: string }) => k.id === id);
    expect(key('vk-qa-dev').policy.excluded).toEqual(['qa-code']);
    expect(key('vk-qa-dev').publication.actual).toEqual(['synthetic-provider/qa-chat']);
    expect(key('vk-qa-visual').policy.groups).toEqual(['qa-visual']);
    await shot('after-key-published');
  });

  await test.step('key draft navigation guard', async () => {
    await button('Restore QA Code').click();
    await button('All virtual keys').click();
    await page.getByRole('heading', { name: 'Discard key draft?' }).waitFor();
    await button('Keep editing').click();
    await keyHeading().waitFor();
    await button('Discard draft').click();
  });

  await test.step('browser Back and Forward preserve navigation and draft guard', async () => {
    await button('All virtual keys').click();
    await openDevelopmentKey();
    await composerStep('Review').click();
    await button('Restore QA Code').click();
    await page.goBack();
    await button('Keep editing').click();
    await keyHeading().waitFor();
    await button('Discard draft').click();
    await button('All virtual keys').click();
    await page.goBack();
    await keyHeading().waitFor();
    await page.goForward();
    await page.getByLabel('Search keys', { exact: true }).waitFor();
    await openDevelopmentKey();
  });

  await test.step('disabled key distinguishes retained selection from usable access', async () => {
    // The banner now says the saved selection is shown for review; the "no model access" wording is gone.
    await button('Disable').click();
    await page.getByText('This key is disabled. Its saved model selection is shown for review.').waitFor();
    const keys = (await api('workspace')).data.keys;
    expect(keys.find((k: { id: string }) => k.id === 'vk-qa-dev').active).toBe(false);
    await button('Enable').click();
    await button('Disable').waitFor();
    await composerStep('Review').click();
    await page.getByText('Verified', { exact: true }).waitFor();
  });

  await test.step('publication failure retains key draft and recovery action', async () => {
    await button('Restore QA Code').click();
    // #69: once read back, the verified readback is the baseline.
    await expect(keyChanges().getByText('Compared with the last verified readback', { exact: true })).toBeVisible();
    await expect(keyChanges().getByRole('list', { name: 'Will gain' })).toContainText('synthetic-provider/qa-code');
    await page.route('**/api/workspace', route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic unavailable response' }) })
      : route.continue());
    await button('Publish changes').click();
    await page.getByRole('alert').filter({ hasText: 'Synthetic unavailable' }).first().waitFor();
    await expect(button('Publish changes')).toBeEnabled();
    await page.unroute('**/api/workspace');
    await button('Discard draft').click();
  });

  await test.step('unmanaged key opens on adoption; the composer follows adoption', async () => {
    // #69: each card says what Bifrost allows today. An unmanaged key starts with adoption as its
    // single primary action: nothing to compose, nothing published, until the key is adopted.
    await button('All virtual keys').click();
    await expect(keyCard('QA All Providers Key')).toContainText('All providers');
    await expect(keyCard('QA Claude Key')).toContainText('1 provider · all models of Claude');
    await expect(keyCard('QA Unmanaged Key')).toContainText('No provider');
    await expect(keyCard('QA Codex Key')).toContainText('1 provider · 2 models');
    await keyCard('QA Unmanaged Key').getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByText('Synthetic unmanaged client · Bifrost key · Registry policy not adopted')).toBeVisible();
    await expect(button('Review adoption')).toHaveCount(1);
    await expect(page.getByRole('list', { name: 'Key composition steps' })).toHaveCount(0);
    await expect(button('Publish changes')).toHaveCount(0);
    await expect(page.getByText('Unpublished draft', { exact: true })).toHaveCount(0);
    await shot('after-unmanaged-key');
    await button('All virtual keys').click();
    await keyCard('QA Codex Key').getByRole('button', { name: 'Review', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Bifrost allows today' })).toContainText('Codex · qa-codex, qa-codex-mini');
    await button('Review adoption').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Use this key with Registry', exact: true }).click();
    await composerStep('Review').click();
    await expect(keyChanges()).toContainText('No change.');
    expect((await api('workspace')).data.keys.find((k: { id: string }) => k.id === 'vk-qa-codex').managed).toBe(true);
  });

  await test.step('search recovery clears filter instead of starting creation', async () => {
    // The empty result no longer has a recovery button: it is a message, and clearing the field recovers.
    await button('All virtual keys').click();
    await page.getByLabel('Search keys').fill('nothing-matches-qa');
    await page.getByText('No keys match these filters.').waitFor();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByLabel('Search keys').fill('');
    await page.getByText('QA Development Key', { exact: true }).first().waitFor();
  });

  await test.step('key creation secret has a clipboard denial fallback', async () => {
    await button('Create key').click();
    await page.getByLabel('Key name', { exact: true }).fill('QA Browser Key');
    await page.getByRole('dialog').getByRole('button', { name: 'Create key', exact: true }).click();
    await page.getByLabel('Virtual key secret', { exact: true }).waitFor();
    await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('denied'); } } }));
    await button('Copy secret').click();
    await page.getByRole('alert').filter({ hasText: 'Ctrl+C or Cmd+C' }).waitFor();
    const input = page.getByLabel('Virtual key secret', { exact: true });
    expect(await input.evaluate((el: HTMLInputElement) => el.selectionEnd! - el.selectionStart! === el.value.length)).toBe(true);
    await button('Done').click();
    await input.waitFor({ state: 'hidden' });
    await expect(input).toHaveCount(0);
  });

  await test.step('metadata correction uses visible dialog and persists', async () => {
    // "Sources & References" is now Settings > Open catalog data.
    await nav('Settings').click();
    await button('Open catalog data').click();
    await page.getByRole('button').filter({ hasText: 'synthetic-provider/qa-chat' }).first().click();
    await button('Edit field').click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.locator('input').fill('QA metadata corrected');
    await dialog.getByRole('button', { name: 'Save shared correction' }).click();
    await dialog.waitFor({ state: 'hidden' });
    const catalog = await api('catalog');
    expect(catalog.accesses.find((a: { model: string }) => a.model === 'qa-chat').fields.name.value).toBe('QA metadata corrected');
  });

  await test.step('mobile sheet, footer, focus and metadata detail fit viewport', async () => {
    await nav('Groups').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await button('Create group').click();
    await withinViewport(sheet());
    // The primary action is Continue (Publish group is on the last step); a disabled button does
    // not receive pointer events, so enable it before checking that nothing covers it.
    await page.getByRole('textbox', { name: 'Group name *', exact: true }).fill('QA Mobile Group');
    await withinViewport(button('Continue'));
    for (const target of [sheet().getByRole('heading', { name: 'Create group', exact: true }), sheet().getByRole('button', { name: 'Close', exact: true }), button('Continue')]) {
      expect(await target.evaluate(el => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el === hit || el.contains(hit);
      }), 'Toast must not cover the mobile title, close control or primary action').toBe(true);
    }
    expect(await sheet().evaluate(el => el.contains(document.activeElement))).toBe(true);
    await shot('after-mobile-group');
    await button('Cancel').click();
    await button('Discard changes').click();
    await sheet().waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav('My models').click();
    await page.getByRole('button', { name: /^Open .* details$/ }).first().click(); // QA Chat was renamed by the metadata correction
    await page.setViewportSize({ width: 390, height: 620 });
    await withinViewport(sheet());
    await withinViewport(button('Review')); // was Save model
    await shot('after-mobile-editor');
    await button('Cancel').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav('Settings').click();
    await button('Open catalog data').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button').filter({ hasText: 'synthetic-provider/qa-code' }).first().click();
    await withinViewport(button('Back to list'));
    await button('Edit field').click();
    await withinViewport(page.getByRole('dialog'));
    await shot('after-mobile-metadata');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 950 });
    await nav('My models').click();
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await test.step('dark theme and logout clear secrets and workspace', async () => {
    await button('Use dark theme').click();
    await shot('after-catalog-dark-mobile');
    await expect(page.locator('html')).toHaveAttribute('class', 'dark');
    await button('Sign out').click();
    await button('Sign in').waitFor();
    await expect(page.getByText('QA Code', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => [...Object.values(localStorage), ...Object.values(sessionStorage)].some(v => v.includes('sk-bf-')))).toBe(false);
  });

  await test.step('large catalogs remain reachable and metadata failure keeps model editing', async () => {
    const stress = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    stress.setDefaultTimeout(10_000);
    stress.on('pageerror', e => errors.push(e.message));
    const catalog = await api('catalog');
    const models = Array.from({ length: 65 }, (_, i) => ({
      ...structuredClone(workspace.data.models[0]), id: `qa-${i}`, name: `QA Model ${i}`,
      accesses: [{ provider: 'synthetic-provider', id: `synthetic-provider/qa-${i}`, nativeModel: `qa-${i}`, status: 'Configured', route: 'Direct provider' }],
    }));
    const large = { ...workspace, data: { ...workspace.data, models }, discovery: [] };
    const references = models.map(m => ({ ...structuredClone(catalog.references[0]), id: `fixture/${m.id}`, fields: { name: { value: m.name, source: 'fixture', kind: 'declared' } } }));
    const accesses = models.map(m => ({ id: `synthetic-provider/${m.id}`, provider: 'synthetic-provider', model: m.id, referenceId: `fixture/${m.id}`, configured: true, fields: {}, overrides: {} }));
    await stress.route('**/api/workspace', r => r.fulfill({ json: large }));
    await stress.route('**/api/catalog', r => r.fulfill({ json: { ...catalog, references, accesses } }));
    await stress.goto('/');
    await stress.getByRole('button', { name: /Show more/ }).click();
    await expect(stress.getByRole('button', { name: /^Open .* details$/ })).toHaveCount(65);
    await stress.getByRole('link', { name: 'Settings', exact: true }).click();
    await stress.getByRole('button', { name: 'Open catalog data', exact: true }).click();
    await stress.getByRole('button', { name: /Show more/ }).click();
    await stress.getByText('Showing 65 of 65 matching entries.', { exact: false }).waitFor();
    await stress.unroute('**/api/catalog');
    await stress.route('**/api/catalog', r => r.fulfill({ status: 503, json: { error: 'Synthetic metadata offline' } }));
    await stress.getByRole('link', { name: 'My models', exact: true }).click();
    await stress.getByText(/Model details unavailable/).waitFor();
    await stress.getByRole('button', { name: 'View details', exact: true }).first().click();
    await stress.locator('[data-slot="sheet-content"]').getByRole('button', { name: 'Review', exact: true }).waitFor(); // was Save model
    await stress.close();
  });

  await test.step('no browser JavaScript errors', async () => {
    expect(errors).toEqual([]);
  });
});
