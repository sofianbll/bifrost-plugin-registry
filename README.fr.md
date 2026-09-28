<div align="center">

<img src="ui/public/bifrost-logo.webp" alt="Bifrost Registry" width="200">

# Bifrost Registry

**Un catalogue de modèles fiable et une composition d'accès par clé pour les clés virtuelles Bifrost.**

Organisez chaque modèle une seule fois, puis décidez exactement de ce que chaque clé virtuelle peut atteindre — via une interface embarquée qui tourne à côté de votre gateway Bifrost existant.

[![CI](https://github.com/sofianbll/bifrost-plugin-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/sofianbll/bifrost-plugin-registry/actions/workflows/ci.yml)
[![Release](https://img.shields.io/badge/release-v0.3.0--rc.4-blue)](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.3.0-rc.4)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

[English](README.md) · Français

</div>

![Catalogue Registry](docs/images/fr/catalogue-grid.png)

*Un catalogue consultable des références Models.dev et Bifrost, avec provenance par champ et corrections révisables.*

L'interface est **anglaise par défaut** ; le français est disponible en un clic (sélecteur de langue) ou via `?lang=fr`.

## Ce que fait Registry

- **Catalogue Models.dev embarqué** — un instantané de référence versionné et reproductible, avec provenance par champ, liens canoniques et corrections manuelles qui survivent aux rafraîchissements.
- **Endpoints par accès** — chaque accès fournisseur choisit ses opérations exposées indépendamment (Chat Completions et Responses sont des choix distincts).
- **Sélection d'accès par clé** — choisissez ce que chaque clé virtuelle peut atteindre ; exclusions et ajouts sont révisés avant publication.
- **Prix et limites natifs** — corrections tarifaires et accès restreint par clé appliqués via la gouvernance Bifrost elle-même, pas une couche parallèle.
- **Routage natif restreint** — publiez des alias partagés qui ne routent que parmi les accès retenus par chaque clé.
- **UI embarquée + import/export** — panneau React sur son propre port, instantanés JSON versionnés avec aperçu et sauvegarde, export CSV aplati.

## Démarrage rapide

```bash
# 1. Chargez l'image dynamique Bifrost 2.2.3 publiée (Linux ARM64)
docker load -i bifrost-dynamic-2.2.3-linux-arm64.tar.gz
# 2. Fournissez les deux identifiants admin et un volume persistant sur /app/data
export REGISTRY_ADMIN_TOKEN=…  REGISTRY_BIFROST_AUTH='Basic …'
# 3. Ajoutez le .so correspondant par URL directe dans les réglages plugin de Bifrost
#    https://github.com/sofianbll/bifrost-plugin-registry/releases/download/v0.3.0-rc.4/bifrost-registry-v0.3.0-rc.4-linux-arm64.so
# 4. Ouvrez le panneau
open http://127.0.0.1:8099/model-registry
```

**[Installation, configuration et retour arrière complets →](docs/INSTALL.md)**

## Captures d'écran

| | |
| --- | --- |
| ![Catalogue en grille](docs/images/fr/catalogue-grid.png)<br>**Grille** — cartes à hauteur égale avec provenance par champ | ![Catalogue en tableau](docs/images/fr/catalogue-table.png)<br>**Tableau** — comparaison dense par créateur et famille |
| ![Options d'affichage](docs/images/fr/display-options.png)<br>**Options d'affichage** — formes et densités grille/carré/tableau | ![Fiche modèle](docs/images/fr/model-card.png)<br>**Fiche modèle** — un modèle, des accès fournisseurs distincts |
| ![Compositeur de clé](docs/images/fr/key-composer.png)<br>**Compositeur de clé** — politiques d'accès basic et expert | ![Mobile](docs/images/fr/mobile.png)<br>**Mobile** — les mêmes parcours à 400 px |

## Pourquoi

Bifrost gouverne l'inférence, les identifiants, les budgets et le routage. Ce qu'il ne donne pas à l'opérateur, c'est une image fiable et révisable de ce que chaque clé virtuelle peut réellement atteindre. Registry comble ce trou : un catalogue des références Models.dev et Bifrost, avec provenance par champ et corrections manuelles qui survivent aux rafraîchissements, composé en politiques d'accès pour les clés virtuelles.

L'embarquement d'un instantané Models.dev versionné rend le catalogue reproductible et hors-ligne — aucune dépendance d'exécution vers une API tierce. L'image du gateway est un Bifrost 2.2.3 non modifié compilé avec chargement dynamique, et Registry reste un plugin installé séparément : le chemin d'inférence auquel vous faites confiance n'est jamais patché.

Projet indépendant, pas un produit officiel Maxim/Bifrost.

## Pour aller plus loin

- [Installation](docs/INSTALL.md) — fichiers de release, identifiants, stockage persistant, mise à jour et retour arrière.
- [Configuration](docs/CONFIGURATION.md) — fiches Registry, groupes, politiques de clé et anciennes datasheets.
- [Guide utilisateur](docs/USER-GUIDE.md) — enregistrement de modèles, sources, groupes et composition de clés.
- [Procédure de release](docs/RELEASE.md) — qualifier et publier une paire gateway/plugin.
- [Compilation native](docs/BUILD.md) — compiler le gateway et le `.so` avec des dépendances compatibles.
- [Index de la documentation](docs/README.md) · [Changelog](CHANGELOG.md) · [État](STATUS.md).

## Exécution et qualification

La release courante **v0.3.0-rc.4** est une paire ARM64 Bifrost 2.2.3 construite depuis la source non modifiée `transports/v2.2.3`. Toutes les suites utilisent des fournisseurs synthétiques.

| Contrôle | Résultat |
| --- | --- |
| Gateway `bifrost-http` | `80d17483…` (build reproductible) |
| Plugin `bifrost-registry.so` | voir le `manifest.json` de la release |
| Isolation `/v1/models` par clé | 42/42 |
| Installation autonome, redémarrage, désactivation | 55/55 |
| Autonome + assistant synthétique | 72/72 |
| Adoption de clés natives | 19/19 |
| Capacités par accès (prix, VK restreinte, alias partagé) | 34/34 assertions |

[Rapport de qualification ARM64](reports/bifrost-2.2.3-arm64-869e251/README.md) · [Audit final](docs/reviews/2026-09-28-final-audit.md)

**Limites honnêtes.** ARM64 seulement — AMD64 2.2.3 et l'image officielle précompilée restent non qualifiés. Toutes les suites tournent contre des fournisseurs synthétiques, **sans inférence réelle**. La suite d'adoption utilise un bridge réseau limité au loopback ; les autres suites utilisent `--network none`. Aucun déploiement de production n'a été effectué, et l'intégration à la barre latérale native est différée.

## Contribuer

Ouvrez d'abord une issue avec un bug reproductible ou un cas d'usage concret, puis une pull request vers `main`. Lisez [CONTRIBUTING.md](CONTRIBUTING.md) pour les exigences et la commande `make check` complète. Les issues suivent les [cinq étiquettes de triage](docs/agents/triage-labels.md) du dépôt.

## Support

Posez vos questions et signalez les bugs via [GitHub Issues](https://github.com/sofianbll/bifrost-plugin-registry/issues). Pour les questions d'usage et de configuration, commencez par le [guide utilisateur](docs/USER-GUIDE.md).

## Sécurité

Signalez les vulnérabilités en privé via [le rapport privé GitHub](https://github.com/sofianbll/bifrost-plugin-registry/security/advisories/new) ; n'ouvrez jamais d'issue publique avec des identifiants ou un exploit. Voir [SECURITY.md](SECURITY.md) pour le périmètre et les limites de confiance.

## Code de conduite

Ce projet suit le [Contributor Covenant v2.1](CODE_OF_CONDUCT.md). Signalez les comportements inacceptables via les canaux privés de [SECURITY.md](SECURITY.md).

## Licence

Le code écrit par le projet est sous [licence MIT](LICENSE). Le code et les assets UI Bifrost vendored conservent leur [licence Apache-2.0](ui/LICENSE), et les polices Geist conservent leur [SIL Open Font License](ui/public/static/fonts/OFL.txt). Voir [les notices tierces](THIRD_PARTY_NOTICES.md) et [la provenance upstream](ui/PROVENANCE.md).
