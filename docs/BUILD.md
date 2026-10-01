# Compilation et installation native

La [procédure de livraison V1 RC](RELEASE.md) décrit les deux paires Linux/musl ARM64 et AMD64, l'image Docker Bifrost compilée avec liaison dynamique, le `.so` séparé, l'installation, la mise à jour et le retour arrière. La prérelease publique `v0.2.0-rc.1` est disponible et la revue navigateur finale est consignée ; les preuves finales du candidat sont dans [`reports/v1-final/`](../reports/v1-final/). Les compilations et pilotes ci-dessous expliquent la provenance et conservent les essais antérieurs.

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

Les [rapports natifs](../reports/native-build-v1/) consignent une compilation contre Bifrost `transports/v2.2.1`, commit `6493abd3d1422c9bfde95f242fd57b38e73ce881`, avec Go 1.27.1 sur Linux amd64. La sonde ABI rapporte un chargement réussi ; les essais de pipeline ultérieurs sont décrits séparément dans [BUILD_STATUS.json](../reports/native-build-v1/BUILD_STATUS.json). L'[état audité](../STATUS.md) précise les limites de ces preuves.

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

Le script utilise le tag exact du checkout pour injecter la version réelle dans le gateway. Pour une archive sans métadonnées Git ou une référence personnalisée, vérifier la source puis définir `BIFROST_VERSION=vX.Y.Z` avant la compilation.

Le répertoire de sortie doit être nouveau. Le script :

1. vérifie les préconditions, compile l'UI Registry avec `npm ci` et `npm run build`, puis copie temporairement le plugin et les assets React dans `transports/registry-plugin` ;
2. utilise le module `transports` réel pour résoudre les dépendances du gateway, du plugin et de la sonde ensemble ;
3. applique `GOWORK=off`, `CGO_ENABLED=1`, `-mod=readonly`, `-trimpath`, `-buildvcs=false`, `-tags=bifrost`, `-ldflags='-w -s'` aux compilations par défaut ;
4. exécute le test natif du plugin, puis compile le gateway, le `.so` et la sonde ABI ;
5. charge le `.so` avec `plugin.Open`, vérifie les signatures, `Init`, `Cleanup`, les refus de contexte nul et la transmission de l’identité entre hooks de listing ;
6. enregistre l’environnement, les dépendances et les SHA-256.

Le staging est supprimé à la sortie. `go.mod` n’est pas corrigé automatiquement : un checkout incohérent ou des dépendances non résolues provoquent un échec explicite. Les fichiers produits ne doivent être déployés qu’après les tests natifs. La sonde ABI ne remplace pas un essai dans le vrai pipeline HTTP de Bifrost.

## Charger le plugin

Fusionner `configs/plugin.fragment.json` dans votre configuration de staging. Préserver tous les providers, clés, budgets, règles et autres plugins. L’ordre retenu est `post_builtin` avec `order: 0` : le contrôle LLM intervient après Governance, qui authentifie la clé native ; le hook HTTP prépare la requête en amont de cette phase et la projection contrôle la réponse. Aucun autre plugin de confiance ne doit réécrire les routes après le dernier contrôle sans validation d’intégration.

Utiliser le gateway dynamique et le plugin issus de la même compilation. Monter **le répertoire** contenant `registry.json`, et non uniquement le fichier : la sauvegarde atomique utilise un remplacement par `rename`.

Le panneau autonome est inclus dans la recette standard : conserver `admin_listen` et définir `REGISTRY_ADMIN_TOKEN` à un secret long et aléatoire dans l’environnement. Cette valeur n’appartient pas au fichier de configuration du plugin.

Dans un conteneur, `admin_listen: "0.0.0.0:8099"` peut être nécessaire pour le port publié ; publier **uniquement sur le loopback hôte**, par exemple `127.0.0.1:8099:8099`, et ne pas exposer ce port publiquement. L’écoute `127.0.0.1` à l’intérieur du conteneur n’est pas équivalente à celle de l’hôte. Pour un accès distant, préférer un tunnel SSH vers le loopback ou une terminaison HTTPS avec contrôle d’accès. Le panneau ne configure pas TLS lui-même.

## Ordre d’activation

Sauvegarder la configuration Bifrost. Déclarer les aliases sur les clés provider existantes, configurer les allowlists natives et les sélections de clés provider à partir du plan, vérifier la gouvernance native et l’identité VK dans le pipeline. Charger ensuite le Registry sur une instance de staging, puis effectuer la checklist complète. Le registre refuse les noms qu’il n’expose pas ; il ne confère jamais lui-même un abonnement ou une capacité modèle.

Pour revenir à une version antérieure après migration de données, arrêter le gateway et restaurer **tout** le volume `/app/data` sauvegardé à l'arrêt ainsi que l'image précédente si elle a changé. Le changement isolé de l'URL du `.so` ne suffit pas à prouver la compatibilité d'un ancien plugin avec un registre plus récent. La [preuve ARM64 finale](../reports/v1-final/arm64/upgrade-rollback/report.json) passe 26/26 contrôles ; suivre la [procédure de release](RELEASE.md#mettre-à-jour-et-revenir-en-arrière).
