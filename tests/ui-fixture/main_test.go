package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
)

type caller func(method, path string, body any, revision string) *httptest.ResponseRecorder

// fixture serves the admin API over the seeded registry and the synthetic Bifrost, as main does.
func fixture(t *testing.T) (*syntheticBifrost, caller) {
	t.Helper()
	snap, err := registry.Compile(seed())
	if err != nil {
		t.Fatal(err)
	}
	store := registry.MemoryStore(snap)
	b := &syntheticBifrost{store: store, keys: seedKeys()}
	s, err := admin.New(store, defaultToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	s.ConnectNative(roundTrip(b.roundTrip))
	return b, func(method, path string, body any, revision string) *httptest.ResponseRecorder {
		t.Helper()
		data, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		r := httptest.NewRequest(method, "http://127.0.0.1:4174"+path, bytes.NewReader(data))
		r.Header.Set("Authorization", "Bearer "+defaultToken)
		r.Header.Set("Content-Type", "application/json")
		if revision != "" {
			r.Header.Set("If-Match", revision)
		}
		w := httptest.NewRecorder()
		s.ServeHTTP(w, r)
		return w
	}
}

func TestFixtureWorkspaceAndNativeReadback(t *testing.T) {
	b, call := fixture(t)
	for _, key := range b.keys {
		if got, err := registry.Credential(map[string]string{"Authorization": "Bearer " + key.Value}); err != nil || got != key.Value {
			t.Fatalf("fixture key %s is not a native credential: %v", key.ID, err)
		}
	}
	var ws struct {
		Revision  string         `json:"revision"`
		Data      map[string]any `json:"data"`
		Discovery []any          `json:"discovery"`
	}
	get := call("GET", "/api/workspace", nil, "")
	if get.Code != 200 || json.Unmarshal(get.Body.Bytes(), &ws) != nil || len(ws.Data["models"].([]any)) != 12 || len(ws.Data["groups"].([]any)) != 2 || len(ws.Data["keys"].([]any)) != 11 || len(ws.Discovery) != 81 {
		t.Fatalf("workspace: %d %s", get.Code, get.Body.String())
	}
	group := ws.Data["groups"].([]any)[0].(map[string]any)
	group["name"] = "QA Development Edited"
	group["members"] = []string{"qa-code"}
	put := call("PUT", "/api/workspace", map[string]any{"data": ws.Data}, ws.Revision)
	if put.Code != 200 {
		t.Fatalf("workspace PUT: %d %s", put.Code, put.Body.String())
	}
	if len(b.keys["vk-qa-dev"].ProviderConfigs) != 1 || len(b.keys["vk-qa-dev"].ProviderConfigs[0].AllowedModels) != 1 || b.keys["vk-qa-dev"].ProviderConfigs[0].AllowedModels[0] != "qa-code" {
		t.Fatal("workspace edit was not applied to synthetic native key")
	}
	readback := call("POST", "/api/keys/vk-qa-dev/readback", nil, "")
	if readback.Code != 200 || !bytes.Contains(readback.Body.Bytes(), []byte(`"state":"verified"`)) {
		t.Fatalf("native readback: %d %s", readback.Code, readback.Body.String())
	}
	assistant := call("GET", "/api/assistant/models?virtualKeyId=vk-qa-dev", nil, "")
	if assistant.Code != 200 || !bytes.Contains(assistant.Body.Bytes(), []byte(`synthetic-provider/qa-code`)) {
		t.Fatalf("assistant native model options: %d %s", assistant.Code, assistant.Body.String())
	}
	created := call("POST", "/api/keys", map[string]string{"name": "QA New Key", "client": "fixture"}, "")
	if created.Code != 201 || !bytes.Contains(created.Body.Bytes(), []byte(`"id":"vk-qa-created-1"`)) {
		t.Fatalf("key creation: %d %s", created.Code, created.Body.String())
	}
	secret := call("POST", "/api/keys/vk-qa-created-1/secret", nil, "")
	if secret.Code != 200 || !bytes.Contains(secret.Body.Bytes(), []byte(`"secret":"sk-bf-qa-fixture-created-1"`)) {
		t.Fatalf("key reveal: %d %s", secret.Code, secret.Body.String())
	}
	if got, err := registry.Credential(map[string]string{"Authorization": "Bearer " + b.keys["vk-qa-created-1"].Value}); err != nil || got != b.keys["vk-qa-created-1"].Value {
		t.Fatalf("created fixture key is not a native credential: %v", err)
	}
	if catalog := call("GET", "/api/catalog", nil, ""); catalog.Code != 200 || !bytes.Contains(catalog.Body.Bytes(), []byte(`fixture/qa-unregistered`)) {
		t.Fatalf("reference catalog: %d %s", catalog.Code, catalog.Body.String())
	}
}

// Saved cards use only subscription providers; the aggregator cross-lists one of them.
func TestFixtureDiscoveryMirrorsSubscriptionGateway(t *testing.T) {
	_, call := fixture(t)
	type access struct {
		Provider    string  `json:"provider"`
		NativeModel string  `json:"nativeModel"`
		ReferenceID *string `json:"referenceId"`
	}
	type model struct {
		ID       string   `json:"id"`
		Accesses []access `json:"accesses"`
	}
	var ws struct {
		Data struct {
			Models []model `json:"models"`
		} `json:"data"`
		Discovery []model `json:"discovery"`
	}
	if get := call("GET", "/api/workspace", nil, ""); get.Code != 200 || json.Unmarshal(get.Body.Bytes(), &ws) != nil {
		t.Fatalf("workspace: %d %s", get.Code, get.Body.String())
	}
	reference := func(a access) string {
		if a.ReferenceID == nil {
			return ""
		}
		return *a.ReferenceID
	}
	saved := map[string]string{}
	for _, m := range ws.Data.Models {
		for _, a := range m.Accesses {
			if a.Provider == "openrouter" {
				t.Fatalf("saved card %s uses the aggregator", m.ID)
			}
			saved[a.Provider+"/"+a.NativeModel] = reference(a)
		}
	}
	aggregator := map[string]string{}
	for _, m := range ws.Discovery {
		for _, a := range m.Accesses {
			if a.Provider == "openrouter" {
				aggregator[a.NativeModel] = reference(a)
			}
		}
	}
	if len(aggregator) <= 60 {
		t.Fatalf("aggregator serves %d models, want more than one 60-card page", len(aggregator))
	}
	if saved["Claude/qa-opus"] != "anthropic/qa-opus" || saved["Claude/qa-opus-fast"] != "anthropic/qa-opus" || aggregator["anthropic/qa-opus"] != "anthropic/qa-opus" {
		t.Fatalf("aggregator does not share the saved Claude card's reference: %q, %q", saved["Claude/qa-opus"], aggregator["anthropic/qa-opus"])
	}
	for _, variant := range []string{"~anthropic/qa-opus-latest", "openai/qa-codex:batch"} {
		if _, ok := aggregator[variant]; !ok {
			t.Fatalf("aggregator variant %s is not discovered", variant)
		}
	}
	// A "-pro" variant linked to the card's reference: the editor must not offer it as the same model.
	if aggregator["anthropic/qa-opus-pro"] != "anthropic/qa-opus" {
		t.Fatalf("variant anthropic/qa-opus-pro is not linked to the card's reference: %q", aggregator["anthropic/qa-opus-pro"])
	}
	// Common IDs drop the aggregator's vendor, so the same model through two providers is one discovered model.
	byID := map[string][]string{}
	for _, m := range ws.Discovery {
		for _, a := range m.Accesses {
			byID[m.ID] = append(byID[m.ID], a.Provider+"/"+a.NativeModel)
		}
	}
	if got := strings.Join(byID["qa-opus"], ","); got != "Claude/qa-opus,openrouter/anthropic/qa-opus" {
		t.Fatalf("qa-opus is served by %q", got)
	}
	for _, id := range []string{"qa-opus-pro", "qa-opus-latest", "qa-codex-batch", "qa-reasoner"} {
		if len(byID[id]) != 1 {
			t.Fatalf("namespace-free common ID %s: %v", id, byID[id])
		}
	}
}

// Unmanaged keys carry native permissions; the one restricted to listed models is adoptable as is.
func TestFixtureUnmanagedKeysCarryNativePermissions(t *testing.T) {
	b, call := fixture(t)
	var body struct {
		Keys []struct {
			ID                string `json:"id"`
			AllowAllProviders bool   `json:"allow_all_providers"`
			ProviderConfigs   []struct {
				Provider      string   `json:"provider"`
				AllowedModels []string `json:"allowed_models"`
				AllowAllKeys  bool     `json:"allow_all_keys"`
			} `json:"provider_configs"`
		} `json:"virtual_keys"`
	}
	nativeGet(t, b, "/api/governance/virtual-keys", &body)
	got := map[string]string{}
	for _, k := range body.Keys {
		got[k.ID] = fmt.Sprint(k.AllowAllProviders, k.ProviderConfigs)
	}
	for id, want := range map[string]string{"vk-qa-all-providers": "true []", "vk-qa-codex": "false [{Codex [qa-codex qa-codex-mini] true}]", "vk-qa-claude": "false [{Claude [*] true}]"} {
		if got[id] != want {
			t.Errorf("%s permissions = %q, want %q", id, got[id], want)
		}
	}
	type preview struct {
		CanApply       bool     `json:"canApply"`
		SelectedRoutes []string `json:"selectedRoutes"`
		Blocked        []string `json:"blocked"`
	}
	adopt := func(id string) (p preview) {
		t.Helper()
		w := call("POST", "/api/keys/adopt", map[string]string{"keyId": id, "operation": "adopt", "phase": "preview"}, "")
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil {
			t.Fatalf("adoption preview %s: %d %s", id, w.Code, w.Body.String())
		}
		return p
	}
	if p := adopt("vk-qa-codex"); !p.CanApply || !reflect.DeepEqual(p.SelectedRoutes, []string{"Codex/qa-codex", "Codex/qa-codex-mini"}) {
		t.Fatalf("restricted key adoption preview: %+v", p)
	}
	if p := adopt("vk-qa-all-providers"); p.CanApply {
		t.Fatalf("a key allowing every provider must not be adoptable: %+v", p)
	}
}

// Every unmanaged key stands for one adoption case spec #85 must prove. A route is saved when a
// card holds that access, discovered when its provider lists it, and undiscovered otherwise
// (Bifrost lists no model of a disabled provider).
func TestFixtureKeysCoverAdoptionCases(t *testing.T) {
	_, call := fixture(t)
	type access struct{ Provider, NativeModel string }
	var ws struct {
		Data struct {
			Models []struct{ Accesses []access } `json:"models"`
			Keys   []struct {
				ID        string `json:"id"`
				Managed   bool   `json:"managed"`
				Readiness struct {
					State    string
					Blockers []struct {
						Provider, Kind string
						Count          int
					}
				}
				Permissions struct {
					AllProviders bool `json:"allProviders"`
					Providers    []struct {
						Provider  string
						AllModels bool `json:"allModels"`
						Models    []string
					}
				}
			} `json:"keys"`
		} `json:"data"`
		Discovery []struct{ Accesses []access }
		Providers []struct{ ID string }
	}
	if w := call("GET", "/api/workspace", nil, ""); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &ws) != nil {
		t.Fatalf("workspace: %d %s", w.Code, w.Body.String())
	}
	saved, discovered, listed := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, m := range ws.Data.Models {
		for _, a := range m.Accesses {
			saved[a.Provider+"/"+a.NativeModel] = true
		}
	}
	for _, m := range ws.Discovery {
		for _, a := range m.Accesses {
			discovered[a.Provider+"/"+a.NativeModel] = true
		}
	}
	for _, p := range ws.Providers {
		listed[p.ID] = true
	}
	if !listed["mistral"] || discovered["mistral/qa-mistral-large"] {
		t.Fatalf("mistral must be a listed provider whose models are never discovered: listed %v", listed)
	}
	got := map[string]string{}
	readiness := map[string]string{}
	routes := map[string][]string{}
	for _, k := range ws.Data.Keys {
		if k.Managed {
			continue
		}
		readiness[k.ID] = k.Readiness.State
		for _, b := range k.Readiness.Blockers {
			readiness[k.ID] += fmt.Sprintf(" %s/%s %d", b.Provider, b.Kind, b.Count)
		}
		counts := map[string]int{}
		for _, p := range k.Permissions.Providers {
			if p.AllModels {
				counts["all-models"]++
			}
			for _, model := range p.Models {
				route := p.Provider + "/" + model
				routes[k.ID] = append(routes[k.ID], route)
				switch {
				case !discovered[route]:
					counts["undiscovered"]++
				case !saved[route]:
					counts["unsaved"]++
				default:
					counts["saved"]++
				}
			}
		}
		switch {
		case k.Permissions.AllProviders:
			got[k.ID] = "all-providers"
		case counts["all-models"] > 0:
			got[k.ID] = "all-models"
		case counts["undiscovered"] > 0:
			got[k.ID] = fmt.Sprint("undiscovered ", counts["undiscovered"], ", saved ", counts["saved"], ", unsaved ", counts["unsaved"])
		case counts["unsaved"] > 0:
			got[k.ID] = fmt.Sprint("unsaved ", counts["unsaved"], ", saved ", counts["saved"])
		case counts["saved"] > 0:
			got[k.ID] = "ready"
		default:
			got[k.ID] = "empty"
		}
	}
	want := map[string]string{
		"vk-qa-unmanaged": "empty", "vk-qa-all-providers": "all-providers", "vk-qa-claude": "all-models", "vk-qa-wildcard": "all-models",
		"vk-qa-codex": "ready", "vk-qa-google": "ready",
		"vk-qa-mistral": "undiscovered 3, saved 2, unsaved 0", // the Hermes case: a disabled provider plus discovered models
		"vk-qa-hermes":  "undiscovered 2, saved 2, unsaved 0",
		"vk-qa-unsaved": "unsaved 1, saved 1",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unmanaged key cases = %v, want %v", got, want)
	}
	// The workspace's own verdict (#87) agrees with the independent reading above.
	wantReadiness := map[string]string{
		"vk-qa-unmanaged": "empty", "vk-qa-all-providers": "blocked /all-providers 1", "vk-qa-claude": "blocked Claude/dynamic 1", "vk-qa-wildcard": "blocked Claude/dynamic 1",
		"vk-qa-codex": "ready", "vk-qa-google": "ready",
		"vk-qa-mistral": "blocked mistral/undiscovered 3", "vk-qa-hermes": "blocked mistral/undiscovered 2", "vk-qa-unsaved": "blocked synthetic-provider/unsaved 1",
	}
	if !reflect.DeepEqual(readiness, wantReadiness) {
		t.Fatalf("unmanaged key readiness = %v, want %v", readiness, wantReadiness)
	}
	// Adoption agrees: only the ready keys can be adopted as they are.
	for id, apply := range map[string]bool{"vk-qa-codex": true, "vk-qa-google": true, "vk-qa-mistral": false, "vk-qa-hermes": false, "vk-qa-unsaved": false, "vk-qa-unmanaged": false} {
		var p struct {
			CanApply bool `json:"canApply"`
		}
		if w := call("POST", "/api/keys/adopt", map[string]string{"keyId": id, "operation": "adopt", "phase": "preview"}, ""); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil || p.CanApply != apply {
			t.Errorf("adoption preview of %s: canApply %v, want %v (%d %s)", id, p.CanApply, apply, w.Code, w.Body.String())
		}
	}
	slices.Sort(routes["vk-qa-mistral"])
	if want := []string{"Claude/qa-haiku", "Claude/qa-sonnet", "mistral/qa-mistral-code", "mistral/qa-mistral-large", "mistral/qa-mistral-small"}; !reflect.DeepEqual(routes["vk-qa-mistral"], want) {
		t.Errorf("mistral key routes = %v, want %v", routes["vk-qa-mistral"], want)
	}
}

