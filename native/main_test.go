//go:build bifrost

package main

import (
	"context"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
	"github.com/valyala/fasthttp"
)

func TestDefaultStorePersistsInBifrostDataDir(t *testing.T) {
	dir := t.TempDir()
	store, err := defaultStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dir, "registry", "registry.json")
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
	reopened, err := defaultStore(dir)
	if err != nil || reopened.Load().Config().DefaultNaming != "model" {
		t.Fatalf("registry did not survive reload: %v", err)
	}
}

func TestNativeTransportKeepsExplicitReadbackKey(t *testing.T) {
	parent := &fasthttp.RequestCtx{}
	transport := nativeTransport{call: func(got *fasthttp.RequestCtx, req *fasthttp.Request, resp *fasthttp.Response) {
		if got != parent || string(req.URI().Path()) != "/v1/models" || string(req.Header.Peek("Authorization")) != "Bearer vk-secret" {
			t.Fatal("native readback request changed")
		}
		resp.SetStatusCode(200)
		resp.SetBodyString(`{"data":[]}`)
	}}
	request, err := http.NewRequestWithContext(context.WithValue(context.Background(), nativeRequestKey{}, parent), "GET", "http://bifrost.internal/v1/models", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer vk-secret")
	response, err := transport.RoundTrip(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != 200 || !strings.Contains(string(body), `"data"`) {
		t.Fatalf("bad native response: %d %s", response.StatusCode, body)
	}
}
