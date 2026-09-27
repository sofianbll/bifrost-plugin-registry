# Contrat UI actuel

Ce contrat regroupe les décisions validées pour finaliser l’interface complète. Il s’applique avant chaque modification visuelle. Les choix déjà validés restent acquis et ne sont pas à redemander. Dans ce mandat, l’agent peut finaliser les détails cohérents qui restent ouverts; toute modification d’une décision validée exige l’accord de Sofian.

## Source, composition et portée

La version intégrée se trouve maintenant dans le checkout principal `/Users/sofian/Developer/50-Experiments/bifrost-plugin-registry`, sous `ui/src/app`, `ui/src/features` et `ui/src/components/registry`. Elle reprend le dernier prototype du worktree `review-catalog-pr15`; ce dernier est conservé comme source de la consolidation. Ne pas repartir des anciens fichiers plats ni des snapshots historiques.

- Partir du dernier prototype réel examiné par Sofian et de ses composants réutilisables. Le rendu `ReferenceCatalogBrowser` montré dans le présent chat a été rejeté et ne constitue pas une référence valide.
- Composer avec la bibliothèque et les versions déjà validées selon Atomic Design. Réutiliser les composants existants; ne pas créer de doublons ni réécrire les fondations validées.
- Finaliser les parcours Catalogue, détail du modèle, groupes, clés, Gateway, documentation des données, import/export et réglages. Le laboratoire est exclu de la navigation et des parcours finaux; garder son code historique.
- Les écrans qui publient doivent appeler les vrais services et montrer séparément tout état simulé. Ne jamais exposer de secret ni modifier la production.

## Cartes de catalogue

Décision précisée par Sofian le 27 septembre : **Grille/Tableau** choisit la vue ; dans Grille, **Rectangle/Carré** choisit la forme ; **Petit/Moyen/Grand** règle indépendamment la densité. Sur écran large, proposer respectivement **4/3/2 colonnes**, identiques pour les deux formes et adaptées à la largeur disponible. Ces tailles ne changent pas la sélection métier ni les données.

