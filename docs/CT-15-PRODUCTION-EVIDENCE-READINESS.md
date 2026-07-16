# CT-15 Production Evidence and Licensing Readiness

**Snapshot:** 2026-07-15  
**Status:** factual publication eligible; assessed release and scoring blocked

## Outcome

The factual globe and the country-assessment program are separate production
tracks. The factual globe can complete its own review path without publishing
targets or scores. Country assessment requires official inventory and NDC
evidence in addition to the factual-emissions plane.

The current evidence has two different release states that must not be collapsed:

- CT-14 deliberately pins zero official inventories, four metadata-only
  country audits, sixteen audits not started, and zero eligible countries.
- The CT-42→CT-40 adapter preserves a reviewed batch publication attestation
  and source-registry approval for all 2,060 facts. CT-40 therefore marks
  factual display and magnitude comparison eligible. The same candidate has
  zero field-level assessment reviews, null assessment/scoring licence
  decisions, no profiles, and an unreviewed assessed-release block.

A later assessment mission must build a new assessed candidate from reviewed
inputs while keeping CT-14 and CT-40's scoped audit evidence unchanged. It does
not need to re-deny or re-authorize the already reviewed factual tier.

## Track A — factual display and magnitude comparison

This limited tier is eligible now for all 2,060 PRIMAP facts because the source
registry pins the CC BY 4.0 release and checksum, permits normalized-value
redistribution, and the CT-10C batch attestation verifies the exact factual-use
boundary. Production must retain:

1. the pinned PRIMAP v2.6.1 checksum, CC BY 4.0 attribution, and change notice;
2. the batch publication attestation and each fact's exact `allowed_uses`;
3. labels that identify the values as harmonized economy-wide GHG facts;
4. no commitment, delivery, performance, impact-band, or score claim.

The batch attestation is sufficient only for factual display and magnitude
comparison. It is not a field-level assessment review, scoring-rights decision,
profile review, or assessed-release approval.

## Track B — assessed runtime and scoring

The top-level CT-40 `deny` applies to `assessed_climate_release`. Assessment or
scoring still requires:

1. an explicit assessment-and-scoring rights decision for the pinned PRIMAP
   v2.6.1 checksum;
2. field-level independent reviews for every fact used by an assessment;
3. reviewed derived metrics and profiles with complete input lineage;
4. an independent assessed-release review whose reviewer IDs exclude the
   builder.

## Track C — top-20 country assessment

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
existing source-registry approval remains intact and supports the factual
tiers. Its missing item is a separate assessment-and-scoring decision tied to
the reviewed checksum.

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

The generated work package records all six CT-40 publication tiers, contains the source-decision record fields,
document manifests, official-inventory and target fields, exact CT-40 review
shape, reviewer roles, all 20 country field gaps, and the ordered worklist.

```sh
node tools/build-climate-evidence-licensing-readiness.js --check
node tools/check-climate-evidence-licensing-readiness.js
```

The checker rebuilds the package byte-for-byte, pins CT-14 and CT-40 inputs,
confirms prohibited production artifacts remain absent, and rejects attempts
to invent approvals, evidence, reviews, eligibility, or release authority.
