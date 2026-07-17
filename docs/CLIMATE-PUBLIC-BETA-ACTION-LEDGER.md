# Climate Public Beta release action ledger

Status date: 2026-07-17

Current state: the mission branch contains the initial plan and ledger commits,
while its unstaged tree contains both a deterministic non-deploying foundation
candidate and later deployment-control/CI candidates that are being split.
The task owner directed engineering to prepare, test, and present the exact F
diff. That 63-path diff has been reproduced from a clean checkout with zero
deployment controls and zero release artifacts. Draft publication and the
protected GitHub CI run remain pending; no generated runtime/governance
release artifact, complete deployable beta package, or authority exists.
Verified fixtures currently
pass policy 5/55, access bootstrap 6/95, remote evidence 10/58, readiness 48
cases, governance contracts 4/74, artifact generation 4/8, package 7/74 plus
18 schema-semantics cases, and diff classification 7/14. The local 320px
fail-closed browser check passed; protected browser/GitHub CI remain pending.

**HIGH blocker:** no implemented transaction binds a fresh access gate and
immutable staged-tree digest to the exact-project Direct Upload, provider
deployment ID/origin/receipt, immediate denial and
exact-surface plus forbidden/candidate/governance/`sw.js` probes, and signed
operator evidence.
Existing check/build/stage commands followed by a later upload have a TOCTOU
and inventory-binding gap. No upload is legitimate until `HIGH-01` is
implemented, independently reviewed, BA-pinned, and genuinely executed.

**HIGH blocker:** current canonical repository setup is squash-only and
requires linear history, while the auto-merge workflow always requests a
squash. Both paths destroy the exact BR/BP/BA object IDs. `HIGH-02` remains
open until those controls are excluded from F, introduced and reviewed only
on the active package branch, pinned by BA, applied by a maintainer, and the
package PR is merged without squash, rebase, or auto-squash.

**HIGH blocker:** default pull-request checkout evaluates GitHub's synthetic
merge ref, not the exact package head. Naming the PR-head SHA in environment
variables does not change the checked-out tree. `HIGH-03` remains open until
an isolated authority job asserts `HEAD == github.event.pull_request.head.sha`
and validates exact BA, while a distinct non-authorizing job tests the
synthetic merge result.

**HIGH blocker for protected F merge:** the unchanged `main` workflow runs
assessed candidate readiness and `climate-truth-ci --allow-incomplete`
unconditionally. Both currently exit nonzero because the real CT-42 UI and
rollback review commits are not ancestors of merged `main`; the truth run also
reports the absent assessed release diff and runtime manifest. This is not a
beta-content failure, but F may not weaken or bypass it. A draft PR can be
presented; merge requires legitimate review-history resolution or contrary
evidence from the actual protected run.

This ledger governs the separate factual Climate Public Beta. It does not
alter, satisfy, or bypass the assessed-climate production gates. The existing
production origin remains on its previously approved release until the
assessed-production process is genuinely complete.

No row marked `human required` may be closed by an agent, a schema, a passing
checker, provenance, or a plausible-looking JSON record. Identities, review
outcomes, rights decisions, operational observations, timestamps, authority,
public keys, and detached signatures must come from the real responsible
people. Private signing keys never enter the repository.

## Release states and permitted actions

| State | Meaning | Permitted action | Explicitly not permitted |
|---|---|---|---|
| `blocked` | Package or authority evidence is incomplete or invalid | Engineering and private evidence preparation | Staging, deployment, sharing, public activation |
| `package_valid_publication_blocked` | Complete reviewed BA package; exact-head authority and separate merge-result compatibility checks pass; commit-preserving settings are active; no level approval | Protected package merge that preserves exact BR/BP/BA object IDs | Squash/rebase/auto-squash, staging, deployment, sharing |
| `l1_approval_record_valid_publication_blocked` | Public CI authenticated the exact L1 approval record and lineage, without private access/remote evidence | Protected approval-only review/merge | Staging, deployment, invited sharing |
| `l2_approval_record_valid_publication_blocked` | Public CI authenticated the exact L2 approval record, L1 lineage, and signed private-index hash, without materializing private evidence | Protected approval-only review/merge | Staging, deployment, public activation or any claim that private evidence passed |
| `l1_preflight_deployment_authorized` | Machine-named preflight state: exact L1 approval and signed private L1 access bootstrap verify; it does not close `HIGH-01` | Build/freeze the immutable staged tree and prepare the future trusted transaction | Direct Upload, invited sharing, or any claim that the checked tree was uploaded |
| `shareable_l1` | `HIGH-01` signed transaction receipt plus signed, ordered, currently fresh L1 remote preflight verify | Share only with the approved invited cohort under access control | Public access |
| `l2_preflight_deployment_authorized` | Machine-named preflight state: exact L2 approval, invited evidence, and chained private L2 access bootstrap verify; it does not close `HIGH-01` | Build/freeze exact unchanged bytes and prepare the repeated trusted transaction | Direct Upload or public activation |
| `authorized_for_public_activation` | Repeated `HIGH-01` receipt plus signed, ordered, currently fresh L2 remote preflight verify after the signed invited-evidence chain and later L2 approval | One controlled exposure change, immediately followed by probes | Claiming monitoring is complete |
| `live_public_beta_monitoring` | Immediate public probes occur after the prior signed transition and pass current freshness | Keep live only during the frozen monitoring window | Claiming final verification |
| `verified_live_public_beta` | Frozen monitoring window and its later signed, currently fresh evidence pass | Continue the public beta under its correction/withdrawal policy | Assessed-production or climate-performance claims |

