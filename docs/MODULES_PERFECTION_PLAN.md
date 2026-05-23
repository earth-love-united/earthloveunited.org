# INTERACTIVE LEARNING MODULES — PERFECTION PLAN
## Earth Love United | May 2026
### Design Pattern: Hook → Explore → Discover → Verify → Connect

---

## OVERVIEW

7 modules. Each follows the **Brilliant.com-style** learning loop:

```
┌──────────┐    ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐
│  HOOK    │───▶│ EXPLORE  │───▶│ DISCOVER  │───▶│ VERIFY   │───▶│ CONNECT  │
│ Surprise  │    │ Interact │    │ Understand│    │ Quiz     │    │ Action   │
│ + Context │    │ Manipulate│   │ "Aha!"    │    │ Confirm  │    │ Next step│
└──────────┘    └──────────┘    └───────────┘    └──────────┘    └──────────┘
```

**Target:** Each module is self-contained, works in 3–15 minutes, and chains naturally into the next.

---

## MODULE 1: THE CARBON ATOM'S JOURNEY

### Concept
User follows a single carbon atom through the cycle — atmosphere → tree → fire → atmosphere OR fossil fuel → power plant → ocean → new tree. User makes choices at each branch point.

### Spec
| Stage | Content | Interactive Element |
|-------|---------|-------------------|
| **HOOK** | "This carbon atom was inside a dinosaur 65 million years ago. Where is it now?" | Full-screen animation of atom floating |
| **EXPLORE** | 8 possible paths through the carbon cycle | Click-to-choose branching paths on a mini-globe |
| **DISCOVER** | Each path shows real timescales (seconds for respiration, millions of years for fossilization) | Animated timer + path summary |
| **VERIFY** | "Which path takes the longest? How much CO₂ does burning 1 tree release?" | Multiple choice with instant feedback |
| **CONNECT** | "Want to see how billions of these atoms add up? → The Keeling Curve" | Link to Module 2 |

### Data Sources
- `data/climate-knowledge-curated.jsonl` (carbon cycle chunks)
- `RESEARCH.md` Section 1 (carbon cycle pools & fluxes)
- `data/geological-memory.json` (deep time context)

### Files to Create
- `js/module-carbon-atom.js` — Module logic (branching paths, animations)
- `css/module-carbon-atom.css` — Styling for the journey visualization
- `design/module-1-carbon-atom.html` — Prototype

### Existing Assets
- `design/concept-1-weight.html` — The CO₂ ticker concept (reusable for Hook)
- `js/biomes.js` — Biome data for geographic context
- `js/data.js` — Core data layer

### Implementation Notes
- Use SVG/CSS animations for the carbon atom path (no heavy 3D needed)
- Branching paths rendered as a directed graph (D3.js or hand-drawn SVG)
- Timescales shown as proportional bars ("1 second here = 1 million years here")

---

## MODULE 2: THE KEELING CURVE EXPLORER

### Concept
Interactive timeline of atmospheric CO₂ — scrub through 68+ years of data (1958–present), overlay historical events, compare to ice core data going back 800,000 years.

### Spec
| Stage | Content | Interactive Element |
|-------|---------|-------------------|
| **HOOK** | "This wavy line changed how we understand our planet. It's still climbing." | Animated Keeling Curve drawing itself |
| **EXPLORE** | Scrub through monthly CO₂ data, toggle seasonal cycle vs trend | Range slider + chart interaction |
| **DISCOVER** | Seasonal oscillation = Northern Hemisphere breathing in/out | Overlay explanation on chart |
| **VERIFY** | "What month has the lowest CO₂ each year? Why?" | Short answer input |
| **CONNECT** | "Now you see the trend. But how much budget is left? → Carbon Budget Game" | Link to Module 3 |

### Data Sources
- `gaia-data.js` — Real-time NOAA CO₂ (live feed)
- `data/climate-knowledge-curated.jsonl` — Keeling Curve context
- `RESEARCH.md` Section 2.1 (atmospheric CO₂ data)
- NOAA GML endpoint: `https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt`
- Ice core data (from `holocene-bifurcation/data/processed/`)

