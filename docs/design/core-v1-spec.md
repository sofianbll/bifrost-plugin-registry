# Bifrost Registry — spec de cadrage V1

Suivi de la spec : [GitHub #1](https://github.com/sofianbll/bifrost-plugin-registry/issues/1), label `needs-info`. Le ticket porte le suivi ; ce document conserve le cadrage local.

**Statut : spec de cadrage, pas encore `ready-for-agent` tant que les arbitrages de fin de document restent ouverts.** Cette V1 couvre le catalogue, les groupes, les clés virtuelles et la publication vérifiable. Elle décrit le comportement voulu ; le prototype actuel simule encore ses appels et ne prouve pas l'intégration réelle.

## Problem Statement

Sofian doit aujourd'hui assembler des listes de modèles et des permissions de clés virtuelles sans voir clairement les accès par fournisseur, l'effet d'un groupe sur plusieurs clés ni le résultat réellement reçu par une application. Un aperçu calculé à partir d'un brouillon ne permet pas de savoir si Bifrost publie les mêmes IDs pour la clé utilisée par Hermes.

## Solution

Depuis une interface intégrée à Bifrost, Sofian parcourt une galerie de modèles et leurs fiches éditables, distingue les accès par fournisseur, compose des groupes et configure les clés natives Bifrost. Une clé réunit ses groupes hérités et ses ajouts individuels, puis retire ses exclusions locales. Avant publication, l'interface montre le résultat prévu et l'impact sur chaque clé. Après **Publish**, elle sauvegarde la révision puis interroge le vrai `GET /v1/models` avec la clé concernée par le chemin client ; elle compare les IDs reçus aux IDs attendus pour **cette révision publiée**. Hermes et une clé témoin valident le parcours réel sur une version Bifrost épinglée.

## User Stories

1. En tant qu'administrateur, je veux ouvrir le registre dans l'interface Bifrost, pour gérer le catalogue sans changer d'environnement.
2. En tant qu'administrateur, je veux voir les modèles en cartes ou en tableau, pour choisir la présentation adaptée à mon travail.
3. En tant qu'administrateur, je veux chercher et filtrer par créateur, famille, fournisseur d'accès, usage, modalité et capacité, pour retrouver un modèle ou un accès précis.
4. En tant qu'administrateur, je veux conserver mes sélections quand je change un filtre ou une vue, pour ne pas perdre un choix masqué.
5. En tant qu'administrateur, je veux une fiche par modèle avec ses accès distincts par fournisseur, pour éviter les doublons visuels sans confondre leurs identifiants et capacités.
6. En tant qu'administrateur, je veux voir la source et le statut déclaré, observé ou inconnu d'une capacité, pour ne pas prendre une affirmation pour un test réussi.
7. En tant qu'administrateur, je veux ajouter un modèle découvert ou, au besoin, le saisir manuellement, pour enrichir le catalogue avec un accès explicite.
8. En tant qu'administrateur, je veux créer et modifier un groupe de modèles, pour partager une sélection entre clés.
9. En tant qu'administrateur, je veux afficher un groupe en cartes ou en arbre, pour comprendre la même sélection sous deux formes.
10. En tant qu'administrateur, je veux voir les clés et IDs gagnés ou perdus avant de publier un changement de groupe, pour anticiper son impact.
11. En tant qu'administrateur, je veux créer et gérer une clé virtuelle depuis cette interface via Bifrost, pour éviter une création manuelle séparée.
12. En tant qu'administrateur, je veux rattacher plusieurs groupes à une clé, pour hériter de leurs modèles.
13. En tant qu'administrateur, je veux ajouter un modèle individuellement à une clé, pour faire une exception positive sans modifier les groupes.
14. En tant qu'administrateur, je veux exclure localement un modèle hérité, pour le retirer de cette clé sans changer les autres.
15. En tant qu'administrateur, je veux voir la provenance et la raison d'inclusion ou d'exclusion de chaque entrée, pour comprendre le catalogue prévu.
16. En tant qu'administrateur, je veux choisir `model`, `provider/model` ou `both` pour une clé, pour exposer les noms compatibles avec son client.
17. En tant qu'administrateur, je veux voir les collisions de noms, références invalides et contraintes natives avant publication, pour corriger un brouillon non publiable.
18. En tant qu'administrateur, je veux comparer l'aperçu du brouillon au dernier état publié, pour comprendre ce qui va changer sans confondre prévision et observation.
19. En tant qu'administrateur, je veux publier une configuration avec détection des conflits de révision, pour éviter d'écraser une modification concurrente.
20. En tant qu'administrateur, je veux que Publish relise `/v1/models` avec la clé concernée puis compare les IDs exacts de la révision publiée, pour vérifier ce que reçoit réellement un client.
21. En tant qu'administrateur, je veux distinguer **Verified**, **Drift detected** et **Not verified**, avec les IDs manquants ou inattendus et le motif d'échec, pour savoir ce qui a été observé et ce qui reste incertain.
22. En tant qu'administrateur, je veux pouvoir relancer une relecture sans republier et voir sa clé, sa révision et sa date, pour diagnostiquer un échec transitoire sans prendre une ancienne preuve pour une preuve actuelle.
23. En tant qu'utilisateur de Hermes, je veux découvrir les modèles permis par ma clé puis utiliser un modèle autorisé, pour confirmer le parcours complet dans mon client réel.
24. En tant qu'administrateur, je veux vérifier avec une clé témoin qu'une exclusion locale reste isolée et qu'un groupe partagé se propage, pour confirmer les règles de sélection.
25. En tant qu'administrateur mobile ou clavier, je veux accéder aux mêmes opérations et états en clair et en sombre, pour pouvoir gérer le registre sans perte de fonction.
26. En tant qu'administrateur, je veux voir la page Laboratoire identifiée comme non fonctionnelle en V1, pour comprendre qu'aucune campagne ni résultat simulé ne certifie mes accès.
27. En tant qu'administrateur, je veux savoir ce qui arrive aux clés Bifrost préexistantes sans politique de registre, pour éviter qu'une intégration globale ne coupe leur accès par surprise.
28. En tant qu'administrateur, je veux éditer une fiche structurée selon les modalités du modèle et distinguer ses sources et inconnues, pour décrire correctement des accès texte, image, audio, vidéo ou embeddings.

## Implementation Decisions

### Décisions de produit confirmées

- La V1 fonctionnelle vise catalogue, groupes et clés. Le laboratoire reste visible, avec ses limites explicites, mais son runner, ses campagnes et ses preuves de capacité sont différés.
- Les clés virtuelles sont créées et gérées via les API natives Bifrost ; le registre enrichit leur sélection. Les droits, limites et règles de routage natives restent applicables.
- Une sélection de clé est l'union de ses groupes et de ses ajouts individuels, diminuée de ses exclusions locales. L'exclusion d'une clé prévaut même si plusieurs groupes apportent le modèle ; elle ne modifie aucune autre clé.
- Le format des noms est choisi par clé parmi `model`, `provider/model` et `both`. Les alias et le routage Bifrost restent compréhensibles ; afficher plusieurs accès ne promet pas une répartition automatique entre eux.
- **Publish** sauvegarde la configuration, relit réellement `GET /v1/models` avec la clé concernée, puis compare les ensembles d'IDs exacts, indépendamment de leur ordre. La base de comparaison est la révision publiée, distincte du brouillon qui peut déjà évoluer.
- Une sauvegarde confirmée suivie d'une réponse exploitable et identique donne **Published · Verified** ; des IDs différents donnent **Published · Drift detected** avec les manquants et inattendus ; une relecture impossible ou inexploitable donne **Published · Not verified** avec motif et nouvel essai possible. Une sauvegarde échouée, partielle ou en conflit ne confirme pas la publication et conserve le brouillon.
- La dernière observation porte clé, révision et date. Toute modification publiée qui touche cette clé périme sa preuve antérieure. Une relecture échouée conserve l'ancienne réponse comme historique, sans la présenter comme vérification actuelle. Un écart seul n'en détermine pas la cause.
- Hermes est le premier client réel de validation, avec configuration, espace de travail, sessions et clés de test dédiés. Une clé témoin sert à vérifier l'isolation ; aucun deuxième client applicatif n'est requis pour la V1.
- L'interface reprend les composants, ressources, palette et typographie Bifrost. Les parcours restent utilisables sur petit écran, au clavier, en thèmes clair et sombre ; les sélections masquées par filtre restent visibles et modifiables. La visite contextuelle est facultative et relançable.

### Propositions techniques pour rendre la V1 implémentable

- Réutiliser le moteur de compilation et de garde, le stockage à révision et l'API admin existants. Étendre leurs contrats uniquement pour l'identité d'un modèle à plusieurs accès, les ajouts individuels et exclusions locales, et les états de publication/relecture. La galerie regroupe les accès visuellement sans fusionner leurs identifiants ni leurs restrictions.
- Conserver une identité stable de modèle et une identité d'accès distincte. Résoudre explicitement l'alias exposé par chaque accès et refuser la publication d'une collision ambiguë ; déléguer le routage effectif aux mécanismes Bifrost déjà configurés. Cette correspondance doit être arrêtée avant tout changement de schéma.
- Garder une publication déterministe par révision et clé : calculer les IDs attendus à partir de la configuration effectivement sauvegardée, puis interroger le point d'entrée client avec cette même clé. Les doublons éventuels dans la réponse doivent être signalés comme réponse inexploitable ou anomalie distincte, sans masquer un écart par conversion silencieuse en ensemble.
- Ne pas ajouter de secret persistant au registre. Utiliser un credential fourni par un mécanisme runtime autorisé pour la relecture, limité à la requête et jamais écrit dans la configuration, les preuves, les logs ou le navigateur après usage. Le mécanisme concret et sa disponibilité lors d'une relecture différée restent à arrêter avant implémentation.
- Traiter la création native de clé et l'enregistrement du registre comme deux opérations pouvant réussir séparément : exposer l'état de chacune et une action de réconciliation vérifiable. Ne pas afficher « publié » tant que l'état demandé n'est pas confirmé. La séquence et le traitement d'un échec partiel seront fixés après vérification des API sur le Bifrost cible.
- Prévoir des fiches structurées et éditables selon les modalités d'entrée et de sortie, avec provenance et fraîcheur des données et capacités. Une capacité inconnue reste inconnue ; seule la preuve de qualification par scénario est différée. Le détail du schéma et des sources recevables doit être fixé avant les tickets correspondants.
- Épingler une version Bifrost et la version Hermes de validation ; vérifier les API de gestion, le chemin client et le chargement du plugin sur ce couple avant de promettre une compatibilité plus large. Prévoir un contrôle de retour arrière fondé sur la configuration sauvegardée, sous réserve de l'essai réel.
- Faire une première tranche bloquante sur une instance isolée : deux clés virtuelles aux listes différentes, noms exposés, modèles cachés, identité de clé, droits natifs et éventuels caches. Brancher l'interface globale seulement après constat du comportement réel. Le hook existant projette la réponse native sur les routes effectivement reçues ; il ne crée pas de route absente.

### Arbitrages restant à trancher avant `ready-for-agent`

1. **Identité modèle et accès** : règle exacte de regroupement des entrées actuelles, identité des variantes, alias courts en collision et comportement pour une capacité exigée par le client.
2. **Credential de relecture** : origine, durée de vie, portée et disponibilité du secret de clé au moment de Publish et lors d'un nouvel essai ; aucun secret supplémentaire ne doit être persisté dans le registre.
3. **Administration native** : opérations V1 au-delà de créer, lire et modifier une clé ; rotation, révocation, budgets et limites, routage, modifications faites hors registre, et réconciliation après succès partiel. Ces opérations sont des propositions à valider, pas des décisions déjà prises.
4. **Environnement et compatibilité** : instance de test, versions exactes de Bifrost et Hermes, méthode de retour arrière et comportement lors d'une évolution de schéma. Aucune migration sans perte ni compatibilité universelle n'est présumée.
5. **Essais réels** : accès modèles/fournisseurs retenus, plafond de dépense et autorisation des appels d'inférence. Les vérifications d'IDs peuvent être séparées des appels payants.
6. **Livraison** : langue finale de l'interface et numérotation des versions. Les documents sont en français ; le prototype UI est actuellement en anglais. Aucun de ces états ne fixe la langue du produit livré.
7. **Adoption des clés existantes** : conduite pour les clés natives sans politique de registre et les endpoints hors périmètre. Le garde actuel refuse une clé non liée à une politique ; une coexistence sûre doit être définie et testée, sans ouvrir implicitement tous les accès.
8. **Préférences** : confirmer si les valeurs par défaut, surcharges par vue, informations de carte et logos doivent être persistés dès la V1 dans une configuration versionnée du plugin, ou seulement après le premier parcours fonctionnel. Le prototype ne les conserve que localement.

## Testing Decisions

- Tester les comportements observables à la frontière la plus haute disponible : requêtes HTTP avec une vraie clé virtuelle vers un **Bifrost épinglé**, puis découverte et appels convenus dans Hermes. L'aperçu, un mock et les fixtures du laboratoire ne sont pas des preuves de publication ni de capacité fournisseur.
- Première validation bloquante obtenue sur Bifrost **2.2.2** isolé : `GET /v1/models` avec deux clés distinctes, modèles cachés, noms, identité transmise au hook, intersection avec les droits natifs et lecture alternée après modification. Une troisième clé native sans politique est refusée. Voir la [preuve de 42 contrôles](../../reports/native-v2.2.2/README.md). Le traitement produit des clés non configurées reste à choisir avant tout branchement global.
- Réutiliser les tests du moteur pour l'union des groupes, les ajouts, la priorité des exclusions, les trois formats de noms, les collisions et les garde-fous de requête. Réutiliser les tests de l'admin pour la validation, la révision, les conflits, les échecs partiels et les états Publish/relecture. Un cas représentatif doit couvrir deux clés, un groupe partagé, un ajout, une exclusion, puis un changement de groupe.
- Vérifier que les IDs reçus sont comparés à ceux de la révision enregistrée, même si le brouillon change pendant ou après la relecture. Tester séparément différence d'IDs, réponse invalide et échec réseau/authentification ; seul le premier est un **drift** confirmé.
- Contrôler le parcours UI à largeur mobile et desktop, clavier, clair/sombre : filtres et sélection masquée, impact de groupe, édition, erreur, réessai et distinction visible entre brouillon, publié et dernière preuve. Un contrôle visuel ne remplace pas les tests HTTP.
- Essai de bout en bout : créer la clé Hermes et la clé témoin, publier les formats retenus, relire `/v1/models`, rafraîchir la découverte dans Hermes, vérifier un appel autorisé et le refus d'un modèle exclu ; puis changer le groupe et constater que l'exclusion locale persiste. Conversation, streaming et outil sont exécutés seulement pour les accès et coûts approuvés ; chaque résultat dit exactement ce qu'il prouve.
- Les suites existantes du moteur et de l'admin constituent la base de régression. Les anciens rapports de build et le serveur de démonstration Newman ne remplacent pas un essai sur le Bifrost cible.

## Out of Scope

- Exécution du laboratoire, branchement Newman à un runner, campagnes de qualification, preuves de capacité et certification fournisseur ; la page visible explique ce report.
- Import/export universel de fiches, favoris et campagnes planifiées. La persistance des préférences UI dans la configuration du plugin reste à arbitrer pour cette V1.
- Clients autres que Hermes pour la preuve V1 ; découverte réelle multi-client et conformité générale aux capacités des fournisseurs.
- Promesse de coût nul, migration automatique sans perte ou compatibilité future avec toutes les versions de Bifrost.
- Déploiement en production, secrets fournisseurs et changement autonome de quotas ou budgets sans arbitrage explicite.

## Further Notes

Le prototype React est une référence d’expérience. Le filtrage HTTP par clé est désormais prouvé sur un **Bifrost 2.2.2 isolé**, avec fournisseur local contrôlé et aucune inférence. Le test a révélé puis vérifié la correction du passage d’identité entre le contexte fournisseur et le post-hook HTTP. La projection conserve uniquement les routes de la réponse native avec une identité Governance confirmée. Cette preuve ne branche pas encore l’UI, la gestion des VK par API Bifrost ou Hermes. La version actuelle du moteur, du store et de l’admin est décrite dans [STATUS](../../STATUS.md) ; le vocabulaire est dans [CONTEXT](../../CONTEXT.md), les décisions de produit et limites dans [product-direction](product-direction.md). Après résolution des arbitrages, les tickets pourront porter des dépendances et preuves de fin distinctes. Cette spec est un cadrage à finaliser, pas une autorisation de déploiement.

Documentation upstream consultée pour la distinction avec les droits natifs : [Virtual Keys — Listing models with a virtual key](https://docs.getbifrost.ai/features/governance/virtual-keys#listing-models-with-a-virtual-key). Cette documentation courante ne remplace pas la preuve sur la version épinglée.
