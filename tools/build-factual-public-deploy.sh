#!/usr/bin/env bash
# Stage the exact reviewed factual globe for the separately governed public path.
# The full assessed-production release gate in build-deploy.sh remains unchanged.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DEPLOY_DIR="_deploy"
cleanup_failed_build() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    rm -rf "$DEPLOY_DIR"
  fi
  exit "$exit_code"
}
trap cleanup_failed_build EXIT

case "${1:-}" in
  ""|--factual-public) ;;
  *)
    echo "usage: ./tools/build-factual-public-deploy.sh [--factual-public]" >&2
    exit 2
    ;;
esac

# Cloudflare branch previews are externally reachable. This narrower path is
# production-main only; pull requests remain local/CI artifacts until merged.
if [ -n "${CF_PAGES_BRANCH:-}" ] && [ "$CF_PAGES_BRANCH" != "main" ]; then
  echo "Factual-public deployment is permitted only for the Cloudflare production branch main; refusing $CF_PAGES_BRANCH." >&2
  exit 1
fi

echo "Cleaning $DEPLOY_DIR/ ..."
rm -rf "$DEPLOY_DIR"

echo "Fetching or verifying the pinned globe.gl runtime dependency ..."
"$REPO_ROOT/tools/fetch-globe-vendor.sh"

echo "Checking exact third-party notices and factual-only readiness ..."
node tools/check-globe-third-party-notices.js
node tools/check-climate-factual-public-readiness.js

mkdir -p "$DEPLOY_DIR"
cp THIRD_PARTY_NOTICES.txt "$DEPLOY_DIR/"

# The existing release surface is the marker-free browser allowlist. This does
# not invoke or relax assessed production readiness; the new aggregate gate
# below supplies the narrower factual-only authority boundary.
echo "Staging the exact marker-free browser allowlist ..."
node tools/stage-public-deploy.js --staged "$DEPLOY_DIR" --mode release
node tools/check-public-deploy-surface.js --staged "$DEPLOY_DIR" --mode release

echo "Verifying final factual-public bytes ..."
exec node tools/check-staged-factual-public-integrity.js --staged "$DEPLOY_DIR"
