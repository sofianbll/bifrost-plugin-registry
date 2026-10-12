---
target: Registry panel on the synthetic fixture, round 1 (cloud, not the live test copy)
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/home/user/bifrost-plugin-registry/ui/src/app/App.tsx"
target_fingerprint: "sha256:06b19ccbd3116d189aac98847f3648371a2118896498bdc8c8a430f84048e75c"
target_path: /home/user/bifrost-plugin-registry/ui/src/app/App.tsx
timestamp: 2026-10-11T19-49-06Z
slug: ui-src-app-app-tsx
---
Method: dual-agent (A: a4af3070a065e85e0 · B: a552b69529e363625)

**Target and scope.** The Registry panel (`ui/src/app/App.tsx`) at branch tip `d1cccb0` (spec #85, tickets #86–#96 plus review fixes), served by the SYNTHETIC UI fixture (`tests/ui-fixture`), run in a cloud session. This is round 1 on the fixture only. It is NOT the measurement on the owner's test copy (real data: 59 cards, ~770 accesses, 11 keys); that live critique is still pending in a local session. Previous live scores: 18/40 → 26/40.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Readiness chips, counts, "No changes" work; the tour ring never shows; Keys has no summary |
| 2 | Match System / Real World | 2 | Developer vocabulary still leaks into core flows ("Native routes were not read back…", `allow_all_providers…`) |
| 3 | User Control and Freedom | 3 | Read-first, Delete in a menu, Cancel everywhere; Group editor still opens in edit with a red Delete; two keys have no exit |
| 4 | Consistency and Standards | 3 | Cohesive; "Active/Unchecked" vs "Managed", "Review adoption" vs "Use this key with Registry" |
| 5 | Error Prevention | 3 | Preview + confirm naming the count; Keep and Remove carry equal weight with no recommendation |
| 6 | Recognition Rather Than Recall | 3 | "Show in To add" deep links; legend far from the cards; three navigation layers in edit mode |
| 7 | Flexibility and Efficiency | 3 | Sort/group/shelves; no "next blocked key"; popover focus trap hurts keyboard efficiency |
| 8 | Aesthetic and Minimalist Design | 2 | First card at y=397 (42% of the viewport); ~14 simultaneous controls; duplicated "Add to" affordances |
| 9 | Error Recovery | 3 | Blockers specific with actions; the all-models key and the empty key give a reason but no action |
| 10 | Help and Documentation | 3 | "?" side sheet and relaunchable tour; the tour ring is invisible; same help on every page |
| **Total** | | **28/40** | **Good** (Excellent needs 36+) |

P0: 0. P1: 2. The "no P0/P1" goal is not met on the fixture.

## Design Specificity Verdict
Interaction design is authored for this product (readiness chips with a one-line reason, the per-provider adoption dialog with the allowed/afterwards/removed preview, attention-only badges, "Add to <card>", subscription shelves). The visual skin is category-standard BY DECISION (accepted style; not a redesign target). Missed character: the chrome still speaks catalogue ("what do I need to do next" is not primary).

**Deterministic scan (B).** `impeccable detect --json ui/src`: 6 warnings, all false positives: 2× `border-accent-on-rounded` (tab underline `border-b-2` in `ModelEditor.tsx:334` and prototype `ModelDetail.tsx:36`), 4× `overused-font` (four `@font-face` lines for Geist/Geist Mono, a recorded brand decision). **Browser overlay: not possible** — the fixture's CSP (`script-src 'self'`) blocks script injection; the playbook fallback was used (no [Human] overlay). Console: no page errors. DOM measurements: contrast light — one miss, the primary CTA "Register a model" 4.42:1 (14px/500 on rgb(28,132,102)); dark and 375 px — zero misses; 3 duplicate ids from repeated icon gradient ids (`lobe-icons-gemini-fill-0/1/2`); no unnamed controls; no page-level horizontal overflow at 375 px; targets under 24 px: header "Help" button 16×16, Expert switch 36×20, sidebar brand link.

## What's Working
1. Adoption dialog and remove preview: blockers per provider with counts, a consequence per action, "Nothing is written to Bifrost until you confirm", a confirm that names the count.
2. Attention-only badges, read-first sheets, Delete in a "…" menu, Save disabled with "No changes", Discard confirmation: the risky editor became a safe one.
3. Subscription-first browsing: To add by provider with OpenRouter collapsed, multi-subscription cards under each provider, logo choice in View options, one "Filters" button keeps the first card on a phone screen, French complete, 4.5:1 measured on sampled text.

## Priority Issues
- **[P1] Capability popovers hold keyboard focus and multiply tab stops.** Each card has ≥3 stops; the capability summaries open a popover that takes focus and Tab cycles inside it (60 Tab presses from card 1 never reached card 2). Fix: do not move focus into the popover on open (Enter/Space for the full panel), make the tile one stop; add a nav landmark. (/impeccable harden)
- **[P1] Adoption still ends in a dead end for the all-models key (Claude `["*"]`) and the empty key.** The Claude key explains "adoption is unsupported" with no action; the empty key still offers "Review adoption" and shows empty selection cards. Fix: no CTA for an empty key; a first-class "leave native" outcome for the other (needs a product decision). (/impeccable clarify)
- **[P2] Developer vocabulary leaks into core flows.** "Native routes were not read back because blockers remain", "allow_all_providers grants future providers…", "dynamic model list", "Registry exposed ID", the help step "read /v1/models back". Plain rewrites. (/impeccable clarify)
- **[P2] The Keys page is a catalogue, not the to-do list.** 10 tiles alphabetical; blocked/ready/empty/managed mixed; vocabulary conflicts. Fix: default to a readiness order. (/impeccable layout)
- **[P2] Phone: the Hermes adoption dialog overflows (397 px content in a 341 px dialog), targets are small, the tour offer is ~170 px tall.** (/impeccable adapt)

## Persona Red Flags
**Jordan (first-timer):** the tour never visibly points at anything (the ring's outline-style is `none`); bare "?" under the capabilities; "Native routes were not read back" on a blocked key.
**Sam (keyboard/low-vision):** popover focus trap, no skip link or nav landmark, lots of 12 px grey text; focus rings and 4.5:1 text are good.
**Casey (mobile):** clipped adoption dialog, 16–36 px targets, 8-select Filters popover; the first card does show on the first screen.

## Minor Observations
Tour spotlight invisible (one-class fix); Group editor opens straight into edit with a red Delete; "Add to QA Opus" pill plus an "Add to card" button on one tile; read-mode sheets of no-reference cards have no Associate action; Edit opens at step 2 with the slug in Display name; adoption dialog uses the same pink wall for non-errors; dark mode turns the green primary buttons grey; Settings content offset; the capability legend repeats on every grid page; "Review binding"/"Disable" beside "Rename".

## Questions to Consider
What if Keys opened as a worklist ("2 ready, 5 blocked — start here")? Should "leave native" be a real third state? Does edit mode need steps, tabs and Basic/Expert together? What if the tour rang a real Blocked tile?

## Not checked / risks
Fixture is synthetic (some "No reference matches" copy is a fixture artefact). The confirm paths (Keep, Replace, Remove apply) were not clicked, so post-confirmation states are unverified here. 200% zoom and screen readers untested.
