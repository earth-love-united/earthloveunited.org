# Workstream 07 — Deployment and Supply Chain

## Outcome

A release is a reproducible static artifact with pinned dependencies, verified hashes, production security headers, smoke checks, and a practiced rollback.

## Current evidence

- `js/vendor/globe.gl.js` is not reliably tracked as part of the release artifact; CI downloads it and can mask an incomplete checkout.
- GAIA loads an unpinned “latest” library synchronously from a CDN without SRI.
- `_deploy/` can diverge from source and has no demonstrated artifact contract.
- No repository-owned production configuration currently proves CSP/security headers, caching, rollback, or post-deploy verification.

## Packets

### DEP-100 — Choose deployment architecture

- `HIGH` · `D3 Hard` · `STUDY`
- Record the canonical hosting target, production domain, artifact root, vendor policy, security headers, cache strategy, service-worker rollout, secrets boundary, deployment authority, and rollback mechanism.

### SUP-200 — Pin and inventory dependencies

- `HIGH` · `D2 Moderate` · `DESIGN`; depends on DEP-100 and LIC-100.
- Vendor approved runtime libraries locally or pin exact CDN versions with integrity and fallback. Record version, source, license, hash, and update owner.

### DEP-300 — Deterministic artifact manifest

- `HIGH` · `D2 Moderate` · `DESIGN`; depends on SUP-200.
- Define included/excluded paths, verify required files, generate hashes, and prevent stale `_deploy/` content from being mistaken for current source.

### DEP-301 — Production release path

- `BLOCKER` · `D3 Hard` · `DESIGN`; depends on DEP-100/300 and SEC-200.
- Configure headers and caching at the host, deploy an immutable artifact, run post-deploy smoke checks, record the release identifier, and test rollback.

## Verification gates

- A clean checkout can produce/identify the artifact without ad hoc downloads.
- The deployed origin reports the expected CSP, HSTS, content-type, referrer, framing, and permissions policies.
- Offline/service-worker upgrades do not strand users on incompatible mixed versions.
- Rollback has been exercised, not merely documented.

