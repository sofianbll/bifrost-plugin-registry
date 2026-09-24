# Cadrage du produit — décisions et historique

Source : besoins explicités par Sofian dans cette session. [État du code](../../STATUS.md) · [Vocabulaire](../../CONTEXT.md) · [Recherche Bifrost sourcée](bifrost-integration-research.md).

## Cadrage actif — 24 septembre 2026

La [spec V1](core-v1-spec.md) fait référence pour le périmètre courant, les comportements attendus, les preuves de livraison et les décisions encore ouvertes. Sofian a validé sa préparation : catalogue central alimenté par Bifrost, Models.dev et les données utiles de sa première V1 ; finition des parcours catalogue, groupes et clés ; installation visée par URL de plugin sur Bifrost standard. L'assistance IA de correspondance reste optionnelle et ultérieure ; le laboratoire demeure différé.

L'installation demandée n'est pas encore obtenue : le pilote local utilise un gateway modifié, une UI React séparée et un plugin compilé avec un hôte compatible. La [recherche et preuve isolée](../../reports/stock-v2.2.2-plugin-install/README.md) confirme que l'image officielle 2.2.2 ARM64 télécharge le `.so` mais refuse son chargement dynamique, et que l'extension UI requiert une évolution de l'hôte. **Sofian maintient la livraison par URL du plugin seul : les dépendances côté Bifrost doivent être résolues avant la sortie.** La version officielle compatible reste à déterminer ; les preuves locales ne suffisent pas à lever ce prérequis. La mise à jour du cadrage n'autorise pas un déploiement en production.

## Historique du cadrage et des retours du 23 septembre

Les sections suivantes conservent le raisonnement et les propositions antérieurs. Leurs tableaux d'écarts et étapes à réaliser décrivent cet état historique : consulter la spec active et `STATUS.md` pour distinguer l'implémentation locale actuelle des travaux restants.

## Résultat recherché

Depuis une galerie lisible, composer visuellement ce qu'une clé virtuelle peut voir et utiliser, prévisualiser le résultat, publier et vérifier le catalogue réellement reçu par son application. Réutiliser des groupes pour éviter de sélectionner chaque modèle dans chaque clé.

## Besoins confirmés

- Une fiche par modèle dans la galerie, avec ses informations et ses accès par fournisseur. Éviter les doublons visuels sans masquer les différences entre accès.
- Ajouter des groupes et des modèles individuels à une clé ; exclure localement un modèle hérité sans modifier les autres clés.
- Créer et gérer les clés depuis cette interface dès la première version, via les API Bifrost (choix explicite de Sofian). Les clés natives restent gérées par Bifrost ; l'interface enrichit leur configuration.
- Une modification publiée d'un groupe se répercute sur les clés qui en héritent. Les exceptions locales restent propres à la clé.
- Choisir par clé les noms `model`, `provider/model` ou les deux.
- Pendant l'édition, voir ce que le brouillon prévoit de publier et les différences avec le catalogue actuel. Après publication, vérifier ce que renvoie réellement l'API avec cette clé.
- Garder les alias et la répartition entre fournisseurs compréhensibles ; préserver le routage Bifrost attendu par les applications.
- Disposer de fiches modèles complètes et éditables, avec les capacités adaptées à leur type et des preuves de fonctionnement.
- Pouvoir tester des modèles ou fournisseurs et identifier les limites du modèle, de l'accès fournisseur ou de Bifrost lorsque les preuves permettent de les distinguer.
- Afficher à la fois la couverture documentée par le Test Harness Bifrost et les résultats réellement observés sur nos accès. Un scénario absent du harness reste « non testé » et ne devient pas « non supporté ».
- Étudier l'import/export de descriptions de modèles dans des formats existants. Le schéma et les outils destinataires restent à identifier ; JSON et TOML seuls ne définissent pas une compatibilité.
- Définir ensemble versions, critères d'acceptation et dépendances avant l'exécution autonome des tickets validés.
- Hermes est le premier client réel de validation, avec une configuration et un espace de travail dédiés aux essais. OpenCode, Codex et Claude ne sont pas nécessaires pour valider ce premier parcours.
- Valider d'abord l'UI et l'UX en manipulant une maquette cliquable, avant de figer la spec, les versions et les tickets d'implémentation. Avancer par parcours courts et retours concrets, adaptés au besoin exprimé par Sofian de voir l'expérience pour la juger.
- Le prototype doit représenter l'application complète et utiliser les composants réels de Bifrost, avec leur provenance vérifiable. L'ancien mockup reste un repère visuel ; une démo de logique avec du CSS approchant n'est pas une réponse acceptée.
- Présenter les modèles dans un dashboard avec galerie et fiches. L'aide prend la forme d'une visite contextuelle courte, facultative et relançable, intégrée aux vrais contrôles de l'interface.

