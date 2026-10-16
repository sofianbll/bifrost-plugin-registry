# Choisir les modèles d’une application

<a id="utiliser-registry"></a>

[English](../USER-GUIDE.md) · Français

Préparez la sélection d’une clé de test Bifrost existante, publiez-la et vérifiez les modèles que Bifrost liste pour cette clé.

## Avant de commencer

Utilisez un gateway de test avec Registry installé et connecté, des fournisseurs configurés et des modèles disponibles chez ces fournisseurs.

Choisissez pour cette application une clé Bifrost existante, active et non expirée. Sa création et ses permissions initiales se règlent dans Bifrost si nécessaire ; ce guide ne crée pas de clé.

## 1. Préparer les modèles

Dans **Mes modèles**, retrouvez les fiches voulues et contrôlez leurs accès fournisseurs. Si une fiche manque, ouvrez le modèle découvert et choisissez **Enregistrer**. Renseignez un nom d’appel valide, un nom d’affichage et au moins un accès complet avec son fournisseur et son identifiant de modèle exact.

Choisissez les opérations exposées pour chaque accès : Chat Completions et Responses sont deux choix distincts. Relisez puis enregistrez la fiche ; les détails facultatifs comme les prix peuvent rester inconnus. Choisir une opération ne prouve pas sa prise en charge par le fournisseur.

**Enregistrer** crée une fiche modèle, pas un accès pour une clé. **Ajouter** rattache un accès à une fiche, ou une fiche à une clé ou à un groupe. Vous choisirez les modèles de cette clé à l’étape 3.

## 2. Ouvrir ou adopter la clé

Dans **Clés**, retrouvez la clé de l’application. Choisissez **Ouvrir** si Registry la gère déjà, **Adopter** si elle est prête, ou **Voir ce qui bloque** pour consulter ce qui manque.

Résolvez d’abord les préalables : enregistrez les fiches manquantes, ou activez ou renouvelez la clé dans Bifrost, puis actualisez l’aperçu. Ces actions sont distinctes des décisions par fournisseur dans la fenêtre d’adoption. Pour chaque décision, comparez les permissions existantes et la sélection proposée ; garder un fournisseur dans Bifrost laisse ses permissions hors de la gestion de Registry.

Pour une option **Modifie Bifrost**, relisez l’aperçu exact avant/après avant de confirmer le changement. Remplacer « tous les fournisseurs » peut retirer les modèles sans fiche et n’autorise plus automatiquement les futurs fournisseurs. Seules ces options signalées changent les permissions natives.

Une fois les préalables et les décisions résolus, adoptez la clé. L’adoption n’élargit pas les permissions natives et ne publie pas les modifications de sélection en attente.

## 3. Choisir les modèles et les accès

Ajoutez les modèles nécessaires à cette application. Un modèle sélectionné inclut **tous ses accès liés par défaut** : relisez la liste **Accès** et décochez ceux que cette clé ne doit pas utiliser.

Ces exclusions locales ne concernent que cette clé, y compris lorsqu’un groupe fournit le modèle. Elles ne changent ni le groupe ni les autres clés.

