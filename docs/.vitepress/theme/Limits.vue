<script setup lang="ts">
import type { Copy } from './copy'
defineProps<{ text: Copy }>()
</script>

<template>
  <section class="showcase-limits" aria-labelledby="limits-title">
    <h2 id="limits-title">{{ text.limitsTitle }}</h2>
    <ul><li v-for="limit in text.limits" :key="limit">{{ limit }}</li></ul>
  </section>
</template>
