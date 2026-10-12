// Self-check of run-checks.mjs: it passes passing tests and fails, with the test's exit code, on a failing one.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./run-checks.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "run-checks-"));
const run = (root = dir) => spawnSync(process.execPath, [runner, root], { encoding: "utf8" });

try {
  writeFileSync(join(dir, "a-pass.test.ts"), "process.exit(0)");
  assert.equal(run().status, 0, "a passing test must pass");

  writeFileSync(join(dir, "b-fail.test.ts"), "process.exit(3)");
  writeFileSync(join(dir, "c-after.test.ts"), "process.exit(0)");
  const failed = run();
  assert.equal(failed.status, 3, "a failing test must fail with its exit code");
  assert.match(failed.stderr, /b-fail\.test\.ts/, "the failure must name the file");
  assert.doesNotMatch(failed.stdout, /c-after/, "nothing may run after the first failure");

  mkdirSync(join(dir, "empty"));
  assert.notEqual(run(join(dir, "empty")).status, 0, "a directory with no tests must fail");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log("run-checks self-check ok");
