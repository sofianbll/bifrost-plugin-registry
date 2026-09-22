//go:build bifrost

// This probes exports and plugin.Open ABI, not Bifrost's request pipeline.
package main

import (
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
	must[func(*schemas.BifrostContext, *schemas.HTTPRequest, *schemas.HTTPResponse) error](p, "HTTPTransportPostHook")
	must[func(*schemas.BifrostContext, *schemas.HTTPRequest, *schemas.BifrostStreamChunk) (*schemas.BifrostStreamChunk, error)](p, "HTTPTransportStreamChunkHook")
	must[func(*schemas.BifrostContext, *schemas.BifrostRequest) error](p, "PreRequestHook")
	gate := must[func(*schemas.BifrostContext, *schemas.BifrostRequest) (*schemas.BifrostRequest, *schemas.LLMPluginShortCircuit, error)](p, "PreLLMHook")
	must[func(*schemas.BifrostContext, *schemas.BifrostResponse, *schemas.BifrostError) (*schemas.BifrostResponse, *schemas.BifrostError, error)](p, "PostLLMHook")
	dir, e := os.MkdirTemp("", "registry-abi-")
	if e != nil {
		panic(e)
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "registry.json")
	if e = os.WriteFile(path, []byte(`{"schema_version":1,"default_naming":"provider/model","models":[],"groups":[],"policies":[]}`), 0600); e != nil {
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
	if e = cleanup(); e != nil {
		panic(e)
	}
	json.NewEncoder(os.Stdout).Encode(map[string]any{"plugin": name(), "plugin_open": true, "export_signatures": true, "init_cleanup": true, "nil_context_fail_closed": true, "real_bifrost_pipeline_tested": false})
	fmt.Fprintln(os.Stderr, "ABI smoke passed. Real Bifrost request and governance tests are still required.")
}
