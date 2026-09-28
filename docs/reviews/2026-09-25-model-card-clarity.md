# Model-card clarity review

Scope: the complete local plugin review, using an existing sanitized gateway capture. This is a source/UI correction, not a new native plugin release or a production deployment. No gateway configuration or credentials were changed.

The user identified a documentary match presented as a native Bifrost reference. This review follows that issue through catalog browsing, registration, property editing, groups and virtual-key selection. The question at every step is: what exists, what is proposed, and what does saving change?

## Findings and corrections

| Severity | Misleading behavior | Correction |
| --- | --- | --- |
| High | A property edited inside a model draft was persisted immediately, even if the model was later cancelled. | Stage corrections with the model and validate/save both under one Registry revision. Cancel discards both. Native effects still have their existing separate, explicit failure handling. |
| High | A provider filter looked like a provider-specific permission selector, although selection includes the whole logical model. | State the selection scope and display every included provider access in selection cards and the key preview. Provider-specific switches remain unimplemented. |
| Medium | The field called a card category selects the Registry endpoint types. | Label it as exposed operations and explain its actual effect. Do not invent a separate navigation taxonomy in this change. |
| Medium | Provider columns showed inherited documentary values without identifying inheritance. | Show inheritance separately from property source. Shared-property previews cover linked accesses beyond the current card. |
| Medium | A gallery-wide source label implied that names, pricing and native access all had the same provenance. | Attach provenance to the specific fact and distinguish an automatic documentary match from a recorded Registry model. |
| Medium | Editing the common ID was described as having no native effect, although saving may install a Bifrost alias. | Show the alias effect separately from multi-provider routing, with local-copy wording in snapshot mode. |
| Medium | Offline review offered online source refresh and AI calls; key verification looked like a failed save. | Disable refresh with a visible reason, omit unavailable AI actions, and show local saved selection separately from live verification. |
| Medium | An unknown boolean opened as false in the documentary editor. | Require an explicit Yes/No choice. Unknown stays distinct from false. |

## Evidence and limits

Two independent code-based heuristic audits rated the initial affected surfaces 6/10 and 7/10. Those are provisional diagnoses, not usability measurements. A higher score is not asserted without user testing.

The catalog still offers documentary grouping suggestions. It does not establish model identity or capabilities through inference tests. Prices and limits edited here are Registry catalog values; this change does not add a native Bifrost pricing/parameter writer.

Validation results are recorded below after integration. Existing release and ABI qualification reports remain historical and unchanged.

### Validation completed

- `npm run check --prefix ui`: all nine existing check entrypoints passed, including staged override and single-request API regressions.
- `npm run build --prefix ui`: TypeScript and production build passed. The existing bundle-size warning remains.
- `go test ./internal/admin ./cmd/registry-review`: passed. The workspace test verifies rejection without persistence for invalid batch/model, stale revision and absent catalog, plus successful joint persistence.
- Independent review of the new transaction found no remaining concrete regressions after the absent-catalog guard was added.
- Browser, isolated capture copy: source attribution and inherited values; stage 32,000 tokens for one access while retaining the 1,000,000-token reference; cancel prompt, return to editing, discard with unchanged persisted file; register and reload the correction; rename a registered card and retain its Registry name in the gallery; disabled source refresh; unknown boolean remains unselected; prepare an existing key locally with two saved models and display all selected accesses; show a neutral local saved state instead of failed live verification.
- Desktop and 390px visual checks: model properties and key selection remain accessible. The temporary viewport and QA tab/server were removed.
- The user-facing local review was restarted on its original port with the new backend and frontend. Its saved configuration remained byte-for-byte unchanged; test writes were confined to the separate ignored QA copy.

Remaining product work: per-provider switches within a model selection, a separate navigation taxonomy, and native writes for supported metadata fields need their own validated contracts. They are not presented as working features by this correction. This review does not prove real-provider inference or gateway/plugin ABI compatibility.
