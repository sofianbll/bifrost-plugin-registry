package registry

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
)

const testToken = "sk-bf-test-token-0123456789"

func fixture() Config {
	return Config{SchemaVersion: 1, DefaultNaming: "provider/model", Models: []Model{
		{ID: "a", Alias: "smart", Provider: "alpha", ProviderKeyIDs: []string{"key-a"}, UpstreamModel: "wire/a-1", CanonicalModel: "canonical-a", ModelFamily: "openai", Creator: "Creator A", Family: "Family A", Capabilities: []string{"text", "tools", "reasoning"}, Endpoints: []string{"chat/completions", "responses"}, Enabled: true, Verified: true, Evidence: "unit test fixture; not a live provider"},
		{ID: "b", Alias: "smart", Provider: "beta", ProviderKeyIDs: []string{"key-b"}, UpstreamModel: "wire-b-2", Creator: "Creator B", Family: "Family B", Capabilities: []string{"text", "tools"}, Endpoints: []string{"chat/completions", "responses"}, Enabled: true, Verified: true, Evidence: "unit test fixture; not a live provider"},
		{ID: "c", Alias: "fast", Provider: "alpha", ProviderKeyIDs: []string{"key-a"}, UpstreamModel: "wire-c-3", Creator: "Creator A", Family: "Family A", Capabilities: []string{"text"}, Endpoints: []string{"chat/completions"}, Enabled: true, Verified: true, Evidence: "unit test fixture; not a live provider"},
	}, Groups: []Group{{ID: "all", Name: "All", ModelIDs: []string{"a", "b", "c"}}}, Policies: []Policy{{VirtualKeyID: "vk-1", Name: "Tests", TokenSHA256: TokenHash(testToken), Groups: []string{"all"}, Enabled: true}}}
}
func mustCompile(t *testing.T, c Config) *Snapshot {
	t.Helper()
	s, e := Compile(c)
	if e != nil {
		t.Fatal(e)
	}
	return s
}
func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, e := json.Marshal(v)
	if e != nil {
		t.Fatal(e)
	}
	return b
}
func req(body string) *Request {
	return &Request{Method: "POST", Path: "/v1/chat/completions", Headers: map[string]string{"Authorization": "Bearer " + testToken, "Content-Type": "application/json"}, Body: []byte(body)}
}
func names(t *testing.T, s *Snapshot) []string {
	t.Helper()
	v, ok := s.View("vk-1")
	if !ok {
		t.Fatal("missing view")
	}
	out := []string{}
	for _, r := range v.Routes {
		out = append(out, r.ExposedID)
	}
	return out
}
func mustPrepare(t *testing.T, s *Snapshot, r *Request) *Session {
	t.Helper()
	v, f := s.Prepare(r)
	if f != nil {
		t.Fatal(f)
	}
	return v
}

