// Models.dev core is MIT, Copyright (c) 2025 models.dev.
// Generate a deterministic, source-preserving catalogue snapshot from the pinned checkout.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const upstream = path.join(root, "dist/models-dev-upstream");
const commit = "6a0b12bc9c66e1ab4fe44232d592a32df09a77e0";
const output = path.resolve(process.argv[2] ?? path.join(root, "dist/checks/modelsdev/snapshot.json"));

assert.equal(execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), commit, "Unexpected Models.dev checkout revision");
assert.equal(execFileSync("git", ["-C", upstream, "status", "--porcelain", "--untracked-files=all", "--", "models", "providers", "packages/core"], { encoding: "utf8" }).trim(), "", "Models.dev source or core has local changes");

type Row = Record<string, any>;
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const parseToml = (relative: string): Row => {
  const file = path.join(upstream, relative);
  assert.ok(existsSync(file), `Missing upstream source ${relative}`);
  return Bun.TOML.parse(readFileSync(file, "utf8")) as Row;
};
const sourceAt = execFileSync("git", ["-C", upstream, "show", "-s", "--format=%cI", commit], { encoding: "utf8" }).trim();
const { generateCatalog } = await import("../dist/models-dev-upstream/packages/core/src/generate.ts");
const generated = await generateCatalog(upstream);
const models: Row = {};
const providers: Row = {};

for (const id of Object.keys(generated.models).sort()) {
  const sourcePath = `models/${id}.toml`;
  models[id] = { sourcePath, authored: parseToml(sourcePath), resolved: generated.models[id] };
}
for (const id of Object.keys(generated.providers).sort()) {
  const sourcePath = `providers/${id}/provider.toml`;
  const provider = generated.providers[id];
  const entries: Row = {};
  for (const modelId of Object.keys(provider.models).sort()) {
    const modelPath = `providers/${id}/models/${modelId}.toml`;
    entries[modelId] = { sourcePath: modelPath, authored: parseToml(modelPath), resolved: provider.models[modelId] };
  }
  providers[id] = { sourcePath, authored: parseToml(sourcePath), resolved: { ...provider, models: undefined }, models: entries };
}

const snapshot = stable({ schemaVersion: 1, source: { repository: "https://github.com/anomalyco/models.dev", commit, sourceAt }, models, providers });
const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
mkdirSync(path.dirname(output), { recursive: true });
const data = output.endsWith(".gz") ? gzipSync(serialized, { level: 9, mtime: 0 }) : Buffer.from(serialized);
writeFileSync(output, data);
console.log(JSON.stringify({ output, bytes: data.byteLength, models: Object.keys(models).length, providers: Object.keys(providers).length, offers: Object.values(providers).reduce((sum: number, provider: any) => sum + Object.keys(provider.models).length, 0), commit, sourceAt }));
