// Run with: go run ./tests/ui-fixture
// This is an isolated browser fixture: every provider, model, and credential is synthetic.
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
)

const defaultToken = "qa-fixture-admin-token-only-1234567890"
const provider = "synthetic-provider"
const providerKey = "synthetic-provider-key"

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type virtualKey struct {
	ID              string           `json:"id"`
	Name            string           `json:"name"`
	Description     string           `json:"description"`
	Value           string           `json:"value"`
	Active          bool             `json:"is_active"`
	ProviderConfigs []providerConfig `json:"provider_configs"`
}

type providerConfig struct {
	Provider      string   `json:"provider"`
	AllowedModels []string `json:"allowed_models"`
	KeyIDs        []string `json:"key_ids,omitempty"`
	Keys          []struct {
		KeyID string `json:"key_id"`
	} `json:"keys,omitempty"`
}

type syntheticBifrost struct {
	sync.Mutex
	store *registry.Store
	keys  map[string]*virtualKey
	next  int
}

func respond(status int, body any) (*http.Response, error) {
	data, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(string(data)))}, nil
}

func (b *syntheticBifrost) roundTrip(r *http.Request) (*http.Response, error) {
	b.Lock()
	defer b.Unlock()
	path := r.URL.Path
	switch {
	case r.Method == "GET" && path == "/api/version":
		return respond(200, "2.2.3-fixture")
	case r.Method == "GET" && path == "/api/providers":
		return respond(200, map[string]any{"providers": []any{map[string]string{"name": provider}}, "total": 1})
	case r.Method == "GET" && path == "/api/providers/"+provider+"/keys":
		return respond(200, map[string]any{"keys": []any{map[string]any{"id": providerKey, "enabled": true}}, "total": 1})
	case strings.HasPrefix(path, "/api/providers/"+provider+"/keys/"):
		if r.Method == "GET" {
			return respond(200, map[string]any{"aliases": map[string]any{}})
		}
		if r.Method == "PUT" {
			return respond(200, map[string]any{})
		}
	case r.Method == "GET" && path == "/api/models":
		models := []map[string]any{}
		for _, name := range []string{"qa-code", "qa-chat", "qa-vision", "qa-unregistered"} {
			models = append(models, map[string]any{"name": name, "provider": provider, "accessible_by_keys": []string{providerKey}})
		}
		return respond(200, map[string]any{"models": models, "total": len(models)})
	case path == "/api/governance/virtual-keys":
		if r.Method == "GET" {
			keys := []*virtualKey{}
			for _, key := range b.keys {
				keys = append(keys, key)
			}
			return respond(200, map[string]any{"virtual_keys": keys, "total_count": len(keys)})
		}
		if r.Method == "POST" {
			var input virtualKey
			if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
				return respond(400, map[string]string{"error": "invalid fixture key"})
			}
			b.next++
			input.ID = fmt.Sprintf("vk-qa-created-%d", b.next)
			input.Value = fmt.Sprintf("sk-bf-qa-fixture-created-%d", b.next)
			input.Active = true
			input.ProviderConfigs = []providerConfig{}
			b.keys[input.ID] = &input
			return respond(200, map[string]any{"virtual_key": input})
		}
	case strings.HasPrefix(path, "/api/governance/virtual-keys/"):
		id := strings.TrimPrefix(path, "/api/governance/virtual-keys/")
		key := b.keys[id]
		if key == nil {
			return respond(404, map[string]string{"error": "fixture key not found"})
		}
		if r.Method == "PUT" {
			var input virtualKey
			if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
				return respond(400, map[string]string{"error": "invalid fixture key update"})
			}
			key.Name, key.Description, key.Active = input.Name, input.Description, input.Active
			key.ProviderConfigs = input.ProviderConfigs
		}
		if r.Method == "GET" || r.Method == "PUT" {
			return respond(200, map[string]any{"virtual_key": key})
		}
	case r.Method == "GET" && path == "/v1/models":
		secret := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		for _, key := range b.keys {
			if key.Value != secret {
				continue
			}
			visible := []map[string]string{}
			if view, ok := b.store.Load().View(key.ID); ok {
				for _, route := range view.Routes {
					for _, pc := range key.ProviderConfigs {
						for _, allowed := range pc.AllowedModels {
							if pc.Provider == route.Provider && allowed == route.Alias {
								visible = append(visible, map[string]string{"id": route.ExposedID})
							}
						}
					}
				}
			}
			return respond(200, map[string]any{"data": visible})
		}
		return respond(401, map[string]string{"error": "unknown fixture key"})
	}
	return respond(404, map[string]string{"error": "unsupported synthetic Bifrost route"})
}

func model(id, name, creator, family, kind string) registry.Model {
	ui, _ := json.Marshal(map[string]any{"id": id, "name": name, "creator": creator, "family": family, "kind": kind, "inputModalities": []string{"Text"}, "outputModalities": []string{"Text"}, "tasks": []string{kind}, "context": "128K", "capabilities": map[string]string{"Tools": "Declared"}})
	return registry.Model{ID: id, Alias: id, Provider: provider, ProviderKeyIDs: []string{providerKey}, UpstreamModel: id, Creator: creator, Family: family, Endpoints: []string{"chat/completions", "responses"}, Enabled: true, Configured: true, Evidence: "Synthetic browser fixture only", Metadata: map[string]json.RawMessage{"ui": ui}}
}