## Required commit sequence

1. Under the operational `HB-00` direction already received, integrate, test,
   and present `F`, the protected
   non-deploying foundation-only tooling/docs PR with no beta runtime manifest,
   frozen decision, review claim, key, signature, authority, workflow change,
   or deployment control. F excludes `.github/workflows/**`,
   `climate-public-beta/_headers`, `tools/build-climate-public-beta.sh`,
   `tools/check-climate-public-beta-diff-boundary.js`,
   `tools/check-climate-public-beta-readiness.js`,
   `tools/lib/climate-public-beta-diff-boundary.js`,
   `tools/stage-climate-public-beta.js`,
   `tools/check-staged-climate-public-beta-integrity.js`, `tools/org-setup.sh`,
   and every equivalent
   staging/build/upload/exposure path.
2. From exact merged `F`, freeze the exact release ID, policy, public-key trust,
   review protocol, feedback/privacy contract, hosting/access model, and rights
   path; complete rights/notice decisions; `--prepare`, obtain signed
   rights/data reviews, `--seal`, and generate the runtime manifest.
3. Commit **BR**, the exact pre-results UI review subject. Execute the frozen
   protocol against BR, record genuine canonical results, obtain the signed UI
   review, generate the surface/diff, and obtain package review. Only on this
   active branch, complete the event-relative beta CI and all deployment
   controls before BP; this includes `tools/org-setup.sh`, auto-merge behavior,
   canonical merge settings, an isolated exact-head authority job, and a
   separate synthetic-merge compatibility job. None may be backported to F.
4. Commit **BP**, the nonpublishable pre-rollback-proof package. Execute
   rollback from BP—including its exact deployment controls—to the frozen
   post-`F` baseline in an isolated worktree and obtain its independent signed
   review.
5. While HEAD is BP, generate the scope that pins the proof/review, then commit
   **BA**. The BA scope must also pin `.github/workflows/**`, `_headers`, the
   builder/stager/final checker, `tools/org-setup.sh`, the canonical merge
   settings and auto-merge behavior, exact-head/merge-result CI, and the future
   trusted-upload transaction.
   Open the first PR containing any deployment control: the nondeployable
   package PR whose protected review validates exact BA in isolation and the
   merge result separately. Before merge, an authorized maintainer applies the
   reviewed commit-preserving settings. The PR must not squash, rebase, or use
   auto-squash, and its merge must preserve BR, BP, and BA object IDs.
6. After the merge, obtain offline L1 approval against exact merged BA; commit
   and merge only its detached approval pair as **BB-L1**.
7. Complete the signed private L1 holding/access bootstrap and immutable staged
   tree. Direct Upload is still prohibited until `HIGH-01` is implemented and
   independently reviewed. Then execute the one trusted transaction that
   repeats the fresh access gate, binds the immutable digest to the exact
   project upload and provider receipt, immediately probes denial and
   forbidden/candidate/governance/`sw.js` paths, and produces signed operator
   evidence. Probe the resulting exact deployment in canonical record order;
   attest/sign while the critical observations are fresh; only then invite
   reviewers. The invited-evidence transition begins strictly after that
   preflight `signed_at`.
8. After the invited-evidence package is signed, bind it in offline L2 approval
   whose `approved_at` is not earlier than that evidence `signed_at`; commit and
   merge only its detached approval pair as **BB-L2**.
9. Complete chained private L2 bootstrap/evidence, repeat the reviewed
   `HIGH-01` trusted transaction for the unchanged L2 tree, and complete the
   ordered/current remote preflight. Each activation/monitoring transition
   begins, attests, and signs strictly after the prior transition's `signed_at`;
   only then perform the one approved exposure change and signed
   monitoring/withdrawal sequence.

BR must be an ancestor of BP, BP an ancestor of BA, BA an ancestor of BB-L1,
and BB-L1 an ancestor of BB-L2 (or their exact preserved merged-main
equivalents). Bound bytes remain identical across each edge. Squash or rebase
that changes BR requires new human protocol execution/review; a changed BP
requires a new rollback execution/review; a changed BA or approval-bound commit
requires new offline authorization. No signature is rewritten to fit history.

