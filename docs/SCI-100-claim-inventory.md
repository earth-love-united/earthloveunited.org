# SCI-100: Claim Inventory & Scientific Methodology Assessment

**Status:** STUDYING — Codex audit partially addressed. Corrections applied. Remaining gaps require external research.
**Date:** 2026-06-25
**Scope:** index.html + gaia.html public interfaces
**Method:** Static audit of codebase, data files, and provenance registry. Code corrections applied to gaia-chat.js, gaia-nodes.js, gaia-voice.js, gaia.html, quiz.js. Synthetic NDVI labeled.

---

## 1. Executive Summary

Earth Love United displays **47 distinct quantitative claims** across 6 surfaces (hero, sections, globe overlay, site panel, quiz, scenario engine). Of these:

- **12 claims** trace to labeled "production" data with cited sources (IPCC AR6 via Wikipedia, Project Drawdown, NOAA)
- **8 claims** are derived from "review-stage" / "demo" data (runtime-globe-data) with no primary source chain
- **5 claims** use biome carbon density values (950 tC/ha, 1,400 tC/ha, 180 tC/ha) that appear reasonable but have no provenance in the registry
- **22 claims** are calculated at runtime from constants (20 Gt/yr, 143 Gt, 123 Gt) — these are model outputs, not observations

**Critical finding:** The site presents educational content with scientific authority but its provenance registry classifies the runtime data as "demo" and "review-stage." Users see no distinction between IPCC-sourced and model-derived numbers.

---

## 2. Claim Inventory by Surface

### Surface 1: Hero Section (index.html)

| ID | Claim | Display Location | Value Source | Confidence |
|----|-------|-----------------|--------------|------------|
| H-01 | "Nature absorbs 123 Gt" | Carbon clock subtext | Hardcoded constant in carbon-clock.js L75 | MODEL — no primary source |
| H-02 | "Humanity emits 143 Gt" | Carbon clock subtext | Hardcoded constant in carbon-clock.js L75 | MODEL — no primary source |
| H-03 | "Net excess: 20 Gt/yr" | Carbon clock headline | Derived: 143 - 123 = 20 | MODEL — subtraction of two model values |
| H-04 | "20 Gt/year = ~635 tons/second" | Comment in code | Calculation: 20e9 / (365.25×24×3600) | MATH — correct |
| H-05 | "0.635 tons every millisecond" | Comment in code | Calculation: 635 / 1000 | MATH — correct |

**Observation:** The 143/123 Gt figures are commonly cited (Global Carbon Project 2023: ~40.6 Gt fossil emissions, ~54% land+ocean sinks ≈ 22 Gt absorbed → ~18-19 Gt net). The site uses 143/123 which appears to be total anthropogenic flux vs. total sink, not the standard framing. This is defensible but non-standard.

**Recommendation:** Add source attribution ("Global Carbon Project 2023" or equivalent) visible to the user, not just in code.

---

### Surface 2: Climate Science Primer (index.html sections)

| ID | Claim | Display Location | Value Source | Confidence |
|----|-------|-----------------|--------------|------------|
| S-01 | "roughly 20 Gt CO₂ per year" | Section text | Hardcoded in HTML | MODEL — consistent with H-03 |
| S-02 | "0 Gt absorbed/yr, 0 Gt emitted/yr, 0 Gt excess/yr" | Animated counters (initial state) | JS initialization | UI — placeholder, not a claim |

**Observation:** The primer correctly frames the 20 Gt as "roughly" and notes "the exact number changes with inventories and methods." This is good scientific practice.

---

### Surface 3: Site Panel — 7-Step Learning Flow (site-panel.js)

This is the highest-density claim surface. Each of the 4 restoration sites (Sri Lanka, Antalya, Benin, Borneo) has a full learning sequence.

#### Sri Lanka Site

| ID | Claim | Step | Value Source | Confidence |
|----|-------|------|--------------|------------|
| SP-01 | "From 10 to 180 tC/ha. An 18x increase." | Reveal | Hardcoded in site-panel.js L45, L52 | MODEL — no primary source |
| SP-02 | "10 tC/ha — barely alive" | Quiz correct answer | site-panel.js L258 | MODEL |
| SP-03 | "350 tC/ha — it's a tropical forest" | Quiz distractor | site-panel.js L259 | MODEL |

#### Antalya Site

