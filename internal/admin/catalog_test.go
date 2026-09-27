package admin

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

func TestCatalogRefreshOverrideAndRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.json")
	if err := os.WriteFile(path, []byte(`{"schema_version":1,"default_naming":"model","models":[],"groups":[],"policies":[]}`), 0600); err != nil {
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
		switch r.URL.Path {
		case "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"openai"}]}`), nil
		case "/api/providers/openai/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-1","enabled":true}]}`), nil
		case "/api/models":
			return nativeResponse(200, `{"models":[{"name":"gpt-5","provider":"openai","accessible_by_keys":["key-1"]}],"total":1}`), nil
		case "/api/models/details":
			if r.URL.Query().Get("unfiltered") != "true" || r.URL.Query().Get("limit") != "100" || r.URL.Query().Get("offset") != "0" {
				t.Fatal("detail pagination/filter missing", r.URL.String())
			}
			return nativeResponse(200, `{"models":[{"name":"gpt-5","provider":"openai","context_length":128000,"input_cost_per_token":"0.0000015","output_cost_per_token":0.000003,"cache_read_input_token_cost":0.00000025}],"total":1}`), nil
		case "/api/models/parameters":
			if r.URL.Query().Get("model") != "openai/gpt-5" {
				t.Fatal("unexpected parameter model", r.URL.String())
			}
			return nativeResponse(200, `{"temperature":true}`), nil
		default:
			t.Fatal("unexpected Bifrost request", r.URL.String())
			return nil, nil
		}
	})
	get := perform(s, "GET", "/api/catalog", "", authorized())
	if get.Code != 200 {
		t.Fatal(get.Code, get.Body.String())
	}
	headers := authorized()
	headers["If-Match"] = get.Header().Get("ETag")
	refreshed := perform(s, "POST", "/api/catalog/refresh", `{}`, headers)
	if refreshed.Code != 200 {
		t.Fatal(refreshed.Code, refreshed.Body.String())
	}
	var first catalogDTO
	if err := json.Unmarshal(refreshed.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}
	if len(first.References) < 400 || len(first.Accesses) != 1 || !first.Accesses[0].Configured || first.Accesses[0].ReferenceID != "openai/gpt-5" {
		t.Fatalf("wrong snapshot catalogue: refs=%d accesses=%+v", len(first.References), first.Accesses)
	}
	if first.Sources[1].Repository != "https://github.com/anomalyco/models.dev" || first.Sources[1].Commit != "6a0b12bc9c66e1ab4fe44232d592a32df09a77e0" || first.Sources[1].SourceAt == "" {
		t.Fatal("snapshot source provenance missing", first.Sources)
	}
	if first.Accesses[0].Fields["input_cost_usd_per_million"].Source != "bifrost" || first.References[0].Fields["tool_call"].Kind != "declared" {
		t.Fatal("source/evidence wrong")
	}
	if len(store.Load().Config().Models) != 0 {
		t.Fatal("reference data created routing access")
	}
	headers["If-Match"] = refreshed.Header().Get("ETag")
	overridden := perform(s, "PUT", "/api/catalog/override", `{"target":"access","id":"openai/gpt-5","field":"context_length","value":8192}`, headers)
	if overridden.Code != 200 {
		t.Fatal(overridden.Code, overridden.Body.String())
	}
	var second catalogDTO
	_ = json.Unmarshal(overridden.Body.Bytes(), &second)
	if string(second.Accesses[0].Fields["context_length"].Value) != "8192" || second.Accesses[0].Fields["context_length"].Source != "manual" {
		t.Fatal("override not effective")
	}
	headers["If-Match"] = overridden.Header().Get("ETag")
	refreshedAgain := perform(s, "POST", "/api/catalog/refresh", `{"sources":["models.dev"]}`, headers)
	var third catalogDTO
	_ = json.Unmarshal(refreshedAgain.Body.Bytes(), &third)
	if refreshedAgain.Code != 200 || len(third.References) < 400 || third.Sources[1].Error != "" || string(third.Accesses[0].Fields["context_length"].Value) != "8192" {
		t.Fatal("local refresh lost snapshot/override", refreshedAgain.Code)
	}
	reopened, err := registry.OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	restarted := catalogView(reopened.Load())
	var persistedContext json.RawMessage
	for _, access := range restarted.Accesses {
		if access.ID == "openai/gpt-5" {
			persistedContext = access.Fields["context_length"].Value
		}
	}
	if len(restarted.References) < 400 || string(persistedContext) != "8192" {
		t.Fatal("catalogue not durable")
	}
	headers["If-Match"] = refreshedAgain.Header().Get("ETag")
	reset := perform(s, "PUT", "/api/catalog/override", `{"target":"access","id":"openai/gpt-5","field":"context_length","value":null}`, headers)
	if reset.Code != 200 || !strings.Contains(reset.Body.String(), `"context_length":{"value":128000`) {
		t.Fatal("automatic value not restored", reset.Code, reset.Body.String())
	}
	headers["If-Match"] = reset.Header().Get("ETag")
	unlinked := perform(s, "PUT", "/api/catalog/match", `{"accessId":"openai/gpt-5","referenceId":""}`, headers)
	if unlinked.Code != 200 {
		t.Fatal("explicit unlink failed", unlinked.Code, unlinked.Body.String())
	}
	headers["If-Match"] = unlinked.Header().Get("ETag")
	again := perform(s, "POST", "/api/catalog/refresh", `{"sources":["models.dev"]}`, headers)
	var fourth catalogDTO
	_ = json.Unmarshal(again.Body.Bytes(), &fourth)
	if again.Code != 200 || fourth.Accesses[0].ReferenceID != "" || !fourth.Accesses[0].MappingManual {
		t.Fatal("explicit unlink was rematched", again.Code, again.Body.String())
	}
	headers["If-Match"] = again.Header().Get("ETag")
	manual := perform(s, "PUT", "/api/catalog/reference", `{"id":"local/private-model","fields":{"name":"Private model","context_length":4096}}`, headers)
	if manual.Code != 200 || !strings.Contains(manual.Body.String(), `"local/private-model"`) {
		t.Fatal("manual reference failed", manual.Code, manual.Body.String())
	}
	if len(store.Load().Config().Models) != 0 {
		t.Fatal("manual reference created routing permission")
	}
	stale := perform(s, "PUT", "/api/catalog/reference", `{"id":"local/stale","fields":{"name":"Stale"}}`, headers)
	if stale.Code != 409 {
		t.Fatal("stale mutation did not conflict", stale.Code, stale.Body.String())
	}
}

func TestModelsDevRefreshUsesEmbeddedSnapshotWithoutNetwork(t *testing.T) {
	snapBytes, err := embeddedModelsDevSnapshot()
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := parseModelsDevSnapshot(snapBytes)
	if err != nil {
		t.Fatal(err)
	}
	offers := 0
	for _, provider := range snapshot.Providers {
		offers += len(provider.Models)
	}
	if len(snapshot.Models) != 428 || len(snapshot.Providers) != 223 || offers != 8185 {
		t.Fatalf("unexpected embedded snapshot counts: models=%d providers=%d offers=%d", len(snapshot.Models), len(snapshot.Providers), offers)
	}

	current := &registry.Catalog{Accesses: []registry.CatalogAccess{
		{ID: "anthropic/claude-sonnet-4-6", Provider: "anthropic", Model: "claude-sonnet-4-6", Configured: true},
		{ID: "amazon-bedrock/anthropic.claude-sonnet-4-6", Provider: "amazon-bedrock", Model: "anthropic.claude-sonnet-4-6", Configured: true},
		{ID: "custom/claude-sonnet-4-6", Provider: "custom", Model: "claude-sonnet-4-6", Configured: true},
		{ID: "anthropic/claude-opus-4-6", Provider: "anthropic", Model: "claude-opus-4-6", Configured: false},
	}}
	refs, accesses, err := modelsDevRows(current, snapshot.Source.SourceAt, snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if len(accesses) != 2 {
		t.Fatalf("matched non-exact or unconfigured access: %d", len(accesses))
	}
	if len(refs) < 400 {
		t.Fatal("canonical refs missing")
	}
	byID := map[string]registry.CatalogAccess{}
	for _, a := range accesses {
		byID[a.ID] = a
	}
	if byID["amazon-bedrock/anthropic.claude-sonnet-4-6"].ReferenceID != "anthropic/claude-sonnet-4-6" {
		t.Fatal("exact authored base_model mapping missing", byID)
	}
	for _, field := range []string{"context_length"} {
		if _, exists := byID["amazon-bedrock/anthropic.claude-sonnet-4-6"].Candidates[field]; exists {
			t.Fatalf("inherited field %s copied as access value", field)
		}
	}
}

func TestModelsDevSnapshotRejectsInvalidSnapshotAndSize(t *testing.T) {
	if _, err := parseModelsDevSnapshot([]byte(`{"schemaVersion":2}`)); err == nil {
		t.Fatal("invalid snapshot accepted")
	}
	if _, err := parseModelsDevSnapshot(make([]byte, maxModelsDevSnapshotBytes+1)); err == nil {
		t.Fatal("oversize snapshot accepted")
	}
}

func TestModelsDevOmissionsAndNormalizedSnapshotFitConfig(t *testing.T) {
	body, err := embeddedModelsDevSnapshot()
	if err != nil {
		t.Fatal(err)
	}
	snapshot, err := parseModelsDevSnapshot(body)
	if err != nil {
		t.Fatal(err)
	}
	current := &registry.Catalog{}
	var offerID, providerID, modelID string
	for p, provider := range snapshot.Providers {
		for id, offer := range provider.Models {
			var omitted []string
			_ = json.Unmarshal(offer.Authored["base_model_omit"], &omitted)
			for _, path := range omitted {
				if path == "limit.input" {
					providerID, modelID, offerID = p, id, path
					break
				}
			}
			if providerID != "" {
				break
			}
		}
		if providerID != "" {
			break
		}
	}
	if providerID == "" {
		t.Fatal("snapshot lacks authored base_model_omit example")
	}
	offer := snapshot.Providers[providerID].Models[modelID]
	var base string
	_ = json.Unmarshal(offer.Authored["base_model"], &base)
	if _, exists := snapshot.Models[base]; !exists {
		t.Fatalf("omit fixture has no exact canonical base %q", base)
	}
	current.Accesses = []registry.CatalogAccess{{ID: providerID + "/" + modelID, Provider: providerID, Model: modelID, Configured: true}}
	refs, accesses, err := modelsDevRows(current, snapshot.Source.SourceAt, snapshot)
	if err != nil {
		t.Fatal(err)
	}
	var catalog registry.Catalog
	catalog.References, catalog.Accesses = refs, accesses
	compiled, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "model", Models: []registry.Model{}, Groups: []registry.Group{}, Policies: []registry.Policy{}, Catalog: &catalog})
	if err != nil {
		t.Fatalf("embedded normalized snapshot exceeds config constraints: %v", err)
	}
	if len(compiled.JSON()) > registry.MaxConfigBytes {
		t.Fatalf("snapshot catalog exceeds config cap: %d", len(compiled.JSON()))
	}
	fields := registry.EffectiveAccessCatalogFields(&catalog, accesses[0])
	field := map[string]string{"limit.input": "max_input_tokens"}[offerID]
	if _, exists := fields[field]; exists {
		t.Fatalf("authored omission %s survived access composition", offerID)
	}
}
