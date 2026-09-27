# UI repair checklist — September 27, 2026

This pass follows Sofian's latest annotated review. Previous browser checks did not establish acceptable visual quality. Work stays in the main checkout and uses the dated local Bifrost snapshot; production is unchanged.

## Implementation

- [x] **Key workflow implemented — Luna:** trace adoption and the disabled save action for an unmanaged key. Remove the dead end without weakening native permission checks or losing drafts. Explain the actual blocker next to its action.
- [x] **Key summary implemented — Luna:** readable loaded summary, coherent rem typography, responsive proportions, exact access details on demand, reachable actions at the bottom.
- [x] **Model creation implemented — Luna:** reuse the actual group/key journey composition, with consistent required fields and Basic/Expert behavior. Preserve the controlled draft when resizing or changing presentation.
- [x] **Settings implemented — Luna:** shared controls for provider logos and image selection, localized labels, aligned compact rows, visible preview and validation errors.
- [x] **Foundations implemented — coordinator:** inspect shared type/control sizes and affected callers. Correct demonstrated inconsistencies; avoid a blind px-to-rem replacement.

## Verification gates

- [x] Independent Luna review of the changed flows and shared callsites.
- [x] Focused behavior checks and TypeScript checks pass.
- [x] Production frontend compiles; local review server serves that build.
- [x] Desktop 1392 × 695: inspect loaded key summary at top, middle and bottom; adoption blocker and next action are understandable.
- [x] Desktop: model creation uses the common journey; required-field, cancel, resize and draft-preservation states work.
- [x] Settings: inspect provider rows at top and bottom; choose/reset logo and invalid-image feedback work.
- [x] Narrow and intermediate screens: 400 px and 800 px; no horizontal overflow, clipped labels or unreachable actions.
- [x] Inspect final diff; preserve unrelated work, user drafts and local runtime data.
- [x] Record screenshots and remaining limitations; update STATUS with observed results only.

## Existing design gate

Grid/Table → Rectangle/Square → Small/Medium/Large is accepted structurally. Card rendering remains under review; this pass does not silently migrate the live collection controls.

## Definition of done

An implemented item is not considered visually verified until its actual rendered state has been inspected. Local snapshot verification does not establish native plugin compatibility, live provider inference or production deployment.

## Confirmed findings

- Shared Button default was `h-7.5`, smaller than its `sm` variant (`h-8`), while Input and Select use `h-9`. Default now shares `h-9`.
- The root computed font is 16 px; most Tailwind sizing already uses rem. Main small/base type tokens and the affected fixed 10–13 px text exceptions have been normalized.
- Read-only adoption preview confirms the selected native key needs 21 additional registered accesses. Two are currently registered. This is a catalog prerequisite, not a missing button permission. Native permission checks remain enforced.

## Rendered verification

- The dated user snapshot still contains 2 registered model cards and 23 explicitly configured model references. No model/group/key was saved during this repair QA.
- Key draft: selected both registered models, opened adoption while dirty, observed 21 missing accesses grouped as Claude 1 / Codex 12 / Google 8, navigated to Models and returned with both choices preserved. Native adoption itself remains blocked until these catalog prerequisites are met.
- Final Expert tray at 1392 × 695 CSS px: width 400.52 px, top 64.74 px, bottom 600.19 px at the end of the composer; both actions are visible. The content scrolls independently of its footer. The local publication result belongs to the main column.
- Model editor: clearing the required name blocks Review and exposes `aria-invalid`; restoring it preserves the draft when switching presentation. At 400 × 800, the panel uses 384 px with 8 px margins and has no internal horizontal overflow. The identity action wraps below the title. The Expert summary remains beside the form while its content scrolls.
- Group editor: Continue is disabled without a name and without members at their respective steps. A temporary two-model group retained its name and selection after changing mode. Its Review and actions were inspected at 400 px; the temporary draft was discarded without saving.
- Provider appearance: all 9 rows inspected, including the bottom of the list; logo selection and reset work. An SVG upload is rejected with the localized supported-format message. No successful new image upload is claimed. At 400/800/1393 px, inspected sections have no horizontal overflow. Container-based row layout fixes the overlap previously visible at 800 px.
- Shared source checks, TypeScript and Vite compilation pass. Final JavaScript: 802.51 kB minified / 240.79 kB gzip; the existing large-chunk warning remains. No native Go binary or production deployment was performed.

### Local visual evidence

- `cle-resume-corrige.png`: final loaded Expert key summary.
- `adoption-prerequis-cpa.png`: actual adoption prerequisites.
- `formulaire-commun-modele.png`: shared model journey.
- `reglages-logos-corriges.png` and `reglages-mobile-corriges.png`: provider settings.

Images are stored in the task's local visualization directory, outside the repository. Viewport measurements above use observed CSS dimensions; the browser zoom changed during QA and physical overrides were adjusted accordingly.

Independent final Luna audit found no additional definite defect in the changed source. Visual approval remains Sofian’s; this checklist records observed checks only.


## Models.dev and per-access endpoints

This subsequent pass uses a separate copy at `dist/checks/modelsdev-endpoints-review/registry.json`. At the start of this pass, the existing review configuration contained **3** registered models; the earlier count of 2 above belongs to the earlier repair. Production and the dated raw capture remain unchanged.

- [x] Embedded snapshot regenerated from pinned Models.dev source `6a0b12bc9c66e1ab4fe44232d592a32df09a77e0`: 428 canonical references, 223 providers, 8,185 offers; upstream authored fields, resolved values and omissions retained. Deterministic JSON/gzip generator checks pass.
- [x] Catalog import/override/manual mapping/restart and omitted-field composition checks pass. The UI preview respects omissions while retaining explicit access overrides.
- [x] Per-access endpoint read/save and legacy omission preservation pass. Explicit null, empty, unknown or duplicate endpoints are rejected; unknown access JSON fields return 400 without save or native writes. New access permissions are never inferred from model kind.
- [x] Full source checks (`./scripts/test.sh`: Go tests with race detection and vet), `make script-check`, frontend checks and production compilation pass. Focused admin checks were rerun after restoring strict access decoding. The existing Vite bundle-size warning remains.
- [x] Dated-copy browser QA: unselecting every endpoint prevents review/save and opens the incomplete access. Responses alone saves successfully; after reload, only Responses remains checked. Other accesses retain their original sets. The UI explicitly reports a local-copy save.
- [x] Desktop and narrow rendered access dialogs inspected, including keyboard navigation and all nine operations. Observed CSS viewport widths: 1600 and 444 px. At narrow width the dialog has equal client/scroll widths (426 px), with readable labels and reachable actions.
- [x] Independent synthetic fixture: refreshing Models.dev displays source date September 25, 2026, pinned repository/commit, and a separate refresh time. It adds 428 source references while preserving four fixture references and four configured accesses. No Bifrost refresh or inference was performed.
- [x] Original configuration SHA-256 remains `2810bdfac0df400471e2d48ad3f6c3183bb5e98d06bbe3f36a04b174d30afce9`; only the dedicated review copy changed during save QA.

Visual evidence in the task visualization directory: `endpoints-desktop.png`, `endpoints-mobile.png`, `modelsdev-source.png`. Bounded Luna implementation and independent audits were used. Source tests and the local review server do not establish native plugin ABI compatibility, actual provider support, inference, native price/limit application or production readiness. No commit, deployment or production mutation was performed by this pass. Follow-up remains tracked in [#17](https://github.com/sofianbll/bifrost-plugin-registry/issues/17) and the model-card contract.