func TestNaming(t *testing.T) {
	for _, tc := range []struct {
		name     string
		prefer   map[string]string
		expected []string
		bad      bool
	}{
		{"provider/model", nil, []string{"alpha/fast", "alpha/smart", "beta/smart"}, false},
		{"model", map[string]string{"smart": "b"}, []string{"fast", "smart"}, false},
		{"both", map[string]string{"smart": "a"}, []string{"alpha/fast", "alpha/smart", "beta/smart", "fast", "smart"}, false},
		{"model", nil, nil, true}, {"both", nil, nil, true},
	} {
		t.Run(fmt.Sprintf("%s_prefer_%v", tc.name, tc.prefer), func(t *testing.T) {
			c := fixture()
			c.Policies[0].Naming = tc.name
			c.Policies[0].Prefer = tc.prefer
			s, e := Compile(c)
			if tc.bad {
				if e == nil {
					t.Fatal("collision accepted")
				}
				return
			}
			if e != nil {
				t.Fatal(e)
			}
			if !reflect.DeepEqual(names(t, s), tc.expected) {
				t.Fatalf("got %v", names(t, s))
			}
		})
	}
}
func TestConfigRejects(t *testing.T) {
	cases := map[string]func(*Config){
		"schema": func(c *Config) { c.SchemaVersion = 2 }, "naming": func(c *Config) { c.DefaultNaming = "auto" },
		"uppercase_alias": func(c *Config) { c.Models[0].Alias = "SMART" }, "alias_slash": func(c *Config) { c.Models[0].Alias = "a/smart" },
		"model_id_duplicate": func(c *Config) { c.Models[1].ID = "a" }, "native_alias_duplicate": func(c *Config) { c.Models[1].Provider = "alpha" },
		"empty_upstream": func(c *Config) { c.Models[0].UpstreamModel = "" }, "control_upstream": func(c *Config) { c.Models[0].UpstreamModel = "x\ny" }, "whitespace_upstream": func(c *Config) { c.Models[0].UpstreamModel = " x" },
		"unsupported_family": func(c *Config) { c.Models[0].ModelFamily = "GPT" }, "no_provider_keys": func(c *Config) { c.Models[0].ProviderKeyIDs = nil }, "duplicate_provider_keys": func(c *Config) { c.Models[0].ProviderKeyIDs = []string{"key-a", "key-a"} },
		"unsupported_endpoint": func(c *Config) { c.Models[0].Endpoints = []string{"realtime"} }, "empty_endpoints": func(c *Config) { c.Models[0].Endpoints = nil }, "duplicate_endpoints": func(c *Config) { c.Models[0].Endpoints = []string{"responses", "responses"} },
		"no_evidence": func(c *Config) { c.Models[0].Evidence = " " }, "group_unknown_model": func(c *Config) { c.Groups[0].ModelIDs = []string{"missing"} }, "empty_group": func(c *Config) { c.Groups[0].ModelIDs = nil },
		"empty_filter": func(c *Config) { c.Groups[0].Filter = &Filter{} }, "duplicate_group": func(c *Config) { c.Groups = append(c.Groups, c.Groups[0]) }, "unknown_exclusion": func(c *Config) { c.Groups[0].Exclude = []string{"unknown"} },
		"unknown_group": func(c *Config) { c.Policies[0].Groups = []string{"unknown"} }, "duplicate_selector": func(c *Config) { c.Policies[0].Groups = []string{"all", "all"} },
		"unknown_added": func(c *Config) { c.Policies[0].Added = []string{"missing"} }, "duplicate_added": func(c *Config) { c.Policies[0].Added = []string{"a", "a"} },
		"unknown_excluded": func(c *Config) { c.Policies[0].Excluded = []string{"missing"} }, "duplicate_excluded": func(c *Config) { c.Policies[0].Excluded = []string{"a", "a"} },
		"invalid_fingerprint": func(c *Config) { c.Policies[0].TokenSHA256 = "sk-bf-rawsecret" }, "uppercase_fingerprint": func(c *Config) { c.Policies[0].TokenSHA256 = strings.ToUpper(c.Policies[0].TokenSHA256) },
		"duplicate_vk_id": func(c *Config) {
			p := c.Policies[0]
			p.TokenSHA256 = TokenHash("another")
			c.Policies = append(c.Policies, p)
		}, "duplicate_fingerprint": func(c *Config) { p := c.Policies[0]; p.VirtualKeyID = "vk-2"; c.Policies = append(c.Policies, p) },
		"bad_preference": func(c *Config) { c.Policies[0].Prefer = map[string]string{"smart": "c"} }, "unknown_preference": func(c *Config) { c.Policies[0].Prefer = map[string]string{"smart": "missing"} },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			c := fixture()
			mutate(&c)
			if _, e := Compile(c); e == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
}
func TestStrictJSON(t *testing.T) {
	for name, s := range map[string]string{
		"duplicate": `{"a":1,"a":2}`, "nested_duplicate": `{"a":{"model":"x","model":"y"}}`, "escaped_duplicate": `{"model":"a","\u006dodel":"b"}`, "trailing": `{} {}`, "trailing_scalar": `{}true`, "truncated": `{"a":`, "deep": strings.Repeat("[", 102) + strings.Repeat("]", 102), "unknown_field": `{"schema_version":1,"default_naming":"model","mystery":1}`,
	} {
		t.Run(name, func(t *testing.T) {
			var c Config
			if StrictJSON([]byte(s), &c, true) == nil {
				t.Fatal("accepted bad JSON")
			}
		})
	}
	var x map[string]any
	if StrictJSON([]byte(`{"a":[1,{"b":true}],"z":null}`), &x, false) != nil {
		t.Fatal("valid JSON rejected")
	}
}
func TestParse(t *testing.T) {
	s, e := Parse(mustJSON(t, fixture()))
	if e != nil || s.Revision() == "" {
		t.Fatal(e)
	}
	if _, e = Parse([]byte("null")); e == nil {
		t.Fatal("null config")
	}
	if _, e = Parse([]byte(strings.Repeat(" ", MaxConfigBytes+1))); e == nil {
		t.Fatal("oversized config")
	}
}
func TestSelectors(t *testing.T) {
	cases := []struct {
		name   string
		change func(*Config)
		want   []string
	}{
		{"empty_policy_denies", func(c *Config) { c.Policies[0].Groups = nil }, []string{}},
		{"disabled_key", func(c *Config) { c.Policies[0].Enabled = false }, []string{}},
		{"unverified_hidden", func(c *Config) { c.Models[0].Verified = false }, []string{"alpha/fast", "beta/smart"}},
		{"disabled_hidden", func(c *Config) { c.Models[1].Enabled = false }, []string{"alpha/fast", "alpha/smart"}},
		{"source_limit", func(c *Config) { c.Policies[0].Sources = []string{"beta"} }, []string{"beta/smart"}},
		{"filters_and_all_capabilities", func(c *Config) {
			c.Groups[0].ModelIDs = nil
			c.Groups[0].Filter = &Filter{Sources: []string{"alpha", "beta"}, Creators: []string{"Creator A"}, Capabilities: []string{"text", "tools"}}
		}, []string{"alpha/smart"}},
		{"family_filter", func(c *Config) {
			c.Groups[0].ModelIDs = nil
			c.Groups[0].Filter = &Filter{Families: []string{"Family B"}}
		}, []string{"beta/smart"}},
		{"union_then_exclude", func(c *Config) {
			c.Groups[0].ModelIDs = []string{"b"}
			c.Groups[0].Filter = &Filter{Sources: []string{"alpha"}}
			c.Groups[0].Exclude = []string{"a"}
		}, []string{"alpha/fast", "beta/smart"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := fixture()
			tc.change(&c)
			if got := names(t, mustCompile(t, c)); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %v want %v", got, tc.want)
			}
		})
	}
}
func TestPolicyLocalSelections(t *testing.T) {
	c := fixture()
	c.Groups[0].Description = "Shared catalogue"
	c.Groups = append(c.Groups, Group{ID: "other", Name: "Other", ModelIDs: []string{"a", "b"}})
	c.Policies[0].Groups = []string{"all", "other"}
	c.Policies[0].Added = []string{"c"}
	c.Policies[0].Excluded = []string{"a", "c"}
	s := mustCompile(t, c)
	if got := names(t, s); !reflect.DeepEqual(got, []string{"beta/smart"}) {
		t.Fatalf("local exclusions must win across groups and additions: %v", got)
	}
	if !reflect.DeepEqual(s.Config().Policies[0].Added, []string{"c"}) || !reflect.DeepEqual(s.Config().Policies[0].Excluded, []string{"a", "c"}) {
		t.Fatal("local selections changed during compile")
	}
	if s.Config().Groups[0].Description != "Shared catalogue" {
		t.Fatal("group description lost during compile")
	}
	c.Policies[0].Groups = nil
	c.Policies[0].Added = []string{"a", "b", "c"}
	c.Policies[0].Excluded = nil
	c.Policies[0].Sources = []string{"alpha"}
	c.Models[2].Verified = false
	if got := names(t, mustCompile(t, c)); !reflect.DeepEqual(got, []string{"alpha/smart"}) {
		t.Fatalf("source and verification checks must apply to additions: %v", got)
	}
	c.Policies[0].Naming = "both"
	c.Policies[0].Sources = nil
	c.Models[2].Verified = true
	if _, err := Compile(c); err == nil || !strings.Contains(err.Error(), "ambiguous") {
		t.Fatalf("bare alias collision through additions accepted: %v", err)
	}
	c.Policies[0].Prefer = map[string]string{"smart": "b"}
	c.Policies[0].Excluded = []string{"b"}
	if _, err := Compile(c); err == nil || !strings.Contains(err.Error(), "preference") {
		t.Fatalf("excluded preference accepted: %v", err)
	}
}
func TestSnapshotIsolationAndDeterminism(t *testing.T) {
	c := fixture()
	s := mustCompile(t, c)
	before := string(s.JSON())
	c.Models[0].Endpoints[0] = "BAD"
	copy := s.Config()
	copy.Models[0].ID = "bad"
	v, _ := s.View("vk-1")
	v.Routes[0].ExposedID = "BAD"
	v.Policy.Groups[0] = "BAD"
	if string(s.JSON()) != before {
		t.Fatal("caller mutated snapshot")
	}
	for i := 0; i < 30; i++ {
		next := mustCompile(t, fixture())
		if next.Revision() != s.Revision() || !reflect.DeepEqual(names(t, next), names(t, s)) {
			t.Fatal("unstable compile")
		}
	}
}

