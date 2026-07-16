# Option 1 climate production release action ledger

**Audit coordinate:** `a476147c3fd33178020da077b828242d63fa360e`

**PR #58 head inspected:** `1f77764e41d90f467130f4468b08111b17c931ba`

**Audit run:** `2026-07-16T23:24:33Z`

**Ledger status:** release blocked; no approval, authority, legal decision, review,
identity, timestamp, public key, or signature is asserted by this document.

This ledger is an engineering and human-action map. It is not release evidence,
a rights decision, a review attestation, or deploy authorization.

## Baseline results

| Command | Exit | Observed result |
|---|---:|---|
| `node tools/check-climate-production-readiness.js --release` | 1 | `BLOCKED (release)`: 10 PASS and 12 BLOCK checks |
| `node tools/climate-truth-ci.js --strict` | 1 | `FAIL`: two missing reviewed components plus CT-42 UI-review and candidate-rollback ancestry failures |
| `./tools/build-deploy.sh --release` | 1 | Correctly stopped at production readiness before staging public output |

These counts are the clean pre-ledger baseline. While this new ledger is
untracked, a new readiness run will also block `release-worktree-clean`; after
the ledger is committed and the tree is otherwise clean, that check can return
to PASS.

The isolated mission worktree started clean at the merged main commit. The
original dirty checkout was inspected before and after mission creation and was
not modified.

Strict CI currently reports these additional details beneath the top-level
`strict-truth-ci` blocker:

- missing `reviewed-runtime-manifest`;
- missing `reviewed-release-diff`;
- `CT-42-UI-R` fails because reviewed commit `0ccf9cf90e25e98cc7b734cb4acf8ee0d85080eb`
  is not an ancestor of squash-merged main;
- `CT-42-ROLLBACK` fails because review-chain commit
  `652e038cae88e03b4b74bbd92188175223d9d386` is not an ancestor of
  squash-merged main.

The PR #58 head and merged main have the identical tree
`c566a7ed8d16d73e9e25a889ae984140c3f8a29e`, and both reviewed commits are
ancestors of the PR head. They are not ancestors of merged main. This is a Git
ancestry break caused by squash merge, not evidence of byte drift.

## Commit and signing sequence decision

The cryptographic binding cannot be produced in one self-referential commit.
It requires at least two preserved commits:

1. **Commit A — reviewed package coordinate.** Finalize every bound byte:
   evidence registry and artifacts, reviewed CT-40 input and authentic output,
   runtime manifest, reviewed diff, executable rollback package, trust registry,
   notices/integration/schema pins, validators, fixtures, CI controls, and public
   runtime bytes.
2. Human reviewers inspect exact Commit A. The approval JSON directly pins
   Commit A, the trust hash and selected key IDs, the CT-45 manifest, and the
   notice/inventory/integration bytes. The reviewed-commit scope checks bind the
   complete reviewed release package and control plane indirectly by requiring
   zero path drift from Commit A.
3. The three role holders sign the exact domain-separated messages offline; the
   detached bundle binds the approval's exact raw-file hash.
4. **Commit B — authorization material only.** Add the exact approval and its
   detached signature bundle. No path bound to Commit A may change.

The approval and detached-bundle paths are deliberately excluded from the two
reviewed scopes, so Commit B may add those two files. The current readiness
scope binds 68 paths, the staged scope binds 67 paths, and their union is 75
enumerated paths.

That union is not yet a complete release-control scope. It omits multiple strict
transition checkers, including `tools/check-source-routing-policy.js`,
`tools/check-source-rights-review-packets.js`,
`tools/check-globe-webgl-fallback.js`,
`tools/check-ct42-ct40-release-review-candidate.js`, and
`tools/check-ct42-runtime-rollback-proof.js`; the readiness scope also omits
`tools/check-climate-factual-runtime-data-review.js`. Before Commit A, engineering
must centralize and extend the bound path set to every release-critical checker,
fixture, schema, generator, and package artifact, with mutation tests. Until that
hardening lands, the accurate claim is only that changes to one of the currently
enumerated paths invalidate binding. After hardening, Commit B must add only the
two intentionally excluded authorization files.

