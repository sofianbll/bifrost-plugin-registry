package registry

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
)

// Catalog is reference data. Only Config.Models and native Bifrost keys grant access.
type Catalog struct {
	References []CatalogReference `json:"references,omitempty"`
	Accesses   []CatalogAccess    `json:"accesses,omitempty"`
	Sources    []CatalogSource    `json:"sources,omitempty"`
}

type CatalogValue struct {
	Value     json.RawMessage `json:"value"`
	Source    string          `json:"source"`
	UpdatedAt string          `json:"updatedAt"`
	Kind      string          `json:"kind"`
}

type CatalogRecord struct {
	// Candidates retain both sources so a manual correction can be reverted without a refresh.
	Candidates map[string]map[string]json.RawMessage `json:"candidates,omitempty"`
	UpdatedAt  map[string]string                     `json:"updatedAt,omitempty"`
	Overrides  map[string]CatalogValue               `json:"overrides,omitempty"`
}

type CatalogReference struct {
	ID string `json:"id"`
	CatalogRecord
}

type CatalogAccess struct {
	ID            string `json:"id"`
	Provider      string `json:"provider"`
	Model         string `json:"model"`
	Configured    bool   `json:"configured"`
	ReferenceID   string `json:"referenceId,omitempty"`
	MappingManual bool   `json:"mappingManual,omitempty"`
	MatchConflict string `json:"matchConflict,omitempty"`
	CatalogRecord
}

type CatalogSource struct {
	ID          string `json:"id"`
	LastSuccess string `json:"lastSuccess,omitempty"`
	LastAttempt string `json:"lastAttempt,omitempty"`
	Error       string `json:"error,omitempty"`
}

var catalogFields = map[string]bool{
	"name": true, "creator": true, "family": true, "context_length": true,
	"max_input_tokens": true, "max_output_tokens": true, "input_modalities": true,
	"output_modalities": true, "input_cost_usd_per_million": true,
	"output_cost_usd_per_million": true, "cache_read_cost_usd_per_million": true,
	"cache_write_cost_usd_per_million": true, "reasoning": true, "tool_call": true,
	"structured_output": true, "temperature": true, "attachment": true,
	"parameters": true, "architecture": true, "additional_attributes": true,
	"legacy_datasheet": true,
}

func CatalogFieldAllowed(field string) bool { return catalogFields[field] }
func CatalogValueValid(field string, value json.RawMessage) bool {
	return CatalogFieldAllowed(field) && validCatalogValue(field, value)
}

func validCatalogID(id string) bool {
	return id != "" && len(id) <= 512 && strings.TrimSpace(id) == id && noControls(id)
}

func validateCatalog(c *Catalog) error {
	if c == nil {
		return nil
	}
	// The 4 MiB config cap is authoritative; these caps also bound work while compiling.
	if len(c.References) > 12000 || len(c.Accesses) > 12000 || len(c.Sources) > 2 {
		return errors.New("catalogue size limit exceeded")
	}
	refs := map[string]bool{}
	for _, r := range c.References {
		if !validCatalogID(r.ID) || refs[r.ID] {
			return fmt.Errorf("invalid or duplicate reference %q", r.ID)
		}
		refs[r.ID] = true
		if err := validateCatalogRecord(r.CatalogRecord); err != nil {
			return fmt.Errorf("reference %q: %w", r.ID, err)
		}
	}
	accesses := map[string]bool{}
	for _, a := range c.Accesses {
		if !validCatalogID(a.ID) || !validCatalogID(a.Provider) || !validCatalogID(a.Model) || a.ID != a.Provider+"/"+a.Model || accesses[a.ID] {
			return fmt.Errorf("invalid or duplicate access %q", a.ID)
		}
		accesses[a.ID] = true
		if a.ReferenceID != "" && !refs[a.ReferenceID] {
			return fmt.Errorf("access %q: unknown reference %q", a.ID, a.ReferenceID)
		}
		if err := validateCatalogRecord(a.CatalogRecord); err != nil {
			return fmt.Errorf("access %q: %w", a.ID, err)
		}
	}
	seen := map[string]bool{}
	for _, s := range c.Sources {
		if (s.ID != "bifrost" && s.ID != "models.dev") || seen[s.ID] || len(s.Error) > 500 {
			return fmt.Errorf("invalid catalogue source %q", s.ID)
		}
		seen[s.ID] = true
	}
	return nil
}