// A key keeps the disabled provider native and adopts the rest: the fixture's /v1/models lists the
// explicit names the key allows on a provider without discoverable models, for the unmanaged key and
// once it is managed, so the readback of the managed routes plus the kept ones is Verified (#92).
func TestFixtureKeptNativeMistralKeyReadsVerified(t *testing.T) {
	_, call := fixture(t)
	adopt := func(phase, token, revision string) *httptest.ResponseRecorder {
		body := map[string]any{"keyId": "vk-qa-mistral", "operation": "adopt", "phase": phase, "keepNative": []string{"mistral"}}
		if token != "" {
			body["previewToken"] = token
		}
		return call("POST", "/api/keys/adopt", body, revision)
	}
	var p struct {
		Revision, PreviewToken string
		CanApply               bool
		SelectedRoutes         []string
		NativeRoutes           []string
	}
	if w := adopt("preview", "", ""); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil || !p.CanApply {
		t.Fatalf("keeping mistral native did not unblock the key: %d %s", w.Code, w.Body.String())
	}
	if want := []string{"Claude/qa-haiku", "Claude/qa-sonnet"}; !reflect.DeepEqual(p.SelectedRoutes, want) {
		t.Fatalf("selected routes = %v, want %v", p.SelectedRoutes, want)
	}
	if w := adopt("apply", p.PreviewToken, p.Revision); w.Code != 200 {
		t.Fatalf("adoption failed: %d %s", w.Code, w.Body.String())
	}
	var ws struct {
		Data struct {
			Keys []struct {
				ID          string
				Managed     bool
				Policy      struct{ KeptNative []string }
				Publication struct {
					State    string
					Expected []string
				}
			}
		}
	}
	if w := call("POST", "/api/keys/vk-qa-mistral/readback", nil, ""); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &ws) != nil {
		t.Fatalf("readback failed: %d %s", w.Code, w.Body.String())
	}
	for _, k := range ws.Data.Keys {
		if k.ID != "vk-qa-mistral" {
			continue
		}
		want := []string{"Claude/qa-haiku", "Claude/qa-sonnet", "mistral/qa-mistral-code", "mistral/qa-mistral-large", "mistral/qa-mistral-small"}
		if !k.Managed || k.Publication.State != "verified" || !reflect.DeepEqual(k.Publication.Expected, want) || !reflect.DeepEqual(k.Policy.KeptNative, []string{"mistral"}) {
			t.Fatalf("kept-native key = %+v, want verified with %v", k, want)
		}
		return
	}
	t.Fatal("vk-qa-mistral missing from the workspace")
}

