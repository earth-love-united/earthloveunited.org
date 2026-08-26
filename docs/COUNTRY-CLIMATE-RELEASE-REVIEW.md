# Country Climate Intelligence v1 — release-review handoff

This is the human and independent-review handoff for the Country Climate Intelligence production decision. It does not grant release authority.

The canonical machine-readable request is:

`data/climate/releases/country-climate-intelligence-v1/review-request.json`

The request is generated from exact artifact bytes by:

~~~sh
node tools/prepare-country-climate-intelligence-review-request.js \
  --subject-commit <candidate-implementation-commit-sha>
~~~

Run that command only after the candidate implementation commit exists. An unbound request is useful for preparation, but the production gate rejects it.

## Review boundary

Country Climate Intelligence has no composite score, target assessment, finance judgment, offset adjustment, or mismatched-scope delta. Historical CT-40 reviews cover a different scored/NDC release and cannot be reused.

A production decision requires all of the following to identify the same release, candidate commit, and exact hashes:

1. release-specific source and rights decisions for every value-producing source;
2. independent discipline reviews for carbon accounting, demography, GHG inventory, power systems, physical climate, reproducibility, UI/accessibility/runtime, and source rights;
3. `release-approval.json`;
4. `reviewed-release-diff.json`;
5. `reviewed-runtime-manifest.json`;
6. an executable `reviewed-rollback-proof.json`;
7. protected-file/CODEOWNERS approval for the reviewed commit;
8. a runtime and release manifest that both self-identify as independently reviewed production artifacts.
9. a separately signed globe-runtime asset approval from the asset-rights reviewer, licensing counsel, and release authorizer.

Missing, partial, stale, self-reviewed, placeholder, non-regular, symlinked, hash-mismatched, or CT-40-derived evidence fails closed.

## Source decisions

| Source | Exact release question | Current blocker |
|---|---|---|
| Global Carbon Budget 2025 v1.0 | Reproduce the two publisher object hashes; verify territorial, cumulative, consumption, transfer-sign, and three-model land-use selections; approve release attribution and normalized redistribution. | Independent receipt, science, and rights attestations are not signed. |
| UN WPP 2024 | Pin the exact input file and receipt; confirm that the 2024 Medium value belongs to the projection period; approve `population.wpp_medium_projection`, the per-capita denominator lineage, CC BY 3.0 IGO attribution, and change notice. | Raw receipt and demography review are missing. |
| Climate TRACE API v7 response, 2026-08-24 | Bind the exact response to an immutable inventory release; resolve every selected field against the terms-page external-dataset exceptions; verify AR6 GWP100, estimate status, gas/sector filters, and forestry/LULUCF exclusion. | Immutable release identity, raw receipt, field-level rights, and inventory review are unresolved. |
| Ember Yearly Electricity Data, 2026-08-25 | Reproduce the pinned long-format snapshot; verify actual-year selection, aggregate/fuel taxonomy, blank-versus-zero behavior, reconciliation, intensity, emissions, and five-year change; approve attribution and redistribution. | Independent receipt, power-systems, and rights attestations are not signed. |
| CCKP CMIP6 response, 2026-08-24 | Pin the response or individual model files, model roster, parameters, and country aggregation chain; resolve CCKP and source-model licence obligations; verify scenarios, percentiles, baseline, and gaps. | Raw receipt, model roster, derivative rights, and physical-climate review are unresolved. |
| CCKP ERA5 responses, 2026-08-25 | Reproduce the temperature and precipitation response/normalization hashes; resolve CCKP processing and ERA5 attribution; verify annual semantics, units, 1970–2025 selection, OLS, KSV exception, and four gaps. | Independent receipt, derivative-rights, and physical-climate attestations are not signed. |

Climate TRACE is deliberately named by the retained API route and retrieval date. The response-reported `5.9.0` value is metadata, not proof of an immutable v5.9.0 release archive.

