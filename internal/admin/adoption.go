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
	"slices"
	"sort"
	"strings"

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
	// Providers of the key whose permissions stay native: adopt only; the preview token covers the choice.
	KeepNative []string `json:"keepNative,omitempty"`
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
	// The blockers grouped for display (adopt only); Blocked keeps the plain reasons.
	Readiness *adoptionReadiness `json:"readiness,omitempty"`
}

type adoptionPlan struct {
	preview        adoptionPreview
	policy         registry.Policy
	nativeEvidence []nativeModel
	blockers       []adoptionBlocker
}

// block records each reason in the plain list and in the structured one the readiness groups;
// a kept provider's blockers only go to the structured one.
func (p *adoptionPlan) block(blockers ...adoptionBlocker) {
	for _, b := range blockers {
		p.blockers = append(p.blockers, b)
		if !b.Kept {
			p.preview.Blocked = append(p.preview.Blocked, b.Reason)
		}
	}
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
		plan.block(otherBlocker("Native key identity changed"))
	}
	plan.block(nativeKeyBlockers(vk)...)
	secret, err := registry.Credential(map[string]string{"x-bf-vk": vk.Value})
	if err != nil || secret != vk.Value || strings.ContainsAny(vk.Value, "*…") {
		plan.block(otherBlocker("Full native key credential is unavailable"))
		secret = ""
	}
	if input.Operation == "rebind" {
		if !existing.Enabled {
			plan.block(otherBlocker("Registry policy is disabled"))
		}
		if secret != "" && registry.TokenHash(secret) == existing.TokenSHA256 {
			plan.block(otherBlocker("Registry binding already matches the native key"))
		}
		if view, ok := snap.View(input.KeyID); ok {
			for _, route := range view.Routes {
				plan.preview.SelectedRoutes = append(plan.preview.SelectedRoutes, route.ExposedID)
			}
		}
		plan.policy = *existing
		plan.policy.TokenSHA256 = registry.TokenHash(secret)
	} else {
		rows, err := s.nativeModels(ctx)
		if err != nil {
			return plan, 502, errors.New("native model discovery unavailable")
		}
		keep := keptProviders(input.KeepNative)
		for _, name := range keep {
			if !vk.hasProvider(name) {
				plan.block(otherBlocker("Kept provider " + name + " is not on the native key"))
			}
		}
		selected, routes, blocked := adoptionSelection(cfg, vk, rows, keep)
		plan.preview.SelectedRoutes = routes
		plan.nativeEvidence = rows
		plan.block(blocked...)
		plan.policy = registry.Policy{
			VirtualKeyID: input.KeyID, Name: vk.Name, TokenSHA256: registry.TokenHash(secret),
			Naming: "provider/model", Added: selected, Groups: []string{}, Enabled: true,
			Adopted: true, NativeModelIDs: selected, KeptNative: keep,
		}
		if secret != "" && !hasBlocking(blocked, "") {
			ids, err := s.nativeModelIDs(ctx, secret)
			if err != nil {
				plan.block(otherBlocker("Native model readback is unavailable"))
			} else {
				plan.preview.NativeRoutes = ids
				if missing, unexpected := diffModels(append(append([]string{}, routes...), keptNativeRoutes(vk, keep)...), ids, keep, routes); len(missing)+len(unexpected) > 0 {
					plan.block(otherBlocker("Native model list differs from configured access; import or reconcile the missing routes first"))
				}
			}
		}
		plan.preview.Readiness = adoptionReadinessOf(vk, plan.blockers)
	}
	if len(plan.preview.Blocked) == 0 {
		plan.preview.CanApply = true
		data, _ := json.Marshal(struct {
			Revision, Operation string
			Native              nativeVK
			Selected, Observed  []string
			Evidence            []nativeModel
			Keep                []string
		}{snap.Revision(), input.Operation, vk, plan.preview.SelectedRoutes, plan.preview.NativeRoutes, plan.nativeEvidence, plan.policy.KeptNative})
		h := sha256.Sum256(data)
		plan.preview.PreviewToken = hex.EncodeToString(h[:])
	}
	return plan, 200, nil
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

// keptProviders is the sorted, de-duplicated choice of providers to keep native.
func keptProviders(names []string) []string {
	var out []string
	for _, name := range names {
		if name != "" && !registry.Has(out, name) {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out
}

func (vk nativeVK) hasProvider(name string) bool {
	for _, pc := range vk.ProviderConfigs {
		if pc.Provider == name {
			return true
		}
	}
	return false
}

// keptNativeRoutes are the explicit routes the native key allows on the kept providers; a wildcard or
// regex allowlist names none, and blacklisted names are not allowed.
func keptNativeRoutes(vk nativeVK, keep []string) []string {
	out := []string{}
	for _, pc := range vk.ProviderConfigs {
		if !registry.Has(keep, pc.Provider) {
			continue
		}
		for _, name := range pc.AllowedModels {
			if name != "" && name != "*" && !strings.HasPrefix(name, "regex:") && !registry.Has(pc.BlacklistedModels, name) {
				out = append(out, pc.Provider+"/"+name)
			}
		}
	}
	sort.Strings(out)
	return out
}

// expectedRoutes are the IDs a key's /v1/models should list: its Registry routes plus the explicit
// routes of the providers it keeps native, as the native key allows them now.
func expectedRoutes(view *registry.View, vk nativeVK) []string {
	out := append(keptNativeRoutes(vk, view.Policy.KeptNative), exposedIDs(view)...)
	sort.Strings(out)
	return out
}

// exposedIDs are the IDs of the key's Registry routes.
func exposedIDs(view *registry.View) []string {
	out := []string{}
	for _, route := range view.Routes {
		out = append(out, route.ExposedID)
	}
	return out
}

// diffModels compares what /v1/models lists with what is expected. A kept provider is Bifrost's own: its
// routes are neither missing nor unexpected. Bifrost 2.2.6 lists only the models a provider itself lists, so
// an explicit name its provider does not list (undiscovered) is absent, and a wildcard lists names no row has.
// A Registry route (managed) stays checked even when it starts with a kept provider's name.
func diffModels(expected, actual, keep, managed []string) (missing, unexpected []string) {
	missing, unexpected = []string{}, []string{}
	kept := func(id string) bool {
		return !slices.Contains(managed, id) && slices.ContainsFunc(keep, func(provider string) bool { return strings.HasPrefix(id, provider+"/") })
	}
	for _, id := range expected {
		if !slices.Contains(actual, id) && !kept(id) {
			missing = append(missing, id)
		}
	}
	for _, id := range actual {
		if !slices.Contains(expected, id) && !kept(id) {
			unexpected = append(unexpected, id)
		}
	}
	return missing, unexpected
}
