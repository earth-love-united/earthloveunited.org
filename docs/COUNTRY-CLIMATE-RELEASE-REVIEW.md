# Country Climate Intelligence v1 — release-review handoff

This is the human and independent-review handoff for the Country Climate Intelligence production decision. It does not grant release authority.

The canonical machine-readable request is:

`data/climate/releases/country-climate-intelligence-v1/review-request.json`

The request is generated from exact artifact bytes by:

~~~sh
node tools/prepare-country-climate-intelligence-review-request.js
~~~

Run that command only after every governed candidate file is final. The request
binds the exact sorted artifact pins and required-absent paths with one canonical
SHA-256 digest. Any later governed-byte or exclusion-boundary change requires a
new request and new reviews; Git commit identity and ancestry are deliberately
not release-authority coordinates because the repository lands pull requests by
squash merge.

## Review boundary

Country Climate Intelligence has no composite score, target assessment, finance judgment, offset adjustment, or mismatched-scope delta. Historical CT-40 reviews cover a different scored/NDC release and cannot be reused.

A production decision requires all of the following to identify the same release, canonical subject digest, and exact hashes:

1. release-specific source and rights decisions for every value-producing source;
2. independent discipline reviews for carbon accounting, demography, power systems, physical climate, reproducibility, UI/accessibility/runtime, and source rights;
3. `release-approval.json`;
4. `reviewed-release-diff.json`;
5. `reviewed-runtime-manifest.json`;
6. an executable `reviewed-rollback-proof.json`;
7. `release-signatures.json`, with verified detached Ed25519 signatures from all seven discipline reviewers and the release authorizer over the exact five-artifact package;
8. a provisioned, protected CCI release trust registry whose exact hash is pinned by the reviewed subject and verifier;
9. protected-file/CODEOWNERS approval for the reviewed artifact-pin digest;
10. a runtime and release manifest that both self-identify as independently reviewed production artifacts;
11. a separately signed globe-runtime asset approval from the asset-rights reviewer, licensing counsel, and release authorizer.

Missing, partial, stale, self-reviewed, placeholder, non-regular, symlinked, hash-mismatched, or CT-40-derived evidence fails closed.

## Source decisions

| Source | Exact release question | Current blocker |
|---|---|---|
| Global Carbon Budget 2025 v1.0 | Confirm the independently reproduced publisher hashes; verify territorial, cumulative, consumption, transfer-sign, and three-model land-use selections; approve release attribution and normalized redistribution. | Science and release-owner rights attestations are not signed. |
| UN WPP 2024 | Confirm the exact current official gzip and receipt; verify that 2024 Medium belongs to the projection period; approve `population.wpp_medium_projection`, per-capita lineage, CC BY 3.0 IGO attribution, and change notice. | Exact receipt is pinned; demography and release-owner rights reviews remain open. |
| Ember Yearly Electricity Data, 2026-08-25 | Confirm the independently reproduced long-format snapshot; verify actual-year selection, aggregate/fuel taxonomy, blank-versus-zero behavior, reconciliation, intensity, emissions, and five-year change; approve attribution and redistribution. | Power-systems and release-owner rights attestations are not signed. |
| CCKP CMIP6 responses, re-fetched 2026-08-27 | Confirm ten exact `ensemble_all_mean` country responses and their parameters; verify scenarios, percentiles, baseline, aggregation, and gaps; approve CCKP CC BY 4.0 with WCRP/ESGF acknowledgement. | All 2,450 mapped values reproduce exactly; physical-climate and release-owner rights reviews remain open. |
| CCKP ERA5 responses, 2026-08-25 | Confirm the independently reproduced temperature and precipitation hashes; approve CCKP CC BY 4.0 and ERA5/Copernicus attribution; verify annual semantics, units, 1970–2025 selection, OLS, KSV exception, and four gaps. | Physical-climate and release-owner rights attestations are not signed. |

WPP is deliberately named `population.wpp_medium_projection`. The UN methodology places 1 January 2024 at the start of the projection interval; no reviewer should approve the legacy `population.estimate` identity.

## Reviewer independence

The candidate builder cannot sign an independent review, source decision, protected-file review, or final approval. At least four distinct independent people must cover the seven discipline roles. A source-rights decision must state the reviewed source version, exact receipts, selected fields, normalized-value and derivative-database permissions, attribution text, required notices, external-dataset exceptions, and any expiry/recheck date.

Review reports and rights decisions must be regular repository artifacts with exact SHA-256 pins. A URL or prose assertion without a pinned decision/report is supporting evidence, not approval.

Reviewer IDs, timestamps, hashes, and CODEOWNERS approval are not signatures. The CCI package uses a separate protected trust registry and eight detached Ed25519 role signatures: carbon accounting, demography, power systems, physical climate, reproducibility, UI/accessibility/runtime, source rights, and release authorizer. Each signature binds the repository, release ID, canonical artifact-pin-and-absence digest, trust-registry hash, role identity/time, and raw SHA-256 of the review request, approval, release diff, runtime manifest, and rollback proof. A change to any signed byte invalidates the package.

The committed trust registry is intentionally `unprovisioned`, and `release-signatures.json` is intentionally absent. Real public keys must be provisioned through protected-file review before the bound review request is regenerated; private keys never enter the repository. No agent-generated fixture key or identity may be promoted.

## Exact release chain

The CCI-specific chain is intentionally separate from the historical `data/climate/runtime-manifest.json` CT-40 chain:

~~~text
artifact-bound review-request.json
  → release-approval.json
  → reviewed-runtime-manifest.json
  → reviewed-release-diff.json
  → executable reviewed-rollback-proof.json
  → eight-role detached release-signatures.json
  → tools/check-country-climate-intelligence-release-gate.js --require-release
  → three-role signed globe-runtime asset approval
  → tools/check-public-climate-release-profile.js --release
  → release-mode public staging
~~~

The reviewed runtime manifest must pin the request subject digest, approval, runtime, source registry, source receipts, components, compilers, public entrypoints, CSS, service worker, and accessibility/runtime checks. The release diff then pins the request, approval, and runtime manifest. The rollback proof pins that complete release package and must successfully restore a prior reviewed baseline in an isolated rehearsal.

## Commands

Candidate integrity:

~~~sh
node tools/check-country-climate-intelligence-ci.js
node tools/check-country-climate-intelligence-release-signatures.js
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

The strict gate must remain red until the exact external decisions, independent reports, provisioned trust registry, and eight valid human signatures exist. Passing candidate checks never implies production authority or deployment authority.

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
