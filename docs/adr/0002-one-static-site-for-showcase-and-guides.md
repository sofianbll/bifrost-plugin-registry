# Keep the showcase and guides in one static VitePress site

For [issue #164](https://github.com/sofianbll/bifrost-plugin-registry/issues/164), Sofian chose to keep VitePress as the base for the public showcase and documentation, at the existing GitHub Pages address. A `layout: home` landing page and a shared theme mapped from `DESIGN.md` keep one identity and one deployment rather than introducing a separate showcase application or domain.

OpenUI's Vue renderer and the option of an isolated learning prototype were considered, then the owner excluded OpenUI from this scope for now. This is a scope decision, not a claim that OpenUI is incompatible with VitePress; no OpenUI prototype was built.

## Consequences

- The planned landing pages are `/` and `/fr/`, with equivalent content and language-matched screenshots. The existing README guide indexes remain useful on GitHub and are to be published at `/guides` and `/fr/guides` instead of being the landing pages.
- The showcase and guides share Registry's existing logos, zinc/emerald tokens, Geist typography, and light/dark identity; the accepted product UI is not redesigned by this decision.
- This records the architecture decision only. The landing pages, theme and route changes are not implemented by this ADR, and no gateway or release change is authorized.
