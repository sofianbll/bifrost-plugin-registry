package admin

import "strings"

// firstPartyCreators names the creator behind a custom provider's Bifrost base type.
var firstPartyCreators = map[string]string{"anthropic": "Anthropic", "openai": "OpenAI", "gemini": "Google"}

// creatorSource says where a saved card's creator comes from. A stored value or an explicit clear
// is manual; otherwise a creator the catalogue filled is the reference's.
func creatorSource(stored, cleared, filled bool) string {
	switch {
	case stored, cleared && !filled:
		return "manual"
	case filled:
		return "reference"
	}
	return ""
}

// inferCreator guesses the creator of a card nothing else identifies: no reference on any access, no
// manual value or clear, and every access served by one custom provider with a first-party base type.
func inferCreator(m *modelDTO, providers []providerDTO) {
	if m.CreatorSource != "" || len(m.Accesses) == 0 {
		return
	}
	for _, a := range m.Accesses {
		if a.Provider != m.Accesses[0].Provider || a.ReferenceID != nil {
			return
		}
	}
	for _, p := range providers {
		if creator := firstPartyCreators[strings.ToLower(p.BaseProviderType)]; p.ID == m.Accesses[0].Provider && creator != "" {
			m.Creator, m.CreatorSource = creator, "inferred"
		}
	}
}

// persistedCreator keeps a guess or a reference's creator out of the stored card (both are read
// again on every read, so they follow a changed reference): only a typed value is stored, or the
// marker of a clear.
func persistedCreator(m modelDTO) modelDTO {
	switch {
	case m.CreatorSource == "inferred" || m.CreatorSource == "reference":
		m.Creator, m.CreatorSource = "", ""
	case cleanUnknown(m.Creator) != "" || m.CreatorSource != "manual":
		m.CreatorSource = ""
	}
	return m
}
