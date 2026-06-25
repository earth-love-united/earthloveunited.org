# SCI-100 Codex Audit

**Date:** 2026-06-25  
**Scope:** Independent verification of OWL's SCI-100 inventory, current quiz math, requested narrative sources, biome carbon-density evidence, carbon-clock framing, pledge-gap notes, and NDVI replacement plan.  
**Mutation boundary:** Documentation only. No code or data files were modified by this audit.  
**Verdict vocabulary:** `VERIFIED`, `NEEDS CORRECTION`, `NEW FINDING`.

## Executive conclusion

OWL correctly identified the synthetic NDVI problem, the absence of claim-level provenance, and the need for an evidence pipeline. However, SCI-100 is **not decision-ready yet** for four reasons:

1. The claim inventory is materially incomplete despite describing itself as all user-facing claims.
2. The carbon-clock `143 / 123 / 20 Gt CO₂` framing is not a Global Carbon Project accounting frame and should not be cited as one.
3. Quiz question 3 still contains a stock/flow dimensional error and the keyed answer remains wrong.
4. The biome table treats incomparable carbon pools and depths as universal ecosystem constants.

The correct SCI-100 disposition is `STUDYING`, not `DECISION-READY`, until a complete surface inventory and a carbon-accounting methodology are approved.

## 1. Verification of OWL's audit

### 1.1 Claim inventory scope

#### NEEDS CORRECTION — “47 distinct claims across 6 surfaces” is not a complete public inventory

The inventory claims complete scope at `docs/SCI-100-claim-inventory.md:5-17`, but later discloses that `gaia.html` was excluded at `docs/SCI-100-claim-inventory.md:196-200`. That exclusion is material:

| Missing surface | Examples omitted from the inventory |
|---|---|
| `gaia.html` | `~143 Gt`, `~123 Gt`, `~20 Gt`, `+1.38°C`, and `~6 years` at `gaia.html:443-447` |
| GAIA chat answers | Carbon-cycle, temperature, budget, biome, site climate, and biography claims throughout `js/gaia-chat.js:87-118` and prompt facts at `js/gaia-chat.js:205-229` |
| GAIA learning nodes | Carbon budgets, sea level, peat, mangrove, restoration economics, global areas, and computed claims throughout `js/gaia-nodes.js:398-1143` |
| Carbon-cycle explorer | `123 Gt CO₂/yr` vegetation uptake and `143 Gt CO₂/yr` human emissions at `js/cycle.js:8-11` |
| Site climate display | Synthetic temperature and precipitation series from `data/sites.json`, rendered at `js/site-panel.js:509-523` |
| Scenario outputs | Dynamic stock-plus-flux claims from `js/data.js:101-119`, rendered at `js/scenario.js:57-69`; the inventory incorrectly counts zero scenario claims in the gap table |
| Climate-event copy | Repeated biome/NDVI claims at `data/climate-events.json:210-223` |

The eight files under `data/modules/` contain many additional quantitative educational claims. They are not currently loaded by either HTML page, so they should be inventoried as **latent publication content**, not counted as currently displayed claims. Examples include `431.12 ppm`, carbon-budget values, carbon-market values, and climate-justice statistics. Their existence still matters before those modules are activated.

No defensible corrected total can be produced by adding a few rows to the original 47: the unit of counting (“distinct claim” versus every display duplication versus every runtime-derived result) was never defined. SCI-100 first needs a claim-ID rule and a generated inventory of every loaded HTML/JS/JSON surface.

#### NEW FINDING — the audit status and mutation statement conflict with its execution log

`docs/SCI-100-claim-inventory.md:3-6` says decision-ready and no code/data changes, while `docs/SCI-100-gap-analysis-plan.md:172-183` records modifications to four code/data files. The documents should distinguish:

- the commit or worktree state that was audited;
- pre-edit observations;
- post-edit verification;
- uncommitted implementation changes.

Without that boundary, statements such as “Q-06 is 14.7M” and “Q-06 is 1.8M” coexist in the same audit package.

### 1.2 Correctly identified findings

#### VERIFIED — site NDVI arrays are synthetic and were presented as measurements

