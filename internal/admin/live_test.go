package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"sync"
	"testing"

	"bifrost-registry/internal/registry"
)

type nativeRoundTrip func(*http.Request) (*http.Response, error)

func (f nativeRoundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func nativeResponse(status int, body string) *http.Response {
	return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{"Content-Type": []string{"application/json"}}}
}

func TestLiveWorkspacePublishAndReadback(t *testing.T) {
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}
	secret := "sk-bf-live-secret"
	keyID := "vk-native"
	nativeKey := `{"id":"vk-native","name":"Hermes","description":"Hermes","value":"sk-bf-live-secret","is_active":true,"provider_configs":[]}`
	var applied map[string]any
	failApply, failKeyRead, failVersion := false, false, false
	actual := `{"data":[{"id":"CLI PROXY/gpt-6-sol"}]}`
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "bifrost.local" {
			t.Fatal("unexpected upstream", r.URL.String())
		}
		switch r.URL.Path {
		case "/api/version":
			if failVersion {
				return nativeResponse(503, `{}`), nil
			}
			return nativeResponse(200, `"2.2.3"`), nil
		case "/api/providers":
			if r.Header.Get("Authorization") != "Bearer native-admin" {
				t.Fatal("missing native admin authorization")
			}
			return nativeResponse(200, `{"providers":[{"name":"CLI PROXY"}],"total":1}`), nil
		case "/api/providers/CLI PROXY/keys":
			return nativeResponse(200, `{"keys":[{"id":"provider-key","enabled":true},{"id":"disabled-key","enabled":false}],"total":2}`), nil
		case "/api/models":
			if r.URL.Query().Get("provider") != "CLI PROXY" || r.URL.Query().Get("keys") != "provider-key" || r.URL.Query().Get("limit") != "100" || r.URL.Query().Get("offset") != "0" {
				t.Fatal("incorrect native model filter", r.URL.String())
			}
			return nativeResponse(200, `{"models":[{"name":"gpt-6-sol","provider":"CLI PROXY","accessible_by_keys":["provider-key"]}],"total":1}`), nil
		case "/api/governance/pricing-overrides":
			return nativeResponse(200, `{"pricing_overrides":[]}`), nil
		case "/api/governance/virtual-keys":
			if r.Method == "POST" {
				var input map[string]any
				_ = json.NewDecoder(r.Body).Decode(&input)
				if input["allow_all_providers"] != false || len(input["provider_configs"].([]any)) != 0 {
					t.Fatal("native key must start denied", input)
				}
				return nativeResponse(200, `{"virtual_key":`+nativeKey+`}`), nil
			}
			return nativeResponse(200, `{"virtual_keys":[`+nativeKey+`],"total_count":1}`), nil
		case "/api/governance/virtual-keys/" + keyID:
			if r.Method == "PUT" {
				if failApply {
					return nativeResponse(503, `{}`), nil
				}
				_ = json.NewDecoder(r.Body).Decode(&applied)
				// Bifrost VK responses embed TableKey: numeric database id, UUID key_id.
				nativeKey = `{"id":"vk-native","name":"Hermes","description":"Hermes","value":"sk-bf-live-secret","is_active":true,"provider_configs":[{"id":3,"provider":"CLI PROXY","keys":[{"id":7,"key_id":"provider-key"}],"allowed_models":["gpt-6-sol"]}]}`
				return nativeResponse(200, `{"virtual_key":`+nativeKey+`}`), nil
			}
			if failKeyRead {
				return nativeResponse(503, `{}`), nil
			}
			return nativeResponse(200, `{"virtual_key":`+nativeKey+`}`), nil
		case "/v1/models":
			if r.Header.Get("Authorization") != "Bearer "+secret {
				t.Fatal("wrong readback key")
			}
			return nativeResponse(200, actual), nil
		default:
			t.Fatal("unexpected native route", r.URL.String())
			return nil, nil
		}
	})
	create := perform(s, "POST", "/api/keys", `{"name":"Hermes","client":"Hermes"}`, authorized())
	if create.Code != 201 {
		t.Fatal(create.Code, create.Body.String())
	}
	var created struct {
		Workspace workspace `json:"workspace"`
		Created   struct {
			ID     string `json:"id"`
			Secret string `json:"secret"`
		} `json:"created"`
	}
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Created.ID != keyID || created.Created.Secret != secret {
		t.Fatal("native key creation missing secret")
	}
	get := perform(s, "GET", "/api/workspace", "", authorized())
	if get.Code != 200 || strings.Contains(get.Body.String(), secret) {
		t.Fatal("workspace leaked secret", get.Code)
	}
	var ws workspace
	if err := json.Unmarshal(get.Body.Bytes(), &ws); err != nil {
		t.Fatal(err)
	}
	if len(ws.Discovery) != 1 || ws.Discovery[0].Accesses[0].ID != "CLI PROXY/gpt-6-sol" || !ws.Data.Keys[0].Managed || ws.Connection.Version != "2.2.3" {
		t.Fatal("discovery or managed key missing")
	}
	if status := perform(s, "GET", "/api/status", "", authorized()); status.Code != 200 || !strings.Contains(status.Body.String(), `"bifrost_connected":true`) {
		t.Fatal("status disagrees with workspace.connection", status.Code, status.Body.String())
	}
	failVersion = true
	if unavailable := perform(s, "GET", "/api/workspace", "", authorized()); unavailable.Code != 200 || !strings.Contains(unavailable.Body.String(), `"version":"unknown"`) {
		t.Fatal("version failure blocked workspace", unavailable.Code, unavailable.Body.String())
	}
	failVersion = false
	model := ws.Discovery[0]
	model.Kind = "Chat"
	model.Accesses[0].Endpoints = []string{"chat/completions"}
	model.Tasks = []string{"Chat"}
	model.InputModalities = []string{"Text"}
	model.OutputModalities = []string{"Text"}
	ws.Data.Models = append(ws.Data.Models, model)
	ws.Data.Groups = []groupDTO{{ID: "code", Name: "Code", Members: []string{"gpt-6-sol"}}}
	ws.Data.Keys[0].Policy.Groups = []string{"code"}
	input, _ := json.Marshal(map[string]any{"data": ws.Data})
	h := authorized()
	h["If-Match"] = ws.Revision
	put := perform(s, "PUT", "/api/workspace", string(input), h)
	if put.Code != 200 {
		t.Fatal(put.Code, put.Body.String())
	}
	pcs, ok := applied["provider_configs"].([]any)
	if !ok || len(pcs) != 1 {
		t.Fatal("native provider permissions missing", applied)
	}
	pc := pcs[0].(map[string]any)
	if pc["provider"] != "CLI PROXY" || pc["allowed_models"].([]any)[0] != "gpt-6-sol" {
		t.Fatal("wrong native allowlist", pc)
	}
	var nativeShape nativeVK
	if err := json.Unmarshal([]byte(nativeKey), &nativeShape); err != nil || len(nativeShape.ProviderConfigs) != 1 || nativeShape.ProviderConfigs[0].keyIDs()[0] != "provider-key" {
		t.Fatal("native database ID was confused with provider key UUID", err)
	}
	check := perform(s, "POST", "/api/keys/"+keyID+"/readback", "", authorized())
	if check.Code != 200 {
		t.Fatal(check.Code, check.Body.String())
	}
	var checked workspace
	_ = json.Unmarshal(check.Body.Bytes(), &checked)
	if checked.Data.Keys[0].Publication.State != "verified" || checked.Data.Keys[0].Publication.Revision != checked.Revision {
		t.Fatal("publication unverified", check.Body.String())
	}
	verified := checked.Data.Keys[0].Publication
	cfg := s.Store.Load().Config()
	cfg.DefaultNaming = "both"
	raw, _ := json.Marshal(cfg)
	h["If-Match"] = checked.Revision
	rawPut := perform(s, "PUT", "/api/config", string(raw), h)
	if rawPut.Code != 200 {
		t.Fatal("raw config change failed", rawPut.Code, rawPut.Body.String())
	}
	get = perform(s, "GET", "/api/workspace", "", authorized())
	if err := json.Unmarshal(get.Body.Bytes(), &checked); err != nil {
		t.Fatal(err)
	}
	stale := checked.Data.Keys[0].Publication
	if get.Code != 200 || stale.State != "not_verified" || stale.Revision != checked.Revision || stale.Revision == verified.Revision ||
		stale.Error != "Registry configuration changed; readback required" || stale.CheckedAt != "" ||
		stale.ObservedAt != verified.ObservedAt || stale.ObservedRevision != verified.ObservedRevision ||
		strings.Join(stale.Actual, ",") != strings.Join(verified.Actual, ",") {
		t.Fatal("raw config change retained verified state or lost historical observation", get.Body.String())
	}
	failKeyRead = true
	check = perform(s, "POST", "/api/keys/"+keyID+"/readback", "", authorized())
	_ = json.Unmarshal(check.Body.Bytes(), &checked)
	if check.Code != 200 || checked.Data.Keys[0].Publication.State != "not_verified" || len(checked.Data.Keys[0].Publication.Actual) != 1 || checked.Data.Keys[0].Publication.ObservedAt == "" {
		t.Fatal("failed key read did not invalidate proof or retain observation", check.Body.String())
	}
	failKeyRead = false
	actual = `{"data":[{"id":"unexpected"}]}`
	check = perform(s, "POST", "/api/keys/"+keyID+"/readback", "", authorized())
	_ = json.Unmarshal(check.Body.Bytes(), &checked)
	p := checked.Data.Keys[0].Publication
	if p.State != "drift" || len(p.Missing) != 1 || len(p.Unexpected) != 1 {
		t.Fatal("drift not detected", check.Body.String())
	}
	actual = `{"data":[{"id":"CLI PROXY/gpt-6-sol"},{"id":"CLI PROXY/gpt-6-sol"}]}`
	check = perform(s, "POST", "/api/keys/"+keyID+"/readback", "", authorized())
	_ = json.Unmarshal(check.Body.Bytes(), &checked)
	if checked.Data.Keys[0].Publication.State != "not_verified" || len(checked.Data.Keys[0].Publication.Actual) != 1 {
		t.Fatal("duplicate ids were silently accepted")
	}
	checked.Data.Groups[0].Name = "Code changed"
	input, _ = json.Marshal(map[string]any{"data": checked.Data})
	h["If-Match"] = checked.Revision
	failApply = true
	put = perform(s, "PUT", "/api/workspace", string(input), h)
	if put.Code != 502 || !strings.Contains(put.Body.String(), `"phase":"native_apply"`) {
		t.Fatal("partial native failure not reported", put.Code, put.Body.String())
	}
	get = perform(s, "GET", "/api/workspace", "", authorized())
	_ = json.Unmarshal(get.Body.Bytes(), &checked)
	if checked.Data.Keys[0].Publication.State != "not_verified" || checked.Data.Keys[0].Publication.Revision != checked.Revision {
		t.Fatal("partial native failure retained stale proof", get.Body.String())
	}
}

