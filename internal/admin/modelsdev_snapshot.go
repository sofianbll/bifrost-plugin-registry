package admin

import (
	"bytes"
	"compress/gzip"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"

	"bifrost-registry/internal/registry"
)

//go:embed data/modelsdev.json.gz
var modelsDevSnapshotFS embed.FS

const maxModelsDevSnapshotBytes = 64 << 20

type modelsDevSnapshot struct {
	SchemaVersion int                          `json:"schemaVersion"`
	Source        modelsDevSnapshotSource      `json:"source"`
	Models        map[string]modelsDevEntry    `json:"models"`
	Providers     map[string]modelsDevProvider `json:"providers"`
}

type modelsDevSnapshotSource struct {
	Repository string `json:"repository"`
	Commit     string `json:"commit"`
	SourceAt   string `json:"sourceAt"`
}

type modelsDevEntry struct {
	SourcePath string                     `json:"sourcePath"`
	Authored   map[string]json.RawMessage `json:"authored"`
	Resolved   map[string]json.RawMessage `json:"resolved"`
}

type modelsDevProvider struct {
	SourcePath string                     `json:"sourcePath"`
	Authored   map[string]json.RawMessage `json:"authored"`
	Resolved   map[string]json.RawMessage `json:"resolved"`
	Models     map[string]modelsDevEntry  `json:"models"`
}

func embeddedModelsDevSnapshot() ([]byte, error) {
	compressed, err := modelsDevSnapshotFS.ReadFile("data/modelsdev.json.gz")
	if err != nil {
		return nil, errors.New("embedded Models.dev snapshot is unavailable")
	}
	reader, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return nil, errors.New("embedded Models.dev snapshot is invalid")
	}
	defer reader.Close()
	body, err := io.ReadAll(io.LimitReader(reader, maxModelsDevSnapshotBytes+1))
	if err != nil || len(body) > maxModelsDevSnapshotBytes {
		return nil, errors.New("embedded Models.dev snapshot exceeds size limit")
	}
	return body, nil
}

func parseModelsDevSnapshot(body []byte) (modelsDevSnapshot, error) {
	var snapshot modelsDevSnapshot
	if len(body) == 0 || len(body) > maxModelsDevSnapshotBytes {
		return snapshot, errors.New("Models.dev snapshot exceeds size limit")
	}
	if err := json.Unmarshal(body, &snapshot); err != nil {
		return snapshot, fmt.Errorf("invalid Models.dev snapshot: %w", err)
	}
	if snapshot.SchemaVersion != 1 || snapshot.Source.Repository == "" || len(snapshot.Source.Commit) != 40 || snapshot.Source.SourceAt == "" || len(snapshot.Models) == 0 || len(snapshot.Models) > 12000 || len(snapshot.Providers) == 0 || len(snapshot.Providers) > 2000 {
		return snapshot, errors.New("invalid Models.dev snapshot metadata or catalogue size")
	}
	if _, err := time.Parse(time.RFC3339, snapshot.Source.SourceAt); err != nil {
		return snapshot, errors.New("invalid Models.dev snapshot source date")
	}
	count := 0
	for providerID, provider := range snapshot.Providers {
		if !validSnapshotID(providerID) || len(provider.Models) > 50000-count {
			return snapshot, errors.New("invalid Models.dev provider catalogue")
		}
		count += len(provider.Models)
	}
	for id, model := range snapshot.Models {
		if !validSnapshotID(id) || model.Resolved == nil || model.SourcePath == "" {
			return snapshot, errors.New("invalid Models.dev canonical model")
		}
	}
	for providerID, provider := range snapshot.Providers {
		for modelID, model := range provider.Models {
			if !validSnapshotID(modelID) || model.Resolved == nil || model.SourcePath == "" {
				return snapshot, fmt.Errorf("invalid Models.dev offer %s/%s", providerID, modelID)
			}
		}
	}
	return snapshot, nil
}

func validSnapshotID(id string) bool {
	return id != "" && len(id) <= 512 && strings.TrimSpace(id) == id && !strings.ContainsAny(id, "\x00\r\n")
}

func modelsDevRows(current *registry.Catalog, at string, snapshot modelsDevSnapshot) ([]registry.CatalogReference, []registry.CatalogAccess, error) {
	refs := make([]registry.CatalogReference, 0, len(snapshot.Models))
	for id, model := range snapshot.Models {
		ref := registry.CatalogReference{ID: id}
		modelsDevFields(&ref.CatalogRecord, at, model.Resolved)
		if creator := modelsDevCreator(id); creator != "" {
			putField(&ref.CatalogRecord, "models.dev", at, "creator", creator)
		}
		refs = append(refs, ref)
	}

	configured := map[string]registry.CatalogAccess{}
	if current != nil {
		for _, access := range current.Accesses {
			if access.Configured {
				configured[access.ID] = access
			}
		}
	}
	accesses := make([]registry.CatalogAccess, 0, len(configured))
	for id, old := range configured {
		provider, ok := snapshot.Providers[old.Provider]
		if !ok {
			continue
		}
		offer, ok := provider.Models[old.Model]
		if !ok {
			continue
		}
		a := registry.CatalogAccess{ID: id, Provider: old.Provider, Model: old.Model}
		var base string
		_ = json.Unmarshal(offer.Authored["base_model"], &base)
		if _, exists := snapshot.Models[base]; exists {
			a.ReferenceID = base
		}
		modelsDevFields(&a.CatalogRecord, at, authoredResolvedFields(offer.Authored, offer.Resolved))
		a.OmittedFields = omittedRegistryFields(offer.Authored["base_model_omit"])
		accesses = append(accesses, a)
	}
	return refs, accesses, nil
}