The repository's current squash-only/linear-history setup and auto-squash
workflow contradict this sequence; they are not accepted defaults for the
package PR. A maintainer must apply the BA-pinned reviewed settings, and the
post-merge ancestry report must prove that the exact BR, BP, and BA object IDs
are reachable from `main`. Pull-request CI must also keep two different facts
separate: exact-head package/readiness authority runs only from an isolated
checkout whose HEAD equals the PR-head SHA, while synthetic merge-ref testing
is compatibility evidence only and grants no package authority.

## Deterministic engineering ledger

| Blocker / check ID | Required evidence or decision | Responsible role | Target artifact | Relevant schema / checker | Dependencies | Current status | Verification command |
|---|---|---|---|---|---|---|---|
| `BE-01-isolated-surface` | Dedicated UI with persistent beta/non-assessment copy and no production-globe coupling | Release engineering | `climate-public-beta/index.html`, `climate-public-beta/css/beta.css`, `climate-public-beta/js/beta.js`, incomplete notice template; `_headers` excluded from F | `tools/check-climate-public-beta-ui.js` | None | Foundation candidate; current notice intentionally incomplete; local 320px fail-closed browser check passed, protected browser CI pending | `node tools/check-climate-public-beta-ui.js --self-test` |
| `BE-02-opaque-data-preparation` | Stable opaque entity/fact allocation; 249 entities, 206 series, 43 gaps, 2,060 facts | Climate data engineering | Preparation fixtures and schemas | `tools/check-climate-public-beta-data.js` | Frozen CT-10C inputs | Foundation candidate; exact Debian `iso-codes` source SHA-256 and 249-row registry transformation also reverified; grants no publication authority | `node tools/check-climate-public-beta-data.js` |
| `BE-03-fresh-raw-rebuild` | Fresh read of exact PRIMAP v2.6.1 raw CSV must reproduce pinned normalized facts | Climate data engineering | Private rebuild report; no candidate output in public surface | `tools/check-climate-public-beta-raw-rebuild.js` | Exact external raw CSV | Local source-backed reconstruction passed: official Zenodo bytes matched size, MD5, SHA-256, 206 series, 2,060 observations, 43 gaps, and the pinned candidate/calculation hashes; raw-backed CT-10B, CT-10B-R, and CT-10C-R checks also passed. The raw file remains outside the repository and no durable release-evidence claim is made | `node tools/check-climate-public-beta-raw-rebuild.js --source /absolute/path/to/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv` |
| `BE-04-reviewed-runtime-finalization` | Exact final-shaped seven-file release proposed outside the repository; signed rights/data reviews pin those exact bytes and the private proposal descriptor; sealing copies without mutation; later corrections enter only through a privacy-safe exact private input | Climate data engineering | `data/climate/public-beta/runtime/releases/<beta-id>/{country-factual,country-identity,country-identity.SOURCE.md,country-identity-transform,fact-lineage,known-limitations,correction-log}` | Six reviewed runtime schemas; `tools/check-climate-public-beta-reviewed-data.js` | `HB-04`, `HB-07`, exact raw CSV | Foundation candidate finalizer individually verified: 13 positive/43 fail-closed cases, 7 runtime files, deterministic empty first history, reviewed nonempty later history, 10/11 initial/later data pins, 12 rights pins; real proposal/runtime absent | `node tools/check-climate-public-beta-reviewed-data.js --self-test`; after genuine reviews, `--seal` and `--check` |
| `BE-05-runtime-support-files` | Exact identity source notice, transform log, limitations, privacy-safe correction log, licence text, completed readable notices, and feedback/privacy URLs bound to the frozen contract | Climate data engineering; rights preparer | Seven-file runtime release set, canonical LGPL text, `THIRD_PARTY_NOTICES.txt`, runtime manifest | Finalizer, generator, runtime/package/UI reviewed-notice, privacy-binding, and correction-hash checks | `HB-04`, `HB-05` | Foundation candidate contracts; UI verifies empty/nonempty correction history; each later correction pins 1+ affected superseded artifacts; incomplete notice intentionally blocks real proposal; runtime manifest absent | `node tools/check-climate-public-beta-ui.js --notice-mode reviewed <exact-HB-01-release-id>` |
| `BE-06-policy-and-trust` | Exact release ID; Cloudflare project/`main`/`pages.dev` origin/suffix; stable aliases; complete Access bundle reference; holding hash; denial rules; governance-contract hashes; thresholds; baseline; rollback; roles; public Ed25519 keys | Release engineering plus named humans | `data/climate/public-beta/governance/{policy.json,approval-trust.json}` | Climate Public Beta policy/trust schemas; `tools/check-climate-public-beta-policy.js` | `HB-01`–`HB-06` | Passes 5 valid states / 55 fail-closed mutations, including duplicate-key ambiguity and revoked-key chronology; real policy/trust/keys absent | Policy self-test |
| `BE-06a-governance-contracts` | Canonical frozen review protocol and feedback/privacy contract; canonical completed UI/accessibility/comprehension results binding exact BR and both contract hashes | Protocol/privacy owners; UI/accessibility/comprehension executor; release engineering | `governance/{review-protocol.json,feedback-privacy-contract.json}`; `governance/releases/<beta-id>/ui-accessibility-comprehension-results.json` | Three governance schemas; `tools/check-climate-public-beta-governance-contracts.js` | `HB-05`, `HB-06`, BR, genuine execution | Foundation candidate contract engine passes 4 valid fixtures / 74 fail-closed mutations; real contracts/results absent | `node tools/check-climate-public-beta-governance-contracts.js --review-protocol <path> --feedback-privacy-contract <path> --ui-accessibility-results <path> --beta-release-id <exact-HB-01-release-id>`; self-test uses `--self-test` |
| `BE-06b-artifact-generator` | Deterministically create runtime manifest, expected surface, release diff, BP-bound executable rollback proof, and later BA scope without overwrite or authority claims | Release engineering; genuine rollback executor for execution fields | `runtime-manifest.json`, `public-surface-manifest.json`, `release-diff.json`, `rollback-proof.json`, `scope-manifest.json` | `tools/generate-climate-public-beta-artifacts.js` plus artifact schemas | Exact ordered inputs and real identities/times where required | Foundation candidate generator passes 4 positive / 8 fail-closed cases; no real release artifact generated | `node tools/generate-climate-public-beta-artifacts.js --self-test` |
| `BE-07-package-scope` | Canonical BA scope pins every statically listed and dynamically discovered workflow/deployment control, exact proof/review, and real release-builder identity; later approvals excluded | Release engineering | `governance/releases/<beta-id>/scope-manifest.json` | Generator; scope schema; package checker | Exact BP controls, proof and signed rollback review; signed package review | Package fixtures cover static/dynamic control discovery; real scope absent | Generate the scope, then run the package checker against exact BA inputs |
| `BE-08-release-diff` | Exact 14-path public-surface diff plus full inventory of statically listed and dynamically discovered workflows/deployment controls; independent package review before BP | Diff builder; `beta_package_reviewer` | `release-diff.json`, control inventory, `independent-package-review*.json` | Generator; release-diff schema; package checker; signed-evidence policy | Exact surface manifest and complete active-branch control set | Package review engine covers static and dynamic controls/workflows; real diff/review absent | Generate the diff/control inventory, run package validation, then obtain the exact signed review before BP |
| `BE-09-rollback-proof` | Exact BP target tree, complete baseline projection, exact Git modes, isolated executable rehearsal, policy/hosting-bound withdrawal plan, real executor/subject identities and times, independent review relationship/chronology; later scope pins proof | Rollback builder; `beta_rollback_reviewer` | `rollback-proof.json`, `independent-rollback-review*.json` | Generator; rollback/scope schemas; package/readiness checkers | Clean exact BP; `HB-02`, `HB-06`, `HB-10` | Package engine passes 7 positive / 74 fail-closed plus 18 schema-semantics cases; generator enforces BP-before-scope; real proof/review absent | Generate rollback proof; after scope, validate it with the bound-scope package check |
| `BE-10-exact-surface` | BA-bound controls stage only the 14 approved files, with exact source/staged hashes and no governance/candidate bytes; stager/build require real access-bootstrap preflight | Release engineering | `public-surface-manifest.json`, `_deploy_beta/` | Surface/stager/final-integrity/readiness checkers | Runtime package; `BE-11a` | The pure read-only surface verifier is foundation-safe. `_headers`, readiness, diff-boundary, stager, builder, and final staged-integrity controls are deferred to the active package PR; no current control binds a later upload | Surface self-test in F; staged-integrity self-test only on the later package branch |
| `HIGH-01-trusted-upload-transaction` | One reviewed execution repeats the fresh access gate; freezes paths, modes, per-file hashes, and aggregate digest; Direct Uploads that immutable tree to the exact project; captures deployment ID/origin/provider receipt; immediately probes denial, exact allowed bytes, forbidden/candidate/governance paths and `/sw.js`; and signs every input/result | Release engineering; `beta_release_operator`; `beta_package_reviewer` | BA-pinned transaction command, schema/checker, private report, provider receipt, probe bundle, detached operator signature | Not implemented; future transaction schema/checker plus dynamic-control discovery | Exact BA, level approval, signed bootstrap, immutable staged tree, operator public key | **HIGH / blocked:** no existing wrapper or check-then-later-upload runbook closes TOCTOU/inventory binding; no upload permitted | No command exists yet; implement, adversarially test, independently review, and BA-pin before use |
| `HIGH-02-commit-preserving-merge-governance` | BA pins reviewed canonical repository settings and auto-merge controls; live settings allow a merge commit and disable required linear history, squash, rebase, and package auto-squash for the package merge; exact BR/BP/BA object IDs remain reachable from merged `main` | Release engineering; repository maintainer; `beta_package_reviewer` | `tools/org-setup.sh`, `.github/workflows/auto-merge.yml`, canonical settings contract, signed package review, settings snapshots, merge record, post-merge ancestry report | Package checker and static/dynamic control discovery; GitHub settings audit; Git ancestry checks | Active BR/BP/BA branch; `HB-00`, `HB-00a`, `HB-10` | **HIGH / blocked:** current setup is squash-only with required linear history and auto-merge requests `--squash`; no package PR or applied safe settings exist | Package validation on exact BA; maintainer settings audit; post-merge `git merge-base --is-ancestor` for exact BR, BP, and BA against `main` |
| `HIGH-03-exact-pr-head-ci` | An isolated authority job checks out the exact PR-head SHA, asserts HEAD equality, and runs package/readiness gates; a separate non-authorizing job tests GitHub's synthetic merge result | Release engineering; repository maintainer; `beta_package_reviewer` | BA-pinned protected workflow, exact-head check report, merge-result compatibility report | GitHub Actions; package/readiness/diff checkers; static/dynamic workflow discovery | Active BR/BP/BA branch; `HB-00`, `HB-10` | **HIGH / blocked:** default pull-request checkout is a synthetic merge ref; changing only a diff environment variable cannot authenticate BA | Protected package-PR run with exact-head `git rev-parse HEAD` equality assertion, followed by the distinct merge-result compatibility job |
| `BE-11-remote-evidence` | Stable aliases plus actual atomic origin; exact observation order deployment→access→surface→browser→baseline→rollback→feedback; each later transition strictly after prior `signed_at`; L2 approval after signed invited evidence; current critical records within one frozen probe interval | `beta_release_operator`; `beta_rollback_reviewer` | Private canonical evidence package, transition chain, signed wrappers/hashes | `tools/check-remote-climate-public-beta.js` | Verified `HIGH-01` receipt for exact project/tree/deployment; prior signed transition where applicable | Checker passes 10 positive / 58 fail-closed cases; no real evidence | Remote checker self-test, then real exact evidence |
| `BE-11a-preupload-access-bootstrap` | Before approved bytes are uploaded, replacement-safe Access is observed on beta-free holding bytes across stable aliases plus the exact atomic holding deployment origin; operator and independent rollback reviewer sign the private report | `beta_release_operator`; `beta_rollback_reviewer` | Outside-repository `invited_beta/` and later `public_beta/` access-bootstrap report/signature pairs | Access-bootstrap schemas; `tools/check-climate-public-beta-access-bootstrap.js` | `HB-02`, `HB-02a`, provisioned trust, exact level approval | Contract passes 6 positive / 95 fail-closed cases; no real observation/signature; this precondition does not close `HIGH-01` | Access-bootstrap self-test; real readiness uses `--access-bootstrap /absolute/private/root` |
| `BE-12-readiness` | Derive governance/results, BR/package/HEAD ancestry, modes, scope, review pins, approval/signature, assessed boundary, rollback, private paths, bootstrap, and ordered/fresh evidence | Release engineering | Structured readiness report | `tools/check-climate-public-beta-readiness.js` | All preceding artifacts | Checker passes 48 cases and actual probe remains `blocked`; current readiness does not implement or verify `HIGH-01`, `HIGH-02`, or `HIGH-03`, so its status alone cannot authorize a package merge or upload | Default readiness JSON command |
| `BE-13-diff-boundary` | F proves zero release/approval/workflow/deployment-control paths; later beta changes select unsigned/L1/L2 gates; active package integrity and static/dynamic control discovery run; deletions fail closed | Release engineering | Active-package CI diff report | `tools/check-climate-public-beta-diff-boundary.js` | Readiness/package checker | 7 expected-pass / 14 adversarial classifications pass. Event-relative semantics are reserved for the active BR/BP/BA package PR after protected F merge; fixed `a476…` cannot remain recurring | Diff-boundary self-test and live base/head comparison |
| `BE-14-assessed-isolation` | Existing assessed readiness/truth results remain exact; beta paths never count as assessed evidence | Climate truth engineering | Assessed-boundary probe | `tools/check-climate-public-beta-assessed-boundary.js` and existing assessed checkers | Clean committed tree | Latest assessed rerun shows no beta regression; CT-44 vendor integrity passes. Pre-existing CT-42 ancestry and missing assessed release artifacts remain L3 requirements; because the unchanged workflow runs candidate readiness and partial truth unconditionally, CT-42 is also a protected F merge blocker | `node tools/check-climate-public-beta-assessed-boundary.js` |
| `BE-15-browser-accessibility-smoke` | Fail-closed browser at 320px; no values without manifest; disabled feedback; no external automatic requests; verified correction history after hashes | UI engineering | Browser report | `tools/check-climate-public-beta-browser.mjs` | Protected browser CI | In-app local 320px test passed: no horizontal overflow, exact visible fail-closed alert, no external automatic assets, no console errors. Protected CI execution still required | `node tools/check-climate-public-beta-browser.mjs http://127.0.0.1:<port>` |
| `BE-16-protected-ci` | F leaves `.github/workflows/**` unchanged; active package PR later introduces protected beta CI, event-relative semantics, isolated exact-head authority, distinct merge-result compatibility, static/dynamic control discovery, and nonpublication states | Repository maintainers | `.github/workflows/ci.yml`, branch protection, CODEOWNERS in BA scope | GitHub Actions, package checker, diff boundary | Active BR/BP/BA package; operational F direction | Deferred local wiring must not enter F; no protected F CI result exists at this checkpoint. Later package review, BA pins, maintainer-applied commit-preserving settings, and exact post-merge ancestry are required. Current assessed CT-42 failures remain a protected F merge blocker and must not be suppressed | Existing protected checks on draft F; later exact-head and distinct merge-result jobs on the active package PR |

