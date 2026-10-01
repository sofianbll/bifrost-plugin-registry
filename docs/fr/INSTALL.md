# Installer Registry

[English](../INSTALL.md) · Français

Registry s'installe en **deux artefacts séparés** : une image de gateway Bifrost compilée avec chargement dynamique (elle ne contient aucun plugin) et le plugin Registry, un fichier `.so` qui embarque son interface. Les deux doivent provenir de la même compilation : même architecture, chaîne Go, versions de dépendances et libc. Démarrer l'image n'installe pas le plugin. Utilisez une instance de staging avant de migrer un déploiement existant.

## Quels fichiers pour quel hôte

Ce tableau est le seul endroit qui nomme les fichiers de release. Choisissez la ligne de votre hôte.

| Hôte | Release | Bifrost | Archive d'image | Plugin (`.so`) |
| --- | --- | --- | --- | --- |
| Linux ARM64 | [v0.3.0-rc.4](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4) (courante) | 2.2.3 | `bifrost-dynamic-2.2.3-linux-arm64.tar.gz` | `bifrost-registry-v0.3.0-rc.4-linux-arm64.so` |
| Linux AMD64 (x86_64) | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (précédente) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-amd64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-amd64.so` |
| Linux ARM64, ancienne paire | [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) (précédente) | 2.2.2 | `bifrost-dynamic-2.2.2-linux-arm64.tar.gz` | `bifrost-registry-v0.2.0-rc.1-linux-arm64.so` |

- Téléchargez chaque fichier depuis sa page de release. L'URL du plugin est toujours `https://github.com/sofianbll/bifrost-plugin-registry/releases/download/<release>/<fichier plugin>` : l'URL du **fichier `.so`**, pas celle du dépôt ni de la page de release.
- Chaque release contient un fichier `SHA256SUMS`. Vérifiez chaque téléchargement avec lui.
- Aucune paire AMD64 n'est encore qualifiée ni publiée pour la version de Bifrost de la release courante : les hôtes AMD64 utilisent la release précédente. Elle est antérieure au catalogue Models.dev, aux endpoints par accès et aux capacités natives de prix et de routage qu'ajoute la release courante.
- Les deux releases sont des release candidates. Voir [Qualification et limites](#qualification-et-limites).

## Choisir un mode d'installation

**Mode A : image Registry et URL du plugin (recommandé).** Exécutez l'image dynamique publiée et ajoutez le `.so` par **URL directe** dans les réglages plugin de Bifrost. L'image contient un Bifrost non modifié compilé avec chargement dynamique et **sans plugin** : le chemin d'inférence auquel vous faites confiance n'est jamais patché, et Registry reste un artefact séparé et versionné.

**Mode B : plugin seul, sur un gateway déjà en place.** Tout Bifrost **compilé avec chargement dynamique** peut héberger le `.so` Registry. Il doit correspondre à l'architecture, la chaîne Go, les versions de dépendances, l'OS et la libc de votre gateway ; les paires qualifiées utilisent Linux/musl et Go 1.27.1. L'image officielle précompilée statique refuse les plugins dynamiques (`Dynamic loading not supported`) ; voir [Dépannage](TROUBLESHOOTING.md).

## Mode A : image et URL du plugin

### 1. Télécharger et vérifier

Téléchargez l'archive d'image et le `.so` de votre hôte d'après le tableau, ainsi que `SHA256SUMS`, puis comparez les empreintes :

```bash
sha256sum <archive d'image> <fichier plugin>
# Comparer chaque résultat avec le même nom de fichier dans SHA256SUMS.
```

Sous macOS, `shasum -a 256 <fichier>` donne l'empreinte équivalente.

### 2. Charger l'image et démarrer le gateway

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
  <tag de l'image>
```

Le port habituel du gateway est `8080`. Publiez le port Registry `8099` uniquement sur le loopback de l'hôte, comme ci-dessus. Dans le conteneur, `admin_listen` doit être `0.0.0.0:8099` pour que ce mapping fonctionne.

### 3. Installer le plugin par URL

Ajoutez le plugin depuis l'interface native Bifrost ou `POST /api/plugins`, avec l'URL du plugin construite d'après le tableau. Fusionnez le [fragment de configuration](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) avec la configuration existante, en remplaçant sa `path` fictive par cette URL, et gardez la [configuration du plugin](#identifiants-et-configuration-du-plugin) ci-dessous. Bifrost télécharge l'URL enregistrée à l'installation et à chaque démarrage : conservez les octets de cette version disponibles à cette URL.

Si le téléchargement échoue avec une erreur de permission sur un fichier temporaire, voir [Dépannage](TROUBLESHOOTING.md).

## Mode B : plugin seul

1. Téléchargez le `.so` correspondant à votre gateway d'après le tableau et vérifiez son empreinte comme ci-dessus. Si votre gateway provient d'une autre compilation, [compilez la paire vous-même](../BUILD.md).
2. Rendez-le accessible au gateway soit par **chemin de fichier local** (`path: "/plugins/bifrost-registry.so"` dans l'entrée plugin, fichier lisible par le processus Bifrost) soit par **URL http(s)** (Bifrost le télécharge au démarrage).
3. Fusionnez le [fragment de configuration](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/configs/plugin.fragment.json) avec ce `path` et la [configuration du plugin](#identifiants-et-configuration-du-plugin) ci-dessous, depuis l'interface native Bifrost ou `POST /api/plugins`.

## Identifiants et configuration du plugin

Les deux modes utilisent deux secrets distincts, fournis comme valeurs d'environnement (jamais dans le JSON versionné ni dans les logs) :

| Variable | Rôle |
| --- | --- |
| `REGISTRY_ADMIN_TOKEN` | Au moins 32 caractères ; ouvre le panneau Registry. |
| `REGISTRY_BIFROST_AUTH` | Valeur complète de l'en-tête `Authorization` permettant au plugin d'appeler l'API admin native Bifrost, par exemple `Basic <base64(utilisateur:mot-de-passe)>`. Doit correspondre à l'authentification configurée du gateway. |

Dans l'entrée du plugin, gardez :

- `placement: "post_builtin"` et `order: 0` ;
- `registry_path: "/app/data/registry/registry.json"` ;
- `admin_listen: "0.0.0.0:8099"` ;
- `admin_token_env: "REGISTRY_ADMIN_TOKEN"` ;
- `bifrost_auth_env: "REGISTRY_BIFROST_AUTH"` ;
- `bifrost_url: "http://127.0.0.1:8080"` lorsque plugin et gateway partagent le même conteneur.

Le plugin initialise un fichier Registry manquant. Ses assets d'interface sont embarqués ; aucun montage de frontend séparé n'est nécessaire.

## Vérifier

Ouvrez **http://127.0.0.1:8099/model-registry** et saisissez le jeton d'administration Registry. Il reste dans la mémoire de l'onglet et doit être ressaisi après rechargement. L'interface est en anglais par défaut ; le français est à un clic ou via `?lang=fr`.

Vérifiez que le plugin est `active` dans `GET /api/plugins` et présent dans `GET /api/plugins/loaded`. Publiez un petit catalogue de test et relisez `/v1/models` avec une clé virtuelle dédiée. Les clés natives préexistantes restent non gérées jusqu'à adoption explicite ; l'adoption n'élargit pas leurs droits natifs.

## Mettre à jour et revenir en arrière

Arrêtez le gateway et sauvegardez **tout** `/app/data` avant une mise à jour. Enregistrez l'URL du nouveau `.so` compatible et redémarrez le gateway : Bifrost retélécharge l'URL sauvegardée au démarrage. Désactiver puis réactiver un plugin Go sans redémarrage n'est pas un chemin de mise à jour pris en charge (`plugin already loaded`). Vérifiez de nouveau le chargement, les données conservées et la clé témoin.

Pour revenir en arrière, arrêtez le gateway, restaurez **l'intégralité** de la sauvegarde du volume prise à l'arrêt, remettez l'image précédente si elle avait changé, puis redémarrez. Restaurer le volume complet récupère ensemble la base Bifrost, son URL de plugin et le registre ; pointer un ancien plugin sur un registre déjà migré n'est pas un retour arrière éprouvé. Conservez les octets de l'ancien plugin à son URL versionnée.

## Qualification et limites

La paire courante est qualifiée sur Linux ARM64 avec des fournisseurs synthétiques ; voir le [rapport de qualification ARM64](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/bifrost-2.2.3-arm64-869e251/README.md). Les preuves de la release précédente couvrent les deux architectures, l'installation par URL, la persistance, l'adoption native et une mise à jour/retour arrière ARM64 ([preuves de release](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/v1-final/README.md)). L'inférence chez un fournisseur réel, un déploiement en production et l'intégration à la barre latérale native ne sont pas certifiés par ces contrôles. [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) (en anglais) est le registre de référence.

L'ancienne recette de montage binaire pour Bifrost 2.2.1 est conservée dans [l'archive historique](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/archive/installation-2.2.1.md).