### Files to Create
- `js/module-keeling.js` — Chart rendering + scrubber logic
- `css/module-keeling.css` — Chart styling
- `design/module-2-keeling.html` — Prototype

### Existing Assets
- `js/gaia-charts.js` — Canvas chart renderer (sparklines, bar charts)
- `design/concept-4-fusion.html` — Multi-act narrative structure (reusable pattern)

### Implementation Notes
- Use `gaia-charts.js` canvas renderer for the main chart
- Add a secondary smooth line for the trend (5-year moving average)
- Ice core overlay as a faded background line (800K years compressed)
- Historical event markers: Paris Agreement (2015), COVID dip (2020), etc.
- "What if" slider: project future CO₂ based on emission scenarios

---

## MODULE 3: THE CARBON BUDGET GAME

### Concept
User is given the remaining carbon budget and must allocate it across sectors. Real-time temperature feedback shows consequences of their choices.

### Spec
| Stage | Content | Interactive Element |
|-------|---------|-------------------|
| **HOOK** | "You have 250 Gt CO₂ left. Spend it wisely — it's all that's left for 1.5°C." | Big number animation |
| **EXPLORE** | Sliders for energy, transport, industry, food, buildings | Interactive sliders with real-time budget counter |
| **DISCOVER** | Temperature projection updates as budget depletes | Thermometer gauge + global map heat overlay |
| **VERIFY** | "Can you keep warming under 1.5°C? Try different allocations" | Challenge mode with scoring |
| **CONNECT** | "Different countries spend differently. See who's over budget → Pledge vs Reality" | Link to Module 4 + globe |

### Data Sources
- `RESEARCH.md` Section 4.5 (carbon budget)
- `DATA_SOURCES.md` Section 1.2 (OWID CO₂ dataset)
- IPCC AR6 carbon budget data (in `data/climate-knowledge-curated.jsonl`)
- `data/climate-facts.json` (budget figures)
- OWID: `https://nyc3.digitaloceanspaces.com/owid-public/data/co2/owid-co2-data.csv`

### Files to Create
- `js/module-carbon-budget.js` — Budget calculator + allocation engine
- `css/module-carbon-budget.css` — Dashboard styling
- `design/module-3-budget.html` — Prototype

### Existing Assets
- `js/scenario.js` — Scenario builder (already exists, needs adaptation)
- `js/carbon-clock.js` — Live CO₂ counter widget
- `data/pledge-nodes.json` — Country emissions data for comparison

### Implementation Notes
- Pre-compute emission factors per sector (kg CO₂ per unit of activity)
- Temperature response model: simplified MAGICC-style (ΔT ≈ λ × cumulative CO₂)
- Country comparison mini-globe overlay showing per-capita vs total
- Gamification: assign a "Budget Grade" (A-F) based on outcome

---

## MODULE 4: RESTORATION PROJECT EXPLORER

### Concept
Globe-based interactive map of restoration projects worldwide. Filter by type, country, registry, price. Click for details with carbon impact, co-benefits, verification status.

### Spec
| Stage | Content | Interactive Element |
|-------|---------|-------------------|
| **HOOK** | "There are 8,877 carbon projects on Earth. Most people have never heard of one." | Globe auto-fly to project cluster |
| **EXPLORE** | Filter panel: type, country, registry, vintage, price range | Globe markers update in real-time |
| **DISCOVER** | Click project → detail panel with location, size, species, carbon impact, photos | Side panel with project deep-dive |
| **VERIFY** | "Is this project real? Check the registry and verification status" | Registry verification walkthrough |
| **CONNECT** | "Now understand the market that prices these projects → Carbon Market Dashboard" | Link to Module 5 |

