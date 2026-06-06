#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════
#  org-setup.sh — one-shot GitHub org/repo configuration for ELU
# ═════════════════════════════════════════════════════════════════
#
#  Run this ONCE, from any machine that can reach api.github.com
#  (e.g. your Mac — Claude's sandbox cannot reach the GitHub API).
#
#  It is idempotent: safe to re-run. It configures:
#    1. Teams:  architects, reviewers, maintainers
#    2. Repo access for those teams
#    3. Repo merge settings (squash-only, delete branch on merge)
#    4. Branch protection on main (require CI + code-owner review)
#
#  Usage:
#    GH_TOKEN=ghp_xxx ./tools/org-setup.sh
#      (or: ./tools/org-setup.sh ghp_xxx)
#
#  Requires: bash + curl. No gh CLI needed.
# ═════════════════════════════════════════════════════════════════
set -uo pipefail

ORG="earth-love-united"
REPO="earthloveunited.org"
ADMIN="elu-foundation"               # org owner account, added to every team
TEAMS=(architects reviewers maintainers)

# CI job names from .github/workflows/ci.yml — these are the required checks
CHECK1="SDK static checks"
CHECK2="Headless SmokeTest + StackLint"

TOKEN="${GH_TOKEN:-${1:-}}"
if [ -z "$TOKEN" ]; then
  echo "❌ No token. Run:  GH_TOKEN=ghp_xxx ./tools/org-setup.sh"
  exit 1
fi

API="https://api.github.com"
AUTH=(-H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json")

# api METHOD PATH [json-body]  -> prints "HTTP <code>"
api() {
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -o /tmp/elu_api_out -w "%{http_code}" -X "$method" "${AUTH[@]}")
  [ -n "$body" ] && args+=(-d "$body")
  local code
  code=$(curl "${args[@]}" "$API$path")
  echo "$code"
}

echo "════ verifying token ════"
SCOPES=$(curl -sS -I "${AUTH[@]}" "$API/user" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-oauth-scopes"{print $2}')
WHO=$(curl -sS "${AUTH[@]}" "$API/user" | grep -o '"login": *"[^"]*"' | head -1 | cut -d'"' -f4)
echo "  authenticated as: ${WHO:-UNKNOWN}"
echo "  token scopes:     ${SCOPES:-<none>}"
echo "  (need: repo, workflow, admin:org)"
echo

echo "════ 1/4 teams ════"
for t in "${TEAMS[@]}"; do
  code=$(api POST "/orgs/$ORG/teams" "{\"name\":\"$t\",\"privacy\":\"closed\"}")
  case "$code" in
    201) echo "  created team: $t" ;;
    422) echo "  team exists:  $t" ;;
    *)   echo "  ⚠️  team $t -> HTTP $code: $(cat /tmp/elu_api_out)" ;;
  esac
  # add ADMIN to the team as maintainer
  code=$(api PUT "/orgs/$ORG/teams/$t/memberships/$ADMIN" '{"role":"maintainer"}')
  echo "     + $ADMIN membership -> HTTP $code"
done
echo

echo "════ 2/4 repo access for teams ════"
# bash 3.2 (macOS default) has no associative arrays — use a case instead.
# maintainers: admin; everyone else: push
team_perm() { case "$1" in maintainers) echo admin ;; *) echo push ;; esac; }
for t in "${TEAMS[@]}"; do
  p=$(team_perm "$t")
  code=$(api PUT "/orgs/$ORG/teams/$t/repos/$ORG/$REPO" "{\"permission\":\"$p\"}")
  echo "  $t -> $p : HTTP $code"
done
echo

echo "════ 3/4 repo merge settings ════"
code=$(api PATCH "/repos/$ORG/$REPO" '{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "delete_branch_on_merge": true,
  "allow_auto_merge": true,
  "default_branch": "main"
}')
echo "  settings -> HTTP $code"
echo

echo "════ 4/4 branch protection on main ════"
read -r -d '' PROT <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["$CHECK1", "$CHECK2"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
JSON
code=$(api PUT "/repos/$ORG/$REPO/branches/main/protection" "$PROT")
echo "  branch protection -> HTTP $code"
[ "$code" != "200" ] && echo "    response: $(cat /tmp/elu_api_out)"
echo

echo "✅ done. Re-run anytime — it's idempotent."
echo "   Verify: https://github.com/$ORG/$REPO/settings/branches"
rm -f /tmp/elu_api_out
