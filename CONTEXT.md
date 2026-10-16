# Bifrost Registry

Catalogue de modèles et sélections réutilisables pour construire la liste de modèles accessible à chaque clé virtuelle Bifrost.

## Language

**Accueil vitrine** :
Présentation publique de Registry destinée à un opérateur Bifrost qui découvre le projet, ses usages et ses limites. Elle se distingue du panneau d'administration et du catalogue publié d'une clé.

**Documentation Registry** :
Ensemble des guides destinés à installer, utiliser et exploiter Registry. Son index oriente vers ces guides ; il se distingue de l'accueil vitrine.

**Catalogue central** :
Référence commune des fiches modèles, de leurs accès et des métadonnées retenues après rapprochement des sources. Les vues, l'API et les exports consultent ce même catalogue ; les droits et secrets des clés restent gérés par Bifrost.
_Avoid_ : catalogue publié, liste des modèles autorisés

**Configuration du gateway** :
Choix de l'administrateur qui déterminent les fournisseurs connectés, les clés, les alias, les autorisations et les règles d'utilisation. Elle décrit comment cette instance donne accès aux modèles.

**Datasheet** :
Données de référence décrivant les modèles et leurs accès : identité, caractéristiques, capacités, paramètres et tarifs. Leur présence ne prouve pas qu'un accès est configuré ou utilisable sur le gateway.

**Modèle de référence** :
Identité d'un modèle et de sa variante, indépendante du service qui le propose. Sa présence dans le catalogue ne signifie pas qu'un accès est configuré ou autorisé.

**Accès modèle** :
Entrée permettant d'appeler un modèle par un fournisseur d'accès avec son identifiant exact. Ses limites, prix et capacités peuvent différer de ceux d'un autre accès au même modèle.

**Identifiant commun du modèle (alias)** :
Nom d'appel porté par la fiche modèle, commun à ses accès fournisseurs. Il correspond aux identifiants exacts des accès retenus pour le groupe ou la clé concernée ; il est distinct du nom affiché de la fiche. Basic le dit « Nom d'appel » (EN : « Call name »), sans « alias » ni « identifiant ».

**Sélection d'accès** :
Choix des accès fournisseurs activés pour une fiche dans un groupe ou une clé virtuelle. La présence d'un accès dans la fiche ne signifie pas qu'il est activé dans toutes les sélections.

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

**Abonnement** :
Mot courant, dans l'interface Basic, pour le fournisseur d'accès (Claude, Codex, OpenCode Go) : les deux mots nomment la même chose, « fournisseur » étant celui de Bifrost et d'Expert. Un écran n'emploie pas l'un et l'autre pour deux choses différentes.
_Avoid_ : créateur

**Modalité** :
Nature des données acceptées en entrée ou produites en sortie : texte, image, audio, vidéo ou vecteurs pour les embeddings. Les modalités d'entrée et de sortie sont décrites séparément.

**Usage** :
Tâche recherchée, comme la conversation, la génération d'images, la synthèse vocale ou les embeddings. Un modèle peut répondre à plusieurs usages.
_Avoid_ : modalité

**Catégorie de modèles** :
Classement de navigation par domaine d'usage, tel que Text, Image, Video, Audio ou Retrieval. Ce classement reste distinct des modalités d'entrée/sortie, des capacités et des accès fournisseurs.
_Avoid_ : groupe de modèles

**Capacité** :
Comportement précis, comme les appels d'outils, le raisonnement, le streaming ou les sorties structurées. Sa prise en charge peut être déclarée, observée sur un accès précis ou inconnue.

**Opération exposée** :
Type de requête que Registry autorise pour un accès modèle, choisi explicitement par l'administrateur. Deux accès d'une même fiche peuvent exposer des opérations différentes ; ce choix ne prouve pas leur prise en charge par le fournisseur.
_Avoid_ : modalité, capacité vérifiée

**Groupe de modèles** :
Sélection partagée de fiches modèles avec leurs choix d'accès fournisseurs. Une modification du groupe s'applique aux clés qui en héritent.
_Avoid_ : catégorie, provider

**Clé virtuelle (VK)** :
Clé Bifrost utilisée par une application pour accéder aux modèles qui lui sont accordés. Dans Registry, sa sélection peut référencer des groupes de modèles et des modèles individuels.

**Regroupement de vue** :
Présentation du catalogue par créateur, fournisseur ou usage. Ce rangement visuel ne crée pas à lui seul un groupe partagé ni une autorisation de clé.

**Sélection de clé** :
Catalogue choisi pour une clé virtuelle : groupes hérités, modèles ajoutés individuellement, choix des accès fournisseurs et exclusions propres à cette clé.

**Exclusion locale** :
Modèle ou accès fournisseur retiré de la sélection d'une clé, y compris lorsqu'un ou plusieurs groupes le fournissent. Cette exclusion ne modifie ni les groupes ni les autres clés.

**Format des noms** :
Forme des identifiants exposés pour une clé : `model`, `provider/model` ou `both`.
_Avoid_ : protocole, endpoint

