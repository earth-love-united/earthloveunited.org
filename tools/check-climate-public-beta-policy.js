#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const policyEngine = require('./lib/climate-public-beta-policy');
const { canonicalJsonText, parseJsonNoDuplicateKeys } = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = path.join(ROOT, 'tools/fixtures/climate-public-beta-policy.json');
const SCHEMA_PATHS = [
  'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap-signatures.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-policy.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-trust-registry.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-approval.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-evidence-signature-bundle.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-signature-bundle.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-signed-evidence.schema.json',
];
const RELEASE_ID_SCHEMA_PATHS = [
  'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap-signatures.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-approval.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-evidence-signature-bundle.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-release-diff.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-rollback-proof.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-runtime-manifest.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-scope-manifest.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-signature-bundle.schema.json',
  'data/climate/public-beta/schemas/climate-public-beta-signed-evidence.schema.json',
  'data/climate/schemas/public-beta-reviewed-correction-log.schema.json',
  'data/climate/schemas/public-beta-reviewed-country-factual.schema.json',
  'data/climate/schemas/public-beta-reviewed-country-identity-transform.schema.json',
  'data/climate/schemas/public-beta-reviewed-country-identity.schema.json',
  'data/climate/schemas/public-beta-reviewed-fact-lineage.schema.json',
  'data/climate/schemas/public-beta-reviewed-known-limitations.schema.json',
];
const CANONICAL_RELEASE_ID_PATTERN = '^(?!.*\\.\\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$';
const RELEASE_ID = 'elu-beta-fixture-v1';
const COMMITS = Object.freeze({ package: 'a'.repeat(40), l1: 'b'.repeat(40), l2: 'c'.repeat(40) });
const SCOPE_SHA = policyEngine.sha256('ephemeral-beta-scope');
const SURFACE_SHA = policyEngine.sha256('ephemeral-beta-surface');
const ANCHOR_MS = Date.UTC(2040, 0, 2, 12, 0, 0, 0);

function at(seconds) { return new Date(ANCHOR_MS + seconds * 1000).toISOString(); }
function jsonText(value) { return canonicalJsonText(value); }
function clone(value) { return structuredClone(value); }
function signatureBitflip(value) {
  const bytes = Buffer.from(value, 'base64');
  bytes[0] ^= 1;
  return bytes.toString('base64');
}

function makePolicy() {
  return {
    schema_version: policyEngine.POLICY_VERSION,
    policy_id: 'elu-climate-public-beta-policy-v1',
    status: 'frozen',
    repository: policyEngine.REPOSITORY,
    product_tier: 'climate_public_beta',
    assessed_production_authority: false,
    publication_levels: [...policyEngine.PUBLICATION_LEVELS],
    release_states: [...policyEngine.RELEASE_STATES],
    required_roles: [...policyEngine.REQUIRED_ROLES],
    required_review_roles: [...policyEngine.REQUIRED_REVIEW_ROLES],
    remote_evidence_roles: [...policyEngine.REMOTE_EVIDENCE_ROLES],
    approval_role: policyEngine.APPROVAL_ROLE,
    approved_origins: {
      invited_beta: 'https://invited-beta.invalid',
      public_beta: 'https://public-beta.invalid',
    },
    approved_aliases: {
      invited_beta: [
        'https://elu-beta-policy-self-test.pages.dev',
        'https://invited-beta-alias.invalid',
        'https://invited-beta.invalid',
      ],
      public_beta: [
        'https://elu-beta-policy-self-test.pages.dev',
        'https://public-beta-alias.invalid',
        'https://public-beta.invalid',
      ],
    },
    hosting_project: {
      provider: 'cloudflare_pages',
      project_id: 'elu-beta-policy-self-test',
      production_branch: 'main',
      access_scope: 'project_wide_all_deployments',
      access_policy_reference: 'urn:elu:ephemeral:cloudflare-access-policy',
      pages_dev_origin: 'https://elu-beta-policy-self-test.pages.dev',
      deployment_alias_hostname_suffix: '.elu-beta-policy-self-test.pages.dev',
      holding_content_sha256: policyEngine.sha256('ephemeral-access-locked-holding-page'),
      deployment_replacement_lock_required: true,
    },
    frozen_thresholds: {
      invited_reviewer_minimum: 2,
      invited_session_minimum: 2,
      accessibility_session_minimum: 1,
      monitoring_window_seconds: 3600,
      remote_probe_interval_seconds: 300,
      rollback_response_target_seconds: 900,
      approval_validity_max_seconds: 172800,
      authorized_access_test_count: 2,
      unauthorized_access_test_count: 2,
    },
    unauthorized_access_policy: {
      allowed_statuses: [302, 401, 403],
      allowed_redirect_origins: ['https://access.invalid'],
    },
    production_baseline_origin: 'https://production-baseline.invalid',
    production_baseline_inventory_sha256: policyEngine.sha256('ephemeral-production-baseline-inventory'),
    rollback_target: {
      type: 'project_access_lock',
      reference: 'urn:elu:ephemeral:rollback-target',
    },
    governance_contracts: {
      review_protocol_path: 'data/climate/public-beta/governance/review-protocol.json',
      review_protocol_sha256: policyEngine.sha256('ephemeral review protocol'),
      feedback_privacy_contract_path: 'data/climate/public-beta/governance/feedback-privacy-contract.json',
      feedback_privacy_contract_sha256: policyEngine.sha256('ephemeral feedback privacy contract'),
    },
    independence_rules: {
      data_builder_differs_from_data_reviewer: true,
      rights_preparer_differs_from_rights_reviewer: true,
      ui_builder_differs_from_ui_accessibility_reviewer: true,
      diff_builder_differs_from_package_reviewer: true,
      rollback_builder_differs_from_rollback_reviewer: true,
      release_builder_differs_from_release_authorizer: true,
    },
    no_assessment_contract: {
      assessed_production_authority: false,
      official_inventory_claims: false,
      target_or_commitment_claims: false,
      performance_or_normative_claims: false,
    },
    decision_reference: 'urn:elu:ephemeral:policy-decision',
  };
}

