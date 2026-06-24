# Production Readiness Roadmap

This is the dependency-ordered backlog. “Wave” indicates safe sequencing, not a promise that every item in a wave has equal urgency.

Hermes must follow the execution contract in [HERMES-OWL-ALPHA-HANDOFF.md](HERMES-OWL-ALPHA-HANDOFF.md). A roadmap row authorizes investigation only; it does not override `STUDY`/`DESIGN` gates or authorize deployment, external writes, legal conclusions, or product decisions.

## Wave 0 — reversible containment

| ID | Action | Severity | Difficulty | Class | Depends on |
|---|---|---:|---:|---|---|
| SCI-001 | Decide and apply temporary containment for disputed carbon, temperature, and quiz values | BLOCKER | D1 | DESIGN | None |
| DAT-001 | Decide and apply temporary containment for the invalid historical-events dataset | BLOCKER | D1 | DESIGN | None |
| SEC-001 | Remove API-key prefix logging | HIGH | D1 | EXECUTE | None |
| SEC-002 | Replace or disable raw model-HTML rendering until a safe renderer exists | BLOCKER | D2 | DESIGN | None |
| TRU-001 | Rename the local pledge wall and disable misleading donation behavior | BLOCKER | D1 | EXECUTE | None |
| A11Y-001 | Remove `user-scalable=no` from both pages | HIGH | D1 | EXECUTE | None |
| REL-001 | Fix `GaiaChat.reset()` / `destroy()` mutation of a `const` binding | HIGH | D1 | EXECUTE | None |
| REL-002 | Remove or guard unsupported Globe API calls that currently warn at runtime | MEDIUM | D1 | EXECUTE | None |
| REL-003 | Remove the tracked machine-specific Lightpanda symlink | HIGH | D1 | EXECUTE | None |
| CI-001 | Remove failure-neutralizing `|| true` from enforced CI checks | BLOCKER | D1 | EXECUTE | None |

## Wave 1 — studies that define the release

| ID | Study output | Severity | Difficulty | Class | Depends on |
|---|---|---:|---:|---|---|
| SCI-100 | Approved scientific-claims methodology and source set | BLOCKER | D3 | STUDY | SCI-001 |
| DAT-100 | Dataset acceptance, provenance, and publication policy | BLOCKER | D3 | STUDY | DAT-001 |
| SEC-100 | GAIA threat model and credential/data-flow decision | BLOCKER | D3 | STUDY | SEC-001, SEC-002 |
| TRU-100 | Product decision for commitments, public identity, moderation, and donations | BLOCKER | D3 | STUDY | TRU-001 |
| LIC-100 | License compatibility review for every redistributed dataset and asset | BLOCKER | D3 | STUDY | DAT-100 |
| DEP-100 | Hosting, security-header, artifact, and rollback architecture | HIGH | D3 | STUDY | SEC-100 |

## Wave 2 — contained implementation

| ID | Action | Severity | Difficulty | Class | Depends on |
|---|---|---:|---:|---|---|
| SCI-200 | Correct carbon-clock and temperature claims from the approved source set | BLOCKER | D2 | EXECUTE | SCI-100 |
| SCI-201 | Recalculate quiz answers and explanations from one documented model | BLOCKER | D2 | EXECUTE | SCI-100 |
| DAT-200 | Replace, repair, or explicitly demote the historical-events dataset | BLOCKER | D3 | DESIGN | DAT-100, LIC-100 |
| SEC-200 | Implement structured GAIA output and safe DOM rendering | BLOCKER | D3 | DESIGN | SEC-100 |
| SEC-201 | Implement the approved credential boundary and privacy disclosure | BLOCKER | D3 | DESIGN | SEC-100 |
| TRU-200 | Implement the approved commitment/public-wall behavior | HIGH | D3 | DESIGN | TRU-100 |
| LIC-200 | Remove, replace, or separately govern incompatible/unknown licensed material | BLOCKER | D3 | DESIGN | LIC-100 |
| A11Y-200 | Replace clickable `div`/`span` controls with keyboard-operable semantics | HIGH | D2 | EXECUTE | None |
| A11Y-201 | Fix GAIA mobile horizontal overflow and minimum text/target sizing | HIGH | D2 | EXECUTE | None |
| CI-200 | Correct SmokeTest and StackLint result assertions | BLOCKER | D2 | EXECUTE | CI-001 |
| SUP-200 | Pin and locally vendor runtime libraries with recorded hashes | HIGH | D2 | DESIGN | DEP-100, LIC-100 |

