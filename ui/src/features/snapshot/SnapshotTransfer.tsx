import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "../../data/api";
import { applySnapshot, getSnapshot, getSnapshotCsv, previewSnapshot, type SnapshotPreview, type SnapshotReceipt } from "./snapshot-api";
import { useCopy } from "../../lib/locale";

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
  const copy = useCopy();
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
      setError(copy("Registry changed since the preview. Refresh it, review the diff, then apply again.", "Le Registry a changé depuis l’aperçu. Actualisez-le, vérifiez les différences, puis appliquez de nouveau."));
      return;
    }
    setError(cause instanceof Error ? cause.message : copy("Snapshot request failed.", "La demande d’instantané a échoué."));
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
    if (file.size > 4 * 1024 * 1024) { setError(copy("Choose a JSON file smaller than 4 MiB.", "Choisissez un fichier JSON de moins de 4 Mio.")); return; }
    try {
      const content = await file.text();
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(copy("The file must contain a JSON object.", "Le fichier doit contenir un objet JSON."));
      setRaw(content); // Keep the original bytes for server-side duplicate-key validation.
      setFilename(file.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : copy("Invalid JSON file.", "Le fichier JSON est invalide.")); }
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

  const sectionLabels: Record<(typeof sections)[number], string> = { models: copy("Models", "Modèles"), groups: copy("Groups", "Groupes"), policies: copy("Policies", "Politiques"), references: copy("References", "Références"), accesses: copy("Accesses", "Accès"), sources: copy("Sources", "Sources") };
  return <div className="space-y-5"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copy("Import and export", "Import et export")}</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">{copy("Save a complete JSON Registry snapshot, export a flat CSV for analysis, or preview a JSON import before applying it.", "Enregistrez un instantané Registry complet en JSON, exportez un CSV à plat pour l’analyse ou prévisualisez un import JSON avant de l’appliquer.")}</p></div>
    {error && <div role="alert" className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">{error}</div>}
    <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="text-base">{copy("Export", "Exporter")}</CardTitle></CardHeader><CardContent className="space-y-3 px-4 py-4 sm:px-6"><p className="text-sm text-muted-foreground">{copy("JSON retains Registry structure and provenance. CSV is a flat view and cannot be imported back as a snapshot.", "Le JSON conserve la structure Registry et la provenance. Le CSV est une vue à plat qui ne peut pas être réimportée comme instantané.")}</p><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!!busy} onClick={() => void run("json", async () => download("registry-snapshot.json", JSON.stringify(await getSnapshot(), null, 2), "application/json"))}><Download className="size-4" />{copy("Download JSON", "Télécharger JSON")}</Button><Button variant="outline" disabled={!!busy} onClick={() => void run("csv", async () => download("registry-catalog.csv", await getSnapshotCsv(), "text/csv;charset=utf-8"))}><Download className="size-4" />{copy("Download CSV", "Télécharger CSV")}</Button></div></CardContent></Card>
    <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="text-base">{copy("Import JSON", "Importer du JSON")}</CardTitle></CardHeader><CardContent className="space-y-4 px-4 py-4 sm:px-6"><div className="space-y-2"><label htmlFor="registry-snapshot-file" className="text-sm font-medium">{copy("Choose a Registry JSON snapshot or legacy V1 config", "Choisissez un instantané Registry JSON ou une configuration V1 héritée")}</label><Input id="registry-snapshot-file" type="file" accept=".json,application/json" disabled={!!busy} onChange={event => void choose(event.target.files?.[0])} /><p className="text-xs text-muted-foreground">{copy("Maximum 4 MiB. Preview validates the original file on the server.", "Maximum : 4 Mio. L’aperçu valide le fichier original sur le serveur.")}</p></div>{filename && <p className="break-all text-xs text-muted-foreground">{copy("Selected:", "Sélectionné :")} {filename}</p>}<Button disabled={!raw || !!busy} onClick={previewFile}><Upload className="size-4" />{preview ? copy("Refresh preview", "Actualiser l’aperçu") : copy("Preview import", "Prévisualiser l’import")}</Button>
      {preview && <div className="space-y-4 rounded-sm border p-3 sm:p-4"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{copy("Import preview", "Aperçu de l’import")}</h3><Badge variant={preview.unchanged ? "success" : "secondary"}>{preview.unchanged ? copy("No changes", "Aucun changement") : copy("Changes found", "Changements détectés")}</Badge><span className="text-xs text-muted-foreground">{preview.source_format}</span></div><p className="break-all text-xs text-muted-foreground">{copy("Current revision:", "Révision actuelle :")} {preview.current_revision} · {copy("Imported revision:", "Révision importée :")} {preview.imported_revision}</p><div className="grid gap-2 sm:grid-cols-2">{sections.map(section => { const diff = preview.changes[section]; return <div key={section} className="min-w-0 rounded-sm border p-3"><p className="text-sm font-medium">{sectionLabels[section]}</p><p className="text-xs text-muted-foreground">{copy(`${diff.added} added · ${diff.updated} updated · ${diff.removed} removed`, `${diff.added} ajoutés · ${diff.updated} modifiés · ${diff.removed} supprimés`)}</p>{diff.details.length > 0 && <details className="mt-2 text-xs"><summary className="cursor-pointer">{copy("Show changes", "Afficher les changements")}</summary><ul className="mt-2 max-h-32 space-y-1 overflow-auto">{diff.details.map((item, index) => <li key={`${item.id}/${index}`} className="break-all font-mono">{item.change}: {item.id}</li>)}</ul>{diff.truncated && <p className="mt-1 text-muted-foreground">{copy("More changes exist; counts above include them.", "D’autres changements existent ; les compteurs ci-dessus les incluent.")}</p>}</details>}</div>; })}</div><p className="text-sm">{copy("Default naming:", "Format des noms par défaut :")} {preview.changes.default_naming.changed ? `${preview.changes.default_naming.before} → ${preview.changes.default_naming.after}` : copy("unchanged", "inchangé")}</p>{stale && <p role="status" className="text-xs text-destructive">{copy("This preview is stale. Refresh it before applying.", "Cet aperçu est périmé. Actualisez-le avant d’appliquer l’import.")}</p>}<Button disabled={!!busy || stale || preview.unchanged} onClick={applyFile}>{copy("Apply import", "Appliquer l’import")}</Button><p className="text-xs text-muted-foreground">{copy("The server checks the current revision and creates a backup before a changed import.", "Le serveur vérifie la révision actuelle et crée une sauvegarde avant d’appliquer un import modifié.")}</p></div>}
      {receipt && <div role="status" className="space-y-1 rounded-sm border border-chart-success/40 bg-chart-success/10 p-3 text-sm"><p className="font-medium">{receipt.unchanged ? copy("Snapshot unchanged", "Instantané inchangé") : copy("Import applied", "Import appliqué")}</p><p className="break-all text-xs">{copy("Revision:", "Révision :")} {receipt.revision}</p><p className="break-all text-xs">{copy("Backup:", "Sauvegarde :")} {receipt.backup || copy("No backup path returned", "Aucun chemin de sauvegarde fourni")}</p></div>}
    </CardContent></Card>
  </div>;
}