func reference(id, name, creator, family string) registry.CatalogReference {
	return registry.CatalogReference{ID: id, CatalogRecord: registry.CatalogRecord{Candidates: map[string]map[string]json.RawMessage{
		"name": {"models.dev": jsonString(name)}, "creator": {"models.dev": jsonString(creator)}, "family": {"models.dev": jsonString(family)},
		"context_length": {"models.dev": json.RawMessage("131072")}, "input_modalities": {"models.dev": json.RawMessage(`["text"]`)}, "output_modalities": {"models.dev": json.RawMessage(`["text"]`)},
	}}}
}

func jsonString(s string) json.RawMessage { b, _ := json.Marshal(s); return b }

func seed() registry.Config {
	models := []registry.Model{
		model("qa-code", "QA Code", "Fixture Labs", "QA", "Chat"),
		model("qa-chat", "QA Chat", "Fixture Labs", "QA", "Chat"),
		model("qa-vision", "QA Vision", "Fixture Labs", "QA", "Vision"),
	}
	return registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: models,
		Groups: []registry.Group{{ID: "qa-development", Name: "QA Development", ModelIDs: []string{"qa-code", "qa-chat"}}, {ID: "qa-visual", Name: "QA Visual", ModelIDs: []string{"qa-vision"}}},
		Policies: []registry.Policy{
			{VirtualKeyID: "vk-qa-dev", Name: "QA Development Key", TokenSHA256: registry.TokenHash("sk-bf-qa-fixture-dev"), Naming: "provider/model", Groups: []string{"qa-development"}, Enabled: true},
			{VirtualKeyID: "vk-qa-visual", Name: "QA Visual Key", TokenSHA256: registry.TokenHash("sk-bf-qa-fixture-visual"), Naming: "provider/model", Groups: []string{"qa-visual"}, Enabled: true},
		},
		Catalog: &registry.Catalog{References: []registry.CatalogReference{
			reference("fixture/qa-code", "QA Code", "Fixture Labs", "QA"), reference("fixture/qa-chat", "QA Chat", "Fixture Labs", "QA"), reference("fixture/qa-vision", "QA Vision", "Fixture Labs", "QA"), reference("fixture/qa-unregistered", "QA Unregistered", "Fixture Labs", "QA"),
		}, Accesses: []registry.CatalogAccess{
			{ID: provider + "/qa-code", Provider: provider, Model: "qa-code", Configured: true, ReferenceID: "fixture/qa-code"},
			{ID: provider + "/qa-chat", Provider: provider, Model: "qa-chat", Configured: true, ReferenceID: "fixture/qa-chat"},
			{ID: provider + "/qa-vision", Provider: provider, Model: "qa-vision", Configured: true, ReferenceID: "fixture/qa-vision"},
			{ID: provider + "/qa-unregistered", Provider: provider, Model: "qa-unregistered", Configured: true, ReferenceID: "fixture/qa-unregistered"},
		}, Sources: []registry.CatalogSource{{ID: "bifrost"}, {ID: "models.dev"}}},
	}
}

func main() {
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func run() error {
	base := filepath.Join("dist", "checks", "ux-audit")
	if err := os.MkdirAll(base, 0700); err != nil {
		return err
	}
	dir, err := os.MkdirTemp(base, "ui-fixture-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "registry.json")
	config, err := json.Marshal(seed())
	if err != nil {
		return err
	}
	if err = registry.AtomicWrite(path, config); err != nil {
		return err
	}
	store, err := registry.OpenStore(path)
	if err != nil {
		return err
	}
	token := os.Getenv("QA_FIXTURE_ADMIN_TOKEN")
	if token == "" {
		token = defaultToken
	}
	server, err := admin.New(store, token, nil)
	if err != nil {
		return err
	}
	if err = server.UseUIDirectory("ui/dist"); err != nil {
		return fmt.Errorf("build current UI first with npm --prefix ui run build: %w", err)
	}
	b := &syntheticBifrost{store: store, keys: map[string]*virtualKey{
		"vk-qa-dev":       {ID: "vk-qa-dev", Name: "QA Development Key", Description: "Synthetic development client", Value: "sk-bf-qa-fixture-dev", Active: true, ProviderConfigs: []providerConfig{{Provider: provider, AllowedModels: []string{"qa-code", "qa-chat"}}}},
		"vk-qa-visual":    {ID: "vk-qa-visual", Name: "QA Visual Key", Description: "Synthetic visual client", Value: "sk-bf-qa-fixture-visual", Active: true, ProviderConfigs: []providerConfig{{Provider: provider, AllowedModels: []string{"qa-vision"}}}},
		"vk-qa-unmanaged": {ID: "vk-qa-unmanaged", Name: "QA Unmanaged Key", Description: "Synthetic unmanaged client", Value: "sk-bf-qa-fixture-unmanaged", Active: true, ProviderConfigs: []providerConfig{}},
	}}
	server.ConnectNative(roundTrip(b.roundTrip))
	httpServer := server.HTTPServer("127.0.0.1:4174")
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(stop)
	go func() { <-stop; _ = httpServer.Close() }()
	log.Printf("synthetic UI fixture ready at http://127.0.0.1:4174/ (registry: %s)", path)
	if err := httpServer.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
