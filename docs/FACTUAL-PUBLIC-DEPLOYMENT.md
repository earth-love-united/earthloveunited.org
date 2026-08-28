# Factual-public deployment

There are two deliberately separate factual-public paths. The historical
`limited_factual_display` path below serves the reviewed CT-42 surface. The
current Country Climate Intelligence candidate uses the separately authorized
`cci_ai_factual` path; neither path grants the signed, human-reviewed assessed
release authority used by `tools/build-deploy.sh --release`.

## Country Climate Intelligence AI-factual path

The CCI path combines the immutable four-specialist-review base with one
fail-closed presentation/performance delta review. The delta can cover only the
exact enumerated presentation, font-delivery, first-paint evidence,
deterministic rollback, and release-rail files. Any climate runtime/source,
source-rights, globe data/texture, scoring, target, finance, or publication
boundary change is rejected and requires fresh specialist review.

Cloudflare Pages contract for this path:

- Production branch: `main`
- Build command: `./tools/build-cci-factual-public-deploy.sh --cci-ai-factual`
- Build output directory: `_deploy`
- Branch preview builds: refused by the script

The build first verifies the current exact review request, the frozen four
reports, the focused delta, and the composite publication artifact. It then
stages the exact CCI factual allowlist, applies the reviewed browser transforms,
and finishes with both independent staged-integrity checks. The project setting
must be changed to this command only after the protected PR is approved and
merged to `main`; a PR preview failure is expected and is not publication
authority.

## Historical CT-42 limited factual display

This is the narrow production path for the reviewed 2023 emissions-magnitude
globe. It publishes factual evidence and explicit source gaps only. It does not
publish commitments, targets, delivery judgments, climate-performance states,
scores, or an assessed climate release.

Its public tier is named `limited_factual_display`. The selector's internal
state must be exactly `legacy_ct40:candidate`, meaning the complete assessed
legacy release package is absent. This does not make a generic candidate build
public: the separate CT-42 factual-display review grants only the bounded facts
listed below. CCI, mixed/partial authority packages, and
`legacy_ct40:release` are refused by this builder.

## Scope that must remain true

- 2,060 reviewed PRIMAP-hist facts are eligible for factual display and
  magnitude comparison.
- 206 registry entities have reviewed factual series and 43 remain visible as
  unranked source gaps.
- CT-40 remains `deny` for `assessed_climate_release`.
- Commitment display, derived metrics, performance assessment, and scores
  remain absent and ineligible.
- The exact CT-42 data/UI review, deterministic rollback proof, localized runtime bytes,
  source links, public copy, notices, and marker-free browser allowlist pass.

The gate is `node tools/check-climate-factual-public-readiness.js`. A protected
maintainer-reviewed merge authorizes this narrow deployment. It does not create
or imply authority for the separate assessed-production release.

## Visual provenance and open concern

The deployment retains the exact notices and public credits already reviewed
with the UI. Natural Earth states that its map data are public domain. NASA's
media guidelines permit factual informational web use with acknowledgement and
without implied endorsement. The Three-Globe source package is MIT-licensed.
The exact source URLs and byte hashes remain pinned in the CT-45 manifest and
the public third-party notice artifact.

This is a maintainer publication decision based on that recorded provenance,
not a legal opinion or a claim that the repository's broader three-role signed
asset/assessed-release approval has been completed. That stricter approval
continues to govern `tools/build-deploy.sh --release` unchanged.

The independent rollback-browser review remains an explicitly open, untested
concern for this narrow launch. The deterministic rollback proof and temporary
site materialization pass; no independent review identity is invented.

Primary terms:

- https://www.naturalearthdata.com/about/terms-of-use/
- https://www.nasa.gov/nasa-brand-center/images-and-media/
- https://github.com/vasturiano/three-globe

## Cloudflare Pages contract

- Production branch: `main`
- Build command: `bash tools/build-factual-public-deploy.sh --factual-public`
- Build output directory: `_deploy`
- Branch preview builds: refused by the script
- Shallow production checkouts: expanded from `origin` before review-chain
  validation; publication fails closed if complete Git ancestry is unavailable

The script first requires
`node tools/check-public-climate-release-profile.js --factual-display`, stages
only the existing marker-free browser allowlist, and finishes by executing
`tools/check-staged-factual-public-integrity.js`. The final gate independently
repeats the factual-display profile guard and rehashes the reviewed CT-42 runtime
scope directly against source and staged bytes. Any failed gate removes
`_deploy`. A complete `legacy_ct40:release` package must use
`tools/build-deploy.sh --release`, including the signed asset and final aggregate
release checks.

## Rollback

Use Cloudflare Pages' rollback/retry controls to restore the previous successful
production deployment. To stop future factual deployments while investigating,
restore the project build command to `bash tools/build-deploy.sh`; the unchanged
assessed-release gate will fail closed until its full signed release contract is
complete.
