#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════
#  build-deploy.sh — Stage a clean directory ready to deploy
# ═════════════════════════════════════════════════════════════════
#
#  Creates ./_deploy/ containing ONLY the files the browser needs:
#  HTML, CSS, JS, runtime data, textures, assets. Excludes scraper
#  pipelines, build artifacts, internal docs, .git, and bloat.
#
#  After a successful --release build only:
#    1. Open Cloudflare Pages → Create project → Upload → drag _deploy/
#    2. (or use `wrangler pages deploy _deploy --project-name earthloveunited`)
#  A --candidate build is local QA output and must never be uploaded.
#
#  Re-run any time to refresh the staging dir from the working tree.
# ═════════════════════════════════════════════════════════════════

set -euo pipefail

# Resolve repo root WITHOUT git — CI build containers (e.g. Cloudflare Pages)
# often check out files without a usable .git, which would make
# `git rev-parse` fail under `set -e`. Derive it from this script's location.
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DEPLOY_DIR="_deploy"
cleanup_failed_build() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    rm -rf "$DEPLOY_DIR"
  fi
  exit "$status"
}
trap cleanup_failed_build EXIT

ENV_DEPLOY_MODE="${ELU_DEPLOY_MODE:-}"
ARG_DEPLOY_MODE=""
case "${1:-}" in
  --candidate) ARG_DEPLOY_MODE="candidate" ;;
  --release) ARG_DEPLOY_MODE="release" ;;
  "") ;;
  *)
    echo "Unknown build mode: $1 (use --candidate or --release)" >&2
    exit 2
    ;;
esac
case "$ENV_DEPLOY_MODE" in
  ""|candidate|release) ;;
  *)
    echo "Unknown ELU_DEPLOY_MODE: $ENV_DEPLOY_MODE (use candidate or release)" >&2
    exit 2
    ;;
esac
# Every Cloudflare Pages build is externally reachable, including branch and
# pull-request previews. Until release readiness passes, none may stage the
# explicitly local-only candidate path.
if [ -n "${CF_PAGES_BRANCH:-}" ]; then
  DEPLOY_MODE="release"
elif [ -n "$ARG_DEPLOY_MODE" ] && [ -n "$ENV_DEPLOY_MODE" ] && [ "$ARG_DEPLOY_MODE" != "$ENV_DEPLOY_MODE" ]; then
  echo "Conflicting build modes: CLI=$ARG_DEPLOY_MODE ELU_DEPLOY_MODE=$ENV_DEPLOY_MODE" >&2
  exit 2
else
  DEPLOY_MODE="${ARG_DEPLOY_MODE:-$ENV_DEPLOY_MODE}"
fi
case "$DEPLOY_MODE" in
  candidate|release) ;;
  "")
    echo "Build mode is required: use --candidate for local QA or --release for production." >&2
    exit 2
    ;;
  *)
    echo "Unknown ELU_DEPLOY_MODE: $DEPLOY_MODE (use candidate or release)" >&2
    exit 2
    ;;
esac

# Remove any stale candidate/release output before a release gate can fail.
echo "🧹 Cleaning $DEPLOY_DIR/ ..."
rm -rf "$DEPLOY_DIR"

echo "📜 Verifying source third-party notices..."
node tools/check-globe-third-party-notices.js

if [ "$DEPLOY_MODE" = "release" ]; then
  echo "🔐 Enforcing production release readiness..."
  node tools/check-climate-production-readiness.js --release
else
  echo "⚠️  LOCAL QA CANDIDATE ONLY — DO NOT PUBLISH. Production use and release authority remain false."
fi

mkdir -p "$DEPLOY_DIR"

# ── Fetch or verify the gitignored globe.gl runtime dependency. The helper
#    refuses an existing mismatch and installs new bytes by atomic rename only
#    after the pinned SHA-256 passes.
echo "📦 Verifying js/vendor/globe.gl.js..."
"$REPO_ROOT/tools/fetch-globe-vendor.sh"

# ── Copy ONLY what the browser needs.
#    Order: HTML pages first, then code, then assets, then runtime data.
echo "📋 Staging files..."

# Entry-point HTML pages
cp index.html "$DEPLOY_DIR/"
[ -f gaia.html ] && cp gaia.html "$DEPLOY_DIR/" || true
cp THIRD_PARTY_NOTICES.txt "$DEPLOY_DIR/"

