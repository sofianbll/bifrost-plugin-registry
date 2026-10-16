import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import Showcase from './Showcase.vue'
import DocsPrototype from './docs-prototype/DocsPrototype.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DocsPrototype', DocsPrototype)
  },
  Layout: () => h(DefaultTheme.Layout, null, {
    'home-hero-before': () => h(Showcase),
  }),
}
