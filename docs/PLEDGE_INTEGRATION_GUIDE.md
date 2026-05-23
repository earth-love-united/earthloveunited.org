# Pledge vs Reality — Globe Integration Guide

> **For:** Hermes (or any agent wiring the COP31 accountability layer)
> **Status:** Data pipeline S-TIER ✅ | Front-end scaffolded, needs testing & polish
> **Last Updated:** 2026-05-20

---

## 1. Architecture Overview

```
pledge-reality/data/output/              → Pipeline output (Parquet, 302 KB)
earthloveunited.org/data/pledge-nodes.json → Front-end JSON (123 nodes, 119 KB)
earthloveunited.org/js/data.js           → Loads pledge-nodes.json as Data.pledgeNodes
earthloveunited.org/js/globe.js          → GlobeModule.initPledgeNodes() renders on globe
earthloveunited.org/js/site-panel.js     → PLEDGE_PANEL.open(node) renders interrogation panel
```

### Data Flow
```
User clicks country node on globe
  → globe.js onPointClick (p._type === 'pledge')
    → PLEDGE_PANEL.open(p)
      → GLOBE_OVERLAY.open('pledge_' + node.iso)
        → renderDashboard(el, node) builds the HTML
```

---

## 2. What Already Exists (DO NOT REWRITE)

### globe.js (lines 60-298)
- `initPledgeNodes()` — merges `Data.sites` + `Data.pledgeNodes` into `pointsData`
- `pledgePointColor(n)` — red/green/grey based on `reality_gap_mt`
- `pledgePointAltitude(n)` — height scaled by `fossil_co2_mt`
- `pledgePointRadius(n)` — radius scaled by `fossil_co2_mt`
- `setLens(lens)` — switches between `'gap'`, `'forest'`, `'cat'` lenses
- `_initPledgeTooltip()` — hover tooltip with country name, emissions, status

### site-panel.js (lines 662-801)
- `PLEDGE_PANEL` — full IIFE module with `open(node)` and `close()`
- `renderDashboard(el, node)` — builds the complete interrogation panel HTML
  - CAT rating badge
  - Reality Gap card (big number + gap metric)
  - Emissions breakdown grid (fossil, LULUCF, total, per-capita)
  - Momentum section (actual velocity vs required velocity)
  - Divergence indicator
  - Change since 2015
  - On-track / Off-track badge
  - Climate Finance section
  - NDC Summary text

### data.js (lines 67-74)
- `Data.pledgeNodes` loaded from `data/pledge-nodes.json`

---

## 3. What Hermes Must Do

### Phase 1: Verify & Debug (Browser Test)

Open `index.html` or `gaia.html` in the browser and verify:

1. **Country nodes appear on the globe** — 123 colored dots should be visible alongside the 4 existing site nodes. If not visible, check:
   - `Data.pledgeNodes` is loaded (inspect `Data.pledgeNodes` in console)
   - `GlobeModule.initPledgeNodes()` is called after data loads
   - `pointsData` merging doesn't clobber the existing sites

2. **Hover tooltip works** — hovering a country dot should show a floating tooltip with country name, emissions, and OVERSHOOTING/ON TRACK status. The tooltip follows the cursor. CSS for `#pledge-tooltip` must exist.

3. **Click opens the Interrogation Panel** — clicking a country dot should:
   - Fly the camera to that country
   - Open the left-side GLOBE_OVERLAY panel
   - Show the dashboard with all metrics

4. **Lens switching works** — Call `GlobeModule.setLens('cat')`, `GlobeModule.setLens('forest')`, `GlobeModule.setLens('gap')` from console. Colors and heights should change.

### Phase 2: CSS Polish

The following CSS classes are referenced but may need creation/refinement:

```css
/* Tooltip */
#pledge-tooltip { ... }
#pledge-tooltip.visible { ... }
.tt-country { ... }
.tt-detail { ... }
.tt-status-red { ... }
.tt-status-green { ... }

/* Panel components */
.pledge-cat-badge { ... }
.pledge-gap-card { ... }
.pledge-big-number { ... }
.pledge-unit { ... }
.pledge-gap-metric { ... }
.pledge-gap-metric.red { ... }
.pledge-gap-metric.green { ... }
.pledge-emit-grid { ... }
.pledge-emit-item { ... }
.pledge-momentum { ... }
.pledge-momentum-actual { ... }
.pledge-momentum-vs { ... }
.pledge-momentum-required { ... }
.pledge-divergence { ... }
.pledge-on-track { ... }
.pledge-section { ... }
.pledge-finance-total { ... }
.pledge-ndc-text { ... }
```

**Design Direction:** Terminal-aesthetic. Dark background, mono font for numbers, red/green for status. Should feel like a command center interrogation terminal, not a friendly dashboard.

### Phase 3: Lens Toggle UI

Add 3 small buttons overlaying the bottom-left of the globe:

```html
<div id="lens-switcher">
  <button class="lens-btn active" onclick="GlobeModule.setLens('gap')">Reality Gap</button>
  <button class="lens-btn" onclick="GlobeModule.setLens('forest')">Forestry</button>
  <button class="lens-btn" onclick="GlobeModule.setLens('cat')">CAT Rating</button>
</div>
```

Wire `.active` class toggling on click.

### Phase 4: Required CAGR Bug Fix

