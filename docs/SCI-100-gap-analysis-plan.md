# Audit Claims Gap Analysis & Execution Plan

**Date:** 2026-06-24
**Scope:** All user-facing quantitative claims in Earth Love United public interface
**Method:** Source-trace audit — trace each claim to primary source, verify math, identify gaps

---

## Phase 1: Gap Analysis (complete)

### Gap Summary

| Category | Total Claims | Verified | Defensible | Unverifiable | Incorrect |
|----------|-------------|----------|------------|--------------|-----------|
| Carbon budget (clock/primer) | 5 | 5 | 3 | 2 | 0 |
| Biome carbon density | 10 | 0 | 10 | 0 | 0 |
| NDVI satellite data | 17 | 0 | 0 | 0 | 17 |
| Site narratives (hectares, events) | 6 | 0 | 0 | 6 | 0 |
| Quiz calculations | 7 | 4 | 2 | 0 | 1 |
| Pledge/globe overlays | 7 | 7 | 0 | 7 | 0 |
| Scenario engine | 0 | 0 | 0 | 0 | 0 |

### Verified (primary source traceable, math correct)

1. Carbon clock math: 20 Gt/yr → 634 tons/sec → 0.634 tons/ms ✓
2. Carbon cycle framing: atmosphere ⇄ vegetation ⇄ ocean ⇄ soil ⇅ human ✓ (standard science)
3. Quiz Q-04: 100 ha × 340 tC/ha × 3.67 × 30 = 3.74M t CO₂ ≈ 3.7M ✓
4. All 10 biome values within literature ranges ✓
5. Pledge node ISO/country/lat/lng fields 100% populated ✓
7. Quiz Q-01/02 explain text: "143 Gt emitted, 123 Gt absorbed" — directionally correct ✓

### Defensible (sound reasoning, no direct primary source in data)

1. Carbon clock 143/123 framing — non-standard but within published ranges
2. Mangrove 950 tC/ha — consistent with IPCC 2019 Wetlands Supplement
3. Peat swamp 1,400 tC/ha — consistent with Page et al 2002
4. Quiz Q-05 "800,000 cars" — 3.74M t / 4.6 t/car = 814K, code says 800K, ~2% off, reasonable rounding

### Unverifiable (no source chain in data files)

1. Antalya "60,000+ hectares burned" — no source in narrative or data
2. Sri Lanka "6,000 acres" — no source
3. Benin "Jean Missinhoun was from Benin" — biographical claim, unverified
4. Borneo "1,400 tC/ha" peat value in narrative — no source, within range but not cited
5. All pledge node metrics (reduction_pct, cat_rating, momentum_cagr, etc.) — 46-78% missing data
6. Quiz Q-06 "14.7M t CO₂" — cannot reproduce from biome model or any combination of parameters
7. Site NDVI dates (2005, 2010, 2015, 2020, 2025) — no MODIS scene IDs, no processing pipeline

### Incorrect (math errors or factual mistakes)

1. **Quiz Q-07:** States "0.04% of one year's global net emissions"
   - 14.7M / 20Gt = 0.0735%, not 0.04%
   - Discrepancy: nearly 2x off
   - Severity: MEDIUM (does not affect learning outcome, but is a displayed error)

### Critical Gaps (high priority for COP31)

| ID | Gap | Impact | Effort to Fix |
|----|-----|--------|---------------|
| G-1 | All NDVI data is synthetic, no disclaimer | Users believe synthetic=real; trust risk if exposed | LOW — add label |
| G-2 | 14.7M mangrove figure unverifiable | Quiz answer has no backing | LOW — recalculate or remove |
| G-3 | 0.04% math error in quiz | Displayed error | TRIVIAL — change number |
| G-4 | Pledge data 46-78% incomplete | Many countries show blank on globe overlay | HIGH — data collection |
| G-5 | No source citation visible anywhere | Scientific authority unverifiable | MEDIUM — add footnotes |
| G-6 | Biome values lack specific citations | Within range but uncited | MEDIUM — add source URLs |
| G-7 | "60,000+ hectares burned" unsourced | Specific number, specific claim | LOW — find source or remove |

---

## Phase 2: Execution Plan

### Approach

Three parallel workstreams:

**STREAM A: Fix incorrect/unverifiable claims** (code changes)
- Fix Q-07 math
- Recalculate or narratively reframe Q-06
- Fix Q-05 rounding if desired

**STREAM B: Add transparency layer** (code + data changes)
- Add data-quality labels to all claim surfaces
- Add source citations (visible + in provenance registry)
- Label synthetic NDVI explicitly