The protected PR must contain both A and B to make GitHub CI green: the workflow
immediately runs release readiness when `data/climate/runtime-manifest.json`
exists, so an unsigned package-only PR cannot pass required CI.

**Merge requirement:** Commit A must remain an ancestor of final main. The
release PR therefore must use a true merge commit or fast-forward and must not
be squash-merged or rebased. PR #58 proves that signing a PR head and then
squash-merging it invalidates the ancestry binding. If the repository permits
only squash merge, the safe fallback is a second offline signing round against
the resulting merged-main commit; the first post-squash deployment remains
correctly blocked until that second approval PR lands.

Before release-artifact work begins, a maintainer must explicitly choose the
merge strategy and either:

- approve a no-tree-change merge of the authentic PR #58 history to restore the
  existing review ancestry; or
- require fresh independent CT-42 UI and rollback review coordinates rooted in
  merged main.

## Canonical artifact generation order

After genuine evidence and review inputs exist, regenerate downstream artifacts
in this order without hand-editing downstream hashes:

1. Write the reviewed CT-40 input, source-rights decisions, exact evidence
   registry, top-20 reviews, field reviews, facts, profiles, and canonical hashes.
   Freeze the embedded independent review records before hashing this input.
2. Run `evaluateRelease()` and write its exact full output as
   `data/climate/releases/ct40-allow-manifest.json`.
3. Write `data/climate/runtime-manifest.json` with exact runtime, evidence,
   source-registry, input, output, fact, profile, and attestation pins.
   Freeze its independent runtime review before creating the diff.
4. Write and canonically hash
   `data/climate/releases/reviewed-release-diff.json`.
   Freeze its independent diff review before building rollback.
5. Build, independently review, and execute
   `data/climate/releases/reviewed-rollback-proof.json` and its pinned patch.
6. Finalize the prepared approval-state checker/schema/trust/notices transition,
   centralize and complete the reviewed path-binding scope, run the package
   validator and binding mutation tests, and create Commit A.
7. Only after Commit A exists, create the human approval and detached signatures
   and create Commit B.

## Release blocker ledger

