import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const dir = mkdtempSync(path.join(tmpdir(), "registry-review-test-"));
try {
  const input = path.join(dir, "raw.json");
  const output = path.join(dir, "config.json");
  writeFileSync(input, JSON.stringify({
    capturedAt: "2026-09-25T12:00:00Z", source: "Pulsar", providers: [{ name: "Custom", keys: [{ aliases: { "anthropic/claude-sonnet-4.6": { canonical_name: "openai/gpt-5" } } }] }], errors: [],
    models: [
      { provider: "openrouter", name: "anthropic/claude-sonnet-4.6", accessible_by_keys: ["k"] },
      { provider: "amazon-bedrock", name: "us.anthropic.claude-sonnet-4-6", accessible_by_keys: ["k"] },
      { provider: "Custom", name: "unknown-variant", accessible_by_keys: ["k"] },
      { provider: "Custom", name: "anthropic/claude-sonnet-4.6", accessible_by_keys: ["k"] },
    ],
    pricing: [
      { provider: "openrouter", base_model: "anthropic/claude-sonnet-4.6", model: "anthropic/claude-sonnet-4.6-latest", input_cost_per_token: 0.000005 },
      { provider: "openrouter", base_model: "anthropic/claude-sonnet-4.6", model: "anthropic/claude-sonnet-4.6", input_cost_per_token: 0.000002 },
    ], parameters: [],
  }));
  execFileSync("bun", [path.join(root, "scripts/build-review-catalog.ts"), input, output]);
  execFileSync("go", ["run", "./cmd/registry", "validate", "--config", output], { cwd: root });
  const config = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(config.catalog.accesses.length, 4);
  assert.equal(config.catalog.accesses.filter((x: any) => x.referenceId === "anthropic/claude-sonnet-4-6").length, 2);
  assert.equal(config.catalog.accesses.find((x: any) => x.model === "unknown-variant").referenceId, undefined);
  assert.match(config.catalog.accesses.find((x: any) => x.model === "unknown-variant").matchConflict, /No exact/);
  assert.match(config.catalog.accesses.find((x: any) => x.provider === "Custom" && x.model === "anthropic\/claude-sonnet-4.6").matchConflict, /Ambiguous/);
  assert.equal(config.catalog.accesses.find((x: any) => x.provider === "amazon-bedrock").candidates.input_cost_usd_per_million["models.dev"], 3.3);
  assert.equal(config.catalog.accesses.find((x: any) => x.provider === "openrouter").candidates.input_cost_usd_per_million.bifrost, 2);
  assert.equal(config.catalog.references.find((x: any) => x.id === "anthropic/claude-sonnet-4-6").candidates.creator["models.dev"], "Anthropic");
  assert.equal(config.catalog.references.find((x: any) => x.id === "openai/gpt-5").candidates.creator["models.dev"], "OpenAI");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
