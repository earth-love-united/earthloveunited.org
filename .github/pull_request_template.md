<!--
  Earth Love United — PR template
  Populated automatically by tools/end-mission.sh for agent PRs.
  For manual / human PRs, fill in each section.
-->

## Mission summary

- **Role:** <!-- architect | reviewer | designer | generalist -->
- **Slug:** <!-- kebab-case slug from the branch name -->
- **One-sentence summary:** <!-- what does this PR do? -->

## Why

<!-- One paragraph explaining the motivation. What problem does this solve?
     What was the trigger? Link to any issue / Slack thread / mission brief. -->

## Checks (run locally before opening)

- [ ] `scripts/verify_load_order.py` passed
- [ ] `node --check` passed for every touched .js file
- [ ] `tools/agent-precommit` passed on every commit
- [ ] SmokeTest.run() returns clean in local browser
- [ ] StackLint.audit() returns no issues
- [ ] No protected files touched (or: explicitly required and explained below)

## Protected files

<!-- If you touched any of the files listed in .github/CODEOWNERS or
     AGENTS.md § Operations § Protected Files, list them here and explain
     WHY the change is necessary. Reviewer will read this carefully. -->

_None._

## Files touched

<!-- This is filled in automatically by end-mission.sh. -->

## Notes for reviewer

<!-- Anything specific the reviewer should look at? Tricky design decision?
     A trade-off worth flagging? -->

---

<sub>Opened by `tools/end-mission.sh`. See `AGENTS.md` § Operations for the lifecycle.</sub>
