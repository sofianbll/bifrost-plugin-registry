import { defineConfig } from 'vitepress'

const repo = 'https://github.com/sofianbll/bifrost-plugin-registry'

export default defineConfig({
  title: 'Bifrost Registry',
  base: '/bifrost-plugin-registry/',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/bifrost-plugin-registry/branding/registry/registry-icon.svg' }]],
  // Internal records stay on GitHub; only the user and operator guides are published.
  srcExclude: ['adr/**', 'design/**', 'reviews/**', 'archive/**', 'agents/**', 'research/**', 'images/README.md', 'SOURCES.md'],
  // Keep GitHub-readable task indexes separate from the product homepages.
  rewrites: { 'README.md': 'guides.md', 'fr/README.md': 'fr/guides.md' },
  markdown: {
    config(md) {
      // Source links remain readable on GitHub; VitePress needs the rewritten filenames.
      md.core.ruler.after('inline', 'guide-index-links', (state) => {
        for (const token of state.tokens) {
          for (const child of token.children || []) {
            const href = child.tag === 'a' && child.attrGet('href')
            if (href && !/^(?:\w+:|\/\/)/.test(href)) {
              child.attrSet('href', href.replace(/(^|\/)README\.md(?=[#?]|$)/, '$1guides.md'))
            }
          }
        }
      })
    },
  },
  themeConfig: {
    // Crop transparent SVG margins without redrawing the existing identity.
    logo: {
      light: { src: '/branding/registry/registry-logo.svg', style: 'width: 145px; height: 32px; object-fit: cover' },
      dark: { src: '/branding/registry/registry-logo-dark.svg', style: 'width: 145px; height: 32px; object-fit: cover' },
      alt: 'Bifrost Registry',
    },
    siteTitle: false,
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: {
        locales: {
          fr: {
            translations: {
              button: { buttonText: 'Rechercher', buttonAriaLabel: 'Rechercher' },
              modal: {
                displayDetails: 'Afficher les détails',
                resetButtonTitle: 'Effacer la recherche',
                backButtonTitle: 'Fermer la recherche',
                noResultsText: 'Aucun résultat pour',
                footer: {
                  selectText: 'sélectionner',
                  selectKeyAriaLabel: 'entrée',
                  navigateText: 'naviguer',
                  navigateUpKeyAriaLabel: 'flèche haut',
                  navigateDownKeyAriaLabel: 'flèche bas',
                  closeText: 'fermer',
                  closeKeyAriaLabel: 'échap',
                },
              },
            },
          },
        },
      },
    },
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      description: 'Per-key model access for Bifrost virtual keys.',
      themeConfig: {
        nav: [{ text: 'Home', link: '/' }, { text: 'Guides', link: '/guides' }],
        sidebar: [
          {
            text: 'Get started',
            items: [
              { text: 'Guides', link: '/guides' },
              { text: 'Install', link: '/INSTALL' },
              { text: 'Choose models for an application', link: '/USER-GUIDE' },
            ],
          },
          {
            text: 'Manage access',
            items: [
              { text: 'Register a model', link: '/USER-GUIDE#_1-register-a-model' },
              { text: 'Groups and existing keys', link: '/USER-GUIDE#_3-compose-groups-and-keys' },
            ],
          },
          {
            text: 'Operate and troubleshoot',
            items: [
              { text: 'Backup and version changes', link: '/INSTALL#upgrade-and-rollback' },
              { text: 'Recover activation', link: '/INSTALL#recover-activation-after-disabling' },
              { text: 'Troubleshooting', link: '/TROUBLESHOOTING' },
              { text: 'Security and trust boundaries', link: '/SECURITY' },
            ],
          },
          {
            text: 'Reference',
            items: [
              { text: 'Configuration', link: '/CONFIGURATION' },
              { text: 'Native build (French only)', link: '/BUILD' },
              { text: 'Deployment acceptance (French only)', link: '/ACCEPTANCE' },
              { text: 'Status', link: `${repo}/blob/main/STATUS.md` },
            ],
          },
        ],
      },
    },
    fr: {
      label: 'Français',
      lang: 'fr',
      link: '/fr/',
      description: 'Accès aux modèles par clé pour les clés virtuelles Bifrost.',
      themeConfig: {
        nav: [{ text: 'Accueil', link: '/fr/' }, { text: 'Guides', link: '/fr/guides' }],
        sidebar: [
          {
            text: 'Démarrer',
            items: [
              { text: 'Guides', link: '/fr/guides' },
              { text: 'Installation', link: '/fr/INSTALL' },
              { text: 'Choisir les modèles d’une application', link: '/fr/USER-GUIDE' },
            ],
          },
          {
            text: 'Gérer les accès',
            items: [
              { text: 'Enregistrer un modèle', link: '/fr/USER-GUIDE#_1-enregistrer-un-modele' },
              { text: 'Groupes et clés existantes', link: '/fr/USER-GUIDE#_3-composer-des-groupes-et-des-cles' },
            ],
          },
          {
            text: 'Exploiter et dépanner',
            items: [
              { text: 'Sauvegarde et changement de version', link: '/fr/INSTALL#mettre-a-jour-et-revenir-en-arriere' },
              { text: 'Récupérer l’activation', link: '/fr/INSTALL#recuperer-l-activation-apres-desactivation' },
              { text: 'Dépannage', link: '/fr/TROUBLESHOOTING' },
              { text: 'Sécurité et frontière de confiance', link: '/fr/SECURITY' },
            ],
          },
          {
            text: 'Référence',
            items: [
              { text: 'Configuration', link: '/fr/CONFIGURATION' },
              { text: 'Compilation native', link: '/BUILD' },
              { text: 'Acceptation du déploiement', link: '/ACCEPTANCE' },
              { text: 'État du projet (anglais)', link: `${repo}/blob/main/STATUS.md` },
            ],
          },
        ],
        docFooter: { prev: 'Page précédente', next: 'Page suivante' },
        outline: { label: 'Sur cette page' },
        returnToTopLabel: 'Haut de page',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Apparence',
        lightModeSwitchTitle: 'Passer au thème clair',
        darkModeSwitchTitle: 'Passer au thème sombre',
        langMenuLabel: 'Changer de langue',
      },
    },
  },
})
