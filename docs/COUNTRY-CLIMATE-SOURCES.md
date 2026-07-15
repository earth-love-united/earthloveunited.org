# Country Climate Evidence Sources and Reuse Rules

**Registry version:** 0.1.0

**Methodology version:** 0.1.0

**Reviewed through:** 2026-07-15

**Machine-readable authority:** `data/climate/source-registry.json`

## Purpose

This document explains which source releases may contribute to the Country
Climate Profile and which are blocked by licensing or reuse uncertainty. It is
not a bibliography and does not authorize ingestion by itself. The JSON
registry is the enforceable, versioned decision record.

The registry is non-runtime governance data. The browser does not load it.
Offline acquisition and compilation code must reject any source unless:

```text
approval.state == approved
redistribution.normalized_values == true
licence.status == confirmed
redistribution.status == permitted
```

Public availability, an API, a download button, or use by another website does
not establish redistribution rights.

## Evidence planes

- **Official:** what a Party submitted or what an official review found. NDC,
  BTR, NIR, CRT, CTF, and TER evidence stays in this plane.
- **Harmonized:** one consistently produced scientific comparison series.
  These values never overwrite official reports.
- **Independent:** external assessment of target ambition, policies,
  projections, or finance.
- **Context:** identity, population, and economic denominators used to define
  the comparison universe or calculate contextual rates.

## Approval matrix

| Registry ID | Plane / domain | Exact release | Reuse decision | Public normalized values |
|---|---|---|---|---|
| `un-m49-continuous-2026-07-15` | Context / identity | Continuous snapshot, 2026-07-15 | **Pending** — general UN terms do not grant public derivative-database redistribution | No |
| `unfccc-ndc-registry-continuous-2026-07-15` | Official / targets | Registry snapshot, 2026-07-15 | **Pending** — UNFCCC unchanged-document permission and Party-specific notices do not yet settle normalized extraction | No |
| `unfccc-btr-continuous-2026-07-15` | Official / progress, policy, CTF finance | First BTR cycle snapshot, 2026-07-15 | **Pending** — links and citation only until extraction rights are approved | No |
| `unfccc-nir-crt-2026-cycle` | Official / inventory | 2026 submission cycle | **Pending** — official values require a normalized-data reuse decision | No |
| `unfccc-ter-continuous-2026-07-15` | Official / expert review | Continuous snapshot, 2026-07-15 | **Pending** — unchanged official report may be archived; normalized findings are blocked | No |
| `gcp-gcb-2025-v1.0` | Harmonized / fossil and land-use CO2 | GCB 2025 v1.0, DOI `10.18160/GCP-2025` | **Approved** — CC BY 4.0 | Yes |
| `primap-hist-2.7-final` | Harmonized / economy-wide GHG | PRIMAP-hist 2.7 final | **Pending** — CC BY-NC-SA 4.0 needs commercial-context and share-alike approval | No |
| `edgar-2025-ghg-non-iea-components` | Harmonized / non-CO2 GHG | EDGAR_2025_GHG | **Approved by component** — EU-owned CC BY 4.0 material only | Yes |
| `iea-edgar-co2-v4-2025` | Harmonized / fossil CO2 | IEA-EDGAR CO2 v4 | **Excluded** — CC BY-NC-ND 4.0; normalization is a derivative | No |
| `cat-continuous-2026-07-15` | Independent / ambition and policy | Continuous snapshot, 2026-07-15 | **Pending** — CAT terms permit credited non-commercial use only | No |
| `un-wpp-2024` | Context / population | World Population Prospects 2024 | **Approved** — CC BY 3.0 IGO | Yes |
| `world-bank-wdi-2026-07-01` | Context / economic denominators | WDI catalog release, 2026-07-01 | **Approved conditionally** — CC BY 4.0; indicator-level third-party metadata must also pass | Yes |
| `oecd-climate-finance-2013-2024` | Independent / finance | Report released 2026-05-21, DOI `10.1787/ab5eb9ad-en` | **Pending** — mixed UNFCCC, DAC, MDB, export-credit, and private-finance inputs need item-level review | No |

## Approved acquisition paths

### Global Carbon Budget 2025

