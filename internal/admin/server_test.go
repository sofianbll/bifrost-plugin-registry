package admin

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

const adminToken = "local-test-admin-token-12345678901234567890"

func setup(t *testing.T) *Server {
	t.Helper()
	s, e := registry.Compile(registry.Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: []registry.Model{}, Groups: []registry.Group{}, Policies: []registry.Policy{}})
	if e != nil {
		t.Fatal(e)
	}
	server, e := New(registry.MemoryStore(s), adminToken, nil)
	if e != nil {
		t.Fatal(e)
	}
	return server
}
func perform(s *Server, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "http://localhost:8099"+path, strings.NewReader(body))
	for k, v := range headers {
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	return w
}
func authorized() map[string]string {
	return map[string]string{"Authorization": "Bearer " + adminToken, "Content-Type": "application/json"}
}
func TestAdminAuthentication(t *testing.T) {
	s := setup(t)
	for name, h := range map[string]map[string]string{"missing": {}, "wrong": {"Authorization": "Bearer incorrect"}, "query_token": {"Authorization": ""}, "basic": {"Authorization": "Basic " + adminToken}} {
		t.Run(name, func(t *testing.T) {
			w := perform(s, "GET", "/api/config?token="+adminToken, "", h)
			if w.Code != 401 {
				t.Fatalf("got %d", w.Code)
			}
			if strings.Contains(w.Body.String(), adminToken) {
				t.Fatal("secret leak")
			}
		})
	}
	w := perform(s, "GET", "/api/config", "", authorized())
	if w.Code != 200 || w.Header().Get("ETag") == "" {
		t.Fatal(w.Code)
	}
	if _, e := New(s.Store, "short", nil); e == nil {
		t.Fatal("short admin token")
	}
}
func TestAdminOriginAndHost(t *testing.T) {
	s := setup(t)
	for _, host := range []string{"evil.invalid:8099", "localhost.evil.invalid", "127.0.0.1.evil.invalid"} {
		t.Run(host, func(t *testing.T) {
			r := httptest.NewRequest("GET", "http://"+host+"/api/config", nil)
			r.Header.Set("Authorization", "Bearer "+adminToken)
			w := httptest.NewRecorder()
			s.ServeHTTP(w, r)
			if w.Code != 403 {
				t.Fatal(w.Code)
			}
		})
	}
	for _, origin := range []string{"http://evil.invalid", "http://localhost:1234", "null", "https://user@localhost:8099"} {
		t.Run(origin, func(t *testing.T) {
			h := authorized()
			h["Origin"] = origin
			if w := perform(s, "GET", "/api/config", "", h); w.Code != 403 {
				t.Fatal(w.Code)
			}
		})
	}
	h := authorized()
	h["Origin"] = "http://localhost:8099"
	if w := perform(s, "GET", "/api/config", "", h); w.Code != 200 {
		t.Fatal(w.Code)
	}
}
func TestStaticAssets(t *testing.T) {
	s := setup(t)
	for _, path := range []string{"/", "/model-registry", "/app.js", "/app.css"} {
		t.Run(path, func(t *testing.T) {
			w := perform(s, "GET", path, "", nil)
			if w.Code != 200 {
				t.Fatal(w.Code)
			}
			if !strings.Contains(w.Header().Get("Content-Security-Policy"), "frame-ancestors 'none'") {
				t.Fatal("missing CSP")
			}
			if strings.Contains(w.Body.String(), adminToken) {
				t.Fatal("credential in static asset")
			}
			if w.Header().Get("Access-Control-Allow-Origin") != "" {
				t.Fatal("CORS unexpectedly enabled")
			}
		})
	}
	for _, path := range []string{"/../go.mod", "/registry.json", "/web/../server.go"} {
		if w := perform(s, "GET", path, "", nil); w.Code != 404 {
			t.Fatal(path, w.Code)
		}
	}
	if w := perform(s, "HEAD", "/app.js", "", nil); w.Code != 200 || w.Body.Len() != 0 {
		t.Fatal("bad HEAD")
	}
	if w := perform(s, "POST", "/app.js", "", nil); w.Code != 405 {
		t.Fatal("static write accepted")
	}
}
func TestSaveRevisionAndValidation(t *testing.T) {
	s := setup(t)
	initial := s.Store.Load().Revision()
	c := s.Store.Load().Config()
	c.DefaultNaming = "model"
	b, _ := json.Marshal(c)
	t.Run("precondition_required", func(t *testing.T) {
		w := perform(s, "PUT", "/api/config", string(b), authorized())
		if w.Code != 428 {
			t.Fatal(w.Code)
		}
	})
	t.Run("bad_content_type", func(t *testing.T) {
		h := authorized()
		h["If-Match"] = initial
		h["Content-Type"] = "text/plain"
		if w := perform(s, "PUT", "/api/config", string(b), h); w.Code != 415 {
			t.Fatal(w.Code)
		}
	})
	t.Run("invalid_config", func(t *testing.T) {
		h := authorized()
		h["If-Match"] = initial
		if w := perform(s, "PUT", "/api/config", "{}", h); w.Code != 422 {
			t.Fatal(w.Code)
		}
		if s.Store.Load().Revision() != initial {
			t.Fatal("bad config saved")
		}
	})
	t.Run("valid_update", func(t *testing.T) {
		h := authorized()
		h["If-Match"] = `"` + initial + `"`
		w := perform(s, "PUT", "/api/config", string(b), h)
		if w.Code != 200 || w.Header().Get("ETag") == "" {
			t.Fatal(w.Code, w.Body.String())
		}
		if s.Store.Load().Config().DefaultNaming != "model" {
			t.Fatal("update missing")
		}
	})
	t.Run("stale_revision", func(t *testing.T) {
		h := authorized()
		h["If-Match"] = initial
		if w := perform(s, "PUT", "/api/config", string(b), h); w.Code != 409 {
			t.Fatal(w.Code)
		}
	})
}
func TestValidatePlanPreview(t *testing.T) {
	s := setup(t)
	body := `{"config":` + string(s.Store.Load().JSON()) + `}`
	for _, path := range []string{"/api/validate", "/api/plan"} {
		t.Run(path, func(t *testing.T) {
			if w := perform(s, "POST", path, body, authorized()); w.Code != 200 {
				t.Fatal(w.Code, w.Body.String())
			}
		})
	}
	cases := []struct {
		name, path, body string
		status           int
	}{
		{"missing_key", "/api/preview", body, 404}, {"bad_config", "/api/validate", `{"config":{}}`, 422}, {"unknown_wrapper", "/api/validate", `{"config":{},"unexpected":1}`, 400}, {"duplicate_wrapper", "/api/validate", `{"config":{},"config":{}}`, 400}, {"duplicate_config", "/api/validate", `{"config":{"schema_version":1,"schema_version":2}}`, 400},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if w := perform(s, "POST", tc.path, tc.body, authorized()); w.Code != tc.status {
				t.Fatal(w.Code, w.Body.String())
			}
		})
	}
	w := perform(s, "GET", "/api/status", "", authorized())
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"bifrost_connected":false`) || !strings.Contains(w.Body.String(), `"native_apply":"manual"`) {
		t.Fatal("misleading status", w.Body.String())
	}
}
func TestAdminLimitsAndMethods(t *testing.T) {
	s := setup(t)
	if w := perform(s, "POST", "/api/validate", strings.Repeat("x", registry.MaxConfigBytes+1), authorized()); w.Code != 413 {
		t.Fatal(w.Code)
	}
	for _, path := range []string{"/api/status", "/api/validate", "/api/plan", "/api/preview", "/api/config"} {
		t.Run(path, func(t *testing.T) {
			if w := perform(s, "DELETE", path, "", authorized()); w.Code != 405 {
				t.Fatal(w.Code)
			}
		})
	}
	if w := perform(s, "GET", "/api/not-found", "", authorized()); w.Code != 404 {
		t.Fatal(w.Code)
	}
	r := httptest.NewRequest("GET", "http://localhost/api/config", nil)
	r.Header.Add("Authorization", "Bearer "+adminToken)
	r.Header.Add("Authorization", "Bearer "+adminToken)
	w := httptest.NewRecorder()
	s.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatal("duplicate auth accepted")
	}
}
func TestRealHTTPServer(t *testing.T) {
	s := setup(t)
	ts := httptest.NewServer(s)
	defer ts.Close()
	r, _ := http.NewRequest("GET", ts.URL+"/api/config", nil)
	r.Header.Set("Authorization", "Bearer "+adminToken)
	resp, e := ts.Client().Do(r)
	if e != nil {
		t.Fatal(e)
	}
	defer resp.Body.Close()
	b, e := io.ReadAll(resp.Body)
	if e != nil || resp.StatusCode != 200 || !bytes.Contains(b, []byte(`"schema_version":1`)) {
		t.Fatal("HTTP request failed", e)
	}
	srv := s.HTTPServer("127.0.0.1:8099")
	if srv.ReadHeaderTimeout <= 0 || srv.MaxHeaderBytes <= 0 {
		t.Fatal("missing HTTP limits")
	}
}
