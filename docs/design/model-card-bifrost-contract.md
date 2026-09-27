# Fiche modèle : contrat natif Bifrost avant enrichissement

Cadrage commencé le 25 septembre et précisé le 26 septembre 2026. Décisions produit consignées ; aucun changement fonctionnel livré par ce document.

## Lecture visuelle

[Comparer les trois inventaires de propriétés](model-card-properties/index.html) : Bifrost natif, datasheets, puis model card cible. Chaque entrée distingue provenance, portée, lecture et modification ; la cible distingue direction validée, proposition et décision ouverte. Les références remontent aux contrats natifs Bifrost 2.2.3. Les champs supplémentaires du document de paramètres sont extensibles : leur inventaire indique les champs connus et ne prétend pas fermer ce format JSON.

Les données modifiables du comparateur sont `model-card-properties/{native,datasheet,target}.json` ; `build.py` valide leurs champs et liens, puis génère le fragment interactif. Les propriétés communes à plusieurs routes sont volontairement décrites dans chaque contrat : le compteur indique des entrées, pas autant de propriétés indépendantes à créer. Les valeurs de clés et de connexions privées ne sont pas incluses.

[Ouvrir les quatre vues](diagrams/model-cards/index.html). Chaque vue dispose d'un fichier Excalidraw modifiable :

1. [Origine des données](diagrams/model-cards/01-origine-des-donnees.excalidraw) : configuration, datasheets et découverte fournisseur.
2. [Fichier ou base](diagrams/model-cards/02-priorite-config-fichier-base.excalidraw) : écriture par l'interface et réconciliation au démarrage.
3. [Priorité des propriétés](diagrams/model-cards/03-priorite-des-proprietes.excalidraw) : les règles varient selon la propriété et la route de lecture.
4. [Enrichissement Registry](diagrams/model-cards/04-enrichissement-registry.excalidraw) : parcours proposé et contrats d'écriture encore à décider.

Les vues 1 à 3 décrivent Bifrost 2.2.3 ; la vue 4 distingue la direction confirmée du mécanisme restant à concevoir. Les fichiers sont locaux, sans lien de partage externe.

## Direction confirmée par Sofian

- Une fiche par modèle, avec plusieurs fournisseurs liés ; pas une fiche par fournisseur.
- Partir des propriétés réelles de Bifrost, y compris celles disponibles mais absentes d'une réponse particulière, puis enrichir la fiche.
- Réutiliser une propriété native existante au lieu de créer un deuxième champ pour la même information.
- L'enregistrement doit pouvoir modifier Bifrost lorsque nécessaire. Les chemins d'écriture et leurs limites doivent être établis champ par champ ; la présence d'un champ en lecture ne prouve pas qu'il est modifiable par API.

### Identifiant commun, sélection des accès et présentation — précision du 25 septembre

Décisions produit confirmées par Sofian ; leur mécanisme d'application reste à spécifier :

- Chaque fiche porte un identifiant commun appelable, son alias. La création de cet alias fait partie du résultat attendu de l'enregistrement ; ce n'est pas seulement un nom d'affichage facultatif.
- Une même fiche rassemble plusieurs accès fournisseurs avec leurs identifiants exacts. L'appel de son identifiant commun doit pouvoir aboutir à l'un des accès activés pour la clé concernée.
- Lors de la sélection d'une fiche dans un groupe ou une clé virtuelle, un sous-menu permet d'activer ou désactiver les accès fournisseurs. Exemple demandé : la fiche Sonnet 4.6 peut être sélectionnée avec CPA seulement, ou CPA et un deuxième provider. Cette sélection ne désactive pas globalement le provider sur le gateway et reste soumise aux droits natifs.
- La capture Vercel AI Gateway fournie est une référence d'organisation visuelle : navigation All/Text/Image/Video/Audio/Retrieval/Evaluation/Tools ; informations d'entrée, sortie, prix et providers ; capacités détaillées regroupées en sorties, entrées et fonctionnalités. Retrieval doit notamment permettre de retrouver les modèles d'embeddings et de reranking.
- Ces catégories sont une présentation des propriétés connues et ne doivent pas recréer des champs concurrents aux propriétés natives. La capture ne prouve pas que chaque information existe dans Bifrost : les données inconnues, comme une latence non mesurée, restent inconnues.

### Sélections et routage — décisions confirmées le 26 septembre

- À la sélection d'une fiche, ses accès fournisseurs **déjà configurés et autorisés** sont activés par défaut. Un accès ajouté ultérieurement à la fiche reste décoché dans les sélections existantes ; son activation demande un choix explicite.
- Chaque clé virtuelle peut personnaliser à la fois ses modèles et les accès fournisseurs de chaque modèle. Elle peut hériter de plusieurs groupes, ajouter des modèles ou accès individuellement et exclure localement un modèle ou un accès hérité, sans modifier le groupe ni les autres clés. Un accès exclu localement ne redevient pas actif parce qu'un autre groupe ou un ajout individuel le fournit ; le rétablissement de l'héritage est une action explicite.
- L'interface de création de clé commence par le choix des fiches modèles. Une vue des groupes permet d'ajouter des sélections partagées tout en conservant les choix déjà faits ; les modèles individuels restent disponibles en complément. Montrer pour chaque modèle et accès s'il est choisi directement, hérité ou exclu. Les réglages fournisseurs plus poussés s'ouvrent à la demande, après les choix usuels. Le détail du layout et des menus reste à valider visuellement.
- Pour un alias commun, le routage doit utiliser les mécanismes **natifs Bifrost**, limités aux accès retenus pour cette clé. Le produit n'ajoute pas de moteur de routage Registry ni de préférence fixe par défaut. Les droits et contraintes natifs continuent de s'appliquer.

