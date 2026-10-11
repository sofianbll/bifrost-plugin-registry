---
target: "Registry panel on the live test copy, spec #85 round 1"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/private/tmp/claude-501/-Users-sofian-Developer-50-Experiments-bifrost-plugin-registry/7669628e-90ed-4f03-aba2-5abe914a0fc8/scratchpad/pr98/ui/src/app/App.tsx"
target_fingerprint: "sha256:ce933f3b09dd4f07e81f05056621ee9b4b2976f96dbbd752955db24e93187fa8"
target_path: /private/tmp/claude-501/-Users-sofian-Developer-50-Experiments-bifrost-plugin-registry/7669628e-90ed-4f03-aba2-5abe914a0fc8/scratchpad/pr98/ui/src/app/App.tsx
timestamp: 2026-10-11T21-39-55Z
slug: ui-src-app-app-tsx
---
Method: dual-agent (A: ae0b1f599bb5a8afb · B: a43a5ab479f112db2)

**Target and scope.** The Registry panel (`ui/src/app/App.tsx`) at PR #98 tip `4417b4d` (spec #85 + wildcard-key adoption + kept-native read-back fix), served by Vite on the owner's Mac and proxied to the LIVE test copy (real Bifrost 2.2.6 data: 59 cards, 697 to add, 11 keys, 2 managed). Live round 1 of #97. Previous live scores: 18 → 26; fixture round: 28.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loader, Verified badges, dated readback; no feedback when a 497-tile shelf opens; stale "Synced" |
| 2 | Match System / Real World | 2 | Jargon in the Save sheet (API endpoints) and Settings (env var names); "Creator not identified" on `~anthropic/…` |
| 3 | User Control and Freedom | 3 | Read-first cards, previews before every Bifrost write, Esc everywhere |
| 4 | Consistency and Standards | 2 | Adopt / Review adoption / "Use this key with Registry"; cards read-first but keys open in the editor |
| 5 | Error Prevention | 3 | Save disabled on no change; preview + confirm for native edits |
| 6 | Recognition Rather Than Recall | 2 | Key editor hides the 2 selected models among 59; help not page-specific |
| 7 | Flexibility and Efficiency | 3 | Sort, grouping, density, Expert; no bulk actions outside the editor |
| 8 | Aesthetic and Minimalist Design | 2 | ~15 toolbar controls before content; chip stacking; all-pink adoption block |
| 9 | Error Recovery | 3 | Blockers name causes; the alias-collision blocker has no action |
| 10 | Help and Documentation | 3 | Help sheet + skippable tour; same content on every page; no glossary |
| **Total** | | **26/40** | **Acceptable** |

## Priority Issues

- **[P1] Creator missing on obviously branded models** (To add tiles, `~anthropic/…` aggregator models, claude-haiku-5-5 under OpenCode Go). Fix: infer on To add tiles too, from base type and aggregator vendor prefix.
- **[P1] False "Will gain" on a verified, unchanged key** (Hermes, kept-native deepseek). Fix: compare plan and readback over the same route set; show "No change" when equal.
- **[P1] Adoption dialog buries the decision**: blockers below the fold (off-screen at 375 px), four blocker kinds in one pink block, the alias collision has no action, three names for one action. Fix: numbered decisions first, inline choice for collisions, optional items marked, accesses collapsed, one verb.
- **[P2] Managed key opens straight into the 59-card editor**; selection hidden. Fix: read-first key summary, "Selected first", Rename/Disable in a menu.
- **[P2] Jargon in Basic mode at save time** (endpoint checkboxes, env var names). Fix: preselect endpoints, show the grid in Expert only.

## Detector (B)
CLI: 6 warnings (2 `border-accent-on-rounded` false positives on tab underlines; `overused-font` Geist, deliberate per the UI contract). Overlay injected on 5 views: real `skipped-heading` (h1→h3 in ModelBrowser and the blocked-key page), `line-length` ~92ch on the blocked-key page, `cramped-padding` in the help sheet header; `nested-cards` and dark `low-contrast` judged false positives (content frame; translucent dark background composited over white). 375 px: no horizontal overflow; 59 title buttons under 24 px tall.

## Minor
Shelf count wording (10 of 697 shown), French spacing before ";" and ":", "+2 de plus", sort label without "Trier par", Access tab repeats facts, "Observed in simulation" wording on a live gateway, help sheet title follows the page but content does not, mid-word break in the French key subtitle at 375 px, Esc focus return after the "…" menu.