function makeTrust() {
  const generated = policyEngine.REQUIRED_ROLES.map(role => {
    const pair = crypto.generateKeyPairSync('ed25519');
    const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
    const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
    return {
      role,
      identity: 'urn:elu:ephemeral:' + role,
      privateKey: pair.privateKey,
      authority: {
        algorithm: 'Ed25519',
        identity: 'urn:elu:ephemeral:' + role,
        key_id: 'ed25519:' + policyEngine.sha256(publicDer),
        public_key_spki_pem: publicPem,
        revoked_at: null,
        role,
        status: 'active',
        valid_from: at(-86400),
        valid_until: at(86400 * 30),
      },
    };
  });
  return {
    generated,
    registry: {
      schema_version: policyEngine.POLICY_VERSION,
      registry_id: 'elu-climate-public-beta-trust-v1',
      status: 'provisioned',
      repository: policyEngine.REPOSITORY,
      required_roles: [...policyEngine.REQUIRED_ROLES],
      authorities: generated.map(item => item.authority),
    },
  };
}

function keyFor(state, role) { return state.generated.find(item => item.role === role); }

function makeEvidence(state, kind, bindings) {
  const config = policyEngine.EVIDENCE_CONFIG[kind];
  const producer = config.roles.length === 1
    ? 'urn:elu:ephemeral:producer:' + kind
    : keyFor(state, 'beta_release_operator').identity;
  const reviewer = config.roles.length === 1
    ? keyFor(state, config.roles[0]).identity
    : keyFor(state, 'beta_rollback_reviewer').identity;
  const evidence = {
    schema_version: policyEngine.POLICY_VERSION,
    evidence_id: 'elu-beta-fixture-' + kind,
    evidence_kind: kind,
    repository: policyEngine.REPOSITORY,
    beta_release_id: RELEASE_ID,
    publication_level: config.level,
    intended_origin: bindings.intended_origin ?? null,
    intended_aliases: bindings.intended_aliases ?? null,
    reviewed_commit_sha: bindings.reviewed_commit_sha ?? null,
    canonical_scope_sha256: bindings.canonical_scope_sha256 ?? null,
    expected_public_surface_manifest_sha256: bindings.expected_public_surface_manifest_sha256 ?? null,
    approval_sha256: bindings.approval_sha256 ?? null,
    prior_evidence_sha256: bindings.prior_evidence_sha256 ?? null,
    observed_at: at(bindings.observed_offset ?? 0),
    observation: config.observation,
    result: 'pass',
    producer_identity: producer,
    reviewer_identity: reviewer,
    reviewed_artifacts: bindings.reviewed_artifacts ?? null,
    remote_index_sha256: bindings.remote_index_sha256 ?? null,
    rollback_subset_sha256: bindings.rollback_subset_sha256 ?? null,
    production_baseline_origin: bindings.production_baseline_origin ?? null,
    production_baseline_inventory_sha256: bindings.production_baseline_inventory_sha256 ?? null,
    assessed_production_authority: false,
  };
  const evidenceText = jsonText(evidence);
  const evidenceSha = policyEngine.sha256(evidenceText);
  const signedAt = at((bindings.observed_offset ?? 0) + 1);
  const signatures = config.roles.map(role => {
    const signer = keyFor(state, role);
    const message = policyEngine.evidenceSignatureMessage({
      repository: policyEngine.REPOSITORY,
      beta_release_id: RELEASE_ID,
      evidence_id: evidence.evidence_id,
      evidence_kind: kind,
      evidence_sha256: evidenceSha,
      signed_at: signedAt,
      role,
      identity: signer.identity,
      key_id: signer.authority.key_id,
    });
    return {
      role,
      identity: signer.identity,
      key_id: signer.authority.key_id,
      signature_base64: crypto.sign(null, Buffer.from(message, 'utf8'), signer.privateKey).toString('base64'),
    };
  });
  const signatureBundle = {
    schema_version: policyEngine.POLICY_VERSION,
    signature_bundle_id: 'elu-climate-public-beta-' + evidence.evidence_id + '-signatures-v1',
    domain: policyEngine.EVIDENCE_SIGNATURE_DOMAIN,
    repository: policyEngine.REPOSITORY,
    beta_release_id: RELEASE_ID,
    evidence_id: evidence.evidence_id,
    evidence_kind: kind,
    evidence_sha256: evidenceSha,
    signed_at: signedAt,
    signatures,
  };
  return {
    evidence,
    evidence_text: evidenceText,
    evidence_file_regular: true,
    signature_bundle: signatureBundle,
    signature_bundle_text: jsonText(signatureBundle),
    signature_bundle_file_regular: true,
  };
}