| Blocker / check ID | Required evidence or decision | Responsible role | Target artifact | Schema / checker | Dependencies | Current status | Verification command |
|---|---|---|---|---|---|---|---|
| `real-ct40-allow` | Exact full `evaluateRelease()` output for a nonempty, reviewed assessed release; `decision=allow`, content eligible, factual-display tier eligible, and no minted release authority | Release builder; independent `ct40_release_reviewer` | `data/climate/releases/ct40-reviewed-release-input.json`; `data/climate/releases/ct40-allow-manifest.json` | `ct40-reviewed-release-input.schema.json`; `release-eligibility-result.schema.json`; `tools/lib/climate-release-gate.js` | Top-20 evidence, rights/scoring decisions, field reviews, reviewed profiles, independent release review | BLOCKED. Production input/output absent. Current candidate has 2,060 facts, zero CT-40 fact reviews, zero profiles, and authentic DENY | Supporting: `node tools/check-reviewed-climate-release.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `canonical-reviewed-release-package` | Shared validator recomputes schemas, CT-40 output, facts/profiles, source decisions, document pins, diff, and rollback | Release/runtime/diff/rollback builders and their independent reviewers | All five canonical release artifacts listed below | `tools/lib/climate-reviewed-release.js`; five release schemas | Every climate-package blocker plus executable rollback | BLOCKED. Validator truthfully reports the package absent | Supporting: `node tools/check-reviewed-climate-release.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `top20-primary-review-complete` | Exact frozen 20-country set; at least one unique exact artifact for each of three roles per country; independent, hashed review records | `document_acquirer`; independent `source_identity_reviewer`; extractor and reviewer | `data/climate/evidence/**`; production source registry `evidence_documents`; reviewed input `top20_primary_source_reviews` | `ct40-reviewed-release-input.schema.json`; `tools/lib/climate-reviewed-release.js`; CT-14/CT-16 checkers | Rights decision for every evidence source; exact artifacts and checksums | BLOCKED. 0/20 eligible, zero official inventories, 16 audits not started; source registry has no evidence-document registry | Supporting: `node tools/check-top20-primary-source-gap-queue.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `licence-decisions-complete` | Exactly one independently reviewed redistribution-and-scoring decision per used source, bound to source version/checksum and every evidence document | `licence_and_redistribution_reviewer`; independent rights reviewer; counsel where required | Separate reviewed decision artifacts compiled into reviewed-input `source_rights_decisions` and candidate licence metadata; production source registry. The five CT-17 packet snapshots remain immutable and blank | `ct40-reviewed-release-input.schema.json`; `source-rights-review-packet.schema.json`; reviewed-package validator | Exact source corpus and final candidate source set | BLOCKED. All five CT-17 packet scopes await authorized decisions; PRIMAP assessment/scoring is undecided and four UNFCCC families are pending/limited | Supporting: `node tools/check-source-rights-review-packets.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `field-reviews-complete` | One authentic field review per released fact, plus reviews for new inventory/target facts; independent extractor/reviewer; exact checksum, methodology, and required field paths | `fact_extractor`; independent `field_level_climate_reviewer`; profile compiler/reviewer | Reviewed input `fact_reviews`; published facts and profiles | `tools/lib/climate-release-gate.js`; input and runtime-manifest schemas | Rights/scoring approval; complete facts; profile compilation | BLOCKED. Current 2,060-fact batch attestation covers factual display only; assessed field reviews and profiles are absent | Supporting: `node tools/check-reviewed-climate-release.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `independent-release-review` | Reviewed candidate with nonempty genuine reviewer set excluding its builder | `release_builder`; independent `ct40_release_reviewer` | Reviewed input `candidate.review` | `ct40-reviewed-release-input.schema.json`; CT-40 evaluator | Complete candidate, facts, profiles, rights, and reviews | BLOCKED. Production candidate absent | Supporting: `node tools/check-reviewed-climate-release.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `reviewed-release-artifacts` | Five regular non-symlink artifacts with exact schemas and pins | Release builder plus runtime, diff, and rollback reviewers | `runtime-manifest.json`; reviewed input; ALLOW; reviewed diff; reviewed rollback proof | Five schemas and shared validator | Authentic ALLOW and canonical generation order | BLOCKED. All five paths absent | Supporting: `node tools/check-reviewed-climate-release.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `rollback-proof` | Exact four-package pins; ancestor baseline; canonical non-no-op patch; successful temporary `git apply`; exact restored hashes; JS syntax; independent review | Rollback builder; independent rollback reviewer | `data/climate/releases/reviewed-rollback-proof.json`; pinned `data/climate/operations/*.patch.b64` | `reviewed-runtime-rollback-proof.schema.json`; `tools/lib/reviewed-runtime-rollback-proof.js` | Final input, ALLOW, manifest, and diff | BLOCKED. Production proof absent. Existing candidate proof is a different schema and its squash-lost ancestry also fails strict CI | Supporting: `node tools/check-reviewed-climate-release.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `strict-truth-ci` | Every configured component passes with zero missing components and no generated drift | Release engineer; independent reviewers for changed reviewed inputs | Production artifacts plus mode/version-aware checker and fixture transition | `tools/climate-truth-ci.js --strict`; policy fixtures | All package blockers; ancestry repair/fresh review; approved-state checker transition | BLOCKED. Missing manifest/diff; CT-42 UI and rollback ancestry failures; current candidate-only assertions make a later production state unreachable | Supporting: `node tools/climate-truth-ci.js --strict`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `runtime-approval-trust-registry-provisioned` | Active canonical Ed25519 SPKI public authority for each exact required role, with derived key IDs and validity windows | Maintainer/CODEOWNER; actual role holders supply public keys | `data/climate/governance/globe-runtime-approval-trust.json` and all exact hash pins | `tools/lib/globe-runtime-approval.js`; approval schema; notice integration/fixtures | Real public identities and public keys; prepared-state policy transition | BLOCKED. Registry is exact but `unprovisioned` with `authorities: []` | Supporting: `node tools/check-globe-runtime-approval.js`; definitive: `node tools/check-climate-production-readiness.js --release` |
| `runtime-approval-signature-bundle-present` | Three canonical 64-byte Ed25519 detached signatures in required-role order | `asset_rights_reviewer`; `licensing_counsel`; `release_authorizer`, signing offline | `data/climate/reviews/globe-runtime-assets-production-review.signatures.json` | `tools/lib/globe-runtime-approval.js` | Commit A, exact approval bytes, registry hash, three private-key operations offline | BLOCKED. Bundle absent | `node tools/check-climate-production-readiness.js --release` |
| `runtime-asset-exact-independent-approval` | Exact v2 approval: five asset dispositions, four counsel resolutions, exact notice/manifest pins, four distinct identities, Commit A binding, and three verified signatures | Release builder; asset-rights reviewer; licensing counsel; release authorizer | `data/climate/reviews/globe-runtime-assets-production-review.json`; trust registry; signature bundle | `globe-runtime-assets-production-review.schema.json`; runtime-approval and readiness libraries | Validated climate package, provisioned trust, five decisions, four resolutions, signatures | BLOCKED. Approval absent; 5/5 asset rows and 4/4 counsel questions unresolved; no reviewed-commit binding | `node tools/check-climate-production-readiness.js --release` |

### Five canonical reviewed-release artifacts

| Artifact | Schema |
|---|---|
| `data/climate/releases/ct40-reviewed-release-input.json` | `data/climate/schemas/ct40-reviewed-release-input.schema.json` |
| `data/climate/releases/ct40-allow-manifest.json` | `data/climate/schemas/release-eligibility-result.schema.json` |
| `data/climate/runtime-manifest.json` | `data/climate/schemas/reviewed-climate-runtime-manifest.schema.json` |
| `data/climate/releases/reviewed-release-diff.json` | `data/climate/schemas/reviewed-release-diff.schema.json` |
| `data/climate/releases/reviewed-rollback-proof.json` | `data/climate/schemas/reviewed-runtime-rollback-proof.schema.json` |

## PASS checks that must remain green

| Check ID | Current boundary | Verification |
|---|---|---|
| `independent-data-review` | Existing CT-42 factual-candidate data review passes; not assessed-release authority | `node tools/check-climate-factual-runtime-data-review.js` |
| `independent-ui-review` | Readiness summary passes, but full checker currently has the ancestry failure recorded above | `node tools/check-climate-factual-runtime-ui-review.js` |
| `canonical-source-links` | Five canonical organization-repository references | `node tools/check-canonical-source-links.js` |
| `public-copy` | Seven configured public files pass | `node tools/check-public-copy.js` |
| `load-order` | Ten classic scripts satisfy the DAG | `python3 scripts/verify_load_order.py` |
| `javascript-syntax` | Active non-vendor JavaScript parses | `node tools/check-climate-production-readiness.js --release` |
| `ct45-runtime-asset-integrity` | Exact five localized assets and runtime coupling pass; no rights authority inferred | `node tools/check-globe-runtime-assets.js` |
| `ct45-notice-integrity` | Notice/inventory/integration bytes pass; no rights authority inferred | `node tools/check-globe-third-party-notices.js` |
| `approval-trust-registry-integrity` | Current empty registry matches its exact policy pin; provisioning must refresh every dependent pin | `shasum -a 256 data/climate/governance/globe-runtime-approval-trust.json`; definitive readiness checker |
| `release-worktree-clean` | Clean checkout at baseline | `test -z "$(git status --porcelain --untracked-files=all)"`; definitive readiness checker |

## Exact evidence and human-review scope

### Frozen top-20 country set

`AUS`, `BRA`, `CAN`, `CHN`, `DEU`, `IDN`, `IND`, `IRN`, `JPN`, `KOR`,
`MEX`, `NGA`, `PAK`, `RUS`, `SAU`, `THA`, `TUR`, `USA`, `VNM`, `ZAF`.

Each country requires nonempty, canonically sorted document-ID lists for:

- `official_inventory`;
- `active_ndc`;
- `target_methodology`.

This is a minimum of 60 globally unique evidence-document registrations. Each
must resolve to one same-country, same-role, regular non-symlink artifact under
`data/climate/evidence/`, have an exact SHA-256, be linked to an independently
reviewed source-rights decision, and be independently reviewed by an identity
different from its extractor. One document cannot be reused in two review roles.

### Field reviews and profiles

The current assessed-release input must not infer field reviews from the CT-10C
factual-display batch attestation. It needs at least 2,060 authentic review
records for the current PRIMAP facts, plus a record for every new released fact.
Each record requires distinct extractor/reviewer identities, a real review time,
the exact source checksum and methodology version, and reviewed entries for
`metric`, `period`, `scope`, `source`, and `evidence`. High-impact derived or
modeled facts additionally require a `derivation` review covering the output and
all input fact IDs.

Every released fact must be consumed by a nonempty reviewed profile set. Profile
compiler and reviewer must be independent; inputs, methodology, and canonical
calculation hash must match.

## Exact asset and counsel decisions

### Five asset-specific rights rows

| Asset ID | Exact runtime path and SHA-256 | Exact source pin |
|---|---|---|
| `country-geometry` | `assets/globe/runtime/ne_110m_admin_0_countries.geojson` · `a4d67eac9c75d5b6f20170d2b07bb53ea791536b0c8e5ebae3ba94df093f76e0` | URL `https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/example/datasets/ne_110m_admin_0_countries.geojson`; `source_path: null`; ID `ne_110m_admin_0_countries.geojson`; type `third_party_package_asset` |
| `earth-night` | `assets/globe/runtime/earth-night.jpg` · `373e5a08c9f378a2ce6320214a613148e4b1e3946b3f39a516c9093b76cb7124` | URL `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg`; `source_path: null`; ID `dnb_land_ocean_ice.2012.3600x1800.jpg`; type `official_publisher_asset` |
| `night-sky` | `assets/globe/runtime/night-sky.png` · `7e1d5e780301e3a33bd79fd3ac414f7a742465f33ae4605abca743d43a3ab983` | URL `https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/night-sky.png`; `source_path: null`; ID `night-sky.png`; type `third_party_package_asset` |
| `earth-blue-marble` | `assets/globe/runtime/earth-blue-marble.jpg` · `228deba2e4b600146bdcb6cfa359b8ead6aacc2b1c13550a29cd82824cfa1c01` | URL `https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-blue-marble.jpg`; `source_path: null`; ID `earth-blue-marble.jpg`; type `third_party_package_asset` |
| `earth-topology` | `assets/globe/runtime/earth-topology.png` · `839b12da2e4dd346b256cebae72e10c479a102c8980a22084c41275e4b9a0e12` | URL `https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-topology.png`; `source_path: null`; ID `earth-topology.png`; type `third_party_package_asset` |

Each row must set `source_origin_verified: true`, contain substantive
`origin_evidence` and `rights_holder_or_authority_basis`, set
`rights_review_status: "reviewed"`, `notice_disposition_status: "resolved"`,
and `redistribution_decision: "approved_for_redistribution"`, and contain a
nonempty attribution obligation. Its reviewer identity must exactly equal the
approval's top-level `reviewer_identity`; its timestamp must be canonical and
its decision reference non-placeholder. `production_use_approved` and
`release_authority` must both be true. Engineering provenance does not supply
those decisions.

### Four licensing-counsel resolutions

1. `helvetiker-mgopen`: “Does the unmodified Helvetiker JSON satisfy the
   MAGENTA/MgOpen notice, naming, modification and no-standalone-sale conditions
   when distributed inside the site bundle?”
2. `unlicense-jurisdiction`: “Is Unlicense acceptable in every jurisdiction in
   which the foundation distributes the site, including jurisdictions that may
   not recognize public-domain dedication?”
3. `emscripten-musl-runtime`: “Does including the complete Emscripten 1.38.43
   and musl notice corpora fully satisfy any obligations arising from generated
   or linked runtime code inside h3-js?”
4. `h3-notice-scope`: “Does the H3 treatment require any notice beyond the full
   Apache-2.0 licence, H3 NOTICE, and DGGRID attribution recorded here?”

Each resolution needs `resolved: true`, substantive resolution text, counsel's
real identity exactly matching top-level `counsel_reviewer_identity`, a real
canonical timestamp, and a non-placeholder decision reference.

## Public-key and detached-signature input contract

The provisioned registry's ordered `required_roles` list is exactly:

- `asset_rights_reviewer`;
- `licensing_counsel`;
- `release_authorizer`.

The registry may contain more than three authority records, but it needs at
least one valid active authority for every required role. The approval selects
one distinct key per role. Each authority record contains exactly `algorithm`,
`identity`, `key_id`,
`public_key_spki_pem`, `revoked_at`, `role`, `status`, `valid_from`, and
`valid_until`. The algorithm is Ed25519, the key is canonical public SPKI PEM,
and `key_id` is `ed25519:` plus SHA-256 of SPKI DER. Active keys have
`revoked_at: null` and must satisfy
`valid_from <= reviewed_at < valid_until`. Selected registry identities must
exactly match the corresponding approval identities, and the three selected key
IDs are distinct. Private keys never enter the repository.

The approval's `builder_identity`, `reviewer_identity`,
`counsel_reviewer_identity`, and `release_authority_identity` are four distinct,
trimmed, non-placeholder identities of at least five characters; the builder is
therefore distinct from all three signing identities. The approval also requires
`independent: true`.

Each role holder signs these exact UTF-8 bytes offline, preserving the final
newline:

```text
ELU-GLOBE-RUNTIME-APPROVAL-SIGNATURE-V1
repository=earth-love-united/earthloveunited.org
approval_path=data/climate/reviews/globe-runtime-assets-production-review.json
approval_sha256=<raw approval file SHA-256>
trust_registry_path=data/climate/governance/globe-runtime-approval-trust.json
trust_registry_sha256=<raw registry file SHA-256>
reviewed_commit_sha=<Commit A SHA>
role=<asset_rights_reviewer|licensing_counsel|release_authorizer>
```

Only canonical Base64 detached signatures of exactly 64 decoded bytes are
committed, in required-role order.

The bundle envelope contains exactly `schema_version: "1.0.0"`,
`signature_bundle_id:
"elu-globe-runtime-assets-production-review-signatures-v1"`, repository,
approval path/hash, trust-registry path/hash, reviewed commit, and signatures.
Each signature item contains exactly `key_id`, `role`, and `signature_base64`.
The approval's `authority_bindings.key_ids` must map the same three derived IDs
selected by the bundle to the three required roles.

## Deterministic engineering work that remains legitimate

The current strict stack contains candidate-only current-state assertions. A
perfect evidence package cannot pass until these are evolved without weakening
their historical DENY guarantees:

- the exact strict components with current-tree production-file absence
  assertions are CT-16 source routing, CT-17 source rights, CT-42-DATA-R,
  CT-43-FALLBACK, CT-42-CT-40, and CT-42-ROLLBACK;
- the separate CT-15 readiness checker has the same candidate-era issue but is
  not a `climate-truth-ci.js --strict` component;
- the CT-45 notice checker currently requires all five rights rows unresolved,
  an empty trust registry, and absent approval/signatures;
- the runtime-approval checker currently asserts the committed registry is empty
  and both approval artifacts are absent;
- the approval schema and notice integration pin the empty registry and current
  unreviewed integration bytes.

The legitimate transition is mode/version aware:

1. keep immutable candidate artifacts and adversarial DENY fixtures;
2. make candidate mode continue to reject release authority;
3. add an exact prepared/production state that accepts only the canonical package,
   provisioned public trust, exact human approval, and valid detached signatures;
4. add adversarial tests proving candidate and production boundaries cannot be
   crossed;
5. refresh deterministic raw and canonical pins only after genuine inputs exist;
   whenever attested bytes change, obtain a fresh human review instead of
   mechanically repinning an old attestation;
6. replace the duplicated, incomplete readiness/staged reviewed-path lists with
   one canonical release-control scope, include every production transition
   checker/fixture/generator, and add mutations proving any post-Commit-A drift
   in that scope fails both source and staged verification.

Commit A must also make the notice integration truthfully stable across Commit
B. The current integration says the approval artifact and signature bundle are
absent, while its checker compares actual presence. The prepared-state design
must allow the two excluded authorization files to appear in Commit B without
changing the Commit-A-bound integration bytes or weakening their exact checks.

Removing absence checks or replacing them with shape-only checks is prohibited.

No real production package generator exists. A deterministic compiler must be
implemented to consume reviewed human inputs and regenerate the five downstream
artifacts in canonical order. The fictional temporary fixture builder in
`tools/check-reviewed-climate-release.js` must never seed production evidence,
identities, decisions, timestamps, or signatures.

## Human action register

| Action ID | Required human action | Deliverable | Blocks |
|---|---|---|---|
| `H-01` | Maintainer chooses true-merge/fast-forward release strategy and decides whether to restore the exact PR #58 ancestry or commission fresh merged-main UI/rollback reviews | Written merge decision; if review is chosen, real review artifacts | Strict CI; cryptographic binding |
| `H-02` | Maintainer names the real people/organizations filling every independent review role and confirms allowed role combinations | Public identity roster and independence mapping | All reviewed evidence/package work |
| `H-03` | Document acquirers and independent source-identity reviewers complete the exact 20-country, 3-role corpus | Exact artifacts, checksums, locators, acquisition records, review IDs/times | Top-20 blocker |
| `H-04` | Authorized rights reviewers decide redistribution and scoring for every used source using the five immutable CT-17 packets as review scopes | Separate completed decision artifacts and references; do not fill or convert the CT-17 packet snapshots; decisions may legitimately be narrow or deny | Licence and ALLOW blockers |
| `H-05` | Independent field-level climate reviewers review the 2,060 current facts and every added fact; independent profile reviewers review compiled profiles | Fact-review and profile-review records | Field review, profile, and ALLOW blockers |
| `H-06` | Independent CT-40 release reviewer reviews the complete candidate | Review identity, time, scope, findings, and allow/deny decision | Independent release review and ALLOW |
| `H-07` | Independent runtime, release-diff, and rollback reviewers review exact bytes and executable proof | Runtime/diff/rollback review records and references | Canonical package, rollback, strict CI |
| `H-08` | Asset-rights reviewer decides the five exact CT-45 rows | Five substantive dispositions with references and times | Exact runtime-asset approval |
| `H-09` | Licensing counsel resolves the four exact questions | Four substantive counsel resolutions with references and times | Exact runtime-asset approval |
| `H-10` | Each actual role holder supplies an intentionally public identity, canonical public Ed25519 SPKI PEM, and validity window; maintainer/CODEOWNER verifies derived key IDs and commits public records only | Valid registry with at least one active authority per role; no private material | Trust provisioning and signing |
| `H-11` | Release authorizer reviews exact Commit A and the final approval | Exact approval decision and review time | Release authority |
| `H-12` | Three role holders sign exact messages offline after Commit A and approval hash exist | Three detached Base64 signatures only; no private material | Signature and exact-approval blockers |

## Core release verification chain

Run from a clean checkout only, without hand-editing `_deploy/`:

```bash
node tools/check-reviewed-climate-release.js
node tools/check-globe-runtime-assets.js
node tools/check-globe-third-party-notices.js
node tools/check-globe-runtime-approval.js
node tools/check-climate-production-readiness-policy.js
node tools/check-staged-production-integrity.js --self-test
node tools/climate-truth-ci.js --strict
node tools/check-climate-production-readiness.js --release
./tools/build-deploy.sh --release
```

The complete GitHub run additionally includes the policy and boundary controls,
including:

```bash
node tools/check-climate-truth-ci.js
node tools/check-climate-runtime-diff-boundary.js --self-test
node tools/check-public-deploy-surface.js --self-test
```

CI also runs the real runtime-diff boundary with the PR base/head SHAs and the
headless SmokeTest/StackLint job against the candidate staging surface.

Success is legitimate only when readiness reports `release_ready`, strict CI
reports PASS with no missing components, the release build finishes from a clean
tree, GitHub CI is green, Commit A remains an ancestor of main, and all detached
signatures verify. Live Cloudflare verification happens only after authorized
merge and must compare the deployed asset epochs and raw response digests to the
exact approved staged bytes.
