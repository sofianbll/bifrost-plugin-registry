# Référence de configuration

## Modèle du registre

`id` est l’identifiant local stable du modèle. `alias` est le nom exposable ; cette version impose des identifiants minuscules sans slash. `provider` est le nom exact du provider configuré dans Bifrost. `provider_key_ids` contient les identifiants non secrets des clés provider EXISTANTES où cet alias doit être déclaré.

`upstream_model` est la cible exacte envoyée par l’alias natif. `canonical_model` est exporté comme `model_name` pour le mapping canonique/pricing natif. `model_family` est exporté comme famille de protocole native : ce n’est **pas** une étiquette de classement et il ne faut pas la deviner. `creator`, `family`, `capabilities` et `metadata` sont des métadonnées d’administration. La famille de classement peut par exemple être `Claude` sans correspondre à la valeur native `anthropic`.

`endpoints` est une liste explicite des endpoints testés/autorisés pour ce modèle. Déclarer un endpoint ne l’implémente pas dans le provider. `enabled` et `verified` doivent être vrais pour qu’un modèle soit publiable. `verified: true` exige `evidence` non vide ; il s’agit d’une déclaration de l’administrateur dont l’exactitude n’est pas vérifiée automatiquement.

## Groupes

`model_ids` et `filter` sont réunis par UNION. Un filtre comprend les listes optionnelles `sources`, `creators`, `families`, `capabilities`.

À l’intérieur des sources/créateurs/familles, une correspondance suffit. Entre catégories, toutes les conditions doivent être satisfaites. Pour les capacités, toutes les capacités demandées doivent être présentes. `exclude` soustrait ensuite les identifiants précisés. Les modèles désactivés ou non vérifiés sont encore retirés lors de la compilation de chaque vue.

Un groupe sans modèles explicites et sans filtre non vide est invalide. Une politique sans aucun groupe est valide et interdit tout. Les membres de groupe sont des IDs locaux, pas des alias.

## Politiques de clés virtuelles

`virtual_key_id` est l’identifiant natif de la clé. `token_sha256` est l’empreinte du **jeton complet** ; ce champ ne doit jamais contenir le jeton brut. Le SDK client continue d’envoyer son vrai jeton `sk-bf-…` à Bifrost via `Authorization: Bearer …` ou `x-bf-vk`.

Pour produire l’empreinte sans secret dans l’historique du shell :

```bash
read -r -s -p 'Clé virtuelle Bifrost : ' BF_VK; printf '\n'
printf '%s' "$BF_VK" | ./dist/registry-linux-amd64 hash
unset BF_VK
```

Le prompt `read -p` de cet exemple est prévu pour Bash. Sur Mac, `go run ./cmd/registry hash` remplace le binaire Linux ; conserver la saisie secrète dans un shell compatible. Le panneau propose aussi un hachage WebCrypto local sur localhost/HTTPS ; ce parcours n’a pas été testé en contexte navigateur sécurisé lors de cette livraison.

`groups` autorise les groupes choisis. `sources` restreint encore leur union ; vide signifie « pas de filtre de source supplémentaire », pas « tout le catalogue ». `naming` surcharge `default_naming`.

| Format | Exemples | Collisions |
| --- | --- | --- |
| `provider/model` | `codex/reasoning` | Chaque source conserve son préfixe. |
| `model` | `reasoning` | Un seul gagnant autorisé pour chaque nom court. |
| `both` | Les deux | Tous les noms préfixés, plus un gagnant pour le nom court. |

`prefer` sélectionne un **ID local** : `{"reasoning":"codex-reasoning"}`. En format `model`, une source perdante ne devient pas implicitement accessible via son nom préfixé ; seuls les noms effectivement exposés sont acceptés. En format `both`, les autres sources restent accessibles avec leur préfixe. Une clé désactivée est rejetée, même si son empreinte reste dans la configuration.

## Déroulement d’une requête

Le moteur lit la clé virtuelle, retrouve une politique activée et prend un snapshot immutable. Il résout le nom exposé vers `provider/alias`, valide l’endpoint et les fallbacks explicites. Il ne résout pas lui-même vers `upstream_model` : ce travail appartient aux aliases natifs. Tous les autres champs JSON sont conservés sémantiquement, y compris outils, reasoning, signatures, `prompt_cache_key` et `previous_response_id`. La mise en forme JSON et l’ordre des propriétés peuvent changer.

Chaque tentative est limitée au primaire ou aux fallbacks explicitement demandés dans cette requête. Une règle native qui ajoute un autre fallback est refusée, même si ce modèle figure dans un autre groupe autorisé. Le corps `fallbacks` doit être une liste de noms exposés, de taille maximale 16. Les overrides de connexion et de clés provider documentés dans le code sont refusés ; la sécurité native Bifrost reste indispensable.

Les requêtes acceptées par le Registry sont encore soumises à l’authentification, à la sélection de clés provider, aux budgets et aux limites de Bifrost. Le Registry ne positionne jamais l’identité authentifiée : il vérifie celle que Bifrost produit, avant de rendre une réponse réussie au client.

## Catalogue public

Le moteur de projection exige une réponse native autorisée dont les entrées portent `provider/alias`. Il ne publie que les correspondances exactes ; un alias non présent dans la liste native n’est pas fabriqué. Seuls `id`, `object`, `created`, `owned_by` et, si présent, `shutdown_date` sont rendus. Le comportement exact du format natif `/models` de chaque version et provider doit être validé : sinon la projection reste vide ou échoue explicitement.

L’aperçu dans l’administration est seulement la vue calculée du registre. Il n’a pas la liste autorisée par le vrai Bifrost et ne prouve donc aucun accès amont.

## Plan et fusion

```bash
./dist/registry-linux-amd64 plan --config configs/registry.json --out plan.json
./dist/registry-linux-amd64 merge-aliases \
  --config configs/registry.json \
  --bifrost-config /copie/config.json \
  --out /copie/config.registry.json
```

Le plan est notre schéma de déploiement, pas celui d’un endpoint Bifrost. La fusion lit un `config.json` avec `providers` sous forme d’objet et des `keys` existantes ayant un `id`. Elle refuse les providers absents, les clés ambiguës et les collisions d’alias, y compris la casse et les définitions contradictoires sur une autre clé du même provider. Elle ne modifie pas les permissions de VK. Elle préserve les secrets et les paramètres dans la COPIE, qui reste donc sensible. Les fichiers de sortie existants ne sont jamais écrasés.

## API du panneau

Toutes les routes `/api/*` demandent un jeton d’administration Bearer, distinct des clés Bifrost. Les corps JSON sont limités à 4 Mio ; les clés JSON dupliquées et les propriétés de configuration inconnues sont refusées.

| Route | Contrat |
| --- | --- |
| `GET /api/config` | Configuration et ETag de révision. |
| `PUT /api/config` | Nouvelle configuration avec `If-Match` obligatoire. 428 si absent, 409 si conflit, 422 si invalide. |
| `POST /api/validate` | `{"config":{…}}` ; vérification structurelle du brouillon. |
| `POST /api/preview` | `{"config":{…},"virtual_key_id":"…"}` ; vue calculée sans accès amont. |
| `POST /api/plan` | `{"config":{…}}` ; compilation des primitives natives attendues. |
| `GET /api/status` | Statut du contrôle local ; ne revendique pas une connexion administrative à Bifrost ou un chargement `.so` vérifié. |