// Saved cards without a Models.dev reference sit on custom subscription providers, one per base
// type, and stay creator "Unknown" in the raw data (creator inference has something to infer);
// one of them is served by two subscriptions.
func TestFixtureCardsWithoutReference(t *testing.T) {
	config := seed()
	referenced := map[string]bool{}
	for _, a := range config.Catalog.Accesses {
		referenced[a.ID] = a.ReferenceID != ""
	}
	baseTypes := map[string][]string{}
	for _, m := range config.Models {
		if referenced[m.Provider+"/"+m.UpstreamModel] {
			continue
		}
		var ui struct{ Creator string }
		if err := json.Unmarshal(m.Metadata["ui"], &ui); err != nil || ui.Creator != "Unknown" || m.Creator != "" {
			t.Errorf("card %s: stored creator %q / %q, want Unknown / none (%v)", m.Alias, ui.Creator, m.Creator, err)
		}
		baseType := findProvider(m.Provider).baseType
		if baseType == "" {
			t.Errorf("card %s without a reference sits on %s, which is not a custom provider", m.Alias, m.Provider)
		}
		baseTypes[m.Alias] = append(baseTypes[m.Alias], baseType)
	}
	want := map[string][]string{"qa-codex-mini": {"openai"}, "qa-sonnet": {"anthropic"}, "qa-flash": {"gemini"}, "qa-shared": {"anthropic", "openai"}}
	if !reflect.DeepEqual(baseTypes, want) {
		t.Fatalf("base types of the cards without a reference = %v, want %v", baseTypes, want)
	}
	_, call := fixture(t)
	var ws struct {
		Data struct {
			Models []struct {
				ID       string
				Accesses []struct{ Provider string }
			}
		}
	}
	if w := call("GET", "/api/workspace", nil, ""); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &ws) != nil {
		t.Fatalf("workspace: %d %s", w.Code, w.Body.String())
	}
	for _, m := range ws.Data.Models {
		if m.ID == "qa-shared" {
			if got := fmt.Sprint(m.Accesses); got != "[{Claude} {Codex}]" {
				t.Fatalf("qa-shared is one card with accesses %s, want Claude and Codex", got)
			}
			return
		}
	}
	t.Fatal("no saved card qa-shared")
}

