# OPERATIONS.md — Agent Runbook

> The day-to-day "what command do I run?" companion to `AGENTS.md`.
>
> - `AGENTS.md` is the **rules** — how the team coordinates, what's protected, what auto-merges.
> - `SWARM_SDK.md` is the **code architecture** — IIFE templates, SML methods, contract registration.
> - `OPERATIONS.md` (this file) is the **runbook** — the exact commands to run, in order.
>
> If a procedure here ever conflicts with `AGENTS.md` or `SWARM_SDK.md`, **the rules win** and this file is wrong. Open a PR to fix it.

---

## Quick reference card

```
START      ./tools/start-mission.sh <role> <slug>
WORK       cd ../earthloveunited.org-missions/<slug> && edit, commit
VALIDATE   python3 scripts/verify_load_order.py
           node --check <file>.js
FINISH     ./tools/end-mission.sh
CLEAN UP   git worktree remove <worktree-path>   (after PR is merged)
```

That's the entire loop. Everything else is detail.

---

## Step-by-step: a typical mission

### 1. Check what's in flight first

```bash
cat MISSIONS.md          # the live kanban
gh pr list               # GitHub-side view of the same
```

If another agent is working on something that overlaps with what you're about to do, **stop and coordinate** via a comment on their PR. Don't open a parallel branch — you'll create a merge conflict that has to be resolved by hand.

### 2. Start the mission

```bash
./tools/start-mission.sh generalist add-events-filter
```

This:
- Creates branch `agent/generalist/add-events-filter`
- Creates a git worktree at `../earthloveunited.org-missions/add-events-filter`
- Pulls latest `main` into it
- Installs the pre-commit hook into that worktree
- Adds a row to `MISSIONS.md`

`cd` into the worktree directory before doing anything else.

### 3. Do the work

Edit files normally. Commit normally. **Every commit runs the pre-commit hook automatically** — it checks four layers:

1. Script load-order DAG (`scripts/verify_load_order.py`)
2. Secrets patterns (no `sk-`, `hf_`, `ghp_`, `AKIA`, `Bearer` tokens)
3. File-size + `.env*` + personal filesystem paths
4. Signature-phrase leak detection

If the hook blocks your commit, **fix the issue and retry**. Do not bypass with `--no-verify` — that flag is off-limits per `AGENTS.md` § Operations.

### 4. After significant edits, validate locally

Before opening a PR, save yourself a CI round-trip:

```bash
# Run the same checks CI will run
python3 scripts/verify_load_order.py
node --check js/<the-file-you-edited>.js

# Open the site, then in the browser console:
#   SmokeTest.run()
#   StackLint.audit()
```

See `AGENTS.md` § Dev Toolkit for the full set of in-browser checks.

### 5. End the mission

```bash
./tools/end-mission.sh
```

This:
- Re-runs `verify_load_order.py` and `node --check`
- Detects whether any protected files were touched
- Pushes the branch to `origin`
- Opens a PR via `gh` with a structured body
- Labels the PR `auto-merge` IF no protected files were touched
- Updates `MISSIONS.md` to "pending-review"
- Returns the PR URL

### 6. Wait for CI + review

- **CI green AND auto-merge label** → GitHub auto-squashes into `main`. You're done.
- **CI green AND protected files touched** → human reviewer pings, decides, merges or asks for changes.
- **CI red** → PR stays open. Look at the failing step. Fix locally. Push again. Don't open a new PR.

### 7. Clean up your worktree

After the PR is merged:

```bash
git worktree remove ../earthloveunited.org-missions/add-events-filter
git branch -d agent/generalist/add-events-filter   # local cleanup
```

---

## Decision tree: should this be one PR or two?

> **One PR per coherent change.** If you can describe the change in one sentence without using "and", it's one PR.

| Scenario | One PR or two? |
|----------|----------------|
| Add a new feature module + register its contract | One |
| Add a feature module + update unrelated CSS | Two |
| Refactor module A + update module B that depends on A | One (atomic) |
| Add a feature + update the README docs for it | One (the docs are part of the feature) |
| Add a feature + bump globe.gl from 2.46 to 2.47 | Two |
| Touch a protected file as part of an unrelated fix | **STOP** — open a separate PR for the protected change |

---

## Protected files (require human review)

If your mission touches any of these, `end-mission.sh` will detect it and the PR will NOT get the `auto-merge` label:

```
LICENSE, CREDITS.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, README.md
AGENTS.md, ARCHITECTURE.md, SWARM_SDK.md, OPERATIONS.md
js/gaia-utils.js, js/module-contracts.js, js/module-validator.js, js/app.js
js/event-bus.js, js/storage-adapter.js
js/modules/                         (entire ES6-class subsystem)
infra/                              (bridge.py + smoke tests)
scripts/verify_load_order.py
tools/agent-precommit, tools/install-hooks.sh
tools/start-mission.sh, tools/end-mission.sh
.github/**, .gitignore
```

When you must touch one of these, explain WHY in the PR description. Reviewers read these explanations carefully.

---

## When things go wrong

### "Pre-commit hook is blocking my commit and I don't understand why"

The hook prints the exact line that tripped it. Read the output. Common culprits:

- Accidentally pasted an API key into a comment → remove it
- A large file got staged → add to `.gitignore`, `git rm --cached <file>`
- Personal path like `/Users/<name>/...` in a script → use repo-relative path
- The signature phrase leaked in → remove it (these phrases are internal-only)

### "CI is failing on `verify_load_order.py` but my code looks fine"

The DAG is wrong. Check `index.html` and `gaia.html`: any new `<script>` tag must appear AFTER all of its dependencies' tags. See `SWARM_SDK.md` § The Script Tag Load Order for the canonical order.

### "CI is failing on `node --check` for a file I didn't touch"

Most likely the file was already broken on `main`. Look at the recent commits to that file. Open a separate hotfix PR; don't bundle it into your mission.

### "Two missions are touching the same files"

Whoever opens the PR second resolves the conflict, on their branch. Coordinate via PR comments. If the conflict is non-trivial, the second mission may need to be paused until the first merges.

### "I need to do something that requires breaking a rule"

Don't. Escalate via a PR comment instead. The rules exist for a reason; if they need to change, that's a meta-PR that touches `AGENTS.md` or `SWARM_SDK.md` and gets human review. Don't work around the system — change it through the system.

---

## Glossary

- **Mission** — a single coherent unit of work, completed on its own branch
- **Worktree** — a git mechanism for having multiple working directories from one repo; we use it so missions don't interfere with each other
- **DAG** — directed acyclic graph; here it means the script load-order graph in `index.html`/`gaia.html`
- **SML** — Standard Module Lifecycle: every module exports `init`, `reset`, `destroy`, `getState` (see `SWARM_SDK.md`)
- **Contract** — the `MODULE_CONTRACTS.register()` declaration of what a module provides and requires
- **Protected file** — a file listed in `.github/CODEOWNERS` that requires human review on any PR

---

*This file is updated by the team as the operational reality evolves. If you find a step that's wrong, fix it via a PR — but note that this is a protected file (see CODEOWNERS), so expect review.*
