# Country Climate Delivery Engine — CT-21

**Formula version:** 1.0.0

**Methodology version:** 0.1.0

**Status:** Pure engine and fictional fixtures; no production country results

## Boundary

The delivery engine compares evidence; it does not predict whether a country
will meet a target. It produces only `ahead`, `on_pace`, `uncertain`,
`off_course`, or `not_assessed` and preserves the measured-pace and
policy-projection tests separately.

The engine has no browser, package, network, or runtime UI dependency. It does
not read production files and it does not mutate inputs. Every assessed result
contains its formula version, methodology version, fact IDs, evidence planes,
parameters, formulas, deterministic calculation hash, and caller-supplied
calculation time.

## Accepted evidence roles

### Observed annual series

`observed_series.data_role` must be `observed_annual`. Every point is treated as
measured or estimated annual evidence and can carry a bounded uncertainty
interval. A series or point labelled as a scenario projection is rejected; a
projection can never enter the trend estimator by changing its container.

The engine assesses exactly one observed evidence plane at a time. It never
averages official and harmonized series. An unresolved cross-plane conflict
returns `not_assessed` with `unresolved_source_conflict`.

### Comparable target endpoint

The endpoint must be the frozen CT-20 result shape with `eligible=true`,
`comparability=comparable`, `independent_review.status=reviewed`, and a
non-null `normalized_endpoint`. The normalized value must be either
`{kind: exact, amount, unit}` or `{kind: range, lower, upper, unit}`. The
engine does not derive, repair, or invent target endpoints. It requires the
CT-20 target year, accounting frame, input fact IDs, and formula lineage.
The complete CT-20 object is copied unchanged into delivery lineage and its
lineage object receives a deterministic SHA-256 hash.

### Policy projection

A projection must use CT-12's `scenario_projection_only` role. It remains a
named, vintage-specific, plane-specific scenario. Only its exact target-year
point is compared with the endpoint. Projection points are never appended to
the observations or used in the trend.

## Recent measured trend

The robust recent window is deterministic:

1. sort unique observed points by year;
2. take the contiguous annual run ending at the latest observation;
3. retain at most the most recent ten points;
4. require at least six points (a minimum five-year span);
5. calculate every pairwise annual slope and take the Theil–Sen median.

Gaps before the selected recent run do not matter. A gap that leaves fewer than
six contiguous recent observations returns `observed_series_incomplete`.

For a strictly positive series and endpoint, the transform is logarithmic:

```text
observed_rate = exp(median((ln(y_j) - ln(y_i)) / (year_j - year_i))) - 1
```

For LULUCF, a real zero, or any non-positive bound, the rate is additive:

```text
observed_change = median((y_j - y_i) / (year_j - year_i))
```

This avoids taking a logarithm of zero and avoids assigning a misleading
percentage change to a net LULUCF series that crosses zero. Negative LULUCF is
preserved; it is not clamped to zero.

## Uncertainty interval

For every point pair, the engine computes a conservative fast and slow slope
from the point bounds. The returned trend interval is the 2.5th percentile of
the fast-slope envelope through the 97.5th percentile of the slow-slope
envelope. This is a deterministic robustness interval, not a claim of a
frequentist confidence interval. When the source supplies no uncertainty, the
point's lower, central, and upper values are identical.

Target endpoint uncertainty and latest-observation uncertainty are propagated
through every endpoint combination. No central value overrides a material
interval overlap.

## Required pace

For strictly positive quantities:

```text
required_rate =
  (target_emissions / latest_emissions) ^
  (1 / (target_year - latest_year)) - 1
```

For additive or zero-crossing quantities:

```text
required_change =
  (target_emissions - latest_emissions) /
  (target_year - latest_year)
```

The illustrative required path starts at the latest observation and ends at
the supplied target endpoint. It is labelled
`Illustrative required pathway`, carries `is_observation=false`, and is not a
model projection or observed fact.

