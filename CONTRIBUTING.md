# Contributing / Contribuer

## English

Open an issue with a reproducible bug or a concrete use case before a larger change. Work on a branch and open a pull request against `main`. Never include API keys, tokens, private URLs, production configurations, or personal data in issues, logs, tests, or commits.

For local checks, install Go 1.27.1, Node.js 22.23.1 with npm, and Python 3. Then run `make check` from the repository root. It runs Go vet and race tests, installs the UI dependencies from `ui/package-lock.json`, checks and builds the UI, and runs the offline Python converter regression. Routine Go output goes to ignored `dist/checks/`; historical evidence under `reports/` is preserved. `make build` builds only the standalone Registry CLI in `dist/registry`; it does not build the Bifrost gateway, plugin `.so`, or release image.

The full packaging regression (`packaging/test-package-release.sh`) requires a previously verified local gateway/plugin pair and upstream source files under ignored `dist/`. Follow [the release procedure](docs/RELEASE.md) for that qualification. Pull request CI runs the Go checks and CLI build, UI checks and build, Python regression, and shell syntax checks. It does not qualify the native ABI, live Bifrost, provider inference, or production behavior.

## Français

Ouvrez un ticket avec un bug reproductible ou un usage concret avant un changement important. Travaillez sur une branche et proposez une pull request vers `main`. Ne publiez jamais de clés API, jetons, URL privées, configurations de production ou données personnelles dans les tickets, journaux, tests ou commits.

Pour les contrôles locaux, installez Go 1.27.1, Node.js 22.23.1 avec npm et Python 3, puis lancez `make check` à la racine. Cette commande exécute `go vet`, les tests avec détecteur de courses, l'installation UI depuis `ui/package-lock.json`, les contrôles et le build UI, puis la régression du convertisseur Python hors ligne. Les sorties Go courantes vont dans `dist/checks/`, ignoré par Git ; les preuves historiques de `reports/` restent conservées. `make build` ne compile que le CLI Registry autonome dans `dist/registry` : ni gateway Bifrost, ni plugin `.so`, ni image de livraison.

La régression complète du paquetage (`packaging/test-package-release.sh`) demande une paire gateway/plugin locale déjà qualifiée et les sources upstream dans `dist/`, ignoré par Git. Suivez [la procédure de release](docs/RELEASE.md) pour cette qualification. La CI des pull requests vérifie seulement la syntaxe des scripts shell ; elle ne qualifie ni l'ABI native, ni Bifrost actif, ni l'inférence fournisseur, ni la production.
