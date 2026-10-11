---
target: "Registry panel on the live test copy, spec #85 round 2"
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/private/tmp/claude-501/-Users-sofian-Developer-50-Experiments-bifrost-plugin-registry/7669628e-90ed-4f03-aba2-5abe914a0fc8/scratchpad/pr98/ui/src/app/App.tsx"
target_fingerprint: "sha256:40fc563c6690439bd7e6e1f09ccebacab0843099f71f2bfe6deb26ee6edff4e9"
target_path: /private/tmp/claude-501/-Users-sofian-Developer-50-Experiments-bifrost-plugin-registry/7669628e-90ed-4f03-aba2-5abe914a0fc8/scratchpad/pr98/ui/src/app/App.tsx
timestamp: 2026-10-11T22-41-18Z
slug: ui-src-app-app-tsx
---
Method: dual-agent (A: aa9652fc7d5f73f4d · B: a4fb78134643f6eb2)

**Target and scope.** The Registry panel (`ui/src/app/App.tsx`) at PR #98 tip `1e02184` (live round 1 fixes merged: creator inference, read-first key page, decisions-first adoption dialog, subscription-first Models), plugin `dev-0bbb1a3c52a4` on the LIVE test copy (real Bifrost 2.2.6 data). Live round 2 of #97. Trend: 18 → 26 → 26 (live), 28 (fixture).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Verified badge, loading states; blank grid for seconds after connect; no "0 of 4 decided" |
| 2 | Match System / Real World | 2 | Subscription sections fit; "Readback", "ID format", "Registry endpoints", revision hashes, pricing-override intro |
| 3 | User Control and Freedom | 3 | Cancel/Esc/Close everywhere, tour returns home; language only in the URL |
| 4 | Consistency and Standards | 2 | Basic toolbar only on Models; editor ungrouped; "? → ?" in the editor; "+1 available" vs "Also available · 2" |
| 5 | Error Prevention | 3 | Decisions gate Adopt, preview + confirm; Remove styled like Keep |
| 6 | Recognition Rather Than Recall | 2 | Icon-only glyphs, unexplained density numbers, key page counts to reconcile |
| 7 | Flexibility and Efficiency | 3 | Basic/Expert, table, show selected only; no shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | Dense cards with ragged footers; ~15 controls in the key editor; commit hash in Settings |
| 9 | Error Recovery | 3 | Blockers name causes and offer recovery |
| 10 | Help and Documentation | 3 | Help sheet with steps + glossary, re-runnable tour; not page-specific |
| **Total** | | **26/40** | **Acceptable** |

## Priority Issues
- **[P1] Key page is a reconciliation puzzle** (1/2/3/4/5 and "3 IDs" across four blocks). Fix: one ledger "Hermes can call N models" with route tags; technical check folded.
- **[P1] Basic mode inconsistent on Keys and the key editor** (full toolbar, ungrouped, "? → ?", four counters). Fix: reuse the Models Basic toolbar, group by subscription, one selection line.
- **[P1] Jargon on daily read paths** (Properties intro, Groups subtitle, Readback, Registry endpoints, revision, raw `~vendor/…` tile titles). Fix: plain copy, technical identifiers in Expert.
- **[P2] Keys list opens on a wall of "Blocked"**; managed keys last; near-duplicate names. Fix: managed first, To adopt and Empty as shelves.
- **[P2] Adoption dialog signals**: no progress, Remove looks like Keep, a non-choice numbered as a decision, footer off-screen on mobile.

## Detector (B)
CLI: 6 warnings (same as round 1: tab-underline false positives, deliberate Geist). Overlay on 6 views: only `nested-cards` (shell container, disappears at 375 px), dark `low-contrast` (translucent background composited over white), deliberate `overused-font`, and `em-dash-overuse` (9 term/definition dashes in the help sheet). Round-1 real findings (skipped headings, line length, help padding) are gone. 375 px: no overflow.
