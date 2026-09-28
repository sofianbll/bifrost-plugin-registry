import { useEffect, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Activity, ArrowRight, CircleHelp, Database, Download, FileJson, KeyRound, Languages, Layers3, LogOut, Plus, Search, Settings2, Sun, Moon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { catalogModels, copy, exposed, keyImpact, members, same, type Demo, type Group, type Key, type Model, type Policy, type PricingProof } from "../domain/registry";
import { firstRegistrationIssue } from "../features/catalog/model-editor-data";
import { ApiError, clearAdminToken, createKey, getWorkspace, putWorkspace, readbackKey, setAdminToken, type AdoptionOperation, type Workspace } from "../data/api";
import ModelBrowser from "../features/catalog/ModelBrowser";
import GatewayInventory from "../features/gateway/GatewayInventory";
import ModelEditor from "../features/catalog/ModelEditor";
import type { CatalogOverride } from "../features/catalog/model-card-fields";
import RegistrySettings from "../features/settings/RegistrySettings";
import AssistantSuggestion from "../features/assistant/AssistantSuggestion";
import VirtualKeySecret from "../features/keys/VirtualKeySecret";
import { omitUnchangedReferenceIds } from "../features/catalog/model-editor-data";
import CatalogMetadata from "../features/catalog/CatalogMetadata";
import SnapshotTransfer from "../features/snapshot/SnapshotTransfer";
import AdoptionDialog from "../features/keys/AdoptionDialog";
import ReferenceCatalogBrowser from "../features/catalog/ReferenceCatalogBrowser";
import { ViewControls, defaultViewOptions, updateViewOverride, type ViewOptions } from "../components/registry/ViewOptions";
import { LanguageContext, useCopy, type Language } from "../lib/locale";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import KeyComposer from "../features/keys/KeyComposer";
import { preserveAdoptionDraft } from "../features/keys/KeyComposer.state";
import KeyLibrary from "../features/keys/KeyLibrary";
import { GroupLibrary } from "../features/groups/GroupLibrary";
import { GroupEditor } from "../features/groups/GroupEditor";

type Page = "gateway" | "models" | "catalog" | "groups" | "keys" | "settings" | "snapshot";
type Confirm = { title: string; text: string; action: () => void; confirmLabel?: string; cancelLabel?: string } | null;
const nav: { id: Page; label: Record<Language, string>; icon: typeof Database }[] = [
  { id: "models", label: { en: "My models", fr: "Mes modèles" }, icon: Database },
  { id: "groups", label: { en: "Groups", fr: "Groupes" }, icon: Layers3 },
  { id: "keys", label: { en: "Virtual keys", fr: "Clés virtuelles" }, icon: KeyRound },
  { id: "settings", label: { en: "Settings", fr: "Réglages" }, icon: Settings2 },
  { id: "gateway", label: { en: "Existing gateway", fr: "Gateway existant" }, icon: Activity },
  { id: "catalog", label: { en: "Documentary data", fr: "Données documentaires" }, icon: FileJson },
  { id: "snapshot", label: { en: "Import & export", fr: "Import & export" }, icon: Download },
];
function route(): { page: Page; id?: string } {
  const [page, id] = location.hash.slice(2).split("/");
  if (page === "qualification") history.replaceState(null, "", `${location.pathname}${location.search}#/models`);
  return { page: nav.some(n => n.id === page) ? page as Page : "models", id };
}

function CollapsedSidebarExpand() {
  const { isMobile, state } = useSidebar();
  const copyText = useCopy();
  if (isMobile || state !== "collapsed") return null;
  return <SidebarTrigger className="size-8" aria-label={copyText("Expand sidebar", "Afficher la barre latérale")} title={copyText("Expand sidebar", "Afficher la barre latérale")} />;
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

function RegistryApp({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const copyText = useCopy();
  const [canUseExpert, setCanUseExpert] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  const [expert, setExpert] = useState(() => new URLSearchParams(location.search).get("mode") === "expert");
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setCanUseExpert(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const effectiveExpert = canUseExpert && expert;
  const setExpertMode = (next: boolean) => {
    const params = new URLSearchParams(location.search);
    params.set("mode", next ? "expert" : "basic");
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
    setExpert(next);
  };
  const isMobile = useIsMobile();
  const [data, setData] = useState<Demo>({ models: [], groups: [], keys: [], campaigns: [] });
  const [revision, setRevision] = useState("");
  const [discovery, setDiscovery] = useState<Model[]>([]);
  const [pricingProofs, setPricingProofs] = useState<PricingProof[]>([]);
  const [connection, setConnection] = useState<Workspace["connection"] | null>(null);
  const [loading, setLoading] = useState(true);
  const snapshotMode = connection?.mode === "snapshot";
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
  const [createdSecretError, setCreatedSecretError] = useState("");
  const createdSecretInput = useRef<HTMLInputElement>(null);
  const [locationState, setLocationState] = useState(route);
  const [search, setSearch] = useState("");
  const [modelDraft, setModelDraft] = useState<Model | null>(null);
  const modelBaseline = useRef<Model | null>(null);
  const [modelOverrides, setModelOverrides] = useState<CatalogOverride[]>([]);
  const [creatingModel, setCreatingModel] = useState(false);
  const [modelError, setModelError] = useState("");
  const [groupDraft, setGroupDraft] = useState<Group | null>(null);
  const groupBaseline = useRef<Group | null>(null);
  const [keyForm, setKeyForm] = useState<{ name: string; client: string } | null>(null);
  const [renameForm, setRenameForm] = useState<{ id: string; name: string } | null>(null);
  const [adoption, setAdoption] = useState<{ keyId: string; operation: AdoptionOperation } | null>(null);
  const [settingsSection, setSettingsSection] = useState<"general" | "help">("general");
  const [catalogFocus, setCatalogFocus] = useState<{ target: "reference" | "access"; id: string } | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [preferences, setPreferences] = useState<ViewOptions>(() => { try { const saved = JSON.parse(localStorage.getItem("registry-prototype-view") || "{}"); return { ...defaultViewOptions, ...saved, shape: saved.shape || defaultViewOptions.shape }; } catch { return defaultViewOptions; } });
  const [listOverrides, setListOverrides] = useState<Record<string, Partial<ViewOptions>>>({});
  useEffect(() => { localStorage.setItem("registry-prototype-view", JSON.stringify(preferences)); }, [preferences]);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); document.documentElement.style.colorScheme = dark ? "dark" : "light"; }, [dark]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [draft, setDraft] = useState<Policy | null>(null);
  const pendingKeyDraft = useRef<{ keyId: string; policy: Policy } | null>(null);

  const applyWorkspace = (workspace: Workspace) => {
    setData(workspace.data);
    setRevision(workspace.revision);
    setDiscovery(workspace.discovery);
    setPricingProofs(workspace.pricingProofs || []);
    setConnection(workspace.connection);
    setApiError("");
  };
  const requireLogin = () => {
    clearAdminToken();
    setStandaloneAuthenticated(false);
    setLoginRequired(true);
    setLoginToken("");
    setLoginError(revision ? copyText("Your session expired. Enter the admin token to continue.", "Votre session a expiré. Saisissez le jeton administrateur pour continuer.") : "");
  };
  const load = async () => {
    if (busyRef.current) return;
    setLoading(true);
    try { applyWorkspace(await getWorkspace()); if (reconcileBlocked) { setReconcileBlocked(false); setNeedsReconcile(false); } }
    catch (error) { if (error instanceof ApiError && error.status === 401) requireLogin(); else setApiError(error instanceof ApiError && error.status === 403 ? copyText("Access to the Registry panel was denied (403).", "L’accès au panneau Registry a été refusé (403).") : error instanceof ApiError ? error.message : copyText("Could not connect to Registry. Check the network and try again.", "Connexion à Registry impossible. Vérifiez le réseau puis réessayez.")); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = loginToken.trim();
    if (!token) { setLoginError(copyText("Enter the admin token.", "Saisissez le jeton administrateur.")); return; }
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
      setLoginError(error instanceof ApiError && error.status === 401 ? copyText("Invalid or expired admin token.", "Jeton administrateur invalide ou expiré.") : error instanceof ApiError && error.status === 403 ? copyText("Access to the Registry panel was denied (403).", "L’accès au panneau Registry a été refusé (403).") : copyText("Could not connect to Registry. Check the network and try again.", "Connexion à Registry impossible. Vérifiez le réseau puis réessayez."));
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
    setPricingProofs([]);
    setConnection(null);
    setApiError("");
    setNeedsReconcile(false);
    setReconcileBlocked(false);
    setCreatedSecret("");
    setModelDraft(null);
    modelBaseline.current = null;
    setModelError("");
    setCreatingModel(false);
    setGroupDraft(null);
    groupBaseline.current = null;
    setDraft(null);
    pendingKeyDraft.current = null;
    setKeyForm(null);
    setRenameForm(null);
    setAdoption(null);
    setCatalogFocus(null);
    setConfirm(null);
    setDiscoveryOpen(false);
    setSearch("");
    setListOverrides({});
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
  const commit = async (next: Demo, label: string, verifyIds: string[] = [], overrides?: CatalogOverride[]) => operation(label, async () => {
    let saved: Workspace;
    try { saved = await putWorkspace(next, revision, overrides); }
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
    const verified = verifyIds.length && !snapshotMode ? await verify(verifyIds) : true;
    toast[verified ? "success" : "warning"](snapshotMode ? copyText("Saved in the local copy. Pulsar remains unchanged.", "Enregistré dans la copie locale. Pulsar reste inchangé.") : verifyIds.length ? verified ? copyText("Published and verified through /v1/models.", "Publié et vérifié via /v1/models.") : copyText("Saved; readback has drift or could not be verified.", "Enregistré ; la relecture diffère ou n’a pas pu être vérifiée.") : copyText("Saved.", "Enregistré."));
  });

  const navigate = (page: Page, id?: string) => {
    const hash = `#/${page}${id ? `/${id}` : ""}`;
    if (location.hash !== hash) history.pushState(null, "", `${location.pathname}${location.search}${hash}`);
    setLocationState({ page, id });
    setSearch("");
  };
  const go = (page: Page, id?: string) => {
    if (locationState.page === "keys" && locationState.id && draft && !same(data.keys.find(k => k.id === locationState.id)?.policy, draft) && (page !== "keys" || id !== locationState.id)) {
      setConfirm({ title: copyText("Discard key draft?", "Abandonner le brouillon de clé ?"), text: copyText("Unpublished key selections will be lost.", "Les sélections non publiées seront abandonnées."), confirmLabel: copyText("Discard changes", "Abandonner les modifications"), cancelLabel: copyText("Keep editing", "Continuer à modifier"), action: () => navigate(page, id) });
      return;
    }
    navigate(page, id);
  };
  const { page, id: pageId } = locationState;
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { contentRef.current?.scrollTo(0, 0); }, [page, pageId]);
  const key = data.keys.find(k => k.id === pageId);
  useEffect(() => {
    if (!key) { if (!pendingKeyDraft.current) setDraft(null); return; }
    if (pendingKeyDraft.current?.keyId === key.id) {
      setDraft(pendingKeyDraft.current.policy);
      pendingKeyDraft.current = null;
    } else setDraft(copy(key.policy));
  }, [key?.id]);
  const activePolicy = draft || key?.policy;
  const isDirty = Boolean(key && draft && !same(key.policy, draft));
  const modelIsDirty = Boolean(modelDraft && modelBaseline.current && (!same(modelDraft, modelBaseline.current) || modelOverrides.length > 0));
  const groupIsDirty = Boolean(groupDraft && groupBaseline.current && !same(groupDraft, groupBaseline.current));
  const requestSignOut = () => {
    if (modelIsDirty || groupIsDirty || isDirty) setConfirm({ title: copyText("Discard drafts and sign out?", "Abandonner les brouillons et se déconnecter ?"), text: copyText("Unsaved changes will be lost.", "Les modifications non enregistrées seront abandonnées."), confirmLabel: copyText("Discard and sign out", "Abandonner et se déconnecter"), cancelLabel: copyText("Keep editing", "Continuer à modifier"), action: signOut });
    else signOut();
  };
  useEffect(() => {
    if (!modelIsDirty && !groupIsDirty && !isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    addEventListener("beforeunload", onBeforeUnload);
    return () => removeEventListener("beforeunload", onBeforeUnload);
  }, [modelIsDirty, groupIsDirty, isDirty]);
  useEffect(() => {
    const onHash = () => {
      const target = route();
      if (target.page === page && target.id === pageId) return;
      if (isDirty && (target.page !== page || target.id !== pageId)) {
        history.replaceState(null, "", `${location.pathname}${location.search}#/${page}${pageId ? `/${pageId}` : ""}`);
        setConfirm({ title: copyText("Discard key draft?", "Abandonner le brouillon de clé ?"), text: copyText("Unpublished key selections will be lost.", "Les sélections non publiées seront abandonnées."), confirmLabel: copyText("Discard changes", "Abandonner les modifications"), cancelLabel: copyText("Keep editing", "Continuer à modifier"), action: () => navigate(target.page, target.id) });
      } else { setLocationState(target); setSearch(""); }
    };
    addEventListener("hashchange", onHash);
    addEventListener("popstate", onHash);
    return () => { removeEventListener("hashchange", onHash); removeEventListener("popstate", onHash); };
  }, [isDirty, page, pageId]);
  const filteredGroups = data.groups.filter(g => `${g.name} ${g.description}`.toLowerCase().includes(search.toLowerCase()));
  const filteredKeys = data.keys.filter(k => `${k.name} ${k.client}`.toLowerCase().includes(search.toLowerCase()));
  const catalog = catalogModels(data.models, discovery);
  const registeredIds = new Set(data.models.map(model => model.id));

  const newModel = (): Model => ({ id: "", name: "", creator: "Unknown", family: "Unknown", inputModalities: [], outputModalities: [], tasks: [], kind: "Unknown", summary: "", context: "Unknown", capabilities: {}, accesses: [{ provider: "", id: "", route: "Direct provider", status: "Unknown", nativeModel: "" }] });
  const openModel = (model: Model, creating: boolean) => { modelBaseline.current = copy(model); setModelOverrides([]); setCreatingModel(creating); setModelError(""); setModelDraft(copy(model)); };
  const closeModel = () => {
    if (!modelDraft || busyRef.current) return;
    if (modelIsDirty) setConfirm({ title: "Abandonner les modifications ?", text: "La fiche et ses corrections non enregistrées seront abandonnées.", confirmLabel: "Abandonner le brouillon", cancelLabel: "Continuer à modifier", action: () => setModelDraft(null) });
    else setModelDraft(null);
  };
  const openGroup = (group: Group) => { groupBaseline.current = copy(group); setGroupDraft(copy(group)); };
  const closeGroup = () => {
    if (!groupDraft || busyRef.current) return;
    if (groupIsDirty) setConfirm({ title: copyText("Discard group changes?", "Abandonner les modifications du groupe ?"), text: copyText("Unsaved group selections will be lost.", "Les sélections non enregistrées du groupe seront abandonnées."), confirmLabel: copyText("Discard changes", "Abandonner les modifications"), cancelLabel: copyText("Keep editing", "Continuer à modifier"), action: () => setGroupDraft(null) });
    else setGroupDraft(null);
  };
  const updateModel = async (overrides: CatalogOverride[]) => {
    if (!modelDraft || busyRef.current) return;
    if (firstRegistrationIssue(modelDraft)) { setModelError("Renseignez l’identifiant commun, le nom, au moins un endpoint Registry par accès et chaque accès fournisseur valide."); return; }
    if (creatingModel && data.models.some(m => m.id === modelDraft.id)) { setModelError("That model ID already exists."); return; }
    const allAccessIds = data.models.filter(m => m.id !== modelDraft.id).flatMap(m => m.accesses.map(a => a.id));
    if (modelDraft.accesses.some(a => allAccessIds.includes(a.id)) || new Set(modelDraft.accesses.map(a => a.id)).size !== modelDraft.accesses.length) { setModelError("Provider access IDs must be unique."); return; }
    const saved = omitUnchangedReferenceIds(copy(modelDraft), catalog);
    const next = { ...data, models: creatingModel ? [...data.models, copy(saved)] : data.models.map(m => m.id === saved.id ? copy(saved) : m) };
    const impacted = data.keys.filter(k => k.managed !== false && members(k.policy, data.groups).includes(saved.id)).map(k => k.id);
    if (await commit(next, "Enregistrement de la fiche…", impacted, overrides)) { setModelDraft(null); setModelError(""); }
  };
  const deleteModel = (model: Model) => {
    const emptied = data.groups.filter(g => g.members.includes(model.id) && !g.members.some(id => id !== model.id));
    if (emptied.length) { const message = `Remove this model from or delete these groups first: ${emptied.map(g => g.name).join(", ")}.`; setModelError(message); toast.error(message); return; }
    const used = data.keys.filter(k => members(k.policy, data.groups).includes(model.id)).length;
    setConfirm({ title: `Delete ${model.name}?`, text: `This removes the model from its groups and key selections. ${used} key catalog${used === 1 ? "" : "s"} will change.`, action: () => {
      const models = data.models.filter(m => m.id !== model.id);
      const groups = data.groups.map(g => ({ ...g, members: g.members.filter(id => id !== model.id) }));
      const keys = data.keys.map(k => {
        const accessSelection = k.policy.accessSelection ? { ...k.policy.accessSelection } : undefined;
        if (accessSelection) {
          delete accessSelection[model.id];
          if (Object.keys(accessSelection).length === 0) {
            const { accessSelection: _, ...rest } = k.policy;
            return { ...k, policy: rest };
          }
        }
        return { ...k, policy: { ...k.policy, added: k.policy.added.filter(id => id !== model.id), excluded: k.policy.excluded.filter(id => id !== model.id), accessSelection } };
      });
      void (async () => { if (await commit({ ...data, models, groups, keys }, "Deleting model…", data.keys.filter(k => k.managed !== false && members(k.policy, data.groups).includes(model.id)).map(k => k.id))) setModelDraft(null); })();
    } });
  };
  const publishGroup = async () => {
    if (!groupDraft?.name.trim() || !groupDraft.members.length) { toast.error("Enter a name and select at least one model."); return; }
    if (data.groups.some(g => g.id !== groupDraft.id && g.name.toLowerCase() === groupDraft.name.trim().toLowerCase())) { toast.error("A group with this name already exists."); return; }
    const nextGroup = { ...groupDraft, name: groupDraft.name.trim() };
    const nextGroups = data.groups.some(g => g.id === groupDraft.id) ? data.groups.map(g => g.id === groupDraft.id ? nextGroup : g) : [...data.groups, nextGroup];
    const impacted = keyImpact(data.keys, data.groups, nextGroups, data.models).filter(row => row.key.managed !== false).map(row => row.key.id);
    if (await commit({ ...data, groups: nextGroups }, snapshotMode ? "Enregistrement local du groupe…" : "Publication du groupe…", impacted)) setGroupDraft(null);
  };
  const saveKey = async () => {
    if (!keyForm?.name.trim()) { toast.error("Enter a key name."); return; }
    if (data.keys.some(k => k.name.toLowerCase() === keyForm.name.trim().toLowerCase())) { toast.error("A key with this name already exists."); return; }
    const form = keyForm;
    await operation("Creating native key…", async () => {
      const result = await createKey(form.name.trim(), form.client.trim());
      setCreatedSecretError("");
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
  const copyCreatedSecret = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(createdSecret);
      setCreatedSecretError("");
      toast.success("Secret copied.");
    } catch {
      createdSecretInput.current?.focus();
      createdSecretInput.current?.select();
      setCreatedSecretError("Clipboard unavailable. The secret is selected; press Ctrl+C or Cmd+C to copy it.");
    }
  };

  const viewFor = (scope: string) => ({ ...preferences, ...listOverrides[scope] });
  const setView = (scope: string, value: ViewOptions) => setListOverrides(old => ({ ...old, [scope]: updateViewOverride(preferences, old[scope] || {}, value) }));
  const resetView = (scope: string) => setListOverrides(old => { const next = { ...old }; delete next[scope]; return next; });
  const title = page === "keys" && key ? key.name : nav.find(item => item.id === page)!.label[language];
  if (loginRequired) return <div className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-6"><Card className="w-full max-w-md p-6"><form onSubmit={signIn} className="space-y-5"><div className="space-y-2"><h1 className="text-xl font-semibold">{copyText("Sign in to Registry", "Connexion à Registry")}</h1><p className="text-sm text-muted-foreground">{copyText("Enter the panel admin token.", "Saisissez le jeton administrateur du panneau.")}</p></div><div className="space-y-2"><label htmlFor="registry-admin-token" className="text-sm font-medium">{copyText("Admin token", "Jeton administrateur")}</label><Input id="registry-admin-token" type="password" autoComplete="current-password" autoFocus required spellCheck={false} value={loginToken} onChange={event => setLoginToken(event.target.value)} /></div>{loginError && <p role="alert" className="text-sm text-destructive">{loginError}</p>}<Button type="submit" className="w-full" disabled={loading}>{loading ? copyText("Signing in…", "Connexion…") : copyText("Sign in", "Se connecter")}</Button></form></Card></div>;
  if (loading && !revision) return <div className="flex min-h-dvh items-center justify-center bg-background p-6"><Card className="w-full max-w-md p-6"><CardTitle>{copyText("Connecting to Bifrost…", "Connexion à Bifrost…")}</CardTitle><p className="text-sm text-muted-foreground">{copyText("Loading the live registry workspace.", "Chargement de l’espace Registry connecté.")}</p></Card></div>;
  if (apiError && !revision) return <div className="flex min-h-dvh items-center justify-center bg-background p-6"><Card className="w-full max-w-md p-6"><CardTitle>{copyText("Registry unavailable", "Registry indisponible")}</CardTitle><p role="alert" className="text-sm text-destructive">{apiError}</p><Button onClick={() => void load()}>{copyText("Retry", "Réessayer")}</Button></Card></div>;
  return <TooltipProvider delayDuration={0}><SidebarProvider><CloseMobileSidebarOnRoute routeKey={`${page}/${pageId || ""}`} /><Sidebar collapsible="icon" className="border-none bg-transparent"><SidebarHeader className="px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2"><MobileSidebarLabel /><CollapsedSidebarExpand /><div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden"><a href="#/models" onClick={e => { e.preventDefault(); go("models"); }} className="min-w-0"><img src={`${import.meta.env.BASE_URL}bifrost-logo.webp`} alt="Bifrost" className="h-[22px] max-w-[145px] object-contain object-left dark:hidden" /><img src={`${import.meta.env.BASE_URL}bifrost-logo-dark.webp`} alt="Bifrost" className="hidden h-[22px] max-w-[145px] object-contain object-left dark:block" /></a><SidebarTrigger className="size-8" aria-label={copyText("Collapse sidebar", "Réduire la barre latérale")} title={copyText("Collapse sidebar", "Réduire la barre latérale")} /></div></SidebarHeader><SidebarContent><SidebarGroup><SidebarGroupLabel>{copyText("WORKSPACE", "ESPACE DE TRAVAIL")}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{nav.filter(item => ["models", "groups", "keys"].includes(item.id)).map(item => { const Icon = item.icon; return <SidebarMenuItem key={item.id}><SidebarMenuButton asChild isActive={page === item.id} tooltip={item.label[language]}><a href={`#/${item.id}`} onClick={e => { e.preventDefault(); if (item.id === "catalog") setCatalogFocus(null); go(item.id); }} className={page === item.id ? "border border-primary/20 text-primary" : "border border-transparent"}><Icon className="size-4" /><span>{item.label[language]}</span></a></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent><SidebarFooter className="p-2"><SidebarMenu><SidebarMenuItem><SidebarMenuButton asChild isActive={["settings", "gateway", "catalog", "snapshot"].includes(page)} tooltip={nav.find(item => item.id === "settings")!.label[language]}><a href="#/settings" onClick={e => { e.preventDefault(); go("settings"); }}><Settings2 className="size-4" /><span>{nav.find(item => item.id === "settings")!.label[language]}</span></a></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar>
    <div className="flex h-dvh w-full min-w-0 flex-col">
      <header className="flex h-13 w-full shrink-0 items-center gap-2 px-3 pt-1 md:pr-3 md:pl-0">
        <SidebarTrigger className="md:hidden" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{key && page === "keys" ? <><button onClick={() => go("keys")} className="text-muted-foreground hover:text-foreground">{copyText("Virtual keys", "Clés virtuelles")}</button><span className="mx-2 text-muted-foreground/50">/</span>{title}</> : title}</h1>
        <Tooltip><TooltipTrigger asChild><button type="button" aria-label={copyText(`Help for ${title}`, `Aide pour ${title}`)} onClick={() => { setSettingsSection("help"); go("settings"); }} className="inline-flex rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CircleHelp className="size-4" /></button></TooltipTrigger><TooltipContent>{page === "models" ? copyText("Explore models and provider accesses", "Explorez les modèles et leurs accès fournisseurs") : page === "groups" ? copyText("Shared sets of models for keys", "Ensembles de modèles partagés entre clés") : page === "keys" ? copyText("Compose and publish key catalogs", "Composez et publiez les catalogues des clés") : page === "settings" ? copyText("AI assistance and display preferences", "Assistance IA et préférences d’affichage") : page === "catalog" ? copyText("Review source data, references, and mappings", "Consultez les sources, références et rapprochements") : page === "snapshot" ? copyText("Import or export Registry snapshots and CSV", "Importez ou exportez un instantané Registry ou un CSV") : copyText("Review the existing Bifrost configuration", "Consultez la configuration Bifrost existante")}</TooltipContent></Tooltip>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant={connection ? "success" : "warning"} className="hidden text-xs sm:inline-flex">{busy || (connection ? `${snapshotMode ? `${copyText("Local copy", "Copie locale")} · ` : ""}Bifrost ${connection.version}` : copyText("Disconnected", "Déconnecté"))}</Badge>
          {!standaloneAuthenticated && !snapshotMode && <a href="/workspace/providers" className="hidden text-xs text-muted-foreground hover:text-foreground xl:inline">Bifrost workspace</a>}
          <Select value={language} onValueChange={value => onLanguageChange(value as Language)}><SelectTrigger size="sm" aria-label={language === "fr" ? "Langue : français" : "Language: English"} title={language === "fr" ? "Français" : "English"} className="w-auto gap-1.5 px-2 text-xs"><Languages className="size-3.5" /><SelectValue>{language.toUpperCase()}</SelectValue></SelectTrigger><SelectContent><SelectGroup><SelectItem value="fr" textValue="Français">Français</SelectItem><SelectItem value="en" textValue="English">English</SelectItem></SelectGroup></SelectContent></Select>
          {canUseExpert && <label className="hidden items-center gap-2 text-xs font-medium xl:flex"><span>{copyText("Expert", "Expert")}</span><Switch id="expert-mode" checked={expert} onCheckedChange={setExpertMode} className="data-[state=checked]:bg-chart-success data-[state=unchecked]:bg-muted-foreground/50 [&>span]:bg-white dark:[&>span]:bg-white" aria-label={copyText("Use Expert key composer", "Utiliser la composition de clé Expert")} /></label>}
          <Button variant="ghost" size="icon" aria-label={dark ? copyText("Use light theme", "Utiliser le thème clair") : copyText("Use dark theme", "Utiliser le thème sombre")} title={dark ? copyText("Use light theme", "Utiliser le thème clair") : copyText("Use dark theme", "Utiliser le thème sombre")} onClick={() => setDark(!dark)}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
          {standaloneAuthenticated ? <Button variant="outline" size="icon" className="size-8 shrink-0" aria-label={copyText("Sign out", "Se déconnecter")} title={copyText("Sign out", "Se déconnecter")} disabled={!!busy || loading} onClick={requestSignOut}><LogOut className="size-4" /></Button> : null}
        </div>
      </header>
      <div ref={contentRef} className="custom-scrollbar content-container relative mx-0 min-h-0 min-w-0 flex-1 overflow-auto border bg-background md:mr-3 md:mb-3 md:rounded-md md:px-10"><main className="mx-auto max-w-[90rem] px-4 py-6 md:px-0 md:py-8">{apiError && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm"><span>{apiError}</span><Button variant="outline" size="sm" onClick={() => void load()}>Reload workspace</Button></div>}{page === "models" && pendingKeyDraft.current && <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-muted/30 p-3 text-sm"><span>{copyText("A key draft is saved while you register the missing models.", "Un brouillon de clé est conservé pendant l’enregistrement des modèles manquants.")}</span><Button type="button" variant="outline" size="sm" onClick={() => navigate("keys", pendingKeyDraft.current!.keyId)}>{copyText("Return to key draft", "Revenir au brouillon de clé")}</Button></div>}
        {snapshotMode && <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><p className="min-w-0 flex-1 text-foreground/80">{copyText("Snapshot copy", "Copie d’instantané")} · <span className="font-medium">{connection.source || "Registry"}</span>{connection.capturedAt && <> · {copyText("captured", "capturée")} {new Date(connection.capturedAt).toLocaleString(language === "fr" ? "fr-FR" : "en-US")}</>}</p>{connection.partial && <details className="max-w-full"><summary className="cursor-pointer text-chart-warning-ink">{copyText("Partial capture", "Capture partielle")}</summary><p className="mt-1 max-w-prose text-chart-warning-ink">{copyText("Model discovery and some aliases need an administrator connection.", "La découverte des modèles et certains alias nécessitent une connexion administrateur.")}</p></details>}<Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => go("gateway")}>{copyText("Gateway details", "Détails du gateway")}</Button></div>}
        {["gateway", "catalog", "snapshot"].includes(page) && <nav aria-label={copyText("Settings sections", "Sections des réglages")} className="mb-6 flex flex-wrap items-center gap-2 border-b pb-3 text-sm"><Button variant="ghost" size="sm" onClick={() => go("settings")}>{copyText("Settings", "Réglages")}</Button><span className="text-muted-foreground">/</span>{nav.filter(item => ["gateway", "catalog", "snapshot"].includes(item.id) && (item.id !== "gateway" || snapshotMode)).map(item => <Button key={item.id} variant={page === item.id ? "secondary" : "ghost"} size="sm" onClick={() => { if (item.id === "catalog") setCatalogFocus(null); go(item.id); }}>{item.label[language]}</Button>)}</nav>}
        {page === "gateway" && (snapshotMode ? <GatewayInventory onModels={() => go("models")} /> : <Card className="max-w-2xl p-6"><CardTitle>{copyText("Existing gateway", "Gateway existant")}</CardTitle><p className="text-sm text-muted-foreground">{copyText("Gateway inventory is available from a captured Bifrost snapshot.", "L’inventaire du gateway est disponible depuis un instantané Bifrost capturé.")}</p></Card>)}
        {page === "models" && <><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-60 flex-1"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{copyText("My models", "Mes modèles")}</h2><p className="mt-1 max-w-prose text-sm text-foreground/70">{copyText("Models and provider accesses configured in Bifrost.", "Modèles et accès fournisseurs configurés dans Bifrost.")}</p></div><div className="flex flex-col items-start gap-2 sm:items-end"><span className="text-xs text-muted-foreground">{catalog.length} {copyText("models", "modèles")} {connection?.partial ? copyText("explicitly configured", "explicitement configurés") : copyText("available", "disponibles")} · {data.models.length} {copyText("registered cards", `fiche${data.models.length > 1 ? "s" : ""} enregistrée${data.models.length > 1 ? "s" : ""}`)}</span><Button onClick={() => setDiscoveryOpen(true)}><Plus className="size-4" />{copyText("Register a model", "Enregistrer un modèle")}</Button></div></div>{catalog.length ? <ReferenceCatalogBrowser revision={revision} models={catalog} registeredIds={registeredIds} registeredModels={data.models} preferences={preferences} onOpen={model => openModel(model, !registeredIds.has(model.id))} onMetadata={(target, id) => { setCatalogFocus({ target, id }); go("catalog"); }} onUnauthorized={requireLogin} /> : <Card className="py-0"><CardContent className="space-y-3 p-6"><h3 className="text-lg font-semibold">{copyText("Build your model catalog", "Créez votre catalogue de modèles")}</h3><p className="max-w-prose text-sm text-muted-foreground">{copyText("No models have been discovered yet. Configure a provider in Bifrost to see its models here.", "Aucun modèle n’a encore été découvert. Configurez un fournisseur dans Bifrost pour afficher ses modèles ici.")}</p><Button variant="outline" onClick={() => setDiscoveryOpen(true)}>{copyText("Add model", "Ajouter un modèle")} <ArrowRight className="size-4" /></Button></CardContent></Card>}</>}
        {page === "snapshot" && <SnapshotTransfer onUnauthorized={requireLogin} onApplied={() => void load()} />}
        {page === "groups" && <GroupLibrary groups={data.groups} models={data.models} keys={data.keys} search={search} onSearch={setSearch} view={viewFor("groups")} onViewChange={next => setView("groups", next)} onResetView={() => resetView("groups")} onCreate={() => openGroup({ id: crypto.randomUUID(), name: "", description: "", members: [] })} onEdit={openGroup} />}
        {page === "catalog" && <CatalogMetadata key={catalogFocus ? `${catalogFocus.target}/${catalogFocus.id}` : "catalog"} focus={catalogFocus} snapshotMode={snapshotMode} onUnauthorized={requireLogin} onChanged={() => void load()} />}
        {page === "keys" && !key && <KeyLibrary keys={data.keys} groups={data.groups} models={data.models} search={search} onSearch={setSearch} view={viewFor("keys")} onViewChange={next => setView("keys", next)} onResetView={() => resetView("keys")} busy={!!busy} snapshotMode={snapshotMode} onCreate={() => setKeyForm({ name: "", client: "" })} onOpen={item => go("keys", item.id)} />}
        {page === "keys" && key && activePolicy && <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-card p-3">
            <div className="min-w-0"><p className="font-medium">{key.name}</p><p className="break-all text-xs text-muted-foreground">{key.client || key.id} · {copyText(key.managed === false ? "Bifrost key · Registry policy not adopted" : "Registry-managed key", key.managed === false ? "Clé Bifrost · sélection Registry non adoptée" : "Clé gérée par Registry")}</p></div>
            <div className="flex flex-wrap items-center gap-2"><VirtualKeySecret keyId={key.id} disabled={!!busy || snapshotMode} onUnauthorized={requireLogin} />{key.managed === false ? <Button variant="outline" disabled={!!busy} onClick={() => setAdoption({ keyId: key.id, operation: "adopt" })}>{snapshotMode ? copyText("Review local selection", "Examiner la sélection locale") : copyText("Review adoption", "Examiner l’adoption")}</Button> : <><Button variant="outline" disabled={!!busy || isDirty} onClick={() => setAdoption({ keyId: key.id, operation: "rebind" })}>{copyText("Review binding", "Examiner l’association")}</Button><Button variant="outline" disabled={!!busy} onClick={() => setRenameForm({ id: key.id, name: key.name })}>{copyText("Rename", "Renommer")}</Button><Button variant="outline" disabled={!!busy} onClick={() => { void commit({ ...data, keys: data.keys.map(item => item.id === key.id ? { ...item, active: !item.active } : item) }, key.active ? "Disabling key…" : "Enabling key…", [key.id]); }}>{key.active ? copyText("Disable", "Désactiver") : copyText("Enable", "Activer")}</Button></>}</div>
          </div>
          {(snapshotMode || key.managed === false || isDirty) && <div className="mb-4 space-y-2 rounded-sm border bg-muted/30 p-3 text-sm">
            {snapshotMode && <p>{copyText("The secret was excluded from this capture. You can prepare a selection in the local copy; this does not change Pulsar or verify live access.", "Le secret est exclu de cette capture. Vous pouvez préparer une sélection dans la copie locale ; cela ne modifie pas Pulsar et ne vérifie pas les accès en direct.")}</p>}
            {key.managed === false && <details><summary className="cursor-pointer font-medium">{copyText("What does adoption do?", "À quoi sert l’adoption ?")}</summary><p className="mt-2 text-muted-foreground">{copyText("Review compares the current Bifrost permissions with a Registry selection. Confirm the proposed selection before composing groups and models for this key. Registry cannot grant more access than Bifrost allows.", "L’examen compare les permissions Bifrost actuelles avec une sélection Registry. Confirmez la sélection proposée avant de composer les groupes et modèles de cette clé. Registry ne peut pas étendre les droits accordés par Bifrost.")}</p></details>}
            {key.managed === false && isDirty && <p className="text-muted-foreground">{copyText("Review adoption first. Your draft selections will be kept and combined with the adopted native selection; Bifrost permission limits still apply when you publish.", "Examinez d’abord l’adoption. Vos choix en brouillon seront conservés et combinés à la sélection native adoptée ; les limites de permission Bifrost resteront appliquées à la publication.")}</p>}
            {key.managed !== false && isDirty && <p className="text-muted-foreground">{copyText("Save or discard this draft before reviewing the key association.", "Enregistrez ou abandonnez ce brouillon avant d’examiner l’association de la clé.")}</p>}
          </div>}
          {!key.active && key.managed !== false && <p className="mb-4 rounded-sm border border-chart-warning/50 bg-chart-warning/10 p-3 text-sm text-chart-warning-ink">{copyText("This key is disabled. Its saved model selection is shown for review.", "Cette clé est désactivée. Sa sélection enregistrée reste visible pour vérification.")}</p>}
          <KeyComposer virtualKey={key} draft={activePolicy} onDraftChange={setDraft} models={data.models} groups={data.groups} preferences={preferences} busy={!!busy} snapshotMode={snapshotMode} expert={effectiveExpert} adoptionRequired={key.managed === false} onReviewAdoption={() => setAdoption({ keyId: key.id, operation: "adopt" })} publishDisabled={reconcileBlocked || (!isDirty && !needsReconcile) || !!busy || key.managed === false} onPublish={() => void publishKey()} onDiscard={() => setDraft(copy(key.policy))} onReread={() => void reread()} onBack={() => go("keys")} />
        </>}
        {page === "settings" && <RegistrySettings key={settingsSection} initialSection={settingsSection} preferences={preferences} onPreferencesChange={setPreferences} snapshotMode={snapshotMode} onNavigate={destination => { if (destination === "catalog") setCatalogFocus(null); go(destination); }} onUnauthorized={requireLogin} providers={catalog.flatMap(model => model.accesses.map(access => access.provider))} />}

      </main></div></div>
    <Dialog open={discoveryOpen} onOpenChange={setDiscoveryOpen}><DialogContent className="flex max-h-[90vh] max-w-5xl flex-col"><DialogHeader><DialogTitle>Enregistrer un modèle existant</DialogTitle><DialogDescription>Choisissez un modèle repéré dans Bifrost, puis complétez sa fiche Registry.</DialogDescription></DialogHeader><div className="min-h-0 overflow-auto"><ModelBrowser models={discovery.filter(model => !data.models.some(existing => existing.id === model.id))} onOpen={model => { openModel(model, true); setDiscoveryOpen(false); }} preferences={preferences} compact label="Discovered models" /></div><DialogFooter><Button variant="outline" onClick={() => { openModel(newModel(), true); setDiscoveryOpen(false); }}>Avancé : saisir un accès manuellement</Button><Button variant="ghost" onClick={() => setDiscoveryOpen(false)}>Cancel</Button></DialogFooter></DialogContent></Dialog>
    <Sheet open={!!modelDraft} onOpenChange={open => { if (!open) closeModel(); }}>{modelDraft && <ModelEditor expert={effectiveExpert} onExpertChange={setExpertMode} snapshotMode={snapshotMode} baseline={data.models.find(model => model.id === modelDraft.id)} draft={modelDraft} onOverridesChange={setModelOverrides} onChange={setModelDraft} creating={creatingModel} workspace={catalog} pricingProofs={pricingProofs} error={modelError} busy={!!busy} onSave={updateModel} onCancel={closeModel} onDelete={deleteModel} onUnauthorized={requireLogin} actionSlot={snapshotMode ? undefined : <AssistantSuggestion draft={modelDraft} onChange={setModelDraft} onOpenSettings={() => setConfirm({ title: copyText("Open AI settings?", "Ouvrir les réglages IA ?"), text: copyText("This closes the model editor and discards its unsaved changes.", "Les modifications non enregistrées de la fiche seront abandonnées."), confirmLabel: copyText("Open settings", "Ouvrir les réglages"), cancelLabel: copyText("Keep editing", "Continuer à modifier"), action: () => { setModelDraft(null); go("settings"); } })} />} />}</Sheet>
    <Sheet open={!!groupDraft} onOpenChange={open => { if (!open) closeGroup(); }}><SheetContent inert={!!busy} className={`overflow-hidden p-4 sm:p-6 ${effectiveExpert ? "sm:w-[calc(100vw-1rem)] sm:max-w-6xl" : ""}`}><SheetHeader className="border-b bg-muted/40 pb-4"><SheetTitle className="text-xl">{copyText(groupDraft && data.groups.some(group => group.id === groupDraft.id) ? "Edit group" : "Create group", groupDraft && data.groups.some(group => group.id === groupDraft.id) ? "Modifier le groupe" : "Créer un groupe")}</SheetTitle><SheetDescription>{copyText("Choose the registered models in this shared selection. Review the key impact before saving.", "Choisissez les modèles enregistrés de cette sélection partagée. Vérifiez l’impact sur les clés avant l’enregistrement.")}</SheetDescription></SheetHeader>{groupDraft && <GroupEditor expert={effectiveExpert} onExpertChange={setExpertMode} group={groupDraft} groups={data.groups} models={data.models} keys={data.keys} snapshotMode={snapshotMode} busy={!!busy} preferences={preferences} onChange={setGroupDraft} onSave={() => void publishGroup()} onCancel={closeGroup} onDelete={() => { const target = groupDraft; setConfirm({ title: copyText(`Delete ${target.name}?`, `Supprimer ${target.name} ?`), text: copyText("Keys using this group will lose its shared models. Their local selections remain.", "Les clés utilisant ce groupe perdront ses modèles partagés. Leurs sélections locales restent intactes."), action: () => { const groups = data.groups.filter(item => item.id !== target.id); const keys = data.keys.map(item => ({ ...item, policy: { ...item.policy, groups: item.policy.groups.filter(id => id !== target.id) } })); const impacted = data.keys.filter(item => item.managed !== false && item.policy.groups.includes(target.id)).map(item => item.id); void (async () => { if (await commit({ ...data, groups, keys }, "Deleting group…", impacted)) setGroupDraft(null); })(); } }); }} />}</SheetContent></Sheet>
    <Dialog open={!!createdSecret} onOpenChange={open => { if (!open) { setCreatedSecret(""); setCreatedSecretError(""); } }}><DialogContent><DialogHeader><DialogTitle>{copyText("Copy the virtual key secret", "Copier le secret de la clé virtuelle")}</DialogTitle><DialogDescription>{copyText("This native Bifrost secret is shown once. Store it before closing.", "Ce secret Bifrost natif ne s’affiche qu’une fois. Enregistrez-le avant de fermer.")}</DialogDescription></DialogHeader><Input ref={createdSecretInput} readOnly value={createdSecret} aria-label={copyText("Virtual key secret", "Secret de la clé virtuelle")} autoComplete="off" spellCheck={false} className="font-mono text-xs" />{createdSecretError && <p role="alert" className="text-sm text-destructive">{createdSecretError}</p>}<DialogFooter><Button onClick={() => void copyCreatedSecret()}>{copyText("Copy secret", "Copier le secret")}</Button><Button variant="outline" onClick={() => { setCreatedSecret(""); setCreatedSecretError(""); }}>{copyText("Done", "Terminé")}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!keyForm} onOpenChange={open => !open && !busyRef.current && setKeyForm(null)}><DialogContent inert={!!busy}><DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">{copyText("Create virtual key", "Créer une clé virtuelle")}</DialogTitle><DialogDescription>{copyText("A native Bifrost virtual key will be created. Its secret is shown once.", "Une clé virtuelle Bifrost native sera créée. Son secret ne s’affichera qu’une fois.")}</DialogDescription></DialogHeader>{keyForm && <div className="space-y-4"><div><label className="mb-2 block text-sm font-medium">{copyText("Name", "Nom")}</label><Input aria-label={copyText("Key name", "Nom de la clé")} autoFocus value={keyForm.name} onChange={e => setKeyForm({ ...keyForm, name: e.target.value })} placeholder={copyText("e.g. Hermes staging", "ex. Hermes staging")} /></div><div><label className="mb-2 block text-sm font-medium">{copyText("Client", "Client")}</label><Input aria-label={copyText("Client name", "Nom du client")} value={keyForm.client} onChange={e => setKeyForm({ ...keyForm, client: e.target.value })} placeholder={copyText("e.g. Hermes", "ex. Hermes")} /></div></div>}<DialogFooter><Button variant="outline" onClick={() => setKeyForm(null)}>{copyText("Cancel", "Annuler")}</Button><Button disabled={!!busy} onClick={saveKey}>{copyText("Create key", "Créer la clé")}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!renameForm} onOpenChange={open => !open && !busyRef.current && setRenameForm(null)}><DialogContent inert={!!busy}><DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">{copyText("Rename virtual key", "Renommer la clé virtuelle")}</DialogTitle><DialogDescription>{copyText("Updates the saved key name.", "Met à jour le nom enregistré de la clé.")}</DialogDescription></DialogHeader>{renameForm && <div><label className="mb-2 block text-sm font-medium">{copyText("Name", "Nom")}</label><Input aria-label={copyText("Key name", "Nom de la clé")} autoFocus value={renameForm.name} onChange={e => setRenameForm({ ...renameForm, name: e.target.value })} /></div>}<DialogFooter><Button variant="outline" onClick={() => setRenameForm(null)}>{copyText("Cancel", "Annuler")}</Button><Button disabled={!!busy} onClick={() => { if (!renameForm?.name.trim() || data.keys.some(k => k.id !== renameForm.id && k.name.toLowerCase() === renameForm.name.trim().toLowerCase())) { toast.error(copyText("Name is empty or already used.", "Le nom est vide ou déjà utilisé.")); return; } const form = renameForm; void (async () => { if (await commit({ ...data, keys: data.keys.map(k => k.id === form.id ? { ...k, name: form.name.trim() } : k) }, copyText("Renaming key…", "Renommage de la clé…"))) setRenameForm(null); })(); }}>{copyText("Save", "Enregistrer")}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={!!confirm} onOpenChange={open => !open && setConfirm(null)}><DialogContent><DialogHeader className="border-b pb-4"><DialogTitle className="text-xl">{confirm?.title}</DialogTitle><DialogDescription>{confirm?.text}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirm(null)}>{confirm?.cancelLabel || copyText("Cancel", "Annuler")}</Button><Button variant="destructive" disabled={!!busy} onClick={() => { confirm?.action(); setConfirm(null); }}>{confirm?.confirmLabel || copyText("Delete", "Supprimer")}</Button></DialogFooter></DialogContent></Dialog>
    {adoption && <AdoptionDialog key={`${adoption.keyId}/${adoption.operation}`} keyId={adoption.keyId} operation={adoption.operation} onClose={() => setAdoption(null)} onUnauthorized={requireLogin} onGoToModels={() => {
      if (key && draft) pendingKeyDraft.current = { keyId: key.id, policy: draft };
      setAdoption(null);
      navigate("models");
    }} onApplied={receipt => {
      const stagedDraft = key?.id === receipt.keyId && draft && !same(key.policy, draft) ? draft : null;
      toast.success(snapshotMode ? copyText("Key prepared in the local copy. Pulsar is unchanged.", "Clé préparée dans la copie locale. Pulsar reste inchangé.") : adoption.operation === "adopt" ? copyText("Native key adopted.", "Clé native adoptée.") : copyText("Key binding updated.", "Association de clé mise à jour."));
      void getWorkspace().then(workspace => {
        applyWorkspace(workspace);
        const adopted = workspace.data.keys.find(item => item.id === receipt.keyId);
        setDraft(adopted ? stagedDraft ? preserveAdoptionDraft(copy(adopted.policy), stagedDraft) : copy(adopted.policy) : stagedDraft);
      }).catch(error => {
        if (error instanceof ApiError && error.status === 401) requireLogin();
        else setApiError(error instanceof Error ? error.message : "Impossible d’actualiser la sélection de la clé.");
      });
    }} />}
    <Toaster closeButton position={isMobile ? "bottom-center" : "bottom-right"} offset={isMobile ? { bottom: "calc(env(safe-area-inset-bottom) + 128px)" } : undefined} mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 128px)" }} visibleToasts={isMobile ? 1 : undefined} richColors />
  </SidebarProvider></TooltipProvider>;
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => new URLSearchParams(location.search).get("lang") === "en" ? "en" : "fr");
  const changeLanguage = (next: Language) => {
    const params = new URLSearchParams(location.search);
    params.set("lang", next);
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
    setLanguage(next);
  };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  return <LanguageContext.Provider value={language}><RegistryApp language={language} onLanguageChange={changeLanguage} /></LanguageContext.Provider>;
}

function Empty({ icon: Icon, title, detail, action }: { icon: typeof Search; title: string; detail: string; action: React.ReactNode }) {
  return <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-12 text-center"><Icon className="size-16 stroke-1 text-muted-foreground" /><h3 className="text-xl font-medium text-muted-foreground">{title}</h3><p className="max-w-lg text-sm text-muted-foreground">{detail}</p><div className="mt-2">{action}</div></div>;
}
