package admin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"bifrost-registry/internal/registry"
)

func catalogFieldsForAccess(c *registry.Catalog, provider, model string) map[string]registry.CatalogValue {
	fields := map[string]registry.CatalogValue{}
	if c == nil {
		return fields
	}
	var access *registry.CatalogAccess
	for i := range c.Accesses {
		if c.Accesses[i].ID == provider+"/"+model {
			access = &c.Accesses[i]
			break
		}
	}
	if access == nil {
		return fields
	}
	fields = registry.EffectiveAccessCatalogFields(c, *access)
	if _, ok := fields["creator"]; !ok && access.ReferenceID != "" {
		for _, ref := range c.References {
			if ref.ID == access.ReferenceID {
				if creator, ok := referenceFields(ref)["creator"]; ok {
					fields["creator"] = creator
				}
				break
			}
		}
	}
	return fields
}

// referenceFields adds the namespace creator to Models.dev references saved before a refresh
// stored it, so older registry files show creators without a refresh. Any stored value wins.
func referenceFields(ref registry.CatalogReference) map[string]registry.CatalogValue {
	fields := registry.EffectiveCatalogFields(ref.CatalogRecord)
	if _, ok := fields["creator"]; ok {
		return fields
	}
	for _, sources := range ref.Candidates {
		if _, ok := sources["models.dev"]; ok {
			if creator := modelsDevCreator(ref.ID); creator != "" {
				raw, _ := json.Marshal(creator)
				fields["creator"] = registry.CatalogValue{Value: raw, Source: "models.dev", UpdatedAt: ref.UpdatedAt["models.dev"], Kind: "declared"}
			}
			break
		}
	}
	return fields
}

func catalogModelFields(m *modelDTO, fields map[string]registry.CatalogValue) {
	getString := func(key string) string { var v string; _ = json.Unmarshal(fields[key].Value, &v); return v }
	// A name equal to the common ID is the slug discovery registered, not a chosen display name.
	if m.Name == "" || m.Name == m.ID {
		if v := getString("name"); v != "" {
			m.Name = v
		}
	}
	if m.Creator == "" || m.Creator == "Unknown" {
		if v := getString("creator"); v != "" {
			m.Creator = v
		}
	}
	if m.Family == "" || m.Family == "Unknown" {
		if v := getString("family"); v != "" {
			m.Family = v
		}
	}
	if m.Context == "" || m.Context == "Unknown" {
		var n float64
		if json.Unmarshal(fields["context_length"].Value, &n) == nil {
			m.Context = strconv.FormatFloat(n, 'f', -1, 64)
		}
	}
	modalities := func(key string) []string {
		values := []string{}
		_ = json.Unmarshal(fields[key].Value, &values)
		for i, v := range values {
			if v != "" {
				values[i] = strings.ToUpper(v[:1]) + v[1:]
			}
		}
		return values
	}
	if len(m.InputModalities) == 0 {
		m.InputModalities = modalities("input_modalities")
	}
	if len(m.OutputModalities) == 0 {
		m.OutputModalities = modalities("output_modalities")
	}
	if m.Capabilities == nil {
		m.Capabilities = map[string]string{}
	}
	for field, label := range map[string]string{"tool_call": "Tool calling", "reasoning": "Reasoning", "structured_output": "Structured output", "attachment": "Attachments"} {
		if m.Capabilities[label] != "" {
			continue
		}
		var supported bool
		if json.Unmarshal(fields[field].Value, &supported) == nil && supported {
			m.Capabilities[label] = "Declared"
		}
	}
}

func stripCatalogAutofill(m *modelDTO, fields map[string]registry.CatalogValue) {
	if len(fields) == 0 {
		return
	}
	auto := modelDTO{}
	catalogModelFields(&auto, fields)
	if auto.Name != "" && m.Name == auto.Name {
		m.Name = ""
	}
	if auto.Creator != "" && m.Creator == auto.Creator {
		m.Creator = ""
	}
	if auto.Family != "" && m.Family == auto.Family {
		m.Family = ""
	}
	if auto.Context != "" && m.Context == auto.Context {
		m.Context = ""
	}
	if len(auto.InputModalities) > 0 && reflect.DeepEqual(m.InputModalities, auto.InputModalities) {
		m.InputModalities = nil
	}
	if len(auto.OutputModalities) > 0 && reflect.DeepEqual(m.OutputModalities, auto.OutputModalities) {
		m.OutputModalities = nil
	}
	for key, value := range auto.Capabilities {
		if m.Capabilities[key] == value {
			delete(m.Capabilities, key)
		}
	}
}

