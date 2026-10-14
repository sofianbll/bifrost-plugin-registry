import { ModelCapabilitiesPanel, ModelCapabilitiesSummary, type CapabilityFacts } from '@/components/registry/model-capabilities';

// Fictional states reproduce the approved reference. Real consumers pass their own facts.
const fixture: CapabilityFacts = {
  outputModalities: ['Text'], inputModalities: ['Image'],
  capabilities: { Reasoning: 'Declared', 'Structured output': 'Declared', 'Tool calling': 'Declared', 'Implicit Caching': 'Declared' },
};
export function VercelCapabilityCandidate() {
  return <div className="w-[328px] max-w-full rounded-md border bg-popover p-3 shadow-sm"><ModelCapabilitiesPanel model={fixture} context={{ source: 'Exemple fictif', scope: 'Comparaison visuelle', execution: 'Non vérifiée' }} /></div>;
}
export function VercelCapabilityPopover() {
  return <ModelCapabilitiesSummary model={fixture} context={{ source: 'Exemple fictif', scope: 'Comparaison visuelle', execution: 'Non vérifiée' }} />;
}
