package admin

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"bifrost-registry/internal/registry"
)

func TestWorkspaceModelSaveMapsReferenceInSameRevision(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.json")
	initial, err := registry.Compile(registry.Config{
		SchemaVersion: 1, DefaultNaming: "provider/model",
		Catalog: &registry.Catalog{
			References: []registry.CatalogReference{{ID: "known/gpt-6-sol"}},
			Accesses: []registry.CatalogAccess{{
				ID: "CLI PROXY/gpt-6-sol", Provider: "CLI PROXY", Model: "gpt-6-sol", Configured: true,
				CatalogRecord: registry.CatalogRecord{Overrides: map[string]registry.CatalogValue{
					"name": {Value: json.RawMessage(`"Manual name"`), Source: "manual", Kind: "declared"},
				}},
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
	nativeWrites := 0
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodGet {
			nativeWrites++
			t.Fatalf("unexpected native write: %s %s", r.Method, r.URL.Path)
		}
		switch r.URL.Path {
		case "/api/version":
			return nativeResponse(200, `"2.2.3"`), nil
		case "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"CLI PROXY"}]}`), nil
		case "/api/providers/CLI PROXY/keys":
			return nativeResponse(200, `{"keys":[{"id":"provider-key","enabled":true}]}`), nil
		case "/api/models":
			return nativeResponse(200, `{"models":[{"name":"gpt-6-sol","provider":"CLI PROXY","accessible_by_keys":["provider-key"]}],"total":1}`), nil
		case "/api/governance/virtual-keys":
			return nativeResponse(200, `{"virtual_keys":[],"total_count":0}`), nil
		default:
			t.Fatalf("unexpected native read: %s", r.URL.Path)
			return nil, nil
		}
	})
	read := func() workspace {
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
	write := func(ws workspace) int {
		t.Helper()
		body, err := json.Marshal(map[string]any{"data": ws.Data})
		if err != nil {
			t.Fatal(err)
		}
		headers := authorized()
		headers["If-Match"] = ws.Revision
		return perform(s, "PUT", "/api/workspace", string(body), headers).Code
	}
	catalog := func() catalogDTO {
		t.Helper()
		res := perform(s, "GET", "/api/catalog", "", authorized())
		if res.Code != 200 {
			t.Fatalf("catalog GET: %d %s", res.Code, res.Body.String())
		}
		var out catalogDTO
		if err := json.Unmarshal(res.Body.Bytes(), &out); err != nil {
			t.Fatal(err)
		}
		return out
	}
	ws := read()
	model := ws.Discovery[0]
	model.Kind = "Chat"
	ws.Data.Models = []modelDTO{model}
	if code := write(ws); code != 200 {
		t.Fatalf("custom model save: %d", code)
	}
	if got := catalog().Accesses[0]; got.ReferenceID != "" || got.MappingManual {
		t.Fatalf("custom model was matched without selection: %+v", got)
	}
	ws = read()
	if saved := ws.Data.Models[0]; saved.Tasks == nil || saved.InputModalities == nil || saved.OutputModalities == nil || saved.Capabilities == nil {
		t.Fatalf("workspace returned null model lists after catalog enrichment: %+v", saved)
	}
	if ws.Data.Models[0].Accesses[0].ReferenceID != nil {
		t.Fatal("unmapped access reported a reference")
	}
	chosen := "known/gpt-6-sol"
	ws.Data.Models[0].Accesses[0].ReferenceID = &chosen
	before := ws.Revision
	if code := write(ws); code != 200 {
		t.Fatalf("mapped model save: %d", code)
	}
	ws = read()
	got := catalog().Accesses[0]
	if ws.Revision == before || ws.Data.Models[0].Accesses[0].ReferenceID == nil || *ws.Data.Models[0].Accesses[0].ReferenceID != chosen || got.ReferenceID != chosen || !got.MappingManual || string(got.Overrides["name"]) != `"Manual name"` {
		t.Fatalf("model and mapping were not saved together: workspace=%+v access=%+v", ws.Data.Models[0].Accesses[0], got)
	}
	reopened, err := registry.OpenStore(path)
	if err != nil || reopened.Load().Config().Catalog.Accesses[0].ReferenceID != chosen {
		t.Fatalf("mapped revision did not persist: %v", err)
	}
	stale := ws
	unknown := "missing/reference"
	ws.Data.Models[0].Accesses[0].ReferenceID = &unknown
	if code := write(ws); code != 422 {
		t.Fatalf("unknown reference: %d", code)
	}
	if read().Revision != stale.Revision || catalog().Accesses[0].ReferenceID != chosen || nativeWrites != 0 {
		t.Fatal("rejected mapping changed Registry or native state")
	}
	ws = stale
	ws.Data.Models[0].Accesses[0].ReferenceID = nil
	if code := write(ws); code != 200 {
		t.Fatalf("omitted reference: %d", code)
	}
	if got := catalog().Accesses[0]; got.ReferenceID != chosen || !got.MappingManual {
		t.Fatal("omitted reference changed mapping", got)
	}
	if code := write(stale); code != 409 {
		t.Fatalf("stale revision: %d", code)
	}
	ws = read()
	empty := ""
	ws.Data.Models[0].Accesses[0].ReferenceID = &empty
	if code := write(ws); code != 200 {
		t.Fatalf("explicit unlink: %d", code)
	}
	if got := catalog().Accesses[0]; got.ReferenceID != "" || !got.MappingManual {
		t.Fatal("explicit unlink did not persist", got)
	}
	cfg := store.Load().Config()
	cfg.Catalog.Accesses = nil
	raw, err := json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save(raw, store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	ws = read()
	ws.Data.Models[0].Accesses[0].ReferenceID = &chosen
	if code := write(ws); code != 200 {
		t.Fatalf("new catalog access mapping: %d", code)
	}
	if got := catalog().Accesses[0]; got.ID != "CLI PROXY/gpt-6-sol" || !got.Configured || got.ReferenceID != chosen || !got.MappingManual {
		t.Fatal("mapped access was not created from native discovery", got)
	}
	cfg = store.Load().Config()
	cfg.Catalog.Accesses[0].MappingManual = false
	raw, err = json.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save(raw, store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	ws = read()
	if code := write(ws); code != 200 || catalog().Accesses[0].MappingManual {
		t.Fatal("echoed reference changed automatic provenance")
	}
}
