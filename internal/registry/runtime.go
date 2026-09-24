package registry

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"mime"
	"net/http"
	"sort"
	"strings"
)

type Request struct {
	Method, Path string
	Headers      map[string]string
	Body         []byte
}
type Failure struct {
	Status        int
	Code, Message string
}

func (f *Failure) Error() string { return f.Message }
func (f *Failure) JSON() []byte {
	b, _ := json.Marshal(map[string]any{"error": map[string]any{"message": f.Message, "type": "registry_error", "code": f.Code}})
	return b
}
func fail(status int, code, msg string) *Failure { return &Failure{status, code, msg} }

type Session struct {
	snapshot *Snapshot
	view     *View
	endpoint string
	allowed  map[string]Route
}

func (s *Session) IsManaged() bool { return s.view != nil }
func (s *Session) PolicyID() string {
	if s.view == nil {
		return ""
	}
	return s.view.Policy.VirtualKeyID
}
func (s *Session) IsModels() bool   { return s.endpoint == "models" }
func (s *Session) Revision() string { return s.snapshot.Revision() }
func (s *Session) VerifyIdentity(authenticatedID string) *Failure {
	if authenticatedID == "" {
		return fail(403, "registry_identity_mismatch", "Bifrost did not confirm the virtual key identity")
	}
	if s.view == nil {
		if _, managed := s.snapshot.views[authenticatedID]; managed {
			return fail(403, "registry_binding_stale", "The native virtual key has a registry policy with a different credential")
		}
		return nil
	}
	if authenticatedID != s.PolicyID() {
		return fail(403, "registry_identity_mismatch", "Bifrost did not confirm the bound virtual key identity")
	}
	return nil
}

// CheckAttempt is run for EVERY provider attempt, after routing and before the provider.
// Never return a normal plugin error for rejection: Bifrost logs and ignores those.
func (s *Session) CheckAttempt(provider, model string) *Failure {
	if !s.IsManaged() || s.IsModels() {
		return nil
	}
	r, ok := s.allowed[provider+"/"+model]
	if !ok {
		// Routing rules may land the request on any model the policy exposes
		// (e.g. an alias whose rule leaves the primary target to the virtual
		// key's provider selection). Attempts must stay within the policy's
		// exposed routes — the same surface governance enforced pre-registry.
		if nr, exists := s.view.native[provider+"/"+model]; exists {
			r, ok = nr, true
		}
	}
	if !ok || !Has(r.Endpoints, s.endpoint) {
		return fail(403, "registry_route_denied", "The selected provider/model is outside this request's registry routes")
	}
	return nil
}

func header(headers map[string]string, name string) (string, error) {
	var result string
	found := false
	for k, v := range headers {
		if strings.EqualFold(k, name) {
			if found {
				return "", fmt.Errorf("duplicate header %s", name)
			}
			found = true
			result = v
		}
	}
	if !noControls(result) {
		return "", errors.New("invalid header characters")
	}
	return strings.TrimSpace(result), nil
}

// Credential only accepts Bifrost virtual keys. Raw upstream credentials are not accepted.
func Credential(headers map[string]string) (string, error) {
	vk, err := header(headers, "x-bf-vk")
	explicitNative := vk != ""
	if err != nil {
		return "", err
	}
	auth, err := header(headers, "authorization")
	if err != nil {
		return "", err
	}
	bearer := ""
	if auth != "" {
		parts := strings.Fields(auth)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
			return "", errors.New("expected Bearer virtual key")
		}
		bearer = parts[1]
	}
	values := []string{bearer}
	for _, name := range []string{"x-api-key", "x-goog-api-key", "api-key"} {
		value, err := header(headers, name)
		if err != nil {
			return "", err
		}
		if strings.HasPrefix(strings.ToLower(value), "sk-bf-") {
			values = append(values, value)
		}
	}
	for _, value := range values {
		if value == "" {
			continue
		}
		if vk != "" && vk != value {
			return "", errors.New("conflicting virtual key credentials")
		}
		vk = value
	}
	if vk == "" || (!explicitNative && (!strings.HasPrefix(vk, "sk-bf-") || len(vk) < 16)) || len(vk) > 512 || strings.ContainsAny(vk, " ,\t") {
		return "", errors.New("a Bifrost virtual key is required")
	}
	return vk, nil
}

