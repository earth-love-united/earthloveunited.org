# Country Climate Intelligence v1 methodology

**Status:** normalized factual candidate pending source revalidation; not a production scientific release

**Methodology version:** 1.1.0

**Candidate date:** 2026-08-25

## Purpose

Country Climate Intelligence is a metric-first, multi-source country dashboard. It keeps three distinct questions separate:

1. How much territorial fossil CO₂ does this country emit?
2. What does its electricity mix show about the power transition?
3. What observed and modeled physical-climate changes are available for its territory?

The dashboard does not publish a composite climate score, target or delivery assessment, finance judgment, vulnerability score, offset adjustment, or country-performance grade. A high clean-electricity share does not cancel territorial emissions. Projected warming is not responsibility, vulnerability, or damage.

## Country universe

The runtime contains exactly 249 ISO 3166-1-compatible registry entities from the separately licensed Debian `iso-codes` identity artifact. Every entity remains navigable even when a source has no comparable value.

An upstream record must map to one registry entity or receive one documented `aggregate_exception`, `territory_exception`, or `unmapped_exception`. Territory values are never inherited from a parent country. Missing data is never converted to zero.

## Lenses

### Carbon

The default comparison is 2024 territorial fossil CO₂ from [Global Carbon Budget 2025 v1.0](https://meta.icos-cp.eu/collections/AxnIW-ydMBT4BdKjxV63DGQl). The ordered rail is descending by the raw `emissions.fossil_co2.territorial` value. Color is sequential and transparent polygon relief is log-scaled for magnitude. Relief is deliberately subtle: every metric tile stays between `0.007` and `0.012` globe radii above the surface.

The query-only presentation experiment `?carbon-relief=low-is-high` reverses Carbon relief so lower territorial fossil CO₂ sits slightly higher and the largest value remains nearest the base tile. It does not change color, the raw descending rail, eligibility, country facts, or source data. Its legend explicitly identifies the inversion as a demo and not a performance score. Missing values remain at the base rather than being treated as low emissions.

The card keeps these facts separate:

- territorial fossil CO₂ in 2024;
- 1990–2024 territorial series;
- cumulative territorial fossil CO₂ from 1850 through 2024;
- latest available consumption-based fossil CO₂;
- latest net transfer of embodied fossil CO₂;
- 2015–2024 land-use CO₂ mean and model spread;
- territorial fossil CO₂ per person using the year-matched WPP 2024 Medium population projection;
- independent 2024 GHG context from Climate TRACE.

Land-use change never enters the territorial fossil comparison value. Positive net transfer follows the GCB territorial-minus-consumption convention and means net exported embodied emissions.

### Power

The comparison is Ember's 2024 published clean-generation aggregate. The rail explores descending `electricity.clean_share`. Color and subtle country-tile relief redundantly encode the same bounded 0–100% clean-share metric on a linear scale; no other power metric affects height.

The card includes clean, fossil, and wind-and-solar shares, 2019–2024 clean-share change, carbon intensity, and power-sector emissions. Only source-classified annual actuals may enter the comparison order. Source-labelled estimates remain context or gaps.

### Physical climate

The comparison explores the World Bank Climate Change Knowledge Portal CMIP6 country-area median temperature anomaly for 2040–2059 relative to 1995–2014 under SSP2-4.5. Color and subtle country-tile relief redundantly encode that same modeled warming median on a linear scale. Height is not vulnerability, damage, or responsibility.

The public fact carries the multi-model p10–p90 range. SSP1-2.6 and SSP5-8.5 medians appear in the analyst detail. The related precipitation anomaly remains context.

The four headline comparison gaps are `ATA`, `ESH`, `FLK`, and `SGS`. Global CCKP rasters cover the required variables and periods, so these are unresolved acquisition/identity cases rather than proven missing climate fields. Antarctica is conditionally fillable after a reviewed geographic polygon and complete model-first aggregation. Western Sahara, Falkland Islands (Malvinas), and South Georgia and the South Sandwich Islands stay explicit gaps until a release-level disputed/NDLSA and multipart-territory boundary policy is approved. Grid-cell percentile rasters cannot be spatially averaged and relabelled as country-level ensemble percentiles; country means must be calculated per model before the cross-model p10/median/p90.

Observed temperature uses the World Bank CCKP's official `api/v1` global-country ERA5 annual aggregate. The exact-checksummed source response contains 246 country/area series for 1950–2025. The compiler selects 1970–2025, retains the 56 annual values for the public chart, and derives an ordinary-least-squares slope in °C per decade. The two fitted endpoints are compiled with the metric; browser code only renders them.

The upstream identity ledger maps 245 series to registry entities and records CCKP's `KSV` Kosovo series as the sole non-ISO exception. `ATA`, `ESH`, `FLK`, and `SGS` remain explicit observed-temperature gaps. No boundary overlay or parent-country imputation is performed because CCKP supplies the country aggregates. ERA5 is labeled as reanalysis rather than direct station observation, values retain the API's two-decimal precision, and observed precipitation remains unavailable in this temperature-only refresh.

## Source contract

| Role | Reviewed v1 component |
|---|---|
| Core carbon | Global Carbon Budget 2025 v1.0, including separate national fossil and land-use workbooks |
| Population denominator | UN World Population Prospects 2024, exact 2024 Medium projection only |
| Independent GHG context | Climate TRACE v5.9.0 annual 2024 country snapshot, forestry/LULUCF excluded, IPCC AR6 GWP100 |
| Power | Ember Yearly Electricity Data, exact 2019 and 2024 annual rows under Ember's published taxonomy |
| Projected physical climate | World Bank CCKP CMIP6 country aggregates |
| Observed physical climate | World Bank CCKP ERA5 annual country temperature aggregates; exact 1950–2025 snapshot, with 1970–2025 series and OLS trend retained |
| Official context | Existing UNFCCC document title, submission date, and direct-link metadata only |

Every value-contributing component requires a reviewed licence, attribution, field permitlist, exact retrieval receipt/checksum, external raw-storage decision, normalized-value redistribution approval, and versioned source ID. The GCB and refreshed ERA5 temperature inputs have pinned raw receipts; the ERA5 normalized snapshot and complete upstream disposition ledger are also pinned. WPP, Climate TRACE, Ember, and CCKP CMIP6 remain candidate-only pending retained raw-receipt revalidation; Climate TRACE external-data exceptions and the CCKP/CMIP6 derivative licence chain also require release-specific rights review. All optional components, including ERA5, still require independent scientific review before production promotion. Browser code calls no source API and uses no API key.

PRIMAP-hist v2.7 is not acquired or ingested. The reviewed v2.6.1 artifact contributes no value and appears only in detailed citation provenance.

## Metric record

Each record carries:

```text
metric ID
value and unit
period
actual | estimated | modeled status
scope object and SHA-256 scope fingerprint
uncertainty object
fact IDs and source IDs
review state
transformation
explicit gap reason when value is null
```

Stable comparison IDs include `emissions.fossil_co2.territorial`, `electricity.clean_share`, and `climate.temperature.change`.

## Permitted derivations

Only these v1 derivations are allowed:

```text
territorial per capita = MtCO₂ × 1,000,000 ÷ WPP 2024 Medium population projection
five-year power change = clean share 2024 − clean share 2019
land-use central value = mean(BLUE model mean, OSCAR model mean, LUCE model mean)
land-use uncertainty = population standard deviation of the three model means
observed trend = OLS slope over annual country aggregates × 10 years
```

All numeric outputs are rounded to six decimal places after the stated calculation. Negative land-use values remain removals.

## Scope and comparison rule

A numerical source delta is allowed only when metric, accounting frame, gases, sectors, geography, LULUCF treatment, GWP, unit, and period all match exactly. The scope fingerprint is evidence for the complete scope object, not permission to compare two different metric IDs.

GCB territorial fossil CO₂ and Climate TRACE economy-wide GHG do not match. They are displayed side by side with a non-comparability note; no disagreement percentage is calculated.

## Ordering and gaps

Each lens declares one metric, period, evidence class, and descending order. Only records matching all four enter the numbered rail. All other registry entities remain below it, searchable and unnumbered, with an explicit reason.

Candidate coverage is:

| Lens | Comparable records | Explicit gaps |
|---|---:|---:|
| Carbon | 213 | 36 |
| Power | 195 | 54 |
| Physical | 245 | 4 |

These counts are recomputed from country records during validation; the runtime cannot substitute the retired PRIMAP coverage constants.

## Evidence presentation

Tooltips always state metric, value, unit, period, and evidence class. Country cards show plain-language facts first. “Methods & sources” expands definitions, uncertainty, scope fingerprint, transformation, release/checksum, source links, citation-only provenance, official metadata, and gap reasons.

At-a-glance facts are removed from the expanded lens grid so a metric card appears only once. For Physical records with observed-temperature coverage, a separate chart shows the annual 1970–2025 ERA5 series as a solid line and the compiled OLS fit as a dashed line. Its table exposes every annual value to keyboard and assistive-technology users.

Headings are metric-first. Provider logos and repeated provider names are not used as the visual hierarchy. Evidence remains accessible by compact attribution links and the methods drawer.

The body-level fallback exposes the same 249 records, current lens, comparison partition, card facts, and explicit gaps when WebGL is unavailable or when the user opens the evidence browser. Color is never the sole status cue.

## Candidate boundary and promotion

The checked-in artifact is a candidate with `production_runtime_release=false`. The previous factual runtime remains staged for rollback. Promotion requires all of the following:

1. source licences, permitlists, external raw receipts, and checksums independently revalidated;
2. core-carbon and optional-component scientific review;
3. schema, compiler, derivation, coverage, and exact-runtime checks;
4. visual, keyboard, screen-reader, narrow-screen, WebGL, and fallback review;
5. atomic service-worker staging and rollback verification;
6. protected-file reviewer approval.

The recovery receipt for this candidate is documented in `data/climate/releases/country-climate-intelligence-v1/source-receipts.json`. It does not replace the remaining independent production review.
