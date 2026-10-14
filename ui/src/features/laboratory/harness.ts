export type HarnessHeader = { key: string; value: string; disabled?: boolean };
export type HarnessRequest = {
  id: string;
  name: string;
  topFolder: string;
  topFolderId: string;
  folderPath: string[];
  method: string;
  url: string;
  headers: HarnessHeader[];
  bodyMode: string | null;
  rawBody?: string;
  formdata?: { key: string; type?: string; value?: string; src?: string }[];
  fileSource?: string | null;
  model?: string;
  provider?: string;
  assertions: string[];
  skip: boolean;
  preview: boolean;
};
export type HarnessFolder = { id: string; name: string; requestCount: number };
export type HarnessCatalog = {
  source: { repository: string; commit: string; path: string; sha256: string; collectionName: string };
  requestCount: number;
  folders: HarnessFolder[];
  requests: HarnessRequest[];
};

export async function loadHarnessCatalog(): Promise<HarnessCatalog> {
  const response = await fetch("/harness-catalog.json");
  if (!response.ok) throw new Error(`Harness catalog HTTP ${response.status}`);
  const catalog = await response.json() as HarnessCatalog;
  if (!Array.isArray(catalog.requests) || !Array.isArray(catalog.folders) || catalog.requestCount !== catalog.requests.length) {
    throw new Error("Invalid harness catalog");
  }
  return catalog;
}

export type AssertionRecord = { name: string; passed: boolean; skipped?: boolean; error?: string };
export type ExecutionRecord = {
  id: string;
  caseId?: string;
  name: string;
  method: string;
  url: string;
  requestHeaders: HarnessHeader[];
  requestBody?: string;
  requestTruncated?: boolean;
  responseStatus?: number;
  responseTimeMs?: number;
  responseHeaders: HarnessHeader[];
  responseBody?: string;
  responseTruncated?: boolean;
  assertions: AssertionRecord[];
  outcome: "passed" | "failed" | "unverified";
  failure?: string;
};
export type RunRecord = {
  id: string;
  provenance: "imported-newman";
  importedAt: string;
  demoProvenance?: { kind: string; runner?: string; sourceCommit?: string; sourceSha256?: string; description?: string };
  reportClaim?: { kind: string; runner?: string; sourceCommit?: string; sourceSha256?: string; description?: string };
  recordedEvents?: { event: "beforeRequest" | "request" | "assertion" | "item"; at: string; executionIndex: number; assertion?: string; failed?: boolean }[];
  executions: ExecutionRecord[];
  unmatchedFailures: { name: string; error: string }[];
  summary: { total: number; passed: number; failed: number; unverified: number };
};

type JsonObject = Record<string, unknown>;
const object = (value: unknown): JsonObject => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const string = (value: unknown): string => typeof value === "string" ? value : "";
function secretKey(key: string): boolean {
  const name = key.replace(/[-_]/g, "").toLowerCase();
  return ["authorization", "proxyauthorization", "cookie", "setcookie", "xbifrostvk", "xgoogapikey", "token", "accesstoken", "refreshtoken", "idtoken", "authtoken", "bearertoken", "sessiontoken"].includes(name)
    || name.endsWith("apikey") || name.endsWith("secret") || name.endsWith("password") || name.endsWith("credential") || name.endsWith("credentials");
}
const MAX_FIELD = 100_000;
const MAX_REPORT = 25_000_000;

