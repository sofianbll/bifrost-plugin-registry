import { request, requestResponse } from "./api";

export type Snapshot = { format_version: 1; registry: unknown };
type Diff = { added: number; updated: number; removed: number; details: { id: string; change: string }[]; truncated?: boolean };
export type SnapshotPreview = {
  source_format: string;
  current_revision: string;
  imported_revision: string;
  unchanged: boolean;
  changes: { models: Diff; groups: Diff; policies: Diff; references: Diff; accesses: Diff; sources: Diff; default_naming: { before: string; after: string; changed: boolean } };
};
export type SnapshotReceipt = { revision: string; unchanged: boolean; backup: string };

export const getSnapshot = () => request<Snapshot>("snapshot");
export const getSnapshotCsv = async () => (await requestResponse("snapshot.csv")).text();
export const previewSnapshot = (raw: string) => request<SnapshotPreview>("snapshot/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
export const applySnapshot = (raw: string, revision: string) => request<SnapshotReceipt>("snapshot/apply", { method: "POST", headers: { "Content-Type": "application/json", "If-Match": revision }, body: raw });
