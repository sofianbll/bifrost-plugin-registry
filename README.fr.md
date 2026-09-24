# Bifrost Registry

**Un catalogue de modèles et des politiques d’accès pour les clés virtuelles Bifrost.**

[English](README.md) · Français

Organisez vos modèles en groupes réutilisables, choisissez les accès de chaque clé virtuelle, puis comparez le catalogue publié avec la vraie réponse de `/v1/models`. Registry ajoute une interface de gestion à [Bifrost](https://github.com/maximhq/bifrost), qui conserve l’inférence, les identifiants, le routage et les budgets.

> **Version candidate.** `v0.2.0-rc.1` est qualifiée avec Bifrost 2.2.2 sur Linux ARM64 et AMD64/musl. Ces contrôles ne certifient pas les capacités des fournisseurs ni un déploiement en production. Projet indépendant, sans affiliation à Maxim/Bifrost.

## Fonctionnalités

- **Catalogue :** fiches de référence et accès fournisseurs distincts, métadonnées Bifrost/Models.dev, provenance et corrections conservées lors des synchronisations.
- **Groupes et clés :** sélections partagées, ajouts et exclusions par clé, formats de noms, aperçu, publication et relecture indépendante.
- **Coexistence native :** les clés Bifrost existantes gardent leur fonctionnement jusqu’à adoption explicite ; Registry ne peut pas élargir leurs droits natifs.
- **Import/export :** instantanés JSON versionnés avec aperçu et sauvegarde, export CSV aplati et conversion hors ligne des anciennes datasheets.
- **Administration :** interface React embarquée, thèmes clair/sombre, jeton administrateur distinct et données persistantes.

## Installation

La [release](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) fournit **deux éléments séparés** pour chaque architecture :

| Élément | Rôle |
| --- | --- |
| Archive de l’image Docker Bifrost | Gateway Bifrost 2.2.2 complet, compilé avec chargement dynamique depuis les sources officielles non modifiées. **Aucun plugin Registry inclus.** |
| Plugin Registry `.so` | À installer par son URL directe versionnée dans Bifrost. Il embarque l’interface et la sert sur le port `8099`. |

1. Télécharger l’archive correspondant à l’architecture de l’hôte, vérifier son empreinte puis la charger avec `docker load -i <archive.tar.gz>`.
2. Configurer le stockage persistant et les deux accès d’administration, puis ajouter l’URL du `.so` compatible dans les paramètres des plugins Bifrost.
3. Ouvrir `http://127.0.0.1:8099/model-registry`.

**[Guide d’installation et de retour arrière en français →](docs/RELEASE.md)**

Le `.so` demande un gateway compilé avec un environnement compatible. L’image officielle statique testée ne peut pas le charger. Une mise à jour du plugin demande un redémarrage ; l’intégration au menu natif Bifrost reste différée.

## Développement

Les prérequis et commandes sont dans [CONTRIBUTING.md](CONTRIBUTING.md). Pour commencer :

```bash
git clone https://github.com/sofianbll/bifrost-plugin-registry.git
cd bifrost-plugin-registry
make check
```

L’interface finale est dans `ui/`, le moteur et l’API dans `internal/`, l’adaptateur Bifrost dans `native/` et les sondes d’intégration dans `integration/`. Les rapports datés restent dans `reports/` ; les anciens comptes rendus sont conservés dans `docs/archive/`.

Le CLI Go autonome reste un outil de configuration distinct. La compilation du `.so` exige un checkout Bifrost et un environnement Go/C compatibles : [guide de compilation](docs/BUILD.md).

## Documentation et état

[Documentation](docs/README.md) · [État actuel](STATUS.md) · [Changelog](CHANGELOG.md) · [Sécurité](SECURITY.md)

Les [preuves de la release](reports/v1-final/README.md) couvrent les empreintes, l’ABI, les catalogues par clé, la persistance, l’adoption et le retour arrière. Chaque architecture passe 42 contrôles de catalogue et 54 du plugin autonome. Hermes a été testé avec un fournisseur synthétique ; cela ne prouve pas une inférence chez un fournisseur réel. La CI courante contrôle les sources sans requalifier automatiquement la paire native.

## Contributions et licence

Signalez les bugs et propositions dans [GitHub Issues](https://github.com/sofianbll/bifrost-plugin-registry/issues). Consultez [CONTRIBUTING.md](CONTRIBUTING.md) pour proposer un changement et [SECURITY.md](SECURITY.md) pour un signalement privé.

Le code propre au projet est sous [licence MIT](LICENSE). Le code et les actifs Bifrost conservent leur [licence Apache-2.0](ui/LICENSE), et les polices Geist leur [licence SIL OFL](ui/public/static/fonts/OFL.txt). Voir les [attributions](THIRD_PARTY_NOTICES.md) et la [provenance](ui/PROVENANCE.md).