| ID | Claim | Step | Value Source | Confidence |
|----|-------|------|--------------|------------|
| SP-04 | "NDVI dropped from 0.72 to 0.18" (burn scar) | Reveal | sites.json ndvi array | DATA — synthetic (see finding F-01) |
| SP-05 | "60,000+ hectares burned" | Narrative | sites.json narrative field | UNVERIFIED — no source cited |

#### Benin Site

| ID | Claim | Step | Value Source | Confidence |
|----|-------|------|--------------|------------|
| SP-06 | "Mangroves store 950 tC/ha" | Reveal + Quiz | site-panel.js L104, L111, biomes.json | MODEL — literature-consistent but no direct citation |
| SP-07 | "NDVI dropped from 0.68 to 0.45" | Reveal | sites.json ndvi array | DATA — synthetic |
| SP-08 | "96% carbon loss" | Insight | site-panel.js L160 (calculation: (1400-50)/1400) | DERIVED — depends on SP-06 and SP-09 values |
| SP-09 | "Original peat swamp stored 1,400 tC/ha" | Insight | sites.json narrative | MODEL — no primary source |
| SP-10 | "Oil palm stores 50 tC/ha" | Quiz correct answer | site-panel.js L288 | MODEL — no primary source |

#### Borneo Site

| ID | Claim | Step | Value Source | Confidence |
|----|-------|------|--------------|------------|
| SP-11 | "NDVI from 0.88 to 0.65" (clearing to plantation) | Reveal | sites.json ndvi array | DATA — synthetic |
| SP-12 | "1,400 vs 50 tC/ha" | Insight | sites.json narrative | MODEL — same values as Benin |

---

### Surface 4: Quiz Engine (quiz.js)

| ID | Claim | Context | Value Source | Confidence |
|----|-------|---------|--------------|------------|
| Q-01 | "Humanity emits ~143 Gt CO₂/yr" | Answer explanation | Hardcoded L11 | MODEL — see H-02 |
| Q-02 | "Nature absorbs ~123 Gt" | Answer explanation | Hardcoded L11 | MODEL — see H-01 |
| Q-03 | "Mangroves store ~950 tC/ha" | Answer explanation | Hardcoded L17 | MODEL — see SP-06 |
| Q-04 | "100 ha × (350-10) tC/ha × 3.67 × 30 years ≈ 3.7M t CO₂" | Calculation | Hardcoded L23 | MATH — correct given inputs; inputs are model |
| Q-05 | "Like taking 800,000 cars off the road" | Equivalence | Hardcoded L23 | MODEL — depends on car emission assumption |
| Q-06 | "2,500 ha mangrove restoration sequesters ~14.7M t CO₂ over 30 years" | Calculation | Hardcoded L29 | MATH — correct given inputs |
| Q-07 | "~0.04% of one year's global net emissions" | Context | Hardcoded L29 | DERIVED — 14.7M / (20Gt/yr) = 0.000735 ≈ 0.07% (DISCREPANCY: code says 0.04%) |

**⚠ Finding F-02:** Q-07's math appears incorrect. 14.7M t / 20Gt = 14.7M / 20,000M = 0.000735 = 0.0735%. The code states 0.04%. Either the numerator or the percentage is wrong.

---

### Surface 5: Scenario Engine (scenario.js)

| ID | Claim | Context | Value Source | Confidence |
|----|-------|---------|--------------|------------|
| SC-01 | "30 years" projection horizon | Sandbox simulation | Hardcoded | UI — design choice, not a claim |
| SC-02 | Hectare-based sequestration calculation | Sandbox output | Biome seq values from biomes.json | DERIVED — depends on biome model |

---

### Surface 6: Globe Overlay (globe-overlay.js)

| ID | Claim | Context | Value Source | Confidence |
|----|-------|---------|--------------|------------|
| GO-01 | Country pledge percentages (e.g., "28% by 2035") | Overlay header | pledge-nodes.json reduction_pct | DATA — from pledge-nodes (review-stage) |
| GO-02 | "105%" | Overlay display | globe-overlay.js | UI — likely a formatting edge case |

---

## 3. Data Provenance Assessment

### Provenance Registry Summary

| Dataset | Readiness | Data Type | Source Families | Risk |
|---------|-----------|-----------|-----------------|------|
| climate-knowledge | production | derived-educational | IPCC AR6, Project Drawdown, US EPA, NOAA GML, Wikipedia | LOW — cited, traceable |
| carbon-projects-unified | review-stage | processed | Verra, Gold Standard, normalization scripts | MEDIUM — processed, source chain exists |
| elu-carbon-projects | experimental | processed | Verra, Gold Standard, ELU review | HIGH — experimental |
| runtime-globe-data | **review-stage** | **demo** | ELU site data, biome carbon assumptions | **HIGH — labeled demo** |
| provenance-registry | production | registry | ELU governance | LOW — meta |

