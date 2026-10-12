---
target: "Registry panel on the live test copy, spec #85 round 3 (final)"
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/private/tmp/claude-501/-Users-sofian-Developer-50-Experiments-bifrost-plugin-registry/7669628e-90ed-4f03-aba2-5abe914a0fc8/scratchpad/pr98/ui/src/app/App.tsx"
target_fingerprint: "sha256:16af84c52df9808010cdeefc185be2f221487e7634c508048ce7c4d676575804"
target_path: /private/tmp/claude-501/-Users-sofian-Developer-50-Experiments-bifrost-plugin-registry/7669628e-90ed-4f03-aba2-5abe914a0fc8/scratchpad/pr98/ui/src/app/App.tsx
timestamp: 2026-10-11T23-45-45Z
slug: ui-src-app-app-tsx
---
Method: dual-agent (A: abc78153db15a8500 · B: a9d892a880d2d9d64)

**Target and scope.** The Registry panel (`ui/src/app/App.tsx`) at PR #98 tip `6a08057` (live rounds 1 and 2 merged), plugin `dev-13638a1778bb` on the LIVE test copy (real Bifrost 2.2.6 data). Live round 3, the last agreed round of #97. Trend: 18 → 26 → 26 → 28 (live).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading states and counts; a key's total disagrees with the IDs Bifrost lists; slow adoption preview |
| 2 | Match System / Real World | 2 | Subscription grouping fits; the register Review step and the adoption decisions are still technical |
| 3 | User Control and Freedom | 3 | Cancel/Close/Esc everywhere; the model sheet survives a route change; dark theme not remembered |
| 4 | Consistency and Standards | 2 | Add / Register / Save for one action (EN); "Keep … in Bifrost" with two meanings; decision counts disagree |
| 5 | Error Prevention | 3 | Adopt gated by decisions, "Changes Bifrost" marks writes, preview + confirm |
| 6 | Recognition Rather Than Recall | 3 | Legend, aria-labels; key page vs editor counts |
| 7 | Flexibility and Efficiency | 3 | Basic/Expert, filters, grouping, show selected only; no bulk register, no search shortcut |
| 8 | Aesthetic and Minimalist Design | 3 | Calm; "+2 available" twice per tile, repeated provenance rows |
| 9 | Error Recovery | 3 | Blocked states name the cause and the next step |
| 10 | Help and Documentation | 3 | Help sheet with steps and glossary; not page-specific, one stale term |
| **Total** | | **28/40** | **Good** |

## Priority Issues
- **[P1] A key's headline total disagrees with what Bifrost verified** ("5 models · Verified" while Bifrost lists 4 IDs; a kept-in-Bifrost model Bifrost does not list is counted). Fix: count what the readback confirms, flag kept rows missing from it, one row per model with subscription chips.
- **[P1] Jargon at the two commit moments** (register Review step; adoption decisions). Fix: one plain sentence of consequence, technical details collapsed (open in Expert).
- **[P2] One action, three names; one label, two meanings** (Add / Register a model / Save model; "Keep … in Bifrost" for an undiscovered model and for a collision; "2 decisions" vs "1 of 3 decided").
- **[P2] Density control overflows View options** (`ViewOptions.tsx`, `w-64` popover holds a 397 px toggle group).
- **[P3] State that does not stick or clear**: theme not persisted; the model sheet stays open across a route change.

## Detector (B)
CLI: 6 warnings, all false positives or deliberate (tab underlines; Geist). Overlay on 8 views: only `nested-cards` from the shell container (0 at 375 px), deliberate `overused-font`, dark `low-contrast` from translucent layers composited over white. Nothing new to fix. 375 px: no overflow.
