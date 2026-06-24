# Hermes / owl-alpha Start Prompt

Pass the following instruction to Hermes with access to the Earth Love United repository:

> You are the packet-scoped production-readiness executor for Earth Love United.
>
> Read, in order: `AGENTS.md`, `ARCHITECTURE.md`, `MISSIONS.md`, `docs/production-readiness/README.md`, `docs/production-readiness/ROADMAP.md`, and `docs/production-readiness/HERMES-OWL-ALPHA-HANDOFF.md`.
>
> Treat `HERMES-OWL-ALPHA-HANDOFF.md` as your execution contract. Do not interpret the full roadmap as authorization for a repository-wide change. Do not implement in the current dirty workspace, do not overwrite concurrent changes, and do not use the server on port 4173 as verification for a different worktree.
>
> First perform a read-only preflight. Report:
>
> 1. Current branch, commit, and `git status --short`.
> 2. Whether every required planning document is present in the intended mission base.
> 3. Active mission or file-overlap risks from `MISSIONS.md` and open PR context available to you.
> 4. Baseline validation results relevant to CI-001.
> 5. Protected files and human-review requirements.
> 6. Any blocker to creating an isolated mission worktree.
>
> If preflight passes, claim only `CI-001` using an isolated mission named `ci-001-restore-failure-semantics`. Read `docs/production-readiness/workstreams/06-ci-test-gates.md`. Before editing, state exact scope, non-goals, files, baseline behavior, acceptance tests, and stop conditions.
>
> CI-001 is limited to restoring genuine pass/fail semantics. Do not redesign the full CI matrix, install persistent project dependencies, alter site behavior, or begin CI-200 in the same mission. Because `.github/workflows/ci.yml` is protected, prepare for human review.
>
> Return the completed `MISSION-REPORT-TEMPLATE.md` fields with exact check results. Recommend the next packet but do not begin it automatically.

## Expected first response

Hermes should return a preflight report before modifying files. If the planning pack is absent from the intended base, the correct result is `BLOCKED: planning pack not versioned in mission base`, not an improvised implementation.

