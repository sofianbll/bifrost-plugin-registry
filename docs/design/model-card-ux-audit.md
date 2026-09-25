# Audit UX de la fiche modèle — 25 septembre 2026

## Conclusion

Le prototype fait manipuler la structure des données avant de rendre la tâche
compréhensible. Il démontre un mécanisme d'héritage, mais ne permet pas de juger
le parcours demandé : retrouver un modèle déjà présent dans Bifrost, le rattacher
à une fiche unique avec ses fournisseurs, puis comprendre ce qui sera enrichi
ou modifié.

La validation précédente prouvait que les contrôles fonctionnaient selon le code.
Elle ne prouvait pas que l'utilisateur pouvait anticiper leur effet.

## Périmètre et méthode

- Prototype local `http://127.0.0.1:8771/model-card-prototype.html`, commit `7df5fc3`.
- Inspection du code, observation dans le navigateur à 1280 × 720 et parcours
  de modification d'une valeur commune. Aucun changement de gateway ou d'UI.
- Skills : UX Heuristics, Design of Everyday Things et Refactoring UI.
- Audit indépendant ciblé par GPT-6 Luna, confronté aux observations navigateur.
- Le retour de Sofian est un signal utilisateur réel. Les causes et solutions
  ci-dessous sont des conclusions heuristiques, pas des résultats d'une étude
  utilisateurs ni une mesure de l'ensemble du produit.

## Problèmes prioritaires

| Priorité | Observation vérifiée | Effet probable | Correction à prototyper |
| --- | --- | --- | --- |
| 3 — majeur | La fiche et deux fournisseurs sont déjà choisis. Aucun point de départ depuis les modèles du gateway. | L'utilisateur ne reconnaît pas son objectif ni ce qui est déjà enregistré. | Commencer par un modèle existant et son état, puis proposer une correspondance de référence à confirmer. Des exemples peuvent simuler ce parcours, à condition d'être identifiés comme tels. |
| 3 — majeur | « Identifier » permet surtout de renommer et de choisir un alias. « Ajuster » présente tous les champs. | Les étapes ne correspondent pas à des décisions reconnaissables; les champs semblent devoir être remplis. | Réserver les étapes à l'enregistrement : choisir le modèle, confirmer son identité et ses fournisseurs, vérifier les changements. Ensuite, une fiche consultable avec modification ciblée. |
| 3 — majeur | Une sortie commune changée à 32 000 laisse les deux fournisseurs à 128 000. | L'utilisateur doit connaître la priorité interne pour prévoir le résultat. | Afficher immédiatement la portée : « Aucun fournisseur modifié : chacun possède sa propre valeur ». Montrer les différences côte à côte. Ne pas décider implicitement que la valeur commune doit écraser les fournisseurs. |
| 3 — majeur | Origine, correction Registry et destination Bifrost sont affichées ensemble; la relecture parle de « valeurs effectives ». | Difficile de distinguer information de référence, brouillon et état réellement lu dans Bifrost. | Séparer la source de l'information de son état : valeur actuelle Bifrost, proposition, destination. Dans le prototype, nommer explicitement le résultat « Aperçu » et réserver « Appliqué » à une écriture vérifiée. |
| 3 — majeur | Quatre champs communs, les mêmes quatre champs par fournisseur, badges techniques et explications répétées. | La comparaison exige de défiler, changer de fournisseur et retenir les valeurs. Le décor donne une importance similaire à des informations de rôles différents. | Une fiche en lecture d'abord; comparaison compacte des fournisseurs; édition de la propriété choisie; une seule action principale visible. Provenance courte auprès de la valeur, détails techniques à la demande. |

Sources de code : `ui/src/model-card-prototype/App.tsx` lignes 39, 57–77,
82–92 et 97–108; `state.ts` lignes 25–34.

## Reproduction du problème de portée

1. Ouvrir **Ajuster**.
2. Saisir **32000** dans **Sortie maximale**, section **Propriétés communes**.
3. Ouvrir **Relire**.

| Élément | Résultat observé |
| --- | --- |
| Impact des corrections | Fiche commune → sortie maximale 32 000 |
| OpenRouter | Sortie maximale 128 000, Models.dev · provider |
| Amazon Bedrock | Sortie maximale 128 000, Models.dev · provider |