function scrubText(value: string): string {
  return value
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[REDACTED]@")
    .replace(/\b(Bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/([?&](?:key|api[-_]?key|access[-_]?token|token|secret|password|x-goog-api-key)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/(["'](?:api[_-]?key|access[_-]?token|secret|password)["']\s*:\s*["'])[^"']+/gi, "$1[REDACTED]");
}
function scrub(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const parsed: unknown = JSON.parse(value);
    let changed = false;
    const visit = (entry: unknown): unknown => {
      if (Array.isArray(entry)) return entry.map(visit);
      if (entry && typeof entry === "object") return Object.fromEntries(Object.entries(entry).map(([key, child]) => {
        if (secretKey(key)) { changed = true; return [key, "[REDACTED]"]; }
        return [key, visit(child)];
      }));
      if (typeof entry === "string") {
        const clean = scrubText(entry);
        if (clean !== entry) changed = true;
        return clean;
      }
      return entry;
    };
    const clean = visit(parsed);
    return changed ? JSON.stringify(clean, null, 2) : value;
  } catch { return scrubText(value); }
}
function bounded(value: unknown): { text?: string; truncated?: boolean } {
  if (value === undefined || value === null) return {};
  const clean = scrub(typeof value === "string" ? value : JSON.stringify(value));
  return clean.length > MAX_FIELD ? { text: clean.slice(0, MAX_FIELD), truncated: true } : { text: clean };
}
function headers(value: unknown): HarnessHeader[] {
  return array(value).map(raw => {
    const header = object(raw);
    const key = string(header.key);
    return { key, value: secretKey(key) ? "[REDACTED]" : scrubText(string(header.value)), ...(header.disabled ? { disabled: true } : {}) };
  }).filter(header => header.key);
}
function responseText(response: JsonObject): unknown {
  const stream = response.stream;
  if (typeof stream === "string") return stream;
  if (Array.isArray(stream)) return new TextDecoder().decode(new Uint8Array(stream));
  const buffer = object(stream);
  if (buffer.type === "Buffer" && Array.isArray(buffer.data)) return new TextDecoder().decode(new Uint8Array(buffer.data as number[]));
  return response.body;
}
function urlText(url: unknown): string {
  if (typeof url === "string") return scrubText(url);
  const parts = object(url);
  if (typeof parts.raw === "string") return scrubText(parts.raw);
  const host = Array.isArray(parts.host) ? parts.host.map(String).join(".") : string(parts.host);
  if (!host) return "";
  const path = Array.isArray(parts.path) ? parts.path.map(String).join("/") : string(parts.path);
  const query = array(parts.query).filter(part => !object(part).disabled).map(part => `${encodeURIComponent(string(object(part).key))}=${encodeURIComponent(string(object(part).value))}`).join("&");
  return scrubText(`${string(parts.protocol) || "http"}://${host}${parts.port ? `:${parts.port}` : ""}/${path}${query ? `?${query}` : ""}`);
}
function errorText(value: unknown): string {
  const error = object(value);
  return scrubText(string(error.message) || string(error.stack) || (typeof value === "string" ? value : "Unknown Newman error"));
}

/** Import Newman JSON evidence. HTTP success alone never creates a passing assertion. */
export function parseNewmanReport(input: string | unknown, catalog?: HarnessCatalog): RunRecord {
  if (typeof input === "string" && input.length > MAX_REPORT) throw new Error("Newman report exceeds 25 MB");
  let data: JsonObject;
  try { data = object(typeof input === "string" ? JSON.parse(input) : input); }
  catch { throw new Error("Invalid Newman JSON report"); }
  const run = object(data.run);
  if (!Array.isArray(run.executions)) throw new Error("Newman report has no run.executions array");
  const failures = array(run.failures).map(raw => object(raw));
  const usedFailures = new Set<number>();
  const executionNameCounts = new Map<string, number>();
  for (const raw of run.executions) {
    const name = string(object(object(raw).item).name);
    executionNameCounts.set(name, (executionNameCounts.get(name) || 0) + 1);
  }
  const nameCounts = new Map<string, number>();
  for (const request of catalog?.requests || []) nameCounts.set(request.name, (nameCounts.get(request.name) || 0) + 1);
  const uniqueCases = new Map((catalog?.requests || []).filter(request => nameCounts.get(request.name) === 1).map(request => [request.name, request.id]));
  const executions: ExecutionRecord[] = run.executions.map((raw, index) => {
    const execution = object(raw);
    const item = object(execution.item);
    const request = object(execution.request);
    const response = object(execution.response);
    const name = scrubText(string(item.name) || `Execution ${index + 1}`);
    const sourceId = string(item.id) || string(item._postman_id);
    const matchingFailures = failures.flatMap((failure, failureIndex) => {
      const source = object(failure.source);
      const failureSourceId = string(source.id) || string(source._postman_id);
      const matches = sourceId && failureSourceId ? sourceId === failureSourceId : executionNameCounts.get(name) === 1 && string(source.name) === name;
      if (!matches) return [];
      usedFailures.add(failureIndex);
      return [errorText(failure.error)];
    });
    const assertionRecords: AssertionRecord[] = array(execution.assertions).map(rawAssertion => {
      const assertion = object(rawAssertion);
      const error = assertion.error ? errorText(assertion.error) : undefined;
      return { name: scrubText(string(assertion.assertion) || string(assertion.name) || "Unnamed assertion"), passed: !error && !assertion.skipped, ...(assertion.skipped ? { skipped: true } : {}), ...(error ? { error } : {}) };
    });
    const requestField = bounded(object(request.body).raw);
    const responseField = bounded(responseText(response));
    const responseStatus = typeof response.code === "number" ? response.code : undefined;
    const responseTimeMs = typeof response.responseTime === "number" ? response.responseTime : undefined;
    const failed = !execution.response || matchingFailures.length > 0 || assertionRecords.some(assertion => assertion.error);
    const passed = !failed && assertionRecords.length > 0 && assertionRecords.every(assertion => assertion.passed);
    return {
      id: `execution-${index}`,
      ...(uniqueCases.has(name) ? { caseId: uniqueCases.get(name) } : {}),
      name,
      method: scrubText(string(request.method)),
      url: urlText(request.url),
      requestHeaders: headers(request.header),
      ...(requestField.text !== undefined ? { requestBody: requestField.text } : {}),
      ...(requestField.truncated ? { requestTruncated: true } : {}),
      ...(responseStatus !== undefined ? { responseStatus } : {}),
      ...(responseTimeMs !== undefined ? { responseTimeMs } : {}),
      responseHeaders: headers(response.header),
      ...(responseField.text !== undefined ? { responseBody: responseField.text } : {}),
      ...(responseField.truncated ? { responseTruncated: true } : {}),
      assertions: assertionRecords,
      outcome: failed ? "failed" : passed ? "passed" : "unverified",
      ...(matchingFailures.length ? { failure: matchingFailures.join("; ") } : {}),
    };
  });
  const unmatchedFailures = failures.flatMap((failure, index) => usedFailures.has(index) ? [] : [{ name: scrubText(string(object(failure.source).name) || "Run failure"), error: errorText(failure.error) }]);
  return {
    id: `import-${crypto.randomUUID()}`,
    provenance: "imported-newman",
    importedAt: new Date().toISOString(),
    ...(Array.isArray(data.recordedEvents) ? { recordedEvents: data.recordedEvents.flatMap(raw => {
      const entry = object(raw);
      const event = entry.event;
      const index = entry.executionIndex;
      if (!["beforeRequest", "request", "assertion", "item"].includes(string(event)) || !Number.isInteger(index) || (index as number) < 0 || (index as number) >= executions.length) return [];
      return [{
        event: event as "beforeRequest" | "request" | "assertion" | "item",
        at: scrubText(string(entry.at)),
        executionIndex: index as number,
        ...(typeof entry.assertion === "string" ? { assertion: scrubText(entry.assertion) } : {}),
        ...(typeof entry.failed === "boolean" ? { failed: entry.failed } : {}),
      }];
    }) } : {}),
    ...(data.demoProvenance ? { reportClaim: {
      kind: scrubText(string(object(data.demoProvenance).kind)),
      runner: scrubText(string(object(data.demoProvenance).runner)),
      sourceCommit: scrubText(string(object(data.demoProvenance).sourceCommit)),
      sourceSha256: scrubText(string(object(data.demoProvenance).sourceSha256)),
      description: scrubText(string(object(data.demoProvenance).description)),
    } } : {}),
    executions,
    unmatchedFailures,
    summary: {
      total: executions.length,
      passed: executions.filter(execution => execution.outcome === "passed").length,
      failed: executions.filter(execution => execution.outcome === "failed").length,
      unverified: executions.filter(execution => execution.outcome === "unverified").length,
    },
  };
}

export type ReplayPlan = {
  status: "ready" | "review-needed";
  reason: string;
  request?: { method: string; url: string; headers: HarnessHeader[]; rawBody?: string };
};

/** A catalog case is reusable as-is only when it already targets the selected provider/model. */
export function prepareReplay(test: HarnessRequest, target: { provider: string; model: string }): ReplayPlan {
  if (test.skip || test.preview) return { status: "review-needed", reason: "Official case is marked SKIP or PREVIEW and needs its upstream prerequisites." };
  if (!test.model || !test.provider) return { status: "review-needed", reason: "The official request has no unambiguous provider/model target." };
  const selectedModel = target.model === test.model ? target.model : `${target.provider}/${target.model}`;
  if (test.provider !== target.provider || test.model !== selectedModel) return { status: "review-needed", reason: `Official request targets ${test.model}; changing provider or model may alter its test meaning.` };
  if (test.bodyMode !== "raw") return { status: "review-needed", reason: "This request needs non-JSON or external fixture data." };
  if (!test.url.startsWith("{{baseUrl}}/")) return { status: "review-needed", reason: "This request uses a different endpoint or external URL." };
  if (test.url.slice("{{baseUrl}}".length).includes("{{") || test.rawBody?.includes("{{") || test.rawBody?.includes("[REDACTED]") || test.headers.some(header => header.value.includes("{{") || header.value.includes("[REDACTED]"))) {
    return { status: "review-needed", reason: "This request needs fixture variables or redacted credentials before replay." };
  }
  return { status: "ready", reason: "The official request already targets this provider and model; execution still requires a configured runner.", request: { method: test.method, url: test.url, headers: test.headers, rawBody: test.rawBody } };
}
