<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useData, useRoute, useRouter } from 'vitepress'
import { content } from './content'
import './style.css'

const props = defineProps({ page: String })
const route = useRoute()
const router = useRouter()
const { site, lang } = useData()
const fr = computed(() => lang.value === 'fr')
const view = ref('B')
const labels = computed(() => fr.value ? ['Actuelle', 'Parcours', 'Fiche'] : ['Current', 'Journey', 'Field guide'])
const data = computed(() => content(fr.value, site.value.base)[props.page])
const original = ref('?docView=A')
let previousAfterChange
const afterChange = async (href) => {
  await previousAfterChange?.(href)
  await readQuery()
}
const pilotPath = /\/(?:fr\/)?(?:guides|INSTALL|USER-GUIDE)(?:\.html)?\/?$/

function enrich(event) {
  const link = event.target?.closest?.('a[href]')
  if (!link) return
  const url = new URL(link.href, location.href)
  if (url.origin !== location.origin || !pilotPath.test(url.pathname) || url.searchParams.has('docView')) return
  new URL(location.href).searchParams.forEach((value, key) => {
    if (key !== 'docView' && !url.searchParams.has(key)) url.searchParams.set(key, value)
  })
  url.searchParams.set('docView', view.value)
  link.href = url.href
  link.dataset.docPilot = 'true'
}
function refreshLinks() {
  document.querySelectorAll('a[data-doc-pilot]').forEach(link => {
    const url = new URL(link.href)
    url.searchParams.set('docView', view.value)
    link.href = url.href
  })
}
async function readQuery() {
  const url = new URL(location.href)
  const value = url.searchParams.get('docView')
  view.value = ['A', 'B', 'C'].includes(value) ? value : 'B'
  url.searchParams.set('docView', 'A')
  url.hash = ''
  original.value = url.pathname + url.search
  await nextTick()
  refreshLinks()
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView()
}
function choose(value) {
  const url = new URL(location.href)
  url.searchParams.set('docView', value)
  history.pushState(null, '', url)
  readQuery()
}
function cycle(delta) { choose(['A', 'B', 'C'][(['A', 'B', 'C'].indexOf(view.value) + delta + 3) % 3]) }
function keyboard(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  if (event.target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], dialog, [role="search"], .VPLocalSearchBox')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    cycle(event.key === 'ArrowLeft' ? -1 : 1)
  }
}
watch(() => route.path, readQuery)
onMounted(() => {
  previousAfterChange = router.onAfterRouteChange
  router.onAfterRouteChange = afterChange
  readQuery()
  window.addEventListener('popstate', readQuery)
  window.addEventListener('keydown', keyboard)
  document.addEventListener('pointerover', enrich)
  document.addEventListener('focusin', enrich)
})
onUnmounted(() => {
  if (router.onAfterRouteChange === afterChange) router.onAfterRouteChange = previousAfterChange
  window.removeEventListener('popstate', readQuery)
  window.removeEventListener('keydown', keyboard)
  document.removeEventListener('pointerover', enrich)
  document.removeEventListener('focusin', enrich)
})
</script>

