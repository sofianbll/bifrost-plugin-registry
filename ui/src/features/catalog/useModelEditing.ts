import { useRef, useState, type RefObject } from "react";
import { toast } from "sonner";
import { copy, members, same, type Demo, type Model } from "../../domain/registry";
import type { Copy } from "../../lib/locale";
import type { Confirm } from "../shared/useConfirmation";
import { associateReference } from "./AssociateReference";
import type { Catalog } from "./catalog-api";
import type { CatalogOverride } from "./model-card-fields";
import { firstRegistrationIssue, omitUnchangedReferenceIds } from "./model-editor-data";
import { cardName } from "./reference-groups";

export function useModelEditing(
  data: Demo,
  copyText: Copy,
  busyRef: RefObject<boolean>,
  getCatalog: () => Model[],
  getReferenceCatalog: () => Catalog | null,
  setConfirm: (confirm: Confirm) => void,
  commit: (next: Demo, label: string, verifyIds?: string[], overrides?: CatalogOverride[]) => Promise<boolean>,
) {
  const [modelDraft, setModelDraft] = useState<Model | null>(null);
  const modelBaseline = useRef<Model | null>(null);
  const [modelOverrides, setModelOverrides] = useState<CatalogOverride[]>([]);
  const [creatingModel, setCreatingModel] = useState(false);
  const [modelTab, setModelTab] = useState<"access">();
  const [modelError, setModelError] = useState("");
  const modelIsDirty = Boolean(
    modelDraft && modelBaseline.current && (!same(modelDraft, modelBaseline.current) || modelOverrides.length > 0),
  );
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
    const saved = omitUnchangedReferenceIds(copy(modelDraft), getCatalog());
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
        `Delete ${cardName(model, getReferenceCatalog())}?`,
        `Supprimer ${cardName(model, getReferenceCatalog())} ?`,
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

  return {
    modelDraft,
    setModelDraft,
    modelBaseline,
    setCreatingModel,
    setModelOverrides,
    creatingModel,
    modelTab,
    modelError,
    setModelError,
    modelIsDirty,
    newModel,
    openModel,
    closeModel,
    discardModelEdits,
    updateModel,
    associateModel,
    deleteModel,
  };
}
