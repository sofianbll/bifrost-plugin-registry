import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ViewOptions } from "../../components/registry/ViewOptions";
import type { Demo, Model } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import type { Confirm } from "../shared/useConfirmation";
import { GroupEditor } from "./GroupEditor";
import type { useGroupEditing } from "./useGroupEditing";

export function GroupEditorSheet({
  groupDraft,
  setGroupDraft,
  closeGroup,
  publishGroup,
  data,
  copyText,
  snapshotMode,
  busy,
  effectiveExpert,
  namedModels,
  preferences,
  setConfirm,
  commit,
}: Pick<ReturnType<typeof useGroupEditing>, "groupDraft" | "setGroupDraft" | "closeGroup" | "publishGroup"> & {
  data: Demo;
  copyText: Copy;
  snapshotMode: boolean;
  busy: string;
  effectiveExpert: boolean;
  namedModels: Model[];
  preferences: ViewOptions;
  setConfirm: (confirm: Confirm) => void;
  commit: (next: Demo, label: string, verifyIds: string[]) => Promise<boolean>;
}) {
  return (
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
  );
}
