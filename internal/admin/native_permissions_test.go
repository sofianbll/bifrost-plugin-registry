package admin

import (
	"encoding/json"
	"net/http"
	"reflect"
	"sort"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

// #93: an unmanaged native key can lose the models Registry cannot represent, or its "all providers",
// only through a preview, then an apply carrying the preview token and an explicit confirmation.
// The synthetic Bifrost below keeps the keys in memory, records every write and reads them back like 2.2.6
// (key_ids ["*"] reads as allow_all_keys, a provider row missing from a PUT is deleted).
type permissionHarness struct {
	server *Server
	keys   map[string]map[string]any
	puts   []map[string]any
	// ignorePut makes Bifrost accept a write without keeping it.
	ignorePut bool
	nextRow   int
}

const permissionKeys = `{
	"vk-hermes": {"id":"vk-hermes","name":"Hermes","description":"Hermes client","value":"sk-bf-hermes","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"id":1,"provider":"Mistral","allowed_models":["m-large","m-small"],"blacklisted_models":[],"allow_all_keys":true},
		{"id":2,"provider":"Codex","allowed_models":["gpt-saved"],"blacklisted_models":[],"allow_all_keys":true}]},
	"vk-mistral": {"id":"vk-mistral","name":"Mistral only","value":"sk-bf-mistral","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"id":3,"provider":"Mistral","allowed_models":["m-large"],"blacklisted_models":[],"allow_all_keys":true}]},
	"vk-plain": {"id":"vk-plain","name":"Plain","value":"sk-bf-plain","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"id":4,"provider":"Codex","allowed_models":["gpt-saved"],"blacklisted_models":[],"allow_all_keys":true}]},
	"vk-all": {"id":"vk-all","name":"Everything","value":"sk-bf-all","is_active":true,"allow_all_providers":true,"provider_configs":[]},
	"vk-all-rows": {"id":"vk-all-rows","name":"Everything but","value":"sk-bf-all-rows","is_active":true,"allow_all_providers":true,"provider_configs":[
		{"id":5,"provider":"Mistral","allowed_models":["m-large"],"blacklisted_models":[],"allow_all_keys":true}]},
	"vk-managed": {"id":"vk-managed","name":"Managed","value":"sk-bf-managed","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"id":6,"provider":"Mistral","allowed_models":["m-large"],"blacklisted_models":[],"allow_all_keys":true}]},
	"vk-profile": {"id":"vk-profile","name":"Profile","value":"sk-bf-profile","is_active":true,"is_access_profile_managed":true,"allow_all_providers":false,"provider_configs":[
		{"id":7,"provider":"Mistral","allowed_models":["m-large"],"blacklisted_models":[],"allow_all_keys":true}]}
}`

func newPermissionHarness(t *testing.T) *permissionHarness {
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
	h := &permissionHarness{server: s, keys: map[string]map[string]any{}, nextRow: 100}
	if err := json.Unmarshal([]byte(permissionKeys), &h.keys); err != nil {
		t.Fatal(err)
	}
	s.live.client.http.Transport = nativeRoundTrip(h.roundTrip(t))
	return h
}

func (h *permissionHarness) roundTrip(t *testing.T) func(*http.Request) (*http.Response, error) {
	return func(r *http.Request) (*http.Response, error) {
		path := r.URL.Path
		switch {
		case path == "/api/version":
			return nativeResponse(200, `"2.2.6"`), nil
		case path == "/api/providers":
			// Mistral is configured but disabled in Bifrost: it is not listed here, so none of its models is discovered.
			return nativeResponse(200, `{"providers":[{"name":"Codex"},{"name":"synth"}]}`), nil
		case path == "/api/providers/Codex/keys":
			return nativeResponse(200, `{"keys":[{"id":"codex-key","enabled":true}]}`), nil
		case path == "/api/providers/synth/keys":
			return nativeResponse(200, `{"keys":[{"id":"synth-key","enabled":true}]}`), nil
		case path == "/api/models":
			if r.URL.Query().Get("provider") == "Codex" {
				return nativeResponse(200, `{"models":[{"name":"gpt-saved","provider":"Codex","accessible_by_keys":["codex-key"]},{"name":"gpt-unsaved","provider":"Codex","accessible_by_keys":["codex-key"]},{"name":"gpt-off","provider":"Codex","accessible_by_keys":["codex-key"]}],"total":3}`), nil
			}
			return nativeResponse(200, `{"models":[{"name":"s-saved","provider":"synth","accessible_by_keys":["synth-key"]}],"total":1}`), nil
		case path == "/api/governance/virtual-keys" && r.Method == "GET":
			list := []map[string]any{}
			for _, k := range h.keys {
				list = append(list, k)
			}
			body, _ := json.Marshal(map[string]any{"virtual_keys": list})
			return nativeResponse(200, string(body)), nil
		case strings.HasPrefix(path, "/api/governance/virtual-keys/"):
			key := h.keys[strings.TrimPrefix(path, "/api/governance/virtual-keys/")]
			if key == nil {
				return nativeResponse(404, `{}`), nil
			}
			if r.Method == "PUT" {
				var payload map[string]any
				if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
					t.Fatal(err)
				}
				h.puts = append(h.puts, payload)
				if !h.ignorePut {
					h.store(key, payload)
				}
			}
			body, _ := json.Marshal(map[string]any{"virtual_key": key})
			return nativeResponse(200, string(body)), nil
		case path == "/v1/models":
			secret := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			ids := []string{}
			for _, k := range h.keys {
				if k["value"] != secret {
					continue
				}
				for _, pc := range k["provider_configs"].([]any) {
					row := pc.(map[string]any)
					for _, name := range row["allowed_models"].([]any) {
						ids = append(ids, row["provider"].(string)+"/"+name.(string))
					}
				}
			}
			sort.Strings(ids)
			data := []map[string]string{}
			for _, id := range ids {
				data = append(data, map[string]string{"id": id})
			}
			body, _ := json.Marshal(map[string]any{"data": data})
			return nativeResponse(200, string(body)), nil
		}
		t.Fatalf("unexpected native call %s %s", r.Method, r.URL)
		return nil, nil
	}
}

