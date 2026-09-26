// PROTOTYPE — host for the create-key modes inside the real Registry shell.
// Only the "create a virtual key" journey is implemented; other nav entries are
// decorative. All data is synthetic and lives in memory (reload resets it).
import { useState } from "react";
import { CircleHelp, KeyRound, Moon, Plus, Sun } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { emptyDraft, fixtureGroups, fixtureModels, lateAccess, plannedExposures, type KeyDraft, type ProtoModel } from "./state";
import { readMode, type Mode } from "./shared";
import VariantA from "./VariantA";
import VariantB from "./VariantB";

type SimulatedKey = { name: string; client: string; naming: KeyDraft["naming"]; planned: string[] };
const stubNav = ["Models", "Gateway inventory", "Documentary data", "Groups", "Laboratory", "Import & Export", "Settings"];

export function App() {
  const isMobile = useIsMobile();
  const [mode, setModeState] = useState<Mode>(readMode);
  const [models, setModels] = useState<ProtoModel[]>(() => structuredClone(fixtureModels));
  const [draft, setDraft] = useState<KeyDraft>(emptyDraft);
  const [created, setCreated] = useState<SimulatedKey[]>([]);
  const [screen, setScreen] = useState<"list" | "create">("list");
  const [lateSimulated, setLateSimulated] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const setTheme = (next: boolean) => { setDark(next); document.documentElement.classList.toggle("dark", next); document.documentElement.style.colorScheme = next ? "dark" : "light"; };
  const setMode = (next: Mode) => {
    const params = new URLSearchParams(location.search);
    params.set("mode", next);
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
    setModeState(next);
  };
  const effectiveMode: Mode = isMobile ? "basic" : mode;
  const simulateLate = () => {
    setLateSimulated(true);
    setModels(old => old.map(m => m.id === "kimi-k2" ? { ...m, accesses: [...m.accesses, lateAccess["kimi-k2"]()] } : m));
    toast.info("A new configured access azure/kimi-k2 appeared on the Kimi K2 card. Existing selections keep it off until explicitly activated.");
  };
  const resetDemo = () => {
    setModels(structuredClone(fixtureModels));
    setDraft(emptyDraft());
    setCreated([]);
    setLateSimulated(false);
    toast.success("Demo reset to the initial fixture.");
  };
  const handleCreate = () => {
    const planned = plannedExposures(draft, fixtureGroups, models);
    setCreated(old => [...old, { name: draft.name.trim(), client: draft.client.trim(), naming: draft.naming, planned }]);
    setDraft(emptyDraft());
    setScreen("list");
    toast.success(`Key "${draft.name.trim()}" created in memory (simulated). No gateway call, no real secret.`);
  };
  const handleCancel = () => {
    setDraft(emptyDraft());
    setScreen("list");
    toast.info("Draft discarded — nothing was created or saved.");
  };
  const composerProps = { draft, setDraft, models, groups: fixtureGroups, lateSimulated, onSimulateLate: simulateLate, onResetDemo: resetDemo, onCancel: handleCancel, onCreate: handleCreate };
  return <TooltipProvider delayDuration={0}><SidebarProvider>
    <Sidebar collapsible="icon" className="border-none bg-transparent">
      <SidebarHeader className="px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
          <img src={`${import.meta.env.BASE_URL}bifrost-logo.webp`} alt="Bifrost" className="h-[22px] max-w-[145px] object-contain object-left dark:hidden" />
          <img src={`${import.meta.env.BASE_URL}bifrost-logo-dark.webp`} alt="Bifrost" className="hidden h-[22px] max-w-[145px] object-contain object-left dark:block" />
          <SidebarTrigger className="size-7" />
        </div>
      </SidebarHeader>
      <SidebarContent><SidebarGroup><SidebarGroupLabel>WORKSPACE</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>
        {stubNav.slice(0, 4).map(label => <SidebarMenuItem key={label}><SidebarMenuButton disabled title="Not part of this prototype"><span className="text-muted-foreground">{label}</span></SidebarMenuButton></SidebarMenuItem>)}
        <SidebarMenuItem><SidebarMenuButton asChild isActive tooltip="Virtual keys"><a href="#keys" onClick={e => { e.preventDefault(); setScreen("list"); }} className="border border-primary/20 text-primary"><KeyRound className="size-4" /><span>Virtual keys</span></a></SidebarMenuButton></SidebarMenuItem>
        {stubNav.slice(4).map(label => <SidebarMenuItem key={label}><SidebarMenuButton disabled title="Not part of this prototype"><span className="text-muted-foreground">{label}</span></SidebarMenuButton></SidebarMenuItem>)}
      </SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
    </Sidebar>
    <div className="flex h-dvh w-full min-w-0 flex-col">
      <header className="flex h-13 w-full shrink-0 items-center gap-2 px-3 pt-1 md:pr-3 md:pl-0">
        <SidebarTrigger className="md:hidden" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{screen === "create" ? <><button onClick={() => setScreen("list")} className="text-muted-foreground hover:text-foreground">Virtual keys</button><span className="mx-2 text-muted-foreground/50">/</span>Create key</> : "Virtual keys"}</h1>
        <Tooltip><TooltipTrigger asChild><button type="button" aria-label="About this prototype" className="inline-flex rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CircleHelp className="size-4" /></button></TooltipTrigger><TooltipContent>Prototype of the create-key journey. Use the Expert toggle in the header to switch between Basic (guided steps) and Expert (live tray) modes. Expert mode is available on larger screens.</TooltipContent></Tooltip>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="warning" className="text-[10px]">Prototype · synthetic fixture · no gateway</Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              {isMobile ? (
                <span className="inline-block">
                  <Button variant={effectiveMode === "expert" ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs" aria-pressed={effectiveMode === "expert"} disabled>Expert</Button>
                </span>
              ) : (
                <Button
                  variant={mode === "expert" ? "default" : "outline"}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  aria-pressed={mode === "expert"}
                  onClick={() => setMode(mode === "expert" ? "basic" : "expert")}
                >
                  Expert
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>{isMobile ? "Expert mode is available on larger screens" : mode === "expert" ? "Expert mode — live composition tray. Switch to Basic" : "Basic mode — guided steps. Switch to Expert"}</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" aria-label={dark ? "Use light theme" : "Use dark theme"} title={dark ? "Use light theme" : "Use dark theme"} onClick={() => setTheme(!dark)}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</Button>
        </div>
      </header>
      <div className="custom-scrollbar content-container mx-0 min-h-0 min-w-0 flex-1 overflow-auto border bg-background md:mr-3 md:mb-3 md:rounded-md md:px-10">
        <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-0 md:py-8">
          {screen === "list" && <div className="mx-auto max-w-4xl space-y-5 pb-24">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Virtual keys</h2>
                <p className="mt-1 max-w-prose text-sm text-foreground/70">Prototype entry point — only the create-key journey is implemented. The witness key below is part of the synthetic fixture.</p>
              </div>
              <Button onClick={() => setScreen("create")}><Plus className="size-4" />Create key</Button>
            </div>
            <div className="overflow-hidden rounded-sm border bg-card shadow-sm">
              <Table className="[&_td]:py-3 [&_td]:whitespace-normal [&_th]:h-12">
                <TableHeader className="bg-muted/50"><TableRow><TableHead>Key</TableHead><TableHead>Client</TableHead><TableHead>Catalog</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-base font-semibold">Witness key</TableCell>
                    <TableCell className="text-muted-foreground">Isolation check</TableCell>
                    <TableCell className="text-sm text-muted-foreground">Inherits group Code</TableCell>
                    <TableCell><Badge variant="secondary">Fixture</Badge></TableCell>
                  </TableRow>
                  {created.map((key, i) => <TableRow key={`${key.name}-${i}`}>
                    <TableCell className="text-base font-semibold">{key.name}</TableCell>
                    <TableCell className="text-muted-foreground">{key.client || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{key.planned.length} IDs planned ({key.naming})</TableCell>
                    <TableCell><Badge variant="warning">Simulated — not published</Badge></TableCell>
                  </TableRow>)}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">Created keys stay in memory only; reloading the page resets the fixture.</p>
          </div>}
          {screen === "create" && <>
            {effectiveMode === "basic" ? <VariantA {...composerProps} /> : <VariantB {...composerProps} />}
          </>}
        </main>
      </div>
    </div>
    <span className="sr-only" aria-live="polite">Key composer mode — {effectiveMode === "basic" ? "Basic — Guided steps" : "Expert — Live tray"}</span>
    <Toaster closeButton position={isMobile ? "bottom-center" : "bottom-right"} offset={isMobile ? { bottom: "calc(env(safe-area-inset-bottom) + 128px)" } : undefined} mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 128px)" }} visibleToasts={isMobile ? 1 : undefined} richColors />
  </SidebarProvider></TooltipProvider>;
}
