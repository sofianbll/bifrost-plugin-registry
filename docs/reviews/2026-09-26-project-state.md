# Project reconciliation — 26 September 2026

This audit reconciles the released product, merged changes, local experiments and
the decisions of September 25–26. It is a dated inventory, not a replacement spec
or authorization to implement or deploy. Source inspection, GitHub reads and
existing evidence were used. No application tests, inference or production
checks were run for this audit. Existing working changes were preserved.

## Product objective and ownership

Registry provides one model card with exact provider accesses, reference data,
protected corrections, groups and per-key selections. Bifrost owns credentials,
native permissions, inference, routing and operational governance. Models.dev is
to be reused inside Registry for reference data and source semantics; Registry
adapts the result and applies supported changes to Bifrost. The target is broader
than a visual redesign or an enriched catalog stored only in Registry.

Authoritative scope sources: [current release status](../../STATUS.md),
[current decisions](../design/product-direction.md#recadrage-des-fiches--décisions-du-26-septembre-2026-implémentation-à-qualifier),
[native model-card contract](../design/model-card-bifrost-contract.md), and
[Models.dev research](../design/models-dev-reuse-research.md).

## Delivery layers: do not conflate them

| Layer | Observed state | Meaning |
| --- | --- | --- |
| Published V1 candidate | `v0.2.0-rc.1`, September 24; Bifrost 2.2.2 dynamic gateway and separate Registry `.so` | Published artifacts with recorded ARM64 and AMD64/musl qualification; not a production certification. |
| Merged follow-up | PR #15 merged; remote `main` is `863568bd3029792a763be3a8d95cd367cb8754b7`; issues #14 and #16 closed | Catalog assistance and UX repairs are merged but absent from RC artifacts. |
| Local model-card work | `codex/prototype-model-card-modelsdev`, `d8bebc1` | Six commits beyond PR #15's head, including prototype work and actual admin/UI fixes. These are not established as integrated into remote main. |
| Current decisions | Modified `CONTEXT.md` and product direction; untracked native contract, Models.dev research and visual inventories | Present locally and copied into the Kimi checkout; not yet committed/published as a complete implementation specification. |
| Kimi work | `codex/kimi-ux-prototype` in the existing `review-catalog-pr15` worktree, also based on `d8bebc1` | Sofian reports Kimi is working. New key-composer prototype files and UI changes are visible. No review or completion claim is made. |

Local `main` and `origin/main` still point to `776baa3`; the live GitHub API shows
the newer merge above. Remote-tracking refs are stale. No checkout, reset, merge,
commit or cleanup was performed. PR #15 and #13 are merged; no open PR was listed.
Open issues are #1 (umbrella V1 spec) and #7 (deferred integrated installation).
There are no dedicated open implementation tickets for the September 26 scope.
GitHub also still marks the older `v0.1.3-native` as Latest while the V1 RC is a
prerelease; that label does not supersede the standard installation direction.

## Complete work inventory

| Area | Already present | Remaining for the current target |
| --- | --- | --- |
| Catalog and identity | Reference/access records, source candidates, provenance, explicit mapping and protected manual corrections | Complete field correspondence and native-property reuse; preserve exact model/access identity across the richer catalog. |
| Models.dev | Existing HTTP import; pinned upstream-core generator and Sonnet/two-offer experiment | Integrate the reusable generation/validation and canonical links into the real Registry data flow. Preserve source `base_model`, provider-authored differences and omissions. Qualify refresh, failure recovery and correction precedence. |
| Editing native properties | Registry metadata editing and native alias installation | Establish the read/write destination per property, partial-failure behavior and native readback. A Registry correction or homonymous additional attribute is not a native technical-field update. |
| Groups and keys | Shared groups, per-key model additions/exclusions, creation, native adoption and naming modes | Deliver the accepted selection contract at provider-access granularity, including initial defaults, future accesses off, inherited/direct origins and local exclusions that win. |
| Common alias and routing | Native aliases, static `Prefer`, passthrough support and permission application | Qualify native routing restricted to each key's selected accesses; no new Registry routing engine. Verify effective provider and exact upstream model, including excluded-access refusal. |
| Publication and persistence | Revision checks, Registry save, native application phases, independent `/v1/models` readback and verified/drift/not-verified states | Extend and requalify these existing paths for the new field/access contracts. Native application is not one atomic transaction with Registry persistence. |
| Import/export and migration | Versioned JSON, preview, backups, flat CSV, offline converter | Preserve compatibility or specify migration if the next persisted schema changes; do not redesign this feature without need. |
| AI assistance | Reviewed field proposals, exact reference candidates, native key/model selection and explicit secret reveal/copy in PR #15 | Preserve behavior in the redesign and later integration. Synthetic checks do not establish real-provider suggestion quality. |
| UX/UI | Production React shell and components, local card experiments, provenance/draft fixes | Kimi's first delivery is two clickable key-creation variants, then user selection and subsequent app-wide design. The initial audit had not recovered the later Kimi UX choices; see the recovery addendum below. Native integration remains outstanding. |
| Qualification and distribution | Reproducible checks and version-specific gateway/plugin release evidence | Qualify the final changed pair and supported architectures; verify the new full Hermes journey, then prepare a new release. Real-provider tests need their own scope and cost authorization. |
| Deferred work | Lab demonstration/history and prior native-menu proof | Active lab runner, exhaustive capability certification, integrated native menu/#7, optional fork work and production rollout remain separate. |

## Models.dev: retain the work already done

The research note says its proposed integration was not implemented. That must
not be read as “no Models.dev code exists.” The existing HTTP importer is in
`internal/admin/catalog.go`. Separately, `scripts/modelsdev-prototype.ts` calls
the actual pinned upstream `generateCatalog`, retains raw provider data and
`baseModelId`, and generates the Sonnet catalog under
`ui/src/model-card-prototype/`. Its README records source and state checks plus
two UI revisions. The first interaction was rejected; the second still needed
user comprehension validation. This is an in-memory experiment, not the native
application contract. Repeating that same experiment is not the next task.

The production importer still tries `row.base_model`, while the pinned upstream
generator removes it from resolved output. Its synthetic import fixture contains
that field. This is a contract mismatch to address, not proof that every import
fails. The prototype already demonstrates one way to retain the source link;
general integration still needs omissions, missing references and refresh rules.

## Evidence boundaries

- [V1 final evidence](../../reports/v1-final/README.md): Bifrost 2.2.2, ARM64 and
  AMD64/musl; 42 model and 54 standalone checks on each architecture; packaged
  image checks, ARM64 adoption and four Hermes checks. Hermes used a synthetic
  provider. Public download hashes were checked at that recorded time.
- [September 25 audit](2026-09-25-ux-audit.md): corrected 2.2.3 ARM64/musl
  candidate, 18 browser journeys and 133 native HTTP checks, synthetic providers.
  The [older 2.2.3 report](../../reports/bifrost-2.2.3/README.md) covers a different
  source snapshot; neither report certifies all later local changes.
- [Local clarity review](2026-09-25-model-card-clarity.md): admin/UI checks and
  isolated snapshot QA, including cancellation and atomic Registry corrections;
  no new gateway/plugin ABI or real-provider qualification.
- CPA restoration and real-provider pilot evidence belong to earlier, separate
  sessions/builds. Current local service health and production were not queried.

## Documentation and handoffs to interpret carefully

The root `HANDOFF.md` describes an older mockup/integrated deployment state.
It is not the current mandate. Historical sections after the explicit history
heading in `product-direction.md` still say publication or additions/exclusions
are missing; current code implements them at the existing scope. The V1 spec's
Registry-only metadata rule is superseded by the September 26 native-field
direction; its AI deferral is superseded by `catalog-assistance.md`.

Figma is a partial retained library, according to `dist/figma/HANDOFF.md` and
the latest Figma chat result. Completed screen assembly is not established;
the Figma service was not re-read in this audit. It is not a prerequisite for
Kimi. The Kimi brief is `/tmp/bifrost-kimi-ux-2026-09-26.md`; its checkout must
remain available while that external work continues.

## Dependency-based continuation proposal

1. While Kimi explores the UI, consolidate one backend contract from the existing
   Models.dev experiment and native-field inventory: canonical/access IDs,
   authored versus inherited values, corrections, persistence, and actual native
   write/readback destinations. Reference existing documents; do not repeat the
   Sonnet prototype or invent UI layout decisions.
2. Resolve the two technical unknowns with bounded local evidence: durable
   Models.dev refresh/mapping, and native common-alias routing with two simulated
   providers and two differently restricted keys. These can be investigated
   independently; neither alone completes the feature.
3. Combine that evidence with Sofian's Kimi UX choice. Reconcile the implementation
   spec and create dependent, testable tickets for gaps only. Keep existing
   publication, imports, AI assistance and permissions behavior as regressions.
4. Integrate, review the six local commits and new changes against merged main,
   requalify the exact gateway/plugin pair and complete the client journey before
   release. Production rollout remains a separate authorized operation.

No new implementation priority was accepted by the user during this audit.
This sequence is a proposal grounded in dependencies, not a newly launched build.


## Recovery addendum — September 27

The local Kimi Code session was recovered from its session store, alongside its
source files, earlier captures and scenario checks. Its last turn ended with a
five-hour quota error. User-authored messages resolve the outstanding UX choice:
keep both Basic and Expert, Basic only on mobile, the card's Accesses menu, and
a compact Expert toggle beside the theme control. These choices are now recorded
in the [native model-card contract](../design/model-card-bifrost-contract.md#parcours-de-clé--choix-de-sofian-dans-la-session-kimi-du-26-septembre).
They supersede the initial brief's request to choose only one variant.

Kimi implemented the compact toggle before interruption. Recovery QA reproduced
one unfinished detail: when a desktop Expert session became mobile, the content
was Basic but the disabled toggle still appeared active. The fix makes its visual
and accessible state follow the effective mode while retaining the desktop
preference and draft. Browser checks after the fix confirmed mobile Basic, an
inactive disabled Expert control, the guided group step, and the selected model
remaining present when Expert returned at desktop width.

Recovery verification:

- Existing nine UI check entrypoints passed.
- TypeScript and Vite build passed; the existing large-bundle warning remains.
- Kimi's existing state check was recovered from ignored `dist/checks` into
  `ui/src/key-composer-prototype/state.test.ts` in the prototype worktree.
  `npm run check:key-composer --prefix ui` passes 22 assertions. These are state
  checks, not 22 independently verified browser journeys.
- Earlier Kimi captures and reported browser checks predate the final compact
  toggle; they are retained as dated evidence, not passed off as final screenshots.
- Native Bifrost, production and provider inference were not exercised.

Repository cleanup makes `STATUS.md` the entry point, marks the old root handoff
historical without discarding it, and marks superseded V1 criteria explicitly.
The Models.dev source experiment, contracts and visuals are retained. Remote
`origin/main` was refreshed; working branches are preserved. No prototype has
been promoted to production and no public issue, PR or release was changed.

The UI prototype remains in `codex/kimi-ux-prototype`, in the existing
`review-catalog-pr15` worktree. From that directory, launch
`npm --prefix ui run prototype:key-composer` and open
`http://127.0.0.1:8772/key-composer-prototype.html`. The other navigation entries
are placeholders; remaining screens and native application are still work ahead.

Local recovery assets (original source archive, hashes, relevant user-message
extract and earlier Kimi captures) are preserved under ignored
`dist/recovery/kimi-2026-09-27/` in the coordinating checkout. Original Kimi session
logs remain untouched. The portable return handoff is
`/tmp/bifrost-kimi-return-2026-09-27.md`.
