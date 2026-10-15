#!/usr/bin/env bash
# Exercise the real packaging entrypoint before any qualified binary pair is needed.
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/registry/scripts" "$TMP/registry/ui/node_modules" "$TMP/source/transports" "$TMP/pair"
cp "$ROOT/scripts/package-release.sh" "$TMP/registry/scripts/"
git init -q "$TMP/registry"
git init -q "$TMP/source"
printf 'entrypoint\n' > "$TMP/source/transports/docker-entrypoint.sh"
printf 'license\n' > "$TMP/source/LICENSE"
printf 'notices\n' > "$TMP/source/THIRD_PARTY_NOTICES.md"
git -C "$TMP/source" add .
git -C "$TMP/source" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm 'Pinned upstream fixture'
COMMIT=$(git -C "$TMP/source" rev-parse HEAD)
printf 'BIFROST_COMMIT=%s\nBIFROST_TAG=fixture\nGO_VERSION=1.27.1\n' "$COMMIT" > "$TMP/registry/bifrost.pin"

expect_failure() {
  local message=$1
  if PAIR_DIR="$TMP/pair" SOURCE_DIR="$TMP/source" REGISTRY_SOURCE_COMMIT=fixture \
    bash "$TMP/registry/scripts/package-release.sh" fixture "$TMP/out" > "$TMP/log" 2>&1; then
    echo 'Unqualified inputs were accepted' >&2
    exit 1
  fi
  if ! grep -Fq "$message" "$TMP/log"; then
    cat "$TMP/log" >&2
    echo "Expected: $message" >&2
    exit 1
  fi
  test ! -e "$TMP/out"
}

for path in transports/docker-entrypoint.sh LICENSE THIRD_PARTY_NOTICES.md; do
  printf 'modified bytes\n' >> "$TMP/source/$path"
  expect_failure "upstream input differs from pinned commit: $path"
  git -C "$TMP/source" show "$COMMIT:$path" > "$TMP/source/$path"
done

# Matching source passes the source guard, but still cannot bypass pair validation.
expect_failure "missing or linked input: $TMP/pair/bifrost-http"

mv "$TMP/source/LICENSE" "$TMP/license"
ln -s "$TMP/license" "$TMP/source/LICENSE"
expect_failure "missing or linked input: $TMP/source/LICENSE"
rm "$TMP/source/LICENSE"
expect_failure "missing or linked input: $TMP/source/LICENSE"
mv "$TMP/license" "$TMP/source/LICENSE"

git -C "$TMP/source" -c user.name=Fixture -c user.email=fixture@example.invalid commit --allow-empty -qm 'Another upstream commit'
expect_failure 'SOURCE_DIR is not at pinned upstream commit:'

git -C "$TMP/source" rm -q THIRD_PARTY_NOTICES.md
git -C "$TMP/source" -c user.name=Fixture -c user.email=fixture@example.invalid commit -qm 'Missing upstream blob'
git -C "$TMP/source" show "$COMMIT:THIRD_PARTY_NOTICES.md" > "$TMP/source/THIRD_PARTY_NOTICES.md"
printf 'BIFROST_COMMIT=%s\n' "$(git -C "$TMP/source" rev-parse HEAD)" > "$TMP/registry/bifrost.pin"
expect_failure 'pinned upstream blob unavailable: THIRD_PARTY_NOTICES.md'

printf 'BIFROST_COMMIT=0000000000000000000000000000000000000000\n' > "$TMP/registry/bifrost.pin"
expect_failure 'pinned upstream commit unavailable in SOURCE_DIR:'

mv "$TMP/source/.git" "$TMP/source-git"
expect_failure 'pinned upstream commit unavailable in SOURCE_DIR:'
echo 'Package provenance checks passed'
