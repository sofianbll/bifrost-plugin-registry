# Cadrage du produit — brouillon du 23 septembre 2026

Source : besoins explicités par Sofian dans cette session. Ce document prépare la spec et les versions ; les propositions ci-dessous ne sont pas encore un plan d'exécution approuvé. [État du code](../../STATUS.md) · [Vocabulaire](../../CONTEXT.md) · [Recherche Bifrost sourcée](bifrost-integration-research.md).

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

## Comportement proposé à vérifier par scénarios

La sélection d'une clé est l'union des groupes et ajouts individuels, moins ses exclusions locales. Une exclusion gagne si plusieurs groupes fournissent le même modèle. Les droits et contraintes natives continuent de s'appliquer.

Exemple : deux clés de test, « Hermes » et « Témoin », héritent du groupe « Code » contenant A et B. Hermes ajoute C et exclut B : son catalogue prévu est A+C, celui de Témoin A+B. Après ajout de D au groupe, Hermes obtient A+C+D et Témoin A+B+D. B reste exclu pour Hermes. La clé témoin permet de vérifier l'isolation des changements sans introduire un deuxième client applicatif.

L'interface explique pour chaque entrée sa provenance, son exclusion ou la restriction qui l'empêche d'être publiée. Avant de publier un changement de groupe, elle montre les clés et les catalogues impactés.

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
3. **Aperçu réel** : comment interroger Bifrost pour la clé sans conserver inutilement son secret ? Le registre conserve aujourd'hui une empreinte, pas le jeton. Comment signaler une estimation périmée ou une relecture impossible ?
4. **Fiches complètes** : quelles sources et quels champs selon texte, image, audio, embeddings ou vidéo ? Quelles valeurs sont déclarées, testées, inconnues ou devenues anciennes ?
5. **Qualification** : quels premiers scénarios, quels fournisseurs, quels coûts maximaux, et quelles preuves permettent d'attribuer un échec à Bifrost ? Les mocks valident un comportement simulé, pas un accès fournisseur réel.
6. **Compatibilité** : API Bifrost utilisables, versions soutenues, dépendance du plugin Go, migrations, retour arrière et détection des écarts avant mise à niveau.
7. **Livraison** : numéros et contenu final des versions, langue UI, environnement de validation, périmètre des opérations autonomes et du déploiement.

## Parcours de cadrage

Recherche ciblée des primitives existantes → prototype UI/UX → retours et validation de l'expérience par Sofian → décisions techniques restantes → spec et versions → tickets complets avec dépendances et critères d'acceptation → exécution dans le périmètre approuvé.

Premier prototype proposé : « Composer le catalogue de ma clé Hermes ». Repartir de la maquette existante et rendre manipulable la sélection de groupes, les cartes modèles, l'ajout individuel, l'exclusion locale et le format des noms. Montrer immédiatement le résultat prévu et sa différence avec un catalogue publié simulé ; toute donnée simulée est explicitement identifiée. Les détails techniques et le JSON restent accessibles à la demande.

La validation se fait une interaction à la fois : comprendre ce que voit Hermes ; distinguer un changement local d'un changement de groupe partagé ; comprendre l'aperçu puis la publication. Explorer ensuite la création de clé, les fiches détaillées et les états d'échec. Le prototype valide la compréhension et l'usage ; la preuve d'intégration via les API Bifrost reste nécessaire dans les tickets. Les choix de présentation se décident en manipulant la maquette, sans nouveau questionnaire technique préalable.

Chaque ticket doit livrer un comportement observable et préciser sa preuve. Les détails techniques ordinaires sont résolus par l'agent ; les arbitrages produit, changements de périmètre et contraintes de coût encore ouverts reviennent à Sofian. Les tickets GitHub ne sont pas encore publiés et aucun ne doit être marqué prêt à implémenter tant que ses décisions bloquantes restent ouvertes.
