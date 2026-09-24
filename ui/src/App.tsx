import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Activity, ArrowLeft, ArrowRight, ChevronDown, CircleHelp, Database, Download, Eye, FileJson, FlaskConical, KeyRound, Layers3, LogOut, Plus, RotateCcw, Search, Settings2, Sun, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { catalogModels, copy, delta, exposed, keyImpact, members, modelImpact, same, toggleModel, type Demo, type Group, type Key, type Model, type Policy } from "./demo";
import { ApiError, clearAdminToken, createKey, getWorkspace, putWorkspace, readbackKey, setAdminToken, type AdoptionOperation, type Workspace } from "./api";
import ModelBrowser from "./ModelBrowser";
import ModelEditor from "./ModelEditor";
import AssistantSettings from "./AssistantSettings";
import AssistantSuggestion from "./AssistantSuggestion";
import VirtualKeySecret from "./VirtualKeySecret";
import { omitUnchangedReferenceIds } from "./model-editor-data";
import CatalogMetadata from "./CatalogMetadata";
import SnapshotTransfer from "./SnapshotTransfer";
import AdoptionDialog from "./AdoptionDialog";
import ReferenceCatalogBrowser from "./ReferenceCatalogBrowser";
import { GroupTree } from "./GroupTree";
import { ViewControls, defaultViewOptions, type ViewOptions } from "./ViewOptions";

type Page = "models" | "catalog" | "groups" | "keys" | "qualification" | "settings" | "snapshot";
type Confirm = { title: string; text: string; action: () => void; confirmLabel?: string; cancelLabel?: string } | null;
const nav: { id: Page; label: string; icon: typeof Database }[] = [
  { id: "models", label: "Model Catalog", icon: Database },
  { id: "catalog", label: "Sources & References", icon: FileJson },
  { id: "groups", label: "Groups", icon: Layers3 },
  { id: "keys", label: "Virtual Keys", icon: KeyRound },
  { id: "qualification", label: "Laboratory", icon: FlaskConical },
  { id: "snapshot", label: "Import & Export", icon: Download },
  { id: "settings", label: "Settings", icon: Settings2 },
];
const formats: Policy["naming"][] = ["model", "provider/model", "both"];
function route(): { page: Page; id?: string } {
  const [page, id] = location.hash.slice(2).split("/");
  return { page: nav.some(n => n.id === page) ? page as Page : "models", id };
}

function CollapsedSidebarExpand() {
  const { isMobile, state, setOpen } = useSidebar();
  if (isMobile || state !== "collapsed") return null;
  return <Button variant="ghost" size="icon" className="size-8" aria-label="Expand sidebar" title="Expand sidebar" onClick={() => setOpen(true)}><img src={`${import.meta.env.BASE_URL}bifrost-icon.webp`} alt="" className="size-5 object-contain dark:invert" /></Button>;
}

function MobileSidebarLabel() {
  const { isMobile } = useSidebar();
  return isMobile ? <><SheetTitle className="sr-only">Navigation</SheetTitle><SheetDescription className="sr-only">Registry pages and settings</SheetDescription></> : null;
}

function CloseMobileSidebarOnRoute({ routeKey }: { routeKey: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => setOpenMobile(false), [routeKey, setOpenMobile]);
  return null;
}

