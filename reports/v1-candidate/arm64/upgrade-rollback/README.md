# Local ARM64 upgrade and rollback proof

[The report](report.json) passes 26/26 checks on `bifrost-dynamic:2.2.2-go1.27.1-arm64` (image ID `sha256:bfa3053c0da925685f71aabcacdde92bf9bc898b120d6ea2b69c90fa7a77a5b7`). It installs the prior paired `.so` from `/previous.so`, saves a model and group, and backs up the entire stopped `/app/data` volume, including SQLite and its WAL files. With the gateway stopped, it changes only the saved plugin URL to `/plugin.so`; a restarted gateway downloads the candidate `.so`, retains the group, and exposes the new catalogue API. After another stop, the probe restores the full backup. The prior URL and exact prior `.so` hash are downloaded again, and the group and legacy API shape return. All disposable Docker objects were removed; no inference was sent.

```bash
python3 integration/image_distribution_probe.py \
  --image bifrost-dynamic:2.2.2-go1.27.1-arm64 \
  --plugin dist/v1-candidate-arm64/bifrost-registry.so \
  --previous-plugin dist/standalone-v1/bifrost-registry.so \
  --out reports/v1-candidate/arm64/upgrade-rollback-new
```

This qualifies a backup-and-restore rollback of a disposable local ARM64 volume. It does not establish that the prior plugin can read a registry file after the candidate has migrated it, or that plugin replacement works without a gateway restart. The current candidate hashes are recorded in the report; rebuilds require a new proof.