**Catalogue publié** :
Liste réellement renvoyée au client lorsqu'il demande les modèles avec sa clé.

**Vérifiée** :
Se dit d'une clé dont le catalogue publié, relu avec cette clé, correspond à ce que Registry y a publié. Elle atteste le catalogue observé à cet instant, ni le routage ni les capacités. Un modèle que Bifrost ne liste pas n'entre jamais dans le total vérifié : il est signalé comme écart. « Vérifiée · 1 écart » se lit : Bifrost a confirmé la clé, mais 1 permission conservée dans Bifrost n'y est pas listée ; une infobulle et l'aide le disent.
_Avoid_ : testée, qualifiée

**Vérifier avec Bifrost** :
Demander à Bifrost quels identifiants de modèles une clé liste et les comparer à ce que Registry a publié. Les modèles ne sont pas appelés. Trois résultats : Vérifiée, Écarts trouvés, Pas encore vérifiée. Le bouton se lit « Vérifier avec Bifrost » tant que Bifrost n'a pas été interrogé pour la clé, puis « Vérifier à nouveau ».
_Avoid_ : relecture, readback (dans un texte affiché en Basic)

**Pas encore vérifiée** :
État d'une clé pour laquelle on n'a pas encore demandé à Bifrost ce qu'elle liste. Le total affiché est alors le plan de Registry, pas un fait confirmé : l'en-tête le dit et le bouton « Vérifier avec Bifrost » se trouve à côté.
_Avoid_ : non vérifiée (réservé à un échec de la vérification)

**Aperçu du brouillon** :
Liste prévue après publication des modifications en cours. Sa valeur dépend des données disponibles ; elle ne constitue pas une observation de l'API publiée.

**Publier** :
Appliquer à un groupe ou à une clé les modifications du brouillon : Registry sauvegarde la révision puis vérifie avec Bifrost. Dans une copie locale, on enregistre localement : rien n'est publié.
_Avoid_ : enregistrer (réservé à la fiche modèle), sauvegarder

**Model card (fiche modèle)** :
Fiche unique d'un modèle portant son identifiant commun et regroupant ses accès par fournisseur, construite à partir des propriétés natives connues de Bifrost puis enrichie dans Registry. Les différences propres aux accès sont conservées ; une information déclarée et une capacité vérifiée restent identifiables séparément.
_Avoid_ : fiche sans préciser le modèle, fiche par provider

**Enregistrer un modèle** :
Créer la fiche modèle dans Registry, depuis un modèle découvert ou saisi à la main. Cela ne donne accès à aucune clé : le modèle n'est utilisable qu'une fois ajouté à une clé ou à un groupe.
_Avoid_ : ajouter un modèle (« ajouter » est réservé à rattacher un accès à une fiche, ou une fiche à une clé ou à un groupe)

**Ajouter** :
Rattacher un accès à une fiche, ou une fiche à une clé ou à un groupe.
_Avoid_ : créer une fiche (c'est Enregistrer)

**Adopter une clé** :
Confier à Registry le choix des modèles d'une clé créée dans Bifrost, sans élargir ses accès. Adopter ne change rien dans Bifrost en soi ; seules les options marquées « Modifie Bifrost » modifient la clé. Le bouton d'une carte de clé nomme la suite : Adopter, Voir ce qui bloque, ou Ouvrir.
_Avoid_ : importer, examiner (comme nom d'une action de carte)

**Décision d'adoption** :
Choix obligatoire que la fenêtre d'adoption demande avant d'adopter, une ligne par fournisseur, avec les modèles concernés nommés dans la ligne. Le compte « n sur N décidées » ne compte que les décisions. Un blocage qu'aucun bouton ne règle (clé désactivée ou expirée dans Bifrost) n'en est pas une : c'est un préalable.
_Avoid_ : étape, blocage (une décision est la réponse à un blocage)

**Préalable à l'adoption** :
Ce qu'il faut faire hors de la fenêtre avant d'adopter, comme enregistrer des modèles que Bifrost liste sans fiche, ou activer une clé désactivée ou expirée dans Bifrost puis actualiser l'aperçu. Il se dit à côté du compte des décisions, sans en être une.
_Avoid_ : décision

**Relier à nouveau la clé Bifrost** :
Refaire le lien entre une clé gérée par Registry et la clé Bifrost correspondante, quand celle-ci a changé.
_Avoid_ : examiner l'association, binding, réassocier

**Enrichissement de fiche** :
Complément ou correction des informations d'une fiche, en réutilisant les propriétés existantes pour une même donnée. Un champ natif absent ou incomplet ne justifie pas la création d'une propriété concurrente dans Registry.

**Scénario de qualification** :
Test d'un comportement défini sur un accès modèle, avec ses conditions d'exécution et ses critères de résultat. La couverture d'un scénario dans le harness décrit les tests disponibles.

**Campagne de qualification** :
Exécution d'un ensemble de scénarios sur une sélection explicite d'accès modèles. Les résultats identifient chaque accès et scénario, y compris les exclusions et les cas non exécutés.
