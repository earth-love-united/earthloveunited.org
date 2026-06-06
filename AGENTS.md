# AGENTS.md — Earth Love United

> **Read this FIRST before writing any code.**
> This file prevents you from going in circles, duplicating work, or breaking the architecture.
>
> Companion documents — read these too:
> - `SWARM_SDK.md` — the **code architecture** (Standard Module Lifecycle, IIFE templates, contract system). The architectural authority.
> - `OPERATIONS.md` — the **runbook** (the exact commands to run during a mission).
> - `ARCHITECTURE.md` — the **module map** (z-index stack, event flows, script load order).
>
> This file (`AGENTS.md`) is the **rules**: what's protected, what auto-merges, how the team coordinates.

## ⚡ Architecture: 100% Bare Metal

**This site has NO build step. No bundler. No Vite. No Webpack. No npm run anything.**

- 2 HTML files with classic `<script>` tags — that's it
- 30+ scripts load in `index.html`, 19 in `gaia.html`
- All modules use the **IIFE pattern**: `const X = (() => { ... })()`
- Cross-module calls go through `safeCall()`, `hasModule()`, `safeGet()` which use `window[name]`
- Serve from any static server: nginx, GitHub Pages, `python -m http.server`

### 🚫 DO NOT
- Install npm packages or add `package.json`
- Set up Vite, Webpack, Rollup, or any bundler
- Use ES module `import`/`export` syntax
- Add `type="module"` to script tags
- Append interactive DOM elements inside `#globeViz` (z-index trap)
- Create elements with `opacity: 0` without `pointer-events: none`
- **Use monolithic method chains on unfamiliar APIs** — use `safeChain()` instead
- **Swallow errors with `console.error`** — use `reportError()` instead

### ✅ DO
- Add new modules as `<script src="js/your-module.js">` in the HTML
- Use IIFE pattern: `const YOUR_MODULE = (() => { return { ... }; })()`
- **ALWAYS** add `window.YOUR_MODULE = YOUR_MODULE;` after the IIFE
- **ALWAYS** register a contract: `MODULE_CONTRACTS.register('YOUR_MODULE', { provides: [...], requires: [...] })`
- Add new modules to `MODULE_MANIFEST` in `js/module-validator.js`
- Use `reportError()` for error reporting, `safeChain()` for fluent APIs
- Use the safe utilities in `gaia-utils.js` (see below)
- Read `ARCHITECTURE.md` for the full module map, z-index stack, event flows

---

## 🔴 CRITICAL: The window.X Rule

```javascript
// ✅ CORRECT — accessible via safeCall/hasModule
const MY_MODULE = (() => {
  return { init, doSomething };
})();
window.MY_MODULE = MY_MODULE;  // ← THIS LINE IS REQUIRED

// ❌ WRONG — safeCall will SILENTLY return undefined
const MY_MODULE = (() => {
  return { init, doSomething };
})();
// Missing window.MY_MODULE → safeCall('MY_MODULE', 'doSomething') → undefined
```

**Why this matters:** `safeCall()` uses `window[globalName]` to find modules. `const` declarations
do NOT attach to `window`. Without `window.X = X`, the module is invisible to the entire
cross-module communication system. This was the root cause of a 2-hour debugging session where
the GLOBE_OVERLAY sidebar was fully functional but unreachable.

---

## 🛡️ Foundation Layer: `js/gaia-utils.js`

This file loads FIRST on every page. It provides safe utilities that ALL modules must use:

### Safe DOM Access
```js
$('element-id')          // → document.getElementById (returns null, never throws)
$html('element-id')      // → el.innerHTML (returns '', never throws)
$text('element-id', val) // → sets el.textContent safely
$show('element-id')      // → el.style.display = '' safely
$hide('element-id')      // → el.style.display = 'none' safely
```

### Safe Cross-Module Calls
```js
safeCall('GAIA_BUBBLE', 'speak', text, tone, duration)
const score = safeGet('GAIA_ENGAGEMENT', 'getScore', 0)  // 0 = default if missing
if (hasModule('GAIA_DATA')) { ... }
```

