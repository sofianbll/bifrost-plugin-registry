#!/usr/bin/env bash
# Fails when tracked paths differ only by case: a case-insensitive disk (macOS, Windows) checks such a pair out as one file.
# shortcut: folds ASCII case only (git quotes non-ASCII paths); upgrade when a tracked path is non-ASCII.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

dups=$(git ls-files | tr '[:upper:]' '[:lower:]' | sort | uniq -d)
if [ -n "$dups" ]; then
  echo "case collision: these tracked paths differ only by case; rename one of each pair:" >&2
  git ls-files | grep -ixFf <(printf '%s\n' "$dups") >&2
  exit 1
fi