## Écarts déjà établis dans le code

| Besoin | État actuel |
| --- | --- |
| Groupes hérités et format des noms | Présents dans le moteur. |
| Ajouts individuels et exclusions locales par clé | Absents de `Policy` ; `Group.Exclude` concerne le groupe partagé. |
| Aperçu publié / brouillon | L'API de preview compile le brouillon ; elle ne mesure pas le catalogue courant auprès de Bifrost. |
| Fiche de capacités vérifiées | Métadonnées, liste libre de capacités et drapeau déclaratif `verified` ; aucune campagne de qualification par capacité. |
| Une identité modèle avec plusieurs accès | Le modèle du registre est actuellement associé à un fournisseur et un alias. La galerie unifiée exige de préciser la correspondance entre ces entrées. |
| Alias courts et répartition | Plusieurs entrées partageant un alias nécessitent `prefer` ; le nom court seul ne prouve pas une répartition. Des alias passthrough délèguent le routage à Bifrost. |
| Intégration admin par API | L'API du registre existe ; la gestion native de Bifrost n'est pas automatiquement synchronisée par ce panneau. |

Sources locales : `internal/registry/config.go`, `internal/registry/runtime.go`, `internal/admin/server.go`, `internal/admin/web/app.js`.

## Retour UX sur le prototype — 23 septembre

Demandes confirmées après revue du premier prototype React. Le [diagnostic initial](ux-audit-2026-09-23.md) et les [références natives Bifrost](bifrost-ui-patterns.md) accompagnent la révision ; l'expérience révisée reste à valider.

- **Collections** : toujours proposer une vue cartes, avec alternative liste/tableau, taille des cartes et choix des informations secondaires. Conserver des comportements identiques dans les catalogues et les sélecteurs ; les tableaux de comparaison et les réponses JSON gardent leur format approprié.
- **Identités** : distinguer créateur, famille et fournisseur d'accès. Regrouper visuellement par créateur ou fournisseur, avec des logos reconnaissables et un nom lisible. Le vocabulaire canonique est dans `CONTEXT.md`.
- **Recherche** : même recherche de modèles et mêmes filtres contextuels dans le catalogue, l'ajout, les groupes, les clés et le laboratoire. Chercher aussi par identifiant d'accès, afficher les filtres actifs et permettre leur retrait individuel. Séparer modalités, usages et capacités.
- **Ajout** : commencer par un catalogue de modèles découverts et sélectionnables. Garder la saisie manuelle secondaire ; la prise en charge future de modèles personnalisés dans Bifrost ne doit pas encombrer le parcours principal.
- **Préférences** : choisir les valeurs par défaut et les exceptions par vue, les informations de carte et l'identité représentée par son logo. Prévoir la synchronisation future avec la configuration du plugin. Dans le prototype, les préférences restent locales et l'export éventuel est un contrat proposé, pas un fichier reconnu par le plugin actuel.
- **Impact des groupes** : montrer quelles clés gagnent ou perdent quels modèles, et quelles exclusions restent préservées. Une vue arborescente permet de parcourir et modifier les sélections sans changer les règles d'héritage.
- **Laboratoire** : catalogue de scénarios/suites, sélection par plusieurs modèles ou fournisseurs, exclusions explicites, aperçu du lot et résultats détaillés par accès/scénario. S'appuyer sur le harness et les plugins natifs selon leurs capacités réelles ; un contrôle via Mocker conserve son statut simulé.

Clarification suivante de Sofian : remplacer les packs clients et scénarios composés localement par la collection réelle du harness Bifrost. Réduire la surcharge avec « Tous les tests / Personnaliser », une préparation progressive et des détails repliés. Un seul sélecteur de cibles, filtrable par créateur/fournisseur/groupe/tâche, conserve des identifiants d'accès exacts ; décocher un accès l'exclut. Une page de suivi structurée doit montrer prompts, requêtes, réponses et assertions avec progression et activité, adaptée au mobile comme au desktop. Le prototype importe désormais le catalogue officiel et les rapports Newman ; sa lecture animée reste explicitement une relecture de données enregistrées. Le branchement à un runner actif reste à réaliser. Aucun second type de harness n'est ajouté au parcours à cette étape.