type catalogReferenceDTO struct {
	ID        string                           `json:"id"`
	Fields    map[string]registry.CatalogValue `json:"fields"`
	Overrides map[string]json.RawMessage       `json:"overrides"`
}
type catalogAccessDTO struct {
	ID            string                           `json:"id"`
	Provider      string                           `json:"provider"`
	Model         string                           `json:"model"`
	Configured    bool                             `json:"configured"`
	ReferenceID   string                           `json:"referenceId,omitempty"`
	MappingManual bool                             `json:"mappingManual,omitempty"`
	MatchConflict string                           `json:"matchConflict,omitempty"`
	OmittedFields []string                         `json:"omittedFields,omitempty"`
	Fields        map[string]registry.CatalogValue `json:"fields"`
	Overrides     map[string]json.RawMessage       `json:"overrides"`
}
type catalogDTO struct {
	Revision   string                   `json:"revision"`
	References []catalogReferenceDTO    `json:"references"`
	Accesses   []catalogAccessDTO       `json:"accesses"`
	Sources    []registry.CatalogSource `json:"sources"`
}

type catalogOverrideInput struct {
	Target string          `json:"target"`
	ID     string          `json:"id"`
	Field  string          `json:"field"`
	Value  json.RawMessage `json:"value"`
}

func applyCatalogOverride(c *registry.Catalog, input catalogOverrideInput) int {
	if !registry.CatalogFieldAllowed(input.Field) || len(input.Value) == 0 || !json.Valid(input.Value) {
		return http.StatusBadRequest
	}
	if c == nil {
		return http.StatusNotFound
	}
	record := catalogRecord(c, input.Target, input.ID)
	if record == nil {
		return http.StatusNotFound
	}
	if string(input.Value) == "null" {
		delete(record.Overrides, input.Field)
		return 0
	}
	if !registry.CatalogValueValid(input.Field, input.Value) {
		return http.StatusUnprocessableEntity
	}
	if record.Overrides == nil {
		record.Overrides = map[string]registry.CatalogValue{}
	}
	record.Overrides[input.Field] = registry.CatalogValue{Value: input.Value, Source: "manual", UpdatedAt: time.Now().UTC().Format(time.RFC3339), Kind: "declared"}
	return 0
}

func catalogView(snap *registry.Snapshot) catalogDTO {
	cfg := snap.Config()
	out := catalogDTO{Revision: snap.Revision(), References: []catalogReferenceDTO{}, Accesses: []catalogAccessDTO{}, Sources: []registry.CatalogSource{}}
	if cfg.Catalog == nil {
		return out
	}
	for _, r := range cfg.Catalog.References {
		out.References = append(out.References, catalogReferenceDTO{r.ID, referenceFields(r), rawOverrides(r.Overrides)})
	}
	for _, a := range cfg.Catalog.Accesses {
		out.Accesses = append(out.Accesses, catalogAccessDTO{a.ID, a.Provider, a.Model, a.Configured, a.ReferenceID, a.MappingManual, a.MatchConflict, a.OmittedFields, registry.EffectiveCatalogFields(a.CatalogRecord), rawOverrides(a.Overrides)})
	}
	out.Sources = cfg.Catalog.Sources
	return out
}

func rawOverrides(in map[string]registry.CatalogValue) map[string]json.RawMessage {
	out := map[string]json.RawMessage{}
	for field, v := range in {
		out[field] = v.Value
	}
	return out
}

