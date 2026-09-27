package admin

import (
	"context"
	"encoding/json"
	"math"
	"net/url"
	"sort"
	"strings"
	"time"

	"bifrost-registry/internal/registry"
)

// nativePricingOverride mirrors the Bifrost /api/governance/pricing-overrides item.
type nativePricingOverride struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	ScopeKind string         `json:"scope_kind"`
	Provider  string         `json:"provider_id"`
	KeyID     string         `json:"provider_key_id"`
	MatchType string         `json:"match_type"`
	Pattern   string         `json:"pattern"`
	Patch     map[string]any `json:"patch"`
}

type pricingOverride struct {
	Name       string
	Provider   string
	KeyID      string
	Pattern    string
	InputCost  *float64
	OutputCost *float64
}

// applyPricingOverrides idempotently syncs manual price corrections to Bifrost
// pricing overrides. It runs under the live mutex held by putWorkspace.
func (s *Server) applyPricingOverrides(ctx context.Context, snap *registry.Snapshot) {
	cfg := snap.Config()
	if cfg.Catalog == nil {
		return
	}

	plan := snap.Plan()
	keyPlansByProvider := map[string][]registry.KeyPlan{}
	for _, kp := range plan.ProviderKeys {
		keyPlansByProvider[kp.Provider] = append(keyPlansByProvider[kp.Provider], kp)
	}

	expected := map[string]pricingOverride{}
	for _, m := range cfg.Models {
		if !m.Enabled || !m.Configured {
			continue
		}
		fields := catalogFieldsForAccess(cfg.Catalog, m.Provider, m.UpstreamModel)
		in, hasIn := overridePrice(fields, "input_cost_usd_per_million")
		out, hasOut := overridePrice(fields, "output_cost_usd_per_million")
		if !hasIn && !hasOut {
			continue
		}
		if len(m.ProviderKeyIDs) == 0 {
			s.setPricingProof(m.Provider, "", m.UpstreamModel, "No provider key in plan for pricing override")
			continue
		}
		for _, kp := range keyPlansByProvider[m.Provider] {
			if !hasKeyID(kp.KeyID, m.ProviderKeyIDs) {
				continue
			}
			po := pricingOverride{
				Name:     pricingOverrideName(m.Provider, kp.KeyID, m.UpstreamModel),
				Provider: m.Provider,
				KeyID:    kp.KeyID,
				Pattern:  m.UpstreamModel,
			}
			if hasIn {
				v := in / 1e6
				po.InputCost = &v
			}
			if hasOut {
				v := out / 1e6
				po.OutputCost = &v
			}
			expected[po.Name] = po
		}
	}

	providers := map[string]bool{}
	for _, po := range expected {
		providers[po.Provider] = true
	}
	for _, m := range cfg.Models {
		if m.Enabled && m.Configured {
			providers[m.Provider] = true
		}
	}

	for provider := range providers {
		existing, err := s.listPricingOverrides(ctx, provider)
		if err != nil {
			s.setPricingProof(provider, "", "", "Failed to list pricing overrides: "+err.Error())
			continue
		}
		existingByName := map[string]nativePricingOverride{}
		for _, o := range existing {
			if strings.HasPrefix(o.Name, "registry/") {
				existingByName[o.Name] = o
			}
		}

		for name, po := range expected {
			if po.Provider != provider {
				continue
			}
			body := map[string]any{
				"name":            name,
				"scope_kind":      "provider_key",
				"provider_id":     po.Provider,
				"provider_key_id": po.KeyID,
				"match_type":      "exact",
				"pattern":         po.Pattern,
				"patch":           pricingPatch(po),
			}
			existingPO, ok := existingByName[name]
			var writeErr error
			if ok {
				writeErr = s.live.client.call(ctx, "PUT", "/api/governance/pricing-overrides/"+url.PathEscape(existingPO.ID), body, nil)
			} else {
				writeErr = s.live.client.call(ctx, "POST", "/api/governance/pricing-overrides", body, nil)
			}
			if writeErr != nil {
				s.setPricingProof(po.Provider, po.KeyID, po.Pattern, "Failed to write pricing override: "+writeErr.Error())
				continue
			}

			after, readErr := s.listPricingOverrides(ctx, po.Provider)
			if readErr != nil {
				s.setPricingProof(po.Provider, po.KeyID, po.Pattern, "Failed to read back pricing override: "+readErr.Error())
				continue
			}
			var found *nativePricingOverride
			for i := range after {
				if after[i].Name == name {
					found = &after[i]
					break
				}
			}
			if found == nil {
				s.setPricingProof(po.Provider, po.KeyID, po.Pattern, "Pricing override missing after write")
				continue
			}
			if !pricingPatchMatches(po, found.Patch) {
				s.setPricingProof(po.Provider, po.KeyID, po.Pattern, "Pricing override read-back mismatch")
				continue
			}
			s.clearPricingProof(po.Provider, po.KeyID, po.Pattern)
		}

		for name, o := range existingByName {
			if _, ok := expected[name]; ok {
				continue
			}
			if err := s.live.client.call(ctx, "DELETE", "/api/governance/pricing-overrides/"+url.PathEscape(o.ID), nil, nil); err != nil {
				s.setPricingProof(o.Provider, o.KeyID, o.Pattern, "Failed to delete stale pricing override: "+err.Error())
			}
		}
	}
}

