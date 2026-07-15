# Country climate evidence contracts

This directory is the offline evidence boundary for the Country Climate
Profile. It does not change the live globe or replace `data/pledge-nodes.json`.

## Publishable identity seed

`country-registry.json` is a separately identifiable LGPL-derived identity
asset built from the pinned Debian `iso-codes` 4.20.1-1 file
`data/iso_3166-1.json`. It carries all 249 source rows.

This is **ISO 3166-1-compatible data sourced from Debian**. It is not an
official ISO publication, an official United Nations dataset, or evidence of a
country's political status. ISO and the United Nations remain normative
authorities for their own standards; Debian is the redistribution source for
this copy.

CT-01 records source `debian-iso-codes-4.20.1-1-iso-3166-1` as approved for
normalized redistribution under `LGPL-2.1-or-later`, subject to the recorded
notice, licence-copy, source-access, modification-marking, and separability
obligations. This project decision is not a general legal opinion.

The identity asset includes:

- source version, retrieval URL/date, source and normalized checksums;
- licence, attribution, warranty, and CT-01 review metadata;
- a complete transformation log and preferred-form source URL;
- [IDENTITY-NOTICE.md](IDENTITY-NOTICE.md) and
  [LGPL-2.1.txt](LGPL-2.1.txt);
- the exact transformation tool at `tools/build-country-registry.js`.

## Fail-closed overlays

The Debian artifact does not establish UN membership, UNFCCC Party status,
LDC/LLDC/SIDS status, territory relationships, region assignment, geometry, or
climate-assessment eligibility. Every one of the 249 entries therefore carries
explicit `null` and `not_reviewed` records for those fields.

Nothing is silently dropped. In particular, a future comparison universe must
set `assessment_eligibility` for every row with an attributed decision and
reason. The identity asset can be redistributed, but no row may enter a public
climate assessment until the separate overlay gate passes.

## Rebuild and gates

Download the pinned preferred-form source and rebuild:

```sh
node tools/build-country-registry.js /path/to/iso_3166-1.json 2026-07-15
node tools/check-country-evidence.js --source /path/to/iso_3166-1.json
```

The builder refuses any source whose SHA-256 is not
`f01b812b57fba9f31ff621bf33e7c7570a01964dbeb5be2167e94decf538c89f`
or whose `3166-1` array does not contain exactly 249 unique code records.

The identity redistribution gate passes:

```sh
node tools/check-country-evidence.js --require-release-eligible
```

The climate-assessment overlay gate intentionally fails until those facts are
separately sourced and reviewed:

```sh
node tools/check-country-evidence.js --require-assessment-overlays
```

## Evidence contracts

- `schemas/observation.schema.json` defines attributed raw, estimated,
  modeled, independent, and derived facts. A derived or modeled fact must list
  input fact IDs, transformation, formula and methodology versions,
  calculation time, and calculation hash.
- `schemas/target.schema.json` preserves native target types. BAU and intensity
  targets cannot become comparable without their actual scenario or
  denominator evidence.
- `schemas/profile.schema.json` keeps the six public axes separate and has no
  composite score.
- `schemas/release.schema.json` describes immutable release artifacts,
  coverage, checksums, and independent review.
- `schemas/enums.json` is the canonical evidence and reason vocabulary.

The schemas use JSON Schema 2020-12. The validator implements the required
subset using Node.js built-ins, with no npm dependency or browser build step.

Valid fixtures distinguish real `0` and `false` values from missing `null`
evidence. Invalid fixtures prove that schema, lineage, target-type,
independent-plane, identity, and release-gate violations fail closed.

## CT-10C factual-display promotion

`releases/primap-hist-2.6.1-factual-display-2026-07-15.json` is a narrow,
deterministic promotion of the CT-10B PRIMAP batch after its exact input bytes
were independently attested. It permits only attributed factual emissions
display, time-series display, and descriptive comparison/ranking by the 2023
value of this one harmonized metric. Such a magnitude ranking is not a target,
delivery, performance, impact-band, composite-score, or normative climate-score
judgment.

The promotion has not been loaded by the site. Its own independent review and
the CT-40 runtime release gate remain required, so
`production_runtime_release` is explicitly false. Verify the deterministic
artifact and nine fail-closed mutations—including rejection of the superseded
CT-10B-R attestation pin—with:

```sh
node tools/check-primap-factual-display-promotion.js
```

The independent CT-10C review is recorded in
`reviews/primap-hist-2.6.1-factual-display-ct10c-review.json`. It pins the
corrected CT-10B attestation and the complete CT-10C artifact, validates the
schema, reconstructs all fields without importing the promotion builder, and
compares the result byte-for-byte. Re-run the raw-source prerequisite, review,
and 14 adversarial denial checks with:

```sh
node tools/check-primap-factual-display-review.js /path/to/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv
```

This review approves only the pinned harmonized facts for descriptive display
and same-metric 2023 emissions-magnitude comparison or ranking. It does not
approve target, commitment, delivery, performance, impact-band, composite,
normative-score, or production-runtime use. CT-40 remains required before any
site integration.
