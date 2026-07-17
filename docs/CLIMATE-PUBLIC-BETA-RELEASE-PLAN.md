# Climate Public Beta release plan

- Status: proposed; planning evidence only
- Publication authority: none
- Assessed-production authority: none
- Last updated: 2026-07-17

This plan defines a truthful, rights-safe public beta for the narrow factual
climate product that already exists in candidate form. It does not authorize
publication, relabel the current candidate, or change the requirements for the
full assessed-climate production release.

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
| L2 — public beta | Publicly reachable dedicated beta origin | L1 complete; independent beta review complete; critical findings resolved; public correction policy and named feedback owner active; a separate exact L2 approval authorizes activation; post-activation verification is mandatory |
| L3 — assessed production | Public assessed climate product | Every requirement in the assessed-production action ledger passes, including CT-40 ALLOW, strict Truth CI, full reviews, rights, signatures, and release approval |

A Cloudflare branch-preview URL is public unless protected by actual access
control. `noindex`, an obscure URL, or a “private” label is not access control.
The L1 checker must prove that an unauthorized request is denied and an
authorized request returns the exact approved bytes. That access-control
invariant must be monitored until a separate L2 approval becomes effective.
The same redistribution and truth requirements apply whenever files are sent to
people outside the authorized internal team.

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
| `BETA-07-public-copy` | Persistent beta label and contextual limitations are accurate and understandable | Copy inventory and UI review | Copy owner; independent non-specialist reviewer | Exact-copy checker plus comprehension review |
| `BETA-08-accessibility` | Keyboard, focus, screen-reader, contrast, 320px layout, 200% zoom, reduced-motion, and non-color cues pass | Accessibility report | Independent accessibility reviewer | Automated checks plus real manual review |
| `BETA-09-security-privacy` | Same-origin runtime delivery, CSP/headers, no secrets, no unnecessary telemetry, and an approved feedback privacy contract | Security/privacy checklist and staged headers | Release engineer; maintainer/data controller | Static checks, browser/network smoke, header and privacy-policy verification |
| `BETA-10-feedback` | Visible intake route, issue taxonomy, triage states, correction/withdrawal policy, feedback owner, private security route, and abuse handling exist | Feedback policy and issue template | Named feedback owner | Link and workflow validation |
| `BETA-11-diff` | Every change from the prior beta or “no prior beta” baseline is exact and reviewed | Reviewed beta release diff | Release engineer; independent reviewer | Recomputed path/hash diff |
| `BETA-12-rollback` | Exact prior deploy/baseline can be restored; cache behavior is tested; procedure is independently reviewed | Executable beta rollback proof | Rollback builder; independent rollback reviewer | Temporary rehearsal and exact restored hashes |
| `BETA-13-staged-bytes` | Only allowlisted files are staged; every source/staged hash matches; no symlinks or internal artifacts exist | Staged build manifest | Release engineer | Independent final staged verifier |
| `BETA-14-ci` | Beta diff-boundary, policy fixtures, truth checks, JavaScript syntax, browser smoke, accessibility automation, and assessed-rail invariants pass with no drift | Full beta CI | Release engineer | Protected GitHub required checks |
| `BETA-15-approval` | Real human data, rights, UI/accessibility, package-diff, rollback, and release authorities authenticate their exact attestations and level-specific decisions; assessed authority remains false | Beta trust registry, review attestations, approvals, and detached signature bundles | Independent beta data, rights, UI/accessibility, package, and rollback reviewers; beta release authorizer | Signature, role, scope, commit, level, origin, validity, and descendant-drift verification |
| `BETA-16a-remote-preflight` | Behind access control, every hostname/alias, deployment ID/commit, authorized byte surface, unauthorized denial, browser result, cache header, production baseline, and withdrawal target matches the proposed level and is authenticated | Signed preactivation evidence outside the public runtime | Release operator; independent rollback reviewer | Signature, alias, access-control, remote surface, browser, production-baseline, and withdrawal-preflight checkers |
| `BETA-16b-live-verification` | After the separately authorized exposure change, every public alias serves exact bytes, immediate probes pass, the frozen monitoring window completes, and any failure triggers signed withdrawal evidence | Signed post-activation evidence outside the public runtime | Release operator; independent rollback reviewer | Signature, public-alias, remote surface, browser, monitoring, and withdrawal checkers |

The full top-20 primary-source package, 2,060 assessed field reviews, country
profiles, assessed CT-40 ALLOW, production Ed25519 registry, and assessed
release signatures are not beta gates because their associated assessed uses
are absent. They remain mandatory and unchanged for L3.

## 8. Required beta artifacts

The following paths are proposed. They do not exist yet and grant no authority
until their schemas, checkers, and genuine reviews are implemented.