func TestCredential(t *testing.T) {
	for name, h := range map[string]map[string]string{
		"bearer": {"Authorization": "Bearer " + testToken}, "lower": {"authorization": "bearer " + testToken}, "header": {"X-Bf-Vk": testToken}, "matching": {"Authorization": "Bearer " + testToken, "x-bf-vk": testToken},
	} {
		t.Run(name, func(t *testing.T) {
			v, e := Credential(h)
			if e != nil || v != testToken {
				t.Fatal(v, e)
			}
		})
	}
	for name, h := range map[string]map[string]string{
		"missing": {}, "provider_key": {"Authorization": "Bearer sk-openai-provider-key"}, "basic": {"Authorization": "Basic xxx"}, "conflict": {"Authorization": "Bearer " + testToken, "x-bf-vk": testToken + "other"}, "case_duplicates": {"authorization": "Bearer " + testToken, "Authorization": "Bearer " + testToken}, "comma": {"x-bf-vk": testToken + ",abc"}, "newline": {"x-bf-vk": testToken + "\n"}, "too_short": {"x-bf-vk": "sk-bf-x"},
	} {
		t.Run(name, func(t *testing.T) {
			if _, e := Credential(h); e == nil {
				t.Fatal("accepted invalid credentials")
			}
		})
	}
}
func TestRequestRejections(t *testing.T) {
	cases := []struct {
		name   string
		change func(*Request)
		status int
	}{
		{"wrong_method", func(r *Request) { r.Method = "GET" }, 405}, {"wrong_path", func(r *Request) { r.Path = "/v1/realtime" }, 400}, {"unknown_key", func(r *Request) { r.Headers["Authorization"] = "Bearer sk-bf-unknown-token" }, 403},
		{"missing_key", func(r *Request) { delete(r.Headers, "Authorization") }, 401}, {"hidden_model", func(r *Request) { r.Body = []byte(`{"model":"wire/a-1"}`) }, 403}, {"bare_hidden", func(r *Request) { r.Body = []byte(`{"model":"smart"}`) }, 403},
		{"null_body", func(r *Request) { r.Body = []byte(`null`) }, 400}, {"array_body", func(r *Request) { r.Body = []byte(`[]`) }, 400}, {"missing_model", func(r *Request) { r.Body = []byte(`{}`) }, 400}, {"numeric_model", func(r *Request) { r.Body = []byte(`{"model":4}`) }, 400},
		{"duplicate_model", func(r *Request) { r.Body = []byte(`{"model":"alpha/smart","model":"beta/smart"}`) }, 400}, {"duplicate_nested", func(r *Request) { r.Body = []byte(`{"model":"alpha/smart","extra":{"a":1,"a":2}}`) }, 400},
		{"multipart", func(r *Request) { r.Headers["Content-Type"] = "multipart/form-data" }, 415}, {"header_case_duplicate", func(r *Request) { r.Headers["content-type"] = "application/json" }, 400},
		{"direct_key", func(r *Request) { r.Headers["x-bf-direct-key"] = "secret" }, 403}, {"api_key_header", func(r *Request) { r.Headers["x-bf-api-key"] = "secret" }, 403}, {"api_key_id", func(r *Request) { r.Headers["x-bf-api-key-id"] = "key-a" }, 403},
		{"raw_provider", func(r *Request) { r.Body = []byte(`{"model":"alpha/smart","provider":"beta"}`) }, 400}, {"raw_baseurl", func(r *Request) { r.Body = []byte(`{"model":"alpha/smart","base_url":"https://evil.invalid"}`) }, 400}, {"raw_apikey", func(r *Request) { r.Body = []byte(`{"model":"alpha/smart","api_key":null}`) }, 400},
		{"fallback_null", func(r *Request) { r.Body = []byte(`{"model":"alpha/smart","fallbacks":null}`) }, 400}, {"fallback_object", func(r *Request) {
			r.Body = []byte(`{"model":"alpha/smart","fallbacks":[{"provider":"beta","model":"smart"}]}`)
		}, 400}, {"fallback_hidden", func(r *Request) { r.Body = []byte(`{"model":"alpha/smart","fallbacks":["other/smart"]}`) }, 403},
		{"fallback_endpoint", func(r *Request) {
			r.Path = "/v1/responses"
			r.Body = []byte(`{"model":"alpha/smart","fallbacks":["alpha/fast"]}`)
		}, 400},
		{"body_too_large", func(r *Request) { r.Body = make([]byte, MaxBodyBytes+1) }, 413},
	}
	s := mustCompile(t, fixture())
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := req(`{"model":"alpha/smart"}`)
			tc.change(r)
			_, f := s.Prepare(r)
			if f == nil || f.Status != tc.status {
				t.Fatalf("want %d got %#v", tc.status, f)
			}
			if !json.Valid(f.JSON()) {
				t.Fatal("error is not JSON")
			}
		})
	}
}
func TestPreparePreservesUnknownPayloads(t *testing.T) {
	c := fixture()
	c.Policies[0].Naming = "both"
	c.Policies[0].Prefer = map[string]string{"smart": "a"}
	s := mustCompile(t, c)
	original := `{"model":"smart","messages":[{"role":"user","content":"hi"}],"tools":[{"type":"function","function":{"name":"x","parameters":{"type":"object"}}}],"reasoning":{"effort":"high"},"prompt_cache_key":"cache-1","previous_response_id":"resp_1","stream":true,"extra_params":{"signature":"opaque","integer":9007199254740993}}`
	r := req(original)
	session := mustPrepare(t, s, r)
	var before, after map[string]json.RawMessage
	json.Unmarshal([]byte(original), &before)
	json.Unmarshal(r.Body, &after)
	for k, v := range before {
		if k != "model" && string(v) != string(after[k]) {
			t.Errorf("modified %s", k)
		}
	}
	if string(after["model"]) != `"alpha/smart"` {
		t.Fatal(string(r.Body))
	}
	if session.CheckAttempt("alpha", "smart") != nil {
		t.Fatal("allowed route denied")
	}
	if session.CheckAttempt("beta", "smart") != nil {
		t.Fatal("policy-exposed route denied (pre-registry governance semantics)")
	}
	if session.CheckAttempt("intruder", "smart") == nil {
		t.Fatal("unexposed provider accepted")
	}
	if session.CheckAttempt("alpha", "wire/a-1") == nil {
		t.Fatal("raw upstream allowed before native alias handling")
	}
}
func TestFallbacksAndNaming(t *testing.T) {
	c := fixture()
	c.Policies[0].Naming = "both"
	c.Policies[0].Prefer = map[string]string{"smart": "a"}
	s := mustCompile(t, c)
	r := req(`{"model":"smart","fallbacks":["beta/smart","fast","alpha/fast"]}`)
	session := mustPrepare(t, s, r)
	if session.CheckAttempt("beta", "smart") != nil || session.CheckAttempt("alpha", "fast") != nil {
		t.Fatal("explicit fallback rejected")
	}
	var b map[string]json.RawMessage
	json.Unmarshal(r.Body, &b)
	if string(b["fallbacks"]) != `["beta/smart","alpha/fast"]` {
		t.Fatal(string(b["fallbacks"]))
	}
	if session.CheckAttempt("intruder", "smart") == nil {
		t.Fatal("injected fallback accepted")
	}
	if session.VerifyIdentity("vk-1") != nil || session.VerifyIdentity("") == nil || session.VerifyIdentity("vk-2") == nil {
		t.Fatal("identity binding")
	}
	if session.Revision() != s.Revision() {
		t.Fatal("snapshot revision")
	}
}
func TestEndpointPaths(t *testing.T) {
	for _, path := range []string{"/v1/models", "/openai/v1/models", "/openai/models", "/v1/audio/speech", "/v1/images/generations"} {
		if _, ok := Endpoint(path); !ok {
			t.Fatal(path)
		}
	}
	for _, path := range []string{"/v1/models/alpha", "/v1/models/", "/v1/../models", "/anthropic/v1/messages", "/v1/realtime", "/api/providers"} {
		if _, ok := Endpoint(path); ok {
			t.Fatal(path)
		}
	}
}
func TestProjectionIntersectionAndPrivacy(t *testing.T) {
	c := fixture()
	c.Policies[0].Naming = "both"
	c.Policies[0].Prefer = map[string]string{"smart": "a"}
	s := mustCompile(t, c)
	r := req("")
	r.Method = "GET"
	r.Path = "/v1/models"
	session := mustPrepare(t, s, r)
	native := []byte(`{"object":"list","data":[{"id":"alpha/smart","created":123,"owned_by":"alpha","context_length":999,"secret":"DO_NOT_LEAK"},{"id":"beta/smart","model_family":"hidden"},{"id":"alpha/fast-raw"},{"id":"alien/model"}]}`)
	out, f := session.Project(native, "vk-1")
	if f != nil {
		t.Fatal(f)
	}
	if strings.Contains(string(out), "DO_NOT_LEAK") || strings.Contains(string(out), "context_length") || strings.Contains(string(out), "family") {
		t.Fatal("metadata leak")
	}
	var env struct {
		Object string           `json:"object"`
		Data   []map[string]any `json:"data"`
	}
	json.Unmarshal(out, &env)
	if env.Object != "list" || len(env.Data) != 3 {
		t.Fatalf("bad projection %s", out)
	}
	for _, e := range env.Data {
		if len(e) != 4 {
			t.Fatal("nonminimal model")
		}
	}
	if session.CheckAttempt("", "any") != nil {
		t.Fatal("models attempt guard should defer to native listing filter")
	}
	out, f = session.Project([]byte(`{"data":[]}`), "vk-1")
	if f != nil || !strings.Contains(string(out), `"data":[]`) {
		t.Fatal("empty listing must remain empty")
	}
	if _, f = session.Project(native, "vk-2"); f == nil {
		t.Fatal("cross-key listing accepted")
	}
}
func TestProjectionRejects(t *testing.T) {
	s := mustCompile(t, fixture())
	r := req("")
	r.Method = "GET"
	r.Path = "/v1/models"
	v := mustPrepare(t, s, r)
	for name, raw := range map[string]string{
		"null": "null", "no_data": "{}", "null_data": `{"data":null}`, "wrong_data": `{"data":{}}`, "no_id": `{"data":[{}]}`, "bad_id": `{"data":[{"id":5}]}`, "duplicate_id": `{"data":[{"id":"a"},{"id":"a"}]}`, "duplicate_key": `{"data":[],"data":[]}`, "invalid_created": `{"data":[{"id":"alpha/smart","created":"yesterday"}]}`, "invalid_shutdown_metadata": `{"data":[{"id":"alpha/smart","shutdown_date":{"secret":"x"}}]}`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, f := v.Project([]byte(raw), "vk-1"); f == nil || f.Status != 502 {
				t.Fatalf("bad response not rejected %#v", f)
			}
		})
	}
}

