---
target: "Registry panel on the live test copy, PR #108 round 4 (dev-e267090)"
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/.claude/worktrees/integrate-99-100/ui/src/app/App.tsx"
target_fingerprint: "sha256:5cb825acc8b6514827d7aaf47edcb945b84dbd8e7ea96dfae8416e95b0786cea"
target_path: /Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/.claude/worktrees/integrate-99-100/ui/src/app/App.tsx
timestamp: 2026-10-13T14-01-36Z
slug: ui-src-app-app-tsx
---
Method: dual-agent, run sequentially (A then B) on one signed-in tab: the sign-in lives only in that tab's memory, so no new tab could be opened. Neither assessment saw the other's output. All read-only.

**Target and scope.** The Registry panel (`ui/src/app/App.tsx`) on the LIVE test copy (Pulsar, real Bifrost 2.2.6 data), build `dev-e267090` = PR #108 at `5f91dfe` (live round 4 of spec #85 follow-up). Trend before this run: 18 → 26 → 26 → 28 (live). Stop rule decided with Sofian: target 36/40 with no P0/P1, one round, Sofian decides if below.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Loading preview…" with Cancel disabled; keys read "Not checked yet" |
| 2 | Match System / Real World | 2 | Basic still shows "Common model ID", "Family: glm", "Review binding", "ID format provider/model", UUID as key subtitle |
| 3 | User Control and Freedom | 3 | Esc and Cancel everywhere; the Basic/Expert switch is unreachable while a sheet is open |
| 4 | Consistency and Standards | 2 | Step labels differ ("Next: model details" / "Review" / "Continue →"); a model listed twice on a key; Create group lacks the width slider |
| 5 | Error Prevention | 3 | "No changes", Adopt gated, preview before write; "Required" shown red before any input |
| 6 | Recognition Rather Than Recall | 3 | Icon capabilities have a panel; Filters hides 8 selects |
| 7 | Flexibility and Efficiency | 2 | No shortcuts, no bulk (710 tiles, one Register each); Expert hidden under 1280 px |
| 8 | Aesthetic and Minimalist Design | 3 | One no-reference card says the same thing 4 times; tour banner on every page |
| 9 | Error Recovery | 3 | Blocked states name the cause; no real error path exercised |
| 10 | Help and Documentation | 3 | "?" sheet, tour, Settings > Help; still "Readback", Mistral hard-coded |
| **Total** | | **27/40** | **Acceptable** |

## Detector (B)
CLI over `ui/src/app`, `ui/src/features`, `ui/src/components` (105 files): exit 2, 1 finding, `border-accent-on-rounded` at `ModelEditor.tsx:1274` (the active-tab underline: deliberate). Overlay: unavailable, the page CSP is `script-src 'self'`, so `detect.js` could not be injected; no user-visible overlay. 375 px: no horizontal overflow on 6 views. No text under 12 px. Targets under 24 px: the sidebar logo link (desktop), 3 disclosure `<summary>` on the key page, the sheet width slider.

## Priority Issues
- **[P1] Adoption dialog contradicts itself** ("3 decisions before adopting" vs "1 of 4 decided"; choices expose no selected state). This is the "decision counts" item of #101, not fixed by PR #108. Fix: one source for both counts, radiogroup with visible selected state. (/impeccable clarify)
- **[P1] Managed key page undermines its total.** Verified on the live Hermes key: "This key can call 3 models" lists "DeepSeek V4.1 Flash" twice ("via DeepSeek, OpenCode Go", then "via DeepSeek"); the fold says "Bifrost allows today · 5 models" unexplained; the button says "Read again" while the body says "Nothing read from Bifrost yet". #99 asked for one row per model: not held on real data, which the synthetic test did not cover. (/impeccable clarify)
- **[P1] Expert "Review" looks dead** on Edit and Register: the footer marks step 3 active but the scroll stays at the top while the review section sits ~1,800 px lower; the no-change review says "You're saving changes to …". Fix: scroll to the section. (/impeccable harden)
- **[P2] Jargon in Basic**: "Common model ID", "Family: glm", "Review binding", key UUID subtitle, dates with seconds, "Readback" in help. (/impeccable clarify)
- **[P2] Noise before the task**: tour banner above every h1; a no-reference card repeats its message 4 times. (/impeccable distill)

## Persona Red Flags
**Alex:** no shortcuts, no "keep all in Bifrost" bulk choice, 710 tiles one at a time, Expert Review does not navigate. **Jordan:** "Capability states · Documented · ? Not specified" unexplained; "Read again" before any read. **Sam:** no skip link, 1 px focus ring, adoption choices expose no selected state. **Casey:** Help 24 px and sidebar toggle 28 px targets.

## Not checked / risks
No readback was triggered, so "Verified · N difference" (the core of #99) was not seen live, only on the synthetic fixture; keys read "Not checked yet". No write path exercised; keyboard and screen-reader findings are inferred from the DOM; contrast not measured numerically.
