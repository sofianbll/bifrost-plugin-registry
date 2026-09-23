import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Braces, Check, CircleHelp, FlaskConical, ImagePlus, MessageSquare, Network, Pause, Play, Radio, RotateCcw, ScanEye, Search, ShieldCheck, Wrench, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ModelBrowser from "./ModelBrowser";
import { displayProvider } from "./BrandIcon";
import { defaultViewOptions, ViewControls, type ViewOptions } from "./ViewOptions";
import type { Campaign, Group, Model } from "./demo";
import { emptySelection, limitCells, planCells, resolveTargets, suiteForScenario, suites, updateViewOverride, type Cell, type LabSelection } from "./lab";

type Props = { models: Model[]; groups: Group[]; campaigns: Campaign[]; onCampaigns: (newCampaigns: Campaign[]) => void; preferences?: ViewOptions };
type Run = { cells: Cell[]; results: Campaign[]; index: number; concurrency: number };
const harnessUrl = "https://docs.getbifrost.ai/providers/test-harness-coverage";
const mockerUrl = "https://docs.getbifrost.ai/features/plugins/mocker";
const parserUrl = "https://docs.getbifrost.ai/features/plugins/jsonparser";

function toggle(values: string[], value: string) { return values.includes(value) ? values.filter(item => item !== value) : [...values, value]; }
function resultFor(cell: Cell): Campaign {
  const { target, suite } = cell;
  const fixtureFailure = cell.runnable && target.access.provider === "azure" && suite.id === "stream";
  const fixtureUnknown = cell.runnable && target.access.provider === "anthropic" && suite.id === "tools";
  const outcome: Campaign["outcome"] = !cell.runnable ? "Not run" : fixtureFailure ? "Fail" : fixtureUnknown ? "Inconclusive" : "Pass";
  const note = !cell.runnable ? cell.reason : fixtureFailure ? "Injected authentication failure fixture. Access or model capability was not measured."
    : fixtureUnknown ? "Injected timeout fixture. Cause cannot be assigned to model, provider, or gateway."
    : "Illustrative response fixture; no gateway or provider request was made.";
  return { id: `run-${crypto.randomUUID().slice(0, 8)}`, model: target.model.id, provider: target.access.provider, accessId: target.access.id, scenario: suite.name, outcome, date: new Date().toISOString().slice(0, 10), note };
}
function stoppedRows(run: Run): Campaign[] { return [...run.results, ...run.cells.slice(run.index).map(cell => resultFor({ ...cell, runnable: false, reason: "Cancelled before execution" }))]; }
function statusVariant(outcome: Campaign["outcome"]) { return outcome === "Pass" ? "success" : outcome === "Fail" ? "destructive" : outcome === "Inconclusive" ? "warning" : "secondary"; }
const suiteIcons = { chat: MessageSquare, stream: Radio, tools: Wrench, vision: ScanEye, json: Braces, embedding: Network, image: ImagePlus };
function SuiteIcon({ id }: { id: string }) { const Icon = suiteIcons[id as keyof typeof suiteIcons] || FlaskConical; return <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />; }
function surfaceNames(suite: { coveredProviders: string[] }) { return [...new Set(suite.coveredProviders.map(provider => provider === "google" || provider === "gemini" ? "Google AI Studio" : displayProvider(provider)))]; }

