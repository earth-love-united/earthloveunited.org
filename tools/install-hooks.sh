#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════
#  install-hooks.sh — Install the agent pre-commit hook
# ═════════════════════════════════════════════════════════════════
#
#  Run this once after cloning, or after pulling new hook updates.
#  It symlinks tools/agent-precommit into .git/hooks/pre-commit so
#  the hook stays version-controlled in tools/ (not lost in .git/).
#
#  Usage:
#      ./tools/install-hooks.sh
# ═════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

HOOK_SRC="$REPO_ROOT/tools/agent-precommit"
HOOK_DST="$REPO_ROOT/.git/hooks/pre-commit"

if [ ! -f "$HOOK_SRC" ]; then
  echo "❌ tools/agent-precommit not found"
  exit 1
fi

chmod +x "$HOOK_SRC"

# If something is already at .git/hooks/pre-commit and it's NOT our symlink,
# back it up.
if [ -e "$HOOK_DST" ] && [ ! -L "$HOOK_DST" ]; then
  BACKUP="$HOOK_DST.backup.$(date +%Y%m%d-%H%M%S)"
  echo "📦 Existing pre-commit found — backing up to $BACKUP"
  mv "$HOOK_DST" "$BACKUP"
fi

# Use a RELATIVE symlink target so the hook works regardless of where the
# repo lives (different machines, worktrees, containers). An absolute target
# would break the moment the repo is cloned to another path.
ln -sf ../../tools/agent-precommit "$HOOK_DST"

echo "✅ Installed: .git/hooks/pre-commit → ../../tools/agent-precommit"
echo ""
echo "Test it without committing:"
echo "   ./tools/agent-precommit"