// The decisions model (Jev-like): a provider that serves only decisions lists it, its reference
// is in a namespace Models.dev has no provider record for, and no card holds it yet.
func TestFixtureDecisionsModelWaitsToBeAdded(t *testing.T) {
	_, call := fixture(t)
	var ws struct {
		Data struct {
			Models []struct{ Accesses []struct{ ID string } }
		}
		Discovery []struct {
			ID       string
			Accesses []struct{ ID, Provider, NativeModel, ReferenceID string }
		}
	}
	if w := call("GET", "/api/workspace", nil, ""); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &ws) != nil {
		t.Fatalf("workspace: %d %s", w.Code, w.Body.String())
	}
	for _, m := range ws.Data.Models {
		for _, a := range m.Accesses {
			if a.ID == "typesafe/qa-jev" {
				t.Fatal("the decisions model must not be saved")
			}
		}
	}
	for _, m := range ws.Discovery {
		for _, a := range m.Accesses {
			if a.Provider == "typesafe" {
				if m.ID != "qa-jev" || a.NativeModel != "qa-jev" || a.ReferenceID != "typesafe/qa-jev" || len(m.Accesses) != 1 {
					t.Fatalf("decisions model: %+v", m)
				}
				return
			}
		}
	}
	t.Fatal("the decisions model is not discovered")
}

