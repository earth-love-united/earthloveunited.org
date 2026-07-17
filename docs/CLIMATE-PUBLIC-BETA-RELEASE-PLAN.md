# Climate Public Beta release plan

- Status: protected non-deploying foundation candidate under integration;
  foundation review/merge, active-package deployment controls/CI, and every
  human release decision remain pending
- Publication authority: none
- Assessed-production authority: none
- Last updated: 2026-07-17

This plan defines a truthful, rights-safe public beta for the narrow factual
climate product that already exists in candidate form. It does not authorize
publication, relabel the current candidate, or change the requirements for the
full assessed-climate production release.

### Current position

- The foundation candidate contains the data compiler, seven-file
  reviewed-runtime finalizer, initial/later correction-history path, factual
  UI shell, pure public-surface policy, policy/trust verifier,
  governance-contract verifier, deterministic artifact generator,
  package/diff/rollback verifier, pre-upload access-bootstrap verifier, and
  remote-evidence verifier. Deployment-gating readiness and event-relative
  diff controls,
  headers, build/stage controls, and protected-CI wiring are deliberately
  reserved for the later active package PR. Nothing is merged or authoritative,
  and no generated runtime/governance release artifact or complete deployable
  beta package exists.
- Individually verified adversarial fixtures currently report: policy 5
  passing states / 55 fail-closed mutations; access bootstrap 6 / 95; remote
  evidence 10 / 58; readiness 48 cases; governance contracts 4 / 74; artifact
  generation 4 / 8; package validation 7 / 74 plus 18 schema-semantics cases;
  and deferred diff classification 7 expected-pass / 14 adversarial. The full
  mixed-tree local regression passed. The in-app local 320px fail-closed
  browser check also passed with no overflow, external automatic assets, or
  console errors. These applicable results must still be reproduced from the
  exact clean F commit before the branch is pushed; the protected browser job
  and full GitHub CI remain pending.
- Fresh official PRIMAP and Debian `iso-codes` source reads reproduce the
  pinned 249-entity, 206-series, 43-gap, 2,060-observation boundary. This is
  engineering evidence, not rights approval or publication authority.
- No real beta policy, trust registry, reviewed runtime, signed human review,
  release approval, private access-bootstrap/remote evidence, deployable
  manifest, or public beta origin exists. In the mixed local design, the
  deferred active-package readiness checker therefore reports `blocked`,
  permits only deterministic preparation, and denies staging,
  deployment, invited sharing, public activation, assessed authority, and any
  production-origin change.
- **HIGH blocker:** no implemented command binds a fresh access check and an
  immutable staged-tree digest to the later Direct Upload and provider
  receipt. Existing build/stage checks cannot prove which bytes were actually
  uploaded. L1 and L2 deployment remain blocked until the exact trusted upload
  transaction and signed operator evidence described below are implemented,
  reviewed, and verified.
- **HIGH blocker:** `tools/org-setup.sh` currently enforces squash-only merges
  plus required linear history, and `.github/workflows/auto-merge.yml` always
  requests `--squash`. That destroys exact BR/BP/BA commits. The reviewed
  canonical settings and auto-merge behavior must become active-package
  deployment controls, be BA-pinned, disable required linear history, prohibit
  squash/rebase/auto-squash for the package PR, and be applied by an authorized
  maintainer before its merge.
- **HIGH blocker:** default PR checkout tests GitHub's synthetic merge ref,
  while diff variables merely name the PR head. Exact BA validation requires
  an isolated checkout whose HEAD is the exact PR-head SHA, plus a separate
  synthetic-merge compatibility test. That two-job split is not implemented.
- **HIGH blocker for protected F merge:** the unchanged `main` workflow runs
  assessed candidate readiness and `climate-truth-ci --allow-incomplete`
  unconditionally. Both currently exit nonzero because the genuine CT-42 UI
  and rollback review commits are not ancestors of merged `main`; the latter
  also truthfully reports the absent assessed release diff and runtime
  manifest. F must not suppress, tolerate, or reinterpret those failures. A
  draft F PR may be presented, but protected merge remains blocked until the
  legitimate review-history issue is resolved or an actual protected run
  proves a different repository state.

The recommended implementation path begins with one protected
**non-deploying foundation-only PR (F)** containing eligible schemas,
compilers, libraries, UI shell, non-deployment checkers/tests, plan, and
ledger, but no runtime manifest, frozen policy or governance contract, review
claim, key, signature, deployable package, publication authority, workflow
change, or deployment control. F must specifically exclude
`.github/workflows/**`, `climate-public-beta/_headers`,
`tools/build-climate-public-beta.sh`,
`tools/check-climate-public-beta-diff-boundary.js`,
`tools/check-climate-public-beta-readiness.js`,
`tools/lib/climate-public-beta-diff-boundary.js`,
`tools/stage-climate-public-beta.js`, and
`tools/check-staged-climate-public-beta-integrity.js`,
`tools/org-setup.sh`, plus any other path
that can configure, stage, build, upload, or expose beta bytes.

The task owner has directed engineering to proceed with this split. That
direction authorizes preparing, testing, and presenting only the exact
non-deploying F diff; it is not release evidence or permission to merge,
stage, upload, share, or publish. After protected human review under the
existing repository checks and merge, the genuine release mission starts from
that new `main`. Event-relative beta CI and every deployment control enter only on
the active BR/BP/BA package branch, are included in the independent package
review, and are pinned by the BA scope before the package PR opens. This
includes `tools/org-setup.sh`, `.github/workflows/auto-merge.yml`, live
merge-setting requirements, and isolated exact-head/merge-result CI. BR, BP,
and BA remain distinct bound commits; the package PR prohibits squash/rebase
and must merge without changing their object IDs. L1 and L2 approvals then use
separate approval-only PRs. This sequencing gives release artifacts stable
reviewed tooling without turning F into a latent deployment path.

The assessed release action ledger remains canonical for Option 1:
`docs/CLIMATE-PRODUCTION-RELEASE-ACTION-LEDGER.md`.

## 1. Decision and product promise

Earth Love United may publish a **Climate Public Beta** before the assessed
climate product is ready, but only as a separate publication tier with its own
scope, artifacts, human decisions, checker, build, deployment surface, and
rollback.

The beta promise is:

> Source-pinned harmonized emissions estimates, explicit source gaps, and a
> transparent methodology are available for public inspection and correction.
> The beta is not an official inventory, a country climate-performance
> assessment, or an approved assessed-climate release.

“Beta” describes product maturity and the invitation to criticize it. It does
not excuse unclear provenance, missing redistribution rights, misleading
claims, inaccessible presentation, or an unsafe deployment.

### Goals

1. Produce a rights-safe, independently reviewed factual beta that can be
   shared with invited reviewers without publishing candidate or unresolved
   globe bytes.
2. Publish the same exact product on a dedicated beta origin only after invited
   criticism is triaged and a separate public approval is authenticated.
3. Preserve all 249 registry entities, the generated 206 factual-series/43-gap
   boundary, and all 2,060 displayed observations without inventing a value,
   zero, official status, assessment, or score.
4. Give every displayed value complete source/method/limitation context and a
   correction path.
5. Make every build reproducible, every public byte allowlisted and hashed,
   every exposure level explicit, and withdrawal/rollback independently
   demonstrable.
6. Keep the existing production site and every assessed-production gate
   unchanged while the beta is reviewed.

## 2. Recommended release shape

The first public beta should be a standalone, accessible, data-first climate
browser on a separate beta origin.

It should:

- show only the frozen PRIMAP-hist v2.6.1 factual emissions series already
  eligible for factual display and same-metric magnitude comparison;
- show every missing series as an explicit, visible, unranked source gap;
- expose source, version, checksum, transformation, unit, scope, limitations,
  attribution, and review state;
- use a table/search/details interface that works without WebGL;
- exclude the current 3D globe library, geometry, textures, service worker,
  candidate files, and all other unresolved climate-runtime assets;
- use an exact public-file allowlist and byte-for-byte staged verification;
- provide a visible correction and feedback route; and
- leave the existing production project on
  `./tools/build-deploy.sh --release` with output `_deploy`.

This design reduces the unresolved runtime-asset dependencies because excluding
an unresolved asset means not distributing its bytes at all. Hiding an asset in
the interface while still staging it is not exclusion. The implementation
effort must be measured before any calendar estimate is made.

A later **visual beta** may add the current globe only after the five exact
asset-rights dispositions, four counsel questions, notices, authority model,
and beta-scoped publication approval are genuinely resolved.

## 3. Current factual starting point

The current candidate contains:

| Item | Current exact scope |
|---|---:|
| Registry entities | 249 |
| Entities with factual emissions series | 206 |
| Explicit source gaps | 43 |
| Annual observations | 2,060 |
| Comparison | 2023, same harmonized metric, competition ties |
| Assessment status | Not assessed |

The eligible factual use is narrow:

- descriptive annual time-series display;
- descriptive same-metric 2023 emissions-magnitude comparison; and
- source-gap disclosure.

The current source-registry record describes PRIMAP-hist v2.6.1 as CC BY 4.0
and records normalized-value redistribution as permitted. The separate CT-10C
review attests the limited factual-display and same-metric magnitude-comparison
tiers. The CT-10C and CT-42 reviews are useful evidence of reproducibility, but
they explicitly do not grant public runtime or release authority. A new beta
publication review and approval are therefore still required.

Country identity data comes from Debian `iso-codes` under
LGPL-2.1-or-later. The beta must distribute that identity asset separately and
include the required copyright, license, warranty, source-access, and
transformation information. It must not silently fold the identity data into a
combined JSON file without preserving those obligations.

## 4. In scope and out of scope

### In scope for the first public beta

- the 249-entity registry universe;
- the 206 frozen PRIMAP-hist v2.6.1 annual factual series;
- the 43 explicit source gaps;
- same-metric 2023 magnitude ordering with ties and denominator disclosed;
- source and methodology details for every displayed value;
- accessible search, table, country/entity details, and an optional visible
  download action;
- known limitations, release notes, correction history, and feedback intake;
- exact hashes, deterministic compilation, staged-byte verification, and
  rollback.

### Excluded from the first public beta

- official-inventory claims;
- NDC commitments and targets;
- target comparability;
- derived metrics;
- climate performance, delivery, progress, ambition, fairness, or impact
  assessment;
- composite or normative scores;
- “leader”, “laggard”, “good”, “bad”, “on track”, or equivalent judgments;
- top-20 assessed country profiles;
- PRIMAP v2.7 or any source version not separately frozen and reviewed;
- pending or excluded source families, including unreviewed UNFCCC, CAT, OECD,
  IEA-EDGAR CO2, any EDGAR component not separately approved, or legacy country
  data;
