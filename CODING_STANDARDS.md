# Coding standards

Judgement calls that a reviewer applies by reading. Mechanical rules live in the checks (`make check`).

## A fake runs the production code for the behaviour under test

A fake of a production component calls the real code for the behaviour the test exercises and replaces only what lies outside it.
Reason: a fixture and admin tests that listed a managed key's `/v1/models` routes without calling the real `Session.Project` hid a defect, the plugin runtime refusing a kept-native provider (`keptRoute` in `internal/registry/runtime.go`).
Example: the `/v1/models` case in `tests/ui-fixture/main.go` passes its listing through `Session.Project`.

## Guesses are shown and stored only after an explicit edit

A derived or guessed value (an inferred creator, a card's display name) is displayed, and stored once the user edits it explicitly.
Reason: a plain save must not turn a guess into the user's data.
Example: `persistedCreator` in `internal/admin/inferred_creator.go` drops an inferred creator before the card is stored and keeps a typed one.

## A destructive edit of a native gateway key is previewed, token-bound, confirmed and read back

A destructive edit of a native gateway key (removing models or providers from its permissions) shows a preview, carries a token bound to that preview, waits for an explicit confirmation, then reads the key back and compares it with the preview.
Reason: the gateway owns the user's keys, so the user sees and approves the exact change and the Registry verifies what the gateway holds afterwards.
Example: `internal/admin/native_permissions.go` runs the full cycle.

## A simplified screen keeps every capability reachable without Expert

When a screen is simplified in Basic, every capability that was reachable there stays reachable there; only identifiers, provenance and technical detail move to Expert or to a folded "Technical details".
Reason: Expert is hidden below 1280 px and on phones, so Basic is the only mode there. A distill pass moved the numeric corrections and the call name out of Basic, and only a review caught it.
Example: "Edit details" in `ui/src/features/catalog/ModelEditor.tsx` keeps the numeric corrections, their revert and their preview in Basic.

## One verb per concept, written down before it is used

A button or heading names one action with one verb taken from `CONTEXT.md`; a new term is added to `CONTEXT.md` in the same change, and the UI contract records the choice.
Reason: "Add", "Register" and "Save" named the same action in three places and cost three critique rounds.
Example: "Enregistrer un modèle" in `CONTEXT.md`: "Register" creates a card, "Add" only attaches an access or a card to a key or group, "Save" applies an edit.
