import type { Demo, Model, Publication } from "./demo";

export type Workspace = {
  revision: string;
  data: Demo;
  discovery: Model[];
  connection: { connected: true; version: string };
};

const endpoint = (path: string) => `${import.meta.env?.BASE_URL ?? "./"}api/${path}`;
let adminToken = "";
export const setAdminToken = (token: string) => { adminToken = token; };
export const clearAdminToken = () => { adminToken = ""; };

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
export const putWorkspace = (data: Demo, revision: string) => request<Workspace>("workspace", {
  method: "PUT",
  headers: { "Content-Type": "application/json", "If-Match": revision },
  body: JSON.stringify({ data }),
});
export const createKey = (name: string, client: string) => request<{ workspace?: Workspace; managed?: boolean; bindingError?: string; refreshError?: string; created: { id: string; secret: string } }>("keys", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, client }),
});
export const readbackKey = (id: string) => request<Workspace>(`keys/${encodeURIComponent(id)}/readback`, { method: "POST" });

export type AdoptionOperation = "adopt" | "rebind";
export type AdoptionPreview = { keyId: string; operation: AdoptionOperation; revision: string; previewToken?: string; selectedRoutes: string[]; nativeRoutes: string[]; blocked: string[]; canApply: boolean; nativePermissionsPreserved: true };
export type AdoptionReceipt = { keyId: string; revision: string; managed: true; nativePermissionsPreserved: true };
export const previewKeyAdoption = (keyId: string, operation: AdoptionOperation) => request<AdoptionPreview>("keys/adopt", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId, operation, phase: "preview" }),
});
export const applyKeyAdoption = (preview: AdoptionPreview) => request<AdoptionReceipt>("keys/adopt", {
  method: "POST", headers: { "Content-Type": "application/json", "If-Match": preview.revision },
  body: JSON.stringify({ keyId: preview.keyId, operation: preview.operation, phase: "apply", previewToken: preview.previewToken }),
});
