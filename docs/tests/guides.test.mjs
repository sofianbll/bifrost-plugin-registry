import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const built = (route) => readFile(new URL(`../.vitepress/dist/${route}`, import.meta.url), 'utf8')

test('the installation starts with the accepted new-test-instance procedure in static HTML', async () => {
  const html = await built('INSTALL.html')
  assert.match(html, /Install Registry on a test instance/)
  assert.match(html, /1\. Download the compatible files/)
  assert.match(html, /5\. Check loading and connection/)
  const text = html.replace(/<[^>]*>/g, '')
  assert.ok(text.indexOf('Already running a gateway? Stop here.') < text.indexOf('docker pull'))
})

test('French installation offers the equivalent five-step static procedure', async () => {
  const html = await built('fr/INSTALL.html')
  assert.match(html, /Installer Registry sur une instance de test/)
  assert.match(html, /1\. Télécharger les fichiers compatibles/)
  assert.match(html, /5\. Vérifier le chargement et la connexion/)
})

test('both first-key guides expose selection, publication and observed-result interpretation without JavaScript', async () => {
  for (const [route, title, first, last, difference] of [
    ['USER-GUIDE.html', 'Choose models for an application', '1. Prepare the models', '5. Read the result', 'Verified · 1 difference'],
    ['fr/USER-GUIDE.html', 'Choisir les modèles d’une application', '1. Préparer les modèles', '5. Lire le résultat', 'Vérifiée · 1 écart'],
  ]) {
    const html = await built(route)
    for (const wording of [title, first, last, difference]) assert.ok(html.includes(wording), `${route}: ${wording}`)
    assert.ok(html.indexOf('key-composer') < html.indexOf('id="publish"'), `${route}: selection image precedes publication`)
  }
})

test('all four guides retain every independently captured legacy target and unique IDs', async () => {
  const legacy = JSON.parse(await readFile(new URL('./legacy-anchors.json', import.meta.url), 'utf8'))
  for (const route of ['INSTALL.html', 'fr/INSTALL.html', 'USER-GUIDE.html', 'fr/USER-GUIDE.html']) {
    const html = await built(route)
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
    assert.equal(ids.length, new Set(ids).size, `${route}: no duplicate IDs`)
    for (const anchor of legacy[route]) assert.ok(ids.includes(anchor), `${route}#${anchor}`)
    assert.equal((html.match(/<h1\b/g) || []).length, 1, `${route}: one task heading`)
    const steps = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)]
      .map((match) => match[1].replace(/<[^>]*>/g, ''))
      .filter((text) => /^[1-5]\. /.test(text))
    assert.equal(steps.length, 5, `${route}: five primary actions`)
    assert.doesNotMatch(html, /docView=|[?&]variant=|DocsPrototype|ClientOnly/)
  }
})

test('all four guides link to existing static pages and anchor targets', async () => {
  for (const route of ['INSTALL.html', 'fr/INSTALL.html', 'USER-GUIDE.html', 'fr/USER-GUIDE.html']) {
    const html = await built(route)
    const current = new URL(route, 'https://docs.invalid/bifrost-plugin-registry/')
    for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
      const target = new URL(href.replaceAll('&amp;', '&'), current)
      if (target.origin !== current.origin || !target.pathname.endsWith('.html')) continue
      assert.ok(target.pathname.startsWith('/bifrost-plugin-registry/'), `${route}: link remains under the site base`)
      const targetHtml = await built(target.pathname.slice('/bifrost-plugin-registry/'.length))
      if (target.hash) {
        const anchor = decodeURIComponent(target.hash.slice(1))
        assert.ok(targetHtml.includes(`id="${anchor}"`), `${route}: ${href} resolves`)
      }
    }
  }
})
