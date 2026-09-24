// Package admin serves a local control plane, never an inference proxy.
package admin

import (
	"crypto/sha256"
	"crypto/subtle"
	"embed"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"bifrost-registry/internal/registry"
)

//go:embed web/*
var files embed.FS

type Server struct {
	Store        *registry.Store
	tokenHash    [32]byte
	allowedHosts map[string]bool
	live         liveState
	uiDir        string
}

func New(store *registry.Store, token string, hosts []string) (*Server, error) {
	if len(token) < 32 {
		return nil, errors.New("admin token must contain at least 32 characters")
	}
	allowed := map[string]bool{"localhost": true, "127.0.0.1": true, "::1": true}
	for _, host := range hosts {
		if host != "" {
			allowed[strings.ToLower(host)] = true
		}
	}
	return &Server{Store: store, tokenHash: sha256.Sum256([]byte(token)), allowedHosts: allowed}, nil
}

func NewEmbedded(store *registry.Store) *Server { return &Server{Store: store} }

// UseUIDirectory serves the built React UI while keeping the embedded admin as fallback.
func (s *Server) UseUIDirectory(dir string) error {
	root, err := filepath.EvalSymlinks(dir)
	if err != nil {
		return err
	}
	info, err := os.Stat(filepath.Join(root, "index.html"))
	if err != nil || !info.Mode().IsRegular() {
		return errors.New("UI directory needs index.html")
	}
	s.uiDir = root
	return nil
}
func (s *Server) HTTPServer(addr string) *http.Server {
	return &http.Server{Addr: addr, Handler: s, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 << 10}
}
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) { s.serve(w, r, false) }

// ServeEmbeddedHTTP is called only behind Bifrost's native admin authentication.
// The standalone listener continues to require its own bearer token.
func (s *Server) ServeEmbeddedHTTP(w http.ResponseWriter, r *http.Request) { s.serve(w, r, true) }

