import { exposed, members, origin, retainedAccesses, toggleModel, type Group, type Key, type Model, type Policy } from "../../domain/registry";

export function toggleVisibleModels(policy: Policy, visible: string[], target: string[], models: Model[], groups: Group[]): Policy {
  const visibleIds = new Set(visible);
  const targetIds = new Set(target);
  return models.reduce((next, model) => {
    if (!visibleIds.has(model.id) || members(next, groups).includes(model.id) === targetIds.has(model.id)) return next;
    return toggleModel(next, model.id, groups);
  }, policy);
}

export function modelOrigin(id: string, policy: Policy, groups: Group[]) {
  const inherited = origin(id, policy, groups);
  const added = policy.added.includes(id);
  const excluded = policy.excluded.includes(id);
  return {
    inherited,
    added,
    excluded,
  };
}

export type AccessOrigin = "inherited" | "added" | "excluded";

export function accessOrigin(accessId: string, modelId: string, policy: Policy, groups: Group[]): AccessOrigin | undefined {
  const sel = policy.accessSelection?.[modelId];
  if (sel?.excluded.includes(accessId)) return "excluded";
  if (sel?.added.includes(accessId)) return "added";
  const state = modelOrigin(modelId, policy, groups);
  if (state.excluded) return undefined;
  if (state.added) return "added";
  if (state.inherited.length > 0) return "inherited";
  return undefined;
}

export function toggleAccess(policy: Policy, modelId: string, accessId: string, models: Model[], groups: Group[]): Policy {
  const next: Policy = structuredClone(policy);
  const model = models.find(m => m.id === modelId);
  if (!model || !members(next, groups).includes(modelId)) return next;
  const origin = accessOrigin(accessId, modelId, next, groups);
  const sel = next.accessSelection?.[modelId] ?? { added: [], excluded: [] };
  let added = sel.added.filter(id => id !== accessId);
  let excluded = sel.excluded.filter(id => id !== accessId);
  if (origin === "excluded") {
    // Re-include: drop the exclusion. If this brings back all accesses, the cleanup below removes the selector.
  } else {
    // Exclude this access.
    excluded = [...new Set([...excluded, accessId])];
  }
  const { known } = retainedAccesses(model, { ...next, accessSelection: { ...next.accessSelection, [modelId]: { added, excluded } } });
  if (known.length === model.accesses.length) {
    if (next.accessSelection) {
      const remaining = { ...next.accessSelection };
      delete remaining[modelId];
      next.accessSelection = Object.keys(remaining).length > 0 ? remaining : undefined;
    }
  } else {
    next.accessSelection = { ...next.accessSelection, [modelId]: { added, excluded } };
  }
  return next;
}

export type AliasStatus = "shared" | "pinned" | "mono";

export type AliasBadge = { status: AliasStatus; count: number };

export function aliasStatus(policy: Policy, groups: Group[], models: Model[]): Record<string, AliasBadge> {
  if (policy.naming === "provider/model") return {};
  const byAlias = new Map<string, { count: number; pinned: boolean }>();
  for (const id of members(policy, groups)) {
    const model = models.find(m => m.id === id);
    if (!model) continue;
    const alias = model.alias ?? model.id;
    const { known } = retainedAccesses(model, policy);
    const current = byAlias.get(alias) ?? { count: 0, pinned: false };
    current.count += known.length;
    current.pinned ||= !!policy.prefer?.[alias];
    byAlias.set(alias, current);
  }
  const status: Record<string, AliasBadge> = {};
  for (const [alias, info] of byAlias.entries()) {
    if (info.pinned) {
      status[alias] = { status: "pinned", count: info.count };
    } else if (info.count > 1) {
      status[alias] = { status: "shared", count: info.count };
    } else {
      status[alias] = { status: "mono", count: info.count };
    }
  }
  return status;
}

export function keyComposition(policy: Policy, groups: Group[], models: Model[]) {
  const selected = members(policy, groups);
  const inherited = new Set(policy.groups.flatMap(id => groups.find(group => group.id === id)?.members || []));
  const byModel = new Map<string, { retained: string[]; excluded: string[]; unknown: string[]; origins: Record<string, AccessOrigin>; total: number }>();
  for (const id of selected) {
    const model = models.find(m => m.id === id);
    if (!model) continue;
    const { known, unknown } = retainedAccesses(model, policy);
    const retained: string[] = [];
    const excluded: string[] = [];
    const origins: Record<string, AccessOrigin> = {};
    for (const access of model.accesses) {
      const origin = accessOrigin(access.id, id, policy, groups);
      if (origin === "excluded") {
        excluded.push(access.id);
      } else if (origin) {
        retained.push(access.id);
        origins[access.id] = origin;
      }
    }
    byModel.set(id, { retained: known, excluded, unknown, origins, total: model.accesses.length });
  }
  return {
    selected,
    excluded: policy.excluded,
    inherited: selected.filter(id => inherited.has(id)),
    direct: policy.added.filter(id => !inherited.has(id)),
    ids: exposed(policy, groups, models),
    aliases: aliasStatus(policy, groups, models),
    byModel,
  };
}


// What Review compares the draft with: the last verified readback, else the last published plan,
// else the models Bifrost allows today, in the key's ID format.
export function keyBaseline(key: Key, groups: Group[], models: Model[]): { source: "readback" | "plan" | "native"; ids: string[] } {
  if (key.publication?.state === "verified" && key.publication.actual) return { source: "readback", ids: key.publication.actual };
  const plan = exposed(key.policy, groups, models);
  const permissions = key.permissions;
  if (plan.length || !permissions) return { source: "plan", ids: plan };
  const ids = models.flatMap(model => {
    const allowed = model.accesses.filter(access => permissions.allProviders || permissions.providers.some(p => p.provider === access.provider && (p.allModels || p.models.includes(access.nativeModel || access.id.slice(access.provider.length + 1))))).map(access => access.id);
    if (!allowed.length) return [];
    return key.policy.naming === "model" ? [model.id] : key.policy.naming === "provider/model" ? allowed : [model.id, ...allowed];
  });
  return { source: "native", ids };
}

export function preserveAdoptionDraft(adopted: Policy, draft: Policy): Policy {
  return {
    ...adopted,
    groups: [...new Set([...adopted.groups, ...draft.groups])],
    added: [...new Set([...adopted.added, ...draft.added])],
    excluded: [...new Set([...adopted.excluded, ...draft.excluded])],
    accessSelection: mergeAccessSelection(adopted.accessSelection, draft.accessSelection),
    naming: draft.naming,
  };
}

function mergeAccessSelection(a?: Record<string, { added: string[]; excluded: string[] }>, b?: Record<string, { added: string[]; excluded: string[] }>): Record<string, { added: string[]; excluded: string[] }> | undefined {
  if (!a && !b) return undefined;
  const out: Record<string, { added: string[]; excluded: string[] }> = {};
  for (const key of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const left = a?.[key] ?? { added: [], excluded: [] };
    const right = b?.[key] ?? { added: [], excluded: [] };
    out[key] = {
      added: [...new Set([...left.added, ...right.added])],
      excluded: [...new Set([...left.excluded, ...right.excluded])],
    };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
