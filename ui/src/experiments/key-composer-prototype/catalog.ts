import { filterModels, type ModelFilters } from "../../domain/registry";
import type { ProtoModel } from "./state";

export type Category = "All" | "Text" | "Image" | "Video" | "Audio" | "Retrieval" | "Evaluation" | "Tools";

export function inCategory(model: ProtoModel, category: Category): boolean {
  if (category === "All") return true;
  if (category === "Retrieval") return model.tasks.some(task => /embedding|rerank|retrieval/i.test(task)) || model.outputModalities.includes("Vector");
  if (category === "Evaluation") return model.tasks.some(task => /evaluat|moderation/i.test(task));
  if (category === "Tools") return model.capabilities["Tool calling"] === "Declared" || model.tasks.some(task => /tool/i.test(task));
  return [...model.inputModalities, ...model.outputModalities].some(value => value.toLowerCase() === category.toLowerCase());
}

export function catalogResults(models: ProtoModel[], filters: ModelFilters, category: Category, status: string, selected: string[], sort: string): ProtoModel[] {
  return (filterModels(models, filters) as ProtoModel[])
    .filter(model => inCategory(model, category) && (status === "all" || (status === "configured" ? model.accesses.some(access => access.configured) : status === "unconfigured" ? model.accesses.every(access => !access.configured) : selected.includes(model.id))))
    .sort((a, b) => sort === "creator" ? a.creator.localeCompare(b.creator) || a.name.localeCompare(b.name) : sort === "accesses" ? b.accesses.length - a.accesses.length || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
}
