.PHONY: check test ui-check script-check build serve native

check: test ui-check script-check

test:
	./scripts/test.sh

ui-check:
	cd ui && npm ci && npm run check && npm run build

script-check:
	python3 scripts/test_import_bifrost_datasheets.py
	bash -n scripts/package-release.sh packaging/test-package-release.sh

build:
	mkdir -p dist
	go build -trimpath -ldflags='-s -w' -o dist/registry ./cmd/registry

serve:
	go run ./cmd/registry serve --config configs/registry.json

native:
	@test -n "$(BIFROST_CHECKOUT)" || (echo 'Set BIFROST_CHECKOUT=/path/to/checkout'; exit 1)
	./scripts/build-with-bifrost.sh "$(BIFROST_CHECKOUT)" ./dist/native
