package admin

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"bifrost-registry/internal/registry"
)

type liveClient struct {
	base          *url.URL
	authorization string
	http          *http.Client
}
type liveState struct {
	sync.Mutex
	client *liveClient
	proofs map[string]publication
}
type accessDTO struct {
	Provider    string `json:"provider"`
	ID          string `json:"id"`
	Route       string `json:"route"`
	Status      string `json:"status"`
	NativeModel string `json:"nativeModel,omitempty"`
}
type modelDTO struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Creator          string            `json:"creator"`
	Family           string            `json:"family"`
	InputModalities  []string          `json:"inputModalities"`
	OutputModalities []string          `json:"outputModalities"`
	Tasks            []string          `json:"tasks"`
	Kind             string            `json:"kind"`
	Summary          string            `json:"summary"`
	Context          string            `json:"context"`
	Capabilities     map[string]string `json:"capabilities"`
	Accesses         []accessDTO       `json:"accesses"`
}
type groupDTO struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Members     []string `json:"members"`
}
type policyDTO struct {
	Groups   []string `json:"groups"`
	Added    []string `json:"added"`
	Excluded []string `json:"excluded"`
	Naming   string   `json:"naming"`
}
type publication struct {
	State            string   `json:"state"`
	Revision         string   `json:"revision"`
	CheckedAt        string   `json:"checkedAt"`
	ObservedAt       string   `json:"observedAt,omitempty"`
	ObservedRevision string   `json:"observedRevision,omitempty"`
	Expected         []string `json:"expected"`
	Actual           []string `json:"actual"`
	Missing          []string `json:"missing"`
	Unexpected       []string `json:"unexpected"`
	Error            string   `json:"error,omitempty"`
}
type keyDTO struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Client      string      `json:"client"`
	Active      bool        `json:"active"`
	Managed     bool        `json:"managed"`
	Policy      policyDTO   `json:"policy"`
	Publication publication `json:"publication"`
	Observed    []string    `json:"observed"`
	ReadError   bool        `json:"readError"`
	Revision    int         `json:"revision"`
}
type demoDTO struct {
	Models    []modelDTO `json:"models"`
	Groups    []groupDTO `json:"groups"`
	Keys      []keyDTO   `json:"keys"`
	Campaigns []any      `json:"campaigns"`
}
type workspace struct {
	Revision   string     `json:"revision"`
	Data       demoDTO    `json:"data"`
	Discovery  []modelDTO `json:"discovery"`
	Connection struct {
		Connected bool   `json:"connected"`
		Version   string `json:"version"`
	} `json:"connection"`
}
type nativeModel struct {
	Name             string   `json:"name"`
	Provider         string   `json:"provider"`
	AccessibleByKeys []string `json:"accessible_by_keys"`
}
type nativeVK struct {
	ID              string                 `json:"id"`
	Name            string                 `json:"name"`
	Description     string                 `json:"description"`
	Value           string                 `json:"value"`
	IsActive        *bool                  `json:"is_active"`
	ProviderConfigs []nativeProviderConfig `json:"provider_configs"`
}
type nativeProviderConfig struct {
	ID                uint     `json:"id"`
	Provider          string   `json:"provider"`
	Weight            *float64 `json:"weight"`
	AllowedModels     []string `json:"allowed_models"`
	BlacklistedModels []string `json:"blacklisted_models"`
	AllowAllKeys      bool     `json:"allow_all_keys"`
	Keys              []struct {
		KeyID string `json:"key_id"`
	} `json:"keys"`
}

func (p nativeProviderConfig) keyIDs() []string {
	if p.AllowAllKeys {
		return []string{"*"}
	}
	ids := []string{}
	for _, key := range p.Keys {
		if key.KeyID != "" {
			ids = append(ids, key.KeyID)
		}
	}
	return ids
}