Pour réutiliser une sélection, vous pouvez aussi [utiliser un groupe](#_3-composer-des-groupes-et-des-cles). C’est facultatif. Modifier un groupe partagé affecte toutes les clés qui en héritent ; gardez les exceptions propres à une clé dans cette clé.

![Compositeur de clé virtuelle](../images/fr/key-composer.png)

*Exemple de sélection d’une clé. Données fictives.*

## 4. Relire et publier

<a id="publish"></a>

Relisez les modèles retenus, leurs noms d’appel et leurs accès dans l’aperçu du brouillon. Cet aperçu est la sélection prévue, pas une liste déjà confirmée par Bifrost.

Cliquez sur **Publier**. Registry enregistre la sélection et demande aussitôt à Bifrost quels modèles cette clé liste. Consultez le résultat à l’étape suivante.

## 5. Lire le résultat

**Vérifiée** : Bifrost a confirmé la sélection publiée. **Écarts trouvés** : examinez les identifiants de modèles manquants ou inattendus et corrigez si besoin la sélection ou la configuration du gateway. **Pas encore vérifiée** : le total reste la sélection prévue ; utilisez **Vérifier avec Bifrost**.

**Vérifiée · 1 écart** reste possible : une permission conservée dans Bifrost n’est pas listée par Bifrost. Consultez cet écart ; le modèle non listé ne compte jamais dans le total vérifié.

Utilisez **Vérifier à nouveau** si vous devez relancer la comparaison. Ce contrôle lit `/v1/models` avec la clé ; il n’appelle aucun modèle et ne prouve donc pas qu’un appel d’inférence réussira. Un identifiant listé ne prouve pas non plus le routage ni les capacités du fournisseur.

## Autres cas et référence

Retrouvez les [détails d’enregistrement](#_1-enregistrer-un-modele), les [groupes et options d’adoption](#_3-composer-des-groupes-et-des-cles), les [limites d’un instantané](#_4-instantane-local-ou-gateway-connecte) ou les [contrôles d’installation](INSTALL.md). [Trouver un autre guide](README.md).

L'interface comprend **Réglages → Aide** et un bouton d'aide dans l'en-tête. Ce guide décrit l'interface actuelle ; [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) (en anglais) consigne les limites de release et de qualification. L'interface est en anglais par défaut ; le français est à un clic (sélecteur de langue) ou via `?lang=fr`.

![Catalogue des modèles, vue grille](../images/fr/catalogue-grid.png)

### Champs et opérations d’enregistrement

<a id="_1-enregistrer-un-modele"></a>

Ouvrez **Mes modèles**, examinez un modèle découvert et choisissez ses accès fournisseurs. Chaque accès conserve son fournisseur et son identifiant natif exacts. L'identifiant commun du modèle est le nom que Registry exposera selon la préférence de nommage de la clé.

Renseignez un identifiant commun valide, un nom d'affichage et au moins un accès complet. Sélectionnez les opérations exposées indépendamment pour chaque accès : Chat Completions et Responses sont des choix distincts. Les sélections existantes survivent à la modification ; les accès nouvellement découverts démarrent sans opération sélectionnée. L'éditeur signale les valeurs obligatoires manquantes avant l'étape de revue. Le créateur, la série, les prix et les capacités peuvent rester inconnus. Choisir une opération autorise ce type de requête côté Registry ; cela ne teste pas si le fournisseur la prend en charge.

Le panneau du modèle peut être élargi sans perdre le brouillon en cours. Relisez le résumé puis enregistrez. Enregistrer une fiche documentaire seule ne donne accès à aucun modèle.

![Éditeur de fiche modèle](../images/fr/model-card.png)

### Données de source et provenance

<a id="_2-comprendre-les-donnees-de-source"></a>

**Réglages → Sources** affiche les dates de synchronisation, les échecs et le nombre d'éléments du catalogue. Ouvrez les données du catalogue pour voir la provenance par champ, les corrections, les rapprochements exacts de références et la création manuelle de références.

- **Models.dev** fournit un instantané de référence local versionné, généré avec son noyau upstream. Son commit source et sa date identifient les données ; la date de rafraîchissement indique seulement quand Registry a importé cet instantané. Les liens canoniques, les valeurs propres à chaque fournisseur et les omissions explicites sont conservés, ainsi que les corrections locales et les rapprochements manuels.
- **Bifrost** fournit la configuration du gateway et les données de modèles déclarées. Une valeur déclarée est une affirmation de la source, pas un test d'inférence.
- **Inconnu** signifie que l'information est indisponible ; cela ne veut dire ni non pris en charge, ni zéro.
- Les **références personnalisées** se créent dans Données du catalogue → Fiches documentaires → Nouvelle fiche. Reliez ensuite explicitement l'accès concerné.

La release courante embarque cet instantané Models.dev ; la release précédente non. Le rafraîchir ne télécharge pas une version upstream plus récente : mettre à jour les données embarquées exige de régénérer l'instantané et de compiler une nouvelle release. Les limites techniques (longueur de contexte, maximum de jetons) restent descriptives : Registry ne les applique pas nativement. Les connecteurs de sources supplémentaires génériques restent un chantier séparé. Voir [l'analyse Models.dev](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/models-dev-reuse-research.md) (en anglais).

### Groupes partagés et détails d’adoption

<a id="_3-composer-des-groupes-et-des-cles"></a>

Les groupes sont des sélections de modèles réutilisables. Dans une clé, un modèle sélectionné inclut par défaut tous ses accès liés. Lorsqu'un modèle sélectionné a plusieurs accès, le compositeur de clé les liste sous **Accès** avec une case à cocher chacun : en décocher un exclut cet accès fournisseur pour cette clé seulement, sans modifier le groupe partagé. Simple et Expert partagent le même brouillon. Expert est disponible sur grand écran.

Pour une clé Bifrost préexistante, choisissez **Adopter**, ou **Voir ce qui bloque** lorsqu’il reste des préalables ou des décisions ; **Ouvrir** ouvre une clé déjà gérée par Registry. Registry compare les permissions natives aux accès enregistrés. Si un modèle doit être enregistré pour préserver les routes existantes de la clé, l’aperçu l’indique. Ne confirmez qu’après avoir relu la sélection proposée. L’adoption n’élargit pas les permissions Bifrost.

Chaque carte de clé indique si la clé est **Prête à adopter**, **Bloquée** (avec la raison) ou **Vide**, et la page Clés filtre sur cet état. La fenêtre d’adoption liste les décisions restantes, une par fournisseur, avec leurs choix et les modèles concernés. Les préalables, comme une clé désactivée ou expirée à rétablir dans Bifrost, ne comptent pas comme décisions. Les modèles que Bifrost ne liste pas (par exemple un fournisseur désactivé) ne peuvent pas être ajoutés depuis Registry, mais vous pouvez **Garder Mistral dans Bifrost** (le bouton porte le nom du fournisseur) : Registry ne gère alors pas et ne modifie pas les permissions de ce fournisseur, adopte le reste de la clé et relit ses routes avec les autres (la carte et la page de la clé indiquent « conservé dans Bifrost »). Un modèle permis par deux fournisseurs est adopté par l’un d’eux : gardez l’autre fournisseur dans Bifrost. Ceux que Bifrost liste sans fiche Registry mènent à **Voir dans À ajouter**, filtré sur ces modèles. Le brouillon de clé en cours est conservé pendant que vous enregistrez les préalables. Ouvrir l’adoption reste possible avec des modifications non enregistrées. Appliquer l’adoption conserve ces modifications pour revue et ne publie pas la sélection en attente.

Un blocage peut aussi être levé sur la clé elle-même, dans Bifrost, depuis la fenêtre d'adoption uniquement : **Retirer ces modèles de la clé dans Bifrost** (modèles que Bifrost ne liste pas) et **Remplacer « tous les fournisseurs » par la liste explicite**. Chacune ouvre un aperçu du changement exact : ce que la clé autorise aujourd'hui et ensuite, et chaque modèle qui cesse d'être autorisé. Rien n'est écrit dans Bifrost avant votre confirmation, et le résultat est relu depuis Bifrost avant d'être annoncé. Remplacer « tous les fournisseurs » garde les fournisseurs pour lesquels Bifrost liste des modèles, chacun limité aux modèles pour lesquels Registry détient un accès direct configuré (l'adoption ne sait pas reprendre une liste « tous les modèles ») : les modèles sans fiche cessent d'être autorisés et les fournisseurs ajoutés plus tard à Bifrost ne le sont pas tant que vous ne les ajoutez pas à la clé. Registry ne modifie jamais les permissions natives d'une clé adoptée.

