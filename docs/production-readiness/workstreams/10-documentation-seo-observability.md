# Workstream 10 — Documentation, Web Presence, and Operations

## Outcome

The repository and public site describe the system that is actually shipped, are discoverable and shareable, and give operators enough visibility to detect and recover from failures.

## Current evidence

- Architecture and operations documents do not consistently match the current module/script inventory.
- README references include missing documents.
- `docs/operations/GO_PUBLIC.md` contains stale or prohibited workflow guidance, including bypassing verification.
- Canonical URL, social images, organization structured data, robots/sitemap, production monitoring, privacy/accessibility statements, and incident/rollback ownership are incomplete or unproven.

## Packets

### DOC-300 — Reconcile protected documentation

- `MEDIUM` · `D2 Moderate` · `EXECUTE`; wait for accepted architecture decisions.
- Update script/module maps, remove broken links, reconcile operational commands with `AGENTS.md`, and mark generated versus source directories clearly.
- Protected-file warning: README and ARCHITECTURE changes require reviewer approval.

### WEB-300 — Production web metadata

- `MEDIUM` · `D2 Moderate` · `DESIGN`; depends on the canonical domain decision.
- Add canonical URLs, Open Graph/Twitter images and metadata, robots policy, sitemap, organization structured data, and meaningful page titles/descriptions.

### OPS-300 — Observability and incident readiness

- `HIGH` · `D3 Hard` · `DESIGN`; depends on DEP-301.
- Define privacy-conscious client error capture, uptime/synthetic checks for both pages and critical assets, alert ownership, severity levels, release identifiers, incident response, and rollback triggers.

### POL-300 — Public policy surfaces

- `HIGH` · `D2 Moderate` · `DESIGN`; depends on SEC-100, TRU-100, and LIC-100.
- Publish concise privacy, accessibility, data provenance, correction, and contact/reporting information matching actual operations.

## Verification gates

- Run a link checker over repository and public documentation.
- Validate structured data and social preview metadata against the deployed origin.
- Trigger a safe synthetic client error and uptime failure to prove notification and release correlation.
- Conduct a tabletop rollback/incident exercise and record follow-up actions.

