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
	// sharedModel makes synth serve gpt-saved too, the model Codex serves (a card exists for both).
	sharedModel bool
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
	"vk-star": {"id":"vk-star","name":"Star","description":"Star client","value":"sk-bf-star","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"id":8,"provider":"Codex","weight":0.5,"allowed_models":["*"],"blacklisted_models":[],"allow_all_keys":true,"budgets":[{"max_limit":10}]},
		{"id":10,"provider":"synth","allowed_models":["s-saved"],"blacklisted_models":[],"allow_all_keys":true}]},
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
			if h.sharedModel {
				return nativeResponse(200, `{"models":[{"name":"s-saved","provider":"synth","accessible_by_keys":["synth-key"]},{"name":"gpt-saved","provider":"synth","accessible_by_keys":["synth-key"]}],"total":2}`), nil
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
					// Like Bifrost 2.2.6, only the models the provider lists: an allowed but undiscovered name is not listed.
					for _, name := range row["allowed_models"].([]any) {
						id := row["provider"].(string) + "/" + name.(string)
						if id == "Codex/gpt-saved" || id == "Codex/gpt-unsaved" || id == "Codex/gpt-off" || id == "synth/s-saved" || h.sharedModel && id == "synth/gpt-saved" {
							ids = append(ids, id)
						}
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
		Provider    string   `json:"provider"`
		Models      []string `json:"models"`
		DropsLimits bool     `json:"dropsLimits,omitempty"`
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

// adopt runs the whole adoption (preview, then apply with its token) and returns the apply status.
func (h *permissionHarness) adopt(t *testing.T, keyID string) int {
	t.Helper()
	w := perform(h.server, "POST", "/api/keys/adopt", `{"keyId":"`+keyID+`","operation":"adopt","phase":"preview"}`, authorized())
	var p adoptionPreview
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil || !p.CanApply {
		t.Fatal("adoption is not offered:", w.Code, w.Body.String())
	}
	headers := authorized()
	headers["If-Match"] = p.Revision
	return perform(h.server, "POST", "/api/keys/adopt", `{"keyId":"`+keyID+`","operation":"adopt","phase":"apply","previewToken":"`+p.PreviewToken+`"}`, headers).Code
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
	if code := h.adopt(t, "vk-hermes"); code != 200 {
		t.Fatal("adoption after the removal failed:", code)
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
		{"replace all models needs a dynamic list", "vk-hermes", "replace-all-models", "Codex", 200, "does not allow every model"},
		{"replace all models needs a provider", "vk-star", "replace-all-models", "", 400, ""},
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

// Bifrost deletes a provider row a write leaves out, with its budgets and rate limit: the preview says so,
// and the token covers it, so the confirmation is for the whole loss.
func TestDroppingARowThatCarriesLimitsIsInThePreview(t *testing.T) {
	h := newPermissionHarness(t)
	plain := h.preview(t, "vk-hermes", "remove-models", "Mistral")
	if jsonOf(t, plain.Remove) != `[{"provider":"Mistral","models":["m-large","m-small"]}]` {
		t.Fatalf("a row without limits must not claim any: %s", jsonOf(t, plain.Remove))
	}
	row := h.keys["vk-hermes"]["provider_configs"].([]any)[0].(map[string]any)
	row["budgets"], row["rate_limit"] = []any{map[string]any{"max_limit": 10}}, map[string]any{"request_max_limit": 5}
	p := h.preview(t, "vk-hermes", "remove-models", "Mistral")
	if !p.CanApply || len(p.Remove) != 1 || !p.Remove[0].DropsLimits {
		t.Fatalf("the preview must say the dropped row takes its budget and rate limit with it: %+v", p)
	}
	if p.PreviewToken == plain.PreviewToken {
		t.Fatal("the token must cover the limits the row carries")
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
	if code := h.adopt(t, "vk-all"); code != 200 {
		t.Fatal("adoption after the replacement failed:", code)
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

func TestReplaceAllProvidersKeepsOneAccessPerModel(t *testing.T) {
	h := newPermissionHarness(t)
	h.sharedModel = true
	cfg := h.server.Store.Load().Config()
	cfg.Models = append(cfg.Models, registry.Model{ID: "synth-gpt-saved", Alias: "gpt-saved", Provider: "synth", ProviderKeyIDs: []string{"synth-key"}, UpstreamModel: "gpt-saved", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true})
	raw, _ := json.Marshal(cfg)
	if _, err := h.server.Store.Save(raw, h.server.Store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	// Both providers could hold gpt-saved, but a policy cannot hold two accesses of one model: Codex comes first.
	p := h.preview(t, "vk-all", "replace-all-providers", "")
	if got := jsonOf(t, p.After); got != `{"allProviders":false,"providers":[{"provider":"Codex","allModels":false,"models":["gpt-saved"]},{"provider":"synth","allModels":false,"models":["s-saved"]}]}` {
		t.Fatalf("one access per model: %s", got)
	}
	if got := jsonOf(t, p.Remove); got != `[{"provider":"Codex","models":["gpt-off","gpt-unsaved"]},{"provider":"synth","models":["gpt-saved"]}]` {
		t.Fatalf("the second access must be named as left out: %s", got)
	}
	if code, body := h.apply("vk-all", "replace-all-providers", "", p.PreviewToken, true); code != 200 {
		t.Fatal(code, body)
	}
	if code := h.adopt(t, "vk-all"); code != 200 {
		t.Fatal("the key must be adoptable once each model has one access:", code)
	}
}

// A provider row allowing every model ("*") is replaced by the models Registry holds a direct access for:
// the row keeps its id (so its budget and weight stay), and every model it stops allowing is named.
func TestReplaceAllModelsOfAProviderByTheModelsRegistryHolds(t *testing.T) {
	h := newPermissionHarness(t)
	if state, _ := h.adoptionState(t, "vk-star"); state != "blocked" {
		t.Fatal("the wildcard key must start blocked:", state)
	}
	p := h.preview(t, "vk-star", "replace-all-models", "Codex")
	if !p.CanApply || p.PreviewToken == "" || len(p.Blocked) != 0 {
		t.Fatalf("wrong preview: %+v", p)
	}
	if got := jsonOf(t, p.Before); got != `{"allProviders":false,"providers":[{"provider":"Codex","allModels":true,"models":[]},{"provider":"synth","allModels":false,"models":["s-saved"]}]}` {
		t.Fatalf("preview must show every model of Codex today: %s", got)
	}
	if got := jsonOf(t, p.After); got != `{"allProviders":false,"providers":[{"provider":"Codex","allModels":false,"models":["gpt-saved"]},{"provider":"synth","allModels":false,"models":["s-saved"]}]}` {
		t.Fatalf("preview must show the models Registry holds: %s", got)
	}
	// The row stays, so its budget stays: nothing claims otherwise.
	if got := jsonOf(t, p.Remove); got != `[{"provider":"Codex","models":["gpt-off","gpt-unsaved"]}]` {
		t.Fatalf("preview must name the models that stop being allowed: %s", got)
	}
	if code, _ := h.apply("vk-star", "replace-all-models", "Codex", p.PreviewToken, false); code != 428 || len(h.puts) != 0 {
		t.Fatalf("unconfirmed replacement was not refused: %d writes=%d", code, len(h.puts))
	}
	if code, _ := h.apply("vk-star", "replace-all-models", "Codex", "wrong", true); code != 409 || len(h.puts) != 0 {
		t.Fatalf("token mismatch was not refused: %d writes=%d", code, len(h.puts))
	}
	if code, body := h.apply("vk-star", "replace-all-models", "Codex", p.PreviewToken, true); code != 200 {
		t.Fatal(code, body)
	}
	want := `{"name":"Star","description":"Star client","is_active":true,"allow_all_providers":false,"provider_configs":[
		{"id":8,"provider":"Codex","weight":0.5,"allowed_models":["gpt-saved"],"blacklisted_models":[],"key_ids":["*"]},
		{"id":10,"provider":"synth","weight":null,"allowed_models":["s-saved"],"blacklisted_models":[],"key_ids":["*"]}]}`
	var expected map[string]any
	if err := json.Unmarshal([]byte(want), &expected); err != nil {
		t.Fatal(err)
	}
	if len(h.puts) != 1 || !reflect.DeepEqual(h.puts[0], expected) {
		t.Fatalf("native write payload:\n got %v\nwant %s", h.puts, jsonOf(t, expected))
	}
	if code := h.adopt(t, "vk-star"); code != 200 {
		t.Fatal("adoption after the replacement failed:", code)
	}
}

// A regex allows what Bifrost matches (a full, case-insensitive RE2 match): the replacement never widens it,
// and only the models it matched are named as left out.
func TestReplaceARegexAllowlistNeverWidensIt(t *testing.T) {
	h := newPermissionHarness(t)
	h.keys["vk-star"]["provider_configs"].([]any)[0].(map[string]any)["allowed_models"] = []any{"regex:GPT-(saved|unsaved)"}
	p := h.preview(t, "vk-star", "replace-all-models", "Codex")
	if got := jsonOf(t, p.Remove); got != `[{"provider":"Codex","models":["gpt-unsaved"]}]` {
		t.Fatalf("only what the regex matched can be left out: %s", got)
	}
	if got := jsonOf(t, p.After.Providers[0]); got != `{"provider":"Codex","allModels":false,"models":["gpt-saved"]}` {
		t.Fatal(got)
	}
	// Nothing Registry holds is matched: the row goes, and its budget with it.
	h.keys["vk-star"]["provider_configs"].([]any)[0].(map[string]any)["allowed_models"] = []any{"regex:gpt-(off|unsaved)"}
	p = h.preview(t, "vk-star", "replace-all-models", "Codex")
	if got := jsonOf(t, p.Remove); !p.CanApply || got != `[{"provider":"Codex","models":["gpt-off","gpt-unsaved"],"dropsLimits":true}]` || len(p.After.Providers) != 1 {
		t.Fatalf("an emptied row is dropped with its limits, and the preview says so: %s %+v", got, p.After)
	}
}

// One access per model: a model another row of the key already holds is left out of the replacement.
func TestReplaceAllModelsKeepsOneAccessPerModel(t *testing.T) {
	h := newPermissionHarness(t)
	h.sharedModel = true
	cfg := h.server.Store.Load().Config()
	cfg.Models = append(cfg.Models, registry.Model{ID: "synth-gpt-saved", Alias: "gpt-saved", Provider: "synth", ProviderKeyIDs: []string{"synth-key"}, UpstreamModel: "gpt-saved", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true})
	raw, _ := json.Marshal(cfg)
	if _, err := h.server.Store.Save(raw, h.server.Store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	h.keys["vk-star"]["provider_configs"] = []any{
		map[string]any{"id": 8, "provider": "Codex", "allowed_models": []any{"gpt-saved"}, "blacklisted_models": []any{}, "allow_all_keys": true},
		map[string]any{"id": 10, "provider": "synth", "allowed_models": []any{"*"}, "blacklisted_models": []any{}, "allow_all_keys": true},
	}
	p := h.preview(t, "vk-star", "replace-all-models", "synth")
	if got := jsonOf(t, p.Remove); got != `[{"provider":"synth","models":["gpt-saved"]}]` {
		t.Fatalf("the second access must be named as left out: %s", got)
	}
	if code, body := h.apply("vk-star", "replace-all-models", "synth", p.PreviewToken, true); code != 200 {
		t.Fatal(code, body)
	}
	if code := h.adopt(t, "vk-star"); code != 200 {
		t.Fatal("the key must be adoptable once each model has one access:", code)
	}
}

// Spec #85 (critique of the Hermes key): one model allowed through two providers is a decision, not a dead end.
// The blocker names both providers, and keeping either one in Bifrost adopts the rest; the readback reads verified.
func TestAliasCollisionIsResolvedByKeepingOneProviderNative(t *testing.T) {
	h := newPermissionHarness(t)
	h.sharedModel = true
	cfg := h.server.Store.Load().Config()
	cfg.Models = append(cfg.Models, registry.Model{ID: "synth-gpt-saved", Alias: "gpt-saved", Provider: "synth", ProviderKeyIDs: []string{"synth-key"}, UpstreamModel: "gpt-saved", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true})
	raw, _ := json.Marshal(cfg)
	if _, err := h.server.Store.Save(raw, h.server.Store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	h.keys["vk-plain"]["provider_configs"] = []any{
		map[string]any{"id": 11, "provider": "synth", "allowed_models": []any{"s-saved", "gpt-saved"}, "blacklisted_models": []any{}, "allow_all_keys": true},
		map[string]any{"id": 4, "provider": "Codex", "allowed_models": []any{"gpt-saved"}, "blacklisted_models": []any{}, "allow_all_keys": true},
	}
	preview := func(keep string) adoptionPreview {
		t.Helper()
		w := perform(h.server, "POST", "/api/keys/adopt", `{"keyId":"vk-plain","operation":"adopt","phase":"preview","keepNative":[`+keep+`]}`, authorized())
		var p adoptionPreview
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil {
			t.Fatal(w.Code, w.Body.String())
		}
		return p
	}
	blocked := preview("")
	if blocked.CanApply || len(blocked.Readiness.Blockers) != 1 || jsonOf(t, blocked.Readiness.Blockers[0]) != `{"provider":"Codex","kind":"collision","count":1,"models":["gpt-saved"],"reasons":["Model gpt-saved is allowed through synth/gpt-saved and Codex/gpt-saved: Registry adopts one access per model"],"with":["synth"]}` {
		t.Fatalf("a model allowed through two providers must be a collision naming both: %s", jsonOf(t, blocked.Readiness))
	}
	if p := preview(`"synth"`); !p.CanApply || strings.Join(p.SelectedRoutes, ",") != "Codex/gpt-saved" {
		t.Fatalf("keeping the first provider native must adopt the other: %+v", p)
	}
	p := preview(`"Codex"`)
	if !p.CanApply || strings.Join(p.SelectedRoutes, ",") != "synth/gpt-saved,synth/s-saved" || p.Readiness.State != "ready" {
		t.Fatalf("keeping the second provider native must adopt the first: %+v", p)
	}
	headers := authorized()
	headers["If-Match"] = p.Revision
	if w := perform(h.server, "POST", "/api/keys/adopt", `{"keyId":"vk-plain","operation":"adopt","phase":"apply","previewToken":"`+p.PreviewToken+`","keepNative":["Codex"]}`, headers); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if len(h.puts) != 0 {
		t.Fatal("adoption wrote to Bifrost")
	}
	read := perform(h.server, "POST", "/api/keys/vk-plain/readback", "", authorized())
	if !strings.Contains(read.Body.String(), `"state":"verified"`) {
		t.Fatalf("the adopted key must read verified: %s", read.Body.String())
	}
}

// Bifrost discovers no model of a provider it has disabled (no enabled key, or not listed at all): the blocker says so.
func TestUndiscoveredModelsOfADisabledProviderSaySo(t *testing.T) {
	h := newPermissionHarness(t)
	h.keys["vk-plain"]["provider_configs"] = []any{
		map[string]any{"id": 11, "provider": "synth", "allowed_models": []any{"s-saved", "s-ghost"}, "blacklisted_models": []any{}, "allow_all_keys": true},
		map[string]any{"id": 12, "provider": "Mistral", "allowed_models": []any{"m-large"}, "blacklisted_models": []any{}, "allow_all_keys": true},
	}
	w := perform(h.server, "POST", "/api/keys/adopt", `{"keyId":"vk-plain","operation":"adopt","phase":"preview"}`, authorized())
	var p adoptionPreview
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	off := map[string]bool{}
	for _, b := range p.Readiness.Blockers {
		off[b.Provider] = b.ProviderDisabled
	}
	if want := map[string]bool{"synth": false, "Mistral": true}; !reflect.DeepEqual(off, want) {
		t.Fatalf("disabled providers = %v, want %v (%s)", off, want, jsonOf(t, p.Readiness))
	}
	ws := perform(h.server, "GET", "/api/workspace", "", authorized())
	if !strings.Contains(ws.Body.String(), `"provider":"Mistral","kind":"undiscovered","count":1,"models":["m-large"],"providerDisabled":true`) {
		t.Fatal("the key card's readiness must say the provider is disabled too", ws.Body.String())
	}
}
