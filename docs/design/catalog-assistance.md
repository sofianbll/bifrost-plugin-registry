# Catalog setup and assistance

Owner feedback, 24 September 2026. Tracked in [#14](https://github.com/sofianbll/bifrost-plugin-registry/issues/14).

## Current scope

- Model ID, Creator and Model series share a searchable selector with a short result list and an explicit custom-value action. Suggestions use the persisted reference catalog and configured/discovered models. Selecting a reference fills known empty fields; existing manual values remain available for review.
- Reference identity and native provider access identity stay distinct. An explicitly selected reference is linked to the configured access in the same revision as model Save. Choosing metadata never invents an access or changes native permissions.
- The editor has a bounded, scrollable body and fixed accessible actions. Capabilities remain visible even when every value is unknown; a catalog declaration or AI suggestion is not a test result.
- AI assistance is now in scope following this request, superseding its earlier deferral. Settings select a native virtual key, one of the exact model IDs visible to that key through `/v1/models`, and Chat Completions or Responses. Bifrost administration authentication alone does not grant inference access. The server resolves the selected key on demand; credentials never enter the prompt, settings JSON or ordinary workspace response.
- AI runs only on an explicit request. It receives bounded model metadata and local reference candidates, returns a validated proposal, and does not save or publish. The user reviews individual field changes; existing nonempty fields are not selected for replacement by default. Only a reference from the provided candidates can be proposed for matching.
- Virtual-key secrets can be revealed/copied on demand from Registry. They remain owned by Bifrost, are absent from persistent Registry configuration and exports, and are cleared from the UI on close or logout.

## Validation

Reuse the existing public HTTP/configuration and UI interaction boundaries: filtered and custom selection, metadata preservation, atomic reference mapping and revision conflicts, short-viewport scrolling, explicit AI review, native authorization refusal, and secret non-disclosure outside the requested action. Exercise AI with synthetic responses; that proves the integration behavior, not real-provider metadata quality.

Audit Bifrost 2.2.3 against official sources and qualify a newly compiled gateway/plugin pair before reporting native compatibility. Preserve the existing local pilot and production; source review and passing source CI alone are insufficient.

## Using the interface

1. In **Settings → AI assistance**, choose an existing virtual key, a model it exposes and the supported request endpoint; save. These settings contain IDs only.
2. In **Add model**, search a model ID, creator or series. Choose a catalogue result to prefill known metadata, or use a custom value. Review the provider access and its reference before saving.
3. **Suggest fields** requests an AI proposal. Select the fields to apply to the draft, then save the model. Neither generating nor applying a proposal publishes changes by itself.
4. In a **Virtual Keys** detail page, use **Reveal key → Reveal secret → Copy secret**. Closing the dialog clears its displayed value.

## HTTP additions

All endpoints use the existing Registry admin authentication and no-store response policy.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/assistant/settings` | Nonsecret settings and current revision |
| `PUT /api/assistant/settings` | Save `{model, endpoint, virtualKeyId}` with `If-Match`; empty values disable assistance |
| `GET /api/assistant/models` | Active virtual-key IDs/names; add `?virtualKeyId=...` for that key's published model IDs |
| `POST /api/assistant/suggest` | Validate `{draft:{id,name,creator,family,provider,nativeModel}}` and return a proposal without saving |
| `POST /api/keys/{id}/secret` | Fetch this key's native value only on this explicit request |

Workspace accesses accept optional `referenceId`: omitted preserves the mapping, an empty string unlinks, and a known exact ID links the native provider/model access. Mapping is committed atomically with the model under the workspace revision. An unchanged mapping retains its provenance.
