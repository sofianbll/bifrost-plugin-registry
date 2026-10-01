# Contributing / Contribuer

## English

Open an issue with a reproducible bug or a concrete use case before a larger change. Work on a branch and open a pull request against `main`. Never include API keys, tokens, private URLs, production configurations, or personal data in issues, logs, tests, or commits.

For local checks, install Go 1.27.1, Node.js 22.23.1 with npm, and Python 3. Then run `make check` from the repository root. It runs Go vet and race tests, installs the UI dependencies from `ui/package-lock.json`, checks and builds the UI, and runs the offline Python converter regression. Routine Go output goes to ignored `dist/checks/`; historical evidence under `reports/` is preserved. `make build` builds only the standalone Registry CLI in `dist/registry`; it does not build the Bifrost gateway, plugin `.so`, or release image.

The full packaging regression (`packaging/test-package-release.sh`) requires a previously verified local gateway/plugin pair and upstream source files under ignored `dist/`. Follow [the release procedure](docs/RELEASE.md) for that qualification. Pull request CI runs the Go checks and CLI build, UI checks and build, Python regression, and shell syntax checks. It does not qualify the native ABI, live Bifrost, provider inference, or production behavior.

The browser journeys and README screenshots run in the separate E2E workflow with `@playwright/test` against the synthetic fixture (`tests/ui-fixture`). To run the journeys locally, build the UI, then run `npx playwright install chromium && npx playwright test` from `ui/` ([details](tests/ui-fixture/README.md)). The screenshots are Linux-only baselines refreshed by a manual workflow run ([docs/images](docs/images/README.md)); never commit images captured on another OS.

The Models.dev snapshot generator (`scripts/build-modelsdev-snapshot.ts`) and its determinism check require Bun and a clean checkout of the pinned upstream repository at `dist/models-dev-upstream` (ignored by Git). Bun is a generation-only tool: the Go plugin, its tests, and the runtime do not depend on it. `make check` runs the determinism check when both Bun and the upstream checkout are available, and skips it with a notice otherwise.

## Français

Ouvrez un ticket avec un bug reproductible ou un usage concret avant un changement important. Travaillez sur une branche et proposez une pull request vers `main`. Ne publiez jamais de clés API, jetons, URL privées, configurations de production ou données personnelles dans les tickets, journaux, tests ou commits.

Pour les contrôles locaux, installez Go 1.27.1, Node.js 22.23.1 avec npm et Python 3, puis lancez `make check` à la racine. Cette commande exécute `go vet`, les tests avec détecteur de courses, l'installation UI depuis `ui/package-lock.json`, les contrôles et le build UI, puis la régression du convertisseur Python hors ligne. Les sorties Go courantes vont dans `dist/checks/`, ignoré par Git ; les preuves historiques de `reports/` restent conservées. `make build` ne compile que le CLI Registry autonome dans `dist/registry` : ni gateway Bifrost, ni plugin `.so`, ni image de livraison.

La régression complète du paquetage (`packaging/test-package-release.sh`) demande une paire gateway/plugin locale déjà qualifiée et les sources upstream dans `dist/`, ignoré par Git. Suivez [la procédure de release](docs/RELEASE.md) pour cette qualification. La CI des pull requests vérifie seulement la syntaxe des scripts shell ; elle ne qualifie ni l'ABI native, ni Bifrost actif, ni l'inférence fournisseur, ni la production.

Les parcours navigateur et les captures du README tournent dans le workflow E2E séparé, avec `@playwright/test` contre la fixture synthétique (`tests/ui-fixture`). Pour lancer les parcours en local, compilez l'UI puis exécutez `npx playwright install chromium && npx playwright test` depuis `ui/` ([détails](tests/ui-fixture/README.md)). Les captures sont des références propres à Linux, régénérées par un lancement manuel du workflow ([docs/images](docs/images/README.md)) : ne publiez jamais de captures prises sur un autre système.

Le générateur de snapshot Models.dev (`scripts/build-modelsdev-snapshot.ts`) et son contrôle de déterminisme exigent Bun et un checkout propre du dépôt upstream épinglé dans `dist/models-dev-upstream` (ignoré par Git). Bun n'est un outil que de génération : ni le plugin Go, ni ses tests, ni l'exécution ne dépendent de lui. `make check` exécute ce contrôle lorsque Bun et le checkout upstream sont présents, et le saute avec un avis sinon.