### ⚠️ NEVER duplicate these patterns:
- Never write `document.getElementById(...)` without null-checking → use `$()`
- Never write `typeof X !== 'undefined'` → use `hasModule()` or `safeCall()`
- Never hardcode voice modifier tables → use `GAIA_VOICE_CONFIG`
- Never create local `fmt()` functions → use `Data.fmt()`

### Error Reporting (dev-mode visible)
```js
// Errors appear as a red banner at the bottom of the page on localhost
reportError('MyModule.init()', new Error('something broke'));  // VISIBLE on screen
reportWarn('MyModule', 'non-critical issue');  // console only
```

### Safe Chain (crash-proof fluent APIs)
```js
// If a method doesn't exist, it's skipped with a dev warning.
// If a method throws, the error is reported and the chain continues.
this.world = safeChain(new Globe(el), 'Globe')
  .globeImageUrl('...')      // exists → called normally
  .specularImageUrl('...')   // doesn't exist → skipped, chain continues!
  .pointsData(Data.sites);   // still runs!
```

### Module Contracts
```js
// Register what your module provides and requires:
MODULE_CONTRACTS.register('MY_MODULE', {
  provides: ['init', 'doSomething'],      // public API
  requires: ['Data', 'GlobeModule'],       // dependencies
});
// Pre-flight check in App.init() validates all contracts before init runs
```

---

## 📊 Z-Index Stack (top → bottom)

**Must be maintained as single source of truth. Full details in ARCHITECTURE.md.**

```
1000  #scroll-progress, #pledge-tooltip
 300  #pledge-modal, #pledge-wall
 200  #hero (pe:none when .hidden), #gaia-bubble
 100  #topbar
  90  #site-panel (pe:none when not .open)
  85  #panel-backdrop (display:none when not .show)
  50  #globe-overlay (pe:none when not .open) — MUST BE CHILD OF document.body
  10  .sections (opaque background)
   1  #globeViz (pe:none when scrolled past 30vh)
```

### Stacking Rules
1. **NEVER** append interactive DOM elements as children of `#globeViz` (z-index: 1 trap)
2. `opacity: 0` without `pointer-events: none` = invisible click interceptor
3. `transform: translateX(100%)` without `pointer-events: none` = off-screen click blocker
4. `transform` creates a new stacking context

---

## 🛠️ Dev Toolkit (9 Tools)

All tools live in `tools/` and are loaded via script tags in `index.html`. Available in browser console.
`js/module-validator.js` is core infrastructure (not a dev tool) that runs at boot.

### Boot Validator (`js/module-validator.js`)
Auto-runs at page load. Validates all modules in `MODULE_MANIFEST` are on `window`.
```
✅ [BOOT] 22/22 modules loaded
✅ [BOOT] 4 CSS stacking checks passed
```

### Testing & Validation
| Tool | Command | Purpose |
|------|---------|---------|
| **SmokeTest** | `SmokeTest.run()` | 22 tests across 5 categories |
| **DiffGuard** | `DiffGuard.before()` / `.after()` | Catch test regressions |
| **StackLint** | `StackLint.audit()` | Z-index audit, invisible blockers, stacking traps |

### Debugging & Tracing
| Tool | Command | Purpose |
|------|---------|---------|
| **PageState** | `PageState.dump()` | Full visual state as text (agent "eyes") |
| **Tracer** | `Tracer.start()` / `.report()` | Log all cross-module safeCall/hasModule calls |
| **StateSnap** | `StateSnap.save('label')` / `.restore('label')` | Save/restore runtime state for bug reproduction |

### Analysis & Reference
| Tool | Command | Purpose |
|------|---------|---------|
| **Impact** | `Impact.check('globe.js')` | Blast radius — who calls it, what breaks |
| **DesignTokens** | `DesignTokens.swatch()` / `.suggest('error')` | Color palette + task-based token suggestions |
| **DepGraph** | `DepGraph.mermaid()` / `.cycles()` | Dependency graph as Mermaid + cycle detection |

