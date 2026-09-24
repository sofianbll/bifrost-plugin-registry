package registry

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

type Alias struct {
	ModelID     string `json:"model_id"`
	ModelName   string `json:"model_name,omitempty"`
	ModelFamily string `json:"model_family,omitempty"`
}
type KeyPlan struct {
	Provider string           `json:"provider"`
	KeyID    string           `json:"key_id"`
	Aliases  map[string]Alias `json:"aliases"`
}
type PolicyPlan struct {
	VirtualKeyID   string              `json:"virtual_key_id"`
	AllowedModels  map[string][]string `json:"allowed_models_by_provider"`
	ProviderKeyIDs map[string][]string `json:"provider_key_ids_by_provider"`
}
type NativePlan struct {
	Revision     string       `json:"registry_revision"`
	ProviderKeys []KeyPlan    `json:"provider_keys"`
	VirtualKeys  []PolicyPlan `json:"virtual_keys"`
	Warnings     []string     `json:"warnings"`
}

func (s *Snapshot) Plan() NativePlan {
	p := NativePlan{Revision: s.Revision(), ProviderKeys: []KeyPlan{}, VirtualKeys: []PolicyPlan{}, Warnings: []string{
		"Review this plan before merging. It is not a full Bifrost config or an HTTP PUT body.",
		"Install aliases on existing provider keys, then configure native virtual-key allowlists. Budgets, limits, routing, secrets and pricing remain native.",
		"model_family changes native provider routing semantics; it is not just a display label. Verify it for each custom provider.",
	}}
	byKey := map[string]*KeyPlan{}
	for _, m := range s.config.Models {
		if !m.Enabled || (!m.Verified && !m.Configured) {
			continue
		}
		for _, id := range m.ProviderKeyIDs {
			key := m.Provider + "/" + id
			entry := byKey[key]
			if entry == nil {
				entry = &KeyPlan{m.Provider, id, map[string]Alias{}}
				byKey[key] = entry
			}
			entry.Aliases[m.Alias] = Alias{m.UpstreamModel, m.CanonicalModel, m.ModelFamily}
		}
	}
	for _, v := range byKey {
		p.ProviderKeys = append(p.ProviderKeys, *v)
	}
	sort.Slice(p.ProviderKeys, func(i, j int) bool {
		a, b := p.ProviderKeys[i], p.ProviderKeys[j]
		return a.Provider+"/"+a.KeyID < b.Provider+"/"+b.KeyID
	})
	modelMap := map[string]Model{}
	for _, m := range s.config.Models {
		modelMap[m.ID] = m
	}
	for _, v := range s.views {
		pp := PolicyPlan{v.Policy.VirtualKeyID, map[string][]string{}, map[string][]string{}}
		for _, r := range v.Routes {
			if !Has(pp.AllowedModels[r.Provider], r.Alias) {
				pp.AllowedModels[r.Provider] = append(pp.AllowedModels[r.Provider], r.Alias)
			}
			for _, id := range modelMap[r.RegistryID].ProviderKeyIDs {
				if !Has(pp.ProviderKeyIDs[r.Provider], id) {
					pp.ProviderKeyIDs[r.Provider] = append(pp.ProviderKeyIDs[r.Provider], id)
				}
			}
		}
		for key := range pp.AllowedModels {
			sort.Strings(pp.AllowedModels[key])
			sort.Strings(pp.ProviderKeyIDs[key])
		}
		p.VirtualKeys = append(p.VirtualKeys, pp)
	}
	sort.Slice(p.VirtualKeys, func(i, j int) bool { return p.VirtualKeys[i].VirtualKeyID < p.VirtualKeys[j].VirtualKeyID })
	return p
}

// MergeAliases only modifies aliases on explicitly identified EXISTING keys.
// It never changes credentials, budgets, provider settings or virtual-key permissions.
// Conflicting native aliases fail closed unless the requested definition is identical.
func (s *Snapshot) MergeAliases(input []byte) ([]byte, error) {
	var root map[string]json.RawMessage
	if err := StrictJSON(input, &root, false); err != nil {
		return nil, err
	}
	var providers map[string]map[string]json.RawMessage
	if err := json.Unmarshal(root["providers"], &providers); err != nil {
		return nil, fmt.Errorf("providers must be a config.json object: %w", err)
	}
	for _, p := range s.Plan().ProviderKeys {
		provider, ok := providers[p.Provider]
		if !ok {
			return nil, fmt.Errorf("missing existing provider %s", p.Provider)
		}
		var keys []map[string]json.RawMessage
		if err := json.Unmarshal(provider["keys"], &keys); err != nil {
			return nil, err
		}
		// Bifrost native aliases are case-insensitive. Audit every key in the
		// provider, not just selected keys, so a hidden conflicting alias cannot
		// silently acquire a different upstream target when native routing changes.
		for _, key := range keys {
			var existing map[string]json.RawMessage
			if raw, exists := key["aliases"]; exists {
				if err := json.Unmarshal(raw, &existing); err != nil || existing == nil {
					return nil, fmt.Errorf("provider %s: invalid existing aliases", p.Provider)
				}
			}
			for name, desired := range p.Aliases {
				for oldName, raw := range existing {
					if !strings.EqualFold(name, oldName) {
						continue
					}
					if name != oldName {
						return nil, fmt.Errorf("native alias case collision %s/%s vs %s; normalize manually", p.Provider, name, oldName)
					}
					old, err := decodeAlias(raw)
					if err != nil || old != desired {
						return nil, fmt.Errorf("conflicting native alias %s/%s on an existing provider key; review manually", p.Provider, name)
					}
				}
			}
		}
		count := 0
		for _, key := range keys {
			var id string
			_ = json.Unmarshal(key["id"], &id)
			if id != p.KeyID {
				continue
			}
			count++
			aliases := map[string]json.RawMessage{}
			if raw, ok := key["aliases"]; ok {
				if err := json.Unmarshal(raw, &aliases); err != nil || aliases == nil {
					return nil, fmt.Errorf("key %s: invalid aliases object", id)
				}
			}
			for name, a := range p.Aliases {
				if old, exists := aliases[name]; exists {
					var oldAlias Alias
					var shorthand string
					if json.Unmarshal(old, &shorthand) == nil {
						oldAlias = Alias{ModelID: shorthand}
					} else {
						if err := StrictJSON(old, &oldAlias, true); err != nil {
							return nil, fmt.Errorf("alias %s already has richer fields; review manually", name)
						}
					}
					if oldAlias != a {
						return nil, fmt.Errorf("refusing to overwrite native alias %s/%s", p.Provider, name)
					}
				}
				aliases[name], _ = json.Marshal(a)
			}
			key["aliases"], _ = json.Marshal(aliases)
		}
		if count != 1 {
			return nil, fmt.Errorf("provider %s must contain exactly one key with id %s (found %d)", p.Provider, p.KeyID, count)
		}
		provider["keys"], _ = json.Marshal(keys)
	}
	root["providers"], _ = json.Marshal(providers)
	return json.MarshalIndent(root, "", "  ")
}

func decodeAlias(raw json.RawMessage) (Alias, error) {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return Alias{ModelID: text}, nil
	}
	var a Alias
	err := StrictJSON(raw, &a, true)
	return a, err
}
