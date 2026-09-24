# Bifrost · Plugin Registry

Catalogue de modèles et groupes réutilisables pour les clés virtuelles Bifrost. Le dépôt contient un moteur Go, un plugin natif et un panneau d'administration local.

**V1 RC — [v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) :** image Bifrost 2.2.2 compilée avec liaison dynamique et plugin `.so` séparé, compilés ensemble depuis les sources officielles non modifiées avec Go 1.27.1 pour Linux ARM64 et AMD64/musl. Les [rapports finaux](reports/v1-final/) passent sur chaque architecture pour `/v1/models` (42/42) et le plugin autonome (54/54). L'image ARM64 avec mise à jour et retour arrière passe [26/26](reports/v1-final/arm64/upgrade-rollback/report.json) ; l'image AMD64 passe [18/18](reports/v1-final/amd64/image/report.json). Le panneau React embarqué est servi par le plugin sur `8099`. Voir la [procédure de livraison](docs/RELEASE.md). La [revue navigateur](reports/v1-final/README.md#revue-navigateur) couvre le catalogue, la recherche, l’import et le mobile ; la production n’a pas été modifiée.

## Où en est le projet ?

| Pour comprendre… | Lire… |
| --- | --- |
| Ce qui fonctionne dans le code et ce qui reste à vérifier | [État audité](STATUS.md) |
| L'expérience souhaitée, le pilote Hermes et les décisions ouvertes | [Cadrage produit](docs/design/product-direction.md) |
| Le vocabulaire des groupes, clés et catalogues | [Contexte](CONTEXT.md) |
| Les capacités actuelles du moteur et du panneau | [Inventaire du code](docs/design/capabilities-inventory.md) |
| Les API et outils Bifrost à réutiliser | [Recherche d'intégration](docs/design/bifrost-integration-research.md) |

**Pilote intégré historique :** l'ancien panneau sous `127.0.0.1:8082/bifrost-registry/` utilise des patchs hôte et possède ses [preuves archivées](reports/native-v2.2.2-live/workspace-final-report.json). Le candidat autonome ne dépend pas de ce pilote.

L'[UI React](docs/design/registry-prototype/README.md) affiche le catalogue, les groupes, les clés et les préférences. Le catalogue distingue fiche de référence et accès fournisseur : sources et dates par champ, correction manuelle protégée, dernier état valide de Models.dev/Bifrost et références manuelles. L'import/export utilise un JSON versionné avec aperçu et sauvegarde ; le CSV est une vue aplatie, et un convertisseur hors ligne traite les anciennes datasheets. Le laboratoire reste **Planned**. Les [anciennes maquettes](docs/design/mockup/README.md) documentent l'historique.

Le build natif et des essais sur Pulsar sont consignés dans [BUILD_STATUS.json](BUILD_STATUS.json) et [les rapports de build](reports/native-build-v1/). Ces preuves historiques ne constituent pas une vérification actuelle de la production.

## Démarrer le panneau maintenant

Depuis ce dossier, avec Go 1.23 ou ultérieur :

```bash
go run ./cmd/registry serve --config configs/registry.json
```

Ouvrir `http://127.0.0.1:8099/model-registry`. Copier le jeton d’administration affiché dans le terminal. Le catalogue initial est vide et n’autorise aucun modèle.

Pour compiler le CLI d'administration sur la machine courante :

```bash
make build
./dist/registry serve --config configs/registry.json
```

Les binaires générés restent locaux et sont ignorés par Git. Un clone neuf contient les sources et les rapports de build.

Pour explorer les écrans avec des données synthétiques, lancer le panneau avec `--config configs/registry.demo.json`. **Tous les providers, modèles amont et identifiants de cette démo sont des fixtures : aucune disponibilité réelle n’est annoncée.** Ne jamais charger cette configuration dans une instance de production.

## Ce qui est implémenté

| Zone | Comportement |
| --- | --- |
| Modèles | CRUD, alias, source Bifrost, clés provider existantes, cible amont, modèle canonique, famille native, créateur, famille de classement, capacités, endpoints et origine de vérification. |
| Groupes | Sélections explicites, filtres dynamiques, exclusions prioritaires. |
| Clés virtuelles | Association à un identifiant natif et à une empreinte du jeton ; groupes et sources autorisés ; noms `model`, `provider/model` ou `both`. |
| Collisions | Préférence explicite pour un alias court partagé. Pas de sélection implicite entre sources. |
| `/v1/models` | Moteur de projection : intersection avec la liste native autorisée, sans métadonnées riches. |
| Requêtes | Moteur de garde : résolution vers `provider/alias`, validation des endpoints, contrôle du primaire et des fallbacks explicites. |
| Administration | Interface claire/sombre, recherche, aperçu par clé, import/export, validation serveur, sauvegarde atomique et contrôle de révision. |
| Déploiement | Plan d’alias natifs et de permissions attendues ; fusion non destructive des alias dans **une copie** de `config.json`. |

Le plugin ne crée pas de proxy d’inférence. Le panneau n’appelle aucun fournisseur. Les alias amont, l’authentification, les budgets, les prix et les réponses restent confiés à Bifrost. Chaque nouvelle combinaison de versions exige une validation native.

## Limites à connaître avant installation

**Validation native distincte.** `go test ./...` n’inclut pas `native/main.go`, protégé par le tag de build `bifrost`. Les tests locaux ne prouvent pas la compatibilité ABI, le comportement de la gouvernance, l’ordre effectif des hooks ou le support des endpoints par vos providers. Utiliser la [checklist native](docs/ACCEPTANCE.md) pour la version et l'environnement ciblés.

**Intégration UI locale historique.** Le pilote 2.2.2 ajoute une entrée Model Registry à la navigation et monte l'UI sous `/bifrost-registry/` via un patch hôte épinglé. Le mode standard sert l'UI directement depuis le plugin sur `8099`, avec un jeton admin distinct ; le CLI peut toujours préparer une configuration hors ligne. Voir les [instructions de compilation et d'installation](docs/BUILD.md).

**Réactivation à chaud.** Après désactivation, le panneau se ferme ; la réactivation par URL sans redémarrage échoue avec `plugin already loaded`. Le redémarrage restaure le panneau, les données et la relecture native. Voir la [preuve locale](reports/plugin-standalone/final/report.json).

**Coexistence native.** Les clés préexistantes conservent leur comportement jusqu'à adoption explicite. L'aperçu et l'adoption ne peuvent pas élargir les droits natifs. Les surfaces Anthropic et Gemini natives restent hors garde Registry documentée ; une capacité inconnue reste inconnue. Aucun alias court ambigu ne déclenche une répartition automatique.

**Périmètre HTTP restreint.** La garde Registry couvre `GET models` et les POST JSON documentés parmi `chat/completions`, `responses`, `completions`, `embeddings`, `images/generations`, `audio/speech`, sous `/v1/`, `/openai/v1/` ou `/openai/`. `GET models/{id}`, multipart, WebSocket, Realtime, batches, routes Gemini/Anthropic natives et accès SDK Go direct ne sont pas qualifiés comme contrôlés par Registry. Les appels cœur sans session HTTP Registry demandent une vérification d'intégration.

**Noms des réponses.** Cette version ne réécrit pas le champ `model` des réponses d’inférence ou des fragments de streaming. Elle ne modifie que les noms de requête, les fallbacks explicites et la liste des modèles.

**Un seul writer.** Le Store fournit un verrou et une révision dans un processus, pas un verrou distribué. Ne pas faire écrire simultanément un CLI standalone et l’administration du plugin dans le même fichier. Une modification directe du fichier n’est pas rechargée automatiquement par le plugin ; redémarrer/recharger le plugin, ou utiliser son propre panneau embarqué.

## Compiler le vrai plugin

La compilation doit partir du **checkout Bifrost correspondant à votre installation**, avec les assets UI réellement compilés et la chaîne Go/C compatible. Le script produit le gateway et le `.so` ensemble, sans toucher à votre instance :

```bash
./scripts/build-with-bifrost.sh /chemin/vers/bifrost ./dist/native
```

Lire [les instructions de compilation](docs/BUILD.md), puis [la checklist de validation native](docs/ACCEPTANCE.md). Le fragment [plugin.fragment.json](configs/plugin.fragment.json) contient une URL d'artefact fictive à remplacer et doit être **fusionné**, jamais substitué à la configuration existante.

## Fichiers utiles

```text
native/main.go                  adaptateur des hooks Bifrost, build séparé
internal/registry/              moteur déterministe et tests unitaires
internal/admin/                 API locale et interface embarquée
cmd/registry/                   CLI d’administration / validation / export
configs/registry.json           configuration initiale vide
configs/registry.demo.json      démonstration synthétique, hors production
configs/plugin.fragment.json    fragment d’installation, pas un config complet
scripts/build-with-bifrost.sh   build commun gateway + .so + sonde ABI
scripts/test.sh                 tests Go avec détecteur de courses
integration/native_probe.go    sonde plugin.Open et signatures, à compiler avec Bifrost
integration/live_smoke.py       tests HTTP sur votre instance, opt-in explicite
docs/design/mockup/            maquette statique, données fictives
reports/                       rapports datés et captures historiques
```

La [référence de configuration](docs/CONFIGURATION.md) et la [sécurité](docs/SECURITY.md) complètent ce guide. Les [sources initiales](docs/SOURCES.md) et [résultats des tests du 20 septembre](reports/VALIDATION.md) documentent la première livraison.

Les rôles des configurations vide, démo et homelab sont décrits dans [configs/README.md](configs/README.md). Projet non officiel, sans affiliation à Maxim/Bifrost.