function makeApproval(state, level, reviewedCommit, nested) {
  const policy = state.policy;
  const signer = keyFor(state, policyEngine.APPROVAL_ROLE);
  const trustText = jsonText(state.registry);
  const trustSha = policyEngine.sha256(trustText);
  const approval = {
    schema_version: policyEngine.POLICY_VERSION,
    approval_id: 'elu-climate-public-beta-' + RELEASE_ID + '-' + level + '-approval-v1',
    repository: policyEngine.REPOSITORY,
    beta_release_id: RELEASE_ID,
    decision: 'approve',
    publication_level: level,
    intended_origin: policy.approved_origins[level],
    intended_aliases: policy.approved_aliases[level],
    reviewed_commit_sha: reviewedCommit,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    approved_at: at(0),
    valid_from: at(-3600),
    valid_until: at(86400),
    revocation_reference: 'urn:elu:ephemeral:revocation:' + level,
    revoked_at: null,
    authority_role: policyEngine.APPROVAL_ROLE,
    authorizer_identity: signer.identity,
    key_id: signer.authority.key_id,
    decision_reference: 'urn:elu:ephemeral:decision:' + level,
    trust_registry_path: policyEngine.TRUST_REGISTRY_PATH,
    trust_registry_sha256: trustSha,
    prior_l1_approval: nested?.prior_l1_approval ?? null,
    invited_evidence_index: nested?.invited_evidence_index ?? null,
    assessed_production_authority: false,
  };
  const approvalText = jsonText(approval);
  const approvalSha = policyEngine.sha256(approvalText);
  const approvalPath = policyEngine.approvalPath(RELEASE_ID, level);
  const message = policyEngine.approvalSignatureMessage({
    repository: policyEngine.REPOSITORY,
    beta_release_id: RELEASE_ID,
    publication_level: level,
    approval_path: approvalPath,
    approval_sha256: approvalSha,
    trust_registry_path: policyEngine.TRUST_REGISTRY_PATH,
    trust_registry_sha256: trustSha,
    reviewed_commit_sha: reviewedCommit,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    intended_origin: policy.approved_origins[level],
    intended_aliases: policy.approved_aliases[level],
    role: policyEngine.APPROVAL_ROLE,
    identity: signer.identity,
    key_id: signer.authority.key_id,
  });
  const signatureBundle = {
    schema_version: policyEngine.POLICY_VERSION,
    signature_bundle_id: 'elu-climate-public-beta-' + RELEASE_ID + '-' + level + '-approval-signatures-v1',
    domain: policyEngine.SIGNATURE_DOMAIN,
    repository: policyEngine.REPOSITORY,
    beta_release_id: RELEASE_ID,
    publication_level: level,
    approval_path: approvalPath,
    approval_sha256: approvalSha,
    trust_registry_path: policyEngine.TRUST_REGISTRY_PATH,
    trust_registry_sha256: trustSha,
    reviewed_commit_sha: reviewedCommit,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    intended_origin: policy.approved_origins[level],
    intended_aliases: policy.approved_aliases[level],
    signatures: [{
      role: policyEngine.APPROVAL_ROLE,
      identity: signer.identity,
      key_id: signer.authority.key_id,
      signature_base64: crypto.sign(null, Buffer.from(message, 'utf8'), signer.privateKey).toString('base64'),
    }],
  };
  return {
    approval,
    approval_text: approvalText,
    approval_file_regular: true,
    signature_bundle: signatureBundle,
    signature_bundle_text: jsonText(signatureBundle),
    signature_bundle_file_regular: true,
  };
}

