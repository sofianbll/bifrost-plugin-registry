# Build et installation native

## État de cette livraison

Le binaire `dist/registry-linux-amd64` est le contrôle local, **pas le plugin**. Aucun `bifrost-registry.so` ni gateway Bifrost recompilé n’est livré. Le script natif n’a pas pu être exécuté ici : la récupération du checkout Bifrost et des dépendances n’était pas disponible ; l’environnement local dispose de Go 1.23.2, alors que la documentation Bifrost consultée indique Go 1.26.1. Ne pas considérer une validation du moteur indépendant comme un build natif réussi.

## Pourquoi reconstruire ensemble

La documentation officielle exige une compatibilité des dépendances Go partagées, du compilateur, de l’OS, de l’architecture et de la libc. Elle décrit un gateway dynamique pour les plugins Go. Une image statique habituelle ne doit pas être supposée compatible avec le `.so`.

Sources :
- https://docs.getbifrost.ai/plugins/building-dynamic-binary
- https://docs.getbifrost.ai/plugins/writing-go-plugin

## Préparation d’un checkout isolé

Utiliser la version exacte de votre gateway, pas `dev`, pas `core@latest`. La cible déclarée par le projet utilisateur est Bifrost HTTP 2.2.1. Vérifier d’abord le tag et son commit dans le dépôt officiel. Exemple de checkout isolé :

```bash
git clone --branch transports/v2.2.1 --depth 1 https://github.com/maximhq/bifrost.git bifrost-build
cd bifrost-build
git rev-parse HEAD
```

Le source exact de ce tag n’a pas été récupéré pendant cette livraison ; les signatures ont été examinées dans la documentation publiée et les fichiers `dev` consultables. La sonde de compilation est donc une étape obligatoire.

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
5. charge le `.so` avec `plugin.Open`, vérifie les signatures, `Init`, `Cleanup` et les refus de contexte nul ;
6. enregistre l’environnement, les dépendances et les SHA-256.

Le staging est supprimé à la sortie. `go.mod` n’est pas corrigé automatiquement : un checkout incohérent ou des dépendances non résolues provoquent un échec explicite. Les fichiers produits ne doivent être déployés qu’après les tests natifs. La sonde ABI ne remplace pas un essai dans le vrai pipeline HTTP de Bifrost.

## Charger le plugin

Fusionner `configs/plugin.fragment.json` dans votre configuration de staging. Préserver tous les providers, clés, budgets, règles et autres plugins. L’ordre retenu est `pre_builtin` : la garde HTTP intervient avant les traitements intégrés, puis la projection HTTP intervient en sens inverse. Aucun autre plugin de confiance ne doit réécrire les routes après le dernier contrôle sans validation d’intégration.

Utiliser le gateway dynamique et le plugin issus du même build. Monter **le répertoire** contenant `registry.json`, et non uniquement le fichier : la sauvegarde atomique utilise un remplacement par `rename`.

Le panneau embarqué est facultatif : supprimer `admin_listen` pour ne pas le servir. Avec le panneau, définir `REGISTRY_ADMIN_TOKEN` à un secret long et aléatoire dans l’environnement. Cette valeur n’appartient pas au fichier de configuration du plugin.

Dans un conteneur, `admin_listen: "0.0.0.0:8099"` peut être nécessaire pour le port publié ; publier **uniquement sur le loopback hôte**, par exemple `127.0.0.1:8099:8099`, et ne pas exposer ce port publiquement. L’écoute `127.0.0.1` à l’intérieur du conteneur n’est pas équivalente à celle de l’hôte. Pour un accès distant, préférer un tunnel SSH vers le loopback ou une terminaison HTTPS avec contrôle d’accès. Le panneau ne configure pas TLS lui-même.

## Ordre d’activation

Sauvegarder la configuration Bifrost. Déclarer les aliases sur les clés provider existantes, configurer les allowlists natives et les sélections de clés provider à partir du plan, vérifier la gouvernance native et l’identité VK dans le pipeline. Charger ensuite le Registry sur une instance de staging, puis effectuer la checklist complète. Le registre refuse les noms qu’il n’expose pas ; il ne confère jamais lui-même un abonnement ou une capacité modèle.

Pour annuler, restaurer la configuration Bifrost précédente et retirer/désactiver ce plugin, puis redémarrer selon le fonctionnement de votre déploiement. Ce retrait enlève aussi ses restrictions : vérifier les permissions natives avant tout retour en production.
