# CT-20 Target Comparability Engine

**Status:** offline contract and calculation engine; no runtime UI integration

**Engine version:** 1.0.0

**Methodology dependency:** 0.1.0

## Purpose and boundary

CT-20 verifies whether a CT-02 target record can lawfully produce a normalized
absolute endpoint. It preserves the native target type, condition, accounting
frame, uncertainty, evidence inputs, and review lineage. It never calculates
delivery, performance, ambition, a gap, or an “on track” status.

The implementation is a pure CommonJS library using only JavaScript built-ins:
`tools/lib/target-comparability.js`. It reads no files or clock, mutates no
input, has no network access, and produces the same result regardless of fact
order. It is intentionally not loaded by `index.html` or `gaia.html`.

## Frozen output contract

`data/climate/schemas/target-comparability-result.schema.json` freezes these
top-level fields:

```text
engine_version                 target_type
methodology_version            condition
target_id / country_id         comparability / eligible / reason_codes
normalized_endpoint            accounting_frame / uncertainty
input_fact_ids / lineage       independent_review
```

`normalized_endpoint` is `null` unless structural comparability, approved
licensing, and independent review all pass. An endpoint value is either:

```text
{ kind: "exact", amount, unit }
{ kind: "range", lower, upper, unit }
```

A range is not collapsed to its midpoint. If its relative half-width exceeds
the configured threshold (50% by default), public eligibility is withheld with
`uncertainty_too_large`. The result includes the complete target accounting
frame: frame, gases, sectors, geography, LULUCF, GWP convention, and Article 6
treatment.

## Gates

The default API is `assessTarget(target, evidence, options)`. `evidence` has an
explicit `licence_approved` boolean and a `facts` array. Facts may use the
CT-02 observation shape or the equivalent compact shape used by fixtures.

The public/default path requires:

- active target status and explicit conditionality;
- complete target scope and accounting choices;
- only explicitly referenced evidence facts;
- exact year, unit, gas, GWP, sector, geography, and LULUCF compatibility;
- approved source licence; and
- a completed review whose reviewer differs from the extractor.

The caller may disable licence/review gates only for an internal structural
diagnostic. Such diagnostics are not release results.

Input `target.comparability` is not trusted. The engine independently derives
its result, which prevents an extractor from self-approving a target by setting
that field to `comparable`.

## Target-type decisions

| Native type | Normalization rule | Deliberate non-comparability |
|---|---|---|
| Base year | Matched reference fact × stated reduction | No first observation or current-emissions proxy |
| BAU | Published target-year scenario fact × stated reduction | No current-emissions proxy; scenario and vintage required |
| Intensity | Matched reference intensity × stated reduction × named target-year denominator | Exact denominator metric, year, and unit algebra required |
| Fixed level | Preserve stated absolute value | Missing value or target year |
| Trajectory | Preserve final supplied, stated official pathway fact | No interpolation, observation claim, or invented linear decline |
| Peaking | Preserve peak-year indicator only | No absolute endpoint; `partially_comparable` when the indicator is complete |
| Sectoral | Preserve as sectoral | Never create an economy-wide gap |
| Qualitative | Preserve as qualitative | Never quantify statement text |
| Net zero | Preserve stated residual endpoint and removals/offset rules | Never infer a gross-emissions pathway from “net zero” alone |

Conditional, unconditional, and combined endpoints remain distinct. A
`not_stated` condition is not silently interpreted. Article 6 treatment is
mandatory, and LULUCF-inclusive evidence must match the target scope exactly;
high uncertainty is retained rather than hidden.

## Canonical failures

The engine embeds all 55 CT-02 reason codes in their canonical order. The test
runner proves exact equality with `data/climate/schemas/enums.json`; it cannot
emit an ad hoc error code. Missing target is `no_active_target_found` with
`target_not_found`, never “No target.” Licence and independent-review gates by
themselves return `not_assessed`; structural failures return
`non_comparable`. Sectoral and qualitative records return
`qualitative_or_sectoral`.

`target_expired` is reserved for expired, withdrawn, and superseded records.
Because the CT-02 vocabulary has no more specific codes for those inactive
states, they share that code. A `not_reviewed` status instead returns
`climate_evidence_not_reviewed` and `source_not_reviewed`; it is never
mislabelled as expiry. Sectoral and qualitative results retain their categorical
status while also carrying all applicable licence, review, conditionality, and
scope reasons.

## Fixtures and deterministic verification

`data/climate/fixtures/target-comparability.json` contains 51 fictional golden
cases. Ten are valid comparable endpoint cases; 41 are deliberately withheld
or non-comparable invalid cases. They cover all nine target types, exact zero,
ranges, LULUCF-heavy uncertainty, all scope mismatch families, Article 6,
three conditions, missing inputs, self-review, CT-03 high-impact visual cases,
and CT-11 China, India, Indonesia, and Iran evidence shapes.
Declared reference or endpoint quantities that disagree with the referenced
fact or deterministic formula fail with `unresolved_source_conflict`.

Run:

```sh
node tools/check-target-comparability.js
```

The checker reverses every case's fact order and requires byte-equivalent data
structures, verifies all 55 reason codes, checks formulas and units through
golden endpoint values, proves ineligible results cannot leak endpoints, and
recursively rejects any delivery or performance field.
