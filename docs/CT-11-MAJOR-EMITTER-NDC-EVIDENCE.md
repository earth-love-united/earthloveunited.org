# CT-11 Major-Emitter NDC Evidence Pilot

**Snapshot:** 2026-07-15
**Status:** metadata-only, in review, not release eligible

## Outcome

The legacy globe label “No target” is unsupported for China, India, and
Indonesia. The current UNFCCC registry lists active official submissions for
all three. Iran is a different case: its official 2015 document is an INDC, and
the United Nations Treaty Collection records a Paris Agreement signature but
no ratification or accession. It must not be displayed as either “No target” or
as an active NDC Registry target.

This pilot commits source metadata, direct links, target-type classification,
field-presence states, locators, canonical reason codes, and review gates. It
does not commit Party PDFs, copied Party text, or normalized target values.

## Official source records

| Country | Official record | Registry / portal state | Date | Target shape retained |
|---|---|---|---|---|
| China | UNFCCC, *China’s 2035 National Determined Contributions* | Active NDC | 2025-11-03 | Economy-wide net-GHG trajectory relative to an endogenous peak |
| India | UNFCCC, *India NDC (2031 - 2035)* | Active NDC | 2026-04-24 | GDP emissions-intensity target |
| Indonesia | UNFCCC, *Republic Of Indonesia Second NDC* | Active NDC | 2025-10-27 | 2031–2035 emissions-level target |
| Indonesia | UNFCCC, *Enhanced NDC - Republic of Indonesia* | Active NDC | 2022-09-23 | Separate 2030 unconditional and conditional BAU targets |
| Iran | UNFCCC INDC Published Documents, *INDC Iran Final Text* | INDC portal; no NDC Registry row | portal file modified 2015-11-21 | Separate unconditional and conditional BAU actions |

The Indonesia distinction is deliberate. Its Second NDC says it moves to an
emissions-level target, while the registry continues to expose the Enhanced
NDC and its earlier BAU components as active. The compiler must preserve those
target types and periods rather than overwriting them with one generic pledge.

## Comparability gate

- China remains `non_comparable`: the reference is a future peak year, the
  reference value is not yet reported, an annual trajectory is not supplied,
  and the GWP and Article 6 fields have not passed complete review.
- India remains `non_comparable`: an intensity target needs a compatible
  target-year GDP denominator series, and the gas basket and Article 6 fields
  still require authoritative document review.
- Indonesia’s 2031–2035 fixed-level component and its separate 2030 BAU
  components remain `not_assessed` until the licence gate, scenario-vintage
  verification, and independent review are complete.
- Iran’s components remain `non_comparable`: no fixed BAU vintage or target-year
  BAU level was identified, sector/LULUCF review is incomplete, and its INDC is
  not an NDC under the Paris Agreement registry.

None of these states means “No target,” “on track,” or “off track.”

## Licence and acquisition gate

CT-01 classifies UNFCCC Party-document extraction as `metadata_only` pending a
rights decision. Registry metadata and direct links may be published, while
normalized target facts may not. All five direct PDF acquisition attempts on
2026-07-15 returned a 212-byte Incapsula HTML interstitial instead of the
authoritative PDF; those responses were discarded. The Iran submissions host
also redirected to a maintenance page.

Consequently, every Party-document checksum is explicitly `null` with
`source_unavailable`. Raw files belong in external versioned storage after a
successful, lawful retrieval; they must never be committed under
`data/climate/`.

This raw-file state is separate from content-locator verification. On
2026-07-15 the official UNFCCC PDF indexing/read channel exposed enough of the
authoritative documents to verify the cited pages, tables, and field-presence
states without creating a local raw-file copy. That indexed content supports
an in-review presence audit only. It does not provide or substitute for a
source-file checksum, and it does not authorize copied text or normalized
public values. For China, both related UNFCCC metadata records 497393 and
497392 are retained alongside the registry row and attachment URL.

## Reviewer separation

The extraction is `in_review`. The builder is recorded as
`agent:ct11-primary-source-builder`; `reviewer_id` remains `null`. A reviewer
must be different from the extractor, confirm each locator against the
authoritative file, record permitted source checksums, and approve the licence
gate before any target value can enter a public climate profile.

## Deterministic checks

```sh
node tools/check-major-emitter-ndc-evidence.js
node tools/build-major-emitter-ndc-release.js --check
```

The first command enforces the CT-02 target types, condition types,
comparability states, evidence states, and reason codes. It also rejects raw
PDFs and any normalized value field. The second verifies the immutable audit
checksum and blocked release manifest.
