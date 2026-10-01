# Research: native multi-arch CI/CD to GHCR, upstream watcher, supply chain

Date of research: 2026-10-01. Every "checked" date below is 2026-10-01.
Scope: how to build the Bifrost gateway + `.so` plugin natively (Alpine/musl, amd64 and arm64, no cross-compilation, see `scripts/build-with-bifrost.sh`), publish one multi-arch image to GHCR, and detect new stable upstream releases.
Nothing here was run in a live workflow. Claims cite primary sources by ID ([S1] ...), listed in "Source index". Statements marked **Unconfirmed** could not be verified from primary sources.
Method note: GitHub docs pages were read as rendered HTML (a summarizer tool misreported `ubuntu-24.04-arm` as x64, so every table value was re-read from the raw page text). Action READMEs and source files were read at the tagged versions named in the text.

## Short answers

| # | Answer |
| --- | --- |
| 1 | Yes. Standard arm64 Linux runners are free and unlimited in public repos, 4 vCPU / 16 GB RAM / 14 GB SSD. Only plan-level concurrency, 6 h/job, 256 matrix jobs apply. |
| 2 | Per-arch native job pushes by digest, a merge job runs `docker buildx imagetools create`. For a prebuilt binary use a path context (or a named context), never the default Git context. |
| 3 | Do not use job-level `container:` with an Alpine image on arm64: the runner has no Alpine Node build for arm64, so every JS action fails. Run Alpine through Docker from the host runner instead. |
| 4 | Do not use `releases/latest` (it returns non-`transports` releases). List tags/releases, filter `transports/vX.Y.Z`, compare with `sort -V`. GITHUB_TOKEN limits: use one run (`workflow_call`), `workflow_dispatch`, or a GitHub App token. |
| 5 | New GHCR packages are private by default; workflow publishing with GITHUB_TOKEN auto-links the repo; making public is a one-way UI action. |
| 6 | Use `actions/attest@v4` (the other two attest actions are wrappers or deprecated), plus BuildKit SBOM for images. |
| 7 | Pin by full SHA with a `# vX.Y.Z` comment, add `.github/dependabot.yml` for `github-actions`. SHAs resolved today are in section 7. |

Repo state observed with read-only API GETs (2026-10-01): `sofianbll/bifrost-plugin-registry` is public, owned by a User account (not an org), `default_workflow_permissions=read`, `can_approve_pull_request_reviews=false` (GITHUB_TOKEN cannot create PRs), immutable releases not enabled. No `.github/dependabot.yml` and no pin file exist yet. I could not list existing GHCR packages (token lacks `read:packages`).

## 1. arm64 runners for public repos

Findings
- `ubuntu-24.04-arm`, `ubuntu-22.04-arm`, `ubuntu-26.04-arm`: Linux, arm64, 4 vCPU, 16 GB RAM, 14 GB SSD, for public repos. The same page says use of standard GitHub-hosted runners on public repos is "free and unlimited". [S1]
- Generally available since 2025-08-07 (Linux and Windows arm64, public repos, no cost). Public preview began 2025-01-16 and then warned of longer queue times at peak hours; the GA notice does not repeat that warning. [S2][S3]
- The GA notice says standard arm runners do not work in private repos (use arm64 larger runners). The current runners table lists `ubuntu-24.04-arm` with 2 vCPU under private repos, which contradicts it. [S2][S1] Irrelevant while the repo is public; **Unconfirmed** if the repo ever goes private.
- No arm-specific quota is documented. Limits are plan-level: concurrent jobs Free 20 / Pro 40 / Team 60 / Enterprise 500, 6 h per job, matrix max 256 jobs, workflow run 35 days, cache 10 GB per repo, GITHUB_TOKEN REST 1,000 requests/hour/repo, workflow file 500 KB. [S4]
- Public-repo usage is free for minutes; artifact/package storage allowances exist per plan (Free: 500 MB artifacts). Actions artifacts and GitHub Packages storage share one pooled allowance. [S5][S4] Container registry storage and bandwidth is currently free; GitHub Packages is free for public packages. [S41]
- Image `ubuntu-24.04-arm` (version 20260920.129.1) ships Docker 28.0.4, Buildx 0.37.1, Git 2.55.0, GitHub CLI 2.101.0, jq 1.7. [S7]
- Label hygiene: `ubuntu-latest` migrates to Ubuntu 26.04 between 2026-10-19 and 2026-11-19; pin explicit labels (existing `ci.yml` already uses `ubuntu-24.04`). Ubuntu 22.04 images begin deprecation 2026-09-17, so avoid `ubuntu-22.04-arm`. [S6][S7]

