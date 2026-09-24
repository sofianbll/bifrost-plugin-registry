# Compilation et installation native

La [procédure de livraison V1 RC](RELEASE.md) décrit les deux paires Linux/musl ARM64 et AMD64, l'image Docker Bifrost compilée avec liaison dynamique, le `.so` séparé, l'installation, la mise à jour et le retour arrière. La prérelease publique `v0.2.0-rc.1` et la QA visuelle finale sont en préparation ; les preuves finales du candidat sont dans [`reports/v1-final/`](../reports/v1-final/). Les compilations et pilotes ci-dessous expliquent la provenance et conservent les essais antérieurs.

## Mode standard prioritaire : plugin avec son propre serveur web

Compiler une paire Bifrost dynamique et plugin `.so` pour **le même Go, les mêmes dépendances et options de compilation, le même OS, la même architecture et la même libc**. La commande de compilation commune ci-dessous embarque les assets React dans le `.so`. Par défaut, elle utilise seulement le tag `bifrost` : aucun patch de routes, de menu ou de sources de l'hôte n'est requis pour le panneau Registry. Le gateway et le plugin sont compilés ensemble pour la compatibilité Go ; cela ne transforme pas l'image officielle Bifrost 2.2.2 en hôte dynamique.

Dans la configuration [exemple](../configs/plugin.fragment.json), remplacer l'URL fictive par l'**URL HTTP(S) directe d'un fichier `.so` versionné**, pas par la page d'un dépôt ou d'une release. Bifrost télécharge ce fichier lors de l'installation et de chaque démarrage, puis persiste son URL. Garder les octets de cette version disponibles et vérifier leur empreinte. Une URL de plugin ne provoque aucune installation automatique par l'image : un administrateur doit l'ajouter via l'interface native ou `POST /api/plugins` sur un gateway qui accepte le chargement dynamique. L'[image officielle 2.2.2 Linux ARM64 testée](../reports/stock-v2.2.2-plugin-install/README.md) télécharge bien le fichier mais échoue avec `Dynamic loading not supported` ; les autres variantes officielles ne sont pas qualifiées ici.

Le plugin sert le panneau à `http://127.0.0.1:8099/` (ou `/model-registry`) et l'API à `/api/*`, sur **son propre port**. Le gateway Bifrost reste à son port API, `8080` dans l'exemple. `bifrost_url` désigne ce gateway **vu depuis le processus du plugin** ; `127.0.0.1:8080` suppose qu'ils partagent le même espace réseau. En conteneur, publier le port admin seulement sur le loopback de l'hôte, ou passer par un reverse proxy HTTPS avec contrôle d'accès. Un nom DNS utilisé dans l'en-tête `Host` doit être ajouté exactement à `admin_allowed_hosts` ; `localhost`, `127.0.0.1` et `::1` sont autorisés par défaut. Le contrôle `Origin` exige la même origine que le panneau.

`registry_path` désigne un fichier dans un **répertoire persistant et inscriptible**. Le plugin crée le répertoire (`0700`) et un registre vide (`0600`) si nécessaire ; monter le répertoire entier pour conserver les sauvegardes atomiques. `admin_token_env` nomme une variable d'environnement contenant un secret d'au moins **32 caractères**. Le navigateur l'envoie en `Authorization: Bearer` aux API du panneau et le garde uniquement en mémoire de l'onglet : il faut le ressaisir après rechargement. `bifrost_auth_env` nomme une autre variable dont la **valeur entière** est l'en-tête `Authorization` utilisé par le serveur Registry pour appeler l'API native Bifrost. Avec l'authentification Basic native, préparer cette valeur dans l'environnement du processus, sans l'inscrire dans le JSON :

```bash
export REGISTRY_BIFROST_AUTH="Basic $(printf '%s:%s' "$BIFROST_ADMIN_USER" "$BIFROST_ADMIN_PASSWORD" | base64 | tr -d '\n')"
```

Définir aussi `REGISTRY_ADMIN_TOKEN` par votre gestionnaire de secrets. Ces deux variables ont des rôles différents : le premier jeton ouvre le panneau, l'en-tête Basic permet au serveur de gérer les clés natives. L'UI et le gateway ont des ports et des authentifications distincts.