function makeFullBaseline() {
  const trustState = makeTrust();
  const policy = makePolicy();
  const state = Object.assign({ policy }, trustState);
  const policyText = jsonText(policy);
  const trustText = jsonText(state.registry);
  const runtimeRoot = 'data/climate/public-beta/runtime/releases/' + RELEASE_ID;
  const reviewedRuntime = [
    runtimeRoot + '/country-factual.json',
    runtimeRoot + '/country-identity.json',
    runtimeRoot + '/country-identity.SOURCE.md',
    runtimeRoot + '/country-identity-transform.json',
    runtimeRoot + '/fact-lineage.json',
    runtimeRoot + '/known-limitations.json',
    runtimeRoot + '/correction-log.json',
  ];
  const reviewProposal = 'private-review/climate-public-beta/' + RELEASE_ID + '/review-proposal.json';
  const reviewPins = {
    beta_data_reviewer: reviewedRuntime.concat([
      'external-sources/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv',
      'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json',
      reviewProposal,
    ]),
    beta_rights_reviewer: reviewedRuntime.concat([
      'climate-public-beta/THIRD_PARTY_NOTICES.txt',
      'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt',
      'data/climate/source-registry.json',
      'external-sources/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv',
      reviewProposal,
    ]),
    beta_ui_accessibility_reviewer: [
      'climate-public-beta/_headers',
      'climate-public-beta/css/beta.css',
      'climate-public-beta/index.html',
      'climate-public-beta/js/beta.js',
      'climate-public-beta/THIRD_PARTY_NOTICES.txt',
      'data/climate/public-beta/runtime/runtime-manifest.json',
    ],
    beta_package_reviewer: [
      'data/climate/public-beta/governance/public-surface-manifest.json',
      'data/climate/public-beta/governance/releases/' + RELEASE_ID + '/release-diff.json',
      'data/climate/public-beta/runtime/runtime-manifest.json',
      'data/climate/public-beta/governance/policy.json',
      'data/climate/public-beta/governance/approval-trust.json',
      'tools/check-climate-public-beta-package.js',
      'tools/check-climate-public-beta-readiness.js',
      'tools/check-climate-public-beta-reviewed-data.js',
      'tools/check-climate-public-beta-surface.js',
      'tools/lib/climate-public-beta-package.js',
      'tools/lib/climate-public-beta-policy.js',
      'tools/lib/climate-public-beta-reviewed-data.js',
      'tools/lib/climate-public-beta-surface.js',
    ],
    beta_rollback_reviewer: [
      'data/climate/public-beta/governance/releases/' + RELEASE_ID + '/rollback-proof.json',
      'tools/build-climate-public-beta.sh',
      'tools/check-climate-public-beta-package.js',
      'tools/check-climate-public-beta-surface.js',
      'tools/check-staged-climate-public-beta-integrity.js',
      'tools/lib/climate-public-beta-package.js',
      'tools/lib/climate-public-beta-surface.js',
    ],
  };
  Object.keys(reviewPins).forEach(role => {
    reviewPins[role] = reviewPins[role].sort().map(itemPath => ({
      path: itemPath,
      sha256: policyEngine.sha256('ephemeral-pin:' + itemPath),
    }));
  });
  const remoteKinds = [
    'l1_remote_preflight', 'l1_invited_evidence_index', 'l2_remote_preflight',
    'public_activation', 'live_monitoring',
  ];
  const remoteContexts = Object.fromEntries(remoteKinds.map(kind => {
    const remoteIndexSha = policyEngine.sha256('ephemeral-remote-index:' + kind);
    const rollbackSubsetSha = policyEngine.sha256('ephemeral-rollback-subset:' + kind);
    const reviewedArtifacts = [
      { path: 'private-evidence/' + kind + '/beta-run-artifact-index.json', sha256: remoteIndexSha },
      { path: 'private-evidence/' + kind + '/rollback-access-withdrawal-subset.json', sha256: rollbackSubsetSha },
    ].sort((left, right) => left.path.localeCompare(right.path));
    return [kind, {
      remote_index_sha256: remoteIndexSha,
      rollback_subset_sha256: rollbackSubsetSha,
      reviewed_artifacts: reviewedArtifacts,
      production_baseline_origin: policy.production_baseline_origin,
      production_baseline_inventory_sha256: policy.production_baseline_inventory_sha256,
    }];
  }));
  const reviewEvidence = Object.fromEntries(policyEngine.REQUIRED_REVIEW_ROLES.map(role => [
    role,
    makeEvidence(state, {
      beta_data_reviewer: 'data_review',
      beta_rights_reviewer: 'rights_review',
      beta_ui_accessibility_reviewer: 'ui_accessibility_review',
      beta_package_reviewer: 'package_review',
      beta_rollback_reviewer: 'rollback_review',
    }[role], { reviewed_artifacts: reviewPins[role] }),
  ]));
  const l1Approval = makeApproval(state, 'invited_beta', COMMITS.package);
  const l1ApprovalSha = policyEngine.sha256(l1Approval.approval_text);
  const l1Preflight = makeEvidence(state, 'l1_remote_preflight', Object.assign({
    intended_origin: policy.approved_origins.invited_beta,
    intended_aliases: policy.approved_aliases.invited_beta,
    reviewed_commit_sha: COMMITS.l1,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    approval_sha256: l1ApprovalSha,
  }, remoteContexts.l1_remote_preflight));
  const l1PreflightSha = policyEngine.sha256(l1Preflight.evidence_text);
  const invitedEvidence = makeEvidence(state, 'l1_invited_evidence_index', Object.assign({
    intended_origin: policy.approved_origins.invited_beta,
    intended_aliases: policy.approved_aliases.invited_beta,
    reviewed_commit_sha: COMMITS.l1,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    approval_sha256: l1ApprovalSha,
    prior_evidence_sha256: l1PreflightSha,
  }, remoteContexts.l1_invited_evidence_index));
  const priorL1 = {
    approval_path: policyEngine.approvalPath(RELEASE_ID, 'invited_beta'),
    approval_sha256: l1ApprovalSha,
    signature_bundle_path: policyEngine.signatureBundlePath(RELEASE_ID, 'invited_beta'),
    signature_bundle_sha256: policyEngine.sha256(l1Approval.signature_bundle_text),
    approval_commit_sha: COMMITS.l1,
  };
  const invitedIndex = {
    evidence_id: invitedEvidence.evidence.evidence_id,
    evidence_sha256: policyEngine.sha256(invitedEvidence.evidence_text),
    signature_bundle_sha256: policyEngine.sha256(invitedEvidence.signature_bundle_text),
  };
  const l2Approval = makeApproval(state, 'public_beta', COMMITS.l1, {
    prior_l1_approval: priorL1,
    invited_evidence_index: invitedIndex,
  });
  const l2ApprovalSha = policyEngine.sha256(l2Approval.approval_text);
  const l2Preflight = makeEvidence(state, 'l2_remote_preflight', Object.assign({
    intended_origin: policy.approved_origins.public_beta,
    intended_aliases: policy.approved_aliases.public_beta,
    reviewed_commit_sha: COMMITS.l2,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    approval_sha256: l2ApprovalSha,
    prior_evidence_sha256: invitedIndex.evidence_sha256,
  }, remoteContexts.l2_remote_preflight));
  const activation = makeEvidence(state, 'public_activation', Object.assign({
    intended_origin: policy.approved_origins.public_beta,
    intended_aliases: policy.approved_aliases.public_beta,
    reviewed_commit_sha: COMMITS.l2,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    approval_sha256: l2ApprovalSha,
    prior_evidence_sha256: policyEngine.sha256(l2Preflight.evidence_text),
  }, remoteContexts.public_activation));
  const monitoring = makeEvidence(state, 'live_monitoring', Object.assign({
    intended_origin: policy.approved_origins.public_beta,
    intended_aliases: policy.approved_aliases.public_beta,
    reviewed_commit_sha: COMMITS.l2,
    canonical_scope_sha256: SCOPE_SHA,
    expected_public_surface_manifest_sha256: SURFACE_SHA,
    approval_sha256: l2ApprovalSha,
    prior_evidence_sha256: policyEngine.sha256(activation.evidence_text),
  }, remoteContexts.live_monitoring));
  const assessedProbeSha = policyEngine.sha256('ephemeral-assessed-probe');
  const input = {
    verification_time: at(100),
    policy,
    policy_text: policyText,
    policy_file_regular: true,
    trust_registry: state.registry,
    trust_registry_text: trustText,
    trust_registry_file_regular: true,
    package: {
      repository: policyEngine.REPOSITORY,
      beta_release_id: RELEASE_ID,
      package_commit_sha: COMMITS.package,
      current_commit_sha: COMMITS.l2,
      canonical_scope_sha256: SCOPE_SHA,
      recomputed_scope_sha256: SCOPE_SHA,
      expected_public_surface_manifest_sha256: SURFACE_SHA,
      recomputed_expected_public_surface_manifest_sha256: SURFACE_SHA,
      policy_sha256: policyEngine.sha256(policyText),
      trust_registry_sha256: policyEngine.sha256(trustText),
      deterministic_package_checks_passed: true,
      required_artifacts_present: true,
      public_surface_boundary_passed: true,
      package_commit_ancestor_of_current: true,
      bound_package_paths_unchanged: true,
      candidate_artifacts_absent: true,
      governance_excluded_from_staged_surface: true,
      assessed_production_authority: false,
      release_builder_identity: 'urn:elu:ephemeral:release-builder',
    },
    package_review_evidence: reviewEvidence,
    package_review_artifact_pins: reviewPins,
    remote_evidence_bindings: Object.fromEntries(remoteKinds.map(kind => [kind, {
      remote_index_sha256: remoteContexts[kind].remote_index_sha256,
      rollback_subset_sha256: remoteContexts[kind].rollback_subset_sha256,
    }])),
    remote_evidence_artifact_pins: Object.fromEntries(remoteKinds.map(kind => [kind,
      remoteContexts[kind].reviewed_artifacts])),
    assessed_boundary: {
      schema_version: policyEngine.POLICY_VERSION,
      selected_state: 'candidate_or_incomplete',
      baseline_id: 'elu-assessed-boundary-ephemeral-baseline',
      expected_probe_sha256: assessedProbeSha,
      observed_probe_sha256: assessedProbeSha,
      production_readiness_status: 'blocked',
      strict_truth_status: 'fail',
      beta_paths_counted_as_assessed_inputs: false,
      assessed_gate_semantics_unchanged: true,
      assessed_production_authority_from_beta: false,
    },
    approvals: { invited_beta: l1Approval, public_beta: l2Approval },
    commit_lineage: {
      l1_approval_commit_sha: COMMITS.l1,
      l1_approval_commit_ancestor_of_current: true,
      l1_bound_bytes_unchanged: true,
      l2_approval_commit_sha: COMMITS.l2,
      l2_approval_commit_ancestor_of_current: true,
      l2_bound_bytes_unchanged: true,
    },
    remote_evidence: {
      l1_remote_preflight: l1Preflight,
      l1_invited_evidence_index: invitedEvidence,
      l2_remote_preflight: l2Preflight,
      public_activation: activation,
      live_monitoring: monitoring,
    },
  };
  return { input, generated: state.generated };
}

