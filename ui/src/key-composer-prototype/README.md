# Key composer prototype (throwaway)

Two modes of the **create a virtual key** journey in a single app. Throwaway UX
evaluation code: synthetic fixture data, in-memory mutations, no gateway, no
Registry API, no real secrets.

```sh
npm --prefix ui run prototype:key-composer
```

Open <http://127.0.0.1:8772/key-composer-prototype.html>. Use the compact
Expert toggle in the header, next to the theme control, to switch modes; the
choice is kept in the `?mode=basic|expert` URL parameter and survives reloads. The older
`?variant=A|B` parameter is still accepted as a fallback (`A` → basic, `B` →
expert).

- **Basic mode — Guided steps**: Models → Groups → Review. Sequential gesture;
  the planned catalog is the final step.
- **Expert mode — Composition tray**: browser (Models / Groups tabs) beside a
  persistent draft panel with live planned catalog on larger screens.

Expert mode is only available on larger screens; on mobile the toggle is
disabled and the journey always uses Basic mode. Returning to a larger screen
restores the chosen mode and the current draft.

Run the state scenario check with `npm --prefix ui run check:key-composer`.

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