func TestStoreAtomicAndConflicts(t *testing.T) {
	path := filepath.Join(t.TempDir(), "registry.json")
	s := mustCompile(t, fixture())
	if e := AtomicWrite(path, s.JSON()); e != nil {
		t.Fatal(e)
	}
	st, e := OpenStore(path)
	if e != nil {
		t.Fatal(e)
	}
	orig := st.Load().Revision()
	if _, e = st.Save([]byte(`{}`), orig); e == nil {
		t.Fatal("bad save")
	}
	if st.Load().Revision() != orig {
		t.Fatal("invalid data replaced good state")
	}
	c := fixture()
	c.Policies[0].Name = "Changed"
	next := mustJSON(t, c)
	if _, e = st.Save(next, "wrong"); e != ErrConflict {
		t.Fatal("missing revision conflict", e)
	}
	if _, e = st.Save(next, orig); e != nil {
		t.Fatal(e)
	}
	if st.Load().Revision() == orig {
		t.Fatal("save not applied")
	}
	info, e := os.Stat(path)
	if e != nil || info.Mode().Perm() != 0600 {
		t.Fatal("insecure file permissions", e)
	}
	reopened, e := OpenStore(path)
	if e != nil || reopened.Load().Revision() != st.Load().Revision() {
		t.Fatal("disk/memory mismatch", e)
	}
	if _, e = st.Save(next, orig); e != ErrConflict {
		t.Fatal("stale save accepted", e)
	}
	if e = os.WriteFile(path, []byte(`invalid external edit`), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e = st.Save(next, st.Load().Revision()); e != ErrConflict {
		t.Fatal("external edit overwritten", e)
	}
}
func TestConcurrentSnapshots(t *testing.T) {
	st := MemoryStore(mustCompile(t, fixture()))
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				snap := st.Load()
				r := req(`{"model":"alpha/smart"}`)
				session, f := snap.Prepare(r)
				if f != nil || session.Revision() != snap.Revision() {
					t.Error("inconsistent snapshot")
				}
			}
		}()
	}
	for j := 0; j < 50; j++ {
		old := st.Load()
		c := old.Config()
		c.Policies[0].Name = fmt.Sprintf("revision-%d", j)
		if _, e := st.Save(mustJSON(t, c), old.Revision()); e != nil {
			t.Fatal(e)
		}
	}
	wg.Wait()
}

