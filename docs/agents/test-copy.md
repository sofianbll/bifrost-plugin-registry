# Test copy: trying a plugin build on a throwaway gateway

## What it is, and what it is not

The test copy is a throwaway copy of the production gateway. It runs as a docker compose project on the host alias `pulsar` (folder `~/build/bifrost-registry-test`, container `bifrost-registry-test`) on the Registry dynamic image. It mounts its plugin from `./plugins/bifrost-registry-dev.so` and keeps its data in `data/registry/registry.json`. Backups go to `~/Data/backups/cleanup-20261008/`.

It is not production. Production is the separate container `bifrost`, which no step below touches. `scripts/test-copy-install.sh` refuses any override that names it.

## Get the plugin to install

1. On the pull request, open the **Qualify** workflow run (it runs for pull requests that touch the gateway/plugin pair). It uploads the `pair-linux-amd64` artifact. Download it as in [the issue tracker notes](issue-tracker.md) (`gh api repos/{owner}/{repo}/actions/artifacts/<artifact-id>/zip > pair.zip`), unzip it into a new empty directory, then extract the tarball it holds into another new empty directory.
2. In that directory, run `shasum -a 256 -c SHA256SUMS`; both lines must say `OK`.
3. Read `registry_version` in `abi-smoke.json`: `dev-<12 hex digits>`. Those digits must be the start of the GitHub merge commit of the PR head (`git fetch origin pull/<number>/merge`, then `git rev-parse FETCH_HEAD`), and `git diff --name-only <PR head> <that merge commit>` must list 0 files. Otherwise the build is not the code under review.

## Install

```sh
scripts/test-copy-install.sh <dir with bifrost-registry.so and SHA256SUMS>           # dry run, changes nothing
BACKUP_LABEL=<label> scripts/test-copy-install.sh <same dir> --apply                 # label defaults to "install"
```

The dry run prints the exact plan. `--apply` changes the host, so run it only when the owner asked for the install. It checks the local checksum, backs up the mounted plugin and `registry.json` as `test-plugin.before-<label>-<UTC time>.so` and `test-registry.before-<label>-<UTC time>.json`, copies the new file next to the mounted one, compares its checksum on the host (stopping if it differs), swaps it in, runs `docker compose up -d --force-recreate` in the test copy's folder only, waits up to about 90 s for the container to be healthy, prints the `plugin status: bifrost-registry` log line and the rollback commands. It needs key-based ssh to `pulsar`; it never prompts.

## Open the panel and sign in

```sh
ssh -N -L 127.0.0.1:18099:127.0.0.1:8099 pulsar
```

Then open `http://127.0.0.1:18099/`. To sign in without printing the token, the owner runs this and pastes the result into the sign-in field:

```sh
ssh pulsar "grep '^REGISTRY_ADMIN_TOKEN=' <the test copy's private env file> | cut -d= -f2-" | pbcopy
```

An agent never reads, prints or types that token.

## Browser rules for critique sub-agents

The sign-in lives in the memory of one browser tab. Reuse that tab: never open a new one, never reload it (the sign-in is lost), and stay read-only (look and read, do not save, create or change anything).

## Rollback

The install prints the rollback command at the end; it restores the backed-up plugin and `registry.json` and recreates the test copy. To run it later, copy the two backup file names from the install output or from `~/Data/backups/cleanup-20261008/`.

## The limit: this does not qualify production

A Go plugin must match the gateway binary that loads it. A `.so` built for the Registry dynamic image does not load into the Bifrost fork image that runs production. Installing on production means switching its image, which is the owner's decision and not part of this procedure. A pass on the test copy is not a production result.
