package admin

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

type adoptionHarness struct {
	server   *Server
	secret   string
	active   bool
	present  bool
	masked   bool
	keyID    string
	keyModel string
	reads    int
	writes   int
}

func newAdoptionHarness(t *testing.T) *adoptionHarness {
	t.Helper()
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}
	cfg := s.Store.Load().Config()
	cfg.Models = []registry.Model{
		{ID: "openai-alpha", Alias: "alpha", Provider: "openai", ProviderKeyIDs: []string{"key-a"}, UpstreamModel: "alpha", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true},
		{ID: "openai-beta", Alias: "beta", Provider: "openai", ProviderKeyIDs: []string{"key-b"}, UpstreamModel: "beta", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true},
	}
	raw, _ := json.Marshal(cfg)
	if _, err := s.Store.Save(raw, s.Store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	h := &adoptionHarness{server: s, secret: "sk-bf-native-secret", active: true, present: true, keyID: "vk-native", keyModel: "alpha"}
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		if r.Method != "GET" {
			h.writes++
			t.Fatalf("adoption modified native state: %s %s", r.Method, r.URL.Path)
		}
		switch r.URL.Path {
		case "/api/governance/virtual-keys":
			if !h.present {
				return nativeResponse(200, `{"virtual_keys":[],"total_count":0}`), nil
			}
			return nativeResponse(200, `{"virtual_keys":[{"id":"vk-native","name":"Native"}],"total_count":1}`), nil
		case "/api/governance/virtual-keys/vk-native":
			value := h.secret
			if h.masked {
				value = "sk-bf-****"
			}
			body, _ := json.Marshal(map[string]any{"virtual_key": map[string]any{
				"id": h.keyID, "name": "Native", "value": value, "is_active": h.active,
				"allow_all_providers": false,
				"provider_configs":    []any{map[string]any{"provider": "openai", "allowed_models": []string{h.keyModel}, "keys": []any{map[string]any{"key_id": "key-a"}}}},
			}})
			return nativeResponse(200, string(body)), nil
		case "/api/providers":
			return nativeResponse(200, `{"providers":[{"name":"openai"}],"total":1}`), nil
		case "/api/providers/openai/keys":
			return nativeResponse(200, `{"keys":[{"id":"key-a","enabled":true},{"id":"key-b","enabled":true}],"total":2}`), nil
		case "/api/models":
			if r.URL.Query().Get("provider") != "openai" || r.URL.Query().Get("keys") != "key-a,key-b" {
				t.Fatalf("discovery did not use native enabled keys: %s", r.URL.String())
			}
			return nativeResponse(200, `{"models":[{"name":"alpha","provider":"openai","accessible_by_keys":["key-a"]},{"name":"beta","provider":"openai","accessible_by_keys":["key-b"]}],"total":2}`), nil
		case "/v1/models":
			h.reads++
			if r.Header.Get("Authorization") != "Bearer "+h.secret {
				t.Fatal("model readback did not use native credential")
			}
			body, _ := json.Marshal(map[string]any{"data": []any{map[string]any{"id": "openai/" + h.keyModel}}})
			return nativeResponse(200, string(body)), nil
		default:
			t.Fatalf("unexpected native route: %s", r.URL.String())
			return nil, nil
		}
	})
	return h
}

func (h *adoptionHarness) request(operation, phase, token, revision string) *httpResponse {
	input, _ := json.Marshal(adoptionInput{KeyID: h.keyID, Operation: operation, Phase: phase, PreviewToken: token})
	headers := authorized()
	if revision != "" {
		headers["If-Match"] = revision
	}
	w := perform(h.server, "POST", "/api/keys/adopt", string(input), headers)
	return &httpResponse{code: w.Code, body: w.Body.String()}
}

type httpResponse struct {
	code int
	body string
}