func pricingOverrideName(provider, keyID, model string) string {
	return "registry/" + provider + "/" + keyID + "/" + model
}

func pricingPatch(po pricingOverride) map[string]any {
	patch := map[string]any{}
	if po.InputCost != nil {
		patch["input_cost_per_token"] = *po.InputCost
	}
	if po.OutputCost != nil {
		patch["output_cost_per_token"] = *po.OutputCost
	}
	return patch
}

func pricingPatchMatches(po pricingOverride, patch map[string]any) bool {
	want := pricingPatch(po)
	for k, v := range want {
		got, ok := patch[k]
		if !ok {
			return false
		}
		gf, ok := toFloat64(got)
		if !ok {
			return false
		}
		wf, ok := toFloat64(v)
		if !ok {
			return false
		}
		if math.Abs(gf-wf) > 1e-12 {
			return false
		}
	}
	return true
}

func toFloat64(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	}
	return 0, false
}

func overridePrice(fields map[string]registry.CatalogValue, field string) (float64, bool) {
	v, ok := fields[field]
	if !ok || v.Source != "manual" {
		return 0, false
	}
	var f float64
	if json.Unmarshal(v.Value, &f) != nil {
		return 0, false
	}
	if f < 0 || math.IsNaN(f) || math.IsInf(f, 0) {
		return 0, false
	}
	return f, true
}

func hasKeyID(id string, ids []string) bool {
	for _, v := range ids {
		if v == id {
			return true
		}
	}
	return false
}

func (s *Server) listPricingOverrides(ctx context.Context, provider string) ([]nativePricingOverride, error) {
	var resp struct {
		PricingOverrides []nativePricingOverride `json:"pricing_overrides"`
	}
	query := url.Values{"provider_id": {provider}}
	if err := s.live.client.callQuery(ctx, "/api/governance/pricing-overrides", query, &resp); err != nil {
		return nil, err
	}
	sort.Slice(resp.PricingOverrides, func(i, j int) bool {
		return resp.PricingOverrides[i].Name < resp.PricingOverrides[j].Name
	})
	return resp.PricingOverrides, nil
}

func (s *Server) setPricingProof(provider, keyID, model, msg string) {
	name := pricingOverrideName(provider, keyID, model)
	now := time.Now().UTC().Format(time.RFC3339)
	s.live.proofs[name] = publication{State: "not_verified", Revision: "", CheckedAt: now, Error: msg}
}

func (s *Server) clearPricingProof(provider, keyID, model string) {
	delete(s.live.proofs, pricingOverrideName(provider, keyID, model))
}
