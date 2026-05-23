# Contributing to Earth Love United

Thanks for wanting to help. This document is the short version of our
contributor rules. The long version — including the deeper architectural
reasoning — lives in [AGENTS.md](AGENTS.md) and
[ARCHITECTURE.md](ARCHITECTURE.md). **Please skim both before opening a PR.**

We genuinely welcome external contributions. We're also experimenting with
multi-agent development (Claude, Hermes, Owl alpha), and the rules below are
written so that human and AI contributors operate by exactly the same rails.

---

## TL;DR — the five things that will save you time

1. **No build step.** Don't add `package.json`, npm scripts, Vite, Webpack,
   or `import`/`export` syntax. Add new modules as `<script src=...>` tags
   in the HTML.
2. **IIFE pattern + `window.X` rule.** Every module is an IIFE assigned to a
   `const`, then explicitly attached to `window`. Without the `window.X = X`
   line, the entire cross-module communication system silently can't see
   your module.
3. **Use `safeCall` / `hasModule` / `safeGet`.** Never call another module's
   methods directly. Never use `typeof X !== 'undefined'`. The utilities in
   `js/gaia-utils.js` are the ABI.
4. **Register a module contract.** Every new module declares what it
   `provides` and `requires` via `MODULE_CONTRACTS.register()`. The boot
   validator will refuse to start if your module is missing.
5. **Mind the z-index stack.** Never append interactive DOM children to
   `#globeViz`. Never use `opacity: 0` without `pointer-events: none`. See
   the full stack in [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Setting up locally

```bash
git clone https://github.com/<ORG>/earthloveunited.org.git
cd earthloveunited.org

# Re-fetch the vendored globe.gl
mkdir -p js/vendor
curl -L https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/dist/globe.gl.min.js \
  -o js/vendor/globe.gl.js

# (Optional) Heavy datasets live on Hugging Face — fetch on demand
./tools/fetch-data.sh

# Serve. Any static server works; this is the simplest:
python3 -m http.server 8000
```

Open `http://localhost:8000` and watch the console. You should see:

```
✅ [BOOT] 22/22 modules loaded
✅ [BOOT] 4 CSS stacking checks passed
```

If you don't see that, the boot validator is telling you what's wrong.

---

## Adding a new module

```javascript
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
window.MY_MODULE = MY_MODULE;  // ← REQUIRED

MODULE_CONTRACTS.register('MY_MODULE', {
  provides: ['init', 'doSomething'],
  requires: ['GAIA_ENGAGEMENT'],
});
```

Then:

1. Add `<script src="js/my-module.js">` in `index.html` at the right load
   order position (after its `requires`, before its dependents).
2. Add the module to `MODULE_MANIFEST` in `js/module-validator.js`.
3. Update the module table in `ARCHITECTURE.md`.

---

## Running checks before opening a PR

Open `http://localhost:8000` and in the browser console:

```javascript
SmokeTest.run()        // 22 tests across 5 categories
StackLint.audit()      // z-index regressions
Tracer.start()         // … interact with the page …
Tracer.report()        // see what cross-module calls happened
```

If `SmokeTest.run()` reports anything red, fix it before opening a PR.

For CSS changes, `StackLint.audit()` is mandatory — it catches invisible
click-interceptors that don't show up in the visual diff.

---

## Commit conventions

We use Conventional Commits with scopes that mirror the module structure:

- `feat(globe): add NDVI overlay toggle`
- `fix(gaia): debounce voice modulation`
- `chore(infra): tighten gitignore`
- `docs(architecture): document new module`
- `refactor(pledge-wall): extract donor card`

Multi-agent commits are welcome but should be attributable. If a commit was
produced primarily by an AI agent, mention it in the body:

```
feat(globe): add atmospheric scattering toggle

Co-authored-by: Hermes <agent@local>
```

---

## What we will not accept

- Any PR introducing a build step (bundler, transpiler, npm scripts)
- Any PR that uses `import`/`export` ES module syntax
- Any PR that swallows errors with `console.error` instead of `reportError()`
- Any PR that hardcodes a third-party method chain on an unfamiliar API
  without `safeChain()`
- Any PR that appends interactive elements inside `#globeViz`
- Any PR that adds a hardcoded API key, secret, or `.env` file
- Any PR that bundles a large data file into the repo — those live on
  Hugging Face. See [CREDITS.md](CREDITS.md).

---

## Reporting bugs / suggesting features

Open a GitHub issue. Include:

- Browser + version
- What you expected vs. what happened
- The output of `PageState.dump()` from the console (this is our "screenshot
  for agents")
- The output of `Tracer.report()` if behaviour is intermittent

---

## Code of Conduct

By contributing you agree to follow our
[Code of Conduct](CODE_OF_CONDUCT.md). Be kind, be specific, give credit.

---

## A note on co-authorship

This project is co-developed with multiple AI agents (Hermes, Owl alpha,
Claude, and others). We believe this is part of how software gets built
now. We do not consider it a secret, we do not consider it shameful, and
we expect that as contributors you may want to use agents too. The rules
above apply to everyone equally — they are designed for collaboration
between humans, between agents, and between humans and agents.
