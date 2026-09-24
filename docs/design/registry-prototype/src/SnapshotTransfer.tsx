import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "./api";
import { applySnapshot, getSnapshot, getSnapshotCsv, previewSnapshot, type SnapshotPreview, type SnapshotReceipt } from "./snapshot-api";

const sections = ["models", "groups", "policies", "references", "accesses", "sources"] as const;
const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function SnapshotTransfer({ onUnauthorized, onApplied }: { onUnauthorized: () => void; onApplied: () => void }) {
  const [raw, setRaw] = useState("");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<SnapshotPreview | null>(null);
  const [receipt, setReceipt] = useState<SnapshotReceipt | null>(null);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState("");

  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onUnauthorized(); return; }
    if (cause instanceof ApiError && cause.status === 409) {
      setStale(true);
      setError("The Registry changed since preview. Refresh the preview, review the diff, then apply again.");
      return;
    }
    setError(cause instanceof Error ? cause.message : "Snapshot request failed.");
  };
  const run = async (label: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(label);
    try { await work(); setError(""); }
    catch (cause) { report(cause); }
    finally { setBusy(""); }
  };
  const choose = async (file?: File) => {
    setPreview(null);
    setReceipt(null);
    setStale(false);
    setRaw("");
    setFilename("");
    setError("");
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { setError("Choose a JSON file smaller than 4 MiB."); return; }
    try {
      const content = await file.text();
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("The file must contain a JSON object.");
      setRaw(content); // Keep the original bytes for server-side duplicate-key validation.
      setFilename(file.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Invalid JSON file."); }
  };
  const previewFile = () => void run("preview", async () => {
    setPreview(null);
    const next = await previewSnapshot(raw);
    setPreview(next);
    setStale(false);
    setReceipt(null);
  });
  const applyFile = () => {
    if (!preview || stale || preview.unchanged) return;
    void run("apply", async () => {
      const result = await applySnapshot(raw, preview.current_revision);
      setReceipt(result);
      setPreview(null);
      onApplied();
    });
  };

  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Import & export</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">Save a complete JSON Registry snapshot, export a flat CSV for analysis, or preview a JSON import before applying it.</p></div>
    {error && <div role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>}
    <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="text-base">Export</CardTitle></CardHeader><CardContent className="space-y-3 px-4 py-4 sm:px-6"><p className="text-sm text-muted-foreground">JSON retains Registry structure and provenance. CSV is a flat view and cannot be imported back as a snapshot.</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!busy} onClick={() => void run("json", async () => download("registry-snapshot.json", JSON.stringify(await getSnapshot(), null, 2), "application/json"))}><Download className="size-4" />Download JSON</Button><Button variant="outline" disabled={!!busy} onClick={() => void run("csv", async () => download("registry-catalog.csv", await getSnapshotCsv(), "text/csv;charset=utf-8"))}><Download className="size-4" />Download CSV</Button></div></CardContent></Card>
    <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="text-base">Import JSON</CardTitle></CardHeader><CardContent className="space-y-4 px-4 py-4 sm:px-6"><div className="space-y-2"><label htmlFor="registry-snapshot-file" className="text-sm font-medium">Choose a Registry JSON snapshot or legacy V1 config</label><Input id="registry-snapshot-file" type="file" accept=".json,application/json" disabled={!!busy} onChange={event => void choose(event.target.files?.[0])} /><p className="text-xs text-muted-foreground">Maximum 4 MiB. Preview validates the original file on the server.</p></div>{filename && <p className="break-all text-xs text-muted-foreground">Selected: {filename}</p>}<Button disabled={!raw || !!busy} onClick={previewFile}><Upload className="size-4" />{preview ? "Refresh preview" : "Preview import"}</Button>
      {preview && <div className="space-y-4 rounded-sm border p-3 sm:p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">Import preview</h3><Badge variant={preview.unchanged ? "success" : "secondary"}>{preview.unchanged ? "No changes" : "Changes found"}</Badge><span className="text-xs text-muted-foreground">{preview.source_format}</span></div><p className="break-all text-xs text-muted-foreground">Current revision: {preview.current_revision} · Imported revision: {preview.imported_revision}</p><div className="grid gap-2 sm:grid-cols-2">{sections.map(section => { const diff = preview.changes[section]; return <div key={section} className="min-w-0 rounded-sm border p-3"><p className="text-sm font-medium capitalize">{section}</p><p className="text-xs text-muted-foreground">{diff.added} added · {diff.updated} updated · {diff.removed} removed</p>{diff.details.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer">Show changes</summary><ul className="mt-2 max-h-32 space-y-1 overflow-auto">{diff.details.map((item, index) => <li key={`${item.id}/${index}`} className="break-all font-mono">{item.change}: {item.id}</li>)}</ul>{diff.truncated && <p className="mt-1 text-muted-foreground">More changes exist; counts above include them.</p>}</details>}</div>; })}</div><p className="text-sm">Default naming: {preview.changes.default_naming.changed ? `${preview.changes.default_naming.before} → ${preview.changes.default_naming.after}` : "unchanged"}</p>{stale && <p role="status" className="text-xs text-destructive">This preview is stale. Refresh it before applying.</p>}<Button disabled={!!busy || stale || preview.unchanged} onClick={applyFile}>Apply import</Button><p className="text-xs text-muted-foreground">The server checks the current revision and creates a backup before a changed import.</p></div>}
      {receipt && <div role="status" className="space-y-1 rounded-sm border border-chart-success/40 bg-chart-success/10 p-3 text-sm"><p className="font-medium">{receipt.unchanged ? "Snapshot unchanged" : "Import applied"}</p><p className="break-all text-xs">Revision: {receipt.revision}</p><p className="break-all text-xs">Backup: {receipt.backup || "No backup path returned"}</p></div>}
    </CardContent></Card>
  </div>;
}
