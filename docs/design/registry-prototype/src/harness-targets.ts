import { emptyModelFilters, filterModels, type Access, type Group, type Model } from "./demo";

export type TargetFilters = { search: string; creator: string; provider: string; task: string; group: string };
export type VisibleTarget = { model: Model; accesses: Access[] };
export const emptyTargetFilters: TargetFilters = { search: "", creator: "", provider: "", task: "", group: "" };

export function visibleHarnessTargets(models: Model[], groups: Group[], filters: TargetFilters): VisibleTarget[] {
  const group = groups.find(item => item.id === filters.group);
  const query = filters.search.trim().toLocaleLowerCase();
  return filterModels(models, { ...emptyModelFilters, search: filters.search, creator: filters.creator, provider: filters.provider, task: filters.task })
    .filter(model => !group || group.members.includes(model.id))
    .map(model => {
      const modelMatch = [model.name, model.id, model.creator, model.family].some(value => value.toLocaleLowerCase().includes(query));
      return { model, accesses: model.accesses.filter(access =>
        (!filters.provider || access.provider === filters.provider) &&
        (!query || modelMatch || [access.id, access.provider].some(value => value.toLocaleLowerCase().includes(query)))
      ) };
    }).filter(row => row.accesses.length);
}