In `renderDashboard()` line 740, the condition `node.required_cagr > 0` is wrong — required CAGR is always **negative** (a country needs to *reduce* emissions). Fix:

```javascript
// BEFORE (broken):
if (node.required_cagr > 0) {

// AFTER (correct):
if (node.required_cagr !== null && node.required_cagr !== undefined) {
```

Also line 744 hardcodes a negative sign. Use the actual value:

```javascript
// BEFORE:
html += '<div class="pledge-momentum-val">-' + node.required_cagr.toFixed(2) + '%/yr</div>';

// AFTER:
html += '<div class="pledge-momentum-val">' + node.required_cagr.toFixed(2) + '%/yr</div>';
```

---

## 4. Data Schema (pledge-nodes.json)

Each of the 123 country nodes has:

| Field | Type | Coverage | Description |
|---|---|---|---|
| `iso` | string | 100% | ISO3 country code |
| `country` | string | 100% | Country name |
| `lat`, `lng` | float | 100% | Centroid coordinates |
| `fossil_co2_mt` | float | 100% | 2024 fossil CO2 emissions (MtCO2) |
| `lulucf_co2_mt` | float | ~89% | Land-use change emissions (MtCO2) |
| `total_co2_mt` | float | 100% | Fossil + LULUCF |
| `co2_per_capita` | float | 100% | Tonnes per person |
| `population` | float | 100% | Total population |
| `cat_rating` | string | ~18% | CAT rating text (e.g., "Critically insufficient") |
| `cat_score` | int | ~18% | Numeric rating (0-4) |
| `globe_color` | string | 100% | Hex color for CAT lens |
| `target_type` | string | ~90% | "base_year", "bau", "intensity", etc. |
| `reduction_pct` | float | ~72% | Pledged reduction percentage |
| `reduction_pct_upper` | float | ~15% | Upper bound for range pledges |
| `target_year` | float | ~89% | NDC target year (2030, 2035, 2040) |
| `baseline_year` | float | ~40% | Reference year for base_year targets |
| `implied_target_mt` | float | ~43% | Calculated: baseline × (1 - reduction%) |
| `reality_gap_mt` | float | ~43% | actual - implied target (positive = overshooting) |
| `momentum_cagr` | float | 100% | 10-year emissions trend (%/yr) |
| `required_cagr` | float | ~42% | Trajectory needed to hit target (%/yr) |
| `divergence` | float | ~42% | momentum - required (positive = failing) |
| `on_track` | string | ~42% | "true" / "false" / "" |
| `change_since_2015` | float | 100% | % change in emissions since Paris |
| `finance_total_bn` | float | ~40% | Climate finance demand ($B) |
| `conditionality` | string | 100% | "Conditional NDC only", etc. |
| `ndc_summary` | string | 100% | Official NDC summary text |

---

## 5. Key Numbers for Spot-Check Validation

When testing in the browser, verify these numbers appear correctly:

| Country | Emissions | Pledge | Reality Gap | Momentum |
|---|---|---|---|---|
| **United States** | 4,904.1 Mt | 61-66% by 2035 | +2,514.6 Mt | -1.00%/yr |
| **Japan** | 961.9 Mt | 60% by 2035 | +437.1 Mt | -2.61%/yr |
| **Germany** | 572.3 Mt | 66.25% by 2040 | +216.3 Mt | -3.66%/yr |
| **Brazil** | 483.0 Mt (fossil) | 59-67% by 2035 | +333.6 Mt | -0.99%/yr |
| **Russia** | 1,780.5 Mt | 65-67% by 2035 | +892.8 Mt | +0.95%/yr |
| **UK** | 312.9 Mt | 81% by 2035 | +198.5 Mt | -3.28%/yr |

---

## 6. Known Limitations (Must Disclose at COP)

> [!IMPORTANT]
> These are methodological limitations that MUST be acknowledged in any public-facing UI.

1. **Fossil CO2 only** — Emissions data is fossil CO2 from GCB 2025, NOT total GHG (CO2eq). NDC pledges are stated in total GHG. For methane-heavy economies (NZ, Brazil), the reality gap may be underestimated.

2. **LULUCF uses BLUE model** — Not official national inventories. Countries will dispute these numbers.

3. **Reality gap coverage** — Only 91/212 countries have implied targets. The rest use BAU or intensity targets that require GDP projections to resolve.

4. **CAT ratings** — Only 38 countries rated by Climate Action Tracker. The remaining 174 show no rating.

---

## 7. Methodology Card (for the UI)

Add a collapsible "Methodology" section at the bottom of the pledge panel:

```
Data Sources:
  Emissions: Global Carbon Budget 2025 (Friedlingstein et al.)
  LULUCF: GCB 2025 BLUE Model (Hansis et al.)
  NDC Pledges: Climate Watch / World Resources Institute
  CAT Ratings: Climate Action Tracker (NewClimate Institute)
  Population: World Bank — World Development Indicators

Formulas:
  Implied Target = Baseline Emissions × (1 - Reduction%)
  Reality Gap = Current Emissions - Implied Target
  Momentum = CAGR over 2015-2024
  Required CAGR = Rate needed to reach Implied Target by Target Year
  Divergence = Momentum CAGR - Required CAGR

Coverage: 212 countries, 19 historical years (1990-2024)
Audit: 27/27 automated checks passed (S-TIER)
```
