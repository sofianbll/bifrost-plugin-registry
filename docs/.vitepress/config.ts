import { defineConfig } from 'vitepress'

const repo = 'https://github.com/sofianbll/bifrost-plugin-registry'

export default defineConfig({
  title: 'Bifrost Registry',
  base: '/bifrost-plugin-registry/',
  // Internal records stay on GitHub; only the user and operator guides are published.
  srcExclude: ['design/**', 'reviews/**', 'archive/**', 'agents/**', 'research/**', 'images/README.md', 'SOURCES.md'],
  // README.md is the docs index on GitHub and the home page here.
  rewrites: { 'README.md': 'index.md', 'fr/README.md': 'fr/index.md' },
  themeConfig: {
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
              { text: 'Overview', link: '/' },
              { text: 'Install', link: '/INSTALL' },
              { text: 'Troubleshooting', link: '/TROUBLESHOOTING' },
            ],
          },
          {
            text: 'Use Registry',
            items: [
              { text: 'User guide', link: '/USER-GUIDE' },
              { text: 'Configuration', link: '/CONFIGURATION' },
              { text: 'Security and trust boundaries', link: '/SECURITY' },
            ],
          },
          {
            text: 'Operate and build',
            items: [
              { text: 'Native build (French only)', link: '/BUILD' },
              { text: 'Deployment acceptance (French only)', link: '/ACCEPTANCE' },
            ],
          },
          {
            text: 'Project',
            items: [
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
              { text: 'Vue d’ensemble', link: '/fr/' },
              { text: 'Installation', link: '/fr/INSTALL' },
              { text: 'Dépannage', link: '/fr/TROUBLESHOOTING' },
            ],
          },
          {
            text: 'Utiliser Registry',
            items: [
              { text: 'Guide utilisateur', link: '/fr/USER-GUIDE' },
              { text: 'Configuration', link: '/fr/CONFIGURATION' },
              { text: 'Sécurité et frontière de confiance', link: '/fr/SECURITY' },
            ],
          },
          {
            text: 'Exploiter et compiler',
            items: [
              { text: 'Compilation native', link: '/BUILD' },
              { text: 'Acceptation du déploiement', link: '/ACCEPTANCE' },
            ],
          },
          {
            text: 'Projet',
            items: [
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
