// Package registry implements the portable, dependency-free registry engine.
// Native Bifrost aliases perform upstream translation; this engine never prices tokens.
package registry

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"sort"
	"strings"
)

const Version = "0.1.0"
const MaxConfigBytes = 4 << 20
const MaxBodyBytes = 32 << 20

type Config struct {
	SchemaVersion int      `json:"schema_version"`
	DefaultNaming string   `json:"default_naming"`
	Models        []Model  `json:"models"`
	Groups        []Group  `json:"groups"`
	Policies      []Policy `json:"policies"`
}

type Model struct {
	ID             string                     `json:"id"`
	Alias          string                     `json:"alias"`
	Provider       string                     `json:"provider"`
	ProviderKeyIDs []string                   `json:"provider_key_ids"`
	UpstreamModel  string                     `json:"upstream_model"`
	CanonicalModel string                     `json:"canonical_model,omitempty"`
	ModelFamily    string                     `json:"model_family,omitempty"`
	Creator        string                     `json:"creator,omitempty"`
	Family         string                     `json:"family,omitempty"`
	Capabilities   []string                   `json:"capabilities,omitempty"`
	Endpoints      []string                   `json:"endpoints"`
	Enabled        bool                       `json:"enabled"`
	Verified       bool                       `json:"verified"`
	Evidence       string                     `json:"evidence,omitempty"`
	Metadata       map[string]json.RawMessage `json:"metadata,omitempty"`
	// Passthrough marks routing aliases: Bifrost routing rules (CEL model == "<alias>")
	// own the alias->upstream resolution, so the guard validates but never rewrites
	// the request model, and RoutingTargets (native "Provider/model" ids from the rule)
	// are pre-authorized for post-routing attempt checks.
	Passthrough    bool     `json:"passthrough,omitempty"`
	RoutingTargets []string `json:"routing_targets,omitempty"`
}

type Filter struct {
	Sources      []string `json:"sources,omitempty"`
	Creators     []string `json:"creators,omitempty"`
	Families     []string `json:"families,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
}

type Group struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	ModelIDs    []string `json:"model_ids"`
	Filter      *Filter  `json:"filter,omitempty"`
	Exclude     []string `json:"exclude,omitempty"`
}

type Policy struct {
	VirtualKeyID string            `json:"virtual_key_id"`
	Name         string            `json:"name"`
	TokenSHA256  string            `json:"token_sha256"`
	Naming       string            `json:"naming,omitempty"`
	Groups       []string          `json:"groups"`
	Added        []string          `json:"added,omitempty"`
	Excluded     []string          `json:"excluded,omitempty"`
	Sources      []string          `json:"sources,omitempty"`
	Prefer       map[string]string `json:"prefer,omitempty"`
	Enabled      bool              `json:"enabled"`
}

type Route struct {
	ExposedID      string   `json:"exposed_id"`
	RegistryID     string   `json:"registry_id"`
	Provider       string   `json:"provider"`
	Alias          string   `json:"alias"`
	UpstreamModel  string   `json:"upstream_model"`
	Endpoints      []string `json:"endpoints"`
	Passthrough    bool     `json:"passthrough,omitempty"`
	RoutingTargets []string `json:"routing_targets,omitempty"`
}

func (r Route) NativeID() string { return r.Provider + "/" + r.Alias }

type View struct {
	Policy Policy  `json:"policy"`
	Routes []Route `json:"routes"`
	index  map[string]Route
	native map[string]Route
}

type Snapshot struct {
	config   Config
	views    map[string]*View
	tokens   map[string]*View
	revision string
}

var slug = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{0,127}$`)