| Priorité de sélection pour une clé | Résultat attendu |
| --- | --- |
| Exclusion locale | Prime sur les groupes et les ajouts individuels pour le modèle ou l'accès visé. |
| Ajout individuel ou groupe hérité | Active le modèle et ses accès retenus, sous réserve des droits natifs et hors exclusion locale. |
| Nouvel accès sur une fiche déjà sélectionnée | Reste décoché jusqu'à activation explicite dans cette sélection. |

Ces décisions décrivent la cible produit, pas une implémentation livrée. La traduction exacte en droits et alias natifs, l'ordre des plugins et le routage de bout en bout restent à qualifier avec deux providers simulés : une clé n'autorisant qu'un accès, une autre autorisant les deux, et vérification de l'identifiant réellement transmis. Le `Prefer[alias]` statique actuel (`internal/registry/config.go`) ne prouve pas ce routage natif. Les contrats d'écriture natifs des autres propriétés de fiche restent également ouverts.

### Parcours de clé — choix de Sofian dans la session Kimi du 26 septembre

- Conserver les deux présentations d'un même brouillon : **Basic**, étapes Models → Groups → Review, et **Expert**, composition avec aperçu permanent. Le passage entre modes conserve les choix.
- Sur mobile, utiliser **Basic uniquement**. La préférence Expert du desktop peut être conservée, mais le contrôle doit représenter le mode effectivement affiché.
- Garder le sous-menu **Accesses** sur chaque carte pour les réglages d'accès avancés.
- Placer un petit interrupteur **Expert** dans le header, près du bouton de thème : piste verte et curseur blanc circulaire en mode Expert, piste grise en mode Basic. La précision visuelle du 27 septembre remplace le bouton textuel initial.

Ces choix ont été récupérés dans les messages utilisateur de la session Kimi ; ils remplacent l'attente d'un choix exclusif entre A et B. Ils valident cette direction UX, pas les autres écrans ni une intégration native. Le [bilan de reprise](../reviews/2026-09-26-project-state.md) distingue le prototype récupéré et ses vérifications de l'implémentation produit.

### Présentation du catalogue — retours visuels du 27 septembre

- Reprendre l’organisation des captures Vercel AI Gateway fournies par Sofian pour la vue liste : recherche, catégories de modèles, menus fournisseurs avec recherche et logos, capacités, filtres complémentaires et tri ; colonnes alignées pour comparer les modèles.
- Afficher les fournisseurs avec leurs logos et les capacités avec des icônes explicites. Un survol ou focus ouvre un tableau lisible de détails, notamment pour le raisonnement. Les données documentaires et leur provenance restent distinctes d’une validation en exécution.
- Aérer les cartes : nom et créateur en premier, description et informations utiles ensuite, sélection clairement visible. Les identifiants et réglages avancés se consultent à la demande. Le nombre de colonnes dépend de l’espace réellement disponible, y compris à côté du brouillon Expert.
- Les captures sont une référence de présentation, pas une source de propriétés des modèles. Prix, latence, confidentialité et dates absents des fixtures restent inconnus ; ne pas transformer une absence en valeur nulle, gratuité ou réponse négative.

La ressource **Don’t Make Me Think** fournie par Sofian guide cette itération : action de sélection visible avec le modèle, hiérarchie lisible au balayage, moins de texte répétitif et détails avancés accessibles à la demande. Les contrôles de prototype ne doivent pas concurrencer le parcours principal.

Cette itération concerne le prototype local uniquement. L’appréciation visuelle de Sofian et le raccordement aux données réelles restent distincts des vérifications du prototype.

## Périmètre vérifié

### Reprise Models.dev et opérations — 27 septembre 2026