func TestNativePlan(t *testing.T) {
	s := mustCompile(t, fixture())
	p := s.Plan()
	if len(p.ProviderKeys) != 2 || len(p.VirtualKeys) != 1 {
		t.Fatalf("bad plan %#v", p)
	}
	a := p.ProviderKeys[0].Aliases["smart"]
	if a.ModelID != "wire/a-1" || a.ModelName != "canonical-a" || a.ModelFamily != "openai" {
		t.Fatal(a)
	}
	if !reflect.DeepEqual(p.VirtualKeys[0].AllowedModels["alpha"], []string{"fast", "smart"}) {
		t.Fatal(p.VirtualKeys[0])
	}
	first := string(mustJSON(t, p))
	for i := 0; i < 15; i++ {
		if string(mustJSON(t, s.Plan())) != first {
			t.Fatal("nondeterministic plan")
		}
	}
}

const nativeConfig = `{"client":{"drop_excess_requests":true},"governance":{"budget":"DO_NOT_CHANGE"},"providers":{"alpha":{"network_config":{"base_url":"http://internal.invalid"},"keys":[{"id":"key-a","value":"KEEP_SECRET","aliases":{"legacy":"keep"}}]},"beta":{"keys":[{"id":"key-b","value":"KEEP_BETA"}]}}}`