function baseline(name) {
  const state = makeFullBaseline();
  const input = state.input;
  if (name === 'package') {
    input.package.current_commit_sha = COMMITS.package;
    input.approvals = { invited_beta: null, public_beta: null };
    input.commit_lineage = {
      l1_approval_commit_sha: null, l1_approval_commit_ancestor_of_current: false,
      l1_bound_bytes_unchanged: false, l2_approval_commit_sha: null,
      l2_approval_commit_ancestor_of_current: false, l2_bound_bytes_unchanged: false,
    };
    input.remote_evidence = {
      l1_remote_preflight: null, l1_invited_evidence_index: null,
      l2_remote_preflight: null, public_activation: null, live_monitoring: null,
    };
  } else if (name === 'shareable_l1') {
    input.package.current_commit_sha = COMMITS.l1;
    input.approvals.public_beta = null;
    input.commit_lineage.l2_approval_commit_sha = null;
    input.commit_lineage.l2_approval_commit_ancestor_of_current = false;
    input.commit_lineage.l2_bound_bytes_unchanged = false;
    input.remote_evidence.l1_invited_evidence_index = null;
    input.remote_evidence.l2_remote_preflight = null;
    input.remote_evidence.public_activation = null;
    input.remote_evidence.live_monitoring = null;
  } else if (name === 'authorized') {
    input.remote_evidence.public_activation = null;
    input.remote_evidence.live_monitoring = null;
  } else if (name === 'live') {
    input.remote_evidence.live_monitoring = null;
  } else if (name !== 'verified') {
    throw new Error('unknown baseline ' + name);
  }
  return state;
}

function refreshApproval(wrapper) { wrapper.approval_text = jsonText(wrapper.approval); }
function refreshEvidence(wrapper) { wrapper.evidence_text = jsonText(wrapper.evidence); }
function refreshEvidenceBundle(wrapper) { wrapper.signature_bundle_text = jsonText(wrapper.signature_bundle); }
function refreshTrust(state) {
  state.input.trust_registry_text = jsonText(state.input.trust_registry);
  state.input.package.trust_registry_sha256 = policyEngine.sha256(state.input.trust_registry_text);
}

