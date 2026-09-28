# Documentation

- [User guide](USER-GUIDE.md): model registration, sources, groups, keys and local snapshot limitations.

Start with [current status](../STATUS.md) for the release, merged changes and local development, then the [September 26 reconciliation](reviews/2026-09-26-project-state.md) for evidence and gaps. Use [installation](INSTALL.md) for the published release or [contributing](../CONTRIBUTING.md) for source work.

## Use Registry

| Guide | Language | Contents |
| --- | --- | --- |
| [Installation](INSTALL.md) | English | Release files, credentials, persistent storage, upgrade and rollback |
| [Installation et livraison](RELEASE.md) | Français | Même parcours, avec les liens vers les preuves |
| [Configuration](CONFIGURATION.md) | Français | Registry records, policies, APIs and legacy datasheets |
| [Security policy](../SECURITY.md) | English | Private vulnerability reporting |
| [Trust boundaries](SECURITY.md) | Français | Native governance, admin access and operational constraints |

## Develop and validate

- [Contribution guide](../CONTRIBUTING.md): requirements, source checks and pull requests.
- [React UI](../ui/README.md): frontend development and upstream provenance.
- [Native build](BUILD.md) (Français): compile the gateway and plugin with compatible dependencies.
- [Packaging](../packaging/README.md): package a verified pair into separate artifacts.
- [Deployment acceptance](ACCEPTANCE.md) (Français): checks for a target environment.
- [Release evidence](../reports/v1-final/README.md): source pin, hashes, native tests and browser review.
- [Changelog](../CHANGELOG.md): release changes.

## Design and history

[Domain vocabulary](../CONTEXT.md), [V1 release specification](design/core-v1-spec.md), [current product decisions](design/product-direction.md), [native model-card contract](design/model-card-bifrost-contract.md), [Models.dev research](design/models-dev-reuse-research.md) and [future Bifrost fork strategy](design/bifrost-fork-strategy.md) capture the project's scope and decisions.

Historical material is preserved in [archive/](archive/), the dated design notes and [reports/](../reports/README.md). These records are useful evidence, not current installation instructions.
