# Final Sol adversarial release review

Reviewer: `ai-reviewer:sol-red-team`
Model: `gpt-5.6-sol`
Reviewer type: AI; not human review, legal counsel, legal certification, or institutional scientific review
Reviewed at: `2026-08-28T03:04:08Z`
Role: final adversarial release review

Subject digest: `3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200`
Review-request SHA-256: `0904afc65386a570871fdc77262a8beb6da8f19043a3d1f235edefd4f96d0372`
Runtime SHA-256: `4939fbc6e26c0ef0fc283ecf98ab3924ccb93d93b7e5392eab2014f7ab3c57fe`
Base commit: `91357d1389c2269609328ffb332850d5e8b85637`
Reviewed public stage: `_deploy`, 51 exact regular files

## Conclusion

No substantive P0 or P1 defect remains in the implementation subject.

The release can honestly be described using the existing precise label:

> AI-reviewed source-data release — source observations, estimates, modeled projections, reanalysis, and disclosed deterministic derivations; no human review or legal certification.

It should not be shortened to “AI-verified facts,” “scientifically reviewed,” “independently reviewed,” “rights-cleared,” or an unqualified “factual release.” The defensible claim is that four AI reviews across three model families reviewed a pinned source-data release and its deterministic publication rails—not that humans, institutions, publishers, or legal counsel certified it.

## Findings by severity

### P1 — Final mechanical authorization remains deliberately pending

The aggregate is correctly fail-closed as `draft_final_sol_pending`. Before publication:

1. Replace `data/climate/reviews/cci-v1-ai-reports/sol-red-team.md` with this report and pin its exact SHA-256.
2. Set the Sol reviewer timestamp and `post_mitigation_verdict`.
3. Set aggregate `status` to `ai_factual_public_authorized`.
4. Set `publication_authority.authorized=true`.
5. Preserve `human_review=false`, `legal_certification=false`, `independent_institutional_review=false`, and every factual-only boundary boolean.
6. Recompute the aggregate calculation hash, rebuild `_deploy`, and repin the exact staged artifact.
7. Require all final review/profile/staged-integrity/strict checks to pass.

This is the declared final-pinning step, not an implementation defect.

### P2 — Standalone legacy source-routing snapshot remains stale

`node tools/check-source-routing-policy.js` exits 1 because its immutable source-registry expectation is `5c7222…`, while the current registry is `6b9e46…`.

This does not invalidate the separate CCI lane: the canonical request pins the current registry, strict CCI climate-truth passes, and profile-aware routing is adversarially tested. The stale standalone legacy snapshot should nevertheless be reconciled separately to avoid confusing future maintainers.

### RESOLVED — Publication-authority field is independently enforced by the verifier

`check-cci-factual-public-review.js` now requires `publication_authority.authorized === true` and the exact AI-factual scope. Contradictory artifacts fail closed.

### P3 — Excluded-asset names remain only in non-executable provenance

The three excluded filenames and upstream URLs remain in the staged historical vendor-integration record, schema, and aggregate exclusion decisions. Their image files, binary digests as staged assets, executable references, service-worker entries, and 51-file allowlist entries are absent.

This is acceptable as denylist/provenance disclosure. It must not be represented as zero textual occurrence anywhere in the stage.

## Scientific and data integrity

- Runtime contains 249 unique registry entities and 26 metrics.
- Exact lens partitions are:
  - Carbon: `213 data + 36 gaps = 249`
  - Physical: `245 data + 4 gaps = 249`
  - Power: `195 data + 54 gaps = 249`
- GCB territorial fossil CO₂ remains separate from land-use CO₂.
- WPP 2024 Medium values remain labeled modeled projections.
- Ember blanks remain gaps; no zero substitution or browser rescaling occurs.
- ERA5 remains labeled reanalysis, and CMIP6 remains labeled modeled projection with period, scenario, baseline, and percentile boundaries.
- Climate TRACE is absent from product evidence and executable output.
- Composite scores, target assessments, finance judgments, performance grades, offset adjustments, mismatched-scope comparisons, and inverted carbon relief are disabled.
- Same-metric ordering is disclosed as magnitude order, not a performance score.
- Country cards expose evidence class, scope, period, transformation, uncertainty where available, checksums, citations, and explicit gap reasons.

