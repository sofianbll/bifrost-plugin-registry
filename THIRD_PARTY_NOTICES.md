# Third-party notices

The root [MIT license](LICENSE) covers project-authored code. It does not replace the licenses of vendored components, fonts or dependencies.

| Material | Origin and license | Attribution |
| --- | --- | --- |
| Vendored UI primitives, styles, icons and images | [Maxim AI Bifrost](https://github.com/maximhq/bifrost), Apache-2.0 | [License](ui/LICENSE), [pinned source and file provenance](ui/PROVENANCE.md) |
| Geist font files | Copied from the pinned Bifrost UI; SIL Open Font License 1.1 | [Font license](ui/public/static/fonts/OFL.txt) |
| Frontend dependencies | Resolved by [ui/package-lock.json](ui/package-lock.json) | Each package retains its own distributed license |
| Bifrost gateway distribution | Built from the pinned upstream Bifrost release | Release provenance bundle and the image's `/app/licenses/` contain the upstream license and notices |

The Registry build embeds the compiled UI into the plugin. The [packaged plugin notices](packaging/README.md) include local copies of the applicable UI, font, and npm license texts beside the `.so`. Redistributors must retain the applicable upstream notices as well as the project license. This project is not affiliated with or endorsed by Maxim/Bifrost.
