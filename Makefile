.PHONY: check verify test ui-check script-check lint build serve native hooks

check: test ui-check script-check

# make check, then the browser journeys only if it passed; logs in dist/checks/verify/, one VERIFY PASSED or FAILED line.
verify:
	./scripts/verify.sh

test:
	./scripts/test.sh

ui-check:
	cd ui && npm ci && npm run check && npm run format:check && npm run build

script-check:
	python3 scripts/test_import_bifrost_datasheets.py
	for f in scripts/*.sh packaging/*.sh; do bash -n "$$f" || exit 1; done
	bash scripts/test-github-setup.sh
	bash scripts/test-verify.sh
	bash scripts/test-test-copy-install.sh
	bash scripts/check-case-collisions.sh
	@if command -v bun >/dev/null 2>&1 && [ -d dist/models-dev-upstream ]; then \
		bun scripts/build-modelsdev-snapshot.test.ts; \
	else \
		echo "skip: models.dev snapshot determinism (bun or dist/models-dev-upstream missing)"; \
	fi

# actionlint (it also runs shellcheck on every `run:` block) and shellcheck on the repo's scripts.
# Both come from one image pinned by digest, so a local run and CI see the same findings.
LINT_IMAGE = rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667
lint:
	docker run --rm -v "$$PWD:/repo" -w /repo $(LINT_IMAGE)
	docker run --rm --entrypoint shellcheck -v "$$PWD:/repo" -w /repo $(LINT_IMAGE) -S warning $$(git ls-files '*.sh')

build:
	mkdir -p dist
	go build -trimpath -ldflags='-s -w' -o dist/registry ./cmd/registry

serve:
	go run ./cmd/registry serve --config configs/registry.json

native:
	@test -n "$(BIFROST_CHECKOUT)" || (echo 'Set BIFROST_CHECKOUT=/path/to/checkout'; exit 1)
	./scripts/build-with-bifrost.sh "$(BIFROST_CHECKOUT)" ./dist/native

hooks:
	git config core.hooksPath .githooks
	git config blame.ignoreRevsFile .git-blame-ignore-revs
