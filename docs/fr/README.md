# Guides Registry

[English](../README.md) · Français

Installez Registry, choisissez les modèles d’une application ou trouvez de l’aide pour votre gateway.

<a id="documentation-de-bifrost-registry"></a>
<a id="utiliser-registry"></a>

## Démarrer

- [Installer Registry](INSTALL.md) — Démarrez une nouvelle instance de test, installez le plugin et connectez son panneau à Bifrost.
- [Choisir les modèles d’une application](USER-GUIDE.md) — Préparez la sélection d’une clé existante, publiez-la et lisez le résultat renvoyé par Bifrost.

## Gérer les accès

- [Enregistrer un modèle](USER-GUIDE.md#_1-enregistrer-un-modele) — Créez une fiche modèle avec son nom d’appel et ses accès fournisseurs.
- [Réutiliser une sélection avec un groupe](USER-GUIDE.md#_3-composer-des-groupes-et-des-cles) — Partagez une sélection de modèles entre plusieurs clés sans les configurer une par une.
- [Adopter une clé existante](USER-GUIDE.md#_3-composer-des-groupes-et-des-cles) — Confiez à Registry la sélection d’une clé Bifrost sans élargir ses permissions.

## Exploiter et dépanner

- [Sauvegarder avant un changement de version](INSTALL.md#mettre-a-jour-et-revenir-en-arriere) — Retrouvez quoi sauvegarder à l’arrêt et comment restaurer ensemble l’image et les données.
- [Récupérer l’activation du plugin](INSTALL.md#recuperer-l-activation-apres-desactivation) — Suivez la procédure de votre version après avoir désactivé le plugin.
- [Résoudre un problème d’installation](TROUBLESHOOTING.md) — Identifiez les erreurs de téléchargement, de permission et de chargement du plugin.
- [Sécuriser l’administration](SECURITY.md) — Contrôlez les accès admin, l’exposition réseau et les limites de sécurité documentées.

## Référence

- [Consulter la configuration](CONFIGURATION.md) — Retrouvez les champs des fiches modèles, des groupes, des clés et de l’API du panneau.
- [Trouver les fichiers compatibles et les versions précédentes](INSTALL.md#quels-fichiers-pour-quel-hote) — Associez chaque fichier du plugin à son hôte et à sa version de Bifrost.
- [Compiler le gateway et le plugin](../BUILD.md) — Suivez la procédure de compilation native pour obtenir une paire compatible.
- [Consulter l’état de la version publiée](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) — Consultez la version disponible, les contrôles réalisés et ce qui reste non testé.

Pour la release courante, ses preuves et ses limites, lire [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) (en anglais). Pour signaler une vulnérabilité, suivre la [politique de sécurité](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/SECURITY.md) (en anglais).

### Développer et valider

- [Guide de contribution](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CONTRIBUTING.md) : prérequis, contrôles sources et pull requests.
- [UI React](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/ui/README.md) : développement du frontend et provenance upstream.
- [Compilation native](../BUILD.md) : compiler le gateway et le plugin avec des dépendances compatibles.
- [Paquetage](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/packaging/README.md) : empaqueter une paire vérifiée en artefacts séparés.
- [Acceptation du déploiement](../ACCEPTANCE.md) : contrôles pour un environnement cible.
- [Preuves de release](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/README.md) et [changelog](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CHANGELOG.md).

### Conception et historique

Le [vocabulaire du domaine](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CONTEXT.md), la [spécification de la release V1](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/core-v1-spec.md) et les [décisions produit actuelles](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/product-direction.md) cadrent le projet. Les revues datées, l'archive et les rapports témoignent de jalons passés, pas d'instructions d'installation actuelles ; ils restent sur GitHub et ne sont pas publiés ici.
