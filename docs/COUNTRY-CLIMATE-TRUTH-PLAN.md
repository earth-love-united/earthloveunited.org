# Country Climate Intelligence v1 release plan

**Mission:** `country-climate-intelligence-v1`

**Release:** `country-climate-intelligence-2026-08-25-candidate.3`

**State:** implemented factual candidate; production promotion withheld

## Outcome

The retired PRIMAP-centered emissions experience is replaced by a metric-first country dashboard with Carbon, Power, and Physical lenses. There is no composite score and no claim that targets, finance, offsets, or projects change a country's factual climate record.

The browser consumes one deterministic static runtime. Source acquisition and normalization stay offline.

## Implemented flow

```text
approved source registry + exact external snapshots
  → component-specific offline compilers
  → 249-row normalized candidate artifacts with explicit gaps and review state
  → deterministic country-climate-intelligence builder
  → exact-SHA static runtime
  → Data
  → COUNTRY_CLIMATE_INTELLIGENCE view model
  → GlobeModule and the parity fallback browser
```

`GlobeModule` owns rendering and interaction only. Scientific selection, order eligibility, scope boundaries, gap copy, evidence classes, and provenance come from the runtime and `COUNTRY_CLIMATE_INTELLIGENCE`.

## Artifacts

| Artifact | Responsibility |
|---|---|
| `data/climate/source-registry.json` | Fail-closed licence, attribution, permitlist, receipt, checksum, storage, and redistribution decisions |
| `tools/compile-gcb-emissions.js` | Existing GCB compiler plus Country Climate Intelligence fossil/consumption/transfer/land-use mode |
| `tools/compile-wpp-population.js` | Exact-year WPP population normalization |
| `tools/compile-climate-trace.js` | 2024 AR6 GWP100 independent GHG context, forestry/LULUCF excluded |
| `tools/compile-ember-power.js` | Exact 2019/2024 published power aggregates and five-year change |
| `tools/compile-cckp-physical.js` | CMIP6 projection ranges and ERA5 OLS trends/gaps |
| `tools/normalize-cckp-era5-country-timeseries.js` | Exact CCKP country-response validation, 246-series identity ledger, and variable-aware 1970–2025 annual temperature/precipitation normalization |
| `tools/refresh-cckp-observed-temperature.js` | Checksum-pinned observed-temperature replacement that leaves projections and precipitation unchanged |
| `tools/refresh-cckp-observed-variable.js` | Checksum-pinned variable refresh used to add observed precipitation without modifying projections or temperature |
| `data/climate/releases/country-climate-intelligence-v1/` | Normalized facts, component checksums, receipts, transformation log, release gates |
| `tools/build-country-climate-intelligence.js` | Deterministic 249-entity assembly, per-capita derivation, coverage, and lens orders |
| `data/climate/runtime/country-climate-intelligence.json` | Compact static factual candidate |
| `js/data.js` | Exact SHA-256 verification and public runtime API |
| `js/country-climate-intelligence.js` | Lens-aware view model and evidence presentation contract |
| `js/globe.js` | Globe/fallback rendering, selection, rail/card interactions, and lens-change event |

## Release gates

| Gate | Candidate state | Promotion requirement |
|---|---|---|
| Source-registry licensing and attribution | configured | Climate TRACE exception-backed fields and the CCKP/CMIP6 derivative chain require release-specific revalidation |
| Field permitlists and compiler denial | passed | no unreviewed source field can be selected |
| Exact normalized component checksums | passed | deterministic rebuild must match committed runtime |
| External raw-receipt revalidation | ERA5 temperature and precipitation receipts pinned; other optional components open | independently revalidate and retain the WPP, TRACE, Ember, and CCKP CMIP6 acquisition receipts |
| Core-carbon scientific review | open | independent reviewer verifies GCB identity mapping, scopes, transfer sign, cumulative, land-use mean/σ, and per-capita denominator |
| Optional-component scientific review | open | independent reviewer verifies TRACE GWP/filter, Ember taxonomy/evidence class, and CCKP scenario/percentile selections |
| Runtime/static validation | passed for candidate | rerun after any factual or code change |
| Visual/accessibility review | passed for current candidate; rerun required after changes | light/dark, desktop/tablet/mobile, keyboard, screen-reader summaries, WebGL and fallback parity |
| Atomic service-worker staging | passed for current candidate | current runtime and previous rollback artifact must stage together |
| Production promotion | blocked | every gate above plus protected reviewer approval |

The release manifest never self-promotes. `independent_scientific_review=false` and `production_runtime_release=false` remain authoritative until a separate reviewer changes them.

## Validation matrix

### Governance and compilation

