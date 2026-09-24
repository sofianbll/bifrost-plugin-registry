#!/usr/bin/env python3
"""Apply the Bifrost 2.2.2 registry UI patch to an exact upstream checkout."""

import subprocess
import sys
from pathlib import Path

EXPECTED = "fdeef8e3f31a3b18a61666ba49247d07bae3600a"
FILES = (
    "transports/bifrost-http/server/server.go",
    "transports/bifrost-http/server/registry_ui.go",
    "transports/bifrost-http/server/registry_ui_test.go",
    "ui/components/sidebar.tsx",
)
PATCH = Path(__file__).resolve().parents[1] / "integration/bifrost-ui.patch"


def git(checkout: Path, *args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(("git", "-C", str(checkout), *args), text=True, capture_output=True)


def main() -> int:
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} /path/to/bifrost-2.2.2", file=sys.stderr)
        return 2
    checkout = Path(sys.argv[1]).resolve()
    revision = git(checkout, "rev-parse", "HEAD")
    if revision.returncode or revision.stdout.strip() != EXPECTED:
        print(f"unsupported Bifrost revision: {revision.stdout.strip() or revision.stderr.strip()}", file=sys.stderr)
        return 1
    if git(checkout, "apply", "--reverse", "--check", str(PATCH)).returncode == 0:
        print("Registry UI patch already applied")
        return 0
    dirty = git(checkout, "status", "--porcelain", "--", *FILES)
    if dirty.returncode or dirty.stdout:
        print("patch targets have local changes; refusing to overwrite them", file=sys.stderr)
        return 1
    check = git(checkout, "apply", "--check", str(PATCH))
    if check.returncode:
        print(check.stderr, file=sys.stderr)
        return 1
    applied = git(checkout, "apply", str(PATCH))
    if applied.returncode:
        print(applied.stderr, file=sys.stderr)
        return 1
    print("Registry UI patch applied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
