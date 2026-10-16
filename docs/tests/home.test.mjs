import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

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