**Structure validée, rendu à ajuster :** Sofian a confirmé « Structure correcte, ajuster encore le rendu des cartes ». Présenter les six combinaisons dans `ui/display-options-review.html` avant de migrer les contrôles actuels. Ne pas propager cette proposition au catalogue, aux groupes et aux clés sans le retour demandé par Sofian. Les références de structure sont [Geist Grid](https://vercel.com/geist/grid) et [Carbon Content Switcher](https://carbondesignsystem.com/components/content-switcher/usage/), adaptées à nos composants.

- Rectangle : cartes plus larges que hautes, hauteur et espacements cohérents même avec du contenu court.
- Carré : rapport réellement 1:1, sans défilement interne. Résumé compact et détails accessibles par les contrôles partagés.
- Tableau : lignes lisibles et actions accessibles.
- Préserver identité, modalités, capacités, logos et accès dans les variantes. Placer identité et sélection en en-tête, faits utiles dans le corps, actions et accès en pied.
- Réutiliser `CatalogCard` ne suffit pas : sa composition et ses états doivent aussi respecter le composant validé.

## Capacités et données

- Résumer les capacités par icônes seules; quand il y en a trop, afficher `+N`.
- Au survol conservé de 500 ms et au clavier, ouvrir le panneau complet de comparaison inspiré de Vercel: sections Input, Output et Features, icône `{}` pour Structured Output.
- Les libellés Image et Video restent explicites. Les modalités restent dans un panneau séparé; ne pas les mélanger aux capacités.
- Expliquer états, icônes et légende dans l’infobulle/panneau. Les variantes à cercles ou diamants sont rejetées; ne pas inventer de nouvelles couleurs.

## Composition et adaptation

- Basic et Expert partagent exactement le même brouillon et les mêmes données; seul le niveau de détail de l’interface varie.
- Sous 1280 px, masquer le sélecteur Basic/Expert; sur mobile, garder Basic.
- Placer le sélecteur près du thème, avec état actif vert et texte blanc. Aligner la barre latérale sur la recherche.
- Fournir français et anglais, modes clair et sombre, textes documentaires lisibles sans longs blocs denses; les contrôles de vue peuvent masquer les détails secondaires. Afficher FR/EN dans l’en-tête avec le nom complet accessible.
- Les créations de groupe et de clé reprennent les compositions Normal/Expert approuvées et les mêmes contrôles de format et de détails. Un seul conteneur gère le défilement de chaque éditeur.
- La navigation principale suit Modèles → Groupes → Clés. Les écrans d’administration se regroupent dans Réglages. La sidebar possède un contrôle visible pour la replier et la déplier.
- Les infobulles d’état restent courtes; ne pas répéter le nom et une explication longue.
- Montrer les données Bifrost déjà capturées dans une copie locale identifiée et datée, sans les confondre avec une connexion en direct.

Ces corrections du 27 septembre remplacent les anciennes notes de hauteur Grid variable et de corps Square défilant conservées dans l’historique ci-dessous.

## Parcours, réglages et aide

- Indiquer les champs réellement obligatoires à leur étape de saisie ; montrer les erreurs près du champ et empêcher une revue invalide. Une valeur documentaire inconnue reste facultative si le contrat ne l’exige pas.
- Réutiliser les panneaux et formulaires partagés ; permettre d’agrandir le modèle et d’ajuster sa largeur en conservant son brouillon et un seul défilement.
- Organiser Réglages en sections identifiables : préférences, sources, connexion, assistance, aide. La navigation s’adapte au mobile. Les références GitHub/Vercel guident la hiérarchie, les composants Registry restent la base.
- Une donnée déclarée vient d’une source ; elle ne prouve pas une capacité testée. Expliquer ce vocabulaire une fois, avec des libellés courts par valeur.
- Expliquer les actions indisponibles et donner la prochaine étape utile. La capture exclut les secrets ; la préparation locale d’une clé est possible lorsque son plan est valide, sans preuve d’accès live.
- Le candidat d’intégration native utilise l’authentification de l’hôte compatible ; le panneau autonome et sa connexion administrateur restent distincts. Ne pas présenter la prise en charge native comme acquise dans l’image officielle.
- Sources : le catalogue local fondé sur Models.dev est la brique cible de Registry. Models.dev externe et Bifrost l’alimentent ; les corrections manuelles doivent rester protégées. Les connecteurs additionnels sont une demande produit, pas une fonctionnalité acquise. L’origine, les dates et les échecs de synchronisation restent consultables.
- Les modèles personnalisés passent par une fiche manuelle et un accès fournisseur explicite. Une fiche documentaire seule ne donne aucun droit.
- Les logos des fournisseurs peuvent être personnalisés sans changer leur identité ou leurs permissions. Indiquer précisément où cette préférence est conservée.
- Fournir une aide courte, facultative et relançable sur les parcours modèles → groupes → clés, ainsi que sur alias, déploiements et routage. Les vues du gateway utilisent les données disponibles sans transformer une capture manquante en absence de configuration.

## Corrections de cohérence en cours — 27 septembre 2026

- Les contrôles standard partagent une hauteur de `2.25rem`; la variante compacte reste à `2rem`. Le bouton standard ne doit pas être plus petit que sa variante compacte.
- Le texte courant utilise `text-sm` (`0.875rem`) ou `text-base` (`1rem`); les métadonnées secondaires utilisent `text-xs` (`0.75rem`). Les informations nécessaires à une action ne doivent pas être réduites à 10–11 pixels.
- Les dimensions de composition doivent suivre la place réellement disponible, y compris dans un panneau redimensionné. Un breakpoint de fenêtre seul ne suffit pas pour ses colonnes internes.
- Les détails d’accès répétés se révèlent à la demande. Le résumé chargé et son action principale doivent rester lisibles après défilement.
- La checklist de correction et les preuves sont conservées dans [la revue active](../reviews/2026-09-27-ui-repair-checklist.md). Une compilation réussie ne vaut pas validation visuelle.

## Historique

Les prototypes, rendus rejetés et notes datées restent des éléments d’historique ou de comparaison. Ils ne remplacent pas ce contrat actuel.

---

# Inventaire historique des composants — état du 27 septembre 2026

La suite conserve le relevé et les observations de cette date. Ses hypothèses de validation ne remplacent pas les décisions consolidées dans le contrat actuel ci-dessus.

Status: the local gallery aggregates 124 previews across 19 families, including current implementations, historical versions and visual references. The separate validated design-system page contains the two accepted families: the latest card structure and icon-only capability summaries. Sofian subsequently approved the Vercel comparison panel presentation with the Braces (`{}`) icon for Structured Output. The approved presentation now backs the shared panel using Registry facts; missing values remain unknown. The previously rejected panel is historical. Other component choices and complete page composition remain pending.

Reviewed: 2026-09-27. Source checkout: `/Users/sofian/.codex/worktrees/review-catalog-pr15/bifrost-plugin-registry`, branch `codex/kimi-ux-prototype`, HEAD `c73a82c` plus the existing uncommitted changes. The main working directory is a different branch; this inventory deliberately follows the interface Sofian reviewed. The later frontend directory reorganization changes paths only; it does not establish visual approval or production qualification.

## Mandate and boundaries

Sofian requested a complete interface component inventory, identification of duplicates and origins, and a shared component library developed together using Brad Frost's Atomic Design methodology. This replaces the premature page-by-page acceptance exercise. Review one component family, including every relevant variant and state, before propagating it through the application. The five browser comments are accepted problem reports, not visual acceptance of the current interface.

Coverage: all 61 TSX source files under `ui/src` (main application, both prototypes, primitives, icons, contexts and entry points), CSS foundations and provider assets; the separate embedded HTML fallback is indexed below. API/state/test files are dependencies, not visual components. Historical HTML mockups and design diagrams in `docs/design` are references, not current component-library implementations. Native Bifrost administration is a host integration, not part of Registry's component ownership.

A static inventory establishes what exists and is reused; it does not establish visual quality, keyboard support or complete behavioral coverage. The current library is not certified or finished.

## Canonical source layout and current choice

The current pass moved code into ownership folders without changing component behavior: `ui/src/app/` composes pages; `components/ui/` keeps local shadcn/Radix primitives; `components/registry/` holds shared Registry controls; `features/{catalog,groups,keys,assistant,laboratory,snapshot,gateway}/` holds production features; `domain/registry.ts` contains shared types and rules; `data/api.ts` owns the same-origin client. `dev/component-gallery/` holds the comparison gallery and archived versions, `dev/fixtures/` holds synthetic Registry data, and `experiments/` holds both interactive prototypes. The production entry and global styles remain at `ui/src/main.tsx` and `ui/src/globals.css`.

The final interface will compose existing components using the Atomic Design levels below. Before choosing a family with multiple viable implementations, show its variants in the gallery and record Sofian's explicit choice. On 2026-09-27 Sofian accepted **only the card structure** of the latest prototype: identity and selection in the header, existing facts in the body, provider access information and actions in the footer. This promotes `CatalogCard`/`CatalogGrid` to `components/registry/` and applies the structure to production model cards, including compact cards. The prestructure production browser remains available as a historical gallery snapshot. A separate later decision accepts only icon-only capability summaries. Sofian rejected the initial shared panel as unlike Vercel, then approved the separate Vercel comparison presentation with a Braces (`{}`) icon for Structured Output. This accepts the visual design, not the fixed fixture as a production data source; the shared model summary is used wherever `ModelBrowser` shows evidence. Its panel leaves source, scope and execution unverified when the model data does not establish them. Logos, other card compositions, and broader application behavior require their own decisions. Basic and Expert key composition choices remain the previously approved direction; these decisions do not approve every card detail, migrate every page, or deploy anything.

## Atomic Design contract

Use the five cooperating levels in [Brad Frost, chapter 2](https://atomicdesign.bradfrost.com/chapter-2/): atoms, molecules, organisms, templates and pages. Molecules perform a simple task; organisms compose substantial sections; templates describe layout/content structure; pages exercise those structures with representative content. Work between parts and whole, including long content and varying data. This is not a mandatory linear waterfall or a requirement to rename every source directory.

Applied classification (proposed):

| Level | Registry examples | Validation surface |
| --- | --- | --- |
| Foundations, supporting the atoms | Semantic colors, Geist/Geist Mono, spacing, radii, icon geometry, motion | Shared light/dark token and size samples |
| Atoms | Button, input, checkbox, label, badge, capability icon, provider logo | Sizes, focus, disabled/error states, names and optical alignment |
| Molecules | Labeled selector, search control, capability item, capability summary, provider/group summary, identity, copy control | Single responsibility, long labels, overflow, mouse/keyboard/touch |
| Organisms | Capability panel, model/group/key card, access chooser, filter toolbar, comparison table, draft panel | All supported variants and shared interactions |
| Templates | Browsing with filters, detail with tabs, guided composition, expert composition, settings forms | Page structure, responsive transitions, no real secrets |
| Pages | Catalog, model details, group editor, key editor and all administration screens | Representative content and cross-component behavior |

## Accepted foundation and source policy

Sofian accepted the existing shadcn/Radix base and Registry-owned compositions, with Vercel and Mistral as composition references. This selects the foundation; it does not approve individual component designs or complete their migration.

| Layer | Current evidence | Source of truth / remaining decision |
| --- | --- | --- |
| Generic React controls | 23 local `components/ui` modules; most vendored from Bifrost, Radix dependencies; Field/Toggle/ToggleGroup recently adapted from shadcn | One local shadcn/Radix foundation; preserve existing behavior and upstream attribution |
| Visual foundations | `globals.css`, Geist fonts, semantic tokens; Lucide imports | Existing tokens, one icon vocabulary; explicit sizes and variants |
| Registry-specific components | Cards, capabilities, accesses, groups, publication, adoption, copy, editors | Registry-owned compositions of the shared primitives |
| Vercel / Geist | Public design references; no Geist component package in `ui/package.json` | Explicit reference for approved interaction/composition, not an assumed importable implementation |
| Brand assets | Bifrost's `ProviderIcons` and assets; sourced Moonshot company mark | One brand catalog with source/license, creator/provider roles and tested geometry |
| Experimental implementations | Two prototype directories; multiple overlapping view/card systems | Comparison fixtures until selected components are promoted; no automatic deletion or fusion |

`npx shadcn@latest info --json` detected Vite, TypeScript and Tailwind 4, but returned `config: null`, `preset: null`, `components: []`. There is no `components.json`. This is a discovery/configuration gap, not evidence that the 23 local modules are absent. CLI documentation defaulted to Base UI; the actual local imports are Radix. Do not migrate or overwrite primitives based on that fallback. Review an explicit Radix configuration separately.

See [local provenance](../../ui/PROVENANCE.md), [shadcn Radix Select](https://ui.shadcn.com/docs/components/radix/select), [Radix Popover](https://ui.shadcn.com/docs/components/radix/popover), and [Geist introduction](https://vercel.com/geist/introduction).

## The five reported problems

| Feedback | Verified evidence | Component family / acceptance target |
| --- | --- | --- |
| Capability popovers are not the requested Vercel pattern | `key-composer-prototype/cards.tsx` renders individual capability popovers as text-heavy provenance fields | One shared capability summary and grouped icon/label panel; show useful capability meaning first, retain scope/source details on demand |
| Detail-page capabilities need recognizable icons and visual comparison | `ModelDetail.tsx` has a text/badge property table, independent of the card capability renderer | Reuse the same capability definitions, icons and state meanings in compact summary, expanded panel and detail comparison |
| Provider-access selector is inconsistent | Two native `<select>` render sites in `ModelDetail.tsx`; local `Select` and `SearchableSelect` already exist | Choose the existing control according to fixed choices vs search/custom input; preserve its shared presentation |
| Gemini mark appears off-center | User screenshot shows the issue; the wrapper centers its box, while the SVG declares a 28×28 viewBox with a drawing occupying a different internal region | Measure the rendered mark and asset bounds before correction; do not apply per-card padding patches. Corrected the shared viewBox to 24×24; creator/provider samples inspected in light and dark themes |
| Moonshot uses initials despite having a brand identity | `BrandIcon.tsx` has no Moonshot mapping and falls back to `label.slice(0, 2)` | Source the approved real asset, record attribution, validate creator and provider uses in both themes; company symbol added with attribution in `ui/PROVENANCE.md`; both roles inspected in light and dark themes |

### Vercel behavior observed

On [AI Gateway models](https://vercel.com/ai-gateway/models), the table shows a short capability icon strip plus an overflow count. An interaction with that cell exposed a grouped panel headed **Output**, **Input**, and **Features**. The supplied screenshot shows a two-column icon+label layout, with present entries emphasized and other entries muted. `Tool` and `Tool Use` are separate labels; the top-level `Tools` category is another control. Do not collapse these concepts into a single Wrench icon without mapping their meaning to Registry's data.

The existing prototype maps both `Tools` and `Tool calling` to Wrench and several categories to Sparkles. A capability definition shared by cards, filters, details and comparisons is a candidate improvement, not a license to invent unsupported data. Preserve unknown vs explicitly unsupported, model declarations vs provider-access facts, and declared vs execution-tested evidence. Vercel's visual dimming alone does not establish Registry's data semantics. Hover delays, mobile behavior, and full keyboard behavior were not verified in this inspection.

## Overlaps and duplication candidates

Similar appearance is not enough to justify merging responsibilities. Compare contracts and state ownership before extracting a shared component.

| Family | Existing implementations / sites | Direction to review |
| --- | --- | --- |
| Model browsing | `ModelBrowser`, `ReferenceCatalogBrowser`, prototype `ComposerBrowser` + `ComposerModelResults`, older model-card prototype | Share presentation and controls; preserve catalog reference, registered model and selection semantics |
| Card structure | Main model cards inline; groups/keys inline in `App`; prototype `CatalogCard`; old prototype card | One composition contract per entity with agreed compact/square/table variants |
| Display options | `ViewControls` vs prototype `ViewMenu` | Converge visible controls after mapping current options; avoid losing density/metadata preferences |
| Capabilities and modalities | `ModelBrowser` inline metadata, prototype `Capabilities`/`Modalities`, `ModelDetail` property table, older model-card properties | Shared definitions, icon/label/state and grouped panel; comparison is a variant, not a separate vocabulary |
| Selectors | Radix `Select`, `SearchableSelect`, native selectors in prototypes | Two legitimate interaction contracts: fixed selection and searchable/custom selection; align presentation |
| Provider identity | `BrandIcon`/`ProviderMark`, inline provider names, prototype summaries | Central brand lookup; creator versus serving-provider identity stays explicit |
| Collections and overflow | Prototype `CompactCollection`/`ProviderSummary`/`GroupSummary`; main provider and group badges inline | Share actual summary/overflow behavior across cards, rows and details |
| Selection and origins | `ModelBrowser`, `GroupTree`, `HarnessTargets`, prototype cards/access rows/draft | Common presentation only where selection scope and inheritance semantics agree |
| Filters and search | Repeated Input+Search and select/checkbox filters across main, laboratory and prototypes | Shared labeled search/filter primitives; domain predicates stay with callers |
| Property/provenance rows | `FactValue`, prototype `Fact`, old prototype `Value`, `CatalogMetadata` | Consistent property/value/status/source presentation; retain different editing contracts |
| Key copying | `VirtualKeySecret`, one-time secret dialog in main `App`, inert token dialog in `KeyLibrary` | Shared copy feedback; keep real secret retrieval and demo token generation separate |
| Empty/loading/error feedback | Main `Empty`, inline notices, alerts, text placeholders, Skeleton, Sonner | Shared presentation patterns with relevant action and accessible announcement |
| Tabs and navigation | Main route shell, prototype `NavigationLink`, detail tabs, main gateway/harness buttons | Consistent navigation semantics and active state; do not treat every tab as a form toggle |
| Forms and validation | Inline labels/layouts and newly added `Field` family | Review one common field contract, validation, help, error and required states |
| Dialogs and side panels | Radix Dialog/Sheet/Popover with many inline contents | Keep one primitive implementation and shared headers/actions; preserve each task's effects |
| JSON/data views and imports | `Content`, gateway details, recorded harness, snapshot preview | Shared display primitives only; snapshot apply and report playback remain different operations |

## Interface coverage map

| Surface | Present components / inline sections |
| --- | --- |
| Main shell and authentication | `App`, sidebar wrappers, header, breadcrumbs, theme/preferences, connection/token states |
| Registered/reference model catalog | `ReferenceCatalogBrowser`, `ModelBrowser`, `BrandIcon`, `ViewControls`, source/status details |
| Model creation/editing | `ModelEditor`, `FactValue`, `ToggleChoices`, `KindSelect`, `SearchableSelect`, `AssistantSuggestion` |
| Catalog metadata and mappings | `CatalogMetadata`, reference/access matching, provenance and correction forms |
| Groups | Main inline library and Sheet editor, `GroupTree`/`ModelBrowser`; prototype `GroupWorkspace`, `GroupsPanel` |
| Virtual keys | Main inline library/detail, policy selections, publication/readback, `AdoptionDialog`, `VirtualKeySecret`; prototype `KeyLibrary`, Basic/Expert composition |
| Import/export | `SnapshotTransfer`, file input, preview, revision/backup feedback, CSV export |
| Native inventory | `GatewayInventory`, provider/alias/routing/key/model views and read-only details |
| Assistant and preferences | `AssistantSettings`, global view preferences; per-page view overrides |
| Laboratory | `Laboratory`, `HarnessTargets`, `HarnessRunView`, recorded report import/replay; separate qualification placeholder |
| Prototype model details | `ModelDetail`, overview/access/properties/sources, `AccessDetailDialog` |
| Prototype draft | `VariantA`, `VariantB`, `DraftSummary`, `PlannedExposures`, `AccessMenu`, `AccessRow`, `StateBadge` |
| Prototype helpers | `DemoBar`, `WitnessNote`, language context, synthetic fixtures; not production features |

## Review workflow and library requirements

1. Choose the canonical source and ownership for the family.
2. Put the actual existing implementations and proposed variant side by side in a local component gallery. Import components rather than copying markup.
3. Validate atoms and molecules inside their card/row/detail context. Work back and forth between levels as required by Atomic Design.
4. Record the chosen variant, behavioral contract, consumers and evidence; migrate every affected callsite only after that family is agreed.
5. Revisit representative pages and cross-component behavior after integration.

Each entry should state: purpose, atomic level, source/attribution, implementation owner, consumers, props/variants, permitted compositions, state meanings, keyboard/touch behavior, responsive behavior, examples and status (existing / proposed / approved / migrated / verified). A style screenshot alone does not finish an entry.

Review matrix: compact/square/table where applicable; browse/select/edit context; light/dark; FR/EN; mobile/intermediate/desktop; empty/one/18 entries; long labels and duplicate display names; active/inactive/partial/unknown; loading/error/disabled; keyboard, focus return and reduced motion. Cases apply according to the component contract rather than a blind Cartesian product.

Next reviews use the comparison gallery for the remaining choices, including modalities and selectors. Card structure and icon-only capabilities are accepted; the gallery still preserves their previous versions. Visual acceptance of other families remains separate from implementation and technical checks.

## Complete comparison gallery — 2026-09-27

Open `http://127.0.0.1:8772/component-gallery.html` through the existing Vite development server. The gallery is a development entry, not included in the production build inputs.

| Source collection | Previews | Coverage |
| --- | ---: | --- |
| Local primitives and foundations | 25 | All 23 `components/ui` modules, semantic colors and Geist typography |
| Current application and prestructure snapshot | 36 | Exported components, model grid sizes/table/selection, editors, administration, all eight App routes |
| Previous composer and HTML references | 9 | `c73a82c` card sizes/table, original mockups and HTML login |
| First React prototype and HTML fallback | 8 | `7df5fc3` identify/edit/review and five original fallback screens |
| Capabilities before extraction | 4 | Original capability/modalities summaries and Properties table |
| Latest key composer | 32 | Catalog/selection formats, provider/group summaries, access states, groups, keys, Basic/Expert compositions |
| Shared capability family | 7 | Accepted icon-only summary and Vercel panel presentation, integrated shared panel, optional modalities, edge cases and archived text summary |
| Focused remaining choices | 2 | Same-fixture modality variants and existing access selectors; not yet approved |
| External visual references | 3 | Supplied Vercel panel, live-captured Mistral listing and detail |

Entries are grouped into 19 functional families, with Atomic Design level, origin, version and source path. Search combines with level/source filters. Existing React implementations are imported directly; committed historical sources are archived only where needed to preserve distinct versions. `7df5fc3` sources are identical to Git; `c73a82c` differs only in import paths and an archive comment. Pre-extraction snippets were recovered from the implementing agent's original source reads. Screenshots of Vercel/Mistral are explicitly visual references, not installed component implementations.

App pages run in a separate iframe with synthetic API responses and in-memory preferences. Mutations and unknown API routes are blocked; original HTML fallback frames use an opaque sandbox and deny fetch. Reset remounts examples. The FR/EN switch follows each original component's translation support; it does not retroactively translate archived implementations. Existing visual defects remain visible for comparison rather than being silently corrected while cataloguing.

Checks: TypeScript, a runnable combined-filter check, and the gallery API boundary check. Browser inspection covers all families mounting, representative selectors/dialogs, editor Sheets and archived screens. This establishes a review surface, not acceptance of every design or exhaustive interaction/state coverage. No production deployment or application-wide replacement was performed for this gallery expansion.

## Validated design-system page

Open `http://127.0.0.1:8772/design-system.html`. Its source is `ui/src/dev/design-system/main.tsx`; a link from the comparison gallery makes it discoverable. It imports the shared `CatalogCard` and capability components directly, with synthetic examples and explicit source context. It is a local development entry, excluded from production build inputs.

The page documents the approved card structure, icon-only summary choice and Vercel comparison panel presentation. The shared panel now uses the approved presentation with per-model facts. Grid/selected square examples isolate header/body/footer structure; placeholders deliberately leave unapproved internal composition open. Capability examples cover mixed states, unknown-only and empty data. Their interactive panel opens the complete shared inventory; historical examples remain in the comparison gallery. The comparison link preserves access to all 124 gallery previews. No approval workflow or persistence is implied.

Browser checks covered desktop/narrow layout, no horizontal overflow at 355px, light/dark, Enter to open the capability panel, Escape and focus return. Catalogue selection remained intact after filtering selected models out and clearing the filter. These are local UI checks, not production qualification.

A development-only entry, “Panneau · comparaison Vercel”, compares the supplied screenshot with a compact candidate at the same scale. Its fixed example reproduces the screenshot states solely for visual review; it does not map those states to Registry data or serve application consumers. Sofian approved its presentation with the Braces (`{}`) icon for Structured Output. Sofian accepted modality variant A (icons input → output), with independent visibility in view settings. The existing access selector remains the next choice; panel integration preserves actual Registry facts and unknown states. Then verify their composition in catalogue, model detail and Basic/Expert key flows.

## Shared capabilities and accepted optional modalities

Local entry: `ui/component-gallery.html`, served by the existing Vite preview at `http://127.0.0.1:8772/component-gallery.html`. The icon-only summary and separate Vercel-style panel presentation are accepted. Consumers use the complete shared panel with the approved presentation and actual Registry facts. Modality variant A is accepted: icon-only input → output with an independent visibility setting, defaulting to visible. Hiding the summary does not remove facts from the detail panel. No backend change or production deployment is included.

Implementation: `ui/src/components/registry/model-capabilities.tsx`. Registry owns this composition; Lucide supplies icons and the existing local shadcn/Radix primitives supply tooltips and popovers. The grouped presentation is informed by Vercel, not copied source code.

| Export / level | Contract | Current consumers |
| --- | --- | --- |
| `CapabilityIcon` / atom | `name`; decorative 16px Lucide mark, one mapping and a fallback for unrecognized names | Items and summaries |
| `CapabilityItem` / molecule | `name`, optional `status`; icon and wrapping label, explicit Unknown/Simulated labels | Panel and isolated gallery samples |
| `ModelCapabilitiesSummary` / molecule | `model`, optional `stacked` and `context`; up to four known icons, +N for all additional entries including unknown states, individual hover explanations, accessible names and an empty state | Compact/square cards and table rows |
| `ModelModalitiesSummary` / molecule | Same facts; icon-only input → output, accessible direction/name labels, two visible values per direction plus overflow counts | Cards, rows and gallery |
| `ModelCapabilitiesPanel` / organism | Input/output arrays and capability-state record; Output/Input/Features sections; two feature columns when the container permits, one when narrow; source/scope disclosure | Shared summary popover, model overview/properties, gallery |
| Gallery / template and representative page | Real composed cards and details, format/theme/language controls, synthetic edge cases | Local visual review only |

Status meanings: an unmarked feature is declared for the reference model; Unknown never means unsupported; a simulated observation is not provider verification. Summary `+N` counts every additional entry, including unknown entries. Hovering the count opens the complete panel with state explanations. When all entries are unknown, the summary shows `+N`; this is a disclosure count, never a count of verified capabilities. A shared legend above the results explains declared, simulated and unknown states; each panel item has a hover/focus explanation. Modalities missing from the arrays are not inferred to be unsupported. Optional `context` supplies source, scope and execution evidence. Missing context remains unspecified/unverified; only synthetic preview callers explicitly label their data fictitious. The shared locale context is independent of the prototypes.

Interaction: a button opens the shared Radix popover by click/touch or keyboard; Escape closes it and returns focus to its trigger. Details remain available through a native source/scope disclosure. Long panels scroll within Radix's available collision height. Labels and non-declared states accompany icons; the standalone decorative icon needs an adjacent accessible name from its consumer. Pointer hover and keyboard focus also open the full panel; moving into it keeps it open.

Evidence, 2026-09-27: TypeScript, the existing UI checks, the key-composer selection/lifecycle checks and `git diff --check` pass. The focused rendering check (`cd ui && node --import tsx src/components/registry/model-capabilities.test.tsx`) covers unknown-only summaries, modality overflow, missing outputs and unknown states. Browser review covered compact/square/table presentation, the Properties consumer, French/English, light/dark, narrow and desktop widths, keyboard opening/Escape/focus return, and scrolling to the last entry/source in a long mobile popover. This is focused review evidence, not complete application accessibility certification.

Fixtures cover declared, unknown-only, simulated, long labels, modality overflow and empty data. Some fixture names/descriptions deliberately remain English in the French gallery. The earlier native access selectors and other card content remain pending choices. Moonshot/Gemini defects were corrected in their shared sources; this technical repair does not imply visual approval of the complete identity family. Sofian rejected the original grouped panel, then approved the Vercel comparison presentation with the Braces icon. The shared owner now uses that accepted presentation.

## Embedded HTML fallback and historical surfaces

The React entry is `ui/index.html`; prototype entries are `ui/key-composer-prototype.html` and `ui/model-card-prototype.html`. Their `main.tsx` files mount the corresponding apps.

The distinct fallback in `internal/admin/web/{index.html,app.js,app.css}` remains served when a built React UI is unavailable (`internal/admin/server.go`). It includes login/token form, sidebar/header, notices, model/group/key lists, deployment plan/settings, editor dialog, output dialog and file import. Its UI helpers are `badge`, `tags`, `notice`, `empty`, `options`, `field`, `selectField`, `checks`; section renderers are `renderModels`, `renderModelRows`, `renderGroups`, `renderKeys`, `renderDeploy`, `renderSettings`, with `openEditor`, `preview` and `plan` producing task dialogs. This is a separate HTML/CSS system, not a shared React library. Retirement or replacement is a separate decision; no removal is authorized by this inventory.

`docs/design/mockup/**`, `docs/design/model-card-properties/index.html`, and `docs/design/diagrams/model-cards/index.html` are historical/reference artifacts. They are indexed here to prevent confusing them with active component owners.

## Complete React source index

The index below is generated from the TypeScript AST over every TSX file in scope. It includes named function components and uppercase component/context variable candidates; React contexts and entry points are explicitly not visual components. SVG renderer entries are listed separately. Inline patterns are covered above. Classifications describe responsibilities, not enforced filesystem moves.

| Module | Named definitions (source line) | Direct local importers |
| --- | --- | --- |
| [ui/src/features/keys/AdoptionDialog.tsx](../../ui/src/features/keys/AdoptionDialog.tsx) | `AdoptionDialog`:14 | `App.tsx` |
| [ui/src/app/App.tsx](../../ui/src/app/App.tsx) | `CollapsedSidebarExpand`:50, `MobileSidebarLabel`:56, `CloseMobileSidebarOnRoute`:61, `App`:67, `Empty`:452 | `main.tsx` |
| [ui/src/features/assistant/AssistantSettings.tsx](../../ui/src/features/assistant/AssistantSettings.tsx) | `AssistantSettings`:9 | `App.tsx` |
| [ui/src/features/assistant/AssistantSuggestion.tsx](../../ui/src/features/assistant/AssistantSuggestion.tsx) | `AssistantSuggestion`:7 | `App.tsx` |
| [ui/src/components/registry/BrandIcon.tsx](../../ui/src/components/registry/BrandIcon.tsx) | `Logo`:10, `ProviderMark`:14, `BrandIcon`:17 | `GroupTree.tsx`, `HarnessTargets.tsx`, `ModelBrowser.tsx`, `ReferenceCatalogBrowser.tsx`, `key-composer-prototype/CompactCollection.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `key-composer-prototype/shared.tsx`, `key-composer-prototype/summary.tsx` |
| [ui/src/features/catalog/CatalogMetadata.tsx](../../ui/src/features/catalog/CatalogMetadata.tsx) | `CatalogMetadata`:21 | `App.tsx` |
| [ui/src/features/gateway/GatewayInventory.tsx](../../ui/src/features/gateway/GatewayInventory.tsx) | `GatewayInventory`:15 | `App.tsx` |
| [ui/src/features/groups/GroupTree.tsx](../../ui/src/features/groups/GroupTree.tsx) | `GroupTree`:10 | `App.tsx` |
| [ui/src/features/laboratory/HarnessRunView.tsx](../../ui/src/features/laboratory/HarnessRunView.tsx) | `Content`:31, `HarnessRunView`:35 | `Laboratory.tsx` |
| [ui/src/features/laboratory/HarnessTargets.tsx](../../ui/src/features/laboratory/HarnessTargets.tsx) | `HarnessTargets`:19 | `Laboratory.tsx` |
| [ui/src/features/laboratory/Laboratory.tsx](../../ui/src/features/laboratory/Laboratory.tsx) | `Laboratory`:25 | Root entry, local use, or currently not imported by a TSX module |
| [ui/src/features/catalog/ModelBrowser.tsx](../../ui/src/features/catalog/ModelBrowser.tsx) | `ModelBrowser`:20 | `App.tsx`, `ReferenceCatalogBrowser.tsx` |
| [ui/src/features/catalog/ModelEditor.tsx](../../ui/src/features/catalog/ModelEditor.tsx) | `FactValue`:55, `ToggleChoices`:59, `KindSelect`:63, `ModelEditor`:69 | `App.tsx` |
| [ui/src/features/catalog/ReferenceCatalogBrowser.tsx](../../ui/src/features/catalog/ReferenceCatalogBrowser.tsx) | `ReferenceCatalogBrowser`:54 | `App.tsx` |
| [ui/src/components/registry/SearchableSelect.tsx](../../ui/src/components/registry/SearchableSelect.tsx) | `SearchableSelect`:7 | `AssistantSettings.tsx`, `CatalogMetadata.tsx`, `ModelEditor.tsx` |
| [ui/src/features/snapshot/SnapshotTransfer.tsx](../../ui/src/features/snapshot/SnapshotTransfer.tsx) | `SnapshotTransfer`:22 | `App.tsx` |
| [ui/src/components/registry/ViewOptions.tsx](../../ui/src/components/registry/ViewOptions.tsx) | `ViewControls`:28 | `App.tsx`, `BrandIcon.tsx`, `HarnessTargets.tsx`, `Laboratory.tsx`, `ModelBrowser.tsx`, `ReferenceCatalogBrowser.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx` |
| [ui/src/features/keys/VirtualKeySecret.tsx](../../ui/src/features/keys/VirtualKeySecret.tsx) | `VirtualKeySecret`:9 | `App.tsx` |
| [ui/src/components/ui/alert.tsx](../../ui/src/components/ui/alert.tsx) | `Alert`:25, `AlertTitle`:29, `AlertDescription`:35 | Root entry, local use, or currently not imported by a TSX module |
| [ui/src/components/ui/badge.tsx](../../ui/src/components/ui/badge.tsx) | `Badge`:28 | `AdoptionDialog.tsx`, `App.tsx`, `CatalogMetadata.tsx`, `GatewayInventory.tsx`, `GroupTree.tsx`, `HarnessRunView.tsx`, `HarnessTargets.tsx`, `Laboratory.tsx`, `ModelBrowser.tsx`, `ModelEditor.tsx`, `ReferenceCatalogBrowser.tsx`, `SnapshotTransfer.tsx`, `key-composer-prototype/App.tsx`, `key-composer-prototype/CatalogPage.tsx`, `key-composer-prototype/CompactCollection.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `key-composer-prototype/shared.tsx`, `key-composer-prototype/summary.tsx` |
| [ui/src/components/ui/button.tsx](../../ui/src/components/ui/button.tsx) | `Button`:36, `BaseButton`:58 | `AdoptionDialog.tsx`, `App.tsx`, `AssistantSettings.tsx`, `AssistantSuggestion.tsx`, `CatalogMetadata.tsx`, `GatewayInventory.tsx`, `GroupTree.tsx`, `HarnessRunView.tsx`, `HarnessTargets.tsx`, `Laboratory.tsx`, `ModelBrowser.tsx`, `ModelEditor.tsx`, `ReferenceCatalogBrowser.tsx`, `SnapshotTransfer.tsx`, `ViewOptions.tsx`, `VirtualKeySecret.tsx`, `components/ui/input.tsx`, `components/ui/sidebar.tsx`, `key-composer-prototype/App.tsx`, `key-composer-prototype/CompactCollection.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/ViewMenu.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `key-composer-prototype/shared.tsx`, `key-composer-prototype/summary.tsx`, `model-card-prototype/App.tsx` |
| [ui/src/components/ui/card.tsx](../../ui/src/components/ui/card.tsx) | `Card`:5, `CardHeader`:15, `CardTitle`:28, `CardDescription`:32, `CardAction`:36, `CardContent`:42, `CardFooter`:46 | `App.tsx`, `CatalogMetadata.tsx`, `GatewayInventory.tsx`, `HarnessRunView.tsx`, `HarnessTargets.tsx`, `Laboratory.tsx`, `ModelBrowser.tsx`, `ReferenceCatalogBrowser.tsx`, `SnapshotTransfer.tsx`, `components/registry/CatalogCard.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/cards.tsx`, `model-card-prototype/App.tsx` |
| [ui/src/components/ui/checkbox.tsx](../../ui/src/components/ui/checkbox.tsx) | `Checkbox`:7 | `App.tsx`, `GroupTree.tsx`, `HarnessTargets.tsx`, `Laboratory.tsx`, `ModelBrowser.tsx`, `ModelEditor.tsx`, `ViewOptions.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `model-card-prototype/App.tsx` |
| [ui/src/components/ui/dialog.tsx](../../ui/src/components/ui/dialog.tsx) | `Dialog`:7, `DialogTrigger`:11, `DialogPortal`:15, `DialogClose`:19, `DialogOverlay`:23, `DialogContent`:36, `DialogHeader`:73, `DialogFooter`:79, `DialogTitle`:85, `DialogDescription`:89 | `AdoptionDialog.tsx`, `App.tsx`, `CatalogMetadata.tsx`, `ModelEditor.tsx`, `ReferenceCatalogBrowser.tsx`, `VirtualKeySecret.tsx`, `key-composer-prototype/App.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/shared.tsx`, `model-card-prototype/App.tsx` |
| [ui/src/components/ui/dropdownMenu.tsx](../../ui/src/components/ui/dropdownMenu.tsx) | `DropdownMenu`:7, `DropdownMenuPortal`:11, `DropdownMenuTrigger`:15, `DropdownMenuContent`:19, `DropdownMenuGroup`:35, `DropdownMenuItem`:39, `DropdownMenuCheckboxItem`:62, `DropdownMenuRadioGroup`:88, `DropdownMenuRadioItem`:92, `DropdownMenuLabel`:112, `DropdownMenuSeparator`:129, `DropdownMenuShortcut`:139, `DropdownMenuSub`:149, `DropdownMenuSubTrigger`:153, `DropdownMenuSubContent`:177 | Root entry, local use, or currently not imported by a TSX module |
| [ui/src/components/ui/field.tsx](../../ui/src/components/ui/field.tsx) | `FieldSet`:11, `FieldLegend`:25, `FieldGroup`:45, `Field`:82, `FieldContent`:98, `FieldLabel`:111, `FieldTitle`:129, `FieldDescription`:142, `FieldSeparator`:157, `FieldError`:187 | `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/browser.tsx` |
| [ui/src/components/ui/input.tsx](../../ui/src/components/ui/input.tsx) | `Input`:13 | `App.tsx`, `CatalogMetadata.tsx`, `GatewayInventory.tsx`, `HarnessTargets.tsx`, `Laboratory.tsx`, `ModelBrowser.tsx`, `ModelEditor.tsx`, `SearchableSelect.tsx`, `SnapshotTransfer.tsx`, `VirtualKeySecret.tsx`, `components/ui/sidebar.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `model-card-prototype/App.tsx` |
| [ui/src/components/ui/label.tsx](../../ui/src/components/ui/label.tsx) | `Label`:6 | `components/ui/field.tsx`, `model-card-prototype/App.tsx` |
| [ui/src/components/ui/popover.tsx](../../ui/src/components/ui/popover.tsx) | `Popover`:6, `PopoverTrigger`:10, `PopoverContent`:14, `PopoverAnchor`:63 | `SearchableSelect.tsx`, `ViewOptions.tsx`, `key-composer-prototype/CompactCollection.tsx`, `key-composer-prototype/ViewMenu.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `key-composer-prototype/shared.tsx` |
| [ui/src/components/ui/select.tsx](../../ui/src/components/ui/select.tsx) | `Select`:7, `SelectGroup`:11, `SelectValue`:15, `SelectTrigger`:19, `SelectContent`:45, `SelectLabel`:74, `SelectItem`:86, `SelectSeparator`:117, `SelectScrollUpButton`:127, `SelectScrollDownButton`:139 | `HarnessTargets.tsx`, `ModelBrowser.tsx`, `ModelEditor.tsx`, `ViewOptions.tsx`, `key-composer-prototype/App.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/browser.tsx` |
| [ui/src/components/ui/separator.tsx](../../ui/src/components/ui/separator.tsx) | `Separator`:6, `DottedSeparator`:30 | `components/ui/field.tsx`, `components/ui/sidebar.tsx`, `components/registry/CatalogCard.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/ViewMenu.tsx`, `key-composer-prototype/cards.tsx` |
| [ui/src/components/ui/sheet.tsx](../../ui/src/components/ui/sheet.tsx) | `SheetContext`:16, `Sheet`:23, `SheetTrigger`:27, `SheetClose`:31, `SheetPortal`:35, `SheetOverlay`:39, `SheetContent`:52, `SheetHeader`:130, `SheetFooter`:169, `SheetTitle`:173, `SheetDescription`:177 | `App.tsx`, `ModelEditor.tsx`, `components/ui/sidebar.tsx`, `key-composer-prototype/App.tsx`, `key-composer-prototype/VariantB.tsx` |
| [ui/src/components/ui/sidebar.tsx](../../ui/src/components/ui/sidebar.tsx) | `SidebarContext`:32, `SidebarProvider`:43, `Sidebar`:144, `SidebarTrigger`:239, `SidebarRail`:261, `SidebarInset`:286, `SidebarInput`:300, `SidebarHeader`:306, `SidebarFooter`:310, `SidebarSeparator`:314, `SidebarContent`:325, `SidebarGroup`:336, `SidebarGroupLabel`:342, `SidebarGroupAction`:359, `SidebarGroupContent`:378, `SidebarMenu`:382, `SidebarMenuItem`:386, `SidebarMenuButton`:412, `SidebarMenuAction`:457, `SidebarMenuBadge`:489, `SidebarMenuSkeleton`:508, `SidebarMenuSub`:541, `SidebarMenuSubItem`:556, `SidebarMenuSubButton`:567 | `App.tsx`, `key-composer-prototype/App.tsx` |
| [ui/src/components/ui/skeleton.tsx](../../ui/src/components/ui/skeleton.tsx) | `Skeleton`:3 | `components/ui/sidebar.tsx` |
| [ui/src/components/ui/switch.tsx](../../ui/src/components/ui/switch.tsx) | `Switch`:12 | `key-composer-prototype/App.tsx` |
| [ui/src/components/ui/table.tsx](../../ui/src/components/ui/table.tsx) | `Table`:9, `TableHeader`:17, `TableBody`:21, `TableFooter`:25, `TableRow`:29, `TableHead`:39, `TableCell`:52, `TableCaption`:65 | `App.tsx`, `HarnessTargets.tsx`, `Laboratory.tsx`, `ModelBrowser.tsx`, `ReferenceCatalogBrowser.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/cards.tsx`, `model-card-prototype/App.tsx` |
| [ui/src/components/ui/textarea.tsx](../../ui/src/components/ui/textarea.tsx) | `Textarea`:5 | `CatalogMetadata.tsx`, `ModelEditor.tsx` |
| [ui/src/components/ui/toggle-group.tsx](../../ui/src/components/ui/toggle-group.tsx) | `ToggleGroupContext`:11, `ToggleGroup`:21, `ToggleGroupItem`:52 | `key-composer-prototype/ViewMenu.tsx` |
| [ui/src/components/ui/toggle.tsx](../../ui/src/components/ui/toggle.tsx) | `Toggle`:31 | `components/ui/toggle-group.tsx` |
| [ui/src/components/ui/tooltip.tsx](../../ui/src/components/ui/tooltip.tsx) | `TooltipProvider`:6, `Tooltip`:10, `TooltipTrigger`:18, `TooltipContent`:22 | `App.tsx`, `components/ui/sidebar.tsx`, `key-composer-prototype/App.tsx`, `key-composer-prototype/CompactCollection.tsx`, `key-composer-prototype/KeyLibrary.tsx` |
| [ui/src/components/ui/treeView.tsx](../../ui/src/components/ui/treeView.tsx) | `TreeNodeComponent`:78, `Tree`:207 | `GroupTree.tsx` |
| [ui/src/experiments/key-composer-prototype/App.tsx](../../ui/src/experiments/key-composer-prototype/App.tsx) | `NavigationLink`:30, `ComposerApp`:35, `App`:161 | `key-composer-prototype/main.tsx` |
| [ui/src/components/registry/CatalogCard.tsx](../../ui/src/components/registry/CatalogCard.tsx) | `CatalogGrid`, `CatalogCard` | `ModelBrowser.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/cards.tsx`, `dev/component-gallery/latest.tsx` |
| [ui/src/experiments/key-composer-prototype/CatalogPage.tsx](../../ui/src/experiments/key-composer-prototype/CatalogPage.tsx) | `CatalogPage`:7 | `key-composer-prototype/App.tsx` |
| [ui/src/experiments/key-composer-prototype/CompactCollection.tsx](../../ui/src/experiments/key-composer-prototype/CompactCollection.tsx) | `CompactCollection`:10, `ProviderSummary`:18, `GroupSummary`:25 | `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/cards.tsx` |
| [ui/src/experiments/key-composer-prototype/GroupWorkspace.tsx](../../ui/src/experiments/key-composer-prototype/GroupWorkspace.tsx) | `GroupWorkspace`:26 | `key-composer-prototype/App.tsx` |
| [ui/src/experiments/key-composer-prototype/KeyLibrary.tsx](../../ui/src/experiments/key-composer-prototype/KeyLibrary.tsx) | `KeyLibrary`:21 | `key-composer-prototype/App.tsx` |
| [ui/src/experiments/key-composer-prototype/ModelDetail.tsx](../../ui/src/experiments/key-composer-prototype/ModelDetail.tsx) | `ModelDetail`:16, `Fact`:67 | `key-composer-prototype/App.tsx` |
| [ui/src/experiments/key-composer-prototype/VariantA.tsx](../../ui/src/experiments/key-composer-prototype/VariantA.tsx) | `VariantA`:21 | `key-composer-prototype/App.tsx` |
| [ui/src/experiments/key-composer-prototype/VariantB.tsx](../../ui/src/experiments/key-composer-prototype/VariantB.tsx) | `VariantB`:22 | `key-composer-prototype/App.tsx` |
| [ui/src/experiments/key-composer-prototype/ViewMenu.tsx](../../ui/src/experiments/key-composer-prototype/ViewMenu.tsx) | `ViewMenu`:11 | `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/browser.tsx` |
| [ui/src/experiments/key-composer-prototype/browser.tsx](../../ui/src/experiments/key-composer-prototype/browser.tsx) | `ComposerBrowser`:30 | `key-composer-prototype/CatalogPage.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx` |
| [ui/src/experiments/key-composer-prototype/cards.tsx](../../ui/src/experiments/key-composer-prototype/cards.tsx) | `Capabilities`:31, `Modalities`:43, `CardSelection`:78, `ComposerModelResults`:97, `GroupsPanel`:159 | `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/browser.tsx` |
| [ui/src/lib/locale.tsx](../../ui/src/lib/locale.tsx) | `LanguageContext`:4 | `key-composer-prototype/App.tsx`, `key-composer-prototype/CatalogPage.tsx`, `key-composer-prototype/CompactCollection.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/KeyLibrary.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/ViewMenu.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `key-composer-prototype/shared.tsx`, `key-composer-prototype/summary.tsx` |
| [ui/src/experiments/key-composer-prototype/main.tsx](../../ui/src/experiments/key-composer-prototype/main.tsx) | Entry point / icon catalog (no named component declaration) | Root entry, local use, or currently not imported by a TSX module |
| [ui/src/experiments/key-composer-prototype/shared.tsx](../../ui/src/experiments/key-composer-prototype/shared.tsx) | `StateBadge`:25, `AccessDetailDialog`:49, `AccessRow`:74, `AccessMenu`:99, `WitnessNote`:111, `DemoBar`:122 | `key-composer-prototype/App.tsx`, `key-composer-prototype/GroupWorkspace.tsx`, `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/cards.tsx`, `key-composer-prototype/summary.tsx` |
| [ui/src/experiments/key-composer-prototype/summary.tsx](../../ui/src/experiments/key-composer-prototype/summary.tsx) | `PlannedExposures`:13, `DraftSummary`:32 | `key-composer-prototype/VariantA.tsx`, `key-composer-prototype/VariantB.tsx` |
| [ui/src/lib/constants/icons.tsx](../../ui/src/lib/constants/icons.tsx) | Entry point / icon catalog (no named component declaration) | `BrandIcon.tsx` |
| [ui/src/main.tsx](../../ui/src/main.tsx) | Entry point / icon catalog (no named component declaration) | Root entry, local use, or currently not imported by a TSX module |
| [ui/src/experiments/model-card-prototype/App.tsx](../../ui/src/experiments/model-card-prototype/App.tsx) | `Value`:49, `App`:57 | `model-card-prototype/main.tsx` |
| [ui/src/experiments/model-card-prototype/main.tsx](../../ui/src/experiments/model-card-prototype/main.tsx) | Entry point / icon catalog (no named component declaration) | Root entry, local use, or currently not imported by a TSX module |

### Provider SVG renderer catalog

`ui/src/lib/constants/icons.tsx` defines 29 provider renderers: `anthropic`, `azure`, `bedrock`, `bedrock_mantle`, `cerebras`, `deepseek`, `cohere`, `elevenlabs`, `groq`, `mistral`, `ollama`, `parasail`, `perplexity`, `sgl`, `openai`, `vertex`, `gemini`, `openrouter`, `huggingface`, `nebius`, `xai`, `replicate`, `vllm`, `runway`, `runware`, `fireworks`, `sarvam`, `wafer`, `databricks`. `BrandIcon.tsx` maps only a subset to Registry provider/creator identities. This is a separate lookup layer, not a new component implementation per screen.

### Native HTML controls inside the React source

These are real callsites to review, not automatically defects: file inputs, semantic buttons and disclosure elements can be appropriate. A styled native select competing with an agreed Select is a concrete consistency issue.

| Module | Native JSX tags and static occurrences |
| --- | --- |
| `ui/src/features/keys/AdoptionDialog.tsx` | `details` × 1, `summary` × 1 |
| `ui/src/app/App.tsx` | `label` × 7, `button` × 2 |
| `ui/src/features/assistant/AssistantSettings.tsx` | `label` × 2, `select` × 2 |
| `ui/src/features/assistant/AssistantSuggestion.tsx` | `label` × 1, `input` × 1 |
| `ui/src/features/catalog/CatalogMetadata.tsx` | `label` × 4, `button` × 1, `details` × 1, `summary` × 1, `select` × 2 |
| `ui/src/features/gateway/GatewayInventory.tsx` | `details` × 4, `summary` × 4 |
| `ui/src/features/groups/GroupTree.tsx` | `label` × 1 |
| `ui/src/features/laboratory/HarnessRunView.tsx` | `details` × 4, `summary` × 4, `button` × 1 |
| `ui/src/features/laboratory/HarnessTargets.tsx` | `label` × 2 |
| `ui/src/features/laboratory/Laboratory.tsx` | `input` × 1, `details` × 2, `summary` × 2 |
| `ui/src/features/catalog/ModelBrowser.tsx` | `details` × 2, `summary` × 2, `label` × 1 |
| `ui/src/features/catalog/ModelEditor.tsx` | `label` × 9, `details` × 5, `summary` × 5, `table` × 1, `select` × 1 |
| `ui/src/features/catalog/ReferenceCatalogBrowser.tsx` | `details` × 1, `summary` × 1 |
| `ui/src/components/registry/SearchableSelect.tsx` | `label` × 1, `button` × 2 |
| `ui/src/features/snapshot/SnapshotTransfer.tsx` | `label` × 1, `details` × 1, `summary` × 1 |
| `ui/src/components/registry/ViewOptions.tsx` | `label` × 2 |
| `ui/src/experiments/key-composer-prototype/App.tsx` | `button` × 3, `label` × 1 |
| `ui/src/experiments/key-composer-prototype/ModelDetail.tsx` | `label` × 2, `select` × 2, `table` × 2 |
| `ui/src/experiments/key-composer-prototype/browser.tsx` | `label` × 1 |
| `ui/src/experiments/key-composer-prototype/cards.tsx` | `button` × 6 |
| `ui/src/experiments/key-composer-prototype/shared.tsx` | `details` × 2, `summary` × 2 |
| `ui/src/experiments/key-composer-prototype/summary.tsx` | `details` × 1, `summary` × 1 |
| `ui/src/experiments/model-card-prototype/App.tsx` | `label` × 1, `details` × 4, `summary` × 4, `select` × 1 |

## Validation record

- Source enumeration: all 61 TSX files, including 23 primitive-family modules; module definitions, importers and native JSX patterns indexed.
- Two focused independent read-only audits: main UI and prototypes; findings reconciled with the source index.
- Reference inspection: Atomic Design chapter, Vercel public catalog interaction and supplied screenshots, Geist introduction, shadcn CLI discovery and Radix documentation.
- No component implementation, API contract, authentication, persistence, release artifact or running gateway changed.
- No fresh product build/test run is claimed for this documentation-only inventory. Visual acceptance is pending.
- [Mistral catalog/detail composition audit](../reviews/2026-09-27-mistral-compositions.md): source reading plus coordinator desktop visual inspection; apply these template/page references after component-family acceptance.

## Composer corrections — 2026-09-27

Requested changes applied to the existing shared components, without adding another card family:

- The visible format name is Grid / Grille; the internal `compact` value remains compatible. Grid height follows visible content. Square keeps a 1:1 ratio with a scrollable body and fixed header/footer even when all details are shown.
- The Expert heading and tabs sit above the browser/sidebar grid, so the draft panel aligns with the filter card. Below 1280 CSS pixels, the Expert switch is hidden and Basic is rendered. The parent retains the draft and preferred mode; the guided step resets when that variant remounts.
- Planned IDs use the existing exposure calculation, with an explicit format selector, examples, count, list and empty state. Other-key isolation is presented as labeled facts. Both remain synthetic preview features.
- Capability overflow uses `+N`, and state explanations use the shared tooltip/legend components. This does not establish real provider verification or approve a new panel presentation.

These corrections are local implementation work requested through browser comments, not a deployment or blanket visual approval.

Focused verification: Grid height reduced from 173px to 113px when both summaries were hidden; Square measured 238 × 238px with all details enabled, and its overflowing body was reachable with PageDown. Expert sidebar/filter-card top coordinates matched at 1386px. At 875px and 400px, Basic rendered without the Expert toggle or page overflow. A 400 → 1386px transition preserved the selected model and key name after fixing the mobile navigation title context. French/English and dark rendering were inspected. TypeScript, production compilation, capability rendering checks and existing composer lifecycle scenarios passed; the existing large-bundle warning remains. Hover handlers use Radix; keyboard tooltip/panel opening was observed, individual pointer hover was not automated.

## Restoring the accepted capability panel — 2026-09-27

The request to proceed covers removing the rejected circle/diamond overlays, preserving icon summaries and `+N`, and using the complete accepted Vercel panel for hover, focus and click/touch. New icon tinting remains undecided and is not introduced. The inventory retains all 19 reference items plus additional facts recorded by Registry; missing values stay unknown. The shared renderer is reused by the gallery fixture and application consumers. The fixture's active states never supply live model facts. No backend or deployment change.

Verification of this restoration: TypeScript/Vite compilation, focused capability assertions (complete inventory, domain-key mapping, unknown semantics, extra facts and +N), and key-composer selection/lifecycle checks passed. Browser checks observed the full hover panel, per-item state tooltip, keyboard entry and Escape focus return, and a scrollable panel fitting a 400 px viewport. Production was not touched. New icon tinting is still awaiting a separate decision.

## Hover scope and wording correction — 2026-09-27

Sofian explicitly corrected three regressions: output labels are Image and Video (Vidéo in French), without Gen; the modality summary discloses only the model’s input/output modalities; the capability summary retains the complete capability panel. Both summaries wait 500 ms before opening on pointer hover, cancel pending opening when the pointer leaves, and remain immediately available on keyboard focus or click. Existing animations and other presentation choices are unchanged. These corrections supersede the earlier shared-full-panel behavior for modality summaries.

Verification: focused capability/modality rendering checks and TypeScript/Vite compilation passed. Browser inspection confirmed the modality-only panel and Image/Video labels in the complete capability panel. The hover panel was absent at 135 ms and present after the 500 ms delay; fast pointer traversal was checked separately. Existing bundle-size warning remains. No deployment.

## Vérification des corrections — 27 septembre 2026

Les collections utilisent une grille large de 360 px minimum et des carrés de 300 px minimum. Grid égalise les rangées; les carrés ne possèdent aucun défilement interne. Les résumés de groupe et de clé sont condensés dans les mêmes composants. Les options partagées exposent les trois formats dans les listes, les sélecteurs de modèles et les préférences globales. Le changement de format applique ensemble largeur et disposition.

Le formulaire de groupe réutilise le navigateur de modèles: trois étapes en mode normal, sélection et aperçu en parallèle en mode Expert. Le panneau partagé laisse le défilement à son contenu et conserve les actions visibles. La zone principale est positionnée pour contenir aussi ses libellés accessibles, qui ne doivent pas agrandir le document.

Vérifications locales: collections aux contenus de longueurs différentes, Grid/Square, clés natives non adoptées, groupe normal/Expert, options du sélecteur, sidebar, réglages, thème sombre, clavier et largeur mobile de 400 px. Les clés natives sans politique Registry sont décrites comme restant sous autorisations Bifrost, sans faux compte nul. Les contrôles TypeScript, les tests UI et la compilation passent; Vite conserve son avertissement de taille de bundle.

La revue réelle utilise le serveur existant `cmd/registry-review` sur `127.0.0.1:8774`, une capture privée datée du 25 septembre et une copie de travail dans `dist/checks/interface-real-data/`. La capture partielle contient 9 fournisseurs, 119 modèles, 43 clés et 10 règles de routage. Les fichiers originaux sont préservés. La copie permet l’examen et des modifications locales; elle ne fournit ni secrets, ni inférence, ni création de clé native, ni relecture vérifiée en direct. Aucun déploiement.


## Explicit operations per provider access — 2026-09-27

Sofian approved independent endpoint checkboxes on each provider access. Chat Completions and Responses are separate choices. Existing choices survive edit/save unchanged; new accesses require at least one explicit supported operation. Model modalities, historical `kind`, and Models.dev provider metadata never select permissions. The shared editor, review and save validation use this same rule.

Models.dev provenance distinguishes the pinned source date/commit from the time the local catalog was refreshed. Access-specific values take priority; upstream omissions suppress inherited reference values unless explicitly overridden for that access. The source catalog does not create provider permissions. Browser and source evidence is recorded in the [repair checklist](../reviews/2026-09-27-ui-repair-checklist.md#modelsdev-and-per-access-endpoints).