- source-registry schema, licence, redistribution, and permitlist checks;
- adversarial mutations for premature approval and permit bypass;
- exact checksum rejection;
- every selected upstream row maps once or receives one enumerated exception;
- exactly 249 normalized entity rows per component;
- zero remains distinct from missing;
- no parent-country imputation.

### Derivations and scope

- per-capita unit conversion and exact WPP 2024 Medium projection denominator;
- 2019–2024 percentage-point change;
- three-model land-use mean, population σ, and negative removals;
- observed OLS slope per decade;
- exact 56-value 1970–2025 ERA5 temperature and precipitation series, compiled fitted endpoints, 245 mappings per variable, one `KSV` exception per variable, and four explicit registry gaps;
- CMIP6 p10 ≤ median ≤ p90;
- deterministic Physical-card projection samples reproduce exactly for the same country and factual release, remain inside the published SSP2-4.5 p10–p90 range, and never enter metric records, rankings, or comparisons;
- complete SSP2-4.5 range plus SSP1-2.6/SSP5-8.5 medians;
- exact scope matching before any numerical source delta;
- estimates or models rejected from a lens requiring actual evidence.

### Runtime and UI

- exact runtime SHA-256 and schema v1;
- 249 unique registry IDs and exactly 18 metric records per entity;
- deterministic coverage and complete lens partitions;
- China, United States, India, Brazil, France, Norway, Tuvalu, and Antarctica fixtures;
- PRIMAP absent from headings, legends, tooltips, ordered rails, and primary charts;
- v2.6.1 present only in detailed citation provenance; v2.7 absent entirely;
- selection preserved across lenses;
- metric/value/unit/period/evidence in tooltips;
- no overlap among At a glance, observed charts, the published projection range, and projected fact cards; Physical groups observed temperature, the evidence-only p10/median/p90 range, the unchanged projected-temperature fact, the projected-precipitation fact, and observed precipitation while its ordered rail remains the modeled projection metric;
- the temperature range copies only the source-published p10, median, and p90, distinguishes them by shape as well as color, and explicitly rejects probabilistic, annual-trajectory, simulation, and ranking interpretations;
- every tile relief value is a subtle monotonic encoding of the active lens's exact comparison metric; the query-only inverse Carbon demo declares its direction and never changes the raw emissions rail, while Physical height is never described as vulnerability, damage, or responsibility;
- fallback parity for all 249 records;
- body-level controls, 44px touch targets, reduced motion, focus restoration, and non-color status cues;
- stale cache, WebCrypto, WebGL, constructor, and partial-data failures fail closed.

## Golden entities

| Entity | Required coverage |
|---|---|
| China | Carbon order leader; long fossil series; consumption/transfer; independent GHG context |
| United States | Carbon order position; cumulative responsibility and consumption context |
| India | Carbon order position; denominator and independent context |
| Brazil | Land-use model spread and separate fossil record |
| France | Consumption/transfer context and high-clean power case |
| Norway | Very high clean-power share without whole-economy praise |
| Tuvalu | Small-state navigation and explicit source gaps |
| Antarctica | Registry navigation; no assessment; explicit Carbon/Power/Physical gaps where unavailable |

## Rollback

The v53 service worker composes the reviewed Guided First Orbit assets with the
subtle relief presentation, candidate dashboard, and both runtime generations:

```text
data/climate/runtime/country-climate-intelligence.json?v=cci1candidate6
data/climate/runtime/country-factual-candidate.json?v=ct42candidate1
```

Rollback is a reviewed runtime/data-loader/service-worker change; it does not delete either artifact. Cache epoch, HTML script queries, runtime checksum, and data version change atomically.

## Next review

The independent source-rigor pass and its remaining production blockers are recorded in
[`COUNTRY-CLIMATE-SOURCE-RIGOR-AUDIT.md`](COUNTRY-CLIMATE-SOURCE-RIGOR-AUDIT.md).
The four projected-temperature gaps require CCKP individual-model, country-first aggregation;
Antarctica is conditionally fillable, while ESH, FLK, and SGS retain explicit gaps until a
reviewed disputed/NDLSA and multipart-territory boundary policy exists. Observed temperature now
uses the exact-checksummed official CCKP country aggregate, with 245 mapped 1970–2025 series and
the same four explicit registry gaps. Its remaining gate is independent scientific and visual
review, not further browser-side acquisition. Observed precipitation now follows the same exact
1950–2025 source boundary, 1970–2025 selection, 245-entity identity ledger, and four explicit gaps.
The next action is completion of those evidence,
rights, scientific, and protected-file reviews, not unreviewed value insertion.
NDC assessment, delivery scoring, finance, vulnerability, monthly/YTD views, and composite
rankings remain out of scope for v1.
