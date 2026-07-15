# CT-30 Country Climate View Model

**Status:** Implementation-ready adapter; runtime integration deferred

`js/country-climate-view-model.js` converts a future CT-22 country profile into
a deterministic presentation model for the globe and country card. It does not
render DOM, choose numeric impact thresholds, compute ranks, or calculate any
climate assessment. Those responsibilities remain with the evidence pipeline,
methodology engines, shared ranking compiler, and renderer respectively.

## Truth boundaries

- Impact, target integrity, ambition, delivery, fair contribution, and evidence
  remain six separate axes. `composite_score` is always `null`.
- Missing or non-comparable commitments never receive positive delivery copy,
  a checkmark, a positive tone, or a rank.
- A delivery result is shown only when the target is comparable, CT-22 supplies
  `delivery.evidence_gate_passed: true`, and no blocking evidence flag is
  present. This makes positive `ahead`/`on_pace` treatment impossible to infer
  from an incomplete profile.
- Missing impact evidence uses `geographic_minimum_unknown` and a visible
  unknown pattern. It is not classified as low impact.
- Conflicting impact planes may remain a candidate for the shared
  emissions-only ranking only when the selected plane is named; the conflict
  still blocks positive delivery treatment and is exposed with a split-plane
  cue.
- Projects and markets are emitted after the evidence section with the fixed
  disclaimer `Not part of the national climate performance profile`.
- Values use property-presence checks so numeric zero is never converted into
  missing data.
- Ranking `eligible` is always `false` in this adapter. A profile can be marked
  `eligible_pending_shared_ranking` only when its required facts are usable;
  the shared ranking compiler owns final eligibility, universes, ties, and
  ordinals.

## Expected CT-22 input

The adapter accepts axes either under `profile.axes` or at the profile root:

```text
identity
impact
target_integrity (or target during migration)
ambition
delivery
fair_contribution
evidence
release
projects
```

The final CT-22 integration must freeze field names for identity, latest impact
observation, normalized target endpoint, release metadata, and provenance. The
adapter intentionally treats unknown enum values as not assessed.

## Runtime integration gate

Do not add the script to `index.html` until all of the following are true:

1. CT-22 publishes a versioned six-axis profile fixture.
2. The adapter is reconciled against that exact shape.
3. A shared ranking payload supplies ordinals and eligible-universe metadata.
4. The globe/card renderer consumes semantic tokens without inventing colors.
5. Browser SmokeTest and StackLint pass after integration.

The current runtime branch does not contain the `js/module-validator.js` file
still referenced by `AGENTS.md` and `ARCHITECTURE.md`. This mission therefore
does not edit protected validator or architecture files. The module does attach
to `window` and registers its contract when loaded.

## Verification

Run:

```bash
node tools/check-country-view-model.js
```

The checker evaluates the browser IIFE in a Node VM, verifies its public global
and module contract, and exercises fictional golden cases for major/low emitters
without targets, comparable delivery, missing data, licence withholding,
conflicts, stale evidence, and qualitative/sectoral targets.