export function App() {
  const [data, setData] = useState<Demo>({ models: [], groups: [], keys: [], campaigns: [] });
  const [revision, setRevision] = useState("");
  const [discovery, setDiscovery] = useState<Model[]>([]);
  const [connection, setConnection] = useState<Workspace["connection"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginRequired, setLoginRequired] = useState(false);
  const [loginToken, setLoginToken] = useState("");
  const [loginError, setLoginError] = useState("");
  const [standaloneAuthenticated, setStandaloneAuthenticated] = useState(false);
  const [busy, setBusy] = useState("");
  const busyRef = useRef(false);
  const [apiError, setApiError] = useState("");
  const [needsReconcile, setNeedsReconcile] = useState(false);
  const [reconcileBlocked, setReconcileBlocked] = useState(false);
  const [createdSecret, setCreatedSecret] = useState("");
  const [locationState, setLocationState] = useState(route);
  const [search, setSearch] = useState("");
  const [modelDraft, setModelDraft] = useState<Model | null>(null);
  const [creatingModel, setCreatingModel] = useState(false);
  const [modelError, setModelError] = useState("");
  const [groupDraft, setGroupDraft] = useState<Group | null>(null);
  const [groupEditorView, setGroupEditorView] = useState<"cards" | "tree">("cards");
  const [keyForm, setKeyForm] = useState<{ name: string; client: string } | null>(null);
  const [renameForm, setRenameForm] = useState<{ id: string; name: string } | null>(null);
  const [adoption, setAdoption] = useState<{ keyId: string; operation: AdoptionOperation } | null>(null);
  const [catalogFocus, setCatalogFocus] = useState<{ target: "reference" | "access"; id: string } | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [preferences, setPreferences] = useState<ViewOptions>(() => { try { return { ...defaultViewOptions, ...JSON.parse(localStorage.getItem("registry-prototype-view") || "{}") }; } catch { return defaultViewOptions; } });
  const [listOverrides, setListOverrides] = useState<Record<string, Partial<ViewOptions>>>({});
  const [selectionView, setSelectionView] = useState<ViewOptions>(defaultViewOptions);
  useEffect(() => { localStorage.setItem("registry-prototype-view", JSON.stringify(preferences)); }, [preferences]);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); document.documentElement.style.colorScheme = dark ? "dark" : "light"; }, [dark]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const [showJson, setShowJson] = useState(false);

  const applyWorkspace = (workspace: Workspace) => {
    setData(workspace.data);
    setRevision(workspace.revision);
    setDiscovery(workspace.discovery);
    setConnection(workspace.connection);
    setApiError("");
  };
  const requireLogin = () => {
    clearAdminToken();
    setStandaloneAuthenticated(false);
    setLoginRequired(true);
    setLoginToken("");
    setLoginError(revision ? "La session a expiré. Saisissez le jeton administrateur pour continuer." : "");
  };
  const load = async () => {
    if (busyRef.current) return;
    setLoading(true);
    try { applyWorkspace(await getWorkspace()); if (reconcileBlocked) { setReconcileBlocked(false); setNeedsReconcile(false); } }
    catch (error) { if (error instanceof ApiError && error.status === 401) requireLogin(); else setApiError(error instanceof ApiError && error.status === 403 ? "Accès refusé au panneau Registry (403)." : error instanceof ApiError ? error.message : "Connexion au Registry impossible. Vérifiez le réseau et réessayez."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = loginToken.trim();
    if (!token) { setLoginError("Saisissez le jeton administrateur."); return; }
    setLoading(true);
    setLoginError("");
    setAdminToken(token);
    try {
      applyWorkspace(await getWorkspace());
      setStandaloneAuthenticated(true);
      setLoginRequired(false);
      setLoginToken("");
    } catch (error) {
      clearAdminToken();
      setLoginToken("");
      setLoginError(error instanceof ApiError && error.status === 401 ? "Jeton administrateur invalide ou expiré." : error instanceof ApiError && error.status === 403 ? "Accès refusé au panneau Registry (403)." : "Connexion au Registry impossible. Vérifiez le réseau et réessayez.");
    } finally { setLoading(false); }
  };
  const signOut = () => {
    clearAdminToken();
    setStandaloneAuthenticated(false);
    setLoginRequired(true);
    setLoginToken("");
    setLoginError("");
    setData({ models: [], groups: [], keys: [], campaigns: [] });
    setRevision("");
    setDiscovery([]);
    setConnection(null);
    setApiError("");
    setNeedsReconcile(false);
    setReconcileBlocked(false);
    setCreatedSecret("");
    setModelDraft(null);
    setModelError("");
    setCreatingModel(false);
    setGroupDraft(null);
    setDraft(null);
    setShowJson(false);
    setKeyForm(null);
    setRenameForm(null);
    setAdoption(null);
    setCatalogFocus(null);
    setConfirm(null);
    setDiscoveryOpen(false);
    setSearch("");
    setListOverrides({});
    setSelectionView(defaultViewOptions);
    history.replaceState(null, "", `${location.pathname}${location.search}#/models`);
    setLocationState({ page: "models" });
  };
  const operation = async (label: string, work: () => Promise<void>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(label);
    try { await work(); setApiError(""); return true; }
    catch (error) { if (error instanceof ApiError && error.status === 401) { requireLogin(); return false; } const message = error instanceof Error ? error.message : "Request failed"; setApiError(message); toast.error(message); return false; }
    finally { busyRef.current = false; setBusy(""); }
  };
  const markReadbackFailure = (id: string, error: unknown) => {
    const fromServer = error instanceof ApiError ? error.publication : undefined;
    const message = error instanceof Error ? error.message : "Readback unavailable";
    setData(old => ({ ...old, keys: old.keys.map(k => {
      if (k.id !== id) return k;
      const prior = k.publication;
      const actual = fromServer?.actual ?? prior?.actual ?? k.observed ?? null;
      return { ...k, publication: {
        state: "not_verified", revision: fromServer?.revision || prior?.revision || revision,
        checkedAt: fromServer?.checkedAt || new Date().toISOString(), observedAt: fromServer?.observedAt || prior?.observedAt, observedRevision: fromServer?.observedRevision || prior?.observedRevision,
        expected: fromServer?.expected || exposed(k.policy, old.groups, old.models), actual,
        missing: [], unexpected: [], error: fromServer?.error || message,
      } };
    }) }));
  };
  const verify = async (ids: string[]) => {
    let verified = true;
    for (const id of [...new Set(ids)]) {
      setBusy("Verifying /v1/models…");
      try {
        const workspace = await readbackKey(id);
        applyWorkspace(workspace);
        if (workspace.data.keys.find(k => k.id === id)?.publication?.state !== "verified") verified = false;
      } catch (error) { if (error instanceof ApiError && error.status === 401) throw error; verified = false; markReadbackFailure(id, error); toast.warning(`${id}: ${error instanceof Error ? error.message : "Readback unavailable"}`); }
    }
    return verified;
  };
  const commit = async (next: Demo, label: string, verifyIds: string[] = []) => operation(label, async () => {
    let saved: Workspace;
    try { saved = await putWorkspace(next, revision); }
    catch (error) {
      const partial = error instanceof ApiError && !!error.revision && ["native_apply", "refresh", "aliases"].includes(error.phase || "");
      if (partial || !(error instanceof ApiError) || [404, 409].includes(error.status)) {
        setNeedsReconcile(true);
        try { applyWorkspace(await getWorkspace()); }
        catch (refreshError) { setReconcileBlocked(true); if (refreshError instanceof ApiError && refreshError.status === 401) throw refreshError; throw new Error("Write result is uncertain and workspace refresh failed. Reload before another write; your draft is preserved."); }
        setReconcileBlocked(false);
        if (!partial) setNeedsReconcile(false);
        throw new Error(partial ? `Registry reached revision ${error.revision}, but Bifrost update or refresh failed. Review the unverified keys before retrying.` : "Workspace refreshed after a failed write. Review the current revision and your draft before publishing again.");
      }
      throw error;
    }
    applyWorkspace(saved);
    setNeedsReconcile(false);
    setReconcileBlocked(false);
    const verified = verifyIds.length ? await verify(verifyIds) : true;
    toast[verified ? "success" : "warning"](verifyIds.length ? verified ? "Published and verified through /v1/models." : "Saved; readback has drift or could not be verified." : "Saved.");
  });

  const navigate = (page: Page, id?: string) => { location.hash = `/${page}${id ? `/${id}` : ""}`; setLocationState({ page, id }); setSearch(""); };
  const go = (page: Page, id?: string) => {
    if (locationState.page === "keys" && locationState.id && draft && !same(data.keys.find(k => k.id === locationState.id)?.policy, draft) && (page !== "keys" || id !== locationState.id)) {
      setConfirm({ title: "Discard key draft?", text: "Unpublished key selections will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", action: () => navigate(page, id) });
      return;
    }
    navigate(page, id);
  };
  const { page, id: pageId } = locationState;
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [page, pageId]);
  const key = data.keys.find(k => k.id === pageId);
  useEffect(() => { setDraft(key ? copy(key.policy) : null); setShowJson(false); }, [key?.id]);
  const activePolicy = draft || key?.policy;
  const predicted = activePolicy ? exposed(activePolicy, data.groups, data.models) : [];
  const observed = key?.publication?.actual ?? key?.observed ?? [];
  const diff = delta(observed, predicted);
  const isDirty = Boolean(key && draft && !same(key.policy, draft));
  useEffect(() => {
    const onHash = () => {
      const target = route();
      if (isDirty && (target.page !== page || target.id !== pageId)) {
        history.replaceState(null, "", `${location.pathname}${location.search}#/${page}${pageId ? `/${pageId}` : ""}`);
        setConfirm({ title: "Discard key draft?", text: "Unpublished key selections will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", action: () => navigate(target.page, target.id) });
      } else { setLocationState(target); setSearch(""); }
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [isDirty, page, pageId]);
  const filteredGroups = data.groups.filter(g => `${g.name} ${g.description}`.toLowerCase().includes(search.toLowerCase()));
  const filteredKeys = data.keys.filter(k => `${k.name} ${k.client}`.toLowerCase().includes(search.toLowerCase()));
  const catalog = catalogModels(data.models, discovery);
  const registeredIds = new Set(data.models.map(model => model.id));

  const newModel = (): Model => ({ id: "", name: "", creator: "Unknown", family: "Unknown", inputModalities: [], outputModalities: [], tasks: [], kind: "Unknown", summary: "", context: "Unknown", capabilities: {}, accesses: [{ provider: "", id: "", route: "Direct provider", status: "Unknown", nativeModel: "" }] });
  const updateModel = async () => {
    if (!modelDraft || busyRef.current) return;
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(modelDraft.id) || !modelDraft.name.trim() || modelDraft.kind === "Unknown" || !modelDraft.accesses.length || !modelDraft.accesses.every(a => a.provider.trim() && a.id === `${a.provider}/${modelDraft.id}` && a.nativeModel?.trim())) { setModelError("Enter a model ID and name, select its native endpoint type, and configure a provider access. Access ID must equal provider/model ID."); return; }
    if (creatingModel && data.models.some(m => m.id === modelDraft.id)) { setModelError("That model ID already exists."); return; }
    const allAccessIds = data.models.filter(m => m.id !== modelDraft.id).flatMap(m => m.accesses.map(a => a.id));
    if (modelDraft.accesses.some(a => allAccessIds.includes(a.id)) || new Set(modelDraft.accesses.map(a => a.id)).size !== modelDraft.accesses.length) { setModelError("Provider access IDs must be unique."); return; }
    const saved = omitUnchangedReferenceIds(copy(modelDraft), catalog);
    const next = { ...data, models: creatingModel ? [...data.models, copy(saved)] : data.models.map(m => m.id === saved.id ? copy(saved) : m) };
    const impacted = data.keys.filter(k => k.managed !== false && members(k.policy, data.groups).includes(saved.id)).map(k => k.id);
    if (await commit(next, "Saving model…", impacted)) { setModelDraft(null); setModelError(""); }
  };
  const deleteModel = (model: Model) => {
    const emptied = data.groups.filter(g => g.members.includes(model.id) && !g.members.some(id => id !== model.id));
    if (emptied.length) { const message = `Remove this model from or delete these groups first: ${emptied.map(g => g.name).join(", ")}.`; setModelError(message); toast.error(message); return; }
    const used = data.keys.filter(k => members(k.policy, data.groups).includes(model.id)).length;
    setConfirm({ title: `Delete ${model.name}?`, text: `This removes the model from its groups and key selections. ${used} key catalog${used === 1 ? "" : "s"} will change.`, action: () => {
      const models = data.models.filter(m => m.id !== model.id);
      const groups = data.groups.map(g => ({ ...g, members: g.members.filter(id => id !== model.id) }));
      const keys = data.keys.map(k => ({ ...k, policy: { ...k.policy, added: k.policy.added.filter(id => id !== model.id), excluded: k.policy.excluded.filter(id => id !== model.id) } }));
      void (async () => { if (await commit({ ...data, models, groups, keys }, "Deleting model…", data.keys.filter(k => k.managed !== false && members(k.policy, data.groups).includes(model.id)).map(k => k.id))) setModelDraft(null); })();
    } });
  };
  const publishGroup = async () => {
    if (!groupDraft?.name.trim() || !groupDraft.members.length) { toast.error("Enter a name and select at least one model."); return; }
    if (data.groups.some(g => g.id !== groupDraft.id && g.name.toLowerCase() === groupDraft.name.trim().toLowerCase())) { toast.error("A group with this name already exists."); return; }
    const nextGroup = { ...groupDraft, name: groupDraft.name.trim() };
    const nextGroups = data.groups.some(g => g.id === groupDraft.id) ? data.groups.map(g => g.id === groupDraft.id ? nextGroup : g) : [...data.groups, nextGroup];
    const impacted = keyImpact(data.keys, data.groups, nextGroups, data.models).filter(row => row.key.managed !== false).map(row => row.key.id);
    if (await commit({ ...data, groups: nextGroups }, "Publishing group…", impacted)) setGroupDraft(null);
  };
  const saveKey = async () => {
    if (!keyForm?.name.trim()) { toast.error("Enter a key name."); return; }
    if (data.keys.some(k => k.name.toLowerCase() === keyForm.name.trim().toLowerCase())) { toast.error("A key with this name already exists."); return; }
    const form = keyForm;
    await operation("Creating native key…", async () => {
      const result = await createKey(form.name.trim(), form.client.trim());
      setCreatedSecret(result.created.secret);
      setKeyForm(null);
      navigate("keys", result.created.id);
      if (result.workspace) applyWorkspace(result.workspace);
      else {
        try { applyWorkspace(await getWorkspace()); }
        catch (error) { if (error instanceof ApiError && error.status === 401) throw error; throw new Error(`Native key created, but workspace refresh failed: ${result.refreshError || "connection unavailable"}. Copy the displayed secret and reload later.`); }
      }
      if (result.managed === false || result.bindingError) throw new Error(`${result.bindingError || "Registry binding failed"}. Native key is unmanaged; copy its secret and reconcile before using it.`);
      toast.success("Native virtual key created. Copy its secret now.");
    });
  };
  const publishKey = async () => {
    if (!key || !draft || key.managed === false) return;
    const next = { ...data, keys: data.keys.map(k => k.id === key.id ? { ...k, policy: copy(draft) } : k) };
    await commit(next, "Publishing key…", [key.id]);
  };
  const reread = async () => {
    if (!key || key.managed === false) return;
    await operation("Verifying /v1/models…", async () => {
      let workspace: Workspace;
      try { workspace = await readbackKey(key.id); }
      catch (error) { if (!(error instanceof ApiError && error.status === 401)) markReadbackFailure(key.id, error); throw error; }
      applyWorkspace(workspace);
      const state = workspace.data.keys.find(k => k.id === key.id)?.publication?.state;
      toast[state === "verified" ? "success" : "warning"](state === "verified" ? "Readback verified." : state === "drift" ? "Readback differs from published policy." : "Readback unavailable.");
    });
  };
  const downloadJson = () => {
    if (!key) return;
    const payload = { object: "list", data: observed.map(id => ({ id, object: "model" })) };
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })); link.download = `${key.name.toLowerCase().replace(/\s+/g, "-")}-models-readback.json`; link.click(); URL.revokeObjectURL(link.href);
  };

  const viewFor = (scope: string) => ({ ...preferences, ...listOverrides[scope] });
  const setView = (scope: string, value: ViewOptions) => setListOverrides(old => { const current = { ...preferences, ...old[scope] }; const changed = (Object.keys(value) as (keyof ViewOptions)[]).find(field => value[field] !== current[field]); return changed ? { ...old, [scope]: { ...old[scope], [changed]: value[changed] } } : old; });
  const resetView = (scope: string) => setListOverrides(old => { const next = { ...old }; delete next[scope]; return next; });
  const title = page === "models" ? "Model Catalog" : page === "catalog" ? "Sources & References" : page === "snapshot" ? "Import & Export" : page === "groups" ? "Groups" : page === "qualification" ? "Laboratory" : page === "settings" ? "Settings" : key ? key.name : "Virtual Keys";
  if (loginRequired) return <div className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-6"><Card className="w-full max-w-md p-6"><form onSubmit={signIn} className="space-y-5"><div className="space-y-2"><h1 className="text-xl font-semibold">Connexion au Registry</h1><p className="text-sm text-muted-foreground">Saisissez le jeton administrateur du panneau.</p></div><div className="space-y-2"><label htmlFor="registry-admin-token" className="text-sm font-medium">Jeton administrateur</label><Input id="registry-admin-token" type="password" autoComplete="current-password" autoFocus required spellCheck={false} value={loginToken} onChange={event => setLoginToken(event.target.value)} /></div>{loginError && <p role="alert" className="text-sm text-destructive">{loginError}</p>}<Button type="submit" className="w-full" disabled={loading}>{loading ? "Connexion…" : "Connexion"}</Button></form></Card></div>;
  if (loading && !revision) return <div className="flex min-h-dvh items-center justify-center bg-background p-6"><Card className="w-full max-w-md p-6"><CardTitle>Connecting to Bifrost…</CardTitle><p className="text-sm text-muted-foreground">Loading the live registry workspace.</p></Card></div>;
  if (apiError && !revision) return <div className="flex min-h-dvh items-center justify-center bg-background p-6"><Card className="w-full max-w-md p-6"><CardTitle>Registry unavailable</CardTitle><p role="alert" className="text-sm text-destructive">{apiError}</p><Button onClick={() => void load()}>Retry</Button></Card></div>;
  return <TooltipProvider delayDuration={0}><SidebarProvider><CloseMobileSidebarOnRoute routeKey={`${page}/${pageId || ""}`} /><Sidebar collapsible="icon" className="border-none bg-transparent"><SidebarHeader className="px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2"><MobileSidebarLabel /><CollapsedSidebarExpand /><div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden"><a href="#/models" onClick={e => { e.preventDefault(); go("models"); }} className="min-w-0"><img src={`${import.meta.env.BASE_URL}bifrost-logo.webp`} alt="Bifrost" className="h-[22px] max-w-[145px] object-contain object-left dark:hidden" /><img src={`${import.meta.env.BASE_URL}bifrost-logo-dark.webp`} alt="Bifrost" className="hidden h-[22px] max-w-[145px] object-contain object-left dark:block" /></a><SidebarTrigger className="size-7" /></div></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>WORKSPACE</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{nav.map(item => { const Icon = item.icon; return <SidebarMenuItem key={item.id}><SidebarMenuButton asChild isActive={page === item.id} tooltip={item.label}><a href={`#/${item.id}`} onClick={e => { e.preventDefault(); if (item.id === "catalog") setCatalogFocus(null); go(item.id); }} className={page === item.id ? "border border-primary/20 text-primary" : "border border-transparent"}><Icon className="size-4" /><span>{item.label}</span></a></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="p-4"><span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">Model Registry</span></SidebarFooter></Sidebar>
    <div className="flex h-dvh w-full min-w-0 flex-col"><header className="flex h-13 w-full shrink-0 items-center gap-2 px-3 pt-1 md:pr-3 md:pl-0"><SidebarTrigger className="md:hidden" /><h1 className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{key && page === "keys" ? <><button onClick={() => go("keys")} className="text-muted-foreground hover:text-foreground">Virtual Keys</button><span className="mx-2 text-muted-foreground/50">/</span>{title}</> : title}</h1><Tooltip><TooltipTrigger asChild><CircleHelp className="hidden size-4 cursor-help text-muted-foreground sm:block" /></TooltipTrigger><TooltipContent>{page === "models" ? "Explore models and provider accesses" : page === "groups" ? "Shared sets of models for keys" : page === "keys" ? "Compose and publish key catalogs" : page === "settings" ? "AI assistance and display preferences" : "Live qualification is planned"}</TooltipContent></Tooltip><div className="ml-auto flex items-center gap-2"><Badge variant={connection ? "success" : "warning"} className="text-[10px]">{busy || (connection ? `Bifrost ${connection.version}` : "Disconnected")}</Badge>{!standaloneAuthenticated && <a href="/workspace/providers" className="hidden text-xs text-muted-foreground hover:text-foreground sm:inline">Bifrost workspace</a>}<Button variant="ghost" size="icon" aria-label={dark ? "Use light theme" : "Use dark theme"} title={dark ? "Use light theme" : "Use dark theme"} onClick={() => setDark(!dark)}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>{standaloneAuthenticated ? <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label="Déconnexion" title="Déconnexion" disabled={!!busy || loading} onClick={signOut}><LogOut className="size-4" /></Button> : <div className="hidden items-center gap-2 rounded-full border bg-card px-2 py-1 md:flex"><span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">S</span><span className="text-xs font-medium">Sofian</span><ChevronDown className="size-3 text-muted-foreground" /></div>}</div></header>
      <div ref={contentRef} className="custom-scrollbar content-container mx-0 min-h-0 min-w-0 flex-1 overflow-auto border bg-background md:mr-3 md:mb-3 md:rounded-md md:px-10"><main className="mx-auto max-w-[1440px] px-4 py-6 md:px-0 md:py-8">{apiError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm"><span>{apiError}. Your unsaved draft is still here.</span><Button variant="outline" size="sm" onClick={() => void load()}>Reload workspace</Button></div>}
        {page === "models" && <><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Models</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">Browse discovered models and review them before adding them to groups or keys.</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{catalog.length} models</Badge><Badge variant="success">{data.models.length} registered</Badge><Badge variant="outline">{catalog.length - data.models.length} need configuration</Badge><Button variant="outline" onClick={() => { setCatalogFocus(null); go("catalog"); }}>Sources & references <ArrowRight className="size-4" /></Button><Button onClick={() => setDiscoveryOpen(true)}><Plus className="size-4" />Add model</Button></div></div>{catalog.length ? <ReferenceCatalogBrowser revision={revision} models={catalog} registeredIds={registeredIds} preferences={preferences} onOpen={model => { setCreatingModel(!registeredIds.has(model.id)); setModelError(""); setModelDraft(copy(model)); }} onMetadata={(target, id) => { setCatalogFocus({ target, id }); go("catalog"); }} onUnauthorized={requireLogin} /> : <Card className="py-0"><CardContent className="space-y-3 p-6"><h3 className="text-lg font-semibold">Build your model catalog</h3><p className="max-w-prose text-sm text-muted-foreground">No models have been discovered yet. Configure a provider in Bifrost to see its models here.</p><Button variant="outline" onClick={() => setDiscoveryOpen(true)}>Add model <ArrowRight className="size-4" /></Button></CardContent></Card>}</>}
        {page === "catalog" && <CatalogMetadata key={catalogFocus ? `${catalogFocus.target}/${catalogFocus.id}` : "catalog"} focus={catalogFocus} onUnauthorized={requireLogin} onChanged={() => void load()} />}
        {page === "snapshot" && <SnapshotTransfer onUnauthorized={requireLogin} onApplied={() => void load()} />}
        {page === "groups" && <><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Groups</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">Reusable model selections shared by virtual keys.</p></div><Button data-tour="groups" onClick={() => setGroupDraft({ id: crypto.randomUUID(), name: "", description: "", members: [] })}><Plus className="size-4" />Create group</Button></div><div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-card p-4 shadow-sm"><div className="relative min-w-[220px] max-w-sm flex-1"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label="Search groups" placeholder="Search groups..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div><ViewControls value={{...preferences, ...listOverrides["groups"]}} onChange={next => setView("groups", next)} onReset={() => resetView("groups")} scope="Groups" fields={["description", "metadata", "providers"]} /></div>{viewFor("groups").layout === "grid" ? <div className={`grid gap-4 ${viewFor("groups").size === "small" ? "sm:grid-cols-2 xl:grid-cols-4" : viewFor("groups").size === "large" ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>{filteredGroups.map((g, index) => <Card key={g.id} data-tour={index === 0 ? "groups" : undefined} className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="size-4" />{g.name}</CardTitle></CardHeader><CardContent className="flex flex-1 flex-col gap-3 px-4 py-4 sm:px-6">{viewFor("groups").description && <p className="text-xs text-muted-foreground">{g.description || "No description"}</p>}{viewFor("groups").metadata && <p className="text-base font-semibold">{g.members.length} <span className="text-xs font-normal text-muted-foreground">selected models</span></p>}{viewFor("groups").providers && <p className="text-xs text-muted-foreground">Used by {data.keys.filter(k => k.policy.groups.includes(g.id)).map(k => k.name).join(", ") || "no keys"}</p>}<Button variant="outline" size="sm" className="ml-auto mt-auto w-fit" onClick={() => setGroupDraft(copy(g))}>Edit group <ArrowRight className="size-3.5" /></Button></CardContent></Card>)}</div> : <div className="overflow-hidden rounded-sm border bg-card shadow-sm"><Table className="[&_td]:py-3 [&_td]:whitespace-normal [&_th]:h-12"><TableHeader className="bg-muted/50"><TableRow><TableHead>Group</TableHead><TableHead>Models</TableHead><TableHead>Used by</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{filteredGroups.map(g => <TableRow key={g.id} className="cursor-pointer" onClick={() => setGroupDraft(copy(g))}><TableCell><div className="text-base font-semibold">{g.name}</div><div className="mt-1 text-xs text-muted-foreground">{g.description || "No description"}</div></TableCell><TableCell>{g.members.length} models</TableCell><TableCell className="space-x-1">{data.keys.filter(k => k.policy.groups.includes(g.id)).map(k => <Badge key={k.id} variant="secondary" className="font-mono">{k.name}</Badge>)}{!data.keys.some(k => k.policy.groups.includes(g.id)) && <span className="text-muted-foreground">—</span>}</TableCell><TableCell className="text-right"><Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setGroupDraft(copy(g)); }}>Edit <ArrowRight className="size-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div>}{!filteredGroups.length && <Empty icon={Layers3} title="No matching groups" detail={data.groups.length ? "Try another search." : "Create a group to reuse its models across keys."} action={<Button onClick={() => { setSearch(""); setGroupDraft({ id: crypto.randomUUID(), name: "", description: "", members: [] }); }}>Create group</Button>} />}</>}
        {page === "keys" && !key && <><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Virtual Keys</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">Create a native key, compose its catalog, and verify the actual /v1/models response.</p></div><Button onClick={() => setKeyForm({ name: "", client: "" })}><Plus className="size-4" />Create key</Button></div><div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-card p-4 shadow-sm"><div className="relative min-w-[220px] max-w-sm flex-1"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input aria-label="Search keys" placeholder="Search keys..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} /></div><ViewControls value={{...preferences, ...listOverrides["keys"]}} onChange={next => setView("keys", next)} onReset={() => resetView("keys")} scope="Keys" fields={["description", "metadata", "providers"]} /></div>{viewFor("keys").layout === "grid" ? <div className={`grid gap-4 ${viewFor("keys").size === "small" ? "sm:grid-cols-2 xl:grid-cols-4" : viewFor("keys").size === "large" ? "lg:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>{filteredKeys.map((k, index) => <Card key={k.id} data-tour={index === 0 ? "keys" : undefined} className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" />{k.name}</CardTitle></CardHeader><CardContent className="flex flex-1 flex-col gap-3 px-4 py-4 sm:px-6">{viewFor("keys").description && <p className="text-xs text-muted-foreground">Client: {k.client}</p>}{viewFor("keys").metadata && <p className="text-base font-semibold">{members(k.policy, data.groups).length} <span className="text-xs font-normal text-muted-foreground">visible models</span></p>}{viewFor("keys").providers && <p className="text-xs text-muted-foreground">Groups: {k.policy.groups.map(id => data.groups.find(g => g.id === id)?.name).filter(Boolean).join(", ") || "None"}</p>}<div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3"><Badge variant={k.managed === false ? "warning" : k.active ? "success" : "secondary"}>{k.managed === false ? "Not configured" : k.active ? "Active" : "Disabled"}</Badge><Button variant="outline" size="sm" onClick={() => go("keys", k.id)}>Open key <ArrowRight className="size-3.5" /></Button></div></CardContent></Card>)}</div> : <div className="overflow-hidden rounded-sm border bg-card shadow-sm"><Table className="[&_td]:py-3 [&_td]:whitespace-normal [&_th]:h-12"><TableHeader className="bg-muted/50"><TableRow><TableHead>Key</TableHead><TableHead>Client</TableHead><TableHead>Groups</TableHead><TableHead>Models</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>{filteredKeys.map((k, index) => <TableRow key={k.id} data-tour={index === 0 ? "keys" : undefined} className="cursor-pointer" onClick={() => go("keys", k.id)}><TableCell className="text-base font-semibold">{k.name}</TableCell><TableCell className="text-muted-foreground">{k.client}</TableCell><TableCell>{k.policy.groups.map(id => data.groups.find(g => g.id === id)?.name).filter(Boolean).join(", ") || "—"}</TableCell><TableCell>{members(k.policy, data.groups).length}</TableCell><TableCell><Badge variant={k.managed === false ? "warning" : k.active ? "success" : "secondary"}>{k.managed === false ? "Not configured" : k.active ? "Active" : "Disabled"}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); go("keys", k.id); }}>Open <ArrowRight className="size-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div>}{!filteredKeys.length && <Empty icon={KeyRound} title="No matching keys" detail={data.keys.length ? "Try another search." : "Create a virtual key to start composing a catalog."} action={<Button onClick={() => { setSearch(""); setKeyForm({ name: "", client: "" }); }}>Create key</Button>} />}</>}
        {page === "keys" && key && activePolicy && <><div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 max-w-full"><Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => go("keys")}><ArrowLeft className="size-4" />All keys</Button><div className="flex flex-wrap items-center gap-2"><h2 className="min-w-0 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{key.name}</h2><Badge variant={key.managed === false ? "warning" : key.active ? "success" : "secondary"}>{key.managed === false ? "Not configured" : key.active ? "Active" : "Disabled"}</Badge></div><p className="mt-1 text-sm text-foreground/70">{key.client} · Revision <span title={revision}>{revision.slice(0, 12)}</span> · {key.managed === false ? "Native key · Not configured in Registry" : "Registry managed"}</p></div><div className="flex flex-wrap items-center gap-2"><VirtualKeySecret keyId={key.id} disabled={!!busy} onUnauthorized={requireLogin} />{key.managed === false ? <><Badge variant="warning">Not configured</Badge><Button variant="outline" disabled={!!busy} onClick={() => setAdoption({ keyId: key.id, operation: "adopt" })}>Adopt in Registry</Button></> : <><Button variant="outline" disabled={!!busy || isDirty} onClick={() => setAdoption({ keyId: key.id, operation: "rebind" })}>Review binding</Button><Button variant="outline" disabled={!!busy} onClick={() => setRenameForm({ id: key.id, name: key.name })}>Rename</Button><Button variant="outline" disabled={!!busy} onClick={() => { void commit({ ...data, keys: data.keys.map(x => x.id === key.id ? { ...x, active: !x.active } : x) }, key.active ? "Disabling key…" : "Enabling key…", [key.id]); }}>{key.active ? "Disable" : "Enable"}</Button></>}</div></div>
          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.8fr)]"><div inert={key.managed === false || !!busy} className="min-w-0 space-y-5"><Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="text-xl">Compose catalog</CardTitle><p className="text-xs text-muted-foreground">Changes apply only to {key.name}. Shared groups are managed separately.</p></CardHeader><CardContent className="space-y-8 px-4 py-5 sm:px-6"><section data-tour="composer"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-base font-semibold">Shared groups</h3><Button variant="link" size="sm" onClick={() => go("groups")}>Manage groups <ArrowRight className="size-3.5" /></Button></div><div className="grid gap-3 sm:grid-cols-2">{data.groups.map(g => <label key={g.id} className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 hover:bg-muted/40 ${activePolicy.groups.includes(g.id) ? "border-chart-success/50 bg-chart-success/10" : "bg-card"}`}><Checkbox checked={activePolicy.groups.includes(g.id)} onCheckedChange={checked => setDraft(old => old ? { ...old, groups: checked ? [...old.groups, g.id] : old.groups.filter(x => x !== g.id) } : old)} /><span className="flex-1"><span className="block text-sm font-medium">{g.name}</span><span className="text-xs text-muted-foreground">{g.members.length} models</span></span></label>)}</div>{!data.groups.length && <p className="text-sm text-muted-foreground">No groups yet. Add individual models below or create a group.</p>}</section><section className="border-t pt-6"><h3 className="mb-2 text-base font-semibold">Models and local exceptions</h3><p className="mb-3 text-xs text-muted-foreground">An exclusion here does not change a shared group or another key.</p><p className="mb-2 text-xs text-muted-foreground">{members(activePolicy, data.groups).length} selected · {activePolicy.excluded.length} local exclusions. Selected models remain selected when filters hide them.</p><ModelBrowser models={data.models} selected={members(activePolicy, data.groups)} onToggle={id => setDraft(old => old ? toggleModel(old, id, data.groups) : old)} onSetSelected={ids => setDraft(old => old ? data.models.reduce((policy, model) => members(policy, data.groups).includes(model.id) === ids.includes(model.id) ? policy : toggleModel(policy, model.id, data.groups), old) : old)} preferences={preferences} compact label="Key models" /><div className="mt-2 flex flex-wrap gap-1">{activePolicy.excluded.map(id => <Badge key={id} variant="outline">Excluded locally: {data.models.find(m => m.id === id)?.name || id}</Badge>)}</div></section><section className="border-t pt-6"><h3 className="mb-2 text-base font-semibold">Visible model names</h3><div className="flex flex-wrap gap-2">{formats.map(format => <Button key={format} variant={activePolicy.naming === format ? "default" : "outline"} size="sm" onClick={() => setDraft(old => old ? { ...old, naming: format } : old)}>{format}</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">Short names use the explicitly configured Bifrost route. Multiple accesses do not imply load balancing.</p></section></CardContent></Card><div className="flex flex-wrap items-center gap-3 rounded-sm border bg-card p-4 shadow-sm"><Button disabled={reconcileBlocked || (!isDirty && !needsReconcile) || key.managed === false || !!busy} onClick={publishKey}>{needsReconcile ? "Retry native apply" : "Publish changes"}</Button><Button variant="outline" disabled={!isDirty || !!busy} onClick={() => { setDraft(copy(key.policy)); toast.success("Draft discarded."); }}>Discard draft</Button><span className={`basis-full text-xs font-medium sm:basis-auto ${isDirty ? "text-chart-warning-ink" : "text-muted-foreground"}`}>{key.managed === false ? "This native key has no Registry policy" : reconcileBlocked ? "Reload workspace before another write" : needsReconcile ? "Registry saved; native permissions need reconciliation" : isDirty ? "Unpublished changes" : "Draft matches published policy"}</span></div></div>
          <div className="min-w-0 space-y-5"><Card data-tour="preview" className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-primary/10 px-4 py-4 sm:px-6"><CardTitle className="flex items-center gap-2 text-lg"><Eye className="size-4" />Live draft preview</CardTitle><p className="text-xs text-muted-foreground">Expected from the current editor state · {predicted.length} IDs</p></CardHeader><CardContent className="px-4 py-4 sm:px-6"><div className="max-h-56 space-y-2 overflow-auto">{predicted.map(id => <div key={id} className="flex min-w-0 items-center justify-between gap-2 rounded-sm border px-3 py-2 font-mono text-xs"><span className="min-w-0 break-all">{id}</span>{diff.added.includes(id) && <Badge variant="success">+ new</Badge>}</div>)}{!predicted.length && <p className="rounded-sm border border-dashed p-6 text-center text-sm text-muted-foreground">This key would see no models.</p>}</div>{diff.removed.length > 0 && <p className="mt-3 text-xs font-medium text-destructive">To remove: {diff.removed.join(", ")}</p>}</CardContent></Card><Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 px-4 py-4 sm:px-6"><CardTitle className="flex items-center gap-2 text-lg"><Activity className="size-4" />Published catalog and readback</CardTitle><p className="text-xs text-muted-foreground">The last server readback is separate from the draft preview.</p></CardHeader><CardContent className="px-4 py-4 sm:px-6"><div className="mb-4 flex flex-wrap items-center gap-2"><Badge variant={key.publication?.state === "verified" ? "success" : "warning"}>{key.publication?.state === "verified" ? "Verified" : key.publication?.state === "drift" ? "Drift detected" : "Not verified"}</Badge><Button variant="outline" size="sm" disabled={key.managed === false || !!busy} onClick={reread}><RotateCcw className="size-3.5" />Read again</Button><Button variant="ghost" size="sm" disabled={!key.publication?.actual} onClick={downloadJson}><FileJson className="size-3.5" />Export JSON</Button></div><p className="mb-2 text-xs text-muted-foreground">Published IDs: {exposed(key.policy, data.groups, data.models).join(", ") || "None"}</p><p className="mb-3 break-all text-xs text-muted-foreground">{key.publication?.checkedAt ? `Checked ${new Date(key.publication.checkedAt).toLocaleString()} · revision ${key.publication.revision.slice(0, 12)}` : "No readback recorded for this revision."}</p>{key.publication?.actual && <p className="mb-3 break-all text-xs text-muted-foreground">Last successful response: {key.publication.observedAt ? new Date(key.publication.observedAt).toLocaleString() : "time unavailable"} · observed revision {key.publication.observedRevision?.slice(0, 12) || "unknown"}</p>}{key.publication?.error && <p role="alert" className="mb-3 text-xs text-chart-warning-ink">{key.publication.error}</p>}{key.publication?.state === "drift" && <p className="mb-3 text-xs text-destructive">Missing: {key.publication.missing.join(", ") || "none"} · Unexpected: {key.publication.unexpected.join(", ") || "none"}</p>}<div className="max-h-44 space-y-2 overflow-auto">{observed.map(id => <div key={id} className="break-all rounded-sm border px-3 py-2 font-mono text-xs">{id}</div>)}{!observed.length && <p className="text-sm text-muted-foreground">{key.publication?.actual ? "No models in the last response." : "No successful readback available."}</p>}</div>{key.publication?.actual && <><Button variant="link" size="sm" className="mt-2 px-0" onClick={() => setShowJson(!showJson)}>{showJson ? "Hide" : "Show"} response JSON</Button>{showJson && <pre className="max-h-56 overflow-auto rounded-sm bg-muted p-3 text-[11px]">{JSON.stringify({ object: "list", data: observed.map(id => ({ id, object: "model" })) }, null, 2)}</pre>}</>}</CardContent></Card></div></div></>}
        {page === "qualification" && <div className="max-w-2xl space-y-5"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Laboratory</h2><Card className="p-6"><Badge variant="secondary">Planned</Badge><p className="mt-3 text-sm text-muted-foreground">Live qualification is not available yet. Catalog, groups and virtual keys are connected to Bifrost.</p></Card></div>}
        {page === "settings" && <div className="max-w-2xl space-y-5"><div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">Configure AI assistance and local display preferences.</p></div><AssistantSettings onSaved={() => void load()} onUnauthorized={requireLogin} /><Card className="gap-0 overflow-hidden py-0"><CardHeader className="border-b bg-muted/40 py-4"><CardTitle className="text-lg">Global defaults</CardTitle></CardHeader><CardContent className="space-y-6 py-5"><ViewControls value={preferences} onChange={setPreferences} scope="Global" /><div><p className="mb-2 text-sm font-medium">Primary identity on model cards</p><div className="flex gap-2"><Button variant={preferences.logo === "creator" ? "default" : "outline"} size="sm" onClick={() => setPreferences(old => ({ ...old, logo: "creator" }))}>Creator logo</Button><Button variant={preferences.logo === "provider" ? "default" : "outline"} size="sm" onClick={() => setPreferences(old => ({ ...old, logo: "provider" }))}>Serving providers</Button></div><p className="mt-2 text-xs text-muted-foreground">Choose the primary logo; provider details can be shown separately. Unknown creator brands use text.</p></div></CardContent></Card><Card className="gap-0 overflow-hidden py-0"><details><summary className="cursor-pointer bg-muted/40 px-6 py-4 text-base font-medium">Advanced · configuration preview</summary><CardContent className="space-y-4 border-t py-5"><p className="text-sm text-muted-foreground">The proposed config.json below describes catalogue presentation only. It is not an import-ready plugin config and does not synchronize with Bifrost.</p><pre className="overflow-auto rounded-sm bg-muted p-3 text-xs">{JSON.stringify({ prototype: "bifrost-registry-ui", ui: { viewDefaults: preferences } }, null, 2)}</pre><Button variant="outline" size="sm" onClick={() => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ prototype: "bifrost-registry-ui", ui: { viewDefaults: preferences } }, null, 2)], { type: "application/json" })); a.download = "config.json"; a.click(); URL.revokeObjectURL(a.href); }}>Export proposed config.json</Button></CardContent></details></Card></div>}
      </main></div></div>
    <Dialog open={discoveryOpen} onOpenChange={setDiscoveryOpen}><DialogContent className="flex max-h-[90vh] max-w-5xl flex-col"><DialogHeader><DialogTitle>Add model from discovery</DialogTitle><DialogDescription>Configured models discovered from the connected Bifrost instance. Review routing and metadata before saving.</DialogDescription></DialogHeader><div className="min-h-0 overflow-auto"><ModelBrowser models={discovery.filter(model => !data.models.some(existing => existing.id === model.id))} onOpen={model => { setCreatingModel(true); setModelError(""); setModelDraft(copy(model)); setDiscoveryOpen(false); }} preferences={preferences} compact label="Discovered models" /></div><DialogFooter><Button variant="outline" onClick={() => { setCreatingModel(true); setModelError(""); setModelDraft(newModel()); setDiscoveryOpen(false); }}>Advanced: custom model</Button><Button variant="ghost" onClick={() => setDiscoveryOpen(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>
    <Sheet open={!!modelDraft} onOpenChange={open => { if (open || !modelDraft || busyRef.current) return; if (!same(modelDraft, creatingModel ? newModel() : data.models.find(m => m.id === modelDraft.id))) setConfirm({ title: "Discard model changes?", text: "Unsaved model details will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", action: () => setModelDraft(null) }); else setModelDraft(null); }}>{modelDraft && <ModelEditor draft={modelDraft} onChange={setModelDraft} creating={creatingModel} workspace={catalog} error={modelError} busy={!!busy} onSave={updateModel} onCancel={() => setModelDraft(null)} onDelete={deleteModel} onUnauthorized={requireLogin} actionSlot={<AssistantSuggestion draft={modelDraft} onChange={setModelDraft} onOpenSettings={() => setConfirm({ title: "Open AI settings?", text: "This closes the model editor and discards its unsaved changes.", confirmLabel: "Open settings", cancelLabel: "Keep editing", action: () => { setModelDraft(null); go("settings"); } })} />} />}</Sheet>
    <Sheet open={!!groupDraft} onOpenChange={open => { if (open || !groupDraft || busyRef.current) return; const original = data.groups.find(g => g.id === groupDraft.id); if (!same(groupDraft, original || { id: groupDraft.id, name: "", description: "", members: [] })) setConfirm({ title: "Discard group changes?", text: "Unsaved group selections will be lost.", confirmLabel: "Discard changes", cancelLabel: "Keep editing", action: () => setGroupDraft(null) }); else setGroupDraft(null); }}><SheetContent inert={!!busy} className="p-4 sm:p-6"><SheetHeader className="border-b bg-muted/40 pb-4"><SheetTitle className="text-xl">{groupDraft && data.groups.some(g => g.id === groupDraft.id) ? "Edit group" : "Create group"}</SheetTitle><SheetDescription className="sr-only">Choose the group models and review the impact on virtual keys.</SheetDescription></SheetHeader>{groupDraft && <div className="custom-scrollbar flex-1 space-y-5 overflow-auto pr-2"><div><label className="mb-2 block text-sm font-medium">Name</label><Input aria-label="Group name" value={groupDraft.name} onChange={e => setGroupDraft({ ...groupDraft, name: e.target.value })} /></div><div><label className="mb-2 block text-sm font-medium">Description</label><Input aria-label="Group description" value={groupDraft.description} onChange={e => setGroupDraft({ ...groupDraft, description: e.target.value })} /></div><div><h3 className="mb-2 text-sm font-medium">Models in group</h3><p className="mb-2 text-xs text-muted-foreground">{groupDraft.members.length} selected, including models hidden by filters</p><div className="mb-2 flex gap-1"><Button size="sm" variant={groupEditorView === "cards" ? "secondary" : "ghost"} aria-pressed={groupEditorView === "cards"} onClick={() => setGroupEditorView("cards")}>Cards</Button><Button size="sm" variant={groupEditorView === "tree" ? "secondary" : "ghost"} aria-pressed={groupEditorView === "tree"} onClick={() => setGroupEditorView("tree")}>Creator tree</Button></div>{groupEditorView === "cards" ? <ModelBrowser models={data.models} selected={groupDraft.members} onToggle={id => setGroupDraft(old => old ? { ...old, members: old.members.includes(id) ? old.members.filter(x => x !== id) : [...old.members, id] } : old)} onSetSelected={ids => setGroupDraft(old => old ? { ...old, members: ids } : old)} preferences={preferences} compact label="Group models" /> : <GroupTree models={data.models} selected={groupDraft.members} onToggle={id => setGroupDraft(old => old ? { ...old, members: old.members.includes(id) ? old.members.filter(x => x !== id) : [...old.members, id] } : old)} />}</div><div><h3 className="mb-2 text-sm font-medium">Impact if published</h3>{(() => { const next = data.groups.some(g => g.id === groupDraft.id) ? data.groups.map(g => g.id === groupDraft.id ? groupDraft : g) : [...data.groups, groupDraft]; const affected = keyImpact(data.keys, data.groups, next, data.models); const unaffected = data.keys.filter(k => !affected.some(row => row.key.id === k.id)); const names = (ids: string[]) => ids.map(id => data.models.find(m => m.id === id)?.name || id).join(", ") || "None"; return <div className="space-y-2">{affected.map(({ key: k }) => { const impact = modelImpact(k, data.groups, next); return <div key={k.id} className="rounded-sm border border-primary/30 bg-primary/5 p-4 text-xs"><div className="border-b pb-2 text-base font-semibold">{k.name} · affected</div><p className="mt-2"><span className="font-medium">Added:</span> {names(impact.added)}</p><p><span className="font-medium">Removed:</span> {names(impact.removed)}</p><p><span className="font-medium">Unchanged:</span> {names(impact.unchanged)}</p><p><span className="font-medium">Local exclusions preserved:</span> {names(impact.exclusions)}</p></div>; })}{unaffected.map(k => <div key={k.id} className="rounded-sm border bg-card p-4 text-xs"><span className="font-medium">{k.name} · unaffected</span><p>Visible models: {names(members(k.policy, data.groups))}</p><p>Local exclusions preserved: {names(k.policy.excluded)}</p></div>)}{!data.keys.length && <p className="text-xs text-muted-foreground">No keys exist yet.</p>}</div>; })()}</div></div>}<SheetFooter className="flex-col justify-between border-t px-0 pb-0 pt-4 sm:flex-row">{groupDraft && data.groups.some(g => g.id === groupDraft.id) && <Button variant="ghost" className="text-destructive" onClick={() => { const g = groupDraft; setConfirm({ title: `Delete ${g.name}?`, text: "Keys using this group will lose its models; their local selections remain.", action: () => {
      const groups = data.groups.filter(x => x.id !== g.id);
      const keys = data.keys.map(k => ({ ...k, policy: { ...k.policy, groups: k.policy.groups.filter(id => id !== g.id) } }));
      const impacted = data.keys.filter(k => k.managed !== false && k.policy.groups.includes(g.id)).map(k => k.id);
      void (async () => { if (await commit({ ...data, groups, keys }, "Deleting group…", impacted)) setGroupDraft(null); })();
    } }); }}>Delete</Button>}<div className="flex flex-wrap gap-2 sm:ml-auto"><Button variant="outline" onClick={() => setGroupDraft(null)}>Cancel</Button><Button disabled={!!busy} onClick={publishGroup}>Publish group</Button></div></SheetFooter></SheetContent></Sheet>
    <Dialog open={!!createdSecret} onOpenChange={open => { if (!open) setCreatedSecret(""); }}><DialogContent><DialogHeader><DialogTitle>Copy the virtual key secret</DialogTitle><DialogDescription>This native Bifrost secret is shown once. Store it before closing.</DialogDescription></DialogHeader><code className="break-all rounded-sm bg-muted p-3 text-xs" aria-label="Virtual key secret">{createdSecret}</code><DialogFooter><Button onClick={() => { void navigator.clipboard.writeText(createdSecret).then(() => toast.success("Secret copied.")).catch(() => toast.error("Could not copy secret.")); }}>Copy secret</Button><Button variant="outline" onClick={() => setCreatedSecret("")}>Done</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!keyForm} onOpenChange={open => !open && !busyRef.current && setKeyForm(null)}><DialogContent inert={!!busy}><DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">Create virtual key</DialogTitle><DialogDescription>A native Bifrost virtual key will be created. Its secret is shown once.</DialogDescription></DialogHeader>{keyForm && <div className="space-y-4"><div><label className="mb-2 block text-sm font-medium">Name</label><Input aria-label="Key name" autoFocus value={keyForm.name} onChange={e => setKeyForm({ ...keyForm, name: e.target.value })} placeholder="e.g. Hermes staging" /></div><div><label className="mb-2 block text-sm font-medium">Client</label><Input aria-label="Client name" value={keyForm.client} onChange={e => setKeyForm({ ...keyForm, client: e.target.value })} placeholder="e.g. Hermes" /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setKeyForm(null)}>Cancel</Button><Button disabled={!!busy} onClick={saveKey}>Create key</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!renameForm} onOpenChange={open => !open && !busyRef.current && setRenameForm(null)}><DialogContent inert={!!busy}><DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">Rename virtual key</DialogTitle><DialogDescription>Updates the saved key name.</DialogDescription></DialogHeader>{renameForm && <div><label className="mb-2 block text-sm font-medium">Name</label><Input aria-label="Key name" autoFocus value={renameForm.name} onChange={e => setRenameForm({ ...renameForm, name: e.target.value })} /></div>}<DialogFooter><Button variant="outline" onClick={() => setRenameForm(null)}>Cancel</Button><Button disabled={!!busy} onClick={() => { if (!renameForm?.name.trim() || data.keys.some(k => k.id !== renameForm.id && k.name.toLowerCase() === renameForm.name.trim().toLowerCase())) { toast.error("Name is empty or already used."); return; } const form = renameForm; void (async () => { if (await commit({ ...data, keys: data.keys.map(k => k.id === form.id ? { ...k, name: form.name.trim() } : k) }, "Renaming key…")) setRenameForm(null); })(); }}>Save</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!confirm} onOpenChange={open => !open && setConfirm(null)}><DialogContent><DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">{confirm?.title}</DialogTitle><DialogDescription>{confirm?.text}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>{confirm?.cancelLabel || "Cancel"}</Button><Button variant="destructive" disabled={!!busy} onClick={() => { confirm?.action(); setConfirm(null); }}>{confirm?.confirmLabel || "Delete"}</Button></DialogFooter></DialogContent></Dialog>
    {adoption && <AdoptionDialog key={`${adoption.keyId}/${adoption.operation}`} keyId={adoption.keyId} operation={adoption.operation} onClose={() => setAdoption(null)} onUnauthorized={requireLogin} onApplied={() => { toast.success(adoption.operation === "adopt" ? "Native key adopted." : "Key binding updated."); void load(); }} />}
    <Toaster closeButton position="bottom-right" richColors />
  </SidebarProvider></TooltipProvider>;
}

function Empty({ icon: Icon, title, detail, action }: { icon: typeof Search; title: string; detail: string; action: React.ReactNode }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-12 text-center"><Icon className="size-16 stroke-1 text-muted-foreground" /><h3 className="text-xl font-medium text-muted-foreground">{title}</h3><p className="max-w-lg text-sm text-muted-foreground">{detail}</p><div className="mt-2">{action}</div></div>;
}
