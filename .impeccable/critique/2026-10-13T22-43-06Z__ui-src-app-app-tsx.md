---
target: "Registry panel on the live test copy, PR #108 confirmation round (dev-cd10fa936b4d)"
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/.claude/worktrees/integrate-99-100/ui/src/app/App.tsx"
target_fingerprint: "sha256:36a38fa16efdaf494bb1ccb814f9f0ee3f9593e2a32d4e54f5e03f5f6802283f"
target_path: /Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/.claude/worktrees/integrate-99-100/ui/src/app/App.tsx
timestamp: 2026-10-13T22-43-06Z
slug: ui-src-app-app-tsx
---
Method: dual-agent, run sequentially (A then B) on one signed-in tab: the sign-in lives only in that tab's memory, so no new tab could be opened. Neither assessment saw the other's output. All read-only.

**Target and scope.** The Registry panel (`ui/src/app/App.tsx`) on the LIVE test copy (Pulsar, real Bifrost 2.2.6 data), build `dev-cd10fa936b4d` = PR #108 at `8db2653`, after the Impeccable flow (init, document, clarify, distill, adapt, a code review and polish). Confirmation round after the extra round authorised by Sofian. Target 36/40 with no P0/P1: not reached; Sofian decides. The key "Hermes" had been checked against Bifrost before the review by the lead (one "Check with Bifrost" click, read only); "Elson - POC" had not.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Not checked yet", "0 of 2 decided"; the Expert stepper and footer desync |
| 2 | Match System / Real World | 2 | Basic shows "Tasks: Unknown", "Native gateway configuration", "ID format provider/model", a revision hash |
| 3 | User Control and Freedom | 3 | The Basic/Expert switch is inert while a sheet is open; the adoption dialog of a disabled key has no way forward |
| 4 | Consistency and Standards | 3 | Components consistent; verbs drift ("See what blocks it" → "Adopt this key" → "Adopt") |
| 5 | Error Prevention | 3 | Preview before write; the Expert footer can arm "Register" before the review is in view |
| 6 | Recognition Rather Than Recall | 2 | Icon-only "Input +1 → Output"; six identical "See what blocks it" buttons; counts 3 / 4 / 5 on one key page |
| 7 | Flexibility and Efficiency | 2 | No bulk register (711 tiles), no shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Badges only when attention is needed; help, adoption dialog and the 22-row capability panel are dense |
| 9 | Error Recovery | 3 | Blockers are plain sentences with options; "Bifrost does not list this one" has no next step |
| 10 | Help and Documentation | 3 | Long help; "Verified · 1 difference" not explained where it appears |
| **Total** | | **27/40** | **Acceptable** |

## Detector (B)
CLI over `ui/src/app`, `ui/src/features`, `ui/src/components` (110 files): exit 2, 1 finding, `border-accent-on-rounded` at `ModelEditor.tsx:1571` (active-tab underline: deliberate, recorded in DESIGN.md). Overlay unavailable: page CSP `script-src 'self'`. 375 px: no horizontal overflow on 6 views. No text under 12 px. Targets under 24 px: "Advanced: enter an access manually" (20 px) on My models, two "Change requests for …" buttons (20 px) in the model sheet. Under 36 px at 375 px on My models: 52 elements (Register and Accesses buttons 32, chips 28, language select, sign-out), outside the controls adapt targeted. Focus return after Escape, measured: Help sheet → BODY, model sheet → BODY (2 of 2 not returned to the opener); the adoption dialog could not be measured (its button navigates to the key page).

## Strengths
- Hermes shows "Verified Oct 14, 2026 · 1 difference" with "DeepSeek: Bifrost does not list this one" under the right row; same-named rows are told apart by their IDs.
- The adoption dialog isolates writes ("Changes Bifrost" badge, outline buttons, "1 of 4 decided").
- Basic Review: one consequence sentence, identifiers folded.

## Priority Issues
- **[P1] The adoption dialog counts a non-decision.** Key "Elson - Poc": "2 decisions before adopting · 0 of 2 decided", but its first item ("This key is disabled or expired in Bifrost.") has no buttons: Adopt can never enable and nothing says what to do. Verified in source: `adoptionProgress` (`key-readiness.ts:70`) counts every non-kept blocker as a pending decision, provider-less ones included. Fix: show key-level blockers as a "Before adopting" line with the next step, count only choosable decisions. (/impeccable clarify)
- **[P1] The Hermes ledger reads as a contradiction.** "Verified … · 1 difference" is called an oxymoron; the fold shows 3 models, 4 IDs and "5 models". The wording is the one issue #99 asked for and ADR 0001 defines: a vocabulary decision for the owner. (/impeccable layout)
- **[P1] Expert sheet navigation desyncs (Register and Edit).** After "Next: model details" then "Review" the footer shows "Register" while step 1 is still in view; the sheet shell scrolls 283 px and the Close button leaves the screen. Verified in source: `revealJourneyStep` (`EditorJourney.tsx:19`) uses `scrollIntoView`, which also scrolls overflow-hidden ancestors; the stepper pill already did this and the footer now shares it. Fix: scroll the journey container only. (/impeccable harden)
- **[P2] Basic still leaks and contradicts itself:** "Display name" prefilled with "gpt-5.6-luna" under the title "GPT-5.6 Luna"; price absent from Basic properties while Expert shows it. (/impeccable clarify)
- **[P2] The keys list gives no path:** six "Blocked" cards with identical buttons and truncated reasons; a green "Adopt this key" on a blocked key. (/impeccable onboard)

## Persona Red Flags
**Alex:** 711 To-add tiles registered one at a time (issue #102); the header switch is inert under a sheet. **Jordan:** icon-only "Input +1 → Output"; "Facts unknown"; a 4-step, 5-bullet, 7-definition Help. **Sam:** focus falls to BODY after closing the Help and model sheets (measured); six "See what blocks it" share one accessible name. **Casey:** Register and Accesses buttons 32 px; the adoption dialog is about 1,900 px tall.

## Not checked / risks
The tour offer never appeared; Table and Square views; the group editor beyond step 1; the adoption dialog's focus return; real error states. The detector overlay never ran in a page (CSP). Screenshots lag one frame in the pane, so mobile was judged from DOM metrics.
