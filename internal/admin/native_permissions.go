package admin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"reflect"
	"sort"
	"strings"

	"bifrost-registry/internal/registry"
)

// Native permission edit (#93). Before adoption, an unmanaged native key can lose what Registry cannot
// represent: the models Bifrost does not list ("remove-models", one provider at a time), or "all providers"
// ("replace-all-providers"). It is a preview, then an apply that needs the preview token and an explicit
// confirmation; the Registry never edits a key on its own, and never an adopted one.
//
// Replacing "all providers" keeps a provider only through the models Registry can adopt, because a "*" list
// is a dynamic list that adoption refuses: the providers are those Bifrost lists models for (so the enabled,
// discovered ones), each limited to the models with a configured direct Registry access (one provider per model:
// a policy cannot hold two accesses of one alias), and every model it leaves out is named in the preview.
// A provider that already has a row on the key is left exactly as it is.
//
// Bifrost 2.2.6: the write is the one Registry already uses to publish a managed key (PUT with
// allow_all_providers false and the provider rows, ids kept so budgets and rate limits stay), and the result
// is read back and compared with the preview before it is reported. A row emptied by the removal is dropped,
// never sent with an empty allowed_models, whose meaning depends on the Bifrost list version.
const (
	editRemoveModels = "remove-models"
	editReplaceAll   = "replace-all-providers"
)

type permissionEditInput struct {
	KeyID        string `json:"keyId"`
	Operation    string `json:"operation"`
	Provider     string `json:"provider,omitempty"`
	Phase        string `json:"phase"`
	PreviewToken string `json:"previewToken,omitempty"`
	Confirm      bool   `json:"confirm,omitempty"`
}

type permissionChange struct {
	Provider string   `json:"provider"`
	Models   []string `json:"models"`
}

// permissionEditPreview is the exact change: what the key allows today, what it allows afterwards, and
// the models taken off (per provider). No token while the edit is blocked.
type permissionEditPreview struct {
	KeyID        string             `json:"keyId"`
	Operation    string             `json:"operation"`
	Provider     string             `json:"provider,omitempty"`
	Revision     string             `json:"revision"`
	PreviewToken string             `json:"previewToken,omitempty"`
	Remove       []permissionChange `json:"remove"`
	Before       *nativePermissions `json:"before"`
	After        *nativePermissions `json:"after,omitempty"`
	CanApply     bool               `json:"canApply"`
	Blocked      []string           `json:"blocked"`
}

type permissionEdit struct {
	preview permissionEditPreview
	payload map[string]any
	rows    []nativeProviderConfig // what the key must read back as
}

func (s *Server) editNativePermissions(w http.ResponseWriter, r *http.Request) {
	b, err := readJSON(w, r)
	if err != nil {
		return
	}
	var in permissionEditInput
	if registry.StrictJSON(b, &in, true) != nil || in.KeyID == "" || (in.Operation != editRemoveModels && in.Operation != editReplaceAll) ||
		(in.Phase != "preview" && in.Phase != "apply") || (in.Operation == editRemoveModels && in.Provider == "") {
		reply(w, 400, map[string]string{"error": "keyId, operation (remove-models with a provider, or replace-all-providers) and phase (preview or apply) are required"})
		return
	}
	if in.Phase == "apply" && (in.PreviewToken == "" || !in.Confirm) {
		reply(w, 428, map[string]string{"error": "previewToken and an explicit confirmation are required"})
		return
	}
	edit, status, err := s.permissionEditPlan(r.Context(), in)
	if err != nil {
		reply(w, status, map[string]string{"error": err.Error()})
		return
	}
	if in.Phase == "preview" {
		reply(w, 200, edit.preview)
		return
	}
	if !edit.preview.CanApply || edit.preview.PreviewToken != in.PreviewToken {
		reply(w, 409, map[string]string{"error": "Native key or Registry preview changed; preview again"})
		return
	}
	path := "/api/governance/virtual-keys/" + url.PathEscape(in.KeyID)
	if err := s.live.client.call(r.Context(), "PUT", path, edit.payload, nil); err != nil {
		reply(w, 502, map[string]string{"error": err.Error(), "phase": "native_apply"})
		return
	}
	var back struct {
		VirtualKey nativeVK `json:"virtual_key"`
	}
	if err := s.live.client.call(r.Context(), "GET", path, nil, &back); err != nil {
		reply(w, 502, map[string]string{"error": "The change was sent but the key could not be read back; check it in Bifrost", "phase": "native_readback"})
		return
	}
	if back.VirtualKey.AllowAllProviders || !reflect.DeepEqual(rowSignature(back.VirtualKey.ProviderConfigs), rowSignature(edit.rows)) {
		reply(w, 502, map[string]string{"error": "Bifrost does not hold the key as previewed; check it in Bifrost", "phase": "native_readback"})
		return
	}
	permissions := back.VirtualKey.permissions()
	if permissions == nil {
		permissions = &nativePermissions{Providers: []providerPermission{}}
	}
	reply(w, 200, map[string]any{"keyId": in.KeyID, "operation": in.Operation, "applied": true, "permissions": permissions})
}

