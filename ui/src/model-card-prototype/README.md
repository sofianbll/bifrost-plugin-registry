# Model card experiment

Interactive, in-memory experiment: one canonical model, two provider offers, and
Registry corrections that preserve the difference between provider-authored and
inherited properties. This proposes an editing behavior; it does not establish a
native Bifrost application contract.

From the repository root:

```sh
npm --prefix ui run prototype:model-card
```

Open http://127.0.0.1:8771/model-card-prototype.html.
The normal production entry remains unchanged. Reloading clears the draft.
No gateway, Registry API, credentials, or provider inference calls are involved.

The four editable source fields are `limit.context`, `limit.output`, `tool_call`,
and `structured_output`. Prices are standard source prices, read-only. The two
accesses are examples, not discovered user connections. An unknown capability is
not treated as false. Editing metadata cannot create upstream provider support.

The proposed precedence is: Registry access correction → provider-authored value
→ Registry common correction → canonical source value. Removing a correction
restores that precedence. This bounded case has no `base_model_omit`; it is not a
general replacement for Models.dev's merge rules.

## Verification — 2026-09-25

`npm run check`, `npm run build`, the state self-check and the source generator
passed. The production build retains its existing large-chunk warning; this
experiment is served through its separate development entry.

Browser checks at the default desktop size and 390 × 844 confirmed common
context propagation, preservation of provider-authored output limits, isolated
Bedrock corrections, reset to the provider source, invalid-limit blocking,
identity preservation between steps and explicitly simulated registration.
Mobile badge clipping and duplicate React roots during hot reload were fixed.
A fresh final browser session reported no warning or error. Temporary edits and
the viewport override were cleared.

Captured on `codex/prototype-model-card-modelsdev`. GitHub issue tracking is
pending: `gh issue list` could not connect to `api.github.com` during this run.
The next decision is whether this inheritance/editing interaction fits the
intended product; native application and routing remain separate work.

## Data and regeneration

`catalog.json` is generated from Models.dev commit
`6a0b12bc9c66e1ab4fe44232d592a32df09a77e0`. It retains the canonical record, raw
provider TOMLs and resolved offerings. The generator uses upstream
`packages/core/src/generate.ts`, not a recreated catalogue merger.

Prepare the ignored source checkout, then regenerate with Bun:

```sh
git clone https://github.com/anomalyco/models.dev dist/models-dev-upstream
git -C dist/models-dev-upstream checkout 6a0b12bc9c66e1ab4fe44232d592a32df09a77e0
cd dist/models-dev-upstream
bun install --filter @models.dev/core --ignore-scripts --frozen-lockfile
cd ../..
bun scripts/modelsdev-prototype.ts
cd ui
node --import tsx src/model-card-prototype/state.test.ts
```

Skip cloning when the checkout already exists; the generator checks its revision.
No new production dependency is installed. Core is currently a private upstream
package, so this experiment uses a pinned checkout rather than implying a public
installable core package exists.

## Upstream data license

MIT License

Copyright (c) 2025 models.dev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
