# Legacy country data exit ledger

**Decision date:** 2026-07-15

**Historical input:** `data/pledge-nodes.json`, schema 2.0.0, generated 2025-07-18, 123 rows
**Runtime state:** retired; not fetched, cached, parsed, ranked, painted, or rendered

## Public-use prohibition

Every value in the historical payload is unverified because the file provides no field-level source citation, retrieval date, calculation lineage, review record, or licence decision. None of its fields may be used in public country cards, globe styling, rankings, scores, target comparisons, performance judgments, finance claims, or GAIA answers. A non-null value is not evidence. Empty, zero, boolean, colour, and narrative values are equally prohibited.

The file remains in the repository only as a historical audit input for this exit ledger. Its presence is not publication approval. A replacement may enter the live site only through a versioned evidence record, independent review, and an explicit release decision. Until then, the UI must show a neutral, uniform country surface and an evidence-unavailable message.

Status terms:

- **Retired / blocked:** historical field has no permitted public use.
- **Replacement pipeline pending:** a source family or derivation is identified, but no reviewed runtime release exists.
- **No direct replacement:** the field encoded presentation or an unsupported composite and must not return as source data.

## Field-level replacement ledger

| Historical field | Historical source / lineage | Required replacement | Status |
|---|---|---|---|
| `iso` | No row-level citation; described only as part of the 2025 payload | Pinned, licensed ISO-compatible identity registry with explicit geopolitical and eligibility policy | Retired / blocked; identity pipeline exists but is not released to this runtime |
| `country` | No row-level citation or naming policy | Reviewed display name from the identity registry; Natural Earth name is navigation context only | Retired / blocked; replacement pipeline pending |
| `lat` | No coordinate source or centroid method | Natural Earth polygon/label geometry at runtime; separately reviewed small-nation navigation coordinates where polygons are absent | Retired; no climate-evidence use and no direct value migration |
| `lng` | No coordinate source or centroid method | Natural Earth polygon/label geometry at runtime; separately reviewed small-nation navigation coordinates where polygons are absent | Retired; no climate-evidence use and no direct value migration |
| `fossil_co2_mt` | No year, boundary, method, source record, or citation | Reviewed, source-registry-approved harmonized evidence with year, units, boundary, transformation, checksum, and citation. A GCB fossil series may satisfy this field; PRIMAP may be shown only as explicitly labelled economy-wide GHG, never silently relabelled fossil CO₂. | Retired / blocked; replacement pipeline pending |
| `lulucf_co2_mt` | No year, sign convention, land-use boundary, method, or citation | Separately reviewed, source-registry-approved land-use evidence with sign convention and uncertainty disclosed. GCB and any future approved pathway must preserve its native scope; PRIMAP economy-wide totals are not a drop-in LULUCF series. | Retired / blocked; replacement pipeline pending |
| `total_co2_mt` | Apparent aggregate, but formula and rounding are undocumented | Deterministic, reviewed derivation from compatible fossil and land-use observations; never silently mix boundaries | Retired / blocked; derived replacement pending |
| `co2_per_capita` | Emissions year, population denominator, and formula undocumented | Deterministic derivation from a reviewed emissions observation and same-period UN WPP population evidence | Retired / blocked; derived replacement pending |
| `population` | No source, reference date, estimate variant, or citation | Reviewed UN World Population Prospects observation with year and variant | Retired / blocked; replacement pipeline pending |
| `cat_rating` | Appears related to Climate Action Tracker, but record URL, date, scope, and reuse decision are absent | Independently cited ambition assessment only after source-specific licence/reuse approval and review | Retired / blocked; CAT source decision pending |
| `cat_score` | Undocumented numeric conversion of an external rating | No source-data replacement; any future display ordering must use a published, reviewed methodology and retain the underlying label | Retired / blocked; no direct replacement |
| `globe_color` | Presentation colour with undocumented score/status mapping | View-model token derived only from reviewed evidence states; missing evidence always uses a neutral token | Retired / blocked; no direct replacement |
| `target_type` | No NDC document citation, submission date, scope, gases, sectors, or conditions | Reviewed UNFCCC NDC target record with direct document locator and full comparability metadata | Retired / blocked; replacement pipeline pending |
| `reduction_pct` | No target document citation or baseline/scope lineage | Reviewed normalized NDC target value tied to its source passage, baseline, gases, sectors, LULUCF treatment, and conditions | Retired / blocked; replacement pipeline pending |
| `reduction_pct_upper` | No explanation of range semantics or conditionality | Reviewed conditional/unconditional target component represented explicitly, never as an unexplained upper bound | Retired / blocked; replacement pipeline pending |
| `target_year` | No target document citation or version | Reviewed NDC target year tied to the exact submission and target component | Retired / blocked; replacement pipeline pending |
| `baseline_year` | No baseline definition, inventory boundary, or target citation | Reviewed NDC baseline/reference definition with year, scenario type, gases, sectors, and LULUCF treatment | Retired / blocked; replacement pipeline pending |
| `implied_target_mt` | Undocumented calculation and boundary conversion | Target-comparability engine output only when baseline, scope, units, GWP, gases, sectors, and LULUCF treatment are compatible | Retired / blocked; derived replacement pending |
| `reality_gap_mt` | Undocumented subtraction using unverified and potentially incomparable values | Delivery-engine result only after target comparability passes and observed/projection evidence is reviewed | Retired / blocked; derived replacement pending |
| `momentum_cagr` | Undocumented time window, series, formula, and rounding | Reproducible historical trend metric from a reviewed, versioned emissions series with start/end years and boundary | Retired / blocked; derived replacement pending |
| `required_cagr` | Undocumented target conversion, period, formula, and scope | Delivery-engine result from a comparable reviewed target and observation, with exact period and formula disclosed | Retired / blocked; derived replacement pending |
| `divergence` | Undocumented combination of trend and required change | No standalone source field; any future delivery comparison must expose its reviewed inputs and methodology | Retired / blocked; no direct replacement |
| `on_track` | Undocumented boolean judgment with missing values encoded inconsistently | Truth view-model state derived only from reviewed, comparable delivery evidence; otherwise `not_assessed` | Retired / blocked; no direct replacement |
| `change_since_2015` | Undocumented emissions series, boundary, formula, and year endpoint | Deterministic percent change from reviewed observations with explicit 2015 and latest-year evidence IDs | Retired / blocked; derived replacement pending |
| `finance_total_bn` | No provider/recipient perspective, currency, price basis, years, flow type, source, or citation | Reviewed UNFCCC/OECD finance evidence kept separate by direction, instrument, period, currency, and definition | Retired / blocked; source and normalization decisions pending |
| `conditionality` | No NDC document citation or component linkage | Structured conditional/unconditional target components from the reviewed UNFCCC submission | Retired / blocked; replacement pipeline pending |
| `ndc_summary` | Narrative text has no stable source URL, passage locator, language/version, retrieval date, or reuse record | Source-linked NDC metadata and a reviewed factual extraction policy; quote only within approved rights and limits | Retired / blocked; metadata discovery allowed, normalized public text pending |

## Release boundary

Replacement evidence must not be copied back into this legacy shape. The future runtime must consume the reviewed country profile/view-model contract and preserve source IDs, evidence state, reason codes, review status, and release eligibility. In particular, a missing target is not good performance, and missing evidence must never improve a country’s colour, rank, or score.

Run `node tools/verify-legacy-country-exit.js` to prove that the historical payload path and runtime aliases are absent from live HTML, JavaScript, service-worker caching, and localhost smoke tooling.
