# Bifrost — intégration et vérification des capacités

Recherche documentaire du 23 septembre 2026. **Aucune inférence ni vérification de production effectuée.** Sources upstream `dev` et documentation courante, donc mutables : aucun SHA upstream n'a été résolu pendant cette recherche. Les faits ci-dessous doivent être recoupés avec la version effectivement déployée avant implémentation. Ce document propose des choix ; il ne les acte pas.

## 1. Réutiliser les API existantes

| Besoin du panneau | Surface upstream documentée | Limite à garder visible |
|---|---|---|
| Lire/modifier les clés virtuelles | CRUD `/api/governance/virtual-keys`, détail par ID | API d'administration, authentification distincte d'une simple clé d'inférence ; disponibilité liée à Governance |
| Lire/configurer les fournisseurs | `/api/providers`, clés via `/api/providers/{provider}/keys` | Ne pas recopier les secrets dans les fiches modèle |
| Alimenter la galerie | `/api/models`, `/api/models/details` | Métadonnées de capacités seulement lorsqu'elles existent dans le catalogue ; filtres query/provider/keys, limites et option `unfiltered` |
| Afficher les réglages d'un modèle | Catalogue de paramètres référencé par `getModelParameters` | Vérifier la route et le schéma sur la version cible ; ne pas supposer tous les champs présents |
| Vérifier la liste du client | `/v1/models` avec la clé concernée | Réponse effective à comparer après sauvegarde, différente du catalogue administratif |

