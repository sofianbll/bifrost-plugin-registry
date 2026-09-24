package admin

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"reflect"
	"sort"
	"strings"

	"bifrost-registry/internal/registry"
)

type snapshotExport struct {
	FormatVersion int             `json:"format_version"`
	Registry      registry.Config `json:"registry"`
}

type changeDetail struct {
	ID     string `json:"id"`
	Change string `json:"change"`
}

type changeSet struct {
	Added     int            `json:"added"`
	Updated   int            `json:"updated"`
	Removed   int            `json:"removed"`
	Details   []changeDetail `json:"details"`
	Truncated bool           `json:"truncated,omitempty"`
}

func (s *Server) snapshotHandler(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/api/snapshot":
		if !method(w, r, http.MethodGet) {
			return
		}
		snap := s.Store.Load()
		w.Header().Set("ETag", `"`+snap.Revision()+`"`)
		w.Header().Set("Content-Disposition", `attachment; filename="registry-snapshot.json"`)
		reply(w, 200, snapshotExport{1, snap.Config()})
	case "/api/snapshot.csv":
		if !method(w, r, http.MethodGet) {
			return
		}
		writeCatalogCSV(w, s.Store.Load().Config())
	case "/api/snapshot/preview", "/api/snapshot/apply":
		if !method(w, r, http.MethodPost) {
			return
		}
		apply := r.URL.Path == "/api/snapshot/apply"
		expected := strings.Trim(r.Header.Get("If-Match"), `"`)
		if apply && expected == "" {
			reply(w, 428, map[string]string{"error": "If-Match is required"})
			return
		}
		if apply && expected != s.Store.Load().Revision() {
			reply(w, 409, map[string]string{"error": registry.ErrConflict.Error()})
			return
		}
		b, err := readSnapshotJSON(w, r)
		if err != nil {
			return
		}
		candidate, source, status, err := parseSnapshot(b)
		if err != nil {
			reply(w, status, map[string]string{"error": err.Error()})
			return
		}
		current := s.Store.Load()
		if !apply {
			reply(w, 200, snapshotPreview(current, candidate, source))
			return
		}
		next, backup, err := s.Store.SaveWithBackup(candidate.JSON(), expected)
		if err != nil {
			status := 500
			if errors.Is(err, registry.ErrConflict) {
				status = 409
			}
			reply(w, status, map[string]string{"error": err.Error()})
			return
		}
		w.Header().Set("ETag", `"`+next.Revision()+`"`)
		if backup != "" {
			backup = filepath.Base(backup)
		}
		reply(w, 200, map[string]any{"revision": next.Revision(), "unchanged": next.Revision() == current.Revision(), "backup": backup})
	}
}

func readSnapshotJSON(w http.ResponseWriter, r *http.Request) ([]byte, error) {
	if t := strings.TrimSpace(strings.Split(r.Header.Get("Content-Type"), ";")[0]); t != "application/json" {
		reply(w, 415, map[string]string{"error": "application/json required"})
		return nil, errors.New("invalid media type")
	}
	b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, registry.MaxConfigBytes+1024))
	if err != nil {
		reply(w, 413, map[string]string{"error": "snapshot exceeds 4 MiB"})
		return nil, err
	}
	return b, nil
}

func parseSnapshot(b []byte) (*registry.Snapshot, string, int, error) {
	var top map[string]json.RawMessage
	if err := registry.StrictJSON(b, &top, false); err != nil || top == nil {
		return nil, "", 400, errors.New("invalid snapshot JSON")
	}
	if _, ok := top["schema_version"]; ok {
		snap, err := registry.Parse(b)
		return snap, "registry_v1", 422, err
	}
	if _, ok := top["format_version"]; !ok {
		return nil, "", 400, errors.New("unsupported snapshot format")
	}
	var wrapper struct {
		FormatVersion int             `json:"format_version"`
		Registry      json.RawMessage `json:"registry"`
	}
	if err := registry.StrictJSON(b, &wrapper, true); err != nil {
		return nil, "", 400, err
	}
	if wrapper.FormatVersion != 1 || len(wrapper.Registry) == 0 {
		return nil, "", 400, errors.New("unsupported snapshot format_version")
	}
	snap, err := registry.Parse(wrapper.Registry)
	return snap, "snapshot_v1", 422, err
}

