<script setup lang="ts">
import type { Copy } from './copy'
defineProps<{ text: Copy }>()
</script>

<template>
  <section class="showcase-features" aria-labelledby="features-title">
    <h2 id="features-title">{{ text.featuresTitle }}</h2>
    <div class="showcase-feature-list">
      <article v-for="feature in text.features" :key="feature.title">
        <h3>{{ feature.title }}</h3>
        <p>{{ feature.text }}</p>
      </article>
    </div>
  </section>
</template>
