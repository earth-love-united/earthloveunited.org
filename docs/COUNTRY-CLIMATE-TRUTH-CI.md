# CT-41 Climate Truth CI

**Status:** deterministic stack-aware CI entrypoint; reviewed-release mode is
fail-closed

**Policy version:** 1.0.0

## Entrypoint

Run:

```sh
node tools/climate-truth-ci.js --allow-incomplete
node tools/climate-truth-ci.js --strict
```

The first command is for an explicitly partial stacked branch. It runs every
validator present, prints every missing required component, and reports
`INCOMPLETE`; it does not claim a truth release passed. The second command is
the release gate and exits nonzero for any missing component or artifact.

With no flag, a partial branch can remain non-failing only while no reviewed
runtime candidate exists. As soon as `data/climate/runtime-manifest.json`
exists, missing dependencies fail even if `--allow-incomplete` was supplied.
This prevents a reviewed candidate from using partial-stack semantics.

The GitHub workflow now runs policy fixtures and the explicitly labelled
stack-aware command on every change. When a reviewed runtime manifest appears,
the workflow additionally invokes strict mode. `.github/workflows/ci.yml` is
the sole protected file changed by CT-41 and requires CODEOWNERS review.

## Component map

The entrypoint uses the mission map rather than inferring labels from whichever
tool happens to exist:

| Mission | Validator |
|---|---|
| CT-01 source and licence registry | `tools/check-climate-source-registry.js` |
| CT-02 evidence contract | `tools/check-country-evidence.js` |
| CT-03 visual truth contract | `tools/validate-visual-truth-fixtures.js` |
| CT-04 legacy quarantine | `tools/verify-legacy-country-quarantine.js` |
| CT-10 GCB evidence boundary | `tools/check-country-emissions-evidence.js` |
| CT-10B PRIMAP candidates | `tools/check-primap-economy-wide.js --committed-only` |
| CT-11 NDC evidence | `tools/check-major-emitter-ndc-evidence.js` |
| CT-12 policy and finance | `tools/check-policy-finance-evidence.js` |
| CT-13 coverage-gap queue | `tools/check-country-coverage-gap-queue.js` |
| CT-20 target comparability | `tools/check-target-comparability.js` |
| CT-21 delivery | `tools/check-country-delivery-engine.js` |
| CT-22 profile compiler | `tools/check-country-profile-compiler.js` |
| CT-30 reviewed view model | `tools/check-country-view-model.js` |
| CT-31 ranking | `tools/check-country-ranking.js` |
| CT-32 card evidence | `tools/check-country-card-evidence-model.js` |
| CT-33 accessibility | `tools/check-country-accessibility.js` |
| CT-40 release gate | `tools/check-climate-release-gate.js` |

`tools/build-major-emitter-ndc-release.js --check` is also run when present as
an optional generated-artifact verification. Public-copy validation is always
required. Every component is marked `PASS`, `FAIL`, or `MISS` in stable order.

## Reviewed runtime manifest

Strict runtime checks activate only through
`data/climate/runtime-manifest.json`. This avoids treating today's legacy globe
as reviewed climate evidence while still making the future publication gate
unavoidable. The manifest declares:

```text
methodology_version
runtime.review_status = reviewed
runtime.file_paths / runtime.data_files / runtime.claims / runtime.rankings
release_eligibility_manifest
release_diff
published_fact_files
source_registry
```

Runtime source files are loaded from the declared paths. Absolute paths and
parent-directory traversal are rejected for referenced JSON artifacts.

The reviewed runtime fails if it loads `data/pledge-nodes.json`, contains
`On track`, `No target`, or `composite score`, restores quarantined
composite/performance fields, gives a missing
target positive/green treatment, or declares a ranking without metric, unit,
period, evidence plane, and source fact IDs.

## Release, lineage, and drift

The referenced CT-40 manifest must say `allow`, set
`release_eligible: true`, carry no denial reasons, and include a SHA-256. A
denied or inconsistent manifest always fails.

The reviewed release diff records the current and previous release (or marks an
initial release), change summary, changed entity IDs, source revision IDs,
deterministic hash, and independent builder/reviewer attestation. Missing or
self-reviewed diffs fail.

Every published fact is checked against its pinned source decision. It needs
redistribution approval, source checksum agreement, independent review, and
the active methodology version. Derived or modeled facts additionally need
input fact IDs, transformation, formula version, methodology version, and
calculation hash.

Before running validators the entrypoint snapshots Git status under
`data/climate`; it compares the snapshot after every checker. Any generated
artifact mutation is `generated_drift` and fails. Canonical reason-code arrays
exported by CT-20 and CT-40 are compared byte-for-byte with CT-02 enums; their
own validators cover additional embedded vocabularies.

## Policy fixtures

`data/climate/fixtures/truth-ci-policy.json` contains 17 fictional cases: one
complete pass and 16 expected failures covering legacy loads, truth-language
regressions, ambiguous missing-target treatment, composite scores, unsourced
rankings, denied releases, invalid/self-reviewed diffs, missing licence/review/
lineage, canonical-enum divergence, and generated drift.

Run:

```sh
node tools/check-climate-truth-ci.js
```

The checker also proves strict mode is nonzero for missing components,
`--allow-incomplete` is explicitly incomplete rather than passed, and a
reviewed runtime candidate cannot use the incomplete escape hatch.

## Current release limitation

The integrated pre-release stack contains all validators listed above. The
CT-10B CI mode verifies the committed schema, hashes, boundary observations,
coverage, publication gates, and deterministic identifiers without claiming a
raw-source rebuild. Strict
release CI remains red until CT-42 supplies the reviewed runtime manifest and
reviewed release diff; no placeholder is counted as a pass. The independent
PRIMAP rebuild and attestation additionally require the pinned external source
CSV and are run without `--committed-only`, followed by
`tools/check-primap-review-attestation.js /path/to/PRIMAP.csv`, when that
reviewed raw input is available.