## Source rights and attribution

- `night-sky.png`, `earth-blue-marble.jpg`, and `earth-topology.png` are not staged and are absent from executable JavaScript and the service-worker precache.
- Browser requests loaded only the retained `earth-night.jpg` and Natural Earth geometry; no excluded image request occurred.
- The NASA surface is attributed as Earth Observatory Black Marble 2012, image by Robert Simmon, using Suomi NPP VIIRS data credited to Chris Elvidge/NOAA NCEI. The staged copy limits it to a historical decorative surface and disclaims endorsement.
- Natural Earth is retained under its public-domain basis and described as generalized 1:110m navigation geometry, not an authoritative sovereignty or legal-boundary representation.
- Approximate small-state points and excluded disputed subfeatures are disclosed.
- These are AI-reviewed publication decisions, not legal rights clearance.

## Runtime, accessibility, and deployment rails

A live Chrome session against the exact `_deploy` stage showed:

- successful pre-flight module validation;
- one rendered globe canvas;
- the first-orbit disclosure, three independent lenses, and 249-record evidence browser;
- Carbon, Power, and Physical lens switching with preserved country selection;
- a China evidence card exposing observed/reanalysis and modeled-projection boundaries, periods, baselines, and uncertainty;
- no browser console warnings or errors;
- only the two approved globe resources requested.

The successful WebGL path was exercised directly. Fallback behavior is supported by deterministic fallback/accessibility checks and mutation tests, not by an assistive-technology certification or a forced live fallback during this review.

Stage construction is deterministic and exact, uses coupled CCI/globe/service-worker cache epochs, preserves the 249-row rollback snapshot, rejects symlinks and unexpected files, and keeps the old human/signature release path separate and unsatisfied.

## Aggregate and report composition

The refreshed specialist reports are exactly pinned:

- Luna science: `caff5cf48a7f49b7dc1c66d78eacdd6b289ea60f8dc6b9b9918eb663f476a91f`
- Luna rights: `73930c6b4afc6e9801169ad4d5eb40a860ef33debb41d2ff3471399bcde1e095`
- Terra runtime: `640393a44ae146bec9f916393bd7c302c4e52ff322561072d4693873c1ccc246`

Independent pin recomputation checked 24 implementation pins, four report pins, and nine public-output pins: all 37 matched.

The aggregation policy correctly states that no unresolved blocker may be overridden by a vote. The composition is accurately described as two Luna reviews, one Terra review, and one Sol review across three model families, with no institutional-independence claim.

## Commands and outcomes

- `node tools/climate-truth-ci.js --strict` — PASS; CT-45 passed 63/63 policy cases, rejected 149 adversarial mutations and three staged symlink cases.
- `node tools/check-country-climate-intelligence-ci.js` — PASS.
- `node tools/check-cci-factual-public-deploy.js --self-test` — PASS.
- `node tools/check-cci-factual-public-deploy.js --staged _deploy` — PASS, 51 exact files.
- `node tools/check-globe-runtime-assets.js` — PASS.
- `node tools/check-globe-webgl-fallback.js` — PASS, 249 entities and 29 fail-closed mutations.
- `node tools/check-country-accessibility.js` — PASS.
- `python3 scripts/verify_load_order.py` — PASS, 12 scripts.
- `node tools/check-staged-production-integrity.js --self-test` — PASS, including filesystem, tamper, cleanup, public-surface, and mode-isolation cases.
- `node tools/check-public-climate-release-profile.js --self-test` — PASS, including exclusive CCI-versus-legacy routing.
- `node tools/check-country-climate-intelligence-release-signatures.js` — PASS candidate policy and 24 fail-closed mutations.
- `node tools/check-country-climate-intelligence-release-gate.js --require-release` — expected BLOCK: human reviewed-release package absent.
- `node tools/check-globe-runtime-approval.js` — PASS policy; production trust remains unprovisioned and fail-closed.
- `node tools/check-ct42-runtime-rollback-proof.js` — PASS, 51 mutations and exact rollback materialization.
- `node tools/check-ct42-runtime-rollback-review.js` — expected BLOCK: independent legacy rollback review absent.
- `shellcheck --format=gcc tools/build-cci-factual-public-deploy.sh` — PASS.
- `bash -n tools/build-cci-factual-public-deploy.sh` — PASS.
- Read-only workflow audit — no material workflow-security blocker; one low-severity ad-hoc package-install finding.
- `node tools/check-cci-factual-public-review.js` — expected BLOCK while aggregate remains draft.
- `node tools/check-public-climate-release-profile.js --cci-ai-factual` — expected BLOCK while aggregate remains draft.
- `node tools/check-staged-cci-factual-public-integrity.js --staged _deploy` — expected BLOCK while aggregate remains draft.
- `node tools/check-source-routing-policy.js` — BLOCK on the disclosed stale legacy registry snapshot.

