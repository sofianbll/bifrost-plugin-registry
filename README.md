# Bifrost · Plugin Registry

Catalogue de modèles et groupes réutilisables pour les clés virtuelles Bifrost. Le dépôt contient un moteur Go, un plugin natif et un panneau d'administration local.

## Où en est le projet ?

| Pour comprendre… | Lire… |
| --- | --- |
| Ce qui fonctionne dans le code et ce qui reste à vérifier | [État audité](STATUS.md) |
| L'expérience souhaitée, le pilote Hermes et les décisions ouvertes | [Cadrage produit](docs/design/product-direction.md) |
| Le vocabulaire des groupes, clés et catalogues | [Contexte](CONTEXT.md) |
| Les capacités actuelles du moteur et du panneau | [Inventaire du code](docs/design/capabilities-inventory.md) |
| Les API et outils Bifrost à réutiliser | [Recherche d'intégration](docs/design/bifrost-integration-research.md) |

**Prochaine étape : valider l'UI/UX de l'application complète avec Sofian**, puis fixer la spec, les versions et les tickets GitHub. L'interface actuellement servie par le plugin se trouve dans `internal/admin/web/`.

Le [prototype React Bifrost](docs/design/registry-prototype/README.md) réutilise les composants upstream pour le catalogue modèles, les groupes, les clés, le laboratoire et les préférences d’affichage. L’[audit UX](docs/design/ux-audit-2026-09-23.md) et les [références UI natives](docs/design/bifrost-ui-patterns.md) décrivent cette itération. Ses données et appels API sont simulés. Les [anciennes maquettes](docs/design/mockup/README.md) restent consultables comme historique ; la démo Hermes à une page a été rejetée.

Le build natif et des essais sur Pulsar sont consignés dans [BUILD_STATUS.json](BUILD_STATUS.json) et [les rapports de build](reports/native-build-v1/). Ces preuves historiques ne constituent pas une vérification actuelle de la production.

## Démarrer le panneau maintenant

Depuis ce dossier, avec Go 1.23 ou ultérieur :

```bash
go run ./cmd/registry serve --config configs/registry.json
```

Ouvrir `http://127.0.0.1:8099/model-registry`. Copier le jeton d’administration affiché dans le terminal. Le catalogue initial est vide et n’autorise aucun modèle.

Pour construire le CLI d'administration sur la machine courante :

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

**Panneau séparé.** L’interface n’est pas injectée dans la navigation du dashboard Bifrost ou dans sa page Virtual Keys. Elle est servie sur un port local ; le plugin peut l’héberger dans le même processus que Bifrost, ou le CLI peut servir à préparer une configuration hors ligne.

**Application native manuelle.** Il n’y a ni connexion à l’API d’administration Bifrost, ni import automatique de `/models`, ni synchronisation automatique des prix/quotas. Le plan et la fusion des alias ne mettent pas à jour les permissions des clés virtuelles. Ces permissions et les sélections de clés provider doivent être configurées dans Bifrost avant activation.

**Périmètre HTTP restreint.** Sont prévus `GET models`, et les POST JSON configurés parmi `chat/completions`, `responses`, `completions`, `embeddings`, `images/generations`, `audio/speech`, sous `/v1/`, `/openai/v1/` ou `/openai/`. `GET models/{id}`, multipart, WebSocket, Realtime, batches, routes Gemini/Anthropic natives et accès SDK Go direct ne sont pas couverts. Les appels cœur sans session HTTP Registry sont refusés : cela peut affecter des sondes internes de Bifrost et doit être vérifié en staging.

**Noms des réponses.** Cette version ne réécrit pas le champ `model` des réponses d’inférence ou des fragments de streaming. Elle ne modifie que les noms de requête, les fallbacks explicites et la liste des modèles.

**Un seul writer.** Le Store fournit un verrou et une révision dans un processus, pas un verrou distribué. Ne pas faire écrire simultanément un CLI standalone et l’administration du plugin dans le même fichier. Une modification directe du fichier n’est pas rechargée automatiquement par le plugin ; redémarrer/recharger le plugin, ou utiliser son propre panneau embarqué.

## Construire le vrai plugin

Le build doit partir du **checkout Bifrost correspondant à votre installation**, avec les assets UI réellement construits et la chaîne Go/C compatible. Le script produit le gateway et le `.so` ensemble, sans toucher à votre instance :

```bash
./scripts/build-with-bifrost.sh /chemin/vers/bifrost ./dist/native
```

Lire [les instructions de build](docs/BUILD.md), puis [la checklist de validation native](docs/ACCEPTANCE.md). Le fragment `configs/plugin.fragment.json` doit être **fusionné**, jamais substitué à la configuration existante.

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