### Data Sources
- `carbon-projects/unified/carbon_projects_final.jsonl` (8,877 projects, 27 MB)
- `data/sites.json` (existing site data)
- `CARBON_REGISTRIES.md` (registry analysis)
- `PLEDGE_INTEGRATION_GUIDE.md` (country node data)

### Files to Create
- `js/module-projects.js` — Project filtering, globe rendering, detail panel
- `css/module-projects.css` — Project cards, filter panel
- `design/module-4-projects.html` — Prototype

### Existing Assets
- `js/globe.js` — Globe.gl rendering (points, arcs, markers)
- `js/site-panel.js` — Site detail panel (reusable pattern)
- `js/pledge-wall.js` — Pledge/commitment UI pattern
- Carbon project data is already unified and deduplicated

### Implementation Notes
- Use globe.gl `pointLayer` with size = credits issued, color = project type
- Implement filter chips (sector: forestry/energy/cookstoves, registry: Verra/Gold Standard/ACR)
- Comparison mode: select 2-3 projects → side-by-side card layout
- "Impact Calculator" widget: "How many trees to offset a NYC-London flight?"
- Registry verification badges with tooltip explanations

---

## MODULE 5: CARBON MARKET DASHBOARD

### Concept
Real-time carbon credit prices, historical charts, registry comparison, retirement counter. Educational — not for actual trading.

### Spec
| Stage | Content | Interactive Element |
|-------|---------|-------------------|
| **HOOK** | "A ton of CO₂ was just sold for $X. Here's how that market works." | Live price ticker |
| **EXPLORE** | Time range selector, project type filter, registry comparison | Interactive charts |
| **DISCOVER** | "Prices vary 100x between registries. Here's why." | Comparative analysis |
| **VERIFY** | "What would you pay to offset a transatlantic flight?" | Calculator challenge |
| **CONNECT** | "Markets are one solution. What else works? → Drawdown Solutions" | Link to Module 6 |

### Data Sources
- `gaia-data.js` — Carbonmark API (live prices + retirements)
- `DATA_SOURCES.md` Section 2.5 (carbon market data sources)
- `carbon-projects/unified/market_analysis.json`
- Ecosystem Marketplace data
- EU ETS compliance prices

### Files to Create
- `js/module-market.js` — Dashboard rendering + API integration
- `css/module-market.css` — Dashboard styling
- `design/module-5-market.html` — Prototype

### Existing Assets
- `js/gaia-charts.js` — Canvas chart renderer
- `js/gaia-data.js` — Live data engine with Carbonmark
- Carbon Clock widget (retirement counter concept)

### Implementation Notes
- Line charts for price history (1 day / 1 week / 1 month / 1 year / all time)
- Bar chart comparing average prices by registry (Verra vs Gold Standard vs ACR)
- Retirement counter: "X tonnes retired today" (animated ticker)
- "Buy and retire" simulation — educational, no real transactions
- Color-code: green = nature-based, blue = tech-based, orange = renewable energy

---

## MODULE 6: DRAWDOWN SOLUTIONS EXPLORER

### Concept
80+ climate solutions ranked by impact. Filter by sector, cost, readiness. Build a personal "solution portfolio."

### Spec
| Stage | Content | Interactive Element |
|-------|---------|-------------------|
| **HOOK** | "There are 80 ways to stop climate change. Here are the top 10 by impact." | Ranked card stack animation |
| **EXPLORE** | Filter by sector, cost range, impact level, readiness | Dynamic card grid |
| **DISCOVER** | Each card: description, CO₂ reduction (Gt), cost/savings, co-benefits | Card flip animation for details |
| **VERIFY** | Quiz: "Which solution removes the most CO₂ per dollar?" | Ranked comparison challenge |
| **CONNECT** | "Build your portfolio. Now see how YOUR actions add up → Your Carbon Footprint" | Link to Module 7 |

### Data Sources
- `data/climate-knowledge-curated.jsonl` (Drawdown solutions chunks)
- `data/raw/drawdown_solutions.json` + `drawdown_solutions_v2.json`
- Project Drawdown website data
- `RESEARCH.md` Section 5 (solutions analysis)

