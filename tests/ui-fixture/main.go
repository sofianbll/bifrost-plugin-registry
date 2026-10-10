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
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"syscall"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
)

const defaultToken = "qa-fixture-admin-token-only-1234567890"
const provider = "synthetic-provider"
const providerKey = "synthetic-provider-key"

// nativeModel is one model a synthetic provider serves, as Bifrost discovers it.
type nativeModel struct {
	name, reference string  // reference: Models.dev reference the catalogue links it to, if any
	mode            string  // as Bifrost's /api/models/parameters datasheet declares it
	input, output   float64 // documented price in USD per million tokens, if any
}

// gatewayProvider mirrors a Bifrost 2.2.6 provider: custom ones carry a base provider type.
type gatewayProvider struct {
	name, baseType, key string
	models              []nativeModel
}

// The shape of a real subscription gateway: custom subscription providers, an aggregator
// whose native names cross-list subscription models, and variant IDs. Names are synthetic.
var providers = []gatewayProvider{
	{name: provider, key: providerKey, models: []nativeModel{
		{name: "qa-code", reference: "fixture/qa-code", mode: "chat"}, {name: "qa-chat", reference: "fixture/qa-chat", mode: "chat"},
		{name: "qa-vision", reference: "fixture/qa-vision", mode: "chat"}, {name: "qa-unregistered", reference: "fixture/qa-unregistered", mode: "chat"},
	}},
	{name: "Claude", baseType: "anthropic", key: "claude-subscription-key", models: []nativeModel{
		{name: "qa-opus", reference: "anthropic/qa-opus", mode: "chat"}, {name: "qa-haiku", reference: "anthropic/qa-haiku", mode: "chat"},
	}},
	{name: "Codex", baseType: "openai", key: "codex-subscription-key", models: []nativeModel{
		{name: "qa-codex", reference: "openai/qa-codex", mode: "chat"}, {name: "qa-codex-mini", mode: "chat"},
	}},
	{name: "Google", baseType: "gemini", key: "google-subscription-key", models: []nativeModel{
		{name: "qa-gemini", reference: "google/qa-gemini", mode: "chat"}, {name: "qa-image", reference: "google/qa-image", mode: "image_generation"},
	}},
	{name: "openrouter", key: "openrouter-key", models: aggregatorModels()},
}

// aggregatorModels pages past the 60-card first screen. anthropic/qa-opus shares its reference
// with the saved Claude card qa-opus; the variants have no reference. The qwen/ fillers sort
// after the qa-* cards, so the first screen of the mixed catalogue still shows QA Chat.
func aggregatorModels() []nativeModel {
	models := []nativeModel{
		{name: "anthropic/qa-opus", reference: "anthropic/qa-opus", mode: "chat", input: 4, output: 20},
		{name: "~anthropic/qa-opus-latest", mode: "chat"},
		{name: "openai/qa-codex:batch", mode: "chat"},
		// Bifrost declares 2e-7 per token; read per million it carries float noise the UI must not show.
		{name: "deepseek/qa-reasoner", reference: "deepseek/qa-reasoner", mode: "chat", input: 0.19999999999999998, output: 0.6},
		{name: "tencent/qa-hunyuan", reference: "tencent/qa-hunyuan", mode: "chat"},
		{name: "meituan/qa-longcat", reference: "meituan/qa-longcat", mode: "chat"},
	}
	for i := 1; i <= 60; i++ {
		models = append(models, nativeModel{name: fmt.Sprintf("qwen/qa-qwen-%02d", i), mode: "chat"})
	}
	return models
}

type roundTrip func(*http.Request) (*http.Response, error)

func (f roundTrip) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

type virtualKey struct {
	ID                string           `json:"id"`
	Name              string           `json:"name"`
	Description       string           `json:"description"`
	Value             string           `json:"value"`
	Active            bool             `json:"is_active"`
	AllowAllProviders bool             `json:"allow_all_providers"`
	ProviderConfigs   []providerConfig `json:"provider_configs"`
}

