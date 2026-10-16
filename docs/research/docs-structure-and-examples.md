# Documentation structure and examples for #164

**Status: proposal, not accepted or implemented. Sources checked: 2026-10-16.**

Scope: clearer documentation content and task navigation for a homelab operator; keep VitePress and the already approved homepage B. This is not a generator comparison, full documentation audit, runtime change or deployment plan. No AI assistant, external SaaS component, marketing banner or palette redesign is proposed.

Method: read the official pages indexed below, then compare their concrete structures with this checkout's installation and user guides. Three product examples only: Docker, Tailscale and Caddy. Maintained research notes here are English; the requested rewrite example remains French.

## Problem grounded in the current guides

- Installation places a long current-and-historical artifact matrix before the recommended procedure; current credentials, verification, activation recovery, upgrade and evidence share one page. These are useful facts serving different moments of work, not disposable detail. [R1]
- The user guide already starts with tasks, but “Compose groups and keys” combines reusable selections, adoption prerequisites, permission-changing blocker resolution, publication and readback. Splitting by operator goal is a proposal, not a finding that these features are wrong. [R2]
- The safety contract must remain visible: gateway image **without** the plugin plus a separately installed compatible `.so`; matching architecture/toolchain/dependencies/libc; staging before migration; two distinct admin secrets; persistent data; stopped-volume backup; no unsupported hot reactivation or implied migration qualification. [R1]

## Primary framework: Diátaxis, with Google for procedural writing

Diátaxis distinguishes learning-oriented tutorials, goal-oriented how-to guides, information-oriented reference and understanding-oriented explanation. Its how-to guidance says to name the user's goal, maintain a logical sequence and link to supporting reference instead of inserting every detail. These are authoring principles, not evidence of effectiveness for Sofian. [D1–D5]

Apply them without forcing four new top-level silos:

- **Learn:** a bounded first catalogue/group/key exercise on a disposable staging instance, with expected results; not a production migration tutorial. [D2; proposed application]
- **Do:** install a compatible pair, restrict one key, adopt an existing key, recover activation, prepare an upgrade or restore a backup. Keep recovery and upgrade separate. [D3; proposed application]
- **Look up:** exact artifact pairs, settings, credential roles, checksums and version-specific qualification limits. [D4; proposed application]
- **Understand:** why there are two artifacts, model versus provider access, group versus key exclusions, and why listed IDs do not prove inference. [D5; proposed application]

Google recommends conditions before instructions, descriptive links and numbered sequences; its procedure guidance also separates alternative methods, asks for prerequisites in advance and generally keeps one action per step. Adopt these rules, not English-only spelling rules for French pages. [G1–G2]

## Three transferable examples

| Official example | Sourced observation | What to reuse here (proposal) | What not to copy |
| --- | --- | --- | --- |
| Docker Engine installation [E1] | Leads with platform selection and an architecture matrix linking to platform-specific procedures; distinguishes stable/test channels and explicitly bounds verification for derivative distributions. | First choose the host and compatible pair; show current supported rows first, with clearly linked historical reference and exact qualification boundaries. | Docker's platform breadth or backward-compatibility statements: they establish nothing about Registry's Go plugin ABI. Do not copy a large matrix into every task. |
| Tailscale quickstart [E2] | “Create a tailnet” uses numbered onboarding steps, states when authenticated devices should appear, then links to permissions, logging and troubleshooting topics. Later sections expand into many use cases. | A short first-success route with visible checkpoints; make later operations independently discoverable rather than prerequisites for first use. | Hosted sign-up/SSO, commercial-plan details, invitations or the long use-case tail. Registry's two admin credentials and native key permissions are different contracts. |
| Caddy Getting Started [E3] | Declares objectives and prerequisites, warns about an already-running service before the exercise, and checks configuration and a visible HTTP response. Navigation separates tutorials and reference. | Put prerequisites and conflicting-state warnings before action; pair steps with observed outcomes and link to reference for technical detail. | Its deliberately exploratory daemon/API/config tutorial as the install procedure. Especially do not transfer its zero-downtime reload behavior: Registry's loaded `.so` has restart/recovery limits. [R1] |

These examples were selected for operational transfer, not popularity or visual similarity. VitePress/Vue guides were not added: this question is about operating the installed product, not authoring a documentation site or frontend.

## Proposed navigation and task shape

Use plain task labels in the existing documentation navigation, not Diátaxis terminology the reader must learn:

- **Start:** prerequisites and compatible files → install image and plugin → verify installation → first catalogue and key.
- **Manage access:** register a model → create a reusable group → restrict one key → adopt an existing Bifrost key. Distinguish prerequisites from permission-changing confirmations. [R2]
- **Operate safely:** credentials and exposure → backup/restore → upgrade and migration limits → activation recovery → troubleshooting by symptom. [R1]
- **Reference and concepts:** settings, compatibility/history, provenance and qualification evidence; model/access/group/key relationships. Link to these from the action that needs them, preserving current authoritative sources. [R1–R2]

