# Country Climate Intelligence v1 — transformation log

Release: `country-climate-intelligence-2026-08-27-candidate.7`

Status: normalized factual candidate with exact value-source re-fetch receipts. This is not a production promotion receipt. Independent scientific review and release-owner confirmation of the documented redistribution-rights decisions remain open.

## Reproducibility boundary

- Raw third-party files stay outside the repository.
- The repository stores exact source/component receipts, normalized country facts pending independent scientific review, explicit gap records, transformation code, and the compact runtime.
- The browser runtime uses recursively key-sorted, newline-terminated compact JSON. Human-review component artifacts remain indented; formatting never changes values or ordering.
- Every compiler starts from the 249-entry country registry. A source row must map once or receive one enumerated aggregate, territory, or unmapped exception. Missing data is never converted to zero and a territory never inherits its parent country's value.
- Prior normalized candidate facts were recovered byte-for-byte from candidate SHA-256 `436db7290378d9d9f1a1f59f83d2cb219638ac490f5f7f3dccffc8fe203bde09` after an uncommitted temporary worktree was purged. Carbon, population, and CMIP6 projections are unchanged. Observed temperature/precipitation and the Ember power component are refreshed from exact-checksummed snapshots.
- Candidate.5 changes the WPP denominator metric ID from `population.estimate` to `population.wpp_medium_projection`. `tools/migrate-wpp-medium-projection-id.js` requires the exact candidate.4 WPP component hash, verifies all 236 available records were already modeled 2024 Medium projections, recomputes only the scope fingerprint after changing the metric ID, and records `value_changes=false`. No population or per-capita input value changes in this contract migration.
- Candidate.6 removes the Climate TRACE component, source record, compiler path, all 249 independent-GHG metric records, and its scientific/rights review obligations. GCB carbon values, ordering, coverage, and derivations are unchanged.
- Candidate.7 independently re-fetches every value-contributing source. Exact GCB workbooks reproduce annual territorial, consumption, and transfer values; a fresh compile changes only 182 sub-display-precision cumulative/land-use results by at most 0.000008 MtCO₂. The current official WPP gzip replaces 26 one-person rounding differences from the recovered component. Ten exact CCKP projection responses reproduce all 2,450 mapped projected values without a difference. Ember and both ERA5 responses reproduce their pinned bytes exactly. The final CCKP component header is normalized to the same pending-review artifact type as the other components; obsolete recovery labels, a candidate.3 identifier, and an empty 2026-08-24 ERA5 acquisition attempt are not carried into the public runtime. No CCKP country value changes in that metadata cleanup.
- Source registry version `0.8.0` binds methodology `1.2.0` and excludes Climate TRACE from the product evidence boundary. The release-review request pins the methodology, source-rigor audit, truth plan, and reviewer handoff alongside the runtime and retained compilers.

## Carbon

- The official fossil and land-use workbooks were independently re-fetched from their ICOS objects and reproduced at 755,198 / 1,271,678 bytes with SHA-256 `968097cacb1a6a5bfa0cf74ee90763f74a90ef10499e060ab43d1a74c671d46b` / `9a29536d6925d06f8c4a97581b720121fcf219732c240e970bc24167d74e38d1`.
- The 237 distinct workbook entities have a complete disposition ledger: 216 registry mappings and 21 enumerated aggregate, bunker, or Kosovo exceptions. The mapping receipt is `data/climate/mappings/gcb-2025-country-map.json`.
- Territorial fossil CO₂: GCB source MtC multiplied by 3.664; 2024 is the comparison record; 1990–2024 remains a source series.
- Cumulative fossil CO₂: sum of available 1850–2024 territorial MtC values, then multiplied by 3.664.
- Consumption emissions and net transfers: latest published source value, kept in their own accounting frames. Net transfer follows GCB's territorial-minus-consumption convention; positive means net exported embodied emissions.
- Land-use CO₂: calculate each model's 2015–2024 arithmetic mean for BLUE, OSCAR, and LUCE; the central value is the arithmetic mean of those three model means; uncertainty is their population standard deviation. Negative values remain removals.
- Per capita: `territorial MtCO₂ × 1,000,000 ÷ year-matched WPP 2024 Medium population projection`. No different year or variant is substituted. The denominator and derived result are labeled modeled rather than actual or estimated.

