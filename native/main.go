//go:build bifrost

// Native Bifrost adapter. Build inside the SAME transports module as Bifrost
// using scripts/build-with-bifrost.sh, not with an arbitrary core@latest.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
	"github.com/maximhq/bifrost/core/schemas"
)

type configuration struct {
	RegistryPath      string   `json:"registry_path"`
	AdminListen       string   `json:"admin_listen,omitempty"`
	AdminTokenEnv     string   `json:"admin_token_env,omitempty"`
	AdminAllowedHosts []string `json:"admin_allowed_hosts,omitempty"`
}
type instance struct {
	store  *registry.Store
	server *http.Server
}

var current atomic.Pointer[instance]
var lifecycle sync.Mutex

const sessionKey schemas.BifrostContextKey = "bifrost-registry.private-session.v1"

func GetName() string { return "bifrost-registry" }
func Init(config any) error {
	lifecycle.Lock()
	defer lifecycle.Unlock()
	if current.Load() != nil {
		return errors.New("registry already initialized; clean up before reinitializing")
	}
	data, e := json.Marshal(config)
	if e != nil {
		return e
	}
	var cfg configuration
	if e = registry.StrictJSON(data, &cfg, true); e != nil {
		return e
	}
	if cfg.RegistryPath == "" {
		return errors.New("registry_path is required")
	}
	store, e := registry.OpenStore(cfg.RegistryPath)
	if e != nil {
		return e
	}
	inst := &instance{store: store}
	if cfg.AdminListen != "" {
		env := cfg.AdminTokenEnv
		if env == "" {
			env = "REGISTRY_ADMIN_TOKEN"
		}
		handler, e := admin.New(store, os.Getenv(env), cfg.AdminAllowedHosts)
		if e != nil {
			return e
		}
		listener, e := net.Listen("tcp", cfg.AdminListen)
		if e != nil {
			return e
		}
		inst.server = handler.HTTPServer(cfg.AdminListen)
		go func() { _ = inst.server.Serve(listener) }()
	}
	current.Store(inst)
	return nil
}
func Cleanup() error {
	lifecycle.Lock()
	defer lifecycle.Unlock()
	old := current.Swap(nil)
	if old == nil || old.server == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return old.server.Shutdown(ctx)
}
func failureResponse(f *registry.Failure) *schemas.HTTPResponse {
	return &schemas.HTTPResponse{StatusCode: f.Status, Headers: map[string]string{"Content-Type": "application/json", "Cache-Control": "no-store"}, Body: f.JSON()}
}
func unavailable() *registry.Failure {
	return &registry.Failure{Status: 503, Code: "registry_not_initialized", Message: "Registry is not initialized"}
}
func session(ctx *schemas.BifrostContext) *registry.Session {
	if ctx == nil {
		return nil
	}
	s, _ := ctx.Value(sessionKey).(*registry.Session)
	return s
}
func identity(ctx *schemas.BifrostContext) string {
	if ctx == nil {
		return ""
	}
	id, _ := ctx.Value(schemas.BifrostContextKeyGovernanceVirtualKeyID).(string)
	return id
}

func HTTPTransportPreHook(ctx *schemas.BifrostContext, req *schemas.HTTPRequest) (*schemas.HTTPResponse, error) {
	if req == nil || ctx == nil {
		return failureResponse(unavailable()), nil
	}
	// Management routes are not inference routes. Do not interfere with administration.
	if strings.HasPrefix(req.Path, "/api/") || req.Path == "/metrics" || req.Path == "/health" {
		return nil, nil
	}
	inst := current.Load()
	if inst == nil {
		return failureResponse(unavailable()), nil
	}
	input := &registry.Request{Method: req.Method, Path: req.Path, Headers: req.Headers, Body: req.Body}
	sess, f := inst.store.Load().Prepare(input)
	if f != nil {
		return failureResponse(f), nil
	}
	req.Body = input.Body
	if req.Headers == nil {
		req.Headers = map[string]string{}
	}
	for k := range req.Headers {
		if strings.EqualFold(k, "content-length") {
			delete(req.Headers, k)
		}
	}
	// This sets the raw credential, NEVER a trusted/validated identity. Native governance
	// must still authenticate it and enforce budgets and native VK permissions.
	token, _ := registry.Credential(req.Headers)
	ctx.SetValue(schemas.BifrostContextKeyVirtualKey, token)
	ctx.SetValue(sessionKey, sess)
	return nil, nil
}
func HTTPTransportPostHook(ctx *schemas.BifrostContext, req *schemas.HTTPRequest, resp *schemas.HTTPResponse) error {
	s := session(ctx)
	if s == nil || resp == nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}
	if resp.Headers == nil {
		resp.Headers = map[string]string{}
	}
	if s.IsModels() {
		out, f := s.Project(resp.Body, identity(ctx))
		if f != nil {
			bad := failureResponse(f)
			*resp = *bad
			return nil
		}
		resp.Body = out
		for k := range resp.Headers {
			if strings.EqualFold(k, "content-length") || strings.EqualFold(k, "etag") {
				delete(resp.Headers, k)
			}
		}
		resp.Headers["Content-Type"] = "application/json"
		resp.Headers["Cache-Control"] = "no-store"
		resp.Headers["Vary"] = "Authorization, x-bf-vk"
	} else if f := s.VerifyIdentity(identity(ctx)); f != nil {
		*resp = *failureResponse(f)
	}
	return nil
}
func HTTPTransportStreamChunkHook(ctx *schemas.BifrostContext, req *schemas.HTTPRequest, chunk *schemas.BifrostStreamChunk) (*schemas.BifrostStreamChunk, error) {
	// Authentication failures can legitimately lack a validated identity. Preserve
	// native error chunks; only successful content requires the confirmed binding.
	if chunk != nil && chunk.BifrostError != nil {
		return chunk, nil
	}
	if s := session(ctx); s != nil {
		if f := s.VerifyIdentity(identity(ctx)); f != nil {
			return nil, f
		}
	}
	// Preserve reasoning signatures, cache accounting, tool-call deltas and model names.
	// This release does not rewrite native streaming response payloads.
	return chunk, nil
}
func PreRequestHook(ctx *schemas.BifrostContext, req *schemas.BifrostRequest) error { return nil }
func PreLLMHook(ctx *schemas.BifrostContext, req *schemas.BifrostRequest) (*schemas.BifrostRequest, *schemas.LLMPluginShortCircuit, error) {
	s := session(ctx)
	var f *registry.Failure
	if s == nil || req == nil {
		f = &registry.Failure{Status: 403, Code: "registry_http_required", Message: "A guarded HTTP registry request is required"}
	} else {
		provider, model, _ := req.GetRequestFields()
		f = s.CheckAttempt(string(provider), model)
	}
	if f == nil {
		return req, nil, nil
	}
	status := f.Status
	typ := "registry_error"
	fallbacks := false
	err := &schemas.BifrostError{StatusCode: &status, Type: &typ, Error: &schemas.ErrorField{Message: f.Message}, AllowFallbacks: &fallbacks}
	return req, &schemas.LLMPluginShortCircuit{Error: err}, nil
}
func PostLLMHook(ctx *schemas.BifrostContext, resp *schemas.BifrostResponse, err *schemas.BifrostError) (*schemas.BifrostResponse, *schemas.BifrostError, error) {
	return resp, err, nil
}
