#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════
#  start-mission.sh — Begin an agent mission in an isolated worktree
# ═════════════════════════════════════════════════════════════════
#
#  Creates a git worktree on a fresh mission branch, pulls latest main,
#  and logs the mission start to MISSIONS.md.
#
#  Usage:
#      ./tools/start-mission.sh <role> <slug>
#
#      <role>  one of: architect | reviewer | designer | generalist
#      <slug>  kebab-case mission name (e.g. add-events-filter)
#
#  Example:
#      ./tools/start-mission.sh generalist add-events-filter
#      → creates branch agent/generalist/add-events-filter
#      → creates worktree at ../earthloveunited-missions/add-events-filter
#      → cd into the worktree to do your work
#
#  See AGENTS.md § Operations for the full mission lifecycle.
#  See SWARM_SDK.md for the SDK architectural rules.
# ═════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Argument handling ──
if [ $# -ne 2 ]; then
  echo "Usage: $0 <role> <slug>"
  echo "  <role>  one of: architect | reviewer | designer | generalist"
  echo "  <slug>  kebab-case mission name (e.g. add-events-filter)"
  exit 1
fi

ROLE="$1"
SLUG="$2"

# ── Validate role ──
case "$ROLE" in
  architect|reviewer|designer|generalist) ;;
  *)
    echo "❌ Invalid role: $ROLE"
    echo "   Must be one of: architect | reviewer | designer | generalist"
    exit 1
    ;;
esac

# ── Validate slug (kebab-case, no spaces, no special chars) ──
if ! [[ "$SLUG" =~ ^[a-z][a-z0-9-]*[a-z0-9]$ ]]; then
  echo "❌ Invalid slug: $SLUG"
  echo "   Must be kebab-case: lowercase letters, digits, hyphens only"
  echo "   Examples: add-events-filter, refactor-globe-modes"
  exit 1
fi

# ── Locate repo root ──
REPO_ROOT="$(git rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
cd "$REPO_ROOT"

BRANCH="agent/${ROLE}/${SLUG}"
WORKTREE_DIR="../${REPO_NAME}-missions/${SLUG}"

# ── Check for collisions ──
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "❌ Branch $BRANCH already exists."
  echo "   Either delete it or pick a different slug."
  exit 1
fi

if [ -d "$WORKTREE_DIR" ]; then
  echo "❌ Worktree directory already exists: $WORKTREE_DIR"
  echo "   Either remove it (git worktree remove $WORKTREE_DIR) or pick a different slug."
  exit 1
fi

# ── Make sure main is current ──
echo "📡 Fetching latest main..."
git fetch origin main 2>/dev/null || echo "   (no remote yet — skipping fetch)"

# ── Create the worktree ──
echo "🌱 Creating worktree at $WORKTREE_DIR on branch $BRANCH..."
mkdir -p "$(dirname "$WORKTREE_DIR")"
git worktree add -b "$BRANCH" "$WORKTREE_DIR" main

# ── Install hooks in the new worktree (worktrees share .git/hooks via the
#    parent repo, but tools/install-hooks.sh is idempotent) ──
if [ -x "$WORKTREE_DIR/tools/install-hooks.sh" ]; then
  ( cd "$WORKTREE_DIR" && ./tools/install-hooks.sh ) >/dev/null
fi

# ── Log to MISSIONS.md ──
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
MISSIONS_FILE="$REPO_ROOT/MISSIONS.md"

if [ ! -f "$MISSIONS_FILE" ]; then
  cat > "$MISSIONS_FILE" <<'EOF'
# MISSIONS.md — Live kanban for agent missions

Maintained automatically by `tools/start-mission.sh` and `tools/end-mission.sh`.
Do not edit by hand.

## In Flight

| Started | Role | Slug | Branch | Status |
|---------|------|------|--------|--------|

## Completed (last 20)

| Finished | Role | Slug | PR | Outcome |
|----------|------|------|----|---------|
EOF
fi

# Insert new row under "## In Flight" header (above the next "##" heading)
python3 - "$MISSIONS_FILE" "$TIMESTAMP" "$ROLE" "$SLUG" "$BRANCH" <<'PYEOF'
import sys, pathlib
path = pathlib.Path(sys.argv[1])
ts, role, slug, branch = sys.argv[2:]
row = f"| {ts} | {role} | {slug} | `{branch}` | in-progress |\n"
lines = path.read_text().splitlines(keepends=True)
out = []
inserted = False
in_flight = False
for line in lines:
    if line.startswith("## In Flight"):
        in_flight = True
        out.append(line)
        continue
    if in_flight and line.startswith("## ") and not inserted:
        # Insert just before the next "## " heading
        if not out[-1].endswith("\n"):
            out.append("\n")
        out.append(row)
        out.append("\n")
        inserted = True
    out.append(line)
if not inserted:
    out.append(row)
path.write_text("".join(out))
PYEOF

# ── Done ──
echo ""
echo "✅ Mission started: $BRANCH"
echo "   Worktree:    $WORKTREE_DIR"
echo "   Role:        $ROLE"
echo "   Logged in:   MISSIONS.md"
echo ""
echo "Next:"
echo "   cd $WORKTREE_DIR"
echo "   # … do your work, commit normally …"
echo "   ./tools/end-mission.sh   # when done"
