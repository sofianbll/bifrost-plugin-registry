package admin

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"

	"bifrost-registry/internal/registry"
)

func TestReadbackDistinguishesUnusableResponseFromEmptyObservation(t *testing.T) {
	for _, tc := range []struct {
		name   string
		body   string
		state  string
		actual []string
	}{
		{name: "absent data", body: `{}`, state: "not_verified"},
		{name: "null data", body: `{"data":null}`, state: "not_verified"},
		{name: "malformed JSON", body: `{"data":`, state: "not_verified"},
		{name: "invalid data type", body: `{"data":{}}`, state: "not_verified"},
		{name: "missing ID", body: `{"data":[{}]}`, state: "not_verified"},
		{name: "invalid ID type", body: `{"data":[{"id":42}]}`, state: "not_verified"},
		{name: "duplicate ID", body: `{"data":[{"id":"openai/alpha"},{"id":"openai/alpha"}]}`, state: "not_verified"},
		{name: "empty list", body: `{"data":[]}`, state: "drift", actual: []string{}},
		{name: "ordinary list", body: `{"data":[{"id":"openai/alpha"}]}`, state: "verified", actual: []string{"openai/alpha"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := setup(t)
			if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
				t.Fatal(err)
			}
			cfg := s.Store.Load().Config()
			cfg.Models = []registry.Model{{ID: "alpha", Alias: "alpha", Provider: "openai", ProviderKeyIDs: []string{"key-alpha"}, UpstreamModel: "alpha", Endpoints: []string{"chat/completions"}, Enabled: true, Configured: true}}
			cfg.Policies = []registry.Policy{{VirtualKeyID: "vk-readback", TokenSHA256: registry.TokenHash("sk-bf-readback"), Naming: "provider/model", Added: []string{"alpha"}, Enabled: true}}
			raw, err := json.Marshal(cfg)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := s.Store.Save(raw, s.Store.Load().Revision()); err != nil {
				t.Fatal(err)
			}
			const key = `{"id":"vk-readback","name":"Readback","value":"sk-bf-readback","is_active":true,"provider_configs":[]}`
			body := `{"data":[{"id":"historical/model"}]}`
			s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
				if r.Method != http.MethodGet || r.URL.Host != "bifrost.local" {
					t.Fatal("unexpected native request", r.Method, r.URL)
				}
				switch r.URL.Path {
				case "/v1/models":
					if r.Header.Get("Authorization") != "Bearer sk-bf-readback" {
						t.Fatal("readback did not use the virtual key")
					}
					return nativeResponse(200, body), nil
				case "/api/governance/virtual-keys/vk-readback":
					return nativeResponse(200, `{"virtual_key":`+key+`}`), nil
				case "/api/governance/virtual-keys":
					return nativeResponse(200, `{"virtual_keys":[`+key+`]}`), nil
				case "/api/providers":
					return nativeResponse(200, `{"providers":[]}`), nil
				case "/api/version":
					return nativeResponse(200, `"2.2.6"`), nil
				default:
					t.Fatal("unexpected native route", r.URL)
					return nil, nil
				}
			})
			read := func() publication {
				t.Helper()
				res := perform(s, "POST", "/api/keys/vk-readback/readback", "", authorized())
				if res.Code != 200 {
					t.Fatal(res.Code, res.Body.String())
				}
				var ws workspace
				if err := json.Unmarshal(res.Body.Bytes(), &ws); err != nil {
					t.Fatal(err)
				}
				if len(ws.Data.Keys) != 1 {
					t.Fatal("missing readback key", res.Body.String())
				}
				return ws.Data.Keys[0].Publication
			}
			prior := read()
			if prior.State != "drift" || prior.ObservedAt == "" || prior.ObservedRevision == "" || !reflect.DeepEqual(prior.Actual, []string{"historical/model"}) {
				t.Fatalf("missing historical observation: %+v", prior)
			}
			body = tc.body
			got := read()
			if got.State != tc.state || got.CheckedAt == "" {
				t.Fatalf("unexpected readback result: %+v", got)
			}
			if tc.state == "not_verified" {
				if got.Error == "" || !reflect.DeepEqual(got.Actual, prior.Actual) || got.ObservedAt != prior.ObservedAt || got.ObservedRevision != prior.ObservedRevision || len(got.Missing)+len(got.Unexpected) != 0 {
					t.Fatalf("unusable response replaced historical evidence or created drift: %+v", got)
				}
			} else {
				if got.Error != "" || !reflect.DeepEqual(got.Actual, tc.actual) || got.ObservedAt != got.CheckedAt || got.ObservedRevision != got.Revision {
					t.Fatalf("valid response was not recorded as a current observation: %+v", got)
				}
				if tc.state == "drift" && (!reflect.DeepEqual(got.Missing, []string{"openai/alpha"}) || len(got.Unexpected) != 0) {
					t.Fatalf("empty observation did not report the missing model: %+v", got)
				}
			}
		})
	}
}
