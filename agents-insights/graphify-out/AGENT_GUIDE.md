# Graphify Agent Guide — For Hermes Agent Team

**Owner**: Hermes Agent (hy3-preview)  
**Purpose**: Maintain repo map for all 5 Hermes agents working on earthloveunited.org  
**Last Updated**: 2026-05-19

---

## WHAT THIS MAP DOES

- **787 nodes, 1153 edges, 39 communities** (as of 2026-05-19)
- **AST-only extraction** (free, no LLM cost) — fast updates
- **God nodes identified**: `open()` (55 edges), `BrowserManager` (32), `log()` (21)
- **Community structure**: 39 clusters grouping related functionality

---

## PRUNING LOG (2026-05-19)

**False edges identified and documented** (not physically removed from graph.json due to encoding issues):

1. **`_fetchIndex()` (js/gaia-retrieval.js) → `fetch()` linked to `dis/worker.js`** — FALSE
   - Reality: `gaia-retrieval.js` uses browser native `fetch()`, not worker.js
   - Verification: Read source code, confirmed browser runtime

2. **`_fetchJson()` (js/gaia-structured.js) → `fetch()` linked to `dis/worker.js`** — FALSE
   - Reality: `gaia-structured.js` uses browser native `fetch()` for static JSON files
   - Verification: Read source code, confirmed browser runtime

3. **`main()` (tools/scraper/*.py) → `open()` linked to `assets/js/index.js`** — FALSE
   - Reality: Python scrapers use `open()` for file I/O, not JS files
   - Verification: Cross-language inference incorrect

**Instructions for agents**: Ignore any edges that link browser JS files to `dis/worker.js` via `fetch()`. They are separate runtimes.

---

## HOW TO USE THE MAP

### For GAIA Chat Agents (Communities 0, 3, 5, 7, 12, 13, 15, 17)
- **Community 17** (cohesion 0.27): `gaia-retrieval.js` — BM25 engine
- **Community 15** (cohesion 0.23): `gaia-structured.js` — structured lookups
- **Community 3** (cohesion 0.08): GAIA chat + OpenRouter integration
- Check `_buildGroundedTurn()` wiring in Community 3

### For Scraper Agents (Communities 1, 2, 6, 8, 9, 14, 16, 19, 20)
- **God node `open()` (55 edges)** — verify if you're using shared BrowserManager utils
- **Community 2** (cohesion 0.06): BatchRunner + RateLimiter + BrowserManager stack
- **124 isolated nodes** — your scraper scripts may have duplicated logic

### For Build Pipeline Agents
- **Community 27** (2 nodes): `build.js`, `bundleJs()`, `exposeGlobals()`
- Vite config + `dis/` scripts = fragmented — wire `build:knowledge` into package.json

---

## KNOWN ISSUES (Verified by Graphify Agent)

1. **False INFERRED edges on `fetch()`**:
   - `gaia-retrieval.js` and `gaia-structured.js` use **browser native `fetch()`**
   - `dis/worker.js` uses **Cloudflare Worker `env.ASSETS.fetch()`** + external `fetch()`
   - Graphify v1 conflated these — they are **separate runtimes**, not connected

2. **God node `open()` is noisy**:
   - Python scrapers use `open()` for file I/O
   - Graphify linked across languages incorrectly
   - Don't trust `open()` cross-module edges without verification

3. **124 isolated nodes**:
   - Mostly `tools/scraper/*.py` scripts
   - Likely missing shared utils imports
   - Check for duplicated logic across scripts

---

## UPDATE WORKFLOW

### When to update:
- After significant code changes (new features, refactoring)
- When adding new scraper scripts or GAIA features
- When other agents report "can't find X in the graph"

### How to update (for any agent):
```bash
graphify update /Users/ekmelozdemir/earthloveunited.org
```

### What gets updated:
- `agents-insights/graphify-out/graph.json` — full graph data
- `agents-insights/graphify-out/GRAPH_REPORT.md` — human-readable summary
- `agents-insights/graphify-out/graph.html` — interactive visualization
- `agents-insights/graphify-out/AGENT_GUIDE.md` — this file (updated by Graphify Agent)

---

## SEMANTIC VERIFICATION (Graphify Agent Only)

I manually verify INFERRED edges by:
1. Reading the actual source code
2. Checking if the relationship makes architectural sense
3. Documenting false positives (like cross-runtime `fetch()`)

To request verification:
```
@hy3 Please verify graphify edges for [specific nodes/communities]
```

---

## TODO FOR TEAM

- [ ] Wire `dis/build_retrieval_index.py` into npm scripts (see Community 27)
- [ ] De-duplicate scraper utils (124 isolated nodes problem)
- [ ] Verify GAIA grounded path is fully wired (Community 3 → 15, 17)
- [ ] Set `MOONSHOT_API_KEY` if you want Kimi's semantic extraction for isolated nodes

---

**Graphify Agent (hy3)**: I run AST extraction, verify semantics manually, and keep this map clean. Other agents — use this guide, trust the communities, but verify god node edges if you're refactoring.
