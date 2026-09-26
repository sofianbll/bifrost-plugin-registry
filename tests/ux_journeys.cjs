// Run against a fresh `go run ./tests/ui-fixture`; no real provider is contacted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = 'http://127.0.0.1:4174';
const out = 'dist/checks/ux-audit';
const token = process.env.QA_FIXTURE_ADMIN_TOKEN || 'qa-fixture-admin-token-only-1234567890';
const checks = [];
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const headers = { Authorization: `Bearer ${token}` };
  const api = async path => { const r = await page.request.get(`${base}/api/${path}`, { headers }); assert.equal(r.status(), 200); return r.json(); };
  const button = name => page.getByRole('button', { name, exact: true });
  const nav = name => page.getByRole('link', { name, exact: true });
  const sheet = () => page.locator('[data-slot="sheet-content"]');
  const shot = name => page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled' });
  const check = async (name, run) => { await run(); checks.push(name); console.log(`PASS ${name}`); };
  const withinViewport = async locator => {
    await page.waitForFunction(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
    }, await locator.elementHandle(), { timeout: 2000 });
    const box = await locator.boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= page.viewportSize().width + 1 && box.y + box.height <= page.viewportSize().height + 1, JSON.stringify(box));
  };
  try {
    const workspace = await api('workspace');
    assert.equal(workspace.connection.version, '2.2.3-fixture', 'This destructive QA is restricted to the synthetic fixture');
    await page.goto(base);
    await check('authentication and catalog', async () => {
      await page.getByLabel('Admin token', {exact: true}).fill('invalid-fixture-token');
      await button('Sign in').click();
      await page.getByRole('alert').filter({hasText: 'Invalid'}).waitFor();
      await page.getByLabel('Admin token', {exact: true}).fill(token);
      await button('Sign in').click();
      await button('Details').first().waitFor();
      await shot('after-catalog-light');
    });
    await check('model cancel protects draft; focus stays in editor', async () => {
      await button('Details').first().click();
      await page.getByLabel('Display name', {exact:true}).fill('QA draft preserved');
      assert.ok(await sheet().evaluate(el => el.contains(document.activeElement)));
      await button('Cancel').click();
      await page.getByRole('heading', {name:'Discard model changes?'}).waitFor();
      await button('Keep editing').click();
      assert.equal(await page.getByLabel('Display name', {exact:true}).inputValue(), 'QA draft preserved');
      await button('Cancel').click();
      await button('Discard changes').click();
      await sheet().waitFor({state:'hidden'});
    });
    await check('unchanged discovery closes without false discard warning', async () => {
      await button('Review & add').first().click();
      await button('Cancel').click();
      await sheet().waitFor({state:'hidden'});
      assert.equal(await page.getByRole('heading', {name:'Discard model changes?'}).count(), 0);
    });
    await check('custom provider derives exposed ID and validation stays beside Save', async () => {
      await button('Add model').first().click();
      await button('Advanced: custom model').click();
      await page.getByRole('combobox', {name:'Model ID *', exact:true}).fill('qa-custom');
      await page.getByLabel('Display name', {exact:true}).fill('QA Custom');
      await page.getByRole('combobox', {name:'Serving provider *', exact:true}).fill('synthetic-provider');
      await page.keyboard.press('Tab');
      assert.equal(await page.getByLabel('Exposed provider ID').inputValue(), 'synthetic-provider/qa-custom');
      assert.equal(await page.getByLabel('Exposed provider ID').getAttribute('readonly'), '');
      await button('Save model').click();
      await sheet().getByRole('alert').waitFor();
      await withinViewport(sheet().getByRole('alert'));
      await shot('after-editor-validation');
      await button('Cancel').click(); await button('Discard changes').click();
    });
    await check('group filter retains hidden selections and cancel protects draft', async () => {
      await nav('Groups').click(); await button('Create group').click();
      await page.getByLabel('Group name', {exact:true}).fill('QA Browser Group');
      await page.getByRole('checkbox', {name:'Select QA Code', exact:true}).check();
      await page.getByLabel('Search group models', {exact:true}).fill('vision');
      await page.getByRole('checkbox', {name:'Select QA Vision', exact:true}).check();
      await page.getByText(/2 total selected/).waitFor();
      await button('Cancel').click(); await button('Keep editing').click();
      assert.equal(await page.getByLabel('Group name').inputValue(), 'QA Browser Group');
      await button('Publish group').click();
      await sheet().waitFor({state:'hidden'});
      assert.deepEqual((await api('workspace')).data.groups.find(g => g.name === 'QA Browser Group').members.sort(), ['qa-code','qa-vision']);
    });
    await check('key origin and exclusion publish with independent readback', async () => {
      await nav('Virtual Keys').click();
      await page.locator('[data-slot="card"]').filter({has:page.getByText('QA Development Key', {exact:true})}).getByRole('button', {name:'Open key'}).click();
      await page.getByText('From QA Development', {exact:true}).first().waitFor();
      assert.equal(await button('Publish changes').isDisabled(), true);
      assert.equal(await page.getByText('+ new', {exact:true}).count(), 0, 'No draft changes despite absent readback');
      await page.getByRole('button', {name:'Exclude from this key: QA Code', exact:true}).click();
      await page.getByText(/From QA Development · Excluded locally/).first().waitFor();
      await button('Publish changes').click();
      await page.getByText('Verified', {exact:true}).waitFor();
      const ws = await api('workspace');
      assert.deepEqual(ws.data.keys.find(k => k.id === 'vk-qa-dev').policy.excluded, ['qa-code']);
      assert.deepEqual(ws.data.keys.find(k => k.id === 'vk-qa-dev').publication.actual, ['synthetic-provider/qa-chat']);
      assert.deepEqual(ws.data.keys.find(k => k.id === 'vk-qa-visual').policy.groups, ['qa-visual']);
      await shot('after-key-published');
    });
    await check('key draft navigation guard', async () => {
      await page.getByRole('button', {name:'Restore to this key: QA Code', exact:true}).click();
      await button('All keys').click();
      await button('Keep editing').click();
      await page.getByRole('heading',{name:'QA Development Key',exact:true}).waitFor();
      await button('Discard draft').click();
    });
    await check('browser Back and Forward preserve navigation and draft guard', async () => {
      await button('All keys').click();
      await page.locator('[data-slot="card"]').filter({has:page.getByText('QA Development Key',{exact:true})}).getByRole('button',{name:'Open key'}).click();
      await page.getByRole('button',{name:'Restore to this key: QA Code',exact:true}).click();
      await page.goBack();
      await button('Keep editing').click();
      await page.getByRole('heading',{name:'QA Development Key',exact:true}).waitFor();
      await button('Discard draft').click();
      await button('All keys').click();
      await page.goBack();
      await page.getByRole('heading',{name:'QA Development Key',exact:true}).waitFor();
      await page.goForward();
      await page.getByLabel('Search keys',{exact:true}).waitFor();
      await page.locator('[data-slot="card"]').filter({has:page.getByText('QA Development Key',{exact:true})}).getByRole('button',{name:'Open key'}).click();
    });
    await check('disabled key distinguishes retained selection from usable access', async () => {
      await button('Disable').click();
      await page.getByText(/This key is disabled. Clients have no model access/).waitFor();
      const ws=await api('workspace');
      assert.equal(ws.data.keys.find(k=>k.id==='vk-qa-dev').active,false);
      await button('Enable').click();
      await button('Disable').waitFor();
      await page.getByText('Verified',{exact:true}).waitFor();
    });
    await check('publication failure retains key draft and recovery action', async () => {
      await page.getByRole('button', {name:'Restore to this key: QA Code', exact:true}).click();
      const fail = route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic unavailable response'})});
      await page.route('**/api/workspace', route => route.request().method() === 'PUT' ? fail(route) : route.continue());
      await button('Publish changes').click();
      await page.getByRole('alert').filter({hasText:'Synthetic unavailable'}).first().waitFor();
      assert.equal(await button('Publish changes').isEnabled(), true);
      await page.unroute('**/api/workspace');
      await button('Discard draft').click();
    });
    await check('unmanaged key does not present a fabricated catalog', async () => {
      await button('All keys').click();
      await page.locator('[data-slot="card"]').filter({has:page.getByText('QA Unmanaged Key', {exact:true})}).getByRole('button', {name:'Open key'}).click();
      await button('Adopt in Registry').first().waitFor();
      assert.equal(await page.getByText('Compose catalog', {exact:true}).count(), 0);
      assert.equal(await page.getByText('Draft preview', {exact:true}).count(), 0);
      await shot('after-unmanaged-key');
    });
    await check('search recovery clears filter instead of starting creation', async () => {
      await button('All keys').click(); await page.getByLabel('Search keys').fill('nothing-matches-qa');
      await button('Clear search').click();
      await page.getByText('QA Development Key', {exact:true}).first().waitFor();
    });
    await check('key creation secret has a clipboard denial fallback', async () => {
      await button('Create key').click(); await page.getByLabel('Key name', {exact:true}).fill('QA Browser Key');
      await page.getByRole('dialog').getByRole('button', {name:'Create key', exact:true}).click();
      await page.getByLabel('Virtual key secret', {exact:true}).waitFor();
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async()=>{throw new Error('denied')}}}));
      await button('Copy secret').click();
      await page.getByRole('alert').filter({hasText:'Ctrl+C or Cmd+C'}).waitFor();
      const input = page.getByLabel('Virtual key secret', {exact:true});
      assert.ok(await input.evaluate(el=>el.selectionEnd-el.selectionStart===el.value.length));
      await button('Done').click();
      await input.waitFor({state:'hidden'});
      assert.equal(await input.count(), 0);
    });
    await check('metadata correction uses visible dialog and persists', async () => {
      await nav('Sources & References').click();
      await page.getByRole('button').filter({hasText:'synthetic-provider/qa-chat'}).first().click();
      await button('Edit field').click();
      const dlg=page.getByRole('dialog');
      await dlg.waitFor();
      await dlg.locator('input').fill('QA metadata corrected');
      await dlg.getByRole('button', {name:'Save correction'}).click();
      await dlg.waitFor({state:'hidden'});
      const cat=await api('catalog');
      assert.equal(cat.accesses.find(a=>a.model==='qa-chat').fields.name.value, 'QA metadata corrected');
    });
    await check('mobile sheet, footer, focus and metadata detail fit viewport', async () => {
      await nav('Groups').click(); await page.setViewportSize({width:390,height:844});
      await button('Create group').click(); await withinViewport(sheet());
      await withinViewport(button('Publish group'));
      for (const target of [sheet().getByRole('heading', {name:'Create group',exact:true}), sheet().getByRole('button', {name:'Close',exact:true}), button('Publish group')]) {
        assert.ok(await target.evaluate(el => {const r=el.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit)}), 'Toast must not cover the mobile title, close control or publish action');
      }
      assert.ok(await sheet().evaluate(el=>el.contains(document.activeElement)));
      await shot('after-mobile-group');
      await button('Cancel').click();
      await page.setViewportSize({width:1440,height:950}); await nav('Model Catalog').click();
      await button('Details').first().click(); await page.setViewportSize({width:390,height:620});
      await withinViewport(sheet()); await withinViewport(button('Save model')); await shot('after-mobile-editor');
      await button('Cancel').click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth));
      await page.setViewportSize({width:1440,height:950});
      await nav('Sources & References').click();
      await page.setViewportSize({width:390,height:844});
      await page.getByRole('button').filter({hasText:'synthetic-provider/qa-code'}).first().click();
      await withinViewport(button('Back to list'));
      await button('Edit field').click();
      await withinViewport(page.getByRole('dialog'));
      await shot('after-mobile-metadata');
      await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).click();
      await page.setViewportSize({width:1440,height:950});await nav('Model Catalog').click();await page.setViewportSize({width:390,height:844});
    });
    await check('dark theme and logout clear secrets and workspace', async () => {
      await button('Use dark theme').click(); await shot('after-catalog-dark-mobile');
      assert.equal(await page.locator('html').getAttribute('class'), 'dark');
      await button('Sign out').click(); await button('Sign in').waitFor();
      assert.equal(await page.getByText('QA Code',{exact:true}).count(),0);
      assert.equal(await page.evaluate(()=>[...Object.values(localStorage),...Object.values(sessionStorage)].some(v=>v.includes('sk-bf-'))),false);
    });
    await check('large catalogs remain reachable and metadata failure keeps model editing', async () => {
      const stress = await browser.newPage({ viewport: {width:1440,height:950} });
      stress.setDefaultTimeout(10000);
      stress.on('pageerror',e=>errors.push(e.message));
      const catalog = await api('catalog');
      const models = Array.from({length:65},(_,i)=>({...structuredClone(workspace.data.models[0]),id:`qa-${i}`,name:`QA Model ${i}`,accesses:[{provider:'synthetic-provider',id:`synthetic-provider/qa-${i}`,nativeModel:`qa-${i}`,status:'Configured',route:'Direct provider'}]}));
      const large = {...workspace,data:{...workspace.data,models},discovery:[]};
      const refs = models.map(m=>({...structuredClone(catalog.references[0]),id:`fixture/${m.id}`,fields:{name:{value:m.name,source:'fixture',kind:'declared'}}}));
      const accesses=models.map(m=>({id:`synthetic-provider/${m.id}`,provider:'synthetic-provider',model:m.id,referenceId:`fixture/${m.id}`,configured:true,fields:{},overrides:{}}));
      await stress.route('**/api/workspace',r=>r.fulfill({json:large}));
      await stress.route('**/api/catalog',r=>r.fulfill({json:{...catalog,references:refs,accesses}}));
      await stress.goto(base);
      await stress.getByRole('button',{name:/Show more/}).click();
      assert.equal(await stress.getByRole('button',{name:'Details',exact:true}).count(),65);
      await stress.getByRole('link',{name:'Sources & References',exact:true}).click();
      await stress.getByRole('button',{name:/Show more/}).click();
      await stress.getByText('Showing 65 of 65 matching accesses.',{exact:false}).waitFor();
      await stress.unroute('**/api/catalog');
      await stress.route('**/api/catalog',r=>r.fulfill({status:503,json:{error:'Synthetic metadata offline'}}));
      await stress.getByRole('link',{name:'Model Catalog',exact:true}).click();
      await stress.getByText(/Model details unavailable/).waitFor();
      await stress.getByRole('button',{name:'View details',exact:true}).first().click();
      await stress.getByRole('button',{name:'Save model',exact:true}).waitFor();
      await stress.close();
    });
    assert.deepEqual(errors,[]);
    checks.push('no browser JavaScript errors');
  } catch (e) {
    await shot('failure');
    console.error(e);
    process.exitCode=1;
  } finally {
    fs.writeFileSync(`${out}/browser-report.json`, JSON.stringify({passed:checks.length,checks,errors,scope:'Real Registry HTTP + production React build; synthetic Bifrost, no native ABI or provider inference qualification'},null,2)+'\n');
    await browser.close();
  }
})();
