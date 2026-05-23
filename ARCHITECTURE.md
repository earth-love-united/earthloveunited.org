# Earth Love United — Architecture Map

> **Read this before touching any code.** This document maps the entire module system,
> z-index stacking order, event flows, and known traps.
>
> Last updated: 2026-05-21

---

## Module Registry

Every JS module that is referenced via `safeCall()`, `hasModule()`, or `safeGet()`
**must** be attached to `window` — otherwise these functions silently fail.

### Core Layer (required for page to function)

| Module | File | `window.X` | Pattern | Description |
|--------|------|:----------:|---------|-------------|
| `Data` | `js/data.js` | ❌ global | `const Data = {}` | JSON loader, biome/site data, carbon math |
| `Storage` | `js/data.js` | ❌ global | `const Storage = {}` | Safe localStorage wrapper |
| `GlobeModule` | `js/globe.js` | ❌ global | `const GlobeModule = {}` | Globe.gl renderer, point/label setup |
| `Panel` | `js/globe.js` | ❌ global | `const Panel = {}` | Legacy right-side panel (used as fallback) |
| `PanelSlider` | `js/globe.js` | ❌ global | `const PanelSlider = {}` | NDVI/area slider helpers for Panel |
| `App` | `js/app.js` | ❌ global | `const App = {}` | Main init, scroll handler, enterSite() |
| `Quiz` | `js/quiz.js` | ❌ global | `const Quiz = {}` | Carbon quiz widget |
| `Biomes` | `js/biomes.js` | ❌ global | `const Biomes = {}` | Biome comparison bars |
| `Counters` | `js/counters.js` | ❌ global | `const Counters = {}` | Animated number counters |
| `Cycle` | `js/cycle.js` | ❌ global | `const Cycle = {}` | Carbon cycle diagram |
| `Scenario` | `js/scenario.js` | ❌ global | `const Scenario = {}` | Biome transition sandbox |

### Globe Interaction Layer

| Module | File | `window.X` | Pattern | Description |
|--------|------|:----------:|---------|-------------|
| `GLOBE_OVERLAY` | `js/globe-overlay.js` | ✅ | const IIFE | Left sidebar over globe — tabbed content |
| `GAIA_NODES` | `js/gaia-nodes.js` | ✅ | const IIFE | Globe point click handlers, site registration |
| `SITE_PANEL` | `js/site-panel.js` | ✅ | const IIFE | Right side panel (currently unused in favor of GLOBE_OVERLAY) |
| `PLEDGE_PANEL` | `js/site-panel.js` | ✅ | const IIFE | Pledge node dashboard renderer |
| `COUNTRY_DATA` | `js/country-data.js` | ❌ IIFE | const IIFE | Country metadata for pledge tooltips |
| `DELEGATION` | `js/delegation.js` | ❌ IIFE | const IIFE | COP31 delegation data |

### GAIA Intelligence Layer

| Module | File | `window.X` | Pattern | Description |
|--------|------|:----------:|---------|-------------|
| `GAIA_BUBBLE` | `js/gaia-bubble.js` | ❌ IIFE | const IIFE | Floating GAIA speech bubble |
| `GAIA_VOICE` | `js/gaia-voice.js` | ❌ IIFE | const IIFE | Voice line selection engine |
| `GAIA_ENGAGEMENT` | `js/gaia-engagement.js` | ✅ | const IIFE | User behavior tracking, archetype detection |
| `GAIA_PRESENCE` | `js/gaia-presence.js` | ✅ | const IIFE | Ambient site teasers |
| `GAIA_JOURNAL` | `js/gaia-journal.js` | ❌ IIFE | const IIFE | Session journal/diary |
| `GAIA_KNOWLEDGE` | `js/gaia-overlay-knowledge.js` | ❌ IIFE | const IIFE | TF-IDF knowledge engine (2541 chunks) |
| `GAIA_CHARTS` | `js/gaia-legacy/gaia-charts.js` | ❌ legacy | `window.GAIA_CHARTS` via script | Canvas sparklines |
| `GAIA_DATA` | `js/gaia-legacy/gaia-data.js` | ❌ legacy | `window.GAIA_DATA` via script | Live CO₂/climate data fetcher |
| `GaiaMind` | `dis/gaia-mind.js` | ❌ | distributed | LLM state machine for GAIA chat |

