# État du projet — 23 septembre 2026

Cet état décrit le checkout local. La production Pulsar n'a pas été interrogée pendant cet audit. Les rapports et `BUILD_STATUS.json` attestent de vérifications passées, pas de l'état live actuel.

| Partie | État vérifié dans ce dépôt |
| --- | --- |
| Moteur et garde | Implémentés en Go : modèles, groupes, politiques de clés virtuelles, filtrage de `/v1/models` et contrôle des requêtes. Voir `internal/registry/` et `native/main.go`. |
| Panneau implémenté | UI française servie sur `/model-registry` par `internal/admin/`, avec API de configuration, validation, aperçu et plan. Le plugin peut l'héberger sur son port admin local. |
| Build natif | Les artefacts et la sonde ABI pour Bifrost `transports/v2.2.1` sont consignés dans `reports/native-build-v1/`. `BUILD_STATUS.json` déclare un chargement et des essais sur Pulsar ; ils ne sont pas revérifiés ici. |
| Nouvelle UI | `docs/design/mockup/` contient cinq écrans anglais avec des données fictives. Cette maquette n'appelle pas l'API et n'est pas l'UI servie par le plugin. |
| Intégration à Bifrost | Le gateway personnalisé, le proxy `/bifrost-registry/` et l'adaptation des chemins de l'UI ne sont pas implémentés. Le panneau actuel utilise `/app.js`, `/app.css` et `/api/*` à la racine. |
| Journal des refus | L'API `/api/events`, les compteurs et le journal de garde n'existent pas. L'écran Denials est seulement maquetté. |

## Vérifications et limites

- Les tests Go du moteur, du CLI et de l'admin passent ici avec `GOCACHE` dans `/private/tmp` et `TestRealHTTPServer` exclu. Ce test ne peut pas ouvrir `[::1]:0` dans le sandbox ; la suite complète n'est donc pas validée dans cet environnement.
- `reports/local-tests-summary.json` annonce 156 tests et 87,8 % de couverture pour une campagne antérieure aux derniers changements de passthrough. Ces chiffres ne qualifient pas `HEAD`.
- `README.md` et `docs/BUILD.md` orientent vers les preuves disponibles. `reports/VALIDATION.md`, `docs/SOURCES.md` et `reports/initial-source-SHA256SUMS` conservent explicitement l'état initial. `BUILD_STATUS.json` mélange 129 modèles/32 groupes et une ancienne mention de 119 modèles/30 groupes : la version chargée actuellement en production reste à vérifier.
- L'ouverture de la maquette locale dans le navigateur intégré a été bloquée par sa politique d'URL. Son état est établi par lecture du code, sans nouvelle validation visuelle dans cet audit.

## Base de reprise et prochaine étape

- Point de départ de cette reprise : `main` à `503e775`, comprenant la maquette locale, devant la référence locale `origin/main` à `f05e029`. Le nettoyage et le cadrage sont regroupés sur `codex/prepare-ui-ux`. Consulter `git status` pour l'état courant ; aucun push n'a été effectué pendant cette préparation.
- Les binaires restent locaux et ignorés par Git, dont `reports/native-build-v1/bifrost-http` (143 Mo). Les rapports et empreintes de build restent suivis. Le code, les configurations et l'ancienne maquette sont conservés.
- La configuration des skills Matt Pocock est dans `AGENTS.md` et `docs/agents/`. GitHub Issues est accessible et les cinq labels choisis sont présents. Aucun ticket d'implémentation n'a été créé pendant cette préparation.
- Prochaine étape confirmée : prototype UI/UX du parcours Hermes, puis retours de Sofian avant la spec et les tickets. Voir le [cadrage produit](docs/design/product-direction.md) pour les besoins, versions proposées et décisions ouvertes.
