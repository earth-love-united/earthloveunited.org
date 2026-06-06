# Earth Love United

> A global foundation for climate action — open, auditable, and built bare-metal.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![HF Datasets](https://img.shields.io/badge/🤗_Datasets-3_public-orange)](https://huggingface.co/ego0op)
[![No build step](https://img.shields.io/badge/build-bare%20metal-success)](#the-bare-metal-philosophy)

This is the source of [earthloveunited.org](https://earthloveunited.org) — the
public face of the Earth Love United Foundation, a global initiative for
sustainability and climate action. The site is an interactive 3D experience
combining a globe-anchored knowledge layer, a grounded climate-science RAG
agent ("Gaia"), and a pledge wall for community commitments.

We open-sourced this codebase because foundations should be auditable. There
is nothing in here we wouldn't want a partner, donor, or researcher to read.

---

## Quick start

```bash
git clone https://github.com/<ORG>/earthloveunited.org.git
cd earthloveunited.org

# Re-fetch the vendored globe.gl (gitignored — see CREDITS.md)
mkdir -p js/vendor
curl -L https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/dist/globe.gl.min.js \
  -o js/vendor/globe.gl.js

# (Optional) Fetch the climate + carbon datasets from Hugging Face
./tools/fetch-data.sh           # all   — needs `pip install huggingface_hub`

# Serve. That's it.
python3 -m http.server 8000
# → open http://localhost:8000
```

No `npm install`. No `pnpm`. No bundler. No build step at all. The site is two
HTML files (`index.html`, `gaia.html`) loading classic `<script>` tags. See
[ARCHITECTURE.md](ARCHITECTURE.md) for the module map, and
[SWARM_SDK.md](SWARM_SDK.md) for the Standard Module Lifecycle (SML) every
module follows.

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
├── index.html              Landing page (the globe)
├── gaia.html               Gaia agent interface
├── js/
│   ├── gaia-utils.js       Foundation: safeCall, hasModule, $, reportError
│   ├── module-contracts.js Module dependency/interface validation
│   ├── module-validator.js Boot validator — checks all modules on window
│   ├── app.js              Init entry point
│   ├── globe.js            Globe.gl-backed 3D earth
│   ├── gaia-*.js           Gaia agent system (chat, voice, retrieval, etc.)
│   └── ...                 ~40 IIFE modules
├── css/                    Design tokens, layout, components
├── data/                   Small, fast-loading JSON for the site
├── dis/                    Gaia knowledge index + climate facts (runtime data)
├── docs/                   Architecture & research notes
├── ARCHITECTURE.md         Module map, z-index stack, event flows
├── AGENTS.md               Contributor & AI-agent conventions
├── CREDITS.md              Full third-party attribution
├── CONTRIBUTING.md         How to contribute
└── CODE_OF_CONDUCT.md      Community standards
```

---

## Datasets

We publish three open climate datasets on Hugging Face under CC BY 4.0, with
**286 downloads** at the time of going public:

| Dataset | Rows | Downloads |
|---|---|---|
| [`earth-love-united-climate-knowledge`](https://huggingface.co/datasets/ego0op/earth-love-united-climate-knowledge) | ~10,100 | 158 |
| [`carbon-projects-unified`](https://huggingface.co/datasets/ego0op/carbon-projects-unified) | ~23,300 | 100 |
| [`earth-love-united-carbon-projects`](https://huggingface.co/datasets/ego0op/earth-love-united-carbon-projects) | ~23,300 | 28 |

These are the corpus behind Gaia's grounded answers. Built from IPCC AR6,
Project Drawdown, US EPA, NOAA GML, Our World in Data, Wikipedia, and arXiv.
Full source attribution lives in [CREDITS.md](CREDITS.md).

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

The boot validator (`js/module-validator.js`) runs automatically at page load
and reports `✅ [BOOT] N/N modules loaded` in the console.

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
