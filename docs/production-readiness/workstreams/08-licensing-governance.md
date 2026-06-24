# Workstream 08 — Licensing and Governance

## Outcome

Every redistributed dataset, library, image, and generated derivative has compatible terms, required attribution, and an accountable approval record.

## Current evidence

Repository materials are broadly presented under CC BY 4.0 while upstream sources appear to include CC BY-SA, CC BY-NC, and variable publication terms. A project-wide license cannot override incompatible source restrictions.

## Packets

### LIC-100 — Compatibility study

- `BLOCKER` · `D3 Hard` · `STUDY`
- Build an inventory with artifact, upstream owner, source URL, exact version/date, original license, redistribution status, derivative status, attribution, share-alike/noncommercial obligations, and proposed disposition.
- Required approval: a qualified human legal/licensing reviewer. Agents may research and structure evidence but must not declare legal compatibility.

### LIC-200 — Remediation plan

- `BLOCKER` · `D3 Hard` · `DESIGN`; depends on LIC-100.
- For each incompatible or unknown item, choose removal, replacement, separate licensing, permission, or changed distribution terms. Keep legal conclusions out of unreviewed public copy.

### GOV-200 — Review ownership

- `HIGH` · `D2 Moderate` · `DESIGN`.
- Name owners and review cadences for science, data promotion, security, privacy, accessibility, licensing, and production incidents.

## Acceptance criteria

- No production artifact has unknown redistribution status.
- Attribution is generated from the exact shipped inventory.
- Data readiness approval and legal approval are separate recorded decisions.
- Donation/tax/foundation representations are reviewed by the responsible human owner.

