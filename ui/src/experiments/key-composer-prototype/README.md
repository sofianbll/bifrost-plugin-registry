# Registry UX prototype (throwaway)

An in-memory UX evaluation of the model catalog, model details, groups, and
virtual keys. All data is synthetic; there is no gateway, Registry API, or real
secret.

```sh
npm --prefix ui run prototype:key-composer
```

Open <http://127.0.0.1:8772/key-composer-prototype.html>. Choose Français or
English in the header language menu. Use the compact Expert switch beside the
theme control to switch modes; the
choice is kept in the `?mode=basic|expert` URL parameter and survives reloads. The older
`?variant=A|B` parameter is still accepted as a fallback (`A` → basic, `B` →
expert).

The sidebar connects four screen lots:

| Lot | Interaction to review | Acceptance boundary |
| --- | --- | --- |
| Models | Shared Grid, Square, and Table views, filters, then open a model. | Browsing never changes a key selection. |
| Model detail | Overview, per-provider accesses, documentary property comparison, and sources. | Missing access facts remain unknown; model declarations are not promoted to access facts. |
| Groups | Browse in shared views; create or edit a model/access selection, preview linked-key impact, save or cancel. | Edits stay in memory and linked keys reflect the saved group. |
| Virtual keys | Browse, create, edit, copy an inert demo token, and inspect planned IDs. | No real key, routing, or persistence. |

The model browser and group editor reuse the key composer’s catalog cards,
selection controls, provider summaries, access details, view switcher, and
filters. The standalone catalog keeps selection controls hidden. Remaining
sidebar entries are disabled because those screens are outside this prototype.

- **Basic mode — Guided steps**: Models → Groups → Review. Sequential gesture;
  the planned catalog is the final step.
- **Expert mode — Composition tray**: browser (Models / Groups tabs) beside a
  persistent draft panel with live planned catalog on larger screens.

Expert mode requires 1280 CSS pixels; below that width its toggle is hidden
and the journey uses Basic. Returning to desktop restores the preferred mode
and the same draft. The internal Basic step resets when its view remounts.

Run the selection and key lifecycle scenario checks with `npm --prefix ui run check:key-composer`.

The September 27 reference screen opens directly on key creation. It shares one
selection and filtering state across **Grid**, **Square**, and **Table** views;
switching views or filters preserves selected models and their configured accesses.
The header language select supports `?lang=fr|en` (French by default). Expert
mode keeps the live draft on wide screens, while Basic presents
guided steps; both use the same model results. The compact layout puts search,
view, categories and provider/capability filters before the cards. Demo controls
are after the results. The table remains horizontally scrollable for comparison.

Directional modality icons and capability icons open compact details by click,
touch or keyboard. Model-level declarations are labelled as such; access details
show only facts actually present for that provider. Missing per-access evidence
is **not specified**, never assumed unsupported. Capability and modality details
do not claim an execution test. Square cards show the same selection/access
actions as compact cards and the table.
Unavailable price, latency, release and privacy data remain unknown; unsupported
filters and sorts do not invent these values. Demo controls are expandable. The ID format selector is directly visible
in the preview. Card geometry and capability summaries use the shared Registry components.

Both modes implement the September 26 selection rules against the synthetic
fixture: configured accesses activate by default at selection time; a later
access (demo control: "new Azure access appears on Kimi K2") stays off in
existing selections until explicitly activated; local exclusion wins over
groups and direct picks and is restored explicitly; the witness key and the
group definitions never change from this page. The preview shows what the
draft plans only — nothing is published, routed or verified.

What this prototype does **not** establish: alias creation, native routing,
plugin ordering, ABI compatibility, provider inference, or any write to
Bifrost. Declared values in access details are documentary; unknowns stay
unknown.

## Key library and editing

The sidebar and breadcrumb open the in-memory key library. It reuses `CatalogCard`,
`CatalogGrid`, and `ViewMenu` with the model browser: Grid, Square, and Table.
Search matches key name, client, resolved model names/IDs, and groups; filters
narrow by group and client, and sorting supports name, client, and exposed ID count.

Edit clones the saved draft, including its selections and access overrides. Save
replaces the same key ID and retains its demo token; cancel leaves the saved key
unchanged. Leaving an unsaved draft requests confirmation. The witness stays
read-only. Creating a key adds an entry rather than replacing another key.

Copy writes only an inert `DEMO_NOT_VALID_` token. Success appears after clipboard
write completes; if access fails, a dialog offers manual selection. No native key,
secret endpoint, persistence, gateway write, or authentication is involved. Reload
resets all keys and edits to the synthetic fixture.

## Component conventions

Use the existing Bifrost-vendored shadcn/Radix primitives and their standard
variants before adding local size overrides. Keep the same spacing scale across
toolbars, cards and dialogs. Selection uses a checkbox in table rows; secondary
explanations and expert controls are disclosed on demand. Rich capability details
must stay compact and keyboard accessible. Do not use overlapping provider logos
or broad descendant sizing overrides. This follows Sofian's September 27 feedback
and the supplied *Don't Make Me Think* resource. A library change alone does not
validate the page composition.

`ViewMenu` uses the retrieved shadcn/Radix ToggleGroup with vertical single
selection, icons for every format, and a sliding active indicator. Arrow keys move
focus and Space selects. Model display options reveal descriptions, IDs, provider
logos, and capability icons without changing selections or access configuration.
Square cards can grow when extra text is enabled to prevent clipping.

Toggle, ToggleGroup, and Field are adapted from the official shadcn registry to
local imports, individual Radix packages, and the existing radius. Micro-interactions
use short CSS transitions and respect reduced motion; button feedback is scoped
to this prototype. No additional animation runtime or preset migration is used.

Provider and inherited-group summaries share `CompactCollection` between model
cards/table rows and key cards. Providers are deduplicated by provider ID: three
logos plus an actionable overflow count. Groups show one truncated badge plus an
overflow count; distinct groups with identical names remain counted separately.
Named popovers expose all entries in a bounded, keyboard-scrollable list. Key
cards include providers only from active accesses of active resolved models.
In the key and group composers, a green ring marks a provider with at least one
active access; a dashed outline marks one with none. The access count remains
the source for exact per-model access selection.
An ignored QA fixture under `ui/dist/checks/` was used to inspect 18 providers
and 18 groups, including two groups with the same name. Vite build clears this
temporary output directory.

Expert requires at least 1280 CSS pixels, matching its two-column layout. Below that threshold the toggle is hidden and Basic renders with the same draft; the preferred mode resumes at desktop width. Grid cards follow visible content; Square keeps a 1:1 ratio with a scrollable body.
