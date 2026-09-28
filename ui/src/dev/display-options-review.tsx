import { useState } from "react";
import { LanguageContext } from "@/lib/locale";
import { createRoot } from "react-dom/client";
import { LayoutGrid, List, Settings2, Square } from "lucide-react";
import { CatalogCard, CatalogGrid } from "@/components/registry/CatalogCard";
import { cardFormat, gridColumns } from "@/components/registry/ViewOptions";
import { BrandIcon, displayProvider } from "@/components/registry/BrandIcon";
import { ProviderSummary } from "@/components/registry/CompactCollection";
import { ModelCapabilitiesSummary, ModelModalitiesSummary } from "@/components/registry/model-capabilities";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fixture } from "@/dev/fixtures/registry";
import type { Model } from "@/domain/registry";
import "@/globals.css";

type Shape = "rectangle" | "square";
type Density = "small" | "medium" | "large";
type Layout = "grid" | "table";
const models = fixture.models;

function ModelCard({ model, shape }: { model: Model; shape: Shape }) {
  const providers = [...new Set(model.accesses.map(access => access.provider))];
  const format = shape === "square" ? "square" : "compact";
  return <CatalogCard format={format} header={<>
    <BrandIcon model={model} mode="creator" />
    <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-semibold" title={model.name}>{model.name}</h3><p className="truncate text-xs text-muted-foreground">{model.creator} · {model.family}</p></div>
  </>} footer={<><ProviderSummary ids={providers} /><span className="whitespace-nowrap text-xs text-muted-foreground">Accès · {model.accesses.length}</span></>}>
    <p className="line-clamp-2 min-h-8 text-xs leading-4 text-foreground/80" title={model.summary}>{model.summary}</p>
    <div className="min-h-7"><ModelModalitiesSummary model={model} /></div>
    <div className="min-h-7"><ModelCapabilitiesSummary model={model} /></div>
  </CatalogCard>;
}

function Review() {
  const [layout, setLayout] = useState<Layout>("grid");
  const [shape, setShape] = useState<Shape>("rectangle");
  const [density, setDensity] = useState<Density>("medium");
  return <main className="min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-[1500px] space-y-6 p-5 sm:p-8">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Référence historique · contrôles migrés dans ViewControls</p>
        <h1 className="text-2xl font-semibold tracking-tight">Options d’affichage du catalogue</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">Ces variantes ont été intégrées dans les contrôles actifs du catalogue (ModelBrowser / ReferenceCatalogBrowser). Grille et Tableau choisissent la présentation. Dans la Grille, Rectangle et Carré gardent les mêmes cartes et les mêmes informations; Petit, Moyen et Grand règlent seulement la densité.</p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-sm border bg-card p-3" aria-label="Options d’affichage proposées">
        <div className="flex flex-wrap items-center gap-4">
          <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">Vue</p><ToggleGroup type="single" value={layout} onValueChange={value => value && setLayout(value as Layout)} aria-label="Vue">
            <ToggleGroupItem value="grid" aria-label="Grille"><LayoutGrid className="size-4" /><span>Grille</span></ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Tableau"><List className="size-4" /><span>Tableau</span></ToggleGroupItem>
          </ToggleGroup></div>
          {layout === "grid" && <>
            <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">Forme des cartes</p><ToggleGroup type="single" value={shape} onValueChange={value => value && setShape(value as Shape)} aria-label="Forme des cartes">
              <ToggleGroupItem value="rectangle" aria-label="Rectangle"><LayoutGrid className="size-4" /><span>Rectangle</span></ToggleGroupItem>
              <ToggleGroupItem value="square" aria-label="Carré"><Square className="size-4" /><span>Carré</span></ToggleGroupItem>
            </ToggleGroup></div>
            <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">Densité · colonnes sur grand écran</p><ToggleGroup type="single" value={density} onValueChange={value => value && setDensity(value as Density)} aria-label="Densité de la grille">
              {(["small", "medium", "large"] as Density[]).map(value => <ToggleGroupItem key={value} value={value} aria-label={`${{ small: "Petit", medium: "Moyen", large: "Grand" }[value]} · ${{ small: 4, medium: 3, large: 2 }[value]} colonnes`}><span>{{ small: "Petit", medium: "Moyen", large: "Grand" }[value]}</span><span className="text-xs text-muted-foreground">{{ small: 4, medium: 3, large: 2 }[value]}</span></ToggleGroupItem>)}
            </ToggleGroup></div>
          </>}
        </div>
        <Popover><PopoverTrigger asChild><Button variant="outline" size="sm"><Settings2 className="size-4" />Options proposées</Button></PopoverTrigger><PopoverContent align="end" className="w-72 space-y-3">
          <h2 className="font-semibold">Répartition de la grille</h2><p className="text-sm text-muted-foreground">Petit · 4 colonnes<br />Moyen · 3 colonnes<br />Grand · 2 colonnes</p><p className="border-t pt-3 text-xs text-muted-foreground">Le nombre de colonnes s’adapte à la largeur disponible. Rectangle et Carré utilisent la même densité.</p>
        </PopoverContent></Popover>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{layout === "table" ? "Vue Tableau" : `Vue Grille · ${shape === "square" ? "Carré" : "Rectangle"} · ${{ small: "Petit", medium: "Moyen", large: "Grand" }[density]}`}</h2><p className="text-xs text-muted-foreground">8 modèles de démonstration</p></div>
      {layout === "grid" ? <CatalogGrid format={cardFormat({ layout: "grid", shape })} columns={gridColumns(density)}>{models.map(model => <ModelCard key={model.id} model={model} shape={shape} />)}</CatalogGrid> : <div className="rounded-sm border bg-card"><Table><TableHeader><TableRow><TableHead>Modèle</TableHead><TableHead>Créateur</TableHead><TableHead>Fournisseurs</TableHead><TableHead>Modalités</TableHead><TableHead>Capacités</TableHead><TableHead>Accès</TableHead></TableRow></TableHeader><TableBody>{models.map(model => <TableRow key={model.id}><TableCell className="font-medium">{model.name}</TableCell><TableCell>{model.creator}</TableCell><TableCell><ProviderSummary ids={model.accesses.map(access => access.provider)} /></TableCell><TableCell><ModelModalitiesSummary model={model} /></TableCell><TableCell><ModelCapabilitiesSummary model={model} /></TableCell><TableCell>{model.accesses.length}</TableCell></TableRow>)}</TableBody></Table></div>}
      <p className="text-xs text-muted-foreground">Données fictives de la galerie. Les cartes réutilisent CatalogCard et BrandIcon. Aucune donnée réelle ni préférence n’est modifiée.</p>
      <nav aria-label="Références de conception" className="flex flex-wrap gap-3 border-t pt-4 text-xs text-muted-foreground"><a className="underline underline-offset-4 hover:text-foreground" href="https://vercel.com/ai-gateway/models/providers" target="_blank" rel="noreferrer">Catalogue Vercel AI Gateway</a><a className="underline underline-offset-4 hover:text-foreground" href="https://vercel.com/geist/grid" target="_blank" rel="noreferrer">Geist · grille</a><a className="underline underline-offset-4 hover:text-foreground" href="https://carbondesignsystem.com/components/content-switcher/usage/" target="_blank" rel="noreferrer">Carbon · sélecteur de vue</a></nav>
    </div>
  </main>;
}

createRoot(document.getElementById("root")!).render(<LanguageContext.Provider value="fr"><Review /></LanguageContext.Provider>);
