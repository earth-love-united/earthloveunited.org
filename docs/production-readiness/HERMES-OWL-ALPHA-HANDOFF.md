# Hermes / owl-alpha Handoff

## Handoff state

**Ready for repository study, packet refinement, and packet-scoped missions.**

This document is the execution contract for Hermes. The roadmap is not a request to fix everything in one branch. Work one packet at a time, honor its execution class, and return evidence after every mission.

## Objective

Move Earth Love United toward production readiness without weakening its bare-metal architecture, overstating scientific or product claims, masking failures, or mixing unrelated concurrent work.

Success is measured by closed packet acceptance criteria and stronger automated gates—not by the number of files changed.

## Required reading order

1. `AGENTS.md`
2. `ARCHITECTURE.md`
3. `MISSIONS.md`
4. `docs/production-readiness/README.md`
5. `docs/production-readiness/ROADMAP.md`
6. The selected `workstreams/*.md` brief
7. This handoff again before editing

If any required file is absent from the mission worktree, stop and report it. Do not recreate policy from memory.

## Authority and non-authority

Hermes may:

- Read and analyze the full repository.
- Execute an `EXECUTE` packet whose required behavior is unambiguous.
- Produce a decision record for a `DESIGN` or `STUDY` packet.
- Add scoped tests and documentation required by the packet.
- Open a packet-specific PR through the documented mission lifecycle.

Hermes may not:

- Deploy to production, change DNS/hosting, send messages, spend money, or create external services without separate authorization.
- Make final scientific, medical, legal, licensing, privacy, tax, donation, or foundation-status determinations.
- Implement a `STUDY` packet’s final behavior before the named human decision is recorded.
- Select among materially different product architectures when the packet calls for `DESIGN` or `STUDY`.
- add npm, a package manifest, bundler, ES modules, or a build step.
- Bypass hooks, neutralize failures, force-push, modify `.git/`, delete `_dead/`, or overwrite concurrent work.

## Repository isolation — mandatory

At handoff preparation time, the source workspace was on branch `agent/designer/swipeable-hover-card` at `a1d06bd` and already contained unrelated modifications/untracked data. The exact dirty set can change while other work is active.

Before every mission:

```bash
git status --short
git branch --show-current
git rev-parse --short HEAD
cat MISSIONS.md
```

Rules:

1. Do not implement production-readiness packets in the dirty source workspace.
2. Use `./tools/start-mission.sh <role> <packet-id>-<slug>` to create an isolated worktree after confirming the planning pack exists in the selected base.
3. If these planning files are not committed/reachable from the mission base, stop and ask the handoff owner to publish them. Do not silently copy an unversioned plan into a mission.
4. The already-served `http://127.0.0.1:4173/index.html` may point at another worktree. It is valid for observation only, not mission verification.
5. Serve the mission worktree on a separate port and record its path/commit in evidence.
6. One packet per mission unless the roadmap explicitly requires an inseparable pair.

Suggested mission naming:

```bash
./tools/start-mission.sh generalist sec-001-remove-key-logging
./tools/start-mission.sh generalist a11y-001-restore-zoom
./tools/start-mission.sh reviewer sci-100-claims-methodology
```

## Packet state machine

Use only these states:

```text
UNCLAIMED → STUDYING → DECISION-READY → APPROVED → IMPLEMENTING → VERIFYING → COMPLETE
                     ↘ BLOCKED
```

- `EXECUTE`: may move from `UNCLAIMED` to `IMPLEMENTING` after baseline evidence.
- `DESIGN`: must produce an accepted decision record before `IMPLEMENTING`.
- `STUDY`: ends at `DECISION-READY` unless a human explicitly approves the decision and authorizes a follow-up implementation packet.
- `BLOCKED`: report the exact missing decision, evidence, authority, or external dependency. Do not choose a convenient default.
- `COMPLETE`: acceptance criteria and required verification are evidenced; code existence alone is insufficient.

## First mission sequence

Do not start with scientific replacements, the event-data rebuild, public pledges, credentials architecture, licensing remediation, or deployment. Those require study/decision work.

Recommended independent first missions:

| Order | Packet | Mission | Why first | Special constraint |
|---:|---|---|---|---|
| 1 | CI-001 | Restore real CI failure semantics | A trustworthy gate is prerequisite to later changes | `.github/workflows/ci.yml` is protected; human review required |
| 2 | CI-200 | Correct SmokeTest/StackLint assertions | Existing CI reads the wrong result shapes | Prove a deliberately failing result makes the check fail |
| 3 | SEC-001 | Remove API-key fragment logging | Bounded security containment | Do not redesign credentials in this mission |
| 4 | A11Y-001 | Restore browser zoom | Bounded accessibility correction | Verify both HTML pages and 200% zoom |
| 5 | REL-001 | Repair GAIA lifecycle cleanup | Bounded runtime defect | Exercise reset → destroy → re-init repeatedly |
| 6 | REL-002 | Remove unsupported Globe API calls | Reduces noisy runtime failure signals | Verify against the exact shipped Globe version |
| 7 | REL-003 | Remove machine-specific Lightpanda dependency | Makes tooling portable | Do not install or vendor a new browser binary |

