#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# build.sh — Earth Love United JS Bundle Builder (B1)
# Concatenates individual JS files into ordered bundles.
# No transpilation, no minification — pure concatenation.
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPTDIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPTDIR"

BUNDLE_DIR="js"

bundle() {
  local output="$1"; shift; local files=("$@")
  local tmpfile="${output}.tmp"
  echo "// ═══ BUNDLED $(basename "$output") — generated $(date -u +%Y-%m-%dT%H:%M:%SZ) ═══" > "$tmpfile"
  for f in "${files[@]}"; do
    if [ -f "$f" ]; then
      echo "// ── $(basename "$f") ──" >> "$tmpfile"; cat "$f" >> "$tmpfile"; echo "" >> "$tmpfile"
    else echo "WARNING: $f not found" >&2
    fi
  done
  mv "$tmpfile" "$output"
  echo "  ✓ $(basename "$output"): $(wc -l < "$output" | tr -d ' ') lines, $(wc -c < "$output" | tr -d ' ') bytes"
}

echo "Building bundles..."

bundle "${BUNDLE_DIR}/foundation.bundle.js" \
  "js/gaia-utils.js" "js/module-contracts.js" "js/event-bus.js" \
  "js/storage-adapter.js" "js/storage.js" "js/data-schema.js" "js/data.js"

bundle "${BUNDLE_DIR}/app.bundle.js" \
  "js/quiz.js" "js/cycle.js" "js/biomes.js" "js/counters.js" "js/scenario.js" \
  "js/globe.js" "js/globe-modes.js" "js/globe-restore.js" "js/globe-ndvi.js" \
  "js/climate-data-loader.js" "js/globe-events.js" \
  "js/gaia-legacy/gaia-data.js" "js/gaia-legacy/gaia-signals.js" "js/gaia-legacy/gaia-charts.js" \
  "js/gaia-voice.js" "js/gaia-engagement.js" "js/gaia-journal.js" "js/gaia-bubble.js" \
  "js/globe-overlay.js" "js/site-panel.js" "js/carbon-clock.js" \
  "js/country-data.js" "js/delegation.js" "js/pledge-wall.js" "js/gaia-nodes.js" \
  "js/gaia-legacy/gaia-knowledge.js" "js/gaia-overlay-knowledge.js" \
  "js/ndvi-verifier.js" "js/gaia-presence.js" "js/registry-check.js" \
  "js/module-validator.js" "js/bridge-client.js" "js/app.js"

bundle "${BUNDLE_DIR}/gaia.bundle.js" \
  "js/gaia-legacy/gaia-data.js" "js/gaia-legacy/gaia-charts.js" \
  "js/gaia-embeddings.js" "js/gaia-reranker.js" "js/gaia-retrieval.js" "js/gaia-structured.js" \
  "js/gaia-legacy/gaia-knowledge.js" "dis/gaia-voice-data.js" \
  "dis/gaia-state-machine.js" "dis/gaia-voice-engine.js" "js/gaia-journal.js" \
  "dis/gaia-quest-system.js" "dis/gaia-key-gate.js" "dis/gaia-mind.js" \
  "js/gaia-legacy/gaia-dom-adapter.js" "js/gaia-chat.js" "js/gaia-legacy/gaia-integration.js"

echo "Done."
