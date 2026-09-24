# Vérification de l’interface native — 24 septembre 2026

Candidat local apparié `dist/native-plugin-ui-candidate-v3/`, source Bifrost épinglé au commit `fdeef8e3f31a3b18a61666ba49247d07bae3600a`. Fixture synthétique distincte du pilote utilisateur, publiée uniquement sur loopback pendant la vérification ; aucune inférence fournisseur.

## Parcours observés

- Connexion par le formulaire Bifrost et sa session native. Entrée **Models → Model Registry** visible, ouverture par Entrée au clavier.
- UI et API embarquées accessibles sur `/plugins/bifrost-registry/`, sans serveur Registry secondaire ni montage de ses actifs.
- Groupe `Persisted proof` créé par la preuve HTTP, puis description modifiée dans le panneau en `Edited through the native embedded UI`. **Publish group** donne `Saved.`. La valeur est conservée après rechargement de la page, redémarrage du gateway avec le même répertoire de données, puis nouvelle lecture dans l’UI.
- Clé synthétique visible ; **Read again** affiche **Verified** avec exactement `openai/upstream-alpha` après le redémarrage. Aucun secret affiché sur ces pages.
- Contrôles visuels à 1280 × 800 (groupes clair, clé sombre) et 320 × 740 (groupes sombre, liste de clés sombre, détail de clé clair, catalogue clair). Sur les vues mobiles contrôlées : largeur du document **320 px**, sans débordement horizontal.
- Menu Registry mobile ouvert au clavier, lien Virtual Keys activé avec Entrée, menu refermé automatiquement. Recherche de navigation Bifrost mobile : `Model Registry`, Flèche bas puis Entrée ouvre bien le plugin. L’entrée et les contrôles restent lisibles en thème clair et sombre.
- Retour vers **Bifrost workspace** fonctionnel. Pas d’erreur console relevée sur ces parcours ; le dashboard natif émet ses avertissements existants de dimensions de graphiques.

## Limites et nettoyage

Ces contrôles couvrent l’intégration de livraison du ticket #6, pas une nouvelle revue exhaustive du produit ni la validation UX finale par Sofian. Le laboratoire reste hors de ce lot. Les captures ont été inspectées dans le navigateur de test pendant l’exécution.

La preuve HTTP principale [41/41](final/report.json) utilise Docker `--network none`. La vérification navigateur utilise un container jetable séparé avec publication loopback ; la tentative sur réseau Docker interne ne publiait pas de port et a été remplacée. Seules des données synthétiques sont utilisées. Onglet fermé, dimensions du navigateur rétablies, containers et réseau de test supprimés, identifiants temporaires retirés.

La compatibilité d’un artefact **officiel** Bifrost reste bloquée dans #7.
