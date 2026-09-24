# Bifrost Registry — spécification de cadrage V1

Suivi : [GitHub #1](https://github.com/sofianbll/bifrost-plugin-registry/issues/1), label `needs-info`.

**Statut : non `ready-for-agent`.** Les comportements ci-dessous guident la V1. L'installation par URL d'un plugin `.so` dans un Bifrost stock et plusieurs choix d'administration restent à prouver ou à décider. Les résultats du pilote local 2.2.2 ne valident ni une installation stock ni la production.

**Recherche du 24 septembre :** l'image officielle 2.2.2 Linux ARM64 testée télécharge le plugin puis refuse son chargement (`Dynamic loading not supported`). Le source épinglé ne propose pas non plus de contrat d'extension pour monter l'UI et sa navigation. **Décision de Sofian : conserver la livraison par URL du plugin seul et résoudre les dépendances côté Bifrost avant la sortie.** La version officielle compatible reste à identifier après intégration et publication de ces évolutions. [Preuve isolée](../../reports/stock-v2.2.2-plugin-install/README.md) · [Source Bifrost](stock-plugin-install-research.md) · [Coexistence des clés](native-key-coexistence-research.md).

## Problem Statement

Sofian veut un catalogue fiable pour composer les accès des clés virtuelles Bifrost. Les informations sont dispersées entre modèles découverts, prix, paramètres, métadonnées externes et anciennes données V1. Une fiche incomplète ou contradictoire rend la sélection difficile ; un aperçu ne dit pas à lui seul ce que recevra Hermes. La livraison doit aussi s'installer à partir de l'URL du seul plugin `.so` sur Bifrost stock, sans patch hôte ni actifs séparés. Le pilote actuel ne satisfait pas encore cette condition.

## Solution

Un **catalogue central** persistant fait autorité pour les fiches et la composition des groupes. Il rapproche les sources disponibles, conserve l'origine et la date de chaque valeur effective, et protège les corrections de métadonnée lors des synchronisations. La galerie montre par défaut les accès modèles configurés dans Bifrost ; les modèles de référence sans accès configuré restent consultables. Une fiche regroupe les accès d'un même modèle sans effacer leurs identifiants exacts, prix, limites ni capacités propres au fournisseur d'accès.

Depuis l'interface native Bifrost, Sofian compose des groupes et des sélections de clés, voit l'effet d'un brouillon, publie une révision et relit le vrai `GET /v1/models` avec la clé concernée. Les permissions et secrets natifs restent gérés par Bifrost. La V1 est livrable seulement après une installation propre depuis l'URL du plugin sur une version stock compatible, puis une vérification du parcours UI, API et Hermes.

## User Stories

1. En tant qu'administrateur, je veux installer le plugin depuis l'URL d'un `.so` dans Bifrost stock, pour démarrer sans modifier le binaire hôte ni déployer des actifs séparés.
2. En tant qu'administrateur, je veux retrouver Registry dans la navigation Bifrost et ses styles natifs, pour gérer mes modèles dans une interface cohérente.
3. En tant qu'administrateur, je veux retrouver mon catalogue et mes groupes après un redémarrage ou une mise à jour compatible, pour conserver mon travail.
4. En tant qu'administrateur, je veux voir d'abord les modèles et accès configurés dans Bifrost, pour travailler sur ceux que mes clés peuvent réellement utiliser.
5. En tant qu'administrateur, je veux consulter séparément le catalogue de référence complet, pour repérer des modèles à configurer.
6. En tant qu'administrateur, je veux voir les modèles découverts non enregistrés avec un état explicite, pour ne pas les confondre avec les accès prêts à publier.
7. En tant qu'administrateur, je veux une fiche par modèle de référence avec ses accès fournisseurs distincts, pour éviter les doublons visuels sans fusionner leurs identifiants.
8. En tant qu'administrateur, je veux voir l'identifiant exact de chaque accès, son fournisseur, son état configuré et son éventuel alias, pour prévoir ce qu'une clé pourra exposer.
9. En tant qu'administrateur, je veux voir les prix, limites, paramètres, usages, modalités et capacités propres à chaque accès quand ils sont connus, pour choisir en connaissance de cause.
10. En tant qu'administrateur, je veux distinguer valeur déclarée, valeur observée et inconnue, pour ne pas prendre une métadonnée pour une preuve de fonctionnement.
11. En tant qu'administrateur, je veux voir la source et la date de chaque valeur effective, pour juger sa fraîcheur.
12. En tant qu'administrateur, je veux corriger une valeur et la conserver lors des synchronisations, pour ne pas perdre une décision manuelle.
13. En tant qu'administrateur, je veux rétablir la valeur automatique d'un champ corrigé, pour reprendre les mises à jour de sa source.
14. En tant qu'administrateur, je veux voir les rapprochements absents, ambigus ou contradictoires, pour les résoudre avant qu'ils ne changent une fiche.
15. En tant qu'administrateur, je veux que la disparition temporaire d'une source n'efface pas un accès actif, pour préserver les clés publiées.
16. En tant qu'administrateur, je veux voir quand une source externe est indisponible et depuis quand ses données datent, pour utiliser le dernier état valide sans croire qu'il est actuel.
17. En tant qu'administrateur, je veux ajouter manuellement une fiche ou un accès explicite, pour documenter un cas absent des sources automatiques.
18. En tant qu'administrateur, je veux modifier une fiche par l'UI, l'API ou un import groupé avec les mêmes validations et conflits de révision, pour éviter trois règles d'écriture incompatibles.
19. En tant qu'administrateur, je veux exporter et importer un instantané JSON structuré du Registry, pour sauvegarder et déplacer mes données sans perdre les relations et provenances.
20. En tant qu'administrateur, je veux exporter une table CSV aplatie, pour analyser le catalogue dans un tableur.
21. En tant qu'administrateur, je veux prévisualiser les écarts et sauvegarder l'état avant d'importer mes anciennes données V1, pour migrer de façon contrôlée et répétable.
22. En tant qu'administrateur, je veux voir le catalogue en cartes ou en tableau et ajuster les informations affichées, pour adapter la densité à ma tâche.
23. En tant qu'administrateur, je veux rechercher par nom et identifiant d'accès puis filtrer par créateur, famille, fournisseur, usage, modalité et capacité, pour trouver la bonne cible.
24. En tant qu'administrateur, je veux choisir créateur, famille et modalités dans des listes avec suggestions, pour saisir des valeurs cohérentes sans être bloqué par un cas nouveau.
25. En tant qu'administrateur, je veux conserver les sélections masquées lorsque je filtre ou change de vue, pour ne pas modifier mon brouillon par accident.
26. En tant qu'administrateur, je veux que « Tout sélectionner » agisse sur tous les résultats du filtre courant et laisse mes choix hors filtre intacts, avec des compteurs explicites, pour modifier un sous-ensemble sans perte.
27. En tant qu'administrateur, je veux des préférences de grille et de tableau conservées, avec valeurs par défaut et exceptions par vue, pour retrouver une présentation utile.
28. En tant qu'administrateur, je veux créer et modifier un groupe partagé depuis la galerie, pour réutiliser une sélection entre plusieurs clés.
29. En tant qu'administrateur, je veux voir un groupe en cartes ou dans un arbre de sélection, pour comprendre le même brouillon sous deux formes.
30. En tant qu'administrateur, je veux voir quelles clés et quels IDs gagnent ou perdent un accès après modification d'un groupe, pour anticiper sa publication.
31. En tant qu'administrateur, je veux créer et gérer une clé virtuelle avec les API natives Bifrost, pour éviter une opération manuelle séparée.
32. En tant qu'administrateur, je veux rattacher plusieurs groupes et des ajouts individuels à une clé, pour construire son catalogue.
33. En tant qu'administrateur, je veux exclure localement un modèle hérité, pour le retirer de cette clé sans toucher aux autres.
34. En tant qu'administrateur, je veux choisir `model`, `provider/model` ou `both` pour chaque clé, pour servir les noms attendus par son client.
35. En tant qu'administrateur, je veux voir la provenance et la raison d'inclusion ou d'exclusion de chaque accès, pour comprendre le catalogue prévu.
36. En tant qu'administrateur, je veux voir les collisions, références invalides et restrictions natives avant publication, pour corriger un brouillon non publiable.
37. En tant qu'administrateur, je veux comparer le brouillon au dernier catalogue publié, pour voir le changement prévu sans le confondre avec une observation.
38. En tant qu'administrateur, je veux publier sans écraser une révision concurrente, pour protéger les changements d'un autre opérateur.
39. En tant qu'administrateur, je veux relire `/v1/models` avec la clé concernée après Publish, pour comparer les IDs reçus à ceux attendus pour cette révision.
40. En tant qu'administrateur, je veux voir **Verified**, **Drift detected** ou **Not verified**, les IDs manquants ou inattendus et la cause d'un échec de relecture, pour savoir ce qui a été prouvé.
41. En tant qu'administrateur, je veux relancer une relecture et retrouver sa clé, sa révision et sa date, pour distinguer une preuve actuelle de son historique.
42. En tant qu'administrateur, je veux que mes clés natives préexistantes continuent de fonctionner avant adoption explicite du Registry, pour installer sans interruption imprévue.
43. En tant qu'utilisateur de Hermes, je veux découvrir les modèles autorisés avec ma clé et appeler un modèle permis, pour vérifier le parcours client réel.
44. En tant qu'administrateur, je veux contrôler avec une clé témoin l'isolation des exclusions et la propagation des groupes, pour valider les règles de composition.
45. En tant qu'administrateur, je veux utiliser les mêmes fonctions sur mobile, au clavier et en thèmes clair ou sombre, pour administrer sans perte d'accès.
46. En tant qu'administrateur, je veux une visite contextuelle courte, facultative et relançable, pour apprendre sans quitter les vrais contrôles.
47. En tant qu'administrateur, je veux voir le Laboratoire marqué **Planned**, pour ne pas prendre ses écrans ou rapports historiques pour une qualification active.

## Implementation Decisions

### Contrats confirmés

- La livraison conserve une seule URL de plugin sur une distribution officielle Bifrost compatible. Le chargement dynamique et l'intégration native de l'UI, de ses routes et de sa navigation sont des prérequis de sortie côté Bifrost. Leur préparation et leurs preuves locales peuvent avancer ; leur adoption et leur publication officielles restent une dépendance externe. Le pilote modifié reste une preuve de développement.
- Le catalogue central est la référence persistante pour les fiches et la composition. Il ne devient ni un magasin concurrent de credentials, ni une source de permissions supérieure aux règles natives Bifrost. Un modèle de référence seul ne crée aucun accès, aucune clé et aucune autorisation.
- Les sources à rapprocher sont les prix et fiches de paramètres Bifrost, l'état d'accès configuré lu dans Bifrost, les métadonnées Models.dev et les données V1 antérieures de Sofian. Chaque champ possède une seule valeur effective, sa source et sa date ; une correction utilisateur prévaut jusqu'au retour explicite en mode automatique.
- Le modèle de référence et l'accès modèle ont des identités distinctes. Prix, limites et capacités peuvent varier selon le fournisseur d'accès. Les noms publiés selon le format de la clé conservent une correspondance explicite avec les identifiants exacts des accès ; la relecture compare les noms publiés attendus. Un nom proche ne suffit pas à établir une correspondance de modèle ni à fusionner deux variantes.
- Une métadonnée facultative manquante n'empêche pas un accès valide découvert de rejoindre un groupe ou une clé. Une correspondance ambiguë, un conflit ou un accès non configuré suit un état explicite et ne reçoit pas de permission implicite.
- L'union des groupes et des ajouts individuels, diminuée des exclusions locales, définit la sélection d'une clé. L'exclusion locale l'emporte sur tous les groupes et ne modifie aucune autre clé. Les droits, limites et règles de routage natives restent applicables.
- Les trois formats de noms sont `model`, `provider/model` et `both`. Une collision non résolue bloque la publication concernée ; afficher plusieurs fournisseurs ne crée pas de répartition automatique.
- Publish sauvegarde une révision puis compare les IDs exacts renvoyés par `GET /v1/models` avec la clé concernée aux IDs de cette révision, indépendamment de l'ordre. Une réponse identique donne **Published · Verified** ; des IDs différents donnent **Published · Drift detected** ; une relecture impossible ou inexploitable donne **Published · Not verified**. Un échec de sauvegarde ne confirme pas la publication.
- Une preuve de relecture est liée à la clé, la révision et la date. Une nouvelle publication qui touche cette clé la périme ; l'ancienne réponse peut rester visible comme historique. **Verified** ne prouve ni l'inférence, ni le routage, ni les capacités du fournisseur.
- Une opération native Bifrost et une sauvegarde Registry peuvent réussir séparément. L'interface expose un succès partiel, conserve le brouillon et permet une réconciliation vérifiable ; elle ne présente pas l'ensemble comme publié après un succès unique.
- L'interface utilise les composants, styles, typographie et API natives Bifrost dans la mesure où leurs contrats sont vérifiés. Le Laboratoire reste visible avec l'état **Planned** ; son runner n'est pas requis pour cette V1.

### Approche proposée à confirmer sur la cible

- Utiliser une même surface d'écriture du Registry pour UI, API et lots : validation, contrôle de révision, aperçu des changements et écriture persistante. Les lectures des sources sont rapprochées avant d'être proposées comme valeurs effectives ; aucune synchronisation ne supprime silencieusement un accès actif ni ne révoque une clé.
- Lorsque la source externe est indisponible, garder le dernier instantané valide et afficher sa fraîcheur. Les correspondances non trouvées, ambiguës ou contradictoires demandent une décision explicite ; une correction utilisateur n'est pas écrasée par un rafraîchissement.
- L'import/export canonique est un instantané JSON structuré et versionné du Registry. Le CSV exporte seulement une vue tabulaire aplatie ; il ne garantit pas un aller-retour complet. L'import ancien passe par aperçu, diff, vérification d'idempotence et sauvegarde avant écriture.
- Réutiliser les API natives pour les accès et les clés lorsqu'elles couvrent le besoin. L'API Bifrost `/api/models/catalog` ne permet aujourd'hui d'écrire que `additional_attributes` sur des lignes de prix existantes : elle ne constitue pas un CRUD générique de fiches. Toute écriture de prix, paramètres ou métadonnées dans Bifrost attend une preuve de correspondance champ par champ sur la version cible.
- Les anciennes données V1 reposent notamment sur un synchroniseur de prix et paramètres et des correspondances locales de fournisseurs. Réutiliser les règles et données valides après audit ; ne pas imposer son script Python ni ses identifiants personnels à une installation générale. La synchronisation des clés natives relève d'un ancien outil distinct.
- Les clés natives non gérées devraient conserver leur comportement Bifrost par un passage direct jusqu'à adoption explicite. C'est une **proposition à confirmer et tester** : le garde actuel renvoie 403 pour une clé sans politique Registry. Aucun passage direct ne peut élargir les permissions natives.
- Le pilote actuel couple un patch hôte, des actifs React externes et un plugin reconstruit pour l'ABI Go de Bifrost 2.2.2. L'interface native sait déjà ajouter une URL et le chargeur la télécharge : le test stock ARM64 échoue ensuite au chargement dynamique. Le contrat plugin ne permet pas d'enregistrer les routes et la navigation nécessaires à notre UI. La solution retenue exige un artefact officiel compatible et une extension native Bifrost pour servir l'interface embarquée dans le plugin sous l'authentification native.

### Décisions et faits bloquants avant `ready-for-agent`

1. **Prérequis Bifrost de la distribution retenue** : obtenir une version officielle permettant le chargement dynamique et l'extension native de l'UI ; le choix « plugin seul » est tranché. Le téléchargement par URL et le refus dynamique sur l'image ARM64 sont prouvés. L'installation par URL seule, la compatibilité ABI, le redémarrage, la mise à jour et le retour arrière devront être validés sur l'artefact officiel retenu ; aucun autre build ou architecture n'est présumé compatible. Une preuve locale ne lève pas la dépendance de publication côté Bifrost.
2. **Identité et rapprochement** : fixer les règles qui relient les identifiants Bifrost, Models.dev et l'ancien catalogue, y compris variantes, alias courts ambigus, accès personnalisés et conflits de sources.
3. **Écriture native** : décider les champs que Bifrost peut réellement recevoir sur la version cible, ceux que Registry conserve seul et la conduite des modifications natives faites hors Registry.
4. **Clés préexistantes** : décider et vérifier la coexistence, l'adoption et la réconciliation des clés sans politique Registry. Le 403 actuel n'est pas une expérience acceptable par défaut pour une installation sur un serveur existant.
5. **Gestion et relecture des clés** : préciser les opérations natives V1 au-delà du parcours déjà implémenté ; auditer le mécanisme existant de relecture et ses échecs partiels sous l'authentification du Bifrost standard. La relecture fonctionne dans le pilote local ; sa conformité à l'installation cible reste à prouver, en conservant les secrets hors du catalogue et des rapports.
6. **Migration et stockage** : valider schéma, emplacement persistant, sauvegarde, import des anciennes données et retour arrière après changement de version.
7. **Périmètre de livraison** : fixer les langues UI et opérations de gestion native retenues ; autoriser séparément les appels d'inférence réels et leur plafond de coût pour Hermes.

## Testing Decisions

- Le test principal porte sur le comportement externe au plus haut niveau possible : installation stock, UI/API, sauvegarde persistante, puis `/v1/models` et appel Hermes avec une vraie clé. Les tests unitaires du moteur et de l'administration existants servent de régression ; les fixtures du Laboratoire ne sont pas des preuves fournisseur.
- Tester un catalogue alimenté par chaque source, puis l'indisponibilité d'une source, sa reprise, un conflit d'identité, une correction utilisateur protégée et le retour automatique. Vérifier qu'une fiche de référence sans accès configuré n'entre pas dans une clé et qu'une métadonnée absente n'empêche pas un accès valide.
- Exercer UI, API et import groupé sur le même type de modification : validation équivalente, conflit de révision identique et écriture atomique du catalogue. Vérifier séparément qu'un succès partiel entre Bifrost et Registry reste explicite et réconciliable. Vérifier l'aller-retour JSON, le caractère aplati du CSV et la répétition sans doublons de la migration V1.
- Exercer deux clés, un groupe partagé, un ajout individuel, une exclusion locale, les trois formats de noms et une collision. Comparer la révision sauvegardée à la vraie réponse HTTP ; distinguer drift, réponse invalide et erreur réseau/authentification. Signaler les IDs dupliqués comme anomalie au lieu de les masquer lors de la comparaison. Vérifier que l'évolution ultérieure du brouillon ne requalifie pas une ancienne relecture.
- Installer depuis la seule URL du plugin sur la version officielle Bifrost qui aura intégré les prérequis, redémarrer, mettre à jour et revenir en arrière avec sauvegarde. Vérifier l'état initial des clés natives avant adoption et après retrait du plugin. L'image 2.2.2 ARM64 testée reste une référence d'échec ; chaque version et architecture annoncée compatible doit avoir sa propre preuve.
- Vérifier les parcours visuels et fonctionnels sur desktop et mobile, au clavier, en clair et sombre : galerie, filtres, sélection globale limitée aux résultats filtrés, choix masqués préservés, fiche, groupes, clés, publication, états d'erreur, préférences et aide facultative. La revue ciblée du pilote local ne couvre pas encore tous ces écrans.
- Faire la découverte réelle dans Hermes avec une clé dédiée, un appel autorisé et un refus attendu ; contrôler aussi la clé témoin après changement de groupe. Le pilote local a déjà 44/44 contrôles sur sa paire finale et deux appels `chat/completions` réels, mais aucun parcours Hermes de bout en bout ; ces preuves ne qualifient ni le paquet stock, ni la production.

## Out of Scope

- Runner du Laboratoire, campagnes actives, qualification exhaustive de capacités et certification de fournisseurs. Une métadonnée déclarée ne devient pas une capacité vérifiée.
- Association assistée par IA dans le parcours V1, embeddings, base vectorielle et dépendance à un modèle ou runner pour synchroniser le catalogue.
- Garantie d'import/export universel pour tous les outils et formats externes ; le CSV ne représente pas l'instantané canonique.
- Répartition automatique entre plusieurs fournisseurs, remplacement des règles natives de permissions, stockage des credentials dans Registry et compatibilité garantie avec toutes les futures versions de Bifrost.
- Déploiement de production et migration automatique sans contrôle des données ou du retour arrière.

## Further Notes

Une **option ultérieure** d'association assistée par IA peut présélectionner environ 30 candidats par nom et mots clés, puis demander au modèle choisi via Bifrost de proposer un candidat ou « aucun ». Elle présenterait les changements champ par champ avant acceptation, préserverait les corrections utilisateur et mémoriserait les correspondances acceptées. La configuration du fournisseur IA reste à décider. Ses propositions ne vérifieraient aucune capacité. Cette note ne constitue pas un critère d'acceptation V1.

Le pilote local 2.2.2 sert de preuve partielle : les 25 modèles découverts du fournisseur CLI PROXY sont visibles, le workspace et les clés gérées fonctionnent, et l'UI React est intégrée avec patch hôte. Le stock Bifrost, la coexistence des clés non gérées, tous les écrans, Hermes et la production restent à valider. Voir [STATUS](../../STATUS.md) pour les preuves datées, [CONTEXT](../../CONTEXT.md) pour le vocabulaire et [product-direction](product-direction.md) pour l'historique des choix produit. Cette spec demeure un cadrage `needs-info`, pas une autorisation de déploiement.

Sources de cadrage : [catalogue Bifrost](https://docs.getbifrost.ai/architecture/framework/model-catalog), [Models.dev](https://models.dev/) et sa [documentation source](https://github.com/anomalyco/models.dev/blob/dev/README.md), [contrat ABI des plugins Go](https://pkg.go.dev/plugin), [version Bifrost épinglée](https://github.com/maximhq/bifrost/releases/tag/transports/v2.2.2). Les anciennes données personnelles proviennent notamment du synchroniseur local `datasheet-sync.py` du stack Pulsar ; ce n'est pas une dépendance à installer. Ces sources courantes ne prouvent pas à elles seules le comportement de la version stock cible.
