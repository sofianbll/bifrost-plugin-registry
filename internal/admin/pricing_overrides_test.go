package admin

import (
	"encoding/json"
	"testing"
)

// Bifrost serialises the pricing patch as the JSON string "pricing_patch" in the
// override list, and as a "patch" object in /api/models/details. Read-back must
// see the values in both shapes or it reports a drift that is not there.
func TestNativePricingOverrideUnmarshalPatchShapes(t *testing.T) {
	var fromList nativePricingOverride
	if err := json.Unmarshal([]byte(`{"id":"po-1","name":"registry/p/k/m","scope_kind":"provider_key","provider_key_id":"k","match_type":"exact","pattern":"m","pricing_patch":"{\"input_cost_per_token\":0.0000015}"}`), &fromList); err != nil {
		t.Fatal(err)
	}
	if fromList.Patch["input_cost_per_token"] != 0.0000015 {
		t.Fatalf("pricing_patch string not decoded: %+v", fromList.Patch)
	}
	if fromList.KeyID != "k" || fromList.Pattern != "m" || fromList.ScopeKind != "provider_key" {
		t.Fatalf("scalar fields lost: %+v", fromList)
	}

	var fromDetails nativePricingOverride
	if err := json.Unmarshal([]byte(`{"id":"po-1","patch":{"input_cost_per_token":0.0000015}}`), &fromDetails); err != nil {
		t.Fatal(err)
	}
	if fromDetails.Patch["input_cost_per_token"] != 0.0000015 {
		t.Fatalf("patch object not decoded: %+v", fromDetails.Patch)
	}

	want := pricingOverride{Name: fromList.Name, Provider: "p", KeyID: "k", Pattern: "m", InputCost: ptr(0.0000015)}
	if !pricingPatchMatches(want, fromList.Patch) {
		t.Fatalf("read-back mismatch on a matching patch: %+v", fromList.Patch)
	}
}

func ptr(f float64) *float64 { return &f }
