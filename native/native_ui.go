//go:build bifrost && bifrost_native_ui

package main

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
	"github.com/maximhq/bifrost/core/schemas"
	"github.com/valyala/fasthttp"
	"github.com/valyala/fasthttp/fasthttpadaptor"
)

type nativeRequestKey struct{}

type nativeTransport struct {
	call func(*fasthttp.RequestCtx, *fasthttp.Request, *fasthttp.Response)
}

func (t nativeTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	parent, ok := r.Context().Value(nativeRequestKey{}).(*fasthttp.RequestCtx)
	if !ok {
		return nil, errors.New("native request context is missing")
	}
	var child fasthttp.Request
	child.Header.SetMethod(r.Method)
	child.Header.SetHost(string(parent.Host()))
	child.SetRequestURI(r.URL.RequestURI())
	for key, values := range r.Header {
		for _, value := range values {
			child.Header.Add(key, value)
		}
	}
	if r.Body != nil {
		body, err := io.ReadAll(io.LimitReader(r.Body, (8<<20)+1))
		if err != nil || len(body) > 8<<20 {
			return nil, errors.New("native request body is too large")
		}
		child.SetBody(body)
	}
	var result fasthttp.Response
	t.call(parent, &child, &result)
	headers := http.Header{}
	result.Header.VisitAll(func(key, value []byte) { headers.Add(string(key), string(value)) })
	body := append([]byte(nil), result.Body()...)
	return &http.Response{StatusCode: result.StatusCode(), Header: headers, Body: io.NopCloser(bytes.NewReader(body)), ContentLength: int64(len(body)), Request: r}, nil
}

func defaultStore(dir string) (*registry.Store, error) {
	if dir == "" {
		return nil, errors.New("Bifrost app directory is unavailable")
	}
	return openOrCreateStore(filepath.Join(dir, "registry", "registry.json"))
}

func GetAdminUI(host schemas.PluginAdminUIHost) (schemas.PluginAdminUI, error) {
	lifecycle.Lock()
	defer lifecycle.Unlock()
	inst := current.Load()
	if inst == nil {
		return schemas.PluginAdminUI{}, errors.New("registry is not initialized")
	}
	assets, err := admin.EmbeddedAssets()
	if err != nil {
		return schemas.PluginAdminUI{}, err
	}
	if host.CallNative == nil {
		return schemas.PluginAdminUI{}, errors.New("native Bifrost API is unavailable")
	}
	store := inst.store.Load()
	if store == nil {
		store, err = defaultStore(host.DataDir)
		if err != nil {
			return schemas.PluginAdminUI{}, err
		}
		inst.store.Store(store)
	}
	panel := admin.NewEmbedded(store)
	panel.ConnectNative(nativeTransport{call: host.CallNative})
	api := func(ctx *fasthttp.RequestCtx) {
		fasthttpadaptor.NewFastHTTPHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			index := strings.Index(r.URL.Path, "/api/")
			if index < 0 {
				http.NotFound(w, r)
				return
			}
			r.URL.Path = r.URL.Path[index:]
			panel.ServeEmbeddedHTTP(w, r.WithContext(context.WithValue(r.Context(), nativeRequestKey{}, ctx)))
		}))(ctx)
	}
	return schemas.PluginAdminUI{Title: "Model Registry", Assets: assets, API: api}, nil
}