func (s *Server) permissionEditPlan(ctx context.Context, in permissionEditInput) (permissionEdit, int, error) {
	snap := s.Store.Load()
	edit := permissionEdit{preview: permissionEditPreview{KeyID: in.KeyID, Operation: in.Operation, Provider: in.Provider, Revision: snap.Revision(), Remove: []permissionChange{}, Blocked: []string{}}}
	cfg := snap.Config()
	for _, p := range cfg.Policies {
		if p.VirtualKeyID == in.KeyID {
			return edit, 409, errors.New("key is managed by Registry; its native permissions are never rewritten")
		}
	}
	var detail struct {
		VirtualKey nativeVK `json:"virtual_key"`
	}
	if err := s.live.client.call(ctx, "GET", "/api/governance/virtual-keys/"+url.PathEscape(in.KeyID), nil, &detail); err != nil {
		var status nativeHTTPError
		if errors.As(err, &status) && status == 404 {
			return edit, 404, errors.New("native key not found")
		}
		return edit, 502, errors.New("native key detail unavailable")
	}
	vk := detail.VirtualKey
	rows, err := s.nativeModels(ctx)
	if err != nil {
		return edit, 502, errors.New("native model discovery unavailable")
	}
	edit.preview.Before = vk.permissions()
	blocked := func(reason string) { edit.preview.Blocked = append(edit.preview.Blocked, reason) }
	if vk.ID != in.KeyID {
		blocked("Native key identity changed")
	}
	if vk.IsAccessProfileManaged {
		blocked("Native key is controlled by an external access profile")
	}
	next := []nativeProviderConfig{}
	switch in.Operation {
	case editRemoveModels:
		if vk.AllowAllProviders {
			// Dropping the row of an all-providers key would open that provider completely.
			blocked("This key allows all providers: replace that first")
		}
		_, _, blockers := adoptionSelection(cfg, vk, rows, nil)
		gone, names := map[string]bool{}, []string{}
		for _, b := range blockers {
			if b.Kind == blockUndiscovered && b.Provider == in.Provider && b.Model != "" && !gone[b.Model] {
				gone[b.Model] = true
				names = append(names, b.Model)
			}
		}
		if len(names) == 0 {
			blocked("Nothing to remove for this provider")
		}
		sort.Strings(names)
		for _, pc := range vk.ProviderConfigs {
			if pc.Provider == in.Provider {
				kept := []string{}
				for _, model := range pc.AllowedModels {
					if !gone[model] {
						kept = append(kept, model)
					}
				}
				if len(kept) == 0 {
					continue
				}
				pc.AllowedModels = kept
			}
			next = append(next, pc)
		}
		edit.preview.Remove = []permissionChange{{Provider: in.Provider, Models: names}}
		if len(names) == 0 {
			edit.preview.Remove = []permissionChange{}
		}
	case editReplaceAll:
		if !vk.AllowAllProviders {
			blocked("This key does not allow all providers")
			break
		}
		next = append(next, vk.ProviderConfigs...)
		has := map[string]bool{}
		for _, pc := range vk.ProviderConfigs {
			has[pc.Provider] = true
		}
		listed, providers := map[string]map[string]bool{}, []string{}
		for _, row := range rows {
			if has[row.Provider] {
				continue
			}
			if listed[row.Provider] == nil {
				listed[row.Provider] = map[string]bool{}
				providers = append(providers, row.Provider)
			}
			listed[row.Provider][row.Name] = true
		}
		sort.Strings(providers)
		candidate := nativeVK{}
		for _, provider := range providers {
			candidate.ProviderConfigs = append(candidate.ProviderConfigs, nativeProviderConfig{Provider: provider, AllowedModels: sortedKeys(listed[provider]), AllowAllKeys: true})
		}
		_, routes, _ := adoptionSelection(cfg, candidate, rows, nil)
		holdable := map[string]bool{}
		for _, route := range routes {
			holdable[route] = true
		}
		// A policy holds one access per model: when several providers serve the same model, the key keeps the
		// first provider (by name) and the others are left out, unless a row the key already has holds it.
		_, kept0, _ := adoptionSelection(cfg, nativeVK{ProviderConfigs: vk.ProviderConfigs}, rows, nil)
		taken := map[string]bool{}
		for _, route := range kept0 {
			taken[route[strings.Index(route, "/")+1:]] = true
		}
		for _, pc := range candidate.ProviderConfigs {
			kept, left := []string{}, []string{}
			for _, model := range pc.AllowedModels {
				if holdable[pc.Provider+"/"+model] && !taken[model] {
					taken[model] = true
					kept = append(kept, model)
				} else {
					left = append(left, model)
				}
			}
			if len(kept) > 0 {
				next = append(next, nativeProviderConfig{Provider: pc.Provider, AllowedModels: kept, AllowAllKeys: true})
			}
			if len(left) > 0 {
				edit.preview.Remove = append(edit.preview.Remove, permissionChange{Provider: pc.Provider, Models: left})
			}
		}
	}
	if len(edit.preview.Blocked) > 0 {
		return edit, 200, nil
	}
	sort.SliceStable(next, func(i, j int) bool { return next[i].Provider < next[j].Provider })
	pcs := []map[string]any{}
	for _, pc := range next {
		pcs = append(pcs, pc.writeRow())
	}
	// The whole key is reposted from its read-back; only the provider rows and allow_all_providers change.
	edit.payload = map[string]any{"name": vk.Name, "description": vk.Description, "allow_all_providers": false, "provider_configs": pcs}
	if vk.IsActive != nil {
		edit.payload["is_active"] = *vk.IsActive
	}
	edit.rows = next
	edit.preview.After = (&nativeVK{ProviderConfigs: next}).permissions()
	edit.preview.CanApply = true
	data, _ := json.Marshal(struct {
		Revision, Operation, Provider string
		Native                        nativeVK
		Payload                       map[string]any
		Remove                        []permissionChange
	}{snap.Revision(), in.Operation, in.Provider, vk, edit.payload, edit.preview.Remove})
	h := sha256.Sum256(data)
	edit.preview.PreviewToken = hex.EncodeToString(h[:])
	return edit, 200, nil
}

// writeRow is a provider row as a PUT sends it: the id keeps the row's budget and rate limit.
func (p nativeProviderConfig) writeRow() map[string]any {
	row := map[string]any{"provider": p.Provider, "weight": p.Weight, "allowed_models": orEmpty(p.AllowedModels), "blacklisted_models": orEmpty(p.BlacklistedModels), "key_ids": p.keyIDs()}
	if p.ID != 0 {
		row["id"] = p.ID
	}
	return row
}

func orEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// rowSignature is what a key allows per provider, ignoring order: the model lists and the blacklists.
func rowSignature(rows []nativeProviderConfig) []string {
	out := []string{}
	for _, pc := range rows {
		allowed, black := append([]string{}, pc.AllowedModels...), append([]string{}, pc.BlacklistedModels...)
		sort.Strings(allowed)
		sort.Strings(black)
		b, _ := json.Marshal([]any{pc.Provider, allowed, black})
		out = append(out, string(b))
	}
	sort.Strings(out)
	return out
}
