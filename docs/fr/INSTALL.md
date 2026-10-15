# Installer Registry

[English](../INSTALL.md) · Français

Registry s'installe en **deux artefacts séparés** : une image de gateway Bifrost compilée avec chargement dynamique (elle ne contient aucun plugin) et le plugin Registry, un fichier `.so` qui embarque son interface. Les deux doivent provenir de la même compilation : même architecture, chaîne Go, versions de dépendances et libc. Démarrer l'image n'installe pas le plugin. Utilisez une instance de staging avant de migrer un déploiement existant.

**Candidat source, pas une release :** `bifrost.pin` cible désormais Bifrost 2.3.0 non modifié (`transports/v2.3.0`, commit `9237ec06672406e437b3cb33fc793ffd0403b3ae`), avec Go 1.27.1 et Alpine 3.23 inchangés. [STATUS consigne la qualification native AMD64/ARM64 du checkpoint b73 exact et ses limites](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md#foundation-checkpoint), pas celle des commits suivants ou d'une image distribuée. Les fichiers publiés v0.3.0 et les exemples ci-dessous restent destinés à Bifrost 2.2.6 ; n'installez pas ces plugins sur un gateway 2.3.

## Quels fichiers pour quel hôte

Choisissez la ligne de votre hôte.

| Hôte | Release | Bifrost | Image du gateway | Plugin (`.so`) |
| --- | --- | --- | --- | --- |
| Linux AMD64 (x86_64) | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) (stable courante) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-amd64.so` |
| Linux ARM64 | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) (stable courante) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-arm64.so` |
| Linux AMD64 (x86_64), release publiée précédente | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-amd64.so` |
| Linux ARM64, release publiée précédente | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (ancienne) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (ancienne) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (ancienne) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (ancienne) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (ancienne) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (ancienne) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-arm64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4) (ancienne) | 2.2.3 | `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` | `bifrost-registry-v0.3.0-rc.4-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (ancienne) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-amd64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (ancienne) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-arm64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-arm64.so` |

- Téléchargez chaque `.so` depuis sa page de release. L'URL du plugin est toujours `https://github.com/sofianbll/bifrost-plugin-registry/releases/download/<release>/<fichier plugin>` : l'URL du **fichier `.so`**, pas celle du dépôt ni de la page de release. v0.3.0 et rc.5 à rc.8 n'ont pas d'archive d'image : l'image du gateway vient de GHCR (voir le [mode A](#mode-a-image-et-url-du-plugin)) ; les releases plus anciennes la fournissent en archive sur leur page de release.
- Chaque release contient un fichier `SHA256SUMS`. Vérifiez chaque téléchargement avec lui.
- Empreintes des plugins v0.3.0 : AMD64 `0361097e8ced195d0377b618aeb99360a5daf0ed1f6457f7a8b770f155e59f60` ; ARM64 `0d2bf90386976873d6bc33790378373236a5305f3adb2fcf7ac9efadc5a3a14a`. Elles correspondent au manifeste publié.
- v0.3.0 est la release stable pour les deux architectures. v0.2.0-rc.1 est antérieure au catalogue Models.dev, aux endpoints par accès et aux capacités natives de prix et de routage qu'ajoute v0.3.0.
- Voir [Qualification et limites](#qualification-et-limites).

## Choisir un mode d'installation

**Mode A : image Registry et URL du plugin (recommandé).** Exécutez l'image dynamique publiée et ajoutez le `.so` par **URL directe** dans les réglages plugin de Bifrost. L'image contient un Bifrost non modifié compilé avec chargement dynamique et **sans plugin** : le chemin d'inférence auquel vous faites confiance n'est jamais patché, et Registry reste un artefact séparé et versionné.

**Mode B : plugin seul, sur un gateway déjà en place.** Tout Bifrost **compilé avec chargement dynamique** peut héberger le `.so` Registry. Il doit correspondre à l'architecture, la chaîne Go, les versions de dépendances, l'OS et la libc de votre gateway ; les paires qualifiées utilisent Linux/musl et Go 1.27.1. L'image officielle précompilée statique refuse les plugins dynamiques (`Dynamic loading not supported`) ; voir [Dépannage](TROUBLESHOOTING.md).

## Mode A : image et URL du plugin

### 1. Télécharger et vérifier

Téléchargez le `.so` de votre hôte d'après le tableau, ainsi que `SHA256SUMS`, dans un même dossier, puis vérifiez-le :

```bash
sha256sum -c --ignore-missing SHA256SUMS
```

`SHA256SUMS` liste tous les fichiers de la release ; `--ignore-missing` ignore ceux que vous n'avez pas téléchargés. Sous macOS, `shasum -a 256 <fichier>` donne l'empreinte à comparer à la main.

Pour v0.3.0-rc.4 et v0.2.0-rc.1, téléchargez aussi l'archive d'image du tableau et vérifiez-la de la même façon.

### 2. Récupérer l'image et démarrer le gateway

Pour v0.3.0, l'image du gateway (sans plugin) est une image multi-architecture sur GHCR : Docker choisit `linux/amd64` ou `linux/arm64` selon votre hôte. Épinglez le digest publié ci-dessous ; le tag `2.2.6` est pratique mais se déplace à chaque compilation publiée du gateway Bifrost 2.2.6.

```bash
# épinglé
docker pull ghcr.io/sofianbll/bifrost-dynamic@sha256:849fe441be5215a3c4783a9fcdd9989dde1f3c8c201dc6b4c140060880f07a66
# pratique
docker pull ghcr.io/sofianbll/bifrost-dynamic:2.2.6
```

Pour v0.3.0-rc.8 (même Bifrost 2.2.6), épinglez `ghcr.io/sofianbll/bifrost-dynamic@sha256:1555e28d4e5adca52d10c54d2e94db18a6c8346fa29b250de50e408ada42d6fe` ; pour v0.3.0-rc.7, épinglez `ghcr.io/sofianbll/bifrost-dynamic@sha256:d0b4e98c40e22f142c637737507acfb4e181f6dc340c85aba8989b9df0bbf3be` ; pour rc.6 (tag `2.2.5`), `ghcr.io/sofianbll/bifrost-dynamic@sha256:7c3354b041e4c06b1797a58adcfe8c6eeb11b270edff2ccf5610c4a98809d367` ; pour rc.5 (tag `2.2.4`), `ghcr.io/sofianbll/bifrost-dynamic@sha256:ef56067e2bf807930270d2d6318ba9e9996ed914c9469db46068078d3c06e7b2`.

Pour v0.3.0-rc.4 et v0.2.0-rc.1, chargez plutôt l'archive :

```bash
docker load -i <archive d'image>   # affiche le tag de l'image chargée
```

Conservez les providers, clés, budgets et règles Bifrost existants. Utilisez l'entrypoint normal de l'image et un volume **inscriptible et persistant** monté sur `/app/data`. Pour remplacer l'image d'un gateway existant, arrêtez-le d'abord et sauvegardez **tout** son volume, y compris SQLite et ses fichiers WAL. Ne lancez jamais deux writers sur ce volume.

Sur un gateway neuf, configurez d'abord l'administration native de Bifrost et les providers. Fournissez les deux [identifiants](#identifiants-et-configuration-du-plugin) par votre gestionnaire de secrets ou un fichier d'environnement privé, puis démarrez le conteneur. Cette commande est illustrative ; adaptez ports, volume et durcissement à votre environnement :

```bash
docker run -d --name bifrost \
  -p 8080:8080 -p 127.0.0.1:8099:8099 \
  -v bifrost-data:/app/data \
  -e REGISTRY_ADMIN_TOKEN -e REGISTRY_BIFROST_AUTH \
  <référence de l'image>
```

Le port habituel du gateway est `8080`. Publiez le port Registry `8099` uniquement sur le loopback de l'hôte, comme ci-dessus. Dans le conteneur, `admin_listen` doit être `0.0.0.0:8099` pour que ce mapping fonctionne.

### 3. Installer le plugin par URL

Ajoutez le plugin depuis l'interface native Bifrost ou `POST /api/plugins`, avec l'URL du plugin construite d'après le tableau. Fusionnez le [fragment de configuration](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) avec la configuration existante, en remplaçant sa `path` fictive par cette URL, et gardez la [configuration du plugin](#identifiants-et-configuration-du-plugin) ci-dessous. Bifrost télécharge l'URL enregistrée à l'installation et à chaque démarrage : conservez les octets de cette version disponibles à cette URL.

Si le téléchargement échoue avec une erreur de permission sur un fichier temporaire, voir [Dépannage](TROUBLESHOOTING.md).

## Mode B : plugin seul

1. Téléchargez le `.so` correspondant à votre gateway d'après le tableau et vérifiez son empreinte comme ci-dessus. Si votre gateway provient d'une autre compilation, [compilez la paire vous-même](../BUILD.md).
2. Rendez-le accessible au gateway soit par **chemin de fichier local** (`path: "/plugins/bifrost-registry.so"` dans l'entrée plugin, fichier lisible par le processus Bifrost) soit par **URL http(s)** (Bifrost le télécharge au démarrage).
3. Fusionnez le [fragment de configuration](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) avec ce `path` et la [configuration du plugin](#identifiants-et-configuration-du-plugin) ci-dessous, depuis l'interface native Bifrost ou `POST /api/plugins`.

Pour le **candidat source 2.3.0**, une installation locale initiale peut conserver le même nom de fichier immuable et versionné pour récupérer par **désactiver → redémarrer → activer**. Gardez les octets du `.so` de la paire exacte lisibles à ce chemin absolu dans le conteneur entre les redémarrages, de préférence sur un montage en lecture seule. Cela ne qualifie pas la réactivation locale à chaud. L'installation initiale par URL reste prise en charge, mais sa récupération exige la [transition explicite URL→local](#recuperer-l-activation-apres-desactivation) ci-dessous.

## Identifiants et configuration du plugin

Les deux modes utilisent deux secrets distincts, fournis comme valeurs d'environnement (jamais dans le JSON versionné ni dans les logs) :

| Variable | Rôle |
| --- | --- |
| `REGISTRY_ADMIN_TOKEN` | Au moins 32 caractères ; ouvre le panneau Registry. |
| `REGISTRY_BIFROST_AUTH` | Valeur complète de l'en-tête `Authorization` permettant au plugin d'appeler l'API admin native Bifrost, par exemple `Basic <base64(utilisateur:mot-de-passe)>`. Doit correspondre à l'authentification configurée du gateway. |

Avec Bifrost 2.2.6 (v0.3.0 et rc.7/rc.8), l'API de gestion native (`/api/...`, hors routes publiques comme `/health`) reste verrouillée tant que l'authentification du tableau de bord n'est pas activée ou qu'aucun jeton de configuration (setup token) n'est envoyé ([notes de version amont](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.2.6)). Registry n'envoie que l'en-tête `Authorization` issu de `REGISTRY_BIFROST_AUTH`, jamais de jeton de configuration : activez donc l'authentification du tableau de bord, comme le fait la configuration qualifiée. 2.2.6 active aussi `enforce_auth_on_inference` par défaut sur les nouveaux déploiements : l'inférence, y compris la vérification de `/v1/models` décrite dans « Vérifier », demande un identifiant, comme la clé virtuelle dédiée qui y est utilisée.

Dans l'entrée du plugin, gardez :

- `placement: "post_builtin"` et `order: 0` ;
- `registry_path: "/app/data/registry/registry.json"` ;
- `admin_listen: "0.0.0.0:8099"` ;
- `admin_token_env: "REGISTRY_ADMIN_TOKEN"` ;
- `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"` ;
- `bifrost_url: "http://127.0.0.1:8080"` lorsque plugin et gateway partagent le même conteneur.

Le plugin initialise un fichier Registry manquant. Ses assets d'interface sont embarqués ; aucun montage de frontend séparé n'est nécessaire.

## Vérifier

Ouvrez **http://127.0.0.1:8099/model-registry** et saisissez le jeton d'administration Registry. Il reste dans la mémoire de l'onglet et doit être ressaisi après rechargement. L'interface de v0.3.0 et de v0.3.0-rc.4 à rc.8 est en anglais par défaut ; le français est à un clic ou via `?lang=fr`. v0.2.0-rc.1, installée par les lignes anciennes, s'ouvre d'abord en français.

Vérifiez que le plugin est `active` dans `GET /api/plugins` et présent dans `GET /api/plugins/loaded`. Publiez un petit catalogue de test et relisez `/v1/models` avec une clé virtuelle dédiée. Les clés natives préexistantes restent non gérées jusqu'à adoption explicite ; l'adoption n'élargit pas leurs droits natifs. À partir de v0.3.0, `GET http://127.0.0.1:8099/api/status`, avec le jeton d'administration Registry en jeton Bearer, renvoie la release installée dans `version`, et `bifrost_connected: true` dès que Registry joint Bifrost.

## Récupérer l'activation après désactivation

La réactivation à chaud d'un `.so` Go déjà chargé n'est pas prise en charge (`HTTP 500`, `plugin already loaded`) ; le panneau Registry reste fermé après l'échec.

- **v0.3.0 publiée / Bifrost 2.2.6 :** l'échec conserve la ligne sauvegardée `enabled:true`. Redémarrez le gateway pour recharger le plugin.
- **Candidat source Bifrost 2.3.0 :** l'échec d'activation par URL restaure la ligne précédente, `enabled:false`. Le redémarrage seul le laisse désactivé. Réactiver l'URL inchangée après redémarrage échoue aussi : la vérification au démarrage désactivé a déjà ouvert le module Go, et l'activation par URL le retélécharge sous un autre nom temporaire (`plugin already loaded`). Ne répétez pas les tentatives et ne traitez pas un 500 comme un succès.

**Récupération du candidat 2.3 installé par URL — passage explicite en mode local :**

1. Préparez une copie locale des **mêmes octets du plugin compatible**, vérifiés contre le SHA-256 de l'artefact installé, sous un nouveau nom de fichier versionné et persistant. Le `path` est absolu **dans le conteneur du gateway**, pas sur l'hôte Docker. Par exemple, utilisez `/app/data/registry/plugins/sha256-<empreinte vérifiée>/bifrost-registry.so` sur le volume persistant existant, ou un fichier versionné monté en lecture seule sous `/plugins/`. Gardez le fichier lisible et si possible en lecture seule ; le répertoire de données reste inscriptible pour les sauvegardes Registry. N'écrasez jamais un `.so` déjà chargé.
2. Désactivez depuis les réglages plugin natifs ou `PUT /api/plugins/bifrost-registry`. Un échec d'activation par URL antérieur doit laisser `enabled:false` et le panneau fermé.
3. **Avant de redémarrer**, enregistrez le `path` local avec `enabled:false` depuis l'API/les réglages natifs, sans changer les autres réglages du plugin. Relisez le flag désactivé, le chemin local exact et les réglages dans `GET /api/plugins` ; confirmez l'absence dans `GET /api/plugins/loaded` et le panneau fermé. N'activez pas la copie locale dans l'ancien processus.
4. Arrêtez complètement le processus gateway et attendez sa fin, puis redémarrez avec le même fichier/montage au même nom. Confirmez la ligne sauvegardée désactivée/locale, l'absence dans la liste chargée et le panneau fermé.
5. Activez ce **même chemin local** depuis les réglages/PUT natifs. Exigez HTTP 200, puis effectuez les vérifications ci-dessous. Pour une installation initialement locale, gardez son chemin vérifié existant et suivez désactiver → arrêter/redémarrer → activer ; aucune transition URL→local n'est nécessaire.

Le mode d'installation sauvegardé devient durablement local : Bifrost ne télécharge plus l'ancienne URL du plugin au démarrage. L'opérateur conserve le fichier immuable et son montage persistant ; ne rétablissez pas silencieusement le mode URL. Aucune édition directe de base ni suppression/recréation du plugin ne fait partie de la récupération.

Après récupération, vérifiez `enabled:true`, le statut `active` et le **chemin** sauvegardé dans `GET /api/plugins`, la présence dans `GET /api/plugins/loaded`, le panneau, les modèles/groupes/politiques de clés conservés et la relecture `/v1/models` inchangée de la clé témoin. La récupération utilise les mêmes octets, pas un nouvel artefact, une mise à niveau du gateway, une migration de volume ou un retour arrière qualifié ; elle ne doit pas élargir les permissions natives. [Les preuves du checkpoint 2.3 dans STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md#foundation-checkpoint) sont bornées à ses paires exactes, pas une garantie générale de compatibilité.

## Mettre à jour et revenir en arrière

Arrêtez le gateway et sauvegardez **tout** `/app/data` avant une mise à jour. Pour v0.3.0 publiée / Bifrost 2.2.6, enregistrez l'URL du nouveau `.so` compatible et redémarrez le gateway : Bifrost retélécharge l'URL sauvegardée au démarrage. Désactiver puis réactiver un plugin Go sans redémarrage n'est pas un chemin de mise à jour pris en charge (`plugin already loaded`). Vérifiez de nouveau le chargement, les données conservées et la clé témoin.

Pour le candidat source 2.3.0, la récupération ci-dessus vérifie seulement les **mêmes octets existants**, pas une mise à jour vers de nouveaux octets ou un autre gateway. Un nouveau plugin exige son propre fichier versionné compatible, son empreinte et une qualification de mise à jour ; ne remplacez jamais un fichier chargé en place. Une mise à jour à chaud échouée restaure la ligne précédente, chemin compris : ne supposez pas la nouvelle URL ou le nouveau chemin local enregistré. Relisez-le. Les assets publiés v0.3.0 ne constituent pas une paire de mise à jour 2.3. Une mise à niveau du gateway peut migrer la base Bifrost ; la récupération d'activation ne qualifie pas à elle seule cette migration ou son retour arrière.

Les données Registry écrites avant v0.3 n'ont pas de sélection d'accès par clé. À partir de v0.3.0, quand un modèle d'une clé est proposé par plusieurs accès fournisseurs, le plugin se charge mais retire ce modèle du catalogue de la clé : le journal du gateway affiche `bifrost-registry: warning: policy <clé>: model <alias> has N accesses and no access_selection`, et le panneau marque la clé **Choix d'accès requis**. Ouvrez la clé, décochez dans la liste Accès du modèle ceux qu'elle ne doit pas utiliser, puis publiez.

Pour revenir en arrière, arrêtez le gateway, restaurez **l'intégralité** de la sauvegarde du volume prise à l'arrêt, remettez l'image précédente si elle avait changé, puis redémarrez. Restaurer le volume complet récupère ensemble la base Bifrost, son URL de plugin et le registre ; pointer un ancien plugin sur un registre déjà migré n'est pas un retour arrière éprouvé. Conservez les octets de l'ancien plugin à son URL versionnée.

## Qualification et limites

v0.3.0 a été qualifiée nativement sur Linux AMD64 et ARM64 contre Bifrost 2.2.6 avec des fournisseurs synthétiques ; résultats des suites, sondes de distribution, empreintes et provenance figurent dans [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) et l'[exécution de release](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38761865725). Le `npm ci` de l'interface upstream Bifrost a signalé 9 vulnérabilités (1 basse, 5 élevées, 3 critiques) durant les deux builds natifs ; cette interface est compilée en fichiers statiques, pas en serveur Node/Next. Aucun SBOM, traçage du bundle ou test d'exploitabilité n'a établi de chemin atteignable ni d'exploitation ; le risque résiduel est plausible mais non démontré. L'installation séparée de l'interface Registry a signalé 0 vulnérabilité. Ce n'est pas une garantie de sécurité ; aucune correction upstream n'est incluse. Le triage est suivi dans [#141](https://github.com/sofianbll/bifrost-plugin-registry/issues/141). L'image Bifrost officielle précompilée, l'inférence réelle, un déploiement en production et l'intégration native à la barre latérale ne sont pas qualifiés par ces contrôles.

Pour le socle 2.3 distinct et non publié, [STATUS consigne la qualification native exacte et l'assessment borné #141 terminé](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md#foundation-checkpoint). L'assessment conclut que le candidat est acceptable pour le jeu d'advisories capturé sous limites explicites, pas universellement sûr ni accepté pour une release ou un rollout ; il ne corrige pas les constats historiques v0.3.0 ci-dessus.

L'ancienne recette de montage binaire pour Bifrost 2.2.1 est conservée dans [l'archive historique](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/archive/installation-2.2.1.md).
