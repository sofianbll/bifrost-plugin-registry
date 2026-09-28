package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSnapshotRoutesAreOfflineAndFiltered(t *testing.T) {
	n := &nativeSnapshot{capture: snapshot{Version: "2.2.3", Models: []model{{Name: "a", Provider: "p", AccessibleByKeys: []string{"enabled"}}, {Name: "b", Provider: "p", AccessibleByKeys: []string{"other"}}}}, providers: []provider{{Name: "p", Keys: []providerKey{{ID: "enabled"}}}}}
	req, _ := http.NewRequest("GET", "http://bifrost.internal/api/models?provider=p&keys=enabled&offset=0&limit=1", nil)
	resp, err := n.RoundTrip(req)
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("response: %v %v", resp, err)
	}
	var page struct {
		Models []model `json:"models"`
		Total  int     `json:"total"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&page); err != nil || page.Total != 1 || len(page.Models) != 1 || page.Models[0].Name != "a" {
		t.Fatalf("filtered page: %+v %v", page, err)
	}
	req, _ = http.NewRequest("POST", "http://bifrost.internal/v1/chat/completions", nil)
	resp, err = n.RoundTrip(req)
	if err != nil || resp.StatusCode != 405 {
		t.Fatalf("inference must be unavailable: %v %v", resp, err)
	}
}

func TestLocalRequest(t *testing.T) {
	for _, tc := range []struct {
		host, origin string
		allowed      bool
	}{
		{"127.0.0.1:8772", "", true},
		{"127.0.0.1:8772", "http://127.0.0.1:8772", true},
		{"example.com:8772", "", false},
		{"127.0.0.1:8772", "https://evil.example", false},
	} {
		r, _ := http.NewRequest("PUT", "http://127.0.0.1:8772/api/workspace", nil)
		r.Host = tc.host
		if tc.origin != "" {
			r.Header.Set("Origin", tc.origin)
		}
		if got := localRequest(r); got != tc.allowed {
			t.Fatalf("host %s origin %s allowed=%v", tc.host, tc.origin, got)
		}
	}
}

func TestWorkingCopyDoesNotChangeCapture(t *testing.T) {
	dir := t.TempDir()
	original := filepath.Join(dir, "capture.json")
	content := []byte(`{"capturedAt":"now","source":"Pulsar","providers":[{"name":"p","keys":[{"id":"k"}]}]}`)
	if err := os.WriteFile(original, content, 0600); err != nil {
		t.Fatal(err)
	}
	n := &nativeSnapshot{capture: snapshot{CapturedAt: "now"}, providers: []provider{{Name: "p", Keys: []providerKey{{ID: "k"}}}}, statePath: filepath.Join(dir, "registry.json.native-review.json")}
	r, _ := http.NewRequest("PUT", "http://bifrost.internal/api/providers/p/keys/k", strings.NewReader(`{"aliases":{"a":{"model":"b"}}}`))
	resp, err := n.RoundTrip(r)
	if err != nil || resp.StatusCode != 200 {
		t.Fatalf("local update: %v %v", resp, err)
	}
	reloaded := &nativeSnapshot{capture: snapshot{CapturedAt: "now"}, statePath: n.statePath}
	if err := reloaded.loadWorkingCopy(); err != nil {
		t.Fatal(err)
	}
	if len(reloaded.providers) != 1 || len(reloaded.providers[0].Keys[0].Aliases) != 1 {
		t.Fatalf("working copy not reloaded: %+v", reloaded.providers)
	}
	view := n.context()
	if view["partial"] != false || len(view["providers"].([]provider)) != 0 {
		t.Fatal("review context must describe the original capture")
	}
	got, err := os.ReadFile(original)
	if err != nil || string(got) != string(content) {
		t.Fatal("original capture changed")
	}
	info, err := os.Stat(n.statePath)
	if err != nil || info.Mode().Perm() != 0600 {
		t.Fatalf("working copy permissions: %v %v", info, err)
	}
}
