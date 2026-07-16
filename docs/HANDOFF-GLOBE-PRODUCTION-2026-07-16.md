# Globe production handoff — 2026-07-16

## Mission outcome

The climate globe now presents reviewed factual emissions without exposing
internal CT/runtime-governance jargon or repeating disclaimer banners.
Major emitters remain visibly ranked by emissions magnitude and are explicitly
not scored. Countries with missing emissions data remain visible, unranked, and
cannot look better merely because they have no value or commitment assessment.

This is a verified local candidate, not an authorized production release.

## Exact working coordinate

- Repository: `earthloveunited.org` primary workspace
- Mission worktree: `/private/tmp/earthloveunited-missions/globe-notices-integration`
- Branch: `agent/generalist/globe-notices-integration`
- HEAD: `dd0fb54dbbbf2ccb9b4e0b01dd5b1affdb78e6fe`
- Worktree state at handoff: clean
- Push/PR/deploy: none performed
- Local HTTP server: stopped
- Candidate staging directory: `_deploy/` — 46 exact files, local QA only

Recent mission commits:

```text
dd0fb54 chore(climate): refresh truth-copy rollback proof
ce22cd2 chore(climate): refresh reviewed truth-copy chain
f3a3769 chore(climate): review concise globe truth copy
bd5b6ef fix(globe): remove internal fallback jargon
998e6dc fix(globe): distinguish gaps from estimates
abe4513 feat(globe): simplify public evidence language
```

## Public product behavior

The public surface now uses this evidence model:

- 206 registry entities have reviewed PRIMAP-hist v2.6.1 factual emissions
  series; 43 source gaps remain visible and unranked.
- The interactive globe contains 201 entities: 194 reviewed factual series and
  7 mapped source gaps. The accessible evidence browser contains all 249.
- The legend identifies a 2023 harmonized estimate, PRIMAP-hist v2.6.1,
  exclusion of LULUCF, and that emissions magnitude is not a climate-performance
  score.
- Factual cards say `Reviewed emissions data` and expose the chart, table,
  source/methodology, limitations, and a separate `Climate performance — Not
  scored` boundary.
- Source-gap cards say `No emissions estimate · visible and unranked`; they do
  not render a factual value or chart.
- NASA is credited once for the decorative Black Marble 2012 background. The
  detailed source and rights evidence remains in the notices/manifest controls.
- Public fallback and failure states contain no CT number, candidate/release
  review jargon, or runtime-boundary language.

Primary runtime files changed:

- `index.html`
- `js/globe.js`
- `sw.js`
- `ARCHITECTURE.md`

Delivery keys are now:

- `js/globe.js?v=v11`
- `/sw.js?v=34-truth-copy`
- cache `elu-v34-truth-copy`

`ARCHITECTURE.md` is protected, so a future PR requires human/CODEOWNER review.

## Review and verification state

Independent UI review:

- Review artifact:
  `data/climate/reviews/climate-factual-runtime-ct42-ui-review.json`
- Review ID:
  `ct-42-truth-copy-independent-ui-review-2026-07-15T232047Z`
- Reviewed runtime commit:
  `bd5b6ef63df2ba17103e78351aedf677fb2d339f`
- Reviewer:
  `truth-copy-independent-ui-reviewer`
- Result: 15/15 gates passed; 23 canonical runtime paths pinned
- SmokeTest: 22/22, zero failed, zero critical
- StackLint: zero issues
- Responsive checks: 320×720, 375×720, and 640×400 at device scale factor 2;
  zero horizontal overflow, zero card-header overlap, 44px minimum controls
- Forced-colors gate is explicitly recorded as a continuity inference: the CSS
  is byte-identical to the prior independent review and all 104 DOM/semantic
  hooks are unchanged. Fresh China/Greenland text, focus, and reflow checks
  passed; the artifact does not claim a fresh forced-colors emulator run.

Full climate truth CI:

```bash
node tools/climate-truth-ci.js
```

Result: every configured gate passed. Overall status remains `INCOMPLETE` only
because the reviewed runtime manifest and reviewed release diff are deliberately
absent. CI calculation hash:
`6d199ef61e6fcfc3c3568058a588fb152901db125f7991b52c46e13b57aa18c0`.

Candidate production readiness:

```bash
node tools/check-climate-production-readiness.js --candidate
```

Result: `CANDIDATE_INTEGRITY_READY_RELEASE_BLOCKED`.

Candidate staging and final integrity:

```bash
./tools/build-deploy.sh --candidate
ELU_VERIFIED_DEPLOY_MODE=candidate \
  node tools/check-staged-production-integrity.js --staged _deploy
```

Result: PASS — 46 exact public files, 23 final CT-45 runtime rehashes, notice
and footer parity, and the approval boundary preserved.

Rollback proof:

- Runtime control commit:
  `bd5b6ef63df2ba17103e78351aedf677fb2d339f`
- Review-chain commit:
  `ce22cd22d79dba2d3b2945d81a03f1ec197b468a`
- Proof calculation hash:
  `201be9c92d15f07280474f2f8fc513250a0cb1fa9602582d5eda697eb89164be`
- Patch artifact SHA-256:
  `95302814f0b32fad2be40f668f68582f3897204336c00d260ee438bf29740029`
- Static/materialization rehearsal: PASS
- Independent production rollback approval remains absent by design.

## Truth boundary that must remain intact

CT-40 currently reports a truthful assessed-release `DENY`, while all 2,060
reviewed facts remain eligible for factual display and magnitude comparison.
Commitments, targets, delivery, derived performance, impact bands, and climate
scores are not present or assessed. Do not convert missing assessment data into
zeroes, favorable colors, positive status, or inferred commitments.

The release is intentionally blocked by:

- unresolved rights dispositions for all five globe asset groups;
- four unresolved licensing-counsel questions;
- unprovisioned approval trust registry and absent role signatures;
- absent reviewed runtime manifest and reviewed release diff;
- absent independent production rollback approval and release authority.

NASA is not the blocker. The Black Marble credit and exact provenance are in
place; production still requires the repository's own human rights/approval
workflow.

## Known follow-up issue

The local server logged two pre-existing missing legacy images during QA:

- `/assets/legacy/ishita.png`
- `/assets/legacy/dove.jpg`

They were not introduced by the climate-copy mission and did not alter the
climate integrity result, but they should be restored or their references
updated before a public launch.

## Recommended next mission

1. Start by reading `AGENTS.md`, `ARCHITECTURE.md`, this handoff, and
   `docs/CLIMATE-PRODUCTION-READINESS.md`.
2. Confirm the worktree is still clean and that no overlapping mission/PR is in
   flight.
3. Resolve the two legacy image 404s in a small, separate mission.
4. Begin the human-controlled asset-rights and release-authorization workflow;
   never invent reviewers, decisions, signatures, or approval keys.
5. Generate the reviewed runtime manifest, reviewed release diff, and scoped
   release decision only after the required independent/human evidence exists.
6. Rerun full truth CI, candidate readiness, independent UI review where runtime
   bytes change, rollback verification, and staged integrity.
7. Run `./tools/build-deploy.sh --release` only after release readiness passes.
8. Push/open a PR only with explicit user authorization. Never publish the
   current `_deploy/` candidate.

To resume local inspection:

```bash
cd /private/tmp/earthloveunited-missions/globe-notices-integration
python3 -m http.server 8017 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8017/`. Stop the server when finished.
