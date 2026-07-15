# CT-40 Independent Review and Release Eligibility Gate

**Status:** offline fail-closed validator; no runtime or public-data release

**Gate version:** 1.0.0

## Purpose

CT-40 is the final separation between staged climate evidence and an eligible
release. Schema-valid data is not automatically publishable or assessable. The
gate requires attributed source decisions, complete evidence lineage, and
independent human review before a fact or Country Climate Profile can enter a
release manifest.

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
output. Both the top-level result and nested manifest carry an explicit
`allow`/`deny`, boolean eligibility, and identical canonical reason-code list.
The manifest also identifies individually eligible facts and profiles and has
a deterministic SHA-256 over the entire decision structure.

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
describes or accepts a real licence. One fully reviewed release is allowed; 35
failing cases cover self-review, timestamps, checksums, field-level lineage,
redistribution versus scoring approval, unresolved conflicts, every blocking
evidence state, high-impact transformation lineage, profile provenance, and
release review.

Run:

```sh
node tools/check-climate-release-gate.js
```

The checker reverses all candidate arrays and requires the exact same output,
verifies the deterministic calculation hash, validates canonical reasons and
manifest consistency, asserts review-queue routing, and proves implicit time
and unversioned methodology inputs fail.
