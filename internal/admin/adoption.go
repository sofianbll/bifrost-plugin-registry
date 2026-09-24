package admin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"bifrost-registry/internal/registry"
)

// A workspace edit may narrow an adopted policy, but cannot retarget the
// model IDs that were bound to the native permission snapshot at adoption.
func validateAdoptedWorkspaceModels(old, next registry.Config) error {
	before := map[string]registry.Model{}
	after := map[string]registry.Model{}
	for _, m := range old.Models {
		before[m.ID] = m
	}
	for _, m := range next.Models {
		after[m.ID] = m
	}
	for _, p := range old.Policies {
		if !p.Adopted {
			continue
		}
		for _, id := range p.NativeModelIDs {
			prior := before[id]
			current, ok := after[id]
			if !ok || prior.Provider != current.Provider || prior.Alias != current.Alias || prior.UpstreamModel != current.UpstreamModel || !sameSet(prior.ProviderKeyIDs, current.ProviderKeyIDs) {
				return fmt.Errorf("adopted native route %s cannot be retargeted through workspace", id)
			}
		}
	}
	return nil
}

func sameSet(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for _, v := range a {
		if !registry.Has(b, v) {
			return false
		}
	}
	return true
}

type adoptionInput struct {
	KeyID        string `json:"keyId"`
	Operation    string `json:"operation"`
	Phase        string `json:"phase"`
	PreviewToken string `json:"previewToken,omitempty"`
}

type adoptionPreview struct {
	KeyID                      string   `json:"keyId"`
	Operation                  string   `json:"operation"`
	Revision                   string   `json:"revision"`
	PreviewToken               string   `json:"previewToken,omitempty"`
	SelectedRoutes             []string `json:"selectedRoutes"`
	NativeRoutes               []string `json:"nativeRoutes"`
	Blocked                    []string `json:"blocked"`
	CanApply                   bool     `json:"canApply"`
	NativePermissionsPreserved bool     `json:"nativePermissionsPreserved"`
}

type adoptionPlan struct {
	preview        adoptionPreview
	policy         registry.Policy
	nativeEvidence []nativeModel
}

func (s *Server) adoptKey(w http.ResponseWriter, r *http.Request) {
	b, err := readJSON(w, r)
	if err != nil {
		return
	}
	var input adoptionInput
	if registry.StrictJSON(b, &input, true) != nil || input.KeyID == "" || (input.Operation != "adopt" && input.Operation != "rebind") || (input.Phase != "preview" && input.Phase != "apply") {
		reply(w, 400, map[string]string{"error": "keyId, operation (adopt or rebind), and phase (preview or apply) are required"})
		return
	}
	expected := strings.Trim(r.Header.Get("If-Match"), `"`)
	if input.Phase == "apply" {
		if expected == "" || input.PreviewToken == "" {
			reply(w, 428, map[string]string{"error": "If-Match and previewToken are required"})
			return
		}
		if s.Store.Load().Revision() != expected {
			reply(w, 409, map[string]string{"error": "Registry revision changed"})
			return
		}
	}
	plan, status, err := s.adoptionPlan(r.Context(), input)
	if err != nil {
		reply(w, status, map[string]string{"error": err.Error()})
		return
	}
	if input.Phase == "preview" {
		reply(w, 200, plan.preview)
		return
	}
	if plan.preview.Revision != expected || plan.preview.PreviewToken != input.PreviewToken {
		reply(w, 409, map[string]string{"error": "Native key or Registry preview changed; preview again"})
		return
	}
	if !plan.preview.CanApply {
		reply(w, 422, plan.preview)
		return
	}
	cfg := s.Store.Load().Config()
	if input.Operation == "adopt" {
		cfg.Policies = append(cfg.Policies, plan.policy)
	} else {
		for i := range cfg.Policies {
			if cfg.Policies[i].VirtualKeyID == input.KeyID {
				cfg.Policies[i].TokenSHA256 = plan.policy.TokenSHA256
				break
			}
		}
	}
	raw, _ := json.Marshal(cfg)
	saved, err := s.Store.Save(raw, expected)
	if err != nil {
		status := 422
		if errors.Is(err, registry.ErrConflict) {
			status = 409
		}
		reply(w, status, map[string]string{"error": err.Error()})
		return
	}
	delete(s.live.proofs, input.KeyID)
	w.Header().Set("ETag", `"`+saved.Revision()+`"`)
	reply(w, 200, map[string]any{"keyId": input.KeyID, "revision": saved.Revision(), "managed": true, "nativePermissionsPreserved": true})
}