func TestStatusReportsUnreachableBifrost(t *testing.T) {
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", ""); err != nil {
		t.Fatal(err)
	}
	s.live.client.http.Transport = nativeRoundTrip(func(*http.Request) (*http.Response, error) { return nativeResponse(503, `{}`), nil })
	if w := perform(s, "GET", "/api/status", "", authorized()); w.Code != 200 || !strings.Contains(w.Body.String(), `"bifrost_connected":false`) {
		t.Fatal("configured but unreachable Bifrost reported connected", w.Code, w.Body.String())
	}
}

func TestWorkspacePreservesPerAccessEndpointsAndRequiresExplicitChoices(t *testing.T) {
	s := setup(t)
	initial, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: []registry.Model{
		{ID: "access-alpha", Alias: "shared", Provider: "alpha", ProviderKeyIDs: []string{"key-alpha"}, UpstreamModel: "native-alpha", Endpoints: []string{"responses"}, Enabled: true, Configured: true},
		{ID: "access-beta", Alias: "shared", Provider: "beta", ProviderKeyIDs: []string{"key-beta"}, UpstreamModel: "native-beta", Endpoints: []string{"chat/completions", "decisions"}, Enabled: true, Configured: true},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Store.Save(initial.JSON(), s.Store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	s.ConnectBifrost("http://bifrost.local", "Bearer native-admin")
	nativeWrites := 0
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodGet {
			nativeWrites++
		}
		switch r.URL.Path {
		case "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"alpha"},{"name":"beta"},{"name":"gamma"}]}`), nil
		case "/api/providers/alpha/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-alpha"}]}`), nil
		case "/api/providers/beta/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-beta"}]}`), nil
		case "/api/providers/gamma/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-gamma"}]}`), nil
		case "/api/models":
			models := map[string]string{"alpha": `{"name":"native-alpha","provider":"alpha","accessible_by_keys":["key-alpha"]}`, "beta": `{"name":"native-beta","provider":"beta","accessible_by_keys":["key-beta"]}`, "gamma": `{"name":"native-gamma","provider":"gamma","accessible_by_keys":["key-gamma"]}`}
			return nativeResponse(200, `{"models":[`+models[r.URL.Query().Get("provider")]+`] ,"total":1}`), nil
		case "/api/governance/virtual-keys":
			return nativeResponse(200, `{"virtual_keys":[],"total_count":0}`), nil
		case "/api/governance/pricing-overrides":
			return nativeResponse(200, `{"pricing_overrides":[]}`), nil
		case "/api/version":
			return nativeResponse(200, `"2.2.3"`), nil
		default:
			if strings.HasPrefix(r.URL.Path, "/api/providers/") && strings.Contains(r.URL.Path, "/keys/") {
				if r.Method == http.MethodGet {
					return nativeResponse(200, `{"aliases":{}}`), nil
				}
				if r.Method == http.MethodPut {
					return nativeResponse(200, `{}`), nil
				}
			}
			t.Fatalf("unexpected native route %s", r.URL.Path)
			return nil, nil
		}
	})

	read := perform(s, "GET", "/api/workspace", "", authorized())
	var ws workspace
	if read.Code != 200 || json.Unmarshal(read.Body.Bytes(), &ws) != nil || len(ws.Data.Models) != 1 {
		t.Fatalf("workspace read: %d %s", read.Code, read.Body.String())
	}
	model := ws.Data.Models[0]
	if model.Kind != "Unknown" || len(model.Accesses) != 2 {
		t.Fatalf("legacy model reconstruction: %#v", model)
	}
	for i := range model.Accesses {
		switch model.Accesses[i].Provider {
		case "alpha":
			if strings.Join(model.Accesses[i].Endpoints, ",") != "responses" {
				t.Fatalf("alpha endpoints: %#v", model.Accesses[i].Endpoints)
			}
			model.Accesses[i].Endpoints = nil
		case "beta":
			if strings.Join(model.Accesses[i].Endpoints, ",") != "chat/completions,decisions" {
				t.Fatalf("beta endpoints: %#v", model.Accesses[i].Endpoints)
			}
			model.Accesses[i].Endpoints = nil
		}
	}
	ws.Data.Models = []modelDTO{model}
	putWorkspaceBody := func(body []byte, revision string) *httptest.ResponseRecorder {
		h := authorized()
		h["If-Match"] = revision
		return perform(s, "PUT", "/api/workspace", string(body), h)
	}
	legacyBody, _ := json.Marshal(map[string]any{"data": ws.Data})
	var legacyPayload map[string]any
	_ = json.Unmarshal(legacyBody, &legacyPayload)
	legacyModels := legacyPayload["data"].(map[string]any)["models"].([]any)
	legacyAccesses := legacyModels[0].(map[string]any)["accesses"].([]any)
	for _, access := range legacyAccesses {
		delete(access.(map[string]any), "endpoints")
	}
	legacyBody, _ = json.Marshal(legacyPayload)
	put := putWorkspaceBody(legacyBody, ws.Revision)
	if put.Code != 200 {
		t.Fatalf("legacy round trip: %d %s", put.Code, put.Body.String())
	}
	var saved workspace
	if json.Unmarshal(put.Body.Bytes(), &saved) != nil {
		t.Fatal("invalid saved workspace")
	}
	got := map[string][]string{}
	for _, access := range saved.Data.Models[0].Accesses {
		got[access.Provider] = access.Endpoints
	}
	if strings.Join(got["alpha"], ",") != "responses" || strings.Join(got["beta"], ",") != "chat/completions,decisions" {
		t.Fatalf("per-access endpoints changed: %#v", got)
	}

	before := saved.Revision
	nativeWrites = 0
	ws.Revision = before
	for name, endpoints := range map[string][]string{"empty": {}, "unknown": {"decisions-typo"}, "duplicate": {"responses", "responses"}} {
		t.Run(name, func(t *testing.T) {
			candidate := saved
			candidate.Data.Models = append([]modelDTO(nil), saved.Data.Models...)
			candidate.Data.Models[0].Accesses = append([]accessDTO(nil), saved.Data.Models[0].Accesses...)
			candidate.Data.Models[0].Accesses[0].Endpoints = endpoints
			body, _ := json.Marshal(map[string]any{"data": candidate.Data})
			invalid := putWorkspaceBody(body, ws.Revision)
			if invalid.Code != 422 || s.Store.Load().Revision() != before || nativeWrites != 0 {
				t.Fatalf("invalid selection mutated Registry: %d %s", invalid.Code, invalid.Body.String())
			}
		})
	}
	var nullPayload map[string]any
	_ = json.Unmarshal(legacyBody, &nullPayload)
	models := nullPayload["data"].(map[string]any)["models"].([]any)
	accesses := models[0].(map[string]any)["accesses"].([]any)
	accesses[0].(map[string]any)["endpoints"] = nil
	nullBody, _ := json.Marshal(nullPayload)
	if invalid := putWorkspaceBody(nullBody, ws.Revision); invalid.Code != 422 || s.Store.Load().Revision() != before || nativeWrites != 0 {
		t.Fatalf("explicit null endpoints accepted: %d %s", invalid.Code, invalid.Body.String())
	}
	var unknownPayload map[string]any
	_ = json.Unmarshal(legacyBody, &unknownPayload)
	unknownModels := unknownPayload["data"].(map[string]any)["models"].([]any)
	unknownAccesses := unknownModels[0].(map[string]any)["accesses"].([]any)
	unknownAccesses[0].(map[string]any)["unexpected"] = true
	unknownBody, _ := json.Marshal(unknownPayload)
	if invalid := putWorkspaceBody(unknownBody, ws.Revision); invalid.Code != 400 || s.Store.Load().Revision() != before || nativeWrites != 0 {
		t.Fatalf("unknown access field accepted: %d %s", invalid.Code, invalid.Body.String())
	}
	newAccess := saved
	newAccess.Data.Models = append([]modelDTO(nil), saved.Data.Models...)
	newAccess.Data.Models[0].Accesses = append([]accessDTO(nil), saved.Data.Models[0].Accesses...)
	newAccess.Data.Models[0].Accesses = append(newAccess.Data.Models[0].Accesses, accessDTO{Provider: "gamma", ID: "gamma/shared", NativeModel: "native-gamma", Route: "Direct provider", Status: "Configured"})
	newAccessBody, _ := json.Marshal(map[string]any{"data": newAccess.Data})
	var newAccessPayload map[string]any
	_ = json.Unmarshal(newAccessBody, &newAccessPayload)
	newModels := newAccessPayload["data"].(map[string]any)["models"].([]any)
	newAccesses := newModels[0].(map[string]any)["accesses"].([]any)
	delete(newAccesses[2].(map[string]any), "endpoints")
	newAccessBody, _ = json.Marshal(newAccessPayload)
	if invalid := putWorkspaceBody(newAccessBody, ws.Revision); invalid.Code != 422 || s.Store.Load().Revision() != before || nativeWrites != 0 {
		t.Fatalf("new access without endpoints accepted: %d %s", invalid.Code, invalid.Body.String())
	}
}

// Issue #53: the panel flags a v0.1.3 policy whose alias has two accesses and no
// access_selection, can still save that workspace, refuses new ambiguity, and
// publishes the alias once the admin keeps one access.
func TestWorkspaceSavesLegacyAmbiguityAndResolvesIt(t *testing.T) {
	legacy, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: []registry.Model{
		{ID: "shared-a", Alias: "shared", Provider: "alpha", ProviderKeyIDs: []string{"key-alpha"}, UpstreamModel: "native-shared-a", Endpoints: []string{"chat/completions"}, Enabled: true, Verified: true, Evidence: "v0.1.3"},
		{ID: "shared-b", Alias: "shared", Provider: "beta", ProviderKeyIDs: []string{"key-beta"}, UpstreamModel: "native-shared-b", Endpoints: []string{"chat/completions"}, Enabled: true, Verified: true, Evidence: "v0.1.3"},
		{ID: "solo", Alias: "solo", Provider: "alpha", ProviderKeyIDs: []string{"key-alpha"}, UpstreamModel: "native-solo", Endpoints: []string{"chat/completions"}, Enabled: true, Verified: true, Evidence: "v0.1.3"},
	}, Groups: []registry.Group{{ID: "all", Name: "All", ModelIDs: []string{"shared-a", "shared-b", "solo"}}}, Policies: []registry.Policy{
		{VirtualKeyID: "vk-legacy", Name: "Legacy", TokenSHA256: registry.TokenHash("sk-bf-legacy"), Naming: "both", Groups: []string{"all"}, Prefer: map[string]string{"shared": "shared-a"}, Enabled: true},
		{VirtualKeyID: "vk-other", Name: "Other", TokenSHA256: registry.TokenHash("sk-bf-other"), Groups: []string{}, Enabled: true},
	}})
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(registry.MemoryStore(legacy), adminToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	s.ConnectBifrost("http://bifrost.local", "Bearer native-admin")
	applied := map[string]map[string]any{}
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		switch r.URL.Path {
		case "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"alpha"},{"name":"beta"}]}`), nil
		case "/api/providers/alpha/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-alpha"}]}`), nil
		case "/api/providers/beta/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-beta"}]}`), nil
		case "/api/models":
			models := map[string]string{"alpha": `[{"name":"native-shared-a","provider":"alpha","accessible_by_keys":["key-alpha"]},{"name":"native-solo","provider":"alpha","accessible_by_keys":["key-alpha"]}],"total":2`, "beta": `[{"name":"native-shared-b","provider":"beta","accessible_by_keys":["key-beta"]}],"total":1`}
			return nativeResponse(200, `{"models":`+models[r.URL.Query().Get("provider")]+`}`), nil
		case "/api/governance/virtual-keys":
			return nativeResponse(200, `{"virtual_keys":[{"id":"vk-legacy","name":"Legacy","is_active":true},{"id":"vk-other","name":"Other","is_active":true}]}`), nil
		case "/api/governance/virtual-keys/vk-legacy", "/api/governance/virtual-keys/vk-other":
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			applied[strings.TrimPrefix(r.URL.Path, "/api/governance/virtual-keys/")] = body
			return nativeResponse(200, `{}`), nil
		case "/api/governance/pricing-overrides":
			return nativeResponse(200, `{"pricing_overrides":[]}`), nil
		case "/api/version":
			return nativeResponse(200, `"2.2.6"`), nil
		default:
			if strings.HasPrefix(r.URL.Path, "/api/providers/") && strings.Contains(r.URL.Path, "/keys/") {
				return nativeResponse(200, `{"aliases":{}}`), nil
			}
			t.Fatalf("unexpected native route %s", r.URL.Path)
			return nil, nil
		}
	})
	keyByID := func(ws workspace, id string) *keyDTO {
		for i := range ws.Data.Keys {
			if ws.Data.Keys[i].ID == id {
				return &ws.Data.Keys[i]
			}
		}
		t.Fatalf("missing key %s", id)
		return nil
	}
	put := func(ws workspace) (*httptest.ResponseRecorder, workspace) {
		body, _ := json.Marshal(map[string]any{"data": ws.Data})
		h := authorized()
		h["If-Match"] = ws.Revision
		w := perform(s, "PUT", "/api/workspace", string(body), h)
		var out workspace
		_ = json.Unmarshal(w.Body.Bytes(), &out)
		return w, out
	}

	read := perform(s, "GET", "/api/workspace", "", authorized())
	var ws workspace
	if read.Code != 200 || json.Unmarshal(read.Body.Bytes(), &ws) != nil {
		t.Fatalf("workspace read: %d %s", read.Code, read.Body.String())
	}
	if got := keyByID(ws, "vk-legacy").PendingAccessSelection; !reflect.DeepEqual(got, map[string][]string{"shared": {"alpha/shared", "beta/shared"}}) {
		t.Fatalf("legacy ambiguity not flagged: %#v", got)
	}
	if got := keyByID(ws, "vk-other").PendingAccessSelection; got != nil {
		t.Fatalf("unrelated key flagged: %#v", got)
	}

	w, saved := put(ws)
	if w.Code != 200 || keyByID(saved, "vk-legacy").PendingAccessSelection == nil {
		t.Fatalf("legacy workspace could not be saved as is: %d %s", w.Code, w.Body.String())
	}

	ambiguous := saved
	ambiguous.Data.Keys = append([]keyDTO(nil), saved.Data.Keys...)
	keyByID(ambiguous, "vk-other").Policy.Groups = []string{"all"}
	if w, _ := put(ambiguous); w.Code != 422 || !strings.Contains(w.Body.String(), "policy vk-other: model shared has 2 accesses; add access_selection") {
		t.Fatalf("new ambiguity accepted: %d %s", w.Code, w.Body.String())
	}

	keyByID(saved, "vk-legacy").Policy.AccessSelection = map[string]registry.AccessSelector{"shared": {Excluded: []string{"beta/shared"}}}
	w, resolved := put(saved)
	if w.Code != 200 || keyByID(resolved, "vk-legacy").PendingAccessSelection != nil {
		t.Fatalf("access choice not saved: %d %s", w.Code, w.Body.String())
	}
	if pcs := fmt.Sprint(applied["vk-legacy"]["provider_configs"]); !strings.Contains(pcs, "allowed_models:[shared solo]") || strings.Contains(pcs, "beta") {
		t.Fatalf("native allowlist does not follow the chosen access: %s", pcs)
	}
	if prefer := s.Store.Load().Config().Policies[0].Prefer["shared"]; prefer != registryID("alpha", "native-shared-a") {
		t.Fatalf("v0.1 preference not carried to the rebuilt access ID: %q", prefer)
	}
}

