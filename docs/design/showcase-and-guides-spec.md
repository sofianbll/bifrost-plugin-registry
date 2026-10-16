# Registry showcase and task-oriented guides — #164

**Status: specification draft, not approved for implementation.** The owner selected showcase B and documentation B as layouts, rejected the first prototype's wording, then approved the replacement editorial outline on October 16, 2026. That outline approval is not approval of the complete replacement copy. The current mandate ends with a locally checked reading prototype and this specification, ready for review.

Tracking issue: https://github.com/sofianbll/bifrost-plugin-registry/issues/164

## Problem Statement

An operator who already uses Bifrost needs to understand what Registry adds, see the product and find a usable first path. A guide index does not explain the product. Conversely, a long installation page mixing current files, historical builds, recovery and release evidence delays the actions the reader came for. The first-key guide mixes optional reuse, adoption decisions and native-permission changes with the main task.

The rejected prototype improved layout but still sounded like a qualification report: abstract labels, repeated cautions and checkpoints that restated the preceding instruction. Shortening every warning would be unsafe; the problem is to put each fact where it helps the operator act.

## Solution

Keep one static VitePress site at the existing GitHub Pages address. Use the selected product-first homepage B and sequential documentation B, with natural, equivalent English and French copy. Let the reader follow **understand Registry → install on a new test instance → choose models for an existing application key → consult a reference or troubleshoot**.

Use Diátaxis to separate the purpose of the writing, not as new navigation terminology: product presentation on the homepage, a task index, an installation procedure and a bounded first-key exercise. Link to technical reference without hiding a prerequisite or a permission-changing consequence. Keep the existing identity, screenshots, hosting and deployment workflow.

## User Stories

1. As a Bifrost operator discovering Registry, I want a plain explanation of its catalogue and per-key selections, so that I know whether it addresses my use case.
2. As that operator, I want the catalogue screenshot near the opening, so that I can see the product before reading implementation detail.
3. As a reader, I want clear installation and documentation links, so that I can continue without guessing where to start.
4. As an operator, I want catalogue, selection and Bifrost verification described separately, so that I do not mistake a model card for a permission or a verified model call.
5. As a reader choosing a task, I want an index organised by actions, so that I can find installation, first use, access management, operation or reference directly.
6. As an installer, I want only the current Linux AMD64 and ARM64 choices in the main path, so that historical releases do not obscure the files I need.
7. As an installer, I want the dynamic gateway image distinguished from the separate matching plugin, so that I do not assume starting the image installs Registry.
8. As an installer, I want checksum and pinned-image information where I download or start the software, so that I can identify the exact compatible pair.
9. As an administrator, I want the two server-side credentials explained by role before use, so that I do not confuse them with an application's virtual key or expose them in examples.
10. As an operator with an existing gateway, I want an explicit boundary before commands, so that a new-instance example does not become an accidental unqualified migration.
11. As an installer, I want to check plugin loading and the Bifrost connection, so that an accessible panel alone is not mistaken for a working connection.
12. As an application operator, I want to start with an existing test key, so that I can learn selection without a fictional key-creation workflow.
13. As that operator, I want model registration and selection to be distinct, so that saving a model card does not appear to grant access.
14. As an operator adopting a key, I want prerequisites separated from required decisions and exact native-permission changes shown before confirmation, so that I understand what will change.
15. As an operator selecting models, I want to know that all linked accesses are initially included, so that I review provider choices before publication.
16. As an operator maintaining one application, I want local exclusions distinguished from shared-group changes, so that I do not change other applications unintentionally.
17. As an operator publishing a selection, I want to read the verification already triggered by publication, so that the guide does not require a redundant second check.
18. As an operator reading a result, I want verified totals, retained-but-unlisted permissions and other differences explained accurately, so that a missing model is never counted as confirmed.
19. As a returning reader, I want current reference, historical versions, recovery and upgrade constraints still reachable through their existing links, so that the simplified path does not remove operational information.
20. As a French or English reader, I want equivalent actions, warnings and screenshots in my language, so that one locale does not promise more than the other.
21. As a keyboard or mobile reader, I want readable text, visible focus, working navigation and no global horizontal scrolling, so that the site remains usable without a desktop pointer.
22. As a maintainer, I want one static build and deployment without prototype controls or generative services, so that this documentation does not add runtime infrastructure or secret management.

