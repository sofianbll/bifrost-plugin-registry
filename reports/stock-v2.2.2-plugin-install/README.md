# Installation du plugin par URL — Bifrost officiel 2.2.2

Recherche du 24 septembre 2026. **Résultat : le fichier est téléchargé, mais le plugin ne se charge pas.** Le succès d'exécution de la sonde ne signifie pas une installation réussie.

## Preuve finale

- Image officielle Linux ARM64 : `maximhq/bifrost@sha256:b9f6a43c325146dc11244902703206294866baefcb67d239a2bdd6a4f5ff52c6`.
- Plugin du pilote local : SHA-256 `f96515e159a986fb745502f77e73dea1591bae6590c6b01c69284ce22ff151ce`.
- Conteneurs jetables, réseau limité à `lo`, aucun port publié, aucun fournisseur et aucune inférence.
- Authentification administrateur native avec identifiants aléatoires jetables. Une autorisation de téléchargement limitée à `127.0.0.1` permet au serveur de fixture de fonctionner dans le réseau isolé ; elle ne démontre pas l'acceptation des URL privées dans la configuration Bifrost par défaut.

| Opération | Résultat |
| --- | --- |
| Liste initiale des plugins | HTTP 200, liste vide |
| Ajout par URL via l'API utilisée par l'interface native | Un téléchargement observé ; 19 931 256 octets écrits par le serveur de fixture |
| Chargement | HTTP 500 : `plugin.Open(...): Dynamic loading not supported` |
| Lecture du plugin après l'échec | HTTP 404 : la ligne ajoutée a été annulée |
| Nettoyage | Suppression du conteneur Bifrost de test confirmée par la sonde ; aucun conteneur `stock-plugin-*` restant lors du contrôle hôte |

Sources du relevé : [host.json](verified/host.json), [report.json](verified/report.json). Le nombre d'octets mesure les écritures terminées du serveur de fixture ; l'erreur de `plugin.Open` prouve indépendamment que le téléchargement a atteint le chargeur. Aucun hash du fichier temporaire côté Bifrost n'a été relu.

L'inspection séparée du même binaire a donné `ldd /app/main` → `Not a valid dynamic program`. La [documentation officielle](https://docs.getbifrost.ai/plugins/getting-started) précise que les plugins dynamiques requièrent un build dynamique de Bifrost, non activé par défaut. Le résultat runtime ci-dessus concerne cette image ARM64 précise ; aucun binaire AMD64 n'a été testé.

## Reproduction

Depuis la racine du dépôt, avec Docker et les images déjà présentes :

```sh
python3 integration/stock_plugin_probe.py --out /private/tmp/bifrost-stock-proof-new
```

Le script utilise `--pull never` et refuse d'écraser un rapport existant. Il ne monte que sa configuration temporaire, son script et l'artefact `.so`. Les données du pilote local et de la production ne sont pas utilisées. Le rapport conserve les résultats HTTP sans identifiants administrateur.

Les tentatives 1 et 2 documentent une erreur du script de sonde : une fonction nommée `http` masquait le module `http.server`. La tentative 3 a obtenu le premier résultat exploitable. Le relevé `verified/` utilise la version corrigée des compteurs et du contrôle de nettoyage. Ces échecs de sonde ne sont pas des défauts Bifrost.

## Conséquence de livraison

Un changement dans le seul `.so` ne résout pas ce refus de chargement. Il faut un hôte compatible avec les plugins dynamiques. Le source 2.2.2 révèle aussi l'absence de contrat permettant à un plugin de déclarer sa route UI et sa navigation ; voir la [recherche épinglée](../../docs/design/stock-plugin-install-research.md).

La distribution demandée « une URL sur Bifrost standard, interface comprise » dépend donc d'une évolution de l'hôte. **Sofian a choisi de conserver cet objectif et de résoudre ces dépendances côté Bifrost avant la sortie.** La livraison attend une version officielle compatible, puis une preuve d'installation complète sur cet artefact. Une compilation locale modifiée peut servir aux essais préparatoires, sans valider cette condition de sortie.