func (s *Server) catalogHandler(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/api/catalog" && r.Method == http.MethodGet {
		snap := s.Store.Load()
		w.Header().Set("ETag", `"`+snap.Revision()+`"`)
		reply(w, 200, catalogView(snap))
		return
	}
	if r.URL.Path != "/api/catalog/refresh" && r.URL.Path != "/api/catalog/override" && r.URL.Path != "/api/catalog/match" && r.URL.Path != "/api/catalog/reference" {
		http.NotFound(w, r)
		return
	}
	verb := http.MethodPut
	if r.URL.Path == "/api/catalog/refresh" {
		verb = http.MethodPost
	}
	if !method(w, r, verb) {
		return
	}
	expected := strings.Trim(r.Header.Get("If-Match"), `"`)
	if expected == "" {
		reply(w, 428, map[string]string{"error": "If-Match is required"})
		return
	}
	if expected != s.Store.Load().Revision() {
		reply(w, 409, map[string]string{"error": registry.ErrConflict.Error()})
		return
	}
	var b []byte
	if r.URL.Path == "/api/catalog/refresh" && r.ContentLength == 0 {
		b = []byte(`{}`)
	} else {
		var err error
		b, err = readJSON(w, r)
		if err != nil {
			return
		}
	}
	cfg := s.Store.Load().Config()
	if cfg.Catalog == nil {
		cfg.Catalog = &registry.Catalog{}
	}
	switch r.URL.Path {
	case "/api/catalog/reference":
		var input struct {
			ID     string                     `json:"id"`
			Fields map[string]json.RawMessage `json:"fields"`
		}
		if registry.StrictJSON(b, &input, true) != nil || input.ID == "" || len(input.Fields) == 0 || !registry.CatalogValueValid("name", input.Fields["name"]) {
			reply(w, 400, map[string]string{"error": "Reference ID and valid name are required"})
			return
		}
		var name string
		_ = json.Unmarshal(input.Fields["name"], &name)
		if strings.TrimSpace(name) == "" {
			reply(w, 400, map[string]string{"error": "Reference name is required"})
			return
		}
		for _, old := range cfg.Catalog.References {
			if old.ID == input.ID {
				reply(w, 409, map[string]string{"error": "Reference already exists"})
				return
			}
		}
		ref := registry.CatalogReference{ID: input.ID}
		ref.Overrides = map[string]registry.CatalogValue{}
		at := time.Now().UTC().Format(time.RFC3339)
		for field, value := range input.Fields {
			if !registry.CatalogValueValid(field, value) {
				reply(w, 422, map[string]string{"error": "Invalid reference field: " + field})
				return
			}
			ref.Overrides[field] = registry.CatalogValue{Value: value, Source: "manual", UpdatedAt: at, Kind: "declared"}
		}
		cfg.Catalog.References = append(cfg.Catalog.References, ref)
		sort.Slice(cfg.Catalog.References, func(i, j int) bool { return cfg.Catalog.References[i].ID < cfg.Catalog.References[j].ID })
	case "/api/catalog/override":
		var input catalogOverrideInput
		if registry.StrictJSON(b, &input, true) != nil {
			reply(w, 400, map[string]string{"error": "Invalid catalogue override"})
			return
		}
		if status := applyCatalogOverride(cfg.Catalog, input); status != 0 {
			reply(w, status, map[string]string{"error": "Invalid or unknown catalogue override"})
			return
		}
	case "/api/catalog/match":
		var input struct {
			AccessID    string `json:"accessId"`
			ReferenceID string `json:"referenceId"`
		}
		if registry.StrictJSON(b, &input, true) != nil || input.AccessID == "" {
			reply(w, 400, map[string]string{"error": "Invalid catalogue mapping"})
			return
		}
		if input.ReferenceID != "" {
			found := false
			for _, ref := range cfg.Catalog.References {
				found = found || ref.ID == input.ReferenceID
			}
			if !found {
				reply(w, 422, map[string]string{"error": "Unknown reference"})
				return
			}
		}
		found := false
		for i := range cfg.Catalog.Accesses {
			if cfg.Catalog.Accesses[i].ID == input.AccessID {
				cfg.Catalog.Accesses[i].ReferenceID = input.ReferenceID
				cfg.Catalog.Accesses[i].MappingManual = true
				found = true
				break
			}
		}
		if !found {
			reply(w, 404, map[string]string{"error": "Unknown access"})
			return
		}
	case "/api/catalog/refresh":
		var input struct {
			Sources []string `json:"sources"`
		}
		if registry.StrictJSON(b, &input, true) != nil {
			reply(w, 400, map[string]string{"error": "Invalid refresh request"})
			return
		}
		if len(input.Sources) == 0 {
			input.Sources = []string{"bifrost", "models.dev"}
		}
		seen := map[string]bool{}
		for _, source := range input.Sources {
			if (source != "bifrost" && source != "models.dev") || seen[source] {
				reply(w, 400, map[string]string{"error": "Unknown or duplicate source"})
				return
			}
			seen[source] = true
		}
		ctx, cancel := context.WithTimeout(r.Context(), 25*time.Second)
		defer cancel()
		for _, source := range input.Sources {
			at := time.Now().UTC().Format(time.RFC3339)
			var refs []registry.CatalogReference
			var accesses []registry.CatalogAccess
			var e error
			if source == "bifrost" {
				s.live.Lock()
				client := s.live.client
				s.live.Unlock()
				if client == nil {
					e = errors.New("Bifrost connection is not configured")
				} else {
					accesses, e = bifrostCatalogue(ctx, client, at)
				}
			} else {
				refs, accesses, e = s.modelsDevCatalogue(ctx, cfg.Catalog, at)
			}
			if e != nil {
				status := cfg.Catalog.Source(source)
				status.LastAttempt, status.Error = at, e.Error()
				continue
			}
			registry.ReplaceCatalogSource(cfg.Catalog, source, at, refs, accesses)
		}
	}
	raw, _ := json.Marshal(cfg)
	next, err := s.Store.Save(raw, expected)
	if err != nil {
		status := 422
		if errors.Is(err, registry.ErrConflict) {
			status = 409
		}
		reply(w, status, map[string]string{"error": err.Error()})
		return
	}
	w.Header().Set("ETag", `"`+next.Revision()+`"`)
	reply(w, 200, catalogView(next))
}

