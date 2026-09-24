package admin

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestKeySecretOnDemand(t *testing.T) {
	s := setup(t)
	if err := s.ConnectBifrost("http://bifrost.local", "Bearer native-admin"); err != nil {
		t.Fatal(err)
	}
	const secret = "sk-bf-synthetic-secret"
	upstreamStatus := 200
	value := secret
	reads := 0
	s.live.client.http.Transport = nativeRoundTrip(func(r *http.Request) (*http.Response, error) {
		reads++
		if r.URL.Host != "bifrost.local" || r.URL.EscapedPath() != "/api/governance/virtual-keys/vk-native" || r.Method != http.MethodGet || r.Header.Get("Authorization") != "Bearer native-admin" {
			t.Fatal("unexpected native request")
		}
		if upstreamStatus != 200 {
			return nativeResponse(upstreamStatus, `{"error":"sk-bf-synthetic-secret"}`), nil
		}
		body, _ := json.Marshal(map[string]any{"virtual_key": map[string]string{"id": "vk-native", "value": value}})
		return nativeResponse(200, string(body)), nil
	})
	path := "/api/keys/vk-native/secret"
	if got := perform(s, "POST", path, "", nil); got.Code != 401 || reads != 0 {
		t.Fatal("unauthenticated secret request reached native API")
	}
	if got := perform(s, "POST", path, "", map[string]string{"Authorization": "Bearer wrong"}); got.Code != 401 || reads != 0 {
		t.Fatal("invalid admin token reached native API")
	}
	if got := perform(s, "GET", path, "", authorized()); got.Code != 404 || reads != 0 {
		t.Fatal("secret request accepted the wrong method")
	}
	got := perform(s, "POST", path, "", authorized())
	if got.Code != 200 || got.Header().Get("Cache-Control") != "no-store" || reads != 1 {
		t.Fatal("authorized on-demand read failed", got.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(got.Body.Bytes(), &body); err != nil || body["secret"] != secret || len(body) != 1 {
		t.Fatal("secret response shape incorrect")
	}
	for _, endpoint := range []string{"/api/config", "/api/snapshot"} {
		other := perform(s, "GET", endpoint, "", authorized())
		if strings.Contains(other.Body.String(), secret) {
			t.Fatal("secret leaked into", endpoint)
		}
	}
	value = "sk-bf-second-synthetic-secret"
	if next := perform(s, "POST", path, "", authorized()); next.Code != 200 || !strings.Contains(next.Body.String(), value) || reads != 2 {
		t.Fatal("secret was cached")
	}
	for _, masked := range []string{"", "sk-bf-****secret", "••••", "<REDACTED>"} {
		value = masked
		invalid := perform(s, "POST", path, "", authorized())
		if invalid.Code != 409 || strings.Contains(invalid.Body.String(), masked) && masked != "" {
			t.Fatal("unavailable secret was exposed", invalid.Code)
		}
	}
	for _, status := range []int{401, 403, 404, 500} {
		upstreamStatus = status
		failed := perform(s, "POST", path, "", authorized())
		want := 502
		if status == 401 || status == 403 {
			want = 403
		}
		if status == 404 {
			want = 404
		}
		if failed.Code != want || strings.Contains(failed.Body.String(), secret) {
			t.Fatal("native failure leaked or lost status", status, failed.Code)
		}
	}
}
