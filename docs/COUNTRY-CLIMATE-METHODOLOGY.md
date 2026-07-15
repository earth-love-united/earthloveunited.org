# Country Climate Profile Methodology Charter

**Status:** Approved architecture baseline; implementation pending evidence gates

**Methodology version:** 0.1.0

**Effective date:** 2026-07-15

## Purpose

Earth Love United will replace its current pledge-gap status with a transparent
Country Climate Profile. The profile is intended to help a public audience ask
five different questions without mistaking one answer for another:

1. How consequential is the country's emissions footprint?
2. What has the country committed to, and can that commitment be compared?
3. Is the commitment ambitious enough under the selected benchmarks?
4. Are measured emissions and implemented policies moving at the required pace?
5. How complete and trustworthy is the evidence behind the assessment?

The first public version will not publish an opaque 0–100 composite score.
Country performance will be expressed as attributed categorical dimensions.

## Normative principles

The methodology is grounded in:

- progression, highest possible ambition, differentiated responsibilities,
  capabilities, and national circumstances under
  [Paris Agreement Article 4](https://unfccc.int/sites/default/files/parisagreement_publication.pdf);
- transparent reporting of reference points, time frames, scope, gases,
  sectors, assumptions, conditionality, and accounting choices under the
  [UNFCCC enhanced transparency framework](https://unfccc.int/Transparency);
- separation of targets, policies/action, domestic pathways, fair-share
  pathways, and finance in the
  [Climate Action Tracker methodology](https://climateactiontracker.org/methodology/cat-rating-methodology/);
- explicit separation of pledge outcomes from current-policy outcomes in the
  [UNEP Emissions Gap Report 2025](https://www.unep.org/resources/emissions-gap-report-2025);
- range- and uncertainty-aware interpretation consistent with the
  [IPCC AR6 WGIII Summary for Policymakers](https://www.ipcc.ch/report/ar6/wg3/chapter/summary-for-policymakers/).

## Scope

### Included

- territorial annual emissions and emissions trends;
- fossil CO2 and economy-wide greenhouse gases as separate series;
- official NDC commitments and structured progress indicators;
- target integrity and comparability;
- independent ambition benchmarks where licensed and available;
- recent observed pace and current-policy projections;
- historical and per-capita responsibility as context;
- climate support provided, mobilized, needed, and received as distinct facts;
- evidence provenance, recency, uncertainty, conflicts, and review status.

### Excluded from the mitigation profile

- adaptation performance and climate vulnerability;
- voluntary carbon-project counts or credit volumes;
- carbon-credit purchases as a substitute for territorial mitigation;
- unverified national claims or inferred commitments;
- a single public composite score before a separate aggregation decision.

Adaptation and vulnerability require a later, separate profile so reporting
capacity and climate exposure do not become mitigation penalties.

## Country universe

The canonical registry begins with all 249 ISO 3166-1-compatible rows from the
pinned, redistributable Debian `iso-codes` source package. It is an identity
seed, not proof of sovereignty, UN membership, UNFCCC Party status, development
group, territory treatment, reporting obligation, or map eligibility. Those
claims remain separately sourced flags and default to `not_reviewed`.

The map may display states and territories, but comparisons must declare the
eligible universe and never imply that every area has identical reporting
obligations. UN M49 codes and groupings may be added only from a source whose
normalized redistribution terms have been approved; they are not silently
copied from the UN website.

## Evidence planes

### Party-reported plane

The official plane preserves what a country submitted or enacted: NDCs,
Biennial Transparency Reports, National Inventory Reports, common reporting
and tracking tables, technical expert review, long-term strategies, legislation,
and official projections.

### Harmonized plane

The comparison plane preserves globally consistent scientific estimates such
as approved releases from Global Carbon Budget, PRIMAP-hist, or EDGAR. It is
used for cross-country comparison, not to overwrite the official record.

Both planes may be shown together. A material difference becomes a quality
flag requiring investigation; it is never silently averaged or reconciled.

## Public profile axes

### 1. Impact

Impact describes consequence, not virtue. Candidate facts include:

- latest annual territorial emissions and global share;
- fossil CO2 and economy-wide GHG, with LULUCF separate;
- emissions per person using a year-matched population denominator;
- cumulative emissions where the source and start year are explicit;
- consumption emissions only when a reliable attributed source is available.

Output bands are `very_high`, `high`, `medium`, `low`, and `not_assessed`.
Thresholds will be versioned and published before release.

### 2. Target integrity

This axis asks whether the commitment can be understood and normalized.

Outputs:

```text
comparable
partially_comparable
non_comparable
qualitative_or_sectoral
no_active_target_found
not_assessed
```

Target integrity is not target ambition. A clearly specified weak target may
be comparable, while a potentially strong but underspecified target may not be.

### 3. Ambition

Ambition compares an eligible target with separately identified benchmarks:

- progression from the country's previous NDC;
- a modelled domestic 1.5°C-compatible pathway;
- a fair-share range reflecting responsibility and capability;
- independent assessments such as CAT where covered and licensed.

The domestic-pathway and fair-share results remain separate. The project will
not invent independent benchmark coverage for countries not assessed by a
source.

Candidate outputs are `aligned`, `almost_sufficient`, `insufficient`,
`highly_insufficient`, `critically_insufficient`, and `not_assessed`.

### 4. Delivery

Delivery has two distinct tests:

1. **Recent pace versus required pace** using a measured, scope-matched annual
   series.
2. **Current-policy projection versus target** where an attributed independent
   or official projection is available.

Outputs are `ahead`, `on_pace`, `uncertain`, `off_course`, and `not_assessed`.
These are not predictions that a country will or will not meet its target.

### 5. Fair contribution

Fair contribution presents responsibility, capability, domestic action, and
international support without letting one erase another. Provider and recipient
roles, commitments and disbursements, loans and grants, and provided/mobilized/
needed/received finance remain distinct.

This axis will remain contextual until its evidence semantics and licensing
pass a separate review.

### 6. Evidence quality

Evidence quality is independent of performance:

- **A:** current primary or approved harmonized source, complete scope,
  reproducible lineage, reviewed, and no unresolved material conflict;
- **B:** sufficient for the stated assessment with bounded limitations;
- **C:** estimated, stale, partial, or dependent on material assumptions;
- **D:** insufficient for a public performance assessment.

The letter is always accompanied by reason codes. A low evidence grade never
improves another axis.

## Target comparability

An absolute target or emissions gap may be calculated only when these inputs
are known and scope-compatible:

1. target year or period;
2. reference year and value, or a reproducible baseline;
3. gas basket and global-warming-potential convention;
4. sector and geographic coverage;
5. LULUCF and removals treatment;
6. conditional and unconditional portions;
7. Article 6 transfer treatment;
8. primary source and methodological assumptions.

### Target-type rules

- **Base-year:** use the stated reduction only with a scope-matched inventory
  for the stated base year.
- **BAU:** require the published BAU scenario, vintage, and target-year value.
  Current emissions are not a BAU proxy.
- **Intensity:** require the stated denominator and a compatible observed and
  target-year denominator series. Fossil-emissions momentum is not a proxy.
- **Fixed level:** preserve the official absolute value or range and its scope.
- **Trajectory or peaking:** preserve the official indicator/pathway; do not
  invent a linear decline.
- **Sectoral or qualitative:** do not produce an economy-wide gap.
- **Net zero:** record year, gases, sectors, residual emissions, removals,
  offsets, and interim targets. “Net zero” alone is not a pathway.

Failure returns `non_comparable` plus a machine-readable reason. It never
returns “No target,” zero, or a favorable performance band.

## Delivery calculations

For a comparable target and latest observation:

```text
required_rate =
  (target_emissions / latest_emissions) ^
  (1 / (target_year - latest_year)) - 1
```

Observed pace must use a scope-matched measured annual series with at least six
observations. The implementation should use a robust log-linear trend and
retain an uncertainty interval.

- `on_pace`: the observed interval is at least as fast as the required pace;
- `off_course`: the complete observed interval is slower;
- `uncertain`: the intervals overlap;
- `not_assessed`: observations or compatible target evidence are insufficient.

The public chart distinguishes measured points, reported uncertainty, target
endpoints, and any illustrative required pathway. Modeled values cannot be
drawn or described as measurements.

## Missing, uncertain, and conflicting evidence

Allowed states include:

```text
available            estimated             modeled
not_reported         not_assessed          non_comparable
not_applicable       not_yet_due           reporting_optional
stale                conflicting           withheld
source_unavailable   not_reviewed
```

Hard rules:

- `null` is never coerced to `0` or `false`;
- missing CAT coverage is not a CAT rating;
- missing delivery evidence is not “off track”;
- missing evidence cannot produce green or lower visual prominence;
- no calculation crosses incompatible scopes or accounting frames;
- source precision and uncertainty limit displayed precision;
- LULUCF remains separate unless an uncertainty-aware compatible total exists;
- SIDS/LDC reporting flexibility is not scored as failure.

## Provenance and versioning

Every published fact or result carries:

```text
fact_id and country_id
metric, value, unit, period, scope
source publisher, title, version, URL/DOI, locator
publication/submission and retrieval dates
checksum, licence, attribution
evidence class and uncertainty
input fact IDs, transformation, formula version
methodology_version and data_release_id
calculated_at and calculation_hash
quality_status and review_status
```

Methodology versions follow semantic versioning. Data releases are immutable
dated snapshots. Every changed country result receives a generated explanation
identifying a source revision, target update, inventory revision, review
correction, or methodology change.

## Publication eligibility

A country may receive a delivery assessment only when:

- a compatible target and measured series pass the schema and comparability
  gates;
- the calculation is deterministic and covered by target-type fixtures;
- all displayed facts have approved source and licence records;
- unresolved source conflicts are either resolved or disclosed within the
  permitted quality threshold;
- an independent reviewer approves manually interpreted target evidence.

All mapped countries remain visible even when these conditions are not met.

## Governance

Changing axis meaning, thresholds, aggregation, or comparability rules requires
a major methodology version and architectural review. Adding a source or metric
without changing meaning is a minor version. Correcting a calculation or
metadata defect is a patch.

No extractor approves its own target interpretation. Automated source checks
stage candidates only; reviewed releases are compiled and published separately.
