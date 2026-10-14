import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, FileJson2, Pause, Play, Square, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ExecutionRecord, HarnessRequest, RunRecord } from "./harness";

type Props = { record?: RunRecord; preview?: HarnessRequest[]; sourceLabel?: string; autoplay?: boolean; onBack: () => void };
type Tab = "Overview" | "Messages" | "Request" | "Response" | "Checks";

function formatted(value: string | undefined) {
  if (!value) return "";
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}
function messages(body: string | undefined, response: string | undefined): { role: string; content: string }[] {
  const result: { role: string; content: string }[] = [];
  try {
    const json = JSON.parse(body || "{}");
    const source = Array.isArray(json.messages) ? json.messages : Array.isArray(json.input) ? json.input : typeof json.input === "string" ? [{ role: "user", content: json.input }] : [];
    result.push(...source.map((item: { role?: string; content?: unknown }) => ({ role: item.role || "message", content: typeof item.content === "string" ? item.content : JSON.stringify(item.content ?? "", null, 2) })));
  } catch { /* Raw body remains available on Request tab. */ }
  try {
    const json = JSON.parse(response || "{}");
    const output = Array.isArray(json.output) ? json.output : [];
    const answer = json.choices?.[0]?.message || json.choices?.[0]?.delta;
    if (answer) result.push({ role: answer.role || "assistant", content: typeof answer.content === "string" ? answer.content : JSON.stringify(answer.content ?? answer, null, 2) });
    for (const item of output) if (item.type === "message") result.push({ role: item.role || "assistant", content: typeof item.content === "string" ? item.content : JSON.stringify(item.content ?? "", null, 2) });
  } catch { /* Raw response remains available on Response tab. */ }
  return result;
}
function Content({ value, empty }: { value?: string; empty: string }) {
  return value ? <pre className="max-h-[28rem] min-w-0 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-muted p-3 text-xs">{formatted(value)}</pre> : <p className="rounded-sm border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>;
}

