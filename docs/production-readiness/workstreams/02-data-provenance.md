# Workstream 02 — Data Provenance and Validity

## Outcome

Runtime data is valid, licensed, reproducible, and represented to users at its actual readiness level.

## Current evidence

`data/events-core.csv` contains 5,000 records, with 4,450 invalid longitudes, 114 records beginning after the assessment date, and no populated source links. The UI describes this as a 30-year historical dataset. `data/provenance-registry.json` identifies relevant runtime material as review-stage/demo, but that status is not shown at point of use.

## Packets

### DAT-001 — Contain invalid event presentation

- `BLOCKER` · `D1 Easy` · `DESIGN`
- Present the product owner with measured invalidity and the reversible choices: hide the layer, label the full layer explicitly as synthetic/demo, or publish only a separately verified subset. Record the selected treatment before editing the runtime.
- Acceptance: users cannot reasonably infer that invalid/demo records are verified history.

### DAT-100 — Define dataset acceptance policy

- `BLOCKER` · `D3 Hard` · `STUDY`
- Decide required schema, geographic bounds, time rules, source-link requirements, transformation documentation, checksum policy, readiness states, and who may promote data from demo to reviewed.
- Include failure behavior: the runtime must fail closed or disclose degraded data, not silently continue as verified.

### DAT-200 — Rebuild the event dataset

- `BLOCKER` · `D3 Hard` · `DESIGN`; depends on DAT-100 and LIC-100.
- Choose one: replace from an approved source, repair from a reproducible transform, or permanently frame it as synthetic demonstration data.
- Acceptance: all published rows satisfy policy and can be traced to source and transform version.

### DAT-300 — Automated data gates

- `HIGH` · `D3 Hard` · `DESIGN`; depends on DAT-200.
- Validate schema, latitude/longitude, start/end ordering, future dates, URLs, uniqueness, checksums, provenance status, and license metadata in CI.
- Acceptance: a deliberately corrupted fixture makes CI fail with a useful row-level message.

### DAT-400 — Claim lineage report

- `MEDIUM` · `D4 Program` · `DESIGN`.
- Generate a human-readable map from source → transform → artifact checksum → public claim/surface.

## Verification gates

- Test boundary coordinates and malformed dates.
- Compare source row counts, output row counts, and rejected-row reports.
- Load the site with each dataset absent or invalid and verify honest fallback behavior.
