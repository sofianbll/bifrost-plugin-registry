// The 18 browser journeys of the UX audit (docs/reviews/2026-09-25-ux-audit.md), expressed
// against the current UI: the September 25 script no longer matched it (renamed controls, the
// model, group and key editors became steps). Each journey keeps its claim; comments say where
// the control changed.
// Scope: real Registry HTTP server + production React build; synthetic Bifrost, no native ABI
// or provider inference qualification. The journeys share one page and are destructive, so this
// is one test of sequential steps run against a fresh fixture (see playwright.config.ts).
import type { Locator, Page } from '@playwright/test';
import { expect, test, token } from './fixtures';

test('UX journeys', async ({ page, pageErrors: errors, browser, baseURL }, testInfo) => {
  const headers = { Authorization: `Bearer ${token}` };
  const api = async (path: string) => {
    const r = await page.request.get(`/api/${path}`, { headers });
    expect(r.status()).toBe(200);
    return r.json();
  };
  // Reference catalogue reads made by the page (the API helper's own reads are not page requests).
  const catalogReads: string[] = [];
  page.on('request', r => { if (r.method() === 'GET' && new URL(r.url()).pathname === '/api/catalog') catalogReads.push(r.url()); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const scope = (name: RegExp) => page.getByRole('radio', { name });
  const searchModels = () => page.getByRole('textbox', { name: 'Search models', exact: true });
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
  // Accessible names of the card actions in the first card grid, read from the accessibility tree.
  const cardActions = async (on: Page) => [...(await on.locator('[data-slot="card"]').first().locator('xpath=..').ariaSnapshot()).matchAll(/- button "((?:[^"\\]|\\.)*)"/g)].map(match => match[1]);
  const duplicates = (names: string[]) => names.filter((name, index) => names.indexOf(name) !== index);
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

  await test.step('My models opens on the saved cards; the rest waits in To add', async () => {
    // 8 saved cards; 68 discovered models are not saved, 66 of them from the openrouter aggregator.
    const opens = page.getByRole('button', { name: /^Open .* details$/ });
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });
    await expect(scope(/^In Registry/)).toHaveAccessibleName('In Registry (8)');
    await expect(scope(/^In Registry/)).toBeChecked();
    await expect(scope(/^To add/)).toHaveAccessibleName('To add (68)');
    await expect(opens).toHaveCount(8);
    await expect(card('QA Chat')).toContainText('Saved');
    await expect(card('QA Opus'), 'openrouter serves the same model outside the card').toContainText('Partial');
    await scope(/^To add/).click();
    await expect(opens).toHaveCount(60); // first page
    await searchModels().fill('qa-opus');
    // Exact IDs: the variant keeps its own; the access sharing QA Opus' reference shows its native ID.
    await expect(opens).toHaveText(['QA Opus', '~anthropic/qa-opus-latest']);
    await expect(card('QA Opus')).toContainText('anthropic/qa-opus');
    await expect(card('QA Opus')).toContainText('Partial');
    await searchModels().fill(':batch');
    await expect(opens).toHaveText(['openai/qa-codex:batch']);
    await expect(card('openai/qa-codex:batch')).toContainText('Not saved');
    await searchModels().fill('');
    // Settings counts the same scopes.
    await nav('Settings').click();
    await expect(page.getByText('In Registry (8) · To add (68)', { exact: true })).toBeVisible();
    await nav('My models').click();
    await scope(/^In Registry/).click();
    await button('Open QA Chat details').waitFor();
  });

  await test.step('the reference catalogue loads once per Registry revision', async () => {
    await nav('Groups').click();
    await nav('My models').click();
    await button('Open QA Chat details').click();
    await sheet().getByRole('button', { name: 'Access', exact: true }).waitFor();
    await button('Cancel').click();
    await sheet().waitFor({ state: 'hidden' });
    expect(catalogReads, 'No refetch when returning to My models or opening a card').toHaveLength(1);
  });

  await test.step('scope, search, filters and grouping survive leaving the page', async () => {
    const grouping = page.getByRole('combobox', { name: 'Group models by', exact: true });
    await scope(/^To add/).click();
    await searchModels().fill('qwen');
    await grouping.click();
    await page.getByRole('option', { name: 'Group by creator', exact: true }).click();
    await nav('Virtual keys').click();
    await nav('My models').click();
    await expect(scope(/^To add/)).toBeChecked();
    await expect(searchModels()).toHaveValue('qwen');
    await expect(grouping).toHaveText('Group by creator');
    await expect(page.getByRole('heading', { name: /^Creator not identified/ })).toBeVisible();
    await grouping.click();
    await page.getByRole('option', { name: 'No grouping', exact: true }).click();
    await button('Clear all').click();
    await scope(/^In Registry/).click();
  });

  await test.step('More filters closes like the other popovers; card actions have unique names', async () => {
    const more = page.getByRole('button', { name: /^More filters/ });
    const output = page.getByRole('combobox', { name: 'Output', exact: true });
    await more.click();
    await expect(output).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(output).toBeHidden();
    await expect(more, 'Escape returns focus to the trigger').toBeFocused();
    // A filter chosen inside keeps the panel open; a click outside closes it.
    await more.click();
    await output.click();
    await page.getByRole('option', { name: 'Text', exact: true }).click();
    await expect(more).toHaveAccessibleName('More filters (1)');
    await expect(output).toBeVisible();
    await page.getByRole('heading', { level: 1 }).click();
    await expect(output).toBeHidden();
    await button('Clear all').click();
    // Every card action names its card: no two "Accesses · 1" or identical summaries.
    const names = await cardActions(page);
    expect(names).toEqual(expect.arrayContaining(['Open QA Chat details', 'Accesses · 1 · QA Chat']));
    expect(duplicates(names), 'In Registry').toEqual([]);
    await scope(/^To add/).click();
    expect(duplicates(await cardActions(page)), 'To add').toEqual([]);
    await scope(/^In Registry/).click();
    // The legend shows the glyphs it explains.
    const legend = page.getByLabel('Capability state legend', { exact: true });
    await expect(legend.locator('svg').first()).toBeVisible();
    await expect(legend).toContainText('?');
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
    const creators = page.getByRole('combobox', { name: 'Creator', exact: true });
    await creators.click();
    // Counts are the models of the current scope: saved cards here, discovered ones in To add.
    await expect(page.getByRole('option')).toHaveText(['Creator: all', 'Anthropic (2)', 'Fixture Labs (3)', 'Google (1)', 'OpenAI (1)', 'Creator not identified (1)']);
    await page.keyboard.press('Escape');
    await scope(/^To add/).click();
    await creators.click();
    await expect(page.getByRole('option')).toHaveText(['Creator: all', 'Anthropic (1)', 'DeepSeek (1)', 'Fixture Labs (1)', 'Google (1)', 'Meituan (1)', 'Tencent (1)', 'Creator not identified (62)']);
    await page.getByRole('option', { name: 'Tencent (1)', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Open .* details$/ })).toHaveText(['QA Hunyuan']);
    await expect(card('QA Hunyuan')).toContainText('Tencent · qa-hunyuan');
    await button('Clear all').click();
    await scope(/^In Registry/).click();
    await button('Open QA Chat details').waitFor();
  });

  await test.step('creator and provider marks resolve to real logos; grouping names match', async () => {
    // Claude, Codex and Google are custom providers with base types anthropic, openai, gemini.
    const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: button(`Open ${name} details`) });
    const marks = (scope: Locator, name: string) => scope.getByRole('img', { name, exact: true });
    const logo = (scope: Locator, name: string) => expect(marks(scope, name).first().locator('svg, img'), `${name} shows a logo, not initials`).toHaveCount(1);
    // Creator logos (default): normalized creator names against the full icon set, initials last.
    await logo(card('QA Opus'), 'Anthropic');
    await logo(card('QA Codex'), 'OpenAI');
    await logo(card('QA Gemini'), 'Google');
    await expect(marks(card('QA Chat'), 'Fixture Labs')).toHaveText('FI');
    await expect(marks(card('qa-codex-mini'), 'Creator not identified')).toHaveText('?');
    // Serving providers in the footer: custom ones through their base type, one display name.
    for (const [model, provider] of [['QA Opus', 'Claude'], ['QA Codex', 'Codex'], ['QA Gemini', 'Google']]) await logo(card(model), provider);
    await button('Use dark theme').click();
    await expect(marks(card('QA Opus'), 'Anthropic').locator('svg'), 'black marks turn light on the dark theme').toHaveCSS('filter', /invert\(1\)/);
    await button('Use light theme').click();

    const group = async (by: string) => {
      await page.getByRole('combobox', { name: 'Group models by', exact: true }).click();
      await page.getByRole('option', { name: by, exact: true }).click();
    };
    const section = (name: string) => page.locator('section').filter({ has: page.getByRole('heading', { level: 3, name: new RegExp(`^${name} \\d+$`) }) });
    const sectionNames = async () => (await page.getByRole('heading', { level: 3 }).allTextContents()).map(text => text.replace(/\s*\d+$/, '')).sort();
    await group('Group by provider');
    await section('Claude').waitFor();
    expect(await sectionNames()).toEqual(['Claude', 'Codex', 'Google', 'synthetic-provider']); // saved cards; OpenRouter waits in To add
    await expect(section('Claude').getByRole('button', { name: 'Open QA Opus details', exact: true }), 'a saved card sits under its own access, not a matching one').toBeVisible();
    await group('Group by creator');
    await section('Anthropic').waitFor();
    await expect(section('Anthropic').getByRole('button', { name: 'Open QA Opus details', exact: true })).toBeVisible();
    await group('No grouping');
    // The aggregator's models wait in To add, with the same creator and provider marks.
    await scope(/^To add/).click();
    await searchModels().fill('qa-reasoner');
    await logo(card('QA Reasoner'), 'DeepSeek');
    await logo(card('QA Reasoner'), 'OpenRouter');
    await searchModels().fill('');
    await scope(/^In Registry/).click();

    // Provider logos: the card's own serving providers replace the creator mark.
    await nav('Settings').click();
    await button('Appearance').click();
    await logo(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Claude', exact: true }) }), 'Claude');
    await button('Provider').click();
    await nav('My models').click();
    await expect(marks(card('QA Opus'), 'Claude')).toHaveCount(2); // header and footer
    await expect(marks(card('QA Opus'), 'Anthropic')).toHaveCount(0);
    await logo(card('QA Opus'), 'Claude');
    await nav('Settings').click();
    await button('Appearance').click();
    await button('Creator').click();
    await nav('My models').click();

    // Keys show the same marks and display names.
    await nav('Virtual keys').click();
    await logo(keyCard('QA Claude Key'), 'Claude');
    await expect(keyCard('QA Claude Key')).toContainText('all models of Claude');
    await nav('My models').click();
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
    await scope(/^To add/).click(); // a discovered model now waits in To add
    await button('Open QA Unregistered details').click(); // was "Review & add"
    await button('Cancel').click();
    await sheet().waitFor({ state: 'hidden' });
    await expect(page.getByRole('heading', { name: 'Discard changes?' })).toHaveCount(0);
  });

  await test.step('registering from To add preselects the operations Bifrost declares', async () => {
    // Google/qa-image declares mode image_generation in its Bifrost parameters datasheet.
    await searchModels().fill('qa-image');
    await button('Open QA Image details').click();
    const inCard = sheet().getByRole('heading', { name: /^In this card/ }).locator('..');
    await expect(inCard.getByRole('checkbox', { name: /^Image generation/ })).toBeChecked();
    await expect(inCard.getByRole('checkbox', { name: /^Chat Completions/ })).not.toBeChecked();
    await button('Prepare model card').click();
    await button('Review').click();
    const write = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/api/workspace'));
    await button('Save model').click();
    const saved = (await write).postDataJSON().data.models.find((m: { id: string }) => m.id === 'qa-image');
    expect(saved.accesses.map((a: { id: string; endpoints: string[] }) => [a.id, a.endpoints])).toEqual([['Google/qa-image', ['images/generations']]]);
    await sheet().waitFor({ state: 'hidden' });
    await expect(scope(/^To add/)).toHaveAccessibleName('To add (67)');
    await searchModels().fill('');
    await scope(/^In Registry/).click();
    await expect(scope(/^In Registry/)).toHaveAccessibleName('In Registry (9)');
    await expect(page.locator('[data-slot="card"]').filter({ has: button('Open QA Image details') })).toContainText('Saved');
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
    await expect(part(popover, /^Available, not in this card/)).toContainText(/Input \$4\/M.*Output \$20\/M/);
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
    await sheet().getByText(/Display name: .* → QA Opus saved/).waitFor();
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
    await expect(part(sheet(), /^Also available/)).toContainText(/Input price \$4\/M.*Output price \$20\/M/);
    await sheet().getByRole('button', { name: /^Remove Claude/ }).click();
    await expect(part(sheet(), /^Also available/), 'A removed saved access can be added back').toContainText('Claude');
    await sheet().getByRole('button', { name: /^Add openrouter/i }).click();
    await expect(part(sheet(), /^Also available/)).not.toContainText(/openrouter/i);
    // Preselected from the native chat mode declared by Bifrost.
    await expect(part(sheet(), /^In this card/).getByRole('checkbox', { name: /Chat Completions/ })).toBeChecked();
    await button('Review').click();
    await sheet().getByText(/^Access added: openrouter · anthropic\/qa-opus$/i).waitFor();
    await sheet().getByText(/^Access removed: Claude · qa-opus$/).waitFor();
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
    await scope(/^In Registry/).click();
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

  await test.step('one language per UI: the English UI shows no French, the French UI no English', async () => {
    // Sentinels: UI words of the other language, in visible text and accessible names. Fixture data
    // is English in both UIs ("QA Development Key", "Synthetic … client", "QA Opus saved"), so the
    // English sentinels avoid its words; proper names (Registry, Bifrost, Models.dev) are shared.
    const sentinels = {
      en: /[àâçéèêëîïôûùœ«»]|\b(Oui|Non|Autre|[Ii]nconnue?|nouveau|Fournisseur|[Ff]iche)\b/,
      fr: /\b(Unknown|unknown|Yes|No|Other|Saved|Partial|Loading|Search|Creator|Provider|Reference|Model|Models(?!\.dev)|Native|Workspace|Catalog|Access|Accesses|Capabilities|Modalities|Series|Tasks|Settings|Show|View|Create|Delete|Name|Review|Cancel|Save|Open|Edit|Declared|declared|Configured|available|[Dd]etails|Input|Output|[Pp]rice|the|and|with|of)\b/,
    };
    const sweep = async (language: 'en' | 'fr', where: string) => {
      const text = await page.evaluate(() => [document.body.innerText, ...[...document.querySelectorAll('[aria-label], [title], [placeholder]')]
        .flatMap(el => ['aria-label', 'title', 'placeholder'].map(name => el.getAttribute(name) || ''))].join('\n'));
      expect.soft(text.split('\n').filter(line => sentinels[language].test(line)), `${where} in ${language === 'en' ? 'English' : 'French'}`).toEqual([]);
    };
    const tour = async (language: 'en' | 'fr') => {
      const t = (english: string, french: string) => language === 'fr' ? french : english;
      const open = (name: string) => page.getByRole('button', { name: t(`Open ${name} details`, `Ouvrir la fiche ${name}`), exact: true });
      const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: open(name) });
      const popover = page.locator('[data-slot="popover-content"]');
      const accesses = async (name: string) => {
        await card(name).getByRole('button', { name: new RegExp(`^${t('Accesses', 'Accès')}`) }).click();
        await popover.getByText(t('Access IDs, matching and sources', 'Identifiants, correspondances et sources'), { exact: true }).click();
      };
      await nav(t('My models', 'Mes modèles')).click();
      await sweep(language, 'My models');
      await accesses('QA Opus saved');
      await sweep(language, 'Accesses popover of a saved card');
      await page.keyboard.press('Escape');
      await page.getByRole('radio', { name: t('Table', 'Tableau'), exact: true }).click();
      await sweep(language, 'My models as a table');
      await page.getByRole('radio', { name: t('Grid', 'Grille'), exact: true }).click();
      // Prices follow the UI language without float noise: Bifrost's 2e-7 per token reads 0.2 per million.
      await scope(new RegExp(`^${t('To add', 'À ajouter')}`)).click();
      await page.getByRole('textbox', { name: t('Search models', 'Rechercher des modèles'), exact: true }).fill('qa-reasoner');
      await accesses('QA Reasoner');
      await expect(popover).toContainText(language === 'fr' ? /Entrée 0,2\s\$\/M/ : /Input \$0\.2\/M/);
      await expect(popover).not.toContainText('0.19999');
      await sweep(language, 'Accesses popover of a model to add');
      await page.keyboard.press('Escape');
      await page.getByRole('textbox', { name: t('Search models', 'Rechercher des modèles'), exact: true }).fill('');
      await scope(new RegExp(`^${t('In Registry', 'Dans Registry')}`)).click();
      // The card sheet: every tab, the access chooser and Review.
      await open('QA Opus saved').click();
      for (const tab of [t('Overview', 'Vue d’ensemble'), t('Properties', 'Propriétés'), t('Sources', 'Sources'), t('Access', 'Accès')]) {
        await sheet().getByRole('button', { name: tab, exact: true }).click();
        await sweep(language, `Card sheet, ${tab} tab`);
      }
      await button(t('Edit accesses', 'Modifier les accès')).click();
      await sweep(language, 'Access chooser');
      await button(t('Review', 'Vérifier')).click();
      await sweep(language, 'Card review');
      await page.keyboard.press('Escape');
      await sheet().waitFor({ state: 'hidden' });
      await nav(t('Groups', 'Groupes')).click();
      await sweep(language, 'Groups');
      await button(t('Edit group', 'Modifier le groupe')).first().click();
      await sweep(language, 'Group sheet');
      await page.keyboard.press('Escape');
      await sheet().waitFor({ state: 'hidden' });
      await nav(t('Virtual keys', 'Clés virtuelles')).click();
      await sweep(language, 'Virtual keys');
      // The adoption dialog reads the reasons Bifrost sends (allow_all_providers blocks this one).
      await keyCard('QA All Providers Key').getByRole('button', { name: t('Review', 'Examiner'), exact: true }).click();
      await button(t('Review adoption', 'Examiner l’adoption')).click();
      await expect(page.getByRole('dialog')).toContainText('allow_all_providers');
      await sweep(language, 'Adoption dialog');
      await page.getByRole('dialog').getByRole('button', { name: t('Cancel', 'Annuler'), exact: true }).click();
      await button(t('All virtual keys', 'Toutes les clés virtuelles')).click();
      await keyCard('QA Development Key').getByRole('button', { name: t('Open', 'Ouvrir'), exact: true }).click();
      await sweep(language, 'Key page');
      await page.getByRole('list', { name: t('Key composition steps', 'Étapes de composition de la clé') }).getByRole('button', { name: new RegExp(`^\\d ${t('Review', 'Vérifier')}`) }).click();
      await sweep(language, 'Key review');
      await nav(t('Settings', 'Réglages')).click();
      for (const section of [t('General', 'Général'), t('Appearance', 'Affichage'), t('Catalog sources', 'Sources'), t('Connection', 'Connexion'), t('AI assistance', 'Assistance'), t('Help', 'Aide')]) {
        await button(section).click();
        await sweep(language, `Settings, ${section}`);
      }
      await button(t('Open catalog data', 'Ouvrir les données du catalogue')).click();
      await page.getByRole('button').filter({ hasText: 'synthetic-provider/qa-chat' }).first().click();
      await sweep(language, 'Catalog data');
    };
    await tour('en');
    await page.getByRole('combobox', { name: 'Language: English', exact: true }).click();
    await page.getByRole('option', { name: 'Français', exact: true }).click();
    await tour('fr');
    await page.getByRole('combobox', { name: 'Langue : français', exact: true }).click();
    await page.getByRole('option', { name: 'English', exact: true }).click();
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

  await test.step('a phone folds the view controls and shows the first card; no gateway dead end', async () => {
    // Wide: View, Shape and Density sit in the toolbar, density with its column count.
    await page.setViewportSize({ width: 1440, height: 950 });
    await expect(page.getByRole('radio', { name: 'Small · 4 columns', exact: true })).toBeVisible();
    // Live mode has no gateway inventory, so Settings offers no way to it.
    await nav('Settings').click();
    await expect(button('Open catalog data')).toBeVisible();
    await expect(button('View gateway')).toHaveCount(0);
    await button('Help').click();
    await expect(page.getByText('Need the gateway details?')).toBeVisible();
    await expect(button('View gateway')).toHaveCount(0);
    await nav('My models').click();
    // 375 px: one column, so the controls fold into View options and density loses its counts.
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('.content-container').evaluate(el => el.scrollTo(0, 0));
    await expect(page.getByRole('radio', { name: 'Table', exact: true })).toHaveCount(0);
    await withinViewport(page.getByRole('button', { name: /^Open .* details$/ }).first());
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await shot('after-mobile-catalogue-375');
    await button('View options').click();
    for (const name of ['Grid', 'Table', 'Rectangle', 'Square', 'Small', 'Medium', 'Large']) await expect(page.getByRole('radio', { name, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('radio', { name: 'Small', exact: true })).toHaveCount(0);
    // An empty Groups page: one Create, no search or view toolbar.
    const empty = await browser.newPage({ baseURL, viewport: { width: 375, height: 812 } });
    empty.on('pageerror', e => errors.push(e.message));
    const catalog = await api('catalog');
    await empty.route('**/api/workspace', r => r.fulfill({ json: { ...workspace, data: { ...workspace.data, groups: [] } } }));
    await empty.route('**/api/catalog', r => r.fulfill({ json: catalog }));
    await empty.goto('/#/groups');
    await empty.getByText('No groups yet', { exact: true }).waitFor();
    await expect(empty.getByRole('button', { name: 'Create group', exact: true })).toHaveCount(1);
    await expect(empty.getByRole('textbox', { name: 'Search groups', exact: true })).toHaveCount(0);
    await expect(empty.getByRole('button', { name: 'View options', exact: true })).toHaveCount(0);
    const create = await empty.getByRole('button', { name: 'Create group', exact: true }).boundingBox();
    expect(create && create.y >= 0 && create.y + create.height <= 812, JSON.stringify(create)).toBeTruthy();
    await testInfo.attach('after-mobile-empty-groups', { body: await empty.screenshot({ animations: 'disabled' }), contentType: 'image/png' });
    await empty.close();
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
    // qa-1 shares qa-0's display name: their card actions must still be told apart.
    const models = Array.from({ length: 65 }, (_, i) => ({
      ...structuredClone(workspace.data.models[0]), id: `qa-${i}`, name: `QA Model ${i === 1 ? 0 : i}`,
      accesses: [{ provider: 'synthetic-provider', id: `synthetic-provider/qa-${i}`, nativeModel: `qa-${i}`, status: 'Configured', route: 'Direct provider' }],
    }));
    const large = { ...workspace, data: { ...workspace.data, models }, discovery: [] };
    const references = models.map(m => ({ ...structuredClone(catalog.references[0]), id: `fixture/${m.id}`, fields: { name: { value: m.name, source: 'fixture', kind: 'declared' } } }));
    const accesses = models.map(m => ({ id: `synthetic-provider/${m.id}`, provider: 'synthetic-provider', model: m.id, referenceId: `fixture/${m.id}`, configured: true, fields: {}, overrides: {} }));
    await stress.route('**/api/workspace', r => r.fulfill({ json: large }));
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    await stress.route('**/api/catalog', async r => { await held; await r.fulfill({ json: { ...catalog, references, accesses } }); });
    await stress.goto('/');
    await expect(stress.getByRole('status', { name: 'Loading model cards…' }), 'A skeleton holds the place of the cards').toBeVisible();
    release();
    await stress.getByRole('button', { name: /Show more/ }).click();
    await expect(stress.getByRole('button', { name: /^Open .* details$/ })).toHaveCount(65);
    const shared = await cardActions(stress);
    expect(shared).toEqual(expect.arrayContaining(['Open QA Model 0 (qa-0) details', 'Open QA Model 0 (qa-1) details']));
    expect(duplicates(shared), 'Cards sharing a display name').toEqual([]);
    await stress.getByRole('link', { name: 'Settings', exact: true }).click();
    await stress.getByRole('button', { name: 'Open catalog data', exact: true }).click();
    await stress.getByRole('button', { name: /Show more/ }).click();
    await stress.getByText('Showing 65 of 65 matching entries.', { exact: false }).waitFor();
    await stress.unroute('**/api/catalog');
    await stress.route('**/api/catalog', r => r.fulfill({ status: 503, json: { error: 'Synthetic metadata offline' } }));
    await stress.getByRole('link', { name: 'My models', exact: true }).click();
    await stress.reload(); // the catalogue is read once per revision: a failure shows on the next load
    await stress.getByText(/Model details unavailable/).waitFor();
    const fallback = await cardActions(stress);
    expect(fallback).toEqual(expect.arrayContaining(['View details · QA Model 0 (qa-1)']));
    expect(duplicates(fallback), 'Fallback cards sharing a display name').toEqual([]);
    await stress.getByRole('button', { name: /^View details/ }).first().click();
    await stress.locator('[data-slot="sheet-content"]').getByRole('button', { name: 'Review', exact: true }).waitFor(); // was Save model
    await stress.close();
  });

  await test.step('no browser JavaScript errors', async () => {
    expect(errors).toEqual([]);
  });
});
