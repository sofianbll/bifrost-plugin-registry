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

## A write to the native gateway is previewed, token-bound, confirmed and read back

Every write to the native Bifrost gateway shows a preview, carries a token bound to that preview, waits for an explicit confirmation, then reads the result back and compares it with the preview.
Reason: the gateway owns the user's keys and limits, so the user sees and approves the exact change and the Registry verifies what the gateway holds.
Example: `internal/admin/native_permissions.go` runs the full cycle; `internal/admin/adoption.go` shares the preview and its bound token.