func (s *Server) adoptionPlan(ctx context.Context, input adoptionInput) (adoptionPlan, int, error) {
	snap := s.Store.Load()
	plan := adoptionPlan{preview: adoptionPreview{
		KeyID: input.KeyID, Operation: input.Operation, Revision: snap.Revision(),
		SelectedRoutes: []string{}, NativeRoutes: []string{}, Blocked: []string{}, NativePermissionsPreserved: true,
	}}
	cfg := snap.Config()
	var existing *registry.Policy
	for i := range cfg.Policies {
		if cfg.Policies[i].VirtualKeyID == input.KeyID {
			existing = &cfg.Policies[i]
			break
		}
	}
	if input.Operation == "adopt" && existing != nil {
		return plan, 409, errors.New("key already has a Registry policy; use explicit rebind for a rotated credential")
	}
	if input.Operation == "rebind" && existing == nil {
		return plan, 404, errors.New("managed key not found")
	}
	vks, err := s.nativeKeys(ctx)
	if err != nil {
		return plan, 502, errors.New("native key list unavailable")
	}
	found := false
	for _, vk := range vks {
		if vk.ID == input.KeyID {
			found = true
			break
		}
	}
	if !found {
		return plan, 404, errors.New("native key not found")
	}
	var detail struct {
		VirtualKey nativeVK `json:"virtual_key"`
	}
	if err := s.live.client.call(ctx, "GET", "/api/governance/virtual-keys/"+url.PathEscape(input.KeyID), nil, &detail); err != nil {
		return plan, 502, errors.New("native key detail unavailable")
	}
	vk := detail.VirtualKey
	if vk.ID != input.KeyID {
		plan.preview.Blocked = append(plan.preview.Blocked, "Native key identity changed")
	}
	if vk.IsActive != nil && !*vk.IsActive || vk.ExpiresAt != nil && !vk.ExpiresAt.After(time.Now()) {
		plan.preview.Blocked = append(plan.preview.Blocked, "Native key is inactive or expired")
	}
	if vk.IsAccessProfileManaged {
		plan.preview.Blocked = append(plan.preview.Blocked, "Native key is controlled by an external access profile")
	}
	secret, err := registry.Credential(map[string]string{"x-bf-vk": vk.Value})
	if err != nil || secret != vk.Value || strings.ContainsAny(vk.Value, "*…") {
		plan.preview.Blocked = append(plan.preview.Blocked, "Full native key credential is unavailable")
		secret = ""
	}
	if input.Operation == "rebind" {
		if !existing.Enabled {
			plan.preview.Blocked = append(plan.preview.Blocked, "Registry policy is disabled")
		}
		if secret != "" && registry.TokenHash(secret) == existing.TokenSHA256 {
			plan.preview.Blocked = append(plan.preview.Blocked, "Registry binding already matches the native key")
		}
		if view, ok := snap.View(input.KeyID); ok {
			for _, route := range view.Routes {
				plan.preview.SelectedRoutes = append(plan.preview.SelectedRoutes, route.ExposedID)
			}
		}
		plan.policy = *existing
		plan.policy.TokenSHA256 = registry.TokenHash(secret)
	} else {
		selected, routes, rows, blocked, err := s.nativeAdoptionSelection(ctx, cfg, vk)
		if err != nil {
			return plan, 502, err
		}
		plan.preview.SelectedRoutes = routes
		plan.nativeEvidence = rows
		plan.preview.Blocked = append(plan.preview.Blocked, blocked...)
		plan.policy = registry.Policy{
			VirtualKeyID: input.KeyID, Name: vk.Name, TokenSHA256: registry.TokenHash(secret),
			Naming: "provider/model", Added: selected, Groups: []string{}, Enabled: true,
			Adopted: true, NativeModelIDs: selected,
		}
		if secret != "" && len(blocked) == 0 {
			ids, err := s.nativeModelIDs(ctx, secret)
			if err != nil {
				plan.preview.Blocked = append(plan.preview.Blocked, "Native model readback is unavailable")
			} else {
				plan.preview.NativeRoutes = ids
				if !sameStrings(ids, routes) {
					plan.preview.Blocked = append(plan.preview.Blocked, "Native model list differs from configured access; import or reconcile the missing routes first")
				}
			}
		}
	}
	if len(plan.preview.Blocked) == 0 {
		plan.preview.CanApply = true
		data, _ := json.Marshal(struct {
			Revision, Operation string
			Native              nativeVK
			Selected, Observed  []string
			Evidence            []nativeModel
		}{snap.Revision(), input.Operation, vk, plan.preview.SelectedRoutes, plan.preview.NativeRoutes, plan.nativeEvidence})
		h := sha256.Sum256(data)
		plan.preview.PreviewToken = hex.EncodeToString(h[:])
	}
	return plan, 200, nil
}

