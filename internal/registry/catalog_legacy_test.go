package registry

import (
	"encoding/json"
	"testing"
)

func TestLegacyDatasheetFieldKeepsRawTiersWithoutGrantingAccess(t *testing.T) {
	raw := json.RawMessage(`{"pricing":{"provider":"Codex","base_model":"gpt","off_peak_pricing":{"windows":[{"hours_utc":"00:00-01:00"}]}},"parameters":{"provider":"Codex","base_model":"gpt","parameters":{"reasoning":["low","high"]}}}`)
	if !CatalogValueValid("legacy_datasheet", raw) || CatalogValueValid("legacy_datasheet", json.RawMessage(`{"pricing":[]}`)) {
		t.Fatal("legacy datasheet shape")
	}
	c := Config{SchemaVersion: 1, DefaultNaming: "provider/model", Catalog: &Catalog{Accesses: []CatalogAccess{{ID: "Codex/gpt", Provider: "Codex", Model: "gpt", Configured: false, CatalogRecord: CatalogRecord{Overrides: map[string]CatalogValue{"legacy_datasheet": {Value: raw, Source: "manual", Kind: "declared"}}}}}}}
	s, err := Compile(c)
	if err != nil {
		t.Fatal(err)
	}
	if len(s.Config().Models) != 0 || len(s.Config().Policies) != 0 || s.Config().Catalog.Accesses[0].Configured {
		t.Fatal("metadata import changed routing rights")
	}
}