### When to Use Each Tool
- **After any CSS change**: `StackLint.audit()` — catches stacking context regressions
- **After adding/editing a module**: `SmokeTest.run('modules')` — catches missing `window.X`
- **When something silently doesn't work**: `Tracer.start()` → interact → `Tracer.failed()`
- **Before shipping**: `SmokeTest.run()` — full validation
- **Before editing a file**: `Impact.check('filename.js')` — understand blast radius
- **When styling new UI**: `DesignTokens.suggest('error')` — use correct design tokens

---

## 📂 Key Files

| File | Purpose |
|------|---------|
| `ARCHITECTURE.md` | Full module map, z-index stack, event flows, script load order, known traps |
| `SWARM_SDK.md` | Code architecture — Standard Module Lifecycle, IIFE templates, contract system |
| `.agent-context.md` | Quick reference for AI agents |
| `js/gaia-utils.js` | Foundation: $(), safeCall, hasModule, safeGet, reportError, safeChain |
| `js/module-contracts.js` | Module dependency/interface validation |
| `js/module-validator.js` | Boot validator — checks all modules are on window |
| `js/event-bus.js` | EventBus — decoupled pub/sub. Extends contracts with `emits` / `listens` |
| `js/storage-adapter.js` | IndexedDB wrapper (`STORAGE_ADAPTER`) — use for any payload > 5MB |
| `js/modules/` | **Parallel subsystem** (ES6 classes, NOT IIFE) — declarative learning modules |
| `js/app.js` | Init entry point (load LAST) — runs pre-flight checks |
| `infra/bridge.py` | Out-of-band agent↔browser WebSocket router (ports 8765 / 8766) |
| `css/base.css` | Design tokens (:root variables), reset, animations |
| `css/layout.css` | Page structure, z-index stack |

---

## 🧩 New Subsystems (read before touching these areas)

### EventBus — decoupled pub/sub

Cross-module signalling without direct coupling. Modules emit events; other
modules subscribe. The contract schema now has two extra fields:

```js
MODULE_CONTRACTS.register('YOUR_MODULE', {
  provides: ['init', 'reset', 'destroy', 'getState', 'doThing'],
  requires: ['DependencyName'],
  emits:    ['your-module:fired'],     // events YOU dispatch
  listens:  ['other-module:received'], // events YOU subscribe to
});
```

Runtime API:
```js
EventBus.emit('eventName', payload)
const off = EventBus.on('eventName', cb)   // returns unsubscribe fn
EventBus.once('eventName', cb)
EventBus.off('eventName', cb)
```

Live channels so far: `bubble:react`, `engagement:signal`, `engagement:tier-change`.
When adding a new channel, prefix it with the emitter's module name (`module:verb`).

### STORAGE_ADAPTER — IndexedDB persistence

`localStorage` is capped at ~5MB. For anything larger (knowledge indices, large
caches, embeddings), use `STORAGE_ADAPTER` instead. Promise-based API:

```js
await STORAGE_ADAPTER.set('key', value)
const value = await STORAGE_ADAPTER.get('key')
await STORAGE_ADAPTER.remove('key')
await STORAGE_ADAPTER.clear()
const keys = await STORAGE_ADAPTER.keys()
```

Loaded on both `index.html` and `gaia.html`. Initialised lazily on first call.

### infra/bridge.py — agent↔browser bridge

Python WebSocket router for autonomous agents to push real-time updates into
running browsers without polling. Two ports:

- `ws://localhost:8765` — browser clients (the running site)
- `ws://localhost:8766` — autonomous agents (your terminal / OWL / Hermes)

Agents send `{action: "broadcast", payload: {...}}` and every connected
browser receives `{source: "bridge", payload: {...}}`. Use this when you need
to push state from a 10-hour mission into a running tab without reloading.

