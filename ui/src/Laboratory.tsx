import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, FileJson2, Folder, Search, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Campaign, Group, Model } from "./demo";
import { loadHarnessCatalog, parseNewmanReport, prepareReplay, type HarnessCatalog, type HarnessRequest, type RunRecord } from "./harness";
import HarnessTargets from "./HarnessTargets";
import HarnessRunView from "./HarnessRunView";
import { selectionCounts, setVisibleSelection } from "./selection";
import { defaultViewOptions, updateViewOverride, ViewControls, type ViewOptions } from "./ViewOptions";

type Props = {
  models: Model[]; groups: Group[]; campaigns: Campaign[]; onCampaigns: (rows: Campaign[]) => void;
  preferences?: ViewOptions; harnessRuns?: RunRecord[]; onHarnessRuns?: (runs: RunRecord[]) => void;
};
type Step = "tests" | "targets" | "review";
type Page = "prepare" | "runs" | "detail";
const sourceUrl = "https://github.com/maximhq/bifrost/blob/6493abd3d1422c9bfde95f242fd57b38e73ce881/tests/e2e/api/collections/provider-harness.json";
const sizeClass = { small: "min-[560px]:grid-cols-2 xl:grid-cols-4", medium: "min-[560px]:grid-cols-2 xl:grid-cols-3", large: "lg:grid-cols-2" };

