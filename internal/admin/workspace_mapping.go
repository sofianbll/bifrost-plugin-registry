package admin

import (
	"errors"

	"bifrost-registry/internal/registry"
)

func workspaceReferenceID(c *registry.Catalog, provider, nativeModel string) *string {
	if c == nil {
		return nil
	}
	for _, access := range c.Accesses {
		if access.ID == provider+"/"+nativeModel && access.ReferenceID != "" {
			id := access.ReferenceID
			return &id
		}
	}
	return nil
}

// A missing reference leaves the catalogue alone. An explicit empty reference
// records a manual unlink so a later source refresh cannot rematch it.
func setWorkspaceReference(cfg *registry.Config, provider, nativeModel string, referenceID *string) error {
	if referenceID == nil {
		return nil
	}
	if cfg.Catalog == nil {
		cfg.Catalog = &registry.Catalog{}
	}
	if *referenceID != "" {
		found := false
		for _, ref := range cfg.Catalog.References {
			if ref.ID == *referenceID {
				found = true
				break
			}
		}
		if !found {
			return errors.New("Unknown reference")
		}
	}
	id := provider + "/" + nativeModel
	for i := range cfg.Catalog.Accesses {
		access := &cfg.Catalog.Accesses[i]
		if access.ID == id {
			if access.ReferenceID == *referenceID {
				return nil
			}
			access.ReferenceID = *referenceID
			access.MappingManual = true
			return nil
		}
	}
	cfg.Catalog.Accesses = append(cfg.Catalog.Accesses, registry.CatalogAccess{
		ID: id, Provider: provider, Model: nativeModel, Configured: true,
		ReferenceID: *referenceID, MappingManual: true,
	})
	return nil
}
