# AGENTS.md — Earth Love United

> **Read this FIRST before writing any code.**
> This file prevents you from going in circles, duplicating work, or breaking the architecture.

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
| `.agent-context.md` | Quick reference for AI agents |
| `js/gaia-utils.js` | Foundation: $(), safeCall, hasModule, safeGet, reportError, safeChain |
| `js/module-contracts.js` | Module dependency/interface validation |
| `js/module-validator.js` | Boot validator — checks all modules are on window |
| `js/app.js` | Init entry point (load LAST) — runs pre-flight checks |
| `css/base.css` | Design tokens (:root variables), reset, animations |
| `css/layout.css` | Page structure, z-index stack |

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
