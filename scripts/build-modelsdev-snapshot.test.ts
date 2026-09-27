import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const root = path.resolve(import.meta.dir, "..");
const dir = mkdtempSync(path.join(tmpdir(), "modelsdev-snapshot-test-"));
try {
  const outputs = [path.join(dir, "first.json"), path.join(dir, "second.json"), path.join(dir, "first.json.gz"), path.join(dir, "second.json.gz")];
  for (const output of outputs) execFileSync("bun", [path.join(root, "scripts/build-modelsdev-snapshot.ts"), output], { cwd: root });
  const first = readFileSync(outputs[0], "utf8");
  assert.equal(first, readFileSync(outputs[1], "utf8"), "Snapshot output must be deterministic");
  assert.deepEqual(readFileSync(outputs[2]), readFileSync(outputs[3]), "Compressed snapshot must be deterministic");
  assert.equal(gunzipSync(readFileSync(outputs[2])).toString("utf8"), first);
  const snapshot = JSON.parse(first);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.source.commit, "6a0b12bc9c66e1ab4fe44232d592a32df09a77e0");
  assert.ok(snapshot.models["anthropic/claude-sonnet-4-6"]);
  const openrouter = snapshot.providers.openrouter.models["anthropic/claude-sonnet-4.6"];
  const bedrock = snapshot.providers["amazon-bedrock"].models["us.anthropic.claude-sonnet-4-6"];
  assert.equal(openrouter.authored.base_model, "anthropic/claude-sonnet-4-6");
  assert.equal(openrouter.resolved.base_model, undefined);
  assert.equal(bedrock.authored.base_model, "anthropic/claude-sonnet-4-6");
  assert.equal(openrouter.resolved.cost.input, 3);
  assert.equal(openrouter.resolved.cost.context_over_200k.input, 6);
  assert.equal(bedrock.resolved.cost.input, 3.3);

  const omitted = snapshot.providers.ambient.models["stepfun/step-3.7-flash"];
  assert.deepEqual(omitted.authored.base_model_omit, ["limit.input"]);
  assert.equal(Object.hasOwn(omitted.resolved.limit, "input"), false);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
