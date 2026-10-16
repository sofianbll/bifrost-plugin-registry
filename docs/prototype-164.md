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

## Verdict — 16 octobre 2026

Sofian a choisi **B — Voir le produit** comme base : introduction compacte, grande capture du catalogue avant les fonctions. A et C restent conservées avec le sélecteur comme sources de comparaison, pas comme fonctionnalités à livrer. La composition B alimente l'étape `/to-spec` ; ce choix ne publie pas le prototype et n'autorise ni fusion ni déploiement. Le build de cette branche reste volontairement déterministe sur A pour conserver le dispositif de comparaison initial.

## Documentation pilot — 16 octobre 2026

Question : comment rendre navigation, installation et première clé compréhensibles sans noyer le lecteur ni retirer les précautions ? Le choix de l’accueil B reste acquis et distinct de ce pilote ; son code n’est pas modifié.

Même commande : `npm --prefix docs run prototype` (serveur existant : `http://127.0.0.1:5173`). Sur les routes `guides.html`, `INSTALL.html`, `USER-GUIDE.html` et leurs équivalents `fr/`, ajouter `?docView=A|B|C` :

- **A — Actuelle** : texte original intact, référence complète et ancres existantes.
- **B — Parcours** : objectif, prérequis et précautions visibles, puis étapes espacées et résultats attendus ; liens de référence après les étapes ; entrée par objectif dans l’index.
- **C — Fiche** : mêmes informations essentielles, actions et panneau de prérequis en deux colonnes ; prérequis avant les actions dans le DOM et sur mobile ; registre de tâches compact dans l’index.

Exemple : <http://127.0.0.1:5173/bifrost-plugin-registry/fr/INSTALL.html?docView=B>. En développement, B est la valeur par défaut et le repli des valeurs invalides. Sélecteur flottant commun, flèches clavier hors saisie/recherche/dialogue ; URL partageable, rechargement et retour/avant. Pas de stockage navigateur. Les liens de détail imposent A ; les liens du pilote et de langue conservent la vue, les autres paramètres et l’ancre. Les autres guides restent inchangés.

Limites jetables : sommaire automatique désactivé sur les six pages pour ne pas exposer les titres statiques de A dans B/C ; la recherche conserve l’index des textes originaux, sans indexer les propositions B/C ; liens détaillés vers A pour procédure complète, API, historique, migration et récupération. Capture existante du compositeur identifiée comme fixture synthétique historique. Les propositions ne sont ni une recette exécutée, ni une validation de migration, d’inférence ou de production. Le build de production rend uniquement le texte original A ; le module proposant B/C et le sélecteur ne sont importés qu’en développement. Branche non destinée à fusion ou déploiement.

Contrôles du sous-agent : build VitePress et liens internes ; conservation exacte des sources Markdown dans les wrappers ; comparaison des six textes HTML de production avec une baseline avant modification ; absence de sélecteur/copie proposée en production ; `git diff --check`. QA navigateur et `make verify` laissés au parent ; aucun gateway ni aucune commande d’installation exécutés.

Contrôles finaux du parent : `make verify` termine par `VERIFY PASSED` ; build docs et assertions des six sources d’origine réussis ; 48 rendus B/C × trois pages × deux langues × deux thèmes × 375/1280 px sans débordement ni erreur de chargement/runtime. Navigation entre pages, langue, clavier, saisie, rechargement et historique contrôlés. Relecture ciblée du contenu sans blocage ; liens de référence déplacés après les étapes en B et vérification déjà déclenchée par « Publier » explicitée. Aucune procédure exécutée sur un gateway ; choix de la vue documentaire encore attendu de Sofian.
