# Validation du pilote local — 24 septembre 2026

## Périmètre

Bifrost `transports/v2.2.2`, instance locale `http://127.0.0.1:8082`, fournisseur **CLI PROXY** configuré par Sofian. La production et un vrai client Hermes ne font pas partie de cette preuve.

## Parcours réel

La version finale v5 passe ensuite **44/44 contrôles** dans [`workspace-final-report.json`](workspace-final-report.json), sans nouvelle inférence. Le contrôle supplémentaire modifie la configuration brute après une relecture réussie : le statut devient `not_verified`, la dernière observation reste disponible et une nouvelle relecture rétablit `verified`.

Le script [`integration/live_workspace.py`](../../integration/live_workspace.py) a produit [`workspace-live-report.json`](workspace-live-report.json) : **39 contrôles réussis**. Il crée deux clés temporaires, publie des modèles et un groupe, compare les listes réellement exposées, puis révoque les clés et restaure le registre initial.

```sh
python3 integration/live_workspace.py --inference --out /private/tmp/registry-live-proof.json
```

Cette commande effectue deux appels payants éventuels au fournisseur, limités à 24 tokens de sortie chacun. Omettre `--inference` pour vérifier les API de gestion et le catalogue sans ces appels.

| Contrôle | Observation |
| --- | --- |
| Modèles découverts | 25 ; accès rattachés aux UUID des clés natives actives |
| Sauvegarde et concurrence | GET/PUT workspace, conflit de révision 409 |
| Composition par clé | Groupe partagé, ajouts directs, exclusions locales, propagation et isolation |
| Noms exposés | Formats courts et préfixés ; comparaison exacte de la réponse `/v1/models` |
| Gestion des clés | Création native, renommage, désactivation et réactivation |
| Conversation réelle | HTTP 200 et tableau `choices` présent pour `gpt-6-luna` puis `CLI PROXY/gpt-6-luna` |
| Confidentialité | Pas de secret dans le workspace ; refus de l'origine croisée et du catalogue d'inférence sans clé |
| Nettoyage | Clés du script révoquées et configuration restaurée |

Les deux conversations prouvent que ces noms sont utilisables sur cet accès. Elles ne qualifient ni toutes les capacités du modèle, ni les 24 autres modèles.

Le premier [`workspace-smoke.json`](workspace-smoke.json) échoue pendant le rafraîchissement : les objets natifs de clés exposent un `id` numérique et un `key_id` UUID. Le pont utilisait le mauvais champ ; la correction et son test ont précédé les 39 contrôles réussis.

## Contrôle visuel ciblé

- Import de `gpt-6-luna` depuis la découverte ; choix explicite Chat et Text, sauvegarde puis rechargement confirmant la persistance. Créateur et autres capacités inconnus restent inconnus.
- Création et publication du groupe temporaire `UI verification` depuis l'interface.
- Ouverture d'une clé native de vérification, comparaison des deux noms attendus avec les deux noms effectivement retournés, puis clic **Read again** donnant **Readback verified**.
- Correction du débordement de l'en-tête des clés : à 320 px, largeur de document 320 px, aucun élément débordant détecté. Vérification desktop à 1280 px.
- Clic du lien **Models → Model Registry** depuis la sidebar native : l'UI se charge sur `/bifrost-registry/`. Le lien HTML préserve la barre finale et évite le routeur SPA natif.
- Clé et groupe temporaires du contrôle navigateur supprimés après vérification de leurs identifiants et libellés. Le modèle réel `gpt-6-luna` est conservé dans le catalogue ; les 25 modèles découverts et la clé du fournisseur sont conservés.

Ce contrôle cible les parcours modifiés. Il ne remplace pas la validation UX finale de Sofian sur tous les écrans.

### Correction de visibilité du catalogue — #4

La galerie affichait seulement les modèles enregistrés, laissant les 24 autres derrière « Add model ». Elle présente maintenant l'union dédupliquée des modèles découverts et enregistrés : **25 modèles visibles, 1 enregistré, 24 à configurer**. Les informations éditées de `gpt-6-luna` sont conservées. La recherche de `claude-sonnet-4-6` et son bouton **Review & add** ouvrent la fiche préremplie existante ; aucune configuration n'a été enregistrée pendant ce contrôle. Les états sont présents en cartes et tableau. À 320 px, les 25 cartes restent accessibles et la largeur du document est de 320 px. La taille normale et la vue cartes ont été rétablies. `npm run check`, `npm run build` et le test de fusion/déduplication passent. Seuls les fichiers frontend compilés ont été remplacés sur le pilote local.

## Limites conservées

- Laboratoire visible comme **Planned** ; aucun harness actif.
- Préférences d'affichage locales au navigateur.
- Clés natives existantes non adoptées automatiquement ; clé sans politique Registry refusée.
- Les ambiguïtés d'alias courts restent bloquées ; aucune répartition entre sources ajoutée.
- Le proxy est une interface d'administration : les API de configuration brute, validation et aperçu restent accessibles sous la chaîne d'authentification native. Le RBAC entreprise n'est pas qualifié par ce pilote local.
- Le patch host est épinglé à un commit Bifrost 2.2.2 précis. Une mise à jour upstream demande une recompilation et les contrôles de compatibilité ; ce pilote n'est pas une preuve de mise à jour transparente.
