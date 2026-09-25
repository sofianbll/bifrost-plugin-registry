// registry-review runs the real Registry control plane against a sanitized, offline native snapshot.
package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"bifrost-registry/internal/admin"
	"bifrost-registry/internal/registry"
)

type snapshot struct {
	CapturedAt   string          `json:"capturedAt"`
	Version      string          `json:"version"`
	Source       string          `json:"source"`
	Providers    []provider      `json:"providers"`
	Models       []model         `json:"models"`
	VirtualKeys  []virtualKey    `json:"virtualKeys"`
	RoutingRules json.RawMessage `json:"routingRules"`
	Pricing      json.RawMessage `json:"pricing"`
	Parameters   json.RawMessage `json:"parameters"`
	Errors       []string        `json:"errors"`
}
type provider struct {
	Name        string        `json:"name"`
	Status      string        `json:"status,omitempty"`
	Description string        `json:"description,omitempty"`
	Keys        []providerKey `json:"keys"`
}
type providerKey struct {
	ID                string                     `json:"id"`
	Name              string                     `json:"name"`
	Enabled           *bool                      `json:"enabled"`
	Weight            *float64                   `json:"weight"`
	Models            []string                   `json:"models"`
	BlacklistedModels []string                   `json:"blacklisted_models"`
	Aliases           map[string]json.RawMessage `json:"aliases"`
	AliasesStatus     json.RawMessage            `json:"aliases_status,omitempty"`
}
type model struct {
	Name             string   `json:"name"`
	Provider         string   `json:"provider"`
	AccessibleByKeys []string `json:"accessible_by_keys"`
	Source           string   `json:"source,omitempty"`
}
type virtualKey struct {
	ID                string          `json:"id"`
	Name              string          `json:"name"`
	Description       string          `json:"description"`
	IsActive          *bool           `json:"is_active"`
	AllowAllProviders bool            `json:"allow_all_providers"`
	ProviderConfigs   json.RawMessage `json:"provider_configs"`
}
type nativeSnapshot struct {
	sync.Mutex
	capture   snapshot
	providers []provider
	keys      []virtualKey
	statePath string
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "registry-review:", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("registry-review", flag.ContinueOnError)
	file := fs.String("snapshot", "", "Sanitized private snapshot JSON")
	config := fs.String("config", "", "Local Registry config JSON")
	ui := fs.String("ui", "ui/dist", "Built UI directory")
	listen := fs.String("listen", "127.0.0.1:8772", "Loopback listener")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *file == "" || *config == "" {
		return errors.New("--snapshot and --config are required")
	}
	host, _, err := net.SplitHostPort(*listen)
	if err != nil {
		return err
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return errors.New("--listen must use a numeric loopback address")
	}
	b, err := os.ReadFile(*file)
	if err != nil {
		return err
	}
	var capture snapshot
	if err := json.Unmarshal(b, &capture); err != nil {
		return err
	}
	if capture.Source != "Pulsar" || capture.CapturedAt == "" {
		return errors.New("snapshot must identify Pulsar and capturedAt")
	}
	var raw struct {
		VirtualKeys []map[string]json.RawMessage `json:"virtualKeys"`
	}
	if err := json.Unmarshal(b, &raw); err != nil {
		return err
	}
	for _, vk := range raw.VirtualKeys {
		if _, ok := vk["value"]; ok {
			return errors.New("snapshot contains a forbidden virtual-key value field")
		}
	}
	store, err := registry.OpenStore(*config)
	if err != nil {
		return err
	}
	var token [32]byte
	if _, err := rand.Read(token[:]); err != nil {
		return err
	}
	tokenString := hex.EncodeToString(token[:])
	srv, err := admin.New(store, tokenString, nil)
	if err != nil {
		return err
	}
	if err := srv.UseUIDirectory(*ui); err != nil {
		return err
	}
	native := &nativeSnapshot{capture: capture, providers: capture.Providers, keys: capture.VirtualKeys, statePath: *config + ".native-review.json"}
	if err := native.loadWorkingCopy(); err != nil {
		return err
	}
	srv.ConnectNative(native)
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !localRequest(r) {
			http.Error(w, "local same-origin access only", http.StatusForbidden)
			return
		}
		r.Header.Set("Authorization", "Bearer "+tokenString)
		if r.URL.Path == "/api/review-context" {
			if r.Method != http.MethodGet {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			writeJSON(w, 200, native.context())
			return
		}
		if strings.HasSuffix(r.URL.Path, "/secret") || strings.HasSuffix(r.URL.Path, "/readback") || (r.URL.Path == "/api/keys" && r.Method == http.MethodPost) || strings.HasPrefix(r.URL.Path, "/api/assistant/") || r.URL.Path == "/api/catalog/refresh" {
			writeJSON(w, 409, map[string]string{"error": "Unavailable in offline snapshot review: no native secret, inference, AI, or verified readback"})
			return
		}
		if (r.URL.Path == "/api/workspace" && (r.Method == http.MethodGet || r.Method == http.MethodPut)) || (r.URL.Path == "/api/keys/adopt" && r.Method == http.MethodPost) {
			rec := &responseCapture{ResponseWriter: w, status: 200}
			srv.ServeHTTP(rec, r)
			if rec.status != 200 {
				rec.flush()
				return
			}
			var body map[string]any
			if json.Unmarshal(rec.body.Bytes(), &body) != nil {
				rec.flush()
				return
			}
			if _, ok := body["connection"]; ok {
				body["connection"] = map[string]any{"connected": true, "version": capture.Version, "mode": "snapshot", "source": "Pulsar", "capturedAt": capture.CapturedAt, "partial": len(capture.Errors) > 0}
			}
			if r.URL.Path == "/api/keys/adopt" {
				body["evidence"] = "snapshot"
				body["source"] = "Pulsar"
				body["capturedAt"] = capture.CapturedAt
			}
			for k, values := range rec.header {
				w.Header()[k] = values
			}
			writeJSON(w, 200, body)
			return
		}
		srv.ServeHTTP(w, r)
	})
	server := srv.HTTPServer(*listen)
	server.Handler = handler
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	fmt.Fprintln(os.Stderr, "Offline Pulsar snapshot review: http://"+*listen+"/model-registry")
	select {
	case err := <-done:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}

