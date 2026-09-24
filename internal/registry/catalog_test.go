package registry

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestCatalogReferenceOnlyAndCapacity(t *testing.T) {
	c := &Catalog{References: make([]CatalogReference, 3500)}
	for i := range c.References {
		id := fmt.Sprintf("maker/model-%04d", i)
		r := CatalogReference{ID: id}
		for field, value := range map[string]any{
			"name": fmt.Sprintf("Model %04d", i), "family": "general", "context_length": 128000,
			"input_modalities": []string{"text", "image"}, "output_modalities": []string{"text"}, "tool_call": true,
		} {
			raw, _ := json.Marshal(value)
			if r.Candidates == nil {
				r.Candidates = map[string]map[string]json.RawMessage{}
			}
			r.Candidates[field] = map[string]json.RawMessage{"models.dev": raw}
		}
		r.UpdatedAt = map[string]string{"models.dev": "2026-09-24T00:00:00Z"}
		c.References[i] = r
	}
	cfg := Config{SchemaVersion: 1, DefaultNaming: "model", Models: []Model{}, Groups: []Group{}, Policies: []Policy{}, Catalog: c}
	snap, err := Compile(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if size := len(snap.JSON()); size > MaxConfigBytes {
		t.Fatalf("3500 normalized references exceed config cap: %d", size)
	} else {
		t.Logf("3500 normalized references: %d bytes", size)
	}
	parsed, err := Parse(snap.JSON())
	if err != nil {
		t.Fatal(err)
	}
	if len(parsed.Config().Catalog.References) != 3500 {
		t.Fatal("references not durable")
	}
	if len(parsed.Plan().VirtualKeys) != 0 {
		t.Fatal("reference data created permission")
	}
}