func TestNativeModelsUsesExactEnabledProviderKeys(t *testing.T) {
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.Header.Get("Authorization") != "Bearer native-admin" {
			t.Fatal("missing native admin authorization")
		}
		switch r.URL.Path {
		case "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"CLI PROXY"}]}`), nil
		case "/api/providers/CLI PROXY/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-a","enabled":true},{"id":"key-b"},{"id":"key-disabled","enabled":false}]}`), nil
		case "/api/models":
			if r.URL.Query().Get("keys") == "" {
				return nativeResponse(200, `{"models":[{"name":"one","provider":"CLI PROXY"},{"name":"two","provider":"CLI PROXY"}],"total":2}`), nil
			}
			if r.URL.Query().Get("provider") != "CLI PROXY" || r.URL.Query().Get("keys") != "key-a,key-b" || r.URL.Query().Get("limit") != "100" || r.URL.Query().Get("offset") != "0" {
				t.Fatal("model query does not contain exactly the enabled keys", r.URL.String())
			}
			return nativeResponse(200, `{"models":[{"name":"one","provider":"CLI PROXY","accessible_by_keys":["key-a","key-b"]},{"name":"two","provider":"CLI PROXY","accessible_by_keys":["key-b"]}],"total":2}`), nil
		default:
			t.Fatal("unexpected native route", r.URL.String())
			return nil, nil
		}
	})
	models, err := s.nativeModels(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(models) != 2 || strings.Join(models[0].AccessibleByKeys, ",") != "key-a,key-b" || strings.Join(models[1].AccessibleByKeys, ",") != "key-b" {
		t.Fatal("native per-key access mapping lost", models)
	}
}

func TestBuiltUIAssetsStayWithinDirectory(t *testing.T) {
	s := setup(t)
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "assets"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<h1>Registry</h1>"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "app.js"), []byte("console.log(1)"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := s.UseUIDirectory(dir); err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]int{"/": 200, "/assets/app.js": 200, "/assets/": 404, "/.env": 404, "/assets/missing.js": 404} {
		got := perform(s, "GET", path, "", nil)
		if got.Code != want {
			t.Fatalf("%s: %d", path, got.Code)
		}
	}
	outside := filepath.Join(t.TempDir(), "secret")
	_ = os.WriteFile(outside, []byte("private"), 0600)
	if err := os.Symlink(outside, filepath.Join(dir, "assets", "secret")); err != nil {
		t.Fatal(err)
	}
	if got := perform(s, "GET", "/assets/secret", "", nil); got.Code != 404 {
		t.Fatal("symlink escaped UI directory")
	}
}

func TestKeySecretReturnedAfterPartialCreate(t *testing.T) {
	for _, phase := range []string{"bind", "refresh"} {
		t.Run(phase, func(t *testing.T) {
			s := setup(t)
			if phase == "bind" {
				path := filepath.Join(t.TempDir(), "registry.json")
				if err := os.WriteFile(path, s.Store.Load().JSON(), 0600); err != nil {
					t.Fatal(err)
				}
				store, err := registry.OpenStore(path)
				if err != nil {
					t.Fatal(err)
				}
				s.Store = store
				if err := os.Remove(path); err != nil {
					t.Fatal(err)
				}
			}
			if err := s.ConnectBifrost("http://bifrost.local", ""); err != nil {
				t.Fatal(err)
			}
			s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
				switch r.URL.Path {
				case "/api/governance/virtual-keys":
					return nativeResponse(200, `{"virtual_key":{"id":"new-vk","name":"Hermes","value":"sk-bf-once"}}`), nil
				case "/api/providers":
					return nativeResponse(503, `{}`), nil
				default:
					t.Fatal("unexpected route", r.URL.Path)
					return nil, nil
				}
			})
			out := perform(s, "POST", "/api/keys", `{"name":"Hermes","client":"Hermes"}`, authorized())
			if out.Code != 201 || !strings.Contains(out.Body.String(), `"secret":"sk-bf-once"`) {
				t.Fatal("created secret lost", out.Code, out.Body.String())
			}
			if phase == "bind" && !strings.Contains(out.Body.String(), `"bindingError"`) {
				t.Fatal("missing binding state", out.Body.String())
			}
			if phase == "refresh" && !strings.Contains(out.Body.String(), `"refreshError"`) {
				t.Fatal("missing refresh state", out.Body.String())
			}
		})
	}
}

func TestInstallAliasesRepostsFullNativeKey(t *testing.T) {
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}
	snap, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model",
		Models: []registry.Model{
			{ID: "access-alpha", Alias: "shared", Provider: "alpha", ProviderKeyIDs: []string{"key-alpha"},
				UpstreamModel: "native-alpha", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true},
		}})
	if err != nil {
		t.Fatal(err)
	}
	var putBody string
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/api/providers/alpha/keys/key-alpha" {
			t.Fatalf("unexpected native route %s", r.URL.Path)
		}
		if r.Method == http.MethodGet {
			// "shared" uses the legacy string wire shape Bifrost re-emits for
			// rich aliases that carry only model_id; it must compare equal.
			return nativeResponse(200, `{"id":"key-alpha","name":"Alpha","value":"masked-preview","models":["*"],"aliases":{"legacy":"old-model","shared":"native-alpha"}}`), nil
		}
		if r.Method == http.MethodPut {
			body, _ := io.ReadAll(r.Body)
			putBody = string(body)
			return nativeResponse(200, `{}`), nil
		}
		t.Fatalf("unexpected native method %s", r.Method)
		return nil, nil
	})
	if err := s.installAliases(context.Background(), snap); err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`"value":"masked-preview"`, `"name":"Alpha"`, `"legacy"`, `"shared"`, `"native-alpha"`} {
		if !strings.Contains(putBody, want) {
			t.Fatalf("alias PUT lost %s: %s", want, putBody)
		}
	}
}

func TestPricingOverridesIdempotentSync(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.json")
	initial, err := registry.Compile(registry.Config{
		SchemaVersion: 1, DefaultNaming: "provider/model",
		Catalog: &registry.Catalog{
			Accesses: []registry.CatalogAccess{{
				ID: "CLI PROXY/gpt-6-sol", Provider: "CLI PROXY", Model: "gpt-6-sol", Configured: true,
			}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, initial.JSON(), 0600); err != nil {
		t.Fatal(err)
	}
	store, err := registry.OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(store, adminToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}

	type overrideState struct {
		sync.Mutex
		overrides map[string]nativePricingOverride
		nextID    int
		calls     []string
		mismatch  bool
	}
	state := &overrideState{overrides: map[string]nativePricingOverride{}, nextID: 1}

	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		state.Lock()
		defer state.Unlock()

		if r.Header.Get("Authorization") != "Bearer native-admin" {
			t.Fatal("missing native admin authorization")
		}

		record := func(method, path string) {
			state.calls = append(state.calls, method+" "+path)
		}

		switch {
		case r.URL.Path == "/api/version":
			return nativeResponse(200, `"2.2.3"`), nil
		case r.URL.Path == "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"CLI PROXY"}]}`), nil
		case r.URL.Path == "/api/providers/CLI PROXY/keys":
			return nativeResponse(200, `{"keys":[{"id":"provider-key","enabled":true}]}`), nil
		case r.URL.Path == "/api/models":
			return nativeResponse(200, `{"models":[{"name":"gpt-6-sol","provider":"CLI PROXY","accessible_by_keys":["provider-key"]}],"total":1}`), nil
		case r.URL.Path == "/api/governance/virtual-keys":
			return nativeResponse(200, `{"virtual_keys":[],"total_count":0}`), nil
		case strings.HasPrefix(r.URL.Path, "/api/governance/pricing-overrides"):
			record(r.Method, r.URL.Path)
			switch r.Method {
			case http.MethodGet:
				keyID := r.URL.Query().Get("provider_key_id")
				out := []nativePricingOverride{}
				for _, o := range state.overrides {
					if o.KeyID == keyID {
						out = append(out, o)
					}
				}
				sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
				body, _ := json.Marshal(map[string]any{"pricing_overrides": out})
				return nativeResponse(200, string(body)), nil
			case http.MethodPost:
				var body nativePricingOverride
				_ = json.NewDecoder(r.Body).Decode(&body)
				body.ID = fmt.Sprintf("po-%d", state.nextID)
				state.nextID++
				if state.mismatch {
					body.Patch = map[string]any{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}
				}
				state.overrides[body.Name] = body
				resp, _ := json.Marshal(map[string]any{"pricing_override": body})
				return nativeResponse(200, string(resp)), nil
			case http.MethodPut:
				id := strings.TrimPrefix(r.URL.Path, "/api/governance/pricing-overrides/")
				var body nativePricingOverride
				_ = json.NewDecoder(r.Body).Decode(&body)
				for name, o := range state.overrides {
					if o.ID == id {
						o.Name = body.Name
						o.ScopeKind = body.ScopeKind
						o.Provider = body.Provider
						o.KeyID = body.KeyID
						o.MatchType = body.MatchType
						o.Pattern = body.Pattern
						o.Patch = body.Patch
						if state.mismatch {
							o.Patch = map[string]any{"input_cost_per_token": 0.0, "output_cost_per_token": 0.0}
						}
						state.overrides[name] = o
						resp, _ := json.Marshal(map[string]any{"pricing_override": o})
						return nativeResponse(200, string(resp)), nil
					}
				}
				return nativeResponse(404, `{}`), nil
			case http.MethodDelete:
				id := strings.TrimPrefix(r.URL.Path, "/api/governance/pricing-overrides/")
				for name, o := range state.overrides {
					if o.ID == id {
						delete(state.overrides, name)
						return nativeResponse(200, `{}`), nil
					}
				}
				return nativeResponse(404, `{}`), nil
			}
		}
		t.Fatal("unexpected native route", r.URL.String())
		return nil, nil
	})

	seedExternalOverride := func() {
		state.Lock()
		state.overrides["external/custom"] = nativePricingOverride{
			ID: "po-external", Name: "external/custom", ScopeKind: "provider_key",
			Provider: "CLI PROXY", KeyID: "provider-key", MatchType: "exact",
			Pattern: "gpt-6-sol", Patch: map[string]any{"input_cost_per_token": 9e-6},
		}
		state.Unlock()
	}

	wsGet := perform(s, "GET", "/api/workspace", "", authorized())
	if wsGet.Code != 200 {
		t.Fatal(wsGet.Code, wsGet.Body.String())
	}
	var ws workspace
	if err := json.Unmarshal(wsGet.Body.Bytes(), &ws); err != nil {
		t.Fatal(err)
	}
	model := ws.Discovery[0]
	model.Kind = "Chat"
	model.Accesses[0].Endpoints = []string{"chat/completions"}
	ws.Data.Models = []modelDTO{model}

	putWorkspace := func(ws workspace, overrides []catalogOverrideInput) *httptest.ResponseRecorder {
		t.Helper()
		body := map[string]any{"data": ws.Data}
		if overrides != nil {
			body["catalogOverrides"] = overrides
		}
		raw, _ := json.Marshal(body)
		headers := authorized()
		headers["If-Match"] = ws.Revision
		return perform(s, "PUT", "/api/workspace", string(raw), headers)
	}
	readWorkspace := func() workspace {
		t.Helper()
		res := perform(s, "GET", "/api/workspace", "", authorized())
		if res.Code != 200 {
			t.Fatal("workspace GET:", res.Code, res.Body.String())
		}
		var out workspace
		if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out
	}

	seedExternalOverride()
	res := putWorkspace(ws, []catalogOverrideInput{
		{Target: "access", ID: "CLI PROXY/gpt-6-sol", Field: "input_cost_usd_per_million", Value: json.RawMessage(`1.5`)},
		{Target: "access", ID: "CLI PROXY/gpt-6-sol", Field: "output_cost_usd_per_million", Value: json.RawMessage(`3`)},
	})
	if res.Code != 200 {
		t.Fatal("first pricing override save failed", res.Code, res.Body.String())
	}

	state.Lock()
	if len(state.overrides) != 2 {
		t.Fatalf("expected 2 overrides (1 external + 1 registry), got %+v", state.overrides)
	}
	po := state.overrides["registry/CLI PROXY/provider-key/gpt-6-sol"]
	state.Unlock()
	if po.Name != "registry/CLI PROXY/provider-key/gpt-6-sol" || po.Provider != "" || po.KeyID != "provider-key" || po.Pattern != "gpt-6-sol" || po.ScopeKind != "provider_key" || po.MatchType != "exact" {
		t.Fatalf("unexpected override shape: %+v", po)
	}
	in, _ := po.Patch["input_cost_per_token"].(float64)
	out, _ := po.Patch["output_cost_per_token"].(float64)
	if math.Abs(in-0.0000015) > 1e-12 || math.Abs(out-0.000003) > 1e-12 {
		t.Fatalf("unexpected patch values: %+v", po.Patch)
	}

	verified := s.live.proofs["registry/CLI PROXY/provider-key/gpt-6-sol"]
	if verified.State != "verified" || verified.Error != "" {
		t.Fatalf("successful pricing sync should leave a verified proof, got %+v", verified)
	}
	wsVerified := readWorkspace()
	foundVerified := false
	for _, p := range wsVerified.PricingProofs {
		if p.Access == "CLI PROXY/gpt-6-sol" {
			foundVerified = true
			if p.State != "verified" {
				t.Fatalf("workspace should expose verified pricing proof, got %+v", p)
			}
		}
	}
	if !foundVerified {
		t.Fatalf("verified pricing proof missing from workspace DTO: %+v", wsVerified.PricingProofs)
	}

	ws2 := readWorkspace()
	res = putWorkspace(ws2, nil)
	if res.Code != 200 {
		t.Fatal("unchanged save failed", res.Code, res.Body.String())
	}
	state.Lock()
	if len(state.calls) < 2 || !strings.HasPrefix(state.calls[len(state.calls)-2], "PUT /api/governance/pricing-overrides/") || !strings.HasPrefix(state.calls[len(state.calls)-1], "GET /api/governance/pricing-overrides") {
		t.Fatalf("expected PUT then GET on unchanged save, got calls %v", state.calls)
	}
	postCount := 0
	for _, c := range state.calls {
		if strings.HasPrefix(c, "POST /api/governance/pricing-overrides") {
			postCount++
		}
	}
	if postCount != 1 {
		t.Fatalf("expected exactly one POST, got calls %v", state.calls)
	}
	state.Unlock()

	catHeaders := authorized()
	catHeaders["If-Match"] = res.Header().Get("ETag")
	res = perform(s, "PUT", "/api/catalog/override", `{"target":"access","id":"CLI PROXY/gpt-6-sol","field":"input_cost_usd_per_million","value":null}`, catHeaders)
	if res.Code != 200 {
		t.Fatal("failed to remove input price override", res.Code, res.Body.String())
	}
	ws3 := readWorkspace()
	state.Lock()
	state.calls = nil
	state.Unlock()
	res = putWorkspace(ws3, nil)
	if res.Code != 200 {
		t.Fatal("save after removing input override failed", res.Code, res.Body.String())
	}
	state.Lock()
	po, ok := state.overrides["registry/CLI PROXY/provider-key/gpt-6-sol"]
	if !ok {
		t.Fatal("registry override was deleted while output price correction remains")
	}
	if _, ok := po.Patch["input_cost_per_token"]; ok {
		t.Fatal("input price patch was not removed")
	}
	if _, ok := po.Patch["output_cost_per_token"]; !ok {
		t.Fatal("output price patch missing")
	}
	if _, ok := state.overrides["external/custom"]; !ok {
		t.Fatal("external override was touched")
	}
	state.Unlock()

	catHeaders["If-Match"] = res.Header().Get("ETag")
	res = perform(s, "PUT", "/api/catalog/override", `{"target":"access","id":"CLI PROXY/gpt-6-sol","field":"output_cost_usd_per_million","value":null}`, catHeaders)
	if res.Code != 200 {
		t.Fatal("failed to remove output price override", res.Code, res.Body.String())
	}
	ws4 := readWorkspace()
	state.Lock()
	state.calls = nil
	state.Unlock()
	res = putWorkspace(ws4, nil)
	if res.Code != 200 {
		t.Fatal("save after removing all price overrides failed", res.Code, res.Body.String())
	}
	state.Lock()
	if _, ok := state.overrides["registry/CLI PROXY/provider-key/gpt-6-sol"]; ok {
		t.Fatal("registry override was not deleted after all price corrections removed")
	}
	if _, ok := state.overrides["external/custom"]; !ok {
		t.Fatal("external override was touched")
	}
	state.Unlock()

	ws5 := readWorkspace()
	for _, bad := range []json.RawMessage{json.RawMessage(`-1`), json.RawMessage(`"NaN"`)} {
		state.Lock()
		state.calls = nil
		state.Unlock()
		res = putWorkspace(ws5, []catalogOverrideInput{{Target: "access", ID: "CLI PROXY/gpt-6-sol", Field: "input_cost_usd_per_million", Value: bad}})
		if res.Code != 422 {
			t.Fatalf("invalid cost %q should be rejected, got %d", bad, res.Code)
		}
		state.Lock()
		for _, c := range state.calls {
			if strings.Contains(c, "/api/governance/pricing-overrides") {
				t.Fatalf("invalid cost triggered native pricing call: %s", c)
			}
		}
		state.Unlock()
	}

	ws6 := readWorkspace()
	state.Lock()
	state.mismatch = true
	state.calls = nil
	state.Unlock()
	res = putWorkspace(ws6, []catalogOverrideInput{
		{Target: "access", ID: "CLI PROXY/gpt-6-sol", Field: "input_cost_usd_per_million", Value: json.RawMessage(`1.5`)},
	})
	if res.Code != 200 {
		t.Fatal("save with readback mismatch should not fail", res.Code, res.Body.String())
	}
	proof := s.live.proofs["registry/CLI PROXY/provider-key/gpt-6-sol"]
	if proof.Error == "" {
		t.Fatal("readback mismatch not recorded in proofs")
	}

	wsFinal := readWorkspace()
	found := false
	for _, p := range wsFinal.PricingProofs {
		if p.Access == "CLI PROXY/gpt-6-sol" {
			found = true
			if p.State != "not_verified" || p.Error == "" {
				t.Fatalf("pricing proof in workspace missing error state: %+v", p)
			}
		}
	}
	if !found {
		t.Fatalf("pricing proof not exposed in workspace DTO: %+v", wsFinal.PricingProofs)
	}
}