// Endpoint supports only explicit OpenAI-compatible JSON inference routes.
// There is no wildcard passthrough, silent multipart conversion or websocket emulation.
func Endpoint(path string) (string, bool) {
	for _, prefix := range []string{"/openai/v1/", "/openai/", "/v1/"} {
		if strings.HasPrefix(path, prefix) {
			p := strings.TrimPrefix(path, prefix)
			if p == "models" || endpoints[p] {
				return p, true
			}
			return "", false
		}
	}
	return "", false
}
func (s *Snapshot) Prepare(req *Request) (*Session, *Failure) {
	token, err := Credential(req.Headers)
	if err != nil {
		return nil, fail(401, "registry_virtual_key_required", err.Error())
	}
	v := s.tokens[TokenHash(token)]
	endpoint, ok := Endpoint(req.Path)
	if v == nil {
		// Native candidates keep all gateway protocol paths, methods and payloads.
		// Governance must confirm that their ID has no Registry policy before use.
		return &Session{snapshot: s, endpoint: endpoint}, nil
	}
	if !v.Policy.Enabled {
		return nil, fail(403, "registry_policy_missing", "virtual key is not bound to an enabled registry policy")
	}
	if !ok {
		return nil, fail(400, "registry_unsupported_endpoint", "This endpoint is not covered by the registry guard")
	}
	expectedMethod := http.MethodPost
	if endpoint == "models" {
		expectedMethod = http.MethodGet
	}
	if req.Method != expectedMethod {
		return nil, fail(405, "registry_method_not_allowed", "Method not allowed")
	}
	for _, name := range []string{"x-bf-direct-key", "x-bf-api-key", "x-bf-api-key-id"} {
		value, e := header(req.Headers, name)
		if e != nil || value != "" {
			return nil, fail(403, "registry_key_override_denied", "Explicit provider key overrides are not accepted by the registry")
		}
	}
	session := &Session{snapshot: s, view: v, endpoint: endpoint, allowed: map[string]Route{}}
	if endpoint == "models" {
		return session, nil
	}
	if len(req.Body) > MaxBodyBytes {
		return nil, fail(413, "registry_body_too_large", "Registry JSON requests are limited to 32 MiB")
	}
	ctype, e := header(req.Headers, "content-type")
	if e != nil {
		return nil, fail(400, "registry_invalid_headers", e.Error())
	}
	media, _, e := mime.ParseMediaType(ctype)
	if e != nil || media != "application/json" {
		return nil, fail(415, "registry_json_required", "This registry version accepts application/json only")
	}
	var body map[string]json.RawMessage
	if err := StrictJSON(req.Body, &body, false); err != nil || body == nil {
		return nil, fail(400, "registry_invalid_json", "Invalid JSON object or duplicate object keys")
	}
	var name string
	if json.Unmarshal(body["model"], &name) != nil || name == "" {
		return nil, fail(400, "registry_model_required", "A nonempty string model is required")
	}
	resolve := func(name string) (Route, *Failure) {
		r, ok := v.index[name]
		if !ok {
			return Route{}, fail(403, "registry_model_hidden", "Model is not exposed by this virtual key")
		}
		if !Has(r.Endpoints, endpoint) {
			return Route{}, fail(400, "registry_endpoint_unverified", "This endpoint has not been enabled for the selected model")
		}
		session.allowed[r.NativeID()] = r
		for _, t := range r.RoutingTargets {
			session.allowed[t] = r
		}
		return r, nil
	}
	route, f := resolve(name)
	if f != nil {
		return nil, f
	}
	if !route.Passthrough {
		body["model"], _ = json.Marshal(route.NativeID())
	}
	// Reject alternate raw routing fields rather than silently overriding them.
	for _, field := range []string{"provider", "api_key", "base_url"} {
		if _, exists := body[field]; exists {
			return nil, fail(400, "registry_routing_override_denied", "Provider and connection overrides are not allowed in inference bodies")
		}
	}
	if raw, exists := body["fallbacks"]; exists {
		var values []string
		if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) || json.Unmarshal(raw, &values) != nil {
			return nil, fail(400, "registry_invalid_fallbacks", "fallbacks must be an array of exposed model identifiers")
		}
		if len(values) > 16 {
			return nil, fail(400, "registry_invalid_fallbacks", "At most 16 explicit fallbacks are allowed")
		}
		result := []string{}
		seen := map[string]bool{}
		for _, name := range values {
			r, f := resolve(name)
			if f != nil {
				return nil, f
			}
			outID := r.NativeID()
			if r.Passthrough {
				// Routing aliases keep their bare name so Bifrost routing rules
				// evaluate them; native rewrite would bypass the CEL match.
				outID = name
			}
			if !seen[outID] {
				result = append(result, outID)
				seen[outID] = true
			}
		}
		body["fallbacks"], _ = json.Marshal(result)
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return nil, fail(400, "registry_invalid_json", "Could not serialize the request")
	}
	// All other raw JSON values are preserved: reasoning, tools, cache keys, previous_response_id, etc.
	req.Body = encoded
	return session, nil
}