Unconfirmed: arm queue-time guarantees and whether the arm pool has capacity limits beyond plan concurrency; whether artifact storage quota is enforced for public repos.

## 2. One multi-arch manifest on GHCR from two native runners

Findings
- Docker's current docs recommend the reusable workflows in `docker/github-builder` (distributes one platform per runner, merges the manifest, signs attestations; default runner map `linux/arm64 -> ubuntu-24.04-arm`, others `ubuntu-24.04`). [S8][S10] The earlier manual pattern (matrix, push by digest, `imagetools create`) is no longer on that page; it was still there at docs commit `3ae207eee` (2026-02-05), and the github-builder docs were added 2026-03-16. [S9][S8]
- `docker/github-builder` `build.yml` takes `context` "in the Git working tree"; I found no input that injects files produced by an earlier job. It therefore fits only if the Alpine build itself lives in the Dockerfile. Its README documents registry identities for Docker Hub, ECR and Google Artifact Registry and a raw `registry-auths` secret; GHCR with GITHUB_TOKEN is not documented there. [S10] **Unconfirmed**: that GHCR works through `registry-auths`.
- Manual pattern (recommended for a prebuilt binary):
  1. Matrix `{amd64: ubuntu-24.04, arm64: ubuntu-24.04-arm}`; each job uses the platform equal to its runner (no QEMU step, so emulation cannot sneak in). [S9][S1]
  2. `docker/build-push-action` with `outputs: type=image,push-by-digest=true,name-canonical=true,push=true`, then write the `digest` output to a file and upload it. [S9][S11]
  3. A `merge` job downloads digests (`pattern: digests-*`, `merge-multiple: true`), logs in, runs `docker buildx imagetools create -t <tag>... <image>@sha256:<d1> <image>@sha256:<d2>`. Sources "must already exist in the registry". [S9][S14]
  4. `--metadata-file meta.json` writes the final index digest, which is the subject for the attestation (section 6). `--annotation "index:KEY=VALUE"` annotates the index. [S14]
- Feeding a prebuilt binary:
  - The default build context of `build-push-action` is a Git context; "any file mutation in the steps that precede the build step will be ignored". Use a path context (`context: ./ctx`, after `actions/checkout` and artifact download). [S11]
  - Alternative: a named context, `build-contexts: bin=./dist/linux-arm64` with `COPY --from=bin ...` in the Dockerfile. [S11][S12]
  - Prefer a small staged directory (Dockerfile, `main`, `docker-entrypoint.sh`, `licenses/`) as context. `packaging/Dockerfile` already expects exactly those files.
  - `actions/upload-artifact` zips and loses permissions (dirs 755, files 644). Upload a `tar` with `archive: false` to keep the executable bit, or `chmod +x` in the Dockerfile. Artifact names must be unique per run (v4+ artifacts are immutable), so name by arch. [S16]
  - Build the binary to a local output without a job container: a Dockerfile builder stage plus `docker buildx build --target <stage> --output type=local,dest=out` extracts files natively on the runner (`platform-split` only matters with several `--platform`). [S13]
- Attestations travel through the merge: BuildKit adds provenance automatically for `build-push-action` (mode=max in public repos, mode=min private); SBOM is opt-in `sbom: true`. [S17] The buildx `imagetools create` source code carries attestation-manifest children from source indexes into the new index. [S15] **Unconfirmed** by a live run.
- Inference from [S17], not verified: a per-arch push by digest with BuildKit attestations on pushes an index (image + attestation manifest) per platform. If you want plain per-arch manifests set `provenance: false` and attest only the final index with `actions/attest`.
- GHCR tags/labels: `docker/metadata-action` lowercases image names and sets `org.opencontainers.image.source` from the repo. [S42]