export default function HarnessRunView({ record, preview, sourceLabel, autoplay = false, onBack }: Props) {
  const executions = record?.executions || [];
  const total = record ? executions.length : preview?.length || 0;
  const [visibleCount, setVisibleCount] = useState(record && autoplay ? 0 : total);
  const [hasReplayed, setHasReplayed] = useState(autoplay);
  const [paused, setPaused] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);
  const [selected, setSelected] = useState(0);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const displayed = record ? executions.slice(0, visibleCount) : preview || [];
  const item: ExecutionRecord | HarnessRequest | undefined = record ? selected < visibleCount ? executions[selected] : undefined : preview?.[selected];
  const execution = record ? item as ExecutionRecord : undefined;
  const request = !record ? item as HarnessRequest : undefined;
  const currentName = item?.name || "Request";
  const requestBody = execution?.requestBody || request?.rawBody;
  const responseBody = execution?.responseBody;
  const chat = useMemo(() => messages(requestBody, responseBody), [requestBody, responseBody]);
  const events = item ? record?.recordedEvents?.filter(event => event.executionIndex === selected) || [] : [];
  const activity = events.filter((event, index) => event.event !== "assertion" || events.findIndex(entry => entry.event === "assertion") === index);
  const assertionEvents = events.filter(event => event.event === "assertion");

  useEffect(() => {
    if (!record || paused || stopped || visibleCount >= total) return;
    const timer = window.setTimeout(() => {
      setVisibleCount(count => {
        const next = count + 1;
        if (autoFollow) setSelected(next - 1);
        return next;
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [record, paused, stopped, visibleCount, total, autoFollow, executions]);

  const choose = (index: number) => { setSelected(index); setAutoFollow(false); setMobileDetail(true); setTab("Overview"); };
  const restart = () => { setVisibleCount(0); setSelected(0); setPaused(false); setStopped(false); setAutoFollow(true); setMobileDetail(false); setHasReplayed(true); };
  const status = record ? !hasReplayed ? "Recorded report" : stopped ? "Replay stopped" : visibleCount === total ? "Replay complete" : paused ? "Replay paused" : "Replaying recorded report" : "Request preview";
  const ready = record ? visibleCount : total;
  const outcome = execution?.outcome;

  return <section className="min-w-0 space-y-4" aria-label="Harness run">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" />Back to Laboratory</Button><div className="mt-2 flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Run details</h2><Badge variant={record ? "secondary" : "warning"}>{record?.demoProvenance ? "Recorded loopback demo" : record ? "Imported Newman report" : "Source preview · no execution"}</Badge></div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sourceLabel || (record ? "Recorded request and response data" : "Official Bifrost harness requests")}</p></div>{record && <div className="flex flex-wrap gap-2">{(visibleCount >= total || stopped) && <Button variant="outline" size="sm" onClick={restart}><Play className="size-4" />Replay</Button>}<Button variant="outline" size="sm" disabled={visibleCount >= total || stopped} onClick={() => setPaused(value => !value)}>{paused ? <Play className="size-4" /> : <Pause className="size-4" />}{paused ? "Resume" : "Pause"}</Button><Button variant="outline" size="sm" disabled={visibleCount >= total || stopped} onClick={() => setStopped(true)}><Square className="size-3" />Stop replay</Button></div>}</div>
    <Card className="gap-2 py-4"><CardContent className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>{status}</strong><span className="text-muted-foreground">{ready} / {total} requests</span></div><div role="progressbar" aria-label="Replay progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={ready} className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${total ? ready / total * 100 : 0}%` }} /></div>{record && <><p className="text-xs text-muted-foreground">Recorded Newman data is revealed in order. Timing is a UI replay; no request is sent now.</p>{visibleCount === total && <><div className="flex flex-wrap gap-1"><Badge variant="success">{record.summary.passed} passed</Badge><Badge variant="destructive">{record.summary.failed} failed</Badge><Badge variant="outline">{record.summary.unverified} unverified</Badge></div>{record.unmatchedFailures.length > 0 && <details className="text-xs text-destructive"><summary className="cursor-pointer">{record.unmatchedFailures.length} run-level failures without a matched request</summary>{record.unmatchedFailures.map((failure, index) => <p key={index} className="mt-1 break-words">{failure.name}: {failure.error}</p>)}</details>}</>}</>}</CardContent></Card>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
      <Card className={`${mobileDetail ? "hidden lg:flex" : "flex"} min-w-0 gap-2 py-3`}><CardHeader className="px-3"><CardTitle className="flex items-center justify-between gap-2 text-sm"><span>Requests</span>{record && <Button variant={autoFollow ? "secondary" : "outline"} size="sm" onClick={() => { setAutoFollow(value => !value); if (!autoFollow && visibleCount) setSelected(visibleCount - 1); }} aria-pressed={autoFollow}>Follow latest</Button>}</CardTitle></CardHeader><CardContent className="max-h-[60vh] min-w-0 space-y-1 overflow-y-auto px-2">{displayed.map((row, index) => { const result = record ? row as ExecutionRecord : undefined; return <button key={`${row.id}-${index}`} type="button" onClick={() => choose(index)} className={`flex w-full min-w-0 items-start gap-2 rounded-sm px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary ${selected === index ? "bg-muted" : ""}`}><span className="mt-0.5 shrink-0">{result?.outcome === "passed" ? <Check className="size-4 text-green-600" /> : result?.outcome === "failed" ? <X className="size-4 text-destructive" /> : <FileJson2 className="size-4 text-muted-foreground" />}</span><span className="min-w-0 flex-1"><span className="block break-words font-medium">{row.name}</span><span className="block truncate text-muted-foreground">{row.method} · {result?.responseStatus || (record ? "No response" : "Source request")}</span></span></button>; })}{record && visibleCount === 0 && <p className="p-3 text-xs text-muted-foreground">Waiting for first recorded request…</p>}</CardContent></Card>
      <Card className={`${mobileDetail ? "flex" : "hidden lg:flex"} min-w-0 gap-2 py-3`}>{item ? <><CardHeader className="min-w-0 px-3 sm:px-5"><div className="flex items-start gap-2"><Button className="lg:hidden" variant="ghost" size="icon" aria-label="Back to requests" onClick={() => setMobileDetail(false)}><ChevronLeft className="size-4" /></Button><div className="min-w-0 flex-1"><CardTitle className="break-words text-base">{currentName}</CardTitle><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{item?.method} {item?.url}</p></div>{outcome && <Badge variant={outcome === "passed" ? "success" : outcome === "failed" ? "destructive" : "outline"}>{outcome}</Badge>}</div></CardHeader><CardContent className="min-w-0 space-y-4 px-3 sm:px-5"><div className="flex flex-wrap gap-1 border-b pb-2" role="tablist" aria-label="Request details">{(["Overview", "Messages", "Request", "Response", "Checks"] as Tab[]).map(name => <Button key={name} role="tab" aria-selected={tab === name} size="sm" variant={tab === name ? "secondary" : "ghost"} onClick={() => setTab(name)}>{name}</Button>)}</div>
        {tab === "Overview" && <div className="grid gap-3 text-sm sm:grid-cols-2"><div className="rounded-sm border p-3"><p className="text-xs text-muted-foreground">Request</p><p className="mt-1 break-all font-mono text-xs">{item?.method} {item?.url}</p>{request && <p className="mt-2 text-xs text-muted-foreground">{request.folderPath.join(" / ")}</p>}</div><div className="rounded-sm border p-3"><p className="text-xs text-muted-foreground">Response</p><p className="mt-1">{execution?.responseStatus ?? "Not available"}</p>{execution?.responseTimeMs !== undefined && <p className="text-xs text-muted-foreground">{execution.responseTimeMs} ms recorded</p>}</div><div className="rounded-sm border p-3 sm:col-span-2"><p className="text-xs text-muted-foreground">Checks</p><p className="mt-1">{execution ? `${execution.assertions.filter(check => check.passed).length} passed · ${execution.assertions.filter(check => !check.passed && !check.skipped).length} failed · ${execution.assertions.filter(check => check.skipped).length} skipped` : `${request?.assertions.length || 0} source assertions · no outcome`}</p>{execution?.failure && <p className="mt-2 break-words text-xs text-destructive">{execution.failure}</p>}</div><div className="rounded-sm border p-3 sm:col-span-2"><p className="mb-2 text-xs text-muted-foreground">Recorded activity</p>{activity.length ? <ol className="space-y-2">{activity.map((event, index) => <li key={index} className="flex flex-wrap items-start gap-2 text-xs"><span className="min-w-16 font-mono text-muted-foreground">{event.at ? new Date(event.at).toLocaleTimeString() : ""}</span><Badge variant={event.failed ? "destructive" : "outline"}>{event.event === "beforeRequest" ? "Sending" : event.event === "request" ? "Response" : event.event === "assertion" ? `Checks (${assertionEvents.length})` : "Finished"}</Badge></li>)}</ol> : <p className="text-xs text-muted-foreground">{record ? "This report has no per-event timestamps." : "Source preview has no execution activity."}</p>}</div></div>}
        {tab === "Messages" && (chat.length ? <div className="space-y-2">{chat.map((message, index) => <div key={index} className="rounded-sm border p-3"><Badge variant="outline">{message.role}</Badge><pre className="mt-2 whitespace-pre-wrap break-words text-xs">{message.content}</pre></div>)}<details className="text-xs"><summary className="cursor-pointer text-muted-foreground">Raw request JSON</summary><Content value={requestBody} empty="No request body recorded." /></details></div> : <Content value={requestBody} empty="No chat messages or request body available." />)}
        {tab === "Request" && <div className="space-y-3"><p className="break-all font-mono text-xs">{item?.method} {item?.url}</p>{(request?.headers.length || execution?.requestHeaders.length) ? <details className="text-xs"><summary className="cursor-pointer">Request headers ({(request?.headers || execution?.requestHeaders || []).length})</summary><div className="mt-2 space-y-1">{(request?.headers || execution?.requestHeaders || []).map((header, index) => <p key={index} className="break-all font-mono">{header.key}: {header.value}</p>)}</div></details> : null}<Content value={requestBody} empty="No request body available in this source." />{execution?.requestTruncated && <Badge variant="warning">Request body truncated by report</Badge>}</div>}
        {tab === "Response" && <div className="space-y-3"><p className="text-sm">{execution?.responseStatus ?? "No response recorded"}{execution?.responseTimeMs !== undefined && ` · ${execution.responseTimeMs} ms`}</p>{execution?.responseHeaders.length ? <details className="text-xs"><summary className="cursor-pointer">Response headers ({execution.responseHeaders.length})</summary><div className="mt-2 space-y-1">{execution.responseHeaders.map((header, index) => <p key={index} className="break-all font-mono">{header.key}: {header.value}</p>)}</div></details> : null}<Content value={responseBody} empty={record ? "The imported Newman report contains no response body for this request." : "Preview only. Import a Newman JSON report to inspect a recorded response."} />{execution?.responseTruncated && <Badge variant="warning">Response body truncated by report</Badge>}</div>}
        {tab === "Checks" && (execution?.assertions.length ? <div className="space-y-2">{execution.assertions.map((check, index) => <div key={index} className="flex items-start gap-2 rounded-sm border p-3 text-sm">{check.skipped ? <Badge variant="outline">Skipped</Badge> : check.passed ? <Check className="mt-0.5 size-4 shrink-0 text-green-600" /> : <X className="mt-0.5 size-4 shrink-0 text-destructive" />}<div className="min-w-0"><p>{check.name}</p>{check.error && <p className="mt-1 break-words text-xs text-destructive">{check.error}</p>}</div></div>)}</div> : request?.assertions.length ? <div className="space-y-2">{request.assertions.map((check, index) => <p key={index} className="rounded-sm border p-3 text-xs">{check}</p>)}<p className="text-xs text-muted-foreground">Source assertions have not run here.</p></div> : <p className="rounded-sm border border-dashed p-4 text-sm text-muted-foreground">No assertion data available.</p>)}
      </CardContent></> : <CardContent className="px-3 sm:px-5"><Button className="mb-3 lg:hidden" variant="ghost" size="sm" onClick={() => setMobileDetail(false)}><ChevronLeft className="size-4" />Requests</Button><p className="rounded-sm border border-dashed p-4 text-sm text-muted-foreground">Select a recorded request once it appears.</p></CardContent>}</Card>
    </div>
  </section>;
}
