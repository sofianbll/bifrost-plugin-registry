package admin

import (
	"encoding/json"
	"net/http"
	"reflect"
	"testing"
)

func TestWorkspacePricingProofAccessIdentity(t *testing.T) {
	for _, tc := range []struct {
		name   string
		proofs map[string]publication
		want   []pricingProofDTO
	}{
		{
			name: "complete native model names",
			proofs: map[string]publication{
				"registry/CLI PROXY/key/model":                  {State: "verified", CheckedAt: "2026-10-15T12:00:00Z"},
				"registry/CLI PROXY/key/vendor/model":           {State: "not_verified", Error: "readback mismatch"},
				"registry/CLI PROXY/key/vendor/family/model/v1": {State: "verified"},
			},
			want: []pricingProofDTO{
				{Access: "CLI PROXY/model", State: "verified", CheckedAt: "2026-10-15T12:00:00Z"},
				{Access: "CLI PROXY/vendor/family/model/v1", State: "verified"},
				{Access: "CLI PROXY/vendor/model", State: "not_verified", Error: "readback mismatch"},
			},
		},
		{
			name: "malformed names cannot claim an access",
			proofs: map[string]publication{
				"registry/CLI PROXY/key":       {State: "verified"},
				"registry/CLI PROXY":           {State: "verified"},
				"other/CLI PROXY/key/model":    {State: "verified"},
				"vk-native":                    {State: "verified"},
				"registry/CLI PROXY/key/model": {State: "not_verified", Error: "readback mismatch"},
			},
			want: []pricingProofDTO{{Access: "CLI PROXY/model", State: "not_verified", Error: "readback mismatch"}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := setup(t)
			if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
				t.Fatal(err)
			}
			s.live.proofs = tc.proofs
			s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
				switch r.URL.Path {
				case "/api/providers":
					return nativeResponse(200, `{"providers":[]}`), nil
				case "/api/governance/virtual-keys":
					return nativeResponse(200, `{"virtual_keys":[]}`), nil
				case "/api/version":
					return nativeResponse(200, `"2.2.6"`), nil
				default:
					t.Fatalf("unexpected native request: %s", r.URL)
					return nil, nil
				}
			})
			res := perform(s, "GET", "/api/workspace", "", authorized())
			if res.Code != http.StatusOK {
				t.Fatalf("workspace GET: %d %s", res.Code, res.Body.String())
			}
			var ws workspace
			if err := json.Unmarshal(res.Body.Bytes(), &ws); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(ws.PricingProofs, tc.want) {
				t.Fatalf("pricing proofs: got %+v, want %+v", ws.PricingProofs, tc.want)
			}
		})
	}
}
