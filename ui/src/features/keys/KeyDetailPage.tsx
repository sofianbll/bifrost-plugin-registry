import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdownMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { copy, type Demo, type Key, type Model, type Policy } from "../../domain/registry";
import type { AdoptionOperation } from "../../data/api";
import type { ViewOptions } from "../../components/registry/ViewOptions";
import type { Copy } from "../../lib/locale";
import type { Page } from "../navigation/navigation";
import type { Confirm } from "../shared/useConfirmation";
import VirtualKeySecret from "./VirtualKeySecret";
import KeyComposer from "./KeyComposer";
import { KeySummary } from "./KeySummary";
import { permissionSummary } from "./KeyComposer.state";
import { KeyPermissions } from "./KeyPermissions";
import { readinessLabel, readinessReason, readinessState, readinessVariant } from "./key-readiness";

type KeyDetailPageProps = {
  currentKey: Key;
  activePolicy: Policy;
  data: Demo;
  namedModels: Model[];
  preferences: ViewOptions;
  busy: string;
  snapshotMode: boolean;
  effectiveExpert: boolean;
  isDirty: boolean;
  keyEditing: boolean;
  reconcileBlocked: boolean;
  needsReconcile: boolean;
  copyText: Copy;
  go: (page: Page, id?: string) => void;
  requireLogin: () => void;
  setRenameForm: (form: { id: string; name: string } | null) => void;
  commit: (next: Demo, label: string, verifyIds?: string[]) => Promise<boolean>;
  setAdoption: (adoption: { keyId: string; operation: AdoptionOperation } | null) => void;
  setConfirm: (confirmation: Confirm) => void;
  setDraft: (draft: Policy | null) => void;
  setEditingKey: (keyId: string | null) => void;
  publishKey: () => Promise<void>;
  reread: () => Promise<void>;
};

export function KeyDetailPage({
  currentKey: key,
  activePolicy,
  data,
  namedModels,
  preferences,
  busy,
  snapshotMode,
  effectiveExpert,
  isDirty,
  keyEditing,
  reconcileBlocked,
  needsReconcile,
  copyText,
  go,
  requireLogin,
  setRenameForm,
  commit,
  setAdoption,
  setConfirm,
  setDraft,
  setEditingKey,
  publishKey,
  reread,
}: KeyDetailPageProps) {
  return (
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
          <VirtualKeySecret keyId={key.id} disabled={!!busy || snapshotMode} onUnauthorized={requireLogin} />
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
                          keys: data.keys.map(item => (item.id === key.id ? { ...item, active: !item.active } : item)),
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
          <h2 className="text-base font-semibold">{copyText("Adopt this key first", "Adoptez d’abord cette clé")}</h2>
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
              <span className="text-xs text-chart-warning-ink">{readinessReason(key.readiness, copyText)}</span>
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
            <Button type="button" disabled={!!busy} onClick={() => setAdoption({ keyId: key.id, operation: "adopt" })}>
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
  );
}
