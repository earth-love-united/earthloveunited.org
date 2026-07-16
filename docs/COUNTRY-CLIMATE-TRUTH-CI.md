# CT-41 Climate Truth CI

**Status:** deterministic stack-aware CI entrypoint; reviewed-release mode is
fail-closed

**Policy version:** 1.2.0

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
| CT-04 legacy runtime exit | `tools/verify-legacy-country-exit.js` |
| CT-04-R independent exit review | `tools/check-legacy-country-exit-review.js` |
| CT-10 GCB evidence boundary | `tools/check-country-emissions-evidence.js` |
| CT-10B PRIMAP candidates | `tools/check-primap-economy-wide.js --committed-only` |
| CT-10B-R PRIMAP source review | `tools/check-primap-review-attestation.js --committed-only` |
| CT-10C factual display promotion | `tools/check-primap-factual-display-promotion.js` |
| CT-10C-R factual display review | `tools/check-primap-factual-display-review.js --committed-only` |
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
| CT-44 vendor delivery | `tools/check-globe-vendor-integrity.js` |
| CT-45 localized globe runtime assets | `tools/check-globe-runtime-assets.js` |
| CT-45 notices | `tools/check-globe-third-party-notices.js` |
| CT-40 release gate | `tools/check-climate-release-gate.js` |
| CT-40 reviewed production package | `tools/check-reviewed-climate-release.js` |

`tools/build-major-emitter-ndc-release.js --check` is also run when present as
an optional generated-artifact verification. Public-copy validation is always
required. Every component is marked `PASS`, `FAIL`, or `MISS` in stable order.

CT-45 pins the five localized globe files, content-versioned runtime and
service-worker URLs, 177-feature geometry validation, 28 approximate point
affordances, pre-render visual-asset validation, the 201-entity mapped deck, and the
first-class 249-entity evidence browser. It also verifies the final staged
copy. CT-45 does not grant texture rights, third-party-notice completeness,
production use, legal approval, deploy authority, or release authority; those
remain independent release inputs.