// Native models declare their mode through Bifrost's /api/models/parameters lookup, and the
// seeded catalogue already holds what a Bifrost refresh stores.
func TestFixtureModelParametersDeclareMode(t *testing.T) {
	_, call := fixture(t)
	read := func(w *httptest.ResponseRecorder) (map[string]string, string) {
		t.Helper()
		var c struct {
			Revision string `json:"revision"`
			Accesses []struct {
				ID     string `json:"id"`
				Fields struct {
					Parameters struct {
						Value struct {
							Mode string `json:"mode"`
						} `json:"value"`
					} `json:"parameters"`
					Input struct {
						Value float64 `json:"value"`
					} `json:"input_cost_usd_per_million"`
				} `json:"fields"`
			} `json:"accesses"`
			Sources []struct {
				ID, Error, LastSuccess string
			} `json:"sources"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &c) != nil {
			t.Fatalf("catalog: %d %s", w.Code, w.Body.String())
		}
		facts := map[string]string{}
		for _, a := range c.Accesses {
			facts[a.ID] = fmt.Sprint(a.Fields.Parameters.Value.Mode, " ", a.Fields.Input.Value)
		}
		for _, s := range c.Sources {
			facts["source "+s.ID] = s.Error
		}
		return facts, c.Revision
	}
	seeded, revision := read(call("GET", "/api/catalog", nil, ""))
	refreshed, _ := read(call("POST", "/api/catalog/refresh", map[string][]string{"sources": {"bifrost"}}, revision))
	if refreshed["source bifrost"] != "" || len(refreshed) != len(seeded) {
		t.Fatalf("Bifrost refresh: %q, %d accesses, want %d", refreshed["source bifrost"], len(refreshed), len(seeded))
	}
	for id, want := range map[string]string{"Google/qa-image": "image_generation 0", "typesafe/qa-jev": "decisions 0", "Claude/qa-opus": "chat 0", "openrouter/anthropic/qa-opus": "chat 4", "openrouter/deepseek/qa-reasoner": "chat 0.19999999999999998"} {
		if seeded[id] != want || refreshed[id] != want {
			t.Errorf("%s: seeded %q, refreshed %q, want %q", id, seeded[id], refreshed[id], want)
		}
	}
}

// Like Models.dev references, the new ones store no creator: only their namespace, which has a
// provider record in the embedded Models.dev snapshot for some and none for others. The catalogue
// names their creator from that namespace on read.
func TestFixtureReferenceNamespaces(t *testing.T) {
	_, call := fixture(t)
	var c struct {
		References []struct {
			ID     string         `json:"id"`
			Fields map[string]any `json:"fields"`
		} `json:"references"`
	}
	if w := call("GET", "/api/catalog", nil, ""); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &c) != nil {
		t.Fatalf("catalog: %d %s", w.Code, w.Body.String())
	}
	file, err := os.Open("../../internal/admin/data/modelsdev.json.gz")
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	gz, err := gzip.NewReader(file)
	if err != nil {
		t.Fatal(err)
	}
	var snapshot struct {
		Providers map[string]any `json:"providers"`
	}
	if err := json.NewDecoder(gz).Decode(&snapshot); err != nil {
		t.Fatal(err)
	}
	stored := map[string]bool{}
	for _, r := range seed().Catalog.References {
		_, stored[r.ID] = r.Candidates["creator"]
	}
	record := map[string]bool{}
	for _, r := range c.References {
		namespace, _, _ := strings.Cut(r.ID, "/")
		if namespace == "fixture" {
			continue
		}
		if creator, _ := r.Fields["creator"].(map[string]any); stored[r.ID] || creator["source"] != "models.dev" {
			t.Errorf("reference %s: stored creator %v, catalogue creator %v", r.ID, stored[r.ID], creator)
		}
		_, record[r.ID] = snapshot.Providers[namespace]
	}
	want := map[string]bool{"anthropic/qa-opus": true, "anthropic/qa-haiku": true, "openai/qa-codex": true, "google/qa-gemini": true, "google/qa-image": true, "deepseek/qa-reasoner": true, "tencent/qa-hunyuan": false, "meituan/qa-longcat": false, "typesafe/qa-jev": false}
	if !reflect.DeepEqual(record, want) {
		t.Fatalf("namespace has a Models.dev provider record: %v, want %v", record, want)
	}
}

func nativeGet(t *testing.T, b *syntheticBifrost, path string, out any) {
	t.Helper()
	resp, err := b.roundTrip(httptest.NewRequest("GET", "http://bifrost.internal"+path, nil))
	if err != nil || resp.StatusCode != 200 || json.NewDecoder(resp.Body).Decode(out) != nil {
		t.Fatalf("native GET %s failed: %v", path, err)
	}
}

// Bifrost 2.2.6 lists a custom provider with custom_provider_config.base_provider_type.
func TestFixtureProvidersCarryCustomBaseTypes(t *testing.T) {
	var body struct {
		Providers []struct {
			Name   string `json:"name"`
			Custom *struct {
				BaseProviderType string `json:"base_provider_type"`
			} `json:"custom_provider_config"`
		} `json:"providers"`
	}
	nativeGet(t, &syntheticBifrost{}, "/api/providers", &body)
	got := map[string]string{}
	for _, p := range body.Providers {
		got[p.Name] = ""
		if p.Custom != nil {
			got[p.Name] = p.Custom.BaseProviderType
		}
	}
	want := map[string]string{"synthetic-provider": "", "Claude": "anthropic", "Codex": "openai", "Google": "gemini", "openrouter": "", "mistral": "", "typesafe": ""}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("providers = %v, want %v", got, want)
	}
}
