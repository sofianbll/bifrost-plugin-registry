// Archived first React prototype and the original embedded HTML fallback.
// Everything shown here uses synthetic, in-memory data.
import { useEffect, useRef } from "react";
import type { GalleryEntry } from "./types";
import { App as FirstModelCard } from "./history/7df5fc3/App";
import fallbackHtml from "../../../../internal/admin/web/index.html?raw";
import fallbackCss from "../../../../internal/admin/web/app.css?raw";
import fallbackJs from "../../../../internal/admin/web/app.js?raw";
import demoConfig from "../../../../configs/registry.demo.json";

function FirstPrototype({ step }: { step: number }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { root.current?.querySelectorAll<HTMLButtonElement>('nav[aria-label="Étapes du prototype"] button')[step]?.click(); }, [step]);
  return <div ref={root} className="overflow-hidden rounded-sm border"><FirstModelCard /></div>;
}

// The archive script is embedded unchanged. The preceding script denies every
// fetch, and sandbox="allow-scripts" gives the document an opaque origin.
const denyFetch = `window.fetch = async () => new Response(JSON.stringify({error:'Aucun backend dans cette galerie (HTTP 403).'}), {status:403, headers:{'Content-Type':'application/json'}});`;
const fixture = JSON.stringify(demoConfig).replace(/</g, "\\u003c");
function fallbackDocument(tab: "models" | "groups" | "keys" | "settings" | "deploy") {
  const bootstrap = `config=${fixture};revision='demo-local';tab=${JSON.stringify(tab)};document.querySelector('#login').hidden=true;document.querySelector('#workspace').hidden=false;markSaved();rerender();`;
  return fallbackHtml
    .replace('<link rel="stylesheet" href="/app.css">', `<style>${fallbackCss}</style>`)
    .replace('<script src="/app.js" defer></script>', '')
    .replace('</body>', `<script>${denyFetch}</script><script>${fallbackJs}</script><script>${bootstrap}</script></body>`);
}
function Fallback({ tab }: { tab: "models" | "groups" | "keys" | "settings" | "deploy" }) {
  return <iframe title={`Fallback HTML · ${tab}`} srcDoc={fallbackDocument(tab)} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-[760px] w-full rounded-sm border bg-white" />;
}

const firstSource = "ui/src/model-card-prototype/App.tsx @ 7df5fc3";
const fallbackSource = "internal/admin/web/index.html + app.css + app.js";
function entry(id: string, title: string, family: string, source: string, description: string, Component: GalleryEntry["Component"], version: string): GalleryEntry {
  return { id, title, family, level: "Templates et pages", origin: "Registry · archive locale", version, source, description, Component };
}
export const earlyEntries: GalleryEntry[] = [
  entry("early-model-card-identify", "Première fiche modèle · identifier", "Propriétés et sources", firstSource, "Premier prototype React : identité commune et deux accès fournisseurs. Sources archivées au commit 7df5fc3 ; interactions locales.", () => <FirstPrototype step={0} />, "Premier prototype · commit 7df5fc3"),
  entry("early-model-card-edit", "Première fiche modèle · ajuster", "Propriétés et sources", firstSource, "Corrections communes et par fournisseur dans le prototype original.", () => <FirstPrototype step={1} />, "Premier prototype · commit 7df5fc3"),
  entry("early-model-card-review", "Première fiche modèle · relire", "Propriétés et sources", firstSource, "Impact et valeurs effectives avant simulation locale.", () => <FirstPrototype step={2} />, "Premier prototype · commit 7df5fc3"),
  ...(["models", "groups", "keys", "settings", "deploy"] as const).map(tab => entry(`early-fallback-${tab}`, `Fallback HTML · ${{ models: "modèles", groups: "groupes", keys: "clés virtuelles", settings: "réglages", deploy: "déploiement" }[tab]}`, { models: "Cartes", groups: "Groupes", keys: "Clés virtuelles", settings: "Parcours complets", deploy: "Parcours complets" }[tab], fallbackSource, "Interface HTML/JS d’origine dans un cadre isolé, avec configuration de démonstration. Toute requête réseau reçoit HTTP 403.", () => <Fallback tab={tab} />, "Fallback HTML embarqué · v0.1")),
];
