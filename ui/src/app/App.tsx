import { useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { ArrowLeft, ArrowRight, MoreHorizontal, Plus, Search } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  copy,
  emptyModelFilters,
  exposed,
  keyImpact,
  members,
  same,
  unsavedModels,
  type Demo,
  type Group,
  type Key,
  type Model,
  type Policy,
  type PricingProof,
} from "../domain/registry";
import { firstRegistrationIssue } from "../features/catalog/model-editor-data";
import {
  ApiError,
  clearAdminToken,
  createKey,
  getWorkspace,
  isWellFormedAdminToken,
  putWorkspace,
  readbackKey,
  setAdminToken,
  type AdoptionOperation,
  type Workspace,
} from "../data/api";
import GatewayInventory from "../features/gateway/GatewayInventory";
import ModelEditor from "../features/catalog/ModelEditor";
import type { CatalogOverride } from "../features/catalog/model-card-fields";
import RegistrySettings from "../features/settings/RegistrySettings";
import { useViewPreferences } from "../features/settings/useViewPreferences";
import { useConfirmation } from "../features/shared/useConfirmation";
import { ConfirmationDialog } from "../features/shared/ConfirmationDialog";
import AssistantSuggestion from "../features/assistant/AssistantSuggestion";
import VirtualKeySecret from "../features/keys/VirtualKeySecret";
import { CreatedKeySecretDialog } from "../features/keys/CreatedKeySecretDialog";
import { useCreatedKeySecret } from "../features/keys/useCreatedKeySecret";
import { KeyRenameDialog } from "../features/keys/KeyRenameDialog";
import { useKeyRename } from "../features/keys/useKeyRename";
import { KeyCreateDialog } from "../features/keys/KeyCreateDialog";
import { useKeyCreation } from "../features/keys/useKeyCreation";
import { omitUnchangedReferenceIds } from "../features/catalog/model-editor-data";
import CatalogMetadata from "../features/catalog/CatalogMetadata";
import SnapshotTransfer from "../features/snapshot/SnapshotTransfer";
import AdoptionDialog from "../features/keys/AdoptionDialog";
import ReferenceCatalogBrowser from "../features/catalog/ReferenceCatalogBrowser";
import { associateReference } from "../features/catalog/AssociateReference";
import { modelFiltersKey } from "../features/catalog/ModelBrowser";
import { useReferenceCatalog } from "../features/catalog/useReferenceCatalog";
import { cardName, groupReferenceModels } from "../features/catalog/reference-groups";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { clearSessionState, setSessionState } from "../lib/session-state";
import { ViewControls } from "../components/registry/ViewOptions";
import { LanguageContext, initialLanguage, rememberLanguage, useCopy, useFormat, type Language } from "../lib/locale";

import KeyComposer from "../features/keys/KeyComposer";
import { checkFailed, keyLedger, KeySummary, verifiedToast } from "../features/keys/KeySummary";
import { permissionSummary, preserveAdoptionDraft } from "../features/keys/KeyComposer.state";
import KeyLibrary from "../features/keys/KeyLibrary";
import { KeyPermissions } from "../features/keys/KeyPermissions";
import { readinessLabel, readinessReason, readinessState, readinessVariant } from "../features/keys/key-readiness";
import { displayProvider, setMarkLabels, setProviderBaseTypes } from "../components/registry/BrandIcon";
import { GroupLibrary } from "../features/groups/GroupLibrary";
import { GroupEditor } from "../features/groups/GroupEditor";
import { HelpSheet } from "../features/help/HelpSheet";
import { Tour, TourOffer } from "../features/help/Tour";
import { markTourSeen, tourSeen } from "../features/help/tourSteps";
import { nav, type Page } from "../features/navigation/navigation";
import { NavigationShell } from "../features/navigation/NavigationShell";
function route(): { page: Page; id?: string } {
  const [page, id] = location.hash.slice(2).split("/");
  if (page === "qualification") history.replaceState(null, "", `${location.pathname}${location.search}#/models`);
  return { page: nav.some(n => n.id === page) ? (page as Page) : "models", id };
}

// "Snapshot copy · Pulsar · captured Oct 12, 2026, 9:30 AM": the capture time in the UI's one time format.
export function SnapshotSource({ source, capturedAt }: { source?: string; capturedAt?: string }) {
  const copyText = useCopy();
  const { moment } = useFormat();
  return (
    <>
      {copyText("Snapshot copy", "Copie d’instantané")} · <span className="font-medium">{source || "Registry"}</span>
      {capturedAt && (
        <>
          {" "}
          · {copyText("captured", "capturée")} {moment(capturedAt)}
        </>
      )}
    </>
  );
}

