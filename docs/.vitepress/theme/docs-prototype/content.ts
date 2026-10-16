// Three reading views on the existing guides; all proposed copy is DEV-only.
export function content(fr: boolean, base: string) {
  const t = (en: string, french: string) => fr ? french : en
  const path = (page: string) => `${base}${fr ? 'fr/' : ''}${page}.html`
  const detail = (page: string, en: string, french: string) => `${path(page)}?docView=A#${t(en, french)}`
  const link = (href: string, en: string, french: string) => ({ href, title: t(en, french) })
  const a = (href: string, en: string, french: string) => `<a href="${href}">${t(en, french)}</a>`
  const release = 'https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/'
  const settings = detail('INSTALL', 'credentials-and-plugin-settings', 'identifiants-et-configuration-du-plugin')
  const installMode = detail('INSTALL', 'mode-a-image-and-plugin-url', 'mode-a-image-et-url-du-plugin')
  const migration = detail('INSTALL', 'upgrade-and-rollback', 'mettre-a-jour-et-revenir-en-arriere')
  const recovery = detail('INSTALL', 'recover-activation-after-disabling', 'recuperer-l-activation-apres-desactivation')
  const registration = detail('USER-GUIDE', '_1-register-a-model', '_1-enregistrer-un-modele')
  const composition = detail('USER-GUIDE', '_3-compose-groups-and-keys', '_3-composer-des-groupes-et-des-cles')
  const evidence = 'https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md'
  return {
    index: {
      title: t('Registry guides', 'Guides Registry'),
      goal: t(
        'Install Registry, choose models for an application, or find help with your gateway.',
        'Installez Registry, choisissez les modèles d’une application ou trouvez de l’aide pour votre gateway.',
      ),
      groups: [
        { title: t('Get started', 'Démarrer'), links: [
          { ...link(path('INSTALL'), 'Install Registry', 'Installer Registry'), text: t(
            'Start a new test instance, install the plugin and connect its panel to Bifrost.',
            'Démarrez une nouvelle instance de test, installez le plugin et connectez son panneau à Bifrost.',
          ) },
          { ...link(path('USER-GUIDE'), 'Choose models for an application', 'Choisir les modèles d’une application'), text: t(
            'Prepare an existing key’s selection, publish it and read the result returned by Bifrost.',
            'Préparez la sélection d’une clé existante, publiez-la et lisez le résultat renvoyé par Bifrost.',
          ) },
        ] },
        { title: t('Manage access', 'Gérer les accès'), links: [
          { ...link(registration, 'Register a model', 'Enregistrer un modèle'), text: t(
            'Create a model card with its call name and provider accesses.',
            'Créez une fiche modèle avec son nom d’appel et ses accès fournisseurs.',
          ) },
          { ...link(composition, 'Reuse a selection with a group', 'Réutiliser une sélection avec un groupe'), text: t(
            'Share a model selection across several keys without configuring each one separately.',
            'Partagez une sélection de modèles entre plusieurs clés sans les configurer une par une.',
          ) },
          { ...link(composition, 'Adopt an existing key', 'Adopter une clé existante'), text: t(
            'Let Registry manage the model selection of a Bifrost key without widening its permissions.',
            'Confiez à Registry la sélection d’une clé Bifrost sans élargir ses permissions.',
          ) },
        ] },
        { title: t('Operate and troubleshoot', 'Exploiter et dépanner'), links: [
          { ...link(migration, 'Back up before changing versions', 'Sauvegarder avant un changement de version'), text: t(
            'Find what to save with the gateway stopped and how to restore the image and data together.',
            'Retrouvez quoi sauvegarder à l’arrêt et comment restaurer ensemble l’image et les données.',
          ) },
          { ...link(recovery, 'Recover plugin activation', 'Récupérer l’activation du plugin'), text: t(
            'Follow the procedure for your version after disabling the plugin.',
            'Suivez la procédure de votre version après avoir désactivé le plugin.',
          ) },
          { ...link(path('TROUBLESHOOTING'), 'Solve an installation problem', 'Résoudre un problème d’installation'), text: t(
            'Identify download, permission and plugin-loading errors.',
            'Identifiez les erreurs de téléchargement, de permission et de chargement du plugin.',
          ) },
          { ...link(path('SECURITY'), 'Secure administration', 'Sécuriser l’administration'), text: t(
            'Check admin access, network exposure and the documented security limits.',
            'Contrôlez les accès admin, l’exposition réseau et les limites de sécurité documentées.',
          ) },
        ] },
        { title: t('Reference', 'Référence'), links: [
          { ...link(path('CONFIGURATION'), 'Look up configuration', 'Consulter la configuration'), text: t(
            'Find the fields for model cards, groups, keys and the panel API.',
            'Retrouvez les champs des fiches modèles, des groupes, des clés et de l’API du panneau.',
          ) },
          { ...link(detail('INSTALL', 'which-files-for-which-host', 'quels-fichiers-pour-quel-hote'), 'Find compatible files and previous versions', 'Trouver les fichiers compatibles et les versions précédentes'), text: t(
            'Match each plugin file to its host and Bifrost version.',
            'Associez chaque fichier du plugin à son hôte et à sa version de Bifrost.',
          ) },
          { ...link(`${base}BUILD.html`, 'Build the gateway and plugin (French)', 'Compiler le gateway et le plugin'), text: t(
            'Follow the French native build procedure for a matching pair.',
            'Suivez la procédure de compilation native pour obtenir une paire compatible.',
          ) },
          { ...link(evidence, 'Check the published release status', 'Consulter l’état de la version publiée'), text: t(
            'See which version is available, what was checked and what remains untested.',
            'Consultez la version disponible, les contrôles réalisés et ce qui reste non testé.',
          ) },
        ] },
      ],
    },
    install: {
      title: t('Install Registry on a test instance', 'Installer Registry sur une instance de test'),
      goal: t(
        'Start a new Bifrost instance, load Registry and open its panel connected to the gateway.',
        'Démarrez une nouvelle instance Bifrost, chargez Registry et ouvrez son panneau connecté au gateway.',
      ),
      before: [
        t(
          'Use a Linux AMD64 or ARM64 host with Docker and writable persistent storage. Prepare your Bifrost admin and provider configuration with dashboard authentication enabled.',
          'Prévoyez un hôte Linux AMD64 ou ARM64 avec Docker et un stockage persistant inscriptible. Préparez la configuration de l’administration et des fournisseurs Bifrost, avec l’authentification du tableau de bord activée.',
        ),
        t(
          'You need two components: the compatible dynamic Bifrost image and the Registry <code>.so</code> plugin. The image contains no plugin; the official static image cannot load it.',
          'Deux éléments sont nécessaires : l’image Bifrost dynamique compatible et le fichier <code>.so</code> du plugin Registry. L’image ne contient pas le plugin ; l’image officielle statique ne peut pas le charger.',
        ),
      ],
      caution: t(
        '<strong>Already running a gateway? Stop here.</strong> Prepare a separate test instance and back up the complete volume with the gateway stopped, including SQLite and WAL files. Never allow two processes to write to that volume at the same time. An in-place upgrade is not established as compatible. Read the ',
        '<strong>Vous avez déjà un gateway ? Arrêtez-vous ici.</strong> Préparez une instance de test séparée et sauvegardez le volume complet, gateway à l’arrêt, fichiers SQLite et WAL compris. Ne laissez jamais deux processus écrire sur ce volume en même temps. La compatibilité d’une mise à jour en place n’est pas établie. Consultez les ',
      ) + a(migration, 'migration limits and coordinated restore procedure', 'limites de migration et la restauration coordonnée') + '.',
      links: [
        link(installMode, 'Full image procedure and API installation', 'Procédure image complète et installation par API'),
        link(detail('INSTALL', 'mode-b-plugin-only', 'mode-b-plugin-seul'), 'Install on another compatible gateway build', 'Installer sur une autre compilation compatible de Bifrost'),
        link(settings, 'Credentials and plugin settings', 'Identifiants et réglages du plugin'),
        link(detail('INSTALL', 'which-files-for-which-host', 'quels-fichiers-pour-quel-hote'), 'Previous versions and file hashes', 'Versions précédentes et empreintes des fichiers'),
        link(migration, 'Back up, change versions and restore', 'Sauvegarder, changer de version et restaurer'),
        link(recovery, 'Recover activation after disabling', 'Récupérer l’activation après désactivation'),
        link(evidence, 'Release checks and limits: no real-provider inference or production readiness established', 'Contrôles et limites de la version : ni inférence réelle ni préparation à la production établies'),
      ],
      steps: [
        {
          id: 'download', title: t('Download the compatible files', 'Télécharger les fichiers compatibles'), downloads: true,
          text: [
            t(
              'Use Registry v0.4.0 with unmodified Bifrost 2.3.0, Go 1.27.1 and Alpine 3.23 (musl). Image and plugin must match exactly: architecture, Go toolchain, dependency versions, OS and libc. Choose the plugin for your host below.',
              'Utilisez Registry v0.4.0 avec Bifrost 2.3.0 non modifié, Go 1.27.1 et Alpine 3.23 (musl). Image et plugin doivent correspondre exactement : architecture, chaîne Go, versions des dépendances, OS et libc. Choisissez ci-dessous le plugin de votre hôte.',
            ),
            t('Download the plugin and ', 'Téléchargez le plugin et ') + a(`${release}SHA256SUMS`, 'SHA256SUMS', 'SHA256SUMS') + t(
              ' into the same directory. Run the checksum command there and check that your plugin reports OK; files you did not download are skipped. Then pull the pinned image below. Docker selects the host architecture.',
              ' dans le même dossier. Lancez-y la commande de vérification et contrôlez que votre plugin indique OK ; les fichiers non téléchargés sont ignorés. Récupérez ensuite l’image épinglée ci-dessous. Docker choisit l’architecture de l’hôte.',
            ),
          ],
          command: 'sha256sum -c --ignore-missing SHA256SUMS\n\ndocker pull ghcr.io/sofianbll/bifrost-dynamic@sha256:29e026ab80de357938e3e6df5ac1c3c54c3f6877f4daa2c859e980140fdbbaa0',
          result: t('The downloaded plugin reports OK and Docker has pulled the image.', 'Le plugin téléchargé indique OK et Docker a récupéré l’image.'),
        },
        {
          id: 'credentials', title: t('Prepare the credentials', 'Préparer les identifiants'),
          text: [
            t(
              'Create a secret of at least 32 characters for <code>REGISTRY_ADMIN_TOKEN</code>. You will enter it to open the Registry panel.',
              'Créez un secret d’au moins 32 caractères pour <code>REGISTRY_ADMIN_TOKEN</code>. Vous le saisirez pour ouvrir le panneau Registry.',
            ),
            t(
              'Set <code>REGISTRY_BIFROST_AUTH</code> to the complete <code>Authorization</code> header matching your Bifrost admin authentication, including its scheme (for example <code>Basic &lt;base64(username:password)&gt;</code>, with your own credentials). The plugin uses it to reach the native admin API; it is not an application key.',
              'Renseignez <code>REGISTRY_BIFROST_AUTH</code> avec l’en-tête <code>Authorization</code> complet correspondant à votre authentification admin Bifrost, préfixe compris (par exemple <code>Basic &lt;base64(username:password)&gt;</code>, avec vos propres identifiants). Le plugin l’utilise pour joindre l’API admin native ; ce n’est pas une clé d’application.',
            ),
            t(
              'Keep both values in a secret manager or private environment file, never in committed JSON or logs. Make them available in the environment of the shell that will start Docker: the next command passes these two variables into the container.',
              'Conservez ces deux valeurs dans un gestionnaire de secrets ou un fichier d’environnement privé, jamais dans le JSON versionné ni les logs. Rendez-les disponibles dans l’environnement du shell qui lancera Docker : la commande suivante transmet ces deux variables au conteneur.',
            ),
          ],
        },
        {
          id: 'gateway', title: t('Start Bifrost', 'Démarrer Bifrost'),
          text: [
            t(
              'The example below comes from the installation guide. Replace <code>&lt;image reference&gt;</code> with the full pinned image reference from step 1. Adapt the container name, ports and volume to your test instance; keep the normal image entrypoint and writable persistent storage at <code>/app/data</code>.',
              'L’exemple ci-dessous provient du guide d’installation. Remplacez <code>&lt;image reference&gt;</code> par la référence complète de l’image épinglée à l’étape 1. Adaptez le nom du conteneur, les ports et le volume à votre instance de test ; gardez l’entrypoint normal de l’image et un stockage persistant inscriptible sur <code>/app/data</code>.',
            ),
            t(
              'Bifrost uses port <code>8080</code>. The mapping <code>127.0.0.1:8099:8099</code> exposes the future Registry panel only on host loopback. Inside the container, its listener must be <code>0.0.0.0:8099</code>, as configured in step 4. Starting this image does not install Registry.',
              'Bifrost utilise le port <code>8080</code>. Le port publié <code>127.0.0.1:8099:8099</code> rend le futur panneau Registry accessible uniquement sur le loopback de l’hôte. Dans le conteneur, son écoute doit être <code>0.0.0.0:8099</code>, comme prévu à l’étape 4. Démarrer cette image n’installe pas Registry.',
            ),
          ],
          command: 'docker run -d --name bifrost \\\n  -p 8080:8080 -p 127.0.0.1:8099:8099 \\\n  -v bifrost-data:/app/data \\\n  -e REGISTRY_ADMIN_TOKEN -e REGISTRY_BIFROST_AUTH \\\n  <image reference>',
        },
        {
          id: 'plugin', title: t('Install the Registry plugin', 'Installer le plugin Registry'),
          text: [
            t('Open the native Bifrost plugin settings and the ', 'Ouvrez les réglages de plugins natifs Bifrost et le ') + a(
              'https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json',
              'plugin configuration fragment', 'fragment de configuration du plugin',
            ) + t(
              '. Merge that entry into your configuration without replacing the existing settings. Set <code>path</code> to the direct URL of your architecture’s <code>.so</code> in step 1, not the release-page URL.',
              '. Fusionnez cette entrée avec votre configuration sans remplacer les réglages existants. Renseignez <code>path</code> avec l’URL directe du <code>.so</code> de votre architecture à l’étape 1, pas celle de la page de release.',
            ),
            t(
              'Keep <code>name: "bifrost-registry"</code>, <code>enabled: true</code>, <code>placement: "post_builtin"</code> and <code>order: 0</code>. In <code>config</code>, keep <code>registry_path: "/app/data/registry/registry.json"</code>, <code>admin_listen: "0.0.0.0:8099"</code>, <code>admin_token_env: "REGISTRY_ADMIN_TOKEN"</code>, <code>bifrost_auth_env: "REGISTRY_BIFROST_AUTH"</code> and <code>bifrost_url: "http://127.0.0.1:8080"</code> for this shared-container setup.',
              'Gardez <code>name: "bifrost-registry"</code>, <code>enabled: true</code>, <code>placement: "post_builtin"</code> et <code>order: 0</code>. Dans <code>config</code>, gardez <code>registry_path: "/app/data/registry/registry.json"</code>, <code>admin_listen: "0.0.0.0:8099"</code>, <code>admin_token_env: "REGISTRY_ADMIN_TOKEN"</code>, <code>bifrost_auth_env: "REGISTRY_BIFROST_AUTH"</code> et <code>bifrost_url: "http://127.0.0.1:8080"</code> pour cette installation dans un même conteneur.',
            ),
            t(
              'Save the entry. Bifrost downloads the URL at installation and on every start: keep that versioned file available. Registry creates its data file if missing and includes its own interface; no frontend mount is needed.',
              'Enregistrez l’entrée. Bifrost télécharge l’URL à l’installation et à chaque démarrage : conservez ce fichier versionné à disposition. Registry crée son fichier de données s’il manque et embarque son interface ; aucun montage frontend n’est nécessaire.',
            ),
          ],
        },
        {
          id: 'verify', title: t('Check loading and connection', 'Vérifier le chargement et la connexion'),
          text: [
            t(
              'Using authenticated Bifrost administration, check that Registry is <code>active</code> in <code>GET /api/plugins</code> and also present in <code>GET /api/plugins/loaded</code>. Both checks are required.',
              'Avec l’administration Bifrost authentifiée, vérifiez que Registry est <code>active</code> dans <code>GET /api/plugins</code> et aussi présent dans <code>GET /api/plugins/loaded</code>. Les deux contrôles sont nécessaires.',
            ),
            t(
              'Open <code>http://127.0.0.1:8099/model-registry</code> and enter the token you set in <code>REGISTRY_ADMIN_TOKEN</code>. The token stays in tab memory; enter it again after a reload. Then query <code>GET http://127.0.0.1:8099/api/status</code> with that token as a Bearer token and check for <code>bifrost_connected: true</code>.',
              'Ouvrez <code>http://127.0.0.1:8099/model-registry</code> et saisissez le jeton défini dans <code>REGISTRY_ADMIN_TOKEN</code>. Le jeton reste en mémoire dans l’onglet ; ressaisissez-le après rechargement. Interrogez ensuite <code>GET http://127.0.0.1:8099/api/status</code> avec ce jeton en Bearer et contrôlez <code>bifrost_connected: true</code>.',
            ),
            t('If loading fails or the panel cannot connect, ', 'Si le chargement échoue ou si le panneau ne se connecte pas, ') + a(
              path('TROUBLESHOOTING'), 'find the matching error in troubleshooting', 'recherchez l’erreur correspondante dans le dépannage',
            ) + t(
              '. Once connected, continue with the first-key guide to publish a selection and check the list Bifrost returns.',
              '. Une fois connecté, poursuivez avec le guide de première clé pour publier une sélection et vérifier la liste renvoyée par Bifrost.',
            ),
          ],
          result: t(
            'The plugin is active and loaded, the panel opens, and status reports bifrost_connected: true.',
            'Le plugin est actif et chargé, le panneau s’ouvre et le statut indique bifrost_connected: true.',
          ),
        },
      ],
      next: link(path('USER-GUIDE'), 'Next: choose models for an application', 'Suite : choisir les modèles d’une application'),
    },
    key: {
      title: t('Choose models for an application', 'Choisir les modèles d’une application'),
      goal: t(
        'Prepare the model selection for an existing Bifrost test key, publish it and check what Bifrost lists for that key.',
        'Préparez la sélection d’une clé de test Bifrost existante, publiez-la et vérifiez les modèles que Bifrost liste pour cette clé.',
      ),
      before: [
        t(
          'Use a test gateway with Registry installed and connected, configured providers and models available through those providers.',
          'Utilisez un gateway de test avec Registry installé et connecté, des fournisseurs configurés et des modèles disponibles chez ces fournisseurs.',
        ),
        t(
          'Choose an existing, enabled and unexpired Bifrost key for this application. Create the key and set its initial permissions in Bifrost if needed; this guide does not create one.',
          'Choisissez pour cette application une clé Bifrost existante, active et non expirée. Sa création et ses permissions initiales se règlent dans Bifrost si nécessaire ; ce guide ne crée pas de clé.',
        ),
      ],
      caption: t(
          'Example of a key’s model selection. Fictional data.',
          'Exemple de sélection d’une clé. Données fictives.',
      ),
      links: [
        link(registration, 'Model registration fields and operations', 'Champs et opérations d’enregistrement d’un modèle'),
        link(composition, 'Reuse groups and review adoption options', 'Réutiliser des groupes et consulter les options d’adoption'),
        link(detail('USER-GUIDE', '_4-local-snapshot-versus-connected-gateway', '_4-instantane-local-ou-gateway-connecte'), 'What a local snapshot cannot verify', 'Ce qu’un instantané local ne permet pas de vérifier'),
        link(path('INSTALL'), 'Check the installation', 'Vérifier l’installation'),
      ],
      steps: [
        {
          id: 'model-card', title: t('Prepare the models', 'Préparer les modèles'),
          text: [
            t(
              'In <strong>My models</strong>, find the cards you want to use and check their provider accesses. If a card is missing, open the discovered model and choose <strong>Register</strong>. Provide a valid call name, a display name and at least one complete access with its provider and exact model ID.',
              'Dans <strong>Mes modèles</strong>, retrouvez les fiches voulues et contrôlez leurs accès fournisseurs. Si une fiche manque, ouvrez le modèle découvert et choisissez <strong>Enregistrer</strong>. Renseignez un nom d’appel valide, un nom d’affichage et au moins un accès complet avec son fournisseur et son identifiant de modèle exact.',
            ),
            t(
              'Select the exposed operations for each access: Chat Completions and Responses are separate choices. Review and register the card; optional details such as prices can remain unknown. Choosing an operation does not prove that the provider supports it.',
              'Choisissez les opérations exposées pour chaque accès : Chat Completions et Responses sont deux choix distincts. Relisez puis enregistrez la fiche ; les détails facultatifs comme les prix peuvent rester inconnus. Choisir une opération ne prouve pas sa prise en charge par le fournisseur.',
            ),
            t(
              '<strong>Register</strong> creates a model card, not access for a key. <strong>Add</strong> attaches an access to a card, or a card to a key or group. You will choose this key’s models in step 3.',
              '<strong>Enregistrer</strong> crée une fiche modèle, pas un accès pour une clé. <strong>Ajouter</strong> rattache un accès à une fiche, ou une fiche à une clé ou à un groupe. Vous choisirez les modèles de cette clé à l’étape 3.',
            ),
          ],
        },
        {
          id: 'adopt', title: t('Open or adopt the key', 'Ouvrir ou adopter la clé'),
          text: [
            t(
              'In <strong>Keys</strong>, find the application’s key. Choose <strong>Open</strong> if Registry already manages it, <strong>Adopt</strong> if it is ready, or <strong>See what blocks it</strong> to inspect what is missing.',
              'Dans <strong>Clés</strong>, retrouvez la clé de l’application. Choisissez <strong>Ouvrir</strong> si Registry la gère déjà, <strong>Adopter</strong> si elle est prête, ou <strong>Voir ce qui bloque</strong> pour consulter ce qui manque.',
            ),
            t(
              'Resolve prerequisites first: register missing model cards, or enable or renew the key in Bifrost, then refresh the preview. These are separate from the provider decisions in the adoption dialog. For each decision, compare the existing permissions and the proposed selection; keeping a provider in Bifrost leaves its permissions outside Registry’s management.',
              'Résolvez d’abord les préalables : enregistrez les fiches manquantes, ou activez ou renouvelez la clé dans Bifrost, puis actualisez l’aperçu. Ces actions sont distinctes des décisions par fournisseur dans la fenêtre d’adoption. Pour chaque décision, comparez les permissions existantes et la sélection proposée ; garder un fournisseur dans Bifrost laisse ses permissions hors de la gestion de Registry.',
            ),
            t(
              'For an option marked <strong>Changes Bifrost</strong>, review the exact before/after preview before confirming the change. Replacing “all providers” can remove models without cards and no longer allows future providers automatically. Only these marked options change native permissions.',
              'Pour une option <strong>Modifie Bifrost</strong>, relisez l’aperçu exact avant/après avant de confirmer le changement. Remplacer « tous les fournisseurs » peut retirer les modèles sans fiche et n’autorise plus automatiquement les futurs fournisseurs. Seules ces options signalées changent les permissions natives.',
            ),
            t(
              'Once the prerequisites and decisions are resolved, adopt the key. Adoption does not widen native permissions or publish pending selection changes.',
              'Une fois les préalables et les décisions résolus, adoptez la clé. L’adoption n’élargit pas les permissions natives et ne publie pas les modifications de sélection en attente.',
            ),
          ],
        },
        {
          id: 'selection', title: t('Choose models and accesses', 'Choisir les modèles et les accès'),
          text: [
            t(
              'Add the models this application needs. A selected model includes <strong>all its linked accesses by default</strong>: review the <strong>Accesses</strong> list and uncheck any this key should not use.',
              'Ajoutez les modèles nécessaires à cette application. Un modèle sélectionné inclut <strong>tous ses accès liés par défaut</strong> : relisez la liste <strong>Accès</strong> et décochez ceux que cette clé ne doit pas utiliser.',
            ),
            t(
              'These local exclusions affect only this key, including when a group supplies the model. They change neither the group nor other keys.',
              'Ces exclusions locales ne concernent que cette clé, y compris lorsqu’un groupe fournit le modèle. Elles ne changent ni le groupe ni les autres clés.',
            ),
            t('To reuse a selection, you can also ', 'Pour réutiliser une sélection, vous pouvez aussi ') + a(
              composition, 'use a group', 'utiliser un groupe',
            ) + t(
              '. This is optional. Changing a shared group affects all keys that inherit it; keep key-specific exceptions in the key.',
              '. C’est facultatif. Modifier un groupe partagé affecte toutes les clés qui en héritent ; gardez les exceptions propres à une clé dans cette clé.',
            ),
          ],
        },
        {
          id: 'publish', title: t('Review and publish', 'Relire et publier'),
          text: [
            t(
              'Review the selected models, their call names and their accesses in the draft preview. This preview is the planned selection, not a list already confirmed by Bifrost.',
              'Relisez les modèles retenus, leurs noms d’appel et leurs accès dans l’aperçu du brouillon. Cet aperçu est la sélection prévue, pas une liste déjà confirmée par Bifrost.',
            ),
            t(
              'Click <strong>Publish</strong>. Registry saves the selection and immediately asks Bifrost which models this key lists. Read the result in the next step.',
              'Cliquez sur <strong>Publier</strong>. Registry enregistre la sélection et demande aussitôt à Bifrost quels modèles cette clé liste. Consultez le résultat à l’étape suivante.',
            ),
          ],
        },
        {
          id: 'read-result', title: t('Read the result', 'Lire le résultat'),
          text: [
            t(
              '<strong>Verified</strong>: Bifrost confirmed the published selection. <strong>Differences found</strong>: inspect the missing or unexpected model IDs and correct the selection or gateway configuration as needed. <strong>Not checked yet</strong>: the total is still the planned selection; use <strong>Check with Bifrost</strong>.',
              '<strong>Vérifiée</strong> : Bifrost a confirmé la sélection publiée. <strong>Écarts trouvés</strong> : examinez les identifiants de modèles manquants ou inattendus et corrigez si besoin la sélection ou la configuration du gateway. <strong>Pas encore vérifiée</strong> : le total reste la sélection prévue ; utilisez <strong>Vérifier avec Bifrost</strong>.',
            ),
            t(
              '<strong>Verified · 1 difference</strong> is also possible: a permission kept in Bifrost is not listed by Bifrost. Inspect that difference; the unlisted model never counts in the verified total.',
              '<strong>Vérifiée · 1 écart</strong> reste possible : une permission conservée dans Bifrost n’est pas listée par Bifrost. Consultez cet écart ; le modèle non listé ne compte jamais dans le total vérifié.',
            ),
            t(
              'Use <strong>Check again</strong> if you need to repeat the comparison. This check reads <code>/v1/models</code> with the key; it calls no model and therefore does not prove that inference will succeed.',
              'Utilisez <strong>Vérifier à nouveau</strong> si vous devez relancer la comparaison. Ce contrôle lit <code>/v1/models</code> avec la clé ; il n’appelle aucun modèle et ne prouve donc pas qu’un appel d’inférence réussira.',
            ),
          ],
        },
      ],
      next: link(path('guides'), 'Find another guide', 'Trouver un autre guide'),
    },
  }
}
