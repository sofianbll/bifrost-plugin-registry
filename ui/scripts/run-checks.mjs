// Runs every *.test.ts(x) under the given directory (default src) with `node --import tsx`,
// one at a time in sorted order, and stops at the first failure with that test's exit code.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "src";

const files = readdirSync(root, { recursive: true })
  .map(path => path.split("\\").join("/"))
  .filter(path => /\.test\.tsx?$/.test(path))
  .sort();

if (files.length === 0) {
  console.error(`no *.test.ts(x) files found under ${root}`);
  process.exit(1);
}

for (const file of files) {
  const path = join(root, file);
  console.log(`> ${path}`);
  const { status } = spawnSync(process.execPath, ["--import", "tsx", path], { stdio: "inherit" });
  if (status !== 0) {
    console.error(`FAILED (exit ${status ?? "signal"}): ${path}`);
    process.exit(status || 1);
  }
}
