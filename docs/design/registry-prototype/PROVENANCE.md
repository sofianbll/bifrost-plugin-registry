# Upstream provenance

## Provider harness catalog and recorded demo

`public/harness-catalog.json` is derived from `tests/e2e/api/collections/provider-harness.json` at commit `6493abd3d1422c9bfde95f242fd57b38e73ce881`. Source SHA-256: `3330c41792b3ec93dd70c50f12c6547803a57ee76869b639bff70a096ad719b0`. The importer retains 3,530 request entries across 114 top-level folders, exact paths/bodies and inherited named assertions; credential-shaped values are redacted. This is a browsing projection, not an executable replacement for the Postman collection. Dynamic assertion names are marked; conditional assertions are not proof of execution.

`public/harness-demo-report.json` was generated using upstream's pinned Newman version 6.2.1, three original official requests (native chat, native Responses, native streaming chat), and original collection-level scripts. `scripts/record-harness-demo.mjs` reproduces it against an isolated loopback stub. HTTP payloads are synthetic, including a deliberate 503 on Responses. Newman report fields and lifecycle event timestamps are captured output. No gateway or provider capability was measured; the stub is not the Bifrost Mocker plugin. No authentication was used. UI playback timing is illustrative.

## UI components

Source: [Maxim AI Bifrost](https://github.com/maximhq/bifrost) commit [`6493abd3d1422c9bfde95f242fd57b38e73ce881`](https://github.com/maximhq/bifrost/tree/6493abd3d1422c9bfde95f242fd57b38e73ce881/ui). The table records SHA-256 of the upstream source and the vendored copy. Identical hashes mean byte-identical files.

| Prototype file | Upstream `ui/` file | Upstream SHA-256 | Copy SHA-256 |
| --- | --- | --- | --- |
| `src/components/ui/treeView.tsx` | `components/ui/treeView.tsx` | `f64401350ea62c078557451c7a9ede04dfc0bd952977478dc8c859410d227d04` | `f64401350ea62c078557451c7a9ede04dfc0bd952977478dc8c859410d227d04` |
| `src/lib/constants/icons.tsx` | `lib/constants/icons.tsx` | `85b357ed9b33510b045b00c9a7729c0759c608c0642dfe8e9509e6fa88ff95b5` | `2787644dc39dc95ba9cd66eba0e0526ea6ff0486e6bbbf5654478a7ab3ceec60` |
| `public/images/azure.webp` | `public/images/azure.webp` | `84e6bc995f23953bbae1b7168e783febe016fdf8ca08533101e595c4474c62c7` | `84e6bc995f23953bbae1b7168e783febe016fdf8ca08533101e595c4474c62c7` |
| `public/images/databricks.svg` | `public/images/databricks.svg` | `91f536ec57cfc059779de5081ef1b9613876b9b4f65efa6f0b8cd66edd32f3d7` | `91f536ec57cfc059779de5081ef1b9613876b9b4f65efa6f0b8cd66edd32f3d7` |
| `public/images/nebius.webp` | `public/images/nebius.webp` | `df8eaea29b693c89db7c09db5902573ef34a3967dee9f5d204cea363301641e8` | `df8eaea29b693c89db7c09db5902573ef34a3967dee9f5d204cea363301641e8` |
| `public/images/sgl.webp` | `public/images/sgl.webp` | `134276749500fd79b785d018925c90dbbe2ed8ddd3b368044569d0dc68b269bd` | `134276749500fd79b785d018925c90dbbe2ed8ddd3b368044569d0dc68b269bd` |
| `public/images/google.svg` | `public/images/scim/google.svg` | `b68e01a0dd2b0cc6a3bcb9d61419f39a7722dd88517bfbf2904214a6d84aa2f3` | `b68e01a0dd2b0cc6a3bcb9d61419f39a7722dd88517bfbf2904214a6d84aa2f3` |
| `src/components/ui/alert.tsx` | `components/ui/alert.tsx` | `1356b832cb8374ead60a99cb2120a36dadeb7b5a5401a9fc6b066ec1f5a43a8f` | `1356b832cb8374ead60a99cb2120a36dadeb7b5a5401a9fc6b066ec1f5a43a8f` |
| `src/components/ui/badge.tsx` | `components/ui/badge.tsx` | `8041cd4d09d4cbc148d6662f421a8b2297fba9fbb676d4b71306bd113e3b7ef9` | `8041cd4d09d4cbc148d6662f421a8b2297fba9fbb676d4b71306bd113e3b7ef9` |
| `src/components/ui/button.tsx` | `components/ui/button.tsx` | `5a635b8d985921f8c7a3aec9300c7404c09c839e6daab8d044e72d0e11da6006` | `5a635b8d985921f8c7a3aec9300c7404c09c839e6daab8d044e72d0e11da6006` |
| `src/components/ui/card.tsx` | `components/ui/card.tsx` | `ce5d68a47b146d77fd62e625a856cbfb8e4b28174c2999a133532909e08f5ef6` | `ce5d68a47b146d77fd62e625a856cbfb8e4b28174c2999a133532909e08f5ef6` |
| `src/components/ui/checkbox.tsx` | `components/ui/checkbox.tsx` | `170bddbdcd7a92237febb76322a27277438a006ed74933581e96890f90a57cf6` | `170bddbdcd7a92237febb76322a27277438a006ed74933581e96890f90a57cf6` |
| `src/components/ui/dialog.tsx` | `components/ui/dialog.tsx` | `04e4e29fe30913f3e9dac0e5159e3457e88ec1c95f3c52a42130996e0d029963` | `04e4e29fe30913f3e9dac0e5159e3457e88ec1c95f3c52a42130996e0d029963` |
| `src/components/ui/dropdownMenu.tsx` | `components/ui/dropdownMenu.tsx` | `8970a980f1d9509bd5f75fd7fb396953b7798f7a70a0da99b4d28dc3630c5b2e` | `8970a980f1d9509bd5f75fd7fb396953b7798f7a70a0da99b4d28dc3630c5b2e` |
| `src/components/ui/input.tsx` | `components/ui/input.tsx` | `2d4115df438afac5965ff2cebfadce4854955a4b890c86f0fbdde4b8686f6b38` | `2d4115df438afac5965ff2cebfadce4854955a4b890c86f0fbdde4b8686f6b38` |
| `src/components/ui/label.tsx` | `components/ui/label.tsx` | `e554a871e3a472286c35ca78f858d7090e60a8599441573e485cdbd33682c233` | `e554a871e3a472286c35ca78f858d7090e60a8599441573e485cdbd33682c233` |
| `src/components/ui/popover.tsx` | `components/ui/popover.tsx` | `b637d80d4037ab9857562eba67a26c87e6934c177c0d86962e60a2e9cb12b94f` | `b637d80d4037ab9857562eba67a26c87e6934c177c0d86962e60a2e9cb12b94f` |
| `src/components/ui/select.tsx` | `components/ui/select.tsx` | `5b4558b1ea3136b9b634384c3350cac0845c6a65d11c20b842473931164ae6b5` | `5b4558b1ea3136b9b634384c3350cac0845c6a65d11c20b842473931164ae6b5` |
| `src/components/ui/separator.tsx` | `components/ui/separator.tsx` | `6016784bb81724c3ab5e71b9a53fe39b629492db25930030dcfead7b919ad68d` | `6016784bb81724c3ab5e71b9a53fe39b629492db25930030dcfead7b919ad68d` |
| `src/components/ui/sheet.tsx` | `components/ui/sheet.tsx` | `9630f0698bdd650a685a5dab1eb69be92ce6bf3dc88c30c83b6cebac3a44e7b1` | `9630f0698bdd650a685a5dab1eb69be92ce6bf3dc88c30c83b6cebac3a44e7b1` |
| `src/components/ui/sidebar.tsx` | `components/ui/sidebar.tsx` | `36cb49715961ae4e88f98c949059c686c8b6aa764acb2063a26c900755f4ed86` | `36cb49715961ae4e88f98c949059c686c8b6aa764acb2063a26c900755f4ed86` |
| `src/components/ui/skeleton.tsx` | `components/ui/skeleton.tsx` | `cd4703f458d22189db7ab5f34163b3ae6af5abd9bf33e66c6b94ecf5878e708d` | `cd4703f458d22189db7ab5f34163b3ae6af5abd9bf33e66c6b94ecf5878e708d` |
| `src/components/ui/switch.tsx` | `components/ui/switch.tsx` | `e20a47abdfeff69d6f290848e68fc6d9e251958416f0f413bad30e821f342c2d` | `e20a47abdfeff69d6f290848e68fc6d9e251958416f0f413bad30e821f342c2d` |
| `src/components/ui/table.tsx` | `components/ui/table.tsx` | `942177a4209b4b8d6b5bf3cd22c181784094ddda4d3cb9c68c409031ad82d7d6` | `942177a4209b4b8d6b5bf3cd22c181784094ddda4d3cb9c68c409031ad82d7d6` |
| `src/components/ui/textarea.tsx` | `components/ui/textarea.tsx` | `0af70794bb4338302a7eb9450d43bee9862ade32fda61ffc230b4d51d0edc89c` | `543deadb03e0f6bcb70889d87214e9e86572344118961f623db01e2bba9e965e` |
| `src/components/ui/tooltip.tsx` | `components/ui/tooltip.tsx` | `8f4edec28d29662bef66371f15238b54f4a489a4cf3794a7fdd46d88b77d842c` | `8f4edec28d29662bef66371f15238b54f4a489a4cf3794a7fdd46d88b77d842c` |
| `src/hooks/use-mobile.ts` | `hooks/use-mobile.ts` | `172c7a3a1c68e449c6047b7cb8a0880a30a9e213fab904ea7314e2a55f59de14` | `172c7a3a1c68e449c6047b7cb8a0880a30a9e213fab904ea7314e2a55f59de14` |
| `src/hooks/useCopyToClipboard.ts` | `hooks/useCopyToClipboard.ts` | `9c1ea441db2052bd65102856861d1e6e7f550bc038cab3f9f9c564544b644ef0` | `9c1ea441db2052bd65102856861d1e6e7f550bc038cab3f9f9c564544b644ef0` |
| `src/lib/utils.ts` | `lib/utils.ts` | `c5c64a3c0b7ec92ba32f513a7e64e563f11358a64009104205219010f8ec9354` | `c5c64a3c0b7ec92ba32f513a7e64e563f11358a64009104205219010f8ec9354` |
| `src/globals.css` | `app/globals.css` | `0a49548c5ce68905f88c9c7783eb8791ee86b4a71c124ca4670b4b9bdd2b0d8a` | `6aa1875f2d0cb7b50504a83407ff7b97a9ceb60baafe6a9a8b148e67b8b86dbb` |
| `public/bifrost-icon.webp` | `public/bifrost-icon.webp` | `4324fa7cc3c9a16d5255faae1fb15980aad8b213b5fdd1c67679db2b25228667` | `4324fa7cc3c9a16d5255faae1fb15980aad8b213b5fdd1c67679db2b25228667` |
| `public/bifrost-logo-dark.webp` | `public/bifrost-logo-dark.webp` | `5f4a2e1562a46baebde57f07ccc4335c3cd966065958e22cffdb3da16b2f2117` | `5f4a2e1562a46baebde57f07ccc4335c3cd966065958e22cffdb3da16b2f2117` |
| `public/bifrost-logo.webp` | `public/bifrost-logo.webp` | `a81788b15ebb9fca1ca7680162f4c480178779594049c3ef36567df3c610eb33` | `a81788b15ebb9fca1ca7680162f4c480178779594049c3ef36567df3c610eb33` |
| `public/static/fonts/Geist-Italic-Variable.woff2` | `public/static/fonts/Geist-Italic-Variable.woff2` | `fc30f0513368921e77966387d499be1b3f4eb728da24f1470d5b32c2227c095c` | `fc30f0513368921e77966387d499be1b3f4eb728da24f1470d5b32c2227c095c` |
| `public/static/fonts/Geist-Variable.woff2` | `public/static/fonts/Geist-Variable.woff2` | `9ceed04f6edb0334ec20ad3ddd75754516d4da63dde8f01b25a961a5ea71e2f6` | `9ceed04f6edb0334ec20ad3ddd75754516d4da63dde8f01b25a961a5ea71e2f6` |
| `public/static/fonts/GeistMono-Italic-Variable.woff2` | `public/static/fonts/GeistMono-Italic-Variable.woff2` | `fd1860c6abe33e3b78b3faea45bd02e38e703ee870004b581eba3a1e6cd349f3` | `fd1860c6abe33e3b78b3faea45bd02e38e703ee870004b581eba3a1e6cd349f3` |
| `public/static/fonts/GeistMono-Variable.woff2` | `public/static/fonts/GeistMono-Variable.woff2` | `f2be56afe817546285c593cedf06110ef6240d5687257ca864315784b9b359ee` | `f2be56afe817546285c593cedf06110ef6240d5687257ca864315784b9b359ee` |
| `public/static/fonts/OFL.txt` | `public/static/fonts/OFL.txt` | `1781d2806a07d91c4edf4740b88449fab7d0eadad53f7c351b94cd4d4eb8c00f` | `1781d2806a07d91c4edf4740b88449fab7d0eadad53f7c351b94cd4d4eb8c00f` |

`src/globals.css`: Tailwind `@source` paths scan this standalone `src/` folder instead of the upstream app and enterprise folders; relative font URLs respect the mounted `/bifrost-registry/` base path. `src/components/ui/textarea.tsx`: only the unused `AutoSizeTextarea` export and its `react-textarea-autosize` import were removed; the upstream `Textarea` component is byte-for-byte unchanged within that file.

`src/lib/constants/icons.tsx` retains the upstream `ProviderIcons` SVG definitions unchanged and removes only the unused routing-engine icon section and `RenderProviderIcon` wrapper. The wrapper depended on `next-themes`; this prototype supplies the current theme with CSS light/dark branches in `src/BrandIcon.tsx`. The four upstream image assets referenced by the retained icon definitions are included above. The Google organization logo comes from upstream SCIM art; Moonshot AI has no matching upstream mark and uses text initials.

The standalone shell composes the original `components/ui/sidebar.tsx` primitive, original buttons/cards/dialogs/sheets/tables, upstream `globals.css`, logos, and Geist fonts. The upstream application `clientLayout.tsx`, `components/sidebar.tsx`, and `components/topbar.tsx` depend on Redux, TanStack Router, RBAC, gateway configuration, and WebSocket state; they were not imported. `src/App.tsx` composes the same shell structure with local hash navigation, fixtures, and a local theme button. The model card combines original `Card`, `Badge`, and `Button` primitives because upstream does not have an individual model card component.

Bifrost source files and assets are under `LICENSE` (Apache 2.0). Geist fonts have the separate license at `public/static/fonts/OFL.txt` (SIL OFL).

The live mount changes font URLs in `globals.css` to Vite-resolved relative assets so they work below `/bifrost-registry/`; upstream colors, component primitives and typography tokens are unchanged.