## Power

- Select exact 2024 annual actuals under Ember's published clean, fossil, wind-and-solar, intensity, power-emissions, and generation-fuel taxonomy. The pinned 49,079,981-byte CSV has SHA-256 `259e1095ee8ffeaf0aff37ad557916ae1823a2da13312da50ba4cec6b4574c3b`; raw bytes remain external.
- Five-year change is `clean share 2024 − clean share 2019`, reported in percentage points.
- Source-labelled estimates cannot enter the 2024 clean-share order.
- The nine standardized generation types are Bioenergy, Coal, Gas, Hydro, Nuclear, Other Fossil, Other Renewables, Solar, and Wind. `Other Renewables` remains Ember's combined geothermal, tidal, and wave category; the dashboard does not relabel it as geothermal.
- All 3,107 selected 2019/2024 rows receive one identity disposition: 2,897 map to registry entities, 195 are documented regional aggregates, and 15 Kosovo rows are documented unmapped exceptions. No parent-country imputation is performed.
- A country fuel mix is publishable only when its non-blank fuel rows reconcile separately to the published clean and fossil anchors and both published sums remain within ±0.02 percentage points of 100. The 194 accepted mixes pass; Lesotho's nine blank fuel cells remain an explicit fuel-mix gap.
- Missing fuel rows remain gaps even when another published component completes the total. Exact source zeroes remain zero. The browser copies raw shares without rescaling; 99.98–100.02 totals are identified as source rounding rather than silently normalized.

## Physical climate

- Projected temperature and precipitation use country-area CMIP6 anomalies for 2040–2059 relative to 1995–2014.
- Ten exact official CCKP country API responses pin both variables for SSP1-2.6 median, SSP2-4.5 p10/median/p90, and SSP5-8.5 median. All 2,450 mapped values reproduce the prior projection component exactly; each response contains 246 upstream entities, including the documented `KSV` exception.
- The public comparison is SSP2-4.5 median with p10–p90. SSP1-2.6 and SSP5-8.5 medians remain analyst context.
- The public projection-range graphic copies only the published SSP2-4.5 p10, median, and p90. It fits no probability distribution, creates no synthetic samples, and draws no path through intervening years.
- The live CCKP download interface resolved to separate official `api/v1` global-country ERA5 `tas` and `pr` routes. Each exact response contains 246 annual country/area series from 1950 through 2025; both raw responses remain external and their byte counts, retrieval URLs, response timestamps, and SHA-256 digests are pinned in variable-specific receipts.
- The compiler selects 1970–2025 without spatial reprocessing, preserves the World Bank CCKP country-area aggregates, and retains all 56 annual values for both public charts. The API values are published to two decimal places.
- Every upstream series maps once or receives a documented exception: 245 series map to registry entities and CCKP's `KSV` Kosovo series is the sole non-ISO exception. Antarctica, Western Sahara, Falkland Islands (Malvinas), and South Georgia and the South Sandwich Islands remain explicit gaps. No parent-country values are imputed.
- ERA5 observed temperature and precipitation trends are ordinary-least-squares slopes over those annual country aggregates, reported in °C per decade and mm/year per decade respectively. The compiled context stores the two fitted endpoints used by each renderer; the browser does not calculate either trend.
- ERA5 is labeled as reanalysis, not direct station observation. Observed trend records expose first-class `evidence_kind: reanalysis` metadata in addition to the constrained `modeled` status field. The precipitation series is the annual accumulated total averaged over the CCKP country area; it is not a direct drought, flood, runoff, or water-availability measure.

## Public boundaries

- No composite score, target assessment, finance judgment, performance label, offset adjustment, or mismatched-scope source delta is produced.
- PRIMAP v2.7 is not acquired or ingested. The reviewed v2.6.1 release is retained only as detailed citation provenance and contributes no runtime value.
- Climate TRACE is not acquired, compiled, represented in runtime metrics, or included in the release source catalog.
- UNFCCC titles, submission dates, and direct links are metadata only.
