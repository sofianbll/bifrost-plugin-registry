import { renderToStaticMarkup } from "react-dom/server";
import { LanguageContext } from "@/lib/locale";
import { ModelCapabilitiesPanel, ModelCapabilitiesSummary, ModelCapabilityLegend, ModelModalitiesPanel, ModelModalitiesSummary } from "./model-capabilities";

const model = { inputModalities: ["Text", "Image", "Audio"], outputModalities: [], capabilities: { Vision: "Unknown" as const, Reasoning: "Unknown" as const } };
const render = (node: React.ReactNode) => renderToStaticMarkup(<LanguageContext.Provider value="fr">{node}</LanguageContext.Provider>);
const unknownSummary = render(<ModelCapabilitiesSummary model={model} />);
if (!/\+2/.test(unknownSummary) || /\?2/.test(unknownSummary) || !/Non renseigné/.test(unknownSummary)) throw new Error("additional unknown entries not counted as +N");
if (/donnée fictive/i.test(render(<ModelCapabilitiesPanel model={model} />))) throw new Error("fixture claimed by default");
const mixed = render(<ModelCapabilitiesSummary model={{ ...model, capabilities: { Reasoning: "Declared", Vision: "Declared", Tools: "Declared", "Tool calling": "Declared", Streaming: "Declared", Chat: "Unknown" } }} />);
if (!/\+2/.test(mixed) || /\?1/.test(mixed)) throw new Error("additional entries, including unknowns, not counted as +N");
if (!/aria-label="[^"]*Raisonnement/.test(mixed) || !/aria-label="[^"]*Outils/.test(mixed)) throw new Error("icon-only trigger has no accessible names");
if (/>Raisonnement<|>Outils</.test(mixed)) throw new Error("capability labels visible in icon-only summary");
const modalities = render(<ModelModalitiesSummary model={model} />);
if (!/\+1/.test(modalities)) throw new Error("modality overflow hidden");
if (!/aria-label="Entrée : Texte, Image, Audio; Sortie : inconnue/.test(modalities) || />Texte<|>Image<|>Audio</.test(modalities)) throw new Error("modality icons lack full accessible names or show duplicate text");
const modalityPanel = render(<ModelModalitiesPanel model={{ ...model, outputModalities: ["Video", "Image"] }} />);
for (const item of ["Entrées", "Sorties", "Texte", "Image", "Audio", "Vidéo"]) if (!modalityPanel.includes(item)) throw new Error(`actual modality missing: ${item}`);
if (/Fonctionnalités|Raisonnement|Vision|data-capability=|Source et portée/.test(modalityPanel)) throw new Error("modality details include capability inventory");
if ((modalityPanel.match(/<li /g) ?? []).length !== 5) throw new Error("modality details include unlisted entries");
const panel = render(<ModelCapabilitiesPanel model={model} />);
if (!/Non renseigné/.test(panel)) throw new Error("empty output hidden");
if (!/data-capability-state="Unknown"/.test(panel)) throw new Error("unknown state hidden");
if (/Non pris en charge/.test(panel)) throw new Error("unknown misrepresented");
const states = render(<ModelCapabilitiesSummary model={{ ...model, capabilities: { Reasoning: "Declared", Vision: "Observed in simulated campaign", Chat: "Unknown" } }} />);
if (!/Raisonnement \([^)]*Déclaré/.test(states) || !/Vision \([^)]*simulation/.test(states) || !/Conversation \([^)]*Non renseigné/.test(states)) throw new Error("summary omitted a truthful capability state");

const empty = { inputModalities: [], outputModalities: [], capabilities: {} };
const fullUnknown = renderToStaticMarkup(<LanguageContext.Provider value="en"><ModelCapabilitiesPanel model={empty} /></LanguageContext.Provider>);
const listed = ['Text', 'Image', 'Video', 'Speech', 'Transcription', 'Realtime', 'Embed', 'Rerank', 'Evaluation', 'Vision (Image)', 'File Input', 'Reasoning', 'Structured Output', 'Tool', 'Tool Use', 'Web Search', 'Websockets', 'Explicit Caching', 'Implicit Caching'];
for (const item of listed) if (!fullUnknown.includes(item)) throw new Error(`approved inventory missing ${item}`);
if (/Image Gen|Video Gen/.test(fullUnknown)) throw new Error('generation suffix restored in English labels');
if ((fullUnknown.match(/data-capability-state="Unknown"/g) ?? []).length !== 19) throw new Error('unknown inventory states missing');
const extended = render(<ModelCapabilitiesPanel model={{ inputModalities: ['Text', 'Audio'], outputModalities: ['Video'], capabilities: { Chat: 'Declared', Streaming: 'Observed in simulated campaign', Reasoning: 'Unknown' } }} />);
for (const item of ['Texte', 'Audio', 'Vidéo', 'Conversation', 'Diffusion']) if (!extended.includes(item)) throw new Error(`actual fact lost: ${item}`);
if (!extended.includes('Déclaré') || !extended.includes('Observé en simulation') || !extended.includes('Non renseigné')) throw new Error('actual fact states not shown');
const mapped = render(<ModelCapabilitiesPanel model={{ inputModalities: ['Image'], outputModalities: ['Image'], capabilities: { 'Tool calling': 'Declared', 'Structured output': 'Observed in simulated campaign' } }} />);
if (/Gén\. image|Gén\. vidéo/.test(mapped)) throw new Error('generation suffix restored in French labels');
for (const [key, state] of [['Vision', 'Declared'], ['Image generation', 'Declared'], ['Tool calling', 'Declared'], ['Structured output', 'Observed in simulated campaign'], ['Speech', 'Unknown']]) {
  if (!mapped.includes(`data-capability="${key}" data-capability-state="${state}"`)) throw new Error(`incorrect fact mapping: ${key}`);
}
if (/[○◆]/.test(mapped + mixed)) throw new Error('rejected state markers restored');
const panelWithContext = render(<ModelCapabilitiesPanel model={model} context={{ source: 'catalogue' }} />);
if (!panelWithContext.includes('Source et portée')) throw new Error('source and scope disclosure missing');
// The legend shows the glyph a card uses for each state: the capability icon when known, "?" when not specified.
const legend = render(<ModelCapabilityLegend />);
if ((legend.match(/<svg/g) ?? []).length !== 2 || !/>\?</.test(legend) || /[○◆]/.test(legend)) throw new Error('legend does not show the glyphs it explains');
console.log('Capability summaries, full inventory, facts and state semantics: passed');