// store applies a PUT the way Bifrost does: the rows sent are the rows kept, key_ids ["*"] reads as allow_all_keys.
func (h *permissionHarness) store(key, payload map[string]any) {
	for _, field := range []string{"name", "description", "is_active", "allow_all_providers"} {
		if v, ok := payload[field]; ok {
			key[field] = v
		}
	}
	rows := []any{}
	for _, raw := range payload["provider_configs"].([]any) {
		row := raw.(map[string]any)
		stored := map[string]any{"provider": row["provider"], "allowed_models": row["allowed_models"], "blacklisted_models": row["blacklisted_models"], "weight": row["weight"]}
		if id, ok := row["id"]; ok {
			stored["id"] = id
		} else {
			h.nextRow++
			stored["id"] = h.nextRow
		}
		ids, _ := row["key_ids"].([]any)
		if len(ids) == 1 && ids[0] == "*" {
			stored["allow_all_keys"] = true
		} else {
			keys := []any{}
			for _, id := range ids {
				keys = append(keys, map[string]any{"key_id": id})
			}
			stored["keys"] = keys
		}
		rows = append(rows, stored)
	}
	key["provider_configs"] = rows
}

type editPreview struct {
	KeyID        string `json:"keyId"`
	Operation    string `json:"operation"`
	Provider     string `json:"provider"`
	Revision     string `json:"revision"`
	PreviewToken string `json:"previewToken"`
	Remove       []struct {
		Provider string   `json:"provider"`
		Models   []string `json:"models"`
	} `json:"remove"`
	Before   *nativePermissions `json:"before"`
	After    *nativePermissions `json:"after"`
	CanApply bool               `json:"canApply"`
	Blocked  []string           `json:"blocked"`
}