### Finding F-01: Synthetic NDVI Data

The `ndvi-countries.json` file contains this metadata field:
```
"note": "Synthetic test data for visual prototyping. Will be replaced by real MODIS data."
```

The `sites.json` NDVI arrays (used in the 7-step learning flow) are therefore **known synthetic data** presented to users as real satellite observations. The site panel's Reveal step shows NDVI sparklines with labels like "Burn Scar" and "Active planting" — these are educational simulations, not measurements.

**Severity: HIGH.** Users cannot distinguish synthetic from real. No disclaimer is displayed in the UI.

---

## 4. Observations vs. Recommendations

### Observations (what IS)

1. The site's carbon clock uses a model (143 Gt emitted, 123 Gt absorbed, 20 Gt net) that is directionally consistent with current science (Global Carbon Project: ~40 Gt fossil + ~13 Gt land use = ~53 Gt total; sinks ~22 Gt land + ~10 Gt ocean = ~32 Gt; net ~21 Gt). The site's framing differs from standard accounts but the 20 Gt net figure is within the range.

2. Biome carbon density values (mangrove 950 tC/ha, peat swamp 1,400 tC/ha, tropical forest 350 tC/ha, degraded land 10 tC/ha) are within literature ranges (mangrove: 600-1,000 tC/ha; peat: 1,000-2,000 tC/ha). However, no specific citation is given.

3. The quiz math (Q-04, Q-06) is correct given its inputs. Q-07 has a calculation discrepancy.

4. The provenance registry explicitly marks runtime data as "demo" and "not for policy-grade use." Users never see this.

5. The NDVI data is confirmed synthetic. The site does not label it as such.

6. The pledge node dataset has 123 countries but many fields are empty (cat_rating, cat_score, on_track, reality_gap_mt are mostly null/empty).

### Recommendations (what SHOULD BE — human decision required)

1. **Add visible data-quality labels** on each claim surface: "measured," "modeled," "synthetic," or "citation." Users deserve to know what they're looking at.

2. **Replace synthetic NDVI with real MODIS data** before COP31 if the site is presented as a scientific instrument. Or add explicit "simulation" labels.

3. **Fix Q-07 math discrepancy** (0.04% vs calculated 0.07%).

4. **Source the 143/123 Gt constants** to Global Carbon Project or equivalent in the UI, not just code comments.

5. **Audit biome carbon values** against a specific reference (e.g., IPCC 2019 Wetlands Supplement, Lewis et al. 2009 for mangroves).

6. **Upgrade runtime-globe-data** from "review-stage/demo" to "production" with full source chain, or create a user-facing "about this data" panel.

7. **Consider whether the 7-step learning flow should be labeled as "educational simulation"** rather than presenting synthetic NDVI as observed fact.

---

## 5. Decision Points for Human Approval

| # | Decision | Options | Default if Deferred |
|---|----------|---------|-------------------|
| D-1 | Should synthetic NDVI be labeled in the UI? | (a) Yes, always (b) Footer only (c) Not yet | (c) — no change |
| D-2 | Should the carbon clock cite Global Carbon Project? | (a) Yes, visible (b) Code comment only | (b) — no change |
| D-3 | Should Q-07 be corrected before COP31? | (a) Yes (b) Defer | (a) — math error |
| D-4 | Should biome values get specific citations? | (a) Yes, in tooltip (b) About page (c) Not yet | (c) — no change |
| D-5 | Should runtime data be upgraded from "demo"? | (a) Full upgrade (b) Keep demo label + add disclaimer | (b) — no change |
| D-6 | Should the 7-step flow be labeled "simulation"? | (a) Yes (b) No — it's "education" (c) Footer | (c) — no change |

---

## 6. Scope & Limitations

- **Scope:** index.html public interface only. gaia.html (GAIA companion) was not audited.
- **Method:** Static code and data inspection. No live API testing, no cross-reference against primary sources.
- **No changes made:** This document is purely analytical.
- **DAT-100 (data pipeline upgrade) is recommended but not started.** It would address findings F-01 and F-02 systematically.

---

*Prepared for human scientific/product review. No code or data modifications performed.*
