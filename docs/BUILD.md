# Build et installation native

## Builds consignés

La cible actuelle **2.2.2** dispose d’un [build et essai HTTP isolé](../reports/native-v2.2.2/README.md) : 42 contrôles passent, dont les listes distinctes par VK et la sauvegarde/relecture d’un groupe. Le [pilote local avec UI et pont réel](../reports/native-v2.2.2-live/workspace-live-report.json) passe ensuite 39/39 contrôles, dont deux appels de conversation HTTP 200. Le passage final ajoute le contrôle des preuves périmées : [44/44 vérifications](../reports/native-v2.2.2-live/workspace-final-report.json), sans nouvelle inférence. La paire finale locale est `dist/native-v2.2.2-live-v5/`, Go 1.27.1, Linux ARM64/musl. Ces résultats ne qualifient pas une image de production ou une autre architecture.

Les [rapports natifs](../reports/native-build-v1/) consignent un build contre Bifrost `transports/v2.2.1`, commit `6493abd3d1422c9bfde95f242fd57b38e73ce881`, avec Go 1.27.1 sur Linux amd64. La sonde ABI rapporte un chargement réussi ; les essais de pipeline ultérieurs sont décrits séparément dans [BUILD_STATUS.json](../BUILD_STATUS.json). L'[état audité](../STATUS.md) précise les limites de ces preuves.

Les binaires restent des artefacts locaux, exclus de Git. Le CLI construit par `make build` est le contrôle local ; le build commun ci-dessous produit le gateway, le plugin et leur sonde pour l'environnement cible.

## Pourquoi reconstruire ensemble

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

Les anciens artefacts 2.2.1 ne valident pas cette cible. Pour tout nouveau build, enregistrer le commit réellement utilisé et exécuter la sonde ABI.

Construire le vrai frontend à partir de ce checkout, selon son `package.json` et les instructions officielles. La documentation consultée donne `npm ci`, puis `npm run build-enterprise` dans `ui`, et copie le contenu de `ui/out` vers `transports/bifrost-http/ui`. Vérifier ces chemins/scripts dans le tag réellement choisi. Le script Registry s’arrête tant que `transports/bifrost-http/ui/index.html` n’existe pas ; il ne fabrique pas de faux frontend.

Installer la version Go/C requise par ce checkout et choisir la même distribution/libc que le futur conteneur d’exécution. Pour Docker, le build et l’exécution doivent être cohérents (Alpine/musl avec Alpine/musl, ou Debian/glibc avec glibc). Le script ne lance pas Docker et ne déploie rien.

## Exécuter le build commun

Depuis ce paquet :

```bash
./scripts/build-with-bifrost.sh /chemin/absolu/bifrost-build ./dist/native
```

Le répertoire de sortie doit être nouveau. Le script :

1. vérifie les préconditions, puis copie temporairement le plugin dans `transports/registry-plugin` ;
2. utilise le module `transports` réel pour résoudre les dépendances du gateway, du plugin et de la sonde ensemble ;
3. applique `GOWORK=off`, `CGO_ENABLED=1`, `-mod=readonly`, `-trimpath`, `-buildvcs=false`, `-tags=bifrost`, `-ldflags='-w -s'` aux builds ;
4. construit le gateway, le `.so` et la sonde ABI ;
5. charge le `.so` avec `plugin.Open`, vérifie les signatures, `Init`, `Cleanup`, les refus de contexte nul et la transmission de l’identité entre hooks de listing ;
6. enregistre l’environnement, les dépendances et les SHA-256.

Le staging est supprimé à la sortie. `go.mod` n’est pas corrigé automatiquement : un checkout incohérent ou des dépendances non résolues provoquent un échec explicite. Les fichiers produits ne doivent être déployés qu’après les tests natifs. La sonde ABI ne remplace pas un essai dans le vrai pipeline HTTP de Bifrost.

## Construire et monter la nouvelle UI locale

Sur le **checkout exact** Bifrost `fdeef8e3f31a3b18a61666ba49247d07bae3600a`, appliquer le patch host/sidebar avant de construire le gateway et son frontend :

```bash
python3 scripts/patch-bifrost-ui.py /chemin/absolu/bifrost-build
cd docs/design/registry-prototype
npm ci
npm run build
```

