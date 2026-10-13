# A key's total counts only what Bifrost confirms

A key can keep a provider's permissions in Bifrost, and that provider may allow models Bifrost does not list (disabled or undiscovered). Counting every configured route showed "5 models · Verified" while the readback listed 4 IDs (final critique of spec #85, issue #99). We count only the models the readback of that key confirms, one row per model with its subscriptions; a kept route missing from the readback is flagged and the check reads "Verified · 1 difference", never plain "Verified". "Verified" keeps its meaning from `docs/design/product-direction.md`: the catalogue observed for this key at that moment.

## Considered options

- **Count every configured route, kept-in-Bifrost ones included.** Rejected: "Verified" would vouch for a model nobody observed, against the decision of 23 September 2026 that Verified attests only the observed catalogue.
- **Count every configured route and annotate the missing ones.** Rejected: the headline number stays wrong, and the headline is what gets read.

## Consequences

- The key page total can be lower than the number of models the user configured, and than the editor's "selected" count. The page says why.
- A kept provider that Bifrost never lists (for example a disabled one) stays flagged as a difference for as long as Bifrost does not list it.