### Utility Layer

| Module | File | `window.X` | Pattern | Description |
|--------|------|:----------:|---------|-------------|
| `CARBON_CLOCK` | `js/carbon-clock.js` | ❌ IIFE | const IIFE | Live CO₂ clock in topbar |
| `PLEDGE_WALL` | `js/pledge-wall.js` | ❌ IIFE | const IIFE | Pledge modal + wall display |
| `NDVIVerifier` | `js/ndvi-verifier.js` | ❌ IIFE | const IIFE | Satellite NDVI verification |
| `RegistryCheck` | `js/registry-check.js` | ❌ IIFE | const IIFE | Carbon registry verification |

---

## Z-Index Stack (top → bottom)

All `position: fixed` elements compete for click priority. This stack MUST be
maintained as the single source of truth for stacking order.

```
z-index  │ Element              │ File                  │ Notes
─────────┼──────────────────────┼───────────────────────┼─────────────────────────
1000     │ #scroll-progress     │ layout.css            │ 2px bar, harmless
1000     │ #pledge-tooltip      │ globe-overlay.css     │ pointer-events:none when hidden
 300     │ #pledge-modal        │ pledge-wall.css       │ display:none when inactive
 300     │ #pledge-wall         │ pledge-wall.css       │ display:none when inactive
 201     │ .gaia-bubble-expand  │ gaia-bubble.css       │ Full chat window
 200     │ #hero                │ layout.css            │ pe:none + opacity:0 when .hidden
 200     │ #gaia-bubble         │ gaia-bubble.css       │ Floating bubble, small
 100     │ #topbar              │ layout.css            │ 60px tall, full width
  90     │ #site-panel          │ components.css        │ ⚠️ pe:none when not .open
  85     │ #panel-backdrop      │ components.css        │ display:none when not .show
  85     │ .site-panel-overlay  │ components.css        │ display:none when not .visible
  50     │ #globe-overlay       │ globe-overlay.css     │ pe:none when not .open. ON body!
  10     │ .sections            │ layout.css            │ Opaque background, captures clicks
  10     │ .footer              │ layout.css            │ Below sections
   1     │ #globeViz            │ layout.css            │ Globe canvas. pe:none when scrolled
```

### Stacking Rules

1. **NEVER** append interactive DOM elements as children of `#globeViz` (z-index: 1).
   They will be trapped below `.sections` (z-index: 10).
2. Elements with `pointer-events: none` should also have `display: none` or
   `opacity: 0` when inactive. `opacity: 0` alone does NOT disable pointer-events.
3. `transform` creates a new stacking context. An element with `transform: translateX(100%)`
   is visually off-screen but still captures events unless `pointer-events: none` is set.

---

## Event Flow: Globe Point Click

```
User clicks globe point
  │
  ├─ p._type === 'site'
  │    └─ hasModule('GAIA_NODES') ? ──yes──► GAIA_NODES.onNodeClick(siteId)
  │                                             ├─ safeCall('GLOBE_OVERLAY', 'open', siteId)
  │                                             ├─ addXP(siteId, 10)
  │                                             ├─ safeCall('GAIA_BUBBLE', 'speak', ...)
  │                                             └─ safeCall('GAIA_ENGAGEMENT', 'addSignal', ...)
  │    └─ hasModule('SITE_PANEL') ? ──yes──► SITE_PANEL.open(site)
  │    └─ fallback ──────────────────────────► Panel.open(site)
  │
  └─ p._type === 'pledge'
       └─ hasModule('PLEDGE_PANEL') ? ──yes──► PLEDGE_PANEL.open(node)
                                                  ├─ GLOBE_OVERLAY.registerSite({...})
                                                  └─ GLOBE_OVERLAY.open('pledge_' + iso)
       └─ fallback ───────────────────────────► Panel.open({...})
```

## Event Flow: Enter Site (Hero → Globe)

```
User clicks "Enter the Living System"
  │
  └─ enterSite() → App.enterSite()
       ├─ #hero.classList.add('hidden')     → opacity:0, pe:none
       ├─ #topbar.classList.add('visible')  → opacity:1, pe:all
       ├─ updateProgress()                  → scroll bar width
       └─ scroll handler activates:
            └─ if scrollY > 30vh → #globeViz.pe = 'none'
            └─ if scrollY < 30vh → #globeViz.pe = ''
            └─ if GLOBE_OVERLAY.isOpen() → skip pe:none
```