This is a proposed grouping, not a mandate for a page per arrow. First improve headings and links in existing guides; split only independently useful tasks. Preserve existing URLs/anchors, or provide deliberate redirects if a later approved change moves them.

For each operational task: **goal → applies to / prerequisites → warnings before mutation → actions → expected result → failure/recovery link**. Keep necessary warnings in the task, not only in a linked appendix. Move historical digressions, not present-tense safety conditions. These are applications of [D3, G1–G2], not newly qualified procedures.

Installation's first screen should distinguish a new gateway from an existing deployment, identify the compatible two-artifact pair and point to credential/storage prerequisites before starting. Keep checksums and pinned image references accessible at the download step. Do not call v0.3.0/2.2.6 → v0.4.0/2.3.0 an in-place qualified upgrade; retain stopped full-volume backup and coordinated image/plugin switching constraints. [R1]

## Small French before/after: same technical contract

**Before — verbatim opening paragraph of `docs/fr/INSTALL.md`:** [R3]

> Registry s'installe en **deux artefacts séparés** : une image de gateway Bifrost compilée avec chargement dynamique (elle ne contient aucun plugin) et le plugin Registry, un fichier `.so` qui embarque son interface. Les deux doivent provenir de la même compilation : même architecture, chaîne Go, versions de dépendances et libc. Démarrer l'image n'installe pas le plugin. Utilisez une instance de staging avant de migrer un déploiement existant.

**After — editorial proposal only:**

> Pour installer Registry, il vous faut **deux artefacts compatibles** :
>
> - Une **image de gateway Bifrost compilée avec chargement dynamique**. Elle ne contient aucun plugin.
> - Le **plugin Registry (`.so`)**, qui embarque son interface.
>
> **Démarrer l'image n'installe pas le plugin.** Les deux artefacts doivent provenir de la même compilation : même architecture, chaîne Go, versions de dépendances et libc.
>
> **Avant de migrer un déploiement existant, utilisez une instance de staging.**

No command, version promise or technical step was added. The rewrite changes hierarchy and sentence placement, retaining both artifacts, the build constraints and the migration warning. It is not necessarily shorter; lower density is not omission.

## Validation proposal: three realistic tasks, not a synthetic score

Run a moderated walkthrough with Sofian, then another homelab operator if available, on disposable synthetic data only. Record navigation choices, wrong turns, missing prerequisites and misunderstandings; no speed target or efficacy claim is established.

1. **Install on a Linux ARM64 homelab test host.** From documentation navigation, identify the current compatible image and separate `.so`, checksum verification, two secret roles, persistent volume and loopback panel exposure; reach the documented active/loaded and dedicated-key readback checks. Fail if starting the image is mistaken for installing the plugin, or readback for an inference test. [R1]
2. **Restrict one existing key without changing the shared group.** Find registration/adoption prerequisites, review native permission boundaries, exclude one provider access for that key, review/publish and inspect `/v1/models`. Pass only if the operator distinguishes group edits from key exclusions and understands that adoption cannot widen native permissions. [R2]
3. **Plan a v0.3.0/2.2.6 → v0.4.0/2.3.0 change, then diagnose disabled-plugin recovery.** Without touching a real gateway, locate the non-qualified in-place migration limit, stop/full-volume backup, paired switch and coordinated restore requirements; separately find same-byte persistent-local-path activation recovery. Fail if recovery is treated as upgrade qualification, hot reactivation or rollback by replacing only the `.so`. [R1]

## Source index and limits

All external URLs below were fetched and read on 2026-10-16. Repository sources were read locally at checkout `c77f47ff3e510bd5be2e175fe321c6355770998a`; the three guides cited below are unchanged from published commit `340aeb41999fd2465e21b968c2186625c45ceab2` (checked with `git diff`), which the links use. No secondary article or search summary supports the documentation observations.

- [D1] Diátaxis overview: https://diataxis.fr/
- [D2] Tutorials: https://diataxis.fr/tutorials/
- [D3] How-to guides: https://diataxis.fr/how-to-guides/
- [D4] Reference: https://diataxis.fr/reference/
- [D5] Explanation: https://diataxis.fr/explanation/
- [G1] Google style highlights: https://developers.google.com/style/highlights
- [G2] Google procedures: https://developers.google.com/style/procedures
- [E1] Docker Engine installation: https://docs.docker.com/engine/install/
- [E2] Tailscale quickstart: https://tailscale.com/docs/how-to/quickstart
- [E3] Caddy Getting Started: https://caddyserver.com/docs/getting-started
- [R1] Registry installation: https://github.com/sofianbll/bifrost-plugin-registry/blob/340aeb41999fd2465e21b968c2186625c45ceab2/docs/INSTALL.md
- [R2] Registry user guide: https://github.com/sofianbll/bifrost-plugin-registry/blob/340aeb41999fd2465e21b968c2186625c45ceab2/docs/USER-GUIDE.md
- [R3] French source paragraph: https://github.com/sofianbll/bifrost-plugin-registry/blob/340aeb41999fd2465e21b968c2186625c45ceab2/docs/fr/INSTALL.md