// curatedCreators names namespaces without a Models.dev provider record where title case falls short.
var curatedCreators = map[string]string{
	"aisingapore": "AI Singapore", "arcee-ai": "Arcee AI", "bytedance-seed": "ByteDance Seed", "deepreinforce": "DeepReinforce",
	"ibm": "IBM", "inclusionai": "inclusionAI", "nex-agi": "Nex AGI", "openbmb": "OpenBMB", "quiverai": "QuiverAI",
	"sdaia": "SDAIA", "swiss-ai": "Swiss AI",
}

// modelsDevProviderNames maps the embedded snapshot's provider records to their names, without
// qualifiers such as "MiniMax (minimax.io)". Parsed once: catalogue reads derive creators too.
var modelsDevProviderNames = sync.OnceValue(func() map[string]string {
	names := map[string]string{}
	body, err := embeddedModelsDevSnapshot()
	if err != nil {
		return names
	}
	snapshot, err := parseModelsDevSnapshot(body)
	if err != nil {
		return names
	}
	for id, provider := range snapshot.Providers {
		var name string
		if json.Unmarshal(provider.Resolved["name"], &name) == nil {
			name, _, _ = strings.Cut(name, " (")
			names[id] = strings.TrimSpace(name)
		}
	}
	return names
})

// modelsDevCreator names who made a Models.dev reference: Models.dev has no creator field, only
// the ID namespace (anthropic/…). Provider record name, else curated name, else title case.
func modelsDevCreator(id string) string {
	namespace, _, ok := strings.Cut(id, "/")
	if !ok || namespace == "" {
		return ""
	}
	if name := modelsDevProviderNames()[namespace]; name != "" {
		return name
	}
	if name := curatedCreators[namespace]; name != "" {
		return name
	}
	words := strings.FieldsFunc(namespace, func(r rune) bool { return r == '-' || r == '_' })
	for i, word := range words {
		first, size := utf8.DecodeRuneInString(word)
		words[i] = string(unicode.ToUpper(first)) + word[size:]
	}
	return strings.Join(words, " ")
}

func authoredResolvedFields(authored, resolved map[string]json.RawMessage) map[string]json.RawMessage {
	fields := map[string]json.RawMessage{}
	for _, key := range []string{"name", "family", "attachment", "reasoning", "tool_call", "structured_output", "temperature"} {
		if _, authored := authored[key]; authored && len(resolved[key]) > 0 {
			fields[key] = resolved[key]
		}
	}
	for _, group := range []string{"limit", "modalities", "cost"} {
		authoredGroup, resolvedGroup := object(authored[group]), object(resolved[group])
		selected := map[string]json.RawMessage{}
		for key := range authoredGroup {
			if len(resolvedGroup[key]) > 0 {
				selected[key] = resolvedGroup[key]
			}
		}
		if len(selected) > 0 {
			fields[group], _ = json.Marshal(selected)
		}
	}
	return fields
}

func modelsDevFields(record *registry.CatalogRecord, at string, row map[string]json.RawMessage) {
	putMapped(record, "models.dev", at, row, map[string]string{
		"name": "name", "family": "family", "attachment": "attachment", "reasoning": "reasoning",
		"tool_call": "tool_call", "structured_output": "structured_output", "temperature": "temperature",
	})
	putMapped(record, "models.dev", at, object(row["limit"]), map[string]string{"context": "context_length", "input": "max_input_tokens", "output": "max_output_tokens"})
	putMapped(record, "models.dev", at, object(row["modalities"]), map[string]string{"input": "input_modalities", "output": "output_modalities"})
	costs := object(row["cost"])
	for from, to := range map[string]string{"input": "input_cost_usd_per_million", "output": "output_cost_usd_per_million", "cache_read": "cache_read_cost_usd_per_million", "cache_write": "cache_write_cost_usd_per_million"} {
		if value, ok := costPerMillion(costs[from], false); ok {
			putField(record, "models.dev", at, to, value)
		}
	}
}

func omittedRegistryFields(raw json.RawMessage) []string {
	var paths []string
	_ = json.Unmarshal(raw, &paths)
	mapped := map[string]string{
		"limit.context": "context_length", "limit.input": "max_input_tokens", "limit.output": "max_output_tokens",
		"modalities.input": "input_modalities", "modalities.output": "output_modalities",
		"attachment": "attachment", "reasoning": "reasoning", "tool_call": "tool_call",
		"structured_output": "structured_output", "temperature": "temperature",
	}
	fields := make([]string, 0, len(paths))
	seen := map[string]bool{}
	for _, path := range paths {
		if field, ok := mapped[path]; ok && !seen[field] {
			fields = append(fields, field)
			seen[field] = true
		}
	}
	sort.Strings(fields)
	return fields
}