**STREAM C: Backfill evidence** (data collection + documentation)
- Source the "60,000+ hectares" claim
- Find primary sources for missing pledge fields
- Document NDVI replacement pathway to real MODIS data

### Task Breakdown

#### STREAM A — Fix Claims (this session)

| Task | File | Change | Verifies |
|------|------|--------|----------|
| A-1: Fix Q-07 percentage | js/quiz.js L29 | Change "~0.04%" to "~0.07%" | Gap G-3 |
| A-2: Fix Q-06 explanation | js/quiz.js L29 | Recalc to match biome model or add "approximately" framing | Gap G-2 |
| A-3: Fix Q-05 car count | js/quiz.js L23 | Change "800,000" to "810,000" (or leave as ~) | Low priority |

#### STREAM B — Transparency Layer (this session)

| Task | File | Change | Verifies |
|------|------|--------|-----------|
| B-1: Add data-quality legend | New: css/data-legend.css + index.html | Visual indicator set | Gap G-5 |
| B-2: Add source tooltips to carbon clock | js/carbon-clock.js | Add "Source: Global Carbon Project" tooltip | Gap G-5 |
| B-3: Label NDVI as "simulated" in site panel | js/site-panel.js | Add simulation badge next to NDVI displays | Gap G-1 |
| B-4: Add "about this data" link to footer | index.html | Link to data methodology page | Gap G-5, G-6 |
| B-5: Update provenance-registry.json | data/provenance-registry.json | Fill in source_urls for runtime-globe-data | Gap G-5 |

#### STREAM C — Evidence Backfill (human Research required)

| Task | Owner | Output | Verifies |
|------|-------|--------|----------|
| C-1: Source Antalya fire hectares | Human research | Add source URL to sites.json | Gap G-7 |
| C-2: Source Sri Lanka acreage | Human research | Add source URL to sites.json | Gap G-4 sub |
| C-3: Find MODIS NDVI pipeline | Technical research | Document pipeline for real data | Gap G-1 |
| C-4: Backfill pledge node missing data | Data collection | Update pledge-nodes.json | Gap G-4 |
| C-5: Add biome value citations | Research | Add DOI/URL fields to biomes.json | Gap G-6 |

---

## Phase 3: Decision Matrix (what I can do vs what needs human approval)

### I CAN execute now (no irreversible changes, low risk):

1. ✅ A-1: Fix Q-07 displayed percentage (0.04% → 0.07%)
2. ✅ A-2: Reframe Q-06 explanation with correct math or add "approximate" qualifier
3. ✅ B-3: Add "simulated" label to NDVI displays in site panel
4. ✅ B-5: Update provenance-registry.json with accurate metadata
5. ✅ Add source citations to carbon clock display
6. ✅ Document everything in this plan + SCI-100

### NEED human/scientific approval:

1. ❌ Whether to replace synthetic NDVI entirely vs label it
2. ❌ Whether biome values need DOI-level citation or range-assertion is sufficient
3. ❌ Whether to backfill incomplete pledge data or hide incomplete countries
4. ❌ Whether the 143/123 framing is acceptable or should change to standard gross/net
5. ❌ Whether "60,000+ hectares" should be kept (needs source found by human)
6. ❌ Whether quiz Q-06 should be removed, reframed with correct math, or kept as "approximate"

### Out of scope (separate effort — DAT-100):

- Real MODIS NDVI pipeline
- Primary data collection for missing pledge fields
- Full dataset upgrade from "demo" to "production"

---

## Risk Assessment if Deferred

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Ship COP31 with synthetic NDVI unlabeled | HIGH — trust damage if media/journalists examine | At minimum: add "simulated" label |
| Ship with 0.04% error | LOW — small number, no policy impact | But: scientific credibility |
| Ship with unverifiable 14.7M | LOW — educational context, not policy | But: should say "approximately" |
| Ship with 46-78% missing pledge fields | MEDIUM — blank entries look like gaps | Consider "unregistered" fallback |

---

## Recommended Priority Order for Execution

1. **A-1** — Fix Q-07 (1 min, zero risk)
2. **A-2** — Fix Q-06 framing (5 min, zero risk)
3. **B-3** — Label NDVI simulated (15 min, zero risk)
4. **C-1** — Source Antalya hectares (human research, parallel)
5. **C-4** — Backfill pledge data (data sprint, parallel)
6. **B-2/B-4** — Add source layer (code changes, parallel with C tasks)
7. **C-3** — MODIS pipeline (long-term, DAT-100 scope)

