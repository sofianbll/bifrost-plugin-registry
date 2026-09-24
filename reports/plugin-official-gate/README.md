# Ticket #7 — prérequis de qualification officielle

Contrôle du 24 septembre 2026. **Bloqué par la publication côté Bifrost.**

La [liste des versions officielles](https://github.com/maximhq/bifrost/releases) consultée pendant cette implémentation ne fournit pas de version HTTP plus récente que [transports/v2.2.2](https://github.com/maximhq/bifrost/releases/tag/transports/v2.2.2), commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`, intégrant les prérequis demandés.

L'[essai conservé sur l'image officielle ARM64](../stock-v2.2.2-plugin-install/README.md) a atteint le chargement du `.so`, puis échoué avec `Dynamic loading not supported`. L'ajout a été annulé. Le [contrat plugin épinglé](https://github.com/maximhq/bifrost/blob/fdeef8e3f31a3b18a61666ba49247d07bae3600a/core/schemas/plugin.go) ne fournit pas non plus l'extension UI/routes/navigation nécessaire.

Les travaux locaux des tickets #5 et #6 préparent ces évolutions. Leur réussite ne crée pas un artefact officiel et ne lève pas ce prérequis. Le ticket [#7](https://github.com/sofianbll/bifrost-plugin-registry/issues/7) doit donc rester ouvert.

## Reprise du contrôle

1. Identifier la publication officielle qui contient le chargement dynamique et le contrat UI, avec version, digest et architecture.
2. Construire le plugin compatible avec les paramètres publiés de cet artefact.
3. Exécuter les critères de #7 : URL seule, UI/API, persistance et redémarrage, mise à jour, échec de mise à jour et restauration.
4. Conserver les preuves de chaque version/architecture effectivement testée.

Aucune inférence fournisseur, aucune production modifiée et aucune soumission upstream n'ont été effectuées pour ce contrôle de disponibilité.
