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

- The plugin is a `.so` installed separately from the Registry-distributed dynamic gateway image, compiled from official, unmodified Bifrost sources. This is not a qualified official prebuilt image. The panel is served by the plugin on its own port (8099) with its own admin token.
- Bifrost 2.2.6 remains the v0.3 gateway baseline; stable v0.3.0 was published from immutable source checkpoint `9b900e9`. The 2.3.0 foundation is merged in #158/#159, with exact native qualification recorded in the [foundation checkpoint](STATUS.md#foundation-checkpoint), not a release. Synthetic qualification is not real-provider inference or production certification.
- Two reading levels share the same draft: Basic (plain words) and Expert (technical detail, from 1280 px up).
- The interface exists in French and English, light and dark, and down to 375 px wide.

## Capabilities and Constraints

- Confirmed: Bifrost stays the owner of keys and secrets. Registry stores no secret and relays no inference; it describes, selects and verifies.
- Confirmed: the plugin stays separate from the Registry-distributed gateway image; Bifrost sources remain unmodified.
- Confirmed: French and English, light and dark, mobile.
- Terminology lives in `CONTEXT.md`; the decisions already taken for the interface live in `docs/design/component-library.md` and are not reopened without the owner.
- Team administration remains a hypothesis, not a delivered feature or requirement.
- Approved future v0.4 scope: the [complete #102 specification, published October 15, 2026](https://github.com/sofianbll/bifrost-plugin-registry/issues/102#issuecomment-6188326439), accepts connection-level subscription declarations with model exceptions, subscription/other-access To add sections, batch registration, conservative safe-default adoption and contextual help, including their behavioral rules and help content. These are not delivered features or unanswered product questions. Approval covers specification publication only: implementation, storage/compatibility/migration design, release and deployment require a separate mandate; v0.3 scope stays frozen.

## Brand Commitments

The interface reuses Bifrost's shadcn/Radix components, Geist and the accepted visual style recorded in `docs/design/component-library.md` (validated by Sofian). That style is a fixed constraint of this project, not a variable.

## Evidence on Hand

- Historical test-copy observation on October 10, 2026: 59 saved model cards, 11 virtual keys and 771 discovered accesses, not a current inventory ([dated critique](.impeccable/critique/2026-10-10T18-42-15Z__ui-src-app-app-tsx.md)).
- Dated critique snapshots in `.impeccable/critique/`: first measure 18/40; the [last recorded critique, October 13](.impeccable/critique/2026-10-13T22-43-06Z__ui-src-app-app-tsx.md), measured the older build `dev-cd10fa936b4d` at 27/40, 0 P0 and 3 P1. Subsequent fixes are not remeasured; no current 36/40 result is established.
- Issues #99–#101 and #110 are completed through #108/#115, not a current unresolved list inherited from #98. #102 remains approved future v0.4 scope; #139 identity and #109 Bifrost 2.3.0 are delivered in #158/#159. [STATUS](STATUS.md#foundation-checkpoint) records the dated qualification and bounded #141 assessment, distinct from publication or deployment.
- No testimonials, customers or benchmarks exist; none may be invented.

## Product Principles

1. A key's list says only what Bifrost confirms; anything else is flagged as a difference, never counted (ADR 0001).
2. Nothing is written to Bifrost without a preview of the exact change and an explicit confirmation.
3. Speak the operator's words: Basic shows what a state means and what to do; identifiers and endpoint names belong to Expert and folded technical details.
4. A declared fact is not a proven one: documented, tested and unknown stay distinct.
5. Respect what Bifrost owns: keep a provider's permissions in Bifrost rather than rewriting them.

## Accessibility & Inclusion

Operable by keyboard, with visible focus and focus returned after sheets and dialogs; text contrast of at least 4.5:1 and non-text contrast of at least 3:1 in both themes; no meaning carried by colour alone; usable at 375 px without horizontal scroll; every string available in French and English.