func (h *adoptionHarness) preview(t *testing.T, operation string) adoptionPreview {
	t.Helper()
	w := h.request(operation, "preview", "", "")
	if w.code != 200 || strings.Contains(w.body, h.secret) {
		t.Fatalf("preview status or secret leak: %d %s", w.code, w.body)
	}
	var p adoptionPreview
	if err := json.Unmarshal([]byte(w.body), &p); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestAdoptNativeKeyPreservesNarrowNativePermissions(t *testing.T) {
	h := newAdoptionHarness(t)
	if w := perform(h.server, "POST", "/api/keys/adopt", `{"keyId":"vk-native","operation":"adopt","phase":"preview"}`, nil); w.Code != 401 {
		t.Fatal("adoption endpoint bypassed admin auth", w.Code)
	}
	before := perform(h.server, "GET", "/api/workspace", "", authorized())
	if before.Code != 200 || !strings.Contains(before.Body.String(), `"managed":false`) {
		t.Fatal("native-only key did not remain unmanaged before adoption", before.Code, before.Body.String())
	}
	p := h.preview(t, "adopt")
	if !p.CanApply || p.PreviewToken == "" || strings.Join(p.SelectedRoutes, ",") != "openai/alpha" || strings.Join(p.NativeRoutes, ",") != "openai/alpha" || !p.NativePermissionsPreserved {
		t.Fatalf("wrong constrained adoption preview: %+v", p)
	}
	if w := h.request("adopt", "apply", p.PreviewToken, "stale"); w.code != 409 {
		t.Fatal("stale Registry revision accepted", w.code, w.body)
	}
	if w := h.request("adopt", "apply", p.PreviewToken, ""); w.code != 428 {
		t.Fatal("missing If-Match accepted", w.code, w.body)
	}
	h.keyModel = "beta"
	if w := h.request("adopt", "apply", p.PreviewToken, p.Revision); w.code != 409 {
		t.Fatal("changed native permissions accepted from stale preview", w.code, w.body)
	}
	h.keyModel = "alpha"
	w := h.request("adopt", "apply", p.PreviewToken, p.Revision)
	if w.code != 200 || strings.Contains(w.body, h.secret) {
		t.Fatal("adoption failed or returned native secret", w.code, w.body)
	}
	view, ok := h.server.Store.Load().View(h.keyID)
	if !ok || len(view.Routes) != 1 || view.Routes[0].ExposedID != "openai/alpha" || !view.Policy.Adopted || strings.Join(view.Policy.NativeModelIDs, ",") != "openai-alpha" || view.Policy.TokenSHA256 != registry.TokenHash(h.secret) {
		t.Fatalf("adoption lost native ceiling: %+v", view)
	}
	if h.writes != 0 || h.reads == 0 {
		t.Fatal("adoption changed native permissions or skipped native readback", h.writes, h.reads)
	}
	if w := h.request("adopt", "preview", "", ""); w.code != 409 {
		t.Fatal("managed key silently adopted twice", w.code)
	}
}

func TestAdoptionBlocksMissingDisabledOrMaskedNativeKey(t *testing.T) {
	for _, tc := range []struct {
		name, change string
		status       int
	}{
		{"missing", "missing", 404},
		{"disabled", "disabled", 200},
		{"masked", "masked", 200},
		{"unsupported_mapping", "unmapped", 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			h := newAdoptionHarness(t)
			switch tc.change {
			case "missing":
				h.present = false
			case "disabled":
				h.active = false
			case "masked":
				h.masked = true
			case "unmapped":
				h.keyModel = "not-configured"
			}
			w := h.request("adopt", "preview", "", "")
			if w.code != tc.status {
				t.Fatalf("unexpected preview status: %d %s", w.code, w.body)
			}
			if tc.status == 200 {
				var p adoptionPreview
				if err := json.Unmarshal([]byte(w.body), &p); err != nil || p.CanApply || len(p.Blocked) == 0 {
					t.Fatalf("unsupported native key was offered for adoption: %s", w.body)
				}
				if got := h.request("adopt", "apply", "wrong-preview", p.Revision); got.code != 409 {
					t.Fatal("blocked preview applied", got.code, got.body)
				}
			}
			if len(h.server.Store.Load().Config().Policies) != 0 || h.writes != 0 {
				t.Fatal("blocked adoption changed Registry or native state")
			}
		})
	}
}

func TestRebindRotatedManagedNativeKey(t *testing.T) {
	h := newAdoptionHarness(t)
	p := h.preview(t, "adopt")
	if w := h.request("adopt", "apply", p.PreviewToken, p.Revision); w.code != 200 {
		t.Fatal(w.code, w.body)
	}
	if current := h.preview(t, "rebind"); current.CanApply || len(current.Blocked) == 0 {
		t.Fatal("current native binding offered for rebind", current)
	}
	h.secret = "sk-bf-rotated-secret"
	rotated := h.preview(t, "rebind")
	if !rotated.CanApply || rotated.PreviewToken == "" || strings.Join(rotated.SelectedRoutes, ",") != "openai/alpha" {
		t.Fatal("rotated native key cannot rebind", rotated)
	}
	if w := h.request("rebind", "apply", rotated.PreviewToken, rotated.Revision); w.code != 200 {
		t.Fatal(w.code, w.body)
	}
	view, _ := h.server.Store.Load().View(h.keyID)
	if view.Policy.TokenSHA256 != registry.TokenHash(h.secret) || !view.Policy.Adopted || h.writes != 0 {
		t.Fatal("rebind changed permissions or failed to change fingerprint", view.Policy)
	}
}