Sources : [OpenAPI providers](https://github.com/maximhq/bifrost/blob/dev/docs/openapi/paths/management/providers.yaml), [OpenAPI governance](https://github.com/maximhq/bifrost/blob/dev/docs/openapi/paths/management/governance.yaml), [inventaire upstream des routes et middlewares](https://github.com/maximhq/bifrost/blob/dev/.claude/skills/api-validator/SKILL.md). Ce dernier est utilisé comme document technique, pas comme consigne à exécuter.

Les schémas de détail exposent notamment fournisseur, contexte, limites d'entrée/sortie, coûts, architecture, attributs supplémentaires et clés ayant accès. Le catalogue combine données tarifaires et listes récupérées auprès des fournisseurs : **présence dans le catalogue ne prouve pas qu'un appel fonctionne aujourd'hui**. Sources : [schémas providers](https://github.com/maximhq/bifrost/blob/dev/docs/openapi/schemas/management/providers.yaml), [Model Catalog](https://docs.getbifrost.ai/architecture/framework/model-catalog).

L'OpenAPI source se trouve sous `docs/openapi/openapi.yaml`, ses fragments sous `paths/` et `schemas/`, avec un JSON assemblé. Recommandation : figer ces contrats à une version Bifrost, tester uniquement les opérations utilisées et vérifier leurs middlewares réels, plutôt que générer une nouvelle plateforme autour de toute l'API. [Sources OpenAPI et validation upstream](https://github.com/maximhq/bifrost/blob/dev/.claude/skills/api-validator/SKILL.md).

## 2. Réutiliser les tests, distinguer simulation et preuve

### Harness signalé par Sofian

La [matrice Test Harness Coverage](https://docs.getbifrost.ai/providers/test-harness-coverage) décrit le harness Postman/Newman `tests/e2e/api/collections/provider-harness.json`. Sa légende distingue scénario exercé et attendu fonctionnel (`✅`), prérequis environnementaux (`✅*`) et fonctionnalité fournisseur sans scénario dans le harness (`❌`). Un `❌` ne prouve donc pas une incompatibilité Bifrost. La page décrit des rapports par fonctionnalité/fournisseur, fonctionnalité/route et couple fournisseur/modèle.

Proposition : conserver cette couverture documentaire avec sa source/version, puis les résultats des exécutions locales séparément. Adapter les scénarios aux accès et modèles concernés. Les prérequis manquants donnent un état « non exécuté », pas « non supporté ». Cette matrice devient la base principale du chantier de qualification, en complément des suites SDK ci-dessous.

Upstream possède des suites d'intégration TypeScript et Python avec configuration YAML de fournisseurs/modèles et scénarios. La suite TypeScript décrit chat, streaming, appels d'outils simples/multiples et retour de résultat, vision URL/base64, parole, transcription, embeddings, sorties structurées et raisonnement selon SDK. Elle cible un Bifrost et exige des credentials fournisseurs. Les scénarios sont une bonne base de sondes ; leur présence n'est pas une certification de chaque modèle. [README et commandes upstream](https://github.com/maximhq/bifrost/blob/dev/tests/integrations/typescript/README.md).

Le plugin **Mocker** synthétise succès, erreurs, latence et contenu selon fournisseur/modèle/règles. Sa documentation annonce Chat Completions et Responses ; elle ne justifie pas une couverture universelle audio/vision/streaming. Une réponse simulée valide notre comportement face à ce scénario, jamais une capacité réelle du fournisseur. Attention : son comportement par défaut peut laisser passer des appels réels ; une campagne hors ligne doit rendre ce point explicite. [Mocker](https://github.com/maximhq/bifrost/blob/dev/docs/features/plugins/mocker.mdx).

Proposition pour Registry : réutiliser Mocker pour la QA et les démonstrations, avec mode simulé affiché et règles qui empêchent les appels réels involontaires. Une exécution simulée ne délivre aucun badge de capacité vérifiée. L'intégration disponible doit être vérifiée sur la version cible ; la [documentation publique](https://docs.getbifrost.ai/features/plugins/mocker) présente notamment une configuration via le SDK Go.

### JSON Parser : candidat pour un aperçu de stream

[JSON Parser](https://docs.getbifrost.ai/features/plugins/jsonparser) complète le JSON partiel des réponses en streaming et ignore les réponses non streamées ; il peut conserver le contenu initial si la réparation échoue. Son activation ciblée documentée passe par un contexte Go.

Proposition : le réserver à un éventuel aperçu interactif de JSON en cours de génération. Il n'est pas nécessaire pour afficher la réponse JSON complète de `/v1/models`. Distinguer le contenu brut du contenu réparé ; une réparation syntaxique ne prouve ni la conformité à un schéma ni une capacité native du modèle. Ne pas supposer un interrupteur HTTP par clé disponible. Son ajout au runtime reste conditionné à un besoin UI démontré et à un contrat d'intégration vérifié.

**Proposition pour les fiches :** séparer « annoncé par la source », « observé via Bifrost », « observé directement chez le fournisseur », « inconnu ». Chaque observation conserve modèle exact, fournisseur, endpoint/protocole, version Bifrost, scénario et date. Un échec via Bifrost ne suffit pas à l'accuser : droits, quota, réseau, payload, alias ou version peuvent l'expliquer. Attribuer une incompatibilité à Bifrost demande un contrôle direct comparable et une trace exploitable ; sinon afficher « cause indéterminée ». Cette méthode est une déduction de conception, pas une fonctionnalité upstream déjà livrée.

## 3. Upgrades et plugins Go

Les plugins dynamiques demandent un build Bifrost compatible et un `.so` compilé avec `-buildmode=plugin`, même plateforme/architecture et version Go. La documentation distingue déjà les interfaces v1.3, v1.4+, `PreRequestHook` v1.6+ et pré-auth v2.0+. [Guide plugins](https://docs.getbifrost.ai/plugins/getting-started).

Go impose aussi la cohérence du toolchain, des options pertinentes et des sources des dépendances communes. **Prévoir le rebuild/test du couple gateway-plugin lors d'un upgrade**, pas une promesse de réutilisation du vieux `.so`. [Contrat officiel Go plugin](https://pkg.go.dev/plugin).

Un panneau passant par HTTP évite ce couplage binaire. Il reste dépendant du sens des champs et des routes. Exemple concret : le changelog v1.5.0 décrit `[]` comme deny-all, `["*"]` comme allow-all, une migration des clés, une API séparée pour les clés fournisseur et des listes modèles filtrées par virtual key. [Changelog v1.5.0](https://docs.getbifrost.ai/changelogs/v1.5.0).

**Proposition minimale :** conserver un lien Bifrost HTTP étroit, version cible enregistrée, tests de contrat avant upgrade et sauvegarde de la configuration avant migration. Garder le plugin seulement pour les comportements impossibles à obtenir par l'API existante. Aucune garantie de compatibilité éternelle établie.

## 4. Fiche modèle et « format universel »

Models.dev propose des catalogues JSON fournisseur, métadonnées indépendantes du fournisseur et catalogue combiné ; `type=all` inclut les types spécialisés normalement omis. C'est une source possible pour enrichir des cartes et réduire la saisie, avec provenance et rafraîchissement. [API Models.dev](https://models.dev/).

Dans les sources inspectées, **aucun format universel n'a été établi qui encode à la fois fiche, routing Bifrost, droits par clé et preuves d'exécution**. JSON, YAML ou TOML décrivent une syntaxe, pas une compatibilité métier. Le catalogue Bifrost et le catalogue Models.dev sont des contrats spécifiques. Recommandation : importer les métadonnées disponibles, conserver les inconnues explicitement et n'ajouter un format d'export propre versionné que pour les données spécifiques réellement nécessaires. Ne pas inventer des capacités pour rendre une fiche « 100 % remplie ».

## 5. Conséquences proposées pour les versions

1. **Avant la spec finale :** relever version/API Bifrost réellement utilisées, droits management, catalogues disponibles et comportement `/v1/models` ; tester un parcours clé concret. Les docs `dev` ne prouvent pas ces points locaux.
2. **Première expérience complète :** galerie, groupes, ajouts/exclusions propres à la clé, impact d'une modification de groupe, aperçu calculé et vérification effective après sauvegarde. Métadonnées sourcées, valeurs inconnues assumées. Les tests de contrats font partie de cette version.
3. **Qualification des capacités :** commencer par quelques sondes explicitement bornées sur les modèles utilisés, budgets/plafonds et résultats datés ; élargir ensuite aux modalités requises et comparaison directe fournisseur/Bifrost. Réutiliser les scénarios upstream.
4. **À décider avec l'utilisateur :** capacités indispensables dès la première version, fournisseurs prioritaires, budget des appels réels, portée du test direct, règles de rafraîchissement et présentation des résultats périmés. Ne pas lancer un test de tous les modèles par défaut.