```text
climate-public-beta/                 # dedicated beta UI source
  index.html
  _headers
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
    releases/<beta-id>/
      source-rights-review.json
      source-rights-review.signatures.json
      independent-data-review.json
      independent-data-review.signatures.json
      independent-ui-accessibility-review.json
      independent-ui-accessibility-review.signatures.json
      release-diff.json
      release-diff.signatures.json
      rollback-proof.json
      rollback-proof.signatures.json
      approvals/invited-beta.json
      approvals/invited-beta.signatures.json
      approvals/public-beta.json
      approvals/public-beta.signatures.json
```

The exact deploy allowlist contains only the dedicated beta UI, beta-readable
notice, beta runtime manifest, selected immutable runtime release files, and
required public licenses/source notices. Governance paths are not staged.
Public reviewer names or organizations appear only with informed consent.

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

1. freeze beta policy, source scope, schemas, UI source, checkers, public
   allowlist, and authority registry;
2. obtain the exact source/identity redistribution decisions and authenticate
   the rights attestation;
3. rebuild the initial release from the exact pinned PRIMAP v2.6.1 raw CSV,
   compile factual and separately licensed identity artifacts, and verify all
   transformation hashes;
4. perform and authenticate the independent data review, then perform the
   independent UI/copy/accessibility reviews;
5. generate the runtime manifest and deterministic public-surface manifest;
6. generate and independently review the exact release diff;
7. generate, execute locally, and independently review the exact repository
   rollback plus hosted withdrawal procedure, target, and baseline; actual
   remote withdrawal evidence is captured after deployment;
8. compute the canonical beta scope hash over the exact policy, schemas,
   checkers, UI, runtime data, manifests, licenses, notices, trust registry,
   rights/review attestations and signatures, diff, and rollback bytes; exclude
   only the later level-specific approval/signature pair and prevent every
   artifact from pinning itself;
9. commit the complete reviewed package as **Beta Commit A (BA)**;
10. have the release authorizer approve the exact BA commit, scope, expected
    public-surface manifest, `invited_beta` level, and L1 origin offline;
11. commit only the invited approval and detached signatures as
    **Beta Commit B-L1 (BB-L1)**;
12. verify BA is an ancestor of BB-L1 and every bound BA path is byte-identical;
13. build and stage from clean BB-L1, deploy behind access control, complete
    L1 review, and authenticate the L1 remote/feedback evidence index;
14. if no package byte changed, have the release authorizer approve the exact
    BB-L1 commit (or exact merged-main equivalent), prior L1 approval hash,
    signed evidence-index hash, expected public-surface manifest,
    `public_beta` level, and L2 origin offline;
15. commit only the public approval and detached signatures as
    **Beta Commit B-L2 (BB-L2)**;
16. verify BB-L1 is an ancestor of BB-L2 and all package/L1 approval bytes are
    unchanged, then build the L2 preflight from clean BB-L2;
17. after `authorized_for_public_activation`, perform the controlled exposure
    and capture the signed BETA-16b evidence.

The expected public-surface manifest is generated before BA from exact source
paths and hashes. It is not a claim that staging already occurred. `BETA-13`
later enumerates the actual post-BB staged tree and requires byte-for-byte
equality with that expected manifest, avoiding any preapproval/staging cycle.

The merge strategy must preserve BA. If the repository uses squash/rebase and
changes the reviewed commit identity, the signature is invalid. The safe
two-round fallback is:

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

Create a separate beta build path rather than adding a permissive branch to the
current build:

```text
tools/lib/climate-public-beta-policy.js
tools/lib/climate-public-beta-surface.js
tools/check-climate-public-beta-readiness.js
tools/check-climate-public-beta-diff-boundary.js
tools/check-climate-public-beta-surface.js
tools/stage-climate-public-beta.js
tools/check-staged-climate-public-beta-integrity.js
tools/check-remote-climate-public-beta.js
tools/build-climate-public-beta.sh
```

Proposed output directory: `_deploy_beta`.

The beta builder must:

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

The beta diff-boundary policy must watch the dedicated UI tree,
`data/climate/public-beta/**`, every beta builder/stager/checker/library/schema,
the beta notice and headers, and its protected CI/CODEOWNERS wiring. It must run
both adversarial self-tests and a live base/head comparison. Any beta-affecting
change forces the applicable L1 or L2 readiness gate; a production diff checker
reporting “no runtime change” is not sufficient.

Beta policy, trust, approval, build, staging, diff-boundary, and CI paths must be
protected by CODEOWNERS and branch protection. Protected Git governance guards
who may change the authority mechanism; detached signatures authenticate the
actual human decisions. Neither mechanism substitutes for the other.

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