- the current denied candidate manifest and candidate runtime JSON;
- `globe.gl`, the five current globe assets, and the root service worker;
- internal evidence queues, review fixtures, rollback patches, private tester
  data, or authoring tools.

Adding any excluded assessment field moves that work back under the full
assessed-production gate. Public criticism does not convert an excluded field
into an eligible one.

The static runtime JSON is already downloadable by anyone who can load the
page. Public redistribution approval is therefore required for the complete
runtime artifact whether or not the interface includes a Download button.

## 5. Truth and labeling contract

Every beta surface must carry a persistent product label. Recommended primary
copy:

> Climate Public Beta — harmonized factual emissions evidence, not a
> climate-performance assessment.

Country/entity details must communicate, where applicable:

- “PRIMAP-hist v2.6.1 final — source frozen through 2023; this beta displays
  2014–2023”;
- “Harmonized estimate; not an official Party inventory”;
- “Excludes LULUCF; uncertainty bounds are not included”;
- “2023 emissions magnitude among entities using the same metric — not a
  performance, ambition, fairness, or delivery score”;
- “Commitments and targets are not included in this beta”;
- “Climate performance: Not assessed”;
- “No value available in this release; visible and unranked”; and
- “Missing evidence does not indicate better climate performance.”

The identity disclosure must say that the 249 names and codes come from a
Debian-maintained ISO-3166-1-compatible asset, not an official ISO or UN M49
publication. Inclusion does not establish sovereignty, UN or UNFCCC status, or
eligibility for climate assessment. A real human must review the treatment of
territories and politically sensitive entities even though the first beta has
no map.

The interface must not use favorable green treatment for missing data, infer a
zero, mix metrics in one order, hide the denominator, or communicate status by
color alone.

Required evidence details for each factual series are:

- entity identifier and name source;
- source publisher, title, version, DOI or canonical URL;
- publication and retrieval dates;
- exact source and transformation hashes;
- metric, unit, years, gases, sectors, scenario, GWP convention, and LULUCF
  treatment;
- transformation and rounding notes;
- evidence plane and review state;
- attribution and license link;
- limitations and known gaps;
- beta data release ID and fact IDs; and
- a “Report a data or attribution issue” action.

## 6. Sharing levels

| Level | Meaning | Minimum admission rule |
|---|---|---|
| L0 — local candidate | Developer QA only | Existing `--candidate` boundary; never uploaded or sent as a public URL |
| L1 — invited beta review | Rights-safe beta artifact shared with named reviewers through continuously verified access control | All included bytes have sharing rights; beta truth, build, security, and rollback gates pass; reviewer brief and feedback route exist; approval is exactly L1-scoped |
| L2 — public beta | Publicly reachable dedicated beta origin | L1 complete; independent beta review complete; critical findings resolved; public correction policy and named feedback owner active; a separate exact L2 approval authenticates authority, then chained bootstrap/private evidence/repeated `BETA-15c` transaction/remote preflight must independently yield activation authorization; post-activation verification is mandatory |
| L3 — assessed production | Public assessed climate product | Every requirement in the assessed-production action ledger passes, including CT-40 ALLOW, strict Truth CI, full reviews, rights, signatures, and release approval |

A Cloudflare branch-preview URL is public unless protected by actual access
control. `noindex`, an obscure URL, or a “private” label is not access control.
The L1 checker must prove that an unauthorized request is denied and an
authorized request returns the exact approved bytes. That access-control
invariant must be monitored until the complete L2 chain yields
`authorized_for_public_activation` and the one approved exposure change is
performed. An L2 signature alone does not lift Access. The same redistribution
and truth requirements apply whenever files are sent to people outside the
authorized internal team.

## 7. Public-beta release gates

Every gate is fail-closed. “Not applicable” is allowed only when the referenced
content is absent from both the source and staged public surface.

| ID | Requirement | Evidence/artifact | Responsible role | Verification |
|---|---|---|---|---|
| `BETA-01-scope` | Exact beta ID, included claim classes, excluded classes, source versions, entity counts, known limitations, and assessed authority false | Beta policy and runtime manifest | Climate data steward; independent beta reviewer | Proposed beta schema and readiness checker |
| `BETA-02-source-rights` | Exact intended public redistribution and factual use is permitted for every source/runtime byte; attribution and change notices are complete | Source-specific beta rights disposition | Authorized rights reviewer; counsel only where ambiguity remains | Exact registry/version/hash/use comparison plus authenticated rights decision |
| `BETA-03-identity-licence` | Debian `iso-codes` identity data remains separately identifiable with LGPL license, copyright/warranty notice, source-access information, and transformation log; factual JSON uses newly allocated opaque ELU IDs and contains no names, ISO codes, flags, or current ISO-derived fact IDs | Separate identity/lineage artifacts and complete notice set | Release engineer; rights reviewer | Schema, public-surface, identifier-allocation, separation, and notice checkers |
| `BETA-04-asset-boundary` | No unapproved globe/vendor/texture bytes are present; any later included asset has an exact real disposition | Exact public allowlist and negative-path assertions | Release engineer; rights reviewer | Staged tree enumeration and hash parity |
| `BETA-05-factual-integrity` | All released values, facts, gaps, ties, units, and lineage reconstruct from exact reviewed inputs | Deterministic beta data and independent reconstruction review | Data builder; independent climate-data reviewer | Rebuild, schema, invariant, and mutation tests |
| `BETA-06-no-assessment` | No target, commitment, score, performance, impact, fairness, or normative inference exists in data or UI | Beta truth-policy report | Independent climate-data and copy reviewers | Forbidden-field and forbidden-copy checks |
| `BETA-07-public-copy` | Persistent beta label and contextual limitations are accurate and understandable under thresholds frozen before results | Canonical review protocol, completed comprehension results, and signed UI/accessibility review | Protocol owner; independent non-specialist reviewer; `beta_ui_accessibility_reviewer` | Governance-contract, exact-copy, comprehension-results, commit-ancestry, and signed-pin checks |
| `BETA-08-accessibility` | Keyboard, focus, screen-reader, contrast, 320px layout, 200% zoom, reduced-motion, and non-color cues pass the frozen matrix | Canonical review protocol, completed matrix/session results, and signed UI/accessibility review | Independent accessibility reviewer; `beta_ui_accessibility_reviewer` | Governance-contract and browser automation plus genuine manual review |
| `BETA-09-security-privacy` | Same-origin runtime delivery, CSP/headers, no secrets, no unnecessary telemetry, and an approved feedback/privacy contract whose exact URLs bind the runtime | Frozen feedback/privacy contract, security checklist, runtime manifest, and staged headers | Release engineer; accountable owner/data controller | Governance-contract, runtime binding, browser/network, header, and privacy-policy verification |
| `BETA-10-feedback` | Visible intake route, issue taxonomy, triage states, correction/withdrawal policy, accountable owner, private security route, abuse handling, and retention rules exist | Frozen feedback/privacy contract and reviewed public routes | Accountable feedback/privacy owner | Governance-contract, runtime/UI link, and remote workflow validation |
| `BETA-11-diff` | Every change from the prior beta or “no prior beta” baseline is exact and reviewed | Reviewed beta release diff | Release engineer; independent reviewer | Recomputed path/hash diff |
| `BETA-12-rollback` | Exact prior deploy/baseline can be restored; cache behavior is tested; procedure is independently reviewed | Executable beta rollback proof | Rollback builder; independent rollback reviewer | Temporary rehearsal and exact restored hashes |
| `BETA-13-staged-bytes` | Only allowlisted files are staged; every source/staged hash matches; no symlinks or internal artifacts exist | Staged build manifest | Release engineer | Independent final staged verifier |
| `BETA-14-ci` | Beta diff-boundary, policy fixtures, truth checks, JavaScript syntax, browser smoke, accessibility automation, and assessed-rail invariants pass with no drift | Full beta CI | Release engineer | Protected GitHub required checks |
| `BETA-14b-commit-preserving-governance` | Canonical repository settings and auto-merge controls are package-reviewed and BA-pinned; package PR cannot squash/rebase/auto-squash; exact BR/BP/BA object IDs remain reachable after merge | Reviewed governance controls, live settings snapshot, merge record, post-merge ancestry report | Repository maintainer; release engineer | HIGH blocker: current org setup and auto-merge are contradictory; maintainer setting change and exact ancestry verification required |
| `BETA-14c-exact-pr-head-ci` | Exact package/readiness gates run in an isolated checkout whose HEAD equals the PR-head SHA; a separate job validates synthetic merge-result compatibility without granting package authority | Exact-head CI report and distinct merge-result compatibility report | Release engineer; repository maintainer | HIGH blocker: current default checkout conflates the merge ref and exact package tree |
| `BETA-15-approval` | Real human data, rights, UI/accessibility, package-diff, rollback, and release authorities authenticate their exact attestations and level-specific decisions; assessed authority remains false | Beta trust registry, review attestations, approvals, and detached signature bundles | Independent beta data, rights, UI/accessibility, package, and rollback reviewers; beta release authorizer | Signature, role, scope, commit, level, origin, validity, and descendant-drift verification |
| `BETA-15b-access-bootstrap` | Before the first beta upload, the exact dedicated project already serves a reviewed beta-free holding page behind project-wide access control; every alias/path denies unauthorized access and authorized probes return no beta hash; replacement deployments remain covered | Private signed access-bootstrap report and detached operator/rollback-reviewer signatures | `beta_release_operator`; independent `beta_rollback_reviewer` | Exact project/policy/approval/surface bindings, complete probe inventory, holding hashes, chronology, trust, and detached-signature verification |
| `BETA-15c-upload-transaction` | The fresh access gate, immutable staged-tree inventory/digest, exact-project Direct Upload, provider deployment ID/origin/receipt, immediate unauthorized-denial and forbidden/candidate/governance/`sw.js` probes, and signed operator evidence are one bound transaction | Private trusted-upload transaction report, provider receipt, probe results, and detached operator signature | `beta_release_operator` | HIGH blocker: transaction command/schema/checker are not implemented; no existing check-then-later-upload sequence satisfies this gate |
| `BETA-16a-remote-preflight` | Behind access control, every hostname/alias, deployment ID/commit, authorized byte surface, unauthorized denial, browser result, cache header, production baseline, and withdrawal target matches the proposed level; records follow the canonical observation order; this transition follows the prior signed transition; current evidence is within one frozen probe interval | Signed preactivation evidence outside the public runtime | Release operator; independent rollback reviewer | Signature, alias, access-control, remote surface, browser, production-baseline, rollback, feedback, transition-chronology, and current-freshness checks |
| `BETA-16b-live-verification` | After the separately authorized exposure change, every public alias serves exact bytes, immediate probes follow the prior signed transition, the frozen monitoring window completes, and freshness/chronology failure triggers signed withdrawal evidence | Signed post-activation evidence outside the public runtime | Release operator; independent rollback reviewer | Signature, public-alias, remote surface, browser, transition chronology, current freshness, monitoring, and withdrawal checks |

