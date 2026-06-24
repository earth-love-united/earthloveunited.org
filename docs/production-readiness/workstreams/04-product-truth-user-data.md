# Workstream 04 — Product Truth and User Data

## Outcome

Claims such as “public,” “live,” “donate,” and “saved” exactly match implemented persistence, networking, moderation, and financial behavior.

## Current evidence

- The pledge wall is local IndexedDB state but is presented as public.
- The donation interaction does not complete or clearly hand off a donation.
- Several “live” experiences use cached or hardcoded values without a visible freshness timestamp.

## Packets

### TRU-001 — Correct misleading copy and controls

- `BLOCKER` · `D1 Easy` · `EXECUTE`
- Rename local pledges to “My Commitments” (or equivalent), remove public/community claims, add storage scope, and disable or relabel nonfunctional donation controls.

### TRU-100 — Decide the actual product

- `BLOCKER` · `D3 Hard` · `STUDY`
- Decide whether commitments remain local or become a public service. A public service requires identity policy, moderation, abuse reporting, deletion, consent, retention, availability, and operator ownership.
- Separately decide whether donation is informational, an external handoff, or an integrated financial flow. Legal and operational approval is required before collecting funds.

### TRU-200 — Implement approved commitment behavior

- `HIGH` · `D3 Hard` · `DESIGN`; depends on TRU-100.
- For local-only: make privacy and device scope explicit and test reset/export behavior.
- For public: define API/backend, moderation queue, rate limits, deletion, audit trail, privacy notice, and degraded-mode UX before UI integration.

### TRU-400 — Readiness and freshness badges

- `MEDIUM` · `D2 Moderate` · `DESIGN`; depends on DAT-100.
- Show `live`, `cached`, `reviewed`, `provisional`, or `demo` beside the data it qualifies, including an “updated at” value where meaningful.

### PRD-400 — Curated trustworthy-globe study

- `LOW` · `D3 Hard` · `STUDY`; wait for production telemetry and user research.
- Compare the current breadth-first experience with a smaller release containing only reviewed datasets and a focused narrative. Measure comprehension, trust, performance, and maintenance burden before proposing a product change.

## Verification gates

- Test behavior offline, in a fresh browser profile, after storage deletion, and across two devices.
- Copy review must be performed against actual network and persistence traces.
- No donation language may imply tax status, receipt, destination, or completion unless verified end to end.
