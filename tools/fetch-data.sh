#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  fetch-data.sh — pull Earth Love United datasets from Hugging Face
# ─────────────────────────────────────────────────────────────
#
#  The heavy data files (climate corpus, carbon project records) are NOT
#  in this git repo. They live on Hugging Face under CC BY 4.0 and are
#  fetched on demand by this script.
#
#  Usage:
#      ./tools/fetch-data.sh              # fetches everything
#      ./tools/fetch-data.sh climate       # only climate-knowledge
#      ./tools/fetch-data.sh carbon        # only carbon projects
#
#  Requirements:
#      pip install huggingface_hub
#  or:
#      brew install huggingface-cli  (macOS)
#
#  Datasets:
#    https://huggingface.co/datasets/ego0op/earth-love-united-climate-knowledge
#    https://huggingface.co/datasets/ego0op/carbon-projects-unified
#    https://huggingface.co/datasets/ego0op/earth-love-united-carbon-projects
#
# ─────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Verify huggingface-cli is available
if ! command -v huggingface-cli >/dev/null 2>&1; then
  echo "❌ huggingface-cli not found."
  echo "   Install with:  pip install --upgrade huggingface_hub"
  exit 1
fi

WHAT="${1:-all}"

fetch_climate() {
  echo "→ Fetching ego0op/earth-love-united-climate-knowledge…"
  mkdir -p climate-dataset/data/processed
  huggingface-cli download ego0op/earth-love-united-climate-knowledge \
    --repo-type dataset \
    --local-dir climate-dataset/data/processed \
    --local-dir-use-symlinks False
  echo "✓ climate corpus ready in climate-dataset/data/processed/"
}

fetch_carbon() {
  echo "→ Fetching ego0op/carbon-projects-unified…"
  mkdir -p carbon-projects/unified
  huggingface-cli download ego0op/carbon-projects-unified \
    --repo-type dataset \
    --local-dir carbon-projects/unified \
    --local-dir-use-symlinks False
  echo "✓ carbon projects ready in carbon-projects/unified/"
}

case "$WHAT" in
  climate) fetch_climate ;;
  carbon)  fetch_carbon ;;
  all)     fetch_climate; fetch_carbon ;;
  *) echo "Usage: $0 [climate|carbon|all]"; exit 1 ;;
esac

echo ""
echo "✅ Done. Datasets fetched from Hugging Face under CC BY 4.0."
echo "   See CREDITS.md for attribution and citation information."
