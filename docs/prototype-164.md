# Prototype local #164

Question : quelle hiérarchie aide un opérateur Bifrost à comprendre Registry et à juger son installation ?

- **A — Comprendre** : promesse à gauche, fonctions puis captures et explications alternées.
- **B — Voir le produit** : introduction centrée compacte, grande capture du catalogue puis fonctions.
- **C — Décider** : présentation et fonctions à gauche, limites et liens à droite, puis captures.

```sh
npm --prefix docs ci
npm --prefix docs run prototype
```

Ouvrir <http://127.0.0.1:5173/bifrost-plugin-registry/fr/?variant=A> (anglais : retirer `fr/`). Remplacer `A` par `B` ou `C`, utiliser le sélecteur ou les flèches du clavier. Les autres paramètres sont conservés ; retour/avant et rechargement reprennent la variante.

Code jetable sur `prototype/164-showcase`, non publié, non déployé : ne pas fusionner ni déployer cette branche. Le sélecteur est réservé au développement ; le build rend A de façon déterministe. Aucun appel au gateway ni inférence.

Juger la compréhension de la promesse, la distinction catalogue/sélection/vérification, la visibilité des limites, la lecture mobile et le chemin vers l’installation. Comparer EN/FR, clair/sombre, clavier, recherche, langue et images entières. Les captures existantes sont des fixtures synthétiques historiques, pas des résultats réels ni une connexion directe.

Les guides restent dans [l’index anglais](README.md) et [l’index français](fr/README.md), servis sous `guides` et `fr/guides`. Voir la [grille de captures](images/README.md). Les polices Geist existantes sont importées depuis `ui/public/static/fonts`, sans copie ni dépendance. Cette note est exclue du site par `srcExclude`.
