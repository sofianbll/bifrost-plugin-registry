package admin

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

// #87: each unmanaged key says whether it can be adopted, derived from the same plan the adoption dialog previews.
// The gateway discovers Codex gpt-saved, gpt-unsaved, gpt-off (card disabled) and synth s-saved; Mistral is not discovered at all.
func readinessServer(t *testing.T) *Server {
	t.Helper()
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}
	cfg := s.Store.Load().Config()
	card := func(provider, name, key string, enabled bool) registry.Model {
		return registry.Model{ID: strings.ToLower(provider) + "-" + name, Alias: name, Provider: provider, ProviderKeyIDs: []string{key}, UpstreamModel: name, Endpoints: []string{"chat/completions"}, Enabled: enabled, Configured: true}
	}
	cfg.Models = []registry.Model{card("Codex", "gpt-saved", "codex-key", true), card("Codex", "gpt-off", "codex-key", false), card("synth", "s-saved", "synth-key", true)}
	cfg.Policies = []registry.Policy{{VirtualKeyID: "vk-managed", Name: "Managed", TokenSHA256: registry.TokenHash("sk-bf-managed"), Naming: "provider/model", Groups: []string{}, Added: []string{"codex-gpt-saved"}, Enabled: true}}
	raw, _ := json.Marshal(cfg)
	if _, err := s.Store.Save(raw, s.Store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	const keys = `[
		{"id":"vk-ready","name":"Ready","provider_configs":[{"provider":"Codex","allowed_models":["gpt-saved"],"allow_all_keys":true},{"provider":"synth","allowed_models":["s-saved"],"allow_all_keys":true}]},
		{"id":"vk-unsaved","name":"Unsaved","provider_configs":[{"provider":"Codex","allowed_models":["gpt-saved","gpt-unsaved"],"allow_all_keys":true}]},
		{"id":"vk-hermes","name":"Hermes","provider_configs":[{"provider":"Mistral","allowed_models":["m-large","m-small"],"allow_all_keys":true},{"provider":"Codex","allowed_models":["gpt-saved"],"allow_all_keys":true}]},
		{"id":"vk-mixed","name":"Mixed","provider_configs":[{"provider":"Mistral","allowed_models":["m-large"],"allow_all_keys":true},{"provider":"Codex","allowed_models":["gpt-unsaved","gpt-off","gpt-saved"],"allow_all_keys":true}]},
		{"id":"vk-all","name":"All","allow_all_providers":true,"provider_configs":[]},
		{"id":"vk-star","name":"Star","provider_configs":[{"provider":"Codex","allowed_models":["*"],"allow_all_keys":true}]},
		{"id":"vk-empty","name":"Empty","provider_configs":[]},
		{"id":"vk-off","name":"Off","is_active":false,"provider_configs":[{"provider":"Codex","allowed_models":["gpt-saved"],"allow_all_keys":true}]},
		{"id":"vk-unread","name":"Unread"},
		{"id":"vk-managed","name":"Managed","provider_configs":[{"provider":"Mistral","allowed_models":["m-large"],"allow_all_keys":true}]}]`
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/api/version":
			return nativeResponse(200, `"2.2.6"`), nil
		case "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"Codex"},{"name":"synth"}]}`), nil
		case "/api/providers/Codex/keys":
			return nativeResponse(200, `{"keys":[{"id":"codex-key","enabled":true}]}`), nil
		case "/api/providers/synth/keys":
			return nativeResponse(200, `{"keys":[{"id":"synth-key","enabled":true}]}`), nil
		case "/api/models":
			if r.URL.Query().Get("provider") == "Codex" {
				return nativeResponse(200, `{"models":[{"name":"gpt-saved","provider":"Codex","accessible_by_keys":["codex-key"]},{"name":"gpt-unsaved","provider":"Codex","accessible_by_keys":["codex-key"]},{"name":"gpt-off","provider":"Codex","accessible_by_keys":["codex-key"]}],"total":3}`), nil
			}
			return nativeResponse(200, `{"models":[{"name":"s-saved","provider":"synth","accessible_by_keys":["synth-key"]}],"total":1}`), nil
		case "/api/governance/virtual-keys":
			return nativeResponse(200, `{"virtual_keys":`+keys+`}`), nil
		case "/api/governance/virtual-keys/vk-mixed":
			var all struct{ Keys []map[string]any }
			_ = json.Unmarshal([]byte(`{"Keys":`+keys+`}`), &all)
			for _, k := range all.Keys {
				if k["id"] == "vk-mixed" {
					k["value"] = "sk-bf-mixed-secret"
					body, _ := json.Marshal(map[string]any{"virtual_key": k})
					return nativeResponse(200, string(body)), nil
				}
			}
		}
		t.Fatal("unexpected native route", r.URL.String())
		return nil, nil
	})
	return s
}

