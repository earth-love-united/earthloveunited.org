# CLI-100 — Country Climate Profile and Runtime Architecture

**Status:** Accepted for implementation

**Date:** 2026-07-15

**Owners:** architect, climate-data reviewer, designer

## Context

The live globe classifies a country primarily from the presence and sign of
`reality_gap_mt`. Countries without a computable gap are labelled “No target”
even when an NDC exists. This creates a visual loophole: a high emitter can look
less alarming because its commitment is absent or non-comparable.

The flat `data/pledge-nodes.json` artifact does not carry field-level source,
scope, accounting, uncertainty, or transformation lineage. Its generated values
cannot presently support a policy-grade country score.

Its 123 public records are therefore classified as legacy unverified input.
Existing publication does not prove provenance or reuse permission. The file is
frozen for replacement: none of its unsourced values may be copied into the new
evidence store or reviewed release, and the reviewed runtime must stop loading
it once the replacement artifact passes release gates.

The v1 runtime was also simplified without updating the protected architecture
documents. The public application now contains one HTML page and ten classic
runtime scripts. The former `js/module-validator.js`, GAIA page, learning
modules, pledge wall, and other subsystems are archived under `_archive/v1-cut/`.

## Decision

### 1. Publish a profile before a composite score

The first release will expose separate categorical dimensions:

- Impact
- Target integrity
- Ambition
- Delivery
- Fair contribution
- Evidence quality

There will be no opaque 0–100 aggregate. A headline assessment is withheld
when ambition or delivery is not comparable. Missing evidence cannot improve a
result.

### 2. Preserve two evidence planes

Official Party-reported evidence and harmonized scientific estimates remain
separate. Each derived metric declares the plane and accounting scope it uses.
Disagreement becomes a visible quality flag.

### 3. Use an openly redistributable ISO-compatible identity seed

The canonical entity registry begins with all 249 rows in the pinned Debian
`iso-codes` 4.20.1-1 `data/iso_3166-1.json` artifact, licensed
LGPL-2.1-or-later. It is described as ISO 3166-1-compatible data sourced from
Debian, not as an official ISO or UN registry, and remains a separable asset
with its required notices, source/version, checksum, and transformation log.

UN membership, UNFCCC Party status, LDC/LLDC/SIDS groups, territory treatment,
assessment eligibility, geometry, and any optional M49 mapping are separate
reviewed overlays. They default to unknown until an approved source supports
them. Comparisons declare their eligible universe; no row is silently deleted
to force a preferred count.

### 4. Keep accounting frames explicit

Economy-wide GHG, fossil CO2, and LULUCF are separate series. A target gap is
calculated only when actual and target scopes match. Conditional and
unconditional targets are separate records. Adaptation/vulnerability and
carbon projects do not enter the mitigation result.

### 5. Retain the v1 contract architecture

The project will not restore the archived `MODULE_MANIFEST` validator.

Runtime module assurance consists of:

1. `window.X` export for every cross-module API;
2. `MODULE_CONTRACTS.register()` declaration;
3. `MODULE_CONTRACTS.validate()` pre-flight in `App.init()`;
4. `scripts/verify_load_order.py` static dependency/load-order verification;
5. `SmokeTest` runtime coverage.

New country-evaluation code will be introduced as a small classic-script module
with an explicit contract after the evidence schema is approved. It will not be
embedded as additional ad hoc branches in `js/globe.js`.

### 6. Compile evidence offline, serve static artifacts

Source acquisition, normalization, review, and release compilation are offline
publication tasks. The browser still loads committed JSON through classic
scripts with no bundler or application build step.

### 7. Do not grandfather legacy country data

The existing `data/pledge-nodes.json` remains available only to keep the current
site operational during the staged migration. A dedicated audit must identify
its recoverable upstream sources and licences. Country facts are independently
reacquired through approved evidence records; unverifiable fields are withheld,
not migrated. The final runtime switch removes the legacy file from the climate
profile data path.

## Consequences

### Positive

- A major emitter remains visibly consequential even when its target cannot be
  normalized.
- Country records become reproducible and auditable.
- Official claims and comparable estimates can coexist without conflation.
- The globe can expose uncertainty without rewarding missing information.
- The live v1 architecture remains small and understandable.

### Costs

- Many countries will initially show `not_assessed` or `non_comparable` rather
  than a simple score.
- Primary-source NDC interpretation requires human/agent review.
- Some useful secondary datasets cannot be redistributed until licences are
  approved.
- Country evidence, evaluation logic, and visualization must ship in staged
  missions rather than one large rewrite.

## Rejected alternatives

### Redistribute a registry copied directly from the UN M49 website

Rejected for the reviewed release while the source registry records only
general UN website terms and no M49-specific permission for normalized database
redistribution. “Official” does not mean “openly reusable.” M49 remains an
optional reviewed overlay if source-specific reuse approval is later recorded.

### Treat missing gap as “No target”

Rejected because it conflates an absent commitment with an unconvertible,
sectoral, intensity, BAU, stale, or incompletely sourced commitment.

### Use CAT score zero for uncovered countries

Rejected because zero currently means unassessed, not a performance rating.

### Derive missing baselines from the first emissions observation

Rejected because the NDC's stated base year and scope are normative inputs.
An observed series cannot invent them.

### Use one emissions series for both accountability and comparison

Rejected because Party-reported inventories and harmonized estimates answer
different questions and may use different methods or scopes.

### Restore the archived module validator and full runtime

Rejected because the v1 contract pre-flight and static verifier already cover
the live module graph. Restoring archived systems would reintroduce unrelated
surface area and contradict the v1 product decision.

### Publish an immediate composite score

Rejected because weighting impact, ambition, equity, policy, and evidence would
introduce normative choices and false precision before the underlying facts are
comparable.

## Implementation gates

1. Source and licence registry.
2. Evidence and target schema with explicit null/reason states.
3. Visual truth contract and golden UI fixtures.
4. Dual emissions evidence and primary-source review of the top 20 emitters.
5. Target comparability and delivery engines with golden-country fixtures.
6. Deterministic profile compiler and release manifest.
7. Sequential globe, ranking, card/chart, and accessibility missions.
8. Independent scientific red team and truth CI.

The detailed dependency graph and mission boundaries live in
`docs/COUNTRY-CLIMATE-TRUTH-PLAN.md`.
