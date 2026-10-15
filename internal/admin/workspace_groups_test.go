package admin

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

func TestWorkspacePreservesHiddenGroupRules(t *testing.T) {
	for _, tc := range []struct {
		name  string
		group registry.Group
	}{
		{"exclusion", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{"a", "b"}, Exclude: []string{"b"}}},
		{"filter", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{}, Filter: &registry.Filter{Creators: []string{"Creator"}}}},
		{"inferred-filter", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{}, Filter: &registry.Filter{Creators: []string{"Creator"}}}},
		{"capability-filter", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{}, Filter: &registry.Filter{Capabilities: []string{"tools"}}}},
		{"reference-creator-filter", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{}, Filter: &registry.Filter{Creators: []string{"Creator"}}}},
		{"reference-family-filter", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{}, Filter: &registry.Filter{Families: []string{"Family"}}}},
		{"combined", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{"a", "b"}, Filter: &registry.Filter{Creators: []string{"Creator"}}, Exclude: []string{"b"}}},
		{"simple", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{"a"}}},
		{"partial-access", registry.Group{ID: "group", Name: "Group", ModelIDs: []string{"a"}}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: []registry.Model{
				{ID: "a", Alias: "a", Provider: "alpha", UpstreamModel: "native-a", ProviderKeyIDs: []string{"key"}, Creator: "Creator", Enabled: true, Configured: true, Endpoints: []string{"chat/completions"}},
				{ID: "b", Alias: "b", Provider: "alpha", UpstreamModel: "native-b", ProviderKeyIDs: []string{"key"}, Creator: "Other", Enabled: true, Configured: true, Endpoints: []string{"chat/completions"}},
			}, Groups: []registry.Group{tc.group}, Policies: []registry.Policy{{VirtualKeyID: "vk", Name: "Key", TokenSHA256: registry.TokenHash("synthetic-key"), Groups: []string{"group"}, Enabled: true}}}
			if tc.name == "partial-access" {
				cfg.Models[1].Alias = "a"
				cfg.Models[1].Provider = "beta"
			}
			if tc.name == "inferred-filter" {
				cfg.Models[1].Creator = ""
			}
			if tc.name == "capability-filter" {
				cfg.Models[0].Capabilities = []string{"tools"}
			}
			if strings.HasPrefix(tc.name, "reference-") {
				field, value := "creator", "Creator"
				cfg.Models[1].Creator = ""
				if tc.name == "reference-family-filter" {
					field, value = "family", "Family"
					cfg.Models[0].Family = value
				}
				rawValue, _ := json.Marshal(value)
				cfg.Catalog = &registry.Catalog{Accesses: []registry.CatalogAccess{{ID: "alpha/native-b", Provider: "alpha", Model: "native-b", Configured: true, CatalogRecord: registry.CatalogRecord{Overrides: map[string]registry.CatalogValue{field: {Value: rawValue, Source: "manual", Kind: "declared"}}}}}}
			}
			raw, _ := json.Marshal(cfg)
			path := filepath.Join(t.TempDir(), "registry.json")
			if err := os.WriteFile(path, raw, 0600); err != nil {
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
			if err := s.ConnectBifrost("http://bifrost.local", ""); err != nil {
				t.Fatal(err)
			}
			writes := 0
			var applied map[string]any
			s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
				if r.Method != http.MethodGet {
					writes++
				}
				switch r.URL.Path {
				case "/api/providers":
					return nativeResponse(200, `{"providers":[{"name":"alpha"},{"name":"beta"}]}`), nil
				case "/api/providers/alpha/keys", "/api/providers/beta/keys":
					return nativeResponse(200, `{"keys":[{"id":"key"}]}`), nil
				case "/api/models":
					if r.URL.Query().Get("provider") == "beta" {
						return nativeResponse(200, `{"models":[{"name":"native-b","provider":"beta","accessible_by_keys":["key"]}],"total":1}`), nil
					}
					return nativeResponse(200, `{"models":[{"name":"native-a","provider":"alpha","accessible_by_keys":["key"]},{"name":"native-b","provider":"alpha","accessible_by_keys":["key"]},{"name":"native-c","provider":"alpha","accessible_by_keys":["key"]}],"total":3}`), nil
				case "/api/governance/virtual-keys":
					return nativeResponse(200, `{"virtual_keys":[{"id":"vk","name":"Key","is_active":true}]}`), nil
				case "/api/governance/virtual-keys/vk":
					if err := json.NewDecoder(r.Body).Decode(&applied); err != nil {
						t.Fatal(err)
					}
					return nativeResponse(200, `{}`), nil
				case "/api/governance/pricing-overrides":
					return nativeResponse(200, `{"pricing_overrides":[]}`), nil
				case "/api/providers/alpha/keys/key", "/api/providers/beta/keys/key":
					return nativeResponse(200, `{"aliases":{}}`), nil
				case "/api/version":
					return nativeResponse(200, `"2.2.6"`), nil
				default:
					t.Fatalf("unexpected native route %s", r.URL.Path)
					return nil, nil
				}
			})
			get := func() workspace {
				t.Helper()
				w := perform(s, "GET", "/api/workspace", "", authorized())
				var ws workspace
				if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &ws) != nil {
					t.Fatalf("GET: %d %s", w.Code, w.Body.String())
				}
				return ws
			}
			ws := get()
			if tc.name != "simple" && !ws.Data.Groups[0].MembersLocked {
				t.Fatal("hidden group rules are not disclosed to the panel")
			}
			originalRevision := ws.Revision
			ws.Data.Keys[0].Client = "Unrelated description"
			put := func(ws workspace, status int) {
				t.Helper()
				body, _ := json.Marshal(map[string]any{"data": ws.Data})
				h := authorized()
				h["If-Match"] = ws.Revision
				w := perform(s, "PUT", "/api/workspace", string(body), h)
				if w.Code != status {
					t.Fatalf("PUT: want %d got %d %s", status, w.Code, w.Body.String())
				}
				if status == 422 && !strings.Contains(w.Body.String(), "Group") {
					t.Fatalf("missing group explanation: %s", w.Body.String())
				}
			}
			put(ws, 200)
			if got := store.Load().Config().Groups[0]; !reflect.DeepEqual(got, tc.group) {
				t.Fatalf("group rules lost: got %+v want %+v", got, tc.group)
			}
			reopened, err := registry.OpenStore(path)
			if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(reopened.Load().Config().Groups[0], tc.group) {
				t.Fatal("persisted rules differ")
			}
			if got := applied["provider_configs"]; !strings.Contains(strings.TrimSpace(toJSON(t, got)), `"allowed_models":["a"]`) || strings.Contains(toJSON(t, got), `"b"`) {
				t.Fatalf("native selection changed: %v", got)
			}
			ws = get()
			before, nativeWrites := store.Load().Revision(), writes
			stale := ws
			stale.Revision = originalRevision + "stale"
			put(stale, 409)
			if tc.name != "simple" {
				ws.Data.Groups[0].Members = []string{}
				if tc.group.Filter != nil && len(tc.group.ModelIDs) == 0 {
					ws.Data.Groups[0].Members = []string{"b"}
				}
				ws.Data.Groups[0].MembersLocked = false // clients cannot bypass the server guard
				put(ws, 422)
				if len(tc.group.Exclude) > 0 {
					ws = get()
					ws.Data.Models = ws.Data.Models[:1]
					put(ws, 422)
					ws = get()
					ws.Data.Models[1].ID = "renamed"
					ws.Data.Models[1].Accesses[0].ID = "alpha/renamed"
					ws.Data.Groups[0].Members[1] = "renamed"
					put(ws, 422)
					ws = get()
					ws.Data.Models[1].Accesses[0].NativeModel = "native-c"
					put(ws, 422)
				}
			}
			if store.Load().Revision() != before || writes != nativeWrites {
				t.Fatal("rejected request wrote state or native permissions")
			}
		})
	}
}

func toJSON(t *testing.T, value any) string {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return string(raw)
}
