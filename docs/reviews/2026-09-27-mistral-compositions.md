# Audit de compositions d’interface — Mistral Docs / Models

Date d’observation : 2026-09-27
Périmètre : audit en lecture seule pour repérer des compositions réutilisables ultérieurement dans Registry. Pages consultées directement sur le site officiel :

- [Models Overview](https://docs.mistral.ai/models)
- [Mistral Medium 3.5](https://docs.mistral.ai/models/mistral-medium-3-5-26-04)

## Résultat rapide

Le catalogue privilégie une découverte éditoriale par vedettes et familles, puis un inventaire historique tabulaire. La fiche modèle est une page de référence compacte : identité et statut/version, métriques mises en évidence, puis capacités reliées à des routes/API. Ces formes sont réutilisables comme inspiration structurelle; les libellés et données Mistral restent des faits de fournisseur.

## Observations vérifiées

### Catalogue `/models`

- En-tête documentaire partagé : navigation de premier niveau, recherche docs, bascule de thème, liens d’action (« Try Studio ») et fil d’Ariane / navigation latérale Inference.
- Intro éditoriale « Models Overview », texte de cadrage, puis lien d’action vers « Compare models » et explication orientée sélection (tâche, latence, coût).
- Bloc « Featured Models » : six entrées mises en avant, chacune nom + phrase descriptive et lien vers sa fiche.
- « All models » répète le contenu en familles : Generalist, OCR, Audio, Code, Embedding, Moderation and safety, Other specialist. Chaque famille associe un intitulé, une phrase expliquant le périmètre, puis une liste de liens modèle.
- Les entrées de ces familles montrent, selon le modèle, icône, nom, badge de licence ou statut (OPEN, PREMIER…), description courte et version. Ce ne sont pas des champs uniformes garantis pour chaque entrée.
- Les modèles retirés sont séparés dans une table « Deprecated & retired models » comportant modèle, version, API, dates de dépréciation/retrait et alternative. Un libellé « Scroll for more » est visible dans l’extraction.
- Aucun champ de recherche de modèles, menu de filtre, tri ou contrôle de groupe n’a été observé dans le corps du catalogue. Les familles visibles agissent comme groupes éditoriaux, pas comme filtres interactifs prouvés.

### Fiche `Mistral Medium 3.5`

- En-tête de fiche avec icône, nom, description, date de publication (28 avril 2026), état GA, licence Modified MIT, version v26.04 et identifiant API affiché (`mistral-medium-3-5`, avec un bouton « +2 » dont la signification n’est pas établie par l’extraction).
- Liens « Compare » et « Legal » à proximité de l’identité.
- Zone de métriques présentant Speed, Performance, Modalities, Context et Price. Les valeurs textuelles lisibles sont contexte 256k, prix $1.5/M Tokens et $7.5/M Tokens; l’extraction ne permet pas d’associer avec certitude chaque prix à une colonne/entrée, ni de lire valeurs ou visualisations Speed/Performance/Modalities.
- Bloc « Features » listant Structured Outputs, Function Calling, Predicted Outputs, Document QnA, Prefix, Batching, Agents & Conversations, Chat Completions et Built-In Tools. Plusieurs entrées sont liées à des endpoints ou familles d’API.
- Titres « FEATURES WEIGHTS » apparaissent avant la liste; l’état interactif exact (onglets, sections ou texte) n’est pas établi par l’extraction.
- Bloc « Other Models » propose trois liens de modèles apparentés. Pied de page documentaire commun.

## Compositions réutilisables selon Brad Frost

La granularité atom/molecule/organism est une interprétation de conception, pas la nomenclature déclarée par Mistral. Template/page désignent la composition macroscopique et ne sont pas des niveaux d’atomes.

1. **Atome — badge de statut/licence/version** : petite valeur compacte et reconnaissable (ex. GA, Modified MIT, v26.04). Dans Registry, séparer statut du cycle de vie, provenance/licence et version en concepts distincts; ne pas fusionner en un badge ambigu.
2. **Molécule — entrée de modèle** : identité (icône/nom), description courte, métadonnées facultatives et lien. Réutilisable dans listes vedettes et catégories; prévoir l’absence d’icône, licence, version ou description.
3. **Organisme — groupe de modèles par famille** : titre, phrase définissant la famille et collection d’entrées. Utile pour la navigation éditoriale; pour un registre multi-fournisseurs, les catégories doivent être taxonomie Registry contrôlée et non copiées comme catégories Mistral sans correspondance explicite.
4. **Organisme — bandeau vedette** : titre et petit ensemble de modèles promus en cartes/liens plus visibles. La mise en avant est une décision éditoriale de Mistral, non un classement objectif ou un statut de disponibilité.
5. **Organisme — résumé de fiche modèle** : nom/description, statut, version, fournisseur, licence et identifiant(s) d’accès regroupés dans une zone d’identité. Garder les valeurs sourcées et distinguer nom commercial, identifiant fournisseur et alias de déploiement.
6. **Organismes — panneau de capacités et table de cycle de vie** : les capacités reliées aux routes API forment une liste scannable sur la fiche; les versions dépréciées utilisent une table à colonnes, dates et alternative. Les deux servent des questions différentes et méritent des rendus distincts.

**Template catalogue** : intro + action de comparaison + vedettes + groupes de modèles + table historique. Le template organise découverte courante et maintenance historique dans une même page.

**Template fiche** : identité/références + résumé métrique + capacités/endpoints + modèles apparentés. À réutiliser comme page de détail indépendante, avec métriques propres aux types d’entités réellement admis dans Registry.

## Garde-fous sémantiques pour Registry

- La documentation Mistral décrit les offres et endpoints de Mistral. Elle ne prouve pas qu’un autre fournisseur, un proxy, une route Registry ou un déploiement local offre les mêmes capacités.
- « Non indiqué / inconnu » doit rester distinct de « non pris en charge ». Une absence de badge/champ sur la page ne démontre pas une absence de capacité.
- Le prix de fiche est fournisseur, daté et possiblement dépendant d’une unité/contexte. Ne pas comparer ou agréger avant de vérifier entrée/sortie, région, modalité, période et source de tarif.
- Les termes OPEN/PREMIER, GA, versions et alternatives sont les classifications de Mistral dans ces pages; ils ne doivent pas devenir des états Registry génériques sans modèle sémantique propre.
- La présence d’un lien, d’une icône ou d’un exemple de route ne prouve ni intégration exécutable ni compatibilité du plugin.
- La mention « Modified MIT » est un libellé affiché par Mistral; cet audit n’analyse pas le texte de licence et ne déduit aucun droit de réutilisation du code ou du design.

## Limites d’observation

La lecture textuelle officielle a exposé les titres, liens, textes et certaines valeurs, mais aucun parcours de contrôles interactifs n’a été vérifié. L’inspection navigateur complémentaire du sous-agent n’a pas pu fournir d’observation visuelle, car le navigateur intégré a refusé l’accès dans ce contexte; je n’ai donc pas évalué précisément couleurs, espacements, proportions, états hover/focus, responsive, rupture mobile, graphiques, ni comportements de filtres/onglets. Aucune mesure de benchmark n’a été vérifiée indépendamment. Les pages peuvent évoluer après la date d’observation.

## Complément visuel du coordinateur

Après l'audit textuel, le coordinateur a ouvert les deux URL dans le navigateur, puis inspecté la fiche en thème sombre à une largeur desktop (capture de 1280 px). Le catalogue présente des cartes vedettes colorées. La fiche sépare une colonne d'identité/actions, un panneau titre/description/identifiant, puis un bandeau horizontal de métriques. Speed et Performance sont figurés par des segments; Modalities par des icônes directionnelles. La section Features est une grille de trois colonnes, chaque entrée associant une icône, un libellé et les endpoints en texte secondaire. L'arbre d'accessibilité confirme des onglets Features et Weights, avec Features sélectionné. Le changement d'onglet, le bouton +2, le responsive mobile et les états hover/focus n'ont pas été testés. Ce complément lève uniquement la limite d'observation visuelle desktop, pas les autres limites de l'audit.

Ces compositions restent des références pour l'étape templates/pages, après validation des composants Registry. Aucun écran de l'application n'a été remplacé.