Le moteur possède déjà `Creator`, `ModelFamily` et des filtres de groupe sur créateurs/familles/capacités ; le premier prototype ne les représentait pas correctement. Il ne possède pas encore de contrat de préférences d'affichage. L'arbre CEL upstream visualise des règles de routage : l'utiliser comme référence ne doit pas faire confondre une sélection de modèles avec une règle CEL.

Améliorations issues de l'audit à essayer dans cette révision : portée de recherche explicite, conservation de la sélection quand les filtres changent, exclusions et cas non applicables visibles avant une campagne, et retour aux préférences par défaut sans perdre les sélections métier. La mémorisation des recherches, les favoris et les campagnes planifiées restent des pistes à arbitrer, pas des fonctionnalités nécessaires à cette validation.

## Comportement proposé à vérifier par scénarios

La sélection d'une clé est l'union des groupes et ajouts individuels, moins ses exclusions locales. Une exclusion gagne si plusieurs groupes fournissent le même modèle. Les droits et contraintes natives continuent de s'appliquer.

Exemple : deux clés de test, « Hermes » et « Témoin », héritent du groupe « Code » contenant A et B. Hermes ajoute C et exclut B : son catalogue prévu est A+C, celui de Témoin A+B. Après ajout de D au groupe, Hermes obtient A+C+D et Témoin A+B+D. B reste exclu pour Hermes. La clé témoin permet de vérifier l'isolation des changements sans introduire un deuxième client applicatif.

L'interface explique pour chaque entrée sa provenance, son exclusion ou la restriction qui l'empêche d'être publiée. Avant de publier un changement de groupe, elle montre les clés et les catalogues impactés.

## Décision validée — publication vérifiable

Sofian a validé ce parcours le 23 septembre 2026, en référence à la conversation « Vérifier la publication ». Cette validation porte sur le comportement ci-dessous ; l'intégration réelle reste à réaliser.

1. Calculer l'aperçu du brouillon, puis sauvegarder la configuration lors de **Publish**.
2. Relire réellement **`GET /v1/models` avec la clé concernée**, par le chemin utilisé par un client.
3. Comparer les IDs exacts reçus aux IDs attendus pour la révision publiée, sans tenir compte de leur ordre. La V1 compare les IDs ; les comparaisons approfondies de métadonnées sont reportées.

| Résultat | État affiché |
| --- | --- |
| Sauvegarde réussie, relecture valide et IDs identiques | **Published · Verified** |
| Sauvegarde réussie, relecture valide et IDs différents | **Published · Drift detected**, avec modèles manquants et inattendus |
| Sauvegarde réussie, relecture impossible ou réponse inexploitable | **Published · Not verified**, avec motif et possibilité de réessayer |
| Sauvegarde échouée, partielle ou conflit de révision | Publication non confirmée ; erreur explicite, brouillon conservé |

Pendant l'opération, afficher la progression de publication puis de vérification. L'aperçu évolutif du brouillon reste distinct de la dernière relecture réelle, identifiée par clé, révision et date. Modifier à nouveau le brouillon ne rend pas celui-ci vérifié ; une nouvelle publication ou un changement de groupe impactant la clé rend l'ancienne preuve périmée. En cas d'échec de relecture, conserver la dernière réponse en la présentant comme ancienne, jamais comme une vérification actuelle.

Une exclusion locale d'un modèle hérité reste un cas normal, conformément aux règles ci-dessus. Les collisions de noms non résolues et références invalides doivent être signalées avant publication. Un écart de catalogue ne suffit pas à identifier sa cause. **Verified** atteste le catalogue observé pour cette clé à cet instant ; les appels d'inférence, le routage et les capacités nécessitent leurs propres essais Hermes.

Le mécanisme d'accès au secret pour la relecture reste à préciser avant l'implémentation. Le laboratoire reste différé.

## Premier parcours réel : Hermes

Choix confirmé par Sofian. Prévoir un profil/configuration, un espace de travail, des sessions et des clés de test dédiés ; la procédure d'isolation et de découverte des modèles sera vérifiée sur la version Hermes retenue avant exécution. Le choix du client ne fixe pas encore l'environnement Bifrost cible ni le budget d'inférence.

Critères d'acceptation proposés :