Exécuter `npm` depuis ce dépôt, puis utiliser le `dist/` produit par Vite comme répertoire `ui_dir` du plugin. En conteneur, monter par exemple `/chemin/absolu/registry-prototype/dist:/registry-ui:ro`. Le build utilise le chemin public `/bifrost-registry/`. Construire aussi le frontend Bifrost modifié depuis son checkout, puis reconstruire gateway et plugin **ensemble** avec `scripts/build-with-bifrost.sh` comme ci-dessus ; `dist/native-v2.2.2-live-v5/` est la paire finale du pilote local, pas un artefact livré par Git.

Dans la configuration du plugin, conserver `admin_listen`, `admin_token_env` et `registry_path` et ajouter, avec des chemins/valeurs propres à l'environnement :

```json
{
  "bifrost_url": "http://127.0.0.1:8080",
  "ui_dir": "/registry-ui"
}
```

Ces deux champs s'ajoutent aux paramètres existants du fragment `configs/plugin.fragment.json` ; l'extrait n'est pas une configuration complète. `bifrost_url` vise l'API native depuis le runtime du plugin. `ui_dir` contient `index.html` et les assets du build React. Le proxy Bifrost `/bifrost-registry/` joint le panneau sur **`127.0.0.1:8099` depuis le runtime du gateway** : les deux processus doivent partager ce loopback. Définir `REGISTRY_ADMIN_TOKEN` côté serveur uniquement ; le navigateur n'en a pas connaissance. Le proxy reprend l'authentification native de Bifrost et ne crée pas de route dans son API plugin.

Le pilote local sans authentification native utilise explicitement `REGISTRY_ALLOW_LOCAL_UI=true`, seulement avec l'hôte `127.0.0.1:8082` ou `localhost:8082` et un port gateway publié sur le loopback hôte. Ne pas transporter cette exception vers un accès réseau. L'ancien panneau embarqué reste le repli lorsque `ui_dir` est absent.

## Charger le plugin

Fusionner `configs/plugin.fragment.json` dans votre configuration de staging. Préserver tous les providers, clés, budgets, règles et autres plugins. L’ordre retenu est `pre_builtin` : la garde HTTP intervient avant les traitements intégrés, puis la projection HTTP intervient en sens inverse. Aucun autre plugin de confiance ne doit réécrire les routes après le dernier contrôle sans validation d’intégration.

Utiliser le gateway dynamique et le plugin issus du même build. Monter **le répertoire** contenant `registry.json`, et non uniquement le fichier : la sauvegarde atomique utilise un remplacement par `rename`.

Le panneau embarqué est facultatif : supprimer `admin_listen` pour ne pas le servir. Avec le panneau, définir `REGISTRY_ADMIN_TOKEN` à un secret long et aléatoire dans l’environnement. Cette valeur n’appartient pas au fichier de configuration du plugin.

Dans un conteneur, `admin_listen: "0.0.0.0:8099"` peut être nécessaire pour le port publié ; publier **uniquement sur le loopback hôte**, par exemple `127.0.0.1:8099:8099`, et ne pas exposer ce port publiquement. L’écoute `127.0.0.1` à l’intérieur du conteneur n’est pas équivalente à celle de l’hôte. Pour un accès distant, préférer un tunnel SSH vers le loopback ou une terminaison HTTPS avec contrôle d’accès. Le panneau ne configure pas TLS lui-même.

## Ordre d’activation

Sauvegarder la configuration Bifrost. Déclarer les aliases sur les clés provider existantes, configurer les allowlists natives et les sélections de clés provider à partir du plan, vérifier la gouvernance native et l’identité VK dans le pipeline. Charger ensuite le Registry sur une instance de staging, puis effectuer la checklist complète. Le registre refuse les noms qu’il n’expose pas ; il ne confère jamais lui-même un abonnement ou une capacité modèle.

Pour annuler, restaurer la configuration Bifrost précédente et retirer/désactiver ce plugin, puis redémarrer selon le fonctionnement de votre déploiement. Ce retrait enlève aussi ses restrictions : vérifier les permissions natives avant tout retour en production.
