# Country Climate Intelligence v1 source-rigor audit

**Audit date:** 2026-08-24; observed-climate and Ember fuel-mix follow-up 2026-08-25

**Candidate runtime SHA-256:** `1b9c59d0ec912f8ec75f45ef6bab885a45661eea7b68add50ac2138e778ad198`

**Verdict:** no priority-zero scientific defect found; candidate remains ineligible for production promotion pending the open evidence and rights gates below.

This record combines the independent read-only review of the source registry, normalized components, compiler rules, runtime contract, transformation evidence, and public scope claims with the later implementation follow-up. It is an engineering and source-rigor audit, not a substitute for the formal scientific, legal, or protected-file approvals declared by the release manifest.

## Verified strengths

- Global Carbon Budget acquisition receipts and exact raw checksums are retained and verified.
- Ember's 49,079,981-byte long-format snapshot, retrieval metadata, and SHA-256 are retained externally by exact receipt; the normalized component is separately checksummed.
- The runtime deterministically partitions all 249 registry entities: Carbon 213 comparable / 36 explicit gaps, Power 195 / 54, and Physical 245 / 4.
- Missing values remain distinct from zero and territory records are not populated from parent countries.
- GCB territorial fossil CO₂ and independent economy-wide GHG context remain explicitly non-comparable; the runtime produces no disagreement percentage.
- Lens ordering is constrained by metric, period, and evidence class.
- PRIMAP-hist v2.7 is absent. The reviewed v2.6.1 artifact remains citation-only and contributes no public value.

## Findings corrected in this candidate

| Finding | Correction |
|---|---|
| WPP 2024 Medium was described as an estimate even though the 2024 Medium series is a projection. | The compiler now requires a `projection` receipt classification. Population and derived per-capita records are modeled, with public copy stating “WPP 2024 Medium population projection.” |
| The Ember compiler could accept `MtCO2e` and relabel it as `MtCO2`. | Power-emissions normalization now accepts only an explicit `MtCO2` unit; CO₂-equivalent rows fail closed. |
| A clean/fossil/wind-and-solar display could look additive while hiding the generation taxonomy. | The compiler now permitlists nine exact fuel-share metrics, preserves blank cells as gaps, distinguishes source zeroes, and accepts a visual mix only when non-blank clean and fossil components reconcile to their aggregate anchors within ±0.02 percentage points. The browser uses two aligned tracks and never rescales the source rows. |
| Duplicate CCKP scenario/percentile tuples could overwrite an earlier row. | Projection and observed-year duplicates now throw, with negative compiler fixtures. |
| Optional-source normalized facts appeared more approved than their retained evidence justified. | WPP, Climate TRACE, Ember, and CCKP facts now carry `normalized_candidate_pending_source_revalidation`; release-specific source states and gates remain pending. |

The original classification corrections changed evidence state and validation without altering existing metrics. The later Ember follow-up expands the candidate from 18 to 27 metrics with exact published fuel shares; it does not modify the existing clean-share comparison values or ordering.

The later v46 raised-tile treatment and v47 subtle/inverse-relief demo change only presentation behavior. They do not alter source facts, coverage, ordering, or country-level numeric values. The inverse Carbon treatment is query-only, declares its direction in the legend and view model, and leaves the raw descending emissions rail unchanged.

## Headline Physical comparison gaps

The four `climate.temperature.change` gaps are Antarctica (`ATA`), Western Sahara (`ESH`), Falkland Islands (Malvinas) (`FLK`), and South Georgia and the South Sandwich Islands (`SGS`). Each lacks the compiler's complete five-tuple: SSP1-2.6 median, SSP2-4.5 p10/median/p90, and SSP5-8.5 median. The same four entities lack the projected-precipitation tuple.

This is not a confirmed absence of modeled climate fields. CCKP publishes global 0.25° annual temperature-anomaly rasters for the required 2040–2059 climatology:

```text
https://wbg-cckp.s3.amazonaws.com/data/cmip6-x0.25/tas/ensemble-all-ssp126/anomaly-tas-annual-mean_cmip6-x0.25_ensemble-all-ssp126_climatology_median_2040-2059.nc
https://wbg-cckp.s3.amazonaws.com/data/cmip6-x0.25/tas/ensemble-all-ssp245/anomaly-tas-annual-mean_cmip6-x0.25_ensemble-all-ssp245_climatology_{p10,median,p90}_2040-2059.nc
https://wbg-cckp.s3.amazonaws.com/data/cmip6-x0.25/tas/ensemble-all-ssp585/anomaly-tas-annual-mean_cmip6-x0.25_ensemble-all-ssp585_climatology_median_2040-2059.nc
```

The present external-only receipts cannot distinguish a country-API omission, crosswalk omission, or partial upstream response. A replacement compiler must not area-average CCKP's already pixelwise percentile rasters and then label the output a country-level multi-model percentile. In general, the percentile of country-area model means is not the country-area mean of grid-cell percentiles. The scope-preserving method is to aggregate each individual model to the country polygon first and then calculate p10/median/p90 across those country means with a fixed model roster.