After these, produce decision records for SCI-100, DAT-100, SEC-100, TRU-100, LIC-100, and DEP-100. Do not run all six studies as one mission; each has different reviewers and evidence.

### Deferred containment packets

SCI-001, DAT-001, SEC-002, and TRU-001 are urgent but affect public meaning. SCI-001, DAT-001, and SEC-002 are explicitly `DESIGN`; obtain the required decision before implementation. For TRU-001, use the exact local-only/public/donation behavior accepted in its mission scope and escalate if product copy remains ambiguous. “Under review,” hiding the feature, and relabeling it as demo are not interchangeable decisions.

## Baseline checks

Run relevant checks before editing and again after editing. Capture command, exit code, and concise output. A pre-existing failure must be reported; it must not be hidden or attributed to the mission without evidence.

```bash
python3 scripts/verify_load_order.py
find js dis -name '*.js' -not -path '*/vendor/*' -print0 | xargs -0 -n1 node --check
node tools/check-provenance-registry.js
node tools/check-public-copy.js
node tools/check-iso-mapping.js
node tools/verify-globe-country-truth.js
git diff --check
```

Run only validators relevant to the packet plus the load-order and syntax baseline. If a listed tool is absent or its contract has changed, report that rather than substituting an unrelated check.

### Browser baseline

From the mission worktree:

```bash
python3 -m http.server 8000
```

Open both:

- `http://127.0.0.1:8000/index.html`
- `http://127.0.0.1:8000/gaia.html`

On pages that load the tools, capture:

```javascript
await SmokeTest.run()
StackLint.audit()
PageState.dump()
```

Interpret current return contracts correctly:

- `SmokeTest.run()` returns an array of result objects. A failed entry has `pass === false`; there is no reliable `smoke.failed` aggregate.
- `StackLint.audit()` returns the issues array directly; there is no `stack.issues` wrapper.
- For CSS/layout work, run desktop plus 320, 390, 768, and 1280 px widths and confirm `document.documentElement.scrollWidth <= window.innerWidth` unless horizontal scrolling is an explicit feature.
- Record page errors and console errors. Do not silence them to make a test green.

## Required packet preparation

Before editing, add the following to the mission notes or PR draft:

- Packet ID, severity, difficulty, and execution class.
- The exact observed behavior and reproduction.
- Files expected to change and output from `Impact.check('<filename>')` where available.
- Dependencies and protected-file status.
- Explicit scope, non-goals, and stop condition.
- Acceptance criteria converted into checks.
- Baseline results.

For `DESIGN`/`STUDY`, use `DECISION-RECORD-TEMPLATE.md`. For an implementation, use `MISSION-REPORT-TEMPLATE.md`.

## Implementation rules inherited from the repository

- Preserve classic scripts and IIFEs for orchestration modules.
- Every new global module must assign `window.MODULE_NAME`, register a contract, enter `MODULE_MANIFEST`, and load in the documented order.
- The declarative `js/modules/` class subsystem is intentionally different; do not convert it to IIFEs.
- Use `safeCall`, `safeGet`, `hasModule`, safe DOM helpers, `reportError`, and `safeChain` as specified by `AGENTS.md`.
- Never put interactive DOM under `#globeViz`.
- Hidden/off-screen UI must not intercept pointer events.
- Use `StackLint.audit()` after CSS changes and module/contract smoke tests after JavaScript module changes.
- Do not add a new source of truth when an existing registry/config owns the value.

## Commit and PR contract

- Keep unrelated formatting and refactors out of the packet.
- Do not include changes present before the mission.
- Run `git diff --check`, inspect `git diff --stat`, and review every changed file before commit.
- Never use `--no-verify`.
- Use `./tools/end-mission.sh` only after the working tree is committed and verification evidence is prepared.
- Protected files and more than 20 changed files require human review; call this out explicitly.
- A green PR is not permission to deploy.

## Mandatory handback

Every mission response must include:

1. Packet ID and final state.
2. Outcome in one sentence.
3. Files changed and why.
4. Before/after behavior.
5. Exact verification results, including warnings and skipped checks.
6. Remaining risks or unanswered decisions.
7. Protected files touched.
8. Commit hash and PR URL, if created.
9. Recommended next packet, without beginning it automatically.

## Stop and escalate when

- Required evidence conflicts or cannot be traced to a primary source.
- A scientific claim lacks an approved baseline, unit, uncertainty, or review date.
- License or redistribution rights are unknown.
- A change requires a backend, external account, credential, payment flow, moderation operation, or production access.
- The proposed fix changes public meaning, privacy expectations, data retention, or donation behavior without an approved decision.
- The mission overlaps an active branch or dirty file set.
- The same validation failure persists after two scoped correction attempts.
- Scope expands beyond the claimed packet or would touch more than 20 files.

When escalating, report options and consequences. Do not select an option merely to keep moving.