func snapshotPreview(before, after *registry.Snapshot, source string) map[string]any {
	a, b := before.Config(), after.Config()
	changes := map[string]any{
		"default_naming": map[string]any{"before": a.DefaultNaming, "after": b.DefaultNaming, "changed": a.DefaultNaming != b.DefaultNaming},
		"models":         diffObjects(indexObjects(a.Models, func(v registry.Model) string { return v.ID }), indexObjects(b.Models, func(v registry.Model) string { return v.ID })),
		"groups":         diffObjects(indexObjects(a.Groups, func(v registry.Group) string { return v.ID }), indexObjects(b.Groups, func(v registry.Group) string { return v.ID })),
		"policies":       diffObjects(indexObjects(a.Policies, func(v registry.Policy) string { return v.VirtualKeyID }), indexObjects(b.Policies, func(v registry.Policy) string { return v.VirtualKeyID })),
	}
	old, next := a.Catalog, b.Catalog
	if old == nil {
		old = &registry.Catalog{}
	}
	if next == nil {
		next = &registry.Catalog{}
	}
	changes["references"] = diffObjects(indexObjects(old.References, func(v registry.CatalogReference) string { return v.ID }), indexObjects(next.References, func(v registry.CatalogReference) string { return v.ID }))
	changes["accesses"] = diffObjects(indexObjects(old.Accesses, func(v registry.CatalogAccess) string { return v.ID }), indexObjects(next.Accesses, func(v registry.CatalogAccess) string { return v.ID }))
	changes["sources"] = diffObjects(indexObjects(old.Sources, func(v registry.CatalogSource) string { return v.ID }), indexObjects(next.Sources, func(v registry.CatalogSource) string { return v.ID }))
	return map[string]any{"source_format": source, "current_revision": before.Revision(), "imported_revision": after.Revision(), "unchanged": before.Revision() == after.Revision(), "changes": changes}
}

func indexObjects[T any](items []T, id func(T) string) map[string]T {
	out := make(map[string]T, len(items))
	for _, item := range items {
		out[id(item)] = item
	}
	return out
}

func diffObjects[T any](before, after map[string]T) changeSet {
	out := changeSet{Details: []changeDetail{}}
	ids := make([]string, 0, len(before)+len(after))
	for id := range before {
		ids = append(ids, id)
	}
	for id := range after {
		if _, ok := before[id]; !ok {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	for _, id := range ids {
		old, had := before[id]
		next, has := after[id]
		kind := ""
		switch {
		case !had:
			out.Added++
			kind = "added"
		case !has:
			out.Removed++
			kind = "removed"
		case !reflect.DeepEqual(old, next):
			out.Updated++
			kind = "updated"
		}
		if kind != "" {
			if len(out.Details) < 40 {
				out.Details = append(out.Details, changeDetail{id, kind})
			} else {
				out.Truncated = true
			}
		}
	}
	return out
}

// The CSV is an effective, flat catalogue view. It intentionally omits
// competing candidates and cannot be imported as a Registry snapshot.
func writeCatalogCSV(w http.ResponseWriter, cfg registry.Config) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="registry-catalog.csv"`)
	c := csv.NewWriter(w)
	type row struct {
		base   []string
		fields map[string]registry.CatalogValue
	}
	rows := []row{}
	columns := map[string]bool{}
	if cfg.Catalog != nil {
		for _, ref := range cfg.Catalog.References {
			rows = append(rows, row{[]string{"reference", ref.ID, "", "", "", ""}, registry.EffectiveCatalogFields(ref.CatalogRecord)})
		}
		for _, access := range cfg.Catalog.Accesses {
			rows = append(rows, row{[]string{"access", access.ID, access.Provider, access.Model, jsonBool(access.Configured), access.ReferenceID}, registry.EffectiveCatalogFields(access.CatalogRecord)})
		}
	}
	for _, row := range rows {
		for field := range row.fields {
			columns[field] = true
		}
	}
	names := make([]string, 0, len(columns))
	for name := range columns {
		names = append(names, name)
	}
	sort.Strings(names)
	header := []string{"record_type", "id", "provider", "model", "configured", "reference_id"}
	for _, name := range names {
		header = append(header, name, name+"_source")
	}
	_ = c.Write(header)
	for _, row := range rows {
		out := make([]string, 0, len(header))
		for _, value := range row.base {
			out = append(out, csvSafe(value))
		}
		for _, name := range names {
			v := row.fields[name]
			value := string(v.Value)
			var str string
			if json.Unmarshal(v.Value, &str) == nil {
				value = str
			}
			out = append(out, csvSafe(value), v.Source)
		}
		_ = c.Write(out)
	}
	c.Flush()
}

func jsonBool(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
func csvSafe(v string) string {
	trimmed := strings.TrimLeft(v, " \t\r\n")
	if trimmed != "" && strings.ContainsRune("=+-@", rune(trimmed[0])) {
		return "'" + v
	}
	return v
}
