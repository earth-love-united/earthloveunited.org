#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════
#  end-mission.sh — Finalize a mission, run checks, open a PR
# ═════════════════════════════════════════════════════════════════
#
#  Run from inside a mission worktree (the one created by start-mission.sh).
#
#  What it does:
#    1. Detects you're on an agent/<role>/<slug> branch
#    2. Runs the SDK validators locally (verify_load_order + node --check)
#    3. Pushes the branch to origin
#    4. Opens a PR via the gh CLI with a structured body
#    5. Labels the PR `auto-merge` unless protected files were touched
#    6. Updates MISSIONS.md to mark the mission complete
#    7. Returns the PR URL
#
#  Requirements: `gh` CLI installed and authenticated (`gh auth login`).
#
#  See AGENTS.md § Operations for the mission lifecycle.
#  See SWARM_SDK.md for the architectural rules being validated.
# ═════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ── Detect branch + role + slug ──
BRANCH="$(git branch --show-current)"
if ! [[ "$BRANCH" =~ ^agent/([a-z]+)/([a-z][a-z0-9-]+)$ ]]; then
  echo "❌ Not on an agent mission branch (current: $BRANCH)"
  echo "   Mission branches must match: agent/<role>/<slug>"
  exit 1
fi
ROLE="${BASH_REMATCH[1]}"
SLUG="${BASH_REMATCH[2]}"

# ── Ensure working tree is committed ──
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "❌ Working tree is not clean. Commit your changes first."
  git status --short
  exit 1
fi

if [ -z "$(git log main..HEAD --oneline 2>/dev/null)" ]; then
  echo "❌ No commits on this branch beyond main. Nothing to merge."
  exit 1
fi

# ── Run the SDK validators ──
echo ""
echo "🔍 Step 1/4 — verify_load_order (script DAG)"
if ! python3 scripts/verify_load_order.py; then
  echo "❌ Load order DAG broken — fix before opening PR"
  exit 1
fi

echo ""
echo "🔍 Step 2/4 — node --check on every JS file touched in this mission"
CHANGED_JS=$(git diff --name-only main..HEAD -- '*.js' || true)
if [ -n "$CHANGED_JS" ]; then
  echo "$CHANGED_JS" | while read -r f; do
    if [ -f "$f" ]; then
      if ! node --check "$f" 2>&1; then
        echo "❌ Syntax error in $f — fix before opening PR"
        exit 1
      fi
    fi
  done
fi

# ── Detect protected file touches ──
echo ""
echo "🔍 Step 3/4 — protected file scan"
PROTECTED_PATTERN='^(LICENSE|CREDITS\.md|CODE_OF_CONDUCT\.md|CONTRIBUTING\.md|AGENTS\.md|ARCHITECTURE\.md|README\.md|SWARM_SDK\.md|OPERATIONS\.md|\.github/|\.gitignore|js/gaia-utils\.js|js/module-contracts\.js|js/module-validator\.js|js/app\.js|js/event-bus\.js|js/storage-adapter\.js|js/modules/|infra/|scripts/verify_load_order\.py|tools/agent-precommit|tools/install-hooks\.sh|tools/start-mission\.sh|tools/end-mission\.sh)'
PROTECTED_TOUCHED=$(git diff --name-only main..HEAD | grep -E "$PROTECTED_PATTERN" || true)

if [ -n "$PROTECTED_TOUCHED" ]; then
  echo "⚠️  Protected files touched (will require human review):"
  echo "$PROTECTED_TOUCHED" | sed 's/^/   - /'
  AUTOMERGE_LABEL=""
else
  echo "🟢 No protected files touched — eligible for auto-merge"
  AUTOMERGE_LABEL="auto-merge"
fi

# ── Push the branch ──
echo ""
echo "🔍 Step 4/4 — push to origin"
git push -u origin "$BRANCH"

# ── Build the PR body ──
CHANGED_FILES_COUNT=$(git diff --name-only main..HEAD | wc -l | tr -d ' ')
COMMITS_LIST=$(git log main..HEAD --format='- %s' | head -20)

PR_BODY=$(cat <<EOF
## Mission summary

**Role:** \`$ROLE\`
**Slug:** \`$SLUG\`
**Files touched:** $CHANGED_FILES_COUNT
**Protected files:** $([ -n "$PROTECTED_TOUCHED" ] && echo "yes — human review required" || echo "no — eligible for auto-merge")

## Commits

$COMMITS_LIST

## Checks (run locally by end-mission.sh)

- ✅ \`scripts/verify_load_order.py\` — script DAG load order verified
- ✅ \`node --check\` — JS syntax verified for all touched files
- ✅ Pre-commit hook — passed on every commit (DAG + secrets + size + signature)

## Files touched

\`\`\`
$(git diff --name-only main..HEAD)
\`\`\`

---

*This PR was opened by \`tools/end-mission.sh\`. See AGENTS.md § Operations for the lifecycle.*
EOF
)

# ── Open the PR ──
echo ""
echo "📤 Opening PR..."
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ gh CLI not installed. Install with: brew install gh"
  echo "   Then run: gh auth login"
  echo ""
  echo "Branch pushed to origin. Open PR manually:"
  REMOTE_URL=$(git remote get-url origin 2>/dev/null | sed 's|git@github.com:|https://github.com/|; s|\.git$||')
  echo "   $REMOTE_URL/pull/new/$BRANCH"
  exit 0
fi

PR_TITLE="$(git log -1 --format=%s)"
PR_URL=$(gh pr create \
  --title "$PR_TITLE" \
  --body "$PR_BODY" \
  --base main \
  --head "$BRANCH" \
  ${AUTOMERGE_LABEL:+--label "$AUTOMERGE_LABEL"})

# ── Update MISSIONS.md ──
TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
python3 - "$REPO_ROOT/MISSIONS.md" "$ROLE" "$SLUG" "$BRANCH" "$TIMESTAMP" "$PR_URL" <<'PYEOF'
import sys, pathlib, re
path = pathlib.Path(sys.argv[1])
role, slug, branch, ts, pr_url = sys.argv[2:]
if not path.exists():
    sys.exit(0)
text = path.read_text()
# Remove the in-flight row
text = re.sub(
    rf"^\| .*? \| {re.escape(role)} \| {re.escape(slug)} \| `{re.escape(branch)}` \| .* \|\n",
    "",
    text,
    flags=re.MULTILINE,
)
# Insert a completed row under "## Completed" header
new_row = f"| {ts} | {role} | {slug} | {pr_url} | pending-review |\n"
lines = text.splitlines(keepends=True)
out, inserted, in_completed = [], False, False
for line in lines:
    if line.startswith("## Completed"):
        in_completed = True
        out.append(line)
        continue
    if in_completed and line.startswith("| ---") and not inserted:
        out.append(line)
        out.append(new_row)
        inserted = True
        continue
    out.append(line)
if not inserted:
    out.append(new_row)
path.write_text("".join(out))
PYEOF

# ── Done ──
echo ""
echo "✅ Mission complete: $SLUG"
echo "   Branch:  $BRANCH"
echo "   PR:      $PR_URL"
echo "   Status:  $([ -n "$AUTOMERGE_LABEL" ] && echo "labelled auto-merge — will merge when CI green" || echo "pending human review (protected files touched)")"
echo ""
echo "When the PR is merged, run:"
echo "   git worktree remove $REPO_ROOT  # remove this mission's worktree"