## Implementation Decisions

### Accepted constraints

- Keep VitePress, one GitHub Pages address and one deployment. OpenUI is excluded by the owner, not because it is inherently incompatible with Vue.
- Preserve Registry's zinc surfaces, emerald action accent, Geist typography, existing logos, light/dark appearance and responsive navigation. Do not redesign the product panel.
- Keep the product-first homepage B: compact centred introduction, large catalogue screenshot before the three functions, key-selection screenshot, concise installation context and links.
- Keep sequential documentation B: a task and its prerequisites, ordered actions, useful observable checkpoints, then supporting detail. Optional shared groups are not a compulsory step in the first-key exercise.
- Write for a Bifrost operator discovering Registry. English and French must be equivalent in substance, not mechanically identical in sentence structure.

### Content modules and interfaces

- The shared static theme supplies identity and navigation; Markdown remains the authoritative, GitHub-readable guide content. Do not ship prototype content objects, comparison wrappers or a client-only replacement for entire guides.
- The homepage presents catalogue, selection and list verification without installation commands or a release-history matrix. Screenshot captions identify fictional example data; no live gateway or real-user outcome is implied.
- The guide index uses action links under Start, Manage access, Operate and troubleshoot, and Reference. Link descriptions help choose a task rather than restating every contract. Keep links to existing guides that are not being rewritten.
- The installation path covers a new test instance: compatible downloads and checksums; two credentials; persistent gateway and local panel exposure; separate plugin installation; loaded-plugin, panel and Bifrost-connection checks. Link explicitly to the first-key exercise for publication and list verification.
- The first-key exercise covers required model cards; opening/adopting the existing key; models and provider-access choices; review/publication; interpreting the verification result. Screenshots accompany the action they explain. Use actual UI labels in the corresponding locale.
- Preserve detailed material below the guided path on the existing installation and user-guide routes, rather than introducing a page for every verb. Keep independently useful reference sections and historical evidence distinguishable from the current procedure. Do not copy obsolete button labels into the new text; reconcile them in the touched guides.
- Preserve existing guide URLs and deep links using explicit equivalent heading IDs or anchor aliases when reorganising a section. Prototype-only `docView=A` links must become ordinary links to retained reference anchors; no reference may depend on a discarded comparison view.
- The normal VitePress outline and local search must index the delivered content, not the untouched original hidden behind a prototype. Prototype limitations are not accepted delivery behaviour.

### Route and language contract

| Purpose | English | French |
| --- | --- | --- |
| Showcase | `/` | `/fr/` |
| Guide index | `/guides` | `/fr/guides` |
| Installation | `/INSTALL` | `/fr/INSTALL` |
| First-key path and retained user reference | `/USER-GUIDE` | `/fr/USER-GUIDE` |

All paths remain under the existing repository base. Preserve both supported VitePress link forms and GitHub-relative Markdown navigation. Language switching stays on the equivalent page; images and alternative text match the language. Keep the build's existing exclusions for internal design, research and agent records. No new domain, service, analytics or model call is needed.

### Safety and product contracts

