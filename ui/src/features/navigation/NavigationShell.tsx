import { useEffect, type ReactNode } from "react";
import { CircleHelp, Languages, LogOut, Moon, Settings2, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useCopy, type Copy, type Language } from "../../lib/locale";
import type { Key } from "../../domain/registry";
import type { Workspace } from "../../data/api";
import type { Page } from "./navigation";

function CollapsedSidebarExpand() {
  const { isMobile, state } = useSidebar();
  const copyText = useCopy();
  if (isMobile || state !== "collapsed") return null;
  return (
    <SidebarTrigger
      className="size-8"
      aria-label={copyText("Expand sidebar", "Afficher la barre latérale")}
      title={copyText("Expand sidebar", "Afficher la barre latérale")}
    />
  );
}

function MobileSidebarLabel() {
  const { isMobile } = useSidebar();
  const copyText = useCopy();
  return isMobile ? (
    <>
      <SheetTitle className="sr-only">{copyText("Navigation", "Navigation")}</SheetTitle>
      <SheetDescription className="sr-only">
        {copyText("Registry pages and settings", "Pages et réglages de Registry")}
      </SheetDescription>
    </>
  ) : null;
}

function CloseMobileSidebarOnRoute({ routeKey }: { routeKey: string }) {
  const { setOpenMobile } = useSidebar();
  useEffect(() => setOpenMobile(false), [routeKey, setOpenMobile]);
  return null;
}

