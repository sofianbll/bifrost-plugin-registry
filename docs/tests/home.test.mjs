import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('legacy root fragments retain unique static links to their equivalent guide sections', async () => {
  const legacy = JSON.parse(await readFile(new URL('./legacy-anchors.json', import.meta.url), 'utf8'))
  for (const locale of ['', 'fr/']) {
    const html = await readFile(new URL(`../.vitepress/dist/${locale}index.html`, import.meta.url), 'utf8')
    const guides = await readFile(new URL(`../.vitepress/dist/${locale}guides.html`, import.meta.url), 'utf8')
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
    assert.equal(ids.length, new Set(ids).size, `${locale}: unique homepage IDs`)
    for (const anchor of legacy[`${locale}guides.html`]) {
      assert.ok(ids.includes(anchor), `${locale || '/'}#${anchor}: legacy root target exists without JavaScript`)
      assert.ok(html.includes(`href="/bifrost-plugin-registry/${locale}guides#${anchor}"`), `${anchor}: static link keeps base, locale and section`)
      assert.ok(guides.includes(`id="${anchor}"`), `${anchor}: destination exists`)
    }
  }
})

test('both generated homepages present the accepted product-first copy without JavaScript', async () => {
  for (const [locale, title] of [
    ['', 'Organize your models and choose which ones each Bifrost key lists.'],
    ['fr/', 'Organisez vos modèles et choisissez ceux de chaque clé Bifrost.'],
  ]) {
    const html = await readFile(new URL(`../.vitepress/dist/${locale}index.html`, import.meta.url), 'utf8')
    assert.ok(html.includes(title), `the ${locale || 'English'} homepage contains its accepted headline in static HTML`)
    assert.equal((html.match(/<h1\b/g) || []).length, 1)
  }
})

test('generated guide indexes expose the accepted tasks and preserve their legacy anchors', async () => {
  const anchors = JSON.parse(await readFile(new URL('./legacy-anchors.json', import.meta.url), 'utf8'))
  for (const [route, title, tasks] of [
    ['guides.html', 'Registry guides', ['Get started', 'Manage access', 'Operate and troubleshoot', 'Reference']],
    ['fr/guides.html', 'Guides Registry', ['Démarrer', 'Gérer les accès', 'Exploiter et dépanner', 'Référence']],
  ]) {
    const html = await readFile(new URL(`../.vitepress/dist/${route}`, import.meta.url), 'utf8')
    assert.ok(html.includes(title), `${route} presents the task index without JavaScript`)
    for (const task of tasks) assert.ok(html.includes(task), `${route} offers ${task}`)
    for (const anchor of anchors[route]) assert.ok(html.includes(`id="${anchor}"`), `${route} preserves #${anchor}`)
    assert.doesNotMatch(html, /docView=|[?&]variant=/)
    assert.doesNotMatch(html, /href="[^"]*README\.html/, 'GitHub-relative README links resolve to published guide indexes')
  }
})
