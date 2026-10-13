# Synthetic browser QA fixture

From the repository root, build the current UI if needed (`npm --prefix ui run build`), then run:

```sh
go run ./tests/ui-fixture
```

Open <http://127.0.0.1:4174/> and sign in with the synthetic admin token
`qa-fixture-admin-token-only-1234567890`. Set `QA_FIXTURE_ADMIN_TOKEN` to override it.
The fixture listens only on `127.0.0.1`, on port 4174 unless `FIXTURE_PORT`
(1024-65535) says otherwise. It serves `ui/dist` through the real admin
server, and stores its temporary registry under ignored `dist/checks/ux-audit/`.
Stopping the process removes that temporary registry.

All native Bifrost calls use an in-memory synthetic transport that answers like
Bifrost 2.2.6 (`/api/version` is `2.2.6-fixture`). No provider endpoint is called;
every model name, key and secret is synthetic.

### Synthetic gateway

It mirrors the shape of a real subscription gateway (custom subscription providers,
an aggregator that cross-lists them, variant IDs, a disabled provider, a decisions-only
provider, unmanaged keys in every adoption state), not its data.

| Provider (`/api/providers`) | Base type (`custom_provider_config.base_provider_type`) | Native models | Saved model cards |
| --- | --- | --- | --- |
| `synthetic-provider` | standard | `qa-code`, `qa-chat`, `qa-vision`, `qa-unregistered` | `qa-code`, `qa-chat`, `qa-vision` |
| `Claude` | `anthropic` | `qa-opus`, `qa-haiku`, `qa-opus-fast`, `qa-sonnet`, `qa-shared` | all five |
| `Codex` | `openai` | `qa-codex`, `qa-codex-mini`, `qa-shared` | all three |
| `Google` | `gemini` | `qa-gemini`, `qa-image`, `qa-flash` | `qa-gemini`, `qa-flash` |
| `openrouter` (aggregator) | standard | 67: `anthropic/qa-opus`, `anthropic/qa-opus-pro`, `~anthropic/qa-opus-latest`, `openai/qa-codex:batch`, `deepseek/qa-reasoner`, `tencent/qa-hunyuan`, `meituan/qa-longcat`, `qwen/qwen-qa-01` … `-60` | none |
| `mistral` (Mistral-like) | standard, **disabled** | none: its key is disabled, so nothing is discovered | none |
| `typesafe` (Jev-like) | standard, serves only decisions | `qa-jev` | none |

- Saved cards use only the subscription providers (and the original `synthetic-provider`).
  The Claude, Codex and Google cards are saved as discovery registers them: name equal to
  the common ID, creator `Unknown`, no modalities. `qa-opus-fast` ("QA Opus Fast") is a
  second saved card on the `anthropic/qa-opus` reference, so two saved cards share one.
- `openrouter/anthropic/qa-opus` is linked to the same reference as the saved card
  `Claude/qa-opus` and carries a documented price ($4 / $20 per million tokens); its common ID
  is the namespace-free `qa-opus`, so discovery lists it with `Claude/qa-opus` as one model.
  `anthropic/qa-opus-pro` shares the reference too but is a variant, not the same model. The
  `~…-latest` and `:batch` variants have no reference. `openrouter/deepseek/qa-reasoner`
  costs 2e-7 per input token, stored per million with its float noise (0.19999999999999998)
  so the UI's number formatting is exercised.
- The `qwen/` fillers push the aggregator past one 60-card page and sort after the `qa-*`
  cards. Discovery holds 81 models (`qa-shared` is one model served twice); the saved
  cards are 12 (the `qa-shared` card has two accesses), so 69 wait in To add.
