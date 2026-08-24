# Country Climate Intelligence v1 source-rigor audit

**Audit date:** 2026-08-24; observed-temperature recovery follow-up 2026-08-25

**Candidate runtime SHA-256:** `3502840bc2ed0b37daee8f81b8920006f109457145faf68d0600741f7d4add8e`

**Verdict:** no priority-zero scientific defect found; candidate remains ineligible for production promotion pending the open evidence and rights gates below.

This was an independent read-only review of the committed source registry, normalized components, compiler rules, runtime contract, transformation evidence, and public scope claims. It is an engineering and source-rigor audit, not a substitute for the formal scientific, legal, or protected-file approvals declared by the release manifest.

## Verified strengths

- Global Carbon Budget acquisition receipts and exact raw checksums are retained and verified.
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
| Duplicate CCKP scenario/percentile tuples could overwrite an earlier row. | Projection and observed-year duplicates now throw, with negative compiler fixtures. |
| Optional-source normalized facts appeared more approved than their retained evidence justified. | WPP, Climate TRACE, Ember, and CCKP facts now carry `normalized_candidate_pending_source_revalidation`; release-specific source states and gates remain pending. |

The corrections above change evidence classification, review state, and validation behavior. They do not alter the candidate's country-level numeric values.

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

## Observed-temperature gap recovery

The 249 observed temperature gaps are an acquisition-path failure, not evidence that open reanalysis data is unavailable. The documented CCKP country API returned an HTTP-success envelope with an empty `data` array for a plausible ERA5 annual-temperature request. A public CCKP S3 object for annual 0.25° ERA5 `tas` covering 1950–2024 is discoverable, but the CCKP documentation still advertises an older end year and does not by itself settle the release-specific redistribution chain for that derived raster.

The recommended canonical recovery source is direct [Copernicus ERA5 monthly averaged data on single levels](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-monthly-means?tab=overview), dataset DOI [10.24381/cds.f17050d7](https://doi.org/10.24381/cds.f17050d7), using `monthly_averaged_reanalysis` and `2m_temperature` from January 1970 through December 2024. Public copy must identify the result as **ERA5 reanalysis 2 m air-temperature trend, 1970–2024 (°C/decade)**, not as a direct observed-station trend.

The production compiler must:

1. retain exact CDS request JSON, job IDs, retrieval timestamps, client version, source licence, and SHA-256 for every raw chunk;
2. pin a separately licensed Admin-0 boundary artifact and an explicit 249-entity crosswalk;
3. fail closed unless the variable, grid, units, calendar, and complete 1970–2024 period match the permitlist;
4. create annual means from monthly values weighted by days per month;
5. calculate country means using fractional grid-cell intersection weighted by spherical area, never a nearest point or inherited parent value;
6. require a declared annual mapped-area threshold, proposed at 99.5%, and mark unresolved microstates or territories as explicit gaps;
7. calculate the OLS slope across the 55 annual country means and publish the result per decade with `n=55` and method metadata; and
8. retain raw, boundary, crosswalk, normalized-output, and transformation checksums in the release receipt.

ERA5 is globally gridded and technically includes Antarctica, but coverage for all 249 registry entities is an acceptance test rather than an advance claim. Tiny islands, coastal territories, disputed areas, Svalbard and Jan Mayen, and Antarctica require explicit mapping decisions and spatial-resolution caveats. Existing gaps remain in place until one complete checksummed rerun passes those rules.

## Open production blockers

1. Independently retain and revalidate exact external raw acquisition receipts and checksums for WPP, Climate TRACE, Ember, and CCKP.
2. Complete release-specific redistribution review for Climate TRACE fields that may originate in listed external datasets.
3. Complete release-specific review of the World Bank CCKP and underlying CMIP6 derivative-licence chain.
4. Approve the CCKP individual-model roster, NetCDF licence receipts, pinned boundary representation, and model-first aggregation method before filling any of the four projected-temperature gaps.
5. Approve a direct Copernicus ERA5 observed-temperature source entry, attribution, permitlist, pinned boundary source, and redistribution receipt before compiling any replacement trend values.
6. Complete independent scientific review of core-carbon mappings and derivations, plus the optional source taxonomies and selections.
7. Obtain the required protected-file and final production approvals.

Until these are complete, `raw_receipt_revalidation`, `redistribution_rights_revalidation`, `independent_scientific_review`, and `production_runtime_release` remain false.

## Authoritative references used by the audit

- [Global Carbon Budget 2025 ICOS collection](https://meta.icos-cp.eu/collections/AxnIW-ydMBT4BdKjxV63DGQl)
- [UN World Population Prospects 2024 portal](https://www.un.org/development/desa/pd/world-population-prospects-2024) and [methodology report](https://population.un.org/wpp/assets/Files/WPP2024_Methodology-Report_Final.pdf)
- [Climate TRACE data guide](https://climatetrace.org/data) and [terms](https://climatetrace.org/terms)
- [World Bank CCKP metadata](https://climateknowledgeportal.worldbank.org/index.php/metadata) and [CMIP6 collection documentation](https://worldbank.github.io/climateknowledgeportal/docs/collections/cmip6-x0.25.html)
- [CCKP public AWS data documentation](https://worldbank.github.io/climateknowledgeportal/README.html) and [ERA5 collection documentation](https://worldbank.github.io/climateknowledgeportal/docs/collections/era5-x0.25.html)
- [CMIP6 source licence registry](https://wcrp-cmip.github.io/CMIP6_CVs/docs/CMIP6_source_id_licenses.html) and [CMIP6 Terms of Use](https://pcmdi.llnl.gov/CMIP6/TermsOfUse/TermsOfUse6-1.html)
- [Copernicus ERA5 monthly means](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-monthly-means?tab=overview), [Copernicus Product Licence](https://cds.climate.copernicus.eu/licences/licence-to-use-copernicus-products), and [Hersbach et al. (2020)](https://doi.org/10.1002/qj.3803)
- [World Bank Official Boundaries](https://datacatalog.worldbank.org/search/dataset/0038272/world-bank-official-boundaries)

## Audit boundary

This audit did not acquire replacement source files, infer missing country data, reinterpret published aggregate taxonomies, or authorize redistribution. Formal release gates remain controlled by `data/climate/releases/country-climate-intelligence-v1/release-manifest.json`.