## Human decision and evidence ledger

| Blocker / check ID | Required evidence or decision | Responsible human role | Target artifact | Relevant schema / checker | Dependencies | Current status | Verification command |
|---|---|---|---|---|---|---|---|
| `HB-00-foundation-ci-merge-policy` | Prepare non-deploying F with `.github/workflows/**`, `_headers`, builder, stager, final checker, `tools/org-setup.sh`, and every deployment-control path excluded; later introduce event-relative CI, exact-head/merge-result jobs, canonical settings/auto-merge, and all controls only in active BR/BP/BA with static/dynamic review and BA pins; preserve exact BR/BP/BA object IDs in the eventual package merge | Repository/foundation maintainers | F diff; later active package PR, branch protection, BA-scoped workflow/controls | Existing protected checks for F; later GitHub/package/diff checks | Operational direction from the current task; exact F diff and protected review pending | Task owner directed engineering to proceed with F preparation and presentation. This is not release evidence or merge authority; workflow/control edits remain excluded and the exact F diff still requires protected human review | Exact staged-inventory and clean-checkout verification, then protected draft-PR review; later controls receive separate protected review |
| `HB-00a-live-merge-settings` | Before the package PR merge, apply the reviewed BA-pinned settings: permit merge commits, disable required linear history and squash/rebase modes for this merge, prevent package auto-squash, record the live settings, merge without rewriting commits, and verify exact BR/BP/BA reachability from `main` | Authorized repository maintainer | External settings snapshots, package-PR merge record, post-merge ancestry report | Canonical settings contract; GitHub settings audit; Git ancestry checks | Exact BA; signed package review; protected exact-head and merge-result checks | Human/external action required; current live/scripted policy is contradictory and must not be silently reinterpreted | Maintainer settings audit, merge record, and exact post-merge ancestry commands |
| `HB-01-product-scope` | Choose the exact immutable beta release ID; approve product name, factual-only claim classes, exclusions, source/version/year/count scope, and L1/L2 meaning | Foundation maintainer; climate data steward | `policy.json`, review/results IDs, runtime manifest, public copy | Policy/governance/runtime/UI checks | None | Human required; no release ID chosen or claimed | Readiness package transition |
| `HB-02-origin-access` | Choose dedicated Cloudflare Pages project and DNS-label ID, `main` metadata, exact `pages_dev_origin` and deployment suffix, stable L1/L2 origins/aliases/custom domains, complete Access app/policy bundle reference covering apex/wildcard/custom hosts, beta-free holding hash, denial rules, and trusted Direct Upload operator | Foundation maintainer; release operator; security/operations owner | `policy.json`, external hosting/Access configuration | Policy, access-bootstrap, rollback, and remote checks | `HB-01` | Human/external action required; automatic Git deployment is not selected | Policy and access-bootstrap checkers |
| `HB-02a-signed-access-bootstrap` | Configure exact protected holding deployment before approved upload; probe all stable aliases plus actual atomic holding origin; operator and independent rollback reviewer sign private report offline | `beta_release_operator`; `beta_rollback_reviewer` | Outside-repository access-bootstrap report/signature chain | Access-bootstrap schemas/checker; readiness | Exact approval, `HB-02`, provisioned trust | Genuine external observation/review/signing required; no report exists; passing it does not close `HIGH-01` | Access-bootstrap readiness preflight |
| `HB-02b-trusted-upload-evidence` | After `HIGH-01` exists and exact approval/bootstrap pass, execute its single transaction against the exact project/tree; capture receipt/origin and immediate denial, exact-surface, forbidden/candidate/governance, and `/sw.js` probes; sign offline | `beta_release_operator` | Private trusted-upload report, receipt, probe bundle, detached signature | Future `HIGH-01` schema/checker; operator trust key | BA-pinned reviewed transaction, exact staged tree, approval, `HB-02a` | Human/external action required later; no wrapper or genuine receipt exists | Future transaction verifier; no command exists now |
| `HB-03-identities-public-keys` | Name the real release builder and seven beta roles; obtain consent for public attribution; provision only public Ed25519 SPKI keys and validity/revocation data | Foundation maintainer; each role holder | BA scope builder field; `approval-trust.json` | Trust registry/policy checks | `HB-01` | Human required; no identities or keys invented | Readiness trust/package reports |
| `HB-04-source-rights` | Decide exact PRIMAP and Debian `iso-codes` factual use, redistribution, attribution, modification notice, source-access/corresponding-source, disclaimer, and public attestation text | `beta_rights_reviewer`; qualified licensing counsel if the organization requires it | Completed notices/licence/source records; `source-rights-review*.json` | Signed-evidence policy; reviewed notice/data finalizer | Exact proposed output use and bytes | Human rights judgment required | Finalizer seal plus policy package review |
| `HB-05-feedback-privacy` | Approve/freeze accountable owner, controller/processors/contacts, exact feedback/privacy URLs, fields, purpose, anonymity/consent, retention/deletion/access/redaction, abuse, data-subject/privacy requests, and private security route | Foundation privacy/operations owner; counsel if required | `feedback-privacy-contract.json`, runtime manifest feedback URLs, public privacy notice | Governance/runtime/UI/remote checks | Chosen provider and stable origin | Human organizational/privacy decision required; schema cannot decide it | Governance-contract checker and runtime binding |
| `HB-06-frozen-review-risk-controls` | Name protocol owner; freeze exact browser/device/input/assistive matrix, required checks, comprehension prompts/pass criteria, cohort/session/accessibility minima, severities/no-go rules, monitoring/probe thresholds, approval validity, baseline, withdrawal, response target, and rollback target before results | Foundation maintainer; protocol owner; release operator; rollback reviewer | `review-protocol.json`, `policy.json`, rollback/remote controls | Governance/policy/package/remote checks | `HB-02`, `HB-05` | Human review-design/risk decision required; no protocol exists | Governance and policy validation |
| `HB-07-data-review` | Independently review exact final proposed factual/identity/lineage bytes, joins, units, transformations, gaps, limitations, and no-assessment boundary; sign exact pins | `beta_data_reviewer`, independent of builder | `independent-data-review*.json` | Signed-evidence policy; finalizer seal | `BE-03`, `BE-04`, `HB-04` | Genuine independent review required | Finalizer seal and readiness package review |
| `HB-08-comprehension-results-review` | Execute frozen comprehension prompts against exact BR; record privacy-safe sessions/findings/results; review exact beta/non-assessment/gap/identity/feedback copy; sign exact BR/results pins | Genuine participants/executor; independent `beta_ui_accessibility_reviewer`, optionally citing a consenting specialist | `ui-accessibility-comprehension-results.json`, `independent-ui-accessibility-review*.json` | Governance/UI/signed-pin/BR-ancestry checks | BR; `HB-05`, `HB-06`; final UI/notices | Genuine execution and review required; no results/identity/time invented | Governance checker, then readiness package review |
| `HB-09-accessibility-results-review` | Execute manual keyboard, zoom, screen-reader, forced-colors, reduced-motion and device matrix against exact BR; record results; sign exact BR/results pins | Genuine executor; `beta_ui_accessibility_reviewer`, independent of UI builder | Same canonical results and UI review pair | Governance/UI/browser/signed-pin/BR-ancestry checks | BR, `HB-06`, final UI | Genuine manual review required; automated/local smoke is insufficient | Governance checker, then readiness package review |
| `HB-10-package-rollback-reviews` | Independently review/sign exact release diff/package, including static and dynamically discovered workflows/deployment controls, before BP; after BP review/sign rollback, withdrawal, alias/origin coverage, baseline, and response target before BA | `beta_package_reviewer`; `beta_rollback_reviewer` | `independent-package-review*.json`, `rollback-proof.json`, `independent-rollback-review*.json` | Package/generator/policy/readiness checkers | Complete control inventory/diff/results; BP/proof | Genuine independent reviews required; package review cannot precede complete dynamic discovery or be deferred after scope | Package checks, then readiness transition |
| `HB-11-l1-approval` | Offline approval of exact merged BA commit/scope/surface, invited level, origin/aliases/access policy, validity and revocation reference; detached Ed25519 signature | `beta_release_authorizer`, independent of builder | `approvals/invited-beta*.json` in BB-L1 | Approval schema/policy/readiness | BA and `HB-03`–`HB-10` | Human authorization/signing required | Public CI: `--purpose approval-validation`; real staging later: `--purpose access-controlled-preflight --access-bootstrap ...` |
| `HB-11a-l1-remote-signing` | After verified `HIGH-01` upload receipt, observe deployment→access→surface→browser→baseline→rollback→feedback; attest after all records; sign within the frozen interval; rollback reviewer countersigns; start invited evidence only after preflight `signed_at` | `beta_release_operator`; `beta_rollback_reviewer` | Private L1 preflight and invited-evidence packages | Remote/policy/readiness | Merged BB-L1, valid bootstrap, `HB-02b` | External observation/signing required; approval, bootstrap, or stale evidence is not shareability | Remote checker, then current invited readiness |
| `HB-12-l2-approval` | Only after signed invited evidence, approve exact BB-L1 lineage/index, public level, aliases, validity/revocation; require `approved_at >= invited-evidence signed_at`; sign offline | `beta_release_authorizer` | `approvals/public-beta*.json` in BB-L2 | Approval schema/policy/readiness/remote chronology | `shareable_l1`, signed invited evidence | Yields only nondeployable approval validity; L2 still requires chained bootstrap, repeated `HIGH-01`, and current preflight | Approval-validation, then later private chain |
| `HB-12a-public-activation-monitoring` | Perform only the approved exposure change; each activation/monitoring observation, attestation, signature, and monitoring start follows prior `signed_at`; keep freshness-critical records within the frozen interval; sign completed monitoring or execute withdrawal | `beta_release_operator`; `beta_rollback_reviewer` | Private activation/monitoring transition chain | Remote/policy/readiness | `authorized_for_public_activation` from current L2 preflight | External action required only after gate passes; stale or reversed chronology blocks/withdraws | Remote checker for activation and monitoring transitions |
| `HB-13-assessed-ci-ancestry` | Resolve the existing CT-42 UI/rollback review-ancestry failures through a legitimate history decision or fresh independent reviews; do not reinterpret them as beta evidence | Assessed-production maintainers and independent reviewers | Existing assessed review/lineage artifacts | `node tools/climate-truth-ci.js --allow-incomplete` and `--strict`; candidate readiness | Exact assessed release history | Human/review history required for L3 assessed production. It is not an L1/L2 beta-content gate, but the unchanged workflow currently makes it a protected F merge blocker | `node tools/check-climate-production-readiness.js --candidate`; `node tools/climate-truth-ci.js --allow-incomplete`; later `--strict` |

