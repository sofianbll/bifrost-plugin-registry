import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Search, Sun, Moon, ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LanguageContext, type Language } from '@/lib/locale';
import { primitiveEntries } from './primitives';
import { latestEntries } from './latest';
import { applicationEntries } from './application';
import { capabilityEntries } from './capabilities';
import { modalityChoiceEntries } from './modality-choice';
import { accessSelectorChoiceEntries } from './access-selector-choice';
import { referenceEntries } from './references';
import { historyEntries } from './history';
import { earlyEntries } from './early';
import { previousCapabilityEntries } from './previous-capabilities';
import { installGalleryApi } from './gallery-api';
import type { GalleryEntry } from './types';
import { filterEntries } from './filter';
import '../../globals.css';

const entries = [...primitiveEntries, ...applicationEntries, ...historyEntries, ...earlyEntries, ...previousCapabilityEntries, ...latestEntries, ...capabilityEntries, ...modalityChoiceEntries, ...accessSelectorChoiceEntries, ...referenceEntries];
const levels = ['Fondations','Atomes','Molécules','Organismes','Templates et pages'];
const familyOrder = ['Fondations','Actions','Saisie et sélection','États et feedback','Identités et logos','Capacités et modalités','Cartes','Tableaux','Recherche et filtres','Navigation','Superpositions','Accès fournisseurs','Groupes','Clés virtuelles','Propriétés et sources','Assistance','Laboratoire','Import et export','Parcours complets'];
const families = [...new Set(entries.map(entry => entry.family))].sort((a,b) => familyOrder.indexOf(a)-familyOrder.indexOf(b));
const initialFamily = () => new URLSearchParams(location.hash.slice(1)).get('family') || '';
class PreviewBoundary extends Component<{children: ReactNode}, {error: string}> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <p role="alert" className="text-sm text-destructive">Aperçu indisponible : {this.state.error}</p> : this.props.children; }
}
function Gallery() {
  const [family,setFamily] = useState(initialFamily);
  const [query,setQuery] = useState('');
  const [level,setLevel] = useState('');
  const [origin,setOrigin] = useState('');
  const [language,setLanguage] = useState<Language>('fr');
  const [dark,setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [generation,setGeneration] = useState(0);
  useEffect(() => { document.documentElement.classList.toggle('dark',dark); document.documentElement.style.colorScheme = dark ? 'dark' : 'light'; },[dark]);
  const visible = useMemo(() => filterEntries(entries,family,level,origin,query),[family,level,origin,query]);
  const selectFamily = (next: string) => { setFamily(next); setQuery(''); setLevel(''); setOrigin(''); history.replaceState(null,'',next ? `#family=${encodeURIComponent(next)}` : location.pathname); };
  const isOverview = !family && !query && !level && !origin;
  const familyButtons = () => <><Button variant={!family?'secondary':'ghost'} className="justify-start" onClick={() => selectFamily('')}>Vue d’ensemble <span className="ml-auto text-xs">{entries.length}</span></Button>{families.map(name => <Button key={name} variant={family===name?'secondary':'ghost'} className="h-auto min-h-9 justify-start whitespace-normal text-left" onClick={() => selectFamily(name)}>{name}<span className="ml-auto pl-2 text-xs text-muted-foreground">{entries.filter(entry=>entry.family===name).length}</span></Button>)}</>;
  return <LanguageContext.Provider value={language}><div className="min-h-screen bg-background text-foreground">
    <header className="border-b bg-card px-4 py-5 sm:px-6"><div className="mx-auto flex max-w-[1600px] flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Bibliothèque de composants</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Toutes les versions réunies : application, prototypes successifs, primitives Bifrost/shadcn et références Vercel/Mistral.</p><p className="mt-2 text-xs text-muted-foreground">{entries.length} aperçus · {families.length} familles · données fictives · versions conservées pour comparaison</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setLanguage(language==='fr'?'en':'fr')} aria-label="Langue des composants">{language.toUpperCase()}</Button><Button variant="outline" size="sm" onClick={() => setDark(!dark)}>{dark ? <Sun data-icon="inline-start"/> : <Moon data-icon="inline-start"/>}{dark?'Clair':'Sombre'}</Button></div></div></header>
    <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6"><Button variant="outline" size="sm" asChild><a href="design-system.html">Design system validé</a></Button></div>
    <div className="mx-auto grid max-w-[1600px] min-w-0 gap-6 p-4 sm:p-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0"><details className="rounded-sm border bg-card p-3 lg:hidden"><summary className="cursor-pointer text-sm font-medium">Familles de composants{family ? ` · ${family}` : ''}</summary><nav aria-label="Familles de composants" className="mt-3 flex max-h-[45vh] flex-col gap-1 overflow-y-auto">{familyButtons()}</nav></details><nav aria-label="Familles de composants" className="hidden max-h-[calc(100vh-2rem)] flex-col gap-1 overflow-y-auto lg:sticky lg:top-4 lg:flex">{familyButtons()}</nav></aside>
      <main className="flex min-w-0 flex-col gap-5"><div className="flex flex-col gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{isOverview?'Inventaire visuel':family||'Résultats de recherche'}</h2>{!isOverview&&<Button variant="ghost" size="sm" onClick={()=>setGeneration(value=>value+1)}><RotateCcw data-icon="inline-start"/>Réinitialiser les exemples</Button>}</div><div className="flex flex-wrap items-center gap-3"><div className="relative w-full min-w-0 xl:flex-1"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"/><Input className="pl-9" aria-label="Rechercher un composant ou une version" placeholder="Composant, version, fichier source…" value={query} onChange={event=>setQuery(event.target.value)}/></div><div className="flex min-w-0 flex-1 items-center gap-2 text-xs sm:flex-none"><span id="gallery-level-label">Niveau</span><Select value={level || 'all'} onValueChange={value=>setLevel(value==='all'?'':value)}><SelectTrigger className="min-w-0 flex-1 sm:w-48" aria-labelledby="gallery-level-label"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Tous</SelectItem>{levels.map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectGroup></SelectContent></Select></div><div className="flex min-w-0 flex-1 items-center gap-2 text-xs sm:flex-none"><span id="gallery-source-label">Source</span><Select value={origin || 'all'} onValueChange={value=>setOrigin(value==='all'?'':value)}><SelectTrigger className="min-w-0 flex-1 sm:w-52" aria-labelledby="gallery-source-label"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="all">Toutes</SelectItem>{[...new Set(entries.map(entry=>entry.origin))].map(value=><SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectGroup></SelectContent></Select></div></div></div>
      {isOverview ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{families.map(name=><section key={name} className="flex min-w-0 flex-col gap-3 rounded-sm border bg-card p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{name}</h3><Badge variant="secondary">{entries.filter(entry=>entry.family===name).length}</Badge></div><ul className="flex flex-col gap-2 text-sm">{entries.filter(entry=>entry.family===name).map(entry=><li key={entry.id}><button className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={()=>{selectFamily(name);setQuery(entry.title);}}>{entry.title}</button><span className="block text-xs text-muted-foreground">{entry.version}</span></li>)}</ul><Button variant="outline" size="sm" className="mt-auto" onClick={()=>selectFamily(name)}>Comparer les versions</Button></section>)}</div> : <><p className="text-xs text-muted-foreground">{visible.length} aperçu{visible.length>1?'s':''} · les versions d’origine restent distinctes.</p>{!visible.length&&<p className="rounded-sm border p-6 text-sm">Aucun composant ne correspond à ces filtres.</p>}{visible.map(entry=><section key={entry.id} id={entry.id} className="min-w-0 overflow-hidden rounded-sm border bg-card"><header className="flex flex-col gap-2 border-b px-4 py-3"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold">{entry.title}</h3><Badge variant="outline">{entry.level}</Badge></div><div className="flex flex-wrap gap-2 text-xs"><Badge variant="secondary">{entry.version}</Badge><span className="text-muted-foreground">{entry.origin}</span></div><p className="text-sm text-muted-foreground">{entry.description}</p><code className="break-all text-[11px] text-muted-foreground">{entry.source}</code></header><div className="min-w-0 overflow-x-auto p-4" data-gallery-preview={entry.id}><PreviewBoundary key={`${entry.id}-${generation}`}><entry.Component/></PreviewBoundary></div></section>)}</>}
      </main>
    </div>
  </div></LanguageContext.Provider>;
}
installGalleryApi();
createRoot(document.getElementById('root')!).render(<Gallery/>);
