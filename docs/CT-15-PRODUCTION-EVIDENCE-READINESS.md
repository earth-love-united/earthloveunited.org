# CT-15 Production Evidence and Licensing Readiness

**Snapshot:** 2026-07-15  
**Status:** blocked work package; no release authority

## Outcome

The factual globe and the country-assessment program are separate production
tracks. The factual globe can complete its own review path without publishing
targets or scores. Country assessment requires official inventory and NDC
evidence in addition to the factual-emissions plane.

Neither current snapshot can be converted in place:

- CT-14 deliberately pins zero official inventories, four metadata-only
  country audits, sixteen audits not started, and zero eligible countries.
- The CT-42→CT-40 adapter deliberately supplies 2,060 `not_reviewed` facts,
  zero fact reviews, null licence decisions, and an unreviewed release block.

A later mission must build a new candidate from reviewed inputs while keeping
both denial snapshots unchanged.

## Track A — factual runtime

The exact outstanding package is:

1. an explicit CT-40 rights decision for the pinned PRIMAP v2.6.1 checksum;
2. 2,060 fact reviews, each independently covering `metric`, `period`,
   `scope`, `source`, and `evidence`;
3. an independent release review whose reviewer IDs exclude the builder;
4. only after an authentic allow decision, a reviewed runtime manifest,
   release diff, deployment checks, and executable rollback proof.

The CT-10C and CT-42 attestations remain valuable input evidence, but CT-40
does not treat them as field-level fact, rights, or release approval.

## Track B — top-20 country assessment

Each country needs three reviewed document roles: official inventory, latest
active NDC or reviewed absence/status determination, and target methodology.
Every acquired source file and attachment needs an exact-byte SHA-256. Failed
or gated acquisition remains `source_unavailable`, `clickthrough_blocked`, or
`rights_blocked`; a search index or locator cannot substitute for source bytes.

The five currently identified NDC/INDC documents for China, India, Indonesia,
and Iran all have `null` source checksums because exact official bytes were not
acquired. The package names each official metadata/direct URL and keeps
normalized extraction false. All twenty official-inventory document IDs and
checksums are presently empty.

The current source decisions remain fail-closed:

- UNFCCC NDC, BTR, and NIR/CRT families are pending and metadata-only.
- TER source files may be archived unchanged with attribution, but normalized
  findings remain pending.
- Party-document rights and normalized extraction require document-specific
  review plus counsel, written clarification, or an explicitly licensed
  official interface. Public availability is not permission.

For each pending source family, the package names the exact registry fields
that would require independent revision: licence status/evidence/restrictions,
redistribution flags, approval decision, and raw-storage policy. PRIMAP's
existing source-registry approval remains intact; its missing item is a
separate CT-40 candidate licence decision tied to the reviewed checksum.

CT-14 currently routes BTR to the official-inventory role while the source
registry does not give BTR the `official_inventory` domain. That mismatch must
be resolved before BTR values are used as inventory facts. TER may corroborate
an inventory but cannot replace the Party submission.

## Required review separation

- Document acquirer ≠ source-identity reviewer.
- Fact extractor ≠ field-level climate reviewer.
- Profile compiler ≠ profile reviewer.
- Release builder must not appear among CT-40 release reviewer IDs.
- The licence reviewer records source-file, normalized-value, redistribution,
  and scoring permissions separately and may approve, narrow, or deny them.

Iran's legacy INDC must not be promoted to an active NDC. Germany requires a
separate review of EU joint-NDC applicability and membership. Every country
requires current Party status, active/superseded submission status, and an
explicit source-unavailable outcome where evidence cannot be obtained.

## Deterministic artifact

The generated work package contains the source-decision record fields,
document manifests, official-inventory and target fields, exact CT-40 review
shape, reviewer roles, all 20 country field gaps, and the ordered worklist.

```sh
node tools/build-climate-evidence-licensing-readiness.js --check
node tools/check-climate-evidence-licensing-readiness.js
```

The checker rebuilds the package byte-for-byte, pins CT-14 and CT-40 inputs,
confirms prohibited production artifacts remain absent, and rejects attempts
to invent approvals, evidence, reviews, eligibility, or release authority.