// Provider names are Bifrost-native identifiers (e.g. "Google", "Codex"): they are
// admin-controlled (never request-controlled) and are written verbatim into the
// rewritten "model" field as "Provider/alias", which must match Bifrost's native
// provider/model routing form. Internal ASCII spaces are native for custom
// providers; leading/trailing whitespace, slashes and controls stay rejected.
var slugProvider = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,127}$`)
var nativeFamilies = map[string]bool{"anthropic": true, "openai": true, "mistral": true, "cohere": true, "gemini": true, "gemma": true, "llama": true, "imagen": true, "veo": true, "nova": true, "titan": true}
var endpoints = map[string]bool{"chat/completions": true, "responses": true, "completions": true, "embeddings": true, "images/generations": true, "audio/speech": true}

func NamingValid(s string) bool { return s == "model" || s == "provider/model" || s == "both" }
func TokenHash(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func Has(xs []string, s string) bool {
	for _, x := range xs {
		if x == s {
			return true
		}
	}
	return false
}
func unique(xs []string) bool {
	seen := map[string]bool{}
	for _, x := range xs {
		if x == "" || seen[x] {
			return false
		}
		seen[x] = true
	}
	return true
}
func noControls(s string) bool {
	for _, r := range s {
		if r < 32 || r == 127 {
			return false
		}
	}
	return true
}

// StrictJSON rejects duplicate object keys, excessive nesting and trailing JSON.
// Rejecting duplicates is important before interpreting authorization-bearing fields.
func StrictJSON(data []byte, dst any, disallowUnknown bool) error {
	if err := checkJSON(data); err != nil {
		return err
	}
	d := json.NewDecoder(bytes.NewReader(data))
	if disallowUnknown {
		d.DisallowUnknownFields()
	}
	if err := d.Decode(dst); err != nil {
		return err
	}
	return nil
}
func checkJSON(data []byte) error {
	d := json.NewDecoder(bytes.NewReader(data))
	d.UseNumber()
	if err := walkJSON(d, 0); err != nil {
		return err
	}
	if _, err := d.Token(); err != io.EOF {
		return errors.New("unexpected trailing JSON")
	}
	return nil
}
func walkJSON(d *json.Decoder, depth int) error {
	if depth > 100 {
		return errors.New("JSON nesting exceeds 100")
	}
	tok, err := d.Token()
	if err != nil {
		return err
	}
	if delim, ok := tok.(json.Delim); ok {
		switch delim {
		case '{':
			seen := map[string]bool{}
			for d.More() {
				key, e := d.Token()
				if e != nil {
					return e
				}
				k, ok := key.(string)
				if !ok {
					return errors.New("invalid JSON key")
				}
				if seen[k] {
					return fmt.Errorf("duplicate JSON key %q", k)
				}
				seen[k] = true
				if err := walkJSON(d, depth+1); err != nil {
					return err
				}
			}
			end, e := d.Token()
			if e != nil || end != json.Delim('}') {
				return errors.New("invalid JSON object")
			}
		case '[':
			for d.More() {
				if err := walkJSON(d, depth+1); err != nil {
					return err
				}
			}
			end, e := d.Token()
			if e != nil || end != json.Delim(']') {
				return errors.New("invalid JSON array")
			}
		default:
			return errors.New("unexpected JSON delimiter")
		}
	}
	return nil
}
func Parse(data []byte) (*Snapshot, error) {
	if len(data) > MaxConfigBytes {
		return nil, errors.New("registry config exceeds 4 MiB")
	}
	var c Config
	if err := StrictJSON(data, &c, true); err != nil {
		return nil, fmt.Errorf("config: %w", err)
	}
	return Compile(c)
}
func Compile(c Config) (*Snapshot, error) {
	// Deep copy makes compiled snapshots immutable to their callers.
	data, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	var clone Config
	if err = json.Unmarshal(data, &clone); err != nil {
		return nil, err
	}
	c = clone
	// Normalize empty collections for a stable public admin JSON shape.
	if c.Models == nil {
		c.Models = []Model{}
	}
	if c.Groups == nil {
		c.Groups = []Group{}
	}
	if c.Policies == nil {
		c.Policies = []Policy{}
	}
	for i := range c.Groups {
		if c.Groups[i].ModelIDs == nil {
			c.Groups[i].ModelIDs = []string{}
		}
	}
	for i := range c.Policies {
		if c.Policies[i].Groups == nil {
			c.Policies[i].Groups = []string{}
		}
	}
	if c.SchemaVersion != 1 {
		return nil, errors.New("schema_version must be 1")
	}
	if !NamingValid(c.DefaultNaming) {
		return nil, errors.New("default_naming must be model, provider/model, or both")
	}
	if len(c.Models) > 10000 || len(c.Groups) > 1000 || len(c.Policies) > 1000 {
		return nil, errors.New("registry size limit exceeded")
	}
	models := map[string]Model{}
	nativeNames := map[string]string{}
	for _, m := range c.Models {
		if !slug.MatchString(m.ID) || !slug.MatchString(m.Alias) || !slugProvider.MatchString(m.Provider) || strings.TrimSpace(m.Provider) != m.Provider {
			return nil, fmt.Errorf("model %q: id and alias must be lowercase safe identifiers, provider a safe identifier", m.ID)
		}
		if _, ok := models[m.ID]; ok {
			return nil, fmt.Errorf("duplicate model id %s", m.ID)
		}
		if len(m.UpstreamModel) == 0 || len(m.UpstreamModel) > 512 || strings.TrimSpace(m.UpstreamModel) != m.UpstreamModel || !noControls(m.UpstreamModel) {
			return nil, fmt.Errorf("model %s: invalid upstream_model", m.ID)
		}
		if !noControls(m.CanonicalModel) || len(m.CanonicalModel) > 512 {
			return nil, fmt.Errorf("model %s: invalid canonical_model", m.ID)
		}
		if m.ModelFamily != "" && !nativeFamilies[m.ModelFamily] {
			return nil, fmt.Errorf("model %s: unsupported native model_family", m.ID)
		}
		if len(m.ProviderKeyIDs) == 0 || !unique(m.ProviderKeyIDs) {
			return nil, fmt.Errorf("model %s: explicit unique provider_key_ids required", m.ID)
		}
		for _, id := range m.ProviderKeyIDs {
			if !noControls(id) || len(id) > 200 {
				return nil, fmt.Errorf("model %s: invalid provider key id", m.ID)
			}
		}
		if len(m.Endpoints) == 0 || !unique(m.Endpoints) {
			return nil, fmt.Errorf("model %s: unique nonempty endpoints required", m.ID)
		}
		for _, e := range m.Endpoints {
			if !endpoints[e] {
				return nil, fmt.Errorf("model %s: unsupported endpoint %s", m.ID, e)
			}
		}
		if m.Verified && strings.TrimSpace(m.Evidence) == "" {
			return nil, fmt.Errorf("model %s: verified models require evidence", m.ID)
		}
		if m.Passthrough {
			if len(m.RoutingTargets) == 0 || !unique(m.RoutingTargets) {
				return nil, fmt.Errorf("model %s: passthrough models require unique routing_targets", m.ID)
			}
			for _, t := range m.RoutingTargets {
				prov, rest, ok := strings.Cut(t, "/")
				if !ok || !slugProvider.MatchString(prov) || strings.TrimSpace(prov) != prov || rest == "" || len(t) > 512 ||
					strings.TrimSpace(t) != t || !noControls(t) {
					return nil, fmt.Errorf("model %s: invalid routing target %q", m.ID, t)
				}
			}
		}
		n := m.Provider + "/" + m.Alias
		if old, ok := nativeNames[n]; ok {
			return nil, fmt.Errorf("native alias collision %s (%s, %s)", n, old, m.ID)
		}
		nativeNames[n] = m.ID
		models[m.ID] = m
	}
	groups := map[string]map[string]bool{}
	for _, g := range c.Groups {
		if !slug.MatchString(g.ID) {
			return nil, fmt.Errorf("invalid group id %q", g.ID)
		}
		if _, ok := groups[g.ID]; ok {
			return nil, fmt.Errorf("duplicate group %s", g.ID)
		}
		if !unique(g.ModelIDs) || !unique(g.Exclude) {
			return nil, fmt.Errorf("group %s: duplicate or empty references", g.ID)
		}
		if len(g.ModelIDs) == 0 && g.Filter == nil {
			return nil, fmt.Errorf("group %s: explicit members or a nonempty filter required", g.ID)
		}
		if g.Filter != nil && len(g.Filter.Sources)+len(g.Filter.Creators)+len(g.Filter.Families)+len(g.Filter.Capabilities) == 0 {
			return nil, fmt.Errorf("group %s: empty filters cannot mean allow-all", g.ID)
		}
		set := map[string]bool{}
		for _, id := range append(append([]string{}, g.ModelIDs...), g.Exclude...) {
			if _, ok := models[id]; !ok {
				return nil, fmt.Errorf("group %s: unknown model %s", g.ID, id)
			}
		}
		for _, id := range g.ModelIDs {
			set[id] = true
		}
		if f := g.Filter; f != nil {
			for id, m := range models {
				if len(f.Sources) > 0 && !Has(f.Sources, m.Provider) {
					continue
				}
				if len(f.Creators) > 0 && !Has(f.Creators, m.Creator) {
					continue
				}
				if len(f.Families) > 0 && !Has(f.Families, m.Family) {
					continue
				}
				good := true
				for _, cap := range f.Capabilities {
					if !Has(m.Capabilities, cap) {
						good = false
					}
				}
				if good {
					set[id] = true
				}
			}
		}
		for _, id := range g.Exclude {
			delete(set, id)
		}
		groups[g.ID] = set
	}
	s := &Snapshot{config: c, views: map[string]*View{}, tokens: map[string]*View{}}
	for _, p := range c.Policies {
		if p.VirtualKeyID == "" || len(p.VirtualKeyID) > 200 || !noControls(p.VirtualKeyID) {
			return nil, errors.New("policy: native virtual_key_id required")
		}
		if _, ok := s.views[p.VirtualKeyID]; ok {
			return nil, fmt.Errorf("duplicate policy %s", p.VirtualKeyID)
		}
		h, err := hex.DecodeString(p.TokenSHA256)
		if err != nil || len(h) != 32 || strings.ToLower(p.TokenSHA256) != p.TokenSHA256 {
			return nil, fmt.Errorf("policy %s: lowercase SHA-256 fingerprint required", p.VirtualKeyID)
		}
		if _, ok := s.tokens[p.TokenSHA256]; ok {
			return nil, errors.New("duplicate virtual key fingerprint")
		}
		if p.Naming == "" {
			p.Naming = c.DefaultNaming
		}
		if !NamingValid(p.Naming) {
			return nil, fmt.Errorf("policy %s: invalid naming", p.VirtualKeyID)
		}
		if !unique(p.Groups) || !unique(p.Added) || !unique(p.Excluded) || !unique(p.Sources) {
			return nil, fmt.Errorf("policy %s: duplicate/empty selectors", p.VirtualKeyID)
		}
		selected := map[string]bool{}
		for _, gid := range p.Groups {
			set, ok := groups[gid]
			if !ok {
				return nil, fmt.Errorf("policy %s: unknown group %s", p.VirtualKeyID, gid)
			}
			for id := range set {
				selected[id] = true
			}
		}
		for _, id := range append(append([]string{}, p.Added...), p.Excluded...) {
			if _, ok := models[id]; !ok {
				return nil, fmt.Errorf("policy %s: unknown model %s", p.VirtualKeyID, id)
			}
		}
		for _, id := range p.Added {
			selected[id] = true
		}
		for _, id := range p.Excluded {
			delete(selected, id)
		}
		eligible := map[string]Model{}
		for id := range selected {
			m := models[id]
			if m.Enabled && m.Verified && (len(p.Sources) == 0 || Has(p.Sources, m.Provider)) {
				eligible[id] = m
			}
		}
		byAlias := map[string][]Model{}
		for _, m := range eligible {
			byAlias[m.Alias] = append(byAlias[m.Alias], m)
		}
		for alias, id := range p.Prefer {
			m, ok := eligible[id]
			if !ok || m.Alias != alias {
				return nil, fmt.Errorf("policy %s: preference %s must reference an eligible model with that alias", p.VirtualKeyID, alias)
			}
		}
		v := &View{Policy: p, Routes: []Route{}, index: map[string]Route{}, native: map[string]Route{}}
		add := func(m Model, name string) {
			r := Route{name, m.ID, m.Provider, m.Alias, m.UpstreamModel, append([]string{}, m.Endpoints...), m.Passthrough, append([]string{}, m.RoutingTargets...)}
			v.Routes = append(v.Routes, r)
			v.index[name] = r
			if !m.Passthrough {
				v.native[r.NativeID()] = r
			}
		}
		if p.Enabled {
			for alias, ms := range byAlias {
				if p.Naming == "provider/model" || p.Naming == "both" {
					for _, m := range ms {
						if m.Passthrough {
							// Aliases owned by Bifrost routing rules only exist in bare
							// form; "Provider/alias" would bypass the rule's CEL match.
							continue
						}
						add(m, m.Provider+"/"+m.Alias)
					}
				}
				if p.Naming == "model" || p.Naming == "both" {
					chosen := ms[0]
					if len(ms) > 1 {
						preferred := p.Prefer[alias]
						if preferred == "" {
							return nil, fmt.Errorf("policy %s: ambiguous bare alias %s; select a preferred route or provider/model", p.VirtualKeyID, alias)
						}
						chosen = eligible[preferred]
					}
					add(chosen, alias)
				}
			}
		}
		sort.Slice(v.Routes, func(i, j int) bool { return v.Routes[i].ExposedID < v.Routes[j].ExposedID })
		s.views[p.VirtualKeyID] = v
		s.tokens[p.TokenSHA256] = v
	}
	raw, _ := json.Marshal(c)
	sum := sha256.Sum256(raw)
	s.revision = hex.EncodeToString(sum[:])
	return s, nil
}
func (s *Snapshot) Revision() string { return s.revision }
func (s *Snapshot) JSON() []byte     { data, _ := json.MarshalIndent(s.config, "", "  "); return data }
func (s *Snapshot) Config() Config   { var c Config; _ = json.Unmarshal(s.JSON(), &c); return c }

// View returns a copy for UI/API callers. Internal request paths use private snapshots.
func (s *Snapshot) View(id string) (*View, bool) {
	v, ok := s.views[id]
	if !ok {
		return nil, false
	}
	b, _ := json.Marshal(v)
	var out View
	_ = json.Unmarshal(b, &out)
	return &out, true
}
func (s *Snapshot) bound(token string) (*View, error) {
	v, ok := s.tokens[TokenHash(token)]
	if !ok || !v.Policy.Enabled {
		return nil, errors.New("virtual key is not bound to an enabled registry policy")
	}
	return v, nil
}
