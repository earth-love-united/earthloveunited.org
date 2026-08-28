#!/usr/bin/env bash
# Stage the exact AI-reviewed CCI source-data release. This is a separate,
# explicitly non-human/non-legal publication lane; the signed production gate
# in build-deploy.sh is unchanged and remains unsatisfied.

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
  ""|--cci-ai-factual) ;;
  *)
    echo "usage: ./tools/build-cci-factual-public-deploy.sh [--cci-ai-factual]" >&2
    exit 2
    ;;
esac

# Cloudflare previews are public too. This authority is deliberately limited
# to the production branch; PR and branch builds remain CI artifacts.
if [ -n "${CF_PAGES_BRANCH:-}" ] && [ "$CF_PAGES_BRANCH" != "main" ]; then
  echo "CCI AI-factual deployment is permitted only for Cloudflare production branch main; refusing $CF_PAGES_BRANCH." >&2
  exit 1
fi

echo "Verifying exact CCI AI-factual profile and four-review artifact ..."
node tools/check-public-climate-release-profile.js --cci-ai-factual
node tools/check-cci-factual-public-deploy.js --self-test

echo "Cleaning $DEPLOY_DIR/ ..."
rm -rf "$DEPLOY_DIR"

echo "Fetching or verifying the pinned globe.gl runtime dependency ..."
"$REPO_ROOT/tools/fetch-globe-vendor.sh"

echo "Checking exact third-party notices ..."
node tools/check-globe-third-party-notices.js

mkdir -p "$DEPLOY_DIR"
cp THIRD_PARTY_NOTICES.txt "$DEPLOY_DIR/"

echo "Staging rights-safe AI-reviewed source-data bytes ..."
node tools/stage-cci-factual-public-deploy.js --staged "$DEPLOY_DIR"
node tools/check-cci-factual-public-deploy.js --staged "$DEPLOY_DIR"

echo "Verifying final staged AI-factual integrity ..."
exec node tools/check-staged-cci-factual-public-integrity.js --staged "$DEPLOY_DIR"