function resignApprovalRawText(state, level, approvalText) {
  const item = state.input.approvals[level];
  const approval = item.approval;
  const signer = keyFor(state, policyEngine.APPROVAL_ROLE);
  const approvalSha = policyEngine.sha256(approvalText);
  const message = policyEngine.approvalSignatureMessage({
    repository: policyEngine.REPOSITORY,
    beta_release_id: approval.beta_release_id,
    publication_level: level,
    approval_path: policyEngine.approvalPath(approval.beta_release_id, level),
    approval_sha256: approvalSha,
    trust_registry_path: policyEngine.TRUST_REGISTRY_PATH,
    trust_registry_sha256: approval.trust_registry_sha256,
    reviewed_commit_sha: approval.reviewed_commit_sha,
    canonical_scope_sha256: approval.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: approval.expected_public_surface_manifest_sha256,
    intended_origin: approval.intended_origin,
    intended_aliases: approval.intended_aliases,
    role: policyEngine.APPROVAL_ROLE,
    identity: signer.identity,
    key_id: signer.authority.key_id,
  });
  item.approval_text = approvalText;
  item.signature_bundle.approval_sha256 = approvalSha;
  item.signature_bundle.signatures[0].signature_base64 =
    crypto.sign(null, Buffer.from(message, 'utf8'), signer.privateKey).toString('base64');
  item.signature_bundle_text = jsonText(item.signature_bundle);
}