export default function Laboratory({ models, groups, preferences = defaultViewOptions, harnessRuns, onHarnessRuns }: Props) {
  const topRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [catalog, setCatalog] = useState<HarnessCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState<Page>("prepare");
  const [step, setStep] = useState<Step>("tests");
  const [mode, setMode] = useState<"all" | "custom">("all");
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [folderSearch, setFolderSearch] = useState("");
  const [folderLimit, setFolderLimit] = useState(18);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useState("");
  const [requestLimit, setRequestLimit] = useState(30);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [selectedAccessIds, setSelectedAccessIds] = useState<string[]>([]);
  const [localRuns, setLocalRuns] = useState<RunRecord[]>([]);
  const runs = harnessRuns ?? localRuns;
  const saveRuns = onHarnessRuns ?? setLocalRuns;
  const [activeRecord, setActiveRecord] = useState<RunRecord | null>(null);
  const [autoplayReplay, setAutoplayReplay] = useState(false);
  const [preview, setPreview] = useState<HarnessRequest[] | null>(null);
  const [importError, setImportError] = useState("");
  const [override, setOverride] = useState<Partial<ViewOptions>>({});
  const view = { ...preferences, ...override };

  useEffect(() => { let alive = true; setLoadError(""); loadHarnessCatalog().then(value => { if (alive) setCatalog(value); }).catch(error => { if (alive) setLoadError(error instanceof Error ? error.message : "Could not load the harness collection."); }); return () => { alive = false; }; }, [reload]);
  useEffect(() => { topRef.current?.scrollIntoView({ block: "start" }); }, [step, page]);

  const selectedRequests = useMemo(() => !catalog ? [] : mode === "all" ? catalog.requests : catalog.requests.filter(request => customIds.includes(request.id)), [catalog, mode, customIds]);
  const selectedSet = useMemo(() => new Set(customIds), [customIds]);
  const selectedAccesses = useMemo(() => models.flatMap(model => model.accesses.filter(access => selectedAccessIds.includes(access.id)).map(access => ({ model, access }))), [models, selectedAccessIds]);
  const folder = catalog?.folders.find(item => item.id === folderId);
  const folderRequests = useMemo(() => catalog?.requests.filter(request => request.topFolderId === folderId) || [], [catalog, folderId]);
  const visibleRequests = useMemo(() => folderRequests.filter(request => `${request.name} ${request.method} ${request.url} ${request.folderPath.join(" ")}`.toLowerCase().includes(requestSearch.toLowerCase())), [folderRequests, requestSearch]);
  const visibleIds = visibleRequests.map(request => request.id);
  const counts = selectionCounts(customIds, visibleIds);
  const folders = useMemo(() => catalog?.folders.filter(item => item.name.toLowerCase().includes(folderSearch.toLowerCase())) || [], [catalog, folderSearch]);
  const matchingFolderSet = new Set(folders.map(item => item.id));
  const matchingFolderRequestIds = catalog?.requests.filter(request => matchingFolderSet.has(request.topFolderId)).map(request => request.id) || [];
  const folderCounts = selectionCounts(customIds, matchingFolderRequestIds);
  const inspected = catalog?.requests.find(request => request.id === inspectedId);
  const review = useMemo(() => {
    let ready = 0, needsReview = 0, skipped = 0;
    for (const request of selectedRequests) {
      if (request.skip) { skipped += selectedAccesses.length; continue; }
      for (const { model, access } of selectedAccesses) {
        if (prepareReplay(request, { provider: access.provider, model: model.id }).status === "ready") ready++;
        else needsReview++;
      }
    }
    return { ready, needsReview, skipped, total: selectedRequests.length * selectedAccesses.length };
  }, [selectedRequests, selectedAccesses]);

  const idsForFolder = (id: string) => catalog?.requests.filter(request => request.topFolderId === id).map(request => request.id) || [];
  const toggleFolder = (id: string) => { const ids = idsForFolder(id); setCustomIds(old => setVisibleSelection(old, ids, !ids.every(item => old.includes(item)))); };
  const openFolder = (id: string) => { setFolderId(id); setRequestSearch(""); setRequestLimit(30); setInspectedId(null); };
  const openRecord = (record: RunRecord, autoplay = false) => { setActiveRecord(record); setAutoplayReplay(autoplay); setPreview(null); setPage("detail"); };
  const openPreview = () => { setPreview(selectedRequests.slice(0, 24)); setActiveRecord(null); setPage("detail"); };
  const importRecord = (record: RunRecord, autoplay = false) => { saveRuns([record, ...runs]); openRecord(record, autoplay); };
  const importReport = async (file?: File) => {
    if (!file) return;
    setImportError("");
    try {
      if (file.size > 25_000_000) throw new Error("Newman report exceeds 25 MB");
      const record = parseNewmanReport(await file.text(), catalog || undefined);
      if (!record.executions.length) throw new Error("Newman report contains no executions");
      importRecord(record);
    }
    catch (error) { setImportError(error instanceof Error ? error.message : "The file is not a valid Newman JSON report."); }
  };
  const loadDemo = async () => {
    setImportError("");
    try {
      const response = await fetch("/harness-demo-report.json");
      if (!response.ok) throw new Error("Recorded loopback demo report is unavailable.");
      const report = parseNewmanReport(await response.text(), catalog || undefined);
      if (!report.executions.length) throw new Error("Recorded loopback demo has no executions");
      importRecord({ ...report, id: `loopback-${report.id}`, demoProvenance: {
        kind: "recorded-loopback",
        runner: "newman@6.2.1",
        sourceCommit: catalog?.source.commit,
        sourceSha256: catalog?.source.sha256,
        description: "Three official harness requests recorded against an isolated loopback stub. Responses are synthetic; no Bifrost gateway or provider was tested. One failure is deliberate.",
      } }, true);
    } catch (error) { setImportError(error instanceof Error ? error.message : "Could not load the demo report."); }
  };

  if (page === "detail" && (activeRecord || preview)) return <div ref={topRef}><HarnessRunView key={activeRecord?.id || "preview"} record={activeRecord || undefined} preview={preview || undefined} autoplay={autoplayReplay} sourceLabel={activeRecord ? activeRecord.demoProvenance?.description || `Imported Newman report · ${activeRecord.summary.total} executions` : `First ${preview?.length || 0} of ${selectedRequests.length} selected source requests · no provider calls`} onBack={() => setPage(activeRecord ? "runs" : "prepare")} /></div>;

  return <div ref={topRef} className="min-w-0 space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Laboratory</h2><Badge variant="outline">Bifrost API harness</Badge></div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Choose source requests and exact accesses. Preview requests here; inspect recorded responses and checks from a Newman report.</p></div><a className="text-xs text-primary underline underline-offset-2" href={sourceUrl} target="_blank" rel="noreferrer">Pinned source ↗</a></header>
    <nav className="flex flex-wrap items-center gap-2 border-b pb-2" aria-label="Laboratory views"><Button aria-pressed={page === "prepare"} variant={page === "prepare" ? "secondary" : "ghost"} onClick={() => setPage("prepare")}>Prepare run</Button><Button aria-pressed={page === "runs"} variant={page === "runs" ? "secondary" : "ghost"} onClick={() => setPage("runs")}>Runs <Badge variant="outline">{runs.length}</Badge></Button><input ref={importRef} type="file" accept=".json,application/json" className="hidden" aria-label="Import Newman JSON report" onChange={event => { void importReport(event.target.files?.[0]); event.target.value = ""; }} /><Button className="sm:ml-auto" variant="outline" size="sm" onClick={() => importRef.current?.click()}><Upload className="size-4" />Import Newman JSON</Button></nav>
    {importError && <p role="alert" className="rounded-sm border border-destructive p-3 text-sm text-destructive">{importError}</p>}
    {!catalog && !loadError && <p className="rounded-sm border p-5 text-sm text-muted-foreground">Loading pinned Bifrost collection…</p>}
    {loadError && <div role="alert" className="rounded-sm border border-destructive p-4 text-sm"><p>{loadError}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => setReload(value => value + 1)}>Retry loading</Button></div>}
    {page === "runs" && <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Recorded runs</h3><p className="text-xs text-muted-foreground">One card per Newman report. Results remain in browser memory.</p></div><Button variant="outline" size="sm" onClick={() => { void loadDemo(); }}>Open recorded loopback demo</Button></div>{runs.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{runs.map(record => <Card key={record.id} className="gap-2 py-4"><CardHeader className="px-4"><CardTitle className="break-words text-sm">{record.demoProvenance ? "Loopback demo" : "Newman report"}</CardTitle><p className="text-xs text-muted-foreground">{new Date(record.importedAt).toLocaleString()}</p></CardHeader><CardContent className="space-y-3 px-4"><p className="text-xs text-muted-foreground">{record.summary.total} executions</p><div className="flex flex-wrap gap-1"><Badge variant="success">{record.summary.passed} passed</Badge><Badge variant="destructive">{record.summary.failed} failed</Badge><Badge variant="outline">{record.summary.unverified} unverified</Badge></div><div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => openRecord(record)}>Open run <ArrowRight className="size-4" /></Button></div></CardContent></Card>)}</div> : <div className="rounded-sm border border-dashed p-6 text-sm text-muted-foreground">No reports yet. Import a Newman JSON export or open the recorded loopback demo.</div>}</section>}
    {page === "prepare" && catalog && <>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border bg-muted/30 p-3 text-xs"><span><strong>{catalog.requestCount.toLocaleString()}</strong> source requests · <strong>{catalog.folders.length}</strong> folders · Bifrost <code>{catalog.source.commit.slice(0, 7)}</code></span><span className="break-all text-muted-foreground">SHA-256 {catalog.source.sha256.slice(0, 12)}…</span></div>
      <nav className="flex flex-wrap gap-2" aria-label="Preparation steps">{([["tests", "1 · Native tests"], ["targets", "2 · Targets"], ["review", "3 · Review"]] as const).map(([value, label]) => <Button key={value} size="sm" aria-pressed={step === value} variant={step === value ? "secondary" : "outline"} onClick={() => setStep(value)}>{label}</Button>)}</nav>
      {step === "tests" && <section className="min-w-0 space-y-4" aria-label="Native Bifrost tests"><div><h3 className="text-sm font-semibold">Native Bifrost tests</h3><p className="text-xs text-muted-foreground">Names, bodies, paths and assertions come from the pinned Postman collection. Selection is a plan, not a result.</p></div><div className="flex flex-wrap items-center gap-2"><Button variant={mode === "all" ? "secondary" : "outline"} aria-pressed={mode === "all"} onClick={() => setMode("all")}>All tests</Button><Button variant={mode === "custom" ? "secondary" : "outline"} aria-pressed={mode === "custom"} onClick={() => setMode("custom")}>Custom</Button><Badge variant="outline">{selectedRequests.length.toLocaleString()} / {catalog.requestCount.toLocaleString()} selected</Badge></div>
        {mode === "custom" && <div className="min-w-0 space-y-4">{!folder ? <><div className="flex flex-wrap items-center gap-2"><div className="relative min-w-0 basis-full grow sm:basis-48"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search harness folders" placeholder="Search folders" value={folderSearch} onChange={event => { setFolderSearch(event.target.value); setFolderLimit(18); }} className="pl-9" /></div><ViewControls value={view} onChange={next => setOverride(old => updateViewOverride(preferences, old, next))} onReset={() => setOverride({})} scope="Harness folders" fields={["metadata"]} /></div><div className="flex flex-wrap items-center gap-2 rounded-sm border bg-muted/30 p-3 text-xs"><Checkbox aria-label="Select all requests in matching folders" disabled={!matchingFolderRequestIds.length} checked={folderCounts.visibleSelected === 0 ? false : folderCounts.visibleSelected === folderCounts.visibleTotal ? true : "indeterminate"} onCheckedChange={() => setCustomIds(old => setVisibleSelection(old, matchingFolderRequestIds, folderCounts.visibleSelected !== matchingFolderRequestIds.length))} /><span>{folderCounts.visibleSelected}/{folderCounts.visibleTotal} requests in matching folders selected · {folderCounts.totalSelected} total{folderCounts.hiddenSelected ? ` · ${folderCounts.hiddenSelected} outside this search` : ""}</span></div>{folders.length ? view.layout === "grid" ? <div className={`grid grid-cols-1 gap-3 ${sizeClass[view.size]}`}>{folders.slice(0, folderLimit).map(item => { const ids = idsForFolder(item.id); const checked = ids.filter(id => selectedSet.has(id)).length; return <Card key={item.id} className="min-w-0 gap-2 py-4"><CardHeader className="px-4"><div className="flex min-w-0 items-start gap-2"><Checkbox aria-label={`Select all requests in ${item.name}`} checked={checked === 0 ? false : checked === ids.length ? true : "indeterminate"} onCheckedChange={() => toggleFolder(item.id)} /><div className="min-w-0 flex-1"><CardTitle className="break-words text-sm">{item.name}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{view.metadata && `${item.requestCount} requests · `}{checked} selected</p></div><Folder className="size-4 shrink-0 text-muted-foreground" /></div></CardHeader><CardContent className="px-4"><Button variant="outline" size="sm" onClick={() => openFolder(item.id)}>Browse requests <ArrowRight className="size-4" /></Button></CardContent></Card>; })}</div> : <div className="max-w-full overflow-x-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Folder</TableHead><TableHead>Requests</TableHead><TableHead>Selected</TableHead><TableHead>Browse</TableHead></TableRow></TableHeader><TableBody>{folders.slice(0, folderLimit).map(item => { const ids = idsForFolder(item.id); const checked = ids.filter(id => selectedSet.has(id)).length; return <TableRow key={item.id}><TableCell><Checkbox aria-label={`Select all requests in ${item.name}`} checked={checked === 0 ? false : checked === ids.length ? true : "indeterminate"} onCheckedChange={() => toggleFolder(item.id)} /></TableCell><TableCell className="min-w-40 font-medium">{item.name}</TableCell><TableCell>{item.requestCount}</TableCell><TableCell>{checked}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => openFolder(item.id)}>Open <ArrowRight className="size-4" /></Button></TableCell></TableRow>; })}</TableBody></Table></div> : <p className="rounded-sm border p-4 text-sm text-muted-foreground">No matching folders.</p>}{folderLimit < folders.length && <Button variant="outline" size="sm" onClick={() => setFolderLimit(value => value + 18)}>Show more folders ({folders.length - folderLimit} remaining)</Button>}</> : <><div className="flex flex-wrap items-center justify-between gap-2"><div><Button variant="ghost" size="sm" onClick={() => setFolderId(null)}><ChevronLeft className="size-4" />All folders</Button><h4 className="mt-1 text-base font-semibold">{folder.name}</h4><p className="text-xs text-muted-foreground">{folder.requestCount} source requests</p></div><Button variant="outline" size="sm" onClick={() => toggleFolder(folder.id)}>{folderRequests.every(request => selectedSet.has(request.id)) ? "Deselect folder" : "Select folder"}</Button></div><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search requests in folder" placeholder="Name, path, method or endpoint" value={requestSearch} onChange={event => { setRequestSearch(event.target.value); setRequestLimit(30); }} className="pl-9" /></div><div className="flex flex-wrap items-center gap-2 rounded-sm border bg-muted/30 p-3 text-xs"><Checkbox aria-label="Select all matching requests" disabled={!visibleIds.length} checked={counts.visibleSelected === 0 ? false : counts.visibleSelected === counts.visibleTotal ? true : "indeterminate"} onCheckedChange={() => setCustomIds(old => setVisibleSelection(old, visibleIds, counts.visibleSelected !== visibleIds.length))} /><span>{counts.visibleSelected}/{counts.visibleTotal} matching selected · {counts.totalSelected} total{counts.hiddenSelected ? ` · ${counts.hiddenSelected} outside this view` : ""}</span></div><div className="flex justify-end"><ViewControls value={view} onChange={next => setOverride(old => updateViewOverride(preferences, old, next))} onReset={() => setOverride({})} scope="Harness requests" fields={["metadata"]} /></div>
              {visibleRequests.length ? view.layout === "grid" ? <div className={`grid grid-cols-1 gap-2 ${sizeClass[view.size]}`}>{visibleRequests.slice(0, requestLimit).map(request => <Card key={request.id} className="min-w-0 gap-2 py-3"><CardContent className="min-w-0 space-y-2 px-3"><div className="flex items-start gap-2"><Checkbox className="mt-0.5" aria-label={`Select ${request.name}`} checked={selectedSet.has(request.id)} onCheckedChange={checked => setCustomIds(old => setVisibleSelection(old, [request.id], checked === true))} /><div className="min-w-0 flex-1"><p className="break-words text-xs font-medium">{request.name}</p>{view.metadata && <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{request.method} {request.url}</p>}</div></div><div className="flex flex-wrap items-center justify-between gap-2">{request.skip ? <Badge variant="outline">Skipped</Badge> : <span />}<Button variant="outline" size="sm" onClick={() => setInspectedId(request.id)}>Inspect</Button></div></CardContent></Card>)}</div> : <div className="max-w-full overflow-x-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Request</TableHead>{view.metadata && <TableHead>Method / URL</TableHead>}<TableHead>Detail</TableHead></TableRow></TableHeader><TableBody>{visibleRequests.slice(0, requestLimit).map(request => <TableRow key={request.id}><TableCell><Checkbox aria-label={`Select ${request.name}`} checked={selectedSet.has(request.id)} onCheckedChange={checked => setCustomIds(old => setVisibleSelection(old, [request.id], checked === true))} /></TableCell><TableCell className="min-w-40 text-xs font-medium">{request.name}{request.skip && <Badge className="ml-1" variant="outline">Skipped</Badge>}</TableCell>{view.metadata && <TableCell className="min-w-40 break-all font-mono text-xs">{request.method} {request.url}</TableCell>}<TableCell><Button variant="ghost" size="sm" onClick={() => setInspectedId(request.id)}>Inspect</Button></TableCell></TableRow>)}</TableBody></Table></div> : <p className="rounded-sm border p-4 text-sm text-muted-foreground">No matching requests in this folder.</p>}
              {requestLimit < visibleRequests.length && <Button variant="outline" size="sm" onClick={() => setRequestLimit(value => value + 30)}>Show more ({visibleRequests.length - requestLimit} remaining)</Button>}
              {inspected && <Card className="min-w-0 gap-2 py-4"><CardHeader className="px-4"><CardTitle className="break-words text-sm">{inspected.name}</CardTitle><p className="break-words text-xs text-muted-foreground">{inspected.folderPath.join(" / ")}</p></CardHeader><CardContent className="min-w-0 space-y-3 px-4 text-xs"><p className="break-all font-mono">{inspected.method} {inspected.url}</p><div><strong>Source assertions ({inspected.assertions.length})</strong>{inspected.assertions.length ? <ul className="mt-1 list-inside list-disc space-y-1">{inspected.assertions.map((assertion, index) => <li key={index}>{assertion}</li>)}</ul> : <p className="mt-1 text-muted-foreground">None in this item.</p>}</div><details><summary className="cursor-pointer font-medium">Request body</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted p-3">{inspected.rawBody || `Body mode: ${inspected.bodyMode || "none"}`}</pre></details>{inspected.preview && <Badge variant="warning">Preview gated in source</Badge>}{inspected.skip && <Badge variant="outline">Skipped in source</Badge>}</CardContent></Card>}</>}</div>}
        <div className="flex justify-end"><Button disabled={!selectedRequests.length} onClick={() => setStep("targets")}>Choose targets <ArrowRight className="size-4" /></Button></div></section>}
      {step === "targets" && <section className="space-y-4" aria-label="Choose target accesses"><div><h3 className="text-sm font-semibold">Choose exact accesses</h3><p className="text-xs text-muted-foreground">Select each provider access once. Exact access IDs are retained; changing a source request to another model needs review.</p></div><HarnessTargets models={models} groups={groups} selectedAccessIds={selectedAccessIds} onChange={setSelectedAccessIds} preferences={preferences} /><div className="flex flex-wrap justify-between gap-2"><Button variant="outline" onClick={() => setStep("tests")}>Back to tests</Button><Button disabled={!selectedAccessIds.length || !selectedRequests.length} onClick={() => setStep("review")}>Review plan <ArrowRight className="size-4" /></Button></div></section>}
      {step === "review" && <section className="space-y-4" aria-label="Review harness plan"><div><h3 className="text-sm font-semibold">Review plan</h3><p className="text-xs text-muted-foreground">Official requests contain provider and model specific values. A different access needs review before an actual Newman run.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{([["Source requests", selectedRequests.length], ["Exact accesses", selectedAccesses.length], ["Direct matches", review.ready], ["Needs review", review.needsReview], ["Skipped in source", review.skipped]] as const).map(([label, count]) => <Card key={label} className="gap-1 py-3"><CardContent className="px-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold">{count.toLocaleString()}</p></CardContent></Card>)}</div><p className="text-xs text-muted-foreground">{review.total.toLocaleString()} request × access combinations · {review.skipped.toLocaleString()} skipped by source. No API call is made from this prototype.</p><details className="rounded-sm border p-3 text-xs"><summary className="cursor-pointer font-medium">Selected access IDs</summary><div className="mt-2 flex flex-wrap gap-1">{selectedAccesses.map(({ access }) => <Badge key={access.id} variant="outline" className="max-w-full break-all font-mono">{access.id}</Badge>)}</div></details><div className="flex flex-wrap items-center justify-between gap-2"><Button variant="outline" onClick={() => setStep("targets")}>Back to targets</Button><Button disabled={!selectedRequests.length} onClick={openPreview}><FileJson2 className="size-4" />Preview first {Math.min(24, selectedRequests.length)} source requests</Button></div><p className="text-xs text-muted-foreground">Preview is capped at 24 requests. Import a Newman JSON report to replay observed results and inspect responses.</p></section>}
    </>}
  </div>;
}