OWL's central NDVI finding is correct. `data/sites.json:20-45`, `94-119`, and `232-257` contain narrative time series without product/granule/QA metadata. They are rendered as observed change in `js/site-panel.js:68-88`, `104-111`, and `140-160`. The new simulated-data badge is appropriate containment, but containment does not validate the values.

#### VERIFIED — pledge field-completeness counts are substantially correct

An independent parse of 123 rows reproduced the important counts: `reduction_pct` 99/123 (80.5%), `cat_rating` 36/123 (29.3%), `on_track` and `reality_gap_mt` 57/123 (46.3%), `baseline_year` 48/123 (39.0%), and `finance_total_bn` 54/123 (43.9%).

#### NEEDS CORRECTION — “no critical pledge gaps” is only a functional conclusion

`docs/PLEDGE-DATA-GAP.md:37-45` proves that missing fields do not crash the UI; it does **not** prove scientific validity, freshness, provenance, or semantic correctness of populated fields. In particular:

- `cat_score = 0` conflates a numeric score with “not assessed” unless the schema separately records assessment status.
- “unregistered” is not a safe synonym for “this dataset lacks `reduction_pct`.”
- `docs/PLEDGE-DATA-GAP.md:56` infers that missing values are countries “without formal NDCs” without a source-chain audit.

The document should be retitled or scoped as a runtime-null-handling assessment.

### 1.3 Gap-analysis completeness

#### NEEDS CORRECTION — primary-source verification was not performed

The gap plan calls its first phase complete at `docs/SCI-100-gap-analysis-plan.md:9`, but the underlying inventory explicitly says no primary-source cross-check was performed at `docs/SCI-100-claim-inventory.md:198-200`. “IPCC via Wikipedia” at `docs/SCI-100-claim-inventory.md:14` is not primary-source traceability.

#### NEEDS CORRECTION — the following critical gaps were missing