- Dataset DOI: [10.18160/GCP-2025](https://doi.org/10.18160/GCP-2025)
- Version: 2025 v1.0
- Licence: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Use: harmonized national fossil CO2 and land-use-change CO2, retained as
  separate series.
- Attribution: cite the Global Carbon Project release and identify conversions,
  filtering, and other changes.

The ICOS collection record explicitly applies CC BY 4.0 to the release's three
spreadsheets. This versioned record controls over a generic “fair use” statement.

### EDGAR_2025_GHG

- Release page: [EDGAR_2025_GHG](https://edgar.jrc.ec.europa.eu/dataset_ghg2025)
- Licence for EU-owned content: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Approved use: CH4, N2O, F-gases, and other fields explicitly covered by the
  EU-owned-content statement.
- Mandatory denylist: every IEA-EDGAR CO2 file and field.

EDGAR's conditions assign IEA-EDGAR CO2 v4 a separate CC BY-NC-ND 4.0 licence.
That component is a different registry record and is excluded. An extractor
must select approved components, not trust the publisher or release name alone.

### World Population Prospects 2024

- Release: [World Population Prospects 2024](https://population.un.org/wpp/)
- Licence: [CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/)
- Use: year-matched population denominators.
- Required labels: preserve whether a value is an estimate or projection.

### World Development Indicators

- Dataset: [World Development Indicators](https://datacatalog.worldbank.org/search/dataset/0037712/world-development-indicators)
- Catalog version used for this decision: updated 2026-07-01
- Licence: [CC BY 4.0](https://datacatalog.worldbank.org/public-licenses)
- Use: economic denominators only after matching year, price basis, currency,
  and indicator definition.

The WDI-level approval is not a waiver for third-party indicators. Acquisition
must preserve each indicator's provider and licence metadata and reject an
exception that does not independently pass.

## Pending sources

### UN M49 identity

[UN M49](https://unstats.un.org/unsd/methodology/m49/) is the accepted entity
base, but the general [UN website terms](https://www.un.org/en/about-us/terms-of-use)
do not grant redistribution or derivative-database rights. Until UNSD supplies
a source-specific open-data statement or written permission, the project may
link to M49 and use it for internal design, but may not copy its names, codes,
or grouping flags into a public compiled registry.

### UNFCCC official evidence

The [UNFCCC terms](https://unfccc.int/this-site/terms-of-use) say official texts,
data, and documents are public domain and may be copied unchanged with source
acknowledgement. They also contain a general personal/non-commercial limit, and
Party-submitted documents can carry specific notices. The permission to copy an
unchanged document does not clearly authorize a transformed public database.

Pending records therefore cover:

- [NDC Registry](https://unfccc.int/NDCREG): target text and commitments;
- [BTR submissions](https://unfccc.int/biennial-transparency-reports): progress,
  policies, projections, and common tabular-format finance;
- NIR and CRT files in the [UNFCCC reports catalog](https://unfccc.int/reports):
  official inventories;
- TER reports: independent technical findings within the official plane.

Agents may stage document metadata, URLs, submission dates, locators, and
checksums. They may not publish normalized values until a written extraction
policy is approved. Every Party document must also be checked for an overriding
copyright notice.

### PRIMAP-hist 2.7

[PRIMAP-hist 2.7](https://doi.org/10.5281/zenodo.17090760) changed to
CC BY-NC-SA 4.0. Its country-reported and third-party-priority series also have
different commercial-licensing possibilities. No data may be ingested into a
public profile until the intended use is confirmed as compatible or a suitable
licence is obtained.

### Climate Action Tracker

[CAT's legal terms](https://climateactiontracker.org/about/legal/) permit
credited reproduction and distribution only for non-commercial use. CAT remains
the preferred independent benchmark where covered, but its ratings, pathways,
and projections are metadata/link-only until written permission or an approved
licence is recorded. Missing CAT coverage remains `not_assessed`.

### OECD climate finance

The current reference is [Climate Finance Provided and Mobilised by Developed
Countries in 2013–2024](https://doi.org/10.1787/ab5eb9ad-en). OECD data terms
are broadly permissive but explicitly defer to dataset-specific and third-party
rights. The report combines several reporting systems and does not by itself
provide a clean provider-country profile source.

Before approval, the finance mission must select exact tables or datasets and
separately preserve:

- provided versus mobilized amounts;
- public versus private finance;
- bilateral, multilateral, and export-credit flows;
- commitment versus disbursement;
- provider versus recipient;
- grant, loan, equity, guarantee, and other instruments;
- climate theme and attribution method.

## Storage and release rules

1. Raw third-party datasets are never committed to this repository by default.
   Store immutable versions externally and record a cryptographic checksum.
2. A continuously updated web source requires a retrieval-date snapshot. A
   label such as “latest” is not a version.
3. Every normalized fact records the registry source ID and the exact input
   file, document, page/table/cell, release, retrieval date, and checksum.
4. Source-specific attribution text travels into the release manifest and
   public evidence drawer.
5. A new source starts as `pending`. An agent cannot infer approval from a
   similar source, older version, publisher, or upstream citation.
6. A source release, licence, URL, or upstream-component change requires a
   registry version change and renewed validation.
7. `excluded` means acquisition and normalized redistribution are prohibited.
   Metadata and links may remain so the exclusion is auditable.
8. Publication code must fail closed if an approval record is missing,
   contradictory, or expired by a later release.

## Validation

Run:

```sh
node tools/check-climate-source-registry.js
node --check tools/check-climate-source-registry.js
```

The validator checks required domain coverage, exact or retrieval-dated
versions, HTTPS source and terms URLs, attribution and storage fields, unique
IDs, and the fail-closed approval invariants. It deliberately does not claim to
verify live URLs or make a legal determination.

## Unresolved decisions requiring human approval

1. Whether Earth Love United's current and foreseeable use qualifies as
   non-commercial for PRIMAP-hist and CAT.
2. Whether CC BY-NC-SA is compatible with the licence intended for compiled
   country evidence; if not, obtain a separate PRIMAP licence.
3. Whether normalized factual extraction from UNFCCC official and
   Party-submitted documents is authorized under the current terms.
4. Whether UNSD will authorize redistribution of an M49-derived entity table.
5. Which exact OECD finance datasets and disclosure rules are suitable for
   country-level provider and recipient facts.
6. Whether the IEA will authorize transformed IEA-EDGAR CO2 data. Until then,
   GCB is the approved fossil-CO2 source and IEA-EDGAR CO2 remains excluded.

These decisions are gates, not documentation tasks. They must not be resolved
by an extractor or compiler agent.
