# Installer Registry sur une instance de test

<a id="installer-registry"></a>

[English](../INSTALL.md) · Français

Démarrez une nouvelle instance Bifrost, chargez Registry et ouvrez son panneau connecté au gateway.

## Avant de commencer

Prévoyez un hôte Linux AMD64 ou ARM64 avec Docker et un stockage persistant inscriptible. Préparez la configuration de l’administration et des fournisseurs Bifrost, avec l’authentification du tableau de bord activée.

Deux éléments sont nécessaires : l’image Bifrost dynamique compatible et le fichier `.so` du plugin Registry. L’image ne contient pas le plugin ; l’image officielle statique ne peut pas le charger.

**Vous avez déjà un gateway ? Arrêtez-vous ici.** Préparez une instance de test séparée et sauvegardez le volume complet, gateway à l’arrêt, fichiers SQLite et WAL compris. Ne laissez jamais deux processus écrire sur ce volume en même temps. La compatibilité d’une mise à jour en place n’est pas établie. Consultez les [limites de migration et la restauration coordonnée](#mettre-a-jour-et-revenir-en-arriere).

## 1. Télécharger les fichiers compatibles

<a id="_1-telecharger-et-verifier"></a>

Utilisez Registry v0.4.0 avec Bifrost 2.3.0 non modifié, Go 1.27.1 et Alpine 3.23 (musl). Image et plugin doivent correspondre exactement : architecture, chaîne Go, versions des dépendances, OS et libc. Choisissez ci-dessous le plugin de votre hôte.

Téléchargez le plugin et [SHA256SUMS](https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/SHA256SUMS) dans le même dossier. Lancez-y la commande de vérification et contrôlez que votre plugin indique OK ; les fichiers non téléchargés sont ignorés. Récupérez ensuite l’image épinglée ci-dessous. Docker choisit l’architecture de l’hôte.

| Hôte Linux | Registry v0.4.0 · Bifrost 2.3.0 |
| --- | --- |
| AMD64 (x86_64) | [bifrost-registry-v0.4.0-linux-amd64.so](https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/bifrost-registry-v0.4.0-linux-amd64.so) |
| ARM64 | [bifrost-registry-v0.4.0-linux-arm64.so](https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.4.0/bifrost-registry-v0.4.0-linux-arm64.so) |

```bash
sha256sum -c --ignore-missing SHA256SUMS

docker pull ghcr.io/sofianbll/bifrost-dynamic@sha256:29e026ab80de357938e3e6df5ac1c3c54c3f6877f4daa2c859e980140fdbbaa0
```

**Attendu :** Le plugin téléchargé indique OK et Docker a récupéré l’image.

## 2. Préparer les identifiants

Créez un secret d’au moins 32 caractères pour `REGISTRY_ADMIN_TOKEN`. Vous le saisirez pour ouvrir le panneau Registry.

Renseignez `REGISTRY_BIFROST_AUTH` avec l’en-tête `Authorization` complet correspondant à votre authentification admin Bifrost, préfixe compris (par exemple `Basic <base64(username:password)>`, avec vos propres identifiants). Le plugin l’utilise pour joindre l’API admin native ; ce n’est pas une clé d’application.

Conservez ces deux valeurs dans un gestionnaire de secrets ou un fichier d’environnement privé, jamais dans le JSON versionné ni les logs. Rendez-les disponibles dans l’environnement du shell qui lancera Docker : la commande suivante transmet ces deux variables au conteneur.

## 3. Démarrer Bifrost

<a id="_2-recuperer-l-image-et-demarrer-le-gateway"></a>

Remplacez `<image reference>` ci-dessous par la référence complète de l’image épinglée à l’étape 1. Adaptez le nom du conteneur, les ports et le volume à votre instance de test ; gardez l’entrypoint normal de l’image et un stockage persistant inscriptible sur `/app/data`.

Bifrost utilise le port `8080`. Le port publié `127.0.0.1:8099:8099` rend le futur panneau Registry accessible uniquement sur le loopback de l’hôte. Dans le conteneur, son écoute doit être `0.0.0.0:8099`, comme prévu à l’étape 4. Démarrer cette image n’installe pas Registry.

```bash
docker run -d --name bifrost \
  -p 8080:8080 -p 127.0.0.1:8099:8099 \
  -v bifrost-data:/app/data \
  -e REGISTRY_ADMIN_TOKEN -e REGISTRY_BIFROST_AUTH \
  <image reference>
```

## 4. Installer le plugin Registry

<a id="_3-installer-le-plugin-par-url"></a>

Ouvrez les réglages de plugins natifs Bifrost et le [fragment de configuration du plugin](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json). Fusionnez cette entrée avec votre configuration sans remplacer les réglages existants. Renseignez `path` avec l’URL directe du `.so` de votre architecture à l’étape 1, pas celle de la page de release.

Gardez `name: "bifrost-registry"`, `enabled: true`, `placement: "post_builtin"` et `order: 0`. Dans `config`, gardez `registry_path: "/app/data/registry/registry.json"`, `admin_listen: "0.0.0.0:8099"`, `admin_token_env: "REGISTRY_ADMIN_TOKEN"`, `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"` et `bifrost_url: "http://127.0.0.1:8080"` pour cette installation dans un même conteneur.

Enregistrez l’entrée. Bifrost télécharge l’URL à l’installation et à chaque démarrage : conservez les mêmes octets de ce fichier versionné à disposition. Registry crée son fichier de données s’il manque et embarque son interface ; aucun montage frontend n’est nécessaire.

## 5. Vérifier le chargement et la connexion

<a id="verifier"></a>

Avec l’administration Bifrost authentifiée, vérifiez que Registry est `active` dans `GET /api/plugins` et aussi présent dans `GET /api/plugins/loaded`. Les deux contrôles sont nécessaires.

Ouvrez `http://127.0.0.1:8099/model-registry` et saisissez la **valeur** du jeton défini dans `REGISTRY_ADMIN_TOKEN`, pas le nom de la variable. Le jeton reste en mémoire dans l’onglet ; ressaisissez-le après rechargement. Interrogez ensuite `GET http://127.0.0.1:8099/api/status` avec ce jeton en Bearer et contrôlez `bifrost_connected: true` ; `version` identifie la release installée.

Si le chargement échoue ou si le panneau ne se connecte pas, [recherchez l’erreur correspondante dans le dépannage](TROUBLESHOOTING.md). Une fois connecté, [choisissez les modèles d’une application](USER-GUIDE.md) pour publier une sélection de test et vérifier la liste renvoyée par Bifrost. Les clés natives préexistantes restent non gérées jusqu’à adoption explicite ; l’adoption n’élargit pas leurs droits natifs.

**Attendu :** Le plugin est actif et chargé, le panneau s’ouvre et le statut indique `bifrost_connected: true`.

## Autres cas et référence

Les sections suivantes conservent les anciens fichiers, les autres modes d’installation, la récupération et les détails de qualification. [Trouver un autre guide](README.md).

**Release stable courante :** [v0.4.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.4.0), publiée le 16 octobre 2026 depuis Registry `ba59b878f824f04e54bdd5e9760352c2727ea245`, associe Bifrost 2.3.0 non modifié (`transports/v2.3.0`, commit `9237ec06672406e437b3cb33fc793ffd0403b3ae`), Go 1.27.1 et Alpine 3.23. [L'exécution de release](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38887602494) a qualifié nativement les deux architectures puis construit, démarré et sondé chaque image avec le plugin séparé installé par URL avant publication (conteneur recréé, fournisseur synthétique, sans inférence). v0.3.0 reste publiée pour Bifrost 2.2.6 ; n'installez jamais ses plugins sur un gateway 2.3.

## Quels fichiers pour quel hôte

Choisissez la ligne de votre hôte.

| Hôte | Release | Bifrost | Image du gateway | Plugin (`.so`) |
| --- | --- | --- | --- | --- |
| Linux AMD64 (x86_64) | [v0.4.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.4.0) (stable courante) | 2.3.0 | `ghcr.io/sofianbll/bifrost-dynamic:2.3.0` | `bifrost-registry-v0.4.0-linux-amd64.so` |
| Linux ARM64 | [v0.4.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.4.0) (stable courante) | 2.3.0 | `ghcr.io/sofianbll/bifrost-dynamic:2.3.0` | `bifrost-registry-v0.4.0-linux-arm64.so` |
| Linux AMD64 (x86_64), stable précédente | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-amd64.so` |
| Linux ARM64, stable précédente | [v0.3.0](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne prérelease | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-amd64.so` |
| Linux ARM64, ancienne prérelease | [v0.3.0-rc.8](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.8) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.8-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (ancienne) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.7](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.7) (ancienne) | 2.2.6 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.6` | `bifrost-registry-v0.3.0-rc.7-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (ancienne) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.6](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.6) (ancienne) | 2.2.5 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.5` | `bifrost-registry-v0.3.0-rc.6-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (ancienne) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.5](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.5) (ancienne) | 2.2.4 | `ghcr.io/sofianbll/bifrost-dynamic:2.2.4` | `bifrost-registry-v0.3.0-rc.5-linux-arm64.so` |
| Linux ARM64, ancienne | [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4) (ancienne) | 2.2.3 | `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` | `bifrost-registry-v0.3.0-rc.4-linux-arm64.so` |
| Linux AMD64 (x86_64), ancienne | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (ancienne) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-amd64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-amd64.so` |
| Linux ARM64, ancienne | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (ancienne) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-arm64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-arm64.so` |

