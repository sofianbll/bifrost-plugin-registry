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
  <div class="variant-c">
    <div class="showcase-decision">
      <div><Hero :text="text" :prefix="prefix" /><Features :text="text" /></div>
      <aside><Limits :text="text" /><Links :text="text" :prefix="prefix" /></aside>
    </div>
    <div class="showcase-decision-shots">
      <Shot :text="text" :shot="text.catalogue" />
      <Shot :text="text" :shot="text.key" />
    </div>
  </div>
</template>
