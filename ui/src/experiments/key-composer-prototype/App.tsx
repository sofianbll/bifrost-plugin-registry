// PROTOTYPE — synthetic Registry screens inside the real shell.
// Catalog, groups and virtual keys are in-memory; remaining navigation is decorative.
// All data is synthetic and reload resets it.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Boxes, CircleHelp, KeyRound, Layers3, Moon, Sun } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { emptyDraft, fixtureGroups, fixtureModels, lateAccess, sameDraft, type KeyDraft, type ProtoModel } from "./state";
import { editDraft, initialKeys, saveKey, type SimulatedKey } from "./key-state";
import KeyLibrary from "./KeyLibrary";
import CatalogPage from "./CatalogPage";
import { ModelDetail } from "./ModelDetail";
import GroupWorkspace from "./GroupWorkspace";
import { readMode, type Mode } from "./shared";
import VariantA from "./VariantA";
import VariantB from "./VariantB";
import { LanguageContext, useCopy, type Language } from "../../lib/locale";

type Screen = "list" | "create" | "models" | "model-detail" | "groups";
const stubNav = ["Gateway inventory", "Documentary data", "Laboratory", "Import & Export", "Settings"];

function NavigationLink({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: React.ReactNode }) {
  const { setOpenMobile } = useSidebar();
  return <a href={href} onClick={event => { event.preventDefault(); setOpenMobile(false); onNavigate(); }}>{children}</a>;
}

function MobileNavigationA11y() {
  const { isMobile } = useSidebar();
  const copy = useCopy();
  return isMobile ? <><SheetTitle className="sr-only">{copy("Navigation", "Navigation")}</SheetTitle><SheetDescription className="sr-only">{copy("Registry prototype navigation", "Navigation du prototype Registry")}</SheetDescription></> : null;
}