The full top-20 primary-source package, 2,060 assessed field reviews, country
profiles, assessed CT-40 ALLOW, production Ed25519 registry, and assessed
release signatures are not beta gates because their associated assessed uses
are absent. They remain mandatory and unchanged for L3.

## 8. Required beta artifacts

The foundation-candidate UI, schemas, libraries, and checkers are being
isolated on the mission branch for the protected F diff. They are not merged
or authoritative. The release-time runtime, frozen governance records,
reviews, keys, and approvals below do not exist. No listed path grants
authority merely because its schema or deterministic generator exists.

```text
climate-public-beta/                 # dedicated beta UI source
  index.html
  _headers                            # release deployment control; excluded from F
  THIRD_PARTY_NOTICES.txt
  css/beta.css
  js/beta.js

data/climate/public-beta/
  runtime/                           # exact deployable data subset
    runtime-manifest.json
    releases/<beta-id>/
      country-factual.json           # opaque ELU entity/fact IDs only
      country-identity.json          # licensed opaque-ID to identity join
      fact-lineage.json              # licensed source-ID/lineage join
      country-identity.SOURCE.md
      country-identity-transform.json
      known-limitations.json
      correction-log.json
    licenses/
      LGPL-2.1.txt
  governance/                        # repository-only; never wildcard-staged
    policy.json
    public-surface-manifest.json
    approval-trust.json
    review-protocol.json
    feedback-privacy-contract.json
    releases/<beta-id>/
      source-rights-review.json
      source-rights-review.signatures.json
      independent-data-review.json
      independent-data-review.signatures.json
      ui-accessibility-comprehension-results.json
      independent-ui-accessibility-review.json
      independent-ui-accessibility-review.signatures.json
      release-diff.json
      independent-package-review.json
      independent-package-review.signatures.json
      rollback-proof.json
      independent-rollback-review.json
      independent-rollback-review.signatures.json
      scope-manifest.json
      approvals/invited-beta.json
      approvals/invited-beta.signatures.json
      approvals/public-beta.json
      approvals/public-beta.signatures.json
```

The exact deploy allowlist contains only the dedicated beta UI, beta-readable
notice, beta runtime manifest, selected immutable runtime release files, and
required public licenses/source notices. Governance paths are not staged.
Public reviewer names or organizations appear only with informed consent.
`climate-public-beta/_headers` is deployable configuration, not foundation
scaffolding: it enters only on the active package branch, is reviewed with the
exact package, and is pinned by the BA scope.

The private pre-upload access proof has an exact outside-repository layout:

```text
<private-access-root>/
  invited_beta/
    access-bootstrap-report.json
    access-bootstrap-report.signatures.json
  public_beta/                         # required only for L2
    access-bootstrap-report.json
    access-bootstrap-report.signatures.json
```

Each report binds the exact policy, trust registry, level approval, BA scope,
public-surface manifest, dedicated hosting project, project-wide access scope,
beta-free holding deployment and its exact atomic origin, stable aliases,
complete authorized/unauthorized probe matrix, and prior L1 bootstrap where
applicable. It grants neither deployment nor publication authority. It proves
the protected holding state and is a prerequisite to the later upload
transaction, but it cannot prove which future tree is uploaded or close the
check-to-use interval by itself.

The required private trusted-upload transaction artifact has not been
implemented. Its future report and detached operator signature must bind, in
one execution:

1. a fresh passing access gate for the exact level and project;
2. a frozen immutable staged inventory with paths, modes, per-file hashes, and
   one aggregate tree digest;
3. Direct Upload of that exact tree to the exact policy-bound project, with no
   intervening mutable copy or separately invoked upload;
4. the provider deployment ID, atomic deployment origin, timestamped response,
   and receipt/output needed to reconstruct the transaction;
5. immediate probes of stable aliases and the new atomic origin for
   unauthorized denial, exact allowed bytes, forbidden/candidate/governance
   paths, and service-worker absence at `/sw.js`; and
6. the operator's genuine identity, attestation time, public-key ID, detached
   signature, and exact hashes of the gate result, tree inventory, provider
   receipt, and probe results.

No existing wrapper, checker, or manual runbook satisfies this contract. It
must be designed, adversarially tested, independently reviewed, added only on
the active package branch, and pinned in BA before an upload is legitimate.

The Git repository is public. Privileged counsel advice, raw feedback, reporter
identities, security reports, access logs, private tester data, credentials,
and operational secrets must never be committed. Public decision attestations
may cite a non-sensitive decision reference without reproducing privileged
analysis. Private operational/legal records remain outside the repository with
access and retention controlled by the responsible human.

The beta runtime must be newly compiled from the exact eligible inputs. The
current `data/climate/runtime/country-factual-candidate.json` must not be copied,
renamed, or published because its own envelope truthfully says
`review_status=not_reviewed` and `production_runtime_release=false`.

The beta trust registry must contain only public Ed25519 keys and validity
windows for the exact roles `beta_data_reviewer`, `beta_rights_reviewer`,
`beta_ui_accessibility_reviewer`, `beta_package_reviewer`,
`beta_rollback_reviewer`, `beta_release_operator`, and
`beta_release_authorizer`. Private signing keys stay offline and are never
requested or committed. Each reviewer signs their own attestation, the release
operator signs the canonical deployment-evidence index, the rollback reviewer
countersigns its access/withdrawal evidence, and the release authorizer signs
the level-specific approval. Every signature uses a beta-specific domain
separator and cannot be replayed as assessed-production authority.

Each L1 or L2 publication approval must bind all of:

- repository and beta release ID;
- exact reviewed commit;
- canonical beta scope hash;
- deterministic expected public-surface manifest hash;
- publication level (`invited_beta` or `public_beta`);
- exact intended origin/hostname;
- approval time, identity, key ID, authority role, and decision reference;
- validity/expiry and revocation reference; and
- `assessed_production_authority=false`.

The L2 approval additionally binds the exact prior L1 approval hash and the
reviewed, signed invited-feedback/deployment/access/monitoring/rollback evidence
index hash. It cannot claim public authorization from unbound observations.

An L1 signature cannot authorize L2, another origin, another commit, expired
approval, or changed bytes. A JSON identity string without a valid detached
signature is not approval.

### Canonical artifact and commit order

The order is acyclic and must not be rearranged:

0. merge the separately reviewed non-deploying foundation-only tooling PR with
   no runtime manifest, authority artifact, workflow change, or deployment
   control. F specifically excludes `.github/workflows/**`,
   `climate-public-beta/_headers`, `tools/build-climate-public-beta.sh`,
   `tools/check-climate-public-beta-diff-boundary.js`,
   `tools/check-climate-public-beta-readiness.js`,
   `tools/lib/climate-public-beta-diff-boundary.js`,
   `tools/stage-climate-public-beta.js`,
   `tools/check-staged-climate-public-beta-integrity.js`,
   `tools/org-setup.sh`, and every equivalent deployment-control path; then
   start from that exact `main` commit;
1. freeze the exact immutable beta release ID, factual/source scope, policy,
   trust registry of real public keys, review protocol, feedback/privacy
   contract, hosting/access contract, schemas, UI source, checkers, public
   allowlist, and accountable rights/counsel path;
2. obtain the exact PRIMAP/identity redistribution decisions and complete the
   reviewed notices; no generator or provenance result can substitute for that
   human rights decision;
3. run `--prepare` against the exact pinned PRIMAP v2.6.1 raw CSV to create the
   final-shaped seven-file proposal and descriptor outside the repository;
4. obtain genuine detached rights and independent data reviews that pin the
   exact private proposal, descriptor, source, and seven proposed files;
5. run `--seal` to copy those reviewed bytes without mutation into the
   immutable runtime release, then run the exact sealed-runtime checker;
6. deterministically generate and validate the runtime manifest, including its
   exact feedback/privacy-contract URL and hash bindings;
7. commit the exact UI-review subject without a results record as **Beta Review
   Subject (BR)**. BR includes the frozen UI, notices, runtime manifest, policy,
   governance contracts, and their schemas/checkers. It remains nonpublishable;
8. execute the frozen UI/accessibility/comprehension protocol against exact BR,
   create the canonical completed
   `ui-accessibility-comprehension-results.json` binding BR's SHA and both
   governance-contract hashes, then obtain the independent signed
   UI/accessibility review of the exact subject and results;
9. generate the expected public-surface manifest and exact initial/later
   release diff. On this active package branch—not in F—complete every
   deployment-control path, including `tools/org-setup.sh`, auto-merge,
   canonical live merge settings, event-relative beta CI, isolated exact-head
   evaluation, and separate merge-result compatibility; then require
   package validation/review to cover both the statically listed and
   dynamically discovered controls/workflows. Obtain the independent signed
   package/diff review only after that complete inventory. The review must
   precede BP and later scope generation so BP, rollback, BA scope, and
   protected package-PR review all see the exact controls;
10. commit the exact reviewed pre-rollback-proof content tree as **Beta Commit
   P (BP)**. BP contains every deployable byte and deterministic control,
   completed results, signed UI review, diff, and signed package review, but
   excludes the rollback proof, its independent review/signatures, and the
   later scope. It has no publication authority and cannot pass readiness;
11. against exact BP and the frozen baseline commit, generate and execute the
   repository rollback in an isolated worktree, generate the hosted withdrawal
   procedure, then independently review and authenticate the rollback proof.
   The proof binds BP's exact target paths and hashes but cannot contain the
   hash of a later scope that will contain the proof;
12. while Git HEAD is still exact BP, compute the canonical beta scope over the
   exact policy, governance contracts, schemas,
   checkers, UI, runtime data, manifests, licenses, notices, trust registry,
   rights/review attestations and signatures, diff, rollback bytes,
   `.github/workflows/**`, `climate-public-beta/_headers`, builder, stager,
   final staged checker, `tools/org-setup.sh`, canonical merge settings, and
   the future trusted-upload transaction controls;
   exclude only the later level-specific approval/signature pairs. Verify that
   the scope pins the exact rollback-proof bytes and every deployment control,
   and that every rollback target byte remains identical from BP to the scoped
   package. This external binding prevents proof/scope self-reference;