## Exact next human action

Do not sign a release yet. Engineering has the operational direction needed to
separate, test, commit, and open the non-deploying F draft. The next human
action is to review the exact protected draft-PR diff and confirm that it
contains no workflow/deployment control, generated release artifact, decision,
identity, key, signature, or authority claim. Approval of that exact diff may
authorize its merge only; it does not authorize a beta release, a person, a
key, a signature, an upload, sharing, or publication.

Next, the foundation maintainer must freeze one reviewed decision packet
covering `HB-01` through `HB-06`: the exact immutable release ID and factual
product boundary; exact Cloudflare project/`pages.dev` origin/suffix, stable
L1/L2 aliases, Direct Upload operator, and apex/wildcard/custom-domain Access
bundle; real builder/preparer identities and all seven role holders with
independence and public-key consent; the accountable rights/counsel path; the
canonical feedback/privacy contract; and the complete review protocol plus
numeric monitoring, baseline, withdrawal, and rollback thresholds. Only public
Ed25519 SPKI keys may be supplied.

Until that packet is complete, the correct machine state is `blocked`. The
next engineering action after it is frozen is to complete the rights notice
and generate a private, exact reviewed-data proposal with `--prepare`; the next
human actions are the independent rights and data reviews of those proposal
bytes. L1 authorization happens later, only after BP, rollback proof, and BA.

## Sharing decision

The invited beta may be shared with other people only when default invited
readiness reports `shareable_l1`, the remote checker passes for the exact
approved origin with ordered, currently fresh L1 evidence, the verified
`HIGH-01` receipt binds that deployment to the immutable staged tree, the
protected package run authenticated exact BA separately from merge-result
compatibility, the post-merge report proves exact BR/BP/BA reachability, and
the invited cohort/access controls match policy. The public beta may be exposed
only when default public readiness reports `authorized_for_public_activation`
after the later L2 approval, repeated verified `HIGH-01` transaction, and
ordered/current L2 preflight; immediate probes and the later signed monitoring
transition then decide whether it may remain live.

“Best effort,” transparency, and willingness to accept criticism are product
values, not substitutes for source rights, privacy accountability, independent
review, rollback capability, or authenticated release authority. Criticism is
welcomed through the approved feedback route after those minimum protections
are real.
