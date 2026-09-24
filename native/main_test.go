//go:build bifrost

package main

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"bifrost-registry/internal/registry"
	"github.com/maximhq/bifrost/core/schemas"
)

func TestOpenOrCreateStorePreservesExistingAndRejectsCorruption(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "registry", "registry.json")
	store, err := openOrCreateStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("default registry file: %v, %v", info, err)
	}
	config := store.Load().Config()
	config.DefaultNaming = "model"
	next, err := registry.Compile(config)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := store.Save(next.JSON(), store.Load().Revision()); err != nil {
		t.Fatal(err)
	}
	reopened, err := openOrCreateStore(path)
	if err != nil || reopened.Load().Config().DefaultNaming != "model" {
		t.Fatalf("registry did not survive reload: %v", err)
	}
	if err := os.WriteFile(path, []byte("invalid"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := openOrCreateStore(path); err == nil {
		t.Fatal("corrupt registry was replaced")
	}
	if body, err := os.ReadFile(path); err != nil || string(body) != "invalid" {
		t.Fatalf("corrupt registry changed: %q, %v", body, err)
	}
}

func TestNativeCandidateRequiresGovernanceBeforeProvider(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.json")
	snapshot, err := registry.Compile(registry.Config{
		SchemaVersion: 1, DefaultNaming: "provider/model",
		Policies: []registry.Policy{{VirtualKeyID: "vk-managed", Name: "Managed", TokenSHA256: registry.TokenHash("sk-bf-managed-0123456789"), Enabled: true}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := registry.AtomicWrite(path, snapshot.JSON()); err != nil {
		t.Fatal(err)
	}
	if err := Init(map[string]any{"registry_path": path}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = Cleanup() })
	original := []byte(` { "model": "native/only", "extra": true } `)
	newRequest := func() (*schemas.BifrostContext, *schemas.HTTPRequest) {
		ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
		req := &schemas.HTTPRequest{Method: "POST", Path: "/v1/chat/completions", Headers: map[string]string{
			"Authorization": "Bearer sk-bf-native-0123456789", "Content-Type": "application/json", "Content-Length": "47",
		}, Body: bytes.Clone(original)}
		if resp, err := HTTPTransportPreHook(ctx, req); err != nil || resp != nil {
			t.Fatalf("native candidate rejected before Governance: response=%#v error=%v", resp, err)
		}
		if !bytes.Equal(req.Body, original) || req.Headers["Content-Length"] != "47" {
			t.Fatal("native request changed")
		}
		return ctx, req
	}
	for name, id := range map[string]string{"missing": "", "rotated managed": "vk-managed"} {
		t.Run(name, func(t *testing.T) {
			ctx, _ := newRequest()
			ctx.SetValue(schemas.BifrostContextKeyGovernanceVirtualKeyID, id)
			_, short, err := PreLLMHook(ctx, &schemas.BifrostRequest{})
			if err != nil || short == nil || short.Error == nil || short.Error.StatusCode == nil || *short.Error.StatusCode != 403 {
				t.Fatalf("provider attempt was not blocked: short=%#v error=%v", short, err)
			}
		})
	}
	ctx, req := newRequest()
	ctx.SetValue(schemas.BifrostContextKeyGovernanceVirtualKeyID, "vk-native")
	if _, short, err := PreLLMHook(ctx, &schemas.BifrostRequest{}); err != nil || short != nil {
		t.Fatalf("authenticated native candidate denied: short=%#v error=%v", short, err)
	}
	resp := &schemas.HTTPResponse{StatusCode: 200, Headers: map[string]string{"ETag": "native", "Content-Length": "15"}, Body: []byte(`{"native":true}`)}
	if err := HTTPTransportPostHook(ctx, req, resp); err != nil || resp.StatusCode != 200 || string(resp.Body) != `{"native":true}` || resp.Headers["ETag"] != "native" || resp.Headers["Content-Length"] != "15" {
		t.Fatalf("native response changed: response=%#v error=%v", resp, err)
	}
}

func TestNativeModelsCandidateKeepsGovernanceFilteredResponse(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.json")
	snapshot, err := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model"})
	if err != nil {
		t.Fatal(err)
	}
	if err := registry.AtomicWrite(path, snapshot.JSON()); err != nil {
		t.Fatal(err)
	}
	if err := Init(map[string]any{"registry_path": path}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = Cleanup() })
	ctx := schemas.NewBifrostContext(context.Background(), schemas.NoDeadline)
	req := &schemas.HTTPRequest{Method: "GET", Path: "/v1/models", Headers: map[string]string{"Authorization": "Bearer sk-bf-native-0123456789"}}
	if short, err := HTTPTransportPreHook(ctx, req); short != nil || err != nil {
		t.Fatalf("native list rejected: %#v %v", short, err)
	}
	body := []byte(`{"object":"list","data":[{"id":"native/allowed","native_metadata":"keep"}]}`)
	response := func() *schemas.HTTPResponse {
		return &schemas.HTTPResponse{StatusCode: 200, Headers: map[string]string{"ETag": "native-etag"}, Body: bytes.Clone(body)}
	}
	missing := response()
	if err := HTTPTransportPostHook(ctx, req, missing); err != nil || missing.StatusCode != 403 {
		t.Fatalf("unverified native list accepted: %#v %v", missing, err)
	}
	child := schemas.NewBifrostContext(ctx, schemas.NoDeadline)
	child.SetValue(schemas.BifrostContextKeyGovernanceVirtualKeyID, "vk-native")
	if _, errResponse, err := PostLLMHook(child, nil, nil); err != nil || errResponse != nil {
		t.Fatalf("native identity rejected: %#v %v", errResponse, err)
	}
	got := response()
	if err := HTTPTransportPostHook(ctx, req, got); err != nil || got.StatusCode != 200 || !bytes.Equal(got.Body, body) || got.Headers["ETag"] != "native-etag" {
		t.Fatalf("native list was changed: %#v %v", got, err)
	}
}
