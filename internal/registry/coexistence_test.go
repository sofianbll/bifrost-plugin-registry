package registry

import (
	"bytes"
	"slices"
	"testing"
)

func TestConfiguredNativeAccessCanRouteWithoutInferredVerification(t *testing.T) {
	c := fixture()
	c.Models[0].Verified = false
	if slices.Contains(names(t, mustCompile(t, c)), "alpha/smart") {
		t.Fatal("unconfigured unverified row became a route")
	}
	c.Models[0].Configured = true
	s := mustCompile(t, c)
	if !slices.Contains(names(t, s), "alpha/smart") {
		t.Fatal("configured native access was excluded")
	}
	for _, key := range s.Plan().ProviderKeys {
		if key.Provider == "alpha" && key.KeyID == "key-a" {
			if _, ok := key.Aliases["smart"]; !ok {
				t.Fatal("configured access missing from native alias plan")
			}
			return
		}
	}
	t.Fatal("configured access missing from native plan")
}

func TestAdoptedPolicyNeverExceedsNativeModelCeiling(t *testing.T) {
	c := fixture()
	c.Policies[0].Adopted = true
	c.Policies[0].NativeModelIDs = []string{"a"}
	s := mustCompile(t, c)
	if got := names(t, s); len(got) != 1 || got[0] != "alpha/smart" {
		t.Fatalf("adopted policy exceeded native ceiling: %v", got)
	}
	c.Policies[0].NativeModelIDs = []string{"missing"}
	if _, err := Compile(c); err == nil {
		t.Fatal("unknown native ceiling model accepted")
	}
}

func TestNativeKeyCandidateNeedsGovernanceIdentity(t *testing.T) {
	s := mustCompile(t, fixture())
	original := []byte(` { "model": "native/only", "native_extension": { "x": 1 } } `)
	r := &Request{Method: "POST", Path: "/v1/chat/completions", Headers: map[string]string{
		"Authorization": "Bearer sk-bf-native-valid-0123456789",
		"Content-Type":  "application/json",
	}, Body: bytes.Clone(original)}
	session, f := s.Prepare(r)
	if f != nil || session == nil || session.IsManaged() {
		t.Fatalf("unknown hash must be a candidate, got session=%#v failure=%#v", session, f)
	}
	if !bytes.Equal(r.Body, original) || session.CheckAttempt("native", "only") != nil {
		t.Fatal("candidate request or native routing was changed")
	}
	if session.VerifyIdentity("") == nil || session.VerifyIdentity("vk-1") == nil {
		t.Fatal("missing identity or stale managed binding accepted")
	}
	if session.VerifyIdentity("vk-native") != nil {
		t.Fatal("authenticated native key without a policy was denied")
	}
}

func TestDisabledAndRotatedManagedKeysStayDenied(t *testing.T) {
	c := fixture()
	c.Policies[0].Enabled = false
	disabled := mustCompile(t, c)
	r := req(`{"model":"alpha/smart"}`)
	if _, f := disabled.Prepare(r); f == nil || f.Status != 403 {
		t.Fatalf("disabled policy accepted: %#v", f)
	}
	r.Headers["Authorization"] = "Bearer sk-bf-rotated-0123456789"
	candidate, f := disabled.Prepare(r)
	if f != nil || candidate == nil || candidate.IsManaged() || candidate.VerifyIdentity("vk-1") == nil {
		t.Fatalf("rotated disabled key bypassed policy: session=%#v failure=%#v", candidate, f)
	}
	c.Policies[0].Enabled = true
	active := mustCompile(t, c)
	candidate, f = active.Prepare(r)
	if f != nil || candidate.VerifyIdentity("vk-1") == nil {
		t.Fatalf("rotated active key bypassed policy: session=%#v failure=%#v", candidate, f)
	}
}

func TestNativeCandidatePreservesOtherGatewayProtocols(t *testing.T) {
	s := mustCompile(t, fixture())
	for _, path := range []string{"/anthropic/v1/messages", "/genai/v1beta/models/gemini:generateContent"} {
		original := []byte(`{"native_field":"unchanged"}`)
		r := &Request{Method: "POST", Path: path, Headers: map[string]string{"x-bf-vk": "native-custom-format"}, Body: bytes.Clone(original)}
		candidate, f := s.Prepare(r)
		if f != nil || candidate == nil || candidate.IsManaged() || !bytes.Equal(r.Body, original) {
			t.Fatalf("native request changed or rejected: %s %#v", path, f)
		}
		if candidate.VerifyIdentity("") == nil || candidate.VerifyIdentity("vk-1") == nil || candidate.VerifyIdentity("native-valid") != nil {
			t.Fatal("native candidate skipped binding enforcement")
		}
		r.Headers = map[string]string{"Authorization": "Bearer " + testToken}
		if _, f = s.Prepare(r); f == nil || f.Code != "registry_unsupported_endpoint" {
			t.Fatal("managed key used unsupported protocol")
		}
	}
}
