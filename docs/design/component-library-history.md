# Contrat UI : inventaires et preuves historiques

Extraits déplacés tels quels, dans leur ordre d’origine, de [component-library.md](component-library.md) : inventaires, galerie de comparaison et journaux de vérification. Ils ne contiennent aucune décision ; le contrat reste la seule référence.

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

## Extrait de « Validated design-system page »

Browser checks covered desktop/narrow layout, no horizontal overflow at 355px, light/dark, Enter to open the capability panel, Escape and focus return. Catalogue selection remained intact after filtering selected models out and clearing the filter. These are local UI checks, not production qualification.

## Extrait de « Shared capabilities and accepted optional modalities »

Evidence, 2026-09-27: TypeScript, the existing UI checks, the key-composer selection/lifecycle checks and `git diff --check` pass. The focused rendering check (`cd ui && node --import tsx src/components/registry/model-capabilities.test.tsx`) covers unknown-only summaries, modality overflow, missing outputs and unknown states. Browser review covered compact/square/table presentation, the Properties consumer, French/English, light/dark, narrow and desktop widths, keyboard opening/Escape/focus return, and scrolling to the last entry/source in a long mobile popover. This is focused review evidence, not complete application accessibility certification.

## Complete React source index

The index below is generated from the TypeScript AST over every TSX file in scope. It includes named function components and uppercase component/context variable candidates; React contexts and entry points are explicitly not visual components. SVG renderer entries are listed separately. Inline patterns are covered above. Classifications describe responsibilities, not enforced filesystem moves.

| Module | Named definitions (source line) | Direct local importers |
| --- | --- | --- |
| [ui/src/features/keys/AdoptionDialog.tsx](../../ui/src/features/keys/AdoptionDialog.tsx) | `AdoptionDialog`:40 | `App.tsx` |
| [ui/src/app/App.tsx](../../ui/src/app/App.tsx) | `CollapsedSidebarExpand`:50, `MobileSidebarLabel`:56, `CloseMobileSidebarOnRoute`:61, `App`:67, `Empty`:452 | `main.tsx` |
| [ui/src/features/assistant/AssistantSettings.tsx](../../ui/src/features/assistant/AssistantSettings.tsx) | `AssistantSettings`:9 | `App.tsx` |
| [ui/src/features/assistant/AssistantSuggestion.tsx](../../ui/src/features/assistant/AssistantSuggestion.tsx) | `AssistantSuggestion`:7 | `App.tsx` |
| [ui/src/components/registry/BrandIcon.tsx](../../ui/src/components/registry/BrandIcon.tsx) | `Logo`:75, `ProviderMark`:80, `BrandIcon`:85 (also the one identity lookup: `markFor`, `providerMark`, `displayProvider`, `setProviderBaseTypes`, `useProviderAppearance`) | `AdoptionDialog.tsx`, `App.tsx`, `CompactCollection.tsx`, `GatewayInventory.tsx`, `GroupTree.tsx`, `HarnessTargets.tsx`, `KeyComposer.state.ts`, `KeyComposer.tsx`, `ModelAccessMenu.tsx`, `ModelBrowser.tsx`, `ModelEditor.tsx`, `ProviderAppearance.tsx`, `ReferenceCatalogBrowser.tsx`, `provider-appearance.test.ts`, `dev/component-gallery/application.tsx`, `dev/component-gallery/latest.tsx`, `dev/display-options-review.tsx`, `dev/component-gallery/history/…` (3), `key-composer-prototype/ModelDetail.tsx`, `key-composer-prototype/VariantB.tsx`, `key-composer-prototype/browser.tsx`, `key-composer-prototype/cards.tsx`, `key-composer-prototype/shared.tsx`, `key-composer-prototype/summary.tsx` |
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

## Extrait de « Composer corrections — 2026-09-27 »

Focused verification: Grid height reduced from 173px to 113px when both summaries were hidden; Square measured 238 × 238px with all details enabled, and its overflowing body was reachable with PageDown. Expert sidebar/filter-card top coordinates matched at 1386px. At 875px and 400px, Basic rendered without the Expert toggle or page overflow. A 400 → 1386px transition preserved the selected model and key name after fixing the mobile navigation title context. French/English and dark rendering were inspected. TypeScript, production compilation, capability rendering checks and existing composer lifecycle scenarios passed; the existing large-bundle warning remains. Hover handlers use Radix; keyboard tooltip/panel opening was observed, individual pointer hover was not automated.

## Extrait de « Restoring the accepted capability panel — 2026-09-27 »

Verification of this restoration: TypeScript/Vite compilation, focused capability assertions (complete inventory, domain-key mapping, unknown semantics, extra facts and +N), and key-composer selection/lifecycle checks passed. Browser checks observed the full hover panel, per-item state tooltip, keyboard entry and Escape focus return, and a scrollable panel fitting a 400 px viewport. Production was not touched. New icon tinting is still awaiting a separate decision.

## Extrait de « Hover scope and wording correction — 2026-09-27 »

Verification: focused capability/modality rendering checks and TypeScript/Vite compilation passed. Browser inspection confirmed the modality-only panel and Image/Video labels in the complete capability panel. The hover panel was absent at 135 ms and present after the 500 ms delay; fast pointer traversal was checked separately. Existing bundle-size warning remains. No deployment.

## Extrait de « Corrections de rendu et de parcours — 28 septembre 2026 »

Preuves : `npm --prefix ui run check` et `npm --prefix ui run build` passent (avertissement de taille de bundle inchangé) ; les vérifications de rendu des contrôles et du pluriel échouent sans ces correctifs. Vérification au rendu du 28 septembre sur le fixture synthétique `tests/ui-fixture` (`127.0.0.1:4174`, `ui/dist` reconstruit) : dialogue de création de clé à 1452 px et 400 px (marqueur `*`, message inline vide et dupliqué, bouton bloqué puis création réelle, dialogue de secret, Échap), compteur « 4 clés affichées sur 4 » après création, infobulles des totaux au survol et au clavier, filtres complets en une colonne à 400 px, confirmation de suppression de fiche en français. Les `title` natifs des déclencheurs de filtre ne sont pas capturables en capture d'écran : leur contenu est couvert par la vérification du libellé visible et des noms accessibles.