`ATA` is conditionally fillable after a pinned Antarctica polygon, model roster, fractional-cell area overlay, complete five-tuple, coverage threshold, NetCDF attributes/licences, and checksums pass review; it must be labelled as a geographic Antarctic area rather than a sovereign-country assessment. `ESH`, `FLK`, and `SGS` remain explicit gaps until the release approves a versioned disputed/NDLSA and multipart-territory boundary policy. No parent-country values may be inherited.

## Observed temperature and precipitation recovery

The earlier all-entity observed-temperature gap was an acquisition-path failure, not an absence of open reanalysis data. The implemented recovery uses the World Bank CCKP's official `api/v1` global-country ERA5 annual aggregate routes for `tas` and `pr`, rather than performing new browser-side or repository-side spatial aggregation. Exact external receipts pin the 295,983-byte temperature response at SHA-256 `62effa974e359adb02b6e4346d385997af9987a9437e31d58cf0f433cf364824` and the 326,772-byte precipitation response at SHA-256 `8ad69148450466310bdb84284cec2c9c385bbbb6acd5a062597d985464657494`.

Each response contains 246 country/area series from 1950 through 2025. The compiler maps 245 to the 249-entity registry, records CCKP's `KSV` Kosovo series as the sole non-ISO exception, and preserves `ATA`, `ESH`, `FLK`, and `SGS` as explicit gaps. It selects the exact 56 annual values from 1970 through 2025, retains them for public charts, and derives the OLS slope per decade plus fitted endpoints offline. No parent-country value or missing value is imputed. Public copy labels the evidence ERA5 reanalysis rather than direct station observation; precipitation is annual area-mean accumulation, not a drought, flood, runoff, or water-availability diagnosis.

The recovery resolves the acquisition defect for 245 entities. It does not self-approve the optional component: independent scientific review must still confirm the CCKP aggregate semantics, units, period selection, identity ledger, trend derivation, and the four retained gaps before production promotion.

## Open production blockers

1. Independently retain and revalidate exact external raw acquisition receipts and checksums for WPP, Climate TRACE, and CCKP CMIP6; independently verify the pinned Ember and ERA5 receipts against their reviewed compiler contracts.
2. Complete release-specific redistribution review for Climate TRACE fields that may originate in listed external datasets.
3. Complete release-specific review of the World Bank CCKP and underlying CMIP6 derivative-licence chain.
4. Approve the CCKP individual-model roster, NetCDF licence receipts, pinned boundary representation, and model-first aggregation method before filling any of the four projected-temperature gaps.
5. Independently review the CCKP ERA5 `tas`/`pr` attribution, permitlists, aggregate semantics, 1970–2025 selection, OLS implementation, and four explicit identity gaps.
6. Complete independent scientific review of core-carbon mappings and derivations, plus the optional source taxonomies and selections.
7. Obtain the required protected-file and final production approvals.

Until these are complete, `raw_receipt_revalidation`, `redistribution_rights_revalidation`, `independent_scientific_review`, and `production_runtime_release` remain false.

## Authoritative references used by the audit

- [Global Carbon Budget 2025 ICOS collection](https://meta.icos-cp.eu/collections/AxnIW-ydMBT4BdKjxV63DGQl)
- [UN World Population Prospects 2024 portal](https://www.un.org/development/desa/pd/world-population-prospects-2024) and [methodology report](https://population.un.org/wpp/assets/Files/WPP2024_Methodology-Report_Final.pdf)
- [Climate TRACE data guide](https://climatetrace.org/data) and [terms](https://climatetrace.org/terms)
- [Ember Yearly Electricity Data](https://ember-energy.org/data/yearly-electricity-data/) and [API documentation](https://api.ember-energy.org/v1/docs)
- [World Bank CCKP metadata](https://climateknowledgeportal.worldbank.org/index.php/metadata) and [CMIP6 collection documentation](https://worldbank.github.io/climateknowledgeportal/docs/collections/cmip6-x0.25.html)
- [CCKP public AWS data documentation](https://worldbank.github.io/climateknowledgeportal/README.html) and [ERA5 collection documentation](https://worldbank.github.io/climateknowledgeportal/docs/collections/era5-x0.25.html)
- [CMIP6 source licence registry](https://wcrp-cmip.github.io/CMIP6_CVs/docs/CMIP6_source_id_licenses.html) and [CMIP6 Terms of Use](https://pcmdi.llnl.gov/CMIP6/TermsOfUse/TermsOfUse6-1.html)
- [Copernicus ERA5 monthly means](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-monthly-means?tab=overview), [Copernicus Product Licence](https://cds.climate.copernicus.eu/licences/licence-to-use-copernicus-products), and [Hersbach et al. (2020)](https://doi.org/10.1002/qj.3803)
- [World Bank Official Boundaries](https://datacatalog.worldbank.org/search/dataset/0038272/world-bank-official-boundaries)

## Audit boundary

This audit did not acquire replacement source files, infer missing country data, reinterpret published aggregate taxonomies, or authorize redistribution. Formal release gates remain controlled by `data/climate/releases/country-climate-intelligence-v1/release-manifest.json`.
