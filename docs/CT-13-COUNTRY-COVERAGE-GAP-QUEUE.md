# CT-13 — Country coverage-gap matrix and acquisition queue

## Purpose

CT-13 turns the CT-02 country registry and CT-10B PRIMAP candidate release into a deterministic evidence-coverage work queue. It does not evaluate country performance. Its only ordering signal is whether an entity is mapped and which evidence domains remain unavailable or unreviewed.

The generated artifact is `data/climate/releases/country-coverage-gap-queue-2026-07-15.json`. Rebuild it with a caller-supplied UTC timestamp:

```sh
node tools/build-country-coverage-gap-queue.js 2026-07-15T00:00:00Z
node tools/check-country-coverage-gap-queue.js
```

## Coverage boundary

The matrix has all 249 CT-02 entities and these ten domains:

1. identity
2. harmonized emissions
3. official inventory
4. active NDC target
5. target comparability
6. policy projection
7. finance
8. ambition assessment
9. delivery
10. profile review

Identity fields come from the reviewed CT-02 identity registry. Membership, UNFCCC Party, territory, region, geometry, development-group, and assessment-eligibility overlays are copied only in their existing `null` / `not_reviewed` state. No status is inferred.

The CT-10B PRIMAP artifact supplies 206 candidate histories, but they remain `not_reviewed`. CT-13 records only candidate metadata needed to route independent review; it does not publish their values or fact IDs into a country profile. The other 43 registry entities are explicitly `source_unavailable` with `source_missing` and receive harmonized-source gap tasks.

All remaining climate domains are missing or not reviewed. Consequently, reviewed harmonized-emissions, active-target, and profile counts are exactly zero. Country-facing climate values, performance labels, scores, and ranks are null.

## Queue policy

Every entity receives one task for every domain: 2,490 tasks total.

| Evidence-coverage band | Tasks | Meaning |
|---|---:|---|
| mapped visibility and status | 249 | review identity/status overlays |
| critical evidence coverage | 747 | harmonized history, official inventory, and active NDC discovery |
| dependent assessment coverage | 1,494 | comparability, projection, finance, ambition, delivery, and profile review |

`queue_sequence` is deterministic traversal order within these evidence bands. It is not a country rank, performance rank, or impact rank. High-emitter priority is prohibited until independently reviewed emissions evidence exists. Missing data or a missing target is never treated as positive performance.

The allowed acquisition routes are:

- `official_unfccc_national_discovery`
- `harmonized_source_gap_investigation`
- `identity_status_review`
- `licence_review`
- `independent_interpretation_review`

Source candidates contain URLs and source metadata only. They do not copy source claims, and discovery candidates require approval or review before use.

## Reproducibility and validation

The compiler recursively sorts object keys before calculating its SHA-256 `calculation_hash`; arrays preserve meaningful order. The generated timestamp is supplied by the caller, so rebuilding with identical inputs and timestamp is byte-for-byte stable.

`tools/check-country-coverage-gap-queue.js` validates the schema, exact counts, deterministic rebuild, artifact size, null/zero preservation, all route categories, and the reviewed-fact boundary. Its 249 fictional entities reproduce the 206/43 coverage shape without making real-country claims. Mutation cases prove that inferred overlays, leaked candidate values, performance/score/rank assignment, high-impact priority, copied claims, unknown routes, count drift, and malformed timestamps fail closed.
