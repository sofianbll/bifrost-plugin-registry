import { exposed, members, origin, toggleModel, type Group, type Model, type Policy } from "../../domain/registry";

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

export function keyComposition(policy: Policy, groups: Group[], models: Model[]) {
  const selected = members(policy, groups);
  const inherited = new Set(policy.groups.flatMap(id => groups.find(group => group.id === id)?.members || []));
  return {
    selected,
    excluded: policy.excluded,
    inherited: selected.filter(id => inherited.has(id)),
    direct: policy.added.filter(id => !inherited.has(id)),
    ids: exposed(policy, groups, models),
  };
}

export function preserveAdoptionDraft(adopted: Policy, draft: Policy): Policy {
  return {
    ...adopted,
    groups: [...new Set([...adopted.groups, ...draft.groups])],
    added: [...new Set([...adopted.added, ...draft.added])],
    excluded: [...new Set([...adopted.excluded, ...draft.excluded])],
    naming: draft.naming,
  };
}
