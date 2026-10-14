import { useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { Plus, Search } from "lucide-react";
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
  exposed,
  members,
  same,
  unsavedModels,
  type Demo,
  type Key,
  type Model,
  type Policy,
  type PricingProof,
} from "../domain/registry";
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
import { useModelEditing } from "../features/catalog/useModelEditing";
import { ModelEditorSheet } from "../features/catalog/ModelEditorSheet";
import type { CatalogOverride } from "../features/catalog/model-card-fields";
import RegistrySettings from "../features/settings/RegistrySettings";
import { useViewPreferences } from "../features/settings/useViewPreferences";
import { useConfirmation } from "../features/shared/useConfirmation";
import { ConfirmationDialog } from "../features/shared/ConfirmationDialog";
import { KeyDetailPage } from "../features/keys/KeyDetailPage";
import { CreatedKeySecretDialog } from "../features/keys/CreatedKeySecretDialog";
import { useCreatedKeySecret } from "../features/keys/useCreatedKeySecret";
import { KeyRenameDialog } from "../features/keys/KeyRenameDialog";
import { useKeyRename } from "../features/keys/useKeyRename";
import { KeyCreateDialog } from "../features/keys/KeyCreateDialog";
import { useKeyCreation } from "../features/keys/useKeyCreation";
import CatalogMetadata from "../features/catalog/CatalogMetadata";
import SnapshotTransfer from "../features/snapshot/SnapshotTransfer";
import { KeyAdoptionDialog } from "../features/keys/KeyAdoptionDialog";
import { ModelLibraryPage } from "../features/catalog/ModelLibraryPage";
import { useReferenceCatalog } from "../features/catalog/useReferenceCatalog";
import { cardName, groupReferenceModels } from "../features/catalog/reference-groups";
import { clearSessionState } from "../lib/session-state";
import { ViewControls } from "../components/registry/ViewOptions";
import { LanguageContext, initialLanguage, rememberLanguage, useCopy, useFormat, type Language } from "../lib/locale";

import { checkFailed, keyLedger, verifiedToast } from "../features/keys/KeySummary";
import KeyLibrary from "../features/keys/KeyLibrary";
import { displayProvider, setMarkLabels, setProviderBaseTypes } from "../components/registry/BrandIcon";
import { GroupLibrary } from "../features/groups/GroupLibrary";
import { GroupEditorSheet } from "../features/groups/GroupEditorSheet";
import { useGroupEditing } from "../features/groups/useGroupEditing";
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
  const modelEditing = useModelEditing(
    data,
    copyText,
    busyRef,
    () => catalog,
    () => referenceCatalog,
    confirmation => setConfirm(confirmation),
    (next, label, verifyIds, overrides) => commit(next, label, verifyIds, overrides),
  );
  const {
    setModelDraft,
    modelBaseline,
    setModelError,
    setCreatingModel,
    modelIsDirty,
    newModel,
    openModel,
    associateModel,
  } = modelEditing;
  const groupEditing = useGroupEditing(
    data,
    copyText,
    snapshotMode,
    busyRef,
    confirmation => setConfirm(confirmation),
    (next, label, verifyIds) => commit(next, label, verifyIds),
  );
  const { groupDraft, setGroupDraft, groupBaseline, groupIsDirty, openGroup, closeGroup } = groupEditing;
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
                <ModelLibraryPage
                  copyText={copyText}
                  modelScope={modelScope}
                  setModelScope={setModelScope}
                  scopeLabels={scopeLabels}
                  effectiveExpert={effectiveExpert}
                  registeredModels={data.models}
                  toAdd={toAdd}
                  catalog={catalog}
                  referenceCatalog={referenceCatalog}
                  referenceError={referenceError}
                  loadReferenceCatalog={loadReferenceCatalog}
                  registeredIds={registeredIds}
                  preferences={preferences}
                  setPreferences={setPreferences}
                  openModel={openModel}
                  newModel={newModel}
                  setCatalogFocus={setCatalogFocus}
                  go={go}
                  associateModel={associateModel}
                />
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
                <KeyDetailPage
                  currentKey={key}
                  activePolicy={activePolicy}
                  data={data}
                  namedModels={namedModels}
                  preferences={preferences}
                  busy={busy}
                  snapshotMode={snapshotMode}
                  effectiveExpert={effectiveExpert}
                  isDirty={isDirty}
                  keyEditing={keyEditing}
                  reconcileBlocked={reconcileBlocked}
                  needsReconcile={needsReconcile}
                  copyText={copyText}
                  go={go}
                  requireLogin={requireLogin}
                  setRenameForm={setRenameForm}
                  commit={commit}
                  setAdoption={setAdoption}
                  setConfirm={setConfirm}
                  setDraft={setDraft}
                  setEditingKey={setEditingKey}
                  publishKey={publishKey}
                  reread={reread}
                />
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
        <ModelEditorSheet
          modelDraft={modelEditing.modelDraft}
          setModelDraft={modelEditing.setModelDraft}
          modelTab={modelEditing.modelTab}
          setModelOverrides={modelEditing.setModelOverrides}
          creatingModel={modelEditing.creatingModel}
          modelError={modelEditing.modelError}
          closeModel={modelEditing.closeModel}
          updateModel={modelEditing.updateModel}
          deleteModel={modelEditing.deleteModel}
          discardModelEdits={modelEditing.discardModelEdits}
          data={data}
          copyText={copyText}
          snapshotMode={snapshotMode}
          busy={busy}
          effectiveExpert={effectiveExpert}
          catalog={catalog}
          referenceCatalog={referenceCatalog}
          referenceError={referenceError}
          pricingProofs={pricingProofs}
          setConfirm={setConfirm}
          go={go}
        />
        <GroupEditorSheet
          groupDraft={groupDraft}
          setGroupDraft={setGroupDraft}
          closeGroup={closeGroup}
          publishGroup={groupEditing.publishGroup}
          data={data}
          copyText={copyText}
          snapshotMode={snapshotMode}
          busy={busy}
          effectiveExpert={effectiveExpert}
          namedModels={namedModels}
          preferences={preferences}
          setConfirm={setConfirm}
          commit={commit}
        />
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
          <KeyAdoptionDialog
            adoption={adoption}
            setAdoption={setAdoption}
            currentKey={key}
            draft={draft}
            pendingKeyDraft={pendingKeyDraft}
            setModelScope={setModelScope}
            navigate={navigate}
            snapshotMode={snapshotMode}
            copyText={copyText}
            applyWorkspace={applyWorkspace}
            setDraft={setDraft}
            requireLogin={requireLogin}
            setApiError={setApiError}
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
