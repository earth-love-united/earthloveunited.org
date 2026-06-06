#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════
#  build-deploy.sh — Stage a clean directory ready to deploy
# ═════════════════════════════════════════════════════════════════
#
#  Creates ./_deploy/ containing ONLY the files the browser needs:
#  HTML, CSS, JS, runtime data, textures, assets. Excludes scraper
#  pipelines, build artifacts, internal docs, .git, and bloat.
#
#  After running:
#    1. Open Cloudflare Pages → Create project → Upload → drag _deploy/
#    2. (or use `wrangler pages deploy _deploy --project-name earthloveunited`)
#
#  Re-run any time to refresh the staging dir from the working tree.
# ═════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DEPLOY_DIR="_deploy"

echo "🧹 Cleaning $DEPLOY_DIR/ ..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# ── Re-fetch the vendored globe.gl (it's gitignored, so working tree
#    may or may not have it).
echo "📦 Ensuring js/vendor/globe.gl.js is present..."
mkdir -p js/vendor
if [ ! -f js/vendor/globe.gl.js ]; then
  curl -fsSL https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/dist/globe.gl.min.js \
    -o js/vendor/globe.gl.js
  echo "   ✓ fetched globe.gl@2.46.1"
else
  echo "   ✓ already present"
fi

# ── Copy ONLY what the browser needs.
#    Order: HTML pages first, then code, then assets, then runtime data.
echo "📋 Staging files..."

# Entry-point HTML pages
cp index.html gaia.html "$DEPLOY_DIR/"

# Code
cp -r js  "$DEPLOY_DIR/"
cp -r css "$DEPLOY_DIR/"

# Static assets
[ -d assets ]   && cp -r assets   "$DEPLOY_DIR/"
[ -d textures ] && cp -r textures "$DEPLOY_DIR/"

# Runtime data — rsync preserves directory structure and is portable across macOS/Linux
rsync -a --exclude='*.bak*' --exclude='.DS_Store' data/ "$DEPLOY_DIR/data/"

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
echo "Next:"
echo "   Option A — Drag-and-drop:"
echo "     1. Open https://dash.cloudflare.com → Workers & Pages → Create"
echo "     2. Pages → Upload assets → drag the $DEPLOY_DIR folder"
echo "     3. Project name: earthloveunited"
echo "     4. Click Deploy"
echo ""
echo "   Option B — wrangler CLI (faster on subsequent deploys):"
echo "     npx wrangler pages deploy $DEPLOY_DIR --project-name earthloveunited"