Le [premier rapport autonome](../reports/plugin-standalone/final/report.json), antérieur au candidat RC, valide 38/38 contrôles sur Linux ARM64/musl. Les preuves finales passent, sur **chaque** architecture, [42/42 contrôles de modèles ARM64](../reports/v1-final/arm64/models/isolated-models-report.json) ([AMD64](../reports/v1-final/amd64/isolated-models/isolated-models-report.json)) et [54/54 contrôles du plugin ARM64](../reports/v1-final/arm64/standalone/report.json) ([AMD64](../reports/v1-final/amd64/standalone-plugin/report.json)). L'[image AMD64](../reports/v1-final/amd64/image/report.json) passe 18/18 ; le [rapport ARM64](../reports/v1-final/arm64/upgrade-rollback/report.json) passe 26/26, incluant l'image et le retour arrière. Les rapports de provenance de chaque paire vérifient le commit Bifrost épinglé, `core` 1.10.1 et `framework` 1.7.3, avec `GOWORK=off` et sans `replace`. Les tests utilisent un fournisseur synthétique ; aucune inférence réelle n'est prouvée.

**Limite confirmée :** désactiver le plugin ferme le panneau ; tenter de le réactiver par URL sans redémarrer renvoie HTTP 500, `plugin already loaded`. La configuration reste `enabled=true` et un redémarrage du gateway restaure le panneau, les données et la relecture native. Ce mode ne prend pas en charge la réactivation à chaud ; ne pas présenter ce cas comme une mise à jour à chaud validée.

## Compilations antérieures consignées

