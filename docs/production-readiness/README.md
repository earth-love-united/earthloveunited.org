# Production Readiness Program

This directory converts the production-readiness assessment into work that another agent can safely claim, study, implement, and verify. It is the coordination layer; it is not evidence that any finding has been resolved.

Start with [ROADMAP.md](ROADMAP.md), then open the relevant brief in `workstreams/`.

For Hermes / owl-alpha execution, begin with [HERMES-START-PROMPT.md](HERMES-START-PROMPT.md), then follow [HERMES-OWL-ALPHA-HANDOFF.md](HERMES-OWL-ALPHA-HANDOFF.md). The handoff defines authority, repository isolation, the first mission sequence, exact baseline checks, reporting requirements, and stop conditions.

## Classification system

Every work packet has three independent labels.

### Severity

| Label | Meaning |
|---|---|
| `BLOCKER` | Public release should not proceed while the issue is present. |
| `HIGH` | Material user, security, accessibility, or trust risk. |
| `MEDIUM` | Operational or quality debt that weakens a production release. |
| `LOW` | Improvement that can follow a stable launch. |

### Difficulty

| Label | Typical scope |
|---|---|
| `D1 Easy` | Bounded change, usually one or two files, known solution, no migration. |
| `D2 Moderate` | Several files or test surfaces; design is known but coordination is needed. |
| `D3 Hard` | Cross-system behavior, data migration, security boundary, or substantial regression risk. |
| `D4 Program` | Multiple dependent missions or an external system; cannot responsibly land as one change. |

Difficulty is not priority. A `D1` blocker should normally be fixed before a `D4` improvement.

### Execution class

| Label | Rule |
|---|---|
| `EXECUTE` | The intended behavior is already clear. Claim a mission and implement it. |
| `DESIGN` | Write a short design note and acceptance tests before implementation. |
| `STUDY` | Do not implement the final behavior yet. First resolve evidence, legal, security, product, or architecture questions. |

`STUDY` work is complete only when it produces a decision record with sources, rejected alternatives, owner approval where required, and executable follow-up packets.

## Recommended order

1. Contain active release risks with reversible `D1` changes.
2. Complete scientific, licensing, security, and product-truth studies.
3. Implement the decisions as separate missions.
4. Build CI and deployment gates that prevent recurrence.
5. Complete launch operations, observability, and public documentation.

## Agent claim protocol

Before claiming a packet:

1. Read `AGENTS.md`, `ARCHITECTURE.md`, `MISSIONS.md`, this file, and the workstream brief.
2. Run `git status --short`; do not overwrite unrelated or concurrent changes.
3. Check whether the packet touches protected files listed in `AGENTS.md`.
4. Record the packet ID in the mission slug or PR description.
5. For `DESIGN` or `STUDY`, land the decision artifact before implementation.
6. Keep one packet per mission unless the roadmap explicitly groups them.
7. Add verification evidence to the PR; “works locally” is not sufficient.

Use [WORK-PACKET-TEMPLATE.md](WORK-PACKET-TEMPLATE.md) when splitting a packet further.
Use [DECISION-RECORD-TEMPLATE.md](DECISION-RECORD-TEMPLATE.md) for `DESIGN` and `STUDY` packets, and [MISSION-REPORT-TEMPLATE.md](MISSION-REPORT-TEMPLATE.md) for every implementation handback.

## Global release gates

Production-ready means all of the following are true:

- No open `BLOCKER` packet.
- Every public scientific claim has a source, unit, baseline, date, and review status.
- Untrusted or model-generated content cannot reach an unsafe HTML sink.
- User data, API-key handling, public/private persistence, and donation behavior match the copy shown to users.
- Index and GAIA pass desktop and mobile smoke, keyboard, overflow, and basic accessibility checks.
- Runtime datasets pass schema, coordinate, date, provenance, and license gates.
- The deployed artifact is reproducible and does not depend on unpinned runtime libraries.
- CI failures cannot be neutralized and the checks assert real pass/fail values.
- A deployment owner has rollback, monitoring, and incident instructions.

## Coordination note

This planning area was created without altering the concurrent working-tree changes in `data/sites.json`, `index.html`, `js/globe.js`, `js/site-panel.js`, and `tools/verify-globe-country-truth.js`. Agents must re-check current ownership before touching those files.
