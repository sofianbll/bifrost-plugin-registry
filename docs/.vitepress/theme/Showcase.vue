<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useData } from 'vitepress'
import { copy, type Variant } from './copy'
import VariantA from './VariantA.vue'
import VariantB from './VariantB.vue'
import VariantC from './VariantC.vue'

// Throwaway #164: three hierarchies on the existing EN/FR home routes.
const { lang } = useData()
const text = computed(() => copy[lang.value === 'fr' ? 'fr' : 'en'])
const prefix = computed(() => lang.value === 'fr' ? '/fr' : '')
const variant = ref<Variant>('A')
const dev = import.meta.env.DEV
const variants: Variant[] = ['A', 'B', 'C']
const components = { A: VariantA, B: VariantB, C: VariantC }

function readVariant() {
  const value = new URL(window.location.href).searchParams.get('variant')
  variant.value = variants.includes(value as Variant) ? value as Variant : 'A'
}
function choose(value: Variant) {
  const url = new URL(window.location.href)
  url.searchParams.set('variant', value)
  window.history.pushState({}, '', url)
  variant.value = value
}
function cycle(direction: number) {
  choose(variants[(variants.indexOf(variant.value) + direction + variants.length) % variants.length])
}
function keyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="search"]')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    cycle(event.key === 'ArrowRight' ? 1 : -1)
  }
}
function keepLanguageVariant(event: Event) {
  const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('.VPNavBarTranslations a, .VPNavScreenTranslations a')
  if (!link) return
  const url = new URL(link.href)
  url.searchParams.set('variant', variant.value)
  link.href = url.href
}
onMounted(() => {
  if (!dev) return
  readVariant()
  window.addEventListener('popstate', readVariant)
  window.addEventListener('keydown', keyboard)
  // VitePress captures clicks on window, so update language links before its router reads them.
  document.addEventListener('pointerover', keepLanguageVariant, true)
  document.addEventListener('focusin', keepLanguageVariant, true)
})
onUnmounted(() => {
  if (!dev) return
  window.removeEventListener('popstate', readVariant)
  window.removeEventListener('keydown', keyboard)
  document.removeEventListener('pointerover', keepLanguageVariant, true)
  document.removeEventListener('focusin', keepLanguageVariant, true)
})
</script>

<template>
  <div class="showcase" :class="{ 'showcase-prototype': dev }" :data-variant="variant">
    <component :is="components[variant]" :text="text" :prefix="prefix" />
    <nav v-if="dev" class="prototype-switcher" :aria-label="text.prototype">
      <div class="prototype-note">{{ text.prototype }}</div>
      <div class="prototype-controls">
        <button type="button" :aria-label="text.previous" @click="cycle(-1)">←</button>
        <button v-for="key in variants" :key="key" type="button" :aria-pressed="variant === key" @click="choose(key)">{{ key }} <span>{{ text.variants[key][0] }}</span></button>
        <button type="button" :aria-label="text.next" @click="cycle(1)">→</button>
      </div>
      <p aria-live="polite">{{ variant }} — {{ text.variants[variant][1] }}</p>
    </nav>
  </div>
</template>
