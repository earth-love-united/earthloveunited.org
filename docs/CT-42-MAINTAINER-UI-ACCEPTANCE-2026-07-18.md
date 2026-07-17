# CT-42 maintainer UI acceptance — 2026-07-18

## Coordinate and decision

- Frozen subject commit: `a476147c3fd33178020da077b828242d63fa360e`
- Reviewer: Ekmel, Earth Love United maintainer and routine site reviewer
- Environment: Google Chrome on macOS; browser version not captured; no assistive technology used
- Evidence-capture window: `2026-07-17T21:03:28Z` through `2026-07-17T21:21:48Z`
- Maintainer UI acceptance: **PASS**
- Gate summary: **6 PASS, 9 UNTESTED, 0 FAIL**

No blocking defect was observed in the tested scope. `UNTESTED` is an open
concern, not a pass and not a failure. This maintainer acceptance does not
replace the separate independent 15-gate review in
`data/climate/reviews/climate-factual-runtime-ct42-ui-review.json`. That review
remains bound to its exact 23 runtime-file hashes; the same hashes are verified
against the current tree.

## Gate log

| Gate | Result | Observation |
|---|---|---|
| runtime-boundary | PASS | The exact 23-file subject and pinned globe.gl 2.46.1 dependency passed integrity checks. |
| truth-language | PASS | Factual-display disclaimers were visible; no climate scores or performance judgments were presented. |
| magnitude-and-gaps | PASS | Reviewed entities displayed sourced magnitudes; Palestine displayed a clear no-estimate, unranked source-gap card. |
| chart-table-source | PASS | Chart-data disclosure worked and source links resolved to the PRIMAP-hist Zenodo record. |
| screen-reader-semantics | UNTESTED | No screen reader was used. |
| keyboard-focus | UNTESTED | A keyboard-only focus cycle was not performed. |
| touch-targets | UNTESTED | No touch device or measured touch-target audit was used. |
| responsive-320 | UNTESTED | A dedicated 320 CSS-pixel viewport was not used. |
| zoom-200 | PASS | The globe and country modal remained usable during an actual 200% browser zoom review. |
| reduced-motion | UNTESTED | The operating-system reduced-motion preference was not enabled. |
| contrast | UNTESTED | No formal contrast measurement was performed. |
| color-removal | UNTESTED | No grayscale or color-removal test was performed. |
| polygon-render | PASS | Country polygons rendered, country cards opened, and the globe focused on the selected country. |
| fallback-render | UNTESTED | The automated fallback checker passed, but WebGL was not deliberately disabled by the reviewer. |
| smoke-and-stack | UNTESTED | The release page does not load the developer-only browser harness; release-specific machine checks passed separately. |

## Review observations

- The country views use visible factual-display disclaimers and neutral language.
- Source gaps remain explicit instead of receiving invented estimates.
- Country selection, country cards, chart disclosure, source links, and globe focus worked.
- The site felt smooth in routine use and at 200% zoom.
- `Back to [country] in the list` was recorded as a redundant, non-blocking usability control.
- Untested accessibility items remain open follow-up concerns.

## Evidence hashes

The review packet retains the supplied screenshots. Their SHA-256 digests are:

| Ref | SHA-256 | Observation |
|---|---|---|
| E1 | `b9a67f98ae08d74659adf45b8c8e4d23da514da1d10368c29526c82a34ea2315` | Globe, rank rail and country modal |
| E2 | `5fcbd03dbde7278a82ad9daa5b556293f46092aefe6e48fb984d78b61463e6cc` | Searchable evidence browser |
| E3 | `68d76493fe1b157a6ea0ce267db2ebe4dc4e3bebe23f9ecfcb05cb292c7e1bee` | Foundation methodology view |
| E4 | `9b994e5a38916fabf6b793dfc181b857c5215bf435ea0efc4347cb4f5ec5563f` | Palestine source-gap card |
| E5 | `a0144646d8654e8ee165fd3bae0d0f0767074e05ac236441c573cfe504b5b630` | Actual 200% zoom |
| E6 | `ad87bab98f2fdff7566d4b358bb3e2bee827c379cf50bfb8f6c26e80c955569b` | Redundant back-to-list control |
| E7 | `2db77aa5791d17fd29756a3565b7705e16359938e4587c311b6a258868f1f790` | Chrome/macOS reviewer identity context |

## Boundary

This record accepts the tested factual UI scope. It does not assert that the
nine untested gates passed, does not reassess climate data lineage, and does
not itself grant legal, climate-claim, cryptographic-signing, deployment, or
publication authority.
