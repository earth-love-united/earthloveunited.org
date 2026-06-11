# MISSIONS.md — Live kanban for agent missions

Maintained automatically by `tools/start-mission.sh` and `tools/end-mission.sh`.
Do not edit by hand — your changes will be overwritten by the next mission.

To see what's in flight before starting work:

```bash
cat MISSIONS.md
gh pr list                    # same info, GitHub-side
```

To begin a new mission:

```bash
./tools/start-mission.sh <role> <slug>
# role:  architect | reviewer | designer | generalist
# slug:  kebab-case (e.g. add-events-filter)
```

When done:

```bash
./tools/end-mission.sh
```

See `AGENTS.md` § Operations for the full lifecycle.

---

## In Flight

| Started | Role | Slug | Branch | Status |
|---------|------|------|--------|--------|

## Completed (last 20)

| Finished | Role | Slug | PR | Outcome |
|----------|------|------|----|---------|
| 2026-06-11T18:00:26Z | designer | swipeable-hover-card | https://github.com/earth-love-united/earthloveunited.org/pull/1 | pending-review |