### Files to Create
- `js/module-drawdown.js` — Solution cards, filtering, portfolio builder
- `css/module-drawdown.css` — Card grid, flip animations
- `design/module-6-drawdown.html` — Prototype

### Existing Assets
- Data already exists in processed JSONL format
- Card UI pattern from pledge-wall.js (reusable)
- Comparison tool concept from concept-3-diagnosis.html

### Implementation Notes
- Each solution card: front (summary + impact score), back (full details + "How you can help")
- Drag-and-drop portfolio builder (HTML5 drag API)
- "If all of America adopted this..." impact calculator
- Comparison tool: side-by-side of any 3 solutions
- Color coding by sector: energy (amber), food (green), buildings (blue), transport (teal), land use (brown)

---

## MODULE 7: YOUR CARBON FOOTPRINT

### Concept
Step-by-step calculator → personalized action plan → offset recommendation from verified projects.

### Spec
| Stage | Content | Interactive Element |
|-------|---------|-------------------|
| **HOOK** | "You emit X tonnes of CO₂ per year. Here's where it comes from." | Animated footprint growing |
| **EXPLORE** | Slider questionnaire: home energy, transport, food, goods | Real-time footprint update |
| **DISCOVER** | Compare to national/global average. See breakdown by category | Bar chart + country comparison |
| **VERIFY** | "If you did X, you'd reduce by Y% over Z years" | Commit to actions |
| **CONNECT** | "Offset what you can't reduce → Restoration Project Explorer" | Link to Module 4 |

### Data Sources
- `DATA_SOURCES.md` (EPA emission factors)
- `RESEARCH.md` (impact data)
- OWID per-capita emissions data
- Carbonmark API (offset pricing)
- `data/sites.json` and `data/pledge-nodes.json` (country context)

### Files to Create
- `js/module-footprint.js` — Calculator engine + action planner
- `css/module-footprint.css` — Questionnaire + result styling
- `design/module-7-footprint.html` — Prototype

### Existing Assets
- `js/carbon-clock.js` — CO₂ counter widget
- `js/delegation.js` — Country-specific data entry
- `js/data.js` — Core data layer
- Carbon Footprint calculator pattern from concept-1-weight.html

### Implementation Notes
- 5-step questionnaire (home → transport → food → goods → travel)
- Animated footprint visualization: grows/shrinks as user adjusts sliders
- "Your footprint vs. global average" comparison bar
- Personalized action plan: top 5 actions ranked by impact × feasibility
- "Offset your footprint" → links to Module 4 projects sorted by price
- Progress tracker: "You've reduced your footprint by X%"

---

## CROSS-MODULE CHAINING

```
Module 1 (Carbon Atom)
  → Module 2 (Keeling Curve) — "See how billions of atoms change the atmosphere"
    → Module 3 (Budget Game) — "Here's our remaining budget"
      → Module 7 (Footprint) — "Your share of that budget"
        → Module 4 (Projects) — "Offset what you can't reduce"
          → Module 5 (Market) — "Here's how carbon pricing works"
            → Module 6 (Drawdown) — "And here's the full solution set"
```

Each module ends with one forward link. User can enter at any module via sidebar/navigation.

---

## IMPLEMENTATION PHASING

### Phase A: Prototypes (Week 1) — 7 HTML files + minimal JS
| Day | Module | Deliverable |
|-----|--------|-------------|
| 1 | 1 + 2 | Static HTML prototypes with hardcoded data |
| 2 | 3 + 4 | Static HTML prototypes with hardcoded data |
| 3 | 5 + 6 | Static HTML prototypes with hardcoded data |
| 4 | 7 | Static HTML prototype with hardcoded data |
| 5 | All | Design review + iteration |