## Wave 3 — prevention and release operations

| ID | Action | Severity | Difficulty | Class | Depends on |
|---|---|---:|---:|---|---|
| SCI-300 | Create a versioned scientific-facts registry consumed by all surfaces | HIGH | D4 | DESIGN | SCI-200, SCI-201 |
| DAT-300 | Add schema, coordinate, time, link, checksum, and provenance gates | HIGH | D3 | DESIGN | DAT-200 |
| A11Y-300 | Establish automated and manual accessibility release gates | HIGH | D3 | DESIGN | A11Y-200, A11Y-201 |
| CI-300 | Add index/GAIA, desktop/mobile, keyboard, security, data, and service-worker CI matrix | HIGH | D3 | DESIGN | CI-200, A11Y-200, A11Y-201, DAT-300 |
| DEP-300 | Create deterministic deploy manifest and exclude stale `_deploy/` output | HIGH | D2 | DESIGN | SUP-200 |
| DEP-301 | Configure production CSP/headers, cache rules, rollback, and smoke verification | BLOCKER | D3 | DESIGN | DEP-100, DEP-300, SEC-200 |
| OPS-300 | Add production error reporting, uptime checks, and incident runbook | HIGH | D3 | DESIGN | DEP-301 |
| GOV-200 | Assign accountable review owners and cadences | HIGH | D2 | DESIGN | SCI-100, DAT-100, SEC-100, LIC-100 |
| POL-300 | Publish privacy, accessibility, provenance, correction, and contact policies | HIGH | D2 | DESIGN | SEC-100, TRU-100, LIC-100 |
| DOC-300 | Reconcile architecture/operations docs and remove broken references | MEDIUM | D2 | EXECUTE | Accepted architecture decisions |
| WEB-300 | Add canonical URLs, social previews, robots, sitemap, and structured organization data | MEDIUM | D2 | DESIGN | Production domain decision |

## Wave 4 — post-gate improvements

| ID | Action | Severity | Difficulty | Class | Depends on |
|---|---|---:|---:|---|---|
| PERF-400 | Establish asset/performance budgets and measure real-device behavior | MEDIUM | D2 | DESIGN | DEP-300 |
| TRU-400 | Add readiness badges at the point where reviewed/demo data is shown | MEDIUM | D2 | DESIGN | DAT-100 |
| DAT-400 | Build source → transform → checksum → claim lineage reports | MEDIUM | D4 | DESIGN | DAT-300, SCI-300 |
| PRD-400 | Evaluate a smaller, curated “trustworthy globe” release mode | LOW | D3 | STUDY | Production telemetry and user research |

## Workstream index

- [Scientific integrity](workstreams/01-scientific-integrity.md)
- [Data provenance and validity](workstreams/02-data-provenance.md)
- [GAIA security and privacy](workstreams/03-gaia-security-privacy.md)
- [Product truth and user data](workstreams/04-product-truth-user-data.md)
- [Accessibility and responsive behavior](workstreams/05-accessibility-responsive.md)
- [CI and test gates](workstreams/06-ci-test-gates.md)
- [Deployment and supply chain](workstreams/07-deployment-supply-chain.md)
- [Licensing and governance](workstreams/08-licensing-governance.md)
- [Code reliability and performance](workstreams/09-code-reliability-performance.md)
- [Documentation, web presence, and operations](workstreams/10-documentation-seo-observability.md)
