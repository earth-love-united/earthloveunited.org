# Earth Love United

> A global foundation for climate action — open, auditable, and built bare-metal.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![HF Datasets](https://img.shields.io/badge/🤗_Datasets-3_public-orange)](https://huggingface.co/ego0op)
[![No build step](https://img.shields.io/badge/build-bare%20metal-success)](#the-bare-metal-philosophy)

This is the source of [earthloveunited.org](https://earthloveunited.org) — the
public face of the Earth Love United Foundation, a global initiative for
sustainability and climate action.

**v1 surface:** an entry page with a live carbon clock, and a living globe of
country climate pledges vs reality. Earlier experimental layers (the "Gaia"
climate-science RAG agent, pledge wall, quiz, biomes, scenario builder, NDVI
and events globe modes) are parked in [`_archive/v1-cut/`](_archive/v1-cut/)
with full git history, ready to return one at a time.

We open-sourced this codebase because foundations should be auditable. There
is nothing in here we wouldn't want a partner, donor, or researcher to read.

---

## Quick start

```bash
git clone https://github.com/earth-love-united/earthloveunited.org.git
cd earthloveunited.org

# Re-fetch the vendored globe.gl (gitignored — see CREDITS.md)
mkdir -p js/vendor
curl -L https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/dist/globe.gl.min.js \
  -o js/vendor/globe.gl.js

# Serve. That's it.
python3 -m http.server 8000
# → open http://localhost:8000
```

No `npm install`. No `pnpm`. No bundler. No build step at all. The site is one
HTML file (`index.html`) loading ten classic `<script>` tags. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the module map and [AGENTS.md](AGENTS.md)
for the Standard Module Lifecycle and contribution rules.

---

## The bare-metal philosophy

This site has **no build pipeline**. Every JavaScript module is a plain
`<script>` tag. Every cross-module call goes through the `safeCall()` /
`hasModule()` / `safeGet()` utilities defined in `js/gaia-utils.js`.

Why? Three reasons:

1. **Auditability.** A foundation's website should be readable by anyone with
   a text editor. No minified bundle, no obscured supply chain, no opaque
   transpilation. What you see is what runs.
2. **Deploy anywhere.** The site runs identically on Cloudflare Pages,
   GitHub Pages, Hostinger, nginx, Apache, or `python -m http.server`. Zero
   vendor lock-in.
3. **Longevity.** Static HTML + CSS + JS is the longest-lived format on the
   web. Code we ship today will run unchanged in 2046.

This trades some "modern" ergonomics (HMR, tree-shaking, framework patterns)
for permanence and clarity. We think that's the right trade for a foundation.

Full architectural conventions are in [AGENTS.md](AGENTS.md).

---

## Project structure

```
earthloveunited.org/
├── index.html              The site: hero + carbon clock + countries globe
├── js/
│   ├── gaia-utils.js       Foundation: safeCall, hasModule, $, reportError
│   ├── module-contracts.js Module dependency/interface validation
│   ├── app.js              Init entry point, hero ⇄ globe navigation
│   ├── globe.js            Globe.gl-backed 3D earth (pledge vs reality)
│   ├── carbon-clock.js     Live emissions counter
│   ├── data.js             Loads active non-climate context; country evidence withheld
│   └── ...                 10 IIFE modules total
├── css/carbon-clock.css    (critical CSS is inlined in index.html)
├── data/pledge-nodes.json  Historical retired payload (not loaded by runtime)
├── _archive/v1-cut/        Everything cut for v1 (restorable, see its README)
├── dis/                    Gaia knowledge index + climate facts (runtime data)
├── docs/                   Architecture, research, operations, and agent notes
│   ├── operations/         Launch playbooks, mission plans, repo maps
│   └── agents/             Agent-specific notes and migration landing area
├── ARCHITECTURE.md         Module map, z-index stack, event flows
├── AGENTS.md               Contributor & AI-agent conventions
├── CREDITS.md              Full third-party attribution
├── CONTRIBUTING.md         How to contribute
└── CODE_OF_CONDUCT.md      Community standards
```

---

## Datasets

We publish three open climate datasets on Hugging Face under CC BY 4.0:

| Dataset | Rows | Purpose |
|---|---|---|
| [`earth-love-united-climate-knowledge`](https://huggingface.co/datasets/ego0op/earth-love-united-climate-knowledge) | ~10,100 | Grounded GAIA climate knowledge |
| [`carbon-projects-unified`](https://huggingface.co/datasets/ego0op/carbon-projects-unified) | ~23,300 | Unified carbon-project records |
| [`earth-love-united-carbon-projects`](https://huggingface.co/datasets/ego0op/earth-love-united-carbon-projects) | ~23,300 | Earth Love United carbon-project release |

These are the corpus behind Gaia's grounded answers. Built from IPCC AR6,
Project Drawdown, US EPA, NOAA GML, Our World in Data, Wikipedia, and arXiv.
Full source attribution lives in [CREDITS.md](CREDITS.md).

The live country-globe data is currently a review-stage artifact. Its planned
replacement, source hierarchy, evidence contract, and release gates are defined
in [`docs/COUNTRY-CLIMATE-TRUTH-PLAN.md`](docs/COUNTRY-CLIMATE-TRUTH-PLAN.md).
Do not describe country values as policy-grade until that plan's provenance and
comparability gates pass.

---

## Forks & attribution

The interactive globe is built on
[`globe.gl`](https://github.com/vasturiano/globe.gl) by Vasco Asturiano (MIT).
We re-fetch it from the upstream CDN rather than vendoring a permanent copy.

All third-party code, data, and visual assets are listed in
[CREDITS.md](CREDITS.md) with their original sources and licenses preserved.

---

## Developer tooling

A complete dev toolkit ships in `tools/` and is loaded by `index.html`. Open
the browser console on any page:

| Command | What it does |
|---|---|
| `SmokeTest.run()` | 22 tests across 5 categories — full validation |
| `StackLint.audit()` | Z-index audit, invisible blockers, stacking traps |
| `PageState.dump()` | Full visual state as text |
| `Tracer.start()` / `.report()` | Log all cross-module calls during a session |
| `Impact.check('globe.js')` | Blast radius — who calls it, what breaks |
| `DepGraph.mermaid()` | Dependency graph as Mermaid diagram |
| `node tools/check-public-copy.js` | Static scan for unresolved draft copy and dummy links |
| `python3 scripts/verify_load_order.py` | Validate module dependency and script load order |

`App.init()` runs `MODULE_CONTRACTS.validate()` at startup and reports the
runtime pre-flight result. The static load-order verifier runs in CI.

---

## Contributing

We welcome contributors. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and
[AGENTS.md](AGENTS.md) before opening a PR — there are a small number of
architectural rules (the IIFE pattern, the `window.X` rule, the z-index
stack) that are easy to violate accidentally.

We are also experimenting with multi-agent development workflows (Claude,
Hermes, Owl alpha). The conventions in `AGENTS.md` are designed so that
human contributors and agent contributors operate by the same rules.

By participating in this project you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

---

## License

[MIT](LICENSE). See [CREDITS.md](CREDITS.md) for upstream licenses.

---

## About

Earth Love United is a global foundation for climate action. We build open
tools, publish open datasets, and operate as transparently as we can. The
foundation is associated with a separately-developed token; this repository
contains only the foundation's public website and is not financial software.

Maintainer: Ekmel Ozdemir — [github.com/gke0op](https://github.com/gke0op) ·
[huggingface.co/ego0op](https://huggingface.co/ego0op)

<!-- deploy nudge: retrigger Cloudflare Pages build 2026-07-10 -->
