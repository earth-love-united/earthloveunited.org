# CT-17 Source-Rights Review Packets

CT-17 prepares five decision-ready evidence packets for an authorized independent
rights reviewer. For PRIMAP, the packet covers assessment, scoring, derivative
database, and other uses beyond the already approved factual-display and
magnitude-comparison tiers. It does not make a new legal determination, change
the source registry, approve new normalized-fact uses or scoring, change CT-40,
or authorize an assessed release.

The committed bundle remains `requires_authorized_review`. Every decision ID and
reviewer ID is `null`; every approval boolean is `false`. A reviewer must issue a
separate decision artifact rather than filling or converting this evidence bundle
in place.

CT-17 does not suspend the existing PRIMAP source-registry decision or CT-10C
batch attestation. CT-40 continues to mark all 2,060 PRIMAP facts eligible for
factual display and magnitude comparison. The empty CT-17 decision record is for
broader assessment/scoring review, not evidence that factual climate information
is prohibited.

## Scope

The bundle covers:

1. PRIMAP-hist v2.6.1 final, exact CSV
   `Guetschow_et_al_2025-PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv`, pinned to
   SHA-256 `7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9`.
2. UNFCCC NDC Registry metadata and Party NDC documents.
3. UNFCCC NIR/NID and CRT submission packages.
4. UNFCCC BTR textual reports and explicit CTF/CRT components.
5. UNFCCC Technical Expert Review reports and normalized findings, with TER kept
   corroboration-only under CT-16.

The four UNFCCC family packets do not claim to capture any Party document. Their
document-ID and checksum arrays are empty until exact files are acquired and
reviewed separately. No raw or large source download is committed.

## Official evidence recorded on 2026-07-15

These are factual observations from primary pages, not Earth Love United rights
decisions:

- The [PRIMAP v2.6.1 Zenodo record](https://zenodo.org/records/15016289)
  identifies the version and DOI, labels the record CC BY 4.0, and lists the exact
  main CSV with MD5 `09b9c61629f87e16012222e5b303bc36`. Zenodo does not display
  the project-pinned SHA-256 on that page.
- The [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode.en)
  covers sharing and adaptation subject to attribution and change-notice
  conditions, while limiting the grant to rights the licensor can authorize.
- The [UNFCCC Terms of Use](https://unfccc.int/this-site/terms-of-use) contain an
  unchanged-and-acknowledged public-domain statement for official texts, data and
  documents. The same page separately describes personal, non-commercial copying
  without resale, redistribution, compilation or derivatives and makes use
  subject to content-specific restrictions.
- The [NDC Registry](https://unfccc.int/NDCREG) is described as the public registry
  maintained under Paris Agreement Article 4(12) and exposes Party, version,
  status, submission-date and file information.
- The live [UNFCCC Reports catalogue](https://unfccc.int/reports) lists NIDs/NIRs,
  CRTs, BTRs and related artifacts with Party and submission metadata.
- The [BTR overview](https://unfccc.int/biennial-transparency-reports) distinguishes
  the textual report, inventory CRTs and progress/support CTFs and describes an
  NIR as the NID plus CRTs.
- [Reporting and Review](https://unfccc.int/reporting-and-review) states that the
  secretariat publishes Party submissions and technical expert review reports.
  The [First BTR table](https://unfccc.int/first-biennial-transparency-reports)
  links submissions, annexes, TERR symbols and FMCP outputs as they become
  available.

## Project inferences that require human judgment

CT-17 does not resolve the following points. It labels them
`project_inference_for_authorized_review`:

- The two UNFCCC terms clauses may lead to different answers for unchanged files,
  registry metadata, normalized factual extraction, derivative databases,
  commercial use and scoring.
- Public availability, a registry listing or a download link is not sufficient
  evidence of permission.
- Party-authored submissions, translations, annexes and revisions may require
  document-specific review even when hosted by UNFCCC.
- Normalization, unit conversion, table parsing, aggregation, paraphrasing and
  scoring may fall outside unchanged-document use.
- A record-level PRIMAP licence may not answer every obligation inherited from
  incorporated source datasets for assessment, scoring, and derived database
  outputs beyond the existing limited factual tier; this needs rights-review
  judgment.

## Required authorized-review outcome

Each separate decision record must identify the exact reviewer and independence
basis, exact version and checksums, controlling licence evidence or written
clarification, rights-holder authority, resolution of conflicting terms and
document-specific exceptions. It must decide source-file, metadata, normalized
value, redistribution, derivative-database, commercial, transformation, scoring
and attribution uses, plus the exact attribution template, change notice,
restrictions, decision scope, source-registry transition, recheck date and notes.
The checker also asserts that this field set is a superset of the exact decision
contract embedded in the immutable CT-15 work package; no alias translation is
left to the reviewer.

Questions that specifically require counsel or a human rights reviewer include:

- Which UNFCCC clause controls unchanged files, Party submissions and normalized
  facts, and who can authorize each use?
- Does unchanged-document permission extend to extracting and redistributing
  normalized facts or findings?
- Is written UNFCCC, Party or joint clarification required for commercial public
  display, derivative databases and scoring?
- Beyond factual display and magnitude comparison, does PRIMAP's record-level
  CC BY 4.0 statement sufficiently cover assessment, scoring, derivative
  database outputs, and any surviving source-specific duties?

## Artifacts and checks

- Bundle: `data/climate/reviews/source-rights-review-packets-2026-07-15.json`
- Schema: `data/climate/schemas/source-rights-review-packet.schema.json`
- Deterministic compiler: `tools/lib/source-rights-review-packets.js`
- Builder: `tools/build-source-rights-review-packets.js`
- Checker: `tools/check-source-rights-review-packets.js`
- Adversarial fixtures: `data/climate/fixtures/source-rights-review-packets.json`

Run:

```bash
node tools/build-source-rights-review-packets.js --check
node tools/check-source-rights-review-packets.js
node tools/check-climate-source-registry.js
node tools/check-climate-evidence-licensing-readiness.js
node tools/check-source-routing-policy.js
```

The CT-17 checker rejects adversarial mutations after recalculating the bundle
hash, including fabricated identities or approvals, changed exact scope, invented
UNFCCC documents, non-authoritative evidence URLs, altered immutable inputs,
source-registry changes, a changed CT-40 assessed denial, or suppression of the
eligible factual tiers.
