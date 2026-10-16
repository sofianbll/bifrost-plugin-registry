<script setup lang="ts">
import type { Copy } from './copy'
defineProps<{ text: Copy; shot: Copy['catalogue']; priority?: boolean }>()
</script>

<template>
  <section class="showcase-shot">
    <div class="showcase-shot-text">
      <h2>{{ shot.title }}</h2>
      <p>{{ shot.text }}</p>
    </div>
    <figure>
      <a :href="shot.image" target="_blank" rel="noopener" :aria-label="`${text.full} — ${shot.title}`">
        <img :src="shot.image" :alt="shot.alt" width="1440" height="900" :loading="priority ? 'eager' : 'lazy'" />
      </a>
      <figcaption>{{ text.caption }} <a :href="shot.image" target="_blank" rel="noopener">{{ text.full }}</a></figcaption>
    </figure>
  </section>
</template>