# PWA: service worker must live at the origin root; manifest is linked from index.html
cp sw.js manifest.json "$DEPLOY_DIR/"

# Code
cp -r js  "$DEPLOY_DIR/"
cp -r css "$DEPLOY_DIR/"

# Static assets
[ -d assets ]   && cp -r assets   "$DEPLOY_DIR/"
[ -d textures ] && cp -r textures "$DEPLOY_DIR/"

# Runtime data — use cp (no rsync dependency; CI images may lack rsync).
mkdir -p "$DEPLOY_DIR/data"
cp -r data/. "$DEPLOY_DIR/data/"
find "$DEPLOY_DIR/data" \( -name '*.bak*' -o -name '.DS_Store' \) -delete 2>/dev/null || true

# DIS knowledge JSONs + JS bridges
mkdir -p "$DEPLOY_DIR/dis"
find dis -maxdepth 1 -type f \( -name "*.js" -o -name "*.json" -o -name "*.json.gz" -o -name "*.css" \) \
  -exec cp {} "$DEPLOY_DIR/dis/" \;

# Build artifacts the runtime fetches
[ -d dist ] && cp -r dist "$DEPLOY_DIR/"

# Tools dir (in-browser dev tools loaded only on localhost via index.html)
[ -d tools ] && {
  mkdir -p "$DEPLOY_DIR/tools"
  # Only copy the in-browser tools (JS), not the bash scripts
  find tools -maxdepth 1 -type f -name "*.js" -exec cp {} "$DEPLOY_DIR/tools/" \;
}

# Holocene bifurcation page if it exists
[ -d holocene-bifurcation ] && cp -r holocene-bifurcation "$DEPLOY_DIR/"

# ── Clean up junk that may have crept in
echo "🧹 Stripping junk..."
find "$DEPLOY_DIR" -name ".DS_Store"   -delete 2>/dev/null
find "$DEPLOY_DIR" -name "Thumbs.db"   -delete 2>/dev/null
find "$DEPLOY_DIR" -name "*.bak"       -delete 2>/dev/null
find "$DEPLOY_DIR" -name "*.bak.*"     -delete 2>/dev/null
find "$DEPLOY_DIR" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
find "$DEPLOY_DIR" -name "*.pyc"       -delete 2>/dev/null

if [ "$DEPLOY_MODE" = "candidate" ]; then
  printf '%s\n' \
    'LOCAL QA CANDIDATE — DO NOT PUBLISH' \
    'Runtime image rights and third-party notices are not reviewed.' \
    'production_use_approved=false' \
    'release_authority=false' \
    > "$DEPLOY_DIR/CANDIDATE-NOT-FOR-PUBLICATION.txt"
fi

# ── Report
echo ""
echo "✅ Staging complete: $DEPLOY_DIR/"
TOTAL_SIZE=$(du -sh "$DEPLOY_DIR" | cut -f1)
TOTAL_FILES=$(find "$DEPLOY_DIR" -type f | wc -l | tr -d ' ')
echo "   Total: $TOTAL_FILES files, $TOTAL_SIZE"
echo ""
echo "Biggest files (sanity check — anything > 5MB? should be runtime knowledge data only):"
find "$DEPLOY_DIR" -type f -size +1M -exec du -h {} \; | sort -rh | head -5
echo ""
if [ "$DEPLOY_MODE" = "release" ]; then
  echo "Production readiness passed. Publish only this verified $DEPLOY_DIR directory."
else
  echo "LOCAL QA ONLY. Do not upload, deploy, or expose this candidate as a public preview."
fi

# Verify the readable notice, machine inventory, integration record, and future
# approval schema after copy and cleanup. Integrity does not grant approval.
echo "📜 Verifying final staged third-party notices..."
node tools/check-globe-third-party-notices.js --staged "$DEPLOY_DIR"

# Replace the shell with the aggregate verifier so successful shell EXIT
# handlers cannot write after verification. The verifier removes failed staged
# output; if exec itself cannot start, the existing shell EXIT trap removes it.
echo "🔐 Verifying final staged production integrity..."
exec node tools/check-staged-production-integrity.js --staged "$DEPLOY_DIR"
