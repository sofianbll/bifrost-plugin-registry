# État du projet — 23 septembre 2026

Cet état décrit le checkout local. La production Pulsar n'a pas été interrogée pendant cet audit. Les rapports et `BUILD_STATUS.json` attestent de vérifications passées, pas de l'état live actuel.

| Partie | État vérifié dans ce dépôt |
| --- | --- |
| Moteur et garde | Implémentés en Go : modèles, groupes, politiques de clés virtuelles, filtrage de `/v1/models` et contrôle des requêtes. Voir `internal/registry/` et `native/main.go`. |
| Panneau implémenté | UI française servie sur `/model-registry` par `internal/admin/`, avec API de configuration, validation, aperçu et plan. Le plugin peut l'héberger sur son port admin local. |
| Build natif | Bifrost `transports/v2.2.2` et plugin reconstruits ensemble pour Linux ARM64/musl : sonde ABI et 42 contrôles HTTP du catalogue par VK réussis, voir `reports/native-v2.2.2/`. L’ancien build 2.2.1 et les déclarations Pulsar de `BUILD_STATUS.json` restent historiques ; la production n’est pas revérifiée ici. |
| Maquette historique | `docs/design/mockup/` contient cinq écrans anglais avec des données fictives. Cette maquette n'appelle pas l'API et n'est pas l'UI servie par le plugin. |
| Prototype Hermes historique | `docs/design/mockup/hermes-prototype.html` a été rejeté par Sofian : démo de logique incomplète, rendu trop éloigné de l'application finale. Conservé comme historique. |
| Prototype React Bifrost | `docs/design/registry-prototype/` utilise les composants UI et ressources upstream à `6493abd3d1422c9bfde95f242fd57b38e73ce881`, avec un shell adapté et un état de démonstration local. Source sur `codex/prototype-bifrost-native`. Validation utilisateur encore attendue. |
| Intégration de la nouvelle UI à Bifrost | Le proxy `/bifrost-registry/` et l’adaptation des chemins de l’UI ne sont pas implémentés. Le panneau actuel utilise `/app.js`, `/app.css` et `/api/*` à la racine ; le prototype React n’est pas branché. |
| Journal des refus | L'API `/api/events`, les compteurs et le journal de garde n'existent pas. L'écran Denials est seulement maquetté. |

## Vérifications et limites

- La suite Go complète du moteur, du CLI et de l’admin passe avec `go test -race -count=1 ./...`, `GOCACHE` dans `/private/tmp` et autorisation des sockets locaux, y compris `TestRealHTTPServer`. L’adaptateur natif sous build tag est vérifié séparément par la sonde et le test HTTP 2.2.2.
- `reports/local-tests-summary.json` annonce 156 tests et 87,8 % de couverture pour une campagne antérieure aux derniers changements de passthrough. Ces chiffres ne qualifient pas `HEAD`.
- `README.md` et `docs/BUILD.md` orientent vers les preuves disponibles. `reports/VALIDATION.md`, `docs/SOURCES.md` et `reports/initial-source-SHA256SUMS` conservent explicitement l'état initial. `BUILD_STATUS.json` mélange 129 modèles/32 groupes et une ancienne mention de 119 modèles/30 groupes : la version chargée actuellement en production reste à vérifier.
- L'ouverture de l'ancienne maquette en `file://` a été bloquée par la politique d'URL. Le nouveau prototype React a été vérifié séparément dans le navigateur intégré sur `http://127.0.0.1:4173/`.

### Prototype React — vérifications du 23 septembre

