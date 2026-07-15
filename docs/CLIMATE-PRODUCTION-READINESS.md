# Climate production readiness

The climate globe uses two separate readiness modes. Passing candidate mode
does not authorize a production release.

## Candidate integrity

Run:

```bash
node tools/check-climate-production-readiness.js --candidate
```

This mode must prove all of the following:

- independent CT-42 data and UI reviews pass;
- public-copy, canonical source-link, JavaScript syntax, and load-order checks
  pass;
- the real CT-40 evaluation remains `deny` and has canonical reasons;
- the top-20 primary-source queue covers 20 entities and authorizes zero;
- the evidence/licensing work package remains blocked and points to a separate
  future reviewed-candidate compiler;
- no runtime manifest, reviewed release diff, or CT-40 allow manifest exists;
- partial climate truth CI is incomplete only for the two prohibited release
  artifacts.

The successful status is
`candidate_integrity_ready_release_blocked`.

## Production release

Run:

```bash
node tools/check-climate-production-readiness.js --release
```

This mode fails closed unless every item below is true:

- CT-40 returns an authentic `allow` with release authority;
- top-20 primary-source review is complete;
- explicit redistribution and scoring licence decisions are complete;
- required field-level fact reviews are complete;
- an independent CT-40 release review passes;
- reviewed runtime manifest, release diff, and allow manifest exist;
- a separately reviewed executable production rollback proof exists at
  `data/climate/releases/reviewed-rollback-proof.json`;
- strict climate truth CI passes with no missing components.

The only successful production status is `release_ready`.

## Current result

The current reviewed factual candidate passes candidate integrity. Production
mode is blocked. The gate must not be weakened to make the release appear
ready; evidence and independent decisions must be added instead.
