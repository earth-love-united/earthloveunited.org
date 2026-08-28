# Superseding final scientific/data-method report

Reviewer: `ai-reviewer:luna-science` — second/final Luna scientific pass
Model: `gpt-5.6-luna`
Scope: source semantics, evidence classes, formulas, derivations, gaps, 249-entity mapping, and factual-public boundaries.

Subject digest: `3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200`
Review-request SHA-256: `0904afc65386a570871fdc77262a8beb6da8f19043a3d1f235edefd4f96d0372`

The test-rail changes do not alter the scientific source records, formulas, public transforms, or runtime values. Verified runtime SHA remains `4939fbc6e26c0ef0fc283ecf98ab3924ccb93d93b7e5392eab2014f7ab3c57fe`.

## Evidence and commands

- Request SHA, calculation hash, 295 pins, and subject digest recomputed exactly.
- `node tools/climate-truth-ci.js --strict` — PASS.
- CT-45 runtime-assets self-test — PASS: 63/63 policy checks, 149 adversarial mutations rejected, 3 staged symlink cases rejected.
- `node tools/check-country-climate-intelligence-ci.js` — PASS.
- `node tools/check-cci-factual-public-deploy.js --staged _deploy` — PASS: 51 exact files.
- Runtime, derivation, UI, atomic, source-registry, public-boundary, release-gate self-tests, and staged globe-notice checks — PASS.
- Independent invariants — PASS:
  - 249 unique registry entities in all four components and runtime.
  - Lens partitions: carbon `213 + 36`, physical `245 + 4`, power `195 + 54`.
  - 213 per-capita identities, 213 GCB fossil records, 197 land-use records.
  - 490 ERA5 OLS trend records and 490 CMIP6 projection records.
  - Zero gap-encoding or duplicate/missing mapping errors.

## Scientific conclusions

- GCB territorial fossil CO₂ remains separate from land-use CO₂. Territorial 2024 values use source MtC × 3.664; cumulative values cover available 1850–2024 territorial data. Land-use uses the BLUE/OSCAR/LUCE 2015–2024 model mean and population standard deviation.
- WPP has 236 mapped values, explicitly labeled modeled 2024 Medium projections, with the declared `TPopulation1July_thousands × 1000` conversion. Missing denominators remain gaps.
- Ember uses 2019 and 2024 annual actuals, the declared nine-fuel taxonomy, percentage-point five-year change, preserved blanks, and no silent zero substitution or visual normalization. 194 fuel mixes reconcile; Lesotho remains an explicit mix gap.
- CCKP CMIP6 uses the declared SSP1-2.6, SSP2-4.5, and SSP5-8.5 selections, p10/median/p90, the 2040–2059 versus 1995–2014 baseline, ensemble-all-mean country aggregates, and 2,450 reproduced projected values. `ATA`, `ESH`, `FLK`, and `SGS` remain explicit gaps.
- CCKP ERA5 uses 1970–2025 annual country-area aggregates, 56 observations per series, explicit ERA5 reanalysis evidence, and OLS trends per decade. `KSV` remains only the documented upstream exception.
- Climate TRACE is absent from the product evidence boundary, executable public references, and staged output.
- Active boundaries disable composite scores, target assessments, finance judgments, performance grades/language, mismatched-scope comparisons, offset adjustments, and inverted carbon relief.
- No scientific P0/P1 defect was found in the unchanged implementation subject.

## Findings by severity

- P1 condition — Repin the aggregate and report receipts against subject digest `3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200` and request SHA `0904afc65386a570871fdc77262a8beb6da8f19043a3d1f235edefd4f96d0372`, then rerun strict staged integrity. This is the declared final-pinning condition, not a defect in the implementation subject.
- P2 non-CCI infrastructure issue — standalone `check-source-routing-policy.js` still reports the existing immutable source-registry hash mismatch (`6b9e…` actual versus `5c722…` expected). Strict CCI climate-truth passes and the current CCI request pins the actual source-registry bytes; reconcile this separately.

## Limitations

- No live publisher refetch was performed; conclusions rely on exact receipts, pinned hashes, deterministic rebuilds, normalized artifacts, and local checks.
- Several raw sources are upstream-only and unarchived, so future provider/API replacement may prevent exact byte recovery.
- Country-level uncertainty is generally absent; CMIP6 spread is represented, while OLS trend uncertainty is not.
- GCB 2024 is an estimate; WPP 2024 is a projection denominator; ERA5 is reanalysis rather than direct station observation; CCKP precipitation is an annual area mean, not a drought, runoff, or water-availability measure.

This is an AI review, not human institutional scientific review, legal certification, or rights clearance.

```json
{"post_mitigation_verdict":"approve_with_conditions"}
```

## Superseding delta addendum — final Luna science binding

Timestamp: `2026-08-28T03:06:41Z`
Reviewer/model: `ai-reviewer:luna-science` / `gpt-5.6-luna`
Scope: Scientific and data-method integrity; read-only AI review.

Canonical subject digest: `3d044004953cd2d159a58e80384b969258611def6dca144c07f3816fe03e8200`
Review-request SHA-256: `0904afc65386a570871fdc77262a8beb6da8f19043a3d1f235edefd4f96d0372`

The latest delta remains verifier/preparer/request binding only. The vendor fallback is correctly narrow: only `js/vendor/globe.gl.js` with an actual `ENOENT` may use the pinned policy SHA; dangling symlinks, permission errors, other paths, and other filesystem errors propagate and fail closed. In-memory checks confirmed all cases.

The preparer’s external set contains exactly the four generated reports, aggregate, prepublication review, and generated vendor. Canonical request regeneration matches exactly: 295 pins, subject digest, request SHA, and calculation hash.

Strict climate-truth CI passed, including CT-45 63/63 policy checks, 149 adversarial mutations, and 3 symlink cases. Vendor integrity passed 23/23 policy checks and 41 adversarial mutations. CCI CI/release-gate self-tests and the 51-file staged deploy passed. Runtime remains SHA `4939fbc6e26c0ef0fc283ecf98ab3924ccb93d93b7e5392eab2014f7ab3c57fe`, with 249 entities, 26 metrics, and 3 lenses. Exact artifact/public/report path-set checks reject missing, extra, and duplicate pins.

Scientific conclusions and limitations are unchanged. The aggregate and report receipts must be repinned to the canonical subject/request above and the final checker rerun. This is a release-integrity condition, not a scientific defect.

This is an AI review, not human institutional scientific review, peer review, legal certification, or rights clearance.

```json
{"post_mitigation_verdict":"approve_with_conditions"}
```
