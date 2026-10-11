package admin

import (
	"sort"
	"strings"
	"time"

	"bifrost-registry/internal/registry"
)

// What stops a native key from being adopted, and what can be done about it.
const (
	blockUndiscovered = "undiscovered" // Bifrost does not list the model: nothing in Registry can add it
	blockUnsaved      = "unsaved"      // discovered but no Registry card holds it: the models page can add it
	blockAllProviders = "all-providers"
	blockDynamic      = "dynamic" // the provider row allows "*" or a regex: keep it in Bifrost, or replace it by the models Registry holds
	blockOther        = "other"   // any other adoption reason, with the reason text as sent
	// A consequence of the other blockers when every route is blocked, not a reason of its own.
	noRepresentableAccess = "Native key has no representable configured model access"
)

// Kept marks a blocker of a provider the adopter keeps in Bifrost: still reported, but it blocks nothing.
type adoptionBlocker struct {
	Provider, Kind, Model, Reason string
	Kept                          bool
}

func otherBlocker(reason string) adoptionBlocker {
	return adoptionBlocker{Kind: blockOther, Reason: reason}
}

// readinessBlocker groups the blockers of one provider and kind (provider "" = the key as a whole).
// Count is len(Models) for model blockers and len(Reasons) otherwise. Reasons are the adoption
// reasons as sent, kept for every kind except undiscovered and unsaved, whose models say it all.
type readinessBlocker struct {
	Provider string   `json:"provider"`
	Kind     string   `json:"kind"`
	Count    int      `json:"count"`
	Models   []string `json:"models"`
	Reasons  []string `json:"reasons,omitempty"`
	// The provider is kept in Bifrost (adoption option b): Registry leaves its permissions alone.
	Kept bool `json:"kept,omitempty"`
}

// adoptionReadiness is the verdict shown on key cards and in the adoption dialog: ready, blocked (with
// blockers in the order the key lists its providers) or empty (the key allows nothing yet).
// Kept blockers do not make the key blocked. Later actions (remove models) extend blockers or add fields next to them.
type adoptionReadiness struct {
	State    string             `json:"state"`
	Blockers []readinessBlocker `json:"blockers"`
}

// nativeKeyBlockers are the key-level reasons visible without reading the key's secret.
func nativeKeyBlockers(vk nativeVK) []adoptionBlocker {
	out := []adoptionBlocker{}
	if vk.IsActive != nil && !*vk.IsActive || vk.ExpiresAt != nil && !vk.ExpiresAt.After(time.Now()) {
		out = append(out, otherBlocker("Native key is inactive or expired"))
	}
	if vk.IsAccessProfileManaged {
		out = append(out, otherBlocker("Native key is controlled by an external access profile"))
	}
	return out
}

func adoptionReadinessOf(vk nativeVK, blockers []adoptionBlocker) *adoptionReadiness {
	if !vk.AllowAllProviders && len(vk.ProviderConfigs) == 0 {
		return &adoptionReadiness{State: "empty", Blockers: []readinessBlocker{}}
	}
	out := &adoptionReadiness{State: "ready", Blockers: []readinessBlocker{}}
	index := map[[2]string]int{}
	for _, b := range blockers {
		if b.Reason == noRepresentableAccess && hasBlocking(blockers, noRepresentableAccess) {
			continue
		}
		if !b.Kept {
			out.State = "blocked"
		}
		i, ok := index[[2]string{b.Provider, b.Kind}]
		if !ok {
			i = len(out.Blockers)
			index[[2]string{b.Provider, b.Kind}] = i
			out.Blockers = append(out.Blockers, readinessBlocker{Provider: b.Provider, Kind: b.Kind, Models: []string{}, Kept: b.Kept})
		}
		g := &out.Blockers[i]
		if b.Model != "" {
			g.Models = append(g.Models, b.Model)
		}
		if b.Kind == blockUndiscovered || b.Kind == blockUnsaved {
			g.Count = len(g.Models)
		} else {
			g.Reasons = append(g.Reasons, b.Reason)
			g.Count = len(g.Reasons)
		}
	}
	return out
}

// hasBlocking reports whether a blocker other than `except` (a reason) stops the key: kept ones do not.
func hasBlocking(blockers []adoptionBlocker, except string) bool {
	for _, b := range blockers {
		if !b.Kept && b.Reason != except {
			return true
		}
	}
	return false
}