1. Créer une clé depuis la nouvelle interface via l'API Bifrost et connecter Hermes avec cette clé.
2. Lui attribuer un groupe, ajouter un modèle individuel et exclure un modèle hérité ; voir leur provenance et le résultat prévu pendant l'édition.
3. Publier, comparer l'aperçu avec `/v1/models`, puis vérifier la liste effectivement proposée par Hermes après son mécanisme de rafraîchissement. Documenter un éventuel cache ou une limite de découverte du client.
4. Vérifier les formats `model`, `provider/model` et `both`, ainsi qu'un appel autorisé et le refus d'un modèle exclu.
5. Vérifier avec la clé témoin qu'une exclusion locale ne change pas les autres clés, puis qu'un changement de groupe partagé se propage en conservant les exceptions locales.
6. Pour les modèles de test convenus, vérifier conversation, streaming et un aller-retour d'outil lorsqu'ils sont attendus. Une réussite dans Hermes ne certifie que le parcours exécuté ; la couverture détaillée des capacités reste au harness Bifrost.

## Versions proposées — à arbitrer ensemble

**Priorité confirmée par Sofian : terminer le catalogue, les groupes et les clés ; mettre le développement fonctionnel du laboratoire de côté.** Sa page reste accessible dans le prototype, avec ses limites de démonstration explicites. L'exécution de campagnes et le branchement à un runner ne bloquent pas la première livraison du parcours Hermes.

| Version candidate | Parcours livré | Preuve de fin |
| --- | --- | --- |
| 0.2 — Catalogue et clés | Création et gestion de clés via les API Bifrost, galerie et fiches, groupes, ajouts/exclusions locales, formats des noms, aperçu/diff, publication et relecture réelle. Sources et inconnues des capacités visibles. | Le parcours Hermes ci-dessus fonctionne de l'UI à l'application ; aucun changement local ne touche la clé témoin. Échecs, conflits, états vides et navigation clavier traités. |
| 0.3 — Qualification | Campagnes ciblées par modèle/fournisseur/capacité, preuves datées, versions testées, limites et échecs expliqués ; export vers les formats retenus. | Un test annoncé réussi a une preuve sémantique reproductible ; un échec réseau, quota ou auth n'est pas présenté comme une capacité absente. |

La compatibilité avec les mises à jour Bifrost doit être vérifiée dès 0.2, puis à chaque version. Ce n'est pas une fonctionnalité reportée à la fin. Un contrôle réel minimal peut entrer en 0.2 ; l'étendue des tests de capacités reste à décider.

Intégrations proposées après lecture des liens de Sofian : harness Postman/Newman comme base de qualification ; Mocker pour la QA et les démonstrations dès qu'un scénario en a besoin ; JSON Parser seulement si un aperçu de JSON en streaming justifie son usage. Réutiliser les composants upstream avec des versions compatibles. Mocker et JSON Parser restent des candidats, pas des fonctionnalités runtime approuvées. Un résultat simulé ou réparé doit être identifié et ne vaut pas preuve d'une capacité native.

## Résultats de la recherche préalable

Les API management et leur OpenAPI ainsi que les suites d'intégration upstream sont des bases existantes à réutiliser. Les sources courantes doivent encore être comparées à la version déployée ; elles ne prouvent pas sa compatibilité. Le plugin Go conserve une dépendance au build du gateway, même si toute l'administration passe par HTTP.

Une preuve de capacité doit identifier le modèle, l'accès fournisseur, l'endpoint, la version Bifrost, le scénario et la date. La seule réponse HTTP 200 ou une réponse simulée ne suffit pas à prouver un comportement d'outils ou de streaming. Sans contrôle fournisseur comparable, une erreur peut rester de cause indéterminée. Aucun format universel couvrant fiches, droits, routage et preuves n'a été établi dans les sources examinées ; un enrichissement depuis les catalogues existants reste possible.

## Décisions ouvertes avant la spec exécutable

