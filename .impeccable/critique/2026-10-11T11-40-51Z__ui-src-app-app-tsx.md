---
target: "panel Registry (ui), parcours complet, après spec #65"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/ui/src/app/App.tsx"
target_fingerprint: "sha256:1d5d368da80ffbef981a1bbf1b6d7913bbae9028bf71f8369326f6f74a8294d1"
target_path: /Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/ui/src/app/App.tsx
timestamp: 2026-10-11T11-40-51Z
slug: ui-src-app-app-tsx
---
Method: dual-agent (A: design review · B: detector + browser), read-only, live test-copy data with the PR #76 plugin (59 saved cards, ~770 discovered accesses, 0 groups, 11 unmanaged keys).

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Skeletons, scope counts, status badges, "Bifrost allows today"; To add count 721→709 during cold load |
| 2 | Match System / Real World | 3 | Real creators and subscription names; 15 cards still "?"; "Partial" undefined; "Registry endpoints" vs glossary "opération exposée" |
| 3 | User Control and Freedom | 3 | Cancel everywhere, explicit Add; "Open details" still lands in edit form; help button navigates away |
| 4 | Consistency and Standards | 2 | Editor step order flips by entry point; "Not saved" tiles open saved cards; raw "typesafe"; ME initials for Meta and Meituan |
| 5 | Error Prevention | 3 | No silent merge; Save enabled with no changes; luna-pro offered as same model |
| 6 | Recognition Rather Than Recall | 3 | 13 creators with counts, base-type marks; 25% of saved cards anonymous; adoption blocker only inside dialog |
| 7 | Flexibility and Efficiency | 2 | No sort; To add paged by 60 and grouped per page; keys one by one; logo choice in Settings |
| 8 | Aesthetic and Minimalist Design | 3 | Calm first screen; 59 identical "Saved" badges; 9 operation checkboxes per access; 53-ID wall on key page |
| 9 | Error Recovery | 2 | Adoption blocker "mistral · 53" with "Go to models" leading nowhere |
| 10 | Help and Documentation | 2 | Static help omits adoption; help button leaves the page |
| **Total** | | **26/40** | **Acceptable** (was 18/40) |

## Design Specificity Verdict
LLM: interaction model now product-specific (In Registry / To add, Also available with prices, Bifrost allows today, adoption-first); visual language still a generic zinc admin template; the subscriptions → per-app keys story is only a grouping filter.
Detector: CLI 1 finding = known false positive (tab underline, ModelEditor.tsx:316). Browser: nested-cards on the shell frame (false positives), overused-font Geist (typeface signal, contract-accepted). Contrast: 0 text failures; muted 4.79-5.27:1 light, 6.75:1 dark; placeholders 5.27:1 (were 4.4:1 and 2.7:1).

## Previous priority issues
- [P0] My models not his models: Resolved.
- [P0] Unchosen paid access injected / empty Edit accesses: Resolved.
- [P1] Identity never resolves: Partly resolved (44/59 creators, base-type marks; 15 cards without reference still "?").
- [P1] Keys: Partly resolved (permission summaries, adoption-first; no readiness signal; Hermes blocked by 53 Mistral models).
- [P2] Localization/consistency/contrast: Mostly resolved.

## Priority Issues
- [P1] Adoption dead end for keys allowing models with no Registry access (Hermes: deepseek · 1, mistral · 53; Mistral disabled so not discoverable). Fix: readiness on key cards; dialog branches per provider (deep-link To add filtered, or manual entries from allowed_models, or keep provider native). clarify, harden.
- [P1] 15 of 59 saved cards anonymous (no Models.dev reference). Fix: inferred creator from first-party subscription base type (labelled inferred), "Match a reference" action, clearer unknown-facts copy. clarify, harden.
- [P2] Registry status contradicts across scopes (To add "Not saved" tile opens the saved card; In Registry badges carry no info). Fix: "Add to <card>" tiles; badges only for exceptions. clarify, distill.
- [P2] Subscription view distorted: group-by-provider uses first access only, grouping after the 60-item page, unsorted sections, logo choice in Settings. layout, harden.
- [P2] Mobile filters fill 65% of first screen; selected toggle segment under 3:1; key page ID wall. adapt, polish.

## Persona Red Flags
- Sofian: two of first three tiles "?"; no key adoptable for Hermes; multi-subscription models under one provider; his own Claude Opus 5.5 shown "Not saved" in To add.
- Alex: no sort, 709 To add paged by 60, no key readiness triage, Expert switch targets an unreachable composer.
- Sam: 11 key buttons all named "Review"; selected toggles <3:1; help changes page; pastel badges in dark mode.

## Minor Observations
Editor step order flips; Delete always present; Display name field shows slug while heading shows reference name; Save enabled with "No changes"; luna-pro matched to Luna; OpenRouter common IDs keep namespace; initials for Zhipu/Tencent/Xiaomi/Alibaba/Typesafe and ME collision; raw "typesafe"; FR "+1 disponibles"; count jump during load; 7-11 s cold load; help omits adoption; duplicate view controls on desktop; breadcrumb repeats H1.

## Questions to Consider
1. Should Keys open on a triage (ready / blocked / empty) instead of 11 identical tiles?
2. Should To add be organized by subscription with OpenRouter as a collapsed shelf?
3. In "In Registry", what should a header say — only what needs attention?
