# Superseding final scientific/data-method report

Reviewer: `ai-reviewer:luna-science` — second/final Luna scientific pass
Model: `gpt-5.6-luna`
Scope: source semantics, evidence classes, formulas, derivations, gaps, 249-entity mapping, and factual-public boundaries.

Subject digest: `6a920fadfa3a245e4544facf2faac5fd0692cc80a4c23fdb7c0cf48bf02073d5`
Review-request SHA-256: `7d7a47e9d2f8cceb1c9d95d26a5f38471062f079c81058ed6f18f182c7319a6e`

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

- P1 condition — The aggregate artifact remains `draft_final_sol_pending`. The Sol report, final authorized status, and calculation hash remain pending. Complete and repin those fields against subject digest `6a920fadfa3a245e4544facf2faac5fd0692cc80a4c23fdb7c0cf48bf02073d5` and request SHA `7d7a47e9d2f8cceb1c9d95d26a5f38471062f079c81058ed6f18f182c7319a6e`, then rerun strict staged integrity. This is the declared final-pinning condition, not a defect in the implementation subject.
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