Composez ensuite les groupes, les ajouts directs et les exclusions locales. Les exclusions s'appliquent à cette clé sans modifier le groupe partagé. Relisez les identifiants obtenus, publiez et relisez `/v1/models`. La relecture vérifie les identifiants listés, pas l'inférence des modèles.

### Instantané local ou gateway connecté

<a id="_4-instantane-local-ou-gateway-connecte"></a>

Le bandeau indique la source et la date de capture. Une capture partielle peut contenir des alias ou des résultats de découverte indisponibles.

Un instantané permet l'édition locale des modèles et du catalogue ainsi que la préparation locale des sélections de clés lorsque son plan d'adoption est valide. Il ne modifie pas le gateway d'origine. Ses identifiants et sa liste de modèles sont simulés : une préparation réussie ne prouve donc pas un accès réel. Les secrets ont été exclus : révéler une vraie clé, la relecture en direct, le rafraîchissement des sources et les appels fournisseurs sont indisponibles.

Le panneau autonome utilise son propre jeton d'accès et des identifiants gateway côté serveur. Une intégration native compatible avec l'hôte peut partager la surface d'administration authentifiée de Bifrost. Cela exige le build hôte/plugin compatible précis ; ce n'est établi ni par l'ouverture de la page d'instantané ni par l'installation de l'image officielle actuelle du gateway.

### Affichage et détails du gateway

<a id="_5-affichage-et-details-du-gateway"></a>

**Réglages → Affichage** contient les préférences d'affichage partagées et les remplacements de logos de fournisseurs. Un logo peut utiliser une icône existante ou un PNG, JPEG ou WebP importé. Ces préférences ne sont enregistrées que dans ce navigateur et ne changent ni l'identité des fournisseurs ni les permissions.

Les pages de catalogue proposent les vues Grille et Tableau. En grille, les cartes peuvent être Rectangle ou Carré et utiliser une densité Petit, Moyen ou Grand.

![Vue grille, cartes carrées, densité moyenne](../images/fr/display-options.png)

L'inventaire du gateway affiche les fournisseurs capturés, les permissions des clés, les alias et le routage. Les vues arborescente et détaillée montrent les mêmes données. Un alias associe un nom demandé à une cible fournisseur ; un déploiement peut être cette cible propre au fournisseur. Les règles de routage choisissent les cibles selon les conditions et pondérations capturées. Les alias manquants ou chiffrés restent explicitement indisponibles.
