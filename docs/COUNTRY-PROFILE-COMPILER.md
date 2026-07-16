# CT-22 Country Profile Compiler

Status: contract implementation with fictional fixtures only. It publishes no
real country performance values.

## Purpose

`tools/lib/country-profile-compiler.js` joins independently reviewed results
into a six-axis country profile:

1. impact
2. target integrity
3. ambition
4. delivery
5. fair contribution
6. evidence quality

The axes remain separate. The compiler does not calculate or expose a
composite score, rank, average, or favorable default. In particular, a country
without a comparable commitment is labelled `without_comparable_target` (or
`high_impact_without_comparable_target`); the absence of a commitment can
never produce `core_axes_available`.

## Inputs and dependency boundary

CT-22 is dependency-free and does no I/O. Callers supply `generated_at`; the
compiler never reads the clock. The timestamp and every independent review
timestamp must be a valid UTC timestamp ending in `Z`.

The target-integrity input consumes the frozen CT-20 output shape from commit
`46f0d52`. The delivery input consumes the CT-21 result shape and its separate
assessment-basis vocabulary from commit `6f6e9ce`. Those implementations are
not copied into this branch and their Git histories are not included.

Every input that would produce an assessed public axis must include:

- an explicit eligible status;
- an extractor and a different reviewer;
- `reviewed` and `passed: true` review state;
- a valid UTC review timestamp;
- a method identifier and methodology version;
- fact IDs and lineage where the upstream result supplies them.

Target integrity accepts reviewed negative findings such as
`no_active_target_found` and `non_comparable`. It does not reinterpret those
findings as successful target performance. Delivery additionally requires the
CT-21 formula version, methodology version, and lineage.

## Output envelope

The compiler returns:

```text
schema_version
profile_id
country_id
data_release_id
compiler_version
methodology_versions
generated_at
headline
  status
  classification
  evidence_reason_codes
  fact_ids
  axis_availability
axes
  impact
  target_integrity
  ambition
  delivery
  fair_contribution
  evidence_quality
calculation_hash
```

Each axis contains its status, availability, canonical CT-02 evidence reasons,
separate CT-21 assessment-basis codes, fact IDs, method ID, methodology
version, optional value, and lineage. The exact envelope is defined by
`data/climate/schemas/compiled-profile.schema.json`.

`toCt02Profile()` produces a compatibility projection that validates against
the existing `data/climate/schemas/profile.schema.json`. It intentionally
omits CT-22-only lineage and availability fields. An available CT-22 headline
is projected to `not_assessed` under CT-02 when ambition or delivery is absent,
preserving CT-02's stricter public availability gate.

## Fail-closed rules

- `licence_not_approved`, `value_withheld`, or an explicit withheld state makes
  the axis and headline `withheld`. This check runs before headline classes.
- Missing, conflicting, ineligible, or unreviewed evidence becomes
  `not_assessed` with reasons.
- Evidence quality retains the CT-02 `A`/`B`/`C`/`D` contract. A missing or
  blocked evidence-quality input becomes grade `D`, has non-available
  availability, and carries an explicit fail-closed reason.
- A numeric zero is preserved. A null impact value is not treated as zero and
  becomes `not_assessed` with `value_not_reported`.
- Ambition and fair contribution remain `not_assessed` unless a caller supplies
  an explicitly eligible, independently reviewed methodology result. Fair
  contribution remains `context_only`; CT-22 invents no equity judgment.
- Unknown evidence or delivery-basis codes throw instead of silently entering
  the public contract.

## Determinism and verification

The SHA-256 `calculation_hash` covers the stable, key-sorted output with its
hash field set to null. Identical inputs produce identical bytes and hashes.

Run:

```bash
node tools/check-country-profile-compiler.js
node tools/check-country-evidence.js
```

The CT-22 checker validates both schemas, exact CT-02 and CT-21 vocabularies,
ten fictional golden cases, the frozen deterministic hash, missing-commitment
headline behavior, zero/null behavior, and malformed/unknown input gates.
