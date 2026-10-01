# Utiliser Registry

[English](../USER-GUIDE.md) · Français

L'interface comprend **Réglages → Aide** et un bouton d'aide dans l'en-tête. Ce guide décrit l'interface actuelle ; [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) (en anglais) consigne les limites de release et de qualification. L'interface est en anglais par défaut ; le français est à un clic (sélecteur de langue) ou via `?lang=fr`.

![Catalogue des modèles, vue grille](../images/fr/catalogue-grid.png)

## 1. Enregistrer un modèle

Ouvrez **Mes modèles**, examinez un modèle découvert et choisissez ses accès fournisseurs. Chaque accès conserve son fournisseur et son identifiant natif exacts. L'identifiant commun du modèle est le nom que Registry exposera selon la préférence de nommage de la clé.

Renseignez un identifiant commun valide, un nom d'affichage et au moins un accès complet. Sélectionnez les opérations exposées indépendamment pour chaque accès : Chat Completions et Responses sont des choix distincts. Les sélections existantes survivent à la modification ; les accès nouvellement découverts démarrent sans opération sélectionnée. L'éditeur signale les valeurs obligatoires manquantes avant l'étape de revue. Le créateur, la série, les prix et les capacités peuvent rester inconnus. Choisir une opération autorise ce type de requête côté Registry ; cela ne teste pas si le fournisseur la prend en charge.

Le panneau du modèle peut être élargi sans perdre le brouillon en cours. Relisez le résumé puis enregistrez. Enregistrer une fiche documentaire seule ne donne accès à aucun modèle.

![Éditeur de fiche modèle](../images/fr/model-card.png)

## 2. Comprendre les données de source

**Réglages → Sources** affiche les dates de synchronisation, les échecs et le nombre d'éléments du catalogue. Ouvrez les données du catalogue pour voir la provenance par champ, les corrections, les rapprochements exacts de références et la création manuelle de références.

- **Models.dev** fournit un instantané de référence local versionné, généré avec son noyau upstream. Son commit source et sa date identifient les données ; la date de rafraîchissement indique seulement quand Registry a importé cet instantané. Les liens canoniques, les valeurs propres à chaque fournisseur et les omissions explicites sont conservés, ainsi que les corrections locales et les rapprochements manuels.
- **Bifrost** fournit la configuration du gateway et les données de modèles déclarées. Une valeur déclarée est une affirmation de la source, pas un test d'inférence.
- **Inconnu** signifie que l'information est indisponible ; cela ne veut dire ni non pris en charge, ni zéro.
- Les **références personnalisées** se créent dans Données du catalogue → Fiches documentaires → Nouvelle fiche. Reliez ensuite explicitement l'accès concerné.

La release courante embarque cet instantané Models.dev ; la release précédente non. Le rafraîchir ne télécharge pas une version upstream plus récente : mettre à jour les données embarquées exige de régénérer l'instantané et de compiler une nouvelle release. Les connecteurs de sources supplémentaires génériques restent un chantier séparé. Voir [l'analyse Models.dev](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/models-dev-reuse-research.md) (en anglais).

## 3. Composer des groupes et des clés

Les groupes sont des sélections de modèles réutilisables. Dans une clé, un modèle sélectionné inclut par défaut tous ses accès liés ; le menu **Accès** d'une carte de modèle exclut (ou rétablit) des accès fournisseurs individuels pour cette clé seulement, sans modifier le groupe partagé. Simple et Expert partagent le même brouillon. Expert est disponible sur grand écran.

Pour une clé Bifrost préexistante, commencez par **Examiner l'adoption**. Registry compare les permissions natives aux accès enregistrés. Si un modèle doit être enregistré pour préserver les routes existantes de la clé, l'aperçu l'indique. Ne confirmez qu'après avoir relu la sélection proposée. L'adoption n'élargit pas les permissions Bifrost.

Les accès manquants sont regroupés par fournisseur. **Aller aux modèles** conserve le brouillon de clé en cours pendant que vous enregistrez les prérequis ; utilisez le bandeau de retour pour le reprendre. Examiner l'adoption reste possible avec des modifications non enregistrées. Appliquer l'adoption conserve ces modifications pour revue et ne publie pas la sélection en attente.

Composez ensuite les groupes, les ajouts directs et les exclusions locales. Les exclusions s'appliquent à cette clé sans modifier le groupe partagé. Relisez les identifiants obtenus, publiez et relisez `/v1/models`. La relecture vérifie les identifiants listés, pas l'inférence des modèles.

![Compositeur de clé virtuelle](../images/fr/key-composer.png)

## 4. Instantané local ou gateway connecté

Le bandeau indique la source et la date de capture. Une capture partielle peut contenir des alias ou des résultats de découverte indisponibles.

Un instantané permet l'édition locale des modèles et du catalogue ainsi que la préparation locale des sélections de clés lorsque son plan d'adoption est valide. Il ne modifie pas le gateway d'origine. Ses identifiants et sa liste de modèles sont simulés : une préparation réussie ne prouve donc pas un accès réel. Les secrets ont été exclus : révéler une vraie clé, la relecture en direct, le rafraîchissement des sources et les appels fournisseurs sont indisponibles.

Le panneau autonome utilise son propre jeton d'accès et des identifiants gateway côté serveur. Une intégration native compatible avec l'hôte peut partager la surface d'administration authentifiée de Bifrost. Cela exige le build hôte/plugin compatible précis ; ce n'est établi ni par l'ouverture de la page d'instantané ni par l'installation de l'image officielle actuelle du gateway.

## 5. Affichage et détails du gateway

**Réglages → Affichage** contient les préférences d'affichage partagées et les remplacements de logos de fournisseurs. Un logo peut utiliser une icône existante ou un PNG, JPEG ou WebP importé. Ces préférences ne sont enregistrées que dans ce navigateur et ne changent ni l'identité des fournisseurs ni les permissions.

Les pages de catalogue proposent les vues Grille et Tableau. En grille, les cartes peuvent être Rectangle ou Carré et utiliser une densité Petit, Moyen ou Grand.

![Vue grille, cartes carrées, densité moyenne](../images/fr/display-options.png)

L'inventaire du gateway affiche les fournisseurs capturés, les permissions des clés, les alias et le routage. Les vues arborescente et détaillée montrent les mêmes données. Un alias associe un nom demandé à une cible fournisseur ; un déploiement peut être cette cible propre au fournisseur. Les règles de routage choisissent les cibles selon les conditions et pondérations capturées. Les alias manquants ou chiffrés restent explicitement indisponibles.