// adoptionSelection maps a native key's permissions onto saved Registry accesses and lists what stops it.
// A route needing a direct access is "undiscovered" when Bifrost does not list it, "unsaved" when it is
// discovered but no card holds it, and "other" when a card exists but cannot serve it. The providers in
// keep stay native: their routes are never selected and their blockers are flagged Kept.
func adoptionSelection(cfg registry.Config, vk nativeVK, rows []nativeModel, keep []string) ([]string, []string, []adoptionBlocker) {
	blocked := []adoptionBlocker{}
	if vk.AllowAllProviders {
		blocked = append(blocked, adoptionBlocker{Kind: blockAllProviders, Reason: "allow_all_providers grants future providers and cannot be represented safely"})
	}
	discovered := map[string]nativeModel{}
	for _, row := range rows {
		key := row.Provider + "/" + row.Name
		if _, duplicate := discovered[key]; duplicate {
			blocked = append(blocked, otherBlocker("Duplicate native model discovery for "+key))
		}
		discovered[key] = row
	}
	models := map[string]registry.Model{}
	for _, model := range cfg.Models {
		models[model.Provider+"/"+model.Alias] = model
	}
	selected := []string{}
	routes := []string{}
	seenProvider := map[string]bool{}
	seenRoute := map[string]bool{}
	viaAlias := map[string]string{} // alias -> the route that already selects it
	for _, pc := range vk.ProviderConfigs {
		providerBlocker := func(reason string) adoptionBlocker {
			return adoptionBlocker{Provider: pc.Provider, Kind: blockOther, Reason: reason}
		}
		if pc.Provider == "" || seenProvider[pc.Provider] {
			blocked = append(blocked, otherBlocker("Native provider configuration is missing or duplicated"))
			continue
		}
		seenProvider[pc.Provider] = true
		if len(pc.AllowedModels) == 0 {
			blocked = append(blocked, providerBlocker("Empty native allowed_models has version-dependent meaning for "+pc.Provider))
			continue
		}
		keyIDs := pc.keyIDs()
		if len(keyIDs) == 0 {
			blocked = append(blocked, providerBlocker("Empty native provider key list has version-dependent meaning for "+pc.Provider))
			continue
		}
		for _, name := range pc.BlacklistedModels {
			if name == "*" || strings.HasPrefix(name, "regex:") {
				blocked = append(blocked, providerBlocker("Dynamic native blacklist is unsupported for "+pc.Provider))
			}
		}
		for _, name := range pc.AllowedModels {
			if name == "" || name == "*" || strings.HasPrefix(name, "regex:") {
				blocked = append(blocked, adoptionBlocker{Provider: pc.Provider, Kind: blockDynamic, Reason: "Dynamic native model allowlist is unsupported for " + pc.Provider})
				continue
			}
			if registry.Has(pc.BlacklistedModels, name) {
				continue
			}
			route := pc.Provider + "/" + name
			modelBlocker := func(kind, reason string) adoptionBlocker {
				return adoptionBlocker{Provider: pc.Provider, Kind: kind, Model: name, Reason: reason}
			}
			if seenRoute[route] {
				blocked = append(blocked, modelBlocker(blockOther, "Duplicate native model route "+route))
				continue
			}
			seenRoute[route] = true
			m, saved := models[route]
			row, found := discovered[route]
			if !saved || !m.Enabled || (!m.Verified && !m.Configured) || m.Passthrough || m.Alias != m.UpstreamModel {
				kind := blockOther
				if !found {
					kind = blockUndiscovered
				} else if !saved {
					kind = blockUnsaved
				}
				blocked = append(blocked, modelBlocker(kind, "Native route "+route+" needs a configured direct Registry access with the same native name"))
				continue
			}
			if !found {
				blocked = append(blocked, modelBlocker(blockUndiscovered, "Native route "+route+" is absent from provider discovery"))
				continue
			}
			usable := false
			for _, id := range row.AccessibleByKeys {
				if registry.Has(m.ProviderKeyIDs, id) && (pc.AllowAllKeys || registry.Has(keyIDs, id)) {
					usable = true
					break
				}
			}
			if !usable {
				blocked = append(blocked, modelBlocker(blockOther, "No enabled native provider key for "+route))
				continue
			}
			if !registry.Has(keep, pc.Provider) {
				// A policy holds one access per alias: two would be refused at save (access_selection missing).
				if first, twice := viaAlias[m.Alias]; twice {
					blocked = append(blocked, modelBlocker(blockOther, "Model "+m.Alias+" is allowed through "+first+" and "+route+": Registry adopts one access per model"))
					continue
				}
				viaAlias[m.Alias] = route
				selected = append(selected, m.ID)
				routes = append(routes, route)
			}
		}
	}
	for i := range blocked {
		blocked[i].Kept = blocked[i].Provider != "" && registry.Has(keep, blocked[i].Provider)
	}
	if len(selected) == 0 {
		blocked = append(blocked, otherBlocker(noRepresentableAccess))
	}
	sort.Strings(selected)
	sort.Strings(routes)
	return selected, routes, blocked
}