- Téléchargez chaque `.so` depuis sa page de release. L'URL du plugin est toujours `https://github.com/sofianbll/bifrost-plugin-registry/releases/download/<release>/<fichier plugin>` : l'URL du **fichier `.so`**, pas celle du dépôt ni de la page de release. v0.4.0, v0.3.0 et rc.5 à rc.8 n'ont pas d'archive d'image : l'image du gateway vient de GHCR (voir le [mode A](#mode-a-image-et-url-du-plugin)) ; les releases plus anciennes la fournissent en archive sur leur page de release.
- Chaque release contient un fichier `SHA256SUMS`. Vérifiez chaque téléchargement avec lui.
- Empreintes des plugins v0.4.0 : AMD64 `5dba39e79417a5c0ab665d80ae26b2a5438190701448ae47714ce899d0469fb9` ; ARM64 `843e96afc947159f247a027d7fcb4be10e55f046057e792aea39b0e850522ae5`.
- v0.4.0 est la release stable pour les deux architectures. v0.2.0-rc.1 est antérieure au catalogue Models.dev, aux endpoints par accès et aux capacités natives de prix et de routage ajoutés par v0.3.0.
- Voir [Qualification et limites](#qualification-et-limites).

## Choisir un mode d'installation

**Mode A : image Registry et URL du plugin (recommandé).** Exécutez l'image dynamique publiée et ajoutez le `.so` par **URL directe** dans les réglages plugin de Bifrost. L'image contient un Bifrost non modifié compilé avec chargement dynamique et **sans plugin** : le chemin d'inférence auquel vous faites confiance n'est jamais patché, et Registry reste un artefact séparé et versionné.

**Mode B : plugin seul, sur un gateway déjà en place.** Tout Bifrost **compilé avec chargement dynamique** peut héberger le `.so` Registry. Il doit correspondre à l'architecture, la chaîne Go, les versions de dépendances, l'OS et la libc de votre gateway ; les paires qualifiées utilisent Linux/musl et Go 1.27.1. L'image officielle précompilée statique refuse les plugins dynamiques (`Dynamic loading not supported`) ; voir [Dépannage](TROUBLESHOOTING.md).

## Mode A : image et URL du plugin

Le parcours en cinq étapes ci-dessus est le mode A de la release courante. Retrouvez les téléchargements à l’[étape 1](#_1-telecharger-et-verifier), le démarrage à l’[étape 3](#_2-recuperer-l-image-et-demarrer-le-gateway) et l’installation à l’[étape 4](#_3-installer-le-plugin-par-url). Conservez les providers, clés, budgets et règles Bifrost existants lorsque vous préparez une copie de test séparée.

Sous macOS, `shasum -a 256 <fichier>` donne l’empreinte à comparer à la main.

Pour v0.3.0-rc.4 et v0.2.0-rc.1, téléchargez aussi l'archive d'image du tableau et vérifiez-la de la même façon.

Les tags pratiques `2.3.0` et `2.3.0-go1.27.1` pointent actuellement sur le digest de l’étape 1 mais peuvent changer ; épinglez plutôt le digest.

Pour la stable précédente v0.3.0 / Bifrost 2.2.6, épinglez `ghcr.io/sofianbll/bifrost-dynamic@sha256:849fe441be5215a3c4783a9fcdd9989dde1f3c8c201dc6b4c140060880f07a66` ; le tag `2.2.6` pointe toujours dessus, pas sur l'image 2.3.0.

Pour v0.3.0-rc.8 (même Bifrost 2.2.6), épinglez `ghcr.io/sofianbll/bifrost-dynamic@sha256:1555e28d4e5adca52d10c54d2e94db18a6c8346fa29b250de50e408ada42d6fe` ; pour v0.3.0-rc.7, épinglez `ghcr.io/sofianbll/bifrost-dynamic@sha256:d0b4e98c40e22f142c637737507acfb4e181f6dc340c85aba8989b9df0bbf3be` ; pour rc.6 (tag `2.2.5`), `ghcr.io/sofianbll/bifrost-dynamic@sha256:7c3354b041e4c06b1797a58adcfe8c6eeb11b270edff2ccf5610c4a98809d367` ; pour rc.5 (tag `2.2.4`), `ghcr.io/sofianbll/bifrost-dynamic@sha256:ef56067e2bf807930270d2d6318ba9e9996ed914c9469db46068078d3c06e7b2`.

Pour v0.3.0-rc.4 et v0.2.0-rc.1, chargez plutôt l'archive :

```bash
docker load -i <archive d'image>   # affiche le tag de l'image chargée
```

Pour l’installation par API, utilisez `POST /api/plugins` avec le même fragment fusionné et la même [configuration du plugin](#identifiants-et-configuration-du-plugin) qu’à l’étape 4. Conservez les octets de cette version disponibles à l’URL sauvegardée pour chaque démarrage.

Si le téléchargement échoue avec une erreur de permission sur un fichier temporaire, voir [Dépannage](TROUBLESHOOTING.md).

## Mode B : plugin seul

1. Téléchargez le `.so` correspondant à votre gateway d'après le tableau et vérifiez son empreinte comme ci-dessus. Si votre gateway provient d'une autre compilation, [compilez la paire vous-même](../BUILD.md).
2. Rendez-le accessible au gateway soit par **chemin de fichier local** (`path: "/plugins/bifrost-registry.so"` dans l'entrée plugin, fichier lisible par le processus Bifrost) soit par **URL http(s)** (Bifrost le télécharge au démarrage).
3. Fusionnez le [fragment de configuration](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) avec ce `path` et la [configuration du plugin](#identifiants-et-configuration-du-plugin) ci-dessous, depuis l'interface native Bifrost ou `POST /api/plugins`.

Pour **v0.4.0 / Bifrost 2.3.0**, une installation locale initiale peut conserver le même nom de fichier immuable et versionné pour récupérer par **désactiver → redémarrer → activer**. Gardez les octets du `.so` de la paire exacte lisibles à ce chemin absolu dans le conteneur entre les redémarrages, de préférence sur un montage en lecture seule. Cela ne qualifie pas la réactivation locale à chaud. L'installation initiale par URL reste prise en charge, mais sa récupération exige la [transition explicite URL→local](#recuperer-l-activation-apres-desactivation) ci-dessous.

## Identifiants et configuration du plugin

Les deux modes utilisent deux secrets distincts, fournis comme valeurs d'environnement (jamais dans le JSON versionné ni dans les logs) :

| Variable | Rôle |
| --- | --- |
| `REGISTRY_ADMIN_TOKEN` | Au moins 32 caractères ; ouvre le panneau Registry. |
| `REGISTRY_BIFROST_AUTH` | Valeur complète de l'en-tête `Authorization` permettant au plugin d'appeler l'API admin native Bifrost, par exemple `Basic <base64(utilisateur:mot-de-passe)>`. Doit correspondre à l'authentification configurée du gateway. |

Pour la v0.4.0 courante / Bifrost 2.3.0, gardez l'authentification du tableau de bord activée pour les appels de Registry à l'API native et une clé virtuelle dédiée pour `/v1/models`, comme dans la configuration qualifiée.

Avec Bifrost 2.2.6 (v0.3.0 et rc.7/rc.8), l'API de gestion native (`/api/...`, hors routes publiques comme `/health`) reste verrouillée tant que l'authentification du tableau de bord n'est pas activée ou qu'aucun jeton de configuration (setup token) n'est envoyé ([notes de version amont](https://github.com/maximhq/bifrost/releases/tag/transports%2Fv2.2.6)). Registry n'envoie que l'en-tête `Authorization` issu de `REGISTRY_BIFROST_AUTH`, jamais de jeton de configuration : activez donc l'authentification du tableau de bord, comme le fait la configuration qualifiée. 2.2.6 active aussi `enforce_auth_on_inference` par défaut sur les nouveaux déploiements : l'inférence, y compris la vérification de `/v1/models` décrite dans « Vérifier », demande un identifiant, comme la clé virtuelle dédiée qui y est utilisée.

Dans l'entrée du plugin, gardez :

- `placement: "post_builtin"` et `order: 0` ;
- `registry_path: "/app/data/registry/registry.json"` ;
- `admin_listen: "0.0.0.0:8099"` ;
- `admin_token_env: "REGISTRY_ADMIN_TOKEN"` ;
- `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"` ;
- `bifrost_url: "http://127.0.0.1:8080"` lorsque plugin et gateway partagent le même conteneur.

Le plugin initialise un fichier Registry manquant. Ses assets d'interface sont embarqués ; aucun montage de frontend séparé n'est nécessaire.

L’interface de v0.4.0, de v0.3.0 et de v0.3.0-rc.4 à rc.8 est en anglais par défaut ; le français est à un clic ou via `?lang=fr`. v0.2.0-rc.1, installée par les lignes anciennes, s’ouvre d’abord en français. La version de release dans `/api/status` est disponible à partir de v0.3.0.

## Récupérer l'activation après désactivation

La réactivation à chaud d'un `.so` Go déjà chargé n'est pas prise en charge (`HTTP 500`, `plugin already loaded`) ; le panneau Registry reste fermé après l'échec.

- **v0.3.0 publiée / Bifrost 2.2.6 :** l'échec conserve la ligne sauvegardée `enabled:true`. Redémarrez le gateway pour recharger le plugin.
- **v0.4.0 courante / Bifrost 2.3.0 :** l'échec d'activation par URL restaure la ligne précédente, `enabled:false`. Le redémarrage seul le laisse désactivé. Réactiver l'URL inchangée après redémarrage échoue aussi : la vérification au démarrage désactivé a déjà ouvert le module Go, et l'activation par URL le retélécharge sous un autre nom temporaire (`plugin already loaded`). Ne répétez pas les tentatives et ne traitez pas un 500 comme un succès.

**Récupération de v0.4.0 / Bifrost 2.3.0 installé par URL — passage explicite en mode local :**

1. Préparez une copie locale des **mêmes octets du plugin compatible**, vérifiés contre le SHA-256 de l'artefact installé, sous un nouveau nom de fichier versionné et persistant. Le `path` est absolu **dans le conteneur du gateway**, pas sur l'hôte Docker. Par exemple, utilisez `/app/data/registry/plugins/sha256-<empreinte vérifiée>/bifrost-registry.so` sur le volume persistant existant, ou un fichier versionné monté en lecture seule sous `/plugins/`. Gardez le fichier lisible et si possible en lecture seule ; le répertoire de données reste inscriptible pour les sauvegardes Registry. N'écrasez jamais un `.so` déjà chargé.
2. Désactivez depuis les réglages plugin natifs ou `PUT /api/plugins/bifrost-registry`. Un échec d'activation par URL antérieur doit laisser `enabled:false` et le panneau fermé.
3. **Avant de redémarrer**, enregistrez le `path` local avec `enabled:false` depuis l'API/les réglages natifs, sans changer les autres réglages du plugin. Relisez le flag désactivé, le chemin local exact et les réglages dans `GET /api/plugins` ; confirmez l'absence dans `GET /api/plugins/loaded` et le panneau fermé. N'activez pas la copie locale dans l'ancien processus.
4. Arrêtez complètement le processus gateway et attendez sa fin, puis redémarrez avec le même fichier/montage au même nom. Confirmez la ligne sauvegardée désactivée/locale, l'absence dans la liste chargée et le panneau fermé.
5. Activez ce **même chemin local** depuis les réglages/PUT natifs. Exigez HTTP 200, puis effectuez les vérifications ci-dessous. Pour une installation initialement locale, gardez son chemin vérifié existant et suivez désactiver → arrêter/redémarrer → activer ; aucune transition URL→local n'est nécessaire.

Le mode d'installation sauvegardé devient durablement local : Bifrost ne télécharge plus l'ancienne URL du plugin au démarrage. L'opérateur conserve le fichier immuable et son montage persistant ; ne rétablissez pas silencieusement le mode URL. Aucune édition directe de base ni suppression/recréation du plugin ne fait partie de la récupération.

Après récupération, vérifiez `enabled:true`, le statut `active` et le **chemin** sauvegardé dans `GET /api/plugins`, la présence dans `GET /api/plugins/loaded`, le panneau, les modèles/groupes/politiques de clés conservés et la relecture `/v1/models` inchangée de la clé témoin. La récupération utilise les mêmes octets, pas un nouvel artefact, une mise à niveau du gateway, une migration de volume ou un retour arrière qualifié ; elle ne doit pas élargir les permissions natives. [Les preuves du checkpoint public 2.3](https://github.com/sofianbll/bifrost-plugin-registry/issues/109#issuecomment-6203460908) sont bornées à ses paires exactes, pas une garantie générale de compatibilité.

## Mettre à jour et revenir en arrière

Arrêtez le gateway et sauvegardez **tout** `/app/data` avant une mise à jour. Pour v0.3.0 publiée / Bifrost 2.2.6, enregistrez l'URL du nouveau `.so` compatible et redémarrez le gateway : Bifrost retélécharge l'URL sauvegardée au démarrage. Désactiver puis réactiver un plugin Go sans redémarrage n'est pas un chemin de mise à jour pris en charge (`plugin already loaded`). Vérifiez de nouveau le chargement, les données conservées et la clé témoin.

Pour v0.4.0 / Bifrost 2.3.0, la récupération ci-dessus vérifie seulement les **mêmes octets existants**, pas une mise à jour vers de nouveaux octets ou un autre gateway. Un nouveau plugin exige son propre fichier versionné compatible, son empreinte et une qualification de mise à jour ; ne remplacez jamais un fichier chargé en place. Une mise à jour à chaud échouée restaure la ligne précédente, chemin compris : ne supposez pas la nouvelle URL ou le nouveau chemin local enregistré. Relisez-le. N'installez jamais les assets v0.3.0 sur le gateway 2.3. La mise à niveau en place depuis v0.3.0/2.2.6 vers v0.4.0/2.3.0 n'est **pas qualifiée** : arrêtez le gateway, sauvegardez tout le volume, puis changez ensemble image et plugin. Une mise à niveau du gateway peut migrer la base Bifrost ; la récupération d'activation ne qualifie pas à elle seule cette migration ou son retour arrière.

Les données Registry écrites avant v0.3 n'ont pas de sélection d'accès par clé. À partir de v0.3.0, quand un modèle d'une clé est proposé par plusieurs accès fournisseurs, le plugin se charge mais retire ce modèle du catalogue de la clé : le journal du gateway affiche `bifrost-registry: warning: policy <clé>: model <alias> has N accesses and no access_selection`, et le panneau marque la clé **Choix d'accès requis**. Ouvrez la clé, décochez dans la liste Accès du modèle ceux qu'elle ne doit pas utiliser, puis publiez.

Pour revenir en arrière, arrêtez le gateway, restaurez **l'intégralité** de la sauvegarde du volume prise à l'arrêt, remettez l'image précédente si elle avait changé, puis redémarrez. Restaurer le volume complet récupère ensemble la base Bifrost, son URL de plugin et le registre ; pointer un ancien plugin sur un registre déjà migré n'est pas un retour arrière éprouvé. Conservez les octets de l'ancien plugin à son URL versionnée.

## Qualification et limites

### Preuves précédentes v0.3.0 (historiques)

v0.3.0 a été qualifiée nativement sur Linux AMD64 et ARM64 contre Bifrost 2.2.6 avec des fournisseurs synthétiques ; résultats des suites, sondes de distribution, empreintes et provenance figurent dans [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) et l'[exécution de release](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38761865725). Le `npm ci` de l'interface upstream Bifrost a signalé 9 vulnérabilités (1 basse, 5 élevées, 3 critiques) durant les deux builds natifs ; cette interface est compilée en fichiers statiques, pas en serveur Node/Next. Aucun SBOM, traçage du bundle ou test d'exploitabilité n'a établi de chemin atteignable ni d'exploitation ; le risque résiduel est plausible mais non démontré. L'installation séparée de l'interface Registry a signalé 0 vulnérabilité. Ce n'est pas une garantie de sécurité ; aucune correction upstream n'est incluse. Le triage est suivi dans [#141](https://github.com/sofianbll/bifrost-plugin-registry/issues/141). L'image Bifrost officielle précompilée, l'inférence réelle, un déploiement en production et l'intégration native à la barre latérale ne sont pas qualifiés par ces contrôles.

### Preuves courantes v0.4.0

La v0.4.0 courante a été qualifiée nativement sur Linux AMD64 et ARM64 (musl) contre Bifrost 2.3.0 ; chaque image publiée a été construite depuis sa paire qualifiée puis sondée avec installation du plugin par URL, conteneur recréé et fournisseur synthétique, sans inférence ([exécution de release](https://github.com/sofianbll/bifrost-plugin-registry/actions/runs/38887602494)). Vérifiez la provenance des assets avec `gh attestation verify <fichier> --repo sofianbll/bifrost-plugin-registry`. Aucun gateway réel ni la production n'ont été touchés ; l'inférence réelle, la préparation à la production et la réactivation locale à chaud ne sont pas qualifiées. Le [checkpoint historique et l'assessment borné #141](https://github.com/sofianbll/bifrost-plugin-registry/issues/109#issuecomment-6203460908) concernent leurs sujets exacts, sans garantie universelle de sécurité ni correction des constats historiques v0.3.0 ci-dessus.

L'ancienne recette de montage binaire pour Bifrost 2.2.1 est conservée dans [l'archive historique](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/archive/installation-2.2.1.md).