WPP is deliberately named `population.wpp_medium_projection`. The UN methodology places 1 January 2024 at the start of the projection interval; no reviewer should approve the legacy `population.estimate` identity.

## Reviewer independence

The candidate builder cannot sign an independent review, source decision, protected-file review, or final approval. At least four distinct independent people must cover the eight discipline roles. A source-rights decision must state the reviewed source version, exact receipts, selected fields, normalized-value and derivative-database permissions, attribution text, required notices, external-dataset exceptions, and any expiry/recheck date.

Review reports and rights decisions must be regular repository artifacts with exact SHA-256 pins. A URL or prose assertion without a pinned decision/report is supporting evidence, not approval.

## Exact release chain

The CCI-specific chain is intentionally separate from the historical `data/climate/runtime-manifest.json` CT-40 chain:

~~~text
bound review-request.json
  → release-approval.json
  → reviewed-runtime-manifest.json
  → reviewed-release-diff.json
  → executable reviewed-rollback-proof.json
  → tools/check-country-climate-intelligence-release-gate.js --require-release
  → three-role signed globe-runtime asset approval
  → tools/check-public-climate-release-profile.js --release
  → release-mode public staging
~~~

The reviewed runtime manifest must pin the request subject, approval, runtime, source registry, source receipts, components, compilers, public entrypoints, CSS, service worker, and accessibility/runtime checks. The release diff then pins the request, approval, and runtime manifest. The rollback proof pins that complete release package and must successfully restore a prior reviewed baseline in an isolated rehearsal.

## Commands

Candidate integrity:

~~~sh
node tools/check-country-climate-intelligence-ci.js
node tools/check-country-climate-intelligence-release-gate.js
node tools/check-public-climate-release-profile.js --candidate
~~~

Expected before external review: the first command passes and the second reports a fail-closed candidate.

Production decision:

~~~sh
node tools/check-country-climate-intelligence-release-gate.js --require-release
node tools/check-public-climate-release-profile.js --release
./tools/build-deploy.sh --release
~~~

The strict gate must remain red until the exact external decisions and independent reports exist. Passing candidate checks never implies production authority or deployment authority.

The selector does not approve data, rights, science, protected files, or
assets. It only prevents a CCI release from falling through to CT-40 authority
and prevents legacy bytes from borrowing a CCI package. Source and final
staged entrypoints must resolve to the same exact profile and generation.
Its CI state is also fail-closed: zero active-profile authority artifacts route
to candidate validation, the complete canonical package routes to release
validation, and every partial or cross-profile package is rejected before a
profile validator runs.
The runtime-diff boundary consumes that exact state: CCI candidate changes are
checked against CCI's own false source-rights/scientific-review gates, while a
complete CCI package routes to the CCI reviewed-release gate. CT-42 candidate
or strict-release evidence is evaluated only for `legacy_ct40`.

The CI job named `Factual-public deploy gates` remains profile-exclusive. For
`legacy_ct40:candidate` it may run only the explicitly limited factual-display
builder and independent staged checks. Here `candidate` describes the absence
of a complete assessed-release authority package; the separately reviewed
`factual_display` tier is not a candidate preview and cannot publish targets,
scores, derived judgments, or CCI values. The builder and final factual verifier
both require the exact legacy state through `--factual-display`.
`legacy_ct40:release` bypasses that narrow tier and must run the normal
release-mode builder, final staged verifier, and signed asset gate. Candidate
`cci` must prove exclusion from the legacy path and must not materialize a
legacy factual-display deploy directory. An approved `cci` package likewise
runs the normal release-mode builder and final staged verifier.
The downstream browser-smoke job uses the same detected phase. Its candidate
lane is validation evidence only and cannot promote the CCI runtime.

The final aggregate verifier records exact SHA-256 fingerprints for every
active release-authority artifact before child checks, reruns the complete
profile policy after the precheck window, and rejects any active or cross-profile
authority-package drift before returning success. This is independent of the
source/staged runtime-byte parity check and is required for both CCI and legacy
full releases.