Suivi : [GitHub #17](https://github.com/sofianbll/bifrost-plugin-registry/issues/17).

**Décision confirmée par Sofian :** choisir les opérations explicitement **par accès fournisseur**, avec Chat Completions et Responses indépendants, sans déduction depuis les modalités Models.dev. Une relecture puis sauvegarde doit conserver exactement les opérations déjà enregistrées. La classification historique `kind` ne doit plus déterminer les droits de requête.

Tranche locale implémentée et vérifiée :

- [x] Vérifier les imports et consommateurs, ainsi que les routes de Bifrost 2.2.3 au commit `411d62b28b03b03bd3b4025b2cfab50af45f05f4`.
- [x] Générer un snapshot autonome avec le cœur Models.dev épinglé à `6a0b12bc9c66e1ab4fe44232d592a32df09a77e0`, en conservant liens canoniques, champs propres aux offres et omissions avant aplatissement.
- [x] Brancher ce snapshot sur le catalogue Registry et exposer sa provenance ; préserver correspondances manuelles, corrections et dernier état valide.
- [x] Sauvegarder et relire les opérations de chaque accès, sans élargissement implicite des configurations existantes.
- [x] Proposer les neuf opérations JSON couvertes : `chat/completions`, `responses`, `completions`, `embeddings`, `images/generations`, `audio/speech`, `decisions`, `rerank`, `ocr`.
- [x] Vérifier import, corrections, omissions, sauvegarde/relecture multi-accès, refus de routes non autorisées et rendu du formulaire sur la capture locale datée.


Preuves : tests source Go (race et vet), contrôles UI et compilation, génération déterministe du snapshot, audits Luna et [vérification dans le navigateur](../reviews/2026-09-27-ui-repair-checklist.md#modelsdev-and-per-access-endpoints). La compatibilité native et l’inférence ne sont pas établies par ces contrôles.
La liste ci-dessus est celle de la tranche Registry, pas l'inventaire exhaustif de Bifrost ni une certification fournisseur. Transcription audio et variations d'images utilisent multipart ; les éditions d'images ont plusieurs formats ; vidéos, ressources Responses, fichiers, lots et conteneurs demandent des contrats supplémentaires. Les clés natives non gérées conservent leur traitement natif. Les propriétés `provider.api`, `npm` et `shape` de Models.dev ne deviennent ni des permissions ni des endpoints par déduction.

L'intégration des données locales ne qualifie pas l'application native des limites/prix, la sélection d'accès par clé, le routage natif, l'ABI du plugin ou l'inférence réelle. Aucun déploiement ni changement de production n'est autorisé par cette tranche.

Sources Bifrost au commit `411d62b28b03b03bd3b4025b2cfab50af45f05f4`, tag `transports/v2.2.3`, présentes dans `dist/source-223-sparse/`. Gateway local isolé : `GET /api/version` renvoie `v2.2.3`. Vérifications en lecture seule, sans inférence, sans écriture de configuration ni exposition de secrets.

Bifrost n'expose pas une unique fiche administrative contenant toutes ses connaissances : il faut rapprocher les contrats suivants, en gardant leur sens et leur portée.

### Configuration et datasheets : deux rôles, un stockage partagé possible

La configuration du gateway décrit les choix locaux : connexions fournisseurs, clés, modèles autorisés, alias et gouvernance. `config.json` est une déclaration de configuration ; le config store conserve l'état persistant administré par Bifrost. Son stockage local par défaut est `config.db`, mais Bifrost permet d'autres configurations de stockage. La priorité entre fichier et base dépend des règles de réconciliation ; ce ne sont pas nécessairement deux copies identiques.

Les datasheets sont les sources de connaissance technique : modèles de base, capacités, limites, paramètres et prix. Bifrost importe aussi ces données dans son config store, notamment les tables `governance_model_pricing` et `governance_model_parameters`, puis les charge en mémoire. Une propriété stockée dans `config.db` peut donc provenir d'une datasheet. Il faut distinguer le rôle et l'origine d'une information de son emplacement de stockage.

Sources : [chargement de configuration](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/lib/config.go#L864), [synchronisation du catalogue](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/datasheet/sync.go#L20), [stockage des paramètres](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/configstore/tables/modelparameters.go#L3).

## 1. Modèle normalisé : `schemas.Model`

Inventaire des propriétés JSON sérialisables de [core/schemas/models.go](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/core/schemas/models.go#L149), utilisé pour les réponses de liste de modèles. La présence dans ce contrat ne garantit pas une valeur pour chaque fournisseur. Ce n'est pas le contrat de `GET /api/models/details`.

| Ensemble | Propriétés natives exactes |
| --- | --- |
| Identité | `id`, `canonical_slug`, `name`, `normalized_name`, `alias`, `owned_by`, `hugging_face_id` |
| Présentation et cycle de vie | `description`, `created`, `is_deprecated` |
| Limites | `context_length`, `max_input_tokens`, `max_output_tokens` |
| Architecture | `architecture.modality`, `.tokenizer`, `.instruct_type`, `.input_modalities`, `.output_modalities` |
| Prix | `pricing.prompt`, `.completion`, `.request`, `.image`, `.web_search`, `.internal_reasoning`, `.input_cache_read`, `.input_cache_write` |
| Informations du fournisseur principal | `top_provider.is_moderated`, `.context_length`, `.max_completion_tokens` |
| Limites par requête | `per_request_limits.prompt_tokens`, `.completion_tokens` |
| Paramètres | `supported_parameters`, `default_parameters.temperature`, `.top_p`, `.frequency_penalty` |
| Raisonnement | `reasoning.mandatory`, `.default_enabled`, `.supported_efforts`, `.default_effort` |
| Méthodes | `supported_methods` |
| Métadonnées éditoriales | `additional_attributes` : dictionnaire de chaînes |

`ProviderExtra` est interne et n'est pas sérialisé. `alias` désigne ici l'identifiant API cible d'un alias, pas automatiquement le nom affiché de la fiche. `owned_by` n'établit pas à lui seul le créateur du modèle.

Le catalogue natif complète les valeurs manquantes avec sa datasheet, en préservant les valeurs déjà fournies par le provider : [ApplyModelInfo](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/modelinfo.go#L44). `normalized_name` peut être dérivé du `base_model` de la datasheet.

## 2. API d'administration : modèles et accès configurés

Contrats dans [handlers/providers.go](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/handlers/providers.go#L719).

- `GET /api/models` : `name`, `provider`, `is_deprecated`, `accessible_by_keys`.
- `GET /api/models/details` : `name`, `provider`, `context_length`, `max_input_tokens`, `max_output_tokens`, `input_cost_per_token`, `output_cost_per_token`, `cache_creation_input_token_cost`, `cache_read_input_token_cost`, `architecture`, `is_deprecated`, `additional_attributes`, `accessible_by_keys`, `overridden_pricing`, `applied_override_id`, `pricing_override_ids`.
- L'enveloppe de `/details` contient `models`, `total`, et éventuellement un index `pricing_overrides`. `overridden_pricing` contient seulement les quatre champs de coût effectivement modifiés par une correction applicable à cette vue.
- `GET /api/models/base` fournit les noms de modèles de base du catalogue. Cette liste n'est pas un inventaire des modèles réellement accessibles sur le gateway.

Le catalogue natif possède `GetBaseModelName`, `IsSameModel` et `GetProvidersForModel` : [modelcatalog/models.go](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/models.go#L204). Ces fonctions sont une base à étudier pour les correspondances ; leur traitement des familles et des alias ne suffit pas à décider la granularité des fiches Registry.

## 3. Datasheet et paramètres : informations déjà disponibles

`GET /api/models/parameters?model=...` renvoie la datasheet stockée, comme document JSON, ou 404. La résolution accepte les identifiants qualifiés par provider et des alias : [getModelParameters](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/handlers/providers.go#L1203).

Le schéma de capacités natif inclut notamment `supported_endpoints`, `supports_function_calling`, `supports_reasoning`, `supports_response_schema`, `supports_prompt_caching`, `reasoning_effort_levels`, `reasoning_budget`, `model_parameters`, `service_tiers` et des contraintes de paramètres : [core/schemas/modelcapabilities.go](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/core/schemas/modelcapabilities.go#L26). Ces données peuvent influencer le comportement du runtime ; ce ne sont pas toutes des étiquettes décoratives.

Constat sur le gateway de test :

- `/api/models/details` : 25 entrées, chacune avec seulement `name` et `provider` dans cette réponse.
- `/api/models/parameters` demandé pour les 25 identifiants qualifiés : **22 réponses 200, 3 réponses 404**. Une réponse `/details` pauvre n'implique donc pas que Bifrost ignore les autres propriétés du modèle.
- Parmi les champs effectivement présents dans ces datasheets : `model`, `base_model`, `provider`, `provider_specific_entry`, `mode`, `max_input_tokens`, `max_output_tokens`, `max_tokens`, `model_parameters`, `supported_endpoints`, `supported_modalities`, `supported_output_modalities`, `supports_function_calling`, `supports_parallel_function_calling`, `supports_response_schema`, `supports_native_structured_output`, `supports_native_streaming`, `supports_reasoning`, `reasoning_effort_levels`, `default_reasoning_effort`, `reasoning_budget`, `supports_vision`, `supports_image_input`, `supports_audio_input`, `supports_audio_output`, `supports_video_input`, `supports_pdf_input`, `supports_prompt_caching`, `supports_web_search`, `service_tiers`, `rpm`, `tpm`, `deprecation_date`, `source`, `metadata`. Liste représentative de l'union observée, pas de champs garantis sur chaque fiche.
- `/v1/models` sans clé virtuelle : 401. Aucune conclusion sur le contenu effectivement publié à un client avec sa clé n'est tirée de cette lecture.

## 4. Écriture native : ce qui est établi

| Information à modifier | Chemin natif vérifié | Limite |
| --- | --- | --- |
| Métadonnées éditoriales | `PUT /api/models/catalog`, éléments `{model, provider, additional_attributes}` | Écrit seulement `additional_attributes`. Le couple modèle/provider doit déjà avoir une ligne de pricing ; une ligne absente fait échouer tout le lot. Le dictionnaire est remplacé, donc préserver les entrées tierces. |
| Alias d'un modèle sur une clé fournisseur | `PUT /api/providers/{provider}/keys/{key_id}` avec `aliases` | Configuration d'accès/routage ; ne remplace pas toutes les propriétés d'une fiche. |
| Tarifs appliqués | API `/api/governance/pricing-overrides` | Corrige les tarifs selon une portée et une correspondance ; ne modifie pas la fiche source entière. |
| Budgets et limites de débit | API `/api/governance/model-configs` | Configuration de gouvernance, distincte du contexte et des limites de tokens du modèle. |
| Limites descriptives, architecture, `base_model`, capacités et paramètres de datasheet | Lecture et synchronisation natives vérifiées | Pas de route HTTP générale d'édition de fiche trouvée dans les handlers 2.2.3 examinés. La configuration accepte `pricing_url` et `model_parameters_url` ; une éventuelle alimentation par Registry reste à concevoir et valider. |

Sources : [écriture du catalogue](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/handlers/providers.go#L1524), [transaction et rechargement](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/server/server.go#L2067), [configuration des sources](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/config.go#L42).

Stocker par exemple `context_length` comme texte dans `additional_attributes` ne modifie pas le champ natif `context_length` utilisé ailleurs. Cette possibilité ne doit pas être présentée comme une édition native de cette propriété.

## 5. Écart avec Registry aujourd'hui

- [Découverte](../../internal/admin/live.go#L105) : ne décode que `name`, `provider`, `accessible_by_keys`.
- [Import Bifrost](../../internal/admin/catalog.go#L451) : lit un sous-ensemble de `/details`, extrait les modalités hors de `architecture`, transforme les coûts par token en coûts par million et conserve la datasheet de paramètres comme un bloc `parameters`.
- [Projection dans la fiche UI](../../internal/admin/catalog.go#L49) : ne réutilise qu'une partie du catalogue. Les capacités natives de la datasheet ne sont pas exploitées comme les champs natifs individuels dans le formulaire.
- Le DTO UI possède notamment `summary`, `context`, `kind`, `capabilities`, distincts des propriétés natives. `kind` mélange Chat/Vision/Image/Embedding et commande les endpoints ; la datasheet native possède déjà `mode` et `supported_endpoints`.
- [Sauvegarde](../../internal/admin/live.go#L577) : recopie le DTO dans `metadata.ui` et répète certains champs dans les objets d'accès Registry. Une fiche logique multi-provider est représentée par plusieurs objets persistés puis regroupée à la lecture.
- [Écriture vers Bifrost](../../internal/admin/live.go#L761) : installe les alias. Les changements de description, contexte, modalités, capacités et prix du formulaire ne sont pas écrits comme propriétés natives correspondantes.

La prochaine décision porte sur la correspondance des propriétés natives entre ces contrats et leur portée modèle/accès, puis sur l'enregistrement des corrections là où Bifrost le permet. Aucun nouveau schéma de fiche ni mécanisme d'écriture alternatif n'est validé ici.

## 6. Priorité et persistance : règles vérifiées

### Configuration des providers, clés et alias

Une modification via l'interface ou l'API est persistée dans le config store puis appliquée au gateway. Elle ne réécrit pas automatiquement `config.json`. Au démarrage, `config.json` et la base sont réconciliés selon `source_of_truth` :

- `split` est le mode par défaut. Lorsque la configuration du provider dans le fichier est inchangée, une clé dont la déclaration fichier est inchangée conserve sa valeur administrée en base. Une clé modifiée dans le fichier est réappliquée. Les clés présentes seulement en base sont conservées dans ce cas.
- Attention : si la configuration du provider lui-même change dans le fichier, elle est réappliquée et des clés présentes seulement en base peuvent être écartées. Il ne faut donc pas résumer `split` par « la base gagne toujours ».
- `config.json` rend le fichier autoritaire pour les providers et clés lorsque la section `providers` est présente, y compris vide. Les entrées absentes du fichier peuvent être supprimées de la base. Si cette section est absente, Bifrost utilise les providers de la base.

Ces règles comparent les empreintes des déclarations fichier, pas simplement leur date de modification. L'empreinte du provider exclut ses clés ; les alias font partie de l'empreinte de chaque clé. Sources : [mode et valeur par défaut](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/lib/config.go#L335), [réconciliation](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/lib/config.go#L1395), [empreintes](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/configstore/clientconfig.go#L753).

Dans le fichier du gateway local de test, `source_of_truth` est absent et `providers` vaut `{}` : il est donc en mode `split`, avec les providers administrés en base. Ce constat local n'est pas une règle universelle de Bifrost.

### Propriétés issues du catalogue

| Propriété / usage | Source et priorité effectives |
| --- | --- |
| Enrichissement de `/v1/models` | Valeur déjà fournie par le provider conservée ; sinon complément du catalogue de pricing. Pour `context_length`, repli sur `max_input_tokens` si le catalogue ne fournit pas le contexte. `architecture` et `pricing` sont complétés comme objets entiers s'ils sont absents ; ce n'est pas une fusion de tous leurs sous-champs. `is_deprecated` est combiné par OU. |
| `/api/models/details` | Les propriétés techniques et tarifs de base viennent du catalogue. Cette route ne reproduit pas la fusion avec les propriétés d'une réponse live du provider. Les corrections tarifaires sont exposées séparément. |
| Capacités et paramètres | `model_parameters_url` alimente les données persistées et le cache utilisés par les lecteurs de capacités ; `/api/models/parameters` expose le document stocké. Des alias ou noms de base peuvent intervenir dans la résolution. |
| Coût d'une requête | Tarif de base, puis correction tarifaire applicable selon la portée et le modèle. La priorité des portées est : clé virtuelle + provider + clé provider, puis clé virtuelle + provider, puis clé virtuelle ; ensuite les mêmes combinaisons pour un utilisateur ; enfin clé provider, provider, global. Dans chaque portée, correspondance exacte avant préfixe générique le plus long ; le mode de requête peut filtrer les corrections. |
| `additional_attributes` | Champ éditorial natif modifiable par l'API catalogue. La synchronisation du pricing préserve ce champ. Ses valeurs ne remplacent pas les champs natifs homonymes. |

Sources : [fusion de la liste](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/handlers/inference.go#L941), [règles de complément](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/modelinfo.go#L44), [détails administratifs](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/transports/bifrost-http/handlers/providers.go#L868), [synchronisation des paramètres](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/datasheet/params.go#L55), [priorité des corrections tarifaires](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/datasheet/overrides.go#L212), [colonnes actualisées par la synchronisation](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/configstore/rdb.go#L2910).

Une valeur présente dans une datasheet est une déclaration, pas une preuve de fonctionnement obtenue par inférence. Une datasheet absente ne signifie pas que le provider est inaccessible.

## 7. Alias et routage natifs : faits établis avant le choix UX

Lecture des sources locales Bifrost 2.2.3, sans modification ni test d'inférence :

- L'alias natif d'une clé provider traduit un nom reçu vers un identifiant modèle cible. La résolution utilise le couple provider/modèle ; cette correspondance ne choisit pas, à elle seule, entre plusieurs providers. Sources : [KeyAliases et AliasConfig](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/core/schemas/account.go#L228), [résolution d'alias](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/keyconfig/store.go#L217).
- Governance peut choisir un provider lorsqu'aucun provider n'est déjà indiqué dans la requête. Les candidats dépendent des droits du modèle, des contraintes applicables et des poids configurés. Si plusieurs candidats pondérés restent et qu'aucun secours explicite n'est présent, les autres peuvent être ajoutés comme secours. Ce comportement dépend de la configuration ; cocher deux providers ne suffit pas à le prouver. Source : [LoadBalanceProvider](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/plugins/governance/main.go#L387).
- Les règles du plugin Routing peuvent choisir un provider, un modèle cible, éventuellement une clé, des poids et des secours. Leur portée peut être une VK, un utilisateur, une équipe, un client ou le niveau global. Sources : [cibles pondérées](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/plugins/routing/rules/engine.go#L250), [priorité des portées](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/plugins/routing/rules/engine.go#L386), [application des cibles](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/plugins/routing/main.go#L464).
- Registry utilise actuellement `Prefer[alias]` pour choisir statiquement un accès lorsqu'un nom commun est ambigu ; sans préférence, cette vue échoue. Cette sélection fixe ne constitue pas la répartition ou le secours natif décrits ci-dessus. Source : [compilation de la vue Registry](../../internal/registry/config.go#L490).

L'ordre complet des plugins et le parcours Registry vers l'inférence n'ont pas été qualifiés par cette lecture. Aucun mécanisme d'implémentation n'est retenu à ce stade. L'interface doit distinguer la liste des accès activés pour un modèle de la règle choisissant l'accès d'une requête. La vérification supplémentaire ci-dessous établit les correspondances UI et les conditions d'autorisation des alias.

### Le bloc natif « Deployments » montré par Sofian

Cette UI édite directement `Key.Aliases`. Chaque ligne appartient à une clé d'un provider ; elle ne crée ni une instance de modèle ni une règle de choix entre providers.

| Champ du formulaire natif | Propriété persistée | Sens |
| --- | --- | --- |
| Deployment name, placeholder Request model name | Clé du dictionnaire `aliases` | Nom demandé par le client, candidat pour l'identifiant commun de la model card |
| Model ID | `aliases[nom].model_id` | Identifiant effectivement envoyé à ce provider |
| Canonical model name | `aliases[nom].model_name` | Nom canonique servant notamment à retrouver les tarifs et les informations du modèle ; ce n'est pas simplement un nom d'affichage Registry |
| Model family | `aliases[nom].model_family` | Famille technique (`anthropic`, `openai`, etc.) utilisée par les adaptateurs ; distincte des catégories Text/Audio/Retrieval et de la série commerciale du modèle |
| Description | `aliases[nom].description` | Note informative, non utilisée pour le traitement Bifrost |
| Provider overrides | Champs optionnels de `AliasConfig` | Ajustements propres à cet accès : région, projet, endpoint, profil et autres paramètres selon le provider |

Sources : [formulaire](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/ui/app/workspace/providers/fragments/apiKeysFormFragment.tsx#L454), [table des deployments](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/ui/app/workspace/providers/fragments/deploymentsTable.tsx#L381), [contrat AliasConfig](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/core/schemas/account.go#L228).

#### Conditions natives établies

- Les alias et les autorisations restent séparés. Créer `aliases["sonnet-4.6"]` ne l'ajoute pas à `models` (Allowed Models). Les tests upstream vérifient cette séparation, y compris lorsqu'une clé n'autorise aucun modèle : [tests du magasin de clés](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/keyconfig/store_test.go#L347).
- Le catalogue peut reconnaître un provider pour un alias si cet alias y existe et que sa liste de modèles autorisés admet le nom demandé : [GetProvidersForModel](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/models.go#L267). Côté permissions de la VK, un nom explicitement autorisé peut être reconnu directement : [IsModelAllowedForProvider](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/models.go#L304).
- La sélection de clé filtre le nom demandé avant sa traduction. La clé doit donc autoriser ce nom d'alias, explicitement ou via une règle qui le couvre, et ne pas le bloquer. Une fois la clé sélectionnée, Bifrost résout sa propre entrée `aliases` vers le `model_id` avant l'appel : [filtrage](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/core/bifrost.go#L9449), [traduction par tentative](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/core/bifrost.go#L7349).
- Le champ Weight du formulaire de clé concerne le choix entre clés d'un provider. La pondération entre providers est distincte : [sélecteur de clés](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/core/keyselectors/weightedrandom.go#L9), [choix du provider](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/plugins/governance/main.go#L462).

#### Processus candidat, à qualifier avant de figer l'implémentation

1. La model card porte un identifiant commun et référence les accès existants, avec leurs clés providers pertinentes et leurs identifiants réels.
2. Pour chaque accès retenu, reprendre ou configurer sa correspondance native Deployments, en préservant les réglages existants et en présentant les changements d'autorisations nécessaires.
3. La sélection d'un groupe ou d'une VK définit les accès autorisés pour cette model card ; sa traduction en configuration Bifrost doit conserver cette restriction.
4. Pour une requête sur l'identifiant commun, laisser les mécanismes natifs choisir un provider admissible puis une clé ; la correspondance de cette clé produit l'identifiant effectivement envoyé au fournisseur.

Ce chemin permet d'étudier la réutilisation de Deployments et Governance sans imposer d'emblée une règle CEL ou une préférence fixe Registry. Il reste à qualifier avec deux providers isolés, une VK qui n'en autorise qu'un, une VK qui autorise les deux, et la vérification de l'identifiant réellement transmis. Le `Prefer` statique actuel de Registry ne doit pas être confondu avec ce comportement candidat.

## 8. Référence fusionnée et métadonnées — recherche du 25 septembre

Sofian propose de fusionner les datasheets Bifrost, Models.dev et d'autres sources pour enrichir la référence utilisée pendant l'enregistrement d'un accès existant. Il envisage aussi le stockage Registry et les paires clé/valeur natives. La répartition ci-dessous est une proposition, pas une décision d'implémentation validée.

Faits vérifiés :

- [Models.dev](https://github.com/anomalyco/models.dev#adding-model-metadata) distingue déjà les faits communs du modèle et ses déclinaisons par provider, reliées par `base_model`. Les déclarations du provider peuvent remplacer les valeurs communes de contexte, modalités, fonctionnalités et prix. Ses API `models.json`, `api.json` et `catalog.json` permettent de récupérer ces niveaux ; `?type=all` inclut aussi les types spécialisés.
- Les limites dépendent de l'accès et de ses conditions. Pour Sonnet 4.5, [Google](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/partner-models/claude/sonnet-4-5) documente un contexte 200k en GA et 1M en Preview ; la [fiche Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-4-5.html) indique 200k. Il faut conserver les conditions de la déclaration, sans transformer 1M en garantie universelle.
- Les opérations ont aussi des contraintes d'accès : le [prompt caching Bedrock](https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-caching.html) n'est pas disponible avec son API batch. La présence séparée de deux capacités dans une fiche ne prouve pas leur compatibilité en combinaison.
- Bifrost 2.2.3 accepte deux sources personnalisées : `pricing_url` charge un dictionnaire JSON d'entrées pricing ; `model_parameters_url` charge un dictionnaire JSON de documents de paramètres. HTTP(S) et `file://` sont possibles. Il faut convertir les sources vers ces contrats, pas concaténer leurs fichiers. Sources : [pricing](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/datasheet/sync.go#L164), [paramètres](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/modelcatalog/datasheet/params.go#L112).
- `additional_attributes` reste un dictionnaire de chaînes local au couple modèle/provider, préservé par la synchronisation. Il convient à des informations éditoriales ; une entrée nommée `context_length` n'écrit pas le champ technique homonyme. L'API remplace le dictionnaire et exige une ligne de pricing existante : [persistance](https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/framework/configstore/rdb.go#L2989).

Proposition à discuter : Registry assemble les sources, les correspondances confirmées et les corrections conservées ; ce catalogue alimente l'UI et produit deux exports compatibles Bifrost. Les propriétés existantes gardent leur sens. Le plugin conserve la provenance et les relations propres aux model cards/groupes ; les métadonnées éditoriales natives sont réutilisées lorsqu'elles conviennent. Une source d'écriture est définie par information ; les exports sont des projections, pas une deuxième copie éditable indépendante.

La fusion doit conserver les désaccords, les inconnues, les unités et la portée par accès. Elle ne prend ni le maximum des contextes ni le OU de toutes les capacités. Un rapprochement ambigu reste proposé à l'utilisateur. Le catalogue de référence peut être vaste sans rendre tous ses modèles configurés ou autorisés. Aucune combinaison de sources ne garantit l'inventaire de tous les modèles existants, notamment privés.

Le code possède déjà un import Bifrost/Models.dev et une séparation références/accès ([catalog.go](../../internal/admin/catalog.go#L539)). Cela constitue une base à réutiliser ; l'export natif, les conflits par propriété et leur application effective restent à qualifier. Aucun changement de source ni écriture gateway n'a été effectué.

### Précision de Sofian : réutiliser Models.dev et appliquer réellement les réglages

- Réutiliser en priorité les contrats et mécanismes existants de Models.dev **comme brique ou dépendance de notre plugin**. C'est Registry qui assure l'adaptation et l'application vers Bifrost. Éviter un nouveau schéma concurrent couvrant les mêmes informations. Les propriétés propres à Bifrost doivent rester représentées sans être perdues dans cette adaptation. Le choix précis de paquetage reste à qualifier ; cette frontière est confirmée par Sofian.
- La model card présente les données communes du modèle et celles de ses accès providers. L'utilisateur doit pouvoir affiner un accès quand il diffère, depuis cette même fiche.
- Une édition technique dans Registry doit préparer puis appliquer les réglages dans les champs réellement utilisés par Bifrost. La remarque sur `additional_attributes` décrit une mauvaise destination d'écriture, pas une limitation souhaitée de Registry à la documentation. L'état « appliqué » doit correspondre à une vérification native ; un champ non applicable ou un échec reste visible.

Proposition UX à examiner : choisir dans la fiche « Modèle » ou un accès provider, afficher la valeur effective et son origine (« héritée », « spécifique à cet accès », « correction locale »), permettre le retour à la valeur héritée, puis présenter les accès affectés avant l'application. Une correction locale d'un accès ne doit pas modifier silencieusement les autres accès.

Le code existant compose déjà les valeurs de référence puis celles de l'accès dans [catalogFieldsForAccess](../../internal/admin/catalog.go#L20). La réutilisation concerne donc aussi ce travail existant ; l'éditeur et l'application native restent à aligner avec les contrats retenus.

L'[audit du dépôt Models.dev](models-dev-reuse-research.md), fixé au commit `6a0b12bc9c66e1ab4fe44232d592a32df09a77e0`, détaille les fonctionnalités déjà réutilisables. Il distingue le moteur de catalogue, le SDK publié et le site : leur interface regroupe déjà les fournisseurs d'un modèle en relisant les liens `base_model` des sources, liens absents des JSON publics. Ce constat corrige l'analyse antérieure limitée à l'import de données ; il ne constitue pas une intégration livrée.

### Tranche (b) — application native des prix : décision de périmètre (27 septembre 2026)

Vérifié dans les sources Bifrost 2.2.3 épinglées (`dist/source-223-sparse`, commit `411d62b`) :

- `POST /api/governance/pricing-overrides` accepte `{name, scope_kind, user_id?, virtual_key_id?, provider_id?, provider_key_id?, match_type: exact|wildcard, pattern, request_types?, patch}` ; le `patch` est le `Options` de `framework/modelcatalog/datasheet/types.go` (coûts par token : `input_cost_per_token`, `output_cost_per_token`, paliers, etc.). Portées reconnues : `global`, `provider`, `provider_key`, `virtual_key`, `virtual_key_provider`, `virtual_key_provider_key`, `user`, `user_provider`, `user_provider_key` (`types.go:306-323`). `PUT` fusionne, `DELETE` supprime, `GET` liste avec filtres.
- Une correction de prix d'un accès Registry correspond nativement à une override de portée `provider_key` (clé du provider) avec `match_type: exact` et `pattern` = identifiant natif du modèle. Les tarifs Models.dev (USD par million de tokens) se convertissent en coût par token.

Décisions de périmètre pour cette tranche :

1. Les corrections de prix (`input_cost_usd_per_million`, `output_cost_usd_per_million`) deviennent des overrides natives idempotentes, nommées et suivies par Registry (création/mise à jour/suppression selon l'état du catalogue). La suppression d'une correction supprime l'override native ; la valeur héritée reprend alors seule.
2. Les limites descriptives (`context_length`, `max_output_tokens`) restent des corrections de catalogue Registry : aucune route native d'édition de fiche n'existe (§4), et écrire dans `additional_attributes` ne modifierait pas les champs natifs. L'UI affiche leur origine sans les présenter comme appliquées nativement.
3. Les budgets/réutilisations (`/api/governance/model-configs`) sont de la gouvernance, pas des propriétés de fiche : hors périmètre de cette tranche.
4. L'état « appliqué » exige une relecture native (`GET /api/governance/pricing-overrides` et/ou `overridden_pricing` de `/api/models/details`) ; un échec ou un champ non applicable reste visible dans l'UI, conformément à la précision de Sofian ci-dessus.
5. Une correction locale d'un accès n'écrit que l'override de cet accès ; les autres accès ne sont jamais modifiés implicitement.