func (h *permissionHarness) edit(body string) (int, string) {
	w := perform(h.server, "POST", "/api/keys/native-permissions", body, authorized())
	return w.Code, w.Body.String()
}

func (h *permissionHarness) preview(t *testing.T, keyID, operation, provider string) editPreview {
	t.Helper()
	code, body := h.edit(`{"keyId":"` + keyID + `","operation":"` + operation + `","provider":"` + provider + `","phase":"preview"}`)
	if code != 200 || strings.Contains(body, "sk-bf-") {
		t.Fatalf("preview status or secret leak: %d %s", code, body)
	}
	var p editPreview
	if err := json.Unmarshal([]byte(body), &p); err != nil {
		t.Fatal(err)
	}
	if len(h.puts) != 0 {
		t.Fatal("a preview wrote to Bifrost")
	}
	return p
}

func (h *permissionHarness) apply(keyID, operation, provider, token string, confirm bool) (int, string) {
	return h.edit(`{"keyId":"` + keyID + `","operation":"` + operation + `","provider":"` + provider + `","phase":"apply","previewToken":"` + token + `","confirm":` + map[bool]string{true: "true", false: "false"}[confirm] + `}`)
}

func jsonOf(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func (h *permissionHarness) adoptionState(t *testing.T, keyID string) (string, bool) {
	t.Helper()
	w := perform(h.server, "POST", "/api/keys/adopt", `{"keyId":"`+keyID+`","operation":"adopt","phase":"preview"}`, authorized())
	var p struct {
		CanApply  bool `json:"canApply"`
		Readiness struct {
			State string `json:"state"`
		} `json:"readiness"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	return p.Readiness.State, p.CanApply
}

func TestRemoveUndiscoveredModelsPreviewsThenWritesOnlyWhatWasPreviewed(t *testing.T) {
	h := newPermissionHarness(t)
	if state, _ := h.adoptionState(t, "vk-hermes"); state != "blocked" {
		t.Fatal("fixture key must start blocked by the undiscovered models:", state)
	}
	p := h.preview(t, "vk-hermes", "remove-models", "Mistral")
	if !p.CanApply || p.PreviewToken == "" || len(p.Blocked) != 0 || p.Operation != "remove-models" || p.Provider != "Mistral" {
		t.Fatalf("wrong preview: %+v", p)
	}
	if got := jsonOf(t, p.Remove); got != `[{"provider":"Mistral","models":["m-large","m-small"]}]` {
		t.Fatalf("preview must name every model removed: %s", got)
	}
	if got := jsonOf(t, p.Before); got != `{"allProviders":false,"providers":[{"provider":"Mistral","allModels":false,"models":["m-large","m-small"]},{"provider":"Codex","allModels":false,"models":["gpt-saved"]}]}` {
		t.Fatalf("preview must show what the key allows today: %s", got)
	}
	if got := jsonOf(t, p.After); got != `{"allProviders":false,"providers":[{"provider":"Codex","allModels":false,"models":["gpt-saved"]}]}` {
		t.Fatalf("preview must show what the key allows afterwards: %s", got)
	}

	// Nothing is written without the explicit confirmation, whatever the token says.
	if code, body := h.apply("vk-hermes", "remove-models", "Mistral", p.PreviewToken, false); code != 428 || len(h.puts) != 0 {
		t.Fatalf("unconfirmed apply was not refused: %d %s writes=%d", code, body, len(h.puts))
	}
	if code, body := h.apply("vk-hermes", "remove-models", "Mistral", "", true); code != 428 || len(h.puts) != 0 {
		t.Fatalf("apply without a preview token was not refused: %d %s writes=%d", code, body, len(h.puts))
	}
	if code, body := h.apply("vk-hermes", "remove-models", "Mistral", "not-the-preview", true); code != 409 || len(h.puts) != 0 {
		t.Fatalf("token mismatch was not refused: %d %s writes=%d", code, body, len(h.puts))
	}
	// The native key changed after the preview: the old token no longer applies.
	h.keys["vk-hermes"]["description"] = "edited in Bifrost meanwhile"
	if code, _ := h.apply("vk-hermes", "remove-models", "Mistral", p.PreviewToken, true); code != 409 || len(h.puts) != 0 {
		t.Fatalf("a stale preview was applied: %d writes=%d", code, len(h.puts))
	}
	p = h.preview(t, "vk-hermes", "remove-models", "Mistral")

	code, body := h.apply("vk-hermes", "remove-models", "Mistral", p.PreviewToken, true)
	if code != 200 || strings.Contains(body, "sk-bf-") {
		t.Fatalf("apply failed or leaked the secret: %d %s", code, body)
	}
	// The whole key is reposted from its read-back: only the Mistral row is gone, the Codex row is untouched.
	if len(h.puts) != 1 {
		t.Fatalf("expected exactly one native write, got %d", len(h.puts))
	}
	want := `{"name":"Hermes","description":"edited in Bifrost meanwhile","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"id":2,"provider":"Codex","weight":null,"allowed_models":["gpt-saved"],"blacklisted_models":[],"key_ids":["*"]}]}`
	var expected map[string]any
	if err := json.Unmarshal([]byte(want), &expected); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(h.puts[0], expected) {
		t.Fatalf("native write payload:\n got %s\nwant %s", jsonOf(t, h.puts[0]), jsonOf(t, expected))
	}
	var done struct {
		Applied     bool               `json:"applied"`
		Permissions *nativePermissions `json:"permissions"`
	}
	if err := json.Unmarshal([]byte(body), &done); err != nil || !done.Applied || jsonOf(t, done.Permissions) != jsonOf(t, p.After) {
		t.Fatalf("the result must be the permissions read back from Bifrost: %s", body)
	}
	if state, ok := h.adoptionState(t, "vk-hermes"); state != "ready" || !ok {
		t.Fatal("the key must be adoptable after the removal:", state, ok)
	}
}

func TestRemoveModelsKeepsTheRestOfAProviderRow(t *testing.T) {
	h := newPermissionHarness(t)
	h.keys["vk-hermes"]["provider_configs"] = []any{
		map[string]any{"id": 1, "provider": "Mistral", "allowed_models": []any{"m-large", "m-small", "m-blocked"}, "blacklisted_models": []any{"m-blocked"}, "allow_all_keys": true, "weight": 0.5},
		map[string]any{"id": 2, "provider": "Codex", "allowed_models": []any{"gpt-saved", "gpt-unsaved"}, "blacklisted_models": []any{}, "keys": []any{map[string]any{"key_id": "codex-key"}}},
	}
	// Only the unrepresentable models of the asked provider go; the unsaved Codex one stays for the models page.
	p := h.preview(t, "vk-hermes", "remove-models", "Mistral")
	if got := jsonOf(t, p.Remove); got != `[{"provider":"Mistral","models":["m-large","m-small"]}]` {
		t.Fatalf("a blacklisted model is not an access: %s", got)
	}
	if code, body := h.apply("vk-hermes", "remove-models", "Mistral", p.PreviewToken, true); code != 200 {
		t.Fatal(code, body)
	}
	// Rows are sent sorted by provider, each with its id (so Bifrost keeps its budget) and its own key list.
	want := `[{"id":2,"provider":"Codex","weight":null,"allowed_models":["gpt-saved","gpt-unsaved"],"blacklisted_models":[],"key_ids":["codex-key"]},
		{"id":1,"provider":"Mistral","weight":0.5,"allowed_models":["m-blocked"],"blacklisted_models":["m-blocked"],"key_ids":["*"]}]`
	var expected []any
	if err := json.Unmarshal([]byte(want), &expected); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(h.puts[0]["provider_configs"], expected) {
		t.Fatalf("rows reposted:\n got %s\nwant %s", jsonOf(t, h.puts[0]["provider_configs"]), jsonOf(t, expected))
	}
}

func TestRemoveModelsRefusals(t *testing.T) {
	h := newPermissionHarness(t)
	for _, tc := range []struct {
		name, key, operation, provider string
		status                         int
		blocked                        string
	}{
		{"nothing to remove", "vk-plain", "remove-models", "Codex", 200, "Nothing to remove"},
		{"unknown provider", "vk-hermes", "remove-models", "Nobody", 200, "Nothing to remove"},
		{"all providers must be replaced first", "vk-all-rows", "remove-models", "Mistral", 200, "allows all providers"},
		{"access profile", "vk-profile", "remove-models", "Mistral", 200, "external access profile"},
		{"managed by Registry", "vk-managed", "remove-models", "Mistral", 409, ""},
		{"unknown key", "vk-nope", "remove-models", "Mistral", 404, ""},
		{"not an operation", "vk-hermes", "delete-everything", "Mistral", 400, ""},
		{"replace needs all providers", "vk-hermes", "replace-all-providers", "", 200, "does not allow all providers"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			code, body := h.edit(`{"keyId":"` + tc.key + `","operation":"` + tc.operation + `","provider":"` + tc.provider + `","phase":"preview"}`)
			if code != tc.status {
				t.Fatalf("status %d, want %d: %s", code, tc.status, body)
			}
			if tc.status == 200 {
				var p editPreview
				if err := json.Unmarshal([]byte(body), &p); err != nil || p.CanApply || p.PreviewToken != "" || len(p.Blocked) == 0 || !strings.Contains(p.Blocked[0], tc.blocked) {
					t.Fatalf("expected a blocked preview mentioning %q: %s", tc.blocked, body)
				}
				if code, _ := h.apply(tc.key, tc.operation, tc.provider, "anything", true); code == 200 {
					t.Fatal("a blocked edit was applied")
				}
			}
			if len(h.puts) != 0 {
				t.Fatal("a refused edit wrote to Bifrost")
			}
		})
	}
	if code, _ := perform(h.server, "POST", "/api/keys/native-permissions", `{"keyId":"vk-hermes","operation":"remove-models","provider":"Mistral","phase":"preview"}`, nil).Code, 0; code != 401 {
		t.Fatal("the native edit bypassed admin authentication", code)
	}
}

func TestRemovingEveryModelOfTheKeyLeavesItEmptyNotWide(t *testing.T) {
	h := newPermissionHarness(t)
	p := h.preview(t, "vk-mistral", "remove-models", "Mistral")
	if got := jsonOf(t, p.After); got != `{"allProviders":false,"providers":[]}` {
		t.Fatalf("the preview must say the key allows nothing afterwards: %s", got)
	}
	if code, body := h.apply("vk-mistral", "remove-models", "Mistral", p.PreviewToken, true); code != 200 {
		t.Fatal(code, body)
	}
	// An emptied provider row is deleted: an empty allowed_models list means "allow all" on a version 1 gateway.
	if rows := h.puts[0]["provider_configs"].([]any); len(rows) != 0 || h.puts[0]["allow_all_providers"] != false {
		t.Fatalf("the emptied row must be dropped, not left empty: %s", jsonOf(t, h.puts[0]))
	}
}

func TestReplaceAllProvidersByTheExplicitListOfCurrentProviders(t *testing.T) {
	h := newPermissionHarness(t)
	if state, _ := h.adoptionState(t, "vk-all"); state != "blocked" {
		t.Fatal("the all-providers key must start blocked:", state)
	}
	p := h.preview(t, "vk-all", "replace-all-providers", "")
	if !p.CanApply || p.PreviewToken == "" || len(p.Blocked) != 0 {
		t.Fatalf("wrong preview: %+v", p)
	}
	if got := jsonOf(t, p.Before); got != `{"allProviders":true,"providers":[]}` {
		t.Fatalf("preview must show all providers today: %s", got)
	}
	// Codex and synth are the providers Bifrost lists and Registry can reach; Mistral is disabled, so it is not one.
	// The key keeps the models Registry holds a direct access for and loses the others, named one by one.
	if got := jsonOf(t, p.After); got != `{"allProviders":false,"providers":[{"provider":"Codex","allModels":false,"models":["gpt-saved"]},{"provider":"synth","allModels":false,"models":["s-saved"]}]}` {
		t.Fatalf("preview must show the explicit list: %s", got)
	}
	if got := jsonOf(t, p.Remove); got != `[{"provider":"Codex","models":["gpt-off","gpt-unsaved"]}]` {
		t.Fatalf("preview must name the models that stop being allowed: %s", got)
	}

	if code, _ := h.apply("vk-all", "replace-all-providers", "", p.PreviewToken, false); code != 428 || len(h.puts) != 0 {
		t.Fatalf("unconfirmed replacement was not refused: %d writes=%d", code, len(h.puts))
	}
	if code, _ := h.apply("vk-all", "replace-all-providers", "", "wrong", true); code != 409 || len(h.puts) != 0 {
		t.Fatalf("token mismatch was not refused: %d writes=%d", code, len(h.puts))
	}
	if code, body := h.apply("vk-all", "replace-all-providers", "", p.PreviewToken, true); code != 200 {
		t.Fatal(code, body)
	}
	want := `{"name":"Everything","description":"","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"provider":"Codex","weight":null,"allowed_models":["gpt-saved"],"blacklisted_models":[],"key_ids":["*"]},
		{"provider":"synth","weight":null,"allowed_models":["s-saved"],"blacklisted_models":[],"key_ids":["*"]}]}`
	var expected map[string]any
	if err := json.Unmarshal([]byte(want), &expected); err != nil {
		t.Fatal(err)
	}
	if len(h.puts) != 1 || !reflect.DeepEqual(h.puts[0], expected) {
		t.Fatalf("native write payload:\n got %v\nwant %s", h.puts, jsonOf(t, expected))
	}
	if state, ok := h.adoptionState(t, "vk-all"); state != "ready" || !ok {
		t.Fatal("the key must be adoptable after the replacement:", state, ok)
	}
}

func TestReplaceAllProvidersKeepsExistingRowsAndNeverWidensThem(t *testing.T) {
	h := newPermissionHarness(t)
	h.keys["vk-all"]["provider_configs"] = []any{
		map[string]any{"id": 9, "provider": "Codex", "allowed_models": []any{"gpt-saved"}, "blacklisted_models": []any{}, "allow_all_keys": true},
	}
	p := h.preview(t, "vk-all", "replace-all-providers", "")
	// The Codex row already limits Codex: it stays as it is, and only synth is added.
	if got := jsonOf(t, p.After); got != `{"allProviders":false,"providers":[{"provider":"Codex","allModels":false,"models":["gpt-saved"]},{"provider":"synth","allModels":false,"models":["s-saved"]}]}` {
		t.Fatal(got)
	}
	if len(p.Remove) != 0 {
		t.Fatalf("an existing row loses nothing: %+v", p.Remove)
	}
	if code, body := h.apply("vk-all", "replace-all-providers", "", p.PreviewToken, true); code != 200 {
		t.Fatal(code, body)
	}
	rows := h.puts[0]["provider_configs"].([]any)
	if first := rows[0].(map[string]any); first["id"] != float64(9) || first["provider"] != "Codex" {
		t.Fatalf("the existing row must keep its id: %s", jsonOf(t, rows))
	}
}

func TestNativeEditIsVerifiedByReadingTheKeyBack(t *testing.T) {
	h := newPermissionHarness(t)
	p := h.preview(t, "vk-hermes", "remove-models", "Mistral")
	h.ignorePut = true
	code, body := h.apply("vk-hermes", "remove-models", "Mistral", p.PreviewToken, true)
	if code != 502 || !strings.Contains(body, "native_readback") {
		t.Fatalf("a change Bifrost did not keep must be reported, not claimed: %d %s", code, body)
	}
}