Minimal shape (adapted from [S9] and [S14], not run; pin SHAs per section 7):
```yaml
- uses: docker/build-push-action@<sha> # v7.4.0
  id: build
  with:
    context: ./ctx
    platforms: linux/${{ matrix.arch }}   # equals the runner arch
    tags: ghcr.io/OWNER/IMAGE
    labels: ${{ steps.meta.outputs.labels }}
    outputs: type=image,push-by-digest=true,name-canonical=true,push=true
# merge job
- run: |
    docker buildx imagetools create --metadata-file meta.json \
      $(jq -cr '.tags | map("-t " + .) | join(" ")' <<< "$DOCKER_METADATA_OUTPUT_JSON") \
      --annotation "index:org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}" \
      $(printf 'ghcr.io/OWNER/IMAGE@sha256:%s ' *)
  working-directory: ${{ runner.temp }}/digests
```
Note: `$DOCKER_METADATA_OUTPUT_JSON` is set by the `docker/metadata-action` step in the same job. [S42]

## 3. Building inside Alpine/musl on a runner

Findings
- Job-level `container:` runs all steps in the image; `run:` steps default to `sh` not bash; `container.options` cannot use `--network` or `--entrypoint`; `container.credentials` is available for private registries (a GHCR image could use GITHUB_TOKEN). [S18]
- Blocking pitfall on arm64: when the job container is detected as Alpine, the runner swaps its bundled Node for `node20_alpine`/`node24_alpine` (a musl build from `actions/alpine_nodejs` [S22]). The runner's `externals.sh` downloads these only for the `linux-x64` package; the `linux-arm64` package has no Alpine Node. `CheckPlatformForAlpineContainer` then throws "JavaScript Actions in Alpine containers are only supported on x64 Linux runners. Detected Linux Arm64". The check runs when a JavaScript action starts, so `actions/checkout`, `upload-artifact`, `attest` and every other JS action fail; plain `run:` steps would not. [S19]
- This is still open: `actions/runner` PR #3665 ("support for running JavaScript actions on Alpine Linux arm64", opened 2025-01-17, last updated 2026-02-23) is unmerged, and issue #801 is open. [S20] Source read at `actions/runner` main, commit `34bcff3`, version file 2.337.0. Hosted runners may lag main by days. **Unconfirmed**: what runner version `ubuntu-24.04-arm` runs today.
- Even on x64, a bare Alpine container has no `git`; `actions/checkout` then falls back to the REST API when Git >= 2.18 is absent, so do not assume Git metadata in the tree (the build script's `git describe` may return nothing; pass `BIFROST_VERSION` explicitly). [S21]
- JS actions on current runners use Node 24 (Node 20 removed 2026-09-23); keep action pins on versions with `runs.using: node24` (checkout v7 does). [S23][S21]
- Recommended instead (all native, no `container:`): keep the job on the Ubuntu host so JS actions run there, and run the Alpine toolchain through Docker:
  - Option A (preferred): Dockerfile builder stage `FROM golang:1.27.1-alpine3.23` + `docker buildx build --target <artifacts> --output type=local,...`. No `--platform`, no QEMU; BuildKit picks the host arch. `golang:1.27.1-alpine3.23` and `-alpine3.24` exist for amd64 and arm64v8. [S13][S24]
  - Option B: `docker run --rm -v "$PWD":/work -w /work golang:1.27.1-alpine3.23 sh -c 'apk add ... && ./scripts/build-with-bifrost.sh ...'`. Operational notes (general Docker behaviour, not from a cited doc): the container runs as root and writes root-owned files into the workspace (use `--user` or `chown` before `upload-artifact`); install what the script header demands (bash, git, python3, npm, gcc, musl-dev) with `apk`.
  - Pin the Alpine minor. The floating `golang:1.27.1-alpine` tag currently resolves to alpine3.24. [S24] The repo's runtime base is `alpine:3.23.5`; upstream's own Dockerfile at `transports/v2.2.4` builds with `golang:1.27.0-alpine3.24` and runs on `alpine:3.23.5`. [S52] Go plugins require the exact same Go toolchain as the gateway; this project compiles both itself with 1.27.1. [S52]
- `scripts/build-with-bifrost.sh` already refuses cross-compilation (`GOOS/GOARCH` must equal host); keep that guard and also assert `uname -m` against the matrix arch in the job.

## 4. Scheduled upstream watcher

Detecting stable upstream releases (tested read-only on 2026-10-01):
- `GET /repos/maximhq/bifrost/releases/latest` returns `ent-v2.2.4-base`, not a `transports/` release. The API defines "latest" as the most recent non-prerelease, non-draft release by `created_at`. Do not use it. [S25][S26]
- The upstream monorepo publishes about 15 releases per version bump (`framework/`, `plugins/*`, `ent-*`, `transports/`). Of the 100 newest releases only 6 were `transports/` releases (2,197 releases total). `releases?per_page=100` therefore covers a few bumps only; paginating everything is wasteful. [S26]
- Stable tag shape: `transports/vX.Y.Z`. Prereleases look like `transports/v2.0.0-prerelease3` with `prerelease=true`. Upstream releases carry no assets (`transports/v2.2.4` had 0), so builds are from the source tag. [S26]
- Recommended: one `git ls-remote --tags --refs` call (no REST quota, about 1 s), filter with the stable regex, `sort -V`, then confirm with one REST call that the release exists and is not prerelease/draft (a tag can exist before its release is published). Record the tag and the commit SHA in the pin file, because Git tags can be moved and this repo already records commits. Tested pieces (output `v2.2.4`, newer than pin `v2.2.3`):
```bash
PIN=$(sed -n 's#^BIFROST_TAG=transports/##p' bifrost.pin)   # proposed pin file, e.g. v2.2.3
LATEST=$(git ls-remote --tags --refs https://github.com/maximhq/bifrost 'refs/tags/transports/v*' \
  | sed 's#.*refs/tags/transports/##' | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | sort -V | tail -1)
[ "$PIN" != "$LATEST" ] && [ "$(printf '%s\n%s\n' "$PIN" "$LATEST" | sort -V | tail -1)" = "$LATEST" ] || exit 0
gh api "repos/maximhq/bifrost/releases/tags/transports/$LATEST" \
  --jq 'select(.prerelease==false and .draft==false) | .tag_name'   # needs GH_TOKEN; prints nothing for prereleases
```
- Also compare upstream's Go version: the tag's `transports/Dockerfile` and `go.mod` decide the toolchain (v2.2.4 Dockerfile uses 1.27.0 while this project builds both sides with 1.27.1). A bump is not just a tag change. [S52]
- Schedule facts: runs only from the default branch's workflow file; can be delayed or dropped at the start of the hour (use an off-peak minute such as `23 */6 * * *`); minimum interval 5 min; in public repos scheduled workflows are disabled after 60 days without repository activity. [S30]

The GITHUB_TOKEN limitation
- Events caused by GITHUB_TOKEN do not create workflow runs, except `workflow_dispatch` and `repository_dispatch`. Since 2026-06-11, `pull_request` events (opened/synchronize/reopened) from a bot-created PR do create runs, but in an approval-required state that a user with write access must approve; other PR activity types and `push`/`release`/`labeled` events create none. [S27][S28]
- Creating the PR at all needs the repository setting "Allow GitHub Actions to create and approve pull requests" (currently off here). [S29]
- Recommended workarounds and trade-offs:

| Workaround | How | Trade-offs |
| --- | --- | --- |
| One run: `workflow_call` | Watcher job calls the build workflow with `uses: ./.github/workflows/build.yml` (called workflow runs inside the same run; permissions can only be kept or reduced; max 10 nesting levels; `secrets: inherit` available). [S31] | No extra secret, no event needed. Build runs without a PR; the pin-bump PR still needs separate CI. |
| `workflow_dispatch` | `gh workflow run build.yml -f bifrost_tag=...` with `permissions: actions: write`. REST needs "Actions: write". [S32][S35] | No new secret. Separate run, not a PR check. The workflow file must already exist on the default branch for the event to fire. [S30] |
| GitHub App token | `actions/create-github-app-token` (client-id variable, private key secret, 1 h token); events from it trigger workflows and PR checks run without approval. [S33][S27] | Create and maintain an App; one more secret to guard; cleanest for fully automatic PRs. |
| PAT | Secret holding a PAT, used for checkout/PR creation. [S27] | Tied to a person, broader scope, expiry; weakest option. |
- `peter-evans/create-pull-request` documents the same limitation and the same alternatives. [S34]
- Suggested for this repo (judgement, not a source claim): watcher uses GITHUB_TOKEN with `issues: write` to open one issue (matches `docs/agents/issue-tracker.md`) and `actions: write` to dispatch a build in "candidate" mode (no publish). A human opens the pin-bump PR from the build's result; use an App only if full automation of the PR is wanted.

## 5. GHCR specifics

- Default visibility on first publish is private. [S36][S37]
- Publishing from a workflow with `secrets.GITHUB_TOKEN` links the repo automatically ("the repository that contains the workflow is linked automatically"). A command-line push is not linked, even if the name matches the repo. If a package already exists in the same namespace without a repo link, GITHUB_TOKEN may lack permission to push to it. [S36]
- Add `org.opencontainers.image.source=https://github.com/OWNER/REPO` (Dockerfile `LABEL` or metadata-action labels) so the link exists at first publish; this also lets the package inherit repo access permissions (access, not visibility). [S36][S37][S38] A package linked only afterwards from the settings page keeps its own permissions unless inheritance is selected. [S37]
- Multi-arch: package-page description/metadata for an index come from the index `annotations`; docs only show the `description` key (`annotation-index.org.opencontainers.image.description`). Set `source`, `description`, `licenses` both as image labels (per-arch) and as `--annotation index:...`. [S36][S14] **Unconfirmed**: that GHCR reads `source` for linking from the index annotation.
- Permissions: job needs `packages: write` (plus `contents: read`); `docker/login-action` with `registry: ghcr.io`, `username: ${{ github.actor }}`, `password: ${{ secrets.GITHUB_TOKEN }}`. Declaring any permission sets all unspecified ones to none, so list each explicitly. [S35][S40][S42] A new personal-account repo defaults GITHUB_TOKEN to read for contents/packages. [S29]
- Make public: UI only (package page, Package settings, Danger Zone, Change visibility). The Packages REST API has list/get/delete/restore endpoints, no visibility endpoint. "Once you make a package public, you cannot make it private again." [S37][S39] Public packages are free; container registry storage and bandwidth are currently free. [S41]
- GitHub-hosted runners are not subject to Docker Hub pull rate limits. [S18]

## 6. Supply chain: provenance and SBOM

- Use `actions/attest@v4`. `actions/attest-build-provenance` v4 is a wrapper and new work should use `actions/attest`; `actions/attest-sbom` is deprecated for the same reason. GitHub's own docs use `actions/attest@v4`. [S43][S40][S44]
- Modes of `actions/attest`: provenance (default), SBOM (`sbom-path`, SPDX or CycloneDX JSON, max 16 MB), custom predicate. Subjects: `subject-path` (glob), `subject-digest` + `subject-name`, or `subject-checksums` (shasum-format file). [S43]
- Permissions: `id-token: write`, `attestations: write`, `contents: read`; add `packages: write` for images. The v4.2.2 README also lists `artifact-metadata: write` (storage records, only for org-owned repos; `create-storage-record: false` skips). [S43][S44] This repo is User-owned: set `create-storage-record: false`. **Unconfirmed** whether omitting the permission fails the step.
- Container images: `subject-name: ghcr.io/OWNER/IMAGE` (no tag), `subject-digest:` the final index digest from `imagetools create --metadata-file` (not a per-arch digest), `push-to-registry: true`. [S43][S44][S14]
- Release assets (`.so`, gateway): the build script's `SHA256SUMS` already has the shasum layout (`hash  name`). Feed it to `subject-checksums`. Names must be unique per arch (for example `bifrost-registry-linux-arm64-musl.so`) before hashing. [S43]
- SBOM for release assets: generate SPDX/CycloneDX with Syft (`anchore/sbom-action`, which also uploads release assets by default via `upload-release-assets: true`) and attest with `sbom-path`. [S44][S51] **Unconfirmed**: that Syft lists the Go module set of a `-buildmode=plugin` `.so`.
- SBOM for images: BuildKit `sbom: true` on `build-push-action`; provenance is automatic (mode=max for public repos). Warning from Docker: mode=max provenance in public repos records build-arg values, so never pass secrets as build args. [S17][S51]
- Two layers exist for images: BuildKit attestations (stored beside the image in the index) and GitHub attestations (`push-to-registry`). They are different stores; choose which one consumers verify. Public-repo attestations are signed through Sigstore's public-good instance. [S43]
- Verification: `gh attestation verify <file> --repo OWNER/REPO` or `gh attestation verify oci://ghcr.io/OWNER/IMAGE@sha256:... --repo OWNER/REPO`. If a reusable workflow did the signing, also pass `--signer-workflow` or `--signer-repo`. [S45]
- Availability: public repos on all current plans; private/internal need Enterprise Cloud. [S43]
- Immutable releases (repo setting, not enabled): tag and assets locked after publish and a release attestation is generated; publish as draft, attach assets, then publish. Creating the release with GITHUB_TOKEN requires `contents: write`. A release created by GITHUB_TOKEN will not trigger an `on: release` workflow (see section 4), so publish images inside the same run. [S46][S35][S27]

## 7. Pinning actions by SHA, and keeping them current

- Full-length commit SHA is "the only way to use an action as an immutable release"; verify the SHA belongs to the action repo, not a fork. Repo and org policies can require SHA pinning. [S47] Existing `ci.yml` already pins checkout, setup-go, setup-node with `# vX.Y.Z` comments and `permissions: contents: read`; new workflows should do the same (explicit `permissions:` per workflow and job).
- Dependabot: add `package-ecosystem: "github-actions"`, `directory: "/"`, `schedule.interval`. It updates SHA pins and a same-line `# tag` comment; a pinned commit not tied to any tag is moved to the latest commit; local `./` references are ignored; reusable workflows are covered. [S48][S47]
```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```
- Dependabot applies a default 3-day cooldown to version updates (security updates exempt); GitHub Actions appears in the cooldown support table (marks not machine-readable in my extraction). `groups` exists to batch PRs. [S49]
- Dependabot runs on `pull_request` get a read-only GITHUB_TOKEN and no Actions secrets, so keep CI secret-free (current `ci.yml` is). Dependabot alerts are not created for SHA-pinned actions, so rely on version updates. [S50][S47]
- Latest releases and their commit SHAs, resolved via the GitHub API on 2026-10-01 (tag to commit, annotated tags dereferenced). Re-resolve before committing; Dependabot will take over afterwards:

| Action | Version | Commit SHA |
| --- | --- | --- |
| actions/checkout | v7.0.1 (matches ci.yml) | 3d3c42e5aac5ba805825da76410c181273ba90b1 |
| actions/setup-go | v7.0.0 (matches ci.yml) | b7ad1dad31e06c5925ef5d2fc7ad053ef454303e |
| actions/upload-artifact | v7.0.1 | 043fb46d1a93c77aae656e7c1c64a875d1fc6a0a |
| actions/download-artifact | v8.0.1 | 3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c |
| actions/attest | v4.2.2 | 1e69f48acb82d1966a394da916b4c1698aa569d6 |
| docker/setup-buildx-action | v4.4.1 | f87e5991a6d7451dcb8d9637bfbc97413f497069 |
| docker/login-action | v4.6.0 | dbcb813823bdd20940b903addbd779551569679f |
| docker/metadata-action | v6.2.0 | dc802804100637a589fabce1cb79ff13a1411302 |
| docker/build-push-action | v7.4.0 | c3c9e263c25d99ce0380d002d59b67737d91b0dc |
| actions/create-github-app-token (App route only) | v3.2.0 | bcd2ba49218906704ab6c1aa796996da409d3eb1 |
| anchore/sbom-action (SBOM route only) | v0.24.2 | 3ad7283483fc7af8ff2b4ea19663c2d5ca935e26 |
| docker/github-builder (option B only) | v1.17.0 | 58cb9f5b71b1836d6f690c1e95effdeb9b98cb8a |

## Source index

All checked 2026-10-01. "src:" gives the repository and ref a rendered page or file was read from.

| ID | Source |
| --- | --- |
| S1 | https://docs.github.com/en/actions/reference/runners/github-hosted-runners |
| S2 | https://github.blog/changelog/2025-08-07-arm64-hosted-runners-for-public-repositories-are-now-generally-available/ |
| S3 | https://github.blog/changelog/2025-01-16-linux-arm64-hosted-runners-now-available-for-free-in-public-repositories-public-preview/ |
| S4 | https://docs.github.com/en/actions/reference/limits |
| S5 | https://docs.github.com/en/billing/concepts/product-billing/github-actions |
| S6 | https://github.blog/changelog/2026-09-17-ubuntu-26-generally-available-and-latest-migration/ |
| S7 | https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Arm64-Readme.md |
| S8 | https://docs.docker.com/build/ci/github-actions/multi-platform/ (src: docker/docs main, commit e79ee7eb5) |
| S9 | https://github.com/docker/docs/blob/3ae207eee/content/manuals/build/ci/github-actions/multi-platform.md (manual digest/merge pattern, 2026-02) |
| S10 | https://docs.docker.com/build/ci/github-actions/github-builder/ and https://github.com/docker/github-builder/blob/v1.17.0/README.md |
| S11 | https://github.com/docker/build-push-action/blob/v7.4.0/README.md |
| S12 | https://docs.docker.com/build/concepts/context/ (named contexts) |
| S13 | https://docs.docker.com/build/exporters/local-tar/ |
| S14 | https://docs.docker.com/reference/cli/docker/buildx/imagetools/create/ (src: docker/buildx docs/reference/buildx_imagetools_create.md, master) |
| S15 | https://github.com/docker/buildx/blob/master/util/imagetools/create.go (attestation handling, buildx v0.37.2 latest) |
| S16 | https://github.com/actions/upload-artifact/blob/v7.0.1/README.md |
| S17 | https://docs.docker.com/build/ci/github-actions/attestations/ |
| S18 | https://docs.github.com/en/actions/how-tos/write-workflows/choose-where-workflows-run/run-jobs-in-a-container |
| S19 | https://github.com/actions/runner/blob/main/src/Runner.Worker/Handlers/StepHost.cs and src/Misc/externals.sh (commit 34bcff3, version 2.337.0) |
| S20 | https://github.com/actions/runner/pull/3665 and https://github.com/actions/runner/issues/801 |
| S21 | https://github.com/actions/checkout/blob/v7.0.1/README.md |
| S22 | https://github.com/actions/alpine_nodejs/blob/main/README.md (Alpine Node builds redistributed for the runner) |
| S23 | https://github.blog/changelog/2026-09-23-node-20-is-no-longer-available-in-github-actions/ |
| S24 | https://github.com/docker-library/official-images/blob/master/library/golang (tags 1.27.1-alpine3.23/3.24; amd64, arm64v8) |
| S25 | https://docs.github.com/en/rest/releases/releases |
| S26 | Upstream release data read with `gh api repos/maximhq/bifrost/releases...` and `git ls-remote --tags` (github.com/maximhq/bifrost) |
| S27 | https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow and https://docs.github.com/en/actions/concepts/security/github_token |
| S28 | https://github.blog/changelog/2026-06-11-bot-created-pull-requests-can-run-workflows-if-approved/ |
| S29 | https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository |
| S30 | https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows (schedule) |
| S31 | https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows |
| S32 | https://docs.github.com/en/rest/actions/workflows (create a workflow dispatch event) |
| S33 | https://github.com/actions/create-github-app-token/blob/v3.2.0/README.md |
| S34 | https://github.com/peter-evans/create-pull-request/blob/main/docs/concepts-guidelines.md |
| S35 | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax (permissions) |
| S36 | https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry |
| S37 | https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility |
| S38 | https://docs.github.com/en/packages/learn-github-packages/connecting-a-repository-to-a-package |
| S39 | https://docs.github.com/en/rest/packages/packages |
| S40 | https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images |
| S41 | https://docs.github.com/en/billing/concepts/product-billing/github-packages |
| S42 | https://github.com/docker/login-action/blob/v4.6.0/README.md and https://github.com/docker/metadata-action/blob/v6.2.0/README.md |
| S43 | https://github.com/actions/attest/blob/v4.2.2/README.md, https://github.com/actions/attest-build-provenance/blob/v4.2.2/README.md, https://github.com/actions/attest-sbom/blob/v4.1.0/README.md |
| S44 | https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations |
| S45 | https://github.com/cli/cli/blob/trunk/pkg/cmd/attestation/verify/verify.go (`gh attestation verify` help text) |
| S46 | https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases |
| S47 | https://docs.github.com/en/actions/reference/security/secure-use |
| S48 | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/keeping-your-actions-up-to-date-with-dependabot |
| S49 | https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference |
| S50 | https://docs.github.com/en/code-security/dependabot/troubleshooting-dependabot/troubleshooting-dependabot-on-github-actions |
| S51 | https://docs.docker.com/build/metadata/attestations/sbom/ and https://github.com/anchore/sbom-action/blob/v0.24.2/README.md |
| S52 | https://github.com/maximhq/bifrost/blob/transports/v2.2.4/transports/Dockerfile and https://docs.getbifrost.ai/plugins/building-dynamic-binary |

## Recommended workflow layout

Proposed files (none created by this research):
1. `.github/dependabot.yml`: `github-actions`, weekly. Add SHA-pinned actions with `# vX.Y.Z` comments everywhere, explicit per-job `permissions`.
2. `bifrost.pin`: `BIFROST_TAG=transports/vX.Y.Z`, upstream commit SHA, Go version (derived from upstream, not assumed).
3. `.github/workflows/upstream-watch.yml`: `schedule` (off-peak minute) + `workflow_dispatch`; `contents: read`, `issues: write`, `actions: write`. Runs the section 4 script, opens or updates one issue, then dispatches `build-native.yml` with `publish=false`.
4. `.github/workflows/build-native.yml`: `on: workflow_call` + `workflow_dispatch` (inputs: `bifrost_tag`, `publish`).
5. Job `build` (matrix `amd64: ubuntu-24.04`, `arm64: ubuntu-24.04-arm`, `contents: read` only): checkout this repo and upstream at the pinned SHA, run the Alpine build via `docker buildx build --output type=local` (builder `golang:1.27.1-alpine3.23`), assert host arch, tar and upload one artifact per arch.
6. Job `image` (matrix, `contents: read`, `packages: write`): download artifact, stage `./ctx`, login to GHCR, build-push by digest with a path context, upload the digest file. No third-party code is compiled in this job.
7. Job `merge` (`packages: write`, `id-token: write`, `attestations: write`): `imagetools create` with tags and index annotations, `--metadata-file`, then `actions/attest` on the index digest with `push-to-registry: true`.
8. Job `release` (only if `publish`; `contents: write`, `id-token: write`, `attestations: write`): rename assets per arch, produce `SHA256SUMS` and SPDX SBOMs, `actions/attest` with `subject-checksums`, create the release as draft, upload, publish.
9. Keep `ci.yml` as the source-only gate; the native build workflow stays a separate qualification path, as `AGENTS.md` requires.
10. Do everything in one run so no second workflow depends on a GITHUB_TOKEN-triggered event; use an App token only if automatic pin-bump PRs with CI are wanted.
11. First run: merge the workflow to `main` (a `workflow_dispatch` workflow must exist on the default branch), dispatch with `publish=false`, compare both arch outputs, then enable publishing.

## Unconfirmed / risks

- No live run: every pattern is doc/source-based. A dry run is required before trusting it, especially the GHCR push, the `imagetools create` merge and the attestations.
- Alpine-on-arm64 runner limitation is read from `actions/runner` main source and an open PR, not from a GitHub doc page; the hosted runner version in use today is unknown.
- `docker/github-builder` with GHCR and with an externally built binary is not documented; treated as unsuitable for the prebuilt-binary flow.
- Whether attestation manifests survive `imagetools create` was inferred from buildx source, not tested; per-arch provenance can be disabled to avoid ambiguity.
- GHCR: index-level `source` annotation linking, and push permission when a package already exists unlinked in the `sofianbll` namespace, are unconfirmed (I could not list packages).
- `actions/attest` v4.2.2 `artifact-metadata: write` behaviour on a User-owned repo is unconfirmed.
- Repo settings currently block GITHUB_TOKEN PR creation and immutable releases are off; changing either is a user decision (not touched here).
- Public-repo attestations go to Sigstore's public-good log, publishing workflow identity.
- Mixed Go versions: upstream's own image build uses Go 1.27.0 at `transports/v2.2.4` while this project builds gateway and plugin with 1.27.1; a watcher that only bumps the tag can produce an unqualified pair.
- arm64 standard runners in private repos: docs conflict (changelog says unsupported, runners table lists 2 vCPU). Irrelevant while public.
- Dependabot cooldown support for `github-actions` is inferred from a table whose marks I could not read.
- Scheduled workflow is disabled after 60 days of no repo activity; the watcher needs monitoring or an occasional manual run.
- Third-party actions (`docker/*`, `anchore/*`, `peter-evans/*`) are not GitHub-certified; SHA pins and review of each bump apply.