CT-45 notices independently pins the readable root notice, machine inventory,
integration record, future approval schema, and empty protected trust registry;
rejects tampering, omission,
symlinks, commented/optional CI, and public-link spoofing; and verifies the
final staged copy. Notice integrity does not confer rights approval. The inventory
core's unchanged-state flags are historical inventory-only properties, while
the later integration is recorded separately. Production still requires five
asset-specific rights dispositions, four resolved counsel questions, an exact
reviewed-commit binding, and one verified detached Ed25519 signature from each
of the asset-rights reviewer, licensing counsel, and release authorizer. The
current registry contains no keys, so it is `unprovisioned` and cannot authorize
a release.

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
ct40_reviewed_release_input
release_diff
rollback_proof
published_fact_files
published_profile_files
source_registry
artifact_pins
```

Runtime source files are loaded from the declared paths. Absolute paths and
parent-directory traversal are rejected for referenced JSON artifacts.

The reviewed runtime fails if it loads `data/pledge-nodes.json`, contains
`On track`, `No target`, or `composite score`, restores quarantined
composite/performance fields, gives a missing
target positive/green treatment, or declares a ranking without metric, unit,
period, evidence plane, and source fact IDs.

## Release, lineage, and drift

The referenced CT-40 manifest is not trusted as a claim. It must be the exact
full output of `evaluateRelease()` recomputed from the separately pinned
`ct40-reviewed-release-input.json`. The input and output must pass their frozen
schemas, contain non-empty facts and profiles, profile every released fact,
recompute derived-fact and profile hashes, and match every published fact and
profile record exactly (including order and every field) to the reviewed CT-40
candidate. Published files have exact `{facts: [...]}` / `{profiles: [...]}`
envelopes, so wrapper metadata cannot bypass review. Every source must match the pinned canonical registry and an
independent redistribution/scoring rights decision. Every top-20 document ID
must resolve through that registry to one unique same-country/same-role regular
non-symlink artifact with an exact digest. The linked, canonically hashed
source-rights decision must repeat the exact document ID/path/digest pin and
approve redistribution and scoring. The package records independently reviewed, canonically hashed
primary-source records for the exact required top-20 country set. An
extra `release_authority` field, a shape-only hash, or any output drift fails.
Successful content validation reports eligibility only and never mints release
authority. Production readiness preserves `ct40.content_eligible=true` with
`ct40.release_authority=false`; authority still requires the detached signed
production approval.

CT-40 v2 also exposes publication tiers. Its legacy top-level decision is
explicitly `assessed_climate_release`, so a DENY cannot be misread as a ban on
publishing climate facts. The real CT-42 candidate may report 2,060 pinned facts
as eligible for factual display and descriptive same-metric magnitude
comparison while commitment display is absent and derived metrics, performance
assessment, and scores remain absent or blocked. These tier results do not
create production or deployment authority.

The factual tier is cryptographically bound outside the candidate payload: the
adapter matches the embedded batch artifact and attestation digests to the
exact CT-42-reviewed files, then passes a separate trusted authority object to
CT-40. Well-shaped but fabricated candidate hashes or licence metadata remain
blocked.

The reviewed release diff records the current and previous release (or marks an
initial release), change summary, changed entity IDs, source revision IDs,
exact input/runtime/output artifact pins, a recomputed canonical hash, and an
independent builder/reviewer attestation. Missing, self-reviewed, shape-only,
or byte-drifted diffs fail.

The production rollback proof is a separate reviewed artifact. Its package
pins, schema, calculation hash, patch bytes, current control-file hashes, and
baseline Git bytes are checked before the patch is streamed to `git apply` for
a temporary tree; the patch artifact itself never exists inside that tree.
Every undeclared target, restored-hash mismatch, and JavaScript syntax failure
must fail. The baseline must precede the reviewed head, every control must
restore byte- and digest-distinct content, and identical remove/add hunks are
rejected as non-executable no-ops. The candidate rollback rehearsal also
requires its review-chain SHA to resolve to a real commit, be an ancestor of
the current builder HEAD, and contain the exact pinned CT-40 result bytes; a
40-hex string alone is never a binding. Mere existence
of `reviewed-rollback-proof.json` never satisfies release readiness. The same
shared package validator runs from strict truth CI and production readiness;
the signed release-authority reviewed-commit binding covers the validator,
schemas, and five release-package artifacts.

The production artifacts have a deliberate acyclic generation order:

1. Write the reviewed CT-40 input, including source-rights decisions and the
   20 hashed primary-source review records; register every referenced evidence
   document with its country, role, source/right decision, path, and digest;
   recompute derived fact/profile hashes.
2. Run `evaluateRelease()` and write its exact full output as the ALLOW file.
3. Write the runtime manifest with exact pins for runtime/data/fact/profile,
   every evidence artifact, source-registry, reviewed-input, and ALLOW bytes.
4. Write and canonically hash the release diff, pinning the manifest, input,
   and ALLOW.
5. Build the rollback patch and proof, pinning those four earlier artifacts;
   run `node tools/check-reviewed-climate-release.js` to rehearse it.
6. Commit the package, then create the separate production approval and
   detached signatures for that reviewed commit. Do not hand-edit downstream
   hashes after an upstream artifact changes; regenerate in this order.

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

`data/climate/fixtures/truth-ci-policy.json` contains 32 fictional cases: one
complete pass and 31 expected failures covering legacy loads, truth-language
regressions, ambiguous missing-target treatment, composite scores, unsourced
rankings, denied releases, invalid/self-reviewed diffs, missing licence/review/
lineage, empty facts/profile data, canonical diff hashes, canonical-enum
divergence, and generated drift. The reviewed production-package checker adds
54 adversarial cases for malformed/empty facts and profiles, synthetic ALLOWs,
invented source rights, placeholder reviewers, shape-only calculation hashes,
pin drift, partial/symlinked artifacts, published-record/envelope substitution,
reordering, duplication and omission, nonexistent/traversing/symlinked/
duplicated/cross-entity/unpinned top-20 evidence, and executable rollback
tampering, including an attempted in-tree patch-artifact target and a pinned
no-effect rollback.

Run:

```sh
node tools/check-climate-truth-ci.js
```

The checker also proves strict mode is nonzero for missing components,
`--allow-incomplete` is explicitly incomplete rather than passed, and a
reviewed runtime candidate cannot use the incomplete escape hatch.

## Current release limitation

The integrated pre-release stack contains all validators listed above. The
CT-10B and review CI modes verify the committed schemas, hashes, boundary
observations, coverage, independent-attestation pins, promotion semantics,
publication gates, and deterministic identifiers without claiming a raw-source
rebuild. Strict
release CI remains red until CT-42 supplies the reviewed runtime manifest and
reviewed release diff; no placeholder is counted as a pass. The independent
PRIMAP rebuild and both review attestations additionally require the pinned
external source CSV. They are run without `--committed-only`, followed by
`tools/check-primap-review-attestation.js /path/to/PRIMAP.csv` and
`tools/check-primap-factual-display-review.js /path/to/PRIMAP.csv`, when that
reviewed raw input is available.

The current asset manifest pins a byte-for-byte NASA Earth Observatory Black
Marble 2012 JPEG and the original Three-Globe 2.45.2 PNG starfield, including
exact provenance, dimensions, hashes, acknowledgement, and no-endorsement
limits. The historical surface and decorative background are not current
performance or astronomical evidence. Runtime
rights and the composite bundle notice review remain explicitly `not_reviewed`.
Production readiness therefore remains blocked even if later climate evidence
becomes complete. The exact notice inventory passes source and staged integrity,
but that does not approve redistribution. Public candidate output remains
local-only until the five asset rows and counsel questions receive authorized
review and the detached role signatures verify.