Beta CI should be a separate protected required job. It must not turn an
expected assessed `BLOCKED` result into a pass or mark missing assessed
components as complete. A dedicated assessed-boundary assertion must verify the
exact expected candidate/block state and passing policy fixtures; simply
running a known-failing `--release` or `--strict` command under `set -e`, or
tolerating an arbitrary nonzero exit, is not evidence that the rails remain
intact.

The existing CT-42 UI-review and candidate-rollback ancestry failures must also
be repaired by a legitimate ancestry decision or fresh independent reviews
before the implementation PR can achieve full green repository CI. The beta
cannot redefine those failures as acceptable merely because it uses a separate
runtime surface.

## 10. Hosting and publication boundary

Recommended hosting:

- a separate maintainer-authorized Cloudflare Pages beta project/origin;
- production branch `main` for that beta project;
- an explicit level-bound build command, initially
  `./tools/build-climate-public-beta.sh --level invited_beta` and only after
  L2 approval `--level public_beta`;
- output `_deploy_beta`;
- all non-main beta-project branch builds rejected or access-controlled; and
- no shared root service worker or cache with the existing production origin.

The beta hostname/project name and whether L1 uses Cloudflare Access are human
infrastructure decisions. Creating or configuring the project is not authorized
by this plan.

The existing production site must stay byte-identical during invited beta
testing, proven by before/after hashes of a frozen production artifact
inventory. L2 remains on the dedicated beta origin. The primary Earth Love
United URL can change only through the full assessed BA/BB-equivalent release
process or a separately designed and authorized future factual-production
program; an L2 beta decision alone cannot promote it.

For every L1/L2 deployment, retain private or access-controlled operational
evidence containing the deployment URL and ID, source commit, approved origin,
access-control result, exact remote-file hashes, browser/accessibility results,
cache headers, observation window, privacy-safe feedback summary, and rollback
or withdrawal result. The public repository may contain a sanitized hashed
index only when its disclosure has been reviewed.

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

The first beta has no earlier beta deployment. Its rollback target must be
frozen before L1 as one of: an exact access-locked holding page, a withdrawn
origin returning the approved status on every alias, or a full project-wide
access lock. The plan must record credentialed Cloudflare steps, deployment
IDs, beta cache headers, purge/withdraw action, human response target, and
post-action remote hashes. Repository rollback and hosted rollback are
separate proofs.

Every reachable project hostname, custom hostname, branch/deployment alias,
and preview alias must be enumerated in the approval and remote evidence. At
L1, every alias must deny unauthorized access. At withdrawal, every alias must
be inaccessible or access-locked; detaching only a custom domain is never
sufficient while a `pages.dev` or deployment alias still serves the bytes.

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

Goal: agree exactly what “Climate Public Beta” means before writing the release
mechanism.

Deliverables:

- this plan reviewed by the maintainer;
- decision to use the recommended data-first scope;
- beta product name and public copy approved;
- beta host/access model chosen;
- real human role roster and beta public-key authorities identified;
- measurable review, monitoring, access, and rollback thresholds frozen; and
- feedback channel and complete privacy contract chosen.

Exit: no unresolved scope-changing decision.

### Milestone B — build a rights-safe beta package

Goal: produce a deterministic beta artifact that contains no denied candidate
or unresolved visual-runtime bytes.

Deliverables:

- schemas, policy, compiler, exact public allowlist, and adversarial fixtures;
- separate identity data, copyright/warranty notice, LGPL text, source-access
  information, and transformation log;
- PRIMAP attribution and modification notice;
- authenticated source-specific beta rights disposition and trust registry;
- compiled beta factual data, manifest, known limitations, and scope hash; and
- deterministic rebuild with zero drift.

Exit: `BETA-01` through `BETA-06` pass.

### Milestone C — create and review the beta experience

Goal: make the factual product understandable and accessible without the 3D
globe.

Deliverables:

- table/search/details UI;
- persistent beta and non-assessment labels;
- evidence drawer and correction link;
- responsive, keyboard, screen-reader, contrast, zoom, and reduced-motion QA;
- independent data, copy/comprehension, and accessibility reviews; and
- reviewed release diff.

Exit: `BETA-07` through `BETA-11` pass.

### Milestone D — prove safe sharing

Goal: make the exact beta bytes shareable with invited reviewers.

Deliverables:

- independent rollback proof;
- exact staged-byte manifest;
- clean beta CI and browser smoke;
- feedback owner and triage workflow;
- authenticated beta publication approval for L1; and
- access-controlled beta deployment.

Exit: all L1-applicable `BETA-*` gates pass, including
`BETA-16a-remote-preflight` unauthorized-denial, authorized-byte, remote digest,
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
- fresh deployed-byte and rollback verification; and
- signed L1 feedback/deployment evidence index; and
- separate authenticated human approval for L2 binding L1 and that index.