func validateCatalogRecord(r CatalogRecord) error {
	if len(r.Candidates) > len(catalogFields) || len(r.Overrides) > len(catalogFields) {
		return errors.New("too many fields")
	}
	for field, sources := range r.Candidates {
		if !CatalogFieldAllowed(field) || len(sources) > 2 {
			return fmt.Errorf("invalid field %q", field)
		}
		for source, value := range sources {
			if (source != "bifrost" && source != "models.dev") || !validCatalogValue(field, value) {
				return fmt.Errorf("invalid %s candidate for %q", source, field)
			}
		}
	}
	for source := range r.UpdatedAt {
		if source != "bifrost" && source != "models.dev" {
			return fmt.Errorf("invalid source date %q", source)
		}
	}
	for field, value := range r.Overrides {
		if !CatalogFieldAllowed(field) || value.Source != "manual" || value.Kind != "declared" || !validCatalogValue(field, value.Value) {
			return fmt.Errorf("invalid override for %q", field)
		}
	}
	return nil
}

func validCatalogValue(field string, raw json.RawMessage) bool {
	if len(raw) == 0 || len(raw) > MaxConfigBytes || (field != "legacy_datasheet" && len(raw) > 8192) || string(raw) == "null" || !json.Valid(raw) {
		return false
	}
	var value any
	if json.Unmarshal(raw, &value) != nil {
		return false
	}
	switch field {
	case "name", "creator", "family":
		s, ok := value.(string)
		return ok && len(s) <= 512 && noControls(s)
	case "context_length", "max_input_tokens", "max_output_tokens", "input_cost_usd_per_million", "output_cost_usd_per_million", "cache_read_cost_usd_per_million", "cache_write_cost_usd_per_million":
		n, ok := value.(float64)
		return ok && n >= 0 && !math.IsNaN(n) && !math.IsInf(n, 0)
	case "reasoning", "tool_call", "structured_output", "temperature", "attachment":
		_, ok := value.(bool)
		return ok
	case "input_modalities", "output_modalities":
		list, ok := value.([]any)
		if !ok || len(list) > 20 {
			return false
		}
		for _, item := range list {
			s, ok := item.(string)
			if !ok || len(s) > 80 || !noControls(s) {
				return false
			}
		}
		return true
	case "parameters":
		_, object := value.(map[string]any)
		_, array := value.([]any)
		return object || array
	case "architecture", "additional_attributes":
		_, ok := value.(map[string]any)
		return ok
	case "legacy_datasheet":
		rows, ok := value.(map[string]any)
		if !ok || len(rows) == 0 || len(rows) > 2 {
			return false
		}
		for name, row := range rows {
			if name != "pricing" && name != "parameters" {
				return false
			}
			if _, ok := row.(map[string]any); !ok {
				return false
			}
		}
		return true
	}
	return false
}

// EffectiveCatalogFields returns the chosen value and its provenance per field.
func EffectiveCatalogFields(r CatalogRecord) map[string]CatalogValue {
	out := map[string]CatalogValue{}
	for field, sources := range r.Candidates {
		if v, ok := sources["models.dev"]; ok {
			out[field] = CatalogValue{Value: v, Source: "models.dev", UpdatedAt: r.UpdatedAt["models.dev"], Kind: "declared"}
		}
		if v, ok := sources["bifrost"]; ok {
			out[field] = CatalogValue{Value: v, Source: "bifrost", UpdatedAt: r.UpdatedAt["bifrost"], Kind: "declared"}
		}
	}
	for field, v := range r.Overrides {
		out[field] = v
	}
	return out
}

