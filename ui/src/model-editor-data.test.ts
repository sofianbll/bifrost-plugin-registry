import { applyModelId, modelEditorOptions, omitUnchangedReferenceIds, prefillFromReference } from "./model-editor-data";
import type { Catalog } from "./catalog-api";
import type { Model } from "./demo";

const reference = { id: "creator/new-model", fields: {
  name: { value: "New Model", source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  creator: { value: "Creator", source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  family: { value: "Series", source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  context_length: { value: 64000, source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
  tool_call: { value: true, source: "models.dev", updatedAt: "2026-09-24", kind: "declared" as const },
}, overrides: {} };
const catalog: Catalog = { revision: "1", references: [reference], accesses: [], sources: [] };
const draft: Model = { id: "", name: "", creator: "Unknown", family: "My correction", inputModalities: [], outputModalities: [], tasks: [], kind: "Unknown", summary: "Manual summary", context: "Unknown", capabilities: {}, accesses: [{ provider: "", id: "", nativeModel: "", route: "Direct provider", status: "Unknown" }] };
const equal = (actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };

equal(modelEditorOptions(catalog, []).modelIds, [{ value: "new-model", label: "New Model", detail: "Reference creator/new-model", referenceId: "creator/new-model" }]);
const catalogWithNativePath: Catalog = { ...catalog, accesses: [
  { id: "provider/native/path", provider: "provider", model: "native/path", configured: true, referenceId: reference.id, fields: {}, overrides: {} },
  { id: "provider/other/path", provider: "provider", model: "other/path", configured: false, fields: {}, overrides: {} },
] };
equal(modelEditorOptions(catalogWithNativePath, []).modelIds, [{ value: "new-model", label: "New Model", detail: "Reference creator/new-model", referenceId: "creator/new-model" }]);
const next = prefillFromReference(draft, reference);
equal(next.name, "New Model");
equal(next.creator, "Creator");
equal(next.family, "My correction");
equal(next.context, "64000");
equal(next.summary, "Manual summary");
equal(next.accesses, draft.accesses);
equal(next.kind, "Unknown");
equal(next.capabilities.Tools, "Declared");
const selected = applyModelId(draft, "new-model", { provider: "provider", nativeModel: "native/path", status: "Configured", source: "provider/native/path" });
equal(selected.accesses[0], { ...draft.accesses[0], provider: "provider", id: "provider/new-model", nativeModel: "native/path", status: "Configured" });
equal(applyModelId(selected, "new-alias").accesses[0].id, "provider/new-alias");
equal(applyModelId({ ...selected, accesses: [{ ...selected.accesses[0], id: "provider/custom" }] }, "new-alias").accesses[0].id, "provider/custom");
equal(applyModelId({ ...selected, accesses: [{ ...selected.accesses[0], nativeModel: "manual/native" }] }, "new-alias").accesses[0].nativeModel, "manual/native");
const existing: Model = { ...draft, id: "alias", accesses: [{ provider: "p", id: "p/alias", nativeModel: "native", route: "Direct provider", status: "Configured", referenceId: "ref/automatic" }] };
equal(omitUnchangedReferenceIds(existing, [existing]).accesses[0].referenceId, undefined);
equal(omitUnchangedReferenceIds({ ...existing, accesses: [{ ...existing.accesses[0], referenceId: "ref/changed" }] }, [existing]).accesses[0].referenceId, "ref/changed");
equal(omitUnchangedReferenceIds({ ...existing, accesses: [{ ...existing.accesses[0], referenceId: "" }] }, [existing]).accesses[0].referenceId, "");
console.log("model editor data checks passed");