13. commit the complete reviewed and scoped package as **Beta Commit A (BA)**,
   verify BR is an ancestor of BP and BP is an ancestor of BA, and open the
   nondeployable package PR. This is the first PR containing the event-relative
   beta workflow or any deployment control. Protected review must validate the
   exact PR-head BA in isolation and separately test merge compatibility.
   Before merge, a maintainer applies the reviewed commit-preserving settings,
   including disabling required linear history; the PR is barred from
   squash/rebase/auto-squash and must retain the exact BR, BP, and BA object
   IDs;
14. only after that merge, have the release authorizer approve the exact merged
   BA commit, scope, expected public-surface manifest, `invited_beta` level,
   stable aliases, access contract, and L1 origin offline. Commit only the
   invited approval and detached signature as **Beta Commit B-L1 (BB-L1)**,
   validate it through nondeployable approval-validation, and merge the
   approval-only PR without changing any BA-bound byte;
15. on the dedicated beta project, provision the reviewed beta-free holding
   deployment and the complete Access application/policy bundle, prove the
   stable aliases and actual atomic holding-deployment origin, run the complete
   authorized/unauthorized holding probe matrix, and have the operator and
   independent rollback reviewer sign the private L1 access-bootstrap report
   offline;
16. from clean merged BB-L1, require the distinct
   `l1_preflight_deployment_authorized` result and build the immutable staged
   tree, but do not treat that result or a separate later upload as sufficient.
   Only after `BETA-15c` is implemented and independently reviewed may the
   operator run the one bound transaction that repeats the fresh access gate,
   digests and uploads the exact immutable tree to the exact project, captures
   the deployment ID/origin/receipt, performs immediate denial and
   forbidden/candidate/governance/`sw.js` probes, and signs the transaction
   evidence. The resulting exact deployment then enters the L1 remote
   preflight. Until that transaction exists, deployment and sharing remain
   blocked;
17. only after that signed evidence verifies does the state become
   `shareable_l1`; begin the invited-evidence transition strictly after the L1
   preflight `signed_at`, run the invited review, and authenticate the complete
   L1 remote/feedback evidence index while current evidence remains fresh;
18. if no package byte changed, have the release authorizer approve the exact
   BB-L1 commit (or exact merged-main equivalent), prior L1 approval hash,
   signed evidence-index hash, expected public-surface manifest,
   `public_beta` level, stable aliases, and L2 origin offline. This decision is
   made only after the invited-evidence signature and its `approved_at` cannot
   be earlier than that evidence `signed_at`. Commit only the
   public approval and detached signature as **Beta Commit B-L2 (BB-L2)**,
   validate it through nondeployable approval-validation, and merge that
   approval-only PR without changing the package or L1 approval bytes;
19. verify BB-L1 is an ancestor of exact merged BB-L2, capture and sign the
   chained private L2 access-bootstrap report, rebuild the unchanged immutable
   L2 tree, repeat the reviewed `BETA-15c` trusted upload transaction, and
   authenticate the ordered, currently fresh L2 remote preflight after the
   prior `signed_at`. Only after
   `authorized_for_public_activation` may the operator perform the single
   approved exposure change; activation and monitoring observations,
   attestations, and signatures each follow the prior transition `signed_at`.

The BR→BP→BA sequence is required by cryptographic acyclicity. The completed
UI results must name a review-subject commit that does not already contain the
results, and readiness checks BR's exact subject pins and ancestry. The
rollback proof can bind already committed BP; the later BA scope can bind the
proof. Requiring the results to contain themselves, or the proof to contain
BA's scope hash while the scope contains the proof, would create impossible
self-hashes rather than stronger gates.

The expected public-surface manifest is generated before BA from exact source
paths and hashes. It is not a claim that staging already occurred. `BETA-13`
later enumerates the actual post-BB staged tree and requires byte-for-byte
equality with that expected manifest, avoiding any preapproval/staging cycle.
Neither artifact proves what a later uploader sent; only the not-yet-implemented
`BETA-15c` transaction may bind the immutable staged digest to the provider
receipt and immediate deployed-surface probes.

The package-PR merge strategy must preserve BR, BP, and BA. If squash/rebase
changes BR, the genuine UI/accessibility/comprehension execution and review
must be repeated; if it changes BP, the rollback execution/review must be
repeated; and if it changes BA, a later release signature is invalid. The
commit object IDs are part of the reviewed release evidence.

The current `tools/org-setup.sh` squash-only/required-linear-history policy and
`.github/workflows/auto-merge.yml` `--squash` behavior contradict that binding.
They are deployment controls, stay out of F, enter only the active package
branch, receive static/dynamic package review, and are pinned by BA. Before the
package PR merges, a maintainer must apply the reviewed settings that allow a
merge commit and prohibit squash/rebase/auto-squash for that PR. The merge
record and post-merge ancestry report must prove that exact BR, BP, and BA are
reachable from `main`.

PR checks also have two non-interchangeable subjects. The authority job must
use an isolated checkout and assert that its HEAD equals
`github.event.pull_request.head.sha` before exact package/readiness checks.
A distinct job tests the synthetic merge result only for compatibility; a
merge-ref pass grants no package or publication authority.

The required two-round package/approval process is:

1. a package-only PR passes a distinct
   `package_valid_publication_blocked` policy state, all deterministic checks,
   and protected human review, but cannot stage/deploy public beta output;
2. merge that unsigned package while the beta builder continues to fail closed;
3. perform a new offline signing round against the exact merged-main commit;
4. open an approval-only PR and require the full level-specific beta readiness
   gate before any deployment.

Branch protection and CI must explicitly recognize the nonpublishable package
state for step 1; otherwise that PR must not merge. Never rewrite an approval
to fit a changed commit.

Approval-only PRs use the equally nondeployable `approval-validation` purpose.
It authenticates the exact L1 or L2 approval record, detached signature,
trust key, commit lineage, scope, manifest, and prior L1 approval. For L2 it
authenticates the release authorizer's signed private-evidence-index hash but
does not claim the underlying private evidence was materialized in public CI.
Its statuses are
`l1_approval_record_valid_publication_blocked` and
`l2_approval_record_valid_publication_blocked`; both explicitly deny staging,
sharing, and public activation. The separate real
`access-controlled-preflight` still requires the private evidence and
access-bootstrap chains before any deployment. This split keeps public CI
cryptographically meaningful without copying private tester/operations data
into GitHub Actions.

L1 and L2 use separate immutable approval files and stable readiness statuses:
`shareable_l1` and `authorized_for_public_activation`. When no package byte
changes after invited review, the explicit sequence is
`BA → BB-L1 → signed L1 evidence index → BB-L2`. BB-L2 adds only the public
approval/signature material and binds BB-L1 plus that evidence index. Moving
from L1 to L2 never overwrites the L1 record. Any factual, UI, policy, rights,
checker, notice, correction, or rollback change creates a new release and
repeats the earliest affected step.

`authorized_for_public_activation` is a preflight state, not a claim that the
origin is already public or monitored. A release operator may then perform the
single approved exposure change. Immediate access, alias, byte, header,
network, browser, and rollback probes must pass before the status becomes
`live_public_beta_monitoring`. Completion of the frozen observation window with
all BETA-16b criteria passing yields `verified_live_public_beta`. Any failure
executes the preauthorized withdrawal/access-lock action before diagnosis or a
replacement release.

## 9. Required engineering architecture

The complete local design includes both non-deploying foundation components
and later release/deployment controls. The following lists selected target
entry points; it is not exhaustive and is not the permitted F diff:

```text
tools/lib/climate-public-beta-policy.js
tools/lib/climate-public-beta-governance-contracts.js
tools/lib/climate-public-beta-surface.js
tools/check-climate-public-beta-governance-contracts.js
tools/check-climate-public-beta-readiness.js
tools/check-climate-public-beta-diff-boundary.js
tools/check-climate-public-beta-surface.js
tools/generate-climate-public-beta-artifacts.js
tools/stage-climate-public-beta.js
tools/check-staged-climate-public-beta-integrity.js
tools/check-remote-climate-public-beta.js
tools/build-climate-public-beta.sh
```

F may include deterministic artifact construction and fail-closed verification
but no path that configures headers or CI, emits a staging/deployment
authorization, stages/builds deploy output, uploads, or changes exposure. The
active BR/BP/BA package branch exclusively owns the
event-relative diff/CI semantics and every deployment control, including the
header/readiness/diff/staging/build/final-integrity chain,
`climate-public-beta/_headers`,
`.github/workflows/**`, `tools/build-climate-public-beta.sh`,
`tools/check-climate-public-beta-diff-boundary.js`,
`tools/check-climate-public-beta-readiness.js`,
`tools/lib/climate-public-beta-diff-boundary.js`,
`tools/stage-climate-public-beta.js`,
`tools/check-staged-climate-public-beta-integrity.js`, and the required
future trusted-upload transaction. BP contains the completed controls; BA
scope pins them; the commit-preserving package PR reviews and tests them.

The canonical governance schemas cover a frozen review protocol, a frozen
feedback/privacy contract, and completed UI/accessibility/comprehension
results. The deterministic generator creates the runtime manifest, expected
surface, release diff, BP-bound rollback proof, and later BA scope in their
documented order. It refuses overwrite and does not make human decisions,
perform reviews, sign, deploy, or grant authority.

Proposed output directory: `_deploy_beta`.

The BA-bound beta builder must:

1. remove stale beta output before evaluating gates;
2. require an explicit public-beta mode and reject unknown modes;
3. require exactly one publication level (`invited_beta` or `public_beta`) and
   run the matching readiness checker before staging;
4. stage only an exact allowlist;
5. reject missing, extra, duplicate, non-regular, and symlinked paths;
6. compare every source/staged SHA-256;
7. verify notices, licenses, beta labeling, and forbidden content;
8. write no candidate marker and include no candidate file;
9. finish by `exec`-ing the independent staged verifier; and
10. delete staged output on any failure.

The beta UI must live only under `climate-public-beta/`. It must not use or
modify production `index.html`, `sw.js`, `manifest.json`, `js/data.js`,
`js/globe.js`, globe CSS, the production public-surface list, or the production
notice inventory. Its own readable `THIRD_PARTY_NOTICES.txt` must cover the
exact PRIMAP and `iso-codes` obligations and must not reuse the globe-specific
notice as if it covered the beta.

