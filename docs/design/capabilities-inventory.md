# Inventaire des capacités — audit du 23 septembre 2026

Inventaire établi par lecture du code à `503e775`, corrigé pendant l'audit du 23 septembre. Les priorités en fin de document sont des pistes ; le [cadrage produit](product-direction.md) porte les besoins et l'ordre de travail retenus. Toutes les références sont de la forme `fichier:ligne`.

Périmètre : moteur (`internal/registry/`), serveur admin (`internal/admin/`), UI web (`internal/admin/web/`), adaptateur natif (`native/main.go`), CLI (`cmd/registry/main.go`), config de prod (`configs/registry.prod.json`).

---

## 1. Modèle de données et capacités du moteur

### 1.1 Structures (`internal/registry/config.go`)

**`Config`** (`config.go:22-28`) : racine du document.
- `schema_version` (doit valoir 1, `config.go:261`), `default_naming` (`model` | `provider/model` | `both`, `config.go:116`), `models[]`, `groups[]`, `policies[]`.
- Limites de taille : 10 000 modèles, 1 000 groupes, 1 000 politiques (`config.go:267`).

**`Model`** (`config.go:30-52`) — un modèle du catalogue :
- Identité : `id` (slug minuscule), `alias` (slug minuscule), `provider` (identifiant Bifrost natif, casse libre, `config.go:112`), `provider_key_ids[]` (obligatoire, unique, non secret, `config.go:288`).
- Ciblage : `upstream_model` (cible exacte de l'alias natif), `canonical_model` (exporté pour le pricing natif), `model_family` (famille de protocole native, liste fermée : anthropic, openai, mistral, cohere, gemini, gemma, llama, imagen, veo, nova, titan — `config.go:113,285`).
- Métadonnées d'admin : `creator`, `family`, `capabilities[]`, `metadata` (map JSON libre), `evidence` (obligatoire si `verified`, `config.go:304`).
- Gouvernance : `endpoints[]` (liste fermée de 6 valeurs, `config.go:114,296-303`), `enabled`, `verified`.
- **Passthrough** : `passthrough` + `routing_targets[]` (`config.go:50-51`). Marque les alias dont la résolution appartient aux règles de routage CEL de Bifrost : la garde valide mais ne réécrit jamais le champ `model`, et pré-autorise les cibles natives `Provider/model` de la règle pour les contrôles post-routage (`config.go:46-49`, `runtime.go:190-192`). Exige `routing_targets` unique et bien formé (`config.go:307-318`).
- Unicité de l'identité native : collision interdite sur `provider/alias` (`config.go:319-324`).

**`Group`** (`config.go:61-67`) :
- `id`, `name`, `model_ids[]` (membres explicites), `filter` (`Filter`, `config.go:54-59` : `sources`, `creators`, `families`, `capabilities`), `exclude[]`.
- Sémantique (`config.go:343-377`) : UNION de `model_ids` et du filtre ; OU au sein d'une catégorie, ET entre catégories, toutes les capacités requises ; `exclude` soustrait en dernier. Un groupe vide sans filtre est invalide (`config.go:337-342`).

**`Policy`** (`config.go:69-78`) — la vue d'une clé virtuelle :
- `virtual_key_id` (identifiant natif Bifrost), `name`, `token_sha256` (empreinte SHA-256 du jeton complet, hex minuscule 64 car., unique, `config.go:387-392`), `naming` (surcharge `default_naming`), `groups[]`, `sources[]` (filtre additionnel par provider), `prefer` (map `alias → model_id`, pour départager les noms courts, `config.go:420-425,448-455`), `enabled`.

**`Route`** (`config.go:80-91`) — entrée exposée : `exposed_id`, `registry_id`, `provider`, `alias`, `upstream_model`, `endpoints`, `passthrough`, `routing_targets`. Identité native = `provider/alias` (`NativeID()`, `config.go:91`).

**`View`** (`config.go:93-98`) : `Policy` + `Routes[]` + index par `exposed_id` + index natif (sans les passthrough, `config.go:431-433`).

**`Snapshot`** (`config.go:100-105`) : config compilée, `views` par `virtual_key_id`, `tokens` par empreinte, `revision` (SHA-256 du JSON canonique, `config.go:464-466`).

### 1.2 Opérations du moteur

- **`Parse(data)`** (`config.go:220-229`) : valide JSON strict (pas de clés dupliquées, profondeur ≤ 100, champs inconnus refusés) puis compile. Limite 4 Mio.
- **`Compile(c)`** (`config.go:230-468`) : normalise, valide tout le graphe (slugs, références, collisions natives, préférences), matérialise les membres de groupes, calcule les routes exposées par politique et la révision. Copie profonde → snapshot immuable.
- **`Prepare(req)`** (`runtime.go:132-243`) : point d'entrée par requête HTTP. Valide endpoint/méthode, extrait la clé virtuelle (`x-bf-vk` ou `Bearer`, `runtime.go:89-116`), lie la politique par empreinte, refuse les overrides de clés (`x-bf-direct-key` etc., `runtime.go:152-157`), résout le modèle demandé dans la vue (`registry_model_hidden` sinon), pré-autorise les routes et `routing_targets`, réécrit `body.model` en identité native (sauf passthrough), valide et réécrit `fallbacks[]` (max 16, `runtime.go:208-235`), refuse les champs bruts `provider`/`api_key`/`base_url`. Produit une **`Session`** portant snapshot, vue, endpoint et `allowed` (routes autorisées pour cette requête).
- **`CheckAttempt(provider, model)`** (`runtime.go:50-68`) : exécuté à CHAQUE tentative provider après routage ; la tentative doit rester dans `allowed` ou dans la vue native (`registry_route_denied` sinon).
- **`Project(body, authenticatedID)`** (`runtime.go:248-308`) : intersecte la réponse native `/v1/models` avec les routes de la vue ; ne jamais annoncer un alias absent de la réponse Bifrost ; renvoie l'enveloppe OpenAI `{object:"list", data:[…]}` avec `shutdown_date` préservé.
- **`VerifyIdentity(authenticatedID)`** (`runtime.go:41-46`) : vérifie que l'identité de clé virtuelle confirmée par la gouvernance Bifrost correspond à la politique liée (`registry_identity_mismatch`).
- Autres capacités : **`Plan()`** (`plan.go:32-84`, cf. §2), **`MergeAliases(configBifrost)`** (`plan.go:89-172`, cf. §5), `Store.Load/Save` avec écriture atomique et contrôle d'optimistic locking (`store.go:35-61`), `Credential/Endpoint` (`runtime.go:89-131`).

---

## 2. API admin (`internal/admin/server.go`)

Sert uniquement `index.html`, `app.js`, `app.css` (embed, `server.go:65-91`) et les routes `/api/*`. Auth : `Authorization: Bearer <token admin ≥ 32 car.>` comparé en temps constant (`server.go:30-41,93-103`) ; hosts restreints (localhost par défaut + `AdminAllowedHosts`, `server.go:34-39,50-57`) ; anti-CSRF par contrôle d'`Origin` (`server.go:58-64`) ; CSP stricte (`server.go:49`). Aucun rôle secondaire : un seul niveau d'accès (tout ou rien).

| Endpoint | Méthode | Auth | Rôle |
|---|---|---|---|
| `GET /api/status` | GET | Bearer | Version, révision du snapshot en mémoire, `mode: "local-control-plane"`, `bifrost_connected: false`, `native_apply: "manual"`, `adapter_build: "not_checked_by_control_plane"` (`server.go:105-109`). **Jamais appelé par l'UI.** |
| `GET /api/config` | GET | Bearer | Renvoie la `Config` du snapshot courant + `ETag: "<revision>"` (`server.go:110-115`). |
| `PUT /api/config` | PUT | Bearer | Sauvegarde atomique avec `If-Match` obligatoire (428 sinon) ; 409 en conflit de révision, 422 en erreur de validation (`server.go:117-139`). Double contrôle disque contre les éditions concurrentes (`store.go:45-57`). |
| `POST /api/validate` | POST | Bearer | Parse la config candidate ; 200 `{valid, revision}` ou 422 (`server.go:140-160,174`). |
| `POST /api/preview` | POST | Bearer | Corps `{config, virtual_key_id}` → compile et renvoie la `View` (404 clé inconnue) (`server.go:165-172`). |
| `POST /api/plan` | POST | Bearer | Corps `{config}` → renvoie `NativePlan` : `registry_revision`, `provider_keys[]` (provider/key_id + alias `{model_id, model_name, model_family}`), `virtual_keys[]` (`allowed_models_by_provider`, `provider_key_ids_by_provider`), `warnings[]` (`server.go:161-164`, `plan.go:25-37`). |

Limites de l'API : corps JSON ≤ 4 Mio (`server.go:184`) ; pas de pagination, pas de filtrage serveur ; pas de endpoint de santé du store, de rechargement, de diff disque/mémoire, de statistiques runtime, ni d'application native (`merge-aliases` n'existe qu'en CLI, `cmd/registry/main.go:68-80`).

---

## 3. UI web actuelle (`internal/admin/web/app.js`, `index.html`)

SPA vanilla JS, 100 % statique, en français, thème sombre/clair (`app.js:122`). Jeton admin saisi à la main, gardé en mémoire d'onglet uniquement (aucun stockage navigateur, `index.html:18`, `app.js:120-121`).

**Onglets** (`app.js:11-17`, `index.html:26-32`) :

1. **Modèles** — 4 cartes de stats (modèles, sources, groupes, publiables, `app.js:52`), recherche plein texte + 3 filtres (source/créateur/famille, `app.js:53-61`), tableau avec badge de publication, édition/suppression. Import JSON (`app.js:118,131-132`).
2. **Groupes** — cartes (membres explicites, filtre dynamique, exclusions), éditeur avec cases à cocher pour `model_ids`/`exclude` et champs de filtre (`app.js:63-65,87`).
3. **Clés virtuelles** — liste des politiques (id natif, format, groupes), bouton **« Aperçu /models »** (modal des routes exposées, `app.js:104-107`), éditeur avec hachage WebCrypto local du jeton brut (`app.js:88,96`).
4. **Déploiement** — 4 étapes statiques : vérifier (`/api/validate`), voir/exporter le plan (`/api/plan`), commande `merge-aliases`, build `.so` (`app.js:71-74`). Badge « Application manuelle ». Aucune action native.
5. **Réglages** — `default_naming`, export JSON, import JSON, rechargement du fichier (`app.js:75-78,110,117`).

**Modèle d'édition** : brouillon local + validation du brouillon entier avant chaque ajout (`app.js:97-99`), sauvegarde via PUT avec `If-Match`, indicateur Brouillon/Enregistré, avertissement `beforeunload` (`app.js:40-41,103,133`).

**Ce qui existe réellement** : recherche/filtres côté modèles uniquement ; pas de recherche dans groupes/policies ; pas de vue « par clé virtuelle » consolidée (les routes ne sont visibles qu'une policy à la fois via le modal d'aperçu) ; pas de comparaison entre policies ; pas d'affichage des `routing_targets`/passthrough dans le tableau ni l'éditeur ; `prefer` éditable seulement en JSON brut dans un textarea (`app.js:88`) ; `metadata` non éditable ; pas de visualisation du plan en tableau (seulement JSON brut, `app.js:108`) ; statut plugin (`/api/status`) non consommé ; pas de journal, pas de métriques.

---

## 4. Données runtime disponibles mais NON exposées

Tout ce qui suit traverse le code à l'exécution mais n'est ni stocké, ni comptabilisé, ni servi par une API. L'adaptateur natif ne logge rien (`native/main.go` : aucun appel de log) et le moteur ne conserve aucune statistique.

| Donnée runtime | Où dans le code | Pourquoi utile dans une UI d'admin |
|---|---|---|
| **Routes autorisées par requête** (`Session.allowed`) | `runtime.go:35-36,158,189-192` | Montrer, pour une clé donnée, la surface réellement pré-autorisée (y compris routing_targets) ; aujourd'hui seul le brouillon compilé est visible. |
| **Révision effectivement servie** (`Session.Revision()`) | `runtime.go:40` (défini mais jamais appelé) | L'admin embarqué et la garde partagent le même `Store` (`native/main.go:58-79,133`) : un `PUT /api/config` actualise la révision servie. Une modification externe du fichier n'est pas rechargée ; afficher la révision servie permettrait de détecter cet écart. |
| **Refus `registry_model_hidden`** | `runtime.go:184` | Modèle demandé mais non exposé par la clé → top des modèles « invisibles » demandés : indique un catalogue mal dimensionné. |
| **Refus `registry_route_denied`** | `runtime.go:65` | Tentative provider hors routes après routage → révèle des règles CEL Bifrost qui débordent de la politique. |
| **Refus `registry_identity_mismatch`** | `runtime.go:43` | Jeton lié à une politique mais identité gouvernance différente → alerte de sécurité majeure, invisible aujourd'hui. |
| **Autres codes d'échec** : `registry_policy_missing` (`runtime.go:150`), `registry_key_override_denied` (`runtime.go:155`), `registry_virtual_key_required` (`runtime.go:146`), `registry_endpoint_unverified` (`runtime.go:187`), `registry_routing_override_denied` (`runtime.go:205`), `registry_invalid_fallbacks` (`runtime.go:211,214`), `registry_unsupported_endpoint`/`registry_method_not_allowed`/`registry_json_required`/`registry_body_too_large` (`runtime.go:135,142,163,171`), `registry_http_required` (`native/main.go:204`) | idem | Un compteur par code par fenêtre temporelle = tableau de bord de santé de la garde ; aucun n'est compté. |
| **Décisions de garde par requête** (résolution `exposed_id → native_id`, passthrough ou non) | `runtime.go:181-201` | Journal d'audit : qui a demandé quoi, sous quel nom, vers quelle cible. Absent. |
| **Diff config déployée (mémoire plugin) vs fichier** | l'admin embarqué partage le `Store` du plugin (`native/main.go:58-79`) ; le panneau `serve` autonome ouvre son propre store (`cmd/registry/main.go:48`) | Endpoint « disque vs mémoire » montrant les modifications externes non rechargées ou celles faites dans le panneau autonome. |
| **Santé du store** (fichier lisible, révision parsée du disque) | `store.go:20-31,45-54` (la logique existe pour le PUT) | `/api/status` ne vérifie rien ; un `healthy`/`last_load`/`disk_revision` rassurerait. |
| **Compteurs d'usage par vue/policy** | aucun — les hooks natifs (`native/main.go:114-231`) ne comptent rien | Volume par clé virtuelle, taux de refus, latence de garde. |
| **Intersection réelle `/v1/models`** | `runtime.go:275-301` : les routes absentes de la réponse native sont silencieusement sautées (`continue`, `runtime.go:279`) | La UI montre les routes « potentielles » ; les alias sans alias natif Bifrost correspondant disparaissent sans trace. Lister ces écarts = vraie vue « servie ». |

---

## 5. Trous et incohérences

### 5.1 Ce que le moteur sait faire mais que l'UI ne permet pas de configurer

- **`passthrough` / `routing_targets`** : supportés par le schéma (`config.go:50-51`) et utilisés en prod (10 modèles sur 129 dans `configs/registry.prod.json`), mais **absents de l'éditeur de modèles** (`app.js:86`) et du tableau. Seul l'import JSON permet de les renseigner. C'est le plus gros trou de l'UI.
- **`metadata`** (`config.go:45`) : accepté par le schéma, non éditable, non affiché.
- **`prefer`** : éditable uniquement en JSON brut (`app.js:88`) alors que le moteur pourrait proposer les modèles éligibles par alias (la validation d'ambiguïté `config.go:448-456` en connaît la sémantique exacte).
- **`MergeAliases`** (`plan.go:89-172`) : capacité complète (fusion contrôlée des alias dans un `config.json` Bifrost, refus des conflits, audit anti-collision insensible à la casse) **exposée uniquement en CLI** (`cmd/registry/main.go:68-80`). L'onglet Déploiement l'affiche comme une commande à copier-coller (`app.js:72-73`) sans jamais l'exécuter côté serveur.
- **Filtres dynamiques de groupes** : éditables (`app.js:87`) mais jamais visualisés résolus — l'UI ne montre pas les membres matérialisés d'un groupe (le moteur les calcule, `config.go:343-377`).

### 5.2 Bizarreries et incohérences

- **`config.json` vs `registry.json`** : deux fichiers distincts, jamais reliés par le code — `registry.json` (registre, `store.go`) et `config.json` (Bifrost natif, lu seulement par `merge-aliases`). Aucun endpoint ne compare le plan aux permissions réellement configurées dans Bifrost ; le plan est « aveugle ».
- **Mode `local-control-plane`** : `/api/status` déclare `bifrost_connected: false` et `native_apply: "manual"` en dur (`server.go:109`) — valeurs constantes, pas des mesures. L'UI n'appelle d'ailleurs jamais `/api/status` (cf. §3) : ces champs ne sont visibles que via la doc (`docs/INSTALL.md:59`).
- **Application partielle** : un `PUT /api/config` sur l'admin embarqué actualise la garde en direct (`server.go:129`, `store.go:59`, `native/main.go:133`). Les alias et permissions natifs Bifrost restent à appliquer séparément ; une modification du fichier hors du plugin n'est pas rechargée automatiquement. Le panneau `serve` autonome ne partage pas le store du plugin.
- **Double écrivain possible** : le store vérifie le disque avant d'écrire (`store.go:45-57`), donc un `serve` autonome et le plugin peuvent partager le fichier, mais le plugin ne reprendra jamais les modifications du serveur sans redémarrage (pas de reload, pas de watch).
- **`Session.Revision()` mort** : méthode définie (`runtime.go:40`) mais aucun appelant — la révision servie n'apparaît dans aucune réponse.
- **Prod sous-utilise le moteur** : 0 groupe avec `filter`, 0 avec `exclude`, alors que ce sont des capacités de base du schéma (`configs/registry.prod.json` — stats de lecture directe).
- **`/api/validate` duplique la validation du PUT** sans effet de bord ; c'est cohérent, mais l'UI l'appelle systématiquement avant chaque ajout au brouillon (`app.js:99,114`) — un round-trip serveur par champ modifié.
- **WebCrypto non testé en contexte navigateur sécurisé** : le hachage local du jeton (`app.js:96`) requiert un contexte sécurisé ; la doc le reconnaît sans mitigation (`docs/CONFIGURATION.md`).

---

## Résumé — ce que l'UI devrait montrer en priorité (~10 lignes)

1. **Révision réellement servie** par le plugin (et alerte « fichier plus récent que le snapshot servi → redémarrez Bifrost ») : c'est le risque opérationnel n°1.
2. **Journal/compteurs des refus de garde** (`model_hidden`, `route_denied`, `identity_mismatch`, etc.) : aujourd'hui la garde est une boîte noire totale.
3. **Éditeur de `passthrough`/`routing_targets`** : capacité utilisée en prod, invisible et inconfigurable dans l'UI.
4. **Vue par clé virtuelle** : comparer côte à côte les routes de plusieurs policies, pas un modal une par une.
5. **Diff plan vs natif** : croiser `Plan()` avec un `config.json` Bifrost importé pour montrer alias manquants / permissions non appliquées.
6. **Membres résolus des groupes** (filtres + exclusions matérialisés) avant d'associer une policy.
7. **Sélecteur de `prefer`** (modèles éligibles par alias) au lieu du textarea JSON.
8. **`/api/status` consommé** et enrichi (santé store, `disk_revision`, heure de chargement).
9. **`merge-aliases` exécutable côté serveur** avec téléchargement du résultat, au lieu d'une commande copiée à la main.
10. **Alias fantômes** : routes du registre absentes de la réponse native `/models` (sautées silencieusement à `runtime.go:279`).
