# Infrastructure Recon — Earth Love United

> Read-only reconnaissance. **No files changed, no git commands that mutate state.** Snapshot: 2026-06-06.

## TL;DR

Git is already initialized and healthy in structure (36 commits, thorough `.gitignore`, role-based workflow docs), but four things need attention before this is "hardened":

1. **No remote** — nothing is backed up off your machine. One disk failure loses everything.
2. **History bloat** — `.git` is 125 MB because giant data files (255 MB + eight ~60 MB versions) were committed earlier and live forever in history, even though they're now gitignored.
3. **Cruft tracked despite `.gitignore`** — `_dead/` (10 files) and `agents-insights/` (137 files) and ~9 large data files were committed before the ignore rules existed, so the rules don't evict them.
4. **The documented safety tripwire isn't installed** — `tools/agent-precommit` (secrets/path blocker) is described in `AGENTS.md` but the actual installed hook is a different script.

No live secrets were found in tracked source. Good.

---

## Git state

| Property | Value |
|---|---|
| Initialized | Yes (`.git` present) |
| Commits | 36 |
| Current branch | `main` |
| Other branches | `codex/academy` (identical tip — 0 ahead / 0 behind `main`) |
| **Remote** | **None configured** ⚠️ |
| Working tree | 69 modified, 12 deleted, 28 untracked — large uncommitted surface |
| `.gitignore` | Present, 90 lines, well-organized |
| Tracked files | 469 |

The big uncommitted surface means a lot of in-flight work isn't checkpointed. Notable **untracked** files that look like they *should* be committed: `.github/` (CODEOWNERS, workflows, PR template), `OPERATIONS.md`, `SWARM_SDK.md`, `MISSIONS.md`, the `tools/*.sh` mission scripts, `js/event-bus.js`, `js/data-schema.js`, `css/print.css`.

## Size & history bloat

Repo on disk: **843 MB**. `.git`: **125 MB**.

The `.git` bloat is historical — these blobs are removed from the working tree but baked into past commits forever:

| Blob in history | Size |
|---|---|
| `climate-dataset/data/processed/earth_love_united_climate_knowledge.jsonl` | 255 MB |
| `carbon-projects/unified/carbon_projects_v2..v8.jsonl` (8 versions) | ~55–62 MB each |
| `tools/scraper/data/external/carbonplan/credits.csv` | 65 MB |

These can only be removed from history by a rewrite (`git filter-repo` / BFG) — a deliberate, destructive operation to plan separately, ideally *before* pushing to a remote.

## `.gitignore` gaps (committed-before-ignored)

These are currently **tracked** even though `.gitignore` lists them. The rules can't evict already-tracked files — they need an explicit `git rm --cached`:

- `_dead/` — 10 files (quarantine dir, per AGENTS.md should not be in git)
- `agents-insights/` — 137 files (graphify output / agent scratch)
- `carbon-projects/data/verra_details_deduped.jsonl` (12 MB), `carbon-projects/raw/*.jsonl` (9 MB + 3.5 MB)
- `dis/climate-facts.json`, `dis/geological-memory.json`, `dis/climate-bifurcation-points.json`
- `tools/scraper/data/checkpoints/verra_details.json`

## Hygiene

- **Secrets:** no `sk-`/`ghp_`/`hf_`/`AKIA`/private-key patterns found in tracked source. ✓
- **Personal paths:** **64 source files** hardcode `/Users/ekmelozdemir/...` (mostly `carbon-projects/pledge-reality/src/*.py`, plus `_dead/`). These break portability and would trip the documented pre-commit tripwire.
- **`.DS_Store`:** present on disk, not tracked, and ignored. ✓
- **Pre-commit hook mismatch:** `.git/hooks/pre-commit` is a *script-load-order* checker, **not** the `tools/agent-precommit` secrets/path tripwire described in `AGENTS.md`. `tools/install-hooks.sh` exists but is untracked, so the documented protection is effectively off.

---

## Recommended hardening sequence (for your approval — nothing done yet)

1. **Add a remote and push** a backup (GitHub private repo) — highest priority; currently single-point-of-failure.
2. **Evict ignored-but-tracked cruft** with `git rm --cached` (`_dead/`, `agents-insights/`, the stray data files) — shrinks the tracked tree, no history rewrite needed.
3. **Install the real tripwire** via `tools/install-hooks.sh` and reconcile it with the load-order hook (chain both).
4. **De-hardcode the 64 `/Users/...` paths** to repo-relative paths so scripts are portable and pass the tripwire.
5. **Decide on history rewrite** (`git filter-repo`) to drop the 255 MB + 60 MB blobs and shrink `.git` from 125 MB — best done before/at the same time as first push, since it rewrites every commit hash.
6. **Commit the in-flight infra** (`.github/`, mission scripts, ops docs) so the documented workflow actually exists in the repo.

> Steps 1–4 and 6 are non-destructive. Step 5 rewrites history and should be a deliberate, separate operation.