The active-package beta diff-boundary policy must watch the dedicated UI tree,
`data/climate/public-beta/**`, every beta builder/stager/checker/library/schema,
the beta notice and headers, and its protected CI/CODEOWNERS wiring. It must run
both adversarial self-tests and a live base/head comparison. Any beta-affecting
change forces the applicable L1 or L2 readiness gate; a production diff checker
reporting “no runtime change” is not sufficient.

Beta policy, trust, approval, build, staging, diff-boundary, upload-transaction,
and CI paths must be protected by CODEOWNERS and branch protection once the
active package PR introduces them. Protected Git governance guards who may
change the authority mechanism; detached signatures authenticate the actual
human decisions. Neither mechanism substitutes for the other.

The first beta must allocate stable opaque ELU entity and fact IDs that do not
encode or hash a name, alpha code, current `iso3166-1:XXX` identifier, or
alpha-bearing source-fact ID. `country-factual.json` contains only those opaque
IDs. `country-identity.json` maps opaque entity IDs to the separately licensed
names/codes, while `fact-lineage.json` maps opaque fact IDs to the current
source lineage and carries every license/notice obligation the rights reviewer
assigns to that mapping. A negative test must reject copied or encoded Debian
identity fields and current ISO-derived IDs in the factual artifact. The
initial L1 package requires a fresh rebuild and independent reconstruction from
the exact pinned external PRIMAP v2.6.1 CSV. Later CI may validate the committed
immutable beta artifacts without downloading the raw 74.7 MB source, but a
changed data release must repeat the raw-source review.

The assessed paths must remain unchanged:

- `./tools/build-deploy.sh --candidate` stays local-only;
- `./tools/build-deploy.sh --release` retains every assessed-production gate;
- `data/climate/runtime-manifest.json` remains the assessed-release trigger;
- `node tools/climate-truth-ci.js --strict` remains the assessed truth gate;
- `_deploy` remains the assessed-production output; and
- the existing Cloudflare production project remains on its current build
  command and output directory.

Beta CI should be a separate protected required job introduced and reviewed
only by the active BR/BP/BA package PR; F must not edit
`.github/workflows/**`. The beta job must not turn an expected assessed
`BLOCKED` result into a pass or mark missing assessed components as complete.
A dedicated assessed-boundary assertion must verify the exact expected
candidate/block state and passing policy fixtures; simply running a
known-failing `--release` or `--strict` command under `set -e`, or tolerating
an arbitrary nonzero exit, is not evidence that the rails remain intact.

The existing CT-42 UI-review and candidate-rollback ancestry failures remain
genuine blockers for L3 assessed production and must eventually be repaired by
a legitimate ancestry decision or fresh independent reviews. They are not an
L1/L2 factual-beta gate. Beta CI must keep the assessed boundary exact and may
not relabel the CT-42 failures as passing, satisfy them with beta artifacts, or
claim assessed authority.

## 10. Hosting and publication boundary

Recommended hosting:

- a separate maintainer-authorized Cloudflare Pages project with an immutable,
  DNS-label-safe project ID and policy metadata that fixes production branch
  `main`;
- trusted-operator **Direct Upload** of prebuilt `_deploy_beta` bytes from a
  clean, locally/private-gated commit, but only through the reviewed
  `BETA-15c` transaction that binds the fresh gate, immutable tree digest,
  exact project upload, provider receipt, immediate probes, and operator
  signature; that transaction is not implemented; automatic Git deployments
  are not the selected beta path because public CI cannot materialize private
  access or operational evidence;
- exact policy binding of `pages_dev_origin` to
  `https://<project-id>.pages.dev` and
  `deployment_alias_hostname_suffix` to `.<project-id>.pages.dev`;
- stable L1/L2 approved origins and alias sets, each including the exact
  `pages_dev_origin` plus every approved custom hostname;
- one reviewed `access_policy_reference` that identifies the complete Access
  application/policy bundle covering the `pages.dev` apex, wildcard
  deployment/preview hosts, and each custom domain; and
- no shared root service worker or cache with the existing production origin.

The beta project ID, stable aliases, custom domains, Access bundle, and the
human authorized to configure or upload are external infrastructure decisions.
L1 access control is mandatory, not optional. Creating or configuring the
project, Access applications, policies, or domains is not authorized by this
plan.

The first approved-beta upload may occur only after the selected project is
already serving the exact policy-pinned beta-free holding bytes under the
complete Access bundle and the private signed L1 access-bootstrap chain
verifies, and only inside the separately implemented and reviewed
`BETA-15c` transaction. The bootstrap report binds and probes both the stable
aliases and the actual atomic holding origin, whose hostname is exactly one
deployment label before
the reviewed suffix:
`https://<holding-deployment-id>.<project-id>.pages.dev`. A configuration that
protects only one custom hostname, one preview, or one current deployment is
insufficient because a replacement deployment URL could expose bytes before
the post-upload checker runs. A check followed by an independently invoked
later upload remains insufficient even when both commands succeed.

After the future trusted transaction Direct Uploads its exact immutable staged
tree, its signed operator record and provider receipt supply the newly
observed atomic origin
`https://<deployment-id>.<project-id>.pages.dev`. Approvals continue to bind
the frozen stable aliases; access and remote evidence must additionally bind
and probe that exact atomic origin. It must match the reviewed suffix, differ
from the stable aliases, and never become a redirect target used to disguise a
failed access check.

The existing production site must stay byte-identical during invited beta
testing, proven by before/after hashes of a frozen production artifact
inventory. L2 remains on the dedicated beta origin. The primary Earth Love
United URL can change only through the full assessed BA/BB-equivalent release
process or a separately designed and authorized future factual-production
program; an L2 beta decision alone cannot promote it.

For every L1/L2 deployment, retain private or access-controlled operational
evidence containing the fresh gate result, immutable staged inventory/digest,
exact project, provider receipt, atomic deployment origin and ID, source
commit, stable approved origins/aliases, immediate denial and
forbidden/candidate/governance/`sw.js` probes, exact remote-file hashes,
browser/accessibility results, cache headers, observation window, privacy-safe
feedback summary, signed operator attestation, and rollback or withdrawal
result. The public
repository may contain a sanitized hashed index only when its disclosure has
been reviewed.

Minimum run records are:

```text
beta-deployment-record.json
beta-access-control-results.json
beta-remote-surface-results.json
beta-browser-accessibility-results.json
beta-production-baseline-results.json
beta-monitoring-results.json
beta-rollback-withdrawal-results.json
beta-invited-feedback-summary.json
beta-run-artifact-index.json
```

These records must contain genuine observations and deployment identifiers.
Templates may be committed only when unmistakably unfilled; no identity,
timestamp, result, URL, or measurement may be invented.

The remote checker must canonicalize every record into the run-artifact index.
The release operator signs the exact private index; the independent rollback
reviewer countersigns the access-control and rollback/withdrawal subset. The
checker verifies both signatures before granting an L1 remote pass, accepting
an L2 evidence index, or reporting `verified_live_public_beta`. Any sanitized
public hash index must reference the signed private index without exposing its
private contents.

Remote evidence is an ordered observation, signature, and transition chain;
timestamps are not interchangeable metadata. Within every transition package,
the record `observed_at` values must be nondecreasing in this exact order:

```text
deployment
  → access_control
  → remote_surface
  → browser_accessibility
  → production_baseline
  → rollback_withdrawal
  → invited_feedback
```

All record/window times occur after the applicable approval floor and before
the attestation. The attestation follows every observation; the evidence
signature follows the attestation and remains inside approval validity. For
each later transition in
`l1_remote_preflight → l1_invited_evidence_index → l2_remote_preflight →
public_activation → live_monitoring`, its earliest observation, attestation,
and `signed_at` must be strictly later than the preceding transition's
`signed_at`; the monitoring window start follows the public-activation
signature too. The L2 approval is made only after the invited-evidence package
has been signed: mechanically, its `approved_at` cannot be earlier than the
invited-evidence `signed_at`.

Historical signed packages remain part of the immutable chain, but evidence
used to justify a **current** sharing, activation, or monitoring action must be
fresh. At verification, the current attestation and the access, surface,
browser, production-baseline, rollback/withdrawal, and feedback observations
must each be no older than the single policy-frozen
`remote_probe_interval_seconds`; the applicable monitoring boundary is also
freshness-critical. The evidence signature must follow the attestation within
that interval. A valid old signature over stale operational observations does
not authorize a current publication action.

The first beta has no earlier beta deployment. Its rollback target must be
frozen before L1 as one of: an exact access-locked holding page, a withdrawn
origin returning the approved status on every alias, or a full project-wide
access lock. The plan must record credentialed Cloudflare steps, deployment
IDs, beta cache headers, purge/withdraw action, human response target, and
post-action remote hashes. Repository rollback and hosted rollback are
separate proofs. The hosted withdrawal plan must bind provider
`cloudflare_pages`, exact project ID, production branch `main`, access scope
`project_wide_all_deployments`, reviewed Access bundle reference,
`pages_dev_origin`, and `deployment_alias_hostname_suffix`; a generic plan for
an unnamed Pages project is invalid.

Every stable project/custom alias is enumerated in the policy and approval;
the actual holding or uploaded atomic deployment origin is added by the signed
operational record when it exists. The Access bundle must cover the stable
`pages.dev` apex, wildcard deployment/preview space, and every custom domain.
At L1, every stable alias and the actual atomic origin must deny unauthorized
access. At withdrawal, those same probed hosts must be inaccessible or
access-locked; detaching only a custom domain is never sufficient while the
`pages.dev` apex or atomic deployment origin still serves the bytes.

## 11. Correction and feedback workflow

Every entity detail and the methodology/footer must link to “Report a data or
attribution issue.” A report should bind to:

- beta release ID;
- entity ID;
- fact ID or UI location;
- issue class: value, provenance, method/accounting, rights/notice,
  identity/map, copy/accessibility, security/privacy, or other;
- reporter explanation and supporting URL/evidence; and
- optional contact information with a clear privacy notice.

Workflow:

1. assign an intake ID and record the submitted time;
2. have a human triage it as duplicate, needs evidence, in review, accepted,
   rejected, security-sensitive, or rights-sensitive;
3. never edit runtime facts directly from feedback;
4. have a different reviewer validate an accepted factual correction;
5. after a human severity decision, immediately place materially false,
   misleading, or rights-sensitive facts/releases in an explicit `withheld` or
   `withdrawn` state that identifies the affected fact and release;
6. ship corrections only through a new immutable beta release and reviewed
   diff;
7. publish a privacy-safe correction log; and
8. route security/privacy reports through a private channel.