Le calcul suit bien le code : une valeur écrite dans la source fournisseur passe
avant une correction commune. La relecture oblige à déduire pourquoi la correction
n'affecte aucun accès. Le problème est la prévisibilité du contrôle et le libellé
« Impact », pas une raison suffisante pour changer cette règle métier sans décision.

Un autre point reste à clarifier : « sortie maximale » décrit-elle une limite
documentée du modèle ou une limite d'utilisation imposée par l'administrateur ?
Le prototype expose le champ descriptif Models.dev et peut faire attendre le second
comportement. La prochaine version doit nommer l'intention et l'effet précisément.

## Constats visuels

À 1280 × 720, l'étape Ajuster mesure 1 621 px de haut. Le choix de fournisseur
commence à y=860 et Continuer à y=1543 : ils ne sont pas visibles quand on commence
à modifier les propriétés communes. Ces coordonnées sont une observation de cette
session, pas une propriété fixe de tous les écrans.

La page possède de l'espace, une police cohérente et des valeurs lisibles.
L'espace est toutefois consommé par les cadres et les répétitions. Ajouter de
l'espace ou des couleurs ne résoudrait pas l'absence de comparaison ni la distance
entre la modification et son effet.

Les noms techniques (`limit.context`, `TOML`, `parameters`, « portée à qualifier »)
occupent le premier niveau de lecture. Ces informations répondent à des questions
d'implémentation. Les questions immédiates restent : quel modèle, quels fournisseurs,
quelle valeur aujourd'hui, quel changement après enregistrement ?

## Évaluation des grilles des skills

Notes heuristiques provisoires, sans prétention de mesure objective. Les points
non contrôlés ne sont pas considérés comme validés.

- **UX Heuristics : 3/10.** Orientation dans la tâche, effet des modifications
  et vocabulaire : trois échecs majeurs (−2 chacun); action principale éloignée
  et générique : un échec mineur (−1). Recherche non évaluée sur ce prototype fixe.
  Les retours explicites, labels et erreurs de saisie constituent des acquis.
- **Design of Everyday Things : 4/10.** Retour/retrait de correction et validation
  des saisies : deux critères satisfaits. Découverte de l'action, compréhension de
  son effet et proximité contrôle/résultat : trois critères en échec.
- **Refactoring UI : 6/10 provisoire.** Palette peu dépendante de la couleur,
  espace disponible, échelle d'espacement, largeur contenue et ombres cohérentes :
  cinq critères satisfaits sur huit. Hiérarchie des rôles et discrétion des
  métadonnées à corriger; conformité complète des contrastes non vérifiée ici.

Pour atteindre les critères des grilles : rendre la tâche et son état immédiatement
identifiables, rapprocher chaque contrôle de ses effets, supprimer les formulaires
dupliqués et vérifier contraste/focus. Une note de 10 ne doit pas être annoncée sur
une nouvelle maquette avant une nouvelle inspection et un essai de compréhension.

## Direction de correction proposée

**Enregistrement :** modèle existant Bifrost → correspondance proposée → fiche
et fournisseurs confirmés → changements avant/après → enregistrement et vérification.

**Consultation et édition :** une fiche modèle lisible, fournisseurs visibles,
différences comparables, action Modifier sur l'élément choisi. Le mode édition
montre les conséquences avant de demander d'enregistrer.

La provenance demandée par Sofian reste présente. Elle doit répondre à « D'où vient
cette valeur ? » avec un repère court et un détail consultable; elle ne remplace
pas « Cette valeur est-elle déjà appliquée ? ».

Conserver les composants Bifrost, le générateur Models.dev et les données épinglées.
Les choix de routage, de priorité commune/fournisseur et de stockage natif ne sont
pas tranchés par cette recommandation UX.

## Critères du prochain essai

Sans explication orale, Sofian doit pouvoir repérer le modèle et ses fournisseurs,
identifier une différence, modifier une seule valeur et prévoir quels accès
changeront. La relecture doit confirmer cette prédiction et distinguer source,
proposition et état appliqué. Une étape supplémentaire est utile si elle porte une
décision réelle; un écran pédagogique permanent ne remplace pas un contrôle clair.