// ConnectBifrost pins all native calls to one operator-supplied origin. No redirects or URL credentials.
func (s *Server) ConnectBifrost(baseURL, authorization string) error {
	u, err := url.Parse(baseURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
		return errors.New("invalid Bifrost connection")
	}
	s.live.Lock()
	defer s.live.Unlock()
	s.live.client = &liveClient{base: u, authorization: authorization, http: &http.Client{Timeout: 12 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	s.live.proofs = map[string]publication{}
	return nil
}

// ConnectNative uses Bifrost's authenticated in-process API dispatcher.
func (s *Server) ConnectNative(transport http.RoundTripper) {
	s.live.Lock()
	defer s.live.Unlock()
	u, _ := url.Parse("http://bifrost.internal")
	s.live.client = &liveClient{base: u, http: &http.Client{Timeout: 12 * time.Second, Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
	s.live.proofs = map[string]publication{}
}
func (c *liveClient) call(ctx context.Context, method, path string, body any, out any) error {
	var rd io.Reader
	if body != nil {
		b, e := json.Marshal(body)
		if e != nil {
			return e
		}
		rd = bytes.NewReader(b)
	}
	u := *c.base
	u.Path, _ = url.PathUnescape(path)
	u.RawPath = path
	req, e := http.NewRequestWithContext(ctx, method, u.String(), rd)
	if e != nil {
		return e
	}
	if c.authorization != "" {
		req.Header.Set("Authorization", c.authorization)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, e := c.http.Do(req)
	if e != nil {
		return errors.New("Bifrost request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Bifrost returned HTTP %d", resp.StatusCode)
	}
	limited := io.LimitReader(resp.Body, 8<<20)
	b, e := io.ReadAll(limited)
	if e != nil {
		return errors.New("Bifrost response failed")
	}
	if len(b) == 8<<20 {
		return errors.New("Bifrost response too large")
	}
	if out != nil && json.Unmarshal(b, out) != nil {
		return errors.New("invalid Bifrost response")
	}
	return nil
}
func (s *Server) liveHandler(w http.ResponseWriter, r *http.Request) {
	s.live.Lock()
	defer s.live.Unlock()
	c := s.live.client
	if c == nil {
		reply(w, 503, map[string]string{"error": "Bifrost connection is not configured"})
		return
	}
	switch {
	case r.URL.Path == "/api/workspace" && r.Method == http.MethodGet:
		ws, e := s.workspace(r.Context())
		if e != nil {
			liveError(w, e, "read")
			return
		}
		w.Header().Set("ETag", `"`+ws.Revision+`"`)
		reply(w, 200, ws)
	case r.URL.Path == "/api/workspace" && r.Method == http.MethodPut:
		s.putWorkspace(w, r)
	case r.URL.Path == "/api/keys" && r.Method == http.MethodPost:
		s.createKey(w, r)
	case strings.HasPrefix(r.URL.Path, "/api/keys/") && strings.HasSuffix(r.URL.Path, "/readback") && r.Method == http.MethodPost:
		id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/keys/"), "/readback")
		if id == "" || strings.Contains(id, "/") {
			http.NotFound(w, r)
			return
		}
		s.readback(w, r, id)
	default:
		http.NotFound(w, r)
	}
}
func liveError(w http.ResponseWriter, e error, phase string) {
	reply(w, 502, map[string]string{"error": e.Error(), "phase": phase})
}
func (s *Server) nativeKeys(ctx context.Context) ([]nativeVK, error) {
	var v struct {
		VirtualKeys []nativeVK `json:"virtual_keys"`
		Total       int        `json:"total_count"`
	}
	// The unpaginated endpoint returns all VKs in Bifrost 2.2.2.
	if e := s.live.client.call(ctx, "GET", "/api/governance/virtual-keys", nil, &v); e != nil {
		return nil, e
	}
	return v.VirtualKeys, nil
}
func (s *Server) nativeModels(ctx context.Context) ([]nativeModel, error) {
	out := []nativeModel{}
	var providers struct {
		Providers []struct {
			Name string `json:"name"`
		} `json:"providers"`
	}
	if e := s.live.client.call(ctx, "GET", "/api/providers", nil, &providers); e != nil {
		return nil, e
	}
	for _, provider := range providers.Providers {
		if provider.Name == "" {
			continue
		}
		var keys struct {
			Keys []struct {
				ID      string `json:"id"`
				Enabled *bool  `json:"enabled"`
			} `json:"keys"`
		}
		if e := s.live.client.call(ctx, "GET", "/api/providers/"+url.PathEscape(provider.Name)+"/keys", nil, &keys); e != nil {
			return nil, e
		}
		ids := []string{}
		for _, key := range keys.Keys {
			if key.ID != "" && (key.Enabled == nil || *key.Enabled) {
				ids = append(ids, key.ID)
			}
		}
		if len(ids) == 0 {
			continue
		}
		for offset := 0; offset < 10000; offset += 100 {
			var page struct {
				Models []nativeModel `json:"models"`
				Total  int           `json:"total"`
			}
			query := url.Values{"provider": {provider.Name}, "keys": {strings.Join(ids, ",")}, "limit": {"100"}, "offset": {fmt.Sprint(offset)}}
			if e := s.live.client.callQuery(ctx, "/api/models", query, &page); e != nil {
				return nil, e
			}
			out = append(out, page.Models...)
			if offset+len(page.Models) >= page.Total || len(page.Models) == 0 {
				break
			}
		}
	}
	return out, nil
}
func (c *liveClient) callQuery(ctx context.Context, path string, query url.Values, out any) error {
	u := *c.base
	u.Path = path
	u.RawQuery = query.Encode()
	req, e := http.NewRequestWithContext(ctx, "GET", u.String(), nil)
	if e != nil {
		return e
	}
	if c.authorization != "" {
		req.Header.Set("Authorization", c.authorization)
	}
	resp, e := c.http.Do(req)
	if e != nil {
		return errors.New("Bifrost request failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return fmt.Errorf("Bifrost returned HTTP %d", resp.StatusCode)
	}
	return json.NewDecoder(io.LimitReader(resp.Body, 8<<20)).Decode(out)
}
func modelID(name string) string {
	b := strings.Builder{}
	for _, r := range strings.ToLower(name) {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '.' || r == '_' || r == '-' {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	id := strings.Trim(b.String(), "-._")
	if id == "" {
		id = "model"
	}
	if len(id) > 110 {
		id = id[:110]
	}
	return id
}
func registryID(provider, name string) string {
	h := sha256.Sum256([]byte(provider + "\x00" + name))
	return "access-" + hex.EncodeToString(h[:8])
}
func nativeToDiscovery(rows []nativeModel) []modelDTO {
	models := []modelDTO{}
	byName := map[string]int{}
	used := map[string]string{}
	for _, row := range rows {
		if row.Provider == "" || row.Name == "" {
			continue
		}
		id := modelID(row.Name)
		if prev := used[id]; prev != "" && prev != row.Name {
			sum := sha256.Sum256([]byte(row.Name))
			id += "-" + hex.EncodeToString(sum[:4])
		}
		used[id] = row.Name
		i, ok := byName[row.Name]
		if !ok {
			i = len(models)
			byName[row.Name] = i
			models = append(models, modelDTO{ID: id, Name: row.Name, Creator: "Unknown", Family: "Unknown", InputModalities: []string{}, OutputModalities: []string{}, Tasks: []string{}, Kind: "Unknown", Summary: "", Context: "Unknown", Capabilities: map[string]string{}, Accesses: []accessDTO{}})
		}
		a := accessDTO{Provider: row.Provider, ID: row.Provider + "/" + id, Route: "Direct provider", Status: "Configured", NativeModel: row.Name}
		models[i].Accesses = append(models[i].Accesses, a)
	}
	sort.Slice(models, func(i, j int) bool { return models[i].ID < models[j].ID })
	return models
}
func (s *Server) workspace(ctx context.Context) (workspace, error) {
	snap := s.Store.Load()
	config := snap.Config()
	rows, e := s.nativeModels(ctx)
	if e != nil {
		return workspace{}, e
	}
	vks, e := s.nativeKeys(ctx)
	if e != nil {
		return workspace{}, e
	}
	discovered := nativeToDiscovery(rows)
	dto := demoDTO{Models: []modelDTO{}, Groups: []groupDTO{}, Keys: []keyDTO{}, Campaigns: []any{}}
	index := map[string]int{}
	for _, m := range config.Models {
		var ui modelDTO
		if raw := m.Metadata["ui"]; len(raw) > 0 {
			_ = json.Unmarshal(raw, &ui)
		}
		ui = sanitizeLiveModel(ui)
		if ui.ID == "" {
			ui = modelDTO{ID: m.Alias, Name: m.Alias, Creator: m.Creator, Family: m.Family, Context: "Unknown", Kind: "Chat"}
		}
		a := accessDTO{Provider: m.Provider, ID: m.Provider + "/" + m.Alias, NativeModel: m.UpstreamModel, Route: "Direct provider", Status: "Configured"}
		if i, ok := index[ui.ID]; ok {
			dto.Models[i].Accesses = append(dto.Models[i].Accesses, a)
		} else {
			ui.Accesses = []accessDTO{a}
			index[ui.ID] = len(dto.Models)
			dto.Models = append(dto.Models, ui)
		}
	}
	refs := map[string]string{}
	for _, m := range config.Models {
		refs[m.ID] = m.Alias
	}
	for _, g := range config.Groups {
		members := []string{}
		seen := map[string]bool{}
		for _, id := range g.ModelIDs {
			v := refs[id]
			if v != "" && !seen[v] {
				members = append(members, v)
				seen[v] = true
			}
		}
		dto.Groups = append(dto.Groups, groupDTO{g.ID, g.Name, g.Description, members})
	}
	policies := map[string]registry.Policy{}
	for _, p := range config.Policies {
		policies[p.VirtualKeyID] = p
	}
	for _, vk := range vks {
		p, managed := policies[vk.ID]
		active := vk.IsActive == nil || *vk.IsActive
		key := keyDTO{ID: vk.ID, Name: vk.Name, Client: vk.Description, Active: active, Managed: managed, Policy: policyDTO{Groups: []string{}, Added: []string{}, Excluded: []string{}, Naming: config.DefaultNaming}, Publication: publication{State: "not_verified", Revision: snap.Revision(), Expected: []string{}, Missing: []string{}, Unexpected: []string{}}, Revision: 1}
		if managed {
			key.Policy = policyDTO{p.Groups, refsToAliases(p.Added, refs), refsToAliases(p.Excluded, refs), p.Naming}
			if key.Policy.Naming == "" {
				key.Policy.Naming = config.DefaultNaming
			}
			if proof, ok := s.live.proofs[vk.ID]; ok {
				if proof.Revision != snap.Revision() {
					proof.State = "not_verified"
					proof.Revision = snap.Revision()
					proof.CheckedAt = ""
					proof.Expected = []string{}
					if view, ok := snap.View(vk.ID); ok {
						for _, route := range view.Routes {
							proof.Expected = append(proof.Expected, route.ExposedID)
						}
					}
					sort.Strings(proof.Expected)
					proof.Missing = []string{}
					proof.Unexpected = []string{}
					proof.Error = "Registry configuration changed; readback required"
				}
				key.Publication = proof
				key.Observed = proof.Actual
				key.ReadError = proof.State == "not_verified"
			}
		}
		dto.Keys = append(dto.Keys, key)
	}
	sort.Slice(dto.Keys, func(i, j int) bool { return dto.Keys[i].Name < dto.Keys[j].Name })
	ws := workspace{Revision: snap.Revision(), Data: dto, Discovery: discovered}
	ws.Connection.Connected = true
	ws.Connection.Version = "2.2.2"
	return ws, nil
}
func refsToAliases(ids []string, refs map[string]string) []string {
	out := []string{}
	seen := map[string]bool{}
	for _, id := range ids {
		if v := refs[id]; v != "" && !seen[v] {
			out = append(out, v)
			seen[v] = true
		}
	}
	return out
}
func (s *Server) putWorkspace(w http.ResponseWriter, r *http.Request) {
	expected := strings.Trim(r.Header.Get("If-Match"), `"`)
	if expected == "" {
		reply(w, 428, map[string]string{"error": "If-Match is required"})
		return
	}
	if s.Store.Load().Revision() != expected {
		reply(w, 409, map[string]string{"error": "Registry revision changed"})
		return
	}
	b, e := readJSON(w, r)
	if e != nil {
		return
	}
	var input struct {
		Data demoDTO `json:"data"`
	}
	if e = registry.StrictJSON(b, &input, true); e != nil {
		reply(w, 400, map[string]string{"error": "Invalid workspace JSON"})
		return
	}
	nativeRows, e := s.nativeModels(r.Context())
	if e != nil {
		liveError(w, e, "discovery")
		return
	}
	nativeVKs, e := s.nativeKeys(r.Context())
	if e != nil {
		liveError(w, e, "keys")
		return
	}
	nativeByID := map[string]nativeVK{}
	for _, v := range nativeVKs {
		nativeByID[v.ID] = v
	}
	old := s.Store.Load().Config()
	oldPolicy := map[string]registry.Policy{}
	for _, p := range old.Policies {
		oldPolicy[p.VirtualKeyID] = p
	}
	cfg := registry.Config{SchemaVersion: 1, DefaultNaming: old.DefaultNaming, Models: []registry.Model{}, Groups: []registry.Group{}, Policies: []registry.Policy{}}
	nativeAccess := map[string]nativeModel{}
	for _, n := range nativeRows {
		nativeAccess[n.Provider+"/"+n.Name] = n
	}
	byLogical := map[string][]string{}
	seenRegistry := map[string]bool{}
	seenLogical := map[string]bool{}
	for _, m := range input.Data.Models {
		if m.ID == "" || seenLogical[m.ID] || len(m.Accesses) == 0 {
			reply(w, 422, map[string]string{"error": "Models require unique IDs and accesses"})
			return
		}
		seenLogical[m.ID] = true
		for _, a := range m.Accesses {
			raw := a.NativeModel
			if raw == "" {
				raw = strings.TrimPrefix(a.ID, a.Provider+"/")
			}
			native, ok := nativeAccess[a.Provider+"/"+raw]
			if !ok || a.ID != a.Provider+"/"+m.ID || len(native.AccessibleByKeys) == 0 {
				reply(w, 422, map[string]string{"error": "Model access is not present in native discovery"})
				return
			}
			id := registryID(a.Provider, raw)
			if seenRegistry[id] {
				reply(w, 422, map[string]string{"error": "Duplicate model access"})
				return
			}
			seenRegistry[id] = true
			metadata, _ := json.Marshal(sanitizeLiveModel(m))
			endpoints := selectedEndpoints(m.Kind)
			if len(endpoints) == 0 {
				reply(w, 422, map[string]string{"error": "Select model tasks and modalities before publishing"})
				return
			}
			cfg.Models = append(cfg.Models, registry.Model{ID: id, Alias: m.ID, Provider: a.Provider, ProviderKeyIDs: native.AccessibleByKeys, UpstreamModel: raw, Creator: cleanUnknown(m.Creator), Family: cleanUnknown(m.Family), Endpoints: endpoints, Enabled: true, Verified: true, Evidence: "Bifrost native model catalog", Metadata: map[string]json.RawMessage{"ui": metadata}})
			byLogical[m.ID] = append(byLogical[m.ID], id)
		}
	}
	for _, g := range input.Data.Groups {
		members := []string{}
		for _, logical := range g.Members {
			ids, ok := byLogical[logical]
			if !ok {
				reply(w, 422, map[string]string{"error": "Group references an unknown model"})
				return
			}
			members = append(members, ids...)
		}
		cfg.Groups = append(cfg.Groups, registry.Group{ID: g.ID, Name: g.Name, Description: g.Description, ModelIDs: members})
	}
	present := map[string]bool{}
	for _, k := range input.Data.Keys {
		_, exists := nativeByID[k.ID]
		if !exists || present[k.ID] {
			reply(w, 422, map[string]string{"error": "Unknown or duplicate native key"})
			return
		}
		present[k.ID] = true
		oldp, managed := oldPolicy[k.ID]
		if !managed {
			if k.Managed {
				reply(w, 422, map[string]string{"error": "Unmanaged key cannot be adopted implicitly"})
				return
			}
			continue
		}
		if !k.Managed {
			reply(w, 422, map[string]string{"error": "Managed key cannot be removed through workspace"})
			return
		}
		added, e := logicalRefs(k.Policy.Added, byLogical)
		if e != nil {
			reply(w, 422, map[string]string{"error": e.Error()})
			return
		}
		excluded, e := logicalRefs(k.Policy.Excluded, byLogical)
		if e != nil {
			reply(w, 422, map[string]string{"error": e.Error()})
			return
		}
		oldp.Name = k.Name
		oldp.Enabled = k.Active
		oldp.Groups = k.Policy.Groups
		oldp.Added = added
		oldp.Excluded = excluded
		oldp.Naming = k.Policy.Naming
		cfg.Policies = append(cfg.Policies, oldp)
	}
	for id := range oldPolicy {
		if !present[id] {
			reply(w, 422, map[string]string{"error": "Managed key is missing from workspace"})
			return
		}
	}
	snap, e := registry.Compile(cfg)
	if e != nil {
		reply(w, 422, map[string]string{"error": e.Error()})
		return
	}
	saved, e := s.Store.Save(snap.JSON(), expected)
	if e != nil {
		status := 500
		if errors.Is(e, registry.ErrConflict) {
			status = 409
		}
		reply(w, status, map[string]string{"error": e.Error()})
		return
	}
	plan := saved.Plan()
	// Saving a revision invalidates every old publication before any native call.
	// Keep the last observed IDs separately for a later failed readback.
	for _, pp := range plan.VirtualKeys {
		prior := s.live.proofs[pp.VirtualKeyID]
		p := publication{State: "not_verified", Revision: saved.Revision(), Expected: []string{}, Actual: prior.Actual, Missing: []string{}, Unexpected: []string{}, ObservedAt: prior.ObservedAt, ObservedRevision: prior.ObservedRevision, Error: "Readback required"}
		if view, ok := saved.View(pp.VirtualKeyID); ok {
			for _, route := range view.Routes {
				p.Expected = append(p.Expected, route.ExposedID)
			}
		}
		sort.Strings(p.Expected)
		s.live.proofs[pp.VirtualKeyID] = p
	}
	// The optimistic Registry save must win before any native side effect.
	if e = s.installAliases(r.Context(), saved); e != nil {
		reply(w, 502, map[string]string{"error": e.Error(), "phase": "aliases", "revision": saved.Revision()})
		return
	}
	for _, pp := range plan.VirtualKeys {
		vk := nativeByID[pp.VirtualKeyID]
		var key keyDTO
		for _, k := range input.Data.Keys {
			if k.ID == pp.VirtualKeyID {
				key = k
				break
			}
		}
		if e = s.applyVirtualKey(r.Context(), vk, key, pp); e != nil {
			p := s.live.proofs[vk.ID]
			p.Error = "Native apply failed"
			s.live.proofs[vk.ID] = p
			reply(w, 502, map[string]string{"error": e.Error(), "phase": "native_apply", "revision": saved.Revision()})
			return
		}
	}
	ws, e := s.workspace(r.Context())
	if e != nil {
		reply(w, 502, map[string]string{"error": e.Error(), "phase": "refresh", "revision": saved.Revision()})
		return
	}
	w.Header().Set("ETag", `"`+ws.Revision+`"`)
	reply(w, 200, ws)
}
func cleanUnknown(v string) string {
	if v == "Unknown" {
		return ""
	}
	return v
}
func sanitizeLiveModel(m modelDTO) modelDTO {
	for name, status := range m.Capabilities {
		if status == "Observed in simulated campaign" {
			m.Capabilities[name] = "Unknown"
		}
	}
	return m
}
func selectedEndpoints(kind string) []string {
	switch kind {
	case "Chat", "Vision":
		return []string{"chat/completions", "responses"}
	case "Embedding":
		return []string{"embeddings"}
	case "Image":
		return []string{"images/generations"}
	default:
		return nil
	}
}
func logicalRefs(ids []string, by map[string][]string) ([]string, error) {
	out := []string{}
	for _, id := range ids {
		r, ok := by[id]
		if !ok {
			return nil, errors.New("Key references an unknown model")
		}
		out = append(out, r...)
	}
	return out, nil
}
func (s *Server) installAliases(ctx context.Context, snap *registry.Snapshot) error {
	for _, p := range snap.Plan().ProviderKeys {
		aliases := map[string]registry.Alias{}
		for name, a := range p.Aliases {
			if name != a.ModelID {
				aliases[name] = a
			}
		}
		if len(aliases) == 0 {
			continue
		}
		path := "/api/providers/" + url.PathEscape(p.Provider) + "/keys/" + url.PathEscape(p.KeyID)
		var key map[string]json.RawMessage
		if e := s.live.client.call(ctx, "GET", path, nil, &key); e != nil {
			return e
		}
		existing := map[string]json.RawMessage{}
		if raw := key["aliases"]; len(raw) > 0 && string(raw) != "null" {
			if json.Unmarshal(raw, &existing) != nil {
				return errors.New("Invalid native aliases")
			}
		}
		for name, a := range aliases {
			for old, raw := range existing {
				if strings.EqualFold(name, old) {
					b, _ := json.Marshal(a)
					if old != name || !bytes.Equal(bytes.TrimSpace(raw), b) {
						return errors.New("Native alias conflict")
					}
				}
			}
			b, _ := json.Marshal(a)
			existing[name] = b
		}
		if e := s.live.client.call(ctx, "PUT", path, map[string]any{"aliases": existing}, nil); e != nil {
			return e
		}
	}
	return nil
}
func (s *Server) applyVirtualKey(ctx context.Context, vk nativeVK, k keyDTO, p registry.PolicyPlan) error {
	pcs := []map[string]any{}
	selected := map[string]bool{}
	for provider, models := range p.AllowedModels {
		selected[provider] = true
		ids := p.ProviderKeyIDs[provider]
		pc := map[string]any{"provider": provider, "allowed_models": models, "blacklisted_models": []string{}, "key_ids": ids}
		for _, old := range vk.ProviderConfigs {
			if old.Provider == provider {
				pc["id"] = old.ID
				pc["weight"] = old.Weight
				pc["blacklisted_models"] = old.BlacklistedModels
				break
			}
		}
		pcs = append(pcs, pc)
	}
	// Keep existing provider rows so Bifrost preserves their budgets and rate limits.
	// An empty allowlist removes their model access without deleting those rows.
	for _, old := range vk.ProviderConfigs {
		if !selected[old.Provider] {
			pcs = append(pcs, map[string]any{"id": old.ID, "provider": old.Provider, "weight": old.Weight, "allowed_models": []string{}, "blacklisted_models": old.BlacklistedModels, "key_ids": old.keyIDs()})
		}
	}
	sort.Slice(pcs, func(i, j int) bool { return pcs[i]["provider"].(string) < pcs[j]["provider"].(string) })
	payload := map[string]any{"name": k.Name, "description": k.Client, "is_active": k.Active, "allow_all_providers": false, "provider_configs": pcs}
	return s.live.client.call(ctx, "PUT", "/api/governance/virtual-keys/"+url.PathEscape(vk.ID), payload, nil)
}
func (s *Server) createKey(w http.ResponseWriter, r *http.Request) {
	b, e := readJSON(w, r)
	if e != nil {
		return
	}
	var input struct {
		Name   string `json:"name"`
		Client string `json:"client"`
	}
	if registry.StrictJSON(b, &input, true) != nil || strings.TrimSpace(input.Name) == "" {
		reply(w, 400, map[string]string{"error": "Valid key name is required"})
		return
	}
	var created struct {
		VirtualKey nativeVK `json:"virtual_key"`
	}
	if e = s.live.client.call(r.Context(), "POST", "/api/governance/virtual-keys", map[string]any{"name": input.Name, "description": input.Client, "is_active": true, "allow_all_providers": false, "provider_configs": []any{}}, &created); e != nil {
		liveError(w, e, "native_create")
		return
	}
	vk := created.VirtualKey
	createdResult := map[string]string{"id": vk.ID, "secret": vk.Value}
	if vk.ID == "" || vk.Value == "" {
		reply(w, 201, map[string]any{"created": createdResult, "managed": false, "bindingError": "Native key created but its ID or secret was not returned"})
		return
	}
	old := s.Store.Load()
	cfg := old.Config()
	cfg.Policies = append(cfg.Policies, registry.Policy{VirtualKeyID: vk.ID, Name: input.Name, TokenSHA256: registry.TokenHash(vk.Value), Naming: cfg.DefaultNaming, Groups: []string{}, Enabled: true})
	raw, _ := json.Marshal(cfg)
	if _, e = s.Store.Save(raw, old.Revision()); e != nil {
		reply(w, 201, map[string]any{"created": createdResult, "managed": false, "bindingError": "Native key created but Registry binding failed"})
		return
	}
	ws, e := s.workspace(r.Context())
	if e != nil {
		reply(w, 201, map[string]any{"created": createdResult, "refreshError": "Workspace refresh failed"})
		return
	}
	reply(w, 201, map[string]any{"workspace": ws, "created": createdResult})
}
func (s *Server) readback(w http.ResponseWriter, r *http.Request, id string) {
	snap := s.Store.Load()
	view, ok := snap.View(id)
	if !ok {
		reply(w, 404, map[string]string{"error": "Unknown managed key"})
		return
	}
	prior := s.live.proofs[id]
	p := publication{State: "not_verified", Revision: snap.Revision(), CheckedAt: time.Now().UTC().Format(time.RFC3339), Expected: []string{}, Missing: []string{}, Unexpected: []string{}, ObservedAt: prior.ObservedAt, ObservedRevision: prior.ObservedRevision}
	for _, route := range view.Routes {
		p.Expected = append(p.Expected, route.ExposedID)
	}
	sort.Strings(p.Expected)
	finish := func() {
		if p.State == "not_verified" && p.Actual == nil {
			p.Actual = prior.Actual
		}
		s.live.proofs[id] = p
		ws, e := s.workspace(r.Context())
		if e != nil {
			reply(w, 502, map[string]any{"error": "Readback failed and workspace refresh is unavailable", "phase": "readback", "publication": p})
			return
		}
		reply(w, 200, ws)
	}
	var response struct {
		VirtualKey nativeVK `json:"virtual_key"`
	}
	if e := s.live.client.call(r.Context(), "GET", "/api/governance/virtual-keys/"+url.PathEscape(id), nil, &response); e != nil {
		p.Error = "Native key read failed"
		finish()
		return
	}
	secret := response.VirtualKey.Value
	if len(p.Expected) == 0 {
		p.Error = "No native provider access selected"
	} else if secret == "" || registry.TokenHash(secret) != view.Policy.TokenSHA256 {
		p.Error = "Native key credential unavailable or changed"
	} else {
		var body struct {
			Data []struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		temp := *s.live.client
		temp.authorization = "Bearer " + secret
		e := temp.call(r.Context(), "GET", "/v1/models", nil, &body)
		if e != nil {
			p.Error = "Model readback failed"
		} else {
			seen := map[string]bool{}
			p.Actual = []string{}
			invalid := false
			for _, item := range body.Data {
				if item.ID == "" || seen[item.ID] {
					invalid = true
					break
				}
				seen[item.ID] = true
				p.Actual = append(p.Actual, item.ID)
			}
			if invalid {
				p.Error = "Invalid model response"
				p.Actual = nil
			} else {
				sort.Strings(p.Actual)
				p.ObservedAt = p.CheckedAt
				p.ObservedRevision = p.Revision
				want := map[string]bool{}
				for _, v := range p.Expected {
					want[v] = true
					if !seen[v] {
						p.Missing = append(p.Missing, v)
					}
				}
				for _, v := range p.Actual {
					if !want[v] {
						p.Unexpected = append(p.Unexpected, v)
					}
				}
				p.State = "verified"
				if len(p.Missing)+len(p.Unexpected) > 0 {
					p.State = "drift"
				}
			}
		}
	}
	finish()
}