- The image and `.so` are separate compatible artifacts. Match architecture, Go toolchain, dependencies, OS and libc; the official static image is not a substitute. The inspected current pair is Registry v0.4.0 / unmodified Bifrost 2.3.0, Linux AMD64 or ARM64, Go 1.27.1, Alpine 3.23/musl. Reconcile current release facts with the release source before final publication; never silently update a version or digest independently of its pair.
- Explain `REGISTRY_ADMIN_TOKEN` (at least 32 characters) and `REGISTRY_BIFROST_AUTH` (complete native-admin Authorization header) before use. Keep dashboard authentication enabled, server-side values private, persistent storage writable, and the administrative panel exposed only on host loopback in the example. Never print a real secret or suggest browser persistence for it.
- Before any command applied to an existing gateway, require a separate test instance and a full stopped-volume backup including SQLite/WAL. Never run two writers on that volume. Keep unqualified in-place upgrades, coordinated image/plugin changes and full-volume restoration explicit. Recovery of the same plugin bytes is not a qualified upgrade, hot reactivation or rollback.
- Registration creates a model card, not key access. Adoption cannot widen native permissions and does not publish pending edits. Separate prerequisites from provider decisions; options marked Changes Bifrost require the exact before/after preview and explicit confirmation, including lost future-provider permission where applicable.
- A model's default selection includes all linked accesses. Local exclusions affect only the selected key; shared-group changes affect inheriting keys. Groups remain optional.
- Publication saves the revision and already triggers verification with Bifrost. Distinguish Verified, Differences found and Not yet verified; explain the possible Verified with one difference when a retained native permission is unlisted. No unlisted model enters the verified total. Neither listing nor model metadata proves inference, routing or provider capabilities.
- Keep local snapshots and historical synthetic screenshots distinguishable from a live connected result. Do not present deferred #102 behaviour, native-menu integration or team administration as delivered features.

## Testing Decisions

Prefer the single highest useful seam: the generated site served under its real repository base, exercised through browser-visible content and navigation. Build assertions supplement this boundary; tests of component internals, sentence length or arbitrary warning counts do not establish a usable guide.

- Build the complete documentation site with no unresolved local links, assets or anchor targets. Confirm that the homepage and guides contain their content in generated HTML and work for basic reading without JavaScript.
- Exercise both languages, light/dark themes and mobile/desktop widths. Inspect the actual render for clipping, wrapping, long identifiers, code/table-local scrolling, screenshot size, navigation and visible keyboard focus. A successful build is not visual evidence.
- Follow the real reader journey: homepage → guides → installation → first key → a detailed reference. Verify language switching, direct deep links, reload, search results and outline links on the final content. No prototype controls or mandatory query parameters may be delivered.
- Check the two complete Markdown originals per guide remain available during the prototype; for final integration, verify preserved reference information and every old heading target rather than requiring identical prose after the authorised rewrite.
- Review every command, credential role, artifact reference, UI action and permission boundary against independent repository sources. Keep warnings before the relevant operation. Check equivalence between English and French; keyword presence alone is insufficient.
- Use the existing documentation build and browser tooling, plus the repository's verification entry point. Read its final result and disclose skipped checks. Existing product journeys provide regression coverage; they do not qualify installation, native compatibility or inference.
- Use the three reading tasks already proposed in the documentation research to discuss understanding: locate an ARM64 installation path; restrict one existing key without changing a shared group; find upgrade versus activation-recovery guidance. No comprehension success is claimed without an observed reader walkthrough. No real gateway execution belongs to this mandate.

### Acceptance checklist for the future site

- [ ] Owner accepts the complete bilingual copy and this specification; layout and outline approvals alone do not satisfy this gate.
- [ ] Homepage B communicates catalogue, selection and Bifrost list verification, with two existing language-matched screenshots and clear guide/install links.
- [ ] Index entries lead to actual tasks; the current installation path has five useful steps and does not start with historical releases.
- [ ] First-key exercise uses an existing key, optional groups, explicit permission boundaries and the verification already triggered by publication.
- [ ] Current files, checksums, secrets, storage, exposure and existing-gateway preconditions remain complete and accurately sourced.
- [ ] Every retained reference and pre-existing public guide anchor resolves without a prototype view parameter; historical evidence remains dated.
- [ ] Search and outline operate on the new final content in both languages; generated HTML is readable without JavaScript.
- [ ] Language parity, mobile/desktop, light/dark, keyboard focus, local navigation and assets are verified on the built site.
- [ ] Comparison controls and development-only copy modules are absent from the final deliverable; one static build/deployment remains.
- [ ] Documentation build, applicable regression checks and final diff review pass; omitted checks and remaining evidence limits are explicit.

