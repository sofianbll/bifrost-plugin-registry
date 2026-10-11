package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

// Subscriptions are custom providers (Claude, Codex, Google, Proxy) whose Bifrost base type names
// the first party; Proxy serves a base type with no creator.
func TestWorkspaceInfersCreatorFromSingleFirstPartyProvider(t *testing.T) {
	models := map[string][]string{"Claude": {"sonnet", "opus", "manual", "cleared", "shared", "later"}, "Codex": {"mini", "shared", "later"}, "Google": {"flash"}, "Proxy": {"plain"}}
	bases := map[string]string{"Claude": "anthropic", "Codex": "openai", "Google": "gemini", "Proxy": "bedrock"}
	creator := func(name string) registry.CatalogValue {
		return registry.CatalogValue{Value: json.RawMessage(`"` + name + `"`), Source: "manual", Kind: "declared"}
	}
	initial, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Catalog: &registry.Catalog{
		References: []registry.CatalogReference{{ID: "known/opus", CatalogRecord: registry.CatalogRecord{Overrides: map[string]registry.CatalogValue{"creator": creator("Reference Labs")}}}, {ID: "known/later", CatalogRecord: registry.CatalogRecord{Overrides: map[string]registry.CatalogValue{"creator": creator("Later Labs")}}}},
		Accesses:   []registry.CatalogAccess{{ID: "Claude/opus", Provider: "Claude", Model: "opus", Configured: true, ReferenceID: "known/opus"}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "registry.json")
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
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		provider := r.URL.Query().Get("provider")
		switch {
		case r.Method != http.MethodGet:
			t.Fatalf("unexpected native write: %s %s", r.Method, r.URL.Path)
		case r.URL.Path == "/api/version":
			return nativeResponse(200, `"2.2.3"`), nil
		case r.URL.Path == "/api/providers":
			rows := []string{}
			for name, base := range bases {
				rows = append(rows, fmt.Sprintf(`{"name":%q,"custom_provider_config":{"base_provider_type":%q}}`, name, base))
			}
			return nativeResponse(200, `{"providers":[`+strings.Join(rows, ",")+`]}`), nil
		case strings.HasSuffix(r.URL.Path, "/keys"):
			return nativeResponse(200, `{"keys":[{"id":"key","enabled":true}]}`), nil
		case r.URL.Path == "/api/models":
			rows := []string{}
			for _, name := range models[provider] {
				rows = append(rows, fmt.Sprintf(`{"name":%q,"provider":%q,"accessible_by_keys":["key"]}`, name, provider))
			}
			return nativeResponse(200, fmt.Sprintf(`{"models":[%s],"total":%d}`, strings.Join(rows, ","), len(rows))), nil
		case r.URL.Path == "/api/governance/virtual-keys":
			return nativeResponse(200, `{"virtual_keys":[],"total_count":0}`), nil
		case r.URL.Path == "/api/governance/pricing-overrides":
			return nativeResponse(200, `{"pricing_overrides":[]}`), nil
		}
		t.Fatalf("unexpected native read: %s", r.URL.Path)
		return nil, nil
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
	write := func(ws workspace) {
		t.Helper()
		body, _ := json.Marshal(map[string]any{"data": ws.Data})
		headers := authorized()
		headers["If-Match"] = ws.Revision
		if res := perform(s, "PUT", "/api/workspace", string(body), headers); res.Code != 200 {
			t.Fatalf("workspace PUT: %d %s", res.Code, res.Body.String())
		}
	}
	card := func(ws workspace, id string) *modelDTO {
		t.Helper()
		for i := range ws.Data.Models {
			if ws.Data.Models[i].ID == id {
				return &ws.Data.Models[i]
			}
		}
		t.Fatalf("no card %s", id)
		return nil
	}
	expect := func(ws workspace, id, creator, source string) {
		t.Helper()
		if got := card(ws, id); cleanUnknown(got.Creator) != creator || got.CreatorSource != source {
			t.Fatalf("%s: creator %q source %q, want %q %q", id, got.Creator, got.CreatorSource, creator, source)
		}
	}

	// Save every discovered model as a card, as the panel does; two cards carry their own value.
	ws := read()
	for _, m := range ws.Discovery {
		for i := range m.Accesses {
			m.Accesses[i].Endpoints = []string{"chat/completions"}
		}
		switch m.ID {
		case "later": // saved with its Claude access alone; a Codex access with a reference is added below
			m.Accesses = slices.DeleteFunc(m.Accesses, func(a accessDTO) bool { return a.Provider != "Claude" })
		case "manual":
			m.Creator = "Custom Creator"
		case "cleared":
			m.CreatorSource = "manual" // the panel's way to say "no creator, do not guess"
		}
		ws.Data.Models = append(ws.Data.Models, m)
	}
	write(ws)

	ws = read()
	expect(ws, "sonnet", "Anthropic", "inferred")
	expect(ws, "mini", "OpenAI", "inferred")
	expect(ws, "flash", "Google", "inferred")
	expect(ws, "shared", "", "")                      // two subscriptions: no single first party
	expect(ws, "plain", "", "")                       // a base type with no known creator
	expect(ws, "opus", "Reference Labs", "reference") // a reference always wins
	expect(ws, "manual", "Custom Creator", "manual")
	expect(ws, "cleared", "", "manual") // a clear is not guessed again
	expect(ws, "later", "Anthropic", "inferred")

	// Add to card: a second access that carries a reference. Its creator replaces the guess, whatever its position.
	later, labs := card(ws, "later"), "known/later"
	later.Accesses = append(later.Accesses, accessDTO{Provider: "Codex", ID: "Codex/later", NativeModel: "later", Route: "Direct provider", Status: "Configured", Endpoints: []string{"chat/completions"}, ReferenceID: &labs})
	write(ws)
	ws = read()
	expect(ws, "later", "Later Labs", "reference")

	// Saving what the panel read must not turn a guess into a stored value.
	write(ws)
	for _, m := range store.Load().Config().Models {
		var ui modelDTO
		_ = json.Unmarshal(m.Metadata["ui"], &ui)
		switch m.Alias {
		case "sonnet", "mini", "flash", "opus", "shared":
			if cleanUnknown(ui.Creator) != "" || ui.CreatorSource != "" {
				t.Fatalf("%s stored a derived creator: %+v", m.Alias, ui)
			}
		case "manual":
			if ui.Creator != "Custom Creator" || ui.CreatorSource != "" {
				t.Fatalf("manual creator changed: %+v", ui)
			}
		case "cleared":
			if cleanUnknown(ui.Creator) != "" || ui.CreatorSource != "manual" {
				t.Fatalf("cleared marker lost: %+v", ui)
			}
		}
	}
	ws = read()
	expect(ws, "sonnet", "Anthropic", "inferred")
	expect(ws, "cleared", "", "manual")

	// A manual correction overrides the guess, then clears it; a reference replaces it atomically.
	card(ws, "mini").Creator, card(ws, "mini").CreatorSource = "QA Labs", "manual"
	card(ws, "sonnet").Creator, card(ws, "sonnet").CreatorSource = "Unknown", "manual"
	reference := "known/opus"
	card(ws, "flash").Accesses[0].ReferenceID = &reference
	before := ws.Revision
	write(ws)
	ws = read()
	if ws.Revision == before {
		t.Fatal("association did not create a revision")
	}
	expect(ws, "mini", "QA Labs", "manual")
	expect(ws, "sonnet", "", "manual")
	expect(ws, "flash", "Reference Labs", "reference")
	if got := card(ws, "flash").Accesses[0].ReferenceID; got == nil || *got != reference {
		t.Fatalf("association was not saved with the card: %v", got)
	}
}
