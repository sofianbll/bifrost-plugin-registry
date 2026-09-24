package admin

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
	failVersion = true
	if unavailable := perform(s, "GET", "/api/workspace", "", authorized()); unavailable.Code != 200 || !strings.Contains(unavailable.Body.String(), `"version":"unknown"`) {
		t.Fatal("version failure blocked workspace", unavailable.Code, unavailable.Body.String())
	}
	failVersion = false
	model := ws.Discovery[0]
	model.Kind = "Chat"
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
