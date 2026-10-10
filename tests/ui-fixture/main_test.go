package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"os"
	"reflect"
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
	if get.Code != 200 || json.Unmarshal(get.Body.Bytes(), &ws) != nil || len(ws.Data["models"].([]any)) != 8 || len(ws.Data["groups"].([]any)) != 2 || len(ws.Data["keys"].([]any)) != 6 || len(ws.Discovery) != 76 {
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
	if saved["Claude/qa-opus"] != "anthropic/qa-opus" || aggregator["anthropic/qa-opus"] != "anthropic/qa-opus" {
		t.Fatalf("aggregator does not share the saved Claude card's reference: %q, %q", saved["Claude/qa-opus"], aggregator["anthropic/qa-opus"])
	}
	for _, variant := range []string{"~anthropic/qa-opus-latest", "openai/qa-codex:batch"} {
		if _, ok := aggregator[variant]; !ok {
			t.Fatalf("aggregator variant %s is not discovered", variant)
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
	for id, want := range map[string]string{"Google/qa-image": "image_generation 0", "Claude/qa-opus": "chat 0", "openrouter/anthropic/qa-opus": "chat 4"} {
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
	want := map[string]bool{"anthropic/qa-opus": true, "anthropic/qa-haiku": true, "openai/qa-codex": true, "google/qa-gemini": true, "google/qa-image": true, "deepseek/qa-reasoner": true, "tencent/qa-hunyuan": false, "meituan/qa-longcat": false}
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
	want := map[string]string{"synthetic-provider": "", "Claude": "anthropic", "Codex": "openai", "Google": "gemini", "openrouter": ""}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("providers = %v, want %v", got, want)
	}
}