func TestMergeAliasesPreservesNativeConfig(t *testing.T) {
	s := mustCompile(t, fixture())
	out, e := s.MergeAliases([]byte(nativeConfig))
	if e != nil {
		t.Fatal(e)
	}
	for _, want := range []string{"KEEP_SECRET", "KEEP_BETA", "DO_NOT_CHANGE", "legacy", "http://internal.invalid", "canonical-a"} {
		if !strings.Contains(string(out), want) {
			t.Fatal("lost native field", want)
		}
	}
	again, e := s.MergeAliases(out)
	if e != nil || string(again) != string(out) {
		t.Fatal("merge not idempotent", e)
	}
}
func TestMergeAliasesRejects(t *testing.T) {
	s := mustCompile(t, fixture())
	for name, raw := range map[string]string{
		"missing_provider": `{"providers":{}}`, "wrong_shape": `{"providers":[]}`, "missing_key": strings.Replace(nativeConfig, `"key-a"`, `"unknown"`, 1),
		"conflicting_alias":  strings.Replace(nativeConfig, `"legacy":"keep"`, `"smart":"wrong-upstream"`, 1),
		"case_collision":     strings.Replace(nativeConfig, `"legacy":"keep"`, `"SMART":"wire/a-1"`, 1),
		"invalid_aliases":    strings.Replace(nativeConfig, `{"legacy":"keep"}`, `null`, 1),
		"duplicate_json":     strings.Replace(nativeConfig, `"legacy":"keep"`, `"legacy":"keep","legacy":"other"`, 1),
		"other_key_conflict": `{"providers":{"alpha":{"keys":[{"id":"key-a"},{"id":"other","aliases":{"smart":"evil"}}]},"beta":{"keys":[{"id":"key-b"}]}}}`,
		"duplicate_key_id":   `{"providers":{"alpha":{"keys":[{"id":"key-a"},{"id":"key-a"}]},"beta":{"keys":[{"id":"key-b"}]}}}`,
	} {
		t.Run(name, func(t *testing.T) {
			if _, e := s.MergeAliases([]byte(raw)); e == nil {
				t.Fatal("unsafe merge accepted")
			}
		})
	}
}
func FuzzStrictJSONDoesNotPanic(f *testing.F) {
	for _, s := range []string{`{}`, `{"model":"a","model":"b"}`, `[]`, `null`, `"x"`} {
		f.Add([]byte(s))
	}
	f.Fuzz(func(t *testing.T, b []byte) {
		if len(b) > 65536 {
			t.Skip()
		}
		var dst any
		_ = StrictJSON(b, &dst, false)
	})
}