## Out of Scope

- Implementing or deploying the final site under this preparation mandate; pushing the prototype, opening a PR or merging without a separate instruction.
- Rewriting every guide or the product interface; regenerating screenshots, changing release artifacts, installing another documentation engine or adding dependencies.
- Native plugin/gateway builds, ABI qualification, infrastructure changes, credential provisioning, real-key operations, migration, recovery execution or inference testing.
- OpenUI, generative demos, a server, an external assistant, new analytics, fabricated customers, benchmarks or testimonials.
- Implementing #102, creating implementation tickets, automatic AFK-ready labelling, or authorising an implement-spec run. These require a later mandate.

## Further Notes

### Decision and source trail

- Tracking issue #164 retains the initial brief and subsequent owner decisions. Its original OpenUI questions are historical, not unresolved choices.
- ADR 0002 records one static VitePress site. The existing domain glossary supplies the vocabulary; no domain behaviour or architectural decision changes in this editorial work.
- The approved project plan is “#164 — Reprise éditoriale de la vitrine et des guides”. Its approval covers the outline and writing direction, not the complete candidate text.
- Product, domain glossary, release status, existing English/French installation and user guides, current UI labels and the documentation research are the factual sources. The installed GitHub documentation-writer skill was read and used: clarify from known decisions, obtain outline approval, then draft Markdown before integrating the reading prototype.
- The primary prototype stays on local branch `prototype/164-showcase`. Existing guide originals remain intact; homepage A/C retain their original copy, while the replacement homepage copy is enabled only for B in development. Proposed documentation B/C shares the rewritten content. The production build intentionally retains the previous page text until a separately authorised final implementation.

### Evidence for this editorial cycle

- Eight English/French Markdown drafts were written using the approved outline, then integrated into the four representative pages of the existing prototype. The drafts and reproducible checks remain in local ignored `dist/checks/editorial-164/`; the candidate source is captured on the throwaway branch.
- Independent documentary reviews found no blocking issue in the editorial outline, the proposed specification or the resulting bilingual copy. Current UI labels, credential roles, adoption boundaries, publication-triggered verification and the retained-permission difference case were checked against repository sources. This is not owner approval of the text.
- The documentation build passed. All eight generated homepage/index/install/user-guide page texts match the pre-editorial production baseline; the new homepage/documentation copy is absent from production JavaScript. All six original Markdown guide bodies remain exactly preserved.
- Browser checks passed for 72 views: three homepage variants and two proposed documentation views on three routes, across English/French, light/dark and 375/1280 px. Checks covered one main heading, active variant, Geist, no page-wide overflow or resource/runtime error, five-step guides, prerequisite order and screenshot placement. The coordinator also inspected representative screenshots of all four pages, including narrow dark-mode reading.
- The complete homepage-to-first-key journey, anchored original reference, variant cycling, language change, search keyboard guard, reload, history, invalid-query fallback and cross-guide mode preservation passed. A static follow-up resolved 37 internal links/anchors, four development image paths and 24 generated resources. An initial validator incorrectly treated development image URLs as production filenames; it was corrected to check source images and hashed build resources separately, then passed. No application repair was needed for that validator mismatch.
- `make verify` ended with **`VERIFY PASSED`**: check, lint and product browser journeys passed. Models.dev snapshot determinism was skipped because its generation prerequisites were missing. This is an existing evidence limit, not a newly qualified snapshot.
- No moderated comprehension study, actual installation, migration, native qualification, inference or remote CI was run. The prototype still lacks a final-content outline/search index and its candidate guides are development-only; the future-site acceptance checklist above remains unchecked. No gateway, release, production deployment or product runtime source changed.

### Delivery and rollback boundaries

This preparation does not touch the published site or production. A future final-site change remains reversible through its documentation/theme commit and the existing static deployment, without gateway rollback or data migration. Do not merge the throwaway prototype as an implementation shortcut. The issue remains open and not labelled ready-for-agent while final-site implementation is unauthorised.