## Interval classification

Lower rates mean emissions are falling faster.

- `on_pace`: the slowest bound of the observed pace is at least as fast as the
  fastest required bound.
- `off_course`: the fastest bound of the observed pace is slower than the
  slowest required bound.
- `uncertain`: the observed and required intervals overlap.
- `ahead`: the full latest level interval is at or below the endpoint **and**
  the full observed pace interval is at least as fast as required and is not
  increasing.
- `not_assessed`: target, observed series, compatibility, recency, or review
  evidence is insufficient.

Consequently, a favorable level gap alone can never yield `ahead` or
`on_pace`. The fictional `below-target-but-worsening-is-not-ahead` fixture has
an already-low level and still returns `off_course`.

## Combining projection and measured pace

The result retains both tests. When both are assessed:

- matching positive or negative signals retain the measured status;
- any positive/negative disagreement returns `uncertain` with
  `delivery_signals_disagree`;
- an uncertain test makes the combined result uncertain.

An incompatible projection is retained as a nested `policy_projection` result
with `status=not_assessed`, `eligible=false`, and its own evidence/basis codes.
It does not erase an otherwise valid measured-pace result and its mismatch
does not pollute the top-level measured assessment. It is never silently
converted into the target's scope or evidence plane.

## Fail-closed conditions and controlled reasons

Every result has two non-interchangeable arrays:

- `evidence_reason_codes` accepts only the exact 55-code CT-02 vocabulary;
- `assessment_basis_codes` accepts only CT-21's exported, closed calculation
  vocabulary.

Projection eligibility and mismatch codes remain nested under
`policy_projection`. The implementation exports both enums and the checker
rejects duplicates, unknown values, or a CT-02 evidence-vocabulary count other
than 55.

The engine preserves CT-02 reasons for scope and evidence failures:

```text
target_not_found                 target_expired
reference_value_missing          stale_source
unresolved_source_conflict       reporting_optional
independent_review_required      evidence_insufficient
scope_mismatch                   gas_basket_mismatch
gwp_mismatch                     sector_mismatch
geographic_boundary_mismatch     lulucf_mismatch
```

`country_mismatch` is a CT-21 basis rather than a CT-02 evidence reason.
CT-21 assessment basis codes are:

```text
calculation_time_missing
assessment_year_missing
country_mismatch
target_non_comparable
target_endpoint_missing
target_endpoint_invalid_range
target_endpoint_contract_invalid
observed_series_invalid
observation_fact_id_missing
observed_series_incomplete
projection_rejected_as_observation
projection_point_rejected_as_observation
unit_mismatch
observed_pace_at_least_required
target_level_already_met_and_pace_sufficient
observed_pace_slower_than_required
observed_required_intervals_overlap
projection_role_invalid
projection_target_year_missing
projection_invalid
policy_projection_meets_target
policy_projection_misses_target
projection_target_intervals_overlap
delivery_signals_disagree
```

Missing evidence, reporting flexibility, stale evidence, conflicts, a passed
target endpoint, fewer than six recent annual observations, incompatible
scope/gases/GWP/sectors/geography/LULUCF, and unit mismatch never create a
favorable status. A future target that is not yet due remains assessable when
all required evidence exists; a target at or before the latest observation is
`not_assessed` because current required pace to a past endpoint is undefined.
The canonical `reporting_not_yet_due` evidence code is used only for a source's
reporting state; the engine never infers it merely because a target year is in
the future.

## Fictional validation

Run:

```sh
node tools/check-country-delivery-engine.js
```

The suite contains 33 fictional cases. It includes the CT-03 positive-gap /
on-pace and comparable / off-course golden cases; real zero; negative LULUCF;
ranges; stale, gapped, conflicting, and optional-reporting series; passed and
future targets; every material compatibility mismatch; projection
corroboration/disagreement; projection-as-observation rejection; deterministic
hashes; formula units; and complete input lineage.