// Provider names keep their Bifrost-native case ("Google", "Codex"): they are
// admin-controlled and must survive verbatim into the rewritten model field.
func TestCompileNativeCaseProvider(t *testing.T) {
	c := Config{SchemaVersion: 1, DefaultNaming: "both",
		Models: []Model{{ID: "gpt-5.6-sol", Alias: "gpt-5.6-sol", Provider: "Codex",
			ProviderKeyIDs: []string{"17"}, UpstreamModel: "gpt-5.6-sol",
			Endpoints: []string{"chat/completions"}, Enabled: true, Verified: true, Evidence: "unit test"}},
		Groups: []Group{{ID: "code", ModelIDs: []string{"gpt-5.6-sol"}}},
		Policies: []Policy{{VirtualKeyID: "vk-1", Name: "t", TokenSHA256: strings.Repeat("a", 64),
			Groups: []string{"code"}, Enabled: true}}}
	s, err := Compile(c)
	if err != nil {
		t.Fatalf("native-case provider rejected: %v", err)
	}
	v, _ := s.View("vk-1")
	var found *Route
	for i := range v.Routes {
		if v.Routes[i].ExposedID == "Codex/gpt-5.6-sol" {
			found = &v.Routes[i]
		}
	}
	if found == nil || found.NativeID() != "Codex/gpt-5.6-sol" {
		t.Fatalf("native provider/model route missing or altered: %+v", v.Routes)
	}
	bare := false
	for _, r := range v.Routes {
		if r.ExposedID == "gpt-5.6-sol" {
			bare = true
		}
	}
	if !bare {
		t.Fatal("bare alias route missing")
	}
}

