<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { copy } from './copy'
import catalogueEn from '../../images/en/catalogue-grid.png'
import catalogueFr from '../../images/fr/catalogue-grid.png'
import keyEn from '../../images/en/key-composer.png'
import keyFr from '../../images/fr/key-composer.png'

const { lang } = useData()
const french = computed(() => lang.value === 'fr')
const text = computed(() => copy[french.value ? 'fr' : 'en'])
const page = (name: string) => withBase(`/${french.value ? 'fr/' : ''}${name}`)
const shots = computed(() => [
  { ...text.value.catalogue, src: french.value ? catalogueFr : catalogueEn },
  { ...text.value.key, src: french.value ? keyFr : keyEn },
])
const links = computed(() => [page('INSTALL'), page('USER-GUIDE'), page('SECURITY'), 'https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md'])
</script>

<template>
  <div class="registry-home">
    <header class="home-hero">
      <h1>{{ text.title }}</h1>
      <p class="home-intro">{{ text.intro }}</p>
      <div class="home-actions">
        <a class="home-button primary" :href="page('INSTALL')">{{ text.install }}</a>
        <a class="home-button" :href="page('guides')">{{ text.docs }}</a>
      </div>
      <p class="home-independent">{{ text.independent }}</p>
    </header>
    <template v-for="(shot, index) in shots" :key="shot.src">
      <section class="home-shot">
        <h2>{{ shot.title }}</h2>
        <p>{{ shot.text }}</p>
        <figure>
          <a :href="shot.src" :aria-label="`${text.full}: ${shot.title}`"><img :src="shot.src" :alt="shot.alt" :loading="index === 0 ? 'eager' : 'lazy'" width="1440" height="900" /></a>
          <figcaption>{{ text.caption }}</figcaption>
        </figure>
      </section>
      <section v-if="index === 0" class="home-features">
        <h2>{{ text.featuresTitle }}</h2>
        <div class="home-feature-grid">
          <article v-for="feature in text.features" :key="feature.title"><h3>{{ feature.title }}</h3><p>{{ feature.text }}</p></article>
        </div>
      </section>
    </template>
    <div class="home-closing">
      <section><h2>{{ text.limitsTitle }}</h2><ul><li v-for="limit in text.limits" :key="limit">{{ limit }}</li></ul></section>
      <section><h2>{{ text.linksTitle }}</h2><ul><li v-for="(label, index) in text.links" :key="label"><a :href="links[index]">{{ label }}</a></li></ul></section>
    </div>
  </div>
</template>
