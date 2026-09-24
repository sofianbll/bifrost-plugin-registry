#!/usr/bin/env bash
set -euo pipefail

[[ $# == 1 ]] || { echo "usage: $0 /path/to/bifrost-checkout" >&2; exit 2; }
source_dir=$(cd "$1" && pwd)
script_dir=$(cd "$(dirname "$0")" && pwd)
expected=fdeef8e3f31a3b18a61666ba49247d07bae3600a
[[ $(git -C "$source_dir" rev-parse HEAD) == "$expected" ]] || { echo "Bifrost source must be pinned to $expected" >&2; exit 1; }
git -C "$source_dir" apply --check "$script_dir/bifrost-native-plugin-ui.patch"
git -C "$source_dir" apply "$script_dir/bifrost-native-plugin-ui.patch"
echo "Applied native plugin UI patch to $source_dir"
