import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "./api";
import { createCatalogReference, fieldTypes, getCatalog, matchCatalogReference, overrideCatalogField, parseCatalogValue, refreshCatalog, type Catalog, type CatalogAccess, type CatalogFieldName, type CatalogRecord } from "./catalog-api";

type Field = CatalogFieldName;
type Target = "reference" | "access";
type Edit = { target: Target; id: string; field: Field; value: string };
const has = (record: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(record, key);
const show = (value: unknown) => value == null ? "Unknown" : typeof value === "string" ? value || '""' : JSON.stringify(value);
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : "Never";
const draftValue = (value: unknown) => value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);

export default function CatalogMetadata({ onUnauthorized, onChanged, focus }: { onUnauthorized: () => void; onChanged: () => void; focus?: { target: "reference" | "access"; id: string } | null }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [mode, setMode] = useState<Target>(focus?.target || "access");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(focus?.id || "");
  const [matchId, setMatchId] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [newField, setNewField] = useState<Field>("name");
  const [newReference, setNewReference] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);

  const report = (cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) { onUnauthorized(); return; }
    if (cause instanceof ApiError && cause.status === 409) {
      setConflict(true);
      setError("The catalogue changed. Reload its revision, review your draft, then save again.");
      return;
    }
    setError(cause instanceof Error ? cause.message : "Catalogue request failed.");
  };
  const load = async () => {
    setBusy(true);
    try { const next = await getCatalog(); setCatalog(next); if (focus?.target === "access") setMatchId(next.accesses.find(access => access.id === focus.id)?.referenceId || ""); setConflict(false); setError(""); }
    catch (cause) { report(cause); }
    finally { setBusy(false); }
  };
  useEffect(() => { void load(); }, []);
  const mutate = async (work: (revision: string) => Promise<Catalog>, done?: () => void) => {
    if (!catalog || busy || conflict) return;
    setBusy(true);
    try { setCatalog(await work(catalog.revision)); setError(""); done?.(); onChanged(); }
    catch (cause) { report(cause); }
    finally { setBusy(false); }
  };

  const records = mode === "reference" ? catalog?.references || [] : catalog?.accesses || [];
  const term = query.trim().toLowerCase();
  const filtered = term ? records.filter(record => {
    const access = mode === "access" ? record as CatalogAccess : null;
    return [record.id, access?.provider, access?.model, record.fields.name?.value].some(value => String(value ?? "").toLowerCase().includes(term));
  }) : records;
  const visible = filtered.slice(0, 40);
  const selected = records.find(record => record.id === selectedId);
  const access = mode === "access" ? selected as CatalogAccess | undefined : undefined;
  const fields = selected ? Object.entries(selected.fields).sort(([a], [b]) => a.localeCompare(b)) : [];
  const missing = (Object.keys(fieldTypes) as Field[]).filter(field => selected && !has(selected.fields, field));
  const suggestions = matchId.trim() ? (catalog?.references || []).filter(reference => reference.id.toLowerCase().includes(matchId.trim().toLowerCase())).slice(0, 8) : [];

  const beginEdit = (record: CatalogRecord, field: Field) => {
    const current = record.fields[field]?.value;
    const value = current == null && fieldTypes[field] === "boolean" ? "false" : current == null && fieldTypes[field] === "array" ? "[]" : current == null && (fieldTypes[field] === "object" || fieldTypes[field] === "json") ? "{}" : draftValue(current);
    setEdit({ target: mode, id: record.id, field, value });
    setError("");
  };
  const saveEdit = () => {
    if (!edit) return;
    let value: unknown;
    try { value = parseCatalogValue(edit.field, edit.value); } catch (cause) { setError((cause as Error).message); return; }
    void mutate(revision => overrideCatalogField(revision, edit.target, edit.id, edit.field, value), () => setEdit(null));
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Sources & references</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">Imported facts, manual corrections, and explicit access matches. Reference entries cannot be granted to a key.</p></div><Button variant="outline" disabled={busy || !catalog || conflict} onClick={() => void mutate(revision => refreshCatalog(revision))}><RotateCcw className="size-4" />Refresh sources</Button></div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm"><span>{error}</span><Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>{conflict ? "Reload revision" : "Retry"}</Button></div>}
    {!catalog ? <Card><CardContent className="p-6 text-sm text-muted-foreground">{busy ? "Loading catalogue…" : "Catalogue unavailable."}</CardContent></Card> : <>
      <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="text-base">Sources</CardTitle></CardHeader><CardContent className="space-y-3 px-4 py-4 sm:px-6">{catalog.sources.length ? catalog.sources.map(source => <div key={source.id} className="flex flex-wrap items-center justify-between gap-2 rounded-sm border p-3"><div className="min-w-0 text-sm"><strong className="break-all">{source.id}</strong><p className="text-xs text-muted-foreground">Last success: {date(source.lastSuccess)} · Last attempt: {date(source.lastAttempt)}</p>{source.error && <p className="mt-1 break-words text-xs text-destructive" role="status">{source.error}</p>}</div><Button variant="outline" size="sm" disabled={busy || conflict} onClick={() => void mutate(revision => refreshCatalog(revision, [source.id]))}>Refresh {source.id}</Button></div>) : <p className="text-sm text-muted-foreground">No sources reported yet.</p>}</CardContent></Card>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"><section className="min-w-0 space-y-3"><div className="flex flex-wrap gap-2"><Button variant={mode === "access" ? "default" : "outline"} size="sm" onClick={() => { setMode("access"); setSelectedId(""); setQuery(""); setEdit(null); setNewReference(null); }}>Provider accesses ({catalog.accesses.length})</Button><Button variant={mode === "reference" ? "default" : "outline"} size="sm" onClick={() => { setMode("reference"); setSelectedId(""); setQuery(""); setEdit(null); }}>References ({catalog.references.length})</Button></div>{mode === "reference" && <><Button variant="outline" size="sm" onClick={() => setNewReference({ id: "", name: "" })}>New reference</Button>{newReference && <form className="space-y-2 rounded-sm border bg-card p-3" onSubmit={event => { event.preventDefault(); const { id, name } = newReference; if (!id.trim() || id !== id.trim() || !name.trim()) { setError("Enter an exact ID without surrounding spaces and a name."); return; } if (catalog.references.some(reference => reference.id === id)) { setError("A reference with this ID already exists."); return; } void mutate(revision => createCatalogReference(revision, id, name), () => { setSelectedId(id); setQuery(""); setNewReference(null); }); }}><p className="text-sm font-medium">Create a reference-only fiche</p><label htmlFor="new-reference-id" className="block text-xs">Exact reference ID</label><Input id="new-reference-id" value={newReference.id} onChange={event => setNewReference({ ...newReference, id: event.target.value })} spellCheck={false} required /><label htmlFor="new-reference-name" className="block text-xs">Name</label><Input id="new-reference-name" value={newReference.name} onChange={event => setNewReference({ ...newReference, name: event.target.value })} required /><p className="text-xs text-muted-foreground">Add further metadata after creation. A reference alone grants no access.</p><div className="flex gap-2"><Button type="submit" size="sm" disabled={busy || conflict}>Create reference</Button><Button type="button" size="sm" variant="ghost" onClick={() => setNewReference(null)}>Cancel</Button></div></form>}</>}<div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label={`Search ${mode === "access" ? "provider accesses" : "references"}`} placeholder="Search exact ID, name or provider…" className="pl-9" value={query} onChange={event => setQuery(event.target.value)} /></div><p className="text-xs text-muted-foreground">Showing {visible.length} of {filtered.length} matching {mode === "access" ? "accesses" : "references"}. Search to narrow the list.</p><div className="max-h-[36rem] space-y-2 overflow-auto">{visible.map(record => { const item = mode === "access" ? record as CatalogAccess : null; return <button key={record.id} type="button" onClick={() => { setSelectedId(record.id); setMatchId(item?.referenceId || ""); setEdit(null); }} className={`w-full min-w-0 rounded-sm border p-3 text-left text-sm hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-primary ${selectedId === record.id ? "border-primary bg-primary/5" : "bg-card"}`}><span className="flex flex-wrap items-center gap-2"><strong className="break-all">{show(record.fields.name?.value ?? record.id)}</strong>{item && <Badge variant={item.configured ? "success" : "secondary"}>{item.configured ? "Configured" : "Discovered"}</Badge>}</span><span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{record.id}</span>{item && <span className="mt-1 block break-all text-xs text-muted-foreground">{item.provider} · {item.model}{item.referenceId ? ` · Ref: ${item.referenceId}` : " · No reference match"}</span>}</button>; })}{!visible.length && <p className="rounded-sm border border-dashed p-5 text-sm text-muted-foreground">No matching entries.</p>}</div></section>
      <section className="min-w-0">{selected ? <Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="break-all text-base">{show(selected.fields.name?.value ?? selected.id)}</CardTitle><p className="break-all font-mono text-xs text-muted-foreground">Exact {mode === "access" ? "access" : "reference"} ID: {selected.id}</p>{mode === "reference" && <Badge variant="outline" className="w-fit">Metadata only · cannot grant permissions</Badge>}</CardHeader><CardContent className="space-y-5 px-4 py-4 sm:px-6">
        {access && <div className="space-y-2 rounded-sm border p-3"><h3 className="text-sm font-semibold">Reference match {access.mappingManual && <Badge variant="secondary">Manual</Badge>}</h3><p className="break-all text-xs text-muted-foreground">Current: {access.referenceId || "Unlinked"}. Matching is explicit and uses the exact reference ID.</p>{access.matchConflict && <p role="status" className="break-words text-xs text-destructive">Source match conflict: {access.matchConflict}. The current mapping was kept.</p>}<label htmlFor="catalog-match-id" className="text-xs font-medium">Exact reference ID</label><Input id="catalog-match-id" value={matchId} onChange={event => setMatchId(event.target.value)} placeholder="Enter or choose a reference ID" spellCheck={false} />{suggestions.length > 0 && <div className="max-h-32 space-y-1 overflow-auto">{suggestions.map(reference => <Button key={reference.id} type="button" variant="ghost" size="sm" className="h-auto w-full justify-start whitespace-normal break-all font-mono text-xs" onClick={() => setMatchId(reference.id)}>{reference.id}</Button>)}</div>}<div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || conflict || !matchId || matchId === access.referenceId || !catalog.references.some(reference => reference.id === matchId)} onClick={() => void mutate(revision => matchCatalogReference(revision, access.id, matchId))}>Link exact reference <ArrowRight className="size-3.5" /></Button><Button size="sm" variant="outline" disabled={busy || conflict || !access.referenceId} onClick={() => void mutate(revision => matchCatalogReference(revision, access.id, ""), () => setMatchId(""))}>Unlink</Button></div>{matchId && !catalog.references.some(reference => reference.id === matchId) && <p className="text-xs text-destructive">No reference has this exact ID.</p>}</div>}
        {mode === "reference" && <div className="space-y-2"><h3 className="text-sm font-semibold">Linked provider accesses</h3>{catalog.accesses.filter(item => item.referenceId === selected.id).slice(0, 40).map(item => <div key={item.id} className="rounded-sm border p-3 text-xs"><p className="break-all font-mono font-medium">{item.id}</p><p className="mt-1 text-muted-foreground">{item.provider} · {item.configured ? "Configured" : "Discovered"}</p><details className="mt-2"><summary className="cursor-pointer">Own access fields ({Object.keys(item.fields).length})</summary><div className="mt-2 space-y-1">{Object.entries(item.fields).map(([field, fact]) => <p key={field} className="break-words"><strong>{field.replaceAll("_", " ")}:</strong> {show(fact.value)} <span className="text-muted-foreground">· {fact.source} · {fact.kind}</span></p>)}</div></details><Button size="sm" variant="outline" className="mt-2" onClick={() => { setMode("access"); setSelectedId(item.id); setMatchId(item.referenceId || ""); setEdit(null); }}>Edit access metadata</Button></div>)}{!catalog.accesses.some(item => item.referenceId === selected.id) && <p className="text-xs text-muted-foreground">No access linked. This reference cannot be selected for permissions.</p>}{catalog.accesses.filter(item => item.referenceId === selected.id).length > 40 && <p className="text-xs text-muted-foreground">Showing 40 linked accesses.</p>}</div>}
        <div className="space-y-2"><h3 className="text-sm font-semibold">Metadata</h3>{fields.length ? fields.map(([field, fact]) => <div key={field} className="min-w-0 rounded-sm border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="break-all text-xs font-semibold">{field.replaceAll("_", " ")}</p><p className="mt-1 break-words font-mono text-sm">{show(fact.value)}</p><p className="mt-1 break-words text-xs text-muted-foreground">{fact.source} · {fact.kind === "observed" ? "Observed" : "Declared"} · {date(fact.updatedAt)}</p></div><div className="flex flex-wrap gap-1">{field in fieldTypes && <Button variant="outline" size="sm" disabled={busy || conflict} onClick={() => beginEdit(selected, field as Field)}>Edit</Button>}{has(selected.overrides, field) && <Button variant="ghost" size="sm" disabled={busy || conflict} onClick={() => void mutate(revision => overrideCatalogField(revision, mode, selected.id, field, null))}>Revert</Button>}</div></div>{has(selected.overrides, field) && <Badge variant="secondary" className="mt-2">Manual correction</Badge>}</div>) : <p className="text-sm text-muted-foreground">No metadata yet.</p>}</div>
        {missing.length > 0 && <div className="flex flex-wrap items-end gap-2"><label className="min-w-0 flex-1 text-xs font-medium">Add metadata field<select className="mt-1 flex h-9 w-full rounded-sm border bg-background px-2 text-sm" value={missing.includes(newField) ? newField : missing[0]} onChange={event => setNewField(event.target.value as Field)}>{missing.map(field => <option key={field} value={field}>{field.replaceAll("_", " ")}</option>)}</select></label><Button variant="outline" size="sm" disabled={busy || conflict} onClick={() => beginEdit(selected, missing.includes(newField) ? newField : missing[0])}>Edit field</Button></div>}
        {edit && edit.target === mode && edit.id === selected.id && <div className="space-y-2 rounded-sm border border-primary/30 bg-primary/5 p-3"><label htmlFor="catalog-field-value" className="text-sm font-medium">{edit.field.replaceAll("_", " ")} correction</label>{fieldTypes[edit.field] === "boolean" ? <select id="catalog-field-value" className="flex h-9 w-full rounded-sm border bg-background px-2 text-sm" value={edit.value} onChange={event => setEdit({ ...edit, value: event.target.value })}><option value="false">False</option><option value="true">True</option></select> : ["array", "object", "json"].includes(fieldTypes[edit.field]) ? <Textarea id="catalog-field-value" value={edit.value} onChange={event => setEdit({ ...edit, value: event.target.value })} spellCheck={false} /> : <Input id="catalog-field-value" type={fieldTypes[edit.field] === "number" ? "number" : "text"} value={edit.value} onChange={event => setEdit({ ...edit, value: event.target.value })} spellCheck={false} />}{["array", "object", "json"].includes(fieldTypes[edit.field]) ? <p className="text-xs text-muted-foreground">Enter a JSON {fieldTypes[edit.field] === "array" ? "array of strings" : fieldTypes[edit.field] === "json" ? "object or array" : "object"}.</p> : null}<div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || conflict} onClick={saveEdit}>Save correction</Button><Button size="sm" variant="ghost" onClick={() => setEdit(null)}>Cancel</Button></div></div>}
      </CardContent></Card> : <Card><CardContent className="p-6 text-sm text-muted-foreground">Choose an {mode === "access" ? "access" : "reference"} to inspect its facts and provenance.</CardContent></Card>}</section></div>
    </>}
  </div>;
}
