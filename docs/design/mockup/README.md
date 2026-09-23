# Maquettes historiques

La démo Hermes ci-dessous a été rejetée par Sofian. Elle conserve la logique explorée, mais ne sert plus de référence UI. La nouvelle direction est une application complète utilisant les vrais composants Bifrost ; voir [le cadrage produit](../product-direction.md).

Ouvrir **[hermes-prototype.html](hermes-prototype.html)** dans un navigateur, par double-clic. Un seul fichier autonome ; aucune installation, connexion ou donnée réelle. L'état reste en mémoire et repart de zéro au rechargement.

Question : comprend-on ce qui change uniquement pour Hermes, ce qui se propage par un groupe partagé et ce qui reste inconnu quand la relecture échoue ? Le style reprend les tokens Bifrost ; cette étape explore les interactions de sélection, avec une seule proposition de présentation.

Trois parcours guidés sont accessibles en bas de page :

1. **Ma clé uniquement** : ajouter Gemini, exclure Claude, publier et comparer avec la clé témoin.
2. **Un groupe partagé** : ajouter Kimi à Code, voir l'effet sur les deux clés et conserver l'exclusion de Hermes.
3. **Une lecture en échec** : enregistrer, conserver la dernière observation, signaler l'absence de vérification, puis relire.

L'exploration libre permet aussi de cumuler les groupes, de choisir les trois formats de noms et d'ouvrir une fiche illustrative avec plusieurs accès. Les modèles, fournisseurs et réponses API sont fictifs. Les fiches complètes éditables et la création de clé feront l'objet des prochains parcours.

Vérification du modèle de sélection : `node docs/design/mockup/check-hermes.cjs` depuis la racine. Syntaxe JavaScript et références DOM contrôlées ; rendu et interactions dans un vrai navigateur restent à vérifier. L'ouverture des fichiers locaux par l'outil navigateur avait été bloquée pendant l'audit ; aucun contournement n'a été utilisé.

Source sur la branche locale `codex/prototype-hermes`. Aucune décision d'UX validée à ce stade ; les retours de Sofian précèdent la spec et les tickets. `index.html` et `fragments/` conservent la maquette initiale de cinq écrans.
