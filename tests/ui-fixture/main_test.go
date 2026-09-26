package main

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"testing"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
)

func TestFixtureWorkspaceAndNativeReadback(t *testing.T) {
	snap, err := registry.Compile(seed())
	if err != nil {
		t.Fatal(err)
	}
	store := registry.MemoryStore(snap)
	b := &syntheticBifrost{store: store, keys: map[string]*virtualKey{
		"vk-qa-dev":       {ID: "vk-qa-dev", Name: "QA Development Key", Value: "sk-bf-qa-fixture-dev", Active: true, ProviderConfigs: []providerConfig{{Provider: provider, AllowedModels: []string{"qa-code", "qa-chat"}}}},
		"vk-qa-visual":    {ID: "vk-qa-visual", Name: "QA Visual Key", Value: "sk-bf-qa-fixture-visual", Active: true, ProviderConfigs: []providerConfig{{Provider: provider, AllowedModels: []string{"qa-vision"}}}},
		"vk-qa-unmanaged": {ID: "vk-qa-unmanaged", Name: "QA Unmanaged Key", Value: "sk-bf-qa-fixture-unmanaged", Active: true},
	}}
	for _, key := range b.keys {
		if got, err := registry.Credential(map[string]string{"Authorization": "Bearer " + key.Value}); err != nil || got != key.Value {
			t.Fatalf("fixture key %s is not a native credential: %v", key.ID, err)
		}
	}
	s, err := admin.New(store, defaultToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	s.ConnectNative(roundTrip(b.roundTrip))
	call := func(method, path string, body any, revision string) *httptest.ResponseRecorder {
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
	var ws struct {
		Revision  string         `json:"revision"`
		Data      map[string]any `json:"data"`
		Discovery []any          `json:"discovery"`
	}
	get := call("GET", "/api/workspace", nil, "")
	if get.Code != 200 || json.Unmarshal(get.Body.Bytes(), &ws) != nil || len(ws.Data["models"].([]any)) != 3 || len(ws.Data["groups"].([]any)) != 2 || len(ws.Data["keys"].([]any)) != 3 || len(ws.Discovery) != 4 {
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
