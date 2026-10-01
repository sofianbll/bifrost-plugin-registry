# Bifrost Registry documentation

English · [Français](fr/)

Registry adds a trustworthy model catalogue and per-key access composition to Bifrost virtual keys. It runs as a plugin beside an unmodified Bifrost gateway and serves its own interface. It is an independent project, not an official Maxim/Bifrost product.

![Registry catalogue grid](./images/en/catalogue-grid.png)

## Use Registry

| Guide | Contents |
| --- | --- |
| [Installation](INSTALL.md) | Which files for which host, the two installation modes, credentials, upgrade and rollback |
| [Troubleshooting](TROUBLESHOOTING.md) | Temp-directory permission errors, `Dynamic loading not supported`, activation failures |
| [User guide](USER-GUIDE.md) | Model registration, sources, groups, keys and local snapshot limitations |
| [Configuration](CONFIGURATION.md) | Registry records, groups, key policies, panel API and legacy datasheets |
| [Security and trust boundaries](SECURITY.md) | Native governance, admin access and operational constraints |

For the current release, its evidence and its limits, read [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md). To report a vulnerability, follow the [security policy](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/SECURITY.md).

## Develop and validate

- [Contribution guide](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CONTRIBUTING.md): requirements, source checks and pull requests.
- [React UI](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/ui/README.md): frontend development and upstream provenance.
- [Native build](BUILD.md) (French only): compile the gateway and plugin with compatible dependencies.
- [Packaging](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/packaging/README.md): package a verified pair into separate artifacts.
- [Deployment acceptance](ACCEPTANCE.md) (French only): checks for a target environment.
- [Release evidence](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/README.md) and [changelog](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CHANGELOG.md).

## Design and history

The [domain vocabulary](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CONTEXT.md), the [V1 release specification](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/core-v1-spec.md) and the [current product decisions](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/product-direction.md) capture the project's scope. Dated reviews, the archive and the reports are evidence of past checkpoints, not current installation instructions; they stay on GitHub and are not published here.
