import { request } from "../../data/api";

export const revealKeySecret = (keyId: string, signal?: AbortSignal) =>
  request<{ secret: string }>(`keys/${encodeURIComponent(keyId)}/secret`, { method: "POST", signal });
