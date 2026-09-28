# Images du README

Captures utilisées par le README. Elles proviennent des audits UX conservés sous `dist/`
(ignoré par Git) : UI courante sur fixture natif synthétique (`checks/final-ux`) et clôture
UX (`checks/ux-closeout`). Les originaux font 2000×1125 px (800×1800 pour le mobile) ;
les fichiers publiés sont redimensionnés à ≤ 1400 px de large avec `sips --resampleWidth 1400`.

## Vérification de confidentialité

Chaque image livrée a été ouverte et relue à sa résolution finale : aucune ne montre de
secret, de jeton, de clé `sk-bf-…`, de mot de passe, d'URL interne, de donnée issue de la
capture privée `dist/pulsar-review/raw.json`, ni d'identifiant de capture réelle. Les seuls
identifiants visibles sont des valeurs synthétiques de fixture (`upstream-alpha`,
`openai/upstream-alpha`, `QA Chat`, `Persisted proof`).

Deux captures d'audit ont été écartées pour cette raison car elles affichent le dialogue de
secret de clé : `dist/checks/final-ux/screens/screen-19.png` (valeur `sk-bf-…` complète) et
`dist/checks/ux-closeout/screens/closeout-4.png` (« Copier le secret de la clé virtuelle »).
Aucune image retenue ne provient de ces écrans.

| Fichier | Source (`dist/…`) | Contenu observé |
| --- | --- | --- |
| `catalogue-grid.png` | `checks/ux-closeout/screens/closeout-1.png` | « Mes modèles », vue Grille (Rectangle · Petit) : 4 cartes d'accès, légende des modèles de référence. Image d'en-tête. |
| `catalogue-table.png` | `checks/final-ux/screens/screen-05.png` | Vue Tableau : colonnes Modèle / Fournisseurs / Entrées → sorties / Capacités / Action. |
| `display-options.png` | `checks/final-ux/screens/screen-14.png` | « Clés virtuelles », Forme « Carré » (1:1) sélectionnée, barre Forme et Densité visible. |
| `model-card.png` | `checks/final-ux/screens/screen-12.png` | Fiche modèle « upstream-alpha », onglet Propriétés : Sortie maximale, Prix entrée, Prix sortie et origine de chaque valeur. |
| `key-composer.png` | `checks/final-ux/screens/screen-28.png` | Compositeur de clé, étape Vérifier : badge « Ajouté directement », ID d'accès, identifiants proposés. |
| `settings.png` | `checks/final-ux/screens/screen-31.png` | Réglages : sections Général / Affichage / Sources / Connexion / Assistance / Aide. |
| `mobile.png` | `checks/final-ux/screens/screen-35.png` | 400 px : barre latérale en panneau superposé (contenu en une colonne derrière). |
| `dark-theme.png` | `checks/final-ux/screens/screen-38.png` | Thème sombre, catalogue en vue Grille. |
