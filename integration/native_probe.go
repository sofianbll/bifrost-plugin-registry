//go:build bifrost

// This probes exports and the native hook context handoff, not a live Bifrost pipeline.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"plugin"

	"github.com/maximhq/bifrost/core/schemas"
)

func must[T any](p *plugin.Plugin, name string) T {
	v, e := p.Lookup(name)
	if e != nil {
		panic(e)
	}
	typed, ok := v.(T)
	if !ok {
		panic("wrong exported signature: " + name)
	}
	return typed
}
func main() {
	if len(os.Args) != 2 {
		panic("usage: native-probe plugin.so")
	}
	p, e := plugin.Open(os.Args[1])
	if e != nil {
		panic(e)
	}
	name := must[func() string](p, "GetName")
	if name() != "bifrost-registry" {
		panic("wrong plugin name")
	}
	init := must[func(any) error](p, "Init")
	cleanup := must[func() error](p, "Cleanup")
	pre := must[func(*schemas.BifrostContext, *schemas.HTTPRequest) (*schemas.HTTPResponse, error)](p, "HTTPTransportPreHook")
	post := must[func(*schemas.BifrostContext, *schemas.HTTPRequest, *schemas.HTTPResponse) error](p, "HTTPTransportPostHook")
	must[func(*schemas.BifrostContext, *schemas.HTTPRequest, *schemas.BifrostStreamChunk) (*schemas.BifrostStreamChunk, error)](p, "HTTPTransportStreamChunkHook")
	must[func(*schemas.BifrostContext, *schemas.BifrostRequest) error](p, "PreRequestHook")
	gate := must[func(*schemas.BifrostContext, *schemas.BifrostRequest) (*schemas.BifrostRequest, *schemas.LLMPluginShortCircuit, error)](p, "PreLLMHook")
	postLLM := must[func(*schemas.BifrostContext, *schemas.BifrostResponse, *schemas.BifrostError) (*schemas.BifrostResponse, *schemas.BifrostError, error)](p, "PostLLMHook")
	dir, e := os.MkdirTemp("", "registry-abi-")
	if e != nil {
		panic(e)
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "registry.json")
	token := "sk-bf-native-probe-0123456789"
	config, e := json.Marshal(map[string]any{
		"schema_version": 1, "default_naming": "provider/model",
		"models":   []any{map[string]any{"id": "alpha", "alias": "alpha", "provider": "openai", "provider_key_ids": []string{"key-1"}, "upstream_model": "alpha", "endpoints": []string{"chat/completions"}, "enabled": true, "verified": true, "evidence": "native hook probe"}},
		"groups":   []any{map[string]any{"id": "all", "name": "All", "model_ids": []string{"alpha"}}},
		"policies": []any{map[string]any{"virtual_key_id": "vk-probe", "name": "Probe", "token_sha256": fmt.Sprintf("%x", sha256.Sum256([]byte(token))), "groups": []string{"all"}, "enabled": true}},
	})
	if e != nil {
		panic(e)
	}
	if e = os.WriteFile(path, config, 0600); e != nil {
		panic(e)
	}
	if e = init(map[string]any{"registry_path": path}); e != nil {
		panic(e)
	}
	resp, e := pre(nil, nil)
	if e != nil || resp == nil || resp.StatusCode != 503 {
		panic("nil HTTP context not rejected")
	}
	_, blocked, e := gate(nil, nil)
	if e != nil || blocked == nil || blocked.Error == nil || blocked.Error.AllowFallbacks == nil || *blocked.Error.AllowFallbacks {
		panic("unguarded native call not rejected")
	}
	newRequest := func() (*schemas.BifrostContext, *schemas.HTTPRequest) {
		parent := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
		req := &schemas.HTTPRequest{Method: "GET", Path: "/v1/models", Headers: map[string]string{"Authorization": "Bearer " + token}}
		short, err := pre(parent, req)
		if err != nil || short != nil {
			panic("guarded models request not prepared")
		}
		return parent, req
	}
	project := func(parent *schemas.BifrostContext, req *schemas.HTTPRequest, want int) {
		resp := &schemas.HTTPResponse{StatusCode: 200, Body: []byte(`{"object":"list","data":[{"id":"openai/alpha","object":"model"}]}`)}
		if err := post(parent, req, resp); err != nil || resp.StatusCode != want {
			panic(fmt.Sprintf("models projection status: got %d, want %d: %v", resp.StatusCode, want, err))
		}
		if want == 200 {
			var body struct {
				Data []struct {
					ID string `json:"id"`
				} `json:"data"`
			}
			if json.Unmarshal(resp.Body, &body) != nil || len(body.Data) != 1 || body.Data[0].ID != "openai/alpha" {
				panic("models projection returned wrong IDs")
			}
		}
	}
	confirm := func(parent *schemas.BifrostContext, id string, wantError bool) {
		child := schemas.NewBifrostContext(parent, schemas.NoDeadline)
		child.SetValue(schemas.BifrostContextKeyGovernanceVirtualKeyID, id)
		_, result, err := postLLM(child, nil, nil)
		if err != nil || (result != nil) != wantError {
			panic("child LLM identity result does not match")
		}
	}
	parent, req := newRequest()
	project(parent, req, 403) // Raw token and policy alone cannot authorize a listing.
	parent, req = newRequest()
	confirm(parent, "vk-probe", false)
	project(parent, req, 200) // Parent has no Governance context stamp.
	parent, req = newRequest()
	confirm(parent, "vk-probe", false)
	parent.SetValue(schemas.BifrostContextKeyGovernanceVirtualKeyID, "vk-other")
	project(parent, req, 403) // A visible but different identity still wins over confirmation.
	parent, req = newRequest()
	confirm(parent, "", true) // A child without an authenticated identity fails closed.
	confirm(parent, "vk-probe", true)
	project(parent, req, 403)
	parent, req = newRequest()
	confirm(parent, "vk-probe", false)
	confirm(parent, "vk-other", true)
	confirm(parent, "vk-probe", true) // A later successful provider cannot erase rejection.
	project(parent, req, 403)
	parent, req = newRequest()
	project(parent, req, 403) // No result is carried into the next HTTP request.
	confirm(parent, "vk-probe", false)
	project(parent, req, 200)
	if e = cleanup(); e != nil {
		panic(e)
	}
	json.NewEncoder(os.Stdout).Encode(map[string]any{"plugin": name(), "plugin_open": true, "export_signatures": true, "init_cleanup": true, "nil_context_fail_closed": true, "child_identity_handoff": true, "real_bifrost_pipeline_tested": false})
	fmt.Fprintln(os.Stderr, "ABI smoke passed. Real Bifrost request and governance tests are still required.")
}
