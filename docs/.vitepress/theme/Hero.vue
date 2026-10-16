<script setup lang="ts">
import { withBase } from 'vitepress'
import type { Copy } from './copy'
defineProps<{ text: Copy; prefix: string }>()
</script>

<template>
  <header class="showcase-hero">
    <h1>{{ text.title }}</h1>
    <p class="showcase-intro">{{ text.intro }}</p>
    <div class="showcase-actions">
      <a class="showcase-install" :href="withBase(`${prefix}/INSTALL.html`)">{{ text.install }}</a>
      <a class="showcase-secondary" :href="withBase(`${prefix}/guides.html`)">{{ text.docs }}</a>
      <a class="showcase-secondary" href="https://github.com/sofianbll/bifrost-plugin-registry">GitHub</a>
    </div>
    <p class="showcase-independent">{{ text.independent }}</p>
  </header>
</template>