func (s *Server) nativeAdoptionSelection(ctx context.Context, cfg registry.Config, vk nativeVK) ([]string, []string, []nativeModel, []string, error) {
	blocked := []string{}
	if vk.AllowAllProviders {
		blocked = append(blocked, "allow_all_providers grants future providers and cannot be represented safely")
	}
	rows, err := s.nativeModels(ctx)
	if err != nil {
		return nil, nil, nil, nil, errors.New("native model discovery unavailable")
	}
	discovered := map[string]nativeModel{}
	for _, row := range rows {
		key := row.Provider + "/" + row.Name
		if _, duplicate := discovered[key]; duplicate {
			blocked = append(blocked, "Duplicate native model discovery for "+key)
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
	for _, pc := range vk.ProviderConfigs {
		if pc.Provider == "" || seenProvider[pc.Provider] {
			blocked = append(blocked, "Native provider configuration is missing or duplicated")
			continue
		}
		seenProvider[pc.Provider] = true
		if len(pc.AllowedModels) == 0 {
			blocked = append(blocked, "Empty native allowed_models has version-dependent meaning for "+pc.Provider)
			continue
		}
		keyIDs := pc.keyIDs()
		if len(keyIDs) == 0 {
			blocked = append(blocked, "Empty native provider key list has version-dependent meaning for "+pc.Provider)
			continue
		}
		for _, name := range pc.BlacklistedModels {
			if name == "*" || strings.HasPrefix(name, "regex:") {
				blocked = append(blocked, "Dynamic native blacklist is unsupported for "+pc.Provider)
			}
		}
		for _, name := range pc.AllowedModels {
			if name == "" || name == "*" || strings.HasPrefix(name, "regex:") {
				blocked = append(blocked, "Dynamic native model allowlist is unsupported for "+pc.Provider)
				continue
			}
			if registry.Has(pc.BlacklistedModels, name) {
				continue
			}
			route := pc.Provider + "/" + name
			if seenRoute[route] {
				blocked = append(blocked, "Duplicate native model route "+route)
				continue
			}
			seenRoute[route] = true
			m, ok := models[route]
			if !ok || !m.Enabled || (!m.Verified && !m.Configured) || m.Passthrough || m.Alias != m.UpstreamModel {
				blocked = append(blocked, "Native route "+route+" needs a configured direct Registry access with the same native name")
				continue
			}
			row, ok := discovered[route]
			if !ok {
				blocked = append(blocked, "Native route "+route+" is absent from provider discovery")
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
				blocked = append(blocked, "No enabled native provider key for "+route)
				continue
			}
			selected = append(selected, m.ID)
			routes = append(routes, route)
		}
	}
	if len(selected) == 0 {
		blocked = append(blocked, "Native key has no representable configured model access")
	}
	sort.Strings(selected)
	sort.Strings(routes)
	return selected, routes, rows, blocked, nil
}

func (s *Server) nativeModelIDs(ctx context.Context, secret string) ([]string, error) {
	client := *s.live.client
	client.authorization = "Bearer " + secret
	var body struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := client.call(ctx, "GET", "/v1/models", nil, &body); err != nil || body.Data == nil {
		return nil, errors.New("native model readback failed")
	}
	ids := make([]string, 0, len(body.Data))
	seen := map[string]bool{}
	for _, item := range body.Data {
		if item.ID == "" || seen[item.ID] {
			return nil, errors.New("invalid native model list")
		}
		seen[item.ID] = true
		ids = append(ids, item.ID)
	}
	sort.Strings(ids)
	return ids, nil
}

func sameStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