La cible actuelle **2.2.2** dispose d’une [compilation et d'un essai HTTP isolé](../reports/native-v2.2.2/README.md) : 42 contrôles passent, dont les listes distinctes par VK et la sauvegarde/relecture d’un groupe. Le [pilote local avec UI et pont réel](../reports/native-v2.2.2-live/workspace-live-report.json) passe ensuite 39/39 contrôles, dont deux appels de conversation HTTP 200. Le passage final ajoute le contrôle des preuves périmées : [44/44 vérifications](../reports/native-v2.2.2-live/workspace-final-report.json), sans nouvelle inférence. La paire finale locale est `dist/native-v2.2.2-live-v5/`, Go 1.27.1, Linux ARM64/musl. Ces résultats ne qualifient pas une image de production ou une autre architecture.

Le candidat avec contrat UI natif `dist/native-plugin-ui-candidate/` a été recompilé sur le même commit avec Go 1.27.1, Linux ARM64/musl. `scripts/build-with-bifrost.sh` a terminé les tests natifs et la sonde ABI. Cette compilation seule ne prouve pas encore le parcours UI complet ni une image officielle.

Les [rapports natifs](../reports/native-build-v1/) consignent une compilation contre Bifrost `transports/v2.2.1`, commit `6493abd3d1422c9bfde95f242fd57b38e73ce881`, avec Go 1.27.1 sur Linux amd64. La sonde ABI rapporte un chargement réussi ; les essais de pipeline ultérieurs sont décrits séparément dans [BUILD_STATUS.json](../BUILD_STATUS.json). L'[état audité](../STATUS.md) précise les limites de ces preuves.

Les binaires restent des artefacts locaux, exclus de Git. Le CLI compilé par `make build` est le contrôle local ; la commande de build commune ci-dessous produit le gateway, le plugin et leur sonde pour l'environnement cible.

## Pourquoi compiler ensemble

La documentation officielle exige une compatibilité des dépendances Go partagées, du compilateur, de l’OS, de l’architecture et de la libc. Elle décrit un gateway dynamique pour les plugins Go. Une image statique habituelle ne doit pas être supposée compatible avec le `.so`.

Sources :
- https://docs.getbifrost.ai/plugins/building-dynamic-binary
- https://docs.getbifrost.ai/plugins/writing-go-plugin

## Préparation d’un checkout isolé

Utiliser la version exacte de votre gateway, pas `dev`, pas `core@latest`. Sofian a mis à jour sa cible vers **Bifrost HTTP 2.2.2**. Le tag `transports/v2.2.2` pointe vers `fdeef8e3f31a3b18a61666ba49247d07bae3600a`. Exemple de checkout isolé :

```bash
git clone --branch transports/v2.2.2 --depth 1 https://github.com/maximhq/bifrost.git bifrost-build
cd bifrost-build
git rev-parse HEAD
```

Les anciens artefacts 2.2.1 ne valident pas cette cible. Pour toute nouvelle compilation, enregistrer le commit réellement utilisé et exécuter la sonde ABI.

Compiler le vrai frontend à partir de ce checkout, selon son `package.json` et les instructions officielles. La documentation consultée donne `npm ci`, puis `npm run build-enterprise` dans `ui`, et copie le contenu de `ui/out` vers `transports/bifrost-http/ui`. Vérifier ces chemins/scripts dans le tag réellement choisi. Le script Registry s’arrête tant que `transports/bifrost-http/ui/index.html` n’existe pas ; il ne fabrique pas de faux frontend.

Installer la version Go/C requise par ce checkout et choisir la même distribution/libc que le futur conteneur d’exécution. Pour Docker, la compilation et l’exécution doivent être cohérentes (Alpine/musl avec Alpine/musl, ou Debian/glibc avec glibc). Le script ne lance pas Docker et ne déploie rien.

## Exécuter la commande de build commune

Depuis ce paquet :

```bash
./scripts/build-with-bifrost.sh /chemin/absolu/bifrost-build ./dist/native
```

Le répertoire de sortie doit être nouveau. Le script :

1. vérifie les préconditions, compile l'UI Registry avec `npm ci` et `npm run build`, puis copie temporairement le plugin et les assets React dans `transports/registry-plugin` ;
2. utilise le module `transports` réel pour résoudre les dépendances du gateway, du plugin et de la sonde ensemble ;
3. applique `GOWORK=off`, `CGO_ENABLED=1`, `-mod=readonly`, `-trimpath`, `-buildvcs=false`, `-tags=bifrost`, `-ldflags='-w -s'` aux compilations par défaut ;
4. exécute le test natif du plugin, puis compile le gateway, le `.so` et la sonde ABI ;
5. charge le `.so` avec `plugin.Open`, vérifie les signatures, `Init`, `Cleanup`, les refus de contexte nul et la transmission de l’identité entre hooks de listing ;
6. enregistre l’environnement, les dépendances et les SHA-256.

Le staging est supprimé à la sortie. `go.mod` n’est pas corrigé automatiquement : un checkout incohérent ou des dépendances non résolues provoquent un échec explicite. Les fichiers produits ne doivent être déployés qu’après les tests natifs. La sonde ABI ne remplace pas un essai dans le vrai pipeline HTTP de Bifrost.

## Preuve d'installation par URL sur build dynamique

La [sonde jetable](../integration/dynamic_plugin_probe.py) reprend la paire Linux ARM64/musl de `dist/native-v2.2.2-live-v5/` et l'API native d'installation. Depuis la racine du dépôt :

```bash
python3 integration/dynamic_plugin_probe.py --out /private/tmp/bifrost-dynamic-new
```

Elle exige les images locales `golang:1.27.1-alpine` et `python:3.13-alpine`, démarre un gateway avec authentification admin native, installe le `.so` depuis une URL à contenu immuable, puis recrée le gateway avec la même base SQLite. Elle vérifie séparément la ligne sauvegardée `active`, le nom réel dans `/api/plugins/loaded`, le nouveau téléchargement et les refus d'un téléchargement 404 et d'un `.so` invalide. La commande refuse d'écraser un rapport et nettoie ses conteneurs. Le [rapport exécuté](../reports/plugin-delivery-loading/README.md) contient les assertions, empreintes, dépendances communes et limites. Cette preuve locale ne qualifie pas l'image officielle, dont [l'échec 2.2.2](../reports/stock-v2.2.2-plugin-install/README.md) reste conservé.

Le [patch Bifrost proposé](../integration/upstream-dynamic-docker.patch) cible uniquement `transports/Dockerfile` au commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`. Son option `DYNAMIC_PLUGINS=1` compile un gateway sans `-extldflags '-static'` avec le tag `bifrost` ; la compilation par défaut reste statique. L'application à blanc passe sur le source épinglé :

```bash
git -C /chemin/bifrost-build apply --check /chemin/bifrost-plugin-registry/integration/upstream-dynamic-docker.patch
```

Ce patch prépare une variante d'image pour revue upstream ; cette variante Dockerfile n'a pas été construite ni qualifiée ici. Le Dockerfile épinglé utilise Go 1.27.0 dans son stage de build, tandis que la paire locale prouvée utilise Go 1.27.1. Recompiler le `.so` avec le même toolchain, les mêmes dépendances et les mêmes options que l'image dynamique avant tout essai de cette variante ; la paire locale ne doit pas y être réutilisée telle quelle.

## Mode intégré différé : UI dans les routes Bifrost

Sur un checkout isolé au commit exact `fdeef8e3f31a3b18a61666ba49247d07bae3600a`, appliquer le [contrat UI natif](../integration/apply-bifrost-native-plugin-ui.sh), puis résoudre localement les modules Bifrost du même checkout. Remplacer les chemins d'exemple par des chemins absolus :

```bash
./integration/apply-bifrost-native-plugin-ui.sh /chemin/absolu/bifrost-build
git -C /chemin/absolu/bifrost-build apply /chemin/absolu/bifrost-plugin-registry/integration/bifrost-plugin-reopen.patch
(cd /chemin/absolu/bifrost-build/transports && GOWORK=off go mod edit -replace=github.com/maximhq/bifrost/core=../core -replace=github.com/maximhq/bifrost/framework=../framework)
(cd /chemin/absolu/bifrost-build/framework && GOWORK=off go mod edit -replace=github.com/maximhq/bifrost/core=../core)
(cd /chemin/absolu/bifrost-build/ui && npm ci && npm run build-enterprise)
mkdir -p /chemin/absolu/bifrost-build/transports/bifrost-http/ui
cp -R /chemin/absolu/bifrost-build/ui/out/. /chemin/absolu/bifrost-build/transports/bifrost-http/ui/
REGISTRY_NATIVE_UI=1 ./scripts/build-with-bifrost.sh /chemin/absolu/bifrost-build ./dist/native-plugin-ui-new
```

Cette recette est **différée** et requiert des patchs de l'hôte ; elle n'est pas nécessaire au mode standard ci-dessus. Exécuter ces commandes depuis la racine du dépôt Registry, avec un builder Go 1.27.1 Linux ARM64/musl, Python 3, npm et un compilateur C. `REGISTRY_NATIVE_UI=1` active le tag `bifrost_native_ui`, exclu de la compilation standard. Le patch de réouverture s'applique après le contrat UI : il réutilise le module `.so` déjà ouvert lorsque les mêmes octets sont redemandés par URL, tout en retéléchargeant et validant chaque URL ; un changement de binaire exige un redémarrage. Le dernier script compile aussi l'UI React Registry avec `npm ci`/`npm run build`, l'embarque dans le `.so`, exécute les tests natifs, puis compile et sonde la paire gateway/plugin. Le contrat hôte sert l'UI sous `/plugins/{nom-du-plugin}/` avec l'authentification native ; aucun montage `ui_dir` n'est nécessaire pour ce candidat. Les modifications de `go.mod` restent limitées au checkout isolé. Le patch Dockerfile dynamique proposé plus haut est une étape distincte et n'a pas été validé par cette compilation.

## Pilote local historique et différé : UI montée séparément

Les instructions suivantes décrivent le pilote local antérieur, avec route fixe `/bifrost-registry/`, proxy vers le panneau et assets Vite montés via `ui_dir`. Elles ne sont pas la recette du mode standard ci-dessus. Sur le **checkout exact** Bifrost `fdeef8e3f31a3b18a61666ba49247d07bae3600a`, appliquer le patch host/sidebar historique avant de compiler le gateway et son frontend :

```bash
python3 scripts/patch-bifrost-ui.py /chemin/absolu/bifrost-build
cd docs/design/registry-prototype
npm ci
npm run build
```

Exécuter `npm` depuis ce dépôt, puis utiliser le `dist/` produit par Vite comme répertoire `ui_dir` du plugin. En conteneur, monter par exemple `/chemin/absolu/registry-prototype/dist:/registry-ui:ro`. Cette compilation utilise le chemin public `/bifrost-registry/`. Compiler aussi le frontend Bifrost modifié depuis son checkout, puis recompiler gateway et plugin **ensemble** avec `scripts/build-with-bifrost.sh` comme ci-dessus ; `dist/native-v2.2.2-live-v5/` est la paire finale du pilote local, pas un artefact livré par Git.

Dans la configuration du plugin de ce pilote, ajouter `ui_dir` au fragment standard avec un chemin propre à l'environnement :

```json
{
  "ui_dir": "/registry-ui"
}
```

`bifrost_url` figure déjà dans le fragment standard ; `ui_dir` est propre à ce pilote historique et contient `index.html` et les assets React compilés. Le proxy Bifrost `/bifrost-registry/` joint le panneau sur **`127.0.0.1:8099` depuis le runtime du gateway** : les deux processus doivent partager ce loopback. Dans ce seul pilote, définir `REGISTRY_ADMIN_TOKEN` côté serveur uniquement ; le navigateur n'en a pas connaissance. Le proxy reprend l'authentification native de Bifrost et ne crée pas de route dans son API plugin.

Le pilote local sans authentification native utilise explicitement `REGISTRY_ALLOW_LOCAL_UI=true`, seulement avec l'hôte `127.0.0.1:8082` ou `localhost:8082` et un port gateway publié sur le loopback hôte. Ne pas transporter cette exception vers un accès réseau. Sans `ui_dir`, le plugin sert l'UI React embarquée sur son propre port.

## Charger le plugin

Fusionner `configs/plugin.fragment.json` dans votre configuration de staging. Préserver tous les providers, clés, budgets, règles et autres plugins. L’ordre retenu est `post_builtin` avec `order: 0` : le contrôle LLM intervient après Governance, qui authentifie la clé native ; le hook HTTP prépare la requête en amont de cette phase et la projection contrôle la réponse. Aucun autre plugin de confiance ne doit réécrire les routes après le dernier contrôle sans validation d’intégration.

Utiliser le gateway dynamique et le plugin issus de la même compilation. Monter **le répertoire** contenant `registry.json`, et non uniquement le fichier : la sauvegarde atomique utilise un remplacement par `rename`.

Le panneau autonome est inclus dans la recette standard : conserver `admin_listen` et définir `REGISTRY_ADMIN_TOKEN` à un secret long et aléatoire dans l’environnement. Cette valeur n’appartient pas au fichier de configuration du plugin.

Dans un conteneur, `admin_listen: "0.0.0.0:8099"` peut être nécessaire pour le port publié ; publier **uniquement sur le loopback hôte**, par exemple `127.0.0.1:8099:8099`, et ne pas exposer ce port publiquement. L’écoute `127.0.0.1` à l’intérieur du conteneur n’est pas équivalente à celle de l’hôte. Pour un accès distant, préférer un tunnel SSH vers le loopback ou une terminaison HTTPS avec contrôle d’accès. Le panneau ne configure pas TLS lui-même.

## Ordre d’activation

Sauvegarder la configuration Bifrost. Déclarer les aliases sur les clés provider existantes, configurer les allowlists natives et les sélections de clés provider à partir du plan, vérifier la gouvernance native et l’identité VK dans le pipeline. Charger ensuite le Registry sur une instance de staging, puis effectuer la checklist complète. Le registre refuse les noms qu’il n’expose pas ; il ne confère jamais lui-même un abonnement ou une capacité modèle.

Pour revenir à une version antérieure après migration de données, arrêter le gateway et restaurer **tout** le volume `/app/data` sauvegardé à l'arrêt ainsi que l'image précédente si elle a changé. Le changement isolé de l'URL du `.so` ne suffit pas à prouver la compatibilité d'un ancien plugin avec un registre plus récent. La [preuve ARM64 finale](../reports/v1-final/arm64/upgrade-rollback/report.json) passe 26/26 contrôles ; suivre la [procédure de release](RELEASE.md#mettre-à-jour-et-revenir-en-arrière).
