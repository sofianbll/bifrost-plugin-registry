// Synthetic, gallery-only API boundary. Install before mounting any production screen.
import { fixture } from "../fixtures/registry";
import type { Catalog, CatalogField } from "../../features/catalog/catalog-api";

const field = (value: unknown): CatalogField => ({ value, source: "gallery fixture", updatedAt: null, kind: "declared" });
const catalog: Catalog = {
  revision: "gallery-1",
  references: fixture.models.map(model => ({ id: model.id, fields: { name: field(model.name), creator: field(model.creator), family: field(model.family), input_modalities: field(model.inputModalities), output_modalities: field(model.outputModalities) }, overrides: {} })),
  accesses: fixture.models.flatMap(model => model.accesses.map(access => ({ id: access.id, provider: access.provider, model: access.nativeModel || model.id, configured: access.status === "Configured", referenceId: model.id, fields: { name: field(model.name) }, overrides: {} }))),
  sources: [{ id: "gallery fixture", lastSuccess: "2026-09-27T00:00:00Z" }],
};
const workspace = { revision: "gallery-1", data: fixture, discovery: fixture.models, connection: { connected: true, version: "galerie", mode: "snapshot", source: "données synthétiques", capturedAt: "2026-09-27T00:00:00Z", partial: false } };
const body: Record<string, unknown> = {
  workspace,
  catalog,
  "review-context": { source: "fixture locale · 27 septembre 2026", providers: [{ name: "OpenAI", keys: [{ id: "key-demo", name: "Accès de démonstration", weight: 1, enabled: true, models: ["gpt-5"], blacklisted_models: [], aliases: { "gpt-demo": "gpt-5" } }] }], models: [{ provider: "OpenAI", name: "gpt-5" }], routingRules: [{ id: "rule-demo", name: "Routage de démonstration", enabled: true, priority: 1, scope: "global", targets: [{ provider: "openai", model: "gpt-5", weight: 1 }] }], virtualKeys: [{ id: "hermes", name: "Clé fictive", is_active: true, allow_all_providers: false, provider_configs: [{ provider: "openai", models: ["gpt-5"] }] }], errors: [] },
  "assistant/settings": { revision: "gallery-1", settings: { model: "gpt-5", endpoint: "chat_completions", virtualKeyId: "hermes" } },
  "snapshot": { format_version: 1, registry: fixture },
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
let installed = false;
export function installGalleryApi() {
  if (installed) return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const marker = "/api/";
    const at = url.pathname.indexOf(marker);
    if (at >= 0) {
      const key = url.pathname.slice(at + marker.length);
      if (key === "keys/adopt" && method === "POST") {
        const payload = JSON.parse(String(init?.body || "{}")) as { keyId?: string; operation?: string; phase?: string };
        return Promise.resolve(payload.phase === "preview" ? json({ keyId: payload.keyId, operation: payload.operation, revision: "gallery-1", selectedRoutes: ["openai/gpt-5"], nativeRoutes: ["openai/gpt-5"], blocked: [], canApply: true, nativePermissionsPreserved: true, evidence: "snapshot", source: "fixture locale", capturedAt: "2026-09-27", previewToken: "gallery-only" }) : json({ error: "Action désactivée dans la galerie." }, 403));
      }
      if (method !== "GET") return Promise.resolve(json({ error: "Action désactivée dans la galerie." }, 403));
      if (key === "assistant/models") return Promise.resolve(json({ models: fixture.models.map(model => ({ id: model.id, provider: model.accesses[0]?.provider || "", name: model.name })), virtualKeys: [{ id: "hermes", name: "Clé fictive" }] }));
      if (key === "snapshot.csv") return Promise.resolve(new Response("id,name\ngpt-5,GPT-5\n", { headers: { "Content-Type": "text/csv" } }));
      if (key.startsWith("keys/") && key.endsWith("/secret")) return Promise.resolve(json({ error: "Aucun secret réel dans la galerie." }, 403));
      return Promise.resolve(key in body ? json(body[key]) : json({ error: `Fixture absente : ${key}` }, 404));
    }
    // Only the two public harness fixtures and bundled images may reach local static serving.
    if (method === "GET" && url.origin === location.origin && (["/harness-catalog.json", "/harness-demo-report.json"].includes(url.pathname) || url.pathname.includes("/images/"))) return original(input, init);
    return Promise.resolve(json({ error: "Réseau désactivé dans la galerie." }, 403));
  };
}