1. Incorrect 2025 temperature display: `gaia.html:446` and `js/gaia-chat.js:102` show `+1.38°C` relative to 1951–1980. NASA reports **1.19°C** for that baseline; WMO reports about **1.43–1.44°C** relative to 1850–1900. These baselines must not be mixed. Sources: [NASA Global Temperature](https://science.nasa.gov/earth/explore/earth-indicators/global-temperature/) and [WMO State of the Global Climate 2025](https://public.wmo.int/publication-series/state-of-global-climate/state-of-global-climate-2025).
2. Stale carbon budget: multiple GAIA surfaces retain `250 Gt` / six years, while Global Carbon Budget 2025 gives **170 GtCO₂ from January 2026**, about four years at 2025 emissions (`js/gaia-nodes.js:36-39`, `js/gaia-chat.js:110`, `js/gaia-voice.js:101`, `gaia.html:447`).
3. Contradictory annual-emissions values: `js/gaia-chat.js:96` displays about 37.8 Gt fossil plus 3.6 Gt land-use emissions, then labels total human emissions as 143 Gt.
4. Unproven site climate histories: every site has 1980/2000/2025 temperature and rainfall values with no station, reanalysis, grid, baseline, or processing metadata (`data/sites.json:47-62`, analogous arrays for all four sites). These values drive user-visible trend claims.
5. NDVI verifier defects documented in Section 6 below.

## 2. Quiz math audit

### Question 1 — NEEDS CORRECTION

`js/quiz.js:8-11` asks annual addition to the atmosphere and keys `20 Gt`. The arithmetic `143 - 123 = 20` is correct, but the inputs and attribution are not scientifically supported. Use the standard carbon-budget frame described in Section 5.

### Question 2 — VERIFIED AS AN APPROXIMATION, NOT A UNIVERSAL CONSTANT

`js/quiz.js:14-17` uses `950 tC/ha` for mangroves. Donato et al. measured a mean **1,023 Mg C/ha** across 25 Indo-Pacific mangrove forests. Thus 950 is a reasonable rounded educational example if the pool definition and geographic scope are disclosed. It should not be described as the fixed value for all mangroves.

Source: Donato et al. (2011), “Mangroves among the most carbon-rich forests in the tropics,” [DOI 10.1038/ngeo1123](https://doi.org/10.1038/ngeo1123).

### Question 3 — NEEDS CORRECTION; current keyed answer and explanation are wrong

Current text at `js/quiz.js:20-23` calculates:

```text
100 ha × (350 − 10) tC/ha × 3.67 × 30 years
```

`350 − 10 tC/ha` is a **stock difference**, not an annual rate. Multiplying it by 30 years is dimensionally invalid.

- Stock-recovery interpretation: `100 × 340 × 3.67 = 124,780 tCO₂`.
- Annual-accumulation illustration using `6.5 tC/ha/yr`: `100 × 6.5 × 30 × 3.67 = 71,565 tCO₂`.
- Repository engine at `js/data.js:102-109` adds stock recovery and the target biome's 30-year flux: `(34,000 + 7,500) tC × 3.67 = 152,305 tCO₂`.

All three defensible interpretations fall near the `~100,000 t` option, not `~1,000,000 t`. Therefore `correct: 2` at `js/quiz.js:22` should be `correct: 1` after the methodology is selected, and the explanation must name that methodology. The `~810,000 cars` statement is derived from the invalid 3.7M result and is also wrong.

This directly contradicts `docs/SCI-100-claim-inventory.md:97-100` and `docs/SCI-100-gap-analysis-plan.md:27`.

### Question 4 — NEEDS CORRECTION; arithmetic is internally correct but the time bases do not match

The edited multiplication at `js/quiz.js:26-29` is arithmetically correct:

```text
2,500 ha × 6.5 tC/ha/yr × 30 yr × 3.67 = 1,789,125 tCO₂ ≈ 1.8M
1,789,125 / 20,000,000,000 × 100 = 0.00895% ≈ 0.009%
```

However, the numerator is **30 years** of sequestration and the denominator is **one year** of emissions. A like-for-like annual comparison under the question's own assumptions is:

```text
2,500 ha × 6.5 tC/ha/yr × 3.67 = 59,637.5 tCO₂/yr
59,637.5 / 20,000,000,000 × 100 = 0.000298% ≈ 0.0003%
```

The same percentage results from comparing the 30-year total with 30 years of emissions. None of the current answer options is correct; `0.0001%` is merely the closest.

Separately, this is an annual-accumulation-only model. The repository engine would also add the modeled stock transition from degraded land to mangrove and produce about **10.4M tCO₂**. SCI-100 must decide whether restoration questions use:

- stock recovery;
- annual sequestration over a horizon;
- or the current engine's sum of both.

Do not mix those models between quiz, scenario builder, GAIA, and biome cards.

## 3. Narrative-source findings

### Antalya “60,000+ hectares burned” — VERIFIED with scope correction

The Turkish General Directorate of Forestry reports **59,985 ha damaged** by the fire beginning in Manavgat on 28 July 2021 and spreading across multiple Antalya forestry districts. EFFIS's 2021 report independently totals **60,358 ha burned in Antalya during 2021**.

- Primary official source: [Antalya Regional Directorate of Forestry, 25 July 2024](https://www.ogm.gov.tr/antalyaobm/haberler/155).
- Corroborating official source: [EFFIS Annual Fire Report 2021](https://data.effis.emergency.copernicus.eu/effis/reports-and-publications/annual-fire-reports/Annual_Report_2021_final_topdf1.pdf).

`data/sites.json:93` is supportable if written as the **2021 Antalya fire complex / affected Antalya districts**, not as a 2,500-ha project site or a single burn polygon. “Mediterranean pine” and “gone in days” need separate evidence or softer wording.

### Sri Lanka “over 6,000 acres across five districts” — VERIFIED AS A PROPONENT CLAIM

SavePlanetEarth's own project documentation states that it identified **over 6,000 acres** and lists Jaffna 96 acres, Vavuniya over 4,375, Mullaitivu over 850, Mannar 300, and Kilinochchi 850. Source: [SPE Northern Province documentation](https://saveplanetearth.gitbook.io/spe-documentation/multilayer-tree-planting-program/northern-province-of-sri-lanka).

This verifies that **SPE makes the claim** at `data/sites.json:19`; it does not independently verify allocation, title, planting, restoration status, or carbon outcomes. The page says legal documentation is available on request. UNEP was not found as the source. Public copy should say “SPE reports/has identified,” retain the project-proponent label, and separately verify the stronger “approved by the Governor / land confirmed” statement at `data/sites.json:81`.

### Jean Missinhoun “was from Benin/Ouidah” — NEEDS CORRECTION

Public sources verify that Jean Missinhoun was president/founder of Earth Love United and that the foundation described a pilot mangrove project in Benin. They do not verify his birthplace, nationality, Ouidah as his homeland, or the `1972–2024` dates asserted at `js/gaia-chat.js:118`.

- [Financial Afrik article by Jean Missinhoun](https://www.financialafrik.com/2021/11/10/face-au-changement-climatique-lafrique-doit-miser-sur-des-solutions-issues-de-la-nature/) verifies his ELU role and a Benin pilot project.
- [Earth Love United partnership coverage](https://www.journalduniger.com/earth-love-united-et-un-reseau-en-partenariat-pour-leducation-environnementale/) verifies the founder/president role.

The biographical and “homecoming” language at `js/site-panel.js:97`, `data/sites.json:219`, and `js/gaia-chat.js:118` requires a family-approved biography, obituary, corporate filing, or other authoritative record. Until then, separate the verified Benin project connection from the unverified personal-origin claim.

### West Kalimantan “1,400 tC/ha” — NEEDS CORRECTION AS A SITE-SPECIFIC ORIGINAL-STOCK CLAIM

The number is plausible for tropical peat, but not established for the coordinates or original site represented in `data/sites.json:231`.

- Anshari et al. measured **1,371 and 1,253 Mg C/ha** in 2012 and 2016 at a deforested, drained West Kalimantan peat dome and describes tropical-peat stocks commonly in the **1,500–4,000 Mg C/ha** range. Source: Anshari et al. (2021), “Carbon loss from a deforested and drained tropical peatland over four years as assessed from peat stratigraphy,” [DOI 10.1016/j.catena.2021.105719](https://doi.org/10.1016/j.catena.2021.105719).
- Warren et al. show Indonesian peat stores often exceed **1,000 Mg C/ha** and depend strongly on peat depth; their West Kalimantan carbon-density input is 55.5 kg C/m³. Source: Warren et al. (2017), “An appraisal of Indonesia's immense peat carbon stock using national peatland maps,” [DOI 10.1186/s13021-017-0080-2](https://doi.org/10.1186/s13021-017-0080-2).
- Basuki et al. (2016) reported a mean total ecosystem stock of about **4,021 Mg C/ha** in West Kalimantan peat forests with 6.5–10.5 m peat. This was a conference paper rather than a broadly replicated regional estimate, but it demonstrates the depth sensitivity that makes a universal 1,400 value unsafe. Source: Basuki et al., “Carbon stocks and emissions from degradation and conversion of tropical peat swamp forests in West Kalimantan, Indonesia,” [DOI 10.13140/RG.2.2.22826.21445](https://doi.org/10.13140/RG.2.2.22826.21445).

Keep 1,400 only as a clearly labeled scenario assumption or replace it with a measured value tied to a verified polygon, peat depth, carbon density, pool boundary, and date.

## 4. DOI-level biome carbon evidence

### NEW FINDING — the requested values are stale relative to the repository

The values supplied for this audit do not match `data/biomes.json`:

| Biome | Requested | Current repository |
|---|---:|---:|
| Temperate deciduous | 180 | 220 (`data/biomes.json:23-28`) |
| Temperate coniferous | 200 | 300 (`data/biomes.json:30-35`) |
| Boreal forest | 250 | 160 (`data/biomes.json:37-42`) |
| Grassland/savanna | 80 | 90 (`data/biomes.json:44-49`) |
| Seagrass meadow | 150 | 500 (`data/biomes.json:58-63`) |

`gaia.html:424-425` duplicates the current 300 and 500 values, so a data-only correction would not remove every stale copy.

### Evidence matrix

`Mg C/ha` and `tC/ha` are numerically equivalent. They are scientifically comparable only when the same pools, soil depth, ecosystem condition, and time boundary are used.

| Biome/value requested | Verdict | DOI-level source and reported value | Assessment |
|---|---|---|---|
| Mangrove — 950 | VERIFIED as rounded regional example | Donato et al. (2011), “Mangroves among the most carbon-rich forests in the tropics,” [10.1038/ngeo1123](https://doi.org/10.1038/ngeo1123): mean **1,023 Mg C/ha** across 25 Indo-Pacific forests | Close support, but disclose geography and included deep soils. A newer global synthesis reports lower central values, reinforcing uncertainty. |
| Tropical rainforest — 350 | VERIFIED only as a site-scale example | Kothandaraman et al. (2020), “Ecosystem-level carbon storage … Western Ghats,” [10.1038/s41598-020-70313-6](https://doi.org/10.1038/s41598-020-70313-6): mean **336.8 Mg C/ha**, range **226.8–513.7** across studied tropical forest sites | Supports approximately 350 in one regional study, not a universal rainforest constant. Pan et al.'s global tropical-forest density is 242. |
| Temperate deciduous — 180 | NEEDS CORRECTION | Pan et al. (2011), “A Large and Persistent Carbon Sink in the World's Forests,” [10.1126/science.1201609](https://doi.org/10.1126/science.1201609): temperate forests **155 Mg C/ha** | 180 is plausible within local variation, but no exact global deciduous support was found. Current repo is 220, not 180. |
| Peat swamp — 1,400 | NEEDS CORRECTION as universal/intact value | Anshari et al. (2021), [10.1016/j.catena.2021.105719](https://doi.org/10.1016/j.catena.2021.105719): disturbed West Kalimantan peat **1,371 → 1,253 Mg C/ha**; cited tropical range **1,500–4,000** | Numerically supportable for one disturbed peat dome, but not demonstrated as original intact stock for the site's coordinates. |
| Degraded bare land — 10 | NEEDS CORRECTION | No DOI-level source supports a universal 10 tC/ha value | “Degraded” is not a biome or defined carbon pool. Retain only as an explicit scenario parameter with soil depth, prior land use, and uncertainty. |
| Agricultural cropland — 50 | NEEDS CORRECTION as universal value | Zomer et al. (2017), “Global Sequestration Potential of Increased Organic Carbon in Cropland Soils,” [10.1038/s41598-017-15794-8](https://doi.org/10.1038/s41598-017-15794-8): global available cropland top-30-cm SOC mean **82 tC/ha**, sandy soils **34 tC/ha** | 50 lies within spatial variation but is not the reported global mean and omits crop biomass/depth definitions. |
| Grassland/savanna — 80 | NEEDS CORRECTION | Grace et al. (2006), “Productivity and carbon fluxes of tropical savannas,” [10.1111/j.1365-2699.2005.01448.x](https://doi.org/10.1111/j.1365-2699.2005.01448.x): NPP **1–12 tC/ha/yr**, mean **7.2**, showing broad heterogeneity; cited savanna soil stocks are around **174 Mg C/ha** | No exact universal 80-stock support found. The repository currently uses 90. Do not confuse stock with annual productivity. |
| Temperate coniferous — 200 | NEEDS CORRECTION | Pan et al. (2011), [10.1126/science.1201609](https://doi.org/10.1126/science.1201609): all temperate forests **155 Mg C/ha** | No exact global coniferous value of 200 was found. Current repo is 300. A regional/ecozone-specific source is required. |
| Boreal forest — 250 | VERIFIED as rounded global approximation | Pan et al. (2011), [10.1126/science.1201609](https://doi.org/10.1126/science.1201609): boreal forests **239 Mg C/ha** | 250 is a reasonable rounded value under Pan's pool definitions. Current repo is 160 and therefore not the value supplied for review. |
| Seagrass meadow — 150 | VERIFIED as rounded median with explicit 1-m soil boundary | Fourqurean et al. (2012), “Seagrass ecosystems as a globally significant carbon stock,” [10.1038/ngeo1477](https://doi.org/10.1038/ngeo1477): median top-1-m sediment stock **139.7 Mg C/ha**; reported mean approximately **194.2 Mg C/ha** | Supports roughly 150 if labeled top-1-m sediment carbon. Current repo is 500, which is not supported as a global default by this source. |

### Required methodology before adopting any table

Every biome value needs, at minimum:

- carbon pools included: aboveground biomass, belowground biomass, deadwood/litter, soil/peat;
- soil/peat depth;
- ecosystem condition and age;
- geography/ecozone;
- statistic and uncertainty: mean/median/range/sample size;
- stock (`tC/ha`) versus flux (`tC/ha/yr`);
- source DOI and review date.

A single ranked bar chart mixing deep peat, 1-m seagrass sediment, 30-cm cropland soil, and unspecified forest pools creates false comparability.

## 5. Carbon-clock framing

### NEEDS CORRECTION — 143 / 123 / 20 is not scientifically defensible as currently labeled

The current attribution added at `js/carbon-clock.js:75` calls this a “Global Carbon Project 2023 net-accounting framing.” Global Carbon Project does not report 143 GtCO₂/yr of total anthropogenic emissions or 123 GtCO₂/yr of natural absorption.

Global Carbon Budget 2025 uses five explicit perturbation-budget components:

- fossil emissions (`E_FOS`);
- net land-use-change emissions (`E_LUC`);
- atmospheric growth (`G_ATM`);
- ocean sink (`S_OCEAN`);
- land sink (`S_LAND`).

For 2025 it estimates total anthropogenic emissions at **42.2 GtCO₂/yr**. Over 2015–2024, emissions were partitioned approximately **50% atmosphere, 29% ocean, and 21% land**. From January 2026 the remaining 1.5°C budget at 50% likelihood is **170 GtCO₂**, about four years at 2025 emissions.

Primary source: Friedlingstein et al. (2026), “Global Carbon Budget 2025,” *Earth System Science Data*, [DOI 10.5194/essd-18-3211-2026](https://doi.org/10.5194/essd-18-3211-2026).

The site's subtraction happens to yield a number near the decadal atmospheric increase, but unexplained gross numbers are not interchangeable with the perturbation budget. The phrase “Humanity emits 143 Gt” overstates current anthropogenic CO₂ emissions by about 3.4×. The phrase “Nature absorbs 123 Gt” lacks defined land/ocean pools and likely mixes gross-cycle fluxes with net anthropogenic accounting.

### Recommendation

Replace the framing with the standard budget:

> Humanity emitted approximately 42.2 GtCO₂ in 2025. Over the latest assessed decade, about half remained in the atmosphere, while land and ocean sinks removed the other half. Annual partitioning varies, and all values carry uncertainty.

If the animation needs a per-second atmospheric-addition counter, derive it from `G_ATM` for a named year or from the decadal 50% airborne fraction—not from `143 − 123`. Label year, source version, units, uncertainty, and whether the counter represents emissions or atmospheric accumulation.

## 6. NDVI replacement pathway

### MOD13Q1 plan — VERIFIED direction, NEEDS CORRECTION in implementation detail

MODIS MOD13Q1 v6.1 is the correct baseline product for the narrative's 2000–present time span. It provides 250-m, 16-day NDVI from February 2000, has explicit QA bands and a `0.0001` scale factor, and is suitable for consistent long time series.

Primary dataset: Didan (2021), “MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061,” [DOI 10.5067/MODIS/MOD13Q1.061](https://doi.org/10.5067/MODIS/MOD13Q1.061). See also the [Earth Engine catalog](https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1).

Corrections required in `docs/NDVI-PIPELINE-PLAN.md`:

1. A 5-km centroid buffer (`:21-27`) can mix fire scar, water, settlement, forest, and plantation. Use verified site/project polygons and report valid-pixel counts.
2. “Growing season or annual mean” (`:29-32`) is not a reproducible method. Define a site-specific fixed seasonal window and statistic. For disturbance detection, compare matched-season quality-masked medians and preserve pre/post uncertainty.
3. Apply `SummaryQA`/`DetailedQA` masks before aggregation and record the rule.
4. Store collection DOI/version, geometry, date range, reducer, scale, projection, number of observations, QA rule, output uncertainty, processing code hash, and processing date. A few invented scene IDs are insufficient.
5. Validate against independent imagery or known event polygons, not narrative expectations; otherwise the pipeline risks confirmation bias.

### Sentinel Hub alternative — useful for recent high-resolution validation, not a full replacement

Sentinel-2's archive cannot reproduce 2000/2005/2010 narrative points. It is valuable for approximately 2015-present, 10-m validation and project-polygon monitoring.

`docs/NDVI-PIPELINE-PLAN.md:56-59` also uses `B8A` while calling the result 10 m. `B8A` is a 20-m narrow-NIR band; standard 10-m NDVI uses `B08` and `B04`. The existing code correctly names `B08/B04` at `js/ndvi-verifier.js:91-96`.

Sentinel Hub is not a no-key public endpoint. Its official API requires OAuth2: [Sentinel Hub authentication](https://docs.sentinel-hub.com/api/latest/api/overview/authentication/). The Statistical API can compute polygon/time statistics without downloading imagery: [Statistical API](https://docs.sentinel-hub.com/api/latest/api/statistical/).

### NEW FINDING — the current NDVI verifier is not a working partial Statistical API integration

1. `js/ndvi-verifier.js:9` claims no key is required, contradicted by its own note at `:63-66` and official OAuth requirements.
2. It constructs a Statistical API-style `aggregation` payload at `:71-102` but posts it to `/process` at `:105`, then expects a statistics response structure at `:116-125`. Process and Statistical APIs have different endpoints and response schemas.
3. The evalscript does not mask clouds, shadows, snow, water, or no-data pixels.
4. The MODIS fallback at `:154` applies the scale incorrectly: `round(raw × 1000) / 10000` is not `raw × 0.0001`. A raw NDVI of 5000 becomes 500 and is then removed by the `<= 1` filter.
5. A successful fetch compares a recent satellite series with hand-authored historical values but does not make the historical series “verified.”

### Recommended four-site path and effort

For a production-quality four-site replacement:

1. Obtain/approve four polygons.
2. Use Earth Engine MOD13Q1 v6.1 for 2000-present with documented QA and matched seasonal statistics.
3. Export a tidy observation table plus provenance metadata and uncertainty/valid-pixel diagnostics.
4. Use Sentinel-2 L2A only as a higher-resolution 2015-present cross-check at the same polygons.
5. Review time-series breaks against official fire/project evidence before replacing public arrays.

Estimated effort:

- **Prototype values:** 4–8 hours after Earth Engine access and polygons exist.
- **Reproducible extraction, QA, metadata, and four-site review:** 2–4 engineering days.
- **Independent scientific validation and publication approval:** an additional 1–3 reviewer days, longer if polygons or project histories are disputed.

OWL's 5–6-hour estimate is credible for a prototype export, not for a production evidence chain.

## 7. Required follow-up decisions

| Priority | Verdict | Required action |
|---:|---|---|
| 1 | NEEDS CORRECTION | Reopen SCI-100 and generate a complete inventory from every script/data file actually loaded by `index.html` and `gaia.html`. Track latent module content separately. |
| 2 | NEEDS CORRECTION | Remove the Global Carbon Project attribution from 143/123 and approve the standard 42.2 GtCO₂ perturbation-budget framing. |
| 3 | NEEDS CORRECTION | Repair quiz questions 3 and 4, align numerator/denominator time bases, and select one stock/flux methodology for quiz, scenario, GAIA, and biome surfaces. |
| 4 | NEEDS CORRECTION | Replace `+1.38°C vs 1951–1980` and stale 250-Gt/six-year budget claims across all duplicates. |
| 5 | NEEDS CORRECTION | Define biome carbon pools/depths and replace unsupported universal point values; prioritize the current seagrass 500, coniferous 300, and peat/site assertions. |
| 6 | VERIFIED | Add OGM/EFFIS provenance for the scoped Antalya 2021 fire-complex claim. |
| 7 | VERIFIED WITH QUALIFIER | Cite SPE as the proponent source for 6,000 acres; independently verify allocation/approval before stronger wording. |
| 8 | NEEDS CORRECTION | Obtain authoritative/family-approved evidence for Jean Missinhoun's origin and dates or remove the biographical/homecoming specifics. |
| 9 | NEEDS CORRECTION | Implement MOD13Q1 as an offline provenance pipeline; do not rely on the current browser verifier as evidence. |

## 8. Audit limitations

- This review did not alter or execute OWL's uncommitted code/data changes.
- External research prioritized official agencies, dataset publishers, and DOI-level literature. Absence of a discoverable source is not proof a private record does not exist.
- Legal land allocation and personal biography claims require authoritative records outside scientific literature.
- Carbon-density comparison remains conditional until ELU defines common pool and depth boundaries.
