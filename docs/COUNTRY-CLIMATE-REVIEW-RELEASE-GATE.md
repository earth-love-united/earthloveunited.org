# CT-40 Independent Review and Release Eligibility Gate

**Status:** offline tiered-publication and fail-closed assessed-release validator

**Gate version:** 2.0.0

## Purpose

CT-40 separates publication uses instead of treating all climate information as
one all-or-nothing release. Its top-level `allow` / `deny` is explicitly scoped
to `assessed_climate_release`: derived metrics, performance conclusions,
profiles, and scores still require complete evidence lineage and independent
human review. Separately, the gate reports whether pinned factual display,
descriptive magnitude comparison, sourced commitment display, derived metrics,
performance assessment, and scoring are eligible, blocked, or not present.

A top-level assessed-release `deny` therefore does not suppress an independently
reviewed factual tier. It prevents factual emissions data from being silently
promoted into a commitment, delivery, performance, impact-band, or score claim.

The implementation is the pure CommonJS function `evaluateRelease(candidate)`
in `tools/lib/climate-release-gate.js`. It uses Node built-ins only, performs no
I/O, reads no clock, mutates no input, and has no browser integration.

## Input contract

The candidate supplies an explicit `evaluated_at` UTC timestamp and a semantic
`methodology_version`. Implicit current time and a mutable label such as
`latest` are rejected.

### Sources

Each source record supplies a pinned source ID and SHA-256 plus two prior
governance decisions:

```text
licence.redistribution_approved
licence.scoring_approved
licence.decision_id
```

Both approval values must be literal booleans and the prior decision must have
a non-empty ID. The gate does not inspect terms, accept terms, grant rights, or
infer permission. It only consumes decisions already
made in the source registry. Redistribution approval governs evidence facts;
scoring approval additionally governs profile inputs. A profile therefore
remains blocked even when a fact may lawfully be redistributed but not used in
an assessment. Raw evidence release and assessment eligibility are separate:
redistributable context may remain in an evidence artifact while every profile
that references it is withheld.

The reviewed factual-display path is narrower. A batch-attested fact can be
eligible for factual display and same-metric magnitude comparison when its exact
source-registry record is pinned, the source has a confirmed factual-use basis,
normalized-value redistribution is approved, attribution is present, and the
fact's batch artifact and attestation hashes are exact. This path never grants
commitment, derived-metric, performance, score, runtime, or deployment authority.

### Evidence facts and reviews

Each fact carries its source checksum, evidence state, evidence class, and
methodology version. Its separate review attestation carries:

- extractor and reviewer IDs that must both exist and differ;
- `reviewed` status and explicit UTC timestamp;
- the same pinned source checksum;
- the active methodology version; and
- field reviews for `metric`, `period`, `scope`, `source`, and `evidence`, each
  naming the reviewed fact ID.

High-impact derived or modeled metrics under `emissions.*`, `target.*`,
`impact.*`, `ambition.*`, or `delivery.*` also require a `derivation` field
review. That review must name the output and every input fact. The derivation
itself requires transformation text, semantic formula and methodology
versions, explicit input fact IDs, calculation timestamp, and SHA-256. Inputs
must exist in the candidate and cannot include the output itself.

### Conflicts

Every conflict touching a candidate fact must be resolved with resolution text,
existing resolution fact IDs, a reviewer ID, and timestamp. An open or partial
resolution yields `unresolved_source_conflict`. A fact still marked
`conflicting` remains blocked even if an associated conflict record says
resolved; the evidence record must first be replaced or reviewed into a
non-conflicting state.

### Profiles and release review

A profile lists every input fact, methodology version, generation timestamp,
and calculation hash. Its review names distinct compiler and reviewer IDs,
timestamp, methodology version, and the exact same input-fact set.

The release itself names a builder and at least one different reviewer. Every
reviewer ID must be a non-empty unique string, and none may equal the builder.
Its review must be complete and timestamped. A reviewer cannot approve their
own fact extraction, profile compilation, or release build.

## Blocking rules

The following evidence states always block affected assessment and profile
outputs:

| Evidence state | Canonical reason |
|---|---|
| `not_reported` | `value_not_reported` |
| `not_assessed` / `not_reviewed` | `climate_evidence_not_reviewed` |
| `non_comparable` | `evidence_insufficient` |
| `stale` | `stale_source` |
| `conflicting` | `unresolved_source_conflict` |
| `withheld` | `value_withheld` |
| `source_unavailable` | `source_unavailable` |

`not_yet_due`, `reporting_optional`, and `not_applicable` may be released as
reviewed context when redistribution is approved, but they are never eligible
assessment inputs. A referencing profile is denied with
`reporting_not_yet_due`, `reporting_optional`, or `not_applicable` and receives
an assessment-eligibility review-queue item. Reporting flexibility therefore
does not become a negative or positive performance result.

Pending `in_review` attestations also block. Missing source records or checksum
mismatches use `source_missing`; failed redistribution or scoring permissions
use `licence_not_approved`. Missing review detail uses only canonical CT-02
reasons. The gate embeds all 55 codes and the checker requires exact equality
with `data/climate/schemas/enums.json`.

## Output and review queue

`data/climate/schemas/release-eligibility-result.schema.json` freezes the
output. Both the top-level result and nested manifest carry the explicit
`assessed_climate_release` decision scope and an
`allow`/`deny`, boolean eligibility, and identical canonical reason-code list.
`publication_tiers` independently reports `eligible`, `blocked`, or
`not_present` for factual display, magnitude comparison, commitment display,
derived metrics, performance assessment, and scoring. The manifest also
identifies individually eligible assessed-release facts and profiles and has
a deterministic SHA-256 over the entire decision structure.

Batch-reviewed factual publication requires an external authority object
assembled from the pinned source registry, exact promotion bytes, and exact
independent-attestation bytes. Candidate-supplied SHA-shaped identifiers,
licence URLs, attribution, basis strings, or allowed-use flags cannot authorize
themselves. Any mismatch blocks the factual tier even when the field shapes are
valid.

Every blocked fact, profile, or release review emits a stable queue item:

```text
queue_id / subject_type / subject_id
reason_codes
required_fields
```

Required fields point reviewers to review metadata, source/licence decisions,
conflict resolution, evidence or derivation, value state, or source recency.
They do not silently repair evidence and do not weaken release denial.

## Fixtures and verification

`data/climate/fixtures/release-eligibility.json` contains only explicitly
fictional identifiers, values, hashes, and permission decisions. Nothing in it
describes or accepts a real licence. One fully reviewed release is allowed; 37
failing cases cover self-review, timestamps, checksums, field-level lineage,
redistribution versus scoring approval, unresolved conflicts, every blocking
evidence state, high-impact transformation lineage, profile provenance, and
release review. Additional direct probes reject self-asserted batch evidence
and changes to the attestation digest, licence terms, factual basis, or
allowed-use boundary.

Run:

```sh
node tools/check-climate-release-gate.js
```

The checker reverses all candidate arrays and requires the exact same output,
verifies the deterministic calculation hash, validates canonical reasons and
manifest consistency, asserts review-queue routing, and proves implicit time
and unversioned methodology inputs fail.