Smoke test: `python infra/smoke_test.py` (requires the bridge running).

### js/modules/ — declarative learning subsystem

This directory is a **parallel architecture** using ES6 classes, NOT the IIFE
pattern. It loads JSON module definitions from `data/modules/*.json` and
renders the Hook → Explore → Discover → Verify → Connect lifecycle.

Files: `module-engine.js`, `registry.js`, `renderers.js`, `gaia-bridge.js`,
`calculator.js`.

**Do NOT** try to IIFE-ify these files. The ES6 class pattern is intentional;
both patterns coexist with different responsibilities (IIFE for global
orchestration, ES6 classes for declarative content rendering). Both are
compatible with the bare-metal philosophy because they require no build step.

---

## 📦 Adding a New Module

```js
// js/my-module.js
const MY_MODULE = (() => {
  let _initialized = false;

  function init() {
    if (_initialized) return;
    _initialized = true;
    const el = $('my-element');
    safeCall('GAIA_ENGAGEMENT', 'addSignal', 'my_event');
  }

  function doSomething() { /* ... */ }

  return { init, doSomething };
})();
window.MY_MODULE = MY_MODULE;  // ← REQUIRED for safeCall/hasModule

// ← REQUIRED: declare what this module provides and depends on
MODULE_CONTRACTS.register('MY_MODULE', {
  provides: ['init', 'doSomething'],
  requires: ['GAIA_ENGAGEMENT'],
});
```

Then:
1. Add `<script src="js/my-module.js">` in `index.html` at the correct load order position
2. Add the module to `MODULE_MANIFEST` in `js/module-validator.js`
3. Update `ARCHITECTURE.md` module table

---

## 🗑️ Dead Code Quarantine

The `_dead/` directory contains quarantined files from previous agent sessions. **Do not resurrect them.**

---

## 🤝 Operations: How Agents Coordinate

This section is the rulebook for working in the repo after it has been pushed
to GitHub. It is written role-first (architect / reviewer / designer /
generalist), not agent-first — the rules stay stable regardless of which
agent (or human) is filling which role on a given mission.

For the day-to-day "what command do I run?" version of this, see `OPERATIONS.md`.

### Roles

| Role | What this role does | When to invoke |
|------|---------------------|----------------|
| **architect** | Designs new modules, refactors core systems, owns ARCHITECTURE.md | Before major features, when patterns are being introduced |
| **reviewer** | Reviews PRs touching protected files, judges architectural fit | Triggered automatically by CODEOWNERS on protected paths |
| **designer** | Owns CSS, design tokens, visual language, layout | Visual / UX work |
| **generalist** | Implements features, fixes bugs, writes data pipelines | Most missions |

The mapping of which agent currently fills which role is documented separately
in `.github/CODEOWNERS` and a lightweight `TEAM.md` (if present). Agents pick
the role appropriate to the work, not the other way around.

### The Mission Lifecycle

Every piece of work — a feature, a fix, a refactor — is a **mission**. The
mission lifecycle is identical for every agent:

```
1. start-mission.sh  →  fresh worktree on agent/<role>/<slug> branch
2. work in that worktree, commit normally
3. end-mission.sh    →  push, open PR, update MISSIONS.md
4. CI runs           →  SmokeTest + StackLint in headless Chrome
5. auto-merge        →  if green AND no protected files touched
   OR human review   →  if CI red OR protected files touched
```

Concretely:

```bash
# Start
./tools/start-mission.sh generalist add-events-filter
# → cd ../earthloveunited.org-missions/add-events-filter

# Work normally — edit, commit, etc.
git add -A
git commit -m "feat(globe): add events filter UI"

# Finish
./tools/end-mission.sh
# → pushes branch, opens PR, returns PR URL
```

### Branch Naming

```
agent/<role>/<slug>            ← all agent mission branches
fix/<slug>                     ← hotfixes (human-only convention)
main                           ← protected, only updated via PR
```

