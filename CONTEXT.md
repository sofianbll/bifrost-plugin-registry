# Bifrost Registry

Catalogue de modèles et sélections réutilisables pour construire la liste de modèles accessible à chaque clé virtuelle Bifrost.

## Language

**Groupe de modèles** :
Sélection partagée de modèles. Une modification du groupe s'applique aux clés qui en héritent.

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
