#!/bin/bash
# Claude Code cloud environment setup for sofianbll/bifrost-plugin-registry (spec #85).
# Paste into the environment's setup script. Runs as root before the session; must exit 0;
# keep it under ~5 minutes so the environment can be cached.
set -u
log() { echo "[setup] $*"; }

# 1. Plugins the workflow relies on: /mattpocock-skills:* (implement-spec, tdd, code-review, pr),
#    /impeccable (critique, polish, detect), ponytail. Laptop plugins never reach cloud sessions.
if command -v claude >/dev/null 2>&1; then
  for m in mattpocock/skills pbakaus/impeccable dietrichgebert/ponytail; do
    claude plugin marketplace add "$m" || log "marketplace $m: add failed"
  done
  for p in mattpocock-skills@mattpocock impeccable@impeccable ponytail@ponytail; do
    claude plugin install "$p" --yes || log "plugin $p: install failed"
  done
else
  log "claude CLI not on PATH during setup: plugins NOT installed"
fi

# 2. Chromium for the Playwright browser journeys, at the version pinned in ui/package.json.
npx -y playwright@1.63.0 install --with-deps chromium || log "playwright install failed"

exit 0