func localRequest(r *http.Request) bool {
	host, _, err := net.SplitHostPort(r.Host)
	if err != nil {
		return false
	}
	ip := net.ParseIP(host)
	if ip == nil || !ip.IsLoopback() {
		return false
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		u, err := url.Parse(origin)
		if err != nil || u.Scheme != "http" || u.Host != r.Host || u.User != nil {
			return false
		}
	}
	return true
}

type responseCapture struct {
	http.ResponseWriter
	header http.Header
	body   bytes.Buffer
	status int
}

func (r *responseCapture) Header() http.Header {
	if r.header == nil {
		r.header = make(http.Header)
	}
	return r.header
}
func (r *responseCapture) WriteHeader(status int)      { r.status = status }
func (r *responseCapture) Write(p []byte) (int, error) { return r.body.Write(p) }
func (r *responseCapture) flush() {
	for k, v := range r.header {
		r.ResponseWriter.Header()[k] = v
	}
	r.ResponseWriter.WriteHeader(r.status)
	_, _ = r.ResponseWriter.Write(r.body.Bytes())
}

func (n *nativeSnapshot) context() map[string]any {
	n.Lock()
	defer n.Unlock()
	return map[string]any{"mode": "snapshot", "source": "Pulsar", "capturedAt": n.capture.CapturedAt, "version": n.capture.Version, "providers": n.capture.Providers, "models": n.capture.Models, "virtualKeys": n.capture.VirtualKeys, "routingRules": n.capture.RoutingRules, "errors": n.capture.Errors, "partial": len(n.capture.Errors) > 0, "nativeChanges": "local working copy only", "verifiedReadback": false}
}