Limits: this research and the focused rendered inspection below do not establish comprehension, a complete navigation/accessibility audit, or correctness by executing installation, migration, restore or gateway procedures. External pages can change. The proposed reader walkthroughs have not run. No claim that another project's style is proven effective for Sofian; no product implementation, push or production access.

## Additional focused audit and rendered evidence

Three bounded subagents investigated current content, official examples and skill discovery independently; the coordinator inspected the existing guide rendering, not a redesigned page. Content findings are documentary, not findings about runtime behavior:

- The French sidebar mainly names document types (user guide, configuration, security); the installation entry does not distinguish first installation from upgrading an existing deployment (`docs/.vitepress/config.ts:98–120`, `docs/fr/INSTALL.md:37–43`).
- The installation matrix has 15 rows, only two for the current release; previous-release digests also interrupt the current procedure (`docs/fr/INSTALL.md:13–34,59–76`). Move the historical material to discoverable reference, not to deletion.
- Key adoption and native-permission changes are dense paragraphs, while French action wording differs from the accepted vocabulary (`docs/fr/USER-GUIDE.md:30–40`, `CONTEXT.md` entries “Adopter une clé”, “Décision d'adoption” and “Préalable à l'adoption”). Reconcile wording with the current interface before rewriting.
- Security guidance still names V1/Bifrost 2.2.2 evidence (`docs/fr/SECURITY.md:5,23–29`), while installation targets v0.4.0/Bifrost 2.3.0. Mark historical evidence and current requirements explicitly; do not silently relabel old evidence as current qualification.

Local Chromium inspection on 2026-10-16 covered French INSTALL, USER-GUIDE and CONFIGURATION at 1280 and 375 px. On INSTALL, the first command starts at approximately 4,395 px at 1280 px width and 5,339 px at 375 px width, after the mixed-version matrix. At 375 px the matrix needs horizontal scrolling (618 px content in a 327 px table viewport). These are observations of this layout, not reading-time measurements or proof that users fail. Evidence and reproducible script: local ignored `dist/checks/docs-ux-research/` (`rendered-inventory.json`, `.mjs`, screenshots).

VitePress 1.6.4 already supports named warning containers, details blocks, heading anchors and code groups. Use these selectively without new packages: keep safety preconditions visible, reserve disclosure for uncommon explanations/history, and use code groups only for real alternatives. Source: https://vuejs.github.io/vitepress/v1/guide/markdown#custom-containers and https://vuejs.github.io/vitepress/v1/guide/markdown#code-groups.

## Skill discovery: optional help, not a prerequisite

No skill was installed. Existing research, prototype and frontend-design capabilities suffice for a first representative documentation prototype; domain-modeling is not required merely to organize pages or consume the existing vocabulary.

- **Best optional addition: `documentation-writer` from `github/awesome-copilot`.** Its actual source requires reader/goal/type/scope clarification, an approved outline, then Markdown drafting using Diátaxis. The catalogue showed 27.5K installs; GitHub API showed 40,074 repository stars on 2026-10-16. Neither measure proves writing quality or compatibility. Read: https://github.com/github/awesome-copilot/blob/main/skills/documentation-writer/SKILL.md ; catalogue: https://skills.sh/github/awesome-copilot/documentation-writer. It restricts external browsing unless links/instructions are supplied, so pass the approved sources. Optional installation only after owner consent: `npx skills add https://github.com/github/awesome-copilot --skill documentation-writer`.
- **Complement, not a structural solution: Impeccable `clarify` / `distill`.** The first addresses understandable interface language; the second reduces overload. Do not mechanically remove VitePress navigation or safety warnings. Current upstream groups them under Impeccable rather than necessarily exposing the standalone catalogue entries; it can invoke a provided/downloaded binary. Read source before any installation: https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/SKILL.md and https://github.com/pbakaus/impeccable/blob/main/.agents/skills/impeccable/reference/clarify.md.

Recommended next experiment, subject to approval: prototype the documentation index/navigation and two representative tasks (installation and first key) in the real VitePress shell. Reuse existing content and anchors first, preserve expert reference and all safety conditions, and test reader tasks before a whole-site rewrite. Homepage B remains the accepted showcase direction; this documentation experiment is separate and unimplemented.
