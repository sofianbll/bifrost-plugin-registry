import type { Demo, Model, NativePermissions, PricingProof, Publication, Readiness } from "../domain/registry";
import type { CatalogOverride } from "../features/catalog/model-card-fields";

export type Workspace = {
  revision: string;
  data: Demo;
  discovery: Model[];
  pricingProofs: PricingProof[];
  // Native providers; custom ones carry their Bifrost base provider type (Claude → anthropic).
  providers?: { id: string; baseProviderType?: string }[];
  connection: { connected: true; version: string; mode?: "snapshot"; source?: string; capturedAt?: string; partial?: boolean };
};

const endpoint = (path: string) => `${import.meta.env?.BASE_URL ?? "./"}api/${path}`;
let adminToken = "";
export const setAdminToken = (token: string) => { adminToken = token; };
export const clearAdminToken = () => { adminToken = ""; };
// fetch throws on a header value with a stray space or non-ASCII character (e.g. a terminal's "│" gutter).
export const isWellFormedAdminToken = (token: string) => /^[\x21-\x7e]+$/.test(token);

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly phase?: string, readonly revision?: string, readonly publication?: Publication) { super(message); }
}

export async function requestResponse(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (adminToken) headers.set("Authorization", `Bearer ${adminToken}`);
  const response = await fetch(endpoint(path), { credentials: "same-origin", cache: "no-store", ...init, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(typeof body.error === "string" ? body.error : `Request failed (${response.status})`, response.status, body.phase, body.revision, body.publication);
  }
  return response;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return (await requestResponse(path, init)).json() as Promise<T>;
}

export const getWorkspace = () => request<Workspace>("workspace");
export const putWorkspace = (data: Demo, revision: string, catalogOverrides?: CatalogOverride[]) => request<Workspace>("workspace", {
  method: "PUT",
  headers: { "Content-Type": "application/json", "If-Match": revision },
  body: JSON.stringify({ data, ...(catalogOverrides?.length ? { catalogOverrides } : {}) }),
});
export const createKey = (name: string, client: string) => request<{ workspace?: Workspace; managed?: boolean; bindingError?: string; refreshError?: string; created: { id: string; secret: string } }>("keys", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, client }),
});
export const readbackKey = (id: string) => request<Workspace>(`keys/${encodeURIComponent(id)}/readback`, { method: "POST" });

export type AdoptionOperation = "adopt" | "rebind";
export type AdoptionPreview = { keyId: string; operation: AdoptionOperation; revision: string; previewToken?: string; selectedRoutes: string[]; nativeRoutes: string[]; blocked: string[]; readiness?: Readiness; canApply: boolean; nativePermissionsPreserved: true; evidence?: "snapshot"; source?: string; capturedAt?: string };
export type AdoptionReceipt = { keyId: string; revision: string; managed: true; nativePermissionsPreserved: true; evidence?: "snapshot"; source?: string; capturedAt?: string };
// keepNative: providers of the key whose permissions stay in Bifrost (adopt only). The preview token covers
// the choice, so apply must send the same list the preview was made with.
export const previewKeyAdoption = (keyId: string, operation: AdoptionOperation, keepNative: string[] = []) => request<AdoptionPreview>("keys/adopt", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId, operation, phase: "preview", ...(keepNative.length ? { keepNative } : {}) }),
});
export const applyKeyAdoption = (preview: AdoptionPreview, keepNative: string[] = []) => request<AdoptionReceipt>("keys/adopt", {
  method: "POST", headers: { "Content-Type": "application/json", "If-Match": preview.revision },
  body: JSON.stringify({ keyId: preview.keyId, operation: preview.operation, phase: "apply", previewToken: preview.previewToken, ...(keepNative.length ? { keepNative } : {}) }),
});

// Native permission edit before adoption (#93): remove the models Registry cannot represent from one
// provider of an unmanaged key, or replace its "all providers", or replace "all models" of one provider by the
// models Registry holds ("replace-all-models"). Preview first; the apply carries the
// preview token and an explicit confirmation, and only then writes to Bifrost.
export type NativeEditOperation = "remove-models" | "replace-all-providers" | "replace-all-models";
export type NativeEditPreview = { keyId: string; operation: NativeEditOperation; provider?: string; revision: string; previewToken?: string; remove: { provider: string; models: string[]; dropsLimits?: boolean }[]; before: NativePermissions | null; after?: NativePermissions | null; canApply: boolean; blocked: string[] };
export type NativeEditReceipt = { keyId: string; operation: NativeEditOperation; applied: true; permissions: NativePermissions };
export const previewNativeEdit = (keyId: string, operation: NativeEditOperation, provider = "") => request<NativeEditPreview>("keys/native-permissions", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId, operation, provider, phase: "preview" }),
});
export const applyNativeEdit = (preview: NativeEditPreview) => request<NativeEditReceipt>("keys/native-permissions", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ keyId: preview.keyId, operation: preview.operation, provider: preview.provider ?? "", phase: "apply", previewToken: preview.previewToken, confirm: true }),
});