Exit A: `BETA-01` through `BETA-15` and `BETA-16a` pass for the exact L2 bytes,
origin, and aliases; the release owner’s signature yields
`authorized_for_public_activation`.

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

| ID | Human action required | Why automation cannot decide it | Needed by |
|---|---|---|---|
| `HB-01` | Approve the factual-only beta scope and product name | Product and public-representation decision | Milestone A |
| `HB-02` | Choose the beta hostname/project and L1 access model | External infrastructure and exposure decision | Milestone A |
| `HB-03` | Name real data, rights, accessibility, rollback, feedback, and release roles; supply only their public Ed25519 keys and validity windows | Identities and authority cannot be fabricated; private keys remain offline | Milestone A |
| `HB-04` | Confirm exact PRIMAP and `iso-codes` public-beta redistribution, factual use, attribution, modification notice, and source-access obligations | Rights and license judgment | Milestone B |
| `HB-05` | Approve feedback provider, controller/contact, fields, purpose, anonymity, retention/deletion, access, consent/redaction, abuse, privacy-request, and private security-report rules | Privacy and organizational accountability | Milestone A |
| `HB-06` | Freeze reviewer/session counts, browser/device/accessibility matrix, issue severities, observation windows, access probes, response targets, and rollback target | Risk thresholds cannot be invented after outcomes are known | Milestone A |
| `HB-07` | Independently review and authenticate the compiled factual beta | Scientific/data judgment | Milestone C |
| `HB-08` | Review beta copy for accurate public comprehension | Human interpretation judgment | Milestone C |
| `HB-09` | Perform manual accessibility review | Automation cannot cover real assistive use | Milestone C |
| `HB-10` | Independently review rollback/withdrawal evidence | Operational independence | Milestone D |
| `HB-11` | Sign the exact BA scope, commit, manifest, origin, validity, and `invited_beta` level offline | Authenticated L1 publication authority | Milestone D |
| `HB-12` | Review invited feedback and separately sign GO for the exact `public_beta` level and origin | Risk acceptance and authenticated L2 authority | Milestone E |
| `HB-13` | Resolve squash-lost CT-42 UI/rollback review ancestry through a legitimate history decision or fresh independent reviews | Existing repository-wide CI cannot be reinterpreted by the beta track | Before Milestone D CI can be green |

Only public Ed25519 keys, public attestations approved for disclosure, and
detached signatures may enter the repository. Private keys remain offline and
must never be requested. The beta signature domain and trust registry are
separate from the assessed-production Ed25519 requirements, which remain
unchanged.

## 15. Verification chain

These proposed commands do not exist yet; implementing and adversarially
testing them is deterministic engineering work:

```sh
node tools/check-climate-public-beta-diff-boundary.js --self-test
node tools/check-climate-public-beta-diff-boundary.js --base <base> --head <head>
node tools/check-climate-public-beta-readiness.js --level invited_beta
./tools/build-climate-public-beta.sh --level invited_beta
node tools/check-climate-public-beta-surface.js \
  --staged _deploy_beta --level invited_beta
ELU_VERIFIED_PUBLICATION_LEVEL=invited_beta \
  node tools/check-staged-climate-public-beta-integrity.js --staged _deploy_beta
node tools/check-remote-climate-public-beta.js \
  --level invited_beta --url <approved-origin> --evidence <private-evidence-index>
```

L2 repeats the complete chain with `public_beta`, its separate immutable
approval/signature bundle, and the exact L2 origin/exposure state.

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
6. the feedback route and owner are active; and
7. a real release owner authenticates the exact commit, scope, manifest,
   origin, validity, and `invited_beta` level.

The beta is **authorized for public activation** only when, in addition:

1. invited feedback has been triaged;
2. all no-go issues are resolved or the affected content is withheld;
3. accepted corrections have been released immutably;
4. deployed bytes and cache behavior are reverified;
5. the public correction log and known limitations are current; and
6. a real release owner separately authenticates the exact commit, scope,
   manifest, prior L1 approval, signed L1 evidence index, origin, validity, and
   `public_beta` level; and
7. all L2 preflight checks, including `BETA-16a`, pass while access control is
   still enforced.

The beta is **verified live** only after the controlled activation occurs,
immediate remote checks pass, the status enters `live_public_beta_monitoring`,
and the frozen BETA-16b observation window completes without a withdrawal
condition.

This dependency-based definition is the release date. A calendar date should
be set only after `HB-01` through `HB-06` are complete, the `HB-13` resolution
path is chosen, and the remaining work can be estimated without pretending
human review has already happened.
