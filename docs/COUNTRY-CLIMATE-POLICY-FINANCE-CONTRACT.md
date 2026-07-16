# Country Policy, Projection, and Finance Evidence Contract

**Contract version:** 1.0.0

**Methodology version:** 0.1.0

**Status:** Schemas and fictional fixtures validated; normalized country release blocked

## Boundary

This contract supplies typed inputs for the later delivery and fair-contribution
engines. It does not assess a country, calculate a score, or publish a policy,
projection, or finance value. The first release manifest contains source
metadata and links only because the candidate UNFCCC and OECD source families
have unresolved normalized-redistribution gates.

The three record families are deliberately independent:

1. A **policy measure** says what a jurisdiction has legally adopted and what
   implementation evidence exists. Expected effects and observed effects are
   separate lists and cannot reuse a source fact.
2. A **policy projection** is a named, vintage-specific scenario. It is always
   labelled `scenario_projection_only`; it can inform a delivery comparison
   but can never enter an observed emissions series.
3. A **finance fact** describes one typed amount in one flow stage, role,
   origin, channel, purpose, instrument, currency, price basis, and period. It
   cannot be collapsed into an ambiguous total.

## Alignment with the country evidence contract

- Country identifiers use CT-02's `iso3166-1:AAA` shape. No country registry or
  UN M49 row is copied into this mission.
- Evidence planes use the CT-02 set relevant here: `official`, `harmonized`,
  and `independent`. These records never use `context` or `derived` as a way to
  blur source provenance.
- Review states exactly match CT-02: `not_reviewed`, `in_review`, `reviewed`,
  `rejected`, and `superseded`.
- Release gates use CT-02 reason code `licence_not_approved` and fail closed.
- The fixtures use reserved identifier `iso3166-1:ZZZ` and repeatedly identify
  themselves as fictional. They are contract examples, not country evidence.

## Policy semantics

`policy-measure.schema.json` requires:

- jurisdiction level, name, and geographic boundary;
- legal status, adoption date, and effective date;
- sectors and instrument types;
- implementation status plus fact IDs supporting implementation;
- expected and observed effects in separate collections;
- a source registry ID, document URL, precise locator, version, and retrieval
  date;
- extractor/reviewer separation for reviewed records.

Expected effects accept only modeled or projected methods. Observed effects
accept only measured, evaluated, or officially reported methods. Adoption is
not implementation, and an expected reduction is not an observed reduction.

## Projection semantics

`policy-projection.schema.json` requires:

- evidence plane;
- scenario name and vintage;
- one of `with_measures`, `with_additional_measures`, `without_measures`, or a
  precisely described `other` assumption;
- accounting frame, gases, GWP convention, sectors, LULUCF treatment, and
  geography;
- model name, version, operator, and method;
- unit, strictly increasing unique years, and point-level uncertainty;
- source locator and independent review metadata.

Official and harmonized projections remain separate records even when their
scope appears compatible. Reconciliation is a later, attributed comparison,
not an ingestion rewrite.

## Finance semantics

`climate-finance.schema.json` records exactly one amount and requires:

- flow stage: `provided`, `mobilized`, `committed`, `disbursed`, `needed`, or
  `received`;
- country role: provider or recipient;
- origin: domestic or international;
- channel: bilateral, multilateral, fund, or domestic;
- purpose: mitigation, adaptation, or cross-cutting;
- instrument: grant, loan, guarantee, equity, or other;
- currency and current/constant price basis, including the constant-price base
  year and conversion method;
- period, source locator, evidence plane, uncertainty, and review metadata.

Provided and mobilized facts require a provider role. Needed and received facts
require a recipient role. Domestic origin requires a domestic channel. These
rules prevent a report aggregate, pledge, commitment, disbursement, need, and
receipt from being shown as if they were the same quantity. The legacy
`finance_total_bn` field is prohibited.

## Release gate

`data/climate/releases/policy-finance-2026-07-15/manifest.json` is intentionally
blocked and has a normalized record count of zero.

| Source family | Allowed now | Remaining gate |
|---|---|---|
| UNFCCC BTR submissions and CTFs | Titles, versions, links, cadence, and licence state | Confirm normalized-data redistribution terms before extracting policy, projection, or finance values |
| UNFCCC technical expert review | Titles, versions, links, cadence, and licence state | Confirm normalized-data redistribution terms before extracting reviewed values or findings |
| OECD climate finance | Report/table metadata and links | Approve the exact tables and all component-level third-party rights before country normalization |

Policy projections from independent sources such as Climate Action Tracker are
also outside this release until their separate non-commercial-use gate is
resolved. No source gate can be lifted by inference from another publisher's
terms.

## Validation

Run:

```sh
node tools/check-policy-finance-evidence.js
```

The deterministic invalid suite proves rejection of expected/observed effect
conflation, projection-as-observation, evidence-plane mixing, duplicate
projection years, ambiguous finance totals, provider/recipient inversion,
domestic/bilateral mixing, incomplete constant-price bases, and official-source
records placed on an independent plane.
