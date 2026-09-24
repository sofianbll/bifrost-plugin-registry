# Security policy

## Report a vulnerability privately

Use [GitHub's private vulnerability reporting](https://github.com/sofianbll/bifrost-plugin-registry/security/advisories/new). Do not open a public issue containing an exploit, credentials, virtual-key hashes or production configuration.

Include the Registry version, Bifrost version, architecture, installation method, expected behavior and a minimal reproduction using synthetic data. Redact tokens, provider credentials, customer prompts and private host details.

Please reproduce against the current release candidate when possible. Older builds and untested gateway/plugin combinations are not assumed to contain current fixes. This independent project does not promise a response time or a bug bounty.

## Scope

Registry adds restrictions to Bifrost's native governance; it does not replace authentication, budgets or provider permissions. The plugin runs with the privileges of the Bifrost process. Keep its admin interface private, protect its persistent volume and verify artifact hashes.

See the [installation guide](docs/INSTALL.md), [trust-boundary documentation](docs/SECURITY.md) and [qualification evidence](reports/v1-final/README.md) for the tested scope and limitations. An upstream Bifrost issue may also need to be reported through [its security policy](https://github.com/maximhq/bifrost/security/policy).
