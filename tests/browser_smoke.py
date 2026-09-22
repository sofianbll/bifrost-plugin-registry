#!/usr/bin/env python3
"""Local UI smoke; requires playwright and Chromium. Never contacts a provider.
Run after building dist/registry-linux-amd64. Uses a disposable demo config.
"""
import json,os,pathlib,shutil,socket,subprocess,tempfile,time,urllib.request,urllib.error
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
TOKEN='local-browser-test-token-000000000000000000000000'

def main():
    checks=[]
    with tempfile.TemporaryDirectory(prefix='registry-ui-') as tmp:
        cfg=pathlib.Path(tmp)/'registry.json'
        shutil.copy(ROOT/'configs/registry.demo.json',cfg)
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
        base=f'http://127.0.0.1:{port}'
        binary=os.environ.get('REGISTRY_TEST_BINARY',str(ROOT/'dist/registry-linux-amd64'))
        proc=subprocess.Popen([binary,'serve','--config',str(cfg),'--listen',f'127.0.0.1:{port}'],env={**os.environ,'REGISTRY_ADMIN_TOKEN':TOKEN},stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        try:
            for _ in range(100):
                try:
                    with urllib.request.urlopen(base,timeout=.2) as r:
                        if r.status==200:break
                except OSError:time.sleep(.05)
            else:raise RuntimeError('local UI did not start')
            with sync_playwright() as p:
                browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH',shutil.which('chromium')),headless=True,args=['--no-sandbox'])
                page=browser.new_page(viewport={'width':1512,'height':1050},device_scale_factor=1)
                errors=[];requests=[]
                page.on('pageerror',lambda err:errors.append(str(err)))
                page.on('request',lambda req:requests.append(req.url))
                bridge_mode=os.environ.get('REGISTRY_DOM_BRIDGE')=='1'
                if bridge_mode:
                    # Offline DOM rendering: no browser URL navigation. The Python
                    # bridge exercises our actual local HTTP server, not a mock API.
                    def bridge(path, opts):
                        headers=opts.get('headers',{})
                        body=opts.get('body')
                        req=urllib.request.Request(base+path,headers=headers,data=body.encode() if body is not None else None,method=opts.get('method','GET'))
                        try:
                            with urllib.request.urlopen(req,timeout=5) as r:return {'status':r.status,'headers':dict(r.headers),'body':r.read().decode()}
                        except urllib.error.HTTPError as e:return {'status':e.code,'headers':dict(e.headers),'body':e.read().decode()}
                    import re
                    page.expose_function('localTestBridge',bridge)
                    html=(ROOT/'internal/admin/web/index.html').read_text()
                    html=re.sub(r'<link[^>]+app.css[^>]*>', '',html)
                    html=re.sub(r'<script[^>]+app.js[^>]*></script>', '',html)
                    page.set_content(html)
                    page.add_style_tag(content=(ROOT/'internal/admin/web/app.css').read_text())
                    page.evaluate("() => { window.fetch=async(path,opts={})=>{const r=await window.localTestBridge(path,opts);return new Response(r.body,{status:r.status,headers:r.headers})}; }")
                    page.add_script_tag(content=(ROOT/'internal/admin/web/app.js').read_text())
                else:
                    page.goto(base)
                page.locator('#admin-token').fill('incorrect-but-long-enough-to-submit-12345')
                page.locator('#login-form button').click()
                page.locator('#login-error').filter(has_text='authentication').wait_for()
                checks.append('invalid_admin_token_rejected')
                page.locator('#admin-token').fill(TOKEN)
                page.locator('#login-form button').click()
                page.locator('#workspace').wait_for(state='visible')
                assert page.locator('tbody tr').count()==5
                checks.append('login_and_catalogue')
                page.screenshot(path=str(ROOT/'reports/ui-models-dark.png'),full_page=True)
                page.locator('#search').fill('mistral')
                assert page.locator('tbody tr').count()==1
                page.locator('#search').fill('')
                page.locator('#filter-source').select_option('demo-antigravity')
                assert page.locator('tbody tr').count()==2
                page.locator('#filter-source').select_option('')
                checks.append('search_and_filters')
                page.locator('[data-action="edit"][data-id="codex-reasoning"]').click()
                page.locator('#f-evidence').fill('FIXTURE changed by browser test. Not a live verification.')
                page.locator('#editor-form button[type=submit]').click()
                page.locator('#editor').wait_for(state='hidden')
                assert page.locator('#save').is_enabled()
                page.locator('#save').click()
                page.locator('#save-state').filter(has_text='Enregistré').wait_for()
                assert 'FIXTURE changed' in json.loads(cfg.read_text())['models'][0]['evidence']
                checks.append('edit_validate_atomic_save')
                page.locator('[data-tab="groups"]').click()
                assert page.locator('.cards .card').count()==2
                page.locator('[data-tab="keys"]').click()
                page.locator('[data-action="preview"][data-id="DEMO-vk-dev"]').click()
                page.locator('#output').wait_for(state='visible')
                assert page.locator('#output tbody tr').count()==9
                page.locator('#close-output').click()
                checks.append('groups_and_key_preview')
                if not bridge_mode:
                    page.locator('[data-action="edit"][data-kind="policies"][data-id="DEMO-vk-think"]').click()
                    page.locator('#f-raw_token').fill('sk-bf-browser-test-changed-token')
                    page.locator('#f-naming').select_option('provider/model')
                    page.locator('#editor-form button[type=submit]').click()
                    page.locator('#editor').wait_for(state='hidden')
                    page.locator('#save').click()
                    page.locator('#save-state').filter(has_text='Enregistré').wait_for()
                    import hashlib
                    key=json.loads(cfg.read_text())['policies'][1]
                    assert key['token_sha256']==hashlib.sha256(b'sk-bf-browser-test-changed-token').hexdigest()
                    assert 'sk-bf-browser-test-changed-token' not in cfg.read_text()
                    checks.append('client_side_token_hash_no_raw_persistence')
                page.locator('[data-tab="deploy"]').click()
                page.locator('[data-action="plan"]').click()
                page.locator('#plan-json').wait_for()
                assert 'allowed_models_by_provider' in page.locator('#plan-json').inner_text()
                if not bridge_mode:
                    with page.expect_download() as download:
                        page.locator('#download-plan').click()
                    assert download.value.suggested_filename=='bifrost-native-plan.json'
                page.locator('#close-output').click()
                checks.append('native_plan_preview' if bridge_mode else 'native_plan_preview_and_export')
                page.locator('[data-tab="settings"]').click()
                page.locator('#default-naming').select_option('both')
                page.locator('#save').click()
                page.locator('#save-state').filter(has_text='Enregistré').wait_for()
                checks.append('default_naming_save')
                page.locator('[data-tab="models"]').click()
                page.locator('#theme-toggle').click()
                assert page.locator('html').get_attribute('data-theme')=='light'
                page.screenshot(path=str(ROOT/'reports/ui-models-light.png'),full_page=True)
                page.set_viewport_size({'width':390,'height':844})
                assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
                page.screenshot(path=str(ROOT/'reports/ui-mobile.png'),full_page=True)
                checks.append('themes_and_responsive_layout')
                if not bridge_mode:
                    assert page.evaluate('localStorage.length')==0
                    assert page.evaluate('sessionStorage.length')==0
                assert not errors,errors
                assert all(u.startswith(base) for u in requests),requests
                checks.append('no_external_requests_no_js_errors' if bridge_mode else 'no_browser_storage_no_external_requests_no_js_errors')
                page.set_viewport_size({'width':1512,'height':1050})
                page.locator('#logout').click()
                page.locator('#login').wait_for(state='visible')
                assert page.locator('#page').inner_text()==''
                checks.append('logout_clears_workspace')
                browser.close()
        finally:
            proc.terminate()
            try:proc.wait(timeout=5)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
    report={'passed':len(checks),'checks':checks,'data':'synthetic demo only','native_bifrost_tested':False,'mode':'offline_dom_with_actual_local_http_bridge' if bridge_mode else 'browser_navigation','not_tested':['browser_network_CSP_enforcement','WebCrypto_in_secure_context','download_permission','browser_storage'] if bridge_mode else []}
    (ROOT/'reports/browser-tests.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
if __name__=='__main__':main()
