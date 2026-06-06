# SWARM SDK — Earth Love United Architectural Guide

> **Version:** 2.0
> **Date:** May 26 2026
> **Author:** OWL + gke0op
>
> This document is the **sole authoritative reference** for any agent — human or AI — working on the Earth Love United bare-metal stack. All architectural decisions, patterns, and laws defined here are non-negotiable.

---

## Table of Contents

1. [Core Philosophy](#core-philosophy)
2. [The Script Tag Load Order](#the-script-tag-load-order)
3. [The Standard Module Lifecycle (SML)](#the-standard-module-lifecycle-sml)
4. [The Contract System](#the-contract-system)
5. [The IIFE Pattern](#the-iife-pattern)
6. [Code Templates](#code-templates)
7. [The Golden Rule](#the-golden-rule)
8. [Verification & Tooling](#verification--tooling)
9. [Common Pitfalls](#common-pitfalls)
10. [Module Inventory](#module-inventory)

---

## Core Philosophy

Earth Love United is a **zero-build, zero-bundler** web application. There is no Webpack, no Vite, no Rollup, no TypeScript compiler, no npm run build. The site is two HTML files with plain `<script>` tags.

This is intentional. The architecture is:

- **Bare metal**: Every script loads directly in the browser via `<script src="...">`
- **Dependency order is mechanical**: `<script>` tag execution order IS the dependency graph
- **Contracts are declared per-module**: Each module registers its public API and dependencies at boot
- **Validation is automatic**: `MODULE_CONTRACTS.validate()` checks all contracts before `App.init()` runs
- **The pre-commit hook is law**: `scripts/verify_load_order.py` blocks any commit that breaks the DAG

**What this means for agents:**
- You CANNOT add a `<script>` tag without understanding where it belongs in the DAG
- You CANNOT create a module without registering a contract
- You CANNOT inject code into a file without reading its full lexical scope
- You MUST run `node --check` after every file edit

---

## The Script Tag Load Order

The load order in `index.html` and `gaia.html` defines the entire dependency graph. Scripts execute top-to-bottom. If module A depends on module B, B's `<tag>` must appear BEFORE A's.

### index.html Load Order (simplified)

```
1.  vendor/globe.gl.js          ← Third-party (Globe.gl)
2.  gaia-utils.js               ← Foundation: safeCall, hasModule, reportError
3.  module-contracts.js         ← Contract validation system
4.  data.js                     ← Data layer: biomes, sites, pledge nodes
5.  module-validator.js         ← Boot validator (runs pre-flight checks)
6.  quiz.js, cycle.js, ...      ← Feature modules (no interdependencies)
7.  globe.js                    ← Globe renderer (depends on Data)
8.  globe-modes.js              ← Modes (depends on GlobeModule)
9.  globe-restore.js, ...        ← Globe sub-features
10. gaia-legacy/*.js             ← GAIA intelligence layer
11. gaia-voice.js, ...           ← GAIA modules
12. site-panel.js               ← UI overlay (depends on GlobeModule, GAIA nodes)
13. app.js                      ← Init entry point (depends on everything)
```

### gaia.html Load Order (simplified)

```
1.  CDN: globe.gl               ← Third-party
2.  gaia-utils.js, data.js       ← Shared foundation
3.  gaia-legacy/*.js             ← GAIA core
4.  gaia-*.js                    ← GAIA features
5.  dis/*.js                     ← DIS system (state machine, mind, voice)
6.  gaia-dom-adapter.js          ← Bridges DIS into gaia.html's DOM
```

### Enforcement

The pre-commit hook runs `scripts/verify_load_order.py` which:
1. Parses HTML to extract `<script src>` order
2. Scans JS files for `MODULE_CONTRACTS.register()` calls
3. Validates that every `requires` dependency loads BEFORE the dependent module
4. Exits non-zero on any violation, blocking the commit

---

## The Standard Module Lifecycle (SML)

Every major module in the codebase MUST export these four baseline methods. They form a predictable SDK that the swarm can rely on.

### `init(config = {})`

**Purpose:** Boot the module. Bind event listeners. Initialize state. Start async work.

**Contract:**
- MUST be a function on the exported object
- Accepts an optional `config` object
- Should call `load()` or equivalent to restore persisted state
- Should register event listeners and start intervals
- MUST NOT throw — catch and `reportError()` instead

**Example:**
```js
init() {
  load();                          // Restore persisted state
  bindListeners();                 // DOM event bindings
  setInterval(tick, 1000);         // Start periodic work
},
```

### `reset()`

**Purpose:** Return the module to its default state without destroying it.

**Contract:**
- MUST be a function on the exported object
- Clears runtime state (counters, timers, cached data)
- Does NOT unbind listeners or nullify DOM references
- Useful for "start over" scenarios

**Example:**
```js
reset() {
  this.score = 0;
  this.active = false;
  this.cache = {};
},
```

### `destroy()`

**Purpose:** Tear down the module completely. Unbind listeners. Nullify heavy references.

**Contract:**
- MUST be a function on the exported object
- Clears all intervals and timeouts
- Removes all event listeners
- Nullifies DOM references (prevents memory leaks)
- Nullifies WebGL/Canvas references (prevents GPU memory leaks)

**Example:**
```js
destroy() {
  clearInterval(this._interval);
  document.removeEventListener('scroll', this._onScroll);
  this.canvas = null;
  this.gl = null;
},
```

### `getState()`

**Purpose:** Return a read-only snapshot of the module's current state for telemetry.

**Contract:**
- MUST be a function on the exported object
- MUST return a plain object (JSON-serializable)
- MUST NOT include functions, DOM references, or circular references
- Used by the pre-flight validator and dev tools

**Example:**
```js
getState() {
  return {
    score: this.score,
    active: this.active,
    siteCount: Object.keys(this.sites).length,
  };
},
```

---

## The Contract System

Every module registers a contract at load time using `MODULE_CONTRACTS.register()`. This is the runtime dependency injection system.

### Registration

```js
MODULE_CONTRACTS.register('ModuleName', {
  provides: ['init', 'reset', 'destroy', 'getState', 'customMethod'],
  requires: ['DependencyA', 'DependencyB'],
});
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provides` | `string[]` | Yes | Method names this module exposes on `window.X` |
| `requires` | `string[]` | No | Contract names this module depends on |
| `emits` | `string[]` | No | **(Schema v1.1)** Event names this module dispatches via `EventBus.emit()` |
| `listens` | `string[]` | No | **(Schema v1.1)** Event names this module subscribes to via `EventBus.on()` |

**Schema v1.1 — Event Extension.** Modules may declare event-flow
dependencies in addition to hard dependencies. See the EventBus section
below for the runtime; see the Module Inventory for which modules currently
use it.

### Validation

At boot, `module-validator.js` calls `MODULE_CONTRACTS.validate()` which checks:
1. Every required module is registered
2. Every required module's `provides` includes the needed methods
3. Load order respects the dependency DAG (via `verify_load_order.py`)

Errors are reported via `reportError('PRE-FLIGHT', message)` and appear in the console.

### Contract Name vs Variable Name vs File Name

**These are NOT the same thing:**

| Contract Name | Variable Name | File |
|--------------|---------------|------|
| `PLEDGE_WALL` | `PLEDGE_WALL` | `js/pledge-wall.js` |
| `SITE_PANEL` | `SITE_PANEL` | `js/site-panel.js` |
| `PLEDGE_PANEL` | `PLEDGE_PANEL` | `js/site-panel.js` |
| `GAIA_BUBBLE` | `GAIA_BUBBLE` | `js/gaia-bubble.js` |

The contract name is what `MODULE_CONTRACTS.register()` uses. The variable name is what the IIFE assigns to. The file name is where the code lives. All three can differ.

---

## The IIFE Pattern

Every module in this codebase uses the **Immediately Invoked Function Expression** pattern. This is the ONLY approved module pattern.

### Why IIFEs?

- **No build step**: No ES modules, no bundler, no `import`/`export`
- **Private state**: Variables declared inside the IIFE are invisible to other modules
- **Global export**: Only the returned object is assigned to `window.X`
- **Deterministic**: Executes immediately when the `<script>` tag loads

### Anatomy of a Compliant IIFE

```js
// ═══════════════════════════════════════════════════════
// MODULE_NAME v1.0
// Description of what this module does
// ═══════════════════════════════════════════════════════

const ModuleName = (() => {
  // ── Private State ──
  let _state = {};
  let _interval = null;

  // ── Private Functions ──
  function helper() { /* ... */ }

  // ── Public API ──
  return {
    // Lifecycle
    init(config = {}) {
      _interval = setInterval(helper, 1000);
      return true;
    },

    reset() {
      _state = {};
      return true;
    },

    destroy() {
      clearInterval(_interval);
      _interval = null;
      _state = {};
      return true;
    },

    getState() {
      return { ..._state };
    },

    // Custom methods
    doSomething() {
      // ...
    },
  };
})();
window.ModuleName = ModuleName;

// ── Contract Registration ──
if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('ModuleName', {
    provides: ['init', 'reset', 'destroy', 'getState', 'doSomething'],
    requires: ['DependencyName'],
  });
}
```

### Rules

1. **The IIFE MUST assign to `window.X`** — this is how other modules find it
2. **The contract MUST be registered** — inside `if (typeof MODULE_CONTRACTS !== 'undefined')`
3. **SML methods MUST be at the TOP LEVEL** of the return object — never nested inside another method
4. **`getState()` MUST return `{}`** — not an object with trapped stubs
5. **Private state uses `let`/`const`** inside the IIFE — never on `window`
6. **The file MUST pass `node --check`** after any edit

---

## Code Templates

### Template A: Plain Object Literal (Pattern A)

For modules that don't need private state:

```js
const ModuleName = {
  init() { return true; },
  reset() { return true; },
  destroy() { return true; },
  getState() { return {}; },
  customMethod() { /* ... */ },
};
window.ModuleName = ModuleName;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('ModuleName', {
    provides: ['init', 'reset', 'destroy', 'getState', 'customMethod'],
    requires: [],
  });
}
```

### Template B: IIFE with Private State (Pattern B)

For modules that need private state and helper functions:

```js
const ModuleName = (() => {
  let _privateState = {};
  let _timer = null;

  function _helper() { /* private logic */ }

  return {
    init(config = {}) {
      _timer = setInterval(_helper, 1000);
      return true;
    },
    reset() {
      _privateState = {};
      return true;
    },
    destroy() {
      clearInterval(_timer);
      _timer = null;
      _privateState = {};
      return true;
    },
    getState() {
      return { ..._privateState };
    },
    customMethod() {
      _helper();
    },
  };
})();
window.ModuleName = ModuleName;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('ModuleName', {
    provides: ['init', 'reset', 'destroy', 'getState', 'customMethod'],
    requires: ['DependencyName'],
  });
}
```

### Template C: Contract Aliases

When the contract method name differs from the real method name:

```js
const ModuleName = (() => {
  function openModal(node) { /* real implementation */ }
  function closeModal() { /* real implementation */ }

  return {
    init() { return true; },
    reset() { return true; },
    destroy() { return true; },
    getState() { return {}; },

    // Real methods
    openModal,
    closeModal,

    // Contract aliases (contract expects 'open', 'close')
    open(...args) { return openModal(...args); },
    close(...args) { return closeModal(...args); },
  };
})();
window.ModuleName = ModuleName;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('ModuleName', {
    provides: ['init', 'reset', 'destroy', 'getState', 'open', 'close'],
    requires: [],
  });
}
```

---

## The Golden Rule

> **REGEX CANNOT PARSE JAVASCRIPT IIFEs.**

Any batch injection script that uses regex to find `return {` patterns and inject code WILL trap stubs inside nested blocks (like `getState() { return { ... }; }`). The injected code will be invisible to `window.X` and the pre-flight validator will fail.

**The ONLY safe approach is manual scope-reading:**

1. **Read the ENTIRE file** — use `read_file()`, not grep or regex scans
2. **Understand the lexical scope** — identify which `return {` is the MAIN export vs nested returns
3. **Find the TRUE main export block** — the one assigned to `window.X` or the top-level object literal
4. **Check for existing methods** — don't shadow real business logic with duplicate stubs
5. **Identify shorthand properties** — `open, close, nextLayer` in object literals are invisible to regex `methodName(` patterns
6. **Inject at the TOP LEVEL** of the export block — never inside nested return objects
7. **Comma-check** — ensure exactly one comma between each property/method, no trailing comma before `}`
8. **Run `node --check path/to/file.js`** after EVERY file edit before moving to the next one

**NEVER batch-inject. NEVER regex-parse. NEVER skip node --check.**

---

## Verification & Tooling

### Pre-Commit Hook

The pre-commit hook (`.git/hooks/pre-commit`) runs:
1. `scripts/verify_load_order.py` — validates DAG load order
2. Only runs when HTML or JS files are staged

### Static Analysis

```bash
# Verify load order DAG
python3 scripts/verify_load_order.py

# Check syntax of a specific JS file
node --check path/to/file.js

# Check ALL JS files
find js dis -name "*.js" | while read f; do node --check "$f" 2>&1 || echo "❌ $f"; done
```

### Runtime Validation

At boot, `module-validator.js` runs `MODULE_CONTRACTS.validate()` which checks every registered contract. Errors appear in the console as `[PRE-FLIGHT] ModuleName declares .method() but it's missing or not a function`.

---

## Common Pitfalls

### 1. Stubs Trapped in Nested Scopes

**Wrong:**
```js
return {
  init() { return true; },
  getState() {
    return {
      myMethod() { return true; },  // ← TRAPPED! Invisible to window.X
    };
  },
};
```

**Right:**
```js
return {
  init() { return true; },
  myMethod() { return true; },     // ← TOP LEVEL. Visible to window.X
  getState() { return {}; },
};
```

### 2. Duplicate Method Names

**Wrong:**
```js
return {
  open(node) { /* real logic */ },  // ← Real method
  getState() {
    return {
      open() { return true; },       // ← Stub shadows real method
    };
  },
};
```

**Right:**
```js
return {
  open(node) { /* real logic */ },  // ← Only definition
  getState() { return {}; },
};
```

### 3. Missing Comma Before SML Block

**Wrong:**
```js
return {
  customMethod() {}
  reset() {        // ← SyntaxError: unexpected identifier
    return true;
  },
};
```

**Right:**
```js
return {
  customMethod() {},
  reset() {        // ← Comma present
    return true;
  },
};
```

### 4. Contract Name Mismatch

**Wrong:**
```js
// File: pledge-wall.js, variable: PLEDGE_WALL
MODULE_CONTRACTS.register('PLEDGE_PANEL', { ... });  // ← Wrong name!
```

**Right:**
```js
MODULE_CONTRACTS.register('PLEDGE_WALL', { ... });   // ← Matches contract name
```

### 5. Shorthand Properties Invisible to Regex

**Wrong approach:** Using regex `\w+\(` to find method names in an object literal.

```js
return {
  open, close, nextLayer,    // ← These are shorthand references to local functions
  customMethod() { ... },    // ← Only this is visible to regex
};
```

**Right approach:** Read the file natively. Shorthand properties like `open, close` reference local functions defined elsewhere in the IIFE. They ARE valid methods on the object. Don't inject duplicates.

### 6. Multiple Modules Per File

When a file exports multiple modules (e.g., `site-panel.js` has both `SITE_PANEL` and `PLEDGE_PANEL`):

- Each module gets its own IIFE
- Each module gets its own `MODULE_CONTRACTS.register()` call
- Each module gets its own `window.X = X` assignment
- Each module's return block must independently satisfy its contract

---

## EventBus (Schema v1.1)

Decoupled pub/sub for cross-module signalling. Modules `emit` events without
knowing who's listening; modules `listen` without knowing who emits. This
breaks the hard-dependency requirement for incidental signals (e.g.
"engagement changed", "voice line ended") while keeping the contract
explicit and machine-readable.

### Runtime API

```js
window.EventBus.emit('eventName', payload)
const unsub = window.EventBus.on('eventName', callback)   // returns unsub fn
window.EventBus.once('eventName', callback)
window.EventBus.off('eventName', callback)
```

### Naming convention

Events are namespaced `module:verb`:

| Channel | Emitter | Listener |
|---------|---------|----------|
| `engagement:signal` | `GAIA_ENGAGEMENT` | `GAIA_BUBBLE` |
| `engagement:tier-change` | `GAIA_ENGAGEMENT` | (none yet) |
| `bubble:react` | `GAIA_BUBBLE` | (none yet) |

When adding a new channel, prefix it with the emitter's contract name.

### Declaring event flow

Add `emits` and/or `listens` arrays to your contract registration:

```js
MODULE_CONTRACTS.register('YOUR_MODULE', {
  provides: ['init', 'reset', 'destroy', 'getState'],
  requires: [],
  emits:    ['your-module:fired'],
  listens:  ['other-module:received'],
});
```

The validator does not (yet) enforce that every declared `emits` channel has
a registered `listens` somewhere — it's informational. But declaring the
flow makes the swarm's event graph navigable to other agents.

---

## STORAGE_ADAPTER (IndexedDB layer)

`localStorage` is synchronous and limited to ~5MB per origin. For anything
larger — knowledge indices, embeddings, large caches, journal histories —
modules must use `STORAGE_ADAPTER` instead.

### API

```js
await window.STORAGE_ADAPTER.set('key', value)    // arbitrary JSON-able value
const value = await window.STORAGE_ADAPTER.get('key')
await window.STORAGE_ADAPTER.remove('key')
await window.STORAGE_ADAPTER.clear()
const allKeys = await window.STORAGE_ADAPTER.keys()
```

All methods return promises. The adapter opens the IndexedDB connection
lazily on first call, so no explicit `init` await is required (though
`init()` exists for SML compliance).

### Module contract

```js
MODULE_CONTRACTS.register('STORAGE_ADAPTER', {
  provides: ['init', 'reset', 'destroy', 'getState',
             'get', 'set', 'remove', 'clear', 'keys'],
  requires: [],
});
```

Loaded by both `index.html` and `gaia.html`.

---

## Parallel Architecture: `js/modules/`

Most of this codebase uses the IIFE pattern documented above. The
`js/modules/` subdirectory is a **deliberate exception**: it uses ES6 classes
for the declarative learning-module subsystem.

### Why a parallel pattern?

`js/modules/` solves a different problem than the rest of the codebase:

- The IIFE pattern is for **global orchestration** — singletons living on
  `window.X`, coordinating via `safeCall` and `EventBus`
- The ES6 class pattern in `js/modules/` is for **declarative content
  rendering** — multiple instances (one per learning module being shown),
  loaded from JSON definitions, each with its own state

Both are compatible with bare-metal serving — ES6 classes work natively in
modern browsers with no build step.

### Files

| File | Purpose | Pattern |
|------|---------|---------|
| `js/modules/module-engine.js` | Loads/renders declarative module JSON | `class ModuleEngine` |
| `js/modules/registry.js` | Caches module definitions | `class ModuleRegistry` |
| `js/modules/renderers.js` | Stage renderers (Hook / Explore / Discover / Verify / Connect) | `class TextRenderer`, etc. |
| `js/modules/calculator.js` | Helper utilities for module computations | `window.__ELU_CALC` |
| `js/modules/gaia-bridge.js` | Dispatches learning events into the DIS state machine via `postMessage` + `CustomEvent` | older IIFE |

### Rules for `js/modules/`

- Do **not** convert these files to the standard IIFE pattern — the parallel
  architecture is intentional
- Do **not** add them to `MODULE_CONTRACTS` — they don't participate in the
  contract system
- Do **not** load them via `<script>` tags in `index.html`/`gaia.html`'s
  main module ordering — they're loaded on demand by `module-engine.js`
- Cross-system communication between the two architectures happens via
  `EventBus` (preferred) or `window.dispatchEvent(new CustomEvent(...))`

---

## infra/bridge.py — Out-of-Band Agent Channel

A Python WebSocket router that lets autonomous agents (running outside the
browser) push real-time updates into running browser tabs without polling.

### Ports

- `ws://localhost:8765` — browser clients (the running site)
- `ws://localhost:8766` — agents (your terminal, OWL, Hermes, AG)

### Protocol

Agents publish:
```json
{"action": "broadcast", "payload": {"type": "globe-update", "data": [...]}}
```

Browsers receive:
```json
{"source": "bridge", "payload": {"type": "globe-update", "data": [...]}}
```

Full protocol is documented in the file header of `infra/bridge.py`. Smoke
test: `python infra/smoke_test.py` (requires the bridge running).

### When to use it

- Long-running missions that need to surface progress in a live tab
- Multi-agent collaboration where one agent observes another via the UI
- Telemetry from a Python pipeline into the running site

**Not** a substitute for `EventBus` — `EventBus` is for in-browser
intra-module signalling. The bridge is for cross-process, agent↔browser
push.

---

## Module Inventory

### Core Infrastructure
| Module | File | Contract | Provides |
|--------|------|----------|----------|
| `MODULE_CONTRACTS` | `js/module-contracts.js` | — | `register`, `validate`, `getRegistry` |
| `MODULE_VALIDATOR` | `js/module-validator.js` | — | Boot validation |
| `EventBus` | `js/event-bus.js` | `init`, `reset`, `destroy`, `getState`, `emit`, `on`, `off`, `once`, `clear` | Pub/sub channel |
| `STORAGE_ADAPTER` | `js/storage-adapter.js` | `init`, `reset`, `destroy`, `getState`, `get`, `set`, `remove`, `clear`, `keys` | IndexedDB wrapper |

### Data Layer
| Module | File | Contract | Provides |
|--------|------|----------|----------|
| `Data` | `js/data.js` | `init`, `fmt`, `reset`, `destroy`, `getState` | `getBiome`, `getSite`, `transitionCarbon`, `scaleContext` |

### Globe Layer
| Module | File | Contract | Provides |
|--------|------|----------|----------|
| `GlobeModule` | `js/globe.js` | `init`, `initPledgeNodes`, `updateNodeVisuals`, `setLens`, `setHexMode`, `getCountryFeatures`, `setGlobeTexture`, `restoreDefaultTexture`, `setGlobeTextureFromCanvas`, `setOnGlobeClick`, `clearOnGlobeClick`, `clearNodeVisuals`, `restoreNodeVisuals`, `reset`, `destroy`, `getState` | Full globe renderer API |
| `GLOBE_MODES` | `js/globe-modes.js` | `init`, `setMode`, `getMode`, `onCountryDataReady`, `reset`, `destroy`, `getState` | Mode orchestrator |
| `GLOBE_EVENTS` | `js/globe-events.js` | `init`, `activate`, `deactivate`, `getEvents`, `isActive`, `reset`, `destroy`, `getState` | Climate events |
| `GLOBE_NDVI` | `js/globe-ndvi.js` | `init`, `activate`, `deactivate`, `getYear`, `setYear`, `reset`, `destroy`, `getState` | NDVI vegetation mode |
| `GLOBE_RESTORE` | `js/globe-restore.js` | `init`, `activate`, `deactivate`, `restore`, `erase`, `getAction`, `getActions`, `getStats`, `setAction`, `setBrushSize`, `getBrushSize`, `getBrushSizes`, `detectBiomeAt`, `detectCountryAt`, `loadTexture`, `reset`, `destroy`, `getState` | Restoration simulator |
| `GLOBE_OVERLAY` | `js/globe-overlay.js` | `isOpen`, `getCurrentSite`, `init`, `reset`, `destroy`, `getState` | Left sidebar overlay |

### GAIA Intelligence Layer
| Module | File | Contract | Provides |
|--------|------|----------|----------|
| `GAIA_DATA` | `js/gaia-legacy/gaia-data.js` | `init`, `getVisitCount`, `getFirstVisit`, `getTotalTime`, `reset`, `destroy`, `getState` | Live data fetcher |
| `GAIA_CHARTS` | `js/gaia-legacy/gaia-charts.js` | `init`, `render`, `update`, `reset`, `destroy`, `getState` | Canvas chart renderer |
| `GAIA_VOICE` | `js/gaia-voice.js` | `init`, `speak`, `silent`, `setVoice`, `getVoice`, `reset`, `destroy`, `getState` | Voice line engine |
| `GAIA_BUBBLE` | `js/gaia-bubble.js` | `speak`, `show`, `hide`, `setMood`, `setPosition`, `fadeIn`, `fadeOut`, `isVisible`, `setInteractive`, `setPhase`, `handleScroll`, `handleResize`, `on`, `off`, `destroy`, `init`, `reset`, `getState` | GAIA speech bubble |
| `GAIA_ENGAGEMENT` | `js/gaia-engagement.js` | `addSignal`, `getScore`, `getSiteStates`, `interact`, `save`, `load`, `init`, `reset`, `destroy`, `getState` | Scoring engine |
| `GAIA_JOURNAL` | `js/gaia-journal.js` | `init`, `addEntry`, `getEntries`, `getAllQuests`, `save`, `load`, `clear`, `reset`, `destroy`, `getState` | Session journal |
| `GAIA_PRESENCE` | `js/gaia-presence.js` | `init`, `show`, `hide`, `tease`, `reset`, `destroy`, `getState` | Ambient teasers |
| `GAIA_KNOWLEDGE` | `js/gaia-overlay-knowledge.js` | `init`, `query`, `search`, `getContext`, `reset`, `destroy`, `getState` | Knowledge engine |
| `GAIA_NODES` | `js/gaia-nodes.js` | `init`, `onNodeClick`, `onNodeHover`, `getSuggestedSiteIds`, `populateSiteData`, `reset`, `destroy`, `getState` | Globe click handlers |

### UI Layer
| Module | File | Contract | Provides |
|--------|------|----------|----------|
| `SITE_PANEL` | `js/site-panel.js` | `open`, `close`, `nextLayer`, `selectPrediction`, `addInsight`, `verifyCurrentSite`, `switchVerifyTab`, `toggleGAIA`, `speakGAIA`, `addInsightFromGAIA`, `scrollToLayer`, `init`, `reset`, `destroy`, `getState` | Right side panel |
| `PLEDGE_PANEL` | `js/site-panel.js` | `open`, `close`, `init`, `reset`, `destroy`, `getState` | Pledge panel (same file as SITE_PANEL) |
| `PLEDGE_WALL` | `js/pledge-wall.js` | `init`, `open`, `close`, `submit`, `renderPledges`, `getPledges`, `getPledgeCount`, `hasPledged`, `destroy`, `reset`, `getState` | Public commitment wall |

### Feature Modules
| Module | File | Contract | Provides |
|--------|------|----------|----------|
| `Quiz` | `js/quiz.js` | `init`, `start`, `next`, `answer`, `getResult`, `reset`, `destroy`, `getState` | Interactive quiz |
| `Biomes` | `js/biomes.js` | `init`, `getBiome`, `getAllBiomes`, `classify`, `reset`, `destroy`, `getState` | Biome explorer |
| `Cycle` | `js/cycle.js` | `init`, `update`, `getCurrentPhase`, `setPhase`, `reset`, `destroy`, `getState` | Carbon cycle nodes |
| `Counters` | `js/counters.js` | `init`, `increment`, `getCount`, `reset`, `destroy`, `getState` | Animated counters |
| `Scenario` | `js/scenario.js` | `init`, `load`, `play`, `pause`, `reset`, `destroy`, `getState` | Restoration wizard |
| `CARBON_CLOCK` | `js/carbon-clock.js` | `init`, `start`, `stop`, `update`, `reset`, `destroy`, `getState` | CO₂ clock |
| `COUNTRY_DATA` | `js/country-data.js` | `init`, `getCountry`, `getCountries`, `lookup`, `getByCode`, `search`, `reset`, `destroy`, `getState` | Country metadata |
| `Delegation` | `js/delegation.js` | `init`, `getDetected`, `getCountryData`, `reset`, `destroy`, `getState` | COP31 delegation |
| `RegistryCheck` | `js/registry-check.js` | `init`, `check`, `getRegistry`, `getProject`, `reset`, `destroy`, `getState` | Registry checker |
| `NDVIVerifier` | `js/ndvi-verifier.js` | `init`, `activate`, `deactivate`, `verify`, `getStatus`, `reset`, `destroy`, `getState` | Satellite verification |

### DIS System (gaia.html only)
| Module | File | Contract | Provides |
|--------|------|----------|----------|
| `GaiaMind` | `dis/gaia-mind.js` | `init`, `serialize`, `deserialize`, `process`, `getMood`, `setContext`, `getContext`, `reset`, `destroy`, `getState` | GAIA inner world |
| `GaiaState` | `dis/gaia-state-machine.js` | `init`, `getState`, `setState`, `getMood`, `setMood`, `registerCallbacks`, `process`, `reset`, `destroy`, `getState` | State machine |
| `GaiaVoice` | `dis/gaia-voice-engine.js` | `init`, `speak`, `setLibrary`, `getLibrary`, `destroy`, `reset`, `getState` | TTS engine |
| `GaiaKeyGate` | `dis/gaia-key-gate.js` | `init`, `check`, `unlock`, `isUnlocked`, `reset`, `destroy`, `getState` | Key gate |
| `GaiaQuests` | `dis/gaia-quest-system.js` | `init`, `getQuests`, `completeQuest`, `getProgress`, `reset`, `destroy`, `getState` | Quest system |

---

*This document is maintained by OWL and gke0op. When in doubt, read the code. When reading the code, read ALL of it. When injecting, inject at the top level. When done, run node --check.*
