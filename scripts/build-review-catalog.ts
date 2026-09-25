// Offline review snapshot. Models.dev core: MIT, Copyright (c) 2025 models.dev.
// Run with Bun; the pinned upstream checkout stays under ignored dist/.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const upstream = path.join(root, "dist/models-dev-upstream");
const commit = "6a0b12bc9c66e1ab4fe44232d592a32df09a77e0";
const [inputArg = "dist/pulsar-review/raw.json", outputArg = "dist/pulsar-review/review-catalog.json"] = process.argv.slice(2);
const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
assert.notEqual(inputPath, outputPath, "Output must differ from input");
assert.ok(!existsSync(outputPath), `Refusing to overwrite ${outputPath}`);
assert.equal(execFileSync("git", ["-C", upstream, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), commit);

type Row = Record<string, any>;
const raw: Row = JSON.parse(readFileSync(inputPath, "utf8"));
assert.ok(typeof raw.source === "string" && raw.source.startsWith("Pulsar"), "Pulsar capture required");
assert.ok(!Number.isNaN(Date.parse(raw.capturedAt)), "Valid capturedAt required");
assert.ok(Array.isArray(raw.models) && Array.isArray(raw.providers));
assert.ok(Array.isArray(raw.errors) && raw.errors.every((x: unknown) => typeof x === "string"), "Invalid capture errors");
const at = new Date(raw.capturedAt).toISOString();
const upstreamAt = execFileSync("git", ["-C", upstream, "show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" }).trim();
// Mirrors the pinned Models.dev web labName() display names, not serving-provider names.
const labOverrides: Record<string, string> = { alibaba: "Alibaba", meta: "Meta", minimax: "MiniMax", moonshotai: "Moonshot AI", openai: "OpenAI", perplexity: "Perplexity", stepfun: "StepFun", xai: "xAI", zhipuai: "Zhipu AI" };
const labName = (id: string) => {
  if (labOverrides[id]) return labOverrides[id];
  const providerFile = path.join(upstream, "providers", id, "provider.toml");
  if (existsSync(providerFile)) {
    const name = (Bun.TOML.parse(readFileSync(providerFile, "utf8")) as Row).name;
    if (typeof name === "string" && name) return name;
  }
  return id.split("-").map(part => part[0].toUpperCase() + part.slice(1)).join(" ");
};

const discovered = new Map<string, { provider: string; model: string; configured: boolean }>();
for (const row of raw.models as Row[]) {
  if (typeof row.provider !== "string" || typeof row.name !== "string") continue;
  const id = `${row.provider}/${row.name}`;
  assert.ok(id.length <= 512 && !discovered.has(id), `Invalid or duplicate native access ${id}`);
  discovered.set(id, { provider: row.provider, model: row.name, configured: Array.isArray(row.accessible_by_keys) && row.accessible_by_keys.length > 0 });
}
assert.ok(discovered.size, "No configured native models discovered");

const nativeNames = new Set([...discovered.values()].map(x => x.model));
const offerFiles: { providerId: string; modelId: string; file: string; base?: string }[] = [];
for await (const file of new Bun.Glob("*/models/**/*.toml").scan({ cwd: path.join(upstream, "providers") })) {
  const match = /^([^/]+)\/models\/(.+)\.toml$/.exec(file);
  if (!match || !nativeNames.has(match[2])) continue;
  const authored = Bun.TOML.parse(readFileSync(path.join(upstream, "providers", file), "utf8")) as Row;
  offerFiles.push({ providerId: match[1], modelId: match[2], file: `providers/${file}`, base: typeof authored.base_model === "string" ? authored.base_model : undefined });
}

const canonicalIds = new Set<string>();
const candidates = new Map<string, Set<string>>();
for (const [id, native] of discovered) {
  const found = new Set<string>();
  const exact = path.join(upstream, "models", `${native.model}.toml`);
  if (existsSync(exact)) found.add(native.model);
  for (const offer of offerFiles) if (offer.modelId === native.model && offer.base && existsSync(path.join(upstream, "models", `${offer.base}.toml`))) found.add(offer.base);
  // Native aliases are evidence only when Bifrost provides the exact canonical ID.
  for (const provider of raw.providers as Row[]) {
    if (provider.name !== native.provider) continue;
    for (const key of provider.keys ?? []) for (const alias of (Array.isArray(key.aliases) ? key.aliases : Object.entries(key.aliases ?? {}).map(([name, value]) => ({ ...(typeof value === "object" && value ? value : {}), name })))) {
      if (alias?.name === native.model && typeof alias.canonical_name === "string" && existsSync(path.join(upstream, "models", `${alias.canonical_name}.toml`))) found.add(alias.canonical_name);
    }
  }
  candidates.set(id, found);
  for (const canonical of found) canonicalIds.add(canonical);
}
const selectedOffers = offerFiles.filter(x => [...discovered.values()].some(native => native.model === x.modelId && (native.provider === x.providerId || native.provider.toLowerCase() === x.providerId.toLowerCase())));
for (const offer of selectedOffers) if (offer.base) canonicalIds.add(offer.base);

const temp = mkdtempSync(path.join(tmpdir(), "registry-review-catalog-"));
const include = (relative: string) => {
  const destination = path.join(temp, relative);
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(path.join(upstream, relative), destination);
};
let generated: Row;
try {
  for (const id of canonicalIds) include(`models/${id}.toml`);
  for (const offer of selectedOffers) {
    include(`providers/${offer.providerId}/provider.toml`);
    include(offer.file);
  }
  const { generateCatalog } = await import("../dist/models-dev-upstream/packages/core/src/generate.ts");
  generated = await generateCatalog(temp);
} finally {
  rmSync(temp, { recursive: true, force: true });
}

type RecordValue = { candidates: Record<string, Record<string, unknown>>; updatedAt: Record<string, string> };
const record = (): RecordValue => ({ candidates: {}, updatedAt: {} });
const put = (r: RecordValue, source: "bifrost" | "models.dev", date: string, key: string, value: unknown) => {
  if (value === undefined || value === null || (typeof value === "number" && (!Number.isFinite(value) || value < 0))) return;
  (r.candidates[key] ??= {})[source] = value;
  r.updatedAt[source] = date;
};
const modelFields = (r: RecordValue, source: "bifrost" | "models.dev", date: string, row: Row, costs = false) => {
  for (const field of ["name", "family", "attachment", "reasoning", "tool_call", "structured_output", "temperature"]) put(r, source, date, field, row[field]);
  for (const [from, to] of [["context", "context_length"], ["input", "max_input_tokens"], ["output", "max_output_tokens"]]) put(r, source, date, to, row.limit?.[from]);
  put(r, source, date, "input_modalities", row.modalities?.input);
  put(r, source, date, "output_modalities", row.modalities?.output);
  if (costs) for (const [from, to] of [["input", "input_cost_usd_per_million"], ["output", "output_cost_usd_per_million"], ["cache_read", "cache_read_cost_usd_per_million"], ["cache_write", "cache_write_cost_usd_per_million"]]) put(r, source, date, to, row.cost?.[from]);
};
const references = [...canonicalIds].sort().map(id => {
  const r = record();
  const row = generated.models[id];
  assert.ok(row, `Missing generated canonical ${id}`);
  modelFields(r, "models.dev", upstreamAt, row);
  put(r, "models.dev", upstreamAt, "creator", labName(id.split("/")[0]));
  return { id, ...r };
});

const byNativeId = (rows: unknown): Map<string, Row> => {
  const grouped = new Map<string, Row[]>();
  for (const [key, row] of Array.isArray(rows) ? rows.map((x: Row) => [`${x.provider}/${x.base_model ?? x.model ?? x.name}`, x]) : Object.entries((rows && typeof rows === "object") ? rows : {})) {
    if (!row || typeof row !== "object") continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row as Row);
  }
  const result = new Map<string, Row>();
  for (const [id, variants] of grouped) {
    if (variants.length === 1) { result.set(id, variants[0]); continue; }
    const [provider, ...model] = id.split("/");
    const exact = variants.filter(row => row.model === model.join("/") || row.model === `${provider}/${model.join("/")}`);
    if (exact.length === 1) result.set(id, exact[0]);
  }
  return result;
};
const pricing = byNativeId(raw.pricing);
const parameters = byNativeId(raw.parameters);
const accesses = [...discovered].sort(([a], [b]) => a.localeCompare(b)).map(([id, native]) => {
  const r = record();
  put(r, "bifrost", at, "name", native.model);
  const price = pricing.get(id);
  if (price) {
    for (const field of ["context_length", "max_input_tokens", "max_output_tokens", "architecture", "additional_attributes"]) put(r, "bifrost", at, field, price[field]);
    for (const [from, to] of [["input_cost_per_token", "input_cost_usd_per_million"], ["output_cost_per_token", "output_cost_usd_per_million"], ["cache_read_input_token_cost", "cache_read_cost_usd_per_million"], ["cache_creation_input_token_cost", "cache_write_cost_usd_per_million"]]) {
      const value = Number(price[from]);
      if (price[from] !== undefined && price[from] !== null && Number.isFinite(value)) put(r, "bifrost", at, to, value * 1_000_000);
    }
    put(r, "bifrost", at, "input_modalities", price.architecture?.input_modalities);
    put(r, "bifrost", at, "output_modalities", price.architecture?.output_modalities);
  }
  const params = parameters.get(id);
  if (params) put(r, "bifrost", at, "parameters", params.parameters ?? params);
  const nativeProviderOffers = selectedOffers.filter(x => x.modelId === native.model && (native.provider === x.providerId || native.provider.toLowerCase() === x.providerId.toLowerCase()));
  if (nativeProviderOffers.length === 1) {
    const offer = nativeProviderOffers[0];
    modelFields(r, "models.dev", upstreamAt, generated.providers[offer.providerId].models[offer.modelId], true);
  }
  const matches = [...candidates.get(id)!].sort();
  const conflict = matches.length > 1 ? `Ambiguous exact source links; review: ${matches.join(", ")}` : matches.length === 0 ? "No exact canonical identity in pinned Models.dev; review manually" : undefined;
  return { id, provider: native.provider, model: native.model, configured: native.configured, mappingManual: false, ...(matches.length === 1 ? { referenceId: matches[0] } : {}), ...(conflict ? { matchConflict: conflict } : {}), ...r };
});

const captureError = raw.errors.join(" ").slice(0, 500);
const config = { schema_version: 1, default_naming: "provider/model", models: [], groups: [], policies: [], catalog: { references, accesses, sources: [{ id: "bifrost", lastSuccess: at, lastAttempt: at, ...(captureError ? { error: captureError } : {}) }, { id: "models.dev", lastSuccess: upstreamAt, lastAttempt: upstreamAt }] } };
const serialized = `${JSON.stringify(config, null, 2)}\n`;
assert.ok(Buffer.byteLength(serialized) <= (4 << 20), "Review config exceeds Registry 4 MiB limit");
mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, { flag: "wx" });
console.log(JSON.stringify({ output: outputPath, nativeAccesses: accesses.length, configuredByKey: accesses.filter(x => x.configured).length, references: references.length, mapped: accesses.filter(x => "referenceId" in x).length, conflicts: accesses.filter(x => "matchConflict" in x).length, captureWarnings: raw.errors.length, upstreamCommit: commit }));
