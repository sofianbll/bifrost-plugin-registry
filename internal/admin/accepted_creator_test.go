package admin

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"bifrost-registry/internal/registry"
)

func TestWorkspaceAcceptedCreatorSurvivesReload(t *testing.T) {
	for _, source := range []string{"inferred", "reference"} {
		for _, accepted := range []bool{false, true} {
			name := source + "/plain-save"
			if accepted {
				name = source + "/accepted"
			}
			t.Run(name, func(t *testing.T) {
				config := registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: []registry.Model{
					{ID: "claude", Alias: "claude", Provider: "provider", ProviderKeyIDs: []string{"key"}, UpstreamModel: "claude", Endpoints: []string{"chat/completions"}},
				}}
				if source == "reference" {
					config.Catalog = &registry.Catalog{
						References: []registry.CatalogReference{{ID: "known/claude", CatalogRecord: registry.CatalogRecord{Overrides: map[string]registry.CatalogValue{
							"creator": {Value: json.RawMessage(`"Reference Labs"`), Source: "manual", Kind: "declared"},
						}}}},
						Accesses: []registry.CatalogAccess{{ID: "provider/claude", Provider: "provider", Model: "claude", Configured: true, ReferenceID: "known/claude"}},
					}
				}
				initial, err := registry.Compile(config)
				if err != nil {
					t.Fatal(err)
				}
				path := filepath.Join(t.TempDir(), "registry.json")
				if err := os.WriteFile(path, initial.JSON(), 0600); err != nil {
					t.Fatal(err)
				}
				open := func() *Server {
					t.Helper()
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
					s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
						if r.Method != http.MethodGet {
							t.Fatalf("unexpected native write: %s %s", r.Method, r.URL.Path)
						}
						switch r.URL.Path {
						case "/api/version":
							return nativeResponse(200, `"2.2.6"`), nil
						case "/api/providers":
							return nativeResponse(200, `{"providers":[{"name":"provider"}]}`), nil
						case "/api/providers/provider/keys":
							return nativeResponse(200, `{"keys":[{"id":"key","enabled":true}]}`), nil
						case "/api/models":
							return nativeResponse(200, `{"models":[{"name":"claude","provider":"provider","accessible_by_keys":["key"]}],"total":1}`), nil
						case "/api/governance/virtual-keys":
							return nativeResponse(200, `{"virtual_keys":[],"total_count":0}`), nil
						case "/api/governance/pricing-overrides":
							return nativeResponse(200, `{"pricing_overrides":[]}`), nil
						}
						t.Fatalf("unexpected native read: %s", r.URL.Path)
						return nil, nil
					})
					return s
				}
				read := func(s *Server) workspace {
					t.Helper()
					res := perform(s, "GET", "/api/workspace", "", authorized())
					if res.Code != 200 {
						t.Fatalf("workspace GET: %d %s", res.Code, res.Body.String())
					}
					var ws workspace
					if err := json.Unmarshal(res.Body.Bytes(), &ws); err != nil {
						t.Fatal(err)
					}
					return ws
				}
				s := open()
				ws := read(s)
				if len(ws.Data.Models) != 1 || ws.Data.Models[0].CreatorSource != source {
					t.Fatalf("expected %s creator, got %+v", source, ws.Data.Models)
				}
				want := ws.Data.Models[0]
				if accepted {
					// The draft contract emitted by explicit creator acceptance, also used by the manual editor.
					want.Creator, want.CreatorSource = "Accepted Labs", "manual"
					ws.Data.Models[0] = want
				}
				body, err := json.Marshal(map[string]any{"data": ws.Data})
				if err != nil {
					t.Fatal(err)
				}
				headers := authorized()
				headers["If-Match"] = ws.Revision
				if res := perform(s, "PUT", "/api/workspace", string(body), headers); res.Code != 200 {
					t.Fatalf("workspace PUT: %d %s", res.Code, res.Body.String())
				}
				got := read(open()).Data.Models[0]
				if got.Creator != want.Creator || got.CreatorSource != want.CreatorSource {
					t.Fatalf("reloaded creator %q (%s), want %q (%s)", got.Creator, got.CreatorSource, want.Creator, want.CreatorSource)
				}
			})
		}
	}
}