func catalogRecord(c *registry.Catalog, target, id string) *registry.CatalogRecord {
	if target == "reference" {
		for i := range c.References {
			if c.References[i].ID == id {
				return &c.References[i].CatalogRecord
			}
		}
	}
	if target == "access" {
		for i := range c.Accesses {
			if c.Accesses[i].ID == id {
				return &c.Accesses[i].CatalogRecord
			}
		}
	}
	return nil
}

func putCatalogField(record *registry.CatalogRecord, source, at, field string, raw json.RawMessage) {
	if !registry.CatalogValueValid(field, raw) {
		return
	}
	if record.Candidates == nil {
		record.Candidates = map[string]map[string]json.RawMessage{}
	}
	if record.Candidates[field] == nil {
		record.Candidates[field] = map[string]json.RawMessage{}
	}
	record.Candidates[field][source] = raw
	if record.UpdatedAt == nil {
		record.UpdatedAt = map[string]string{}
	}
	record.UpdatedAt[source] = at
}

func putField(record *registry.CatalogRecord, source, at, field string, value any) {
	if value == nil {
		return
	}
	raw, err := json.Marshal(value)
	if err == nil {
		putCatalogField(record, source, at, field, raw)
	}
}

func object(raw json.RawMessage) map[string]json.RawMessage {
	var out map[string]json.RawMessage
	_ = json.Unmarshal(raw, &out)
	return out
}

func putMapped(record *registry.CatalogRecord, source, at string, row map[string]json.RawMessage, keys map[string]string) {
	for from, to := range keys {
		putCatalogField(record, source, at, to, row[from])
	}
}

func costPerMillion(raw json.RawMessage, perToken bool) (float64, bool) {
	if len(raw) == 0 || string(raw) == "null" {
		return 0, false
	}
	var number float64
	if json.Unmarshal(raw, &number) != nil {
		var str string
		if json.Unmarshal(raw, &str) != nil {
			return 0, false
		}
		var err error
		number, err = strconv.ParseFloat(str, 64)
		if err != nil {
			return 0, false
		}
	}
	if number < 0 {
		return 0, false
	}
	if perToken {
		number *= 1_000_000
	}
	return number, true
}

// parameterLookupConcurrency bounds in-flight /api/models/parameters calls during a Bifrost refresh.
// About 800 models at 75 ms each take 7.5 s at 8 in flight, well inside the 25 s refresh budget.
const parameterLookupConcurrency = 8

