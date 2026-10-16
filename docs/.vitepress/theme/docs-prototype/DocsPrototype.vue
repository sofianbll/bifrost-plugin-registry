<script setup>
import { defineAsyncComponent } from 'vue'
defineProps({ page: String })
// Throwaway reading experiment; production never imports the proposed documentation.
const Pilot = import.meta.env.DEV
  ? defineAsyncComponent(() => import('./DocPilot.vue'))
  : null
</script>

<template>
  <Pilot v-if="Pilot" :page="page"><slot /></Pilot>
  <slot v-else />
</template>
