# Country Emissions Evidence — CT-10

## Release boundary

This mission prepares one harmonized annual series: territorial fossil CO2 from
Global Carbon Budget 2025 v1.0. It does not publish economy-wide GHG or LULUCF
and it does not normalize UNFCCC inventory submissions.

The GCB series includes fossil-fuel combustion and oxidation, carbonate
decomposition in industrial processes, cement production, and cement
carbonation uptake as a sink in `E_FOS`. National values exclude international
aviation and maritime bunker fuels. The source workbook is in MtC/yr; the
compiler publishes MtCO2/yr using the source-stated factor `3.664`.

Country-year uncertainty intervals are not present in the national workbook.
Every observation therefore carries
`uncertainty.status=not_provided_at_country_year_level`. The global GCB
uncertainty range is not copied onto countries.

## Evidence planes

- `fossil-co2-territorial.json` is harmonized evidence.
- `official-inventory-manifest.json` is a metadata-only official-plane gate.
- No value is averaged, preferred, or reconciled across those planes.

The official plane remains empty until normalized fact extraction and
redistribution rights for the selected UNFCCC interface are approved.

## Identity rule

The compiler preserves GCB source labels and creates only a source-local ID.
It does not infer ISO or M49 codes. Every `canonical_country_id` remains null
and every `identity_link_status` remains `not_reviewed` until a separately
licensed registry and reviewed crosswalk are available. GCB aggregate columns
such as World, bunker fuels, and statistical difference are excluded from the
country-series artifact and listed in the anomaly report.

## Exact source gate

The required object is
`National_Fossil_Carbon_Emissions_2025_v1.0.xlsx`, 755,198 bytes, SHA-256
`968097cacb1a6a5bfa0cf74ee90763f74a90ef10499e060ab43d1a74c671d46b`.
Its ICOS landing page requires a person to accept CC BY 4.0 download terms.
Automation must not accept those terms for a user.

On 2026-07-15 the direct GCB website download returned a different 739,007-byte
workbook with SHA-256
`a0edc6560fb0c0d974eff994b146ad1be87c79f158831732692c688a46ec55c0`.
That file was excluded because it does not match the v1.0 ICOS object and its
internal modification date predates v1.0 publication. No rows from it are
committed or labelled as v1.0.

Until the exact object is supplied, the committed artifact is deliberately
empty with `release_status=blocked_source_unavailable`. Missing source data is
not represented as zero.

## Reproduction

After an authorized person downloads the exact workbook to external storage:

```sh
node tools/acquire-gcb-2025.js --verify /absolute/path/to/National_Fossil_Carbon_Emissions_2025_v1.0.xlsx
node tools/compile-gcb-emissions.js --input /absolute/path/to/National_Fossil_Carbon_Emissions_2025_v1.0.xlsx
node tools/check-country-emissions-evidence.js --dir "$tmpdir"
```

The compiler uses only Node built-ins and the system `unzip` command. Raw
third-party workbooks are never committed.

Fixture validation is deterministic and does not claim source coverage:

```sh
tmpdir="$(mktemp -d)"
node tools/compile-gcb-emissions.js \
  --fixture data/climate/fixtures/gcb-territorial-input.json \
  --output-dir "$tmpdir"
node tools/check-country-emissions-evidence.js
```