The first release is deterministically sealed with an empty correction log.
A later release must pass `--prior-corrections` an absolute, canonical JSON
file outside the repository. The finalizer rejects reporter identity/contact
fields, validates 1–100 privacy-safe entries, binds each entry to the new and
superseded immutable release IDs and at least one exact affected-artifact pin
from the superseded seven-file runtime (not an artificial requirement to pin
all seven files),
and adds the private input's exact logical SHA-256 to the proposal and data
review subjects. Only the reviewed privacy-safe correction log is copied into
the runtime. The UI renders correction history only after verifying the
runtime manifest, artifact hashes, and correction-log calculation hash.

Known limitations may explain uncertainty or a lower-severity defect. They must
never be used to keep materially misleading or unauthorized content live.

Before L1, the maintainer must name the feedback owner and approve the data
controller/contact, processor/platform, collection purpose and fields,
anonymous-report option, retention/deletion and access policy, who can see
reporter identities, consent for quotations/public credit, correction-log
redaction, abuse/spam handling, incident route, privacy-request route, and
realistic triage/withdrawal targets. Security/privacy reports must divert to a
private channel before sensitive text is sent to a public tracker. A
user-initiated external feedback link is permitted only after this decision;
the beta must not embed third-party telemetry. This plan does not invent an
SLA or privacy decision.

The frozen incident policy preauthorizes hosted withdrawal/access-lock so a
materially false or unauthorized release does not remain live while a new
package is reviewed. That emergency operation executes immediately and is
recorded in signed remote evidence. Only the replacement runtime or an explicit
public `withheld` artifact requires a new BA/BB sequence.

## 12. Review cohort and go/no-go rules

Before L2, obtain completed reviews from real people covering these distinct
perspectives:

- climate data/methodology;
- accessibility and keyboard/screen-reader use;
- non-specialist comprehension of “magnitude, not performance”; and
- release/rollback operation.

The schemas and checkers must enforce this minimum incompatibility matrix:

| Work product | Prohibited reviewer/authorizer combination |
|---|---|
| Factual artifact | Data builder = climate-data reviewer |
| Rights decision | Rights-packet preparer = authorized rights decision-maker |
| UI/copy/accessibility | UI builder = accessibility/comprehension reviewer |
| Release diff | Diff builder = diff reviewer |
| Rollback proof | Rollback builder = rollback reviewer |
| Publication | Release builder = beta release authorizer |
| Accepted correction | Correction extractor/implementer = factual correction reviewer |

One person may cover multiple perspectives only where this matrix and the
approved role policy permit it. Identity strings alone do not prove
independence or authority.

Before L1, humans must freeze measurable beta policy values before seeing the
outcomes: minimum reviewer/session counts, independence rules, browser/device
matrix and pass counts, manual accessibility coverage, invited-review duration,
issue-severity taxonomy, feedback triage and withdrawal targets, remote probe
cadence and observation window, rollback response target, and the exact
authorized/unauthorized access-control tests. These values become checked
policy artifacts; changing them after results requires a reviewed policy change
and new BA/BB sequence.

Publication is **NO-GO** when any of these remains unresolved:

- wrong entity, value, unit, year, source, or lineage;
- misleading assessment or performance implication;
- missing or ambiguous redistribution permission for a distributed byte;
- missing required attribution/license/source offer;
- inaccessible core fact browsing;
- candidate, internal, private, or unallowlisted artifact in the staged tree;
- critical security/privacy issue;
- source/staged/deployed digest mismatch;
- failed or unreviewed rollback; or
- no real exact-scope publication approval.

Lower-severity presentation issues may remain only when documented in known
limitations with a real owner and an explicit human go/no-go decision.

## 13. Implementation milestones

### Milestone A — freeze the beta contract

Goal: agree exactly what “Climate Public Beta” means before creating real
release artifacts or observing review outcomes.

Deliverables:

- operational `HB-00` direction to prepare and present the non-deploying F
  split, followed by protected review and merge of its exact diff; later
  active-package CI/deployment controls, isolated exact-head authority,
  separate merge-result compatibility, and commit-preserving merge remain
  subject to their separate protected and live-maintainer reviews;
- this plan reviewed by the maintainer;
- decision to use the recommended data-first scope;
- exact immutable beta release ID, product name, and public copy approved;
- exact Direct Upload project, stable/atomic host contract, and complete Access
  application/policy model chosen;
- real human role roster and beta public-key authorities identified;
- canonical review protocol and measurable review, monitoring, access, and
  rollback thresholds frozen; and
- canonical feedback/privacy contract and public routes chosen.

Exit: no unresolved scope-changing decision.

### Milestone B — build a rights-safe beta package

Goal: produce a deterministic beta artifact that contains no denied candidate
or unresolved visual-runtime bytes.

Deliverables:

- merged non-deploying schemas/checkers/generator foundation with every
  workflow and deployment-control path still absent from F; frozen
  policy/trust/contracts, compiler, exact public allowlist, and adversarial
  fixtures;
- separate identity data, copyright/warranty notice, LGPL text, source-access
  information, and transformation log;
- PRIMAP attribution and modification notice;
- authenticated source-specific beta rights disposition and trust registry;
- privately proposed and reviewed, immutably sealed beta factual/support data,
  runtime manifest, and known limitations; and
- deterministic rebuild with zero drift.

Exit: `BETA-01` through `BETA-06` pass.

### Milestone C — create and review the beta experience

Goal: make the factual product understandable and accessible without the 3D
globe.

Deliverables:

- table/search/details UI;
- persistent beta and non-assessment labels;
- evidence drawer and correction link;
- exact BR pre-results subject commit;
- executed canonical UI/accessibility/comprehension results binding BR and
  both frozen governance contracts;
- responsive, keyboard, screen-reader, contrast, zoom, and reduced-motion QA;
- independent signed UI/accessibility review;
- exact expected public surface and reviewed release diff/package;
- event-relative beta CI and all deployment controls—including canonical
  repository settings, auto-merge behavior, isolated exact-head authority,
  and separate merge-result compatibility—introduced only on the active
  package branch, complete before BP, independently package-reviewed, and
  destined for BA scope; and
- BP committed only after that package review.

Exit: `BETA-07` through `BETA-11` pass.

### Milestone D — prove safe sharing

Goal: make the exact beta bytes shareable with invited reviewers.

Deliverables:

- executable BP-bound rollback proof and independent signed review;
- BA scope/commit pinning every deployment, CI, and merge-governance control;
- protected exact-BA authority and separate synthetic-merge compatibility CI;
- maintainer-applied reviewed live settings, a commit-preserving package merge,
  and a post-merge report proving exact BR/BP/BA reachability from `main`;
- exact staged-byte manifest;
- clean beta CI and browser smoke;
- feedback owner and triage workflow;
- authenticated BB-L1 approval-only merge;
- signed private holding/access bootstrap;
- implemented, adversarially tested, independently reviewed, BA-pinned
  `BETA-15c` transaction plus genuine signed operator upload receipt; and
- signed stable-alias/atomic-origin remote preflight for the exact transaction
  deployment.

Exit: all L1-applicable `BETA-*` gates pass, including
`BETA-14b-commit-preserving-governance`, `BETA-14c-exact-pr-head-ci`,
`BETA-15c-upload-transaction`, and `BETA-16a-remote-preflight`, including its
unauthorized-denial, authorized-byte, remote digest,
production-baseline, and rollback/withdrawal checks.
`BETA-16b-live-verification` is inapplicable while public activation remains
false. At this point, and not before, the beta may be shared with invited
reviewers.

### Milestone E — invited review and public decision

Goal: use criticism as evidence before opening the beta to everyone.

Deliverables:

- feedback summary with no private tester data;
- accepted corrections released through new immutable versions;
- zero unresolved public-beta no-go findings;
- fresh deployed-byte and rollback verification;
- signed L1 feedback/deployment evidence index; and
- separate authenticated human approval for L2 binding L1 and that index.

Exit A: the release authorizer's detached L2 signature first yields only the
nondeployable `l2_approval_record_valid_publication_blocked` record state.
After the chained L2 access bootstrap, private invited-evidence chain,
the repeated reviewed `BETA-15c` transaction, and signed `BETA-16a` remote
preflight also pass for the exact bytes, stable aliases, and actual atomic
origin, default readiness
yields `authorized_for_public_activation`.

Exit B: the release operator performs the one approved exposure change,
immediate probes yield `live_public_beta_monitoring`, and the frozen observation
window completes with `BETA-16b` passing to yield
`verified_live_public_beta`. A failure at either point executes withdrawal.

### Milestone F — learn and promote

Goal: improve the beta openly without confusing it with assessed production.

Deliverables:

- visible version and correction history;
- monitored source, data, accessibility, and rights issues;
- immutable releases for every accepted correction; and
- continued work on the assessed-production action ledger.

Exit: L3 occurs only when the original assessed-production gates genuinely
pass.

## 14. Human action register

### Foundation governance direction — received for draft F; review pending

There is no foundation PR yet. The task owner has directed engineering to
proceed with the non-deploying foundation split. Operationally, that permits
separating the exact diff, committing it normally, reproducing its tests from
a clean checkout, and opening a draft protected PR. It does not create a
formal approval artifact and does not authorize merge or any release action.
The direction being implemented is:

> Approve F as a non-deploying foundation PR that excludes
> `.github/workflows/**`, `climate-public-beta/_headers`,
> `tools/build-climate-public-beta.sh`,
> `tools/check-climate-public-beta-diff-boundary.js`,
> `tools/check-climate-public-beta-readiness.js`,
> `tools/lib/climate-public-beta-diff-boundary.js`,
> `tools/stage-climate-public-beta.js`,
> `tools/check-staged-climate-public-beta-integrity.js`,
> `tools/org-setup.sh`, and every other deployment-control path; approve
> introducing and reviewing the event-relative CI semantics, isolated exact
> PR-head authority job, separate synthetic-merge compatibility job, canonical
> merge settings/auto-merge behavior, and all other deployment controls only
> in the later active BR/BP/BA package PR, with BA pinning them; and approve a
> package-PR merge policy that prohibits squash, rebase, and auto-squash and
> preserves the exact BR, BP, and BA object IDs?

The disclosed tradeoff is precise: an unrelated PR after L2 will not re-run
private remote-evidence gates in public CI; the active package is still
revalidated on every run, any beta-affecting diff still requires its exact
package/approval state, and every real upload remains blocked until both the
private access-bootstrap and not-yet-implemented `BETA-15c` transaction pass.
Sharing and activation additionally require their later remote-evidence
chains. The fixed historical
`a476…` comparison cannot be the recurring-release design because it would
misclassify every later PR as changing the original beta foundation. Approval
of this direction authorizes completing and presenting the protected
non-deploying F PR and later preparing the separately reviewed active-package
decision packet; it does not approve the F merge, later controls, a beta
release, a person, a key, a signature, an upload, or a deployment. The
repository/foundation maintainer must still review and approve the exact F
diff under branch protection. Later controls and commit-preserving package
merge settings require their own protected review and live maintainer action.