export function NavigationShell({
  page,
  pageId,
  title,
  language,
  copyText,
  onLanguageChange,
  canUseExpert,
  expert,
  setExpertMode,
  dark,
  setDark,
  connection,
  snapshotMode,
  busy,
  loading,
  standaloneAuthenticated,
  setHelpOpen,
  requestSignOut,
  setCatalogFocus,
  go,
  nav,
  currentKey,
  children,
}: {
  page: Page;
  pageId: string | undefined;
  title: string;
  language: Language;
  copyText: Copy;
  onLanguageChange: (language: Language) => void;
  canUseExpert: boolean;
  expert: boolean;
  setExpertMode: (next: boolean) => void;
  dark: boolean;
  setDark: (next: boolean) => void;
  connection: Workspace["connection"] | null;
  snapshotMode: boolean;
  busy: string;
  loading: boolean;
  standaloneAuthenticated: boolean;
  setHelpOpen: (open: boolean) => void;
  requestSignOut: () => void;
  setCatalogFocus: (focus: { target: "reference" | "access"; id: string } | null) => void;
  go: (page: Page, id?: string) => void;
  nav: { id: Page; label: Record<Language, string>; icon: typeof Settings2 }[];
  currentKey: Key | undefined;
  children: ReactNode;
}) {
  return (
    <>
      <CloseMobileSidebarOnRoute routeKey={`${page}/${pageId || ""}`} />
      <Sidebar collapsible="icon" className="border-none bg-transparent">
        <SidebarHeader className="px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2">
          <MobileSidebarLabel />
          <CollapsedSidebarExpand />
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:hidden">
            <a
              href="#/models"
              onClick={e => {
                e.preventDefault();
                go("models");
              }}
              className="-my-px min-w-0 py-px max-sm:-my-[7px] max-sm:py-[7px]"
            >
              <img
                src={`${import.meta.env.BASE_URL}bifrost-logo.webp`}
                alt="Bifrost"
                className="h-[22px] max-w-[145px] object-contain object-left dark:hidden"
              />
              <img
                src={`${import.meta.env.BASE_URL}bifrost-logo-dark.webp`}
                alt="Bifrost"
                className="hidden h-[22px] max-w-[145px] object-contain object-left dark:block"
              />
            </a>
            <SidebarTrigger
              className="size-8"
              aria-label={copyText("Collapse sidebar", "Réduire la barre latérale")}
              title={copyText("Collapse sidebar", "Réduire la barre latérale")}
            />
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>{copyText("WORKSPACE", "ESPACE DE TRAVAIL")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label={copyText("Main navigation", "Navigation principale")}>
                <SidebarMenu>
                  {nav
                    .filter(item => ["models", "groups", "keys"].includes(item.id))
                    .map(item => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton asChild isActive={page === item.id} tooltip={item.label[language]}>
                            <a
                              href={`#/${item.id}`}
                              onClick={e => {
                                e.preventDefault();
                                if (item.id === "catalog") setCatalogFocus(null);
                                go(item.id);
                              }}
                              className={
                                page === item.id ? "border border-primary/20 text-primary" : "border border-transparent"
                              }
                            >
                              <Icon className="size-4" />
                              <span>{item.label[language]}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={["settings", "gateway", "catalog", "snapshot"].includes(page)}
                tooltip={nav.find(item => item.id === "settings")!.label[language]}
              >
                <a
                  href="#/settings"
                  onClick={e => {
                    e.preventDefault();
                    go("settings");
                  }}
                >
                  <Settings2 className="size-4" />
                  <span>{nav.find(item => item.id === "settings")!.label[language]}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <div className="flex h-dvh w-full min-w-0 flex-col">
        <header className="flex h-13 w-full shrink-0 items-center gap-2 px-3 pt-1 md:pr-3 md:pl-0">
          <SidebarTrigger className="md:hidden" />
          {/* A page prints its own title; the topbar only names the parent of a key. */}
          <div className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
            {page === "keys" && currentKey ? title : null}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={copyText(`Help for ${title}`, `Aide pour ${title}`)}
                data-help
                onClick={() => setHelpOpen(true)}
                className="inline-flex items-center justify-center rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:size-9"
              >
                <CircleHelp className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {page === "models"
                ? copyText("Explore models and provider accesses", "Explorez les modèles et leurs accès fournisseurs")
                : page === "groups"
                  ? copyText("Shared sets of models for keys", "Ensembles de modèles partagés entre clés")
                  : page === "keys"
                    ? copyText("Compose and publish key catalogs", "Composez et publiez les catalogues des clés")
                    : page === "settings"
                      ? copyText("AI assistance and display preferences", "Assistance IA et préférences d’affichage")
                      : page === "catalog"
                        ? copyText(
                            "Review source data, references, and mappings",
                            "Consultez les sources, références et rapprochements",
                          )
                        : page === "snapshot"
                          ? copyText(
                              "Import or export Registry snapshots and CSV",
                              "Importez ou exportez un instantané Registry ou un CSV",
                            )
                          : copyText(
                              "Review the existing Bifrost configuration",
                              "Consultez la configuration Bifrost existante",
                            )}
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Badge variant={connection ? "success" : "warning"} className="hidden text-xs sm:inline-flex">
              {busy ||
                (connection
                  ? `${snapshotMode ? `${copyText("Local copy", "Copie locale")} · ` : ""}Bifrost ${connection.version}`
                  : copyText("Disconnected", "Déconnecté"))}
            </Badge>
            {!standaloneAuthenticated && !snapshotMode && (
              <a
                href="/workspace/providers"
                className="hidden text-xs text-muted-foreground hover:text-foreground xl:inline"
              >
                {copyText("Bifrost workspace", "Espace de travail Bifrost")}
              </a>
            )}
            <Select value={language} onValueChange={value => onLanguageChange(value as Language)}>
              <SelectTrigger
                size="sm"
                aria-label={language === "fr" ? "Langue : français" : "Language: English"}
                title={language === "fr" ? "Français" : "English"}
                className="w-auto gap-1.5 px-2 text-xs"
              >
                <Languages className="size-3.5" />
                <SelectValue>{language.toUpperCase()}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="fr" textValue="Français">
                    Français
                  </SelectItem>
                  <SelectItem value="en" textValue="English">
                    English
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            {canUseExpert && (
              <label className="hidden items-center gap-2 text-xs font-medium xl:flex">
                <span>{copyText("Expert", "Expert")}</span>
                <Switch
                  id="expert-mode"
                  checked={expert}
                  onCheckedChange={setExpertMode}
                  className="h-6 data-[state=checked]:bg-chart-success data-[state=unchecked]:bg-muted-foreground/50 [&>span]:bg-white dark:[&>span]:bg-white"
                  aria-label={copyText("Expert mode", "Mode Expert")}
                />
              </label>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                dark
                  ? copyText("Use light theme", "Utiliser le thème clair")
                  : copyText("Use dark theme", "Utiliser le thème sombre")
              }
              title={
                dark
                  ? copyText("Use light theme", "Utiliser le thème clair")
                  : copyText("Use dark theme", "Utiliser le thème sombre")
              }
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {standaloneAuthenticated ? (
              <Button
                variant="outline"
                size="icon"
                className="size-8 max-sm:size-9 shrink-0"
                aria-label={copyText("Sign out", "Se déconnecter")}
                title={copyText("Sign out", "Se déconnecter")}
                disabled={!!busy || loading}
                onClick={requestSignOut}
              >
                <LogOut className="size-4" />
              </Button>
            ) : null}
          </div>
        </header>
        {children}
      </div>
    </>
  );
}