type providerConfig struct {
	Provider      string   `json:"provider"`
	AllowedModels []string `json:"allowed_models"` // "*" allows every model of the provider
	AllowAllKeys  bool     `json:"allow_all_keys"`
	KeyIDs        []string `json:"key_ids,omitempty"`
	Keys          []struct {
		KeyID string `json:"key_id"`
	} `json:"keys,omitempty"`
}

func (k *virtualKey) allows(provider, model string) bool {
	if k.AllowAllProviders {
		return true
	}
	for _, pc := range k.ProviderConfigs {
		if pc.Provider == provider && (slices.Contains(pc.AllowedModels, "*") || slices.Contains(pc.AllowedModels, model)) {
			return true
		}
	}
	return false
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

func findProvider(name string) *gatewayProvider {
	for i := range providers {
		if providers[i].name == name {
			return &providers[i]
		}
	}
	return nil
}

// page applies Bifrost's limit/offset pagination to a {models,total} listing.
func page(rows []map[string]any, query url.Values) map[string]any {
	offset, _ := strconv.Atoi(query.Get("offset"))
	limit, err := strconv.Atoi(query.Get("limit"))
	if err != nil || limit <= 0 {
		limit = len(rows)
	}
	offset = min(max(offset, 0), len(rows))
	return map[string]any{"models": rows[offset:min(offset+limit, len(rows))], "total": len(rows)}
}

func (b *syntheticBifrost) roundTrip(r *http.Request) (*http.Response, error) {
	b.Lock()
	defer b.Unlock()
	path := r.URL.Path
	switch {
	case r.Method == "GET" && path == "/api/version":
		return respond(200, "2.2.6-fixture")
	case r.Method == "GET" && path == "/api/providers":
		rows := []map[string]any{}
		for _, p := range providers {
			row := map[string]any{"name": p.name}
			if p.baseType != "" {
				row["custom_provider_config"] = map[string]any{"base_provider_type": p.baseType, "is_key_less": false}
			}
			rows = append(rows, row)
		}
		return respond(200, map[string]any{"providers": rows, "total": len(rows)})
	case strings.HasPrefix(path, "/api/providers/"):
		// /api/providers/{name}/keys and /api/providers/{name}/keys/{id}
		parts := strings.Split(strings.TrimPrefix(path, "/api/providers/"), "/")
		p := findProvider(parts[0])
		if p == nil || len(parts) < 2 || parts[1] != "keys" {
			break
		}
		if len(parts) == 2 && r.Method == "GET" {
			return respond(200, map[string]any{"keys": []any{map[string]any{"id": p.key, "enabled": true}}, "total": 1})
		}
		if r.Method == "GET" {
			return respond(200, map[string]any{"aliases": map[string]any{}})
		}
		if r.Method == "PUT" {
			return respond(200, map[string]any{})
		}
	case r.Method == "GET" && path == "/api/models":
		models := []map[string]any{}
		if p := findProvider(r.URL.Query().Get("provider")); p != nil {
			for _, m := range p.models {
				models = append(models, map[string]any{"name": m.name, "provider": p.name, "accessible_by_keys": []string{p.key}})
			}
		}
		return respond(200, page(models, r.URL.Query()))
	case r.Method == "GET" && path == "/api/models/details":
		rows := []map[string]any{}
		for _, p := range providers {
			for _, m := range p.models {
				row := map[string]any{"name": m.name, "provider": p.name}
				if m.input > 0 {
					row["input_cost_per_token"], row["output_cost_per_token"] = m.input/1e6, m.output/1e6
				}
				rows = append(rows, row)
			}
		}
		return respond(200, page(rows, r.URL.Query()))
	case r.Method == "GET" && path == "/api/models/parameters":
		name, model, _ := strings.Cut(r.URL.Query().Get("model"), "/")
		if p := findProvider(name); p != nil {
			for _, m := range p.models {
				if m.name == model {
					return respond(200, datasheet(p, m))
				}
			}
		}
		return respond(404, map[string]string{"error": "no fixture datasheet"})
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
			key.AllowAllProviders, key.ProviderConfigs = input.AllowAllProviders, input.ProviderConfigs
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
			} else {
				// Without a Registry policy, Bifrost lists what the native permissions allow.
				for _, p := range providers {
					for _, m := range p.models {
						if key.allows(p.name, m.name) {
							visible = append(visible, map[string]string{"id": p.name + "/" + m.name})
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

// subscriptionCard is saved the way the real gateway's cards were registered from discovery:
// its name is the common ID and its creator is unknown.
func subscriptionCard(provider, id string) registry.Model {
	p := findProvider(provider)
	ui, _ := json.Marshal(map[string]any{"id": id, "name": id, "creator": "Unknown", "family": "Unknown", "kind": "Unknown", "inputModalities": []string{}, "outputModalities": []string{}, "tasks": []string{}, "context": "Unknown", "capabilities": map[string]string{}})
	return registry.Model{ID: id, Alias: id, Provider: p.name, ProviderKeyIDs: []string{p.key}, UpstreamModel: id, Endpoints: []string{"chat/completions", "responses"}, Enabled: true, Configured: true, Evidence: "Synthetic browser fixture only", Metadata: map[string]json.RawMessage{"ui": ui}}
}

const text = `["text"]`

// Models.dev references carry no creator, only their ID namespace; the fixture/* ones predate this.
func reference(id, name, creator, family, input, output string) registry.CatalogReference {
	candidates := map[string]map[string]json.RawMessage{
		"name": {"models.dev": jsonString(name)}, "family": {"models.dev": jsonString(family)},
		"context_length": {"models.dev": json.RawMessage("131072")}, "input_modalities": {"models.dev": json.RawMessage(input)}, "output_modalities": {"models.dev": json.RawMessage(output)},
	}
	if creator != "" {
		candidates["creator"] = map[string]json.RawMessage{"models.dev": jsonString(creator)}
	}
	return registry.CatalogReference{ID: id, CatalogRecord: registry.CatalogRecord{Candidates: candidates}}
}

// datasheet is what Bifrost's /api/models/parameters returns for a native model.
func datasheet(p *gatewayProvider, m nativeModel) map[string]any {
	return map[string]any{"model": m.name, "provider": p.name, "mode": m.mode}
}

// catalogAccesses is what a Bifrost catalogue refresh stores, in provider order so the
// original synthetic-provider rows stay on the first page of the catalogue data screen.
func catalogAccesses() []registry.CatalogAccess {
	accesses := []registry.CatalogAccess{}
	for i := range providers {
		p := &providers[i]
		for _, m := range p.models {
			parameters, _ := json.Marshal(datasheet(p, m))
			fields := map[string]map[string]json.RawMessage{"parameters": {"bifrost": parameters}}
			if m.input > 0 {
				fields["input_cost_usd_per_million"] = map[string]json.RawMessage{"bifrost": jsonNumber(m.input)}
				fields["output_cost_usd_per_million"] = map[string]json.RawMessage{"bifrost": jsonNumber(m.output)}
			}
			accesses = append(accesses, registry.CatalogAccess{ID: p.name + "/" + m.name, Provider: p.name, Model: m.name, Configured: true, ReferenceID: m.reference, CatalogRecord: registry.CatalogRecord{Candidates: fields}})
		}
	}
	return accesses
}

func jsonString(s string) json.RawMessage  { b, _ := json.Marshal(s); return b }
func jsonNumber(n float64) json.RawMessage { b, _ := json.Marshal(n); return b }

func seed() registry.Config {
	models := []registry.Model{
		model("qa-code", "QA Code", "Fixture Labs", "QA", "Chat"),
		model("qa-chat", "QA Chat", "Fixture Labs", "QA", "Chat"),
		model("qa-vision", "QA Vision", "Fixture Labs", "QA", "Vision"),
		subscriptionCard("Claude", "qa-opus"), subscriptionCard("Claude", "qa-haiku"),
		subscriptionCard("Codex", "qa-codex"), subscriptionCard("Codex", "qa-codex-mini"),
		subscriptionCard("Google", "qa-gemini"),
	}
	return registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: models,
		Groups: []registry.Group{{ID: "qa-development", Name: "QA Development", ModelIDs: []string{"qa-code", "qa-chat"}}, {ID: "qa-visual", Name: "QA Visual", ModelIDs: []string{"qa-vision"}}},
		Policies: []registry.Policy{
			{VirtualKeyID: "vk-qa-dev", Name: "QA Development Key", TokenSHA256: registry.TokenHash("sk-bf-qa-fixture-dev"), Naming: "provider/model", Groups: []string{"qa-development"}, Enabled: true},
			{VirtualKeyID: "vk-qa-visual", Name: "QA Visual Key", TokenSHA256: registry.TokenHash("sk-bf-qa-fixture-visual"), Naming: "provider/model", Groups: []string{"qa-visual"}, Enabled: true},
		},
		Catalog: &registry.Catalog{References: []registry.CatalogReference{
			reference("fixture/qa-code", "QA Code", "Fixture Labs", "QA", text, text), reference("fixture/qa-chat", "QA Chat", "Fixture Labs", "QA", text, text), reference("fixture/qa-vision", "QA Vision", "Fixture Labs", "QA", text, text), reference("fixture/qa-unregistered", "QA Unregistered", "Fixture Labs", "QA", text, text),
			// Namespaces with a Models.dev provider record (anthropic, openai, google, deepseek)…
			reference("anthropic/qa-opus", "QA Opus", "", "qa-claude", `["text","image","pdf"]`, text), reference("anthropic/qa-haiku", "QA Haiku", "", "qa-claude", text, text),
			reference("openai/qa-codex", "QA Codex", "", "qa-gpt", text, text), reference("google/qa-gemini", "QA Gemini", "", "qa-gemini", `["text","image"]`, text),
			reference("google/qa-image", "QA Image", "", "qa-gemini", text, `["image"]`), reference("deepseek/qa-reasoner", "QA Reasoner", "", "qa-deepseek", text, text),
			// …and without one (tencent, meituan).
			reference("tencent/qa-hunyuan", "QA Hunyuan", "", "qa-hunyuan", text, text), reference("meituan/qa-longcat", "QA LongCat", "", "qa-longcat", text, text),
		}, Accesses: catalogAccesses(), Sources: []registry.CatalogSource{{ID: "bifrost"}, {ID: "models.dev"}}},
	}
}

// seedKeys are the native virtual keys. The last three are unmanaged with native permissions only.
func seedKeys() map[string]*virtualKey {
	return map[string]*virtualKey{
		"vk-qa-dev":           {ID: "vk-qa-dev", Name: "QA Development Key", Description: "Synthetic development client", Value: "sk-bf-qa-fixture-dev", Active: true, ProviderConfigs: []providerConfig{{Provider: provider, AllowedModels: []string{"qa-code", "qa-chat"}}}},
		"vk-qa-visual":        {ID: "vk-qa-visual", Name: "QA Visual Key", Description: "Synthetic visual client", Value: "sk-bf-qa-fixture-visual", Active: true, ProviderConfigs: []providerConfig{{Provider: provider, AllowedModels: []string{"qa-vision"}}}},
		"vk-qa-unmanaged":     {ID: "vk-qa-unmanaged", Name: "QA Unmanaged Key", Description: "Synthetic unmanaged client", Value: "sk-bf-qa-fixture-unmanaged", Active: true, ProviderConfigs: []providerConfig{}},
		"vk-qa-all-providers": {ID: "vk-qa-all-providers", Name: "QA All Providers Key", Description: "Synthetic client allowed every provider", Value: "sk-bf-qa-fixture-all-providers", Active: true, AllowAllProviders: true, ProviderConfigs: []providerConfig{}},
		"vk-qa-codex":         {ID: "vk-qa-codex", Name: "QA Codex Key", Description: "Synthetic Codex client", Value: "sk-bf-qa-fixture-codex", Active: true, ProviderConfigs: []providerConfig{{Provider: "Codex", AllowedModels: []string{"qa-codex", "qa-codex-mini"}, AllowAllKeys: true}}},
		"vk-qa-claude":        {ID: "vk-qa-claude", Name: "QA Claude Key", Description: "Synthetic Claude client", Value: "sk-bf-qa-fixture-claude", Active: true, ProviderConfigs: []providerConfig{{Provider: "Claude", AllowedModels: []string{"*"}, AllowAllKeys: true}}},
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
	b := &syntheticBifrost{store: store, keys: seedKeys()}
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