1. **Administration native** : création et gestion via API confirmées. Préciser les opérations et champs du premier parcours (rotation, révocation, budgets, limites et routage), la réconciliation des modifications faites dans l'UI Bifrost et le comportement si une sauvegarde native réussit mais celle du registre échoue.
2. **Identité et routage** : comment relier les accès d'un même modèle sans confondre des variantes ? Quand un client exige une capacité, comment éviter une cible qui ne la prend pas en charge ?
3. **Accès à la relecture réelle** : le parcours et ses états sont validés ci-dessus. Reste à préciser comment interroger Bifrost pour la clé sans conserver inutilement son secret ; le registre conserve aujourd'hui une empreinte, pas le jeton.
4. **Fiches complètes** : quelles sources et quels champs selon texte, image, audio, embeddings ou vidéo ? Quelles valeurs sont déclarées, testées, inconnues ou devenues anciennes ?
5. **Qualification** : quels premiers scénarios, quels fournisseurs, quels coûts maximaux, et quelles preuves permettent d'attribuer un échec à Bifrost ? Les mocks valident un comportement simulé, pas un accès fournisseur réel.
6. **Compatibilité** : API Bifrost utilisables, versions soutenues, dépendance du plugin Go, migrations, retour arrière et détection des écarts avant mise à niveau.
7. **Livraison** : numéros et contenu final des versions, langue UI, environnement de validation, périmètre des opérations autonomes et du déploiement.

## Parcours de cadrage

Dernier retour visuel : mieux différencier fond, cartes, sous-sections et zones d'édition ; renforcer les titres et valeurs, atténuer les métadonnées et actions secondaires. Réutiliser exclusivement la palette, Geist et les composants Bifrost. Garder la même hiérarchie en clair/sombre et sur mobile. L'objectif est une lecture moins fatigante, avec une importance visuelle proportionnelle au rôle de chaque élément.

### Chemin restant vers une première version fonctionnelle

1. Valider cette expérience visuelle et figer le contrat modèle → accès ainsi que les ajouts/exclusions propres à chaque clé. Ces comportements sont simulés dans React ; le moteur Go représente encore un fournisseur/alias par entrée et une politique sans `added`/`excluded`.
2. Relier l'interface aux API existantes et compléter la gestion native des clés Bifrost : création et opérations retenues, persistance, conflits et réconciliation si une des sauvegardes échoue. La sauvegarde atomique et les révisions du registre existent déjà.
3. Publier puis relire réellement `/v1/models` avec la clé concernée ; distinguer aperçu, état publié et relecture impossible. Décider comment fournir le secret pour ce contrôle sans le conserver inutilement. Préserver alias et routage natifs ; plusieurs accès visibles ne prouvent pas une répartition automatique.
4. Vérifier le parcours complet avec Hermes et une clé témoin sur une version Bifrost précise, puis documenter les contrôles de compatibilité, migration et retour arrière. Les anciens rapports de build ne remplacent pas cette validation.

Sofian a autorisé la préparation de la [spec V1 de cadrage](core-v1-spec.md). Le premier jalon doit prouver le filtrage réel de `/v1/models` par deux clés sur une instance Bifrost isolée, avant le branchement complet de l'UI. Les décisions confirmées et les arbitrages restants sont distingués dans la spec ; les tickets avec dépendances et preuves de fin suivent la résolution de leurs bloqueurs. Ce cadrage n'autorise pas un déploiement.

Recherche ciblée des primitives existantes → prototype UI/UX → retours et validation de l'expérience par Sofian → décisions techniques restantes → spec et versions → tickets complets avec dépendances et critères d'acceptation → exécution dans le périmètre approuvé.

Prototype disponible pour les retours de Sofian dans [`registry-prototype/`](registry-prototype/README.md) : dashboard/galerie des modèles, fiches, groupes partagés, création et gestion des clés, aperçu/publication et espace de qualification. Il utilise les primitives React, styles, polices et ressources du Bifrost de référence ; les adaptations du shell nécessaires au fonctionnement autonome sont documentées. La simulation porte sur les données et les API. Le rendu proposé reste à valider avec Sofian.

La démo `mockup/hermes-prototype.html` a été rejetée : périmètre réduit à une page de logique, composants maison et parcours pédagogiques permanents ne permettaient pas de valider le visuel final. La nouvelle visite guidée doit accompagner les contrôles avec progression, retour, passage et relance. Les pages restent utilisables librement. Le prototype valide la compréhension et l'usage ; la preuve d'intégration via les API Bifrost reste nécessaire dans les tickets. La présence d'une page Qualification dans le prototype ne tranche pas son périmètre de version.

Chaque ticket doit livrer un comportement observable et préciser sa preuve. Les détails techniques ordinaires sont résolus par l'agent ; les arbitrages produit, changements de périmètre et contraintes de coût encore ouverts reviennent à Sofian. Les tickets GitHub ne sont pas encore publiés et aucun ne doit être marqué prêt à implémenter tant que ses décisions bloquantes restent ouvertes.