### First human decision packet — required before release artifacts

The next legitimate step is a scope-and-operations decision, not a signature.
The foundation maintainer must return one reviewed record that supplies or
rejects each item below. Blank, assumed, agent-selected, or retrospective
answers keep the beta blocked.

1. **Product boundary and release identity:** choose the exact immutable beta
   release ID, accept or amend the name `Climate Public Beta`, the factual-only
   promise in section 1, every inclusion/exclusion in section 4, and the rule
   that assessed work remains L3-only. No placeholder release ID may enter a
   real policy, proposal, manifest, result, review, or command.
2. **Origins and access:** choose the dedicated Cloudflare Pages beta project,
   immutable DNS-label project ID, `main` production-branch metadata, exact
   `pages_dev_origin`, deployment-alias hostname suffix, stable L1/L2 origins
   and aliases, the Access application/policy bundle covering the `pages.dev`
   apex, wildcard deployment/preview hosts, and every custom domain, beta-free
   holding bytes/hash, permitted denial statuses/redirect origins, and the
   person authorized to configure and Direct Upload. Do not change the
   existing production project and do not select automatic Git deployment.
3. **People and public keys:** identify the real release builder and rights
   preparer; assign the seven policy roles below; record required independence
   and consent for public attribution; and provide only each role holder's
   public Ed25519 SPKI key, key ID, validity, status, and revocation reference.
   Seven roles do not necessarily mean seven people, but every independence
   rule must remain true. Private keys and private signing never enter the
   repository or this workflow.
4. **Rights path:** name the person accountable for the PRIMAP and Debian
   `iso-codes` decisions; decide whether qualified licensing counsel is
   required; and have that human complete the exact redistribution,
   attribution, modification, source-access/corresponding-source, disclaimer,
   and public-attestation questions before a review proposal is generated.
5. **Feedback and privacy contract:** name the accountable owner, controller,
   processors and contacts; choose the exact public feedback and privacy URLs,
   accepted fields, purpose, consent model, anonymity option,
   retention/deletion, access controls, redaction, abuse handling,
   data-subject/privacy-request route, and private security-report route; then
   freeze the canonical contract before the runtime manifest or results.
6. **Review protocol and risk controls:** name the protocol owner and freeze
   the invited cohort/session/accessibility minima, complete
   browser/device/input/assistive matrix, required checks, comprehension
   prompts/pass criteria, severity taxonomy and no-go severities, approval
   lifetime, monitoring interval/window/counts, access probe counts,
   production-baseline inventory, withdrawal rules, rollback target, and
   response target before observing results.

After this packet is genuinely frozen, engineering can generate the exact
private data proposal and policy/trust artifacts. The relevant independent
humans then review those exact bytes. Nobody should sign L1 or L2 approval at
this first decision stage.

| ID | Human action required | Why automation cannot decide it | Needed by |
|---|---|---|---|
| `HB-00` | Approve non-deploying F with every workflow/deployment-control path, including `tools/org-setup.sh`, excluded; approve introducing/reviewing event-relative CI, exact-head/merge-result jobs, canonical settings/auto-merge, and all controls only in the active package PR with BA pins; approve a package merge preserving exact BR/BP/BA object IDs | Repository split, branch-protection, CI comparison, and merge-policy authority belong to maintainers | F, then the active BR/BP/BA package PR |
| `HB-00a` | Before package merge, apply the reviewed BA-pinned live settings: allow a merge commit, disable required linear history and squash/rebase modes for this merge, prevent package auto-squash, record the settings, merge without rewriting commits, and verify exact BR/BP/BA reachability from `main` | Only an authorized repository maintainer can change live settings and perform the commit-preserving merge | Milestone D package merge |
| `HB-01` | Choose the exact immutable beta release ID; approve the factual-only beta scope, product name, L1/L2 meanings, and exclusions | Product identity and public-representation decision | Milestone A and every release artifact |
| `HB-02` | Choose the exact Cloudflare Pages project ID, `pages.dev` origin/suffix, stable L1/L2 aliases, custom domains, Direct Upload operator, holding hash, and complete Access application/policy bundle | External infrastructure and exposure decision | Milestone A |
| `HB-02a` | Before L1 or L2 staging, configure the policy-pinned beta-free holding deployment and complete replacement-safe Access bundle; probe stable aliases plus the actual atomic holding origin; operator and independent rollback reviewer sign the private access-bootstrap report | Only real external configuration, observation, identity, chronology, and offline signatures can prove the first upload is protected | Milestone D/E preflight |
| `HB-02b` | After the trusted upload transaction exists and exact level approval/bootstrap pass, execute it against the exact project/tree; capture the receipt/origin and immediate denial, exact-surface, forbidden/candidate/governance, and `/sw.js` probes; sign offline | Only the real operator and provider response can bind the upload and observation; no wrapper exists yet | Milestone D/E deployment |
| `HB-03` | Name the release builder and rights preparer; assign the seven policy roles (`beta_data_reviewer`, `beta_rights_reviewer`, `beta_ui_accessibility_reviewer`, `beta_package_reviewer`, `beta_rollback_reviewer`, `beta_release_operator`, `beta_release_authorizer`); supply only their public Ed25519 keys, validity/status, and revocation references | Identities and authority cannot be fabricated; private keys remain offline | Milestone A |
| `HB-04` | Confirm exact PRIMAP and `iso-codes` public-beta redistribution, factual use, attribution, modification notice, and source-access obligations | Rights and license judgment | Milestone B |
| `HB-05` | Approve and freeze the canonical feedback/privacy contract: accountable owner, controller/processors/contact, exact URLs, fields, purpose, anonymity/consent, retention/deletion/access/redaction, abuse, data-subject/privacy-request, and private security-report rules | Privacy and organizational accountability cannot be generated from a schema | Milestone A and runtime-manifest generation |
| `HB-06` | Approve and freeze the canonical review protocol and risk controls, including owner, exact matrix/checks/prompts/pass criteria, cohort/session minima, severities, monitoring/probe thresholds, response target, and rollback target | Review design and risk thresholds cannot be invented or chosen after outcomes are known | Before BR/results and Milestone A |
| `HB-07` | Independently review and authenticate the compiled factual beta | Scientific/data judgment | Milestone C |
| `HB-08` | Execute the frozen comprehension protocol against exact BR, produce privacy-safe completed results binding BR and both governance contracts, and review the exact beta copy for accurate understanding | Human interpretation outcomes cannot be fabricated or inferred from the UI | Before BP, Milestone C |
| `HB-09` | Execute the frozen manual accessibility matrix against exact BR, record genuine results, then have the independent `beta_ui_accessibility_reviewer` sign exact BR/results pins | Automation cannot cover real assistive use; a results JSON is not self-authenticating | Before BP, Milestone C |
| `HB-10` | Independently review/sign the exact release diff/package—including every statically listed and dynamically discovered workflow/deployment control—before BP; then review/sign BP-bound rollback/withdrawal evidence before BA | Package and operational judgments require the distinct `beta_package_reviewer` and `beta_rollback_reviewer` | Milestones C/D |
| `HB-11` | Sign the exact BA scope, commit, manifest, origin, validity, and `invited_beta` level offline | Authenticated L1 publication authority | Milestone D |
| `HB-12` | Only after the invited-evidence package is signed, review feedback and separately sign GO for exact `public_beta`, with `approved_at` not earlier than invited-evidence `signed_at`; this signature still requires the later ordered/current L2 preflight | Risk acceptance and authenticated L2 authority cannot precede its evidence or replace operational freshness | Milestone E |
| `HB-13` | Resolve squash-lost CT-42 UI/rollback review ancestry through a legitimate history decision or fresh independent reviews | The assessed-production result cannot be reinterpreted by the beta track | It is not an L1/L2 beta-content gate, but the unchanged workflow currently makes it a protected F merge blocker; it also remains mandatory for L3 assessed production |

Only public Ed25519 keys, public attestations approved for disclosure, and
detached signatures may enter the repository. Private keys remain offline and
must never be requested. The beta signature domain and trust registry are
separate from the assessed-production Ed25519 requirements, which remain
unchanged.

## 15. Verification chain

The complete local design contains the deterministic commands, and their
listed fixtures have been individually verified in the mixed mission
worktree; the foundation-eligible subset must still be reproduced from the
exact clean F commit, and integrated protected CI is pending. This does not
make every command eligible for F: workflow, header, readiness,
event-relative diff, staging/build/final-integrity, and future
upload-transaction controls enter only on the active package branch and are
pinned in BA. Commands that
consume real raw source, reviewed artifacts, private evidence, or approvals
remain fail-closed until those inputs genuinely exist:

