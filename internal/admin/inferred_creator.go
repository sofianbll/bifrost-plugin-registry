package admin

import (
	"strings"
	"unicode"
)

// firstPartyCreators names the creator behind a custom provider's Bifrost base type.
var firstPartyCreators = map[string]string{"anthropic": "Anthropic", "openai": "OpenAI", "gemini": "Google"}

// vendorCreators names the creator behind an aggregator's vendor namespace ("anthropic/…", "~openai/…").
var vendorCreators = map[string]string{
	"anthropic": "Anthropic", "openai": "OpenAI", "google": "Google", "meta-llama": "Meta", "meta": "Meta",
	"mistralai": "Mistral", "x-ai": "xAI", "xai": "xAI", "deepseek": "DeepSeek", "cohere": "Cohere",
	"moonshotai": "Moonshot AI", "amazon": "Amazon", "microsoft": "Microsoft", "perplexity": "Perplexity",
}

// familyCreators names the creator of an unmistakable model name family, by the name's first word.
var familyCreators = map[string]string{
	"claude": "Anthropic", "gpt": "OpenAI", "chatgpt": "OpenAI", "o1": "OpenAI", "o3": "OpenAI", "o4": "OpenAI",
	"gemini": "Google", "gemma": "Google", "llama": "Meta", "mistral": "Mistral", "mixtral": "Mistral",
	"codestral": "Mistral", "grok": "xAI", "deepseek": "DeepSeek", "kimi": "Moonshot AI",
}

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

// nameFamilies returns the first word of the model's ID and of each native model name without its
// vendor namespace ("~anthropic/claude-opus-latest" → "claude"), and those vendors ("anthropic").
func nameFamilies(m modelDTO) (families, vendors []string) {
	names := []string{m.ID}
	for _, a := range m.Accesses {
		vendor, bare := splitVendor(a.NativeModel)
		names = append(names, bare)
		if vendor != "" {
			vendors = append(vendors, strings.ToLower(strings.TrimPrefix(vendor, "~")))
		}
	}
	for _, name := range names {
		if words := strings.FieldsFunc(strings.ToLower(name), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) }); len(words) > 0 {
			families = append(families, words[0])
		}
	}
	return families, vendors
}

// only returns the one creator table gives the keys, or "" when it gives none or several.
func only(table map[string]string, keys []string) string {
	found := ""
	for _, k := range keys {
		if c := table[k]; c != "" && found != "" && c != found {
			return ""
		} else if c != "" {
			found = c
		}
	}
	return found
}

// siblingCreators maps a name family (3 letters or more) to the creator its saved cards state, by
// hand or from a reference. A family whose cards disagree maps to "": it names no creator.
func siblingCreators(cards []modelDTO) map[string]string {
	siblings := map[string]string{}
	for _, c := range cards {
		if c.CreatorSource == "inferred" || cleanUnknown(c.Creator) == "" {
			continue
		}
		families, _ := nameFamilies(c)
		for _, f := range families {
			if prev, seen := siblings[f]; !seen && len(f) >= 3 {
				siblings[f] = c.Creator
			} else if seen && prev != c.Creator {
				siblings[f] = ""
			}
		}
	}
	return siblings
}

// inferCreator guesses the creator of a card or To add tile nothing else identifies: no reference
// creator, no manual value or clear. The first rule with a single answer wins: the aggregator's
// vendor namespace, a known model name family, the base type of the one custom provider serving
// every access, then the saved sibling cards of the same name family.
func inferCreator(m *modelDTO, providers []providerDTO, siblings map[string]string) {
	if m.CreatorSource != "" || cleanUnknown(m.Creator) != "" || len(m.Accesses) == 0 {
		return
	}
	families, vendors := nameFamilies(*m)
	creator := only(vendorCreators, vendors)
	if creator == "" {
		creator = only(familyCreators, families)
	}
	single := true
	for _, a := range m.Accesses {
		single = single && a.Provider == m.Accesses[0].Provider
	}
	for _, p := range providers {
		if creator == "" && single && p.ID == m.Accesses[0].Provider {
			creator = firstPartyCreators[strings.ToLower(p.BaseProviderType)]
		}
	}
	if creator == "" {
		creator = only(siblings, families)
	}
	if creator != "" {
		m.Creator, m.CreatorSource = creator, "inferred"
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
