# HANDOFF — bifrost-plugin-registry

> Dernière mise à jour : 2026-09-25 · session Kimi Work (Sofian)
> But : reprendre le fil exactement là où on l'a laissé, sans rien re-découvrir.

## 1. Contexte en 30 secondes

Plugin Go (`*.so`) pour Bifrost (AI gateway) qui gouverne quels modèles chaque
virtual key (VK) peut appeler. Repo public : `sofianbll/bifrost-plugin-registry`.
Build sur Pulsar (alias ssh `pulsar`), déployé en prod via le service compose
`gateway` dans `/home/sofian/Homelab-OS/docker/stacks/pulsar/bifrost/`.
Release publique courante : **v0.1.3-native**.

La phase en cours : **design de l'UI admin du plugin**, intégrée comme native
dans l'UI Bifrost. Le mockup v1 vient d'être livré et commit (`503e775`).

## 2. État livré (vérifié)

- `docs/design/bifrost-ui-design-system.md` — design system Bifrost exact
  (Tailwind 4 CSS-first, accent teal oklch, Geist/Geist Mono, text-sm=0.825rem,
  sidebar 240px, tables sticky, sheets, empty states, copywriting anglais bref).
- `docs/design/capabilities-inventory.md` — modèle de données réel du plugin,
  5 endpoints admin existants, trous identifiés (pas d'éditeur passthrough,
  pas de télémétrie, `/api/status` = constantes, journal des refus absent).
- `docs/design/mockup/index.html` — mockup interactif cliquable (file:// OK),
  5 écrans : Overview, Virtual Keys, Models, Groups, Denials. Fragments sources
  dans `docs/design/mockup/fragments/*.html`. Vérifié headless Chromium, 0 erreur JS.
  ⚠️ Le shell et les fragments sont dupliqués : toute modif de fragment doit être
  réinjectée (regex section) — voir git log ou régénérer.

## 3. Décisions figées (ne pas rouvrir sans accord de Sofian)

1. **L'API est la source de vérité.** Le store en mémoire servi par l'API l'est ;
   `registry.json` n'est que la persistance. `PUT /api/config` s'applique live
   à la garde (vérifié : `internal/registry/store.go` — `Save()` swap le snapshot
   partagé). Le « merge » n'est plus un mécanisme central : reste juste un
   import ponctuel `config.json` → diff → apply via API.
2. **`GET /v1/models` filtré par VK, format configurable** : champ policy
   `id_format` = `provider/model` | `model` | `both`. La réponse ne liste que
   ce que la clé autorise (déjà visible dans le mockup, écran Models).
3. **Intégration UI = option A** : panneau servi sous `/bifrost-registry/` via
   custom `main.go` (Bootstrap + `BifrostHTTPServer.Router`), reverse proxy vers
   `127.0.0.1:8099`, **pas de fork UI** pour l'instant, entrée sidebar plus tard.
4. **Langue UI : anglais** (cohérence Bifrost). Mockup en anglais.
5. **Pas d'environnement de staging, jamais**, sauf demande explicite.
6. **Méthode : dev/test 100% sur Mac d'abord**, prod Pulsar ensuite.
7. **Bifrost v2.2.2 sortie le 2026-09-23** (fixs streaming/kimi-k3/session
   affinity, zéro migration DB) — rebase du build proposé, **pas encore GO**.

## 4. Gouvernance de travail (Sofian l'exige, s'y conformer)

- **Subagents systématiquement**, orchestrés depuis l'orchestrateur (moi) :
  un subagent **ne peut pas** en spawner d'autres. Découper fin, paralléliser
  quand pas de dépendance (fragments d'écrans en parallèle = bon pattern),
  `resume` plutôt que respawn.
- **AVANT d'envoyer des agents ou de partir en solo : présenter le plan et
  obtenir le GO explicite de Sofian.** Rien ne part sans validation.
- **Hindsight à chaque tour** : `hindsight memory recall sofian "…"` avant,
  `hindsight memory retain sofian "…"` après (bank `sofian`,
  server http://100.65.38.100:8888).
- Tout le travail se fait **dans le repo** `/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry`,
  pas dans le workspace Kimi.
- Ton : direct, tutoiement, français. Jamais afficher de secrets.

## 5. Infra clés

- Repo local : `/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry`
- Checkout build Pulsar : `/home/sofian/build/bifrost-build`, script
  `build-registry-plugin.sh`, binaire dynamique requis (l'officiel est statique).
- Prod : registry actif **129 modèles / 32 groupes / 38 policies**, révision
  `ab74ce27…`, fichier `/home/sofian/Data/appdata/bifrost/registry/registry.json`,
  backup `registry.json.bak-passthrough`. Admin sur `127.0.0.1:8099`.
- VK mockées du mockup : hermes, hindsight, cpa, opencode-omo, kimi-work.
  Groupes : cheap-fast, frontier, vision (+ long-context, open-weights, embeddings).
- Test headless : playwright-core + Chromium for Testing dans `/tmp/bftest`
  (regénérable : `npm i playwright-core`, chromium dans
  `~/Library/Caches/ms-playwright/chromium-1243/…`).

## 6. Prochaines étapes — dans l'ordre

**En attente du retour de Sofian sur le mockup :**
- (a) périmètre MVP — reco : phase 1 = Overview + Virtual Keys + Denials,
  phase 2 = Models + Groups + import config.json.
- (b) langue anglais OK ? (déjà décidé §3.4, confirmation seulement)
- (c) rebase v2.2.2 maintenant ou après la phase 1 ?
- (d) ajustements d'écrans dans le mockup ?

**Puis, avec GO, plan d'implémentation en vagues d'agents :**
- A1 : custom gateway `main.go` (Bootstrap + route `/bifrost-registry/` → proxy 8099).
- A2 : UI admin base-path relative (app.js/index.html du plugin).
- A3 : build scripts (Mac + Pulsar) pour le nouveau binaire.
- A4 : tests locaux Mac (smoke proxy + garde + login) **avant** tout toucher à Pulsar.
- Fondations moteur (chiffrer, indépendantes de l'UI) : télémétrie de garde
  (compteurs + ring buffer in-memory + endpoint `/api/events`), status réel
  (disk_revision/served_revision/last_load/healthy), reload fichier éventuel,
  éditeur passthrough/routing_targets, `id_format` par VK sur `/v1/models`.

## 7. Pièges connus

- Login admin : un « Type error » côté Sofian non reproduit en headless ; fix
  déployé (api() verbeuse) mais cause racine inconnue — vérifier avec lui que
  l'accès marche avant de bâtir dessus.
- Tailwind CDN + tokens `var()` : les opacités `/30` ne passent pas → utiliser
  color-mix ou classes pleines (bug déjà mordu sur le segment control).
- Un PUT API = live ; toute modif externe du fichier `registry.json` sur Pulsar
  exige un restart (ou le futur endpoint de reload) — c'est le seul cas de drift.
