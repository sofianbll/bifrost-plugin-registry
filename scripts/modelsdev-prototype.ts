// Models.dev source and core generator: MIT, Copyright (c) 2025 models.dev.
// License notice: ui/src/experiments/model-card-prototype/README.md.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const upstream = path.join(root, "dist/models-dev-upstream");
const commit = "6a0b12bc9c66e1ab4fe44232d592a32df09a77e0";
const modelId = "anthropic/claude-sonnet-4-6";
const modelPath = `models/${modelId}.toml`;
const offers = [
  { providerId: "openrouter", modelId: "anthropic/claude-sonnet-4.6" },
  { providerId: "amazon-bedrock", modelId: "us.anthropic.claude-sonnet-4-6" },
];
const output = path.join(root, "ui/src/experiments/model-card-prototype/catalog.json");

assert.equal(execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), commit);
assert.ok(existsSync(path.join(upstream, modelPath)), `Missing ${modelPath}`);
const input = mkdtempSync(path.join(tmpdir(), "modelsdev-registry-"));

try {
  function include(sourcePath: string) {
    const source = path.join(upstream, sourcePath);
    assert.ok(existsSync(source), `Missing ${sourcePath}`);
    const destination = path.join(input, sourcePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }

  include(modelPath);
  for (const { providerId, modelId } of offers) {
    include(`providers/${providerId}/provider.toml`);
    include(`providers/${providerId}/models/${modelId}.toml`);
  }

  // Use upstream validation, inheritance, omission, and cost normalization.
  const { generateCatalog } = await import("../dist/models-dev-upstream/packages/core/src/generate.ts");
  const catalog = await generateCatalog(input);
  const metadata = catalog.models[modelId];
  assert.ok(metadata, `Missing generated ${modelId}`);

  const accesses = await Promise.all(offers.map(async ({ providerId, modelId: providerModelId }) => {
    const sourcePath = `providers/${providerId}/models/${providerModelId}.toml`;
    const authored = Bun.TOML.parse(await Bun.file(path.join(upstream, sourcePath)).text());
    const baseModelId = authored.base_model;
    assert.equal(authored.base_model_omit, undefined, "The editing experiment only covers inheritance without omissions");
    assert.equal(baseModelId, modelId, `Unexpected base_model in ${sourcePath}`);
    assert.ok(existsSync(path.join(upstream, `models/${baseModelId}.toml`)), `Unresolved ${baseModelId}`);
    const provider = catalog.providers[providerId];
    const resolved = provider?.models[providerModelId];
    assert.ok(provider && resolved, `Missing generated ${providerId}/${providerModelId}`);
    assert.equal(resolved.id, providerModelId);
    return {
      id: `${providerId}/${providerModelId}`,
      providerId,
      providerName: provider.name,
      modelId: providerModelId,
      baseModelId,
      authored,
      resolved,
      sourcePath,
    };
  }));

  assert.equal(accesses.length, 2);
  for (const access of accesses) {
    assert.equal(access.resolved.limit.context, metadata.limit.context);
    assert.equal(access.resolved.limit.output, 128000);
    assert.deepEqual(access.resolved.modalities, metadata.modalities);
    assert.equal(Object.hasOwn(access.resolved, "base_model"), false);
  }
  assert.equal(accesses[0].resolved.cost?.input, 3);
  assert.equal(accesses[1].resolved.cost?.input, 3.3);

  const result = {
    source: { repository: "https://github.com/anomalyco/models.dev", commit },
    model: { id: modelId, metadata, sourcePath: modelPath },
    accesses,
  };
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(output);
} finally {
  rmSync(input, { recursive: true, force: true });
}
