# CT-32 Country Card and Chart Evidence Model

Status: pure contract compiler with fictional fixtures. No DOM, globe, or live
country data is integrated by this mission.

## Purpose

`tools/lib/country-card-evidence-model.js` converts reviewed CT-22 profile
axes and their chart evidence into a deterministic payload for a future country
card renderer. It is intentionally separate from the CT-30 presentation
adapter and does not change `index.html`, `js/globe.js`, or any CSS.

The compiler was reconciled against the CT-22 contract at commit `2acd08b`.
It consumes the six axes but never combines them into a score. Its stable card
section order is:

1. responsibility
2. commitment
3. ambition
4. delivery
5. evidence
6. projects and markets

Fair-contribution facts remain in the CT-22 profile and provenance fact set;
CT-32 does not invent a card judgment for them. A later UX decision can add a
fairness-context section without changing the evidence chart boundary.

## Chart evidence boundary

The chart has four distinct layers:

- `measured_series` accepts only explicitly observational annual series from
  official or harmonized planes. Each numeric point preserves its real year,
  unit, scope, fact ID, source IDs, review date, and uncertainty. Zero remains
  zero; null is not accepted as a measured number.
- `comparable_target_endpoints` accepts only eligible, independently reviewed
  CT-20 comparable endpoints. Conditional, unconditional, and combined cases
  remain separate records.
- `illustrative_required_path` can only be copied from CT-21, must declare
  `data_role: illustrative_required_path` and `is_observation: false`, must have
  CT-21 lineage, and must match a comparable endpoint's year, unit, and value.
  Non-comparable targets therefore receive no path.
- `scenario_projections` must declare `scenario_projection_only` and
  `is_observation: false`. Their points are never appended to measured series.

The compiler rejects attempts to pass a projection, required path, project
outcome, market credit, generic synthetic series, or synthetic point through
the measured-observation input. Projects and markets are always emitted in a
separate section with:

```text
Not part of the national climate performance profile
affects_profile: false
```

## Conflicts and missing evidence

Official and harmonized values with the same metric, scope, unit, and year are
kept as separate series. If their values differ, the output adds an
`unresolved_source_conflict` record containing both planes, values, and fact
IDs. It does not choose or average a winner.

Missing observation or target arrays produce empty chart layers and null
latest evidence. A non-comparable target result remains visible through the
commitment axis status and reasons but cannot create an endpoint or pathway.

## Accessibility and provenance

Every payload contains an accessible chart title, description, and text
summary that counts measured series, comparable endpoints, illustrative paths,
scenario projections, and conflicts. Renderers can expose this text without
deriving claims from pixel position or color.

Top-level provenance collects source IDs, fact IDs, UTC review dates, and the
CT-22 profile calculation hash. The caller supplies `generated_at`; both it and
review timestamps must be valid UTC timestamps ending in `Z`.

The output SHA-256 is calculated over a recursively key-sorted payload with the
hash field set to null. Identical inputs therefore produce identical output.

## Verification

Run:

```bash
node tools/check-country-card-evidence-model.js
node tools/check-country-view-model.js
```

The CT-32 checker validates the JSON schema and fictional cases for measured
observations with a target/path, non-comparable and missing evidence, conflicting
planes, distinct conditional cases, projection separation, numeric zero,
synthetic/project smuggling rejection, accessible copy, and deterministic
hashes.
