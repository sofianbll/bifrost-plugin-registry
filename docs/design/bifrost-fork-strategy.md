# Stratégie future du fork Bifrost — 24 septembre 2026

Cette note consigne l'orientation retenue pour l'usage personnel de Bifrost. Elle ne lance ni fork, ni déploiement, ni automatisation.

## Périmètre

- Forker le dépôt **complet** Bifrost : gateway HTTP, UI et core. Le core SDK seul ne constitue pas l'application Bifrost complète.
- Garder la branche `main` du fork comme miroir d'upstream, sans changements personnels. La tête de `main` upstream n'est pas, à elle seule, une release stable.
- Conserver le Model Registry dans son dépôt et son plugin séparés. Le fork Bifrost peut porter la configuration de compilation pour charger les plugins Go ; l'intégration des routes, de l'UI et de la navigation du plugin dans l'hôte reste une option ultérieure. Préparer et valider d'abord le panneau Registry séparé.

Compiler le gateway complet avec chargement dynamique et copier un plugin dans une image sont des opérations de compilation et de distribution. Ajouter le contrat d'interface embarquée ou corriger la réactivation par URL modifie le code source de Bifrost. Le candidat Registry actuel utilise ce nouveau contrat : son `.so` ne doit pas être présenté comme compatible avec un Bifrost seulement recompilé en dynamique sans ces modifications. Deux modes sont retenus : standard sans patch UI en priorité, intégré conservé pour plus tard. Voir [le cadrage](product-direction.md) et [la recette et les patchs](../BUILD.md).

## Développement et livraison personnels

1. Choisir comme base une version ou un tag **publié** de Bifrost, avec son commit exact, puis créer une branche de développement distincte du miroir `main`.
2. Y appliquer les patches personnels et seulement les PR upstream choisies après examen et tests. Enregistrer leur provenance et leur commit ; ne pas assimiler une PR ouverte à une release.
3. Tester ensemble le gateway, l'UI, le plugin Registry et les parcours concernés sur cette base précise. Utiliser des jeux de données de développement séparés ; vérifier sauvegarde, migrations et retour arrière avant toute mise à niveau des données réelles.
4. Figer la production sur un commit ou tag personnel. Déployer l'image **exacte** qui a passé les contrôles, identifiée par son digest ; une recompilation ultérieure n'est pas la même image testée.
5. Pour chaque release personnelle, noter la base officielle et son commit, les PR et patches inclus, la version du plugin Registry, le digest de l'image et les contrôles réellement passés.

Cette stratégie donne le contrôle d'un artefact personnel. Elle ne prouve pas que l'image officielle Bifrost accepte l'installation du plugin seul et ne résout pas [#7](https://github.com/sofianbll/bifrost-plugin-registry/issues/7). Les tickets et la spec de livraison officielle restent à réaligner sur la priorité actuelle.
