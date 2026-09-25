# Model card experiment

Interactive, in-memory experiment: can a user register one model card from two
gateway entries, then predict the effect of a targeted edit without learning the
source inheritance rules? The gateway entries are explicit scenario examples;
the Models.dev records are pinned upstream data. No native application contract
is established by this experiment.

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

## First revision — historical verification, 2026-09-25

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
Sofian rejected this first interaction as confusing. The subsequent
[UX audit](../../../docs/design/model-card-ux-audit.md) found that the interface
exposed the inheritance mechanism before the user's task. Functional checks above
did not establish that the journey was understandable.

## Second revision — UX question

The intended sequence is selecting example gateway entries, reviewing the model
card and its linked providers, then reviewing changes before saving in the demo.
Properties are readable by default, with a scoped editor and an immediate
before/after preview. Source provenance stays available without dominating the
page. Saving remains in memory and does not publish a callable alias.

One cohesive revision follows the accepted audit direction. The previous
revision remains at `7df5fc3` for comparison; multiple alternative layouts are not
added to the user's workflow. Native application and routing remain separate work.

### Verification, 2026-09-25

`npm run check`, `npm run build` and the state self-check pass. The state check now
also exercises the pinned catalogue: common context propagation, preservation of
provider-authored limits, a provider-only correction, reset and unknown versus
false. The existing production bundle-size warning remains.

Browser checks covered selection (including none and one provider), scoped
before/after previews, invalid and unchanged inputs, reset, local registration,
editing a saved card and cancelling back to its saved state. Escape closes the
editor and restores focus to its opening button. Desktop and 390 × 844 layouts
were inspected; the mobile review now keeps Before and After visible together.
A fresh reload reported no browser warning or error. Test edits and the temporary
viewport override were cleared. These checks establish interaction behavior;
Sofian's first-use comprehension still needs his trial.

GitHub tracking remains pending because `api.github.com` was unreachable. This
revision is local to the prototype branch and does not change the gateway.

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
