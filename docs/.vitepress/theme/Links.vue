<script setup lang="ts">
import { withBase } from 'vitepress'
import type { Copy } from './copy'
defineProps<{ text: Copy; prefix: string }>()
const paths = ['/INSTALL.html', '/USER-GUIDE.html', '/SECURITY.html']
</script>

<template>
  <footer class="showcase-links" aria-labelledby="links-title">
    <h2 id="links-title">{{ text.linksTitle }}</h2>
    <ul>
      <li v-for="(path, index) in paths" :key="path"><a :href="withBase(prefix + path)">{{ text.links[index] }}</a></li>
      <li><a href="https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md">{{ text.links[3] }}</a></li>
    </ul>
  </footer>
</template>
