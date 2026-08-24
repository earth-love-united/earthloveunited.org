# Country Climate Intelligence v1 source-rigor audit

**Audit date:** 2026-08-24

**Candidate runtime SHA-256:** `9af7122f02e09b10af7add4ed75a61453d0bd4573ed6bad090561723608d0d7a`

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

## Open production blockers

1. Independently retain and revalidate exact external raw acquisition receipts and checksums for WPP, Climate TRACE, Ember, and CCKP.
2. Complete release-specific redistribution review for Climate TRACE fields that may originate in listed external datasets.
3. Complete release-specific review of the World Bank CCKP and underlying CMIP6 derivative-licence chain.
4. Complete independent scientific review of core-carbon mappings and derivations, plus the optional source taxonomies and selections.
5. Obtain the required protected-file and final production approvals.

Until these are complete, `raw_receipt_revalidation`, `redistribution_rights_revalidation`, `independent_scientific_review`, and `production_runtime_release` remain false.

## Authoritative references used by the audit

- [Global Carbon Budget 2025 ICOS collection](https://meta.icos-cp.eu/collections/AxnIW-ydMBT4BdKjxV63DGQl)
- [UN World Population Prospects 2024 portal](https://www.un.org/development/desa/pd/world-population-prospects-2024) and [methodology report](https://population.un.org/wpp/assets/Files/WPP2024_Methodology-Report_Final.pdf)
- [Climate TRACE data guide](https://climatetrace.org/data) and [terms](https://climatetrace.org/terms)
- [World Bank CCKP metadata](https://climateknowledgeportal.worldbank.org/index.php/metadata) and [CMIP6 collection documentation](https://worldbank.github.io/climateknowledgeportal/docs/collections/cmip6-x0.25.html)

## Audit boundary

This audit did not acquire replacement source files, infer missing country data, reinterpret published aggregate taxonomies, or authorize redistribution. Formal release gates remain controlled by `data/climate/releases/country-climate-intelligence-v1/release-manifest.json`.
