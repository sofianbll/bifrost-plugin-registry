import { useState } from 'react';
import { ComposerModelResults } from './history/c73a82c/cards';
import { AccessDetailDialog } from './history/c73a82c/shared';
import { emptyDraft, fixtureModels, fixtureGroups, resolveDraft, toggleAccess, toggleModel, type ProtoModel, type ProtoAccess } from './history/c73a82c/state';
import { defaultViewOptions } from '@/components/registry/ViewOptions';
import type { GalleryEntry } from './types';
import mockup from '../../../../docs/design/mockup/index.html?raw';
import hermes from '../../../../docs/design/mockup/hermes-prototype.html?raw';
import properties from '../../../../docs/design/model-card-properties/index.html?raw';
import diagram from '../../../../docs/design/diagrams/model-cards/index.html?raw';
import fallbackHtml from '../../../../internal/admin/web/index.html?raw';
import fallbackCss from '../../../../internal/admin/web/app.css?raw';

function SnapshotCards({size='small',table=false}:{size?:'small'|'medium'|'large';table?:boolean}) {
 const [draft,setDraft]=useState(()=>({...emptyDraft(),groups:['code']}));
 const [detail,setDetail]=useState<{model:ProtoModel;access:ProtoAccess}|null>(null);
 const resolved=new Map(resolveDraft(draft,fixtureGroups,fixtureModels).map(item=>[item.model.id,item]));
 return <><ComposerModelResults filtered={fixtureModels.slice(0,3)} view={{...defaultViewOptions,size,layout:table?'table':'grid'}} groupBy="none" draft={draft} groups={fixtureGroups} resolved={resolved} callbacks={{onToggleModel:model=>setDraft(value=>toggleModel(value,model,fixtureGroups)),onToggleAccess:access=>setDraft(value=>toggleAccess(value,access)),onShowDetail:(model,access)=>setDetail({model,access})}}/><AccessDetailDialog model={detail?.model??null} access={detail?.access??null} onClose={()=>setDetail(null)}/></>;
}
function ArchiveFrame({html,title}:{html:string;title:string}) { return <iframe title={title} srcDoc={html} sandbox="allow-scripts" className="h-[700px] w-full rounded-sm border"/>; }
const fallback = fallbackHtml.replace(/<link rel="stylesheet" href="\/app.css">/,`<style>${fallbackCss}</style>`).replace(/<script src="\/app.js" defer><\/script>/,'');
const historyEntry=(id:string,title:string,family:string,version:string,source:string,Component:GalleryEntry['Component'],description:string):GalleryEntry=>({id,title,family,level:'Templates et pages',origin:'Registry · archive locale',version,source,Component,description});
export const historyEntries:GalleryEntry[]=[
 ...(['small','medium','large'] as const).map(size=>historyEntry(`history-cards-${size}`,`Cartes de sélection · taille ${size}`,'Cartes','Prototype Kimi · commit c73a82c · 27 septembre','ui/src/key-composer-prototype/cards.tsx @ c73a82c',()=> <SnapshotCards size={size}/>,"Version enregistrée avant les modifications locales : cartes, capacités en infobulles et choix d’accès. Seuls les imports ont été adaptés pour l’archivage.")),
 historyEntry('history-table','Tableau de sélection · Kimi','Tableaux','Prototype Kimi · commit c73a82c · 27 septembre','ui/src/key-composer-prototype/cards.tsx @ c73a82c',()=> <SnapshotCards table/>,"Tableau historique interactif, avec les composants et l’état de ce commit."),
 historyEntry('history-mockup','Maquette HTML · catalogue, groupes et clés','Parcours complets','Maquette HTML antérieure','docs/design/mockup/index.html',()=> <ArchiveFrame html={mockup} title="Maquette HTML historique"/>,"Archive originale interactive dans un cadre isolé. Styles Tailwind et polices chargés depuis les CDN déclarés dans l’original."),
 historyEntry('history-hermes','Composition Hermes · héritage et publication','Clés virtuelles','Prototype HTML antérieur','docs/design/mockup/hermes-prototype.html',()=> <ArchiveFrame html={hermes} title="Prototype Hermes historique"/>,"Prototype original autonome, sans requête fournisseur. Sélection, héritage et aperçu conservés."),
 historyEntry('history-properties','Propriétés des model cards · exploration','Propriétés et sources','Exploration HTML antérieure','docs/design/model-card-properties/index.html',()=> <ArchiveFrame html={properties} title="Exploration des propriétés"/>,"Visualisation originale conservée dans son cadre isolé."),
 historyEntry('history-diagram','Composition des model cards · diagramme','Parcours complets','Exploration HTML antérieure','docs/design/diagrams/model-cards/index.html',()=> <ArchiveFrame html={diagram} title="Diagramme des model cards"/>,"Diagramme historique de composition ; ce document est une référence, pas un composant React."),
 historyEntry('history-fallback','Fallback HTML · écran de connexion','Parcours complets','Interface HTML embarquée','internal/admin/web/index.html + app.css',()=> <ArchiveFrame html={fallback} title="Connexion du fallback HTML"/>,"HTML et styles d’origine. Script réseau désactivé dans cet aperçu : le formulaire de connexion ne contacte aucune instance."),
];