func (c *Catalog) Source(id string) *CatalogSource {
	for i := range c.Sources {
		if c.Sources[i].ID == id {
			return &c.Sources[i]
		}
	}
	c.Sources = append(c.Sources, CatalogSource{ID: id})
	return &c.Sources[len(c.Sources)-1]
}

// ReplaceCatalogSource applies one valid normalized snapshot. Failed fetches do not call it.
func ReplaceCatalogSource(c *Catalog, source, at string, refs []CatalogReference, accesses []CatalogAccess) {
	byRef := map[string]int{}
	presentRefs := map[string]bool{}
	for i := range c.References {
		byRef[c.References[i].ID] = i
		removeSource(&c.References[i].CatalogRecord, source)
	}
	for _, next := range refs {
		presentRefs[next.ID] = true
		i, ok := byRef[next.ID]
		if !ok {
			i = len(c.References)
			byRef[next.ID] = i
			c.References = append(c.References, CatalogReference{ID: next.ID})
		}
		copySource(&c.References[i].CatalogRecord, next.CatalogRecord, source)
	}
	byAccess := map[string]int{}
	for i := range c.Accesses {
		byAccess[c.Accesses[i].ID] = i
		removeSource(&c.Accesses[i].CatalogRecord, source)
		if source == "bifrost" {
			c.Accesses[i].Configured = false
		}
	}
	for _, next := range accesses {
		i, ok := byAccess[next.ID]
		if !ok {
			i = len(c.Accesses)
			byAccess[next.ID] = i
			c.Accesses = append(c.Accesses, CatalogAccess{ID: next.ID, Provider: next.Provider, Model: next.Model})
		}
		a := &c.Accesses[i]
		if source == "bifrost" {
			a.Configured = next.Configured
		}
		if source == "models.dev" {
			a.MatchConflict = ""
			if next.ReferenceID != "" {
				if presentRefs[next.ReferenceID] {
					if a.ReferenceID == "" && !a.MappingManual {
						a.ReferenceID = next.ReferenceID
					} else if a.ReferenceID != next.ReferenceID {
						a.MatchConflict = "Source names a different reference: " + next.ReferenceID
					}
				}
			} else if a.ReferenceID != "" {
				a.MatchConflict = "Source has no exact reference for this access"
			}
		}
		copySource(&a.CatalogRecord, next.CatalogRecord, source)
	}
	if source == "models.dev" {
		for i := range c.Accesses {
			a := &c.Accesses[i]
			if a.ReferenceID == "" && !a.MappingManual {
				if presentRefs[a.ID] {
					a.ReferenceID = a.ID
				}
			}
		}
	}
	status := c.Source(source)
	status.LastAttempt, status.LastSuccess, status.Error = at, at, ""
	sort.Slice(c.References, func(i, j int) bool { return c.References[i].ID < c.References[j].ID })
	sort.Slice(c.Accesses, func(i, j int) bool { return c.Accesses[i].ID < c.Accesses[j].ID })
	sort.Slice(c.Sources, func(i, j int) bool { return c.Sources[i].ID < c.Sources[j].ID })
}

func removeSource(r *CatalogRecord, source string) {
	delete(r.UpdatedAt, source)
	for field, candidates := range r.Candidates {
		delete(candidates, source)
		if len(candidates) == 0 {
			delete(r.Candidates, field)
		}
	}
}

func copySource(dst *CatalogRecord, src CatalogRecord, source string) {
	if dst.Candidates == nil {
		dst.Candidates = map[string]map[string]json.RawMessage{}
	}
	if dst.UpdatedAt == nil {
		dst.UpdatedAt = map[string]string{}
	}
	dst.UpdatedAt[source] = src.UpdatedAt[source]
	for field, values := range src.Candidates {
		if v, ok := values[source]; ok {
			if dst.Candidates[field] == nil {
				dst.Candidates[field] = map[string]json.RawMessage{}
			}
			dst.Candidates[field][source] = v
		}
	}
}