- **Cards without a Models.dev reference** on custom subscriptions, one per base type, with
  creator `Unknown` in the raw data (a creator can be inferred from the base type):
  `Claude/qa-sonnet` (`anthropic`), `Codex/qa-codex-mini` (`openai`), `Google/qa-flash`
  (`gemini`). `qa-shared` ("QA Shared") also has no reference and is one saved card with two
  accesses from two subscriptions, `Claude/qa-shared` and `Codex/qa-shared` (registry rows
  `qa-shared` and `qa-shared-codex`, same alias): a creator cannot be inferred from two base
  types, and grouping by serving provider must file it under both.
- **Disabled provider**: `/api/providers` lists `mistral`, its key reads `enabled: false`, so
  `/api/models` is never asked for it and no `mistral/…` model is discovered or saved; only
  the names a virtual key allows explicitly are listed by `/v1/models` (see QA Mistral Key below).
- **Decisions model**: `typesafe/qa-jev` declares `mode: "decisions"` in its datasheet and is
  linked to the reference `typesafe/qa-jev`, whose namespace has no provider record in the
  embedded Models.dev snapshot (like the real Jev). It is discovered and has no card.
- Each native model declares a `mode` (`chat`, or `image_generation` for `Google/qa-image`)
  in its `/api/models/parameters` datasheet. `/api/models/details` lists name, provider and
  per-token prices, so a Bifrost catalogue refresh works; the seeded catalogue already holds
  the same `parameters` and prices.

**References** (Models.dev shape: name, family, context, modalities, no creator):
`anthropic/qa-opus`, `anthropic/qa-haiku`, `openai/qa-codex`, `google/qa-gemini`,
`google/qa-image` and `deepseek/qa-reasoner` have a namespace with a provider record in the
embedded Models.dev snapshot; `tencent/qa-hunyuan`, `meituan/qa-longcat` and
`typesafe/qa-jev` have none. `Codex/qa-codex-mini`, `Claude/qa-sonnet`, `Google/qa-flash`,
`qa-shared` and the aggregator fillers and variants have no reference. The four original
`fixture/qa-*` references keep a `Fixture Labs` creator.

**Groups**: **QA Development** (`qa-code`, `qa-chat`) and **QA Visual** (`qa-vision`).

**Virtual keys** (`/api/governance/virtual-keys`):

