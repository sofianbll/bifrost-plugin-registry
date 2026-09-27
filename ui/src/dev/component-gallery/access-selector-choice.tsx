import { useState } from "react";
import { SearchableSelect } from "@/components/registry/SearchableSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GalleryEntry } from "./types";

const providers = [
  { id: "openai/gpt-4o", label: "OpenAI · gpt-4o" },
  { id: "anthropic/claude-3-5-sonnet", label: "Anthropic · claude-3-5-sonnet" },
  { id: "google/gemini-2.5-pro", label: "Google · gemini-2.5-pro" },
];

function Comparison() {
  const [plain, setPlain] = useState(providers[0].id);
  const [searchable, setSearchable] = useState(providers[0].id);
  const options = providers.map(({ id, label }) => ({ value: id, label }));

  return <div className="grid min-w-0 gap-6 md:grid-cols-2">
    <section className="min-w-0 space-y-3 rounded-sm border p-4">
      <h3 className="text-sm font-semibold">A · Liste fermée</h3>
      <p className="text-xs text-muted-foreground">Select shadcn/Radix · choix parmi les trois accès natifs de la fixture.</p>
      <label className="block text-sm font-medium" htmlFor="access-choice-plain">Accès fournisseur</label>
      <Select value={plain} onValueChange={setPlain}>
        <SelectTrigger id="access-choice-plain" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>{providers.map(provider => <SelectItem key={provider.id} value={provider.id}>{provider.label}</SelectItem>)}</SelectContent>
      </Select>
      <p className="break-all text-xs text-muted-foreground">Sélection : <code>{plain}</code></p>
      <p className="text-xs text-muted-foreground">Adapté à une liste courte et connue.</p>
    </section>

    <section className="min-w-0 space-y-3 rounded-sm border p-4">
      <h3 className="text-sm font-semibold">B · Recherche</h3>
      <p className="text-xs text-muted-foreground">SearchableSelect Registry · mêmes trois accès, avec recherche et valeur personnalisée actuellement autorisée.</p>
      <SearchableSelect label="Accès fournisseur" value={searchable} options={options} onChange={setSearchable} placeholder="Rechercher un accès…" />
      <p className="break-all text-xs text-muted-foreground">Valeur : <code>{searchable}</code></p>
      <p className="text-xs text-amber-700 dark:text-amber-300">Comparaison seulement : avant tout branchement sur les accès natifs, il faudrait empêcher les valeurs libres et n’accepter que les IDs proposés.</p>
    </section>
  </div>;
}

export const accessSelectorChoiceEntries: GalleryEntry[] = [{
  id: "access-selector-choice",
  title: "Accès · choisir le sélecteur",
  family: "Saisie et sélection",
  level: "Molécules",
  origin: "Registry",
  version: "À choisir",
  source: "ui/src/components/ui/select.tsx · ui/src/components/registry/SearchableSelect.tsx",
  description: "Comparaison visuelle sur les mêmes IDs synthétiques. La liste fermée est recommandée pour une courte liste d’accès natifs; SearchableSelect autorise actuellement les valeurs personnalisées.",
  Component: Comparison,
}];
