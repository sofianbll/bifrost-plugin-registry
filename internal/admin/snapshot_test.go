package admin

import (
	"encoding/csv"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"bifrost-registry/internal/registry"
)

func TestSnapshotLegacyImportBackupAndRepeat(t *testing.T) {
	legacy, err := os.ReadFile("../../configs/registry.demo.json")
	if err != nil {
		t.Fatal(err)
	}
	want, err := registry.Parse(legacy)
	if err != nil {
		t.Fatal("known Registry V1 fixture", err)
	}
	path := filepath.Join(t.TempDir(), "registry.json")
	initial := []byte(`{"schema_version":1,"default_naming":"provider/model","models":[],"groups":[],"policies":[]}`)
	if err := os.WriteFile(path, initial, 0600); err != nil {
		t.Fatal(err)
	}
	store, err := registry.OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(store, adminToken, nil)
	if err != nil {
		t.Fatal(err)
	}
	before := store.Load().Revision()
	if w := perform(s, "GET", "/api/snapshot", "", nil); w.Code != 401 {
		t.Fatal("unauthenticated export", w.Code)
	}
	preview := perform(s, "POST", "/api/snapshot/preview", string(legacy), authorized())
	if preview.Code != 200 {
		t.Fatal(preview.Code, preview.Body.String())
	}
	var p struct {
		SourceFormat     string `json:"source_format"`
		ImportedRevision string `json:"imported_revision"`
		Changes          struct {
			Models   changeSet `json:"models"`
			Groups   changeSet `json:"groups"`
			Policies changeSet `json:"policies"`
		} `json:"changes"`
	}
	if err := json.Unmarshal(preview.Body.Bytes(), &p); err != nil {
		t.Fatal(err)
	}
	if p.SourceFormat != "registry_v1" || p.ImportedRevision != want.Revision() || p.Changes.Models.Added != len(want.Config().Models) || p.Changes.Groups.Added != len(want.Config().Groups) || p.Changes.Policies.Added != len(want.Config().Policies) {
		t.Fatal("incorrect legacy preview", preview.Body.String())
	}
	if w := perform(s, "POST", "/api/snapshot/apply", string(legacy), authorized()); w.Code != 428 {
		t.Fatal("missing revision", w.Code)
	}
	h := authorized()
	h["If-Match"] = before
	apply := perform(s, "POST", "/api/snapshot/apply", string(legacy), h)
	if apply.Code != 200 || store.Load().Revision() != want.Revision() {
		t.Fatal(apply.Code, apply.Body.String())
	}
	var result struct {
		Revision  string `json:"revision"`
		Unchanged bool   `json:"unchanged"`
		Backup    string `json:"backup"`
	}
	if err := json.Unmarshal(apply.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result.Unchanged || result.Backup == "" || result.Revision != want.Revision() {
		t.Fatal("missing backup receipt", apply.Body.String())
	}
	backupPath := filepath.Join(filepath.Dir(path), result.Backup)
	backup, err := os.ReadFile(backupPath)
	if err != nil || string(backup) != string(initial) {
		t.Fatal("backup content", err)
	}
	if info, err := os.Stat(backupPath); err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("backup permissions", err)
	}
	if disk, err := registry.OpenStore(path); err != nil || disk.Load().Revision() != want.Revision() {
		t.Fatal("atomic import not persisted", err)
	}
	if w := perform(s, "POST", "/api/snapshot/apply", string(legacy), h); w.Code != 409 {
		t.Fatal("stale revision accepted", w.Code)
	}
	h["If-Match"] = result.Revision
	repeat := perform(s, "POST", "/api/snapshot/apply", string(legacy), h)
	if repeat.Code != 200 {
		t.Fatal(repeat.Code, repeat.Body.String())
	}
	if err := json.Unmarshal(repeat.Body.Bytes(), &result); err != nil || !result.Unchanged || result.Backup != "" {
		t.Fatal("repeat changed state or made a backup", repeat.Body.String(), err)
	}
	backups, err := filepath.Glob(filepath.Join(filepath.Dir(path), ".registry.json.backup-*"))
	if err != nil || len(backups) != 1 {
		t.Fatal("duplicate backup", backups, err)
	}
}

func TestSnapshotRoundtripCatalogAndInvalidFormats(t *testing.T) {
	s := setup(t)
	cfg := s.Store.Load().Config()
	cfg.Catalog = &registry.Catalog{
		References: []registry.CatalogReference{{ID: "ref", CatalogRecord: registry.CatalogRecord{Candidates: map[string]map[string]json.RawMessage{"name": {"models.dev": json.RawMessage(`"Automatic"`)}}, Overrides: map[string]registry.CatalogValue{"name": {Value: json.RawMessage(`"=1+1"`), Source: "manual", Kind: "declared"}}}}},
		Accesses:   []registry.CatalogAccess{{ID: "P/model", Provider: "P", Model: "model", Configured: true, ReferenceID: "ref"}},
		Sources:    []registry.CatalogSource{{ID: "models.dev", LastSuccess: "2026-09-24T00:00:00Z"}},
	}
	b, _ := json.Marshal(cfg)
	snap, err := s.Store.Save(b, s.Store.Load().Revision())
	if err != nil {
		t.Fatal(err)
	}
	exported := perform(s, "GET", "/api/snapshot", "", authorized())
	if exported.Code != 200 || exported.Header().Get("ETag") != `"`+snap.Revision()+`"` {
		t.Fatal(exported.Code)
	}
	parsed, source, status, err := parseSnapshot(exported.Body.Bytes())
	if err != nil || status != 422 || source != "snapshot_v1" || parsed.Revision() != snap.Revision() {
		t.Fatal("roundtrip lost metadata", source, err)
	}
	preview := perform(s, "POST", "/api/snapshot/preview", exported.Body.String(), authorized())
	if preview.Code != 200 || !strings.Contains(preview.Body.String(), `"unchanged":true`) {
		t.Fatal(preview.Code, preview.Body.String())
	}
	for _, input := range []string{`{"format_version":2,"registry":{}}`, `{"foo":"bar"}`, `{"format_version":1,"registry":{},"extra":1}`, `{"format_version":1,"format_version":1,"registry":{}}`} {
		if w := perform(s, "POST", "/api/snapshot/preview", input, authorized()); w.Code != 400 {
			t.Fatal("unknown format accepted", w.Code, input)
		}
	}
	if w := perform(s, "POST", "/api/snapshot/preview", `{"format_version":1,"registry":{}}`, authorized()); w.Code != 422 {
		t.Fatal("invalid Registry accepted", w.Code)
	}
	csvResponse := perform(s, "GET", "/api/snapshot.csv", "", authorized())
	if csvResponse.Code != 200 {
		t.Fatal(csvResponse.Code)
	}
	rows, err := csv.NewReader(strings.NewReader(csvResponse.Body.String())).ReadAll()
	if err != nil || len(rows) != 3 || rows[0][6] != "name" || rows[0][7] != "name_source" || rows[1][0] != "reference" || rows[1][6] != "'=1+1" || rows[1][7] != "manual" || rows[2][0] != "access" {
		t.Fatal("bad flattened CSV", rows, err)
	}
}