The `<slug>` is kebab-case and descriptive: `add-events-filter`,
`refactor-globe-modes`, not `update-1` or `wip`. Other agents read branch
names to know what's in flight.

### Protected Files (require reviewer approval)

CODEOWNERS enforces this automatically. The list:

```
/LICENSE
/CREDITS.md
/CODE_OF_CONDUCT.md
/AGENTS.md
/ARCHITECTURE.md
/README.md
/.github/**
/.gitignore
/js/gaia-utils.js
/js/module-contracts.js
/js/module-validator.js
/tools/agent-precommit
/tools/start-mission.sh
/tools/end-mission.sh
```

If your mission touches any of these, expect human review on the PR. Plan
for it: open the PR with extra context in the description explaining why
the change is necessary. Do **not** sneak protected changes into an
unrelated PR — reviewers will reject the whole thing.

### Pre-commit Tripwires

Every commit is checked locally before it can be made. The hook lives at
`tools/agent-precommit` and is installed via `tools/install-hooks.sh`. It
blocks any commit containing:

- Hardcoded secrets patterns (`sk-`, `hf_`, `ghp_`, `AKIA`, `Bearer`)
- `.env*` files
- Files larger than 10MB (point them at Hugging Face instead — see CREDITS.md)
- Personal filesystem paths (`/Users/...`, `/home/...`)
- Internal signature phrases reserved for human-agent attestation

If a commit is blocked, the hook tells you exactly which line tripped which
rule. Fix the line and retry. Do not bypass with `--no-verify` — that flag
should be considered off-limits for agents.

### Auto-merge vs. Human Review

| Condition | Outcome |
|-----------|---------|
| CI green, no protected files touched, < 20 files changed | **Auto-merges** when labelled `auto-merge` |
| CI green, but touches protected files | Human review required (CODEOWNERS blocks merge) |
| CI red | Bounces back to the originating agent; no merge |
| > 20 files changed in one PR | Human review required regardless of CI |
| Pre-commit hook tripped | Commit never happens — agent must fix locally |

All PRs touching protected files receive architectural review against the
documented guidelines in this file and ARCHITECTURE.md. Reviewers will
reject PRs that violate the IIFE pattern, the `window.X` rule, the z-index
stack, or any of the DO-NOT rules at the top of this document — regardless
of whether CI happens to pass.

### Visibility: MISSIONS.md

`MISSIONS.md` is the live kanban for the team. `start-mission.sh` adds an
entry when work begins; `end-mission.sh` updates it when the PR opens or
merges. Before starting a new mission, agents read `MISSIONS.md` to avoid
collisions:

```bash
cat MISSIONS.md     # see what's in flight
gh pr list           # see open PRs (same info, GitHub-side)
```

If two missions would touch overlapping files, the second agent should
either wait for the first to merge OR coordinate via a comment on the
first agent's PR.

### Escalation: when to pull the human in

The human (the foundation maintainer) is involved when something needs
**judgment**, not when something needs **execution**. Escalate via the PR
when:

- CI has failed twice on the same change despite agent fixes
- A protected file change is genuinely necessary
- The mission revealed an architectural decision that should be made
  explicitly (e.g., "should we add a new module type?")
- A dependency between agents is blocking progress and can't be unblocked
  via PR comments
- The work has gone significantly out of scope from the original mission

For everything else: keep going. Open PRs. Trust the rails.

### What is explicitly OFF-LIMITS for agents

- Force-pushing to any branch (`git push --force` / `--force-with-lease`)
- Deleting branches that aren't yours
- Modifying `.git/` internals directly
- Bypassing the pre-commit hook with `--no-verify`
- Editing CODEOWNERS to remove yourself from review
- Pushing directly to `main`
- Deleting `_dead/` (it's a deliberate quarantine, not garbage)
- Touching the workspace's parent directories outside `earthloveunited.org/`

These restrictions exist so that a 10-hour autonomous mission cannot damage
shared state or the public release. If a mission appears to require any of
the above, escalate via a PR comment — do not work around the restriction.
