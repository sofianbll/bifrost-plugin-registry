"""Run the release workflow's real metadata step without network or publishing."""

import os
from pathlib import Path
import subprocess
import tempfile
import textwrap
import unittest


ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = (ROOT / ".github/workflows/release.yml").read_text()
META = textwrap.dedent(
    WORKFLOW.split("      - id: meta\n", 1)[1]
    .split("        run: |\n", 1)[1]
    .split("\n  qualify:\n", 1)[0]
)
# Only external read-only lookups are faked; unexpected commands fail closed.
LOOKUPS = """
gh() { [[ $1 == release && $2 == view ]] && return 1; exit 99; }
git() {
  case "$*" in
    'ls-remote --exit-code --tags origin refs/tags/'*) return 2 ;;
    'rev-parse HEAD') echo fixture-commit ;;
    *) exit 99 ;;
  esac
}
"""


class ReleaseMetadataTest(unittest.TestCase):
    def metadata(self, tag, override=""):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "output"
            result = subprocess.run(
                ["bash", "-e", "-o", "pipefail", "-c", LOOKUPS + META],
                cwd=ROOT,
                env={**os.environ, "TAG": tag, "PRERELEASE": override,
                     "GITHUB_REPOSITORY": "fixture/registry",
                     "GITHUB_REF": "refs/heads/main", "GITHUB_OUTPUT": str(output)},
                text=True, capture_output=True, check=False,
            )
            return result, output.read_text() if output.exists() else ""

    def test_classification(self):
        for tag, override, expected in [
            ("v1.2.3", "", "false"),
            ("v1.2.3", "false", "false"),
            ("v1.2.3", "true", "true"),
            ("v1.2.3-rc.1", "false", "true"),
            ("v1.2.3-pre.1", "", "true"),
            ("v1.2.3-alpha.1", "false", "true"),
            ("v1.2.3-beta.2", "", "true"),
            ("v1.2.3-bifrost2.2.6-rc.1", "true", "true"),
            ("v1.2.3-preview.1", "", "true"),
        ]:
            with self.subTest(tag=tag, override=override):
                result, output = self.metadata(tag, override)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"prerelease={expected}\n", output)
                self.assertIn(f"tag={tag}\n", output)

    def test_invalid_tags_emit_no_metadata(self):
        for tag in ["1.2.3", "v1.2", "v1.2.3-", "v1.2.3/beta", "v1.2.3\ninjected=true"]:
            with self.subTest(tag=tag):
                result, output = self.metadata(tag, "true")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("invalid release tag", result.stdout)
                self.assertEqual(output, "")


if __name__ == "__main__":
    unittest.main()
