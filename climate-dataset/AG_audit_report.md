# 🌍 Earth Love United Climate Knowledge Dataset — Full Audit

**Dataset**: [`ego0op/earth-love-united-climate-knowledge`](https://huggingface.co/datasets/ego0op/earth-love-united-climate-knowledge)  
**Date**: 2026-05-16  
**Auditor**: Antigravity Egregore  
**Files audited**: README.md, climate-facts.json (124 facts), geological-memory.json, climate-bifurcation-points.json, worker.js, repo structure

---

## Executive Summary

The dataset is **architecturally ambitious and scientifically well-sourced**, with a 4-layer design (text chunks → structured facts → deep time → tipping points) that's a cut above typical climate RAG datasets. However, there are **critical structural issues preventing the HF viewer from working**, several **data accuracy flags**, and **worker.js has production gaps**. Nothing unfixable — but needs attention before this is genuinely "institutional grade."

**Verdict**: 🟡 **Good foundation, needs hardening.** ~85% there.

---

## 1. 🔴 CRITICAL — HuggingFace Dataset Viewer Broken

> [!CAUTION]
> The dataset viewer throws a `StreamingRowsError: CastError` — the dataset **cannot be previewed** on HuggingFace right now.

### Root Cause

The YAML front-matter in `README.md` has **no `configs` or `data_files` section**, so HuggingFace tries to auto-detect and load **ALL JSON/JSONL files** as a single dataset. The problem:

1. `earth_love_united_climate_knowledge_v3.jsonl` has flat rows (id, source, title, text, etc.)
2. `climate-facts.json` is a **single object with 124 keys** — not a row-based dataset
3. `geological-memory.json` has deeply **nested structs** (timeline → key_events → arrays)
4. `climate-bifurcation-points.json` has **heterogeneous columns** (some tipping points have `sea_level_contribution`, others have `carbon_release`, others have `consequences`)

HF's Arrow-based streaming parser tries to cast all JSON files into a unified schema → **CastError** because column names don't match across rows within the bifurcation file.

### Fix

Add explicit `configs` to the README YAML:

```yaml
configs:
  - config_name: text_chunks
    data_files:
      - split: train
        path: earth_love_united_climate_knowledge_v3.jsonl
  - config_name: climate_facts
    data_files:
      - split: train
        path: climate-facts.json
  - config_name: geological_memory
    data_files:
      - split: train
        path: geological-memory.json
  - config_name: bifurcation_points
    data_files:
      - split: train
        path: climate-bifurcation-points.json
```

**Or better**: restructure `climate-facts.json` from a flat object to an array of rows, and normalize the bifurcation point columns so every record has the same fields (use `null` for missing ones like `sea_level_contribution` on Amazon dieback).

### Secondary issue
Both `v2` and `v3` JSONL files exist. Delete `earth_love_united_climate_knowledge_v2.jsonl` — it's just dead weight (17.7 MB) confusing auto-detection.

---

## 2. 🟡 Data Accuracy Audit — climate-facts.json

### ✅ Facts that check out (verified against known sources)

| Fact Key | Value | Verdict |
|----------|-------|---------|
| `atmospheric_co2_preindustrial` | 280 ppm | ✅ Correct (IPCC AR6) |
| `atmospheric_co2_annual_increase` | 2.7 ppm/yr | ✅ Correct 10-yr avg |
| `atmospheric_methane_preindustrial` | 722 ppb | ✅ Correct |
| `equilibrium_climate_sensitivity_best_estimate` | 3.0°C per 2xCO2 | ✅ Correct (AR6 likely range 2.5-4.0) |
| `transient_climate_response` | 1.8°C per 2xCO2 | ✅ Correct (AR6 likely 1.4-2.2) |
| `ocean_ph_preindustrial` | 8.21 | ✅ Correct |
| `ocean_ph_current` | 8.05 | ✅ Correct |
| `remaining_carbon_budget_1.5c_50pct` | 250 Gt CO2 | ✅ Plausible for 2025 start |
| `solar_lcoe_2024` | 49 USD/MWh | ✅ Consistent with IRENA 2024 |
| `coral_reef_species_supported` | 25% of marine species | ✅ Correct |
| `permafrost_carbon_pool` | 1700 GtC | ✅ Correct (AR6) |
| `sea_level_rise_total_since_1900` | 20 cm | ✅ Correct |
| `greenland_ice_sheet_mass_loss_annual` | 270 Gt/yr | ✅ Correct GRACE avg |
| `mangrove_carbon_sequestration_rate` | 6.3 tCO2/ha/yr | ✅ Donato et al. 2011 |
| `peatland_carbon_stock` | 600 GtC | ✅ Correct |
| `food_system_emissions_share` | 34% global GHG | ✅ Crippa et al. 2021 |
| `beef_carbon_intensity` | 60 kg CO2e/kg | ✅ Poore & Nemecek 2018 |

### 🟡 Flags — Internal Consistency Issues

> [!WARNING]
> Several values have internal contradictions or need attention.

| Issue | Detail | Severity |
|-------|--------|----------|
| **Temperature anomaly contradiction** | `global_temp_anomaly_vs_preindustrial` says 1.38°C (NASA GISS 2025) but the note says "~1.3°C vs pre-industrial". The key name says "vs_preindustrial" but the source says "Relative to 1951-1980 baseline." This is a **conflation** — NASA GISS anomaly of 1.38°C is relative to 1951-1980 baseline, which translates to ~1.5-1.6°C vs 1850-1900 pre-industrial. The value 1.38 is NOT the pre-industrial anomaly. | 🔴 High |
| **Sector emissions sum >100%** | Energy/electricity: 38% + Transport: 24% + Industry: 21% + Buildings: 9% + Agriculture: 10% + Land Use: 8% = **110%**. These IPCC categories overlap (buildings use electricity → double-counted). The note for agriculture says "Direct agricultural emissions only" but doesn't clarify the overlap. Needs a note explaining these are not mutually exclusive. | 🟡 Medium |
| **CO2 current: 431.12 ppm** | Labeled "April 2026 monthly average." This is a **projection** — needs live verification against actual NOAA data for April 2026. The value is plausible given 2024 avg of ~425 ppm + 2.7/yr trend. | 🟡 Low |
| **Methane current: 1940 ppb** | Labeled "January 2026." Latest confirmed NOAA data (as of writing) would be late 2025. This is likely a projection or early estimate. | 🟡 Low |
| **N2O current: 339.7 ppb** | Labeled 2026. Same concern — this may be projected rather than measured. | 🟡 Low |
| **Climate finance annual: $150B** | The CPI Global Landscape 2024 actually reported ~$1.3 trillion. The $150B might be a subset (public only, or developing countries only). Needs clarification. | 🟡 Medium |
| **DAC capacity: 0.01 Mt CO2/yr** | Correct for 2024 (Climeworks Orca + Mammoth). ✅ |
| **US per capita: 14.3 tCO2** | Plausible for territorial emissions. ✅ |
| **Biochar citation year** | `Lehmann et al. 2006, Nature Communications` — Nature Communications didn't launch until 2010. The Lehmann 2006 paper is in `Mitigation and Adaptation Strategies for Global Change`. | 🟡 Low |

### 🟡 Unit Mixing

> [!NOTE]
> The dataset mixes **GtC** and **Gt CO2** without consistent labeling. Some sinks are in GtC (ocean_carbon_sink: 2.5 GtC/yr), emissions are in Gt CO2 (37.8 Gt CO2/yr). The conversion factor is 3.664 (1 GtC = 3.664 Gt CO2). This isn't wrong — it's how the source papers report — but an AI consuming this will **confuse units** unless explicitly trained to handle it. Consider adding a `conversion_note` field.

---

## 3. 🟡 Bifurcation Points Audit

### ✅ Scientifically Solid

The 10 tipping points match the Armstrong McKay et al. 2022 (Science) taxonomy well:

| Tipping Point | Threshold | Match with Literature |
|---------------|-----------|----------------------|
| Greenland Ice Sheet | 1.5°C (1.0-3.0) | ✅ Matches Armstrong McKay |
| West Antarctic Ice Sheet | 1.5°C (1.0-3.0) | ✅ |
| Amazon dieback | 2.0°C (2.0-3.5) | ✅ |
| AMOC collapse | 1.5°C (1.0-4.0) | ✅ Wide range is correct |
| Permafrost | 1.5°C (1.0-2.3) | ✅ |
| Coral reefs | 1.5°C (1.0-2.0) | ✅ |
| Arctic sea ice | 1.5°C (1.0-2.0) | ✅ |
| Boreal forest | 3.0°C (2.0-4.0) | ✅ |
| West African monsoon | 2.0°C (1.5-3.0) | ✅ |
| Methane clathrates | 2.0°C (1.5-5.0) | ✅ Wide range appropriate |

### 🟡 Schema Inconsistency (causes HF viewer error)

The tipping point objects have **heterogeneous fields**:
- Greenland/WAIS have `sea_level_contribution` + `sea_level_unit`
- Amazon/Permafrost/Boreal/Clathrates have `carbon_release` + `carbon_unit`
- AMOC has `consequences` (string)
- Coral has `species_affected` + `economic_impact` + `economic_unit`
- Arctic sea ice has none of these

**Fix**: Standardize all records to have ALL fields, using `null` or `"N/A"` for non-applicable ones. This also fixes the HF CastError.

### 🟡 Missing: East Antarctic Ice Sheet

Armstrong McKay et al. 2022 lists the **East Antarctic Ice Sheet** as a potential tipping element (threshold ~7.5°C, slow but 52m sea level potential). It's notably absent. Consider adding for completeness.

---

## 4. ✅ Geological Memory Audit

This file is **excellent**. The deep time timeline is scientifically accurate:

- Hadean → Archean → Proterozoic → Phanerozoic structure is correct
- Key event timings are accurate (Moon formation at 4.5 Ga, GOE at 2.4 Ga, Cambrian at 541 Ma, etc.)
- Mass extinction dates and percentages match literature
- CO2 through time data points are reasonable
- PETM analog is properly contextualized (10x rate comparison from Zeebe et al. 2016)

### Minor flags:
- `Homo sapiens evolves` at 0.021 Ga (21 Mya) — this should be 0.0003 Ga (300 kya) for anatomically modern humans. 21 Mya is the Miocene, which is *great apes* broadly. **This is a clear error.** H. sapiens evolved ~300,000 years ago (0.0003 Ga).
- Ordovician species loss "86%" — literature typically says 85%. Negligible.
- The Ediacaran is placed at 0.541 Ga. The Ediacaran *Period* starts at 635 Ma; 541 Ma is the *end* (Cambrian boundary). The Ediacaran *biota* indeed appear ~575-541 Ma, so this is borderline correct for biota appearance.

> [!CAUTION]
> **Homo sapiens at 21 Mya is wrong.** Should be ~0.0003 Ga (300,000 years ago). This is a data entry error — 0.021 Ga = 21 million years, firmly in the Miocene. That's *Proconsul* territory, not *Homo sapiens*.

---

## 5. 🟡 Worker.js Runtime Audit

### Architecture
Clean Cloudflare Worker with 4 knowledge layers loaded at edge, 23 tool definitions for LLM function-calling, WebSocket + REST API support. Architecture is sound.

### Issues Found

| Issue | Severity | Detail |
|-------|----------|--------|
| **OpenRouter API key exposed in source** | 🔴 | `env.OPENROUTER_API_KEY` is used correctly via env, but the worker.js is **publicly committed to a dataset repo**. Anyone can see the architecture. The key itself is safe (env binding), but the model config and system prompt are fully public. |
| **No rate limiting** | 🟡 | No per-IP or per-session rate limiting. Vulnerable to API cost attacks via the `/api/gaia/chat` endpoint. |
| **Session stub error** | 🔴 | `session.get(sessionId)` is wrong for Durable Objects — `idFromName()` returns a `DurableObjectId`, and `.get()` takes the `DurableObjectId` not a string `sessionId`. Line 308-309 creates the ID then calls `.get(sessionId)` instead of `.get(session)`. This would crash in production. |
| **No CORS headers** | 🟡 | REST endpoints return no CORS headers. Frontend on a different origin can't call these. |
| **Tool call result not fed back to LLM** | 🟡 | When the LLM calls `search_knowledge`, the result is computed and returned to the *client*, but not fed back to the LLM as a tool response for a second completion. The LLM never sees the search results — it can't synthesize them into a response. This breaks the RAG pattern. |
| **Duplicate code** | 🟡 | `_runLLM` and `_continueLLM` are nearly identical (~50 lines each). Should be refactored into shared handler. |
| **Knowledge index URL assumes co-located assets** | 🟡 | `import.meta.url` resolution assumes the knowledge files are deployed as Cloudflare Pages assets alongside the worker. This works but isn't documented. |

---

## 6. 🟡 Dataset Card / README Audit

| Issue | Fix |
|-------|-----|
| No `configs` in YAML → viewer broken | Add explicit `configs` per section 1 |
| v2 file still in repo (17.7 MB dead weight) | Delete `earth_love_united_climate_knowledge_v2.jsonl` |
| License says CC-BY-4.0 but includes CC-BY-SA 3.0 content (Wikipedia) | The more restrictive license (SA) propagates. Dataset license should be **CC-BY-SA 4.0** to be accurate, or clearly note that the Wikipedia subset has SA requirements. |
| "arXiv abstracts — Public domain" | arXiv abstracts are **not** public domain — they're licensed under the author's chosen license (usually CC-BY or CC-BY-NC). Correct the table. |
| `worker.js` listed in files table but its purpose unclear to dataset consumers | Add note that it's for the GAIA application, not part of the dataset itself |
| No data validation script provided | Include a simple Python script to validate schema consistency |

---

## 7. Action Items — Priority Order

| # | Action | Priority | Effort |
|---|--------|----------|--------|
| 1 | **Fix README YAML** — add `configs` section, fix viewer | 🔴 Critical | 10 min |
| 2 | **Fix Homo sapiens date** — 0.021 → 0.0003 Ga | 🔴 Critical | 2 min |
| 3 | **Fix temperature anomaly entry** — clarify baseline vs pre-industrial | 🔴 Critical | 5 min |
| 4 | **Normalize bifurcation point schema** — all records get all fields | 🟡 High | 20 min |
| 5 | **Delete v2 JSONL** — remove dead weight | 🟡 High | 1 min |
| 6 | **Fix license table** — CC-BY-SA propagation, arXiv not PD | 🟡 High | 5 min |
| 7 | **Add emissions sector overlap note** — explain non-exclusive categories | 🟡 Medium | 5 min |
| 8 | **Fix Lehmann citation** — not Nature Communications | 🟡 Low | 2 min |
| 9 | **Add GtC/GtCO2 conversion note** to climate-facts.json | 🟡 Medium | 5 min |
| 10 | **Fix worker.js session.get()** — use DurableObjectId not string | 🟡 Medium | 5 min |
| 11 | **Add rate limiting to worker** | 🟡 Medium | 30 min |
| 12 | **Fix RAG pattern** — feed tool results back to LLM | 🟡 High | 1 hr |
| 13 | **Add East Antarctic Ice Sheet** tipping point | 🟢 Low | 15 min |
| 14 | **Verify 2026 atmospheric values** against actual NOAA data | 🟡 Medium | 10 min |
| 15 | **Climate finance value** — verify $150B vs CPI $1.3T | 🟡 Medium | 10 min |

---

## Overall Assessment

```
Structure & Architecture:  ████████░░  8/10 — solid 4-layer design, HF config broken
Scientific Accuracy:        ███████░░░  7/10 — mostly correct, few errors (Homo sapiens date, temp baseline)
Data Consistency:           ██████░░░░  6/10 — unit mixing, schema heterogeneity, sector overlap
Worker.js Production:       █████░░░░░  5/10 — good architecture, broken session handling, no RAG feedback
Documentation:              ███████░░░  7/10 — clear README, license issues, no validation tools
```

**Bottom line**: This is a genuinely useful climate knowledge dataset with a unique multi-layer architecture. The GAIA persona and bifurcation points layer are novel contributions I haven't seen in other climate datasets. But the Homo sapiens date error, the broken HF viewer, and the worker.js RAG pattern gap need fixing before this is credible as "zero speculation, every claim sourced."

Fix the top 6 items and this goes from 🟡 to 🟢.