func TestNativeProviderWithInternalSpace(t *testing.T) {
	c := fixture()
	c.Models[0].Provider = "CLI PROXY"
	c.Policies[0].Sources = []string{"CLI PROXY"}
	s := mustCompile(t, c)
	if got := names(t, s); !reflect.DeepEqual(got, []string{"CLI PROXY/smart"}) {
		t.Fatalf("native provider name changed: %v", got)
	}
	r := req(`{"model":"CLI PROXY/smart"}`)
	session := mustPrepare(t, s, r)
	if !strings.Contains(string(r.Body), `"CLI PROXY/smart"`) || session.CheckAttempt("CLI PROXY", "smart") != nil {
		t.Fatalf("native provider route did not survive request: %s", r.Body)
	}
	if _, err := Parse(mustJSON(t, c)); err != nil {
		t.Fatalf("round-trip rejected native provider name: %v", err)
	}
	for _, provider := range []string{" CLI PROXY", "CLI PROXY ", "CLI/PROXY", "CLI\tPROXY", "CLI\nPROXY", "CLI  /PROXY", strings.Repeat("A", 129)} {
		c.Models[0].Provider = provider
		if _, err := Compile(c); err == nil {
			t.Fatalf("invalid provider %q accepted", provider)
		}
	}
	c = passthroughFixture()
	c.Models[3].RoutingTargets = []string{"CLI PROXY/smart"}
	if _, err := Compile(c); err != nil {
		t.Fatalf("native routing target rejected: %v", err)
	}
}

func passthroughFixture() Config {
	c := fixture()
	c.Models = append(c.Models, Model{
		ID: "alias-rot", Alias: "rot", Provider: "alpha", ProviderKeyIDs: []string{"key-a"},
		UpstreamModel: "wire/a-1", Endpoints: []string{"chat/completions", "responses"},
		Enabled: true, Verified: true, Evidence: "routing rule unit fixture",
		Passthrough: true, RoutingTargets: []string{"alpha/smart", "beta/smart"},
	})
	c.Groups[0].ModelIDs = append(c.Groups[0].ModelIDs, "alias-rot")
	return c
}

func TestPassthroughAlias(t *testing.T) {
	c := passthroughFixture()
	c.Policies[0].Naming = "both"
	c.Policies[0].Prefer = map[string]string{"smart": "a"}
	s := mustCompile(t, c)
	got := names(t, s)
	for _, r := range got {
		if r == "alpha/rot" || r == "beta/rot" {
			t.Fatalf("passthrough alias exposed in provider/model form: %v", got)
		}
	}
	if !reflect.DeepEqual(got, []string{"alpha/fast", "alpha/smart", "beta/smart", "fast", "rot", "smart"}) {
		t.Fatalf("unexpected exposed routes: %v", got)
	}
	// Bare alias request: model must reach Bifrost routing untouched…
	r := req(`{"model":"rot","messages":[]}`)
	session := mustPrepare(t, s, r)
	var b map[string]json.RawMessage
	json.Unmarshal(r.Body, &b)
	if string(b["model"]) != `"rot"` {
		t.Fatalf("passthrough model rewritten: %s", r.Body)
	}
	// …but every routing target attempt is pre-authorized, strangers are not.
	if session.CheckAttempt("alpha", "smart") != nil || session.CheckAttempt("beta", "smart") != nil {
		t.Fatal("routing target attempt denied")
	}
	if session.CheckAttempt("intruder", "smart") == nil {
		t.Fatal("non-target attempt accepted")
	}
	// Attempt on any policy-exposed model is accepted (rule left the primary
	// target to the virtual key's provider selection); unexposed stays denied.
	if session.CheckAttempt("alpha", "fast") != nil {
		t.Fatal("policy-exposed attempt denied")
	}
	// Passthrough fallbacks keep their bare alias names.
	r2 := req(`{"model":"rot","fallbacks":["rot","alpha/smart"]}`)
	mustPrepare(t, s, r2)
	var b2 map[string]json.RawMessage
	json.Unmarshal(r2.Body, &b2)
	if string(b2["fallbacks"]) != `["rot","alpha/smart"]` {
		t.Fatalf("passthrough fallbacks rewritten: %s", r2.Body)
	}
	// The provider/model form must not smuggle an unrewritable route.
	r3 := req(`{"model":"alpha/rot","messages":[]}`)
	if _, f := s.Prepare(r3); f == nil || f.Code != "registry_model_hidden" {
		t.Fatalf("provider/model passthrough form accepted: %+v", f)
	}
}

func TestPassthroughValidation(t *testing.T) {
	c := passthroughFixture()
	c.Models[3].RoutingTargets = nil
	if _, e := Compile(c); e == nil || !strings.Contains(e.Error(), "routing_targets") {
		t.Fatalf("missing routing targets accepted: %v", e)
	}
	c = passthroughFixture()
	c.Models[3].RoutingTargets = []string{"no-provider-separator"}
	if _, e := Compile(c); e == nil || !strings.Contains(e.Error(), "routing target") {
		t.Fatalf("malformed routing target accepted: %v", e)
	}
}