function RegistryApp({
  language,
  onLanguageChange,
}: {
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  const copyText = useCopy();
  const keyNameMessages = {
    required: copyText("Enter a key name.", "Saisissez un nom de clé."),
    duplicate: copyText("A key with this name already exists.", "Une clé portant ce nom existe déjà."),
  };
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
  const createdKeySecret = useCreatedKeySecret(copyText);
  const { setCreatedSecret, setCreatedSecretError } = createdKeySecret;
  const [locationState, setLocationState] = useState(route);
  const [modelDraft, setModelDraft] = useState<Model | null>(null);
  const modelBaseline = useRef<Model | null>(null);
  const [modelOverrides, setModelOverrides] = useState<CatalogOverride[]>([]);
  const [creatingModel, setCreatingModel] = useState(false);
  const [modelTab, setModelTab] = useState<"access">();
  const [modelError, setModelError] = useState("");
  const [groupDraft, setGroupDraft] = useState<Group | null>(null);
  const groupBaseline = useRef<Group | null>(null);
  const keyCreation = useKeyCreation(
    copyText,
    data.keys,
    keyNameMessages,
    (label, work) => operation(label, work),
    setCreatedSecret,
    setCreatedSecretError,
    workspace => applyWorkspace(workspace),
    (page, id) => navigate(page, id),
  );
  const { keyForm, setKeyForm, keyFormFields, saveKey } = keyCreation;
  const keyRename = useKeyRename(data, copyText, (next, label) => commit(next, label));
  const { setRenameForm } = keyRename;
  // A managed key opens read-first; "Edit selection" opens the composer for that key (an unpublished draft keeps it open).
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adoption, setAdoption] = useState<{ keyId: string; operation: AdoptionOperation } | null>(null);
  // Help opens beside the page ("?"); the guided tour is offered once per browser, then only on request.
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOffer, setTourOffer] = useState(() => !tourSeen());
  const [tourRun, setTourRun] = useState(0);
  const [catalogFocus, setCatalogFocus] = useState<{ target: "reference" | "access"; id: string } | null>(null);
  const [modelScope, setModelScope] = useState<"registry" | "to-add">("registry");
  // The reference catalogue is read once per Registry revision and shared by the pages.
  const { referenceCatalog, setReferenceCatalog, referenceError, setReferenceError, loadReferenceCatalog } =
    useReferenceCatalog(copyText, () => requireLogin());
  const { preferences, setPreferences, setListOverrides, viewFor, setView, resetView } = useViewPreferences();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);
  const { confirm, setConfirm } = useConfirmation();
  const [draft, setDraft] = useState<Policy | null>(null);
  const pendingKeyDraft = useRef<{ keyId: string; policy: Policy } | null>(null);

  const applyWorkspace = (workspace: Workspace) => {
    setData(workspace.data);
    setRevision(workspace.revision);
    setDiscovery(workspace.discovery);
    setPricingProofs(workspace.pricingProofs || []);
    setProviderBaseTypes(workspace.providers);
    setConnection(workspace.connection);
    setApiError("");
  };
  const requireLogin = () => {
    clearAdminToken();
    setStandaloneAuthenticated(false);
    setLoginRequired(true);
    setLoginToken("");
    setLoginError(
      revision
        ? copyText(
            "Your session expired. Enter the admin token to continue.",
            "Votre session a expiré. Saisissez le jeton administrateur pour continuer.",
          )
        : "",
    );
  };
  const load = async () => {
    if (busyRef.current) return;
    setLoading(true);
    try {
      applyWorkspace(await getWorkspace());
      if (reconcileBlocked) {
        setReconcileBlocked(false);
        setNeedsReconcile(false);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) requireLogin();
      else
        setApiError(
          error instanceof ApiError && error.status === 403
            ? copyText(
                "Access to the Registry panel was denied (403).",
                "L’accès au panneau Registry a été refusé (403).",
              )
            : error instanceof ApiError
              ? error.message
              : copyText(
                  "Could not connect to Registry. Check the network and try again.",
                  "Connexion à Registry impossible. Vérifiez le réseau puis réessayez.",
                ),
        );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  // A catalogue correction already handed over the catalogue of the revision it created.
  useEffect(() => {
    if (revision && referenceCatalog?.revision !== revision) void loadReferenceCatalog();
  }, [revision]);
  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const token = loginToken.trim();
    if (!token) {
      setLoginError(copyText("Enter the admin token.", "Saisissez le jeton administrateur."));
      return;
    }
    if (!isWellFormedAdminToken(token)) {
      setLoginError(
        copyText(
          "The token contains spaces or invalid characters; copy it again on one line.",
          "Le jeton contient des espaces ou des caractères invalides ; copiez-le à nouveau sur une seule ligne.",
        ),
      );
      return;
    }
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
      setLoginError(
        error instanceof ApiError && error.status === 401
          ? copyText("Invalid or expired admin token.", "Jeton administrateur invalide ou expiré.")
          : error instanceof ApiError && error.status === 403
            ? copyText(
                "Access to the Registry panel was denied (403).",
                "L’accès au panneau Registry a été refusé (403).",
              )
            : copyText(
                "Could not connect to Registry. Check the network and try again.",
                "Connexion à Registry impossible. Vérifiez le réseau puis réessayez.",
              ),
      );
    } finally {
      setLoading(false);
    }
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
    setModelScope("registry");
    setReferenceCatalog(null);
    setReferenceError("");
    clearSessionState();
    setListOverrides({});
    history.replaceState(null, "", `${location.pathname}${location.search}#/models`);
    setLocationState({ page: "models" });
  };
  const operation = async (label: string, work: () => Promise<void>) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(label);
    try {
      await work();
      setApiError("");
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        requireLogin();
        return false;
      }
      const message = error instanceof Error ? error.message : copyText("Request failed", "Échec de la requête");
      setApiError(message);
      toast.error(message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy("");
    }
  };
  const markReadbackFailure = (id: string, error: unknown) => {
    const fromServer = error instanceof ApiError ? error.publication : undefined;
    const message = error instanceof Error ? error.message : checkFailed(copyText);
    setData(old => ({
      ...old,
      keys: old.keys.map(k => {
        if (k.id !== id) return k;
        const prior = k.publication;
        const actual = fromServer?.actual ?? prior?.actual ?? k.observed ?? null;
        return {
          ...k,
          publication: {
            state: "not_verified",
            revision: fromServer?.revision || prior?.revision || revision,
            checkedAt: fromServer?.checkedAt || new Date().toISOString(),
            observedAt: fromServer?.observedAt || prior?.observedAt,
            observedRevision: fromServer?.observedRevision || prior?.observedRevision,
            expected: fromServer?.expected || exposed(k.policy, old.groups, old.models),
            actual,
            missing: [],
            unexpected: [],
            error: fromServer?.error || message,
          },
        };
      }),
    }));
  };
  // Differences are the kept routes Bifrost does not list on the keys it confirmed (ADR 0001): "Verified" is never plain.
  const verify = async (ids: string[]) => {
    let verified = true;
    let differences = 0;
    for (const id of [...new Set(ids)]) {
      setBusy(copyText("Checking with Bifrost…", "Vérification avec Bifrost…"));
      try {
        const workspace = await readbackKey(id);
        applyWorkspace(workspace);
        const checked = workspace.data.keys.find(k => k.id === id);
        if (checked?.publication?.state === "verified")
          differences += keyLedger(checked, workspace.data.models, workspace.data.groups).differences;
        else verified = false;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) throw error;
        verified = false;
        markReadbackFailure(id, error);
        // The key is named, not its id.
        toast.warning(
          `${data.keys.find(k => k.id === id)?.name || id}: ${error instanceof Error ? error.message : checkFailed(copyText)}`,
        );
      }
    }
    return { verified, differences };
  };
  const commit = async (next: Demo, label: string, verifyIds: string[] = [], overrides?: CatalogOverride[]) =>
    operation(label, async () => {
      let saved: Workspace;
      try {
        saved = await putWorkspace(next, revision, overrides);
      } catch (error) {
        const partial =
          error instanceof ApiError &&
          !!error.revision &&
          ["native_apply", "refresh", "aliases"].includes(error.phase || "");
        if (partial || !(error instanceof ApiError) || [404, 409].includes(error.status)) {
          setNeedsReconcile(true);
          try {
            applyWorkspace(await getWorkspace());
          } catch (refreshError) {
            setReconcileBlocked(true);
            if (refreshError instanceof ApiError && refreshError.status === 401) throw refreshError;
            throw new Error(
              copyText(
                "The write result is uncertain and the workspace refresh failed. Reload before another write; your draft is preserved.",
                "Le résultat de l’écriture est incertain et l’actualisation de l’espace a échoué. Rechargez avant une autre écriture ; votre brouillon est conservé.",
              ),
            );
          }
          setReconcileBlocked(false);
          if (!partial) setNeedsReconcile(false);
          throw new Error(
            partial
              ? copyText(
                  `Registry reached revision ${error.revision}, but the Bifrost update or refresh failed. Review the unverified keys before retrying.`,
                  `Registry a atteint la révision ${error.revision}, mais la mise à jour ou l’actualisation Bifrost a échoué. Examinez les clés non vérifiées avant de réessayer.`,
                )
              : copyText(
                  "The workspace was refreshed after a failed write. Review the current revision and your draft before publishing again.",
                  "L’espace a été actualisé après une écriture échouée. Vérifiez la révision courante et votre brouillon avant de publier à nouveau.",
                ),
          );
        }
        throw error;
      }
      applyWorkspace(saved);
      setNeedsReconcile(false);
      setReconcileBlocked(false);
      const { verified, differences } =
        verifyIds.length && !snapshotMode ? await verify(verifyIds) : { verified: true, differences: 0 };
      toast[verified ? "success" : "warning"](
        snapshotMode
          ? copyText(
              "Saved in the local copy. Pulsar remains unchanged.",
              "Enregistré dans la copie locale. Pulsar reste inchangé.",
            )
          : verifyIds.length
            ? verified
              ? verifiedToast(copyText, differences, true)
              : copyText(
                  "Published; Bifrost differs or could not be checked.",
                  "Publié ; Bifrost diffère ou n’a pas pu être vérifié.",
                )
            : copyText("Saved.", "Enregistré."),
      );
    });

  const navigate = (page: Page, id?: string) => {
    const hash = `#/${page}${id ? `/${id}` : ""}`;
    if (location.hash !== hash) history.pushState(null, "", `${location.pathname}${location.search}${hash}`);
    setLocationState({ page, id });
  };
  const go = (page: Page, id?: string) => {
    if (
      locationState.page === "keys" &&
      locationState.id &&
      draft &&
      !same(data.keys.find(k => k.id === locationState.id)?.policy, draft) &&
      (page !== "keys" || id !== locationState.id)
    ) {
      setConfirm({
        title: copyText("Discard key draft?", "Abandonner le brouillon de clé ?"),
        text: copyText("Unpublished key selections will be lost.", "Les sélections non publiées seront abandonnées."),
        confirmLabel: copyText("Discard changes", "Abandonner les modifications"),
        cancelLabel: copyText("Keep editing", "Continuer à modifier"),
        action: () => navigate(page, id),
      });
      return;
    }
    navigate(page, id);
  };
  const { page, id: pageId } = locationState;
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [page, pageId]);
  const key = data.keys.find(k => k.id === pageId);
  useEffect(() => {
    setEditingKey(null);
    if (!key) {
      if (!pendingKeyDraft.current) setDraft(null);
      return;
    }
    if (pendingKeyDraft.current?.keyId === key.id) {
      setDraft(pendingKeyDraft.current.policy);
      pendingKeyDraft.current = null;
    } else setDraft(copy(key.policy));
  }, [key?.id]);
  // A managed key's page opens with a fresh read of what Bifrost lists for it (#110, owner decision of
  // 2026-10-14): a read, not a write, so the verdict never goes stale across a gateway restart. Silent on
  // success; a failure is recorded like a manual check, without a toast.
  useEffect(() => {
    if (page !== "keys" || !pageId || snapshotMode) return;
    const managed = key && key.managed !== false;
    if (!managed) return;
    let cancelled = false;
    readbackKey(pageId)
      .then(workspace => {
        if (!cancelled) applyWorkspace(workspace);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          requireLogin();
          return;
        }
        markReadbackFailure(pageId, error);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageId, key?.id, key?.managed, snapshotMode]);
  const activePolicy = draft || key?.policy;
  const isDirty = Boolean(key && draft && !same(key.policy, draft));
  const keyEditing = Boolean(key && (editingKey === key.id || isDirty));
  const modelIsDirty = Boolean(
    modelDraft && modelBaseline.current && (!same(modelDraft, modelBaseline.current) || modelOverrides.length > 0),
  );
  const groupIsDirty = Boolean(groupDraft && groupBaseline.current && !same(groupDraft, groupBaseline.current));
  const startTour = () => {
    markTourSeen();
    setTourOffer(false);
    setHelpOpen(false);
    // Step 1 speaks of registered cards: its ring must not land on a tile of To add.
    setModelScope("registry");
    setTourRun(run => run + 1);
  };
  const dismissTour = () => {
    markTourSeen();
    setTourOffer(false);
  };
  const requestSignOut = () => {
    if (modelIsDirty || groupIsDirty || isDirty)
      setConfirm({
        title: copyText("Discard drafts and sign out?", "Abandonner les brouillons et se déconnecter ?"),
        text: copyText("Unsaved changes will be lost.", "Les modifications non enregistrées seront abandonnées."),
        confirmLabel: copyText("Discard and sign out", "Abandonner et se déconnecter"),
        cancelLabel: copyText("Keep editing", "Continuer à modifier"),
        action: signOut,
      });
    else signOut();
  };
  useEffect(() => {
    if (!modelIsDirty && !groupIsDirty && !isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    addEventListener("beforeunload", onBeforeUnload);
    return () => removeEventListener("beforeunload", onBeforeUnload);
  }, [modelIsDirty, groupIsDirty, isDirty]);
  useEffect(() => {
    const onHash = () => {
      const target = route();
      if (target.page === page && target.id === pageId) return;
      if (isDirty && (target.page !== page || target.id !== pageId)) {
        history.replaceState(null, "", `${location.pathname}${location.search}#/${page}${pageId ? `/${pageId}` : ""}`);
        setConfirm({
          title: copyText("Discard key draft?", "Abandonner le brouillon de clé ?"),
          text: copyText("Unpublished key selections will be lost.", "Les sélections non publiées seront abandonnées."),
          confirmLabel: copyText("Discard changes", "Abandonner les modifications"),
          cancelLabel: copyText("Keep editing", "Continuer à modifier"),
          action: () => navigate(target.page, target.id),
        });
      } else setLocationState(target);
    };
    addEventListener("hashchange", onHash);
    addEventListener("popstate", onHash);
    return () => {
      removeEventListener("hashchange", onHash);
      removeEventListener("popstate", onHash);
    };
  }, [isDirty, page, pageId]);
  // My models: the saved cards ("In Registry"), and everything discovered but not saved ("To add").
  const toAdd = unsavedModels(data.models, discovery);
  const catalog = [...data.models, ...toAdd];
  const registeredIds = new Set(data.models.map(model => model.id));
  // Groups and keys only read saved cards: they get them under the name My models shows. Saves keep data.models.
  const namedModels = useMemo(
    () => data.models.map(model => ({ ...model, name: cardName(model, referenceCatalog) })),
    [data.models, referenceCatalog],
  );
  // Every creator and provider name the pages can show, so initials stay distinct where no mark exists.
  useEffect(
    () =>
      setMarkLabels(
        [
          ...catalog.flatMap(model => [
            model.creator,
            ...model.accesses.map(access => displayProvider(access.provider)),
          ]),
          ...(referenceCatalog?.references.map(reference => reference.fields.creator?.value) ?? []).filter(
            (creator): creator is string => typeof creator === "string",
          ),
        ].filter(label => label && label !== "Unknown"),
      ),
    [data.models, discovery, referenceCatalog],
  );
  // A scope counts the tiles it shows: one per saved card; To add one per reference, the same count
  // before and after the catalogue loads (the accesses already carry their reference).
  const modelCounts = { registry: data.models.length, toAdd: groupReferenceModels(toAdd, referenceCatalog).length };
  const scopeLabels = {
    registry: copyText(`In Registry (${modelCounts.registry})`, `Dans Registry (${modelCounts.registry})`),
    toAdd: copyText(`To add (${modelCounts.toAdd})`, `À ajouter (${modelCounts.toAdd})`),
  };

  const newModel = (): Model => ({
    id: "",
    name: "",
    creator: "Unknown",
    family: "Unknown",
    inputModalities: [],
    outputModalities: [],
    tasks: [],
    kind: "Unknown",
    summary: "",
    context: "Unknown",
    capabilities: {},
    accesses: [{ provider: "", id: "", route: "Direct provider", status: "Unknown", nativeModel: "" }],
  });
  const openModel = (model: Model, creating: boolean, tab?: "access") => {
    setModelTab(tab);
    modelBaseline.current = copy(model);
    setModelOverrides([]);
    setCreatingModel(creating);
    setModelError("");
    setModelDraft(copy(model));
  };
  const closeModel = () => {
    if (!modelDraft || busyRef.current) return;
    if (modelIsDirty) confirmDiscardModel(() => setModelDraft(null));
    else setModelDraft(null);
  };
  const confirmDiscardModel = (action: () => void) =>
    setConfirm({
      title: copyText("Discard changes?", "Abandonner les modifications ?"),
      text: copyText(
        "The model card and its unsaved corrections will be discarded.",
        "La fiche et ses corrections non enregistrées seront abandonnées.",
      ),
      confirmLabel: copyText("Discard draft", "Abandonner le brouillon"),
      cancelLabel: copyText("Keep editing", "Continuer à modifier"),
      action,
    });
  // Cancel in the editor of a saved card returns to its read view.
  const discardModelEdits = (revert: () => void) => {
    const done = () => {
      setModelError("");
      revert();
    };
    if (modelIsDirty) confirmDiscardModel(done);
    else done();
  };
  const openGroup = (group: Group) => {
    groupBaseline.current = copy(group);
    setGroupDraft(copy(group));
  };
  const closeGroup = () => {
    if (!groupDraft || busyRef.current) return;
    if (groupIsDirty)
      setConfirm({
        title: copyText("Discard group changes?", "Abandonner les modifications du groupe ?"),
        text: copyText(
          "Unsaved group selections will be lost.",
          "Les sélections non enregistrées du groupe seront abandonnées.",
        ),
        confirmLabel: copyText("Discard changes", "Abandonner les modifications"),
        cancelLabel: copyText("Keep editing", "Continuer à modifier"),
        action: () => setGroupDraft(null),
      });
    else setGroupDraft(null);
  };
  const updateModel = async (overrides: CatalogOverride[]) => {
    if (!modelDraft || busyRef.current) return;
    if (firstRegistrationIssue(modelDraft)) {
      setModelError(
        copyText(
          "Provide the call name, the name, at least one request type per access and every valid provider access.",
          "Renseignez le nom d’appel, le nom, au moins un type de requête par accès et chaque accès fournisseur valide.",
        ),
      );
      return;
    }
    if (creatingModel && data.models.some(m => m.id === modelDraft.id)) {
      setModelError(copyText("That model ID already exists.", "Cet identifiant de modèle existe déjà."));
      return;
    }
    const allAccessIds = data.models.filter(m => m.id !== modelDraft.id).flatMap(m => m.accesses.map(a => a.id));
    if (
      modelDraft.accesses.some(a => allAccessIds.includes(a.id)) ||
      new Set(modelDraft.accesses.map(a => a.id)).size !== modelDraft.accesses.length
    ) {
      setModelError(
        copyText("Provider access IDs must be unique.", "Les identifiants d’accès fournisseur doivent être uniques."),
      );
      return;
    }
    const saved = omitUnchangedReferenceIds(copy(modelDraft), catalog);
    const next = {
      ...data,
      models: creatingModel
        ? [...data.models, copy(saved)]
        : data.models.map(m => (m.id === saved.id ? copy(saved) : m)),
    };
    const impacted = data.keys
      .filter(k => k.managed !== false && members(k.policy, data.groups).includes(saved.id))
      .map(k => k.id);
    if (await commit(next, copyText("Saving the model card…", "Enregistrement de la fiche…"), impacted, overrides)) {
      setModelDraft(null);
      setModelError("");
    }
  };
  const associateModel = (model: Model, referenceId: string) =>
    commit(
      { ...data, models: data.models.map(row => (row.id === model.id ? associateReference(row, referenceId) : row)) },
      copyText("Saving the reference…", "Enregistrement de la fiche documentaire…"),
    );
  const deleteModel = (model: Model) => {
    const emptied = data.groups.filter(g => g.members.includes(model.id) && !g.members.some(id => id !== model.id));
    if (emptied.length) {
      const message = copyText(
        `Remove this model from these groups, or delete the groups first: ${emptied.map(g => g.name).join(", ")}.`,
        `Retirez ce modèle de ces groupes, ou supprimez d’abord les groupes : ${emptied.map(g => g.name).join(", ")}.`,
      );
      setModelError(message);
      toast.error(message);
      return;
    }
    const used = data.keys.filter(k => members(k.policy, data.groups).includes(model.id)).length;
    setConfirm({
      title: copyText(
        `Delete ${cardName(model, referenceCatalog)}?`,
        `Supprimer ${cardName(model, referenceCatalog)} ?`,
      ),
      text: copyText(
        `This removes the model from its groups and key selections. ${used} key ${used === 1 ? "catalog" : "catalogs"} will change.`,
        `Ce modèle sera retiré de ses groupes et des sélections de clés. ${used} catalogue${used === 1 ? "" : "s"} de clé${used === 1 ? "" : "s"} changera${used === 1 ? "" : "ont"}.`,
      ),
      action: () => {
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
          return {
            ...k,
            policy: {
              ...k.policy,
              added: k.policy.added.filter(id => id !== model.id),
              excluded: k.policy.excluded.filter(id => id !== model.id),
              accessSelection,
            },
          };
        });
        void (async () => {
          if (
            await commit(
              { ...data, models, groups, keys },
              copyText("Deleting model…", "Suppression du modèle…"),
              data.keys
                .filter(k => k.managed !== false && members(k.policy, data.groups).includes(model.id))
                .map(k => k.id),
            )
          )
            setModelDraft(null);
        })();
      },
    });
  };
  const publishGroup = async () => {
    if (!groupDraft?.name.trim() || !groupDraft.members.length) {
      toast.error(
        copyText("Enter a name and select at least one model.", "Saisissez un nom et sélectionnez au moins un modèle."),
      );
      return;
    }
    if (
      data.groups.some(g => g.id !== groupDraft.id && g.name.toLowerCase() === groupDraft.name.trim().toLowerCase())
    ) {
      toast.error(copyText("A group with this name already exists.", "Un groupe portant ce nom existe déjà."));
      return;
    }
    const nextGroup = { ...groupDraft, name: groupDraft.name.trim() };
    const nextGroups = data.groups.some(g => g.id === groupDraft.id)
      ? data.groups.map(g => (g.id === groupDraft.id ? nextGroup : g))
      : [...data.groups, nextGroup];
    const impacted = keyImpact(data.keys, data.groups, nextGroups, data.models)
      .filter(row => row.key.managed !== false)
      .map(row => row.key.id);
    if (
      await commit(
        { ...data, groups: nextGroups },
        snapshotMode
          ? copyText("Saving the group locally…", "Enregistrement local du groupe…")
          : copyText("Publishing the group…", "Publication du groupe…"),
        impacted,
      )
    )
      setGroupDraft(null);
  };
  const publishKey = async () => {
    if (!key || !draft || key.managed === false) return;
    const next = { ...data, keys: data.keys.map(k => (k.id === key.id ? { ...k, policy: copy(draft) } : k)) };
    await commit(next, copyText("Publishing key…", "Publication de la clé…"), [key.id]);
  };
  const reread = async () => {
    if (!key || key.managed === false) return;
    await operation(copyText("Checking with Bifrost…", "Vérification avec Bifrost…"), async () => {
      let workspace: Workspace;
      try {
        workspace = await readbackKey(key.id);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) markReadbackFailure(key.id, error);
        throw error;
      }
      applyWorkspace(workspace);
      const checked = workspace.data.keys.find(k => k.id === key.id);
      const state = checked?.publication?.state;
      toast[state === "verified" ? "success" : "warning"](
        checked && state === "verified"
          ? verifiedToast(copyText, keyLedger(checked, workspace.data.models, workspace.data.groups).differences)
          : state === "drift"
            ? copyText("Bifrost differs from the published selection.", "Bifrost diffère de la sélection publiée.")
            : checkFailed(copyText),
      );
    });
  };
  const title = nav.find(item => item.id === page)!.label[language];
  if (loginRequired)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-4 sm:p-6">
        <Card className="w-full max-w-md p-6">
          <form onSubmit={signIn} className="space-y-5">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold">{copyText("Sign in to Registry", "Connexion à Registry")}</h1>
              <p className="text-sm text-muted-foreground">
                {copyText("Enter the panel admin token.", "Saisissez le jeton administrateur du panneau.")}
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="registry-admin-token" className="text-sm font-medium">
                {copyText("Admin token", "Jeton administrateur")}
              </label>
              <Input
                id="registry-admin-token"
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                spellCheck={false}
                value={loginToken}
                onChange={event => setLoginToken(event.target.value)}
              />
            </div>
            {loginError && (
              <p role="alert" className="text-sm text-destructive">
                {loginError}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? copyText("Signing in…", "Connexion…") : copyText("Sign in", "Se connecter")}
            </Button>
          </form>
        </Card>
      </div>
    );
  if (loading && !revision)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md p-6">
          <CardTitle>{copyText("Connecting to Bifrost…", "Connexion à Bifrost…")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {copyText("Loading the live registry workspace.", "Chargement de l’espace Registry connecté.")}
          </p>
        </Card>
      </div>
    );
  if (apiError && !revision)
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md p-6">
          <CardTitle>{copyText("Registry unavailable", "Registry indisponible")}</CardTitle>
          <p role="alert" className="text-sm text-destructive">
            {apiError}
          </p>
          <Button onClick={() => void load()}>{copyText("Retry", "Réessayer")}</Button>
        </Card>
      </div>
    );
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <NavigationShell
          page={page}
          pageId={pageId}
          title={title}
          language={language}
          copyText={copyText}
          onLanguageChange={onLanguageChange}
          canUseExpert={canUseExpert}
          expert={expert}
          setExpertMode={setExpertMode}
          dark={dark}
          setDark={setDark}
          connection={connection}
          snapshotMode={snapshotMode}
          busy={busy}
          loading={loading}
          standaloneAuthenticated={standaloneAuthenticated}
          setHelpOpen={setHelpOpen}
          requestSignOut={requestSignOut}
          setCatalogFocus={setCatalogFocus}
          go={go}
          nav={nav}
          currentKey={key}
        >
          <div
            ref={contentRef}
            className="custom-scrollbar content-container relative mx-0 min-h-0 min-w-0 flex-1 overflow-auto border bg-background md:mr-3 md:mb-3 md:rounded-md md:px-10"
          >
            <main className="@container mx-auto max-w-[90rem] px-4 py-6 md:px-0 md:py-8">
              {apiError && (
                <div
                  role="alert"
                  className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm"
                >
                  <span>{apiError}</span>
                  <Button variant="outline" size="sm" onClick={() => void load()}>
                    {copyText("Reload workspace", "Recharger l’espace")}
                  </Button>
                </div>
              )}
              {tourOffer && page === "models" && (
                <TourOffer canStart={!isDirty} onStart={startTour} onDismiss={dismissTour} />
              )}
              {page === "models" && pendingKeyDraft.current && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-muted/30 p-3 text-sm">
                  <span>
                    {copyText(
                      "A key draft is saved while you register the missing models.",
                      "Un brouillon de clé est conservé pendant l’enregistrement des modèles manquants.",
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("keys", pendingKeyDraft.current!.keyId)}
                  >
                    {copyText("Return to key draft", "Revenir au brouillon de clé")}
                  </Button>
                </div>
              )}
              {snapshotMode && (
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <p className="min-w-0 flex-1 text-foreground/80">
                    <SnapshotSource source={connection.source} capturedAt={connection.capturedAt} />
                  </p>
                  {connection.partial && (
                    <details className="max-w-full">
                      <summary className="cursor-pointer text-chart-warning-ink">
                        {copyText("Partial capture", "Capture partielle")}
                      </summary>
                      <p className="mt-1 max-w-prose text-chart-warning-ink">
                        {copyText(
                          "Model discovery and some aliases need an administrator connection.",
                          "La découverte des modèles et certains alias nécessitent une connexion administrateur.",
                        )}
                      </p>
                    </details>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => go("gateway")}>
                    {copyText("Gateway details", "Détails du gateway")}
                  </Button>
                </div>
              )}
              {["gateway", "catalog", "snapshot"].includes(page) && (
                <nav
                  aria-label={copyText("Settings sections", "Sections des réglages")}
                  className="mb-6 flex flex-wrap items-center gap-2 border-b pb-3 text-sm"
                >
                  <Button variant="ghost" size="sm" onClick={() => go("settings")}>
                    {copyText("Settings", "Réglages")}
                  </Button>
                  <span className="text-muted-foreground">/</span>
                  {nav
                    .filter(
                      item =>
                        ["gateway", "catalog", "snapshot"].includes(item.id) && (item.id !== "gateway" || snapshotMode),
                    )
                    .map(item => (
                      <Button
                        key={item.id}
                        variant={page === item.id ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => {
                          if (item.id === "catalog") setCatalogFocus(null);
                          go(item.id);
                        }}
                      >
                        {item.label[language]}
                      </Button>
                    ))}
                </nav>
              )}
              {page === "gateway" &&
                (snapshotMode ? (
                  <GatewayInventory onModels={() => go("models")} />
                ) : (
                  <Card className="max-w-2xl p-6">
                    <CardTitle>{copyText("Existing gateway", "Gateway existant")}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {copyText(
                        "Gateway inventory is available from a captured Bifrost snapshot.",
                        "L’inventaire du gateway est disponible depuis un instantané Bifrost capturé.",
                      )}
                    </p>
                  </Card>
                ))}
              {page === "models" && (
                <>
                  <div className="mb-4">
                    {/* The scope switch sits on the title row: the description under it changes length with the scope
                        and must not move the control the person just clicked. */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                        {copyText("My models", "Mes modèles")}
                      </h1>
                      <div className="flex flex-wrap items-center gap-2">
                        <ToggleGroup
                          type="single"
                          variant="outline"
                          className="bg-card"
                          value={modelScope}
                          onValueChange={value => value && setModelScope(value as typeof modelScope)}
                          aria-label={copyText("Model scope", "Portée des modèles")}
                        >
                          <ToggleGroupItem value="registry">{scopeLabels.registry}</ToggleGroupItem>
                          <ToggleGroupItem value="to-add">{scopeLabels.toAdd}</ToggleGroupItem>
                        </ToggleGroup>
                        {modelScope === "registry" && (
                          <Button onClick={() => setModelScope("to-add")}>
                            <Plus className="size-4" />
                            {copyText("Register a model", "Enregistrer un modèle")}
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 max-w-prose text-sm text-foreground/70">
                      {modelScope === "registry" ? (
                        copyText(
                          "Model cards saved in Registry, with their provider accesses.",
                          "Fiches modèles enregistrées dans Registry, avec leurs accès fournisseurs.",
                        )
                      ) : (
                        <>
                          {copyText(
                            "Models discovered in Bifrost and not saved yet. Open one to register it.",
                            "Modèles découverts dans Bifrost et pas encore enregistrés. Ouvrez-en un pour l’enregistrer.",
                          )}{" "}
                          {/* A 24 px target (WCAG 2.5.8); the negative margin keeps the line height. */}
                          <Button
                            variant="link"
                            size="sm"
                            className="-my-0.5 h-auto min-h-6 p-0 align-baseline"
                            onClick={() => openModel(newModel(), true)}
                          >
                            {copyText("Advanced: enter an access manually", "Avancé : saisir un accès manuellement")}
                          </Button>
                        </>
                      )}
                    </p>
                  </div>
                  {catalog.length ? (
                    <ReferenceCatalogBrowser
                      folded={!effectiveExpert}
                      scope={modelScope}
                      models={modelScope === "registry" ? data.models : toAdd}
                      allModels={catalog}
                      catalog={referenceCatalog}
                      error={referenceError}
                      onRetry={() => void loadReferenceCatalog()}
                      registeredIds={registeredIds}
                      registeredModels={data.models}
                      preferences={preferences}
                      onPreferencesChange={setPreferences}
                      onOpen={(model, tab) => {
                        const saved = data.models.find(row => row.id === model.id);
                        openModel(saved ?? model, !saved, tab);
                      }}
                      onMetadata={(target, id) => {
                        setCatalogFocus({ target, id });
                        go("catalog");
                      }}
                      onAssociate={associateModel}
                    />
                  ) : (
                    <Card className="py-0">
                      <CardContent className="space-y-3 p-6">
                        <h3 className="text-lg font-semibold">
                          {copyText("Build your model catalog", "Créez votre catalogue de modèles")}
                        </h3>
                        <p className="max-w-prose text-sm text-muted-foreground">
                          {copyText(
                            "No models have been discovered yet. Configure a provider in Bifrost to see its models here.",
                            "Aucun modèle n’a encore été découvert. Configurez un fournisseur dans Bifrost pour afficher ses modèles ici.",
                          )}
                        </p>
                        <Button variant="outline" onClick={() => openModel(newModel(), true)}>
                          {copyText("Register a model", "Enregistrer un modèle")} <ArrowRight className="size-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
              {page === "snapshot" && <SnapshotTransfer onUnauthorized={requireLogin} onApplied={() => void load()} />}
              {page === "groups" && (
                <GroupLibrary
                  expert={effectiveExpert}
                  groups={data.groups}
                  models={namedModels}
                  keys={data.keys}
                  view={viewFor("groups")}
                  onViewChange={next => setView("groups", next)}
                  onResetView={() => resetView("groups")}
                  onCreate={() => openGroup({ id: crypto.randomUUID(), name: "", description: "", members: [] })}
                  onEdit={openGroup}
                />
              )}
              {page === "catalog" && (
                <CatalogMetadata
                  key={catalogFocus ? `${catalogFocus.target}/${catalogFocus.id}` : "catalog"}
                  catalog={referenceCatalog}
                  catalogError={referenceError}
                  onCatalogChange={setReferenceCatalog}
                  onReload={loadReferenceCatalog}
                  focus={catalogFocus}
                  snapshotMode={snapshotMode}
                  onUnauthorized={requireLogin}
                  onChanged={() => void load()}
                />
              )}
              {page === "keys" && !key && (
                <KeyLibrary
                  keys={data.keys}
                  groups={data.groups}
                  models={namedModels}
                  view={viewFor("keys")}
                  onViewChange={next => setView("keys", next)}
                  onResetView={() => resetView("keys")}
                  busy={!!busy}
                  snapshotMode={snapshotMode}
                  expert={effectiveExpert}
                  onCreate={() => setKeyForm({ name: "", client: "" })}
                  onOpen={item => go("keys", item.id)}
                />
              )}
              {page === "keys" && key && activePolicy && (
                <>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border bg-card p-3">
                    <div className="min-w-0">
                      <Button type="button" variant="ghost" size="sm" className="mb-1 -ml-2" onClick={() => go("keys")}>
                        <ArrowLeft className="size-3.5" />
                        {copyText("All virtual keys", "Toutes les clés virtuelles")}
                      </Button>
                      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{key.name}</h1>
                      <p className="text-xs text-muted-foreground">
                        {/* The client names the key; its raw ID is Expert detail, not a subtitle in Basic. */}
                        {(key.client || effectiveExpert) && (
                          <>
                            <span className="wrap-anywhere">{key.client || key.id}</span> ·{" "}
                          </>
                        )}
                        {copyText(
                          key.managed === false ? "Bifrost key · not adopted yet" : "Registry-managed key",
                          key.managed === false ? "Clé Bifrost · pas encore adoptée" : "Clé gérée par Registry",
                        )}
                      </p>
                    </div>
                    {/* Read-first, like a model card: one primary action, the rare ones in "More actions". */}
                    <div className="flex flex-wrap items-center gap-2">
                      <VirtualKeySecret
                        keyId={key.id}
                        disabled={!!busy || snapshotMode}
                        onUnauthorized={requireLogin}
                      />
                      {key.managed !== false && (
                        <>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!!busy}
                                aria-label={copyText("More actions", "Plus d’actions")}
                              >
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setRenameForm({ id: key.id, name: key.name })}>
                                {copyText("Rename", "Renommer")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onSelect={() => {
                                  void commit(
                                    {
                                      ...data,
                                      keys: data.keys.map(item =>
                                        item.id === key.id ? { ...item, active: !item.active } : item,
                                      ),
                                    },
                                    key.active
                                      ? copyText("Disabling key…", "Désactivation de la clé…")
                                      : copyText("Enabling key…", "Activation de la clé…"),
                                    [key.id],
                                  );
                                }}
                              >
                                {key.active ? copyText("Disable", "Désactiver") : copyText("Enable", "Activer")}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={isDirty}
                                onSelect={() => setAdoption({ keyId: key.id, operation: "rebind" })}
                              >
                                {copyText("Re-link the Bifrost key", "Relier à nouveau la clé Bifrost")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {keyEditing ? (
                            <Button
                              variant="outline"
                              disabled={!!busy}
                              onClick={() =>
                                isDirty
                                  ? setConfirm({
                                      title: copyText("Discard key draft?", "Abandonner le brouillon de clé ?"),
                                      text: copyText(
                                        "Unpublished key selections will be lost.",
                                        "Les sélections non publiées seront abandonnées.",
                                      ),
                                      confirmLabel: copyText("Discard changes", "Abandonner les modifications"),
                                      cancelLabel: copyText("Keep editing", "Continuer à modifier"),
                                      action: () => {
                                        setDraft(copy(key.policy));
                                        setEditingKey(null);
                                      },
                                    })
                                  : setEditingKey(null)
                              }
                            >
                              {isDirty ? copyText("Cancel", "Annuler") : copyText("Close editor", "Fermer l’éditeur")}
                            </Button>
                          ) : (
                            <Button disabled={!!busy} onClick={() => setEditingKey(key.id)}>
                              {copyText("Edit selection", "Modifier la sélection")}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {(snapshotMode || (key.managed !== false && isDirty)) && (
                    <div className="mb-4 space-y-2 rounded-sm border bg-muted/30 p-3 text-sm">
                      {snapshotMode && (
                        <p>
                          {copyText(
                            "The secret was excluded from this capture. You can prepare a selection in the local copy; this does not change Pulsar or verify live access.",
                            "Le secret est exclu de cette capture. Vous pouvez préparer une sélection dans la copie locale ; cela ne modifie pas Pulsar et ne vérifie pas les accès en direct.",
                          )}
                        </p>
                      )}
                      {key.managed !== false && isDirty && (
                        <p className="text-muted-foreground">
                          {copyText(
                            "Publish or discard this draft before re-linking the Bifrost key.",
                            "Publiez ou abandonnez ce brouillon avant de relier à nouveau la clé Bifrost.",
                          )}
                        </p>
                      )}
                    </div>
                  )}
                  {/* An unmanaged key starts with adoption: nothing can be composed or published before it. */}
                  {key.managed === false ? (
                    <section className="space-y-3 rounded-sm border bg-card p-4">
                      <h2 className="text-base font-semibold">
                        {copyText("Adopt this key first", "Adoptez d’abord cette clé")}
                      </h2>
                      <p className="max-w-[52ch] text-sm text-muted-foreground">
                        {copyText(
                          "Adopting compares what Bifrost allows today with a Registry selection, and you confirm it before composing groups and models for this key. Registry cannot grant more access than Bifrost allows.",
                          "Adopter compare ce que Bifrost autorise aujourd’hui avec une sélection Registry ; vous la confirmez avant de composer les groupes et modèles de cette clé. Registry ne peut pas étendre les droits accordés par Bifrost.",
                        )}
                      </p>
                      <div>
                        <p className="text-sm font-medium">
                          {copyText("Bifrost allows today", "Bifrost autorise aujourd’hui")} ·{" "}
                          {permissionSummary(key.permissions, copyText)}
                        </p>
                        <KeyPermissions permissions={key.permissions} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={readinessVariant[readinessState(key)]}>
                          {readinessLabel(readinessState(key), copyText)}
                        </Badge>
                        {readinessReason(key.readiness, copyText) && (
                          <span className="text-xs text-chart-warning-ink">
                            {readinessReason(key.readiness, copyText)}
                          </span>
                        )}
                      </div>
                      {readinessState(key) === "empty" ? (
                        <p className="text-sm font-medium">
                          {copyText(
                            "Add models to this key in Bifrost first",
                            "Ajoutez d’abord des modèles à cette clé dans Bifrost",
                          )}
                        </p>
                      ) : (
                        <Button
                          type="button"
                          disabled={!!busy}
                          onClick={() => setAdoption({ keyId: key.id, operation: "adopt" })}
                        >
                          {snapshotMode
                            ? copyText("Prepare local selection", "Préparer la sélection locale")
                            : copyText("Adopt this key", "Adopter cette clé")}
                        </Button>
                      )}
                    </section>
                  ) : (
                    <>
                      {!key.active && (
                        <p className="mb-4 rounded-sm border border-chart-warning/50 bg-chart-warning/10 p-3 text-sm text-chart-warning-ink">
                          {copyText(
                            "This key is disabled. Its saved model selection is shown for review.",
                            "Cette clé est désactivée. Sa sélection enregistrée reste visible pour vérification.",
                          )}
                        </p>
                      )}
                      {keyEditing ? (
                        <KeyComposer
                          virtualKey={key}
                          draft={activePolicy}
                          onDraftChange={setDraft}
                          models={namedModels}
                          groups={data.groups}
                          preferences={preferences}
                          busy={!!busy}
                          snapshotMode={snapshotMode}
                          expert={effectiveExpert}
                          publishDisabled={reconcileBlocked || (!isDirty && !needsReconcile) || !!busy}
                          onPublish={() => void publishKey()}
                          onDiscard={() => setDraft(copy(key.policy))}
                          onReread={() => void reread()}
                        />
                      ) : (
                        <KeySummary
                          virtualKey={key}
                          models={namedModels}
                          groups={data.groups}
                          busy={!!busy}
                          snapshotMode={snapshotMode}
                          onReread={() => void reread()}
                        />
                      )}
                    </>
                  )}
                </>
              )}
              {page === "settings" && (
                <RegistrySettings
                  expert={effectiveExpert}
                  onStartTour={startTour}
                  preferences={preferences}
                  onPreferencesChange={setPreferences}
                  snapshotMode={snapshotMode}
                  onNavigate={destination => {
                    if (destination === "catalog") setCatalogFocus(null);
                    go(destination);
                  }}
                  onUnauthorized={requireLogin}
                  catalog={referenceCatalog}
                  catalogError={referenceError}
                  providers={catalog.flatMap(model => model.accesses.map(access => access.provider))}
                  modelScopes={`${scopeLabels.registry} · ${scopeLabels.toAdd}`}
                />
              )}
            </main>
          </div>
        </NavigationShell>
        <HelpSheet
          open={helpOpen}
          onOpenChange={setHelpOpen}
          canStart={!isDirty}
          onStart={startTour}
          expert={effectiveExpert}
        />
        {tourRun > 0 && (
          <Tour
            key={tourRun}
            page={page}
            pageId={pageId}
            go={(target, id) => go(target as Page, id)}
            onClose={() => setTourRun(0)}
          />
        )}
        <Sheet
          open={!!modelDraft}
          onOpenChange={open => {
            if (!open) closeModel();
          }}
        >
          {modelDraft && (
            <ModelEditor
              initialTab={modelTab}
              expert={effectiveExpert}
              snapshotMode={snapshotMode}
              saved={data.models}
              draft={modelDraft}
              onOverridesChange={setModelOverrides}
              onChange={setModelDraft}
              creating={creatingModel}
              workspace={catalog}
              catalog={referenceCatalog}
              catalogError={referenceError}
              pricingProofs={pricingProofs}
              error={modelError}
              busy={!!busy}
              onSave={updateModel}
              onCancel={closeModel}
              onDelete={deleteModel}
              onDiscardEdits={discardModelEdits}
              actionSlot={
                snapshotMode ? undefined : (
                  <AssistantSuggestion
                    draft={modelDraft}
                    onChange={setModelDraft}
                    onOpenSettings={() =>
                      setConfirm({
                        title: copyText("Open AI settings?", "Ouvrir les réglages IA ?"),
                        text: copyText(
                          "This closes the model editor and discards its unsaved changes.",
                          "Les modifications non enregistrées de la fiche seront abandonnées.",
                        ),
                        confirmLabel: copyText("Open settings", "Ouvrir les réglages"),
                        cancelLabel: copyText("Keep editing", "Continuer à modifier"),
                        action: () => {
                          setModelDraft(null);
                          go("settings");
                        },
                      })
                    }
                  />
                )
              }
            />
          )}
        </Sheet>
        <Sheet
          open={!!groupDraft}
          onOpenChange={open => {
            if (!open) closeGroup();
          }}
        >
          <SheetContent
            inert={!!busy}
            className={`overflow-hidden p-4 sm:p-6 ${effectiveExpert ? "sm:w-[calc(100vw-1rem)] sm:max-w-6xl" : ""}`}
          >
            <SheetHeader className="border-b bg-muted/40 pb-4">
              <SheetTitle className="text-xl">
                {copyText(
                  groupDraft && data.groups.some(group => group.id === groupDraft.id) ? "Edit group" : "Create group",
                  groupDraft && data.groups.some(group => group.id === groupDraft.id)
                    ? "Modifier le groupe"
                    : "Créer un groupe",
                )}
              </SheetTitle>
              <SheetDescription>
                {snapshotMode
                  ? copyText(
                      "Choose the registered models in this shared selection. Review the key impact before saving locally.",
                      "Choisissez les modèles enregistrés de cette sélection partagée. Vérifiez l’impact sur les clés avant l’enregistrement local.",
                    )
                  : copyText(
                      "Choose the registered models in this shared selection. Review the key impact before publishing.",
                      "Choisissez les modèles enregistrés de cette sélection partagée. Vérifiez l’impact sur les clés avant la publication.",
                    )}
              </SheetDescription>
            </SheetHeader>
            {groupDraft && (
              <GroupEditor
                expert={effectiveExpert}
                group={groupDraft}
                groups={data.groups}
                models={namedModels}
                keys={data.keys}
                snapshotMode={snapshotMode}
                busy={!!busy}
                preferences={preferences}
                onChange={setGroupDraft}
                onSave={() => void publishGroup()}
                onCancel={closeGroup}
                onDelete={() => {
                  const target = groupDraft;
                  setConfirm({
                    title: copyText(`Delete ${target.name}?`, `Supprimer ${target.name} ?`),
                    text: copyText(
                      "Keys using this group will lose its shared models. Their local selections remain.",
                      "Les clés utilisant ce groupe perdront ses modèles partagés. Leurs sélections locales restent intactes.",
                    ),
                    action: () => {
                      const groups = data.groups.filter(item => item.id !== target.id);
                      const keys = data.keys.map(item => ({
                        ...item,
                        policy: { ...item.policy, groups: item.policy.groups.filter(id => id !== target.id) },
                      }));
                      const impacted = data.keys
                        .filter(item => item.managed !== false && item.policy.groups.includes(target.id))
                        .map(item => item.id);
                      void (async () => {
                        if (
                          await commit(
                            { ...data, groups, keys },
                            copyText("Deleting group…", "Suppression du groupe…"),
                            impacted,
                          )
                        )
                          setGroupDraft(null);
                      })();
                    },
                  });
                }}
              />
            )}
          </SheetContent>
        </Sheet>
        <CreatedKeySecretDialog {...createdKeySecret} copyText={copyText} />
        <KeyCreateDialog
          copyText={copyText}
          busy={busy}
          busyRef={busyRef}
          keyForm={keyForm}
          setKeyForm={setKeyForm}
          keyFormFields={keyFormFields}
          saveKey={saveKey}
        />
        <KeyRenameDialog {...keyRename} copyText={copyText} busy={busy} busyRef={busyRef} />
        <ConfirmationDialog confirm={confirm} busy={busy} copyText={copyText} onClose={() => setConfirm(null)} />
        {adoption && (
          <AdoptionDialog
            key={`${adoption.keyId}/${adoption.operation}`}
            keyId={adoption.keyId}
            operation={adoption.operation}
            onClose={() => setAdoption(null)}
            onUnauthorized={requireLogin}
            onShowToAdd={routes => {
              if (key && draft) pendingKeyDraft.current = { keyId: key.id, policy: draft };
              setAdoption(null);
              // To add, filtered on the blocking models only (the browser reads this state when it mounts).
              setSessionState(modelFiltersKey("models.to-add"), { ...emptyModelFilters, routes: routes.join("\n") });
              setModelScope("to-add");
              navigate("models");
            }}
            onApplied={receipt => {
              const stagedDraft = key?.id === receipt.keyId && draft && !same(key.policy, draft) ? draft : null;
              toast.success(
                snapshotMode
                  ? copyText(
                      "Key prepared in the local copy. Pulsar is unchanged.",
                      "Clé préparée dans la copie locale. Pulsar reste inchangé.",
                    )
                  : adoption.operation === "adopt"
                    ? copyText("Native key adopted.", "Clé native adoptée.")
                    : copyText("Key binding updated.", "Association de clé mise à jour."),
              );
              void getWorkspace()
                .then(workspace => {
                  applyWorkspace(workspace);
                  const adopted = workspace.data.keys.find(item => item.id === receipt.keyId);
                  setDraft(
                    adopted
                      ? stagedDraft
                        ? preserveAdoptionDraft(copy(adopted.policy), stagedDraft)
                        : copy(adopted.policy)
                      : stagedDraft,
                  );
                })
                .catch(error => {
                  if (error instanceof ApiError && error.status === 401) requireLogin();
                  else
                    setApiError(
                      error instanceof Error
                        ? error.message
                        : copyText(
                            "Could not refresh the key selection.",
                            "Impossible d’actualiser la sélection de la clé.",
                          ),
                    );
                });
            }}
            onNativeEdited={() =>
              void getWorkspace()
                .then(applyWorkspace)
                .catch(error => {
                  if (error instanceof ApiError && error.status === 401) requireLogin();
                })
            }
          />
        )}
        <Toaster
          closeButton
          position={isMobile ? "bottom-center" : "bottom-right"}
          offset={isMobile ? { bottom: "calc(env(safe-area-inset-bottom) + 128px)" } : undefined}
          mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 128px)" }}
          visibleToasts={isMobile ? 1 : undefined}
          richColors
        />
      </SidebarProvider>
    </TooltipProvider>
  );
}

export function App() {
  const storage = () => {
    try {
      return localStorage;
    } catch {
      return null;
    }
  };
  const [language, setLanguage] = useState<Language>(() => initialLanguage(location.search, storage()));
  const changeLanguage = (next: Language) => {
    rememberLanguage(storage(), next);
    const params = new URLSearchParams(location.search);
    params.set("lang", next);
    history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
    setLanguage(next);
  };
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <LanguageContext.Provider value={language}>
      <RegistryApp language={language} onLanguageChange={changeLanguage} />
    </LanguageContext.Provider>
  );
}

function Empty({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: typeof Search;
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-12 text-center">
      <Icon className="size-16 stroke-1 text-muted-foreground" />
      <h3 className="text-xl font-medium text-muted-foreground">{title}</h3>
      <p className="max-w-lg text-sm text-muted-foreground">{detail}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}
