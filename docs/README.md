# Registry guides

English · [Français](fr/README.md)

Install Registry, choose models for an application, or find help with your gateway.

<a id="bifrost-registry-documentation"></a>
<a id="use-registry"></a>

## Get started

- [Install Registry](INSTALL.md) — Start a new test instance, install the plugin and connect its panel to Bifrost.
- [Choose models for an application](USER-GUIDE.md) — Prepare an existing key’s selection, publish it and read the result returned by Bifrost.

## Manage access

- [Register a model](USER-GUIDE.md#_1-register-a-model) — Create a model card with its call name and provider accesses.
- [Reuse a selection with a group](USER-GUIDE.md#_3-compose-groups-and-keys) — Share a model selection across several keys without configuring each one separately.
- [Adopt an existing key](USER-GUIDE.md#_3-compose-groups-and-keys) — Let Registry manage the model selection of a Bifrost key without widening its permissions.

## Operate and troubleshoot

- [Back up before changing versions](INSTALL.md#upgrade-and-rollback) — Find what to save with the gateway stopped and how to restore the image and data together.
- [Recover plugin activation](INSTALL.md#recover-activation-after-disabling) — Follow the procedure for your version after disabling the plugin.
- [Solve an installation problem](TROUBLESHOOTING.md) — Identify download, permission and plugin-loading errors.
- [Secure administration](SECURITY.md) — Check admin access, network exposure and the documented security limits.

## Reference

- [Look up configuration](CONFIGURATION.md) — Find the fields for model cards, groups, keys and the panel API.
- [Find compatible files and previous versions](INSTALL.md#which-files-for-which-host) — Match each plugin file to its host and Bifrost version.
- [Build the gateway and plugin (French)](BUILD.md) — Follow the French native build procedure for a matching pair.
- [Check the published release status](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md) — See which version is available, what was checked and what remains untested.

For the current release, its evidence and its limits, read [STATUS](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/STATUS.md). To report a vulnerability, follow the [security policy](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/SECURITY.md).

### Develop and validate

- [Contribution guide](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CONTRIBUTING.md): requirements, source checks and pull requests.
- [React UI](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/ui/README.md): frontend development and upstream provenance.
- [Native build](BUILD.md) (French only): compile the gateway and plugin with compatible dependencies.
- [Packaging](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/packaging/README.md): package a verified pair into separate artifacts.
- [Deployment acceptance](ACCEPTANCE.md) (French only): checks for a target environment.
- [Release evidence](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/reports/README.md) and [changelog](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CHANGELOG.md).

### Design and history

The [domain vocabulary](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/CONTEXT.md), the [V1 release specification](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/core-v1-spec.md) and the [current product decisions](https://github.com/sofianbll/bifrost-plugin-registry/blob/main/docs/design/product-direction.md) capture the project's scope. Dated reviews, the archive and the reports are evidence of past checkpoints, not current installation instructions; they stay on GitHub and are not published here.
