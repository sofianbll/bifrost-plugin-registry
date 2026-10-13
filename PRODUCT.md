# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Sofian, the sole operator of a homelab Bifrost gateway. He curates the model subscriptions he pays for (Claude, Codex, Antigravity, OpenCode Go and others) and gives each application (Hermes, OpenCode and so on) a virtual key that sees only the models intended for it. Confirmed: he is the first user. Administration by a small team is a later hypothesis, not a requirement.

## Product Purpose

Registry is a plugin for the Bifrost AI gateway with its own standalone panel. It keeps a central catalogue of model cards (enriched from Bifrost and Models.dev, with the operator's corrections), shared groups of models, and virtual keys composed from groups and individual picks. Publishing a key is verified by reading back what Bifrost actually lists for it. Success: for every key, the operator can say exactly which models it can call, and Bifrost confirms it. (Source: `docs/design/product-direction.md`, `docs/design/core-v1-spec.md`.)

## Positioning

Catalogue and key verification carry equal weight (confirmed by Sofian): one place to browse model cards and, per key, to see and check what the key can really call against what Bifrost lists, and to adopt keys that already exist without breaking them. The native Bifrost dashboard manages keys but does not offer this view of models per key or this verification.

## Operating Context

- The plugin is a `.so` installed separately from the official dynamic Bifrost image; the panel is served by the plugin on its own port (8099) with its own admin token.
- Bifrost 2.2.6 is the qualified gateway. Changes are tried on a test copy of the gateway before any real use.
- Two reading levels share the same draft: Basic (plain words) and Expert (technical detail, from 1280 px up).
- The interface exists in French and English, light and dark, and down to 375 px wide.

## Capabilities and Constraints

- Confirmed: Bifrost stays the owner of keys and secrets. Registry stores no secret and relays no inference; it describes, selects and verifies.
- Confirmed: the plugin stays separate from the official Bifrost image.
- Confirmed: French and English, light and dark, mobile.
- Terminology lives in `CONTEXT.md`; the decisions already taken for the interface live in `docs/design/component-library.md` and are not reopened without the owner.
- Undecided: team features; five structural design questions recorded in issue #102 (subscription versus pay-per-token, splitting "To add", bulk register, a safe adoption default, per-page help).

## Brand Commitments

The interface reuses Bifrost's shadcn/Radix components, Geist and the accepted visual style recorded in `docs/design/component-library.md` (validated by Sofian). That style is a fixed constraint of this project, not a variable.

## Evidence on Hand

- A real test copy of the gateway (59 saved model cards, 11 virtual keys) on the owner's server.
- Dated critique snapshots in `.impeccable/critique/` (18/40 at the first, 25/40 at the latest).
- Issues #99 to #102 and the "Known, not fixed" list on pull request #98.
- No testimonials, customers or benchmarks exist; none may be invented.

## Product Principles

1. A key's list says only what Bifrost confirms; anything else is flagged as a difference, never counted (ADR 0001).
2. Nothing is written to Bifrost without a preview of the exact change and an explicit confirmation.
3. Speak the operator's words: Basic shows what a state means and what to do; identifiers and endpoint names belong to Expert and folded technical details.
4. A declared fact is not a proven one: documented, tested and unknown stay distinct.
5. Respect what Bifrost owns: keep a provider's permissions in Bifrost rather than rewriting them.

## Accessibility & Inclusion

Operable by keyboard, with visible focus and focus returned after sheets and dialogs; text contrast of at least 4.5:1 and non-text contrast of at least 3:1 in both themes; no meaning carried by colour alone; usable at 375 px without horizontal scroll; every string available in French and English.
