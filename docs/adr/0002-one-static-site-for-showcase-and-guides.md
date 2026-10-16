# Keep the showcase and guides in one static VitePress site

For [issue #164](https://github.com/sofianbll/bifrost-plugin-registry/issues/164), Sofian chose one VitePress site at the existing GitHub Pages address: a product-first homepage and task-oriented guides, with equivalent English and French content. The selected layouts are showcase B and sequential documentation B; the replacement wording and complete specification were accepted before local implementation.

OpenUI was considered and excluded by the owner, not ruled out as incompatible with Vue. The site stays static, without a separate application, domain, server or generative demo.

## Consequences

- Homepages are `/` and `/fr/`; the GitHub-readable guide indexes are served at `/guides` and `/fr/guides`.
- The shared theme uses Registry's existing logos, zinc/emerald tokens, Geist and light/dark identity. The product panel is not redesigned.
- Guides remain Markdown, with existing reference content and deep links preserved. Search and outlines use the final content, not hidden prototype text.
- The complete comparison source remains on local branch `prototype/164-showcase`, commit `c3adf83`; comparison controls and development-only content do not ship in the final site.
- [The accepted specification](https://github.com/sofianbll/bifrost-plugin-registry/issues/164#issuecomment-6217934514) governs local implementation. Acceptance did not authorise a push, PR, merge, deployment, release or gateway operation.
