import { installGalleryApi } from "./gallery-api";

const originals: string[] = [];
Object.assign(globalThis, {
  location: { href: "http://gallery.test/component-gallery.html", origin: "http://gallery.test" },
  window: { fetch: async (input: RequestInfo | URL) => { originals.push(String(input)); return new Response("{}", { status: 200 }); } },
});
installGalleryApi();

async function status(path: string, init?: RequestInit) {
  return window.fetch(path, init).then(response => response.status);
}
async function check() {
  const workspace = await window.fetch("./api/workspace");
  const data = await workspace.json() as { data?: { models?: unknown[] } };
  if (workspace.status !== 200 || !data.data?.models?.length) throw new Error("Workspace fixture unavailable");
  if (await status("./api/workspace", { method: "PUT" }) !== 403) throw new Error("API mutation was allowed");
  if (await status("https://external.test/models") !== 403) throw new Error("External fetch was allowed");
  if (await status("./api/unmocked") !== 404) throw new Error("Unknown API route was allowed");
  if (await status("/harness-catalog.json") !== 200 || await status("/harness-demo-report.json") !== 200) throw new Error("Public harness fixture was blocked");
  if (await status("/other.json") !== 403 || await status("/harness-demo-report.json", { method: "POST" }) !== 403 || await status("https://external.test/harness-demo-report.json") !== 403) throw new Error("Static asset boundary was too broad");
  if (originals.join(",") !== "/harness-catalog.json,/harness-demo-report.json") throw new Error("Unexpected request reached original fetch");
  console.log("Gallery API boundary: 9 checks passed");
}
await check();