func (n *nativeSnapshot) loadWorkingCopy() error {
	b, err := os.ReadFile(n.statePath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var state struct {
		CapturedAt  string       `json:"capturedAt"`
		Providers   []provider   `json:"providers"`
		VirtualKeys []virtualKey `json:"virtualKeys"`
	}
	if err := json.Unmarshal(b, &state); err != nil {
		return err
	}
	if state.CapturedAt != n.capture.CapturedAt {
		return errors.New("native working copy belongs to another capture")
	}
	n.providers = state.Providers
	n.keys = state.VirtualKeys
	return nil
}

func (n *nativeSnapshot) persist(providers []provider, keys []virtualKey) error {
	if n.statePath == "" {
		return nil
	}
	b, err := json.Marshal(struct {
		CapturedAt  string       `json:"capturedAt"`
		Providers   []provider   `json:"providers"`
		VirtualKeys []virtualKey `json:"virtualKeys"`
	}{n.capture.CapturedAt, providers, keys})
	if err != nil {
		return err
	}
	dir := filepath.Dir(n.statePath)
	f, err := os.CreateTemp(dir, ".registry-review-*")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if err = f.Chmod(0600); err != nil {
		f.Close()
		return err
	}
	if _, err = f.Write(b); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(f.Name(), n.statePath)
}

func localToken(id string) string {
	h := sha256.Sum256([]byte("registry-review\x00" + id))
	return "sk-bf-review-" + hex.EncodeToString(h[:16])
}

func (n *nativeSnapshot) RoundTrip(r *http.Request) (*http.Response, error) {
	n.Lock()
	defer n.Unlock()
	path := r.URL.Path
	method := r.Method
	var result any
	status := 200
	switch {
	case method == "GET" && path == "/api/version":
		result = n.capture.Version
	case method == "GET" && path == "/api/providers":
		rows := make([]map[string]any, 0, len(n.providers))
		for _, p := range n.providers {
			rows = append(rows, map[string]any{"name": p.Name})
		}
		result = map[string]any{"providers": rows, "total": len(rows)}
	case strings.HasPrefix(path, "/api/providers/"):
		parts := strings.Split(strings.TrimPrefix(path, "/api/providers/"), "/")
		if len(parts) < 2 || parts[1] != "keys" {
			status = 404
			break
		}
		pname, _ := url.PathUnescape(parts[0])
		var p *provider
		for i := range n.providers {
			if n.providers[i].Name == pname {
				p = &n.providers[i]
				break
			}
		}
		if p == nil {
			status = 404
			break
		}
		if len(parts) == 2 && method == "GET" {
			result = map[string]any{"keys": p.Keys, "total": len(p.Keys)}
			break
		}
		if len(parts) != 3 {
			status = 404
			break
		}
		kid, _ := url.PathUnescape(parts[2])
		var key *providerKey
		for _, k := range p.Keys {
			if k.ID == kid {
				key = &k
				break
			}
		}
		if key == nil {
			status = 404
			break
		}
		if method == "GET" {
			result = key
			break
		}
		if method == "PUT" {
			var update struct {
				Aliases map[string]json.RawMessage `json:"aliases"`
			}
			if json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&update) != nil {
				status = 400
				break
			}
			if update.Aliases != nil {
				previous := key.Aliases
				key.Aliases = update.Aliases
				for i := range p.Keys {
					if p.Keys[i].ID == kid {
						p.Keys[i] = *key
						break
					}
				}
				if err := n.persist(n.providers, n.keys); err != nil {
					key.Aliases = previous
					for i := range p.Keys {
						if p.Keys[i].ID == kid {
							p.Keys[i] = *key
							break
						}
					}
					return nil, err
				}
				result = map[string]any{"key": key}
				break
			}
		}
		status = 405
	case method == "GET" && path == "/api/models":
		selected := []model{}
		providerName := r.URL.Query().Get("provider")
		keySet := map[string]bool{}
		for _, id := range strings.Split(r.URL.Query().Get("keys"), ",") {
			keySet[id] = true
		}
		for _, m := range n.capture.Models {
			if m.Provider != providerName {
				continue
			}
			for _, id := range m.AccessibleByKeys {
				if keySet[id] {
					selected = append(selected, m)
					break
				}
			}
		}
		offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		if offset < 0 {
			offset = 0
		}
		if limit <= 0 || limit > 100 {
			limit = 100
		}
		total := len(selected)
		if offset > total {
			offset = total
		}
		end := offset + limit
		if end > total {
			end = total
		}
		result = map[string]any{"models": selected[offset:end], "total": total}
	case method == "GET" && path == "/api/governance/virtual-keys":
		result = map[string]any{"virtual_keys": n.keys, "total_count": len(n.keys)}
	case method == "GET" && path == "/v1/models":
		id := ""
		for _, vk := range n.keys {
			if r.Header.Get("Authorization") == "Bearer "+localToken(vk.ID) {
				id = vk.ID
				break
			}
		}
		if id == "" {
			status = 401
			break
		}
		var vk virtualKey
		for _, candidate := range n.keys {
			if candidate.ID == id {
				vk = candidate
				break
			}
		}
		var configs []struct {
			Provider          string   `json:"provider"`
			AllowedModels     []string `json:"allowed_models"`
			BlacklistedModels []string `json:"blacklisted_models"`
		}
		if json.Unmarshal(vk.ProviderConfigs, &configs) != nil {
			status = 422
			break
		}
		ids := []string{}
		for _, pc := range configs {
			for _, name := range pc.AllowedModels {
				blocked := false
				for _, excluded := range pc.BlacklistedModels {
					if excluded == name {
						blocked = true
						break
					}
				}
				if !blocked {
					ids = append(ids, pc.Provider+"/"+name)
				}
			}
		}
		sort.Strings(ids)
		rows := make([]map[string]string, 0, len(ids))
		for _, id := range ids {
			rows = append(rows, map[string]string{"id": id})
		}
		result = map[string]any{"data": rows, "object": "list"}
	case strings.HasPrefix(path, "/api/governance/virtual-keys/"):
		id, _ := url.PathUnescape(strings.TrimPrefix(path, "/api/governance/virtual-keys/"))
		index := -1
		for i := range n.keys {
			if n.keys[i].ID == id {
				index = i
				break
			}
		}
		if index < 0 {
			status = 404
			break
		}
		if method == "GET" {
			result = map[string]any{"virtual_key": struct {
				virtualKey
				Value string `json:"value"`
			}{n.keys[index], localToken(id)}}
			break
		}
		if method == "PUT" {
			var update virtualKey
			if json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&update) != nil {
				status = 400
				break
			}
			update.ID = id
			prior := n.keys[index]
			n.keys[index] = update
			if err := n.persist(n.providers, n.keys); err != nil {
				n.keys[index] = prior
				return nil, err
			}
			result = map[string]any{"virtual_key": update}
			break
		}
		status = 405
	default:
		status = 405
	}
	if status != 200 {
		result = map[string]string{"error": "Unavailable in offline snapshot review"}
	}
	b, _ := json.Marshal(result)
	return &http.Response{StatusCode: status, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(bytes.NewReader(b)), Request: r}, nil
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
