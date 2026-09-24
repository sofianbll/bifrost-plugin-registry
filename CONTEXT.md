# Bifrost Registry

Catalogue de modèles et sélections réutilisables pour construire la liste de modèles accessible à chaque clé virtuelle Bifrost.

## Language

**Catalogue central** :
Référence commune des fiches modèles, de leurs accès et des métadonnées retenues après rapprochement des sources. Les vues, l'API et les exports consultent ce même catalogue ; les droits et secrets des clés restent gérés par Bifrost.
_Avoid_ : catalogue publié, liste des modèles autorisés

**Modèle de référence** :
Identité d'un modèle et de sa variante, indépendante du service qui le propose. Sa présence dans le catalogue ne signifie pas qu'un accès est configuré ou autorisé.

**Accès modèle** :
Entrée permettant d'appeler un modèle par un fournisseur d'accès avec son identifiant exact. Ses limites, prix et capacités peuvent différer de ceux d'un autre accès au même modèle.

**Correspondance de modèle** :
Association explicite entre un accès et un modèle de référence. Une ressemblance de nom peut proposer une correspondance ; elle ne suffit pas à établir l'identité.

**Correction de métadonnée** :
Valeur choisie par l'administrateur pour un champ de la fiche ou d'un accès, conservée lors des synchronisations jusqu'au retour demandé à la valeur automatique. Elle ne modifie pas les droits natifs et ne constitue pas une preuve de capacité.

**Créateur** :
Organisation qui conçoit le modèle, par exemple Anthropic pour Claude. Elle peut aussi proposer un accès fournisseur à ce modèle.
_Avoid_ : fournisseur, famille

**Famille de modèles** :
Série de modèles apparentés d'un créateur, par exemple Claude, GPT ou Gemini.

**Fournisseur d'accès** :
Service par lequel le modèle est appelé, par exemple Bedrock ou Anthropic pour Claude. Un modèle peut avoir plusieurs accès, chacun avec son identifiant et ses capacités observées.
_Avoid_ : créateur

**Modalité** :
Nature des données acceptées en entrée ou produites en sortie : texte, image, audio, vidéo ou vecteurs pour les embeddings. Les modalités d'entrée et de sortie sont décrites séparément.

**Usage** :
Tâche recherchée, comme la conversation, la génération d'images, la synthèse vocale ou les embeddings. Un modèle peut répondre à plusieurs usages.
_Avoid_ : modalité

**Capacité** :
Comportement précis, comme les appels d'outils, le raisonnement, le streaming ou les sorties structurées. Sa prise en charge peut être déclarée, observée sur un accès précis ou inconnue.

**Groupe de modèles** :
Sélection partagée de modèles. Une modification du groupe s'applique aux clés qui en héritent.

**Regroupement de vue** :
Présentation du catalogue par créateur, fournisseur ou usage. Ce rangement visuel ne crée pas à lui seul un groupe partagé ni une autorisation de clé.

**Sélection de clé** :
Catalogue choisi pour une clé virtuelle : groupes hérités, modèles ajoutés individuellement et exclusions propres à cette clé.

**Exclusion locale** :
Modèle retiré de la sélection d'une clé, y compris lorsqu'un groupe le fournit. Cette exclusion ne modifie ni le groupe ni les autres clés.

**Format des noms** :
Forme des identifiants exposés pour une clé : `model`, `provider/model` ou `both`.
_Avoid_ : protocole, endpoint

**Catalogue publié** :
Liste réellement renvoyée au client lorsqu'il demande les modèles avec sa clé.

**Aperçu du brouillon** :
Liste prévue après publication des modifications en cours. Sa valeur dépend des données disponibles ; elle ne constitue pas une observation de l'API publiée.

**Fiche modèle** :
Présentation des informations du modèle, de ses accès par fournisseur et de ses capacités connues. Une information déclarée et une capacité vérifiée sont identifiables séparément.

**Scénario de qualification** :
Test d'un comportement défini sur un accès modèle, avec ses conditions d'exécution et ses critères de résultat. La couverture d'un scénario dans le harness décrit les tests disponibles.

**Campagne de qualification** :
Exécution d'un ensemble de scénarios sur une sélection explicite d'accès modèles. Les résultats identifient chaque accès et scénario, y compris les exclusions et les cas non exécutés.
