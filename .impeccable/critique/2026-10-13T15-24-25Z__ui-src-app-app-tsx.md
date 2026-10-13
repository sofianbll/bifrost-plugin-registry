---
target: "Registry panel on the live test copy, PR #108 round 5 (dev-d7e241be4b52)"
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/.claude/worktrees/integrate-99-100/ui/src/app/App.tsx"
target_fingerprint: "sha256:5cb825acc8b6514827d7aaf47edcb945b84dbd8e7ea96dfae8416e95b0786cea"
target_path: /Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/.claude/worktrees/integrate-99-100/ui/src/app/App.tsx
timestamp: 2026-10-13T15-24-25Z
slug: ui-src-app-app-tsx
---
Method: dual-agent, run sequentially (A then B) on one signed-in tab: the sign-in lives only in that tab's memory, so no new tab could be opened. Neither assessment saw the other's output. All read-only.

**Target and scope.** The Registry panel (`ui/src/app/App.tsx`) on the LIVE test copy (Pulsar, real Bifrost 2.2.6 data), build `dev-d7e241be4b52` = PR #108 at `2a7ea5a`, i.e. round 4 plus three fixes (adoption decision counts, same-named key rows + provider-count sentence + first-check wording, Expert Review scroll). Extra live round authorised explicitly by Sofian after round 4 (27/40, 3 P1). Target remains 36/40 with no P0/P1; Sofian decides the next step.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good counts; the check action sits in a collapsed fold |
| 2 | Match System / Real World | 2 | Basic shows "Common model ID", "Family: gpt", "Review binding", "Readback"; one record has four names (reference, documentary record, document, entry) |
| 3 | User Control and Freedom | 3 | Esc/Cancel everywhere; Cancel disabled during the ~5 s adoption preview |
| 4 | Consistency and Standards | 2 | Register / Add / Save model / Publish group / Review / Adopt |
| 5 | Error Prevention | 3 | "No changes", preview before write, destructive options badged |
| 6 | Recognition Rather Than Recall | 2 | 8 filters in a popover; capability states need hover; the switch is labelled "Expert" with accessible name "Use Expert key composer" |
| 7 | Flexibility and Efficiency | 2 | No bulk register, no shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | Same fact three times per card; "Inherited from model · Models.dev · documented" eight times in Properties |
| 9 | Error Recovery | 3 | Blockers come with remedies; no real failure observed |
| 10 | Help and Documentation | 3 | "Help for My models" opens the same global text |
| **Total** | | **25/40** | **Acceptable** |

## Detector (B)
CLI over `ui/src/app`, `ui/src/features`, `ui/src/components`: exit 2, 1 finding, `border-accent-on-rounded` at `ModelEditor.tsx:1280` (active-tab underline: deliberate). Overlay unavailable: the page CSP is `script-src 'self'`. 375 px: no horizontal overflow on 6 views. No text under 12 px. Targets under 24 px: the sidebar logo link and the "Technical check" disclosure (20 px). The planned Expert "Review" scroll measurement was NOT done: the permission layer refused the "Edit" click.

## Strengths
- Managed key page: same-named rows are told apart by their IDs ("deepseek-flash" vs "deepseek-v4.1-flash").
- Adoption dialog: decisions first, `aria-pressed` choices, sticky "1 of 4 decided", single scroll.
- Basic Review: one consequence sentence, identifiers folded.

## Priority Issues
- **[P1] Adoption decisions hide their object and cost.** "Use DeepSeek for this model" / "Keep Google in Bifrost" name no model (behind "Show model names"); "Before adopting: register 8 Vertex AI models" is not counted; the intro says "Adopting changes nothing in Bifrost" while options carry "Changes Bifrost"; Cancel is disabled during "Loading preview…". Fix: model names inline (3, then "+N"), count prerequisites, keep Cancel enabled. (/impeccable clarify)
- **[P1] Basic leaks technical identifiers and edit controls.** "Common model ID · claude-opus-5-5", "Family: gpt", Sources tab ("Documentary record", "Mapping chosen in Registry", "Document ID"), Properties with repeated provenance, 22 "Edit" buttons in Basic edit. Fix: about 5 facts and one "Edit details" in Basic, the rest in Expert. (/impeccable distill)
- **[P2] Key status asserts before it proves.** Both managed keys read "Not checked yet" while the headline says "This key can call 3 models"; "Check with Bifrost" is inside a closed fold. (/impeccable clarify)
- **[P2] View options popover clips the density segment** (413 px in a 254 px popover: "Large" invisible, "Medium" cut). Touch targets 24-32 px at 375 px. (/impeccable adapt)
- **[P2, unconfirmed] Expert step state vs content**: A reports the pill reading "3. Review" while the view stays on step 1; source and the automated journey say Review scrolls and focuses the heading. Not measured live.

## Persona Red Flags
**Alex:** 3 clicks to register a one-access model, no multi-select over 11 Register tiles, Expert "Back" inert. **Jordan:** headings "Claude 2", "Codex 14" unexplained; "Facts unknown — associate a reference" never says what a reference is. **Sam:** switch announces "Use Expert key composer" but is labelled "Expert"; Help is a 24 px target. **Casey:** 24-32 px targets, adoption preview ~5 s with Cancel disabled.

## Not checked / risks
No write path exercised. "Verified · N difference" not observable this run: both managed keys read "Not checked yet" (a read done on Hermes before the container restart did not survive it). Keyboard, focus order and contrast not measured numerically. Side effects of A: the first-visit tour offer is consumed in this browser; language toggled FR then EN.
