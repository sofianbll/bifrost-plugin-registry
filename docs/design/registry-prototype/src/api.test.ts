import { getWorkspace, putWorkspace, readbackKey } from "./api";
import type { Demo } from "./demo";

const calls: { url: string; init: RequestInit }[] = [];
const equal = (actual: unknown, expected: unknown) => { if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
globalThis.fetch = (async (url: string, init: RequestInit) => {
  calls.push({ url, init });
  return new Response(JSON.stringify({ revision: "next" }), { status: 200, headers: { "Content-Type": "application/json" } });
}) as typeof fetch;

const data: Demo = { models: [], groups: [], keys: [], campaigns: [] };
await getWorkspace();
await putWorkspace(data, "current");
await readbackKey("native/key");
equal(calls[0].url, "/bifrost-registry/api/workspace");
equal(calls[1].init.headers && (calls[1].init.headers as Record<string, string>)["If-Match"], "current");
equal(JSON.parse(calls[1].init.body as string), { data });
equal(calls[2].url, "/bifrost-registry/api/keys/native%2Fkey/readback");
console.log("Live API request contract: OK");
