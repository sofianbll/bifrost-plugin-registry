# Qualification du candidat V1 — 24 septembre 2026

La distribution comporte une image Bifrost 2.2.2 compilée avec chargement dynamique et un plugin Registry `v0.2.0-rc.1` séparé. L'image ne contient pas le plugin. Son installation passe par une URL de `.so`, puis le plugin sert son interface et son API sur `8099`.

## Périmètre et preuves

| Contrôle | ARM64 | AMD64 |
| --- | --- | --- |
| Source Bifrost officielle inchangée après compilation | [2 744 fichiers](arm64/source-verification.json) | [2 744 fichiers](amd64/source-verification.json) |
| ABI Go gateway/plugin | [réussi](arm64/abi-smoke.json) | [réussi](amd64/abi-smoke.json) |
| Catalogue HTTP par clé, noms et coexistence native | [42/42](arm64/models/isolated-models-report.json) | [42/42](amd64/isolated-models/isolated-models-report.json) |
| URL, panneau autonome, catalogue, import et persistance | [54/54](arm64/standalone/report.json) | [54/54](amd64/standalone-plugin/report.json) |
| Image livrée, `.so` séparé et volume persistant | [26/26, avec mise à jour et restauration](arm64/upgrade-rollback/report.json) | [18/18](amd64/image/report.json) |
| Adoption explicite sans élargissement des droits natifs | [19/19](arm64/adoption-report.json) | Même code, pas de seconde campagne |
| Client Hermes installé : découverte et chat synthétique | [4/4](arm64/hermes/report.json) | Pas de seconde campagne |

La [sonde du fournisseur Hermes](arm64/browser/hermes-fixture-report.json) vérifie qu'un seul appel autorisé atteint le fournisseur synthétique et qu'un modèle exclu renvoie 403 sans l'atteindre. Ce parcours emploie une vraie clé virtuelle et le client Hermes installé, avec zéro outil, un espace temporaire et des connexions limitées au loopback. Il ne prouve aucune inférence ni capacité d'un fournisseur réel.

Chaque architecture conserve les empreintes de ses binaires, les paramètres Go et les dépendances résolues. Source : `transports/v2.2.2`, commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`, Go 1.27.1, core 1.10.1, framework 1.7.3, Linux/musl. Les images ont le même gateway que les paires testées, l'entrypoint officiel et un volume `/app/data`.

## Reproduction

- `integration/isolated_models.py` et `integration/standalone_plugin_probe.py` : exécuter dans un conteneur de la bonne architecture avec `--network none`, les binaires montés en lecture seule et un nouveau dossier de rapport inscriptible. Le premier reçoit aussi le `manifest.json` de la paire.
- `integration/image_distribution_probe.py` : reçoit l'image, le `.so` séparé et un nouveau dossier de rapport. `--previous-plugin` ajoute sauvegarde complète du volume arrêté, mise à jour, puis restauration de la sauvegarde et de l'ancien plugin.
- `integration/standalone_plugin_probe.py --keep-alive --hermes-fixture` : fixture temporaire pour la revue navigateur, `integration/adoption_live_probe.py` et `integration/hermes_client_probe.py`. Publier uniquement les ports loopback attendus par les sondes. Le fichier d'authentification temporaire est privé et supprimé à l'arrêt.

Les tests Go (`go test ./...`), le contrôle frontend (`npm run check`), sa compilation, le convertisseur de datasheets et le test de packaging passent. Les deux revues indépendantes couvrent les contrats fonctionnels et la qualité du code ; les défauts de filtre fournisseur et de recherche des références trouvés en revue ont une régression exécutable.

## Revue navigateur

Sur fixture synthétique loopback, le catalogue affiche trois fiches pour quatre modèles workspace : les accès `openai/upstream-alpha` et `openai/upstream-beta` restent distincts sous une référence partagée. Sur le `.so` final, rechercher « shared reference » affiche une fiche et ses deux accès, en cartes comme en tableau. La source/date et les liens de métadonnées restent visibles. Le test automatisé couvre aussi le cas inverse : deux références distinctes portées par un même modèle ne deviennent pas deux résultats quand une seule correspond.

Le parcours import a été contrôlé avant les deux derniers correctifs de recherche (UI import inchangée) : choix du JSON, aperçu « 1 référence modifiée », application avec reçu de sauvegarde, puis nouveau nom visible dans le catalogue. L'API d'import a été retestée sur les deux `.so` définitifs dans les 54 contrôles. Les thèmes clair/sombre et le rendu à 320 px sont lisibles ; largeur du document mesurée à 320 px. Le rechargement du panneau final redemande le jeton ; aucune erreur console relevée. La déconnexion a également été contrôlée avant le correctif de recherche.

Onglet fermé, dimensions rétablies, conteneurs et volumes des sondes supprimés, identifiants temporaires retirés. La production et le pilote utilisateur sur 8082 n'ont pas été modifiés.

## Limites

La réactivation à chaud par URL reste refusée par le chargeur Go (`plugin already loaded`). Les mises à jour utilisent un redémarrage ; le retour arrière testé restaure le volume complet sauvegardé à l'arrêt. Les tests ne qualifient pas une migration de production, les autres versions Bifrost ni l'image officielle précompilée statique. Le pilote utilisateur sur `8082` est conservé. L'intégration au menu Bifrost et le runner du laboratoire restent différés.

## Vérification après publication

La [prérelease v0.2.0-rc.1](https://github.com/sofianbll/bifrost-plugin-registry/releases/tag/v0.2.0-rc.1) cible le commit `9eb7b8314181d53c1c7a32c8dcf9501dcd4da38d`. Les huit assets correspondent à leurs tailles et empreintes locales. Les deux URL publiques de `.so` ont été téléchargées sans authentification : HTTP 200, mêmes SHA-256 que les plugins testés. [Rapport de téléchargement](public-downloads.json).