## Limitations

- No live publisher refetch or institutional source audit was performed.
- Some upstream inputs are referenced by pinned external receipts rather than archived raw bytes.
- Country-level uncertainty is unavailable for several inputs; CMIP6 spread is shown, while ERA5 OLS trend uncertainty is not propagated.
- Browser evidence is a bounded Chrome session, not exhaustive device or assistive-technology certification.
- Cloudflare production health remains a post-merge operational requirement and is not implied by this review.
- The existing human-signature and independent-review gates remain unsatisfied and confer no authority on this separate AI-factual lane.

```json
{"post_mitigation_verdict":"approve_with_conditions"}
```

## Superseding final delta addendum

Reviewer: `ai-reviewer:sol-red-team`
Model: `gpt-5.6-sol`
Reviewed at: `2026-08-28T03:04:08Z`
Reviewer type: AI; not human review or legal certification

This addendum supersedes prior subject-binding references. All unchanged scientific, rights, runtime, accessibility, and publication-boundary conclusions remain in force.

Canonical subject digest: `3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200`
Review-request SHA-256: `0904afc65386a570871fdc77262a8beb6da8f19043a3d1f235edefd4f96d0372`
Verifier SHA-256: `e95beb2ad6a1edde2316e8587dce0c32ca029e19625a552ad3ef54fdaff58b04`
Request-preparer SHA-256: `68f050e6f09029932e8513236350b145eac68913d4e14ac28d56bd106071be6e`

### Result

No new P0 or P1 implementation defect remains.

The generated-vendor exception is now narrowly correct:

- Vendor absent: PASS using only the canonical vendor-policy digest.
- Exact generated vendor present: PASS.
- Generated vendor with wrong bytes: BLOCK on public-output pin mismatch.
- Dangling vendor symlink: BLOCK because public deploy paths must not contain symlinks.
- Any other missing public output: BLOCK on filesystem inspection.

Subject and authority attacks also fail closed:

- `publication_authority.authorized=false`: BLOCK.
- Wrong publication-authority scope: BLOCK.
- Wrong subject digest: BLOCK.
- Stale review-request SHA: BLOCK.
- Removed review-request artifact pin: BLOCK.
- Substituted reviewer report path: BLOCK.
- Removed public-output pin: BLOCK.
- Correctly rebound in-memory control artifact: PASS.

The verifier requires exact sets of 24 implementation pins and nine public-output pins, canonical report paths for all four reviewers, the exact review-request bytes, and the exact subject digest.

Deterministic request regeneration matched byte-for-byte: 295 subject pins, dependency closure passed, and the regenerated request SHA and subject digest matched the values above. The four reviewer reports, prepublication artifact, aggregate, and generated vendor dependency are correctly classified as post-subject generated outputs, avoiding a hash cycle while remaining mandatory final-aggregate pins.

The profile-routing self-test passed all nine exclusive-routing cases. The legacy human release gate remains separately fail-closed with `reviewed_release_package_absent`.

At review time the aggregate still referenced the superseded subject; the remaining condition was to repin every report and aggregate field, recompute the calculation hash, rebuild `_deploy`, and require the final verifier/profile/staged-integrity suite to pass.

```json
{"post_mitigation_verdict":"approve_with_conditions"}
```
