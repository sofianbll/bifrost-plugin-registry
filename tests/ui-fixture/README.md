# Synthetic browser QA fixture

From the repository root, build the current UI if needed (`npm --prefix ui run build`), then run:

```sh
go run ./tests/ui-fixture
```

Open <http://127.0.0.1:4174/> and sign in with the synthetic admin token
`qa-fixture-admin-token-only-1234567890`. Set `QA_FIXTURE_ADMIN_TOKEN` to override it.
The fixture listens only on `127.0.0.1`, serves `ui/dist` through the real admin
server, and stores its temporary registry under ignored `dist/checks/ux-audit/`.
Stopping the process removes that temporary registry.

All native Bifrost calls use an in-memory synthetic transport that answers like
Bifrost 2.2.6 (`/api/version` is `2.2.6-fixture`). No provider endpoint is called;
every model name, key and secret is synthetic.

### Synthetic gateway

It mirrors the shape of a real subscription gateway (custom subscription providers,
an aggregator that cross-lists them, variant IDs, unmanaged keys), not its data.

| Provider (`/api/providers`) | Base type (`custom_provider_config.base_provider_type`) | Native models | Saved model cards |
| --- | --- | --- | --- |
| `synthetic-provider` | standard | `qa-code`, `qa-chat`, `qa-vision`, `qa-unregistered` | `qa-code`, `qa-chat`, `qa-vision` |
| `Claude` | `anthropic` | `qa-opus`, `qa-haiku` | both |
| `Codex` | `openai` | `qa-codex`, `qa-codex-mini` | both |
| `Google` | `gemini` | `qa-gemini`, `qa-image` | `qa-gemini` |
| `openrouter` (aggregator) | standard | 66: `anthropic/qa-opus`, `~anthropic/qa-opus-latest`, `openai/qa-codex:batch`, `deepseek/qa-reasoner`, `tencent/qa-hunyuan`, `meituan/qa-longcat`, `qwen/qa-qwen-01` … `-60` | none |

- Saved cards use only the subscription providers (and the original `synthetic-provider`).
  The Claude, Codex and Google cards are saved as discovery registers them: name equal to
  the common ID, creator `Unknown`, no modalities.
- `openrouter/anthropic/qa-opus` is linked to the same reference as the saved card
  `Claude/qa-opus` and carries a documented price ($4 / $20 per million tokens). The
  `~…-latest` and `:batch` variants have no reference.
- The `qwen/` fillers push the aggregator past one 60-card page and sort after the `qa-*`
  cards. Discovery holds 76 models.
- Each native model declares a `mode` (`chat`, or `image_generation` for `Google/qa-image`)
  in its `/api/models/parameters` datasheet. `/api/models/details` lists name, provider and
  per-token prices, so a Bifrost catalogue refresh works; the seeded catalogue already holds
  the same `parameters` and prices.

**References** (Models.dev shape: name, family, context, modalities, no creator):
`anthropic/qa-opus`, `anthropic/qa-haiku`, `openai/qa-codex`, `google/qa-gemini`,
`google/qa-image` and `deepseek/qa-reasoner` have a namespace with a provider record in the
embedded Models.dev snapshot; `tencent/qa-hunyuan` and `meituan/qa-longcat` have none.
`Codex/qa-codex-mini` and the aggregator fillers and variants have no reference. The four
original `fixture/qa-*` references keep a `Fixture Labs` creator.

**Groups**: **QA Development** (`qa-code`, `qa-chat`) and **QA Visual** (`qa-vision`).

**Virtual keys** (`/api/governance/virtual-keys`):

| Key | Registry | Native permissions |
| --- | --- | --- |
| QA Development Key (`vk-qa-dev`) | managed | `synthetic-provider`: `qa-code`, `qa-chat` |
| QA Visual Key (`vk-qa-visual`) | managed | `synthetic-provider`: `qa-vision` |
| QA Unmanaged Key (`vk-qa-unmanaged`) | unmanaged | none |
| QA All Providers Key (`vk-qa-all-providers`) | unmanaged | `allow_all_providers: true` (not adoptable) |
| QA Codex Key (`vk-qa-codex`) | unmanaged | `Codex`: `qa-codex`, `qa-codex-mini`, `allow_all_keys` (adoptable as is) |
| QA Claude Key (`vk-qa-claude`) | unmanaged | `Claude`: `*` (all models), `allow_all_keys` |

`/v1/models` answers a managed key with its Registry routes allowed natively, and an
unmanaged key with every `provider/model` its native permissions allow.

Run `go test ./tests/ui-fixture` to check workspace save, native permission
updates and readback, key creation and reveal, reference catalog reads, the provider
base types, the aggregator cross-listing, key permissions and adoption preview, model
modes, and reference namespaces.

## Browser journeys

The Playwright suite in `ui/e2e` starts its own fixture, so stop any fixture you
started by hand (the port is fixed). From `ui/`, with the UI built and Go installed:

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