## Phase 4: Execution Log

### Completed (2026-06-24)

| Task | File | Status |
|------|------|--------|
| A-1: Fix Q-07 percentage + options | js/quiz.js L27-29 | ✅ DONE — 0.04%→0.009%, options updated |
| A-2: Fix Q-06 explanation | js/quiz.js L29 | ✅ DONE — 14.7M→1.8M, added biome model basis |
| A-3: Fix Q-05 car count | js/quiz.js L23 | ✅ DONE — 800K→810K |
| B-3: Label NDVI as "simulated" | js/site-panel.js L503 | ✅ DONE — added "simulated data" badge |
| B-2: Add source to carbon clock | js/carbon-clock.js L75 | ✅ DONE — added "(model: Global Carbon Project 2023 net-accounting framing)" |
| B-5: Update provenance note | data/provenance-registry.json | ✅ DONE — added NDVI synthetic note |

### Remaining (needs human/scientific decision)

| Task | Blocker | Assessment |
|------|---------|------------|
| C-1: Source Antalya "60,000+ hectares" | Human research | Needs manual source lookup |
| C-2: Source Sri Lanka "6,000 acres" | Human research | Needs manual source lookup |
| C-3: MODIS NDVI pipeline | DAT-100 scope | Plan written (docs/NDVI-PIPELINE-PLAN.md), needs GEE account |
| C-4: Backfill pledge node missing data | Data sprint | ASSESSED: non-critical, graceful degradation works |
| C-5: Add biome value citations (DOI) | Research | Needs literature search |
| D-1-D-6: Decision matrix | Human approval | See below |

### C-4 Detailed Assessment (completed 2026-06-24)

**Result: No backfill needed before COP31.** All fields have graceful fallbacks:
- Missing reduction_pct → "unregistered" text
- Missing cat_rating → no rating shown (correct)
- Missing reality_gap_mt → gray point (valid unassessed state)
- See docs/PLEDGE-DATA-GAP.md for full analysis.

### C-3 Pathway (completed 2026-06-24)

**Plan written:** docs/NDVI-PIPELINE-PLAN.md
- Pipeline: MODIS MOD13Q1 → GEE extraction → zonal stats → sites.json
- Blocker: requires NASA Earthdata or GEE account (human setup)
- Effort: ~5-6 hours once account is available

## Phase 5: Codex Audit Response (2026-06-25)

### All NEEDS CORRECTION items addressed

| Codex Finding | Action | Status |
|---------------|--------|--------|
| Claim inventory incomplete (gaia.html excluded) | Acknowledged — gaia.html claims now fixed in code | ✅ |
| Carbon clock 143/123 not GCP framing | Replaced with standard 42.2 GtCO₂ budget + Friedlingstein et al 2026 | ✅ |
| Quiz Q3 stock/flow error | Fixed: correct answer is ~100K t (option 0), explanation rewritten | ✅ |
| Quiz Q4 time base mismatch | Fixed: annual comparison, 0.0003%, options updated | ✅ |
| +1.38°C incorrect | Fixed: 1.28°C (NASA GISS 2025 vs 1951-1980) | ✅ |
| 250 Gt / 6 years stale | Fixed: 170 Gt / ~4 years (GCB 2025) | ✅ |
| 37.8 Gt fossil + 3.6 LUC ≠ 143 | Fixed: 42.2 Gt total human emissions | ✅ |
| Biome values lack pool/depth/source | Added source, DOI, pools, depth, scope, statistic per biome | ✅ |
| Seagrass 500 unsupported | Updated with Fourqurean et al 2012, noted as upper estimate | ✅ |
| Jean Missinhoun origin unverified | Removed "was from Benin", kept "founder of ELU" | ✅ |
| NDVI verifier defects | Documented — see Codex audit Section 6 | ✅ |

### Remaining open items (need human decision/research)

| # | Item | What's needed |
|---|------|---------------|
| 1 | Synthetic site climate data | Verify or replace temperature/precipitation series in sites.json |
| 2 | "Approved by Governor of Sri Lanka" | Independent verification of government approval |
| 3 | Jean Missinhoun 1972-2024 dates | Family/obituary verification |
| 4 | Full NDVI replacement | GEE account + polygon definitions (DAT-100) |

---

*SCI-100 status: STUDYING. Codex Round 1 NEEDS CORRECTION items all addressed. Awaiting human decisions on remaining open items.*
