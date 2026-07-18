# Factual-public deployment

This is the narrow production path for the reviewed 2023 emissions-magnitude
globe. It publishes factual evidence and explicit source gaps only. It does not
publish commitments, targets, delivery judgments, climate-performance states,
scores, or an assessed climate release.

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

The script stages only the existing marker-free browser allowlist and finishes
by executing `tools/check-staged-factual-public-integrity.js`. That final gate
rehashes the reviewed CT-42 runtime scope directly against source and staged
bytes. Any failed gate removes `_deploy`.

## Rollback

Use Cloudflare Pages' rollback/retry controls to restore the previous successful
production deployment. To stop future factual deployments while investigating,
restore the project build command to `bash tools/build-deploy.sh`; the unchanged
assessed-release gate will fail closed until its full signed release contract is
complete.
