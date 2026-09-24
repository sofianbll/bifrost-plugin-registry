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

func TestCatalogRefreshOverrideFailureAndRestart(t *testing.T) {
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
	failExternal := false
	emptyExternal := false
	s.catalogHTTP = &http.Client{Transport: nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "models.dev" || r.Header.Get("Authorization") != "" || r.URL.Query().Get("type") != "all" {
			t.Fatal("external request leaked credentials or wrong URL", r.URL.String())
		}
		if failExternal {
			return nativeResponse(503, `{}`), nil
		}
		if emptyExternal {
			return nativeResponse(200, `{}`), nil
		}
		switch r.URL.Path {
		case "/models.json":
			return nativeResponse(200, `{"openai/gpt-5":{"name":"GPT-5","family":"gpt","limit":{"context":400000},"modalities":{"input":["text","image"],"output":["text"]},"tool_call":true},"openai/unmatched":{"name":"Unmatched"}}`), nil
		case "/api.json":
			return nativeResponse(200, `{"openai":{"models":{"gpt-5":{"base_model":"openai/gpt-5","cost":{"input":1.25,"output":10,"cache_read":0.125}}}}}`), nil
		default:
			t.Fatal("unexpected Models.dev URL", r.URL.String())
			return nil, nil
		}
	})}
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
	if len(first.References) != 2 || len(first.Accesses) != 1 || !first.Accesses[0].Configured || first.Accesses[0].ReferenceID != "openai/gpt-5" {
		t.Fatalf("wrong catalogue: %+v", first)
	}
	if string(first.Accesses[0].Fields["input_cost_usd_per_million"].Value) != "1.5" || string(first.Accesses[0].Fields["cache_read_cost_usd_per_million"].Value) != "0.25" {
		t.Fatal("price units/source precedence wrong", refreshed.Body.String())
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
	failExternal = true
	headers["If-Match"] = overridden.Header().Get("ETag")
	failed := perform(s, "POST", "/api/catalog/refresh", `{"sources":["models.dev"]}`, headers)
	if failed.Code != 200 {
		t.Fatal(failed.Code, failed.Body.String())
	}
	var third catalogDTO
	_ = json.Unmarshal(failed.Body.Bytes(), &third)
	if len(third.References) != 2 || third.Sources[1].Error == "" || third.Sources[1].LastSuccess == "" || string(third.Accesses[0].Fields["context_length"].Value) != "8192" {
		t.Fatal("failed refresh lost snapshot/override", failed.Body.String())
	}
	failExternal = false
	emptyExternal = true
	headers["If-Match"] = failed.Header().Get("ETag")
	empty := perform(s, "POST", "/api/catalog/refresh", `{"sources":["models.dev"]}`, headers)
	var afterEmpty catalogDTO
	_ = json.Unmarshal(empty.Body.Bytes(), &afterEmpty)
	if empty.Code != 200 || len(afterEmpty.References) != 2 || afterEmpty.Sources[1].Error == "" || afterEmpty.Sources[1].LastSuccess != third.Sources[1].LastSuccess || string(afterEmpty.Accesses[0].Fields["context_length"].Value) != "8192" {
		t.Fatal("empty 200 response erased last good catalogue", empty.Code, empty.Body.String())
	}
	reopened, err := registry.OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	restarted := catalogView(reopened.Load())
	if len(restarted.References) != 2 || string(restarted.Accesses[0].Fields["context_length"].Value) != "8192" {
		t.Fatal("catalogue not durable")
	}
	headers["If-Match"] = empty.Header().Get("ETag")
	reset := perform(s, "PUT", "/api/catalog/override", `{"target":"access","id":"openai/gpt-5","field":"context_length","value":null}`, headers)
	if reset.Code != 200 || !strings.Contains(reset.Body.String(), `"context_length":{"value":128000`) {
		t.Fatal("automatic value not restored", reset.Code, reset.Body.String())
	}
	headers["If-Match"] = reset.Header().Get("ETag")
	unlinked := perform(s, "PUT", "/api/catalog/match", `{"accessId":"openai/gpt-5","referenceId":""}`, headers)
	if unlinked.Code != 200 {
		t.Fatal("explicit unlink failed", unlinked.Code, unlinked.Body.String())
	}
	failExternal = false
	emptyExternal = false
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
