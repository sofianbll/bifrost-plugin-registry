.PHONY: test build serve native

test:
	./scripts/test.sh

build:
	mkdir -p dist
	go build -trimpath -ldflags='-s -w' -o dist/registry ./cmd/registry

serve:
	go run ./cmd/registry serve --config configs/registry.json

native:
	@test -n "$(BIFROST_CHECKOUT)" || (echo 'Set BIFROST_CHECKOUT=/path/to/checkout'; exit 1)
	./scripts/build-with-bifrost.sh "$(BIFROST_CHECKOUT)" ./dist/native