### Phase B: Interactive Logic (Week 2) — JS engines
| Day | Modules | Deliverable |
|-----|---------|-------------|
| 6-7 | 1 + 2 | Branching logic + chart scrubber working |
| 8-9 | 3 + 7 | Budget game logic + footprint calculator |
| 10 | 4 | Project filter + globe integration |
| 11 | 5 | Live price charts via gaia-data.js |
| 12 | 6 | Card grid + portfolio builder |
| 13-14 | All | Cross-module navigation + responsive polish |

### Phase C: Data Integration (Week 3) — Live data
- Wire NOAA API for live CO₂ (Module 2)
- Wire Carbonmark API for live prices (Module 5)
- Wire project data from `carbon-projects_final.jsonl` (Module 4)
- Wire Drawdown data from `data/climate-knowledge-curated.jsonl` (Module 6)
- Wire country emissions from `pledge-nodes.json` (Module 7)

### Phase D: Polish + CI (Week 4)
- Unit tests for calculator logic (Modules 3, 7)
- Visual regression tests for all modules
- Performance audit (target: < 2s per module load)
- Mobile touch optimization
- Turkish language strings (COP31 requirement)

---

## TECHNICAL DECISIONS

### Framework
- **No React** — keep vanilla JS with the existing IIFE/component pattern
- Modules are self-contained `<section>` elements with `data-module` attribute
- Each module JS file exports an `init()` function called by `app.js`

### Charts
- Use existing `gaia-charts.js` canvas renderer (sparklines, bar charts)
- For Module 2 (Keeling Curve): consider lightweight D3.js for the timeline scrubber only
- All charts export to static canvas (screenshot-friendly)

### State
- Each module saves progress to `localStorage` (module-specific key)
- Global module progress tracked by `GAIA_ENGAGEMENT` (existing scoring system)
- Completion unlocks badges (see PRODUCTION_GUIDE.md gamification section)

### CSS Pattern
- Each module gets its own CSS file: `css/module-{name}.css`
- Shared variables in `css/base.css` (colors, spacing, typography tokens)
- RTL support planned via CSS logical properties (COP31 Turkey)

### Accessibility
- All interactive elements keyboard-navigable (Tab/Enter/Space/Arrow keys)
- ARIA labels on all form controls and interactive elements
- Color contrast verified against WCAG 2.1 AA
- Reduced motion support: respect `prefers-reduced-motion`

---

## FILE CREATION SUMMARY

### New JS Modules (7 files)
```
js/module-carbon-atom.js     — Branching carbon journey
js/module-keeling.js         — Interactive CO₂ timeline
js/module-carbon-budget.js   — Budget allocation game
js/module-projects.js        — Restoration project explorer
js/module-market.js          — Carbon market dashboard
js/module-drawdown.js        — Solutions explorer + portfolio
js/module-footprint.js       — Personal calculator + planner
```

### New CSS Modules (7 files)
```
css/module-carbon-atom.css
css/module-keeling.css
css/module-carbon-budget.css
css/module-projects.css
css/module-market.css
css/module-drawdown.css
css/module-footprint.css
```

### New Design Prototypes (7 files)
```
design/module-1-carbon-atom.html
design/module-2-keeling.html
design/module-3-budget.html
design/module-4-projects.html
design/module-5-market.html
design/module-6-drawdown.html
design/module-7-footprint.html
```

### Modified Files
- `js/app.js` — Add module loading/navigation
- `js/globe.js` — Hook project explorer into globe click handlers
- `js/gaia-integration.js` — Wire module completion to DIS events
- `css/base.css` — Add module-shared variables
- `index.html` — Add module navigation

---

## SUCCESS CRITERIA (per module)

| Criterion | Target |
|-----------|--------|
| Load time | < 500ms (module JS + CSS, lazy-loaded) |
| Interactions | All drag/slider/click work on desktop + touch |
| Data accuracy | All numbers traced to `data/` or `docs/` sources |
| Accessibility | WCAG 2.1 AA (keyboard + screen reader + contrast) |
| Mobile | Full functionality at 375px width |
| Cross-module | Navigation chain works in both directions |
| COP31 ready | Turkish strings extractable, RTL layout supported |