func TestWorkspaceKeysCarryAdoptionReadiness(t *testing.T) {
	s := readinessServer(t)
	w := perform(s, "GET", "/api/workspace", "", authorized())
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var ws struct {
		Data struct {
			Keys []struct {
				ID          string          `json:"id"`
				Managed     bool            `json:"managed"`
				Permissions json.RawMessage `json:"permissions"`
				Readiness   json.RawMessage `json:"readiness"`
			} `json:"keys"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &ws); err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	for _, k := range ws.Data.Keys {
		got[k.ID] = string(k.Readiness)
		if k.ID == "vk-ready" && len(k.Permissions) == 0 {
			t.Fatal("existing permissions summary lost")
		}
	}
	want := map[string]string{
		"vk-ready": `{"state":"ready","blockers":[]}`,
		// Discovered by Bifrost but with no Registry card: the models page can add it.
		"vk-unsaved": `{"state":"blocked","blockers":[{"provider":"Codex","kind":"unsaved","count":1,"models":["gpt-unsaved"]}]}`,
		// Bifrost does not list these models (disabled provider): nothing on the models page can add them.
		"vk-hermes": `{"state":"blocked","blockers":[{"provider":"Mistral","kind":"undiscovered","count":2,"models":["m-large","m-small"]}]}`,
		// One group per provider and kind, in the order the key lists its providers; a disabled card is "other".
		"vk-mixed":  `{"state":"blocked","blockers":[{"provider":"Mistral","kind":"undiscovered","count":1,"models":["m-large"]},{"provider":"Codex","kind":"unsaved","count":1,"models":["gpt-unsaved"]},{"provider":"Codex","kind":"other","count":1,"models":["gpt-off"],"reasons":["Native route Codex/gpt-off needs a configured direct Registry access with the same native name"]}]}`,
		"vk-all":    `{"state":"blocked","blockers":[{"provider":"","kind":"all-providers","count":1,"models":[],"reasons":["allow_all_providers grants future providers and cannot be represented safely"]}]}`,
		"vk-star":   `{"state":"blocked","blockers":[{"provider":"Codex","kind":"other","count":1,"models":[],"reasons":["Dynamic native model allowlist is unsupported for Codex"]}]}`,
		"vk-empty":  `{"state":"empty","blockers":[]}`,
		"vk-off":    `{"state":"blocked","blockers":[{"provider":"","kind":"other","count":1,"models":[],"reasons":["Native key is inactive or expired"]}]}`,
		"vk-unread": "", // no provider rows in the native answer: not read, so no verdict
		// Already adopted: readiness is about adoption only.
		"vk-managed": "",
	}
	for id, expected := range want {
		if got[id] != expected {
			t.Errorf("%s readiness:\n got %s\nwant %s", id, got[id], expected)
		}
	}
}

func TestAdoptionPreviewCarriesTheSameReadiness(t *testing.T) {
	s := readinessServer(t)
	w := perform(s, "POST", "/api/keys/adopt", `{"keyId":"vk-mixed","operation":"adopt","phase":"preview"}`, authorized())
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	var p struct {
		Blocked   []string        `json:"blocked"`
		CanApply  bool            `json:"canApply"`
		Readiness json.RawMessage `json:"readiness"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	want := `{"state":"blocked","blockers":[{"provider":"Mistral","kind":"undiscovered","count":1,"models":["m-large"]},{"provider":"Codex","kind":"unsaved","count":1,"models":["gpt-unsaved"]},{"provider":"Codex","kind":"other","count":1,"models":["gpt-off"],"reasons":["Native route Codex/gpt-off needs a configured direct Registry access with the same native name"]}]}`
	if p.CanApply || string(p.Readiness) != want {
		t.Fatalf("preview readiness:\n got %s\nwant %s", p.Readiness, want)
	}
	// The plain reasons keep their meaning: one line per blocked route.
	if len(p.Blocked) != 3 {
		t.Fatalf("blocked reasons changed: %v", p.Blocked)
	}
}

// A policy cannot hold two accesses of one alias (Store.Save refuses it without an access_selection), so a key
// that reaches one model through two subscriptions is blocked up front instead of reading "ready", then failing 422.
func TestOneModelThroughTwoSubscriptionsIsNotReady(t *testing.T) {
	card := func(provider, id string) registry.Model {
		return registry.Model{ID: id, Alias: "qa-shared", Provider: provider, ProviderKeyIDs: []string{"k"}, UpstreamModel: "qa-shared", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true}
	}
	cfg := registry.Config{Models: []registry.Model{card("Claude", "qa-shared"), card("Codex", "qa-shared-codex")}}
	row := func(provider string) nativeProviderConfig {
		return nativeProviderConfig{Provider: provider, AllowedModels: []string{"qa-shared"}, AllowAllKeys: true}
	}
	vk := nativeVK{ProviderConfigs: []nativeProviderConfig{row("Claude"), row("Codex")}}
	rows := []nativeModel{{Name: "qa-shared", Provider: "Claude", AccessibleByKeys: []string{"k"}}, {Name: "qa-shared", Provider: "Codex", AccessibleByKeys: []string{"k"}}}

	_, _, blocked := adoptionSelection(cfg, vk, rows, nil)
	got := jsonOf(t, adoptionReadinessOf(vk, blocked))
	want := `{"state":"blocked","blockers":[{"provider":"Codex","kind":"other","count":1,"models":["qa-shared"],"reasons":["Model qa-shared is allowed through Claude/qa-shared and Codex/qa-shared: Registry adopts one access per model"]}]}`
	if got != want {
		t.Fatalf("two accesses of one alias must block adoption:\n got %s\nwant %s", got, want)
	}
	// Keeping one subscription in Bifrost leaves a single access to adopt.
	selected, _, blocked := adoptionSelection(cfg, vk, rows, []string{"Codex"})
	if len(selected) != 1 || hasBlocking(blocked, "") {
		t.Fatalf("keeping Codex native should unblock the key: %v %+v", selected, blocked)
	}
}
