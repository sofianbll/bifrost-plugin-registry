import type { Demo, Model, Publication } from "./demo";

export type Workspace = {
  revision: string;
  data: Demo;
  discovery: Model[];
  connection: { connected: true; version: string };
};

const endpoint = (path: string) => `${import.meta.env?.BASE_URL ?? "/bifrost-registry/"}api/${path}`;

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly phase?: string, readonly revision?: string, readonly publication?: Publication) { super(message); }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(endpoint(path), { credentials: "same-origin", cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(typeof body.error === "string" ? body.error : `Request failed (${response.status})`, response.status, body.phase, body.revision, body.publication);
  }
  return response.json() as Promise<T>;
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
