---
target: panel Registry (ui), parcours complet
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/ui/src/app/App.tsx"
target_fingerprint: "sha256:1d5d368da80ffbef981a1bbf1b6d7913bbae9028bf71f8369326f6f74a8294d1"
target_path: /Users/sofian/Developer/50-Experiments/bifrost-plugin-registry/ui/src/app/App.tsx
timestamp: 2026-10-10T18-42-15Z
slug: ui-src-app-app-tsx
---
Method: dual-agent (A: design review · B: detector + browser), read-only, live test-copy data (771 discovered accesses, 59 saved cards, 0 groups, 11 keys).

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Saved/not-saved status invisible (computed in ReferenceCatalogBrowser.tsx:95-105, shown only in popover); 15-20 s "Loading model cards…" without skeleton |
| 2 | Match System / Real World | 2 | Jargon ("reference models", "native accesses"); slugs instead of reference names |
| 3 | User Control and Freedom | 2 | "Open details" lands in edit form; silently injected access must be removed by hand |
| 4 | Consistency and Standards | 1 | Missing creator rendered 3 ways; raw vs display provider names; FR strings in EN UI; verb drift |
| 5 | Error Prevention | 1 | Unchosen paid OpenRouter access merged into saved card; no publish diff vs current catalogue |
| 6 | Recognition Rather Than Recall | 2 | Must remember which of 731 rows are saved; duplicate titles |
| 7 | Flexibility and Efficiency | 2 | No saved-only scope, sort, bulk actions; filters lost on navigation; paging by 60 |
| 8 | Aesthetic and Minimalist Design | 2 | "?" grids, 11 identical key cards, raw JSON in popover |
| 9 | Error Recovery | 2 | Endpoint error points at an access the owner never added; "View gateway" dead end in live mode |
| 10 | Help and Documentation | 2 | Static help only; contract's relaunchable tour absent |
| **Total** | | **18/40** | **Poor** |

## Design Specificity Verdict
LLM: vocabulary is product-specific (declared/observed/verified, draft-not-published, readback); layout is a generic admin template. On real data the card identity slots fail (CR/UN initials, "Créateur non identifié", "? → ?", slugs). The owner's real story (subscriptions → groups → one key per app) is absent from the main screen.
Detector: CLI 1 finding (border-accent-on-rounded, ModelEditor.tsx:333) = false positive (underline tab, rounded-b-none). Browser: nested-cards ×75 = false positives (app shell inset container); real: low-contrast text-muted-foreground #71717b on #f4f4f5 = 4.4:1 (headers, counts) on every page; search placeholders 2.7:1.

## Overall Impression
Good building blocks (key composition, readback) but the primary journey breaks on the first screen with real data. Biggest opportunity: make "My models" the 59 saved cards with complete identity.

## What's Working
1. Honest evidence vocabulary (KeyComposer.tsx:142, readback states).
2. Clear key composition (groups + adds − exclusions; group impact preview in GroupEditor.tsx).
3. Shared ViewControls/CatalogCard/filter-chip system.

## Priority Issues
- [P0] "My models" is not his models: App.tsx:326/456 renders catalogModels(registered + 771 discovered) via ReferenceCatalogBrowser; 714 OpenRouter/Vertex; no saved scope; status hidden. Fix: default to saved cards with "In Registry (59) · Available (n)" scope, status badge in card header, aggregator discovery in "Available". Command: shape, then distill.
- [P0] Opening a saved card injects an unchosen paid access: draftFor (ReferenceCatalogBrowser.tsx:37-43) merges all same-reference entries; openrouter access preselected with no endpoints → Review blocked by firstRegistrationIssue (model-editor-data.ts:43). Code-traced: "Edit accesses" on existing cards → setStep("choose") renders nothing (ModelEditor.tsx:295,316,339). Fix: saved accesses only; others as unchecked "Also available" with price + Add; make choose valid for existing cards. Command: harden.
- [P1] Identity never resolves: 0/428 references carry creator (namespace only); registered "Unknown" defeats fallback (ReferenceCatalogBrowser.tsx:120); BrandIcon.tsx:8 maps 2 creators; custom providers Claude/Codex/Google render initials; card face ignores reference modalities. Fix: creator from reference namespace (overridable), Unknown = missing, full icon set via normalized names, reference name/modalities fallback, one localized label. Command: polish, clarify.
- [P1] Keys: 11 identical "Adoption needed" cards (KeyLibrary.tsx:57), composer open while publish blocked, no diff at Review. Fix: show current Bifrost grant per key, adoption as step 0, diff panel before Publish. Command: shape, clarify.
- [P2] Localization/consistency/contrast: FR strings in EN (ReferenceCatalogBrowser.tsx:25,29,89-91,141; ModelEditor.tsx:47-52), sticky More filters <details> (ModelBrowser.tsx:65), 4.4:1 and 2.7:1 contrast, inconsistent counts (771/731/787/844), float noise. Command: harden, polish.

## Persona Red Flags
- Sofian (homelab, subscriptions → per-app keys): UI leads with always-empty creator; his Claude card proposes OpenRouter at $4/$20 per M; no "group from all Codex models" bridge; 11 keys untriageable.
- Alex (power user): no sort/saved scope, paging by 60, filters lost, per-key adoption ×11, duplicate register entry points.
- Sam (keyboard/screen reader): duplicate accessible names "Open claude-opus-5-5 details"; legend without glyphs; More filters ignores Escape/outside click; FR aria-label in EN UI.

## Minor Observations
Double page titles; dominant green "Register a model"; raw JSON + no in-card/not-in-card distinction in Accesses popover; no endpoint preselected; OpenRouter :batch/~latest variants as peers; empty Groups shows full toolbar + two Create buttons; mobile toolbar ≈1.7 screens; catalogue refetched each visit.

## Questions to Consider
1. The key composer already shows exactly the 59 saved cards; why doesn't "My models"?
2. Should a 500+ entry aggregator ever be a peer of a curated card, or a shelf opened only when looking for something new?
3. Does the owner curate by creator or by subscription? If subscription, why does every card lead with a creator logo the data can't fill?
