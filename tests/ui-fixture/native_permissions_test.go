package main

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

// #93: the Hermes key and the all-providers key can be edited natively (preview, then confirmed apply)
// and are adoptable afterwards; the fixture records the native key updates for the journeys.
func TestFixtureNativePermissionEdit(t *testing.T) {
	b, call := fixture(t)
	type edited struct {
		PreviewToken string `json:"previewToken"`
		CanApply     bool   `json:"canApply"`
		Remove       []struct {
			Provider string
			Models   []string
		}
		After struct {
			AllProviders bool `json:"allProviders"`
			Providers    []struct {
				Provider string
				Models   []string
			}
		}
	}
	edit := func(keyID, operation, provider string) edited {
		t.Helper()
		var p edited
		w := call("POST", "/api/keys/native-permissions", map[string]any{"keyId": keyID, "operation": operation, "provider": provider, "phase": "preview"}, "")
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil || !p.CanApply || p.PreviewToken == "" {
			t.Fatalf("preview of %s %s: %d %s", operation, keyID, w.Code, w.Body.String())
		}
		return p
	}
	apply := func(keyID, operation, provider string, p edited) {
		t.Helper()
		body := map[string]any{"keyId": keyID, "operation": operation, "provider": provider, "phase": "apply", "previewToken": p.PreviewToken}
		if w := call("POST", "/api/keys/native-permissions", body, ""); w.Code != 428 {
			t.Fatalf("an unconfirmed edit of %s was not refused: %d", keyID, w.Code)
		}
		body["confirm"] = true
		if w := call("POST", "/api/keys/native-permissions", body, ""); w.Code != 200 {
			t.Fatalf("apply on %s: %d %s", keyID, w.Code, w.Body.String())
		}
	}
	// adopt applies the adoption the preview offers: a key that previews as ready must also save.
	adopt := func(keyID string) {
		t.Helper()
		var p struct {
			PreviewToken string `json:"previewToken"`
			Revision     string `json:"revision"`
		}
		w := call("POST", "/api/keys/adopt", map[string]string{"keyId": keyID, "operation": "adopt", "phase": "preview"}, "")
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil {
			t.Fatal(w.Code, w.Body.String())
		}
		if w := call("POST", "/api/keys/adopt", map[string]string{"keyId": keyID, "operation": "adopt", "phase": "apply", "previewToken": p.PreviewToken}, p.Revision); w.Code != 200 {
			t.Fatalf("adopting %s: %d %s", keyID, w.Code, w.Body.String())
		}
	}
	canAdopt := func(keyID string) bool {
		t.Helper()
		var p struct {
			CanApply bool `json:"canApply"`
		}
		w := call("POST", "/api/keys/adopt", map[string]string{"keyId": keyID, "operation": "adopt", "phase": "preview"}, "")
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &p) != nil {
			t.Fatal(w.Code, w.Body.String())
		}
		return p.CanApply
	}

	if canAdopt("vk-qa-hermes") {
		t.Fatal("the Hermes key must start blocked")
	}
	p := edit("vk-qa-hermes", "remove-models", "mistral")
	if len(b.writes) != 0 {
		t.Fatal("a preview wrote to the fixture's Bifrost")
	}
	if want := "qa-mistral-large,qa-mistral-small"; len(p.Remove) != 1 || strings.Join(p.Remove[0].Models, ",") != want {
		t.Fatalf("removed models = %+v, want %s", p.Remove, want)
	}
	apply("vk-qa-hermes", "remove-models", "mistral", p)
	if !canAdopt("vk-qa-hermes") {
		t.Fatal("the Hermes key must be adoptable once its undiscovered models are removed")
	}
	adopt("vk-qa-hermes")

	if canAdopt("vk-qa-all-providers") {
		t.Fatal("the all-providers key must start blocked")
	}
	p = edit("vk-qa-all-providers", "replace-all-providers", "")
	if p.After.AllProviders || len(p.After.Providers) == 0 {
		t.Fatalf("the explicit list is missing: %+v", p.After)
	}
	apply("vk-qa-all-providers", "replace-all-providers", "", p)
	if !canAdopt("vk-qa-all-providers") {
		t.Fatal("the all-providers key must be adoptable once replaced by the explicit list")
	}
	adopt("vk-qa-all-providers")

	if len(b.writes) != 2 || b.writes[0].KeyID != "vk-qa-hermes" || b.writes[1].KeyID != "vk-qa-all-providers" {
		t.Fatalf("recorded writes = %+v", b.writes)
	}
	w := httptest.NewRecorder()
	b.recordedWrites(nil).ServeHTTP(w, httptest.NewRequest("GET", "http://127.0.0.1:4174/__fixture/native-writes", nil))
	var served []nativeWrite
	if json.Unmarshal(w.Body.Bytes(), &served) != nil || len(served) != 2 || strings.Contains(w.Body.String(), "sk-bf-") {
		t.Fatalf("served writes: %s", w.Body.String())
	}
}

