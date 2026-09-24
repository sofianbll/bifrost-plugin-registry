// @ts-nocheck — Node's test imports run through tsx; the browser tsconfig has no Node types.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseNewmanReport, prepareReplay, type HarnessCatalog } from "./harness";

const catalog = JSON.parse(readFileSync(new URL("../public/harness-catalog.json", import.meta.url), "utf8")) as HarnessCatalog;
assert.equal(catalog.source.sha256, "3330c41792b3ec93dd70c50f12c6547803a57ee76869b639bff70a096ad719b0");
assert.equal(catalog.folders.length, 114);
assert.equal(catalog.requestCount, 3530);
assert.equal(new Set(catalog.requests.map(request => request.id)).size, catalog.requestCount);
assert.ok(catalog.requests.some(request => request.rawBody?.includes("Say hello in one short sentence.")));
assert.ok(catalog.requests.some(request => /"max_tokens"\s*:\s*\d+/.test(request.rawBody || "")), "generation token limits must survive redaction");
assert.ok(catalog.requests.some(request => request.assertions.length));
assert.ok(catalog.requests[0].assertions.some(assertion => assertion.startsWith("Status code is")), "collection assertions must be inherited");
assert.ok(catalog.requests.some(request => request.skip));
assert.ok(catalog.requests.some(request => request.preview));
assert.equal(catalog.requests.find(request => request.name === "POST /openai/v1/chat/completions")?.headers.find(header => header.key === "Authorization")?.value, "[REDACTED]");

const run = parseNewmanReport({ run: { executions: [
  { item: { name: "passed" }, request: { method: "POST", url: { raw: "https://localhost/v1/chat/completions?api_key=leak" }, header: [{ key: "Authorization", value: "Bearer leak" }], body: { raw: '{"model":"test","max_tokens":32,"api_key":"leak"}' } }, response: { code: 200, responseTime: 12, stream: { type: "Buffer", data: [...new TextEncoder().encode('{"ok":true,"access_token":"leak"}')] } }, assertions: [{ assertion: "reply works" }] },
  { item: { name: "failed" }, request: {}, response: { code: 500, stream: { type: "Buffer", data: [101, 114, 114, 111, 114] } }, assertions: [{ assertion: "request succeeds", error: { message: "expected 200, got 500" } }] },
  { item: { name: "unverified" }, request: {}, response: { code: 200, stream: { type: "Buffer", data: [111, 107] } }, assertions: [] },
  { item: { name: "expected rejection" }, request: { url: { protocol: "http", host: ["localhost"], port: "8080", path: ["v1", "chat"], query: [{ key: "token", value: "leak" }] } }, response: { code: 400, stream: { type: "Buffer", data: [111, 107] } }, assertions: [{ assertion: "Status code is 4xx" }] },
  { item: { name: "no response" }, request: {}, assertions: [{ assertion: "status" }] },
  { item: { name: "skipped assertion" }, request: {}, response: { code: 200 }, assertions: [{ assertion: "optional", skipped: true }] },
] } });
assert.deepEqual(run.summary, { total: 6, passed: 2, failed: 2, unverified: 2 });
assert.equal(run.executions[0].responseTimeMs, 12);
assert.match(run.executions[0].requestBody!, /"max_tokens": 32/);
assert.equal(run.executions[0].responseBody, '{\n  "ok": true,\n  "access_token": "[REDACTED]"\n}');
assert.ok(!JSON.stringify(run).includes("leak"));
assert.equal(run.executions[1].assertions[0].error, "expected 200, got 500");
assert.equal(run.executions[2].outcome, "unverified");
assert.equal(run.executions[3].url, "http://localhost:8080/v1/chat?token=[REDACTED]");
assert.equal(run.executions[3].outcome, "passed");
assert.equal(run.executions[4].outcome, "failed");
assert.equal(run.executions[5].assertions[0].skipped, true);
assert.throws(() => parseNewmanReport("{oops"), /Invalid Newman JSON/);
assert.throws(() => parseNewmanReport({}), /no run.executions/);

const recorded = parseNewmanReport(readFileSync(new URL("../public/harness-demo-report.json", import.meta.url), "utf8"));
assert.deepEqual(recorded.summary, { total: 3, passed: 2, failed: 1, unverified: 0 });
assert.equal(recorded.reportClaim?.kind, "recorded-loopback");
assert.equal(recorded.demoProvenance, undefined, "imported JSON must not grant itself verified demo provenance");
assert.equal(recorded.recordedEvents?.length, 28);
assert.equal(recorded.recordedEvents?.[0].event, "beforeRequest");
assert.match(recorded.executions[0].url, /^http:\/\/127\.0\.0\.1:\d+\/v1\/chat\/completions$/);
assert.match(recorded.executions[2].responseBody!, /^data: /);
assert.equal(recorded.executions[1].responseStatus, 503);
assert.match(recorded.executions[1].assertions.find(assertion => !assertion.passed)?.error || "", /expected HTTP 200/);

const caseWithModel = catalog.requests.find(request => request.model && request.provider && request.bodyMode === "raw" && !request.skip && !request.preview && request.url.startsWith("{{baseUrl}}/"))!;
assert.equal(prepareReplay(caseWithModel, { provider: caseWithModel.provider!, model: caseWithModel.model! }).status, "ready");
assert.equal(prepareReplay(caseWithModel, { provider: caseWithModel.provider!, model: "other-model" }).status, "review-needed");
const gpt5 = catalog.requests.find(request => request.model === "openai/gpt-5" && request.url === "{{baseUrl}}/v1/chat/completions" && !request.skip && !request.preview && !request.rawBody?.includes("{{"))!;
assert.equal(prepareReplay(gpt5, { provider: "openai", model: "gpt-5" }).status, "ready");
assert.equal(prepareReplay(gpt5, { provider: "openai", model: "openai/gpt-5" }).status, "ready");
assert.equal(prepareReplay(gpt5, { provider: "gemini", model: "gpt-5" }).status, "review-needed");
console.log("Harness catalog and Newman import checks passed");
