# Jev (Typesafe) pour décider l'enregistrement d'un modèle

Recherche documentaire du 11 octobre 2026. **Aucun appel d'inférence (Jev ou autre) ni accès aux serveurs de Sofian.** Sources : Bifrost épinglé [`transports/v2.2.6`, `8b4fce4f`][bf] ([`bifrost.pin`](../../bifrost.pin)) ; documentation Typesafe lue le 11 octobre (mutable, sans version) ; snapshot Models.dev embarqué [`6a0b12bc`][md] et branche `dev` à [`0598d41d`][md-dev] ; datasheet Bifrost publique lue le 11 octobre (mutable) ; ce dépôt à `0de984b`. Ce document propose ; il ne décide rien.

## Question

Que prend et que renvoie Jev (`typesafe/jev-latest`), comment l'appeler via Bifrost (opération Registry `decisions`), avec quelles limites et quel coût, et peut-il décider comment enregistrer un modèle dans Registry — identifiant commun, accès fournisseurs regroupés dans une fiche, référence Models.dev, opérations exposées — à partir des données Models.dev, Registry et de la découverte Bifrost ? Comparaison avec l'assistance IA existante.

## Réponse courte

- Jev est un modèle « System One » de **décision typée**, pas un LLM : il reçoit un `state` (texte ou JSON) et des questions `noul` (probabilité oui/non), `choice` (une option parmi ≤ 255) ou `score` (échelle de 2 à 10 niveaux), et renvoie une valeur et des probabilités par question. Il ne génère ni texte, ni code, ni explication ([System One][ts-s1], [coding agents][ts-agents]).
- Dans Bifrost 2.2.6, le fournisseur `typesafe` ne sert que `POST /v1/decisions` (type de requête `decisions`) et la liste de modèles ; Chat Completions et Responses renvoient `unsupported_operation`. **Jev ne peut donc pas remplacer le modèle de l'assistant actuel**, limité à ces deux endpoints.
- Coût négligeable : 0,042 $ par million de jetons d'entrée, sortie gratuite ; une requête au plafond de 64 k jetons coûte environ 0,0027 $. Les limites de débit publiées sont mouvantes et diffèrent de la datasheet Bifrost.
- Adéquation **partielle** : Jev convient pour *choisir* parmi des candidats que le code a construits (référence Models.dev, appariement d'un accès à une référence), avec une confiance utilisable pour envoyer les cas douteux en revue. Il ne convient pas pour inventer un identifiant, remplir des champs libres ou numériques, ni décider des opérations exposées. Une partie de la décision est déjà déterministe (`base_model` Models.dev, `mode` Bifrost) et devrait passer avant toute IA.
- Toute réponse reste une proposition revue par l'administrateur, comme l'impose le glossaire ([`CONTEXT.md`](../../CONTEXT.md#L29-L30), [`#L60-L62`](../../CONTEXT.md#L60-L62)).

## Contrat d'entrée/sortie de Jev

| Élément | Contrat | Source |
|---|---|---|
| Appel natif | `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer`, corps `{state, model, questions}` | [API][ts-api] |
| `state` | chaîne, objet ou tableau ; texte uniquement (ni image, ni audio, ni vidéo) | [API][ts-api], [Models][ts-models] |
| Clés de `questions` | choisies par l'appelant, renvoyées dans `answers` ; **jamais envoyées au modèle** | [API][ts-api] |
| `noul` | `instructions` requis ; `criteria` optionnel `{true, false}` ; réponse : nombre 0–1, sans `confidence` | [API][ts-api], [Confidence][ts-conf] |
| `choice` | `criteria` requis, option → description (ou `null`), 255 options maximum ; les noms d'options **et** leurs descriptions sont envoyés au modèle ; réponse : option la plus probable, `probabilities` sur toutes les options, `confidence` | [API][ts-api], [Choice][ts-choice] |
| `score` | `criteria` tableau ordonné de 2 à 10 niveaux ; réponse : valeur pondérée (peut tomber entre deux niveaux), `legend`, `probabilities`, `confidence` | [API][ts-api] |
| Usage | `input_tokens`, `output_tokens` ; seule l'entrée est facturée | [API][ts-api], [Models][ts-models] |
| Erreurs | 401, 422 (validation), 429 (débit), 529 (surcharge) ; retenter 429/529 avec backoff | [API][ts-api] |
| Non documenté | nombre maximal de questions, taille maximale de `state` hors budget de contexte, latence chiffrée, délai d'expiration | [API][ts-api] (vérifié par absence) |

`confidence` vaut 1 quand toute la probabilité est sur une issue et 0 quand elle est uniformément répartie ; Typesafe recommande d'agir automatiquement seulement au-dessus d'un seuil propre à chaque action et d'escalader vers un humain sinon ([Confidence][ts-conf]).

Exemple de la documentation Bifrost, réduit à une question ; `usage` est celui de l'exemple complet à trois questions (requête via la passerelle, réponse normalisée par Bifrost) — [`typesafe.mdx` L65-L110][bf-doc-ex] :

```json
{
  "model": "typesafe/jev-1.13.0",
  "state": "Customer message: I was double charged and nobody replied. I want a refund today.",
  "questions": {
    "category": {
      "kind": "choice",
      "instructions": "Pick the ticket category",
      "criteria": { "billing": "charges and refunds", "bug": "product defects", "other": "anything else" }
    }
  }
}
```

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "category": { "kind": "choice", "value": "billing", "confidence": 1, "probabilities": { "billing": 1, "bug": 0, "other": 0 } }
  },
  "usage": { "prompt_tokens": 437, "completion_tokens": 72, "total_tokens": 509 }
}
```

Bifrost renomme `type` en `kind` et unifie `noul`/`choice`/`score` dans `value` ([mapping L112-L153][bf-doc-map]). La réponse indique la version résolue (`jev-1.13.0`) même si la requête utilise un alias.

## Routage dans Bifrost 2.2.6

| Point | Constat au commit épinglé | Source |
|---|---|---|
| Fournisseur | `schemas.Typesafe = "typesafe"`, présent dans les tags 2.2.3 à 2.2.6 | [`bifrost.go` L79][bf-provider] |
| Configuration | clé bearer (`env.TYPESAFE_API_KEY` dans l'exemple), `models: ["*"]` ; URL de base par défaut `https://api.typesafe.ai`, chemin amont `/v1/systemone` ; délai réseau par défaut 300 s | [doc L34-L53][bf-doc-setup], [`utils.go` L9-L15][bf-ts-utils], [`provider.go` L16][bf-timeout] |
| Endpoint unifié | `POST /v1/decisions`, champs connus `model`, `state`, `questions`, `fallbacks` ; type de requête `decisions` | [`inference.go` L224-L229, L731, L787, L1303-L1351][bf-inf], [`bifrost.go` L195][bf-reqtype] |
| Validation locale | `kind` hors `noul/choice/score`, `instructions` absentes, critères mal formés : 400 avant tout appel amont. Chaque question doit recevoir une réponse du bon type, sinon échec global | [`decision.go` L55-L116, L254-L309][bf-ts-decision] |
| Autres opérations | Chat Completions, Responses, Embeddings, Text Completions… : `unsupported_operation` | [`unsupported.go` L211-L224][bf-ts-unsup] |
| Liste de modèles | catalogue **statique** (`jev-1.13.0`, `jev-latest`, `jev-preview`), aucun appel amont, filtré par les listes de la clé | [`typesafe.go` L68-L124][bf-ts-list], [`utils.go` L25-L50][bf-ts-utils] |
| Intégration native | `/typesafe/v1/systemone` et `/typesafe/v1/models`, forme Typesafe | [`integrations/typesafe.go` L28-L80][bf-ts-int] |
| Émulation | si un fournisseur sans décision native reçoit `/v1/decisions`, Bifrost émule via son API Responses (outil forcé `emit_decision`), y compris en repli | [`bifrost.go` L7970-L7995][bf-dispatch], [`decisionemulation.go` L22-L114][bf-emul] |
| Coût | `decisions` tarifé sur `prompt_tokens` × prix d'entrée (+ sortie, nulle pour Jev) | [`cost.go` L1230-L1242][bf-cost], [`types.go` L453-L454][bf-mode] |

Côté Registry, `decisions` fait déjà partie des neuf opérations exposables ([`config.go` L201](../../internal/registry/config.go#L201)) et correspond au type natif `decisions` pour les corrections de prix ([`pricing_overrides.go` L85](../../internal/admin/pricing_overrides.go#L85)). Une clé liée à une politique Registry ne peut appeler Jev utilement que par `/v1/decisions` et seulement si l'accès Jev expose `decisions` ([`runtime.go` L156-L166, L184, L228](../../internal/registry/runtime.go#L156-L166), [test L563](../../internal/registry/registry_test.go#L563)). Le préfixe `/typesafe/` n'est pas couvert par le garde (400 `registry_unsupported_endpoint`). À l'inverse, le garde accepte `/openai/v1/decisions`, alors que l'intégration OpenAI de Bifrost 2.2.6 n'a aucune route `decisions` ([`integrations/openai.go`][bf-openai], vérifié par absence).

Écart de documentation : Bifrost écrit que Typesafe ne documente pas de liste de modèles ([doc L31][bf-doc-ops]) ; la page Models de Typesafe documente aujourd'hui `GET /v1/models` ([Listing models][ts-models-list]). De même, la doc Bifrost dit refuser les descriptions `choice` non textuelles ([doc L133][bf-doc-map]) alors que le code accepte `null` ([`decision.go` L137-L139, L226-L229][bf-ts-decision]).

## Limites et coût

| Grandeur | Typesafe (propriétaire) | Datasheet Bifrost (`typesafe/jev-latest`, lue le 11 oct.) | Models.dev |
|---|---|---|---|
| Prix | 42 $/Btok = 0,042 $/Mtok en entrée ; sortie gratuite | `input_cost_per_token` 4,2e-8 ; sortie 0 | offres : entrée 0,042, sortie 0 ; `opencode/jev-1.13-free` à 0 |
| Contexte | 64 k par requête (`state` + toutes les questions) ; 32 k pour `state` + la plus longue question | `max_input_tokens` 65 536 | référence 64 000, sortie 0 ; offres Cloudflare, Nano-GPT, Vercel à 32 000 |
| Débit | 100 k jetons/s et 80 req/s, **variables sans préavis** | `rpm` 1 200, `tpm` 15 000 000 | — |
| Modalités | texte uniquement | `supported_modalities: ["text"]`, pas d'outils | entrée/sortie `text` |
| Version | `jev-latest` et `jev-preview` → `jev-1.13.0` ; un alias peut changer de version sans préavis | `base_model: jev-1.13.0` pour les trois IDs | référence unique `typesafe/jev-latest`, `type = "decision"` |

Sources : [Models][ts-models], datasheet [`getbifrost.ai/datasheet`][bf-ds] et [`model-parameters`][bf-ds-params], [`jev-latest.toml`][md-jev], snapshot embarqué [`modelsdev.json.gz`](../../internal/admin/data/modelsdev.json.gz).

La datasheet ne correspond pas aux limites publiées par Typesafe : 1 200 req/min contre 4 800, et 15 M jetons/min contre 6 M. Ce sont les valeurs Typesafe qui font foi. Estimation, non mesurée : 3 000 jetons d'entrée coûtent environ 0,000126 $ ; 64 000 jetons, environ 0,0027 $. Le coût ne sera donc pas un obstacle ; il faudra surveiller les 429. Typesafe déclare une précision meilleure en anglais et l'absence d'entraînement sur les requêtes clients ([Models][ts-models]).

## Adéquation à la décision « enregistrer un modèle »

### Ce qui est déjà déterministe

- **Référence Models.dev** : Registry relie un accès configuré seulement si le couple fournisseur/modèle Bifrost existe exactement dans Models.dev, puis suit `base_model` ([`modelsdev_snapshot.go` L109-L149](../../internal/admin/modelsdev_snapshot.go#L109-L149)). Models.dev n'a **aucun fournisseur `typesafe`** (snapshot et `dev`) ; l'accès Bifrost `typesafe/jev-latest` ne se relie donc pas automatiquement, bien que la référence `typesafe/jev-latest` existe. C'est exactement le cas résiduel où une aide au choix servirait.
- **Regroupement d'accès** : dans le snapshot, les six offres Models.dev de Jev portent toutes `base_model = "typesafe/jev-latest"` sous des IDs différents (`typesafe/jev`, `typesafe-ai/jev`, `jev`, `jev-1.13`, `jev-1.13-free`, `typesafe/jev-latest`) ; `dev` ajoute des offres OpenRouter et Nano-GPT, non examinées. Le `base_model` de la datasheet Bifrost désigne au contraire la version résolue (`jev-1.13.0`), dans un autre espace de noms.
- **Opérations exposées** : la datasheet Bifrost déclare `mode: "decisions"` pour les trois IDs Typesafe. Registry lit ce `mode` via `/api/models/parameters` ([`catalog.go` L575, L593](../../internal/admin/catalog.go#L575)), mais la table de présélection de l'éditeur ne connaît pas `decisions` ([`model-editor-data.ts` L47-L56](../../ui/src/features/catalog/model-editor-data.ts#L47-L56)) : rien n'est présélectionné pour Jev. Une entrée de table suffirait ; aucune IA n'est nécessaire. Le `type = "decision"` de Models.dev n'est pas importé ([`modelsdev_snapshot.go` L223-L236](../../internal/admin/modelsdev_snapshot.go#L223-L236)). Je n'ai pas vérifié ce que renvoie la passerelle de Sofian.

### Ce que Jev pourrait décider

| Sous-décision | Entrée construite par le code | Question Jev | Sortie exploitable |
|---|---|---|---|
| Référence Models.dev d'un accès non apparié | `state` : accès (fournisseur, ID natif, `mode`/limites/prix Bifrost) + candidats Models.dev préfiltrés en code | `choice` dont les options sont les IDs de référence + `aucune` | ID choisi, `probabilities`, `confidence` |
| Accès à regrouper dans une fiche | fiche ou référence cible + accès Bifrost découverts | une `noul` par accès candidat (« même modèle ? »), toutes dans une requête ; ou un `score` à trois issues (différent / à revoir / identique), comme le [cookbook d'alignement d'entités][ts-align] | probabilité par accès ; cas médians en revue |
| Identifiant commun | IDs candidats générés en code et conformes au [slug Registry](../../internal/registry/config.go#L191) | `choice` éventuel | utile seulement si une règle de nommage existe ; il n'y a pas de vérité terrain |
| Opérations exposées | — | non recommandé | choix d'autorisation de l'administrateur, qui ne prouve pas le support ([`CONTEXT.md` L60-L62](../../CONTEXT.md#L60-L62)) ; la source factuelle est `mode` |

Requête illustrative, **non exécutée**, pour le premier cas :

```json
{
  "model": "typesafe/jev-latest",
  "state": {
    "access": { "provider": "typesafe", "native_model": "jev-latest", "bifrost_mode": "decisions", "bifrost_base_model": "jev-1.13.0" },
    "candidates": {
      "typesafe/jev-latest": { "name": "Jev", "type": "decision", "context": 64000 },
      "mistral/magistral-medium-latest": { "name": "Magistral Medium (latest)", "context": 128000 }
    }
  },
  "questions": {
    "reference": {
      "kind": "choice",
      "instructions": "Which entry of `candidates` is the same model as `access`?",
      "criteria": { "typesafe/jev-latest": "Jev by Typesafe", "mistral/magistral-medium-latest": "Magistral Medium by Mistral", "none": "No candidate is the same model" }
    }
  }
}
```

### Écarts et risques

- **Pas de génération** : Jev choisit parmi les options fournies et ne produit pas de nom, de série ni de valeur libre ([Generation][ts-jag-gen]). Les candidats doivent donc venir du code. Il ne peut pas inventer un accès absent des options ; il peut en revanche en regrouper un à tort. Une fusion erronée coûte plus cher qu'un doublon : il faut une issue intermédiaire envoyée en revue ([alignement d'entités][ts-align]).
- **Validation à garder dans Registry** : sur le chemin natif Typesafe, Bifrost vérifie le type de chaque réponse, mais pas que la `choice` appartient aux options ([`decision.go` L283-L287][bf-ts-decision]). Le chemin émulé, lui, le vérifie ([`utils/decisionemulation.go` L598-L607][bf-emul-parse]). Registry doit donc revalider comme il le fait déjà pour `referenceId` ([`assistant.go` L419-L430](../../internal/admin/assistant.go#L419-L430)).
- **Défauts connus de `jev-1.13`** ([jaggedness][ts-jag]) : biais vers la première option (faire tourner l'ordre et comparer), lecture littérale, chiffres, dates et comparaisons numériques peu fiables (comparer contextes et prix en code), contexte dégradé par les données inutiles (préfiltrer : 428 références dans le snapshot, 255 options au maximum), contenu adverse pris en compte (descriptions et noms viennent de sources externes).
- **Reproductibilité** : `jev-latest` peut changer de version sans préavis ; Typesafe conseille d'épingler l'ID versionné si des seuils de confiance ont été réglés ([Aliases][ts-models-alias]).
- **Opérations par accès** : Jev ne sert pas Chat ni Responses chez `typesafe`, alors que la datasheet classe les offres OpenRouter et opencode-zen en `mode: "chat"` (non vérifié). Une fiche Jev regroupant ces accès devrait donc exposer des opérations différentes selon l'accès.
- **Revue humaine obligatoire** : une ressemblance de nom ne suffit pas à établir l'identité ([`CONTEXT.md` L29-L30](../../CONTEXT.md#L29-L30)) ; l'assistance ne sauvegarde ni ne publie ([`catalog-assistance.md` L11](catalog-assistance.md)).
- **Qualité non mesurée** : aucune évaluation sur des cas Registry réels n'a été faite. Il faudra un jeu d'exemples étiquetés et un budget d'appels explicite.

## Comparaison avec `/api/assistant/suggest`

| Aspect | Assistant actuel | Jev via `/v1/decisions` |
|---|---|---|
| Endpoint | `chat_completions` ou `responses` seulement ([`config.go` L368](../../internal/registry/config.go#L368), [`AssistantSettings.tsx` L93](../../ui/src/features/assistant/AssistantSettings.tsx#L93)) | `decisions` seulement |
| Entrée | brouillon de 6 champs (≤ 4 096 octets) + ≤ 30 références trouvées par sous-chaîne ([`assistant.go` L231, L288-L340](../../internal/admin/assistant.go#L288-L340)) | `state` jusqu'à 64 k jetons + questions typées |
| Sortie | JSON libre demandé par consigne : `referenceId` + ≤ 9 champs (nom, créateur, série, contexte, modalités, capacités) ([L345](../../internal/admin/assistant.go#L345)) | valeurs typées et probabilités ; aucun champ libre |
| Contrôle | parsing strict, `referenceId` limité aux candidats, valeurs validées ([L414-L457](../../internal/admin/assistant.go#L414-L457)) | type garanti par Bifrost ; appartenance de la `choice` à revalider |
| Signal d'incertitude | aucun | `confidence` / `probabilities`, utilisables comme seuil de revue |
| Coût et délai | modèle choisi, ≤ 700 jetons de sortie, 15 s ([L265, L348-L351](../../internal/admin/assistant.go#L342-L352)) | 0,042 $/Mtok en entrée ; latence non documentée |
| Périmètre | métadonnées de fiche et une correspondance de référence | correspondance et regroupement ; ni identifiant, ni opérations, ni champs |
| Revue | lignes cochées par champ ; champs vides seulement par défaut ; la référence n'est pas cochée par défaut et s'applique à tous les accès ([`assistant-proposal.ts` L20-L44](../../ui/src/features/assistant/assistant-proposal.ts#L20-L44)) | même principe, à concevoir |

Conséquence pratique : Jev serait un complément ciblé sur la correspondance, pas un remplaçant de l'assistant. Il faudrait ajouter l'endpoint `decisions` aux réglages et au code d'inférence. Aujourd'hui, les réglages acceptent tout modèle visible par la clé ([`assistant.go` L107-L123](../../internal/admin/assistant.go#L107-L123)) : choisir `typesafe/jev-latest` avec Chat ou Responses s'enregistrerait, puis chaque suggestion échouerait (`unsupported_operation`, traduit en « Bifrost inference failed »). Ce comportement est déduit du code ; il n'a pas été exécuté. Autre option : comme Bifrost émule `/v1/decisions` sur les LLM, l'assistant pourrait adopter ce contrat typé tout en gardant son LLM actuel, à son coût. L'accès doit alors exposer `decisions`.

## Questions ouvertes pour Sofian

1. L'objectif est-il d'ajouter une étape de correspondance (choisir la référence, regrouper les accès) ou de remplacer l'assistant de champs ? Jev ne peut faire que la première.
2. Faut-il d'abord combler les règles déterministes (`mode: decisions` → `decisions`, `base_model` Models.dev) et n'appeler l'IA que sur le résidu ?
3. `jev-latest`, `jev-1.13.0` et `jev-preview` vont-ils dans une seule fiche (identifiant commun `jev-latest` ?) ou en fiches séparées, sachant que les alias bougent ? Les accès OpenRouter et opencode, de mode « chat », vont-ils dans la même fiche ?
4. Quels seuils de confiance pour proposer automatiquement, signaler en revue ou ne rien proposer ? Faut-il un contrôle par permutation de l'ordre des options ?
5. Quelle clé appellerait Jev : une clé native ou une clé liée à une politique Registry (l'accès Jev doit alors exposer `decisions`) ? Quel budget et quel jeu d'exemples étiquetés pour une campagne d'évaluation ?
6. Quelle version de Bifrost sert réellement le fournisseur `typesafe` chez Sofian (présent dans les tags 2.2.3 à 2.2.6) ? Faut-il vérifier `/api/models/parameters` pour `typesafe/jev-latest` en lecture seule ?

## Sources

[bf]: https://github.com/maximhq/bifrost/tree/8b4fce4f1709d66f9208d02f50552da522535f9e
[bf-doc-ex]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/docs/providers/supported-providers/typesafe.mdx#L65-L110
[bf-doc-map]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/docs/providers/supported-providers/typesafe.mdx#L112-L153
[bf-doc-ops]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/docs/providers/supported-providers/typesafe.mdx#L17-L32
[bf-doc-setup]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/docs/providers/supported-providers/typesafe.mdx#L34-L53
[bf-provider]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/schemas/bifrost.go#L79
[bf-reqtype]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/schemas/bifrost.go#L195
[bf-timeout]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/schemas/provider.go#L16
[bf-inf]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/transports/bifrost-http/handlers/inference.go#L731
[bf-dispatch]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/bifrost.go#L7970-L7995
[bf-emul]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/decisionemulation.go#L22-L114
[bf-emul-parse]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/providers/utils/decisionemulation.go#L598-L607
[bf-ts-utils]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/providers/typesafe/utils.go#L9-L50
[bf-ts-list]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/providers/typesafe/typesafe.go#L68-L124
[bf-ts-decision]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/providers/typesafe/decision.go
[bf-ts-unsup]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/core/providers/typesafe/unsupported.go#L211-L224
[bf-ts-int]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/transports/bifrost-http/integrations/typesafe.go#L28-L80
[bf-openai]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/transports/bifrost-http/integrations/openai.go
[bf-cost]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/framework/modelcatalog/datasheet/cost.go#L1230-L1242
[bf-mode]: https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/framework/modelcatalog/datasheet/types.go#L453-L454
[bf-ds]: https://getbifrost.ai/datasheet
[bf-ds-params]: https://getbifrost.ai/datasheet/model-parameters
[md]: https://github.com/anomalyco/models.dev/tree/6a0b12bc9c66e1ab4fe44232d592a32df09a77e0
[md-dev]: https://github.com/anomalyco/models.dev/tree/0598d41da9fd1025030e89abb58b7566cb679702
[md-jev]: https://github.com/anomalyco/models.dev/blob/6a0b12bc9c66e1ab4fe44232d592a32df09a77e0/models/typesafe/jev-latest.toml
[ts-api]: https://docs.typesafe.ai/api
[ts-models]: https://docs.typesafe.ai/models
[ts-models-alias]: https://docs.typesafe.ai/models#aliases
[ts-models-list]: https://docs.typesafe.ai/models#listing-models
[ts-s1]: https://docs.typesafe.ai/concepts/system-one
[ts-agents]: https://docs.typesafe.ai/introduction/coding-agents
[ts-choice]: https://docs.typesafe.ai/primitives/choice#request-structure
[ts-conf]: https://docs.typesafe.ai/confidence
[ts-jag]: https://docs.typesafe.ai/model-jaggedness/jev-1.13
[ts-jag-gen]: https://docs.typesafe.ai/model-jaggedness/jev-1.13#generation
[ts-align]: https://docs.typesafe.ai/cookbooks/entity_alignment

- Bifrost épinglé : provider Typesafe, schéma de décision, routes, émulation et coût (liens ci-dessus) ; [OpenAPI `decisions`](https://github.com/maximhq/bifrost/blob/8b4fce4f1709d66f9208d02f50552da522535f9e/docs/openapi/schemas/inference/decisions.yaml).
- Models.dev : [`filter.ts` L1-L40](https://github.com/anomalyco/models.dev/blob/6a0b12bc9c66e1ab4fe44232d592a32df09a77e0/packages/core/src/filter.ts#L1-L40) (`decision` est l'unique type ; exclu par défaut de l'API publique), référence et offres Jev dans le snapshot embarqué.
- Typesafe : [Models][ts-models], [API][ts-api], [System One][ts-s1], [Confidence][ts-conf], [jaggedness `jev-1.13`][ts-jag] (revue du 2 octobre 2026), [alignement d'entités][ts-align].
- Registry : [assistance de catalogue](catalog-assistance.md), [recherche Models.dev](models-dev-reuse-research.md), [glossaire](../../CONTEXT.md).