// Project intersects a successful, governance-filtered native /v1/models response
// with the registry. It never advertises an alias missing from Bifrost's response.
// Rich metadata stays in the registry UI; this endpoint keeps the OpenAI envelope.
func (s *Session) Project(body []byte, authenticatedID string) ([]byte, *Failure) {
	if f := s.VerifyIdentity(authenticatedID); f != nil {
		return nil, f
	}
	if !s.IsManaged() {
		return nil, fail(500, "registry_unmanaged_projection", "Unmanaged responses are handled by Bifrost")
	}
	if len(body) > MaxBodyBytes {
		return nil, fail(502, "registry_models_too_large", "Native model listing exceeds the registry limit")
	}
	var envelope map[string]json.RawMessage
	if err := StrictJSON(body, &envelope, false); err != nil {
		return nil, fail(502, "registry_invalid_models", "Invalid native model response")
	}
	var entries []map[string]json.RawMessage
	raw, exists := envelope["data"]
	if !exists || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) || json.Unmarshal(raw, &entries) != nil {
		return nil, fail(502, "registry_invalid_models", "Native response must contain a data array")
	}
	native := map[string]map[string]json.RawMessage{}
	for _, m := range entries {
		var id string
		if json.Unmarshal(m["id"], &id) != nil || id == "" {
			return nil, fail(502, "registry_invalid_models", "Native model identifier missing")
		}
		if _, found := native[id]; found {
			return nil, fail(502, "registry_duplicate_native_model", "Duplicate native model identifier")
		}
		native[id] = m
	}
	out := []map[string]any{}
	for _, r := range s.view.Routes {
		m, ok := native[r.NativeID()]
		if !ok {
			continue
		}
		var created int64
		var owner string
		if raw, ok := m["created"]; ok && json.Unmarshal(raw, &created) != nil {
			return nil, fail(502, "registry_invalid_models", "Invalid native model timestamp")
		}
		_ = json.Unmarshal(m["owned_by"], &owner)
		if owner == "" {
			owner = r.Provider
		}
		item := map[string]any{"id": r.ExposedID, "object": "model", "created": created, "owned_by": owner}
		if raw, ok := m["shutdown_date"]; ok {
			if !bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
				var date string
				if json.Unmarshal(raw, &date) != nil || len(date) > 128 || !noControls(date) {
					return nil, fail(502, "registry_invalid_models", "Invalid native shutdown_date")
				}
			}
			item["shutdown_date"] = raw
		}
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool { return out[i]["id"].(string) < out[j]["id"].(string) })
	encoded, err := json.Marshal(map[string]any{"object": "list", "data": out})
	if err != nil {
		return nil, fail(500, "registry_projection_error", "Model projection failed")
	}
	return encoded, nil
}
