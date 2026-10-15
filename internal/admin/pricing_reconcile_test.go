package admin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

const reconcileOverrideName = "registry/provider/provider-key/model"

// Only the external Bifrost API is replaced; workspace saves and publication use
// the real store, compiler, HTTP handlers and pricing reconciler.
type pricingReconcileFixture struct {
	t          *testing.T
	server     *Server
	path       string
	overrides  map[string]nativePricingOverride
	posts      int
	failList   string
	failDelete bool
}

func newPricingReconcileFixture(t *testing.T) *pricingReconcileFixture {
	t.Helper()
	f := &pricingReconcileFixture{t: t, path: filepath.Join(t.TempDir(), "registry.json"), overrides: map[string]nativePricingOverride{}}
	snap, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Catalog: &registry.Catalog{
		Accesses: []registry.CatalogAccess{{ID: "provider/model", Provider: "provider", Model: "model", Configured: true}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(f.path, snap.JSON(), 0600); err != nil {
		t.Fatal(err)
	}
	f.restart()
	ws := f.read()
	m := ws.Discovery[0]
	m.Accesses[0].Endpoints = []string{"chat/completions"}
	ws.Data.Models = []modelDTO{m}
	f.save(ws, []catalogOverrideInput{{Target: "access", ID: "provider/model", Field: "input_cost_usd_per_million", Value: json.RawMessage(`1.5`)}})
	if got, ok := f.overrides[reconcileOverrideName]; !ok || got.Patch["input_cost_per_token"] != 0.0000015 {
		t.Fatalf("initial publication did not write native correction: %+v", f.overrides)
	}
	return f
}

func (f *pricingReconcileFixture) restart() {
	f.t.Helper()
	store, err := registry.OpenStore(f.path)
	if err != nil {
		f.t.Fatal(err)
	}
	f.server, err = New(store, adminToken, nil)
	if err != nil {
		f.t.Fatal(err)
	}
	if err := f.server.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		f.t.Fatal(err)
	}
	f.server.live.client.http.Transport = nativeRoundTrip(f.roundTrip)
}

func (f *pricingReconcileFixture) roundTrip(r *http.Request) (*http.Response, error) {
	if r.Header.Get("Authorization") != "Bearer native-admin" {
		f.t.Fatal("missing native admin authorization")
	}
	switch r.URL.Path {
	case "/api/version":
		return nativeResponse(200, `"2.2.6"`), nil
	case "/api/providers":
		return nativeResponse(200, `{"providers":[{"name":"provider"}]}`), nil
	case "/api/providers/provider/keys":
		return nativeResponse(200, `{"keys":[{"id":"provider-key","enabled":true}]}`), nil
	case "/api/models":
		return nativeResponse(200, `{"models":[{"name":"model","provider":"provider","accessible_by_keys":["provider-key"]}],"total":1}`), nil
	case "/api/governance/virtual-keys":
		return nativeResponse(200, `{"virtual_keys":[],"total_count":0}`), nil
	}
	if strings.HasPrefix(r.URL.Path, "/api/governance/pricing-overrides") {
		switch r.Method {
		case http.MethodGet:
			if f.failList == "all" || (f.failList == "key" && r.URL.Query().Get("provider_key_id") != "") {
				return nativeResponse(503, `{"error":"pricing unavailable"}`), nil
			}
			out := []nativePricingOverride{}
			for _, o := range f.overrides {
				if key := r.URL.Query().Get("provider_key_id"); key == "" || o.KeyID == key {
					out = append(out, o)
				}
			}
			raw, err := json.Marshal(map[string]any{"pricing_overrides": out})
			if err != nil {
				f.t.Fatal(err)
			}
			return nativeResponse(200, string(raw)), nil
		case http.MethodPost, http.MethodPut:
			var o nativePricingOverride
			if err := json.NewDecoder(r.Body).Decode(&o); err != nil {
				f.t.Fatal(err)
			}
			if r.Method == http.MethodPost {
				f.posts++
				o.ID = fmt.Sprintf("po-%d", f.posts)
			} else {
				o.ID = strings.TrimPrefix(r.URL.Path, "/api/governance/pricing-overrides/")
			}
			f.overrides[o.Name] = o
			return nativeResponse(200, `{}`), nil
		case http.MethodDelete:
			if f.failDelete {
				return nativeResponse(503, `{"error":"delete unavailable"}`), nil
			}
			id := strings.TrimPrefix(r.URL.Path, "/api/governance/pricing-overrides/")
			for name, o := range f.overrides {
				if o.ID == id {
					delete(f.overrides, name)
					return nativeResponse(200, `{}`), nil
				}
			}
			return nativeResponse(404, `{}`), nil
		}
	}
	f.t.Fatalf("unexpected native request: %s %s", r.Method, r.URL)
	return nil, nil
}

func (f *pricingReconcileFixture) read() workspace {
	f.t.Helper()
	res := perform(f.server, "GET", "/api/workspace", "", authorized())
	if res.Code != 200 {
		f.t.Fatal(res.Code, res.Body.String())
	}
	var ws workspace
	if err := json.Unmarshal(res.Body.Bytes(), &ws); err != nil {
		f.t.Fatal(err)
	}
	return ws
}

func (f *pricingReconcileFixture) save(ws workspace, overrides []catalogOverrideInput) workspace {
	f.t.Helper()
	raw, err := json.Marshal(map[string]any{"data": ws.Data, "catalogOverrides": overrides})
	if err != nil {
		f.t.Fatal(err)
	}
	headers := authorized()
	headers["If-Match"] = ws.Revision
	res := perform(f.server, "PUT", "/api/workspace", string(raw), headers)
	if res.Code != 200 {
		f.t.Fatal(res.Code, res.Body.String())
	}
	return f.read()
}

func TestPricingReconcileLastAccessRemoved(t *testing.T) {
	f := newPricingReconcileFixture(t)
	ws := f.read()
	ws.Data.Models = nil
	ws = f.save(ws, nil)
	if _, ok := f.overrides[reconcileOverrideName]; ok {
		t.Fatal("last access removed but Registry native pricing override remains")
	}
	if len(ws.Data.Models) != 0 || len(ws.PricingProofs) != 0 {
		t.Fatalf("removed access still has models or pricing proofs: %+v", ws)
	}
}

func TestPricingReconcileAfterRestartPreservesForeignOverrides(t *testing.T) {
	f := newPricingReconcileFixture(t)
	foreign := map[string]nativePricingOverride{}
	for i, tc := range []struct {
		name, scope, key, match, pattern, provider string
	}{
		{"external/custom", "provider_key", "provider-key", "exact", "model", ""},
		{"registry/manual", "provider_key", "provider-key", "exact", "model", ""},
		{"registry/provider/provider-key/global", "global", "provider-key", "exact", "global", ""},
		{"registry/provider/provider-key/wildcard", "provider_key", "provider-key", "wildcard", "wildcard", ""},
		{"registry/provider/provider-key/pattern", "provider_key", "provider-key", "exact", "another-model", ""},
		{"registry/provider/another-key/key", "provider_key", "provider-key", "exact", "key", ""},
		{"registry/provider/provider-key/provider", "provider_key", "provider-key", "exact", "provider", "another-provider"},
		{"registry//provider-key/empty", "provider_key", "provider-key", "exact", "empty", ""},
	} {
		o := nativePricingOverride{ID: fmt.Sprintf("foreign-%d", i), Name: tc.name, ScopeKind: tc.scope, KeyID: tc.key, MatchType: tc.match, Pattern: tc.pattern, Provider: tc.provider, Patch: map[string]any{"input_cost_per_token": 9e-6}}
		foreign[o.Name] = o
		f.overrides[o.Name] = o
	}
	ws := f.read()
	ws.Data.Models = nil
	f.failDelete = true
	f.save(ws, nil)
	f.failDelete = false
	f.restart() // No in-memory publication proof remains to supply the old key.
	f.save(f.read(), nil)
	if !reflect.DeepEqual(f.overrides, foreign) {
		t.Fatalf("reconciliation must remove only the Registry-owned override: got %+v, want %+v", f.overrides, foreign)
	}
	if f.posts != 1 {
		t.Fatalf("reconciliation duplicated a native override: %d creates", f.posts)
	}
}

func TestPricingReconcileWithoutExpectedCorrections(t *testing.T) {
	for _, removeCatalog := range []bool{false, true} {
		t.Run(fmt.Sprintf("removeCatalog=%t", removeCatalog), func(t *testing.T) {
			f := newPricingReconcileFixture(t)
			res := perform(f.server, "GET", "/api/config", "", authorized())
			if res.Code != 200 {
				t.Fatal(res.Code, res.Body.String())
			}
			var cfg registry.Config
			if err := json.Unmarshal(res.Body.Bytes(), &cfg); err != nil {
				t.Fatal(err)
			}
			if removeCatalog {
				cfg.Catalog = nil
			} else {
				cfg.Catalog.Accesses[0].Overrides = nil
			}
			raw, err := json.Marshal(cfg)
			if err != nil {
				t.Fatal(err)
			}
			headers := authorized()
			headers["If-Match"] = res.Header().Get("ETag")
			res = perform(f.server, "PUT", "/api/config", string(raw), headers)
			if res.Code != 200 {
				t.Fatal("existing config path refused catalogue edit:", res.Code, res.Body.String())
			}
			f.restart()
			ws := f.save(f.read(), nil)
			if len(f.overrides) != 0 || len(ws.PricingProofs) != 0 || len(ws.Data.Models) != 1 {
				t.Fatalf("no correction expected, but native override or proof remains: %+v, %+v", f.overrides, ws)
			}
		})
	}
}

func TestPricingReconcileNativeFailureAndRetry(t *testing.T) {
	for _, phase := range []string{"list", "key-list", "delete"} {
		t.Run(phase, func(t *testing.T) {
			f := newPricingReconcileFixture(t)
			ws := f.read()
			ws.Data.Models = nil
			if phase == "list" {
				f.failList = "all"
			} else if phase == "key-list" {
				f.failList = "key"
			}
			f.failDelete = phase == "delete"
			ws = f.save(ws, nil)
			if len(ws.Data.Models) != 0 {
				t.Fatal("native failure rolled back the persisted Registry edit")
			}
			if _, ok := f.overrides[reconcileOverrideName]; !ok {
				t.Fatal("fixture lost override despite native failure")
			}
			if len(ws.PricingProofs) == 0 {
				t.Fatal("native failure was not exposed in workspace pricing proofs")
			}
			for _, p := range ws.PricingProofs {
				if p.State != "not_verified" || p.Error == "" {
					t.Fatalf("native failure presented as verified: %+v", p)
				}
			}
			f.failList, f.failDelete = "", false
			ws = f.save(ws, nil)
			if len(f.overrides) != 0 || len(ws.PricingProofs) != 0 || f.posts != 1 {
				t.Fatalf("retry did not reconcile without duplication: overrides=%+v proofs=%+v creates=%d", f.overrides, ws.PricingProofs, f.posts)
			}
		})
	}
}