func bifrostCatalogue(ctx context.Context, client *liveClient, at string) ([]registry.CatalogAccess, error) {
	// Reuse the native discovery path so only accesses backed by configured keys enter this view.
	server := &Server{}
	server.live.client = client
	rows, err := server.nativeModels(ctx)
	if err != nil {
		return nil, err
	}
	byID := map[string]*registry.CatalogAccess{}
	for _, row := range rows {
		if row.Name == "" || row.Provider == "" || len(row.AccessibleByKeys) == 0 {
			continue
		}
		id := row.Provider + "/" + row.Name
		if _, ok := byID[id]; ok {
			continue
		}
		a := &registry.CatalogAccess{ID: id, Provider: row.Provider, Model: row.Name, Configured: true}
		putField(&a.CatalogRecord, "bifrost", at, "name", row.Name)
		byID[id] = a
	}
	// Details are metadata, not proof of inference. Pagination uses the native {models,total} contract.
	for offset := 0; ; offset += 100 {
		if offset >= 10000 {
			return nil, errors.New("Bifrost model details exceed 10000 rows")
		}
		query := url.Values{"unfiltered": {"true"}, "limit": {"100"}, "offset": {strconv.Itoa(offset)}}
		var page struct {
			Models []map[string]json.RawMessage `json:"models"`
			Total  int                          `json:"total"`
		}
		if err := client.callQuery(ctx, "/api/models/details", query, &page); err != nil {
			return nil, err
		}
		if page.Total < 0 || page.Total > 10000 {
			return nil, errors.New("invalid Bifrost model detail total")
		}
		for _, row := range page.Models {
			var name, provider string
			_ = json.Unmarshal(row["name"], &name)
			_ = json.Unmarshal(row["provider"], &provider)
			a := byID[provider+"/"+name]
			if a == nil {
				continue
			}
			putMapped(&a.CatalogRecord, "bifrost", at, row, map[string]string{
				"context_length": "context_length", "max_input_tokens": "max_input_tokens", "max_output_tokens": "max_output_tokens", "architecture": "architecture", "additional_attributes": "additional_attributes",
			})
			prices := map[string]string{"input_cost_per_token": "input_cost_usd_per_million", "output_cost_per_token": "output_cost_usd_per_million", "cache_read_input_token_cost": "cache_read_cost_usd_per_million", "cache_creation_input_token_cost": "cache_write_cost_usd_per_million"}
			for from, to := range prices {
				if price, ok := costPerMillion(row[from], true); ok {
					putField(&a.CatalogRecord, "bifrost", at, to, price)
				}
			}
			arch := object(row["architecture"])
			putCatalogField(&a.CatalogRecord, "bifrost", at, "input_modalities", arch["input_modalities"])
			putCatalogField(&a.CatalogRecord, "bifrost", at, "output_modalities", arch["output_modalities"])
		}
		if len(page.Models) == 0 || offset+len(page.Models) >= page.Total {
			break
		}
	}
	// Parameters are fetched only for exact configured model IDs; no arbitrary user URL enters this path.
	ids := make([]string, 0, len(byID))
	for id := range byID {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	// One lookup per access; run them concurrently so large gateways fit the refresh timeout (#61).
	// The first non-404 error fails the source and cancels the remaining lookups.
	lookupCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	params := make([]json.RawMessage, len(ids))
	slots := make(chan struct{}, parameterLookupConcurrency)
	var wg sync.WaitGroup
	var mu sync.Mutex
	var firstErr error
	for i, id := range ids {
		slots <- struct{}{}
		wg.Add(1)
		go func() {
			defer func() { <-slots; wg.Done() }()
			err := client.callQuery(lookupCtx, "/api/models/parameters", url.Values{"model": {id}}, &params[i])
			if err == nil || err.Error() == "Bifrost returned HTTP 404" {
				return
			}
			mu.Lock()
			defer mu.Unlock()
			if firstErr == nil {
				firstErr = err
				cancel()
			}
		}()
	}
	wg.Wait()
	if firstErr != nil {
		return nil, firstErr
	}
	for i, id := range ids {
		if len(params[i]) > 0 && string(params[i]) != "null" {
			putCatalogField(&byID[id].CatalogRecord, "bifrost", at, "parameters", params[i])
		}
	}
	out := make([]registry.CatalogAccess, 0, len(ids))
	for _, id := range ids {
		out = append(out, *byID[id])
	}
	return out, nil
}

func (s *Server) modelsDevCatalogue(_ context.Context, current *registry.Catalog, _ string) ([]registry.CatalogReference, []registry.CatalogAccess, error) {
	body, err := embeddedModelsDevSnapshot()
	if err != nil {
		return nil, nil, err
	}
	snapshot, err := parseModelsDevSnapshot(body)
	if err != nil {
		return nil, nil, err
	}
	refs, accesses, err := modelsDevRows(current, snapshot.Source.SourceAt, snapshot)
	if err != nil {
		return nil, nil, err
	}
	source := current.Source("models.dev")
	source.Repository, source.Commit, source.SourceAt = snapshot.Source.Repository, snapshot.Source.Commit, snapshot.Source.SourceAt
	return refs, accesses, nil
}
