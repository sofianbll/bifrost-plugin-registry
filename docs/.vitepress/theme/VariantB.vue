<script setup lang="ts">
import type { Copy } from './copy'
import Hero from './Hero.vue'
import Features from './Features.vue'
import Shot from './Shot.vue'
import Limits from './Limits.vue'
import Links from './Links.vue'
defineProps<{ text: Copy; prefix: string }>()
</script>

<template>
  <div class="variant-b">
    <Hero :text="text" :prefix="prefix" />
    <Shot class="showcase-primary-shot" :text="text" :shot="text.catalogue" priority />
    <Features :text="text" />
    <Shot :text="text" :shot="text.key" />
    <div class="showcase-closing"><Limits :text="text" /><Links :text="text" :prefix="prefix" /></div>
  </div>
</template>