```sh
node tools/check-climate-public-beta-data.js --self-test
node tools/check-climate-public-beta-policy.js --self-test
node tools/check-climate-public-beta-governance-contracts.js --self-test
node tools/generate-climate-public-beta-artifacts.js --self-test
node tools/check-climate-public-beta-access-bootstrap.js --self-test
node tools/check-climate-public-beta-package.js --self-test
node tools/check-remote-climate-public-beta.js --self-test
node tools/check-climate-public-beta-readiness.js --self-test
node tools/check-climate-public-beta-diff-boundary.js --self-test

node tools/check-climate-public-beta-raw-rebuild.js \
  --source /absolute/private/path/to/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv
node tools/check-climate-public-beta-reviewed-data.js --self-test

# Only after HB-01 through HB-06 and the completed rights notice exist:
node tools/check-climate-public-beta-reviewed-data.js --prepare \
  --source /absolute/private/path/to/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv \
  --release-id <exact-HB-01-release-id> \
  --data-builder-identity <genuine-builder-identity> \
  --rights-preparer-identity <genuine-preparer-identity> \
  --proposal-dir /absolute/private/review-proposal-directory

# For a later immutable release only, add the reviewed privacy-safe history:
#   --prior-corrections /absolute/private/prior-corrections.json

# After the exact proposal has genuine signed data and rights reviews:
node tools/check-climate-public-beta-reviewed-data.js --seal \
  --release-id <exact-HB-01-release-id> \
  --proposal-dir /absolute/private/review-proposal-directory \
  --output /absolute/repository/data/climate/public-beta/runtime/releases/<exact-HB-01-release-id>
node tools/check-climate-public-beta-reviewed-data.js \
  --check --release-id <exact-HB-01-release-id>

# Generate the manifest, then commit BR before recording any result:
node tools/generate-climate-public-beta-artifacts.js \
  --runtime-manifest \
  --release-id <exact-HB-01-release-id> \
  --verification-time <genuine-UTC-verification-time> \
  --feedback-contract /absolute/repository/data/climate/public-beta/governance/feedback-privacy-contract.json \
  --root /absolute/repository

# After genuine protocol execution against BR and creation of the results file:
node tools/check-climate-public-beta-governance-contracts.js \
  --review-protocol /absolute/repository/data/climate/public-beta/governance/review-protocol.json \
  --feedback-privacy-contract /absolute/repository/data/climate/public-beta/governance/feedback-privacy-contract.json \
  --ui-accessibility-results /absolute/repository/data/climate/public-beta/governance/releases/<exact-HB-01-release-id>/ui-accessibility-comprehension-results.json \
  --beta-release-id <exact-HB-01-release-id>

# After the signed UI review, create the expected surface and diff; then obtain
# the independent package review before committing BP.
node tools/generate-climate-public-beta-artifacts.js \
  --surface-manifest --release-id <exact-HB-01-release-id> \
  --root /absolute/repository
node tools/generate-climate-public-beta-artifacts.js \
  --release-diff --release-id <exact-HB-01-release-id> \
  --current-snapshot /absolute/repository/data/climate/public-beta/governance/public-surface-manifest.json \
  --root /absolute/repository
# A later release also supplies --previous-release-id and --previous-snapshot.

# Commit BP first. Then execute rollback from clean exact BP while the BA scope
# is absent. The identities/times/evidence ID and hosted plan must be genuine.
node tools/generate-climate-public-beta-artifacts.js \
  --rollback-proof --release-id <exact-HB-01-release-id> \
  --release-commit <exact-BP-SHA> \
  --baseline-commit <exact-frozen-post-foundation-baseline-SHA> \
  --hosted-withdrawal-plan /absolute/private/reviewed-hosted-withdrawal-plan.json \
  --work-dir /absolute/new-empty-isolated-work-directory \
  --evidence-id <genuine-rollback-evidence-id> \
  --executed-at <genuine-UTC-execution-time> \
  --proof-created-at <genuine-UTC-proof-time> \
  --executor-identity <genuine-rollback-executor-identity> \
  --execution-subject-identity <genuine-rollback-subject-identity> \
  --root /absolute/repository

# After the independent signed rollback review, generate the BA scope while
# HEAD is still BP, then commit BA and use a commit-preserving package PR.
node tools/generate-climate-public-beta-artifacts.js \
  --scope-manifest --release-id <exact-HB-01-release-id> \
  --release-builder-identity <genuine-release-builder-identity> \
  --root /absolute/repository
node tools/check-climate-public-beta-package.js \
  --scope-manifest /absolute/repository/data/climate/public-beta/governance/releases/<exact-HB-01-release-id>/scope-manifest.json \
  --root /absolute/repository
node tools/check-climate-public-beta-package.js \
  --rollback-proof /absolute/repository/data/climate/public-beta/governance/releases/<exact-HB-01-release-id>/rollback-proof.json \
  --bound-scope-manifest /absolute/repository/data/climate/public-beta/governance/releases/<exact-HB-01-release-id>/scope-manifest.json \
  --root /absolute/repository

node tools/check-climate-public-beta-diff-boundary.js --base <base> --head <head>
# Approval-only PR validation; authenticates the public record but cannot deploy:
node tools/check-climate-public-beta-readiness.js \
  --level invited_beta --purpose approval-validation --json
# Real preflight additionally requires the signed private holding/access proof:
node tools/check-climate-public-beta-readiness.js \
  --level invited_beta --purpose access-controlled-preflight \
  --access-bootstrap /absolute/private/access-bootstrap-directory --json
# The next commands validate/stage BA-bound bytes only; they do not authorize
# or bind an upload.
./tools/build-climate-public-beta.sh --level invited_beta \
  --access-bootstrap /absolute/private/access-bootstrap-directory
node tools/check-climate-public-beta-surface.js \
  --staged _deploy_beta --level invited_beta
ELU_VERIFIED_PUBLICATION_LEVEL=invited_beta \
ELU_CLIMATE_PUBLIC_BETA_ACCESS_BOOTSTRAP=/absolute/private/access-bootstrap-directory \
  node tools/check-staged-climate-public-beta-integrity.js --staged _deploy_beta
# HIGH: stop here until BETA-15c is implemented and independently reviewed.
# No current command atomically binds this tree to Direct Upload and a receipt.
# Remote checks below run only after that future signed transaction succeeds.
node tools/check-remote-climate-public-beta.js \
  --level invited_beta --url <stable-approved-origin> \
  --evidence /absolute/private/evidence/beta-run-artifact-index.json
node tools/check-climate-public-beta-readiness.js \
  --level invited_beta \
  --access-bootstrap /absolute/private/access-bootstrap-directory \
  --evidence /absolute/private/evidence/beta-run-artifact-index.json --json
```

L2 repeats the complete chain with `public_beta`, its separate immutable
approval/signature bundle, chained private public access-bootstrap report,
private invited/remote evidence, and the exact L2 origin/exposure state. Its
build supplies both `--access-bootstrap` and `--evidence`; its final staged
check supplies `ELU_VERIFIED_PUBLICATION_LEVEL=public_beta`,
`ELU_CLIMATE_PUBLIC_BETA_ACCESS_BOOTSTRAP`, and
`ELU_CLIMATE_PUBLIC_BETA_PRIVATE_EVIDENCE` as exact absolute private paths.
Those checks still stop before upload. L2 must repeat the separately
implemented, reviewed, BA-pinned `BETA-15c` transaction and preserve its
signed operator receipt before remote verification.

The beta CI must also prove the assessed rails were not weakened:

```sh
node tools/check-climate-runtime-diff-boundary.js --self-test
node tools/check-globe-runtime-assets.js
node tools/check-public-deploy-surface.js --self-test
node tools/check-staged-production-integrity.js --self-test
node tools/check-climate-production-readiness-policy.js
node tools/check-climate-truth-ci.js
node tools/check-climate-public-beta-assessed-boundary.js
```

The proposed final boundary checker must select candidate or reviewed-release
state from the canonical assessed artifacts and compare the candidate, release,
allow-incomplete, and strict probes to a reviewed, versioned expected-state
baseline. While the assessed package is absent/incomplete, it requires the
exact current structured blocked/failure IDs. As legitimate Option 1 work
advances, a reviewed baseline may change; an authentic `release_ready` and
strict PASS is accepted only when the unchanged assessed gates themselves pass.
It must reject semantic drift and any result inconsistent with the selected
state; `|| true` and arbitrary nonzero acceptance are forbidden. Beta paths
must never count as assessed inputs. The live production runtime-diff checker
must also run with the PR base/head.

Negative beta-surface tests must prove `_deploy_beta` contains none of:

```text
CANDIDATE-NOT-FOR-PUBLICATION.txt
data/climate/runtime/**
data/climate/runtime-manifest.json
data/climate/releases/ct40-reviewed-release-input.json
data/climate/releases/ct40-allow-manifest.json
data/climate/releases/reviewed-release-diff.json
data/climate/releases/reviewed-rollback-proof.json
manifest.json
sw.js
js/vendor/globe.gl.js
assets/globe/runtime/**
data/climate/fixtures/**
data/climate/reviews/**
data/climate/operations/**
data/governance/vendor/**
docs/**
tools/**
```

The checker must also scan HTML, CSS, JavaScript, JSON, headers, and notices for
candidate/runtime/globe references, production-origin fetches,
`navigator.serviceWorker.register`, and unapproved external executable, data,
font, image, or telemetry requests. Browser network capture must prove all
automatic runtime delivery is same-origin, and live beta verification must
prove `/sw.js` is absent (normally HTTP 404). A user-initiated reviewed feedback
link is not an automatic runtime request.

## 16. Definition of “shareable” and “publishable”

The beta is **shareable with invited reviewers** only when:

1. every distributed byte has a real rights basis and complete notice;
2. the new beta data and UI have completed their required independent reviews;
3. every `BETA-*` gate for L1 passes from a clean commit;
4. the staged output matches its exact manifest;
5. rollback has been executed and independently reviewed;
6. protected CI authenticates exact BA separately from synthetic-merge
   compatibility, and the merge record proves exact BR/BP/BA object IDs remain
   reachable from `main`;
7. the feedback route and owner are active;
8. a real release owner authenticates the exact commit, scope, manifest,
   origin, validity, and `invited_beta` level; and
9. the implemented and independently reviewed `BETA-15c` transaction binds
   the fresh access gate and immutable staged digest to the exact project
   upload, provider receipt/origin, immediate probes, and signed operator
   evidence; and
10. the signed L1 remote preflight follows the canonical record order, starts
   after its approval/access floor, and verifies with its attestation and all
   freshness-critical observations inside one frozen remote-probe interval.

The beta is **authorized for public activation** only when, in addition:

1. invited feedback has been triaged;
2. all no-go issues are resolved or the affected content is withheld;
3. accepted corrections have been released immutably;
4. deployed bytes and cache behavior are reverified;
5. the public correction log and known limitations are current; and
6. a real release owner separately authenticates the exact commit, scope,
   manifest, prior L1 approval, signed L1 evidence index, origin, validity, and
   `public_beta` level only after that invited-evidence index is signed, with
   `approved_at` no earlier than the index `signed_at`; and
7. the reviewed `BETA-15c` transaction is repeated for the exact L2 tree and
   project, then all L2 preflight checks, including `BETA-16a`, pass while
   access control is still enforced, in canonical record order, strictly
   after the prior signed transition and with all current-freshness fields
   inside one frozen remote-probe interval.

The beta is **verified live** only after the controlled activation occurs,
its observations/attestation/signature follow the L2-preflight `signed_at`,
immediate remote checks pass while current, the status enters
`live_public_beta_monitoring`, and the later signed monitoring evidence stays
ordered and current through the frozen BETA-16b observation window without a
withdrawal condition.

This dependency-based definition is the release date. A calendar date for L1
or L2 should be set only after `HB-01` through `HB-06` are complete and the
remaining beta work can be estimated without pretending human review has
already happened. `HB-13` remains an assessed requirement, not factual-beta
evidence or a beta-content gate. However, the unchanged repository workflow
currently makes it a protected F merge blocker; that operational dependency
must be resolved legitimately before the separate beta path can advance from
draft foundation to merged foundation.
