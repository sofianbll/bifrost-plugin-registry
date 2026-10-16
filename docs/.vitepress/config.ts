import { defineConfig } from 'vitepress'
import { fileURLToPath } from 'node:url'

const repo = 'https://github.com/sofianbll/bifrost-plugin-registry'

export default defineConfig({
  title: 'Bifrost Registry',
  base: '/bifrost-plugin-registry/',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/bifrost-plugin-registry/branding/registry/registry-icon.svg' }]],
  // Internal records stay on GitHub; only the user and operator guides are published.
  srcExclude: ['adr/**', 'design/**', 'reviews/**', 'archive/**', 'agents/**', 'research/**', 'images/README.md', 'SOURCES.md', 'prototype-164.md'],
  // Keep the GitHub documentation indexes separate from the showcase.
  rewrites: { 'README.md': 'guides.md', 'fr/README.md': 'fr/guides.md' },
  // The local prototype imports existing panel fonts outside docs/.
  vite: { server: { fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] } } },
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
        sidebar: [
          {
            text: 'Get started',
            items: [
              { text: 'Guides', link: '/guides' },
              { text: 'Install', link: '/INSTALL' },
              { text: 'First key', link: '/USER-GUIDE' },
            ],
          },
          {
            text: 'Manage access',
            items: [
              { text: 'Register a model', link: '/USER-GUIDE?docView=A#_1-register-a-model' },
              { text: 'Groups and adoption', link: '/USER-GUIDE?docView=A#_3-compose-groups-and-keys' },
            ],
          },
          {
            text: 'Operate',
            items: [
              { text: 'Troubleshooting', link: '/TROUBLESHOOTING' },
              { text: 'Backup and version changes', link: '/INSTALL?docView=A#upgrade-and-rollback' },
              { text: 'Activation recovery', link: '/INSTALL?docView=A#recover-activation-after-disabling' },
              { text: 'Security and trust boundaries', link: '/SECURITY' },
              { text: 'Deployment acceptance (French only)', link: '/ACCEPTANCE' },
            ],
          },
          {
            text: 'Reference',
            items: [
              { text: 'Configuration', link: '/CONFIGURATION' },
              { text: 'Native build (French only)', link: '/BUILD' },
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
        sidebar: [
          {
            text: 'Démarrer',
            items: [
              { text: 'Guides', link: '/fr/guides' },
              { text: 'Installation', link: '/fr/INSTALL' },
              { text: 'Première clé', link: '/fr/USER-GUIDE' },
            ],
          },
          {
            text: 'Gérer les accès',
            items: [
              { text: 'Enregistrer un modèle', link: '/fr/USER-GUIDE?docView=A#_1-enregistrer-un-modele' },
              { text: 'Groupes et adoption', link: '/fr/USER-GUIDE?docView=A#_3-composer-des-groupes-et-des-cles' },
            ],
          },
          {
            text: 'Exploiter',
            items: [
              { text: 'Dépannage', link: '/fr/TROUBLESHOOTING' },
              { text: 'Sauvegarde et changement de version', link: '/fr/INSTALL?docView=A#mettre-a-jour-et-revenir-en-arriere' },
              { text: 'Récupérer l’activation', link: '/fr/INSTALL?docView=A#recuperer-l-activation-apres-desactivation' },
              { text: 'Sécurité et frontière de confiance', link: '/fr/SECURITY' },
              { text: 'Acceptation du déploiement', link: '/ACCEPTANCE' },
            ],
          },
          {
            text: 'Référence',
            items: [
              { text: 'Configuration', link: '/fr/CONFIGURATION' },
              { text: 'Compilation native', link: '/BUILD' },
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