<template>
  <div class="doc-pilot" :class="`doc-pilot-${view}`">
    <slot v-if="view === 'A'" />
    <template v-else>
      <p class="doc-pilot-notice">
        {{ fr ? 'Proposition de documentation, ne pas exécuter sur un gateway réel.' : 'Documentation proposal; do not execute on a real gateway.' }}
        <a :href="original">{{ fr ? 'Lire le texte original' : 'Read the original' }}</a>
      </p>
      <h1>{{ data.title }}</h1>
      <p class="doc-pilot-goal">{{ data.goal }}</p>
      <div v-if="page === 'index'" class="doc-pilot-hub">
        <section v-for="group in data.groups" :key="group.title">
          <h2>{{ group.title }}</h2>
          <ul>
            <li v-for="link in group.links" :key="link.href">
              <a :href="link.href">{{ link.title }}</a>
              <p>{{ link.text }}</p>
            </li>
          </ul>
        </section>
      </div>
      <div v-else class="doc-pilot-layout">
        <aside class="doc-pilot-prerequisites" :aria-label="fr ? 'Avant de commencer' : 'Before you start'">
          <h2>{{ fr ? 'Avant de commencer' : 'Before you start' }}</h2>
          <p v-for="item in data.before" :key="item" v-html="item" />
          <p class="doc-pilot-caution" v-html="data.caution" />
          <template v-if="view === 'C'">
            <h3>{{ fr ? 'Détails et autres cas' : 'Details and other cases' }}</h3>
            <ul><li v-for="link in data.links" :key="link.href"><a :href="link.href">{{ link.title }}</a></li></ul>
          </template>
        </aside>
        <div class="doc-pilot-actions">
          <section v-for="(step, index) in data.steps" :id="step.id" :key="step.id" class="doc-pilot-step">
            <h2><span v-if="view === 'B'" class="doc-pilot-number">{{ index + 1 }}.</span> {{ step.title }}</h2>
            <p v-for="paragraph in step.text" :key="paragraph" v-html="paragraph" />
            <div v-if="step.downloads" class="doc-pilot-table">
              <table>
                <thead><tr><th>{{ fr ? 'Hôte Linux' : 'Linux host' }}</th><th>Registry v0.4.0 · Bifrost 2.3.0</th></tr></thead>
                <tbody><tr v-for="arch in ['amd64', 'arm64']" :key="arch"><td>{{ arch === 'amd64' ? 'AMD64 (x86_64)' : 'ARM64' }}</td><td><a :href="`https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/bifrost-registry-v0.4.0-linux-${arch}.so`">{{ `bifrost-registry-v0.4.0-linux-${arch}.so` }}</a></td></tr></tbody>
              </table>
            </div>
            <pre v-if="step.command"><code>{{ step.command }}</code></pre>
            <p class="doc-pilot-result"><strong>{{ fr ? 'Attendu : ' : 'Expected: ' }}</strong>{{ step.result }}</p>
          </section>
          <figure v-if="page === 'key'">
            <img :src="`${site.base}images/${fr ? 'fr' : 'en'}/key-composer.png`" :alt="fr ? 'Compositeur de clé virtuelle' : 'Virtual key composer'" />
            <figcaption>{{ fr ? 'Repère : regardez les accès retenus et les exclusions de cette clé. Capture de fixture synthétique historique, pas un gateway connecté ni une preuve d’appel modèle.' : 'Look at the selected accesses and this key’s exclusions. Historical synthetic fixture screenshot, not a connected gateway or proof of a model call.' }}</figcaption>
          </figure>
          <section v-if="view === 'B'" class="doc-pilot-details">
            <h2>{{ fr ? 'Détails et autres cas' : 'Details and other cases' }}</h2>
            <ul><li v-for="link in data.links" :key="link.href"><a :href="link.href">{{ link.title }}</a></li></ul>
          </section>
          <a class="doc-pilot-next" :href="data.next.href">{{ data.next.title }}</a>
        </div>
      </div>
    </template>
    <nav class="doc-pilot-switcher" :aria-label="fr ? 'Choisir la vue documentaire' : 'Choose documentation view'">
      <span>{{ fr ? 'Prototype doc — non publié' : 'Doc prototype — unpublished' }}</span>
      <div>
        <button :aria-label="fr ? 'Vue précédente' : 'Previous view'" @click="cycle(-1)">←</button>
        <button v-for="(key, index) in ['A', 'B', 'C']" :key="key" :aria-pressed="view === key" @click="choose(key)">{{ key }} {{ labels[index] }}</button>
        <button :aria-label="fr ? 'Vue suivante' : 'Next view'" @click="cycle(1)">→</button>
      </div>
      <span class="doc-pilot-live" aria-live="polite" aria-atomic="true">{{ view }} — {{ labels[['A', 'B', 'C'].indexOf(view)] }}</span>
    </nav>
  </div>
</template>