function ComposerApp({ language, onLanguageChange }: { language: Language; onLanguageChange: (language: Language) => void }) {
  const isMobile = useIsMobile();
  const copy = useCopy();
  const [mode, setModeState] = useState<Mode>(readMode);
  const [canUseExpert, setCanUseExpert] = useState(() => window.matchMedia("(min-width: 1280px)").matches);
  const [models, setModels] = useState<ProtoModel[]>(() => structuredClone(fixtureModels));
  const [groups, setGroups] = useState(() => structuredClone(fixtureGroups));
  const [draft, setDraft] = useState<KeyDraft>(emptyDraft);
  const [baseline, setBaseline] = useState<KeyDraft>(emptyDraft);
  const [keys, setKeys] = useState<SimulatedKey[]>(() => structuredClone(initialKeys));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [screen, setScreen] = useState<Screen>("create");
  const [pendingScreen, setPendingScreen] = useState<Screen>("list");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [lateSimulated, setLateSimulated] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const setTheme = (next: boolean) => { setDark(next); document.documentElement.classList.toggle("dark", next); document.documentElement.style.colorScheme = next ? "dark" : "light"; };
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const update = () => setCanUseExpert(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const setMode = (next: Mode) => {
    const params = new URLSearchParams(location.search);
    params.set("mode", next);
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
    setModeState(next);
  };
  const effectiveMode: Mode = canUseExpert ? mode : "basic";
  const scrollToStart = () => { if (contentRef.current) contentRef.current.scrollTop = 0; };
  useLayoutEffect(scrollToStart, [screen, selectedModelId]);
  useEffect(() => {
    if (screen !== "create" || sameDraft(draft, baseline)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [screen, draft, baseline]);
  const startCreate = () => { const next = emptyDraft(); setDraft(next); setBaseline(emptyDraft()); setEditingId(null); setScreen("create"); };
  const startEdit = (key: SimulatedKey) => { if (key.readonly) return; setDraft(editDraft(key)); setBaseline(editDraft(key)); setEditingId(key.id); setScreen("create"); };
  const leaveComposer = (next: Screen = "list") => { setDraft(emptyDraft()); setBaseline(emptyDraft()); setEditingId(null); setScreen(next); setConfirmLeave(false); };
  const navigate = (next: Screen) => { if (screen === "create" && !sameDraft(draft, baseline)) { setPendingScreen(next); setConfirmLeave(true); } else leaveComposer(next); };
  const requestLeave = () => navigate("list");
  const simulateLate = () => {
    setLateSimulated(true);
    setModels(old => old.map(m => m.id === "kimi-k2" ? { ...m, accesses: [...m.accesses, lateAccess["kimi-k2"]()] } : m));
    toast.info(copy("A new Azure access appeared for Kimi K2. Existing selections keep it off until you activate it.", "Un nouvel accès Azure est apparu pour Kimi K2. Il reste désactivé dans les sélections existantes jusqu’à son activation."));
  };
  const resetDemo = () => {
    setModels(structuredClone(fixtureModels));
    setGroups(structuredClone(fixtureGroups));
    setDraft(emptyDraft());
    setBaseline(emptyDraft());
    setKeys(structuredClone(initialKeys));
    setEditingId(null);
    setScreen("list");
    setLateSimulated(false);
    toast.success(copy("Demo reset to the initial fixture.", "Démonstration réinitialisée."));
  };
  const handleSave = () => {
    const next = { ...draft, name: draft.name.trim(), client: draft.client.trim() };
    setKeys(old => saveKey(old, next, editingId ?? crypto.randomUUID()));
    leaveComposer();
    toast.success(editingId ? copy("Demo key updated in memory.", "Clé de démonstration modifiée en mémoire.") : copy("Demo key created in memory.", "Clé de démonstration créée en mémoire."));
  };
  const handleCancel = () => {
    leaveComposer();
    toast.info(copy("Changes discarded. Stored keys are unchanged.", "Modifications abandonnées. Les clés enregistrées restent inchangées."));
  };
  const composerProps = { draft, baseline, editing: editingId !== null, setDraft, models, groups, lateSimulated, onSimulateLate: simulateLate, onResetDemo: resetDemo, onCancel: handleCancel, onCreate: handleSave };
  return <TooltipProvider delayDuration={0}><SidebarProvider data-prototype="key-composer">
    <Sidebar collapsible="icon" className="border-none bg-transparent">
      <SidebarHeader className="px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2">
        <MobileNavigationA11y />
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <img src={`${import.meta.env.BASE_URL}bifrost-logo.webp`} alt="Bifrost" className="h-[22px] max-w-[145px] object-contain object-left dark:hidden" />
          <img src={`${import.meta.env.BASE_URL}bifrost-logo-dark.webp`} alt="Bifrost" className="hidden h-[22px] max-w-[145px] object-contain object-left dark:block" />
          <SidebarTrigger className="size-7" aria-label={copy("Toggle navigation", "Afficher ou masquer la navigation")} />
        </div>
      </SidebarHeader>
      <SidebarContent><SidebarGroup><SidebarGroupLabel>{copy("WORKSPACE", "ESPACE DE TRAVAIL")}</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
        <SidebarMenuItem><SidebarMenuButton asChild isActive={screen === "models" || screen === "model-detail"} tooltip={copy("Models", "Modèles")} className="group-data-[collapsible=icon]:justify-center"><NavigationLink href="#models" onNavigate={() => navigate("models")}><Boxes className="size-4" /><span className="group-data-[collapsible=icon]:sr-only">{copy("Models", "Modèles")}</span></NavigationLink></SidebarMenuButton></SidebarMenuItem>
        {stubNav.slice(0, 2).map(label => <SidebarMenuItem key={label} className="group-data-[collapsible=icon]:hidden"><SidebarMenuButton disabled title={copy("Outside this prototype", "Hors de ce prototype")}><span className="text-muted-foreground">{copy(label, ({ "Gateway inventory": "Inventaire passerelle", "Documentary data": "Données documentaires" } as Record<string, string>)[label] || label)}</span></SidebarMenuButton></SidebarMenuItem>)}
        <SidebarMenuItem><SidebarMenuButton asChild isActive={screen === "groups"} tooltip={copy("Groups", "Groupes")} className="group-data-[collapsible=icon]:justify-center"><NavigationLink href="#groups" onNavigate={() => navigate("groups")}><Layers3 className="size-4" /><span className="group-data-[collapsible=icon]:sr-only">{copy("Groups", "Groupes")}</span></NavigationLink></SidebarMenuButton></SidebarMenuItem>
        <SidebarMenuItem><SidebarMenuButton asChild isActive={screen === "list" || screen === "create"} tooltip={copy("Virtual keys", "Clés virtuelles")} className="group-data-[collapsible=icon]:justify-center"><NavigationLink href="#keys" onNavigate={requestLeave}><KeyRound className="size-4" /><span className="group-data-[collapsible=icon]:sr-only">{copy("Virtual keys", "Clés virtuelles")}</span></NavigationLink></SidebarMenuButton></SidebarMenuItem>
        {stubNav.slice(2).map(label => <SidebarMenuItem key={label} className="group-data-[collapsible=icon]:hidden"><SidebarMenuButton disabled title={copy("Outside this prototype", "Hors de ce prototype")}><span className="text-muted-foreground">{copy(label, ({ Laboratory: "Laboratoire", "Import & Export": "Import / Export", Settings: "Paramètres" } as Record<string, string>)[label] || label)}</span></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
    </Sidebar>
    <div className="flex h-dvh w-full min-w-0 flex-col">
      <header className="flex h-13 w-full min-w-0 shrink-0 items-center gap-2 px-3 pt-1 md:pr-3 md:pl-0">
        <SidebarTrigger className="md:hidden" aria-label={copy("Toggle navigation", "Afficher ou masquer la navigation")} />
        <h1 className="hidden min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground sm:block">{screen === "create" ? <><button onClick={requestLeave} className="text-muted-foreground hover:text-foreground">{copy("Virtual keys", "Clés virtuelles")}</button><span className="mx-2 text-muted-foreground/50">/</span>{editingId ? copy("Edit key", "Modifier la clé") : copy("Create key", "Créer une clé")}</> : screen === "model-detail" ? <><button onClick={() => navigate("models")} className="text-muted-foreground hover:text-foreground">{copy("Models", "Modèles")}</button><span className="mx-2 text-muted-foreground/50">/</span>{models.find(model => model.id === selectedModelId)?.name}</> : screen === "models" ? copy("Models", "Modèles") : screen === "groups" ? copy("Groups", "Groupes") : copy("Virtual keys", "Clés virtuelles")}</h1>
        <Tooltip><TooltipTrigger asChild><button type="button" aria-label={copy("About this prototype", "À propos de ce prototype")} className="inline-flex shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CircleHelp className="size-4" /></button></TooltipTrigger><TooltipContent>{copy("Synthetic data only. No gateway or real keys. Expert shows a live draft on wide screens.", "Données fictives uniquement. Aucune passerelle ni clé réelle. Le mode Expert affiche le brouillon sur les grands écrans.")}</TooltipContent></Tooltip>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Badge variant="warning" className="shrink-0 text-[10px]">Prototype<span className="hidden sm:inline"> · {copy("synthetic data · no gateway", "données fictives · sans passerelle")}</span></Badge>
          <Select value={language} onValueChange={value => onLanguageChange(value as Language)}>
            <SelectTrigger size="sm" aria-label={language === "fr" ? "Langue : français" : "Language: English"} className="w-[88px] gap-1 px-2 text-xs">
              <SelectValue><span aria-hidden="true">{language === "fr" ? "🇫🇷 FR" : "🇬🇧 EN"}</span><span className="sr-only">{language === "fr" ? "Français" : "English"}</span></SelectValue>
            </SelectTrigger>
            <SelectContent><SelectGroup><SelectItem value="fr" textValue="Français"><span aria-hidden="true">🇫🇷</span> Français</SelectItem><SelectItem value="en" textValue="English"><span aria-hidden="true">🇬🇧</span> English</SelectItem></SelectGroup></SelectContent>
          </Select>
          {canUseExpert && <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-2">
                <label htmlFor="expert-mode" className="text-xs font-medium">Expert</label>
                <Switch id="expert-mode" size="default" checked={effectiveMode === "expert"} onCheckedChange={checked => setMode(checked ? "expert" : "basic")} className="data-[state=checked]:bg-chart-success data-[state=unchecked]:bg-muted-foreground/50 [&>span]:bg-white dark:[&>span]:bg-white" />
              </span>
            </TooltipTrigger>
            <TooltipContent>{mode === "expert" ? copy("Expert: live draft. Switch to Basic", "Expert : brouillon en direct. Passer en mode simple") : copy("Basic: guided steps. Switch to Expert", "Simple : étapes guidées. Passer en mode Expert")}</TooltipContent>
          </Tooltip>}
          <Button variant="ghost" size="icon" aria-label={dark ? copy("Use light theme", "Utiliser le thème clair") : copy("Use dark theme", "Utiliser le thème sombre")} onClick={() => setTheme(!dark)}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
        </div>
      </header>
      <div ref={contentRef} className="custom-scrollbar content-container mx-0 min-h-0 min-w-0 flex-1 overflow-auto border bg-background md:mr-3 md:mb-3 md:rounded-md md:px-5">
        <main className="mx-auto max-w-[1440px] px-3 py-4 md:px-0 md:py-4">
          {screen === "list" && <KeyLibrary keys={keys} groups={groups} models={models} onCreate={startCreate} onEdit={startEdit} />}
          {screen === "create" && <>
            {effectiveMode === "basic" ? <VariantA {...composerProps} /> : <VariantB {...composerProps} />}
          </>}
          {screen === "models" && <CatalogPage models={models} onOpenModel={id => { setSelectedModelId(id); setScreen("model-detail"); }} />}
          {screen === "model-detail" && models.find(model => model.id === selectedModelId) && <ModelDetail key={selectedModelId} model={models.find(model => model.id === selectedModelId)!} onBack={() => navigate("models")} />}
          {screen === "groups" && <GroupWorkspace groups={groups} models={models} keys={keys} onGroupsChange={setGroups} onPageChange={scrollToStart} />}
        </main>
      </div>
    </div>
    <span className="sr-only" aria-live="polite">{copy("Key composer mode", "Mode de création de clé")} — {effectiveMode === "basic" ? copy("Basic", "Simple") : "Expert"}</span>
    <Toaster closeButton toastOptions={{ closeButtonAriaLabel: copy("Close notification", "Fermer la notification") }} position={isMobile ? "bottom-center" : "bottom-right"} offset={isMobile ? { bottom: "calc(env(safe-area-inset-bottom) + 128px)" } : undefined} mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 128px)" }} visibleToasts={isMobile ? 1 : undefined} richColors />
    <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}><DialogContent><DialogHeader><DialogTitle>{copy("Discard unsaved changes?", "Abandonner les modifications ?")}</DialogTitle><DialogDescription>{copy("Your stored key will stay unchanged.", "La clé enregistrée restera inchangée.")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setConfirmLeave(false)}>{copy("Keep editing", "Continuer")}</Button><Button variant="destructive" onClick={() => leaveComposer(pendingScreen)}>{copy("Discard changes", "Abandonner")}</Button></DialogFooter></DialogContent></Dialog>
  </SidebarProvider></TooltipProvider>;
}

export function App() {
  const [language, setLanguage] = useState<Language>(() => new URLSearchParams(location.search).get("lang") === "en" ? "en" : "fr");
  useEffect(() => { document.documentElement.lang = language; document.title = language === "fr" ? "Prototype · Registry" : "Prototype · Registry"; }, [language]);
  const changeLanguage = (next: Language) => {
    const params = new URLSearchParams(location.search);
    params.set("lang", next);
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
    setLanguage(next);
  };
  return <LanguageContext.Provider value={language}><ComposerApp language={language} onLanguageChange={changeLanguage} /></LanguageContext.Provider>;
}
