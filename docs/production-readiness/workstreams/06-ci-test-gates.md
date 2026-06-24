# Workstream 06 — CI and Test Gates

## Outcome

CI fails for real regressions and covers the release surfaces, data contracts, browser sizes, security invariants, and offline behavior.

## Current evidence

- An enforced pre-commit-related CI command is neutralized with `|| true`.
- CI assertions do not match the actual SmokeTest/StackLint result shapes.
- Browser coverage is desktop `index.html` only; GAIA, mobile, keyboard, security, scientific invariants, datasets, and service-worker behavior are absent.

## Packets

### CI-001 — Restore failure semantics

- `BLOCKER` · `D1 Easy` · `EXECUTE`
- Remove unconditional success paths from required checks. If a check is informational, label it as such rather than pretending it enforces policy.
- Protected-file warning: CI and hook changes may require reviewer approval under `AGENTS.md`.

### CI-200 — Assert actual tool results

- `BLOCKER` · `D2 Moderate` · `EXECUTE`
- Inspect the runtime return values of SmokeTest and StackLint and assert their documented pass/fail fields. Add a deliberately failing fixture or test mode to prove red CI.

### CI-300 — Production matrix

- `HIGH` · `D3 Hard` · `DESIGN`
- Cover both pages, desktop/mobile, console errors, overflow, keyboard paths, XSS payloads, scientific invariants, dataset validation, missing assets, offline/service-worker update behavior, and deployment smoke checks.
- Keep the bare-metal architecture: use the existing static server and browser tooling; do not introduce a bundler.

## Definition of a trustworthy gate

- It fails when its guarded behavior is deliberately broken.
- It emits a specific diagnostic.
- It runs against the same asset layout used in deployment.
- It does not download an artifact in CI that production is expected to already contain unless the deploy manifest explicitly owns that step.