func (s *Server) serve(w http.ResponseWriter, r *http.Request, embedded bool) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'")
	host := r.Host
	if h, _, err := net.SplitHostPort(host); err == nil {
		host = h
	}
	if !embedded && !s.allowedHosts[strings.ToLower(host)] {
		reply(w, 403, map[string]string{"error": "host not allowed"})
		return
	}
	if origin := r.Header.Get("Origin"); origin != "" {
		u, e := url.Parse(origin)
		if e != nil || u.Host != r.Host || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil {
			reply(w, 403, map[string]string{"error": "cross-origin requests are not allowed"})
			return
		}
	}
	if !strings.HasPrefix(r.URL.Path, "/api/") {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			reply(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		if embedded {
			http.NotFound(w, r)
			return
		}
		if s.uiDir != "" {
			s.serveUI(w, r)
			return
		}
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" || path == "model-registry" {
			path = "index.html"
		}
		if path != "index.html" && path != "app.js" && path != "app.css" {
			http.NotFound(w, r)
			return
		}
		sub, _ := fs.Sub(files, "web")
		data, err := fs.ReadFile(sub, path)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		mime := map[string]string{"index.html": "text/html; charset=utf-8", "app.js": "text/javascript; charset=utf-8", "app.css": "text/css; charset=utf-8"}
		w.Header().Set("Content-Type", mime[path])
		w.WriteHeader(200)
		if r.Method != http.MethodHead {
			_, _ = w.Write(data)
		}
		return
	}
	if !embedded {
		// Explicit Bearer token, no ambient cookies, no CORS, no query-string credentials.
		auths := r.Header.Values("Authorization")
		if len(auths) != 1 || !strings.HasPrefix(auths[0], "Bearer ") {
			w.Header().Set("WWW-Authenticate", "Bearer")
			reply(w, 401, map[string]string{"error": "admin authentication required"})
			return
		}
		got := sha256.Sum256([]byte(strings.TrimPrefix(auths[0], "Bearer ")))
		if subtle.ConstantTimeCompare(got[:], s.tokenHash[:]) != 1 {
			reply(w, 401, map[string]string{"error": "admin authentication required"})
			return
		}
	}
	switch r.URL.Path {
	case "/api/workspace", "/api/keys":
		s.liveHandler(w, r)
	case "/api/status":
		if !method(w, r, http.MethodGet) {
			return
		}
		reply(w, 200, map[string]any{"version": registry.Version, "revision": s.Store.Load().Revision(), "mode": "local-control-plane", "bifrost_connected": false, "native_apply": "manual", "adapter_build": "not_checked_by_control_plane"})
	case "/api/config":
		if r.Method == http.MethodGet {
			snap := s.Store.Load()
			w.Header().Set("ETag", `"`+snap.Revision()+`"`)
			reply(w, 200, snap.Config())
			return
		}
		if !method(w, r, http.MethodPut) {
			return
		}
		expected := strings.Trim(r.Header.Get("If-Match"), `"`)
		if expected == "" {
			reply(w, 428, map[string]string{"error": "If-Match is required"})
			return
		}
		b, err := readJSON(w, r)
		if err != nil {
			return
		}
		next, err := s.Store.Save(b, expected)
		if err != nil {
			status := 422
			if errors.Is(err, registry.ErrConflict) {
				status = 409
			}
			reply(w, status, map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("ETag", `"`+next.Revision()+`"`)
		reply(w, 200, map[string]string{"revision": next.Revision()})
	case "/api/validate", "/api/preview", "/api/plan":
		if !method(w, r, http.MethodPost) {
			return
		}
		b, err := readJSON(w, r)
		if err != nil {
			return
		}
		var input struct {
			Config       json.RawMessage `json:"config"`
			VirtualKeyID string          `json:"virtual_key_id"`
		}
		if err := registry.StrictJSON(b, &input, true); err != nil {
			reply(w, 400, map[string]string{"error": err.Error()})
			return
		}
		snap, err := registry.Parse(input.Config)
		if err != nil {
			reply(w, 422, map[string]string{"error": err.Error()})
			return
		}
		if r.URL.Path == "/api/plan" {
			reply(w, 200, snap.Plan())
			return
		}
		if r.URL.Path == "/api/preview" {
			view, ok := snap.View(input.VirtualKeyID)
			if !ok {
				reply(w, 404, map[string]string{"error": "unknown virtual key"})
				return
			}
			reply(w, 200, view)
			return
		}
		reply(w, 200, map[string]any{"valid": true, "revision": snap.Revision()})
	default:
		if strings.HasPrefix(r.URL.Path, "/api/keys/") {
			s.liveHandler(w, r)
			return
		}
		http.NotFound(w, r)
	}
}
func EmbeddedAssets() (fs.FS, error) {
	assets, err := fs.Sub(files, "web/react")
	if err != nil {
		return nil, err
	}
	if _, err = fs.ReadFile(assets, "index.html"); err != nil {
		return nil, err
	}
	return assets, nil
}

func (s *Server) serveUI(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/")
	if path == "" || path == "model-registry" {
		path = "index.html"
	}
	if strings.HasPrefix(path, ".") || strings.Contains(path, "/.") || filepath.IsAbs(path) {
		http.NotFound(w, r)
		return
	}
	clean := filepath.Clean(path)
	if clean == ".." || strings.HasPrefix(clean, "../") {
		http.NotFound(w, r)
		return
	}
	file := filepath.Join(s.uiDir, clean)
	resolved, err := filepath.EvalSymlinks(file)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	rel, err := filepath.Rel(s.uiDir, resolved)
	if err != nil || rel == ".." || strings.HasPrefix(rel, "../") {
		http.NotFound(w, r)
		return
	}
	info, err := os.Stat(resolved)
	if err != nil || !info.Mode().IsRegular() {
		http.NotFound(w, r)
		return
	}
	http.ServeFile(w, r, resolved)
}
func readJSON(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	if t := strings.Split(r.Header.Get("Content-Type"), ";")[0]; strings.TrimSpace(t) != "application/json" {
		reply(w, 415, map[string]string{"error": "application/json required"})
		return nil, errors.New("invalid media type")
	}
	b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, registry.MaxConfigBytes))
	if err != nil {
		reply(w, 413, map[string]string{"error": "request exceeds 4 MiB"})
		return nil, err
	}
	return b, nil
}
func method(w http.ResponseWriter, r *http.Request, m string) bool {
	if r.Method != m {
		w.Header().Set("Allow", m)
		reply(w, 405, map[string]string{"error": "method not allowed"})
		return false
	}
	return true
}
func reply(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
