package admin

import (
	"fmt"
	"testing"
)

// An aggregator names models "vendor/model": the proposed common ID is the model's own name, like
// the direct provider's, and the same model through two providers is one discovered model.
func TestDiscoveryProposesNamespaceFreeCommonIDs(t *testing.T) {
	rows := []nativeModel{
		{Provider: "Claude", Name: "claude-fable-5"},
		{Provider: "openrouter", Name: "anthropic/claude-fable-5"},
		{Provider: "openrouter", Name: "~anthropic/claude-fable-latest"},
		{Provider: "openrouter", Name: "openai/gpt-5.6-luna:batch"},
		{Provider: "openrouter", Name: "deepseek/qa-reasoner"},
		// Two vendors under one bare name are two models: both keep their vendor.
		{Provider: "openrouter", Name: "meta/llama-3-70b"},
		{Provider: "openrouter", Name: "nvidia/llama-3-70b"},
		{Provider: "synthetic", Name: "plain-model"},
	}
	got := map[string][]string{}
	for _, model := range nativeToDiscovery(rows) {
		for _, access := range model.Accesses {
			got[model.ID] = append(got[model.ID], fmt.Sprintf("%s=%s", access.ID, access.NativeModel))
		}
	}
	want := map[string][]string{
		"claude-fable-5":      {"Claude/claude-fable-5=claude-fable-5", "openrouter/claude-fable-5=anthropic/claude-fable-5"},
		"claude-fable-latest": {"openrouter/claude-fable-latest=~anthropic/claude-fable-latest"},
		"gpt-5.6-luna-batch":  {"openrouter/gpt-5.6-luna-batch=openai/gpt-5.6-luna:batch"},
		"qa-reasoner":         {"openrouter/qa-reasoner=deepseek/qa-reasoner"},
		"meta-llama-3-70b":    {"openrouter/meta-llama-3-70b=meta/llama-3-70b"},
		"nvidia-llama-3-70b":  {"openrouter/nvidia-llama-3-70b=nvidia/llama-3-70b"},
		"plain-model":         {"synthetic/plain-model=plain-model"},
	}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("discovery IDs\n got %v\nwant %v", got, want)
	}
}