- `npm run build` et `npm run check` passent depuis `docs/design/registry-prototype/`. Le contrôle de logique couvre notamment les exclusions locales, l'héritage des groupes, les formats de noms et les réponses simulées. Les 31 empreintes des fichiers vendus correspondent à `PROVENANCE.md`.
- Parcours vérifiés dans le navigateur : création de modèle et de clé, ajout individuel/exclusion dans Hermes, format `both`, propagation d'un groupe vers Hermes et la clé témoin, aperçu distinct de la réponse publiée, échec de relecture conservant l'ancienne réponse avec état non vérifié.
- Vérification finale : visite en six étapes (retour, fin et fermeture avec Échap), validation persistante des champs modèle, campagne simulée et rapport conservant un identifiant d'accès personnalisé. Galerie et visite contrôlées à 320 px sans débordement horizontal, en thème clair et sombre ; dimensions de navigateur remises à leur valeur normale ensuite.
- L'état reste en mémoire et se réinitialise au rechargement. Création de clés, publication, relecture et qualification restent simulées : aucun secret utilisable ni appel Bifrost/fournisseur. La validation UX par Sofian et les preuves d'intégration réelle restent à faire.

### Itération UX — catalogue, groupes et laboratoire

- Taxonomie explicite : créateur, série de modèles, fournisseur servant, tâches, modalités d’entrée/sortie et capacités. Recherche et filtres partagés entre catalogue, découverte, groupes, clés et cibles du laboratoire. Les sélections masquées par les filtres restent visibles et modifiables.
- Collections en cartes ou tableaux, tailles de cartes et informations configurables. Préférences globales locales, surcharges par vue et choix du logo créateur/fournisseurs. L’export `config.json` reste une proposition de contrat UI, sans synchronisation avec le plugin.
- Édition des groupes en cartes ou arbre natif Bifrost, avec un même brouillon. Aperçu nominatif des ajouts/retraits par clé et des exclusions locales conservées. Ajout de modèle depuis deux entrées de découverte illustratives, puis formulaire prérempli.
- Laboratoire avec sept scénarios référencés au harness Bifrost, sélection multiple par modèle/fournisseur/créateur/groupe, exclusions d’accès, matrice de cas, progression, annulation, historique et relance ciblée. Mocker et JSONParser sont documentés comme outils candidats ; ils ne sont pas connectés.
- Contrôles navigateur : ajout de GPT-4o (9 modèles / 12 accès), exclusion de Sonnet et ajout individuel dans Hermes, garde de navigation du brouillon, impact groupe préservant l’exclusion, continuité arbre/cartes, préférences propagées aux tableaux et au laboratoire. Lot de 12 cas : 7 réussites simulées, 2 résultats indéterminés, 3 cas non exécutés ; exclusion Azure respectée et relance limitée aux deux cas indéterminés. Quitter un lot conserve son rapport avec les cas restants non exécutés.
- Cartes, laboratoire et visite guidée inspectés à 320 px en thèmes clair/sombre, sans débordement horizontal de page ; catalogue inspecté à 1280 px. Navigation mobile corrigée pour fermer le menu et remonter en haut, avec titre et description accessibles. Aucun nouvel avertissement console sur ce parcours après correction. Dimensions remises à leur valeur normale et données de démonstration réinitialisées.
- `npm run build` et `npm run check` passent pour cette itération ; 38 empreintes de sources/copies vérifiées contre `PROVENANCE.md`. Le build signale seulement un bundle JavaScript de 565 Ko, non découpé pour ce prototype. Validation utilisateur encore attendue.
- Aucune modification de l’intégration Go, de la production, des secrets ou de permissions Bifrost. Les résultats du laboratoire restent des fixtures, jamais des preuves de capacité fournisseur.

### Retouches — espacements, sélection et packs clients

