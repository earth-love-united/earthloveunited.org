# CT-31 Deterministic Country Ranking

**Status:** Compiler and release contract complete; runtime integration deferred

`js/country-ranking-compiler.js` is the only layer permitted to assign country
ranking ordinals. It is pure and dependency-free: callers provide records, a
complete selection tuple, and optional release metadata; the compiler returns a
new release without reading time, storage, DOM state, projects, or prior lenses.

## Annual-emissions universe

An entity is eligible only when its latest observation exactly matches the
selected:

- metric;
- period (a single year for this lens);
- evidence plane;
- accounting frame;
- scope; and
- unit.

The observation must contain a finite numeric value, be explicitly reviewed,
and pass its evidence gate. Zero is valid. Null is missing. Stale, conflicting,
unreviewed, unavailable, or licence-blocked evidence is unranked with explicit
reason codes. Duplicate mapped country IDs are rejected rather than counted
twice.

Eligible rows sort by the unrounded value descending. Exact numeric ties use
competition ranking (`1, 2, 2, 4`) and country ID only as the deterministic
within-tie order. The separate unranked group is never numbered or appended to
the ranked rail; its country-ID ordering is presentation order, never an
ordinal.

## Pledge-overshoot universe

Overshoot uses `latest observation minus selected target endpoint`. In addition
to the exact observation tuple, eligibility requires:

- target integrity `comparable`;
- explicit `scope_match: true`;
- the selected conditionality case;
- exact target year, scope, and unit;
- a finite numeric target endpoint;
- `review_state: reviewed`; and
- a passed target evidence gate with no blocking evidence flag.

The gap sign is a level comparison only. Every ranked row states
`delivery_inferred: false`; the compiler never labels pace or predicts target
achievement.

## Release shape

Every result contains:

```text
ranking_version
release_id                             (required nonempty caller ID)
compiled_at                            (required valid UTC second timestamp)
input_hash                             (required lowercase SHA-256 from caller)
calculation_hash                       (compiler SHA-256 over canonical release)
selection                             (complete comparison tuple)
disclosure                            (eligible, mapped, and unranked counts)
ranked[]                              (competition ordinals)
unranked.entries[]                    (ordinal null + reasons)
composite_score_used: false
project_data_used: false
```

Compilation fails closed when release metadata is absent or malformed. The
compiler reads no clock. Its dependency-free SHA-256 covers the selection,
denominators, ranked and unranked rows, caller metadata, and truth-boundary
flags. Reordering identical input records produces the same release hash.

## Closed ranking-reason vocabulary

Ranking exclusion reasons occupy their own namespace and never reuse CT-02
evidence reason codes. Version 0.1.0 permits exactly:

```text
ranking_value_missing
ranking_value_invalid
ranking_metric_mismatch
ranking_period_mismatch
ranking_plane_mismatch
ranking_accounting_frame_mismatch
ranking_scope_mismatch
ranking_unit_mismatch
ranking_observation_not_reviewed
ranking_evidence_gate_not_passed
ranking_evidence_not_reviewed
ranking_source_missing
ranking_source_unavailable
ranking_licence_blocked
ranking_value_withheld
ranking_evidence_stale
ranking_evidence_conflicting
ranking_target_not_comparable
ranking_target_scope_not_matched
ranking_condition_mismatch
ranking_target_year_mismatch
ranking_target_scope_mismatch
ranking_target_unit_mismatch
ranking_target_value_missing
ranking_target_value_invalid
ranking_target_not_reviewed
ranking_target_evidence_gate_not_passed
```

The compiler and JSON Schema mirror this list exactly, and the checker rejects
vocabulary drift.

Because compilation is stateless, changing lenses creates a new universe and
cannot preserve prior ordinals. The fixture proves that a major emitter without
a target is rank 1 for emissions and unnumbered for pledge overshoot.

## Runtime gate

Do not load this module in `index.html` until CT-22 supplies the exact record
shape and the renderer replaces all legacy ranking state on every lens change.
The repository's documented module validator is not present on this base
branch, so protected infrastructure remains untouched. The module still
attaches to `window` and safely registers its contract when loaded.

Verify with:

```bash
node tools/check-country-ranking.js
```
