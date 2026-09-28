import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight, Moon, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardTitle } from '@/components/ui/card';
import { CatalogCard, CatalogGrid } from '@/components/registry/CatalogCard';
import { ModelCapabilitiesSummary, ModelModalitiesSummary, ModelCapabilityLegend } from '@/components/registry/model-capabilities';
import { VercelCapabilityCandidate, VercelCapabilityPopover } from '@/dev/component-gallery/VercelCapabilityCandidate';
import { fixture } from '@/dev/fixtures/registry';
import { LanguageContext } from '@/lib/locale';
import '../../globals.css';

const model = fixture.models[0];
const unknownModel = { ...model, capabilities: { Vision: 'Unknown' as const, Reasoning: 'Unknown' as const } };
const emptyModel = { ...model, inputModalities: [], outputModalities: [], capabilities: {} };
const context = { scope: 'Modèle de référence', source: 'Exemple fictif', execution: 'Non vérifiée' };

function CardExample({ format, selected = false }: { format: 'compact' | 'square'; selected?: boolean }) {
  return <CatalogGrid format={format}><CatalogCard format={format} selected={selected} header={<CardTitle className="min-w-0 truncate text-sm">{model.name}</CardTitle>} footer={<span className="text-xs text-muted-foreground">Pied de carte · exemple</span>}>
    <p className="text-xs text-muted-foreground">Zone de contenu · exemple</p>
  </CatalogCard></CatalogGrid>;
}

function App() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);
  return <LanguageContext.Provider value="fr"><div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card px-4 py-6 sm:px-6"><div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4">
      <div><p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">Registry · référence de conception</p><h1 className="text-2xl font-semibold tracking-tight">Design system validé</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Les composants et décisions retenus pour composer les prochaines pages. Les exemples utilisent des données fictives.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" asChild><a href="component-gallery.html">Comparer toutes les versions <ArrowUpRight data-icon="inline-end" /></a></Button><Button variant="outline" size="sm" onClick={() => setDark(value => !value)} aria-label={dark ? 'Passer au thème clair' : 'Passer au thème sombre'}>{dark ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}{dark ? 'Clair' : 'Sombre'}</Button></div>
    </div></header>
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <nav aria-label="Composants validés" className="flex flex-wrap gap-2 text-sm"><a className="rounded-sm border px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#cartes">01 · Structure de carte</a><a className="rounded-sm border px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#capacites">02 · Résumé des capacités</a><a className="rounded-sm border px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#panneau-capacites">03 · Panneau de capacités</a><a className="rounded-sm border px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="#modalites">04 · Modalités</a></nav>
      <section id="cartes" className="min-w-0 scroll-mt-6 rounded-sm border bg-card"><div className="space-y-2 border-b p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Structure de carte catalogue</h2><Badge variant="secondary">Structure validée</Badge></div><p className="max-w-3xl text-sm text-muted-foreground">En-tête, contenu et pied séparés ; formats grille et carré ; état sélectionné. Le logo et les autres détails internes restent à décider dans leur propre contexte. Les modalités ont leur propre validation ci-dessous.</p><code className="block break-all text-xs text-muted-foreground">ui/src/components/registry/CatalogCard.tsx · CatalogCard, CatalogGrid</code></div><div className="grid min-w-0 gap-5 p-5 sm:grid-cols-2"><div className="min-w-0 space-y-2"><h3 className="text-sm font-medium">Grille · neutre</h3><CardExample format="compact" /></div><div className="min-w-0 space-y-2"><h3 className="text-sm font-medium">Carré · sélectionné</h3><CardExample format="square" selected /></div></div></section>
      <section id="capacites" className="min-w-0 scroll-mt-6 rounded-sm border bg-card"><div className="space-y-2 border-b p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Capacités du modèle</h2><Badge variant="secondary">Résumé validé</Badge></div><p className="max-w-3xl text-sm text-muted-foreground">Le résumé par icônes seules est retenu. Le panneau complet reprend la présentation Vercel validée et reste accessible au survol, au focus et au clic. Les états inconnus restent explicites ; une observation simulée ne valide pas un fournisseur.</p><code className="block break-all text-xs text-muted-foreground">ui/src/components/registry/model-capabilities.tsx · ModelCapabilitiesSummary</code></div><div className="space-y-5 p-5"><ModelCapabilityLegend /><div className="grid min-w-0 gap-4 sm:grid-cols-3">{[{ label: 'États mixtes', value: model }, { label: 'Tout inconnu', value: unknownModel }, { label: 'Aucune donnée', value: emptyModel }].map(item => <div key={item.label} className="min-w-0 space-y-2 rounded-sm border p-3"><h3 className="text-sm font-medium">{item.label}</h3><ModelCapabilitiesSummary model={item.value} context={context} /><p className="text-xs text-muted-foreground">Survoler, cibler au clavier ou activer les icônes pour ouvrir toutes les capacités.</p></div>)}</div><a className="inline-block text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href="component-gallery.html#family=Capacit%C3%A9s%20et%20modalit%C3%A9s">Comparer les capacités dans la galerie ↗</a></div></section>
      <section id="panneau-capacites" className="min-w-0 scroll-mt-6 rounded-sm border bg-card"><div className="space-y-2 border-b p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Panneau de capacités</h2><Badge variant="secondary">Présentation validée · icône {'{}'}</Badge></div><p className="max-w-3xl text-sm text-muted-foreground">Présentation retenue d’après la référence Vercel. Le même composant partagé sert les cartes et cet exemple fictif. Toutes les lignes restent présentes ; les valeurs non renseignées sont distinguées des déclarations.</p><code className="block break-all text-xs text-muted-foreground">ui/src/components/registry/model-capabilities.tsx · ModelCapabilitiesPanel</code></div><div className="flex flex-wrap items-start gap-6 p-5"><VercelCapabilityCandidate /><div className="space-y-2"><p className="text-xs text-muted-foreground">Tester le popover au clavier</p><VercelCapabilityPopover /></div></div></section>
      <section id="modalites" className="min-w-0 scroll-mt-6 rounded-sm border bg-card"><div className="space-y-2 border-b p-5"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold">Modalités entrée → sortie</h2><Badge variant="secondary">A retenu · affichage facultatif</Badge></div><p className="max-w-3xl text-sm text-muted-foreground">Icônes des contenus reçus et produits par le modèle. Le réglage « Modalités entrée / sortie » permet de masquer ce résumé indépendamment des capacités. Son panneau affiche uniquement les entrées et sorties du modèle, après 500 ms au survol ; le focus et le clic restent immédiats.</p><code className="block break-all text-xs text-muted-foreground">ui/src/components/registry/model-capabilities.tsx · ModelModalitiesSummary</code></div><div className="p-5"><ModelModalitiesSummary model={model} /></div></section>
      <p className="text-xs text-muted-foreground">Référence de développement locale · aucune donnée réelle ni modification de production.</p>
    </main>
  </div></LanguageContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<App />);
