import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import Showcase from './Showcase.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    'home-hero-before': () => h(Showcase),
  }),
}
