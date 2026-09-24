import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const input = process.argv[2];
const output = process.argv[3];
if (!input || !output) throw new Error("usage: node scripts/import-harness.mjs SOURCE.json public/harness-catalog.json");

const bytes = readFileSync(input);
const collection = JSON.parse(bytes.toString("utf8"));
const sourceSha = createHash("sha256").update(bytes).digest("hex");
if (sourceSha !== "3330c41792b3ec93dd70c50f12c6547803a57ee76869b639bff70a096ad719b0") throw new Error("Source SHA-256 does not match pinned Bifrost commit");
const sensitive = key => {
  const name = key.replace(/[-_]/g, "").toLowerCase();
  return ["authorization", "proxyauthorization", "cookie", "setcookie", "xbifrostvk", "xgoogapikey", "token", "accesstoken", "refreshtoken", "idtoken", "authtoken", "bearertoken", "sessiontoken"].includes(name)
    || name.endsWith("apikey") || name.endsWith("secret") || name.endsWith("password") || name.endsWith("credential") || name.endsWith("credentials");
};
const redactText = text => String(text).replace(/\b(Bearer\s+)[^\s"']+/gi, "$1[REDACTED]");
function redactBody(raw) {
  if (typeof raw !== "string") return undefined;
  try {
    const parsed = JSON.parse(raw);
    let changed = false;
    const visit = value => {
      if (Array.isArray(value)) return value.map(visit);
      if (!value || typeof value !== "object") return typeof value === "string" ? redactText(value) : value;
      return Object.fromEntries(Object.entries(value).map(([key, child]) => {
        if (sensitive(key)) { changed = true; return [key, "[REDACTED]"]; }
        return [key, visit(child)];
      }));
    };
    const clean = visit(parsed);
    return changed ? JSON.stringify(clean, null, 2) : redactText(raw);
  } catch { return redactText(raw); }
}
function safeUrl(raw) {
  return redactText(String(raw || "")
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[REDACTED]@")
    .replace(/([?&](?:key|api[-_]?key|access[-_]?token|token|secret|password|x-goog-api-key)=)[^&]+/gi, "$1[REDACTED]"));
}
function requestInfo(request) {
  const rawBody = redactBody(request.body?.raw);
  let model;
  try {
    const body = JSON.parse(request.body?.raw || "null");
    if (typeof body?.model === "string" && !body.model.includes("{{")) model = body.model;
  } catch { /* Non-JSON requests remain available without model metadata. */ }
  if (!model && request.body?.mode === "formdata") {
    const field = request.body.formdata?.find(entry => entry.key === "model" && entry.type === "text");
    if (field && typeof field.value === "string" && !field.value.includes("{{")) model = field.value;
  }
  return {
    method: request.method || "GET",
    url: safeUrl(typeof request.url === "string" ? request.url : request.url?.raw),
    headers: (request.header || []).map(({ key, value, disabled }) => ({ key, value: sensitive(key) ? "[REDACTED]" : redactText(value ?? ""), ...(disabled ? { disabled: true } : {}) })),
    bodyMode: request.body?.mode || null,
    ...(rawBody !== undefined ? { rawBody } : {}),
    ...(request.body?.mode === "formdata" ? { formdata: request.body.formdata.map(entry => ({ key: entry.key, type: entry.type, ...(entry.value !== undefined ? { value: sensitive(entry.key) ? "[REDACTED]" : redactText(entry.value) } : {}), ...(entry.src !== undefined ? { src: entry.src } : {}) })) } : {}),
    ...(request.body?.mode === "file" ? { fileSource: request.body.file?.src || null } : {}),
    ...(model ? { model, ...(model.includes("/") ? { provider: model.split("/")[0] } : {}) } : {}),
  };
}

const folders = [];
const requests = [];
function testNames(events) {
  const script = (events || []).filter(event => event.listen === "test").flatMap(event => event.script?.exec || []).join("\n");
  return [...script.matchAll(/pm\.test\s*\(\s*(['"`])([^'"`\n]*)\1/g)].map(match => script.slice(match.index + match[0].length).trimStart().startsWith(",") ? match[2] : `${match[2].trim()} [dynamic]`);
}
function walk(items, names = [], positions = [], inheritedAssertions = testNames(collection.event)) {
  items.forEach((item, index) => {
    const path = [...positions, index];
    if (item.item) { walk(item.item, [...names, item.name], path, [...inheritedAssertions, ...testNames(item.event)]); return; }
    if (!item.request) return;
    requests.push({
      id: `case-${path.join("-")}`,
      name: item.name,
      topFolder: names[0] || "(root)",
      topFolderId: names.length ? `folder-${path[0]}` : "folder-root",
      folderPath: names,
      ...requestInfo(item.request),
      assertions: [...inheritedAssertions, ...testNames(item.event)],
      skip: /\[SKIP\]/i.test(item.name),
      preview: /\[PREVIEW\]/i.test(item.name),
    });
  });
}
walk(collection.item || []);
for (let index = 0; index < collection.item.length; index++) {
  const item = collection.item[index];
  if (item.item) folders.push({ id: `folder-${index}`, name: item.name, requestCount: requests.filter(request => request.id.startsWith(`case-${index}-`)).length });
}
const catalog = {
  source: {
    repository: "https://github.com/maximhq/bifrost",
    commit: "6493abd3d1422c9bfde95f242fd57b38e73ce881",
    path: "tests/e2e/api/collections/provider-harness.json",
    sha256: sourceSha,
    collectionName: collection.info?.name || "Provider harness",
  },
  requestCount: requests.length,
  folders,
  requests,
};
writeFileSync(output, JSON.stringify(catalog));
console.log(`${requests.length} requests, ${folders.length} folders -> ${output}`);
