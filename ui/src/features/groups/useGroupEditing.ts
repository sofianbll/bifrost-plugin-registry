import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { copy, keyImpact, same, type Demo, type Group } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import type { Confirm } from "../shared/useConfirmation";

export function useGroupEditing(
  data: Demo,
  copyText: Copy,
  snapshotMode: boolean,
  busyRef: RefObject<boolean>,
  setConfirm: (confirm: Confirm) => void,
  commit: (next: Demo, label: string, verifyIds: string[]) => Promise<boolean>,
) {
  const [groupDraft, setGroupDraft] = useState<Group | null>(null);
  const groupBaseline = useRef<Group | null>(null);
  const groupIsDirty = Boolean(groupDraft && groupBaseline.current && !same(groupDraft, groupBaseline.current));
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
  const publishGroup = async () => {
    if (!groupDraft?.name.trim() || (!groupDraft.members.length && !groupDraft.membersLocked)) {
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

  return { groupDraft, setGroupDraft, groupBaseline, groupIsDirty, openGroup, closeGroup, publishGroup };
}
