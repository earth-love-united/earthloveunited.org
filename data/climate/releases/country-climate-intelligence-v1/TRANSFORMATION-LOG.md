# Country Climate Intelligence v1 — transformation log

Release: `country-climate-intelligence-2026-08-24-candidate.1`

Status: normalized factual candidate pending source revalidation. This is not a production promotion receipt. Independent scientific review, external raw-receipt revalidation, and release-specific redistribution-rights review remain open.

## Reproducibility boundary

- Raw third-party files stay outside the repository.
- The repository stores exact source/component receipts, reviewed normalized country facts, explicit gap records, transformation code, and the compact runtime.
- The browser runtime uses recursively key-sorted, newline-terminated compact JSON. Human-review component artifacts remain indented; formatting never changes values or ordering.
- Every compiler starts from the 249-entry country registry. A source row must map once or receive one enumerated aggregate, territory, or unmapped exception. Missing data is never converted to zero and a territory never inherits its parent country's value.
- The reviewed normalized facts were recovered byte-for-byte from candidate SHA-256 `436db7290378d9d9f1a1f59f83d2cb219638ac490f5f7f3dccffc8fe203bde09` after an uncommitted temporary worktree was purged. The five component artifacts record that recovery and are now the deterministic assembly inputs.

## Carbon

- Territorial fossil CO₂: GCB source MtC multiplied by 3.664; 2024 is the comparison record; 1990–2024 remains a source series.
- Cumulative fossil CO₂: sum of available 1850–2024 territorial MtC values, then multiplied by 3.664.
- Consumption emissions and net transfers: latest published source value, kept in their own accounting frames. Net transfer follows GCB's territorial-minus-consumption convention; positive means net exported embodied emissions.
- Land-use CO₂: calculate each model's 2015–2024 arithmetic mean for BLUE, OSCAR, and LUCE; the central value is the arithmetic mean of those three model means; uncertainty is their population standard deviation. Negative values remain removals.
- Per capita: `territorial MtCO₂ × 1,000,000 ÷ year-matched WPP 2024 Medium population projection`. No different year or variant is substituted. The denominator and derived result are labeled modeled rather than actual or estimated.
- Climate TRACE: sum explicit 2024 annual country/gas/sector tonnes after excluding forestry and land use; convert tonnes to megatonnes; retain AR6 GWP100, gas, sector, estimate, and uncertainty-availability context. This independent GHG scope is shown beside—not subtracted from or compared by percentage with—GCB fossil CO₂.

## Power

- Select exact 2024 annual actuals under Ember's published clean, fossil, wind-and-solar, intensity, and power-emissions taxonomy.
- Five-year change is `clean share 2024 − clean share 2019`, reported in percentage points.
- Source-labelled estimates cannot enter the 2024 clean-share order.

## Physical climate

- Projected temperature and precipitation use country-area CMIP6 anomalies for 2040–2059 relative to 1995–2014.
- The public comparison is SSP2-4.5 median with p10–p90. SSP1-2.6 and SSP5-8.5 medians remain analyst context.
- ERA5 observed trends use ordinary least squares over annual country aggregates from 1970 through the snapshot's last complete year and are reported per decade.
- The v1 ERA5 acquisition response was empty. All 249 observed-trend records therefore carry the reviewed `source_snapshot_empty` gap; no values are inferred.

## Public boundaries

- No composite score, target assessment, finance judgment, performance label, offset adjustment, or mismatched-scope source delta is produced.
- PRIMAP v2.7 is not acquired or ingested. The reviewed v2.6.1 release is retained only as detailed citation provenance and contributes no runtime value.
- UNFCCC titles, submission dates, and direct links are metadata only.