---

## Script Load Order (index.html)

Scripts load synchronously in this order. A module can only reference modules
that appear ABOVE it in this list.

```
 1. globe.gl (CDN)           ← Three.js + globe.gl library
 2. gaia-utils.js            ← $(), safeCall, hasModule, safeGet
 3. data.js                  ← Data, Storage
 4. quiz.js                  ← Quiz
 5. cycle.js                 ← Cycle
 6. biomes.js                ← Biomes
 7. counters.js              ← Counters
 8. scenario.js              ← Scenario
 9. globe.js                 ← GlobeModule, Panel, PanelSlider
10. gaia-legacy/gaia-data.js ← GAIA_DATA
11. gaia-legacy/gaia-signals.js ← GAIA_SIG
12. gaia-legacy/gaia-charts.js  ← GAIA_CHARTS
13. gaia-voice.js            ← GAIA_VOICE
14. dis/gaia-mind.js         ← GaiaMind
15. gaia-engagement.js       ← GAIA_ENGAGEMENT
16. gaia-journal.js          ← GAIA_JOURNAL
17. gaia-bubble.js           ← GAIA_BUBBLE
18. site-panel.js            ← SITE_PANEL, PLEDGE_PANEL
19. carbon-clock.js          ← CARBON_CLOCK
20. country-data.js          ← COUNTRY_DATA
21. delegation.js            ← DELEGATION
22. pledge-wall.js           ← PLEDGE_WALL
23. globe-overlay.js         ← GLOBE_OVERLAY
24. gaia-nodes.js            ← GAIA_NODES
25. gaia-legacy/gaia-knowledge.js ← GaiaKnowledge
26. gaia-overlay-knowledge.js ← GAIA_KNOWLEDGE
27. ndvi-verifier.js         ← NDVIVerifier
28. gaia-presence.js         ← GAIA_PRESENCE
29. registry-check.js        ← RegistryCheck
30. module-validator.js      ← Boot validator (NEW)
31. app.js                   ← App (init entry point)
```

---

## CSS Files

| File | Purpose |
|------|---------|
| `css/layout.css` | Page structure: hero, topbar, sections, globe, footer |
| `css/components.css` | Cards, panels, backdrops, sliders, quiz, cycle |
| `css/globe-overlay.css` | Left sidebar overlay, tabs, charts, pledge styles |
| `css/gaia-bubble.css` | GAIA bubble + full chat window |
| `css/gaia-presence.css` | GAIA cursor follower + ambient elements |
| `css/pledge-wall.css` | Pledge modal + wall display |
| `css/ndvi-verifier.css` | NDVI satellite verification panel |

---

## Data Files

| File | Description | Loaded by |
|------|-------------|-----------|
| `data/biomes.json` | 12 biome types with carbon density, sequestration rates | Data.init() |
| `data/sites.json` | 4 restoration sites with NDVI, climate, narratives | Data.init() |
| `data/pledge-nodes.json` | 123 countries with emissions, targets, reality gaps | Data.init() |
| `dis/climate-facts.json` | Global climate statistics | GAIA_KNOWLEDGE |
| `dis/gaia-knowledge-base.json` | 2541 text chunks for TF-IDF search | GAIA_KNOWLEDGE |

---

## Known Traps

| Trap | Why It's Dangerous | Prevention |
|------|-------------------|------------|
| `const X = (() => {})()` without `window.X = X` | `safeCall('X', ...)` silently returns undefined | Boot validator catches this |
| Appending DOM to `#globeViz` | Child z-index trapped below `.sections` (z:10) | ALWAYS append to `document.body` |
| `opacity: 0` without `pointer-events: none` | Element is invisible but intercepts all clicks | Always pair opacity:0 with pe:none |
| `transform: translateX(100%)` without `pe:none` | Element is off-screen but has live hit area | Always pair transform with pe:none |
| Duplicate CSS selectors (`#panel-backdrop` × 2) | Second rule may override first unexpectedly | Lint / manual audit |
| `safeCall` swallows errors | Catch block logs warning but returns undefined | Check console for `[safeCall]` warnings |
