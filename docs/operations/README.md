# Operations Notes

This directory holds one-off launch playbooks, mission plans, cleanup notes,
and repository maps that do not need to live at the repository root.

Root governance files stay at root for now:

- `../../AGENTS.md`
- `../../OPERATIONS.md`
- `../../SWARM_SDK.md`
- `../../MISSIONS.md`

Those files are still referenced by contributor docs and mission scripts. Move
them only after the tooling and links are updated in a dedicated governance PR.

## Safe Moves Completed

- `GO_PUBLIC.md` -> `docs/operations/GO_PUBLIC.md`
- `WAVE_4_PLAN.md` -> `docs/operations/WAVE_4_PLAN.md`
- `REPO_MAP.md` -> `docs/operations/REPO_MAP.md`
- `scripts/README_CLEANUP.md` -> `docs/operations/README_CLEANUP.md`

## Target Structure

- Root: public identity, licensing, contribution, and architecture files.
- `docs/operations/`: mission runbooks, launch playbooks, repository maps, and cleanup notes.
- `docs/agents/`: agent quick references and handoff notes after protected-path migration is approved.