const MUTATIONS = {
  'missing-package-artifact': state => { state.input.package.required_artifacts_present = false; },
  'scope-hash-drift': state => { state.input.package.recomputed_scope_sha256 = '0'.repeat(64); },
  'surface-hash-drift': state => { state.input.package.recomputed_expected_public_surface_manifest_sha256 = '0'.repeat(64); },
  'candidate-byte-present': state => { state.input.package.candidate_artifacts_absent = false; },
  'governance-staged': state => { state.input.package.governance_excluded_from_staged_surface = false; },
  'trust-role-missing': state => { state.input.trust_registry.authorities.pop(); state.input.trust_registry.status = 'incomplete'; refreshTrust(state); },
  'trust-revoked-before-validity': state => {
    const authority = state.input.trust_registry.authorities[0];
    authority.status = 'revoked';
    authority.revoked_at = at(-86401);
    state.input.trust_registry.status = 'incomplete';
    refreshTrust(state);
  },
  'trust-revoked-after-validity': state => {
    const authority = state.input.trust_registry.authorities[0];
    authority.status = 'revoked';
    authority.revoked_at = at(86400 * 30);
    state.input.trust_registry.status = 'incomplete';
    refreshTrust(state);
  },
  'private-key-in-trust': state => {
    state.input.trust_registry.authorities[0].public_key_spki_pem = state.generated[0].privateKey.export({ type: 'pkcs8', format: 'pem' });
    refreshTrust(state);
  },
  'review-signature-bitflip': state => {
    const item = state.input.package_review_evidence.beta_data_reviewer;
    item.signature_bundle.signatures[0].signature_base64 = signatureBitflip(item.signature_bundle.signatures[0].signature_base64);
    refreshEvidenceBundle(item);
  },
  'review-artifact-pin-drift': state => {
    const item = state.input.package_review_evidence.beta_data_reviewer;
    item.evidence.reviewed_artifacts[0].sha256 = '0'.repeat(64);
    refreshEvidence(item);
  },
  'review-artifact-pin-empty': state => {
    const item = state.input.package_review_evidence.beta_data_reviewer;
    item.evidence.reviewed_artifacts = [];
    state.input.package_review_artifact_pins.beta_data_reviewer = [];
    refreshEvidence(item);
  },
  'reviewer-not-independent': state => {
    const item = state.input.package_review_evidence.beta_data_reviewer;
    item.evidence.reviewer_identity = item.evidence.producer_identity;
    refreshEvidence(item);
  },
  'assessed-probe-drift': state => { state.input.assessed_boundary.observed_probe_sha256 = '0'.repeat(64); },
  'assessed-beta-input-counted': state => { state.input.assessed_boundary.beta_paths_counted_as_assessed_inputs = true; },
  'assessed-block-reinterpreted-as-pass': state => { state.input.assessed_boundary.production_readiness_status = 'release_ready'; },
  'unauthorized-access-redirect-unfrozen': state => {
    state.input.policy.unauthorized_access_policy.allowed_redirect_origins = ['http://unreviewed.invalid'];
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'hosting-project-scope-drift': state => {
    state.input.policy.hosting_project.access_scope = 'single_deployment_only';
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'hosting-pages-origin-drift': state => {
    state.input.policy.hosting_project.pages_dev_origin = 'https://other-project.pages.dev';
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'hosting-deployment-suffix-drift': state => {
    state.input.policy.hosting_project.deployment_alias_hostname_suffix = '.other-project.pages.dev';
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'hosting-pages-origin-not-approved': state => {
    state.input.policy.approved_aliases.invited_beta =
      state.input.policy.approved_aliases.invited_beta.filter(alias =>
        alias !== state.input.policy.hosting_project.pages_dev_origin);
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'hosting-holding-hash-missing': state => {
    state.input.policy.hosting_project.holding_content_sha256 = null;
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'rollback-target-invalid': state => {
    state.input.policy.rollback_target.type = 'unreviewed_action';
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'governance-review-protocol-hash-drift': state => {
    state.input.policy.governance_contracts.review_protocol_sha256 = null;
    state.input.policy_text = jsonText(state.input.policy);
    state.input.package.policy_sha256 = policyEngine.sha256(state.input.policy_text);
  },
  'l1-approval-absent': () => {},
  'l1-approved-in-future': state => {
    const item = state.input.approvals.invited_beta;
    item.approval.approved_at = at(101);
    resignApprovalRawText(state, 'invited_beta', jsonText(item.approval));
  },
  'l1-duplicate-deny-approve': state => {
    const item = state.input.approvals.invited_beta;
    const duplicated = item.approval_text.replace(
      '  "decision": "approve",\n',
      '  "decision": "deny",\n  "decision": "approve",\n',
    );
    assert.notEqual(duplicated, item.approval_text);
    resignApprovalRawText(state, 'invited_beta', duplicated);
  },
  'l1-origin-replay': state => { state.input.approvals.invited_beta.approval.intended_origin = state.input.policy.approved_origins.public_beta; refreshApproval(state.input.approvals.invited_beta); },
  'l1-approval-alias-drift': state => {
    state.input.approvals.invited_beta.approval.intended_aliases = ['https://unreviewed-alias.invalid'];
    refreshApproval(state.input.approvals.invited_beta);
  },
  'l1-commit-drift': state => { state.input.approvals.invited_beta.approval.reviewed_commit_sha = COMMITS.l1; refreshApproval(state.input.approvals.invited_beta); },
  'l1-scope-drift': state => { state.input.approvals.invited_beta.approval.canonical_scope_sha256 = '0'.repeat(64); refreshApproval(state.input.approvals.invited_beta); },
  'l1-surface-drift': state => { state.input.approvals.invited_beta.approval.expected_public_surface_manifest_sha256 = '0'.repeat(64); refreshApproval(state.input.approvals.invited_beta); },
  'l1-signature-bitflip': state => {
    const item = state.input.approvals.invited_beta;
    item.signature_bundle.signatures[0].signature_base64 = signatureBitflip(item.signature_bundle.signatures[0].signature_base64);
    refreshEvidenceBundle(item);
  },
  'l1-expired': state => { state.input.approvals.invited_beta.approval.valid_until = at(50); refreshApproval(state.input.approvals.invited_beta); },
  'l1-preflight-origin-drift': state => { state.input.remote_evidence.l1_remote_preflight.evidence.intended_origin = state.input.policy.approved_origins.public_beta; refreshEvidence(state.input.remote_evidence.l1_remote_preflight); },
  'l1-preflight-alias-drift': state => {
    state.input.remote_evidence.l1_remote_preflight.evidence.intended_aliases = ['https://unreviewed-alias.invalid'];
    refreshEvidence(state.input.remote_evidence.l1_remote_preflight);
  },
  'l1-preflight-record-pin-drift': state => {
    state.input.remote_evidence.l1_remote_preflight.evidence.reviewed_artifacts[0].sha256 = '0'.repeat(64);
    refreshEvidence(state.input.remote_evidence.l1_remote_preflight);
  },
  'l1-preflight-index-hash-drift': state => {
    state.input.remote_evidence.l1_remote_preflight.evidence.remote_index_sha256 = '0'.repeat(64);
    refreshEvidence(state.input.remote_evidence.l1_remote_preflight);
  },
  'l1-preflight-production-baseline-drift': state => {
    state.input.remote_evidence.l1_remote_preflight.evidence.production_baseline_inventory_sha256 = '0'.repeat(64);
    refreshEvidence(state.input.remote_evidence.l1_remote_preflight);
  },
  'l1-preflight-evidence-absent': state => { state.input.remote_evidence.l1_remote_preflight = null; },
  'l1-preflight-unsigned': state => { state.input.remote_evidence.l1_remote_preflight.signature_bundle.signatures = []; refreshEvidenceBundle(state.input.remote_evidence.l1_remote_preflight); },
  'l2-approval-absent': () => {},
  'l2-prior-l1-hash-drift': state => { state.input.approvals.public_beta.approval.prior_l1_approval.approval_sha256 = '0'.repeat(64); refreshApproval(state.input.approvals.public_beta); },
  'l2-evidence-index-hash-drift': state => { state.input.approvals.public_beta.approval.invited_evidence_index.evidence_sha256 = '0'.repeat(64); refreshApproval(state.input.approvals.public_beta); },
  'l2-origin-replay': state => { state.input.approvals.public_beta.approval.intended_origin = state.input.policy.approved_origins.invited_beta; refreshApproval(state.input.approvals.public_beta); },
  'l2-level-replay': state => { state.input.approvals.public_beta.approval.publication_level = 'invited_beta'; refreshApproval(state.input.approvals.public_beta); },
  'l2-commit-lineage-false': state => { state.input.commit_lineage.l2_approval_commit_ancestor_of_current = false; },
  'l2-preflight-surface-drift': state => { state.input.remote_evidence.l2_remote_preflight.evidence.expected_public_surface_manifest_sha256 = '0'.repeat(64); refreshEvidence(state.input.remote_evidence.l2_remote_preflight); },
  'activation-absent': () => {},
  'activation-prior-evidence-drift': state => { state.input.remote_evidence.public_activation.evidence.prior_evidence_sha256 = '0'.repeat(64); refreshEvidence(state.input.remote_evidence.public_activation); },
  'activation-signature-bitflip': state => {
    const item = state.input.remote_evidence.public_activation;
    item.signature_bundle.signatures[0].signature_base64 = signatureBitflip(item.signature_bundle.signatures[0].signature_base64);
    refreshEvidenceBundle(item);
  },
  'monitoring-absent': () => {},
  'monitoring-prior-evidence-drift': state => { state.input.remote_evidence.live_monitoring.evidence.prior_evidence_sha256 = '0'.repeat(64); refreshEvidence(state.input.remote_evidence.live_monitoring); },
  'monitoring-signature-bitflip': state => {
    const item = state.input.remote_evidence.live_monitoring;
    item.signature_bundle.signatures[1].signature_base64 = signatureBitflip(item.signature_bundle.signatures[1].signature_base64);
    refreshEvidenceBundle(item);
  },
  'approval-signature-replayed-as-evidence': state => {
    const approvalSignature = state.input.approvals.invited_beta.signature_bundle.signatures[0].signature_base64;
    state.input.remote_evidence.l1_remote_preflight.signature_bundle.signatures[0].signature_base64 = approvalSignature;
    refreshEvidenceBundle(state.input.remote_evidence.l1_remote_preflight);
  },
};

function run() {
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 1 && args[0] === '--self-test'),
    'usage: node tools/check-climate-public-beta-policy.js [--self-test]');
  const fixtureText = fs.readFileSync(FIXTURE_PATH, 'utf8');
  const fixture = parseJsonNoDuplicateKeys(fixtureText, 'policy fixture');
  assert.equal(fixture.fixture_only, true);
  assert.deepEqual(fixture.expected_state_order, policyEngine.RELEASE_STATES);
  assert(!/BEGIN (?:RSA |EC )?PRIVATE KEY|signature_base64\s*:/i.test(fixtureText),
    'fixture file must contain no key or detached-signature material');
  SCHEMA_PATHS.forEach(relative => {
    const schema = parseJsonNoDuplicateKeys(
      fs.readFileSync(path.join(ROOT, relative), 'utf8'), relative);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
  });
  const validReleaseIds = ['a-1', 'a.1', `a${'b'.repeat(62)}1`];
  const invalidReleaseIds = [
    'a1', 'A-1', 'a_1', 'a..1', '-a1', 'a1-', `a${'b'.repeat(63)}1`,
  ];
  validReleaseIds.forEach(value => assert.equal(policyEngine.validReleaseId(value), true,
    `canonical valid release ID rejected: ${value}`));
  invalidReleaseIds.forEach(value => assert.equal(policyEngine.validReleaseId(value), false,
    `non-canonical release ID accepted: ${value}`));
  RELEASE_ID_SCHEMA_PATHS.forEach(relative => {
    const schema = parseJsonNoDuplicateKeys(
      fs.readFileSync(path.join(ROOT, relative), 'utf8'), relative);
    const pattern = schema.$defs?.releaseId?.pattern || schema.properties?.beta_release_id?.pattern;
    assert.equal(pattern, CANONICAL_RELEASE_ID_PATTERN,
      `${relative} must use the canonical beta release ID pattern`);
    const releaseIdPattern = new RegExp(pattern);
    validReleaseIds.forEach(value => assert.equal(releaseIdPattern.test(value), true,
      `${relative} rejects canonical release ID ${value}`));
    invalidReleaseIds.forEach(value => assert.equal(releaseIdPattern.test(value), false,
      `${relative} accepts non-canonical release ID ${value}`));
  });

  const expectedBaselines = {
    package: 'package_valid_publication_blocked',
    shareable_l1: 'shareable_l1',
    authorized: 'authorized_for_public_activation',
    live: 'live_public_beta_monitoring',
    verified: 'verified_live_public_beta',
  };
  Object.entries(expectedBaselines).forEach(([name, expected]) => {
    const result = policyEngine.evaluatePolicy(baseline(name).input);
    assert.equal(result.state, expected, name + ' baseline state; transition failures=' +
      JSON.stringify(Object.fromEntries(Object.entries(result.transitions).map(([key, value]) => [key, value.failure_ids]))) +
      '; invited evidence=' + JSON.stringify(result.transitions.public_beta.invited_evidence_report?.failure_ids));
    assert.equal(result.assessed_production_authority, false);
  });
  assert.equal(policyEngine.evaluatePolicy(baseline('package').input).l1_preflight_deployment_authorized, false,
    'unsigned package cannot be staged for remote preflight');
  assert.equal(policyEngine.evaluatePolicy(baseline('shareable_l1').input).l1_preflight_deployment_authorized, true,
    'valid package, lineage, and L1 approval authorize access-controlled preflight deployment');
  assert.equal(policyEngine.evaluatePolicy(baseline('shareable_l1').input).l2_preflight_deployment_authorized, false,
    'L1 shareability without the invited evidence and L2 approval cannot authorize an L2 preflight deployment');
  assert.equal(policyEngine.evaluatePolicy(baseline('authorized').input).l2_preflight_deployment_authorized, true,
    'valid L1 evidence, lineage, and L2 approval authorize only the access-controlled L2 preflight deployment');
  const missingL2Remote = baseline('authorized');
  missingL2Remote.input.remote_evidence.l2_remote_preflight = null;
  const missingL2RemoteResult = policyEngine.evaluatePolicy(missingL2Remote.input);
  assert.equal(missingL2RemoteResult.state, 'shareable_l1');
  assert.equal(missingL2RemoteResult.l2_preflight_deployment_authorized, true,
    'missing L2 remote evidence must block public activation while preserving preflight-only deployment authorization');
  assert.equal(policyEngine.stateSatisfies('package_valid_publication_blocked', 'shareable_l1'), false);
  assert.equal(policyEngine.stateSatisfies('shareable_l1', 'shareable_l1'), true);
  assert.equal(policyEngine.stateSatisfies('verified_live_public_beta', 'authorized_for_public_activation'), true);

  fixture.mutations.forEach(test => {
    assert.equal(typeof MUTATIONS[test.id], 'function', test.id + ': mutation handler missing');
    const state = baseline(test.baseline);
    MUTATIONS[test.id](state);
    const result = policyEngine.evaluatePolicy(state.input);
    assert.equal(result.state, test.expected_state, test.id + ': unexpected state');
    assert.equal(result.assessed_production_authority, false, test.id + ': assessed authority drift');
    if (Object.hasOwn(test, 'expected_l1_preflight_deployment_authorized')) {
      assert.equal(result.l1_preflight_deployment_authorized,
        test.expected_l1_preflight_deployment_authorized,
        test.id + ': preflight-only deployment authorization drift');
    }
  });
  process.stdout.write(
    'Climate Public Beta policy: PASS (5 exact states; ' + fixture.mutations.length +
    ' fail-closed mutations; ephemeral Ed25519 keys remained in-process)\n'
  );
}

try { run(); }
catch (error) {
  process.stderr.write('Climate Public Beta policy: FAIL\n' + (error.stack || error.message) + '\n');
  process.exitCode = 1;
}