// A Claude row of "*": vk-qa-wildcard is adopted keeping Claude in Bifrost and reads Verified; vk-qa-claude has
// "*" replaced by the Claude models saved in Registry (a confirmed native edit), then is adopted.
func TestFixtureWildcardKeys(t *testing.T) {
	b, call := fixture(t)
	type preview struct {
		Revision, PreviewToken string
		CanApply               bool
		SelectedRoutes         []string
		Remove                 []struct{ Models []string }
		After                  struct {
			Providers []struct {
				Provider string
				Models   []string
			}
		}
	}
	post := func(path string, body map[string]any, revision string, out any) {
		t.Helper()
		w := call("POST", path, body, revision)
		if w.Code != 200 || out != nil && json.Unmarshal(w.Body.Bytes(), out) != nil {
			t.Fatalf("%s %v: %d %s", path, body, w.Code, w.Body.String())
		}
	}
	var p preview
	keep := map[string]any{"keyId": "vk-qa-wildcard", "operation": "adopt", "phase": "preview", "keepNative": []string{"Claude"}}
	post("/api/keys/adopt", keep, "", &p)
	if !p.CanApply || strings.Join(p.SelectedRoutes, ",") != "Codex/qa-codex" {
		t.Fatalf("keeping Claude must leave Codex to adopt: %+v", p)
	}
	keep["phase"], keep["previewToken"] = "apply", p.PreviewToken
	post("/api/keys/adopt", keep, p.Revision, nil)
	var ws struct {
		Data struct {
			Keys []struct {
				ID          string
				Publication struct{ State string }
			}
		}
	}
	post("/api/keys/vk-qa-wildcard/readback", nil, "", &ws)
	verified := false
	for _, k := range ws.Data.Keys {
		verified = verified || k.ID == "vk-qa-wildcard" && k.Publication.State == "verified"
	}
	if !verified {
		t.Fatalf("the kept wildcard key must read verified: %+v", ws.Data.Keys)
	}

	edit := map[string]any{"keyId": "vk-qa-claude", "operation": "replace-all-models", "provider": "Claude", "phase": "preview"}
	p = preview{}
	post("/api/keys/native-permissions", edit, "", &p)
	if !p.CanApply || len(p.Remove) != 0 || len(p.After.Providers) != 1 || strings.Join(p.After.Providers[0].Models, ",") != "qa-haiku,qa-opus,qa-opus-fast,qa-shared,qa-sonnet" {
		t.Fatalf("every Claude model has a card: nothing left out: %+v", p)
	}
	edit["phase"], edit["previewToken"] = "apply", p.PreviewToken
	if w := call("POST", "/api/keys/native-permissions", edit, ""); w.Code != 428 || len(b.writes) != 0 {
		t.Fatalf("an unconfirmed replacement was not refused: %d", w.Code)
	}
	edit["confirm"] = true
	post("/api/keys/native-permissions", edit, "", nil)
	if len(b.writes) != 1 || b.writes[0].KeyID != "vk-qa-claude" {
		t.Fatalf("recorded writes = %+v", b.writes)
	}
	p = preview{}
	post("/api/keys/adopt", map[string]any{"keyId": "vk-qa-claude", "operation": "adopt", "phase": "preview"}, "", &p)
	if !p.CanApply || len(p.SelectedRoutes) != 5 {
		t.Fatalf("vk-qa-claude must be adoptable once replaced: %+v", p)
	}
}
