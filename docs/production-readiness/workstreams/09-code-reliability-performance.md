# Workstream 09 — Code Reliability and Performance

## Outcome

Runtime modules fail visibly and safely, use supported APIs, clean up correctly, and meet explicit asset/runtime budgets.

## Current evidence

- `GaiaChat.reset()` / `destroy()` assigns to a `const` binding and can throw during lifecycle cleanup.
- Globe initialization emits warnings for unsupported methods such as `specularImageUrl`, `ringsTransitionDuration`, and `ringLabel`.
- A tracked Lightpanda symlink points to a personal absolute path and is broken outside one workstation.
- Asset and runtime budgets are not release gates.

## Packets

### REL-001 — Repair GAIA lifecycle cleanup

- `HIGH` · `D1 Easy` · `EXECUTE`
- Correct mutable lifecycle state and add a reset/destroy/re-init test.

### REL-002 — Align with supported Globe API

- `MEDIUM` · `D1 Easy` · `EXECUTE`
- Verify the pinned API version, remove invalid calls or isolate version-specific optional calls with existing safe utilities, and ensure warnings do not conceal real failures.

### REL-003 — Remove machine-specific tooling dependency

- `HIGH` · `D1 Easy` · `EXECUTE`
- Remove the tracked `tools/scraper/bin/lightpanda` symlink that targets a personal absolute path. Preserve portable Chromium operation and the existing explicit Lightpanda-missing error path; do not download, vendor, or silently select a new binary in this packet. Ensure no tracked personal filesystem path remains.
- Acceptance: a clean checkout contains no machine-specific symlink, Chromium mode is unaffected, and explicitly requesting unavailable Lightpanda fails with portable setup guidance.

### PERF-400 — Performance budget

- `MEDIUM` · `D2 Moderate` · `DESIGN`
- Measure HTML/JS/CSS/data/image transfer, parse/execute time, main-thread blocking, first useful interaction, memory, globe frame behavior, and low-end mobile performance. Set budgets before optimization.

## Verification gates

- Run syntax/load-order/contract checks after module changes.
- Capture console errors and warnings as browser-test failures, with an explicit allowlist only for understood external limitations.
- Test lifecycle actions repeatedly to find listener, timer, speech, and animation leaks.