- Barres de recherche/actions, cartes de clés/groupes, tableaux et panneaux d’édition espacés depuis leur composition ; composants upstream inchangés. L’aperçu de clé reste à côté du composeur à 1280 px. Les cartes du sélecteur compact utilisent une seule colonne pour conserver leur lisibilité.
- « Select all » sélectionne les résultats de la vue filtrée ; sa désélection conserve les choix masqués. Le même comportement existe pour les modèles (groupes, clés et laboratoire) et les tests. Compteurs distincts : sélection directe, sélection visible/masquée, puis modèles effectifs, accès, tests et cas du lot. Une vue vide désactive la sélection globale.
- Quatre packs suggérés ajoutent leurs tests sans supprimer les choix individuels : Hermes Agent, Codex, Claude Code et OpenCode dans sa variante OpenAI compatible. Le catalogue compte désormais 13 scénarios, dont six fixtures Responses/Messages. Mocker et JSONParser sont présentés sous « Bifrost plugins », avec leur rôle explicite.
- Contrôles navigateur : filtre OpenAI sur une clé (2/3 visibles + 1 masqué), sélection globale (4 au total), puis désélection visible (Sonnet conservé, deux modèles hérités exclus localement). Ajout du pack Codex conservant les tests Hermes, désélection des trois tests Responses filtrés conservant les trois autres, filtre vide désactivant l’action. Lot Codex + Claude Code : 2 modèles, 2 accès, 6 tests, 12 cas ; 6 succès simulés et 6 combinaisons sans correspondance de harness non exécutées. Azure et Bedrock exclus n’apparaissent pas dans le rapport.
- À 320 px, les onglets du laboratoire passent à la ligne et le récapitulatif reste entièrement lisible. Les packs et les cartes ont été inspectés dans le navigateur. `npm run build` et `npm run check` passent ; seuls les avertissements de taille du bundle demeurent. Les tests couvrent la portée filtrée, les doublons, les packs additifs, les protocoles et les capacités inconnues qui doivent rester testables.
- Aucun client réel ni harness exécuté : les packs sont des recettes proposées, pas une certification. Les [sources des protocoles clients](docs/design/bifrost-ui-patterns.md#suggested-client-test-packs) et les limites de preuve sont documentées.

- Correctif du logo dans le menu replié : icône compacte avec contraste sombre, bouton de réouverture accessible, logo complet conservé dans le menu ouvert et mobile. Vérification navigateur des états replié/ouvert en clair et sombre à 1280 px, et du menu mobile à 390 px ; build et contrôles du prototype réussis.

### Dernière clarification UX — laboratoire centré sur Bifrost

- Packs clients locaux supprimés. Préparation en trois étapes (tests, modèles/accès, vérification) et historique séparé ; mode Tous/Personnaliser conservant le sous-ensemble personnalisé. Les 13 scénarios restent illustratifs et la collection officielle complète n'est pas importée. Les correspondances fournisseurs sont explicitement présentées comme illustratives.
- Grille responsive du sélecteur de modèles, raccourcis de sélection et exclusions accessibles avant la grille, options et matrice du lot repliées. Retour en haut lors des changements d'étape. Pied des cartes de rapports corrigé : source à gauche, bouton à droite, espacement et retour à la ligne.
- Vérifications navigateur : 1 test masqué + 3 tests streaming filtrés conservés en passant de Personnaliser à Tous puis retour (4/13) ; GPT-5 choisi avec Azure exclu, rapport simulé limité à `openai/gpt-5`, puis historique augmenté. Vue mobile à 320 px inspectée en sombre, résumé et compteurs sans débordement. Build et contrôles de logique réussis ; seul l'avertissement existant sur la taille du bundle reste. Aucune exécution réelle de harness ni appel fournisseur.

### État actuel — collection officielle et lecteur Newman

Cette itération remplace les scénarios/packs illustratifs du laboratoire décrits dans les étapes historiques ci-dessus.

- Catalogue dérivé de la collection officielle à `6493abd` : 3 530 requêtes et 114 dossiers, empreinte source vérifiée, IDs positionnels préservant les noms répétés. Recherche, sélection filtrée des dossiers/requêtes, vues cartes/tableaux et modes Tous/Personnaliser. Les assertions affichées dans la source peuvent être conditionnelles ; elles ne constituent pas des résultats.
- Un seul sélecteur de cibles conserve les identifiants d'accès exacts. Créateur, fournisseur, groupe et tâche filtrent cette même sélection ; décocher exclut l'accès. Le récapitulatif distingue correspondances directes, prérequis à revoir et cas ignorés par la source, sans réécrire automatiquement les tests pour un autre modèle.
- Page de rapport dédiée : prompts/messages, requêtes, réponses, assertions et activité enregistrée. Import de JSON Newman local, corps Buffer/SSE décodés, valeurs de credentials masquées, erreurs/absence de réponse/skip traités distinctement. Historique conservé entre les pages de la session. Pause, arrêt et relance concernent la relecture UI.
- Une vraie exécution Newman 6.2.1 sur un serveur loopback isolé fournit le rapport de démonstration : trois requêtes officielles et scripts hérités, deux réussites et un échec délibéré. Les réponses sont produites par un stub ; ni Bifrost ni un fournisseur n'ont été qualifiés. Les événements de requête/response/assertion/fin sont enregistrés avec leurs timestamps. Le lien à un runner actif et les plugins Mocker/JSON Parser restent à intégrer.
- Contrôles navigateur : catalogue et détails à 320 px, suivi à 768 et 1280 px, thèmes clair/sombre, absence de débordement horizontal sur ces parcours. Sélection filtrée OpenAI conservant Azure hors filtre, désélection filtrée conservant cet accès, prompt source exact, erreur 503 et assertion associée, import du rapport réel, pause/reprise/arrêt, historique conservé après navigation. Les 38 empreintes des composants/ressources vendus restent inchangées.
- `npm run check` couvre le catalogue, le parseur, la sélection filtrée, les préférences et le moteur de démonstration ; `npm run build` vérifie TypeScript et Vite. Validation UX de Sofian toujours attendue. Aucun push ni changement de production.

## Base de reprise et prochaine étape

### Préparation de la spec V1

- Sofian a donné son accord pour préparer la spec et demande confirmation du contrôle de `/v1/models` par VK. Le mécanisme existe : politique liée à la clé, confirmation de l'identité par Governance, puis intersection de la réponse native avec les routes autorisées par cette politique. Il ne peut pas exposer un modèle absent de la réponse native.
- Les tests existants `TestProjectionIntersectionAndPrivacy` et `TestProjectionRejects` passent lors de cette vérification ciblée. Ils prouvent le comportement local, pas le pipeline d'une instance Bifrost active. Les anciens smokes d'inférence ne prouvent pas deux listes `/v1/models` distinctes par VK.
- Premier jalon obtenu sur Bifrost 2.2.2 isolé : voir la preuve ci-dessous. La [spec V1 de cadrage](docs/design/core-v1-spec.md) distingue décisions confirmées et arbitrages ouverts ; ces derniers empêchent encore le statut prêt à implémenter pour l’ensemble.
- Spec publiée dans [GitHub #1](https://github.com/sofianbll/bifrost-plugin-registry/issues/1) avec `needs-info` ; [GitHub #2](https://github.com/sofianbll/bifrost-plugin-registry/issues/2) porte le jalon autonome de filtrage HTTP. Son correctif runtime reste local, sans déploiement.

### Preuve HTTP — Bifrost 2.2.2

- Cible mise à jour à la demande de Sofian : `transports/v2.2.2`, commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`. Paire gateway/plugin compilée avec Go 1.27.1, Linux ARM64/musl ; vrai frontend upstream construit, sonde ABI réussie.
- Un vrai essai a trouvé un défaut : l’identité Governance du contexte enfant n’atteignait pas le post-hook HTTP. Le correctif transmet uniquement le résultat validé, dans une session atomique propre à la requête de modèles ; tout désaccord reste bloquant. Inférence et streaming inchangés.
- **42 contrôles passent** : baseline native identique pour trois VK, listes Registry distinctes pour deux clés, formats `model`, `provider/model`, `both`, intersection des droits natifs, lecture alternée, modification d’un groupe via l’API Registry et révisions, refus des clés absentes/inconnues/non configurées et de l’identité incohérente. `/v1/models` et `/openai/v1/models` vérifiés.
- Conteneur sans réseau externe, fournisseur loopback contrôlé, aucune inférence. Configurations, clés, SQLite, logs et conteneur de test supprimés. Rapports avant/après, manifeste, patch exact et commande de reproduction dans [reports/native-v2.2.2](reports/native-v2.2.2/README.md) ; binaires locaux ignorés dans `dist/native-v2.2.2/`.
- Limites : prototype encore simulé, gestion des VK par API Bifrost et parcours Hermes à brancher. Les VK sans politique Registry sont actuellement refusées ; le cas sans fournisseur natif autorisé reste fail-closed et doit être cadré avant activation globale. Aucune preuve de chargement sur la production de Sofian.

### Priorité actuelle et hiérarchie visuelle

- Décision validée par Sofian : **Publish → sauvegarde → vrai `GET /v1/models` avec la clé → comparaison des IDs de la révision publiée**. États distincts : vérifié, écart détecté, relecture impossible ; aperçu du brouillon et dernière preuve horodatée séparés. Voir [le contrat produit](docs/design/product-direction.md#décision-validée--publication-vérifiable). Il s'agit d'une validation du comportement, pas d'une preuve d'intégration ; le prototype reste simulé.
- Sofian reporte le développement fonctionnel du laboratoire ; sa page reste dans le prototype. La prochaine version fonctionnelle vise catalogue, groupes et clés, validés dans Hermes. Les étapes restantes sont détaillées dans [le cadrage produit](docs/design/product-direction.md#chemin-restant-vers-une-première-version-fonctionnelle).
- Retouche visuelle par composition des composants existants : canvas distinct des cartes, en-têtes de cartes teintés, titres de page 24/30 px et noms de modèles 16 px, métadonnées secondaires, boutons d'ouverture plus discrets, sélections accentuées avec les couleurs Bifrost. Composeur, aperçu, relecture, réglages et panneaux d'édition suivent cette hiérarchie. L'aperçu de configuration reste dans une section avancée repliée.
- Diagnostic `refactoring-ui` ciblé : 9/10 (7 critères sur 8 examinés). Hiérarchie, niveaux de gris, espacement, labels/valeurs, échelle, largeur du texte et relief contrôlés ; une vérification exhaustive de tous les contrastes reste à faire. Le texte secondaire directement sur le canvas clair a été renforcé après mesure du couple natif à environ 4,46:1. Cette note ne constitue pas une certification d'accessibilité.
- Parcours vérifiés en clair/sombre : catalogue, groupes/cartes/arbre/panneau à 320 px, clés et composeur à 1280 px, réglages à 768 px. Aucun débordement horizontal sur ces écrans. Une exclusion de modèle modifie encore uniquement le brouillon et son aperçu ; abandonner le brouillon rétablit la sélection. Build et contrôles existants réussis ; 38 empreintes upstream intactes. Audit indépendant du diff : aucun changement de logique métier détecté.

- Point de départ de cette reprise : `main` à `503e775`, comprenant la maquette locale, devant la référence locale `origin/main` à `f05e029`. Le nettoyage et le cadrage sont regroupés sur `codex/prepare-ui-ux`. Consulter `git status` pour l'état courant ; aucun push n'a été effectué pendant cette préparation.
- Les binaires restent locaux et ignorés par Git, dont `reports/native-build-v1/bifrost-http` (143 Mo). Les rapports et empreintes de build restent suivis. Le code, les configurations et l'ancienne maquette sont conservés.
- La configuration des skills Matt Pocock est dans `AGENTS.md` et `docs/agents/`. GitHub Issues est accessible et les cinq labels choisis sont présents. Aucun ticket d'implémentation n'a été créé pendant cette préparation.
- Prochaine étape : résoudre les arbitrages de la spec de cadrage et terminer les validations UX avant les tickets suivants. La preuve isolée du filtrage par clé est obtenue sur 2.2.2 ; Hermes reste le premier client réel de validation. Voir le [cadrage produit](docs/design/product-direction.md).