export default function Laboratory({ models, groups, campaigns, onCampaigns, preferences = defaultViewOptions }: Props) {
  const [selection, setSelection] = useState<LabSelection>(emptySelection);
  const [suiteIds, setSuiteIds] = useState<string[]>(["chat", "stream", "tools"]);
  const [suiteSearch, setSuiteSearch] = useState("");
  const [useFilter, setUseFilter] = useState("All uses");
  const [concurrency, setConcurrency] = useState(2);
  const [caseCeiling, setCaseCeiling] = useState(24);
  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const onCampaignsRef = useRef(onCampaigns);
  const [report, setReport] = useState<Campaign[] | null>(null);
  const [step, setStep] = useState<"catalog" | "compose">("catalog");
  const [suiteOverride, setSuiteOverride] = useState<Partial<ViewOptions>>({});
  const [reportOverride, setReportOverride] = useState<Partial<ViewOptions>>({});
  const suiteView = { ...preferences, ...suiteOverride };
  const reportView = { ...preferences, ...reportOverride };

  const selectedSuites = suites.filter(suite => suiteIds.includes(suite.id));
  const targets = useMemo(() => resolveTargets(models, groups, selection), [models, groups, selection]);
  const cells = useMemo(() => limitCells(planCells(targets, selectedSuites), caseCeiling), [targets, selectedSuites, caseCeiling]);
  const runnable = cells.filter(cell => cell.runnable).length;
  const skipped = cells.length - runnable;
  const allAccesses = models.flatMap(model => model.accesses.map(access => ({ model, access })));
  const providers = [...new Set(allAccesses.map(row => row.access.provider))].sort();
  const creators = [...new Set(models.map(model => model.creator).filter(Boolean))].sort();
  const categories = [...new Set(suites.map(suite => suite.use))];
  const visibleSuites = suites.filter(suite => (useFilter === "All uses" || suite.use === useFilter) && `${suite.name} ${suite.use} ${suite.endpoint}`.toLowerCase().includes(suiteSearch.toLowerCase()));
  const excluded = allAccesses.filter(row => selection.excludedAccessIds.includes(row.access.id));

  useEffect(() => { onCampaignsRef.current = onCampaigns; }, [onCampaigns]);
  useEffect(() => () => {
    if (!runRef.current) return;
    const interrupted = stoppedRows(runRef.current);
    runRef.current = null;
    onCampaignsRef.current(interrupted);
  }, []);

  useEffect(() => {
    if (!run) return;
    if (run.index >= run.cells.length) {
      runRef.current = null;
      onCampaigns(run.results);
      setReport(run.results);
      setRun(null);
      return;
    }
    const timer = window.setTimeout(() => {
      const current = runRef.current;
      if (!current) return;
      const nextRows = current.cells.slice(current.index, current.index + current.concurrency).map(resultFor);
      const next = { ...current, index: current.index + nextRows.length, results: [...current.results, ...nextRows] };
      runRef.current = next;
      setRun(next);
    }, 420);
    return () => window.clearTimeout(timer);
  }, [run, onCampaigns]);

  const setScope = (key: "modelIds" | "providerIds" | "groupIds" | "creators", value: string) => setSelection(old => ({ ...old, [key]: toggle(old[key], value) }));
  const cancel = () => {
    const current = runRef.current;
    if (!current) return;
    runRef.current = null;
    const stopped = stoppedRows(current);
    onCampaigns(stopped); setReport(stopped); setRun(null);
  };
  const start = () => { if (runnable && !runRef.current) { const next = { cells, results: [], index: 0, concurrency }; runRef.current = next; setReport(null); setRun(next); } };
  const rerunUnresolved = (rows: Campaign[]) => {
    const unresolved = rows.filter(row => (row.outcome === "Fail" || row.outcome === "Inconclusive") && suiteForScenario(row.scenario));
    const accessIds = [...new Set(unresolved.map(row => row.accessId))];
    const chosen = suites.filter(suite => unresolved.some(row => suiteForScenario(row.scenario)?.id === suite.id));
    const retry = planCells(allAccesses.filter(row => accessIds.includes(row.access.id)), chosen)
      .filter(cell => unresolved.some(row => row.accessId === cell.target.access.id && suiteForScenario(row.scenario)?.id === cell.suite.id));
    if (!retry.length) return;
    const next = { cells: retry, results: [], index: 0, concurrency };
    runRef.current = next;
    setReport(null); setStep("compose"); setRun(next);
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="text-xl font-semibold">Laboratory</h2><Badge variant="warning">Local simulation</Badge></div><p className="mt-1 text-sm text-muted-foreground">Plan capability checks across model accesses. Reports use fixed fixtures until Bifrost execution is connected.</p></div><a href={harnessUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline underline-offset-2">Bifrost harness coverage ↗</a></div>

    <div className="flex gap-1 border-b" aria-label="Laboratory steps"><Button aria-pressed={step === "catalog"} variant={step === "catalog" ? "secondary" : "ghost"} onClick={() => setStep("catalog")}>1 · Test catalog <Badge variant="outline">{suiteIds.length}</Badge></Button><Button aria-pressed={step === "compose"} variant={step === "compose" ? "secondary" : "ghost"} onClick={() => setStep("compose")}>2 · Batch plan <Badge variant="outline">{targets.length}</Badge></Button></div>

      {run && <Card className="gap-3 py-4" aria-live="polite"><CardContent><div className="flex items-center justify-between"><span className="text-sm font-medium">Simulating {run.index} / {run.cells.length} checks</span><Button size="sm" variant="outline" onClick={cancel}><Pause className="size-3" />Cancel</Button></div><div role="progressbar" aria-valuemin={0} aria-valuemax={run.cells.length} aria-valuenow={run.index} className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${run.cells.length ? run.index / run.cells.length * 100 : 0}%` }} /></div></CardContent></Card>}

    {step === "catalog" && <>
      <div className="grid gap-3 sm:grid-cols-3"><Card className="gap-2 py-4"><CardContent><span className="text-xs text-muted-foreground">Documented scenarios</span><p className="mt-1 text-2xl font-semibold">{suites.length}</p><p className="text-xs text-muted-foreground">Subset mapped from Postman/Newman</p></CardContent></Card><Card className="gap-2 py-4"><CardContent><span className="text-xs text-muted-foreground">Selected for batch</span><p className="mt-1 text-2xl font-semibold">{suiteIds.length}</p><p className="text-xs text-muted-foreground">Mixed usages are allowed</p></CardContent></Card><Card className="gap-2 py-4"><CardContent><span className="text-xs text-muted-foreground">Observed here</span><p className="mt-1 text-2xl font-semibold">0</p><p className="text-xs text-muted-foreground">No live gateway or provider checks</p></CardContent></Card></div>
      <div className="flex flex-wrap items-center gap-2"><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Search tests" placeholder="Search tests or endpoints" value={suiteSearch} onChange={event => setSuiteSearch(event.target.value)} className="pl-9" /></div><Select value={useFilter} onValueChange={setUseFilter}><SelectTrigger aria-label="Filter by use" className="min-w-36"><SelectValue /></SelectTrigger><SelectContent>{["All uses", ...categories].map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => setSuiteIds(suites.map(suite => suite.id))}>Select all</Button><ViewControls value={suiteView} onChange={next => setSuiteOverride(old => updateViewOverride(preferences, old, next))} onReset={() => setSuiteOverride({})} scope="Test catalog" fields={["description", "metadata", "providers", "evidence"]} /></div>
      {suiteView.layout === "grid" ? <div className={`grid gap-3 ${suiteView.size === "small" ? "sm:grid-cols-2 xl:grid-cols-4" : suiteView.size === "large" ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>{visibleSuites.map(suite => <Card key={suite.id} className="gap-3 py-4"><CardHeader className="px-4"><div className="flex items-start gap-3"><Checkbox id={`suite-${suite.id}`} checked={suiteIds.includes(suite.id)} onCheckedChange={() => setSuiteIds(old => toggle(old, suite.id))} aria-label={`Select ${suite.name}`} /><div className="min-w-0"><label htmlFor={`suite-${suite.id}`} className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><SuiteIcon id={suite.id} />{suite.name}</label><p className="mt-1 text-xs text-muted-foreground">{suite.use}</p></div></div></CardHeader><CardContent className="space-y-2 px-4">{suiteView.metadata && <code className="block break-all rounded-sm bg-muted px-2 py-1 text-xs">{suite.endpoint}</code>}{suiteView.description && <p className="text-xs text-muted-foreground">{suite.criterion}</p>}{(suiteView.providers || suiteView.evidence) && <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Coverage details</summary><div className="mt-2 flex flex-wrap gap-1">{suiteView.providers && surfaceNames(suite).map(name => <Badge variant="outline" key={name}>{name}</Badge>)}{suiteView.evidence && <Badge variant="secondary">Harness mapping · model unverified</Badge>}</div></details>}</CardContent></Card>)}</div> : <div className="overflow-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Select</TableHead><TableHead>Scenario</TableHead><TableHead>Use</TableHead>{suiteView.metadata && <TableHead>Endpoint</TableHead>}{suiteView.providers && <TableHead>Provider surfaces</TableHead>}</TableRow></TableHeader><TableBody>{visibleSuites.map(suite => <TableRow key={suite.id}><TableCell><Checkbox aria-label={`Select ${suite.name}`} checked={suiteIds.includes(suite.id)} onCheckedChange={() => setSuiteIds(old => toggle(old, suite.id))} /></TableCell><TableCell className="font-medium"><span className="flex items-center gap-2"><SuiteIcon id={suite.id} />{suite.name}</span>{suiteView.description && <p className="text-xs font-normal text-muted-foreground">{suite.criterion}</p>}{suiteView.evidence && <p className="text-xs font-normal text-muted-foreground">Harness mapping · model unverified</p>}</TableCell><TableCell>{suite.use}</TableCell>{suiteView.metadata && <TableCell className="font-mono text-xs">{suite.endpoint}</TableCell>}{suiteView.providers && <TableCell className="text-xs">{surfaceNames(suite).join(", ")}</TableCell>}</TableRow>)}</TableBody></Table></div>}
      {!visibleSuites.length && <p className="rounded-sm border p-5 text-sm text-muted-foreground">No matching scenarios.</p>}
      <Card className="gap-3 py-4"><CardContent className="grid gap-4 sm:grid-cols-2"><div><div className="flex items-center gap-2"><ShieldCheck className="size-4" /><h3 className="text-sm font-semibold">Mocker</h3><Badge variant="secondary">Pipeline candidate</Badge></div><p className="mt-2 text-xs text-muted-foreground">Bifrost's plugin can return controlled dummy responses. It checks a mocked path, never provider capability. No plugin is connected here.</p><a className="mt-2 inline-block text-xs text-primary underline" href={mockerUrl} target="_blank" rel="noreferrer">Plugin documentation ↗</a></div><div><div className="flex items-center gap-2"><FlaskConical className="size-4" /><h3 className="text-sm font-semibold">JSON Parser</h3><Badge variant="secondary">Pipeline candidate</Badge></div><p className="mt-2 text-xs text-muted-foreground">Repairs incomplete JSON chunks in streaming responses. It does not establish general structured-output support. No plugin is connected here.</p><a className="mt-2 inline-block text-xs text-primary underline" href={parserUrl} target="_blank" rel="noreferrer">Plugin documentation ↗</a></div></CardContent></Card>
      <div className="flex justify-end"><Button onClick={() => setStep("compose")} disabled={!suiteIds.length}>Choose accesses <ArrowRight className="size-4" /></Button></div>
    </>}

    {step === "compose" && <>
      <Card className="gap-4 py-4"><CardHeader><CardTitle className="text-sm">1. Select target models</CardTitle><p className="text-xs text-muted-foreground">A model includes every configured provider access. Add scopes below to build a union.</p></CardHeader><CardContent><ModelBrowser models={models} selected={selection.modelIds} onToggle={id => setScope("modelIds", id)} preferences={preferences} compact label="Select models for a batch" /></CardContent></Card>
      <Card className="gap-4 py-4"><CardHeader><CardTitle className="text-sm">2. Expand by provider, group, or creator</CardTitle><p className="text-xs text-muted-foreground">Each choice adds accesses. Exclusions below always win.</p></CardHeader><CardContent className="space-y-4">{([["Providers", "providerIds", providers], ["Groups", "groupIds", groups.map(group => group.id)], ["Creators", "creators", creators]] as const).map(([label, key, values]) => <div key={key}><h4 className="mb-2 text-xs font-medium text-muted-foreground">{label}</h4><div className="flex flex-wrap gap-1.5">{values.map(value => <Button key={value} size="sm" variant={selection[key].includes(value) ? "secondary" : "outline"} aria-pressed={selection[key].includes(value)} onClick={() => setScope(key, value)}>{selection[key].includes(value) && <Check className="size-3" />}{key === "groupIds" ? groups.find(group => group.id === value)?.name : key === "providerIds" ? displayProvider(value) : value}</Button>)}</div></div>)}</CardContent></Card>
      <Card className="gap-4 py-4"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-sm">3. Resolve exact accesses</CardTitle><Badge variant="secondary">{new Set(targets.map(target => target.model.id)).size} models · {targets.length} accesses · {excluded.length} excluded</Badge></div><p className="text-xs text-muted-foreground">The access ID below is retained exactly in every report, including custom IDs.</p></CardHeader><CardContent>{targets.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{targets.map(({ model, access }) => <div key={`${model.id}:${access.id}`} className="flex min-w-0 items-start justify-between gap-2 rounded-sm border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{model.name}</p><p className="break-all font-mono text-xs text-muted-foreground">{access.id}</p><Badge variant={access.status === "Configured" ? "secondary" : "warning"} className="mt-2">{access.status}</Badge></div><Button variant="ghost" size="icon" aria-label={`Exclude ${access.id}`} title="Exclude access" onClick={() => setSelection(old => ({ ...old, excludedAccessIds: [...old.excludedAccessIds, access.id] }))}><X className="size-4" /></Button></div>)}</div> : <p className="text-sm text-muted-foreground">Choose a model, provider, group, or creator to resolve accesses.</p>}{excluded.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="text-xs text-muted-foreground">Excluded:</span>{excluded.map(({ access }) => <Button key={access.id} variant="outline" size="sm" onClick={() => setSelection(old => ({ ...old, excludedAccessIds: old.excludedAccessIds.filter(id => id !== access.id) }))}><span className="max-w-48 truncate font-mono text-xs">{access.id}</span><RotateCcw className="size-3" /></Button>)}</div>}</CardContent></Card>
      <Card className="gap-4 py-4"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle className="text-sm">4. Review batch</CardTitle><span className="flex gap-1"><Badge variant="secondary">{runnable} runnable</Badge><Badge variant="outline">{skipped} skipped</Badge><Badge variant="outline">{cells.length} cases</Badge></span></div><p className="text-xs text-muted-foreground">Runnable means the provider surface is mapped in the harness and declared tasks/modalities fit. It does not confirm capability.</p></CardHeader><CardContent className="space-y-4"><details className="rounded-sm border p-3"><summary className="cursor-pointer text-sm font-medium">Advanced run controls</summary><div className="mt-3 flex flex-wrap gap-4"><label className="text-xs">Concurrent fixture steps<Select value={String(concurrency)} onValueChange={value => setConcurrency(Number(value))}><SelectTrigger className="mt-1 min-w-24" aria-label="Concurrent fixture steps"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 4].map(value => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></label><label className="text-xs">Case ceiling<Input className="mt-1 w-28" type="number" min={1} max={100} value={caseCeiling} onChange={event => setCaseCeiling(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /></label></div><p className="mt-2 text-xs text-muted-foreground">Controls affect only this local fixture run. The ceiling turns excess scenario-access cases into skipped results.</p></details><div className="max-h-80 overflow-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Exact access</TableHead><TableHead>Scenario</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{cells.map((cell, index) => <TableRow key={`${cell.target.access.id}:${cell.suite.id}:${index}`}><TableCell className="break-all font-mono text-xs">{cell.target.access.id}</TableCell><TableCell className="text-xs">{cell.suite.name}</TableCell><TableCell><Badge variant={cell.runnable ? "secondary" : "outline"}>{cell.runnable ? "Runnable" : "Skip"}</Badge><span className="ml-2 text-xs text-muted-foreground">{cell.reason}</span></TableCell></TableRow>)}</TableBody></Table></div>{!cells.length && <p className="text-sm text-muted-foreground">Select at least one scenario and access to preview a batch.</p>}<div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">No API calls or costs. All outcomes are fixed local fixtures.</p><Button disabled={!runnable || !!run} onClick={start}><Play className="size-4" />Run fixture batch</Button></div></CardContent></Card>

    </>}

    <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h3 className="text-sm font-semibold">Fixture report history</h3><Badge variant="outline">{campaigns.length} checks</Badge></div><ViewControls value={reportView} onChange={next => setReportOverride(old => updateViewOverride(preferences, old, next))} onReset={() => setReportOverride({})} scope="Reports" fields={["description", "metadata", "providers", "evidence"]} /></div>
      {reportView.layout === "grid" ? <div className={`grid max-h-[36rem] gap-3 overflow-auto ${reportView.size === "small" ? "sm:grid-cols-2 xl:grid-cols-4" : reportView.size === "large" ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>{campaigns.map(row => <Card key={row.id} className="gap-2 py-4"><CardContent className="space-y-2 px-4"><div className="flex items-start justify-between gap-2"><p className="min-w-0 break-all font-mono text-xs">{row.accessId}</p><Badge variant={statusVariant(row.outcome)}>{row.outcome === "Pass" ? "Fixture pass" : row.outcome}</Badge></div><p className="text-sm font-medium">{row.scenario}</p>{reportView.providers && <p className="text-xs text-muted-foreground">Serving provider: {row.provider}</p>}{reportView.description && <p className="line-clamp-3 text-xs text-muted-foreground">{row.note}</p>}{reportView.metadata && <p className="text-xs text-muted-foreground">{row.date} · {row.id}</p>}{reportView.evidence && <Badge variant="outline">Local fixture only</Badge>}<Button variant="outline" size="sm" onClick={() => setReport([row])}>Open report <ArrowRight className="size-3" /></Button></CardContent></Card>)}</div> : <div className="max-h-96 overflow-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Exact access</TableHead><TableHead>Scenario</TableHead><TableHead>Outcome</TableHead>{reportView.metadata && <TableHead>Date</TableHead>}{reportView.providers && <TableHead>Provider</TableHead>}{reportView.evidence && <TableHead>Source</TableHead>}<TableHead className="text-right">Report</TableHead></TableRow></TableHeader><TableBody>{campaigns.map(row => <TableRow key={row.id}><TableCell className="break-all font-mono text-xs">{row.accessId}</TableCell><TableCell>{row.scenario}{reportView.description && <p className="max-w-64 text-xs text-muted-foreground">{row.note}</p>}</TableCell><TableCell><Badge variant={statusVariant(row.outcome)}>{row.outcome === "Pass" ? "Fixture pass" : row.outcome}</Badge></TableCell>{reportView.metadata && <TableCell className="text-xs text-muted-foreground">{row.date}</TableCell>}{reportView.providers && <TableCell className="text-xs">{row.provider}</TableCell>}{reportView.evidence && <TableCell className="text-xs">Local fixture</TableCell>}<TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setReport([row])}>Open <ArrowRight className="size-3" /></Button></TableCell></TableRow>)}</TableBody></Table></div>}
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><CircleHelp className="size-3" />A skipped or missing scenario is not an unsupported capability. Fixture results are not measured evidence.</p></section>

    <Dialog open={!!report} onOpenChange={open => !open && setReport(null)}><DialogContent className="max-h-[85vh] max-w-4xl overflow-auto"><DialogHeader><DialogTitle>Fixture batch report</DialogTitle><DialogDescription>No request was sent to Bifrost or a provider. Harness coverage is documentation; these outcomes are simulated.</DialogDescription></DialogHeader>{report && <><div className="flex flex-wrap gap-2">{(["Pass", "Fail", "Inconclusive", "Not run"] as const).map(outcome => <Badge key={outcome} variant={statusVariant(outcome)}>{report.filter(row => row.outcome === outcome).length} {outcome === "Pass" ? "fixture pass" : outcome.toLowerCase()}</Badge>)}</div><div className="overflow-auto rounded-sm border"><Table><TableHeader><TableRow><TableHead>Exact access</TableHead><TableHead>Scenario</TableHead><TableHead>Result</TableHead><TableHead>Interpretation</TableHead></TableRow></TableHeader><TableBody>{report.map(row => <TableRow key={row.id}><TableCell className="break-all font-mono text-xs">{row.accessId}</TableCell><TableCell className="text-xs">{row.scenario}</TableCell><TableCell><Badge variant={statusVariant(row.outcome)}>{row.outcome}</Badge></TableCell><TableCell className="max-w-72 text-xs text-muted-foreground">{row.note}</TableCell></TableRow>)}</TableBody></Table></div><div className="flex justify-end"><Button variant="outline" disabled={!!run || !report.some(row => (row.outcome === "Fail" || row.outcome === "Inconclusive") && suiteForScenario(row.scenario) && allAccesses.some(target => target.access.id === row.accessId))} onClick={() => rerunUnresolved(report)}><RotateCcw className="size-4" />Rerun failed or inconclusive</Button></div></>}</DialogContent></Dialog>
  </div>;
}