| Key | Registry | Native permissions |
| --- | --- | --- |
| QA Development Key (`vk-qa-dev`) | managed | `synthetic-provider`: `qa-code`, `qa-chat` |
| QA Visual Key (`vk-qa-visual`) | managed | `synthetic-provider`: `qa-vision` |
| QA Unmanaged Key (`vk-qa-unmanaged`) | unmanaged | none |
| QA All Providers Key (`vk-qa-all-providers`) | unmanaged | `allow_all_providers: true` (not adoptable) |
| QA Codex Key (`vk-qa-codex`) | unmanaged | `Codex`: `qa-codex`, `qa-codex-mini`, `allow_all_keys` (adoptable as is) |
| QA Claude Key (`vk-qa-claude`) | unmanaged | `Claude`: `*` (all models), `allow_all_keys`; the journeys replace `*` by the five Claude models saved in Registry, then adopt it |
| QA Google Key (`vk-qa-google`) | unmanaged | `Google`: `qa-gemini`, `qa-flash`, `allow_all_keys` (adoptable as is, a second ready key) |
| QA Mistral Key (`vk-qa-mistral`) | unmanaged | `mistral`: `qa-mistral-large`, `qa-mistral-small`, `qa-mistral-code` (never discovered) and `Claude`: `qa-haiku`, `qa-sonnet` (saved); blocked by the three undiscovered models |
| QA Hermes Key (`vk-qa-hermes`) | unmanaged | `mistral`: `qa-mistral-large`, `qa-mistral-small` (never discovered) and `Claude`: `qa-haiku`, `qa-opus` (saved); the same case as QA Mistral Key, kept apart so two journeys can each adopt one (the native permission edit adopts this one) |
| QA To Add Key (`vk-qa-unsaved`) | unmanaged | `synthetic-provider`: `qa-vision` (saved) and `qa-unregistered` (discovered, no card); blocked by the unsaved model |
| QA Wildcard Key (`vk-qa-wildcard`) | unmanaged | `Claude`: `*` (all models) and `Codex`: `qa-codex` (saved); the journeys adopt it keeping Claude in Bifrost |
| QA Kept Key (`vk-qa-kept`) | unmanaged | `Codex`: `qa-codex-mini` (saved) and `Google`: `qa-gemini` (saved), `qa-ghost` (Google does not serve it); the journeys adopt it keeping Google in Bifrost, and its readback lacks `Google/qa-ghost` (#99) |

Adoption cases among the unmanaged keys: **ready** (`vk-qa-codex`, `vk-qa-google`),
**empty** (`vk-qa-unmanaged`), **all providers** (`vk-qa-all-providers`), **all models of a
provider** (`vk-qa-claude`, `vk-qa-wildcard`), **blocked by undiscovered models** (`vk-qa-mistral`,
`vk-qa-hermes` on a disabled provider, `vk-qa-kept` on an enabled one), **blocked by discovered models without a card** (`vk-qa-unsaved`). The
journeys adopt `vk-qa-codex`, `vk-qa-mistral` (keeping `mistral` in Bifrost), `vk-qa-wildcard`
(keeping `Claude` in Bifrost), `vk-qa-kept` (keeping `Google` in Bifrost) and, after a native permission edit, `vk-qa-hermes`,
`vk-qa-all-providers` and `vk-qa-claude`; `vk-qa-google` stays ready. No journey saves `qa-unregistered`.

`/v1/models` answers an unmanaged key with every `provider/model` its native permissions allow,
plus the names it allows explicitly on a disabled provider. For a managed key it builds the same
kind of native list from the key's explicit names, like Bifrost 2.2.6: a name its provider does not
serve is left out (unless the provider has no discoverable models, as a disabled one), and a `*` row
lists every model its provider serves; then it runs the plugin's own `Session.Project`
on it (Registry routes only, plus the providers the policy keeps native).

**Native key updates.** A virtual key `PUT` behaves like Bifrost: every provider row gets an
`id`, `key_ids: ["*"]` reads back as `allow_all_keys` and other IDs as `keys`. The fixture
records each update exactly as sent and serves them at `GET /__fixture/native-writes` as
`[{"keyId": …, "body": …}]` (fixture only, no secret), so a journey can assert what the panel
wrote to Bifrost.

Run `go test ./tests/ui-fixture` to check workspace save, native permission
updates and readback, key creation and reveal, reference catalog reads, the provider
base types, the aggregator cross-listing, key permissions and adoption preview, the
adoption case of every unmanaged key, the cards without a reference and the multi-subscription
card, the decisions model, model modes, and reference namespaces.

## Browser journeys

The Playwright suite in `ui/e2e` starts its own fixture, so stop any fixture you
started by hand on the same port. Parallel runs: give each its own `FIXTURE_PORT`
(for example `FIXTURE_PORT=4191 npx playwright test`); the Playwright config and the
fixture both read it. From `ui/`, with the UI built and Go installed:

```sh
npm ci && npm run build
npx playwright install chromium
npx playwright test
```

This runs the 18 journeys of the [UX audit](../../docs/reviews/2026-09-25-ux-audit.md).
They mutate the fixture and refuse non-fixture workspaces. Every invocation of
`playwright test` builds and starts a fresh fixture and stops it with SIGTERM, which
removes its temporary registry: run the suite again rather than reusing state. Reports
and traces go to `dist/checks/e2e/`. The README screenshots are a second, read-only
config run as its own invocation; see [docs/images](../../docs/images/README.md).

The suite replaces `node tests/ux_journeys.cjs` (last present at `60e859f`), which wrote its
captures and JSON report to `dist/checks/ux-audit/`; only the fixture's temporary registry
still lives there. The dated [UX audit](../../docs/reviews/2026-09-25-ux-audit.md) keeps its
original commands.
