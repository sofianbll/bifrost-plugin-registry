package admin

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

func TestAssistantSettingsAndSuggestions(t *testing.T) {
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}
	secret := "sk-bf-provider-secret"
	inferenceStatus := 200
	readbackStatus := 200
	hideAlias := false
	selectedModel := "OpenAI/alpha"
	malformed := false
	var inferenceCalls int
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host != "bifrost.local" {
			t.Fatal("unexpected upstream host")
		}
		switch r.URL.Path {
		case "/api/providers":
			if r.Header.Get("Authorization") != "Bearer native-admin" {
				t.Fatal("missing admin auth")
			}
			return nativeResponse(200, `{"providers":[{"name":"OpenAI"}]}`), nil
		case "/api/providers/OpenAI/keys":
			return nativeResponse(200, `{"keys":[{"id":"provider-key","enabled":true}]}`), nil
		case "/api/models":
			return nativeResponse(200, `{"models":[{"name":"gpt-test","provider":"OpenAI","accessible_by_keys":["provider-key"]}],"total":1}`), nil
		case "/api/governance/virtual-keys":
			return nativeResponse(200, `{"virtual_keys":[{"id":"vk-test","name":"Test key","value":"`+secret+`","is_active":true}]}`), nil
		case "/v1/models":
			if r.Header.Get("Authorization") != "Bearer "+secret {
				t.Fatal("model list did not use selected VK")
			}
			if readbackStatus != 200 {
				return nativeResponse(readbackStatus, `{"error":"private native error"}`), nil
			}
			if hideAlias {
				return nativeResponse(200, `{"data":[]}`), nil
			}
			// Registry publishes aliases that differ from the upstream gpt-test ID.
			return nativeResponse(200, `{"data":[{"id":"OpenAI/alpha"},{"id":"alpha"}]}`), nil
		case "/v1/chat/completions", "/v1/responses":
			inferenceCalls++
			if r.Header.Get("Authorization") != "Bearer "+secret {
				t.Fatal("inference did not use selected native VK")
			}
			body, _ := io.ReadAll(r.Body)
			if strings.Contains(string(body), secret) || strings.Contains(string(body), "native-admin") || !strings.Contains(string(body), `"model":"`+selectedModel+`"`) {
				t.Fatal("unsafe inference body")
			}
			if inferenceStatus != 200 {
				return nativeResponse(inferenceStatus, `{"error":"provider-secret-should-stay-private"}`), nil
			}
			content := `{"referenceId":"","fields":{"name":"GPT test","tool_call":true}}`
			if malformed {
				content = `{"fields":{"tool_call":"yes"}}`
			}
			encoded, _ := json.Marshal(content)
			if r.URL.Path == "/v1/responses" {
				return nativeResponse(200, `{"output":[{"content":[{"type":"output_text","text":`+string(encoded)+`}]}]}`), nil
			}
			return nativeResponse(200, `{"choices":[{"message":{"content":`+string(encoded)+`}}]}`), nil
		}
		t.Fatal("unexpected Bifrost path", r.URL.Path)
		return nil, nil
	})
	if got := perform(s, "GET", "/api/assistant/models", "", nil); got.Code != 401 {
		t.Fatal(got.Code)
	}
	options := perform(s, "GET", "/api/assistant/models", "", authorized())
	if options.Code != 200 || !strings.Contains(options.Body.String(), `"virtualKeys"`) || strings.Contains(options.Body.String(), secret) {
		t.Fatal(options.Code, options.Body.String())
	}
	if strings.Contains(options.Body.String(), "OpenAI/alpha") {
		t.Fatal("models listed before selecting VK")
	}
	options = perform(s, "GET", "/api/assistant/models?virtualKeyId=vk-test", "", authorized())
	if options.Code != 200 || !strings.Contains(options.Body.String(), `"id":"OpenAI/alpha"`) || !strings.Contains(options.Body.String(), `"id":"alpha"`) || strings.Contains(options.Body.String(), secret) {
		t.Fatal("key-scoped models", options.Code, options.Body.String())
	}
	if got := perform(s, "GET", "/api/assistant/models?virtualKeyId=missing", "", authorized()); got.Code != 422 {
		t.Fatal("unknown key", got.Code)
	}
	readbackStatus = 403
	if got := perform(s, "GET", "/api/assistant/models?virtualKeyId=vk-test", "", authorized()); got.Code != 403 || strings.Contains(got.Body.String(), "private native error") {
		t.Fatal("native model denial", got.Code, got.Body.String())
	}
	readbackStatus = 401
	if got := perform(s, "GET", "/api/assistant/models?virtualKeyId=vk-test", "", authorized()); got.Code != 403 {
		t.Fatal("native 401 must not log out Registry admin", got.Code)
	}
	readbackStatus = 200
	settings := perform(s, "GET", "/api/assistant/settings", "", authorized())
	if settings.Code != 200 {
		t.Fatal(settings.Code)
	}
	rev := strings.Trim(settings.Header().Get("ETag"), `"`)
	putHeaders := authorized()
	putHeaders["If-Match"] = `"` + rev + `"`
	if got := perform(s, "PUT", "/api/assistant/settings", `{"model":"OpenAI/unknown","endpoint":"chat_completions","virtualKeyId":"vk-test"}`, putHeaders); got.Code != 422 {
		t.Fatal(got.Code)
	}
	if got := perform(s, "PUT", "/api/assistant/settings", `{"model":"OpenAI/gpt-test","endpoint":"chat_completions","virtualKeyId":"vk-test"}`, putHeaders); got.Code != 422 {
		t.Fatal("unpublished upstream ID accepted", got.Code)
	}
	saved := perform(s, "PUT", "/api/assistant/settings", `{"model":"OpenAI/alpha","endpoint":"chat_completions","virtualKeyId":"vk-test"}`, putHeaders)
	if saved.Code != 200 || strings.Contains(saved.Body.String(), secret) {
		t.Fatal(saved.Code, saved.Body.String())
	}
	if got := perform(s, "PUT", "/api/assistant/settings", `{"model":"OpenAI/alpha","endpoint":"responses","virtualKeyId":"vk-test"}`, putHeaders); got.Code != 409 {
		t.Fatal("stale revision", got.Code)
	}
	draft := `{"draft":{"id":"gpt-test","name":"GPT test"}}`
	before := s.Store.Load().Revision()
	proposal := perform(s, "POST", "/api/assistant/suggest", draft, authorized())
	if proposal.Code != 200 || !strings.Contains(proposal.Body.String(), `"tool_call":true`) || strings.Contains(proposal.Body.String(), secret) {
		t.Fatal(proposal.Code, proposal.Body.String())
	}
	if s.Store.Load().Revision() != before || inferenceCalls != 1 {
		t.Fatal("suggestion mutated Registry or missed inference")
	}
	hideAlias = true
	if got := perform(s, "POST", "/api/assistant/suggest", draft, authorized()); got.Code != 422 || inferenceCalls != 1 {
		t.Fatal("revoked alias was used", got.Code)
	}
	hideAlias = false
	malformed = true
	if got := perform(s, "POST", "/api/assistant/suggest", draft, authorized()); got.Code != 502 {
		t.Fatal("malformed output", got.Code)
	}
	malformed = false
	inferenceStatus = 403
	if got := perform(s, "POST", "/api/assistant/suggest", draft, authorized()); got.Code != 403 || strings.Contains(got.Body.String(), "provider-secret") {
		t.Fatal("native denial", got.Code, got.Body.String())
	}
	inferenceStatus = 401
	if got := perform(s, "POST", "/api/assistant/suggest", draft, authorized()); got.Code != 403 {
		t.Fatal("native inference 401 must not log out Registry admin", got.Code)
	}
	inferenceStatus = 200
	putHeaders["If-Match"] = `"` + s.Store.Load().Revision() + `"`
	selectedModel = "alpha"
	if got := perform(s, "PUT", "/api/assistant/settings", `{"model":"alpha","endpoint":"responses","virtualKeyId":"vk-test"}`, putHeaders); got.Code != 200 {
		t.Fatal(got.Code)
	}
	if got := perform(s, "POST", "/api/assistant/suggest", draft, authorized()); got.Code != 200 {
		t.Fatal("responses endpoint", got.Code, got.Body.String())
	}
	if s.Store.Load().Config().Assistant.VirtualKeyID != "vk-test" {
		t.Fatal("settings were not persisted")
	}
}

func TestAssistantProposalRejectsUnknownMappingAndCapabilities(t *testing.T) {
	candidates := []assistantCandidate{{ID: "known"}}
	for _, content := range []string{
		`{"referenceId":"invented","fields":{"name":"x"}}`,
		`{"fields":{"tool_call":"yes"}}`,
		`{"fields":{"permission":true}}`,
		`{"fields":{"context_length":-1}}`,
		`{"fields":{"context_length":10000001}}`,
		`{"fields":{"input_modalities":["credential"]}}`,
	} {
		if _, err := parseAssistantProposal(content, candidates); err == nil {
			t.Fatal("accepted invalid AI proposal", content)
		}
	}
	if _, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "model", Assistant: &registry.AssistantSettings{Model: "alpha", Endpoint: "responses", VirtualKeyID: "vk"}}); err != nil {
		t.Fatal(err)
	}
}
