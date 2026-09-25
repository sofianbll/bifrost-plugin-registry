# Full-plugin review with a private gateway capture

This local review uses the production React entry and the real Registry admin
server and store. A separate command supplies native configuration from a private,
sanitized capture. It neither connects to the original gateway nor proves native
plugin ABI compatibility, provider inference, or deployment readiness.

## Run

Keep captures and generated configuration under ignored `dist/`. Never commit
provider credentials, virtual-key values, session tokens, private URLs, or the
captured configuration. The upstream Models.dev checkout and its dependencies
are prepared as described in the model-card prototype README.

```sh
bun scripts/build-review-catalog.ts dist/review/raw.json dist/review/registry.json
npm --prefix ui run build
go run ./cmd/registry-review --snapshot dist/review/raw.json \
  --config dist/review/registry.json --ui ui/dist --listen 127.0.0.1:8772
```

Open `http://127.0.0.1:8772/model-registry`. Only a loopback listener is accepted;
cross-origin browser writes are rejected. The UI identifies the source, capture
date, partial-capture status, and local-only changes after reads and writes.

The converter uses the pinned Models.dev core generator. It joins only exact
native identities and explicit canonical links; ambiguous or missing links remain
unmapped. A virtual-key allowlist or routing target is a configuration reference,
not proof that a provider offers that model. Capture limitations are retained.

## What can be reviewed

- Browse exact native accesses, find a reference, compare common and provider
  facts, register a model, and revisit its saved card in the full plugin shell.
- Edit supported catalogue properties through existing Registry APIs, with scope
  and before/after values visible. This saves Registry metadata, not native limits.
- Create groups and prepare selections for existing captured virtual keys. Local
  adoption uses snapshot-derived permissions and is labelled accordingly.
- Inspect the original captured provider settings, readable aliases, routing
  rules and virtual-key permissions separately from Registry changes.

Registry writes persist in the supplied configuration. Native-copy changes persist
in the sibling `.native-review.json` file, whose capture timestamp must match.
The original capture is not changed. Local-only placeholder credentials are used
inside the adapter; they are not credentials for the original gateway.

Secret retrieval, key creation, external catalogue refresh, AI calls and verified
readback are unavailable. No locally derived catalogue is presented as a successful
live `/v1/models` verification. Encrypted or unread alias fields are shown as
unavailable, not as confirmed empty lists.

## Checks

```sh
go test ./cmd/registry-review ./internal/admin ./internal/registry
bun scripts/build-review-catalog.test.ts
npm --prefix ui run check
npm --prefix ui run build
```

Browser review must cover registration, saved-state reload, scoped metadata edits,
cancel, groups, existing-key selection, native inventory and small-screen layout.
Passing these checks does not establish that a new user understands the journey;
that remains the purpose of the review session.
