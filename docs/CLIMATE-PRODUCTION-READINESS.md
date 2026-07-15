# Climate production readiness

The climate globe uses two separate readiness modes. Passing candidate mode
does not authorize a production release.

## Notice and asset-rights boundary

Inventory integrity is not rights approval. The notice checker proves that
the readable `THIRD_PARTY_NOTICES.txt`, machine inventory, integration record,
future approval schema, and protected approval-trust registry are regular
non-symlink files with exact pinned hashes. The deploy builder repeats those
checks against the final staged copy.
A checker `PASS` is byte and control-plane evidence only; it grants no
redistribution, production-use, legal, deploy, or release authority.

The immutable inventory core says deployment and public UI were not changed by
the earlier inventory-only mission. Those booleans are historical inventory-only
properties, not claims about this later integration. The separate integration
record truthfully records the deploy copy, public footer link, CI controls, and
readiness changes while keeping approval absent.

Candidate mode requires five asset-specific rights dispositions: one for the
Natural Earth geometry and one for each of the four visual assets. All five remain
`not_reviewed`, with null redistribution and notice decisions and false
production/release authority. The four vendor counsel questions also remain
unresolved. No production approval or detached signature artifact exists in the
repository.

The protected registry at
`data/climate/governance/globe-runtime-approval-trust.json` is truthfully
`unprovisioned`: it contains no public keys and grants no authority. A future
maintainer-reviewed provisioning change must add real Ed25519 public keys for
exactly three roles—`asset_rights_reviewer`, `licensing_counsel`, and
`release_authorizer`—and update the protected registry hash in policy. Private
keys never belong in the repository.

After those real humans complete the review, each role signs the exact
domain-separated `ELU-GLOBE-RUNTIME-APPROVAL-SIGNATURE-V1` message. That message
binds the repository, approval path and SHA-256, trust-registry path and
SHA-256, reviewed commit SHA, and signer role, including its final newline. The
three signatures go in
`data/climate/reviews/globe-runtime-assets-production-review.signatures.json`;
the approval binds the same three derived Ed25519 key IDs. The verifier rejects
missing, duplicate, expired, revoked, wrong-role, noncanonical, replayed, or
cryptographically invalid signatures.

Each signer signs these exact UTF-8 bytes, substituting the pinned values and
retaining the final newline after `role=...`:

```text
ELU-GLOBE-RUNTIME-APPROVAL-SIGNATURE-V1
repository=earth-love-united/earthloveunited.org
approval_path=data/climate/reviews/globe-runtime-assets-production-review.json
approval_sha256=<64 lowercase hex>
trust_registry_path=data/climate/governance/globe-runtime-approval-trust.json
trust_registry_sha256=<64 lowercase hex>
reviewed_commit_sha=<40 lowercase hex>
role=<asset_rights_reviewer|licensing_counsel|release_authorizer>
```

Safe future sequence:

1. provision only real public keys and identities through maintainer review;
2. update every protected registry/schema/integration pin and complete the
   exact commit-bound approval without committing private material;
3. have each role sign the documented message offline and commit only the
   detached bundle;
4. run the approval checker, readiness policy, source notice/CT-45 checks, and
   a clean `build-deploy.sh --release`; never bypass a failed gate or hand-edit
   staged output.

## Candidate integrity

Run:

```bash
node tools/check-climate-production-readiness.js --candidate
```

This mode must prove all of the following:

- independent CT-42 data and UI reviews pass;
- public-copy, canonical source-link, JavaScript syntax, and load-order checks
  pass;
- the real CT-40 evaluation remains `deny` and has canonical reasons;
- the top-20 primary-source queue covers 20 entities and authorizes zero;
- the evidence/licensing work package remains blocked and points to a separate
  future reviewed-candidate compiler;
- no runtime manifest, reviewed release diff, or CT-40 allow manifest exists;
- partial climate truth CI is incomplete only for the two prohibited release
  artifacts;
- CT-45 localized globe bytes, runtime URL coupling, pre-render validation,
  fallback behavior, and staged-copy integrity pass while the asset manifest
  continues to say rights/notices `not_reviewed`, production use `false`, and
  release authority `false`;
- the source notice checker passes, the empty registry retains its exact pin,
  the future approval and signature bundle remain absent, and the exact five
  current rights rows remain unresolved.

The successful status is
`candidate_integrity_ready_release_blocked`.

## Production release

Run:

```bash
node tools/check-climate-production-readiness.js --release
```

This mode fails closed unless every item below is true:

- CT-40 returns an authentic `allow` with release authority;
- top-20 primary-source review is complete;
- explicit redistribution and scoring licence decisions are complete;
- required field-level fact reviews are complete;
- an independent CT-40 release review passes;
- reviewed runtime manifest, release diff, and allow manifest exist;
- a separately reviewed executable production rollback proof exists at
  `data/climate/releases/reviewed-rollback-proof.json`;
- strict climate truth CI passes with no missing components;
- CT-45 passes and a separate independent exact-digest runtime-asset review
  approves the visual-asset rights, confirms the complete deployed third-party notice
  inventory, and explicitly grants production use and release authority;
- the exact v2 approval is a regular file tied to the reviewed commit and pins
  the CT-45 manifest, readable notice, machine inventory, and integration
  record. It must contain all five non-blanket approved asset rows, four
  resolved counsel rows, valid decision references/timestamps, and distinct
  non-placeholder builder, asset-rights reviewer, counsel reviewer, and release
  authorizer identities;
- the protected registry is provisioned and the exact detached bundle verifies
  one distinct Ed25519 signature for each required role at `reviewed_at`.

The only successful production status is `release_ready`.

`./tools/build-deploy.sh --candidate` stages a local candidate. Its final
executable command is `tools/check-staged-production-integrity.js`, which reruns
CT-45 and notice verification, then rehashes the four notice artifacts, trust
registry, exact footer, and any approval/signature pair after every copy and
earlier check. Candidate output remains non-public.
`./tools/build-deploy.sh --release` (also inferred for
`CF_PAGES_BRANCH=main`) runs this production gate before staging and currently
refuses. CT-45 establishes reproducible bytes; it does not grant texture
rights, complete third-party notices, legal approval, deploy authority, or
release authority. No public candidate preview should redistribute the vendor
or textures until the pinned readable and machine third-party notices are
deployed and independently reviewed.

## Current result

The current factual base remains fail closed. Production mode is blocked by the
unprovisioned registry, absent human approval/signatures, and the wider climate
release requirements. Any UI/control change must receive a fresh independent
candidate review before candidate integrity can pass. The gate must not be
weakened to make the release appear ready; evidence and independent decisions
must be added instead.
