# Going Public — Step-by-Step

> This file exists only for the launch. **Delete it after the first push.**
> It walks you through the fresh-history reset, the GitHub repo creation,
> and the Cloudflare Pages connection. Run the commands in order from your
> Mac terminal (not from inside Claude — the sandbox can't do destructive
> git ops safely).

---

## Pre-flight (1 minute)

```bash
cd ~/earthloveunited.org

# Sanity: confirm you are on main and aware of what's there
git branch --show-current   # should print: main
git log --oneline | wc -l    # should print: 32
git status --short           # current changes (about 4 modified + 1 untracked)
```

If there is a leftover lock file from earlier in this session, remove it:

```bash
rm -f .git/packed-refs.lock .git/refs/tags/pre-public-archive-test.lock
git tag -d pre-public-archive-test 2>/dev/null   # ignore "not found"
```

---

## Step 1 — Safety net

Tag the current state. If anything goes wrong, you can recover from this tag.

```bash
git add -A
git commit -m "wip: pre-public checkpoint" --no-verify
git tag pre-public-archive
```

(If `git commit` says "nothing to commit", that's fine — proceed.)

If you want to **also** keep the old history as a separate branch for your
own reference:

```bash
git branch legacy-history-32-commits
```

---

## Step 2 — Verify the .gitignore behaviour

**Important git fact:** `.gitignore` only excludes *untracked* files. Files
that are already in git's index are tracked regardless of `.gitignore`.
That's why the bloat is still showing up in current `git ls-files` — and
why we need the orphan branch in Step 3. The orphan branch starts from an
empty index, so the new `.gitignore` takes full effect.

You can simulate what the fresh branch *would* include like this:

```bash
# This shows what 'git add -A' on a clean index would pick up.
# It should NOT list any climate-dataset/data/processed/*, agents-insights/*,
# or carbon-projects/unified/carbon_projects_v*.jsonl entries.
GIT_INDEX_FILE=/tmp/test-index git read-tree --empty
GIT_INDEX_FILE=/tmp/test-index git add -A --dry-run 2>&1 | \
  grep -E "(earth_love_united_climate_knowledge|agents-insights|carbon_projects_v[0-9])" \
  && echo "❌ bloat would slip through — investigate .gitignore" \
  || echo "✓ orphan branch will exclude all the bloat"
rm -f /tmp/test-index
```

The expected output is the `✓` line.

---

## Step 3 — Fresh history (the destructive step)

This squashes all 32 commits into a single, clean v1.0 initial commit.
**The `pre-public-archive` tag above is your safety net.**

```bash
# Create a new orphan branch (no history)
git checkout --orphan v1-public

# Stage everything (will respect the new .gitignore)
git add -A

# Verify nothing huge sneaks in
git diff --cached --stat | tail -5
# Total "insertions" should be small (under ~50,000). If you see 500k+,
# something big slipped past .gitignore — abort with `git checkout main`
# and investigate before continuing.

# Commit
git commit -m "feat: initial public release of Earth Love United (v1.0)

A bare-metal foundation website with an interactive 3D globe, a grounded
climate-science RAG agent (Gaia), and a community pledge wall.

Companion datasets on Hugging Face:
- ego0op/earth-love-united-climate-knowledge
- ego0op/carbon-projects-unified
- ego0op/earth-love-united-carbon-projects

Built with Claude, Hermes, and Owl alpha. Co-development of code by humans
and agents is documented in [AGENTS.md](../../AGENTS.md) and
[CONTRIBUTING.md](../../CONTRIBUTING.md).

See CREDITS.md for full third-party attribution."

# Replace main with this new clean history
git branch -M v1-public main

# Verify
git log --oneline   # should print exactly ONE commit
du -sh .git         # should be MUCH smaller than 226M
```

Garbage-collect the old objects (drops the 226MB pack down to ~10MB):

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
du -sh .git   # should now be <20MB
```

---

## Step 4 — Create the GitHub repo

In your browser:

1. Go to https://github.com/new
2. **Owner:** your personal account `gke0op` for now (you can transfer to
   an org later — see "Transferring to an org" below).
3. **Repository name:** `earthloveunited.org`
4. **Description:** `Open-source foundation website for global climate action — bare-metal, no build step.`
5. **Public** ✅
6. **Do NOT initialize** with README, .gitignore, or license — we already have them.
7. Click **Create repository**.

GitHub will show you a URL like `git@github.com:gke0op/earthloveunited.org.git`
(SSH) or `https://github.com/gke0op/earthloveunited.org.git` (HTTPS). Copy
the SSH one if you have an SSH key set up; otherwise use HTTPS.

---

## Step 5 — Push

```bash
git remote add origin git@github.com:gke0op/earthloveunited.org.git
# (or: https://github.com/gke0op/earthloveunited.org.git)

git push -u origin main
```

If it succeeds, you should see:

```
Enumerating objects: ~500, done.
...
To github.com:gke0op/earthloveunited.org.git
 * [new branch]      main -> main
branch 'main' set up to track 'origin/main' from 'origin'.
```

**If GitHub rejects the push with a "file > 100MB" error**, the .gitignore
didn't catch something. Don't force-push. Run:

```bash
git ls-files | xargs du -k 2>/dev/null | sort -rn | head -10
```

Identify the offending file, add it to `.gitignore`, then:

```bash
git rm --cached <path/to/file>
git commit --amend --no-edit
git push -u origin main
```

---

## Step 5b — Lock down `main` (branch protection)

**Do this immediately after the first successful push, before any agent runs a mission.**

In your browser:

1. Go to `https://github.com/gke0op/earthloveunited.org/settings/branches`
2. Click **Add branch protection rule**
3. **Branch name pattern:** `main`
4. Enable:
   - ✅ **Require a pull request before merging**
   - ✅ **Require approvals** — 1 approval
   - ✅ **Require review from Code Owners** ← this enforces `.github/CODEOWNERS`
   - ✅ **Require status checks to pass before merging**
     - Select the `static` and `smoke` checks from the `ci` workflow (they'll show up after CI runs once)
   - ✅ **Require branches to be up to date before merging**
   - ✅ **Do not allow bypassing the above settings** (applies to admins too)
   - ✅ **Restrict who can push to matching branches** — leave empty (no one pushes directly)
5. Disable:
   - ❌ **Allow force pushes**
   - ❌ **Allow deletions**
6. Click **Create** / **Save changes**

This is the **mathematical guarantee** that a 10-hour OWL run cannot damage `main`. Worst case it creates a garbage branch you delete with one command.

## Step 5c — Install the local pre-commit hook

From your Mac terminal:

```bash
cd ~/earthloveunited.org
./tools/install-hooks.sh
```

This symlinks `tools/agent-precommit` into `.git/hooks/pre-commit` so every local commit runs the four-layer check (DAG + secrets + size + signature). Re-run this after any pull that updates the hook.

Tell each agent that runs missions to also run this command on their first checkout. `start-mission.sh` re-installs it automatically inside each worktree, so day-two missions don't need to remember.

## Step 6 — Cloudflare Pages connection

In your browser:

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create**
2. Select **Pages** → **Connect to Git**
3. Authorize Cloudflare for the GitHub repo `earth-love-united/earthloveunited.org`
4. **Project name:** select the existing Earth Love United Pages project; do
   not create a second production project to change build settings
5. **Production branch:** `main`
6. **Framework preset:** **None**
7. **Build command:** `./tools/build-deploy.sh --release`
8. **Build output directory:** `_deploy`
9. **Environment variables:** none needed
10. Click **Save and Deploy**

The build command reproducibly fetches `globe.gl@2.46.1`, refuses any SHA-256
mismatch, verifies the exact source notice artifacts, stages only browser files
in `_deploy`, then finishes with the aggregate verifier. That last command
reruns CT-45/notices and rehashes the trust registry, footer, and any detached
approval/signature pair after every staged write. First
deploy takes about 30 seconds. Subsequent commits to `main` auto-deploy.
Notice integrity does not confer rights approval; the production gate still requires
five asset-specific rights dispositions and the three-role signed approval described
in `docs/CLIMATE-PRODUCTION-READINESS.md`.

These Pages settings live outside this repository. A maintainer must confirm
the production project uses this exact command and output directory before the
dependency-delivery gate can be considered operational in production.

Public PR preview builds intentionally run the same `--release` gate and remain
blocked while runtime image rights, complete third-party notices, CT-40, or any
other production input is unresolved. Use
`./tools/build-deploy.sh --candidate` only for local QA; its output carries a
`CANDIDATE-NOT-FOR-PUBLICATION.txt` marker and must not be uploaded or shared as
a public preview.

CT-45 now pins the dark surface to the byte-for-byte NASA Earth Observatory
Black Marble 2012 JPEG and the sky to a deterministic repository-authored SVG.
This closes the previous origin ambiguity and records NASA acknowledgement and
no-endorsement terms, but it is provenance remediation only. Human runtime
rights review, production approval, and release authority remain false.

The protected Ed25519 registry is intentionally empty and `unprovisioned`.
Future release work must provision real public keys for the asset-rights,
licensing-counsel, and release-authorizer roles through maintainer review, keep
all private keys offline, bind the exact registry/approval/commit hashes, and
commit only the detached signatures. Follow the sequence and exact signing
message in `docs/CLIMATE-PRODUCTION-READINESS.md`; never edit `_deploy` after
the final aggregate check.

The existing crypto-token site on `elu-website.pages.dev` is untouched.

---

## Step 7 — Verify the live site

```bash
# Wait ~30 seconds after the Cloudflare deploy
curl -I https://earthloveunited.pages.dev
# → expect: HTTP/2 200

curl -I https://earthloveunited.pages.dev/js/vendor/globe.gl.js
# → expect: HTTP/2 200 (generated by the verified build command)

curl -I https://earthloveunited.pages.dev/THIRD_PARTY_NOTICES.txt
# → expect: HTTP/2 200 (same-origin public notice linked from the footer)

# Verify the deployed response body, not only its HTTP status.
VENDOR_FILE="$(mktemp)"
curl -fsSL --proto '=https' --proto-redir '=https' --tlsv1.2 \
  https://earthloveunited.pages.dev/js/vendor/globe.gl.js \
  -o "$VENDOR_FILE"
if command -v sha256sum >/dev/null 2>&1; then
  VENDOR_SHA256="$(sha256sum "$VENDOR_FILE" | awk '{print $1}')"
else
  VENDOR_SHA256="$(shasum -a 256 "$VENDOR_FILE" | awk '{print $1}')"
fi
test "$VENDOR_SHA256" = "2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a"
rm -f "$VENDOR_FILE"
# → expect: no output and exit status 0

NOTICE_FILE="$(mktemp)"
curl -fsSL --proto '=https' --proto-redir '=https' --tlsv1.2 \
  https://earthloveunited.pages.dev/THIRD_PARTY_NOTICES.txt \
  -o "$NOTICE_FILE"
if command -v sha256sum >/dev/null 2>&1; then
  NOTICE_SHA256="$(sha256sum "$NOTICE_FILE" | awk '{print $1}')"
else
  NOTICE_SHA256="$(shasum -a 256 "$NOTICE_FILE" | awk '{print $1}')"
fi
test "$NOTICE_SHA256" = "741fc18dfd4b0916884cbad6b4dddd3466b7e2399186e5dcd7ff555e482fd0f2"
rm -f "$NOTICE_FILE"
# → expect: no output and exit status 0
```

Open the URL in a browser. Open the JavaScript console. You should see:

```
✅ [BOOT] N/N modules loaded
✅ [BOOT] N CSS stacking checks passed
```

The globe should render. The body-digest command above must also exit 0; a 200
response alone does not prove that Cloudflare served the approved bytes. When
WebGL or the library is unavailable, the tested
accessible factual fallback should appear instead. If the generated vendor URL
returns 404 or its digest differs, inspect the Cloudflare build log and confirm
that the external project settings exactly use `./tools/build-deploy.sh --release` and
`_deploy`. Do not bypass the verified local path with a runtime CDN URL, and do
not commit the generated 1.8 MB file.

---

## Step 8 — Cleanup

After everything works:

```bash
rm docs/operations/GO_PUBLIC.md         # this file
git add docs/operations/GO_PUBLIC.md
git commit -m "chore: remove launch playbook (job done)"
git push
```

---

## Transferring to an org (later)

When you're ready to move the foundation repo to an `earth-love-united` org
(or your existing `HeliosRF` org):

1. Create the org on GitHub.
2. In repo Settings → bottom of the page → **Transfer ownership**.
3. Update Cloudflare Pages to follow the new owner (one-click in the Pages
   settings).
4. Update the README badge URLs and the citation block in CREDITS.md.

The HF datasets can also be moved to an org. Hugging Face supports org
transfer in the dataset settings panel.

---

## If something goes wrong

You have three layers of safety:

1. **The tag:** `git reset --hard pre-public-archive` restores the
   exact pre-launch state.
2. **The branch (if you created it):** `git checkout legacy-history-32-commits`
3. **The reflog:** `git reflog` shows every reference change of the last
   90 days — you can recover any state with `git reset --hard HEAD@{N}`.

Nothing in this playbook is irreversible while the safety tag exists.
