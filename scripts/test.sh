#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p dist/checks
go vet ./...
go test -race -count=1 -coverprofile=dist/checks/coverage.out ./... | tee dist/checks/go-tests.txt
go tool cover -func=dist/checks/coverage.out > dist/checks/coverage.txt
tail -n 1 dist/checks/coverage.txt
if command -v node >/dev/null; then node --check internal/admin/web/app.js; fi
