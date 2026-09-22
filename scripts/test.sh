#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p reports
go vet ./...
go test -race -count=1 -coverprofile=reports/coverage.out -json ./... > reports/go-tests.jsonl
go tool cover -func=reports/coverage.out > reports/coverage.txt
if command -v node >/dev/null; then node --check internal/admin/web/app.js; fi
python3 - <<'PY'
import json,pathlib
p=pathlib.Path('reports');events=[json.loads(x) for x in (p/'go-tests.jsonl').read_text().splitlines()]
tests=[x for x in events if x.get('Action')=='pass' and x.get('Test')]
leaf=[x for x in tests if not any(y['Package']==x['Package'] and y['Test'].startswith(x['Test']+'/') for y in tests)]
summary={'passed_leaf_tests_and_fuzz_seeds':len(leaf),'failed_tests':[x for x in events if x.get('Action')=='fail'],'race_detector':True,'native_adapter_included':False,'native_build':'not_run_by_this_script','live_bifrost_tests':'not_run_by_this_script','coverage_summary':(p/'coverage.txt').read_text().splitlines()[-1]}
(p/'local-tests-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
PY
