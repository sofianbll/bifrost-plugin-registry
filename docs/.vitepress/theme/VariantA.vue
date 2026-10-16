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
  <div class="variant-a">
    <Hero :text="text" :prefix="prefix" />
    <Features :text="text" />
    <div class="showcase-editorial">
      <Shot :text="text" :shot="text.catalogue" />
      <Shot :text="text" :shot="text.key" />
    </div>
    <div class="showcase-closing"><Limits :text="text" /><Links :text="text" :prefix="prefix" /></div>
  </div>
</template>
