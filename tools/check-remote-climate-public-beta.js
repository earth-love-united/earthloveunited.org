#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const remote = require('./lib/climate-public-beta-remote');
const surface = require('./lib/climate-public-beta-surface');
const betaPolicy = require('./lib/climate-public-beta-policy');
const { parseJsonNoDuplicateKeys } = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');

function usage() {
  return 'usage: node tools/check-remote-climate-public-beta.js --self-test\n' +
    '   or: node tools/check-remote-climate-public-beta.js ' +
    '--level invited_beta|public_beta --url <approved-origin> --evidence <private-evidence-index>';
}

function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--self-test') return { selfTest: true };
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!['--level', '--url', '--evidence'].includes(flag) || typeof value !== 'string' ||
        value.startsWith('--') || Object.prototype.hasOwnProperty.call(values, flag)) {
      throw new Error(usage());
    }
    values[flag] = value;
  }
  if (argv.length !== 6 || !values['--level'] || !values['--url'] || !values['--evidence'] ||
      !remote.PUBLICATION_LEVELS.includes(values['--level']) ||
      remote.canonicalOrigin(values['--url']) !== values['--url']) {
    throw new Error(usage());
  }
  return {
    selfTest: false,
    level: values['--level'],
    url: values['--url'],
    evidence: values['--evidence'],
  };
}

function jsonText(value) {
  return JSON.stringify(remote.stable(value), null, 2) + '\n';
}

function fixtureTime(seconds) {
  return new Date(Date.UTC(2000, 0, 1, 0, 0, 0, 0) + seconds * 1000).toISOString();
}

function recordWrap(value) {
  const text = jsonText(value);
  return {
    value,
    text,
    bytes: Buffer.from(text, 'utf8'),
    raw_sha256: remote.hashBytes(Buffer.from(text, 'utf8')),
    canonical_json_sha256: remote.hashJson(value),
  };
}

function selfTestHeaders() {
  return {
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; manifest-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; upgrade-insecure-requests",
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-resource-policy': 'same-origin',
    'permissions-policy': 'accelerometer=(), ambient-light-sensor=(), autoplay=(), bluetooth=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), hid=(), idle-detection=(), local-fonts=(), magnetometer=(), microphone=(), midi=(), payment=(), publickey-credentials-create=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), speaker-selection=(), storage-access=(), usb=(), web-share=(), window-management=(), xr-spatial-tracking=()',
    'referrer-policy': 'no-referrer',
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
  };
}

function makeSurfaceFixture() {
  const contents = {
    'index.html': Buffer.from('<!doctype html><title>Fictional beta self-test</title>\n'),
    '_headers': Buffer.from('/*\n  Cache-Control: no-store\n'),
    'js/beta.js': Buffer.from("'use strict';\n"),
  };
  const files = Object.keys(contents).sort().map(destination => ({
    source_path: destination === 'index.html'
      ? 'climate-public-beta/index.html'
      : destination === '_headers' ? 'climate-public-beta/_headers' : 'climate-public-beta/js/beta.js',
    destination_path: destination,
    sha256: remote.hashBytes(contents[destination]),
  }));
  const manifest = {
    schema_version: '1.0.0',
    manifest_id: 'elu-climate-public-beta-surface-fictional-beta-self-test',
    beta_release_id: 'fictional-beta-self-test',
    publication_channel: 'climate_public_beta',
    assessed_production_authority: false,
    files,
    calculation_hash: null,
  };
  manifest.calculation_hash = remote.hashJson(manifest);
  const text = jsonText(manifest);
  return {
    manifest: {
      value: manifest,
      text,
      raw_sha256: remote.hashBytes(Buffer.from(text, 'utf8')),
    },
    contents,
  };
}

function baseRecord(type, level, evidenceId) {
  return {
    schema_version: '1.0.0',
    record_type: type,
    evidence_id: evidenceId,
    repository: 'earth-love-united/earthloveunited.org',
    beta_release_id: 'fictional-beta-self-test',
    publication_level: level,
  };
}

function makeRecords(level, state, aliases, deploymentOrigin, surfaceFixture, evidenceId, baseSeconds) {
  const observationBaseSeconds = state === 'verified_live_public_beta'
    ? baseSeconds + 54
    : baseSeconds;
  const observedAliases = [...new Set(aliases.concat(deploymentOrigin))].sort();
  const preflight = level === 'invited_beta' || state === 'authorized_for_public_activation';
  const exposure = preflight ? 'access_controlled' : 'public';
  const hashes = value => remote.hashBytes(Buffer.from(value, 'utf8'));
  const fileProbes = [];
  observedAliases.forEach(alias => {
    surfaceFixture.manifest.value.files.forEach(file => {
      const bytes = surfaceFixture.contents[file.destination_path];
      fileProbes.push({
        alias,
        path: file.destination_path,
        status: 200,
        sha256: file.sha256,
        bytes: bytes.length,
      });
    });
  });
  const unauthorizedUrls = alias =>
    remote.unauthorizedProbeUrls(alias, surfaceFixture.manifest.value);
  const records = {
    deployment: {
      ...baseRecord('deployment', level, evidenceId),
      deployment_id: 'fictional-deployment-self-test',
      source_commit_sha: '1'.repeat(40),
      approved_origin: aliases[0],
      deployment_origin: deploymentOrigin,
      aliases: observedAliases,
      exposure_state: exposure,
      observed_at: fixtureTime(observationBaseSeconds),
    },
    access_control: {
      ...baseRecord('access_control', level, evidenceId),
      aliases: observedAliases,
      mode_at_observation: 'access_controlled',
      unauthorized_probes: observedAliases.flatMap(alias => unauthorizedUrls(alias).map(requestUrl => ({
        alias,
        request_url: requestUrl,
        status: 403,
        denied: true,
        redirect_origin: null,
        body_sha256: hashes('fictional access denial self-test'),
      }))),
      authorized_test_count: fileProbes.length + observedAliases.length,
      observed_at: fixtureTime(observationBaseSeconds + 1),
    },
    remote_surface: {
      ...baseRecord('remote_surface', level, evidenceId),
      access_context: preflight ? 'authorized' : 'public',
      aliases: observedAliases,
      file_probes: fileProbes,
      forbidden_path_probes: observedAliases.flatMap(alias =>
        remote.forbiddenRemotePaths(surfaceFixture.manifest.value.beta_release_id)
          .map(relative => ({ alias, path: relative, status: 404 }))),
      sw_probes: observedAliases.map(alias => ({ alias, status: 404 })),
      header_probes: observedAliases.map(alias => ({ alias, headers: selfTestHeaders() })),
      observed_at: fixtureTime(observationBaseSeconds + 2),
    },
    browser_accessibility: {
      ...baseRecord('browser_accessibility', level, evidenceId),
      sessions: observedAliases.map(alias => ({
        alias,
        document_url: alias + '/',
        automatic_requests: [
          { url: alias + '/js/beta.js', kind: 'script' },
        ],
        browser_result: 'pass',
        accessibility_result: 'pass',
        service_worker_controller_present: false,
      })),
      browser_smoke_passed: true,
      manual_accessibility_passed: true,
      observed_at: fixtureTime(observationBaseSeconds + 3),
    },
    production_baseline: {
      ...baseRecord('production_baseline', level, evidenceId),
      production_origin: 'https://production.invalid',
      before_inventory_sha256: null,
      after_inventory_sha256: null,
      before_files: [
        { path: 'index.html', sha256: hashes('fictional unchanged production self-test') },
      ],
      after_files: [
        { path: 'index.html', sha256: hashes('fictional unchanged production self-test') },
      ],
      unchanged: true,
      observed_at: fixtureTime(observationBaseSeconds + 4),
    },
    monitoring: {
      ...baseRecord('monitoring', level, evidenceId),
      state: level === 'invited_beta' ? 'not_applicable'
        : state === 'authorized_for_public_activation' ? 'not_started'
          : state === 'live_public_beta_monitoring' ? 'in_progress' : 'completed',
      immediate_probes_passed: level === 'public_beta' && state !== 'authorized_for_public_activation',
      window_started_at: level === 'public_beta' && state !== 'authorized_for_public_activation'
        ? fixtureTime(baseSeconds)
        : null,
      window_ended_at: state === 'verified_live_public_beta' ? fixtureTime(baseSeconds + 60) : null,
      required_window_seconds: 60,
      probe_interval_seconds: 20,
      probe_count: state === 'verified_live_public_beta' ? 4
        : state === 'live_public_beta_monitoring' ? 1 : 0,
      successful_probe_count: state === 'verified_live_public_beta' ? 4
        : state === 'live_public_beta_monitoring' ? 1 : 0,
      failures: [],
      withdrawal_triggered: false,
    },
    rollback_withdrawal: {
      ...baseRecord('rollback_withdrawal', level, evidenceId),
      target_type: 'project_access_lock',
      target_reference: 'fictional-self-test-withdrawal-target',
      target_frozen: true,
      rehearsal_result: 'pass',
      rehearsal_elapsed_seconds: 20,
      response_target_seconds: 30,
      alias_results: observedAliases.map(alias => ({
        alias,
        result: 'pass',
        inaccessible_or_access_locked: true,
        status: 403,
        response_sha256: hashes('fictional withdrawal response self-test'),
      })),
      withdrawal: {
        executed: false,
        triggered_by_failure: false,
        result: 'not_required',
        alias_results: [],
      },
      observed_at: fixtureTime(observationBaseSeconds + 5),
    },
    invited_feedback: {
      ...baseRecord('invited_feedback', level, evidenceId),
      state: level === 'invited_beta' ? 'not_started' : 'triaged',
      privacy_safe: true,
      reviewer_count: level === 'invited_beta' ? 0 : 2,
      session_count: level === 'invited_beta' ? 0 : 2,
      unresolved_no_go_count: 0,
      triage_complete: level === 'public_beta',
      observed_at: fixtureTime(observationBaseSeconds + 6),
    },
  };
  records.production_baseline.before_inventory_sha256 = remote.hashJson(records.production_baseline.before_files);
  records.production_baseline.after_inventory_sha256 = records.production_baseline.before_inventory_sha256;
  return records;
}

function makeKey(role) {
  const generated = crypto.generateKeyPairSync('ed25519');
  const der = generated.publicKey.export({ type: 'spki', format: 'der' });
  return {
    role,
    privateKey: generated.privateKey,
    publicKey: generated.publicKey,
    keyId: 'ed25519:' + remote.hashBytes(der),
    identity: 'Fictional ' + role.replaceAll('_', ' ') + ' (self-test only)',
  };
}

function makeLiveResults(index, manifest, contents) {
  const aliases = remote.observedAliases(index);
  const expectPublic = index.publication_level === 'public_beta' &&
    index.release_state !== 'authorized_for_public_activation';
  if (!expectPublic) {
    const unauthorizedUrls = alias => remote.unauthorizedProbeUrls(alias, manifest);
    return {
      mode: 'unauthorized_denial',
      aliases,
      alias_results: aliases.map(alias => ({
        alias,
        probes: unauthorizedUrls(alias).map(requestUrl => ({
          request_url: requestUrl,
          status: 403,
          redirect_origin: null,
        })),
      })),
    };
  }
  return {
    mode: 'public_surface',
    aliases,
    alias_results: aliases.map(alias => ({
      alias,
      entry_status: 200,
      sw_status: 404,
      security_headers: selfTestHeaders(),
      forbidden: remote.forbiddenRemotePaths(index.beta_release_id)
        .map(relative => ({ path: relative, status: 404 })),
      files: manifest.files.map(file => ({
        path: file.destination_path,
        status: 200,
        sha256: file.sha256,
        bytes: contents[file.destination_path].length,
      })),
    })),
  };
}

function finalizeFixture(options, keys) {
  const inferredKind = options.transitionKind ||
    (options.level === 'public_beta'
      ? options.state === 'verified_live_public_beta' ? 'live_monitoring'
        : options.state === 'live_public_beta_monitoring' ? 'public_activation' : 'l2_remote_preflight'
      : 'l1_remote_preflight');
  const contracts = {
    l1_remote_preflight: { level: 'invited_beta', state: 'shareable_l1' },
    l1_invited_evidence_index: { level: 'invited_beta', state: 'shareable_l1' },
    l2_remote_preflight: { level: 'public_beta', state: 'authorized_for_public_activation' },
    public_activation: { level: 'public_beta', state: 'live_public_beta_monitoring' },
    live_monitoring: { level: 'public_beta', state: 'verified_live_public_beta' },
  };
  const contract = contracts[inferredKind];
  const level = contract.level;
  const state = contract.state;
  const transitionPosition = betaPolicy.EVIDENCE_KINDS.includes(inferredKind)
    ? ['l1_remote_preflight', 'l1_invited_evidence_index', 'l2_remote_preflight', 'public_activation', 'live_monitoring'].indexOf(inferredKind)
    : -1;
  const previousKind = transitionPosition > 0
    ? ['l1_remote_preflight', 'l1_invited_evidence_index', 'l2_remote_preflight', 'public_activation', 'live_monitoring'][transitionPosition - 1]
    : null;
  const priorFixture = previousKind ? finalizeFixture({ transitionKind: previousKind }, keys) : null;
  const aliases = [
    'https://beta.fixture-only.invalid',
    'https://fictional-remote-self-test-project.pages.dev',
  ];
  const deploymentOrigin =
    'https://fixture-deployment.fictional-remote-self-test-project.pages.dev';
  const evidenceId = 'fictional-' + inferredKind.replaceAll('_', '-') + '-self-test';
  const baseSeconds = transitionPosition * 120;
  const surfaceFixture = makeSurfaceFixture();
  if (options.mutateManifest) options.mutateManifest(surfaceFixture.manifest, surfaceFixture.contents);
  const records = makeRecords(level, state, aliases, deploymentOrigin, surfaceFixture, evidenceId, baseSeconds);
  if (inferredKind === 'l1_invited_evidence_index') {
    records.invited_feedback.state = 'triaged';
    records.invited_feedback.reviewer_count = 2;
    records.invited_feedback.session_count = 2;
    records.invited_feedback.triage_complete = true;
  }
  if (options.mutateRecords) options.mutateRecords(records);
  const wrapped = Object.fromEntries(remote.RECORD_TYPES.map(type => [type, recordWrap(records[type])]));
  const descriptors = remote.RECORD_TYPES.map(type => ({
    record_type: type,
    path: remote.RECORD_FILES[type],
    raw_sha256: wrapped[type].raw_sha256,
    canonical_json_sha256: wrapped[type].canonical_json_sha256,
  }));
  const approvalName = level === 'invited_beta' ? 'invited-beta' : 'public-beta';
  function findPrior(kind) {
    let current = priorFixture;
    while (current) {
      if (current.package.index.value.transition_kind === kind) return current;
      current = current.priorFixture;
    }
    return null;
  }
  const priorL1Fixture = level === 'public_beta' ? findPrior('l1_remote_preflight') : null;
  const invitedFixture = level === 'public_beta' ? findPrior('l1_invited_evidence_index') : null;
  const priorL1Approval = level === 'invited_beta' ? null : {
    approval_path: betaPolicy.approvalPath('fictional-beta-self-test', 'invited_beta'),
    approval_sha256: remote.hashBytes(Buffer.from(priorL1Fixture.authority.approval_text, 'utf8')),
    signature_bundle_path: betaPolicy.signatureBundlePath('fictional-beta-self-test', 'invited_beta'),
    signature_bundle_sha256: remote.hashBytes(Buffer.from(
      priorL1Fixture.authority.approval_signature_bundle_text, 'utf8')),
    approval_commit_sha: priorL1Fixture.package.index.value.reviewed_commit_sha,
  };
  const invitedEvidenceIndex = level === 'invited_beta' ? null : {
    evidence_id: invitedFixture.package.attestation.value.evidence_id,
    evidence_sha256: invitedFixture.package.attestation.raw_sha256,
    signature_bundle_sha256: invitedFixture.package.signatureBundle.raw_sha256,
  };
  const priorEvidenceSha = priorFixture ? priorFixture.package.attestation.raw_sha256 : null;
  const priorTransitionPackages = priorFixture ? [{
    transition_kind: priorFixture.package.index.value.transition_kind,
    index_path: 'prior/' + priorFixture.package.index.value.transition_kind + '/' + remote.INDEX_FILENAME,
    index_raw_sha256: priorFixture.package.index.raw_sha256,
    attestation_raw_sha256: priorFixture.package.attestation.raw_sha256,
    signature_bundle_raw_sha256: priorFixture.package.signatureBundle.raw_sha256,
  }] : [];
  const index = {
    schema_version: '1.0.0',
    evidence_id: evidenceId,
    repository: 'earth-love-united/earthloveunited.org',
    beta_release_id: 'fictional-beta-self-test',
    publication_level: level,
    release_state: state,
    transition_kind: inferredKind,
    approved_origin: aliases[0],
    approved_aliases: aliases,
    deployment_origin: deploymentOrigin,
    reviewed_commit_sha: '1'.repeat(40),
    approval_reviewed_commit_sha: '0'.repeat(40),
    canonical_scope_sha256: '4'.repeat(64),
    release_builder_identity: 'Fictional Beta Release Builder (self-test only)',
    prior_evidence_sha256: priorEvidenceSha,
    expected_public_surface_manifest_sha256: surfaceFixture.manifest.raw_sha256,
    approval_binding: {
      approval_path: 'data/climate/public-beta/governance/releases/fictional-beta-self-test/approvals/' + approvalName + '.json',
      approval_sha256: '2'.repeat(64),
      approval_signature_bundle_path: 'data/climate/public-beta/governance/releases/fictional-beta-self-test/approvals/' + approvalName + '.signatures.json',
      approval_signature_bundle_sha256: '3'.repeat(64),
      prior_l1_approval: priorL1Approval,
      invited_evidence_index: invitedEvidenceIndex,
    },
    records: descriptors,
    prior_transition_packages: priorTransitionPackages,
    evidence_attestation_path: remote.ATTESTATION_FILENAME,
    signature_bundle_path: remote.SIGNATURE_FILENAME,
    canonical_index_sha256: null,
    assessed_production_authority: false,
  };
  if (options.mutateIndexBeforeHash) options.mutateIndexBeforeHash(index);
  index.canonical_index_sha256 = remote.canonicalIndexHash(index);
  const indexRecord = recordWrap(index);
  const reviewedArtifacts = [
    { path: remote.INDEX_FILENAME, sha256: indexRecord.raw_sha256 },
    ...remote.RECORD_TYPES.map(type => ({ path: remote.RECORD_FILES[type], sha256: wrapped[type].raw_sha256 })),
  ].sort((left, right) => left.path.localeCompare(right.path));

  const trustAuthorities = keys.map(key => ({
    algorithm: 'Ed25519',
    identity: key.identity,
    key_id: key.keyId,
    public_key_spki_pem: key.publicKey.export({ type: 'spki', format: 'pem' }),
    revoked_at: null,
    role: key.role,
    status: 'active',
    valid_from: '1999-12-31T00:00:00.000Z',
    valid_until: '2000-01-03T00:00:00.000Z',
  }));
  const trustRegistry = {
    schema_version: '1.0.0',
    registry_id: 'elu-climate-public-beta-trust-v1',
    status: 'provisioned',
    repository: index.repository,
    required_roles: [...betaPolicy.REQUIRED_ROLES],
    authorities: trustAuthorities,
  };
  const trustText = jsonText(trustRegistry);
  const trustSha = remote.hashBytes(Buffer.from(trustText, 'utf8'));
  const thresholds = {
    invited_reviewer_minimum: 2,
    invited_session_minimum: 2,
    accessibility_session_minimum: 2,
    monitoring_window_seconds: 60,
    remote_probe_interval_seconds: 20,
    rollback_response_target_seconds: 30,
    approval_validity_max_seconds: 172800,
    authorized_access_test_count: 2,
    unauthorized_access_test_count: 2,
  };
  const policy = {
    schema_version: '1.0.0',
    policy_id: 'elu-climate-public-beta-policy-v1',
    status: 'frozen',
    repository: index.repository,
    product_tier: 'climate_public_beta',
    assessed_production_authority: false,
    publication_levels: [...betaPolicy.PUBLICATION_LEVELS],
    release_states: [...betaPolicy.RELEASE_STATES],
    required_roles: [...betaPolicy.REQUIRED_ROLES],
    required_review_roles: [...betaPolicy.REQUIRED_REVIEW_ROLES],
    remote_evidence_roles: [...betaPolicy.REMOTE_EVIDENCE_ROLES],
    approval_role: betaPolicy.APPROVAL_ROLE,
    hosting_project: {
      provider: 'cloudflare_pages',
      project_id: 'fictional-remote-self-test-project',
      production_branch: 'main',
      access_scope: 'project_wide_all_deployments',
      access_policy_reference: 'fictional-remote-self-test-access-policy',
      pages_dev_origin: 'https://fictional-remote-self-test-project.pages.dev',
      deployment_alias_hostname_suffix: '.fictional-remote-self-test-project.pages.dev',
      holding_content_sha256: remote.hashBytes(Buffer.from('fictional beta-free holding content')),
      deployment_replacement_lock_required: true,
    },
    approved_origins: { invited_beta: aliases[0], public_beta: aliases[0] },
    approved_aliases: { invited_beta: aliases, public_beta: aliases },
    frozen_thresholds: thresholds,
    unauthorized_access_policy: { allowed_statuses: [403], allowed_redirect_origins: [] },
    production_baseline_origin: 'https://production.invalid',
    production_baseline_inventory_sha256: records.production_baseline.before_inventory_sha256,
    rollback_target: { type: 'project_access_lock', reference: 'fictional-self-test-withdrawal-target' },
    governance_contracts: {
      review_protocol_path: 'data/climate/public-beta/governance/review-protocol.json',
      review_protocol_sha256: remote.hashBytes(Buffer.from('fictional review protocol')),
      feedback_privacy_contract_path: 'data/climate/public-beta/governance/feedback-privacy-contract.json',
      feedback_privacy_contract_sha256: remote.hashBytes(Buffer.from('fictional feedback privacy contract')),
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
    decision_reference: 'Fictional remote policy self-test only',
  };
  const authorizer = keys.find(key => key.role === 'beta_release_authorizer');
  const approval = {
    schema_version: '1.0.0',
    approval_id: 'elu-climate-public-beta-fictional-beta-self-test-' + level + '-approval-v1',
    repository: index.repository,
    beta_release_id: index.beta_release_id,
    decision: 'approve',
    publication_level: level,
    intended_origin: index.approved_origin,
    intended_aliases: index.approved_aliases,
    reviewed_commit_sha: index.approval_reviewed_commit_sha,
    canonical_scope_sha256: index.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
    approved_at: level === 'public_beta' ? fixtureTime(239) : fixtureTime(0),
    valid_from: level === 'public_beta' ? fixtureTime(239) : fixtureTime(0),
    valid_until: '2000-01-02T00:00:00.000Z',
    revocation_reference: 'Fictional revocation register self-test only',
    revoked_at: null,
    authority_role: betaPolicy.APPROVAL_ROLE,
    authorizer_identity: authorizer.identity,
    key_id: authorizer.keyId,
    decision_reference: 'Fictional approval decision self-test only',
    trust_registry_path: betaPolicy.TRUST_REGISTRY_PATH,
    trust_registry_sha256: trustSha,
    prior_l1_approval: priorL1Approval,
    invited_evidence_index: invitedEvidenceIndex,
    assessed_production_authority: false,
  };
  const approvalText = jsonText(approval);
  const approvalSha = remote.hashBytes(Buffer.from(approvalText, 'utf8'));
  index.approval_binding.approval_sha256 = approvalSha;
  const approvalPath = betaPolicy.approvalPath(index.beta_release_id, level);
  index.approval_binding.approval_path = approvalPath;
  const approvalSignature = {
    role: authorizer.role,
    identity: authorizer.identity,
    key_id: authorizer.keyId,
    signature_base64: crypto.sign(null, Buffer.from(betaPolicy.approvalSignatureMessage({
      repository: index.repository,
      beta_release_id: index.beta_release_id,
      publication_level: level,
      approval_path: approvalPath,
      approval_sha256: approvalSha,
      trust_registry_path: betaPolicy.TRUST_REGISTRY_PATH,
      trust_registry_sha256: trustSha,
      reviewed_commit_sha: index.approval_reviewed_commit_sha,
      canonical_scope_sha256: index.canonical_scope_sha256,
      expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
      intended_origin: index.approved_origin,
      intended_aliases: index.approved_aliases,
      role: authorizer.role,
      identity: authorizer.identity,
      key_id: authorizer.keyId,
    }), 'utf8'), authorizer.privateKey).toString('base64'),
  };
  const approvalSignatureBundle = {
    schema_version: '1.0.0',
    signature_bundle_id: 'elu-climate-public-beta-' + index.beta_release_id + '-' + level + '-approval-signatures-v1',
    domain: betaPolicy.SIGNATURE_DOMAIN,
    repository: index.repository,
    beta_release_id: index.beta_release_id,
    publication_level: level,
    approval_path: approvalPath,
    approval_sha256: approvalSha,
    trust_registry_path: betaPolicy.TRUST_REGISTRY_PATH,
    trust_registry_sha256: trustSha,
    reviewed_commit_sha: index.approval_reviewed_commit_sha,
    canonical_scope_sha256: index.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
    intended_origin: index.approved_origin,
    intended_aliases: index.approved_aliases,
    signatures: [approvalSignature],
  };
  const approvalSignatureText = jsonText(approvalSignatureBundle);
  index.approval_binding.approval_signature_bundle_sha256 =
    remote.hashBytes(Buffer.from(approvalSignatureText, 'utf8'));
  index.approval_binding.approval_signature_bundle_path = betaPolicy.signatureBundlePath(index.beta_release_id, level);

  // Approval hashes are part of the index, so finalize the canonical index and
  // its exact artifact pin only after the synthetic approval bytes exist.
  index.canonical_index_sha256 = remote.canonicalIndexHash(index);
  const finalizedIndexRecord = recordWrap(index);
  reviewedArtifacts.find(pin => pin.path === remote.INDEX_FILENAME).sha256 = finalizedIndexRecord.raw_sha256;
  const kind = remote.remoteEvidenceKind(index);
  const defaultAttestationOffset = state === 'verified_live_public_beta' ? 61 : 7;
  const attestationOffset = options.attestationOffsetSeconds ?? defaultAttestationOffset;
  const signedOffset = options.signedOffsetSeconds ?? (attestationOffset + 1);
  const verificationOffset = options.verificationOffsetSeconds ?? (signedOffset + 10);
  const attestation = {
    schema_version: '1.0.0',
    evidence_id: index.evidence_id,
    evidence_kind: kind,
    repository: index.repository,
    beta_release_id: index.beta_release_id,
    publication_level: level,
    intended_origin: index.approved_origin,
    intended_aliases: index.approved_aliases,
    production_baseline_origin: policy.production_baseline_origin,
    production_baseline_inventory_sha256: policy.production_baseline_inventory_sha256,
    reviewed_commit_sha: index.reviewed_commit_sha,
    canonical_scope_sha256: index.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
    approval_sha256: approvalSha,
    prior_evidence_sha256: index.prior_evidence_sha256,
    observed_at: fixtureTime(baseSeconds + attestationOffset),
    observation: betaPolicy.EVIDENCE_CONFIG[kind].observation,
    result: 'pass',
    producer_identity: keys.find(key => key.role === 'beta_release_operator').identity,
    reviewer_identity: keys.find(key => key.role === 'beta_rollback_reviewer').identity,
    reviewed_artifacts: reviewedArtifacts,
    remote_index_sha256: index.canonical_index_sha256,
    rollback_subset_sha256: remote.accessWithdrawalSubsetHash(index),
    assessed_production_authority: false,
  };
  const attestationText = jsonText(attestation);
  const attestationSha = remote.hashBytes(Buffer.from(attestationText, 'utf8'));
  const signedAt = fixtureTime(baseSeconds + signedOffset);
  const bundle = {
    schema_version: '1.0.0',
    signature_bundle_id: 'elu-climate-public-beta-' + attestation.evidence_id + '-signatures-v1',
    domain: betaPolicy.EVIDENCE_SIGNATURE_DOMAIN,
    repository: index.repository,
    beta_release_id: index.beta_release_id,
    evidence_id: attestation.evidence_id,
    evidence_kind: kind,
    evidence_sha256: attestationSha,
    signed_at: signedAt,
    signatures: [],
  };
  bundle.signatures = remote.REMOTE_ROLES.map(role => {
    const key = keys.find(item => item.role === role);
    const message = betaPolicy.evidenceSignatureMessage({
      repository: index.repository,
      beta_release_id: index.beta_release_id,
      evidence_id: attestation.evidence_id,
      evidence_kind: kind,
      evidence_sha256: attestationSha,
      signed_at: signedAt,
      role: key.role,
      identity: key.identity,
      key_id: key.keyId,
    });
    return {
      role: key.role,
      identity: key.identity,
      key_id: key.keyId,
      signature_base64: crypto.sign(null, Buffer.from(message, 'utf8'), key.privateKey).toString('base64'),
    };
  });
  if (options.mutateBundle) options.mutateBundle(bundle);
  if (options.mutateIndexAfterHash) options.mutateIndexAfterHash(index);
  const packageValue = {
    index: options.mutateIndexAfterHash ? recordWrap(index) : finalizedIndexRecord,
    records: wrapped,
    attestation: recordWrap(attestation),
    signatureBundle: recordWrap(bundle),
    priorPackages: priorFixture ? [priorFixture.package] : [],
    root: '/fictional/self-test/private-evidence-not-created',
  };
  const live = makeLiveResults(index, surfaceFixture.manifest.value, surfaceFixture.contents);
  if (options.mutateLive) options.mutateLive(live);
  const authority = {
    policy,
    trust_registry: trustRegistry,
    trust_registry_text: trustText,
    trust_registry_file_regular: true,
    approval,
    approval_text: approvalText,
    approval_file_regular: true,
    approval_signature_bundle: approvalSignatureBundle,
    approval_signature_bundle_text: approvalSignatureText,
    approval_signature_bundle_file_regular: true,
    verification_time: fixtureTime(baseSeconds + verificationOffset),
  };
  packageValue.selfTestAuthority = authority;
  return {
    level,
    state,
    package: packageValue,
    expectedSurfaceManifest: surfaceFixture.manifest,
    liveResults: live,
    mutatePolicy: options.mutatePolicy,
    requestedOrigin: options.requestedOrigin || aliases[0],
    authority,
    priorFixture,
  };
}

function makeSelfTestPolicyVerifier(fixture, mutatePolicy) {
  return async context => {
    const requests = remote.buildPolicyRequests(context, fixture.authority);
    const policyReport = betaPolicy.validatePolicy(fixture.authority.policy);
    const approvalReport = betaPolicy.verifyApproval(requests.approval.input, requests.approval.expected);
    const evidenceReport = betaPolicy.verifySignedEvidence(requests.evidence.input, requests.evidence.expected);
    fixture.policyDebug = {
      policy: policyReport.failure_ids,
      approval: approvalReport.failure_ids,
      evidence: evidenceReport.failure_ids,
    };
    const verified = policyReport.status === 'pass' && approvalReport.status === 'pass' &&
      evidenceReport.status === 'pass';
    const index = context.evidence_index;
    const policy = {
      status: verified ? 'pass' : 'blocked',
      approval_verified: verified,
      transition_authorized: verified,
      verified_release_state: index.release_state,
      publication_level: index.publication_level,
      approved_origin: index.approved_origin,
      approved_aliases: [...index.approved_aliases],
      deployment_alias_hostname_suffix:
        fixture.authority.policy.hosting_project.deployment_alias_hostname_suffix,
      reviewed_commit_sha: index.reviewed_commit_sha,
      expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
      production_baseline_origin: fixture.authority.policy.production_baseline_origin,
      production_baseline_inventory_sha256: fixture.authority.policy.production_baseline_inventory_sha256,
      rollback_target: fixture.authority.policy.rollback_target,
      evidence_signatures_verified: verified,
      verified_remote_roles: verified ? [...remote.REMOTE_ROLES] : [],
      frozen_thresholds: fixture.authority.policy.frozen_thresholds,
      unauthorized_access_policy: fixture.authority.policy.unauthorized_access_policy,
      approval_approved_at: fixture.authority.approval.approved_at,
      approval_valid_from: fixture.authority.approval.valid_from,
      approval_valid_until: fixture.authority.approval.valid_until,
      evidence_signed_at: context.evidence_signature_bundle.signed_at,
      verification_time: fixture.authority.verification_time,
      approval_report: approvalReport,
      evidence_report: evidenceReport,
    };
    if (mutatePolicy) mutatePolicy(policy);
    return policy;
  };
}

async function evaluateFixture(fixture, keys, includeVerifier = true) {
  const context = remote.policyCallbackContext(fixture.package, fixture.expectedSurfaceManifest,
    fixture.level, fixture.requestedOrigin);
  const verifier = includeVerifier ? makeSelfTestPolicyVerifier(fixture, fixture.mutatePolicy) : null;
  const policyVerification = await remote.verifyWithPolicy(verifier, context);
  return remote.evaluateRemoteEvidence({
    package: fixture.package,
    requestedLevel: fixture.level,
    requestedOrigin: fixture.requestedOrigin,
    expectedSurfaceManifest: fixture.expectedSurfaceManifest,
    policyVerification,
    liveResults: fixture.liveResults,
  });
}

function writeSelfTestPackage(root, fixture) {
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, remote.INDEX_FILENAME), fixture.package.index.text);
  remote.RECORD_TYPES.forEach(type => {
    fs.writeFileSync(path.join(root, remote.RECORD_FILES[type]), fixture.package.records[type].text);
  });
  fs.writeFileSync(path.join(root, remote.ATTESTATION_FILENAME), fixture.package.attestation.text);
  fs.writeFileSync(path.join(root, remote.SIGNATURE_FILENAME), fixture.package.signatureBundle.text);
  if (fixture.priorFixture) {
    const priorKind = fixture.priorFixture.package.index.value.transition_kind;
    writeSelfTestPackage(path.join(root, 'prior', priorKind), fixture.priorFixture);
  }
}

function selfTestAuthorityMap(fixture) {
  const output = new Map();
  let current = fixture;
  while (current) {
    output.set(current.package.index.value.transition_kind, current.authority);
    current = current.priorFixture;
  }
  return output;
}

async function runSelfTest() {
  const repositoryJson = readRepoJson('data/climate/fixtures/public-beta-data.json');
  assert.equal(repositoryJson.value.fixture_only, true,
    'real repository JSON adapter did not parse the fixture');
  assert.equal(repositoryJson.raw_sha256,
    remote.hashBytes(Buffer.from(repositoryJson.text, 'utf8')),
    'real repository JSON adapter did not preserve the raw-byte digest');
  const keys = betaPolicy.REQUIRED_ROLES.map(makeKey);
  const passes = [
    { id: 'invited beta preflight', options: { level: 'invited_beta', state: 'shareable_l1' } },
    { id: 'invited review evidence index', options: { transitionKind: 'l1_invited_evidence_index' } },
    { id: 'public beta authorized preflight', options: { level: 'public_beta', state: 'authorized_for_public_activation' } },
    { id: 'public beta live monitoring', options: { level: 'public_beta', state: 'live_public_beta_monitoring' } },
    { id: 'public beta verified live', options: { level: 'public_beta', state: 'verified_live_public_beta' } },
  ];
  for (const test of passes) {
    const fixture = finalizeFixture(test.options, keys);
    const result = await evaluateFixture(fixture, keys);
    assert.equal(result.passed, true, test.id + ': ' + result.blockers.join(', ') + ' ' +
      JSON.stringify(fixture.policyDebug || {}));
    const chain = await remote.verifyPolicyChain({
      package: fixture.package,
      expectedSurfaceManifest: fixture.expectedSurfaceManifest,
      resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
      requireCurrentFreshness: false,
    });
    assert.equal(chain.status, 'pass', test.id + ' chain: ' + chain.failure_ids.join(', '));
  }

  const freshnessFixture = finalizeFixture({ level: 'invited_beta', state: 'shareable_l1' }, keys);
  freshnessFixture.authority.verification_time = '2000-01-01T00:00:10.000Z';
  let freshnessChain = await remote.verifyPolicyChain({
    package: freshnessFixture.package,
    expectedSurfaceManifest: freshnessFixture.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
    requireCurrentFreshness: true,
  });
  assert.equal(freshnessChain.status, 'pass', 'fresh current evidence chain must pass');
  freshnessFixture.authority.verification_time = '2000-01-01T00:02:00.000Z';
  freshnessChain = await remote.verifyPolicyChain({
    package: freshnessFixture.package,
    expectedSurfaceManifest: freshnessFixture.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
    requireCurrentFreshness: true,
  });
  assert.equal(freshnessChain.status, 'blocked', 'stale current evidence chain unexpectedly passed');
  assert.ok(freshnessChain.failure_ids.includes('remote-evidence-current-freshness'));
  const unspecifiedFreshness = await remote.verifyPolicyChain({
    package: freshnessFixture.package,
    expectedSurfaceManifest: freshnessFixture.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
  });
  assert.deepEqual(unspecifiedFreshness.failure_ids, ['remote-current-freshness-selection-required']);

  const staleProbeFixture = finalizeFixture({
    level: 'invited_beta',
    state: 'shareable_l1',
    attestationOffsetSeconds: 20,
    signedOffsetSeconds: 21,
    verificationOffsetSeconds: 40,
  }, keys);
  const staleProbeChain = await remote.verifyPolicyChain({
    package: staleProbeFixture.package,
    expectedSurfaceManifest: staleProbeFixture.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
    requireCurrentFreshness: true,
  });
  assert.equal(staleProbeChain.status, 'blocked', 'fresh wrapper over stale probes unexpectedly passed');
  assert.ok(staleProbeChain.failure_ids.includes('remote-evidence-current-freshness'));

  const reversedTransition = finalizeFixture({ transitionKind: 'public_activation' }, keys);
  const reversedPriorSignedAt = reversedTransition.priorFixture.package.signatureBundle.value.signed_at;
  reversedTransition.package.records.deployment.value.observed_at = reversedPriorSignedAt;
  let chronologyChain = await remote.verifyPolicyChain({
    package: reversedTransition.package,
    expectedSurfaceManifest: reversedTransition.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
    requireCurrentFreshness: false,
  });
  assert.deepEqual(chronologyChain.failure_ids, ['remote-transition-chain-chronology']);

  const reversedAttestation = finalizeFixture({ transitionKind: 'public_activation' }, keys);
  reversedAttestation.package.attestation.value.observed_at =
    reversedAttestation.priorFixture.package.signatureBundle.value.signed_at;
  chronologyChain = await remote.verifyPolicyChain({
    package: reversedAttestation.package,
    expectedSurfaceManifest: reversedAttestation.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
    requireCurrentFreshness: false,
  });
  assert.deepEqual(chronologyChain.failure_ids, ['remote-transition-chain-chronology']);

  const reversedMonitoring = finalizeFixture({ transitionKind: 'live_monitoring' }, keys);
  reversedMonitoring.package.records.monitoring.value.window_started_at =
    reversedMonitoring.priorFixture.package.signatureBundle.value.signed_at;
  chronologyChain = await remote.verifyPolicyChain({
    package: reversedMonitoring.package,
    expectedSurfaceManifest: reversedMonitoring.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
    requireCurrentFreshness: false,
  });
  assert.deepEqual(chronologyChain.failure_ids, ['remote-transition-chain-chronology']);

  const prematureL2Approval = finalizeFixture({ transitionKind: 'l2_remote_preflight' }, keys);
  prematureL2Approval.authority.approval.approved_at = fixtureTime(120);
  chronologyChain = await remote.verifyPolicyChain({
    package: prematureL2Approval.package,
    expectedSurfaceManifest: prematureL2Approval.expectedSurfaceManifest,
    resolvePolicyVerification: makeChainPolicyResolver(betaPolicy),
    requireCurrentFreshness: false,
  });
  assert.deepEqual(chronologyChain.failure_ids, ['remote-l2-approval-chronology']);

  const collectedPasses = [
    { id: 'injected L1 denial collector', options: { level: 'invited_beta', state: 'shareable_l1' } },
    { id: 'injected L2 public collector', options: { level: 'public_beta', state: 'verified_live_public_beta' } },
  ];
  for (const test of collectedPasses) {
    const fixture = finalizeFixture(test.options, keys);
    const contents = Object.fromEntries(fixture.expectedSurfaceManifest.value.files.map(file => [
      file.destination_path,
      file.destination_path === 'index.html'
        ? Buffer.from('<!doctype html><title>Fictional beta self-test</title>\n')
        : file.destination_path === '_headers'
          ? Buffer.from('/*\n  Cache-Control: no-store\n')
          : Buffer.from("'use strict';\n"),
    ]));
    const publicState = test.options.level === 'public_beta';
    const fakeFetch = async url => {
      if (!publicState) return new Response('fictional access denial self-test', { status: 403 });
      const parsed = new URL(url);
      const relative = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
      if (relative === 'sw.js') return new Response('', { status: 404 });
      const body = contents[relative];
      if (!body) return new Response('', { status: 404 });
      return new Response(body, { status: 200, headers: selfTestHeaders() });
    };
    fixture.liveResults = await remote.collectLiveResults({
      package: fixture.package,
      expectedSurfaceManifest: fixture.expectedSurfaceManifest,
      fetcher: fakeFetch,
      timeoutMs: 1000,
    });
    const result = await evaluateFixture(fixture, keys);
    assert.equal(result.passed, true, test.id + ': ' + result.blockers.join(', '));
  }

  const ioFixture = finalizeFixture({ transitionKind: 'live_monitoring' }, keys);
  const authorities = selfTestAuthorityMap(ioFixture);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-beta-remote-self-test-'));
  let ioFailClosedCases = 0;
  try {
    const packageRoot = path.join(temporaryRoot, 'package');
    writeSelfTestPackage(packageRoot, ioFixture);
    const loaded = remote.loadEvidencePackage(path.join(packageRoot, remote.INDEX_FILENAME));
    const loadedChain = await remote.verifyPolicyChain({
      package: loaded,
      expectedSurfaceManifest: ioFixture.expectedSurfaceManifest,
      resolvePolicyVerification: context => {
        const authority = authorities.get(context.evidence_index.transition_kind);
        return makePolicyCallback(betaPolicy, authority)(context);
      },
      requireCurrentFreshness: false,
    });
    assert.equal(loadedChain.status, 'pass', 'filesystem-loaded chain: ' + loadedChain.failure_ids.join(', '));
    assert.deepEqual(Object.keys(loadedChain.remote_evidence), [...remote.TRANSITION_KINDS]);

    const symlinkRoot = path.join(temporaryRoot, 'symlink');
    fs.mkdirSync(symlinkRoot);
    fs.symlinkSync(path.join(packageRoot, remote.INDEX_FILENAME),
      path.join(symlinkRoot, remote.INDEX_FILENAME));
    assert.throws(() => remote.loadEvidencePackage(path.join(symlinkRoot, remote.INDEX_FILENAME)),
      /regular file/);
    ioFailClosedCases += 1;
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }

  const failures = [
    {
      id: 'release ID too short',
      expected: 'run-index-identity',
      options: { mutateIndexBeforeHash: index => { index.beta_release_id = 'a1'; } },
    },
    {
      id: 'release ID contains underscore',
      expected: 'run-index-identity',
      options: { mutateIndexBeforeHash: index => { index.beta_release_id = 'fictional_beta-self-test'; } },
    },
    {
      id: 'release ID contains double dot',
      expected: 'run-index-identity',
      options: { mutateIndexBeforeHash: index => { index.beta_release_id = 'fictional..beta-self-test'; } },
    },
    {
      id: 'release ID too long',
      expected: 'run-index-identity',
      options: { mutateIndexBeforeHash: index => { index.beta_release_id = `a${'b'.repeat(63)}1`; } },
    },
    {
      id: 'policy verifier absent',
      expected: 'signed-evidence-policy-verifier-available',
      options: {},
      includeVerifier: false,
    },
    {
      id: 'request origin drift',
      expected: 'run-index-request-binding',
      options: { requestedOrigin: 'https://fictional-remote-self-test-project.pages.dev' },
    },
    {
      id: 'alias approval drift',
      expected: 'policy-alias-binding',
      options: { mutatePolicy: policy => { policy.approved_aliases = [policy.approved_origin]; } },
    },
    {
      id: 'deployment origin omitted from index',
      expected: 'run-index-keys',
      options: { mutateIndexBeforeHash: index => { delete index.deployment_origin; } },
    },
    {
      id: 'deployment origin aliases stable origin',
      expected: 'run-index-deployment-origin',
      options: { mutateIndexBeforeHash: index => {
        index.deployment_origin = index.approved_aliases[1];
      } },
    },
    {
      id: 'deployment origin null sentinel rejected',
      expected: 'run-index-deployment-origin',
      options: { mutateIndexBeforeHash: index => { index.deployment_origin = null; } },
    },
    {
      id: 'deployment origin has two labels before project suffix',
      expected: 'policy-deployment-alias-binding',
      options: { mutateIndexBeforeHash: index => {
        index.deployment_origin =
          'https://nested.fixture-deployment.fictional-remote-self-test-project.pages.dev';
      } },
    },
    {
      id: 'deployment alias policy suffix drift',
      expected: 'policy-deployment-alias-binding',
      options: { mutatePolicy: policy => {
        policy.deployment_alias_hostname_suffix = '.other-fictional-project.pages.dev';
      } },
    },
    {
      id: 'deployment record atomic origin drift',
      expected: 'deployment-record-binding',
      options: { mutateRecords: records => {
        records.deployment.deployment_origin =
          'https://other-deployment.fictional-remote-self-test-project.pages.dev';
      } },
    },
    {
      id: 'access evidence omits atomic deployment alias',
      expected: 'access-control-record-binding',
      options: { mutateRecords: records => {
        const deploymentOrigin = records.deployment.deployment_origin;
        records.access_control.aliases = records.access_control.aliases
          .filter(alias => alias !== deploymentOrigin);
        records.access_control.unauthorized_probes = records.access_control.unauthorized_probes
          .filter(probe => probe.alias !== deploymentOrigin);
        const perAlias = records.remote_surface.file_probes
          .filter(probe => probe.alias === deploymentOrigin).length + 1;
        records.access_control.authorized_test_count -= perAlias;
      } },
    },
    {
      id: 'surface evidence omits atomic deployment alias',
      expected: 'remote-surface-record-binding',
      options: { mutateRecords: records => {
        const deploymentOrigin = records.deployment.deployment_origin;
        records.remote_surface.aliases = records.remote_surface.aliases
          .filter(alias => alias !== deploymentOrigin);
        records.remote_surface.file_probes = records.remote_surface.file_probes
          .filter(probe => probe.alias !== deploymentOrigin);
        records.remote_surface.forbidden_path_probes =
          records.remote_surface.forbidden_path_probes
            .filter(probe => probe.alias !== deploymentOrigin);
        records.remote_surface.sw_probes = records.remote_surface.sw_probes
          .filter(probe => probe.alias !== deploymentOrigin);
        records.remote_surface.header_probes = records.remote_surface.header_probes
          .filter(probe => probe.alias !== deploymentOrigin);
      } },
    },
    {
      id: 'browser evidence omits atomic deployment alias',
      expected: 'browser-same-origin-automatic-network',
      options: { mutateRecords: records => {
        const deploymentOrigin = records.deployment.deployment_origin;
        records.browser_accessibility.sessions = records.browser_accessibility.sessions
          .filter(session => session.alias !== deploymentOrigin);
      } },
    },
    {
      id: 'index hash drift',
      expected: 'run-index-canonical-hash',
      options: { mutateIndexAfterHash: index => { index.release_state = 'package_valid_publication_blocked'; } },
    },
    {
      id: 'signature bit flip',
      expected: 'signed-evidence-policy-pass',
      options: { mutateBundle: bundle => {
        const bytes = Buffer.from(bundle.signatures[0].signature_base64, 'base64');
        bytes[0] ^= 1;
        bundle.signatures[0].signature_base64 = bytes.toString('base64');
      } },
    },
    {
      id: 'record bytes changed after indexing',
      expected: 'run-record-byte-and-canonical-integrity',
      options: { mutateIndexBeforeHash: index => { index.records[0].raw_sha256 = '4'.repeat(64); } },
    },
    {
      id: 'authorized surface byte mismatch',
      expected: 'remote-surface-exact-authorized-bytes',
      options: { mutateRecords: records => { records.remote_surface.file_probes[0].sha256 = '5'.repeat(64); } },
    },
    {
      id: 'service worker present',
      expected: 'remote-surface-service-worker-absent',
      options: { mutateRecords: records => { records.remote_surface.sw_probes[0].status = 200; } },
    },
    {
      id: 'forbidden candidate path present',
      expected: 'remote-surface-forbidden-paths-absent',
      options: { mutateRecords: records => {
        const probe = records.remote_surface.forbidden_path_probes.find(item =>
          item.path === 'data/climate/runtime/country-factual-candidate.json');
        probe.status = 200;
      } },
    },
    {
      id: 'security header weakened',
      expected: 'remote-surface-security-headers',
      options: { mutateRecords: records => { delete records.remote_surface.header_probes[0].headers['content-security-policy']; } },
    },
    {
      id: 'security header unsafe source added',
      expected: 'remote-surface-security-headers',
      options: { mutateRecords: records => {
        records.remote_surface.header_probes[0].headers['content-security-policy'] =
          records.remote_surface.header_probes[0].headers['content-security-policy']
            .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
      } },
    },
    {
      id: 'permissions policy inventory incomplete',
      expected: 'remote-surface-security-headers',
      options: { mutateRecords: records => {
        records.remote_surface.header_probes[0].headers['permissions-policy'] = 'camera=()';
      } },
    },
    {
      id: 'record observation predates approval',
      expected: 'remote-record-observation-chronology',
      options: { mutateRecords: records => {
        records.deployment.observed_at = '1999-12-31T23:59:59.000Z';
      } },
    },
    {
      id: 'record observation order inverted',
      expected: 'remote-record-observation-chronology',
      options: { mutateRecords: records => {
        records.remote_surface.observed_at = '2000-01-01T00:00:00.000Z';
      } },
    },
    {
      id: 'evidence signed before attestation',
      expected: 'signed-evidence-policy-pass',
      options: { mutateBundle: bundle => {
        bundle.signed_at = '2000-01-01T00:00:06.000Z';
      } },
    },
    {
      id: 'external automatic request',
      expected: 'browser-same-origin-automatic-network',
      options: { mutateRecords: records => {
        records.browser_accessibility.sessions[0].automatic_requests[0].url = 'https://external.invalid/script.js';
      } },
    },
    {
      id: 'same-origin unapproved automatic request',
      expected: 'browser-same-origin-automatic-network',
      options: { mutateRecords: records => {
        records.browser_accessibility.sessions[0].automatic_requests[0].url =
          records.browser_accessibility.sessions[0].alias + '/unapproved-telemetry';
      } },
    },
    {
      id: 'deployed browser has a service worker controller',
      expected: 'browser-service-worker-controller-absent',
      options: { mutateRecords: records => {
        records.browser_accessibility.sessions[0].service_worker_controller_present = true;
      } },
    },
    {
      id: 'unauthorized request served',
      expected: 'access-control-unauthorized-denial',
      options: { mutateRecords: records => {
        records.access_control.unauthorized_probes[0].status = 200;
        records.access_control.unauthorized_probes[0].denied = false;
      } },
    },
    {
      id: 'unauthorized surface path omitted',
      expected: 'access-control-unauthorized-denial',
      options: { mutateRecords: records => { records.access_control.unauthorized_probes.pop(); } },
    },
    {
      id: 'production baseline drift',
      expected: 'production-baseline-unchanged',
      options: { mutateRecords: records => { records.production_baseline.after_files[0].sha256 = '6'.repeat(64); } },
    },
    {
      id: 'rollback rehearsal failed',
      expected: 'rollback-target-and-rehearsal',
      options: { mutateRecords: records => { records.rollback_withdrawal.rehearsal_result = 'fail'; } },
    },
    {
      id: 'rollback alias omitted',
      expected: 'rollback-all-aliases',
      options: { mutateRecords: records => {
        const deploymentOrigin = records.deployment.deployment_origin;
        records.rollback_withdrawal.alias_results = records.rollback_withdrawal.alias_results
          .filter(result => result.alias !== deploymentOrigin);
      } },
    },
    {
      id: 'withdrawal triggered',
      expected: 'release-not-withdrawn',
      options: { mutateRecords: records => {
        records.rollback_withdrawal.withdrawal = {
          executed: true,
          triggered_by_failure: true,
          result: 'pass',
          alias_results: records.rollback_withdrawal.alias_results.map(item => ({ ...item })),
        };
      } },
    },
    {
      id: 'public feedback not triaged',
      expected: 'feedback-invited-triage',
      options: { level: 'public_beta', state: 'authorized_for_public_activation', mutateRecords: records => {
        records.invited_feedback.triage_complete = false;
      } },
    },
    {
      id: 'monitoring window too short',
      expected: 'monitoring-release-state',
      options: { level: 'public_beta', state: 'verified_live_public_beta', mutateRecords: records => {
        records.monitoring.window_ended_at = '2000-01-01T00:00:59Z';
      } },
    },
    {
      id: 'monitoring failure',
      expected: 'monitoring-release-state',
      options: { level: 'public_beta', state: 'live_public_beta_monitoring', mutateRecords: records => {
        records.monitoring.failures.push('fictional self-test probe failure');
      } },
    },
    {
      id: 'public live file changed',
      expected: 'live-public-exact-surface-security-and-no-sw',
      options: { level: 'public_beta', state: 'verified_live_public_beta', mutateLive: live => {
        live.alias_results[0].files[0].sha256 = '7'.repeat(64);
      } },
    },
    {
      id: 'public live service worker present',
      expected: 'live-public-exact-surface-security-and-no-sw',
      options: { level: 'public_beta', state: 'live_public_beta_monitoring', mutateLive: live => {
        live.alias_results[0].sw_status = 200;
      } },
    },
    {
      id: 'public live forbidden governance path present',
      expected: 'live-public-exact-surface-security-and-no-sw',
      options: { level: 'public_beta', state: 'live_public_beta_monitoring', mutateLive: live => {
        live.alias_results[0].forbidden.find(item =>
          item.path === 'data/climate/public-beta/governance/policy.json').status = 200;
      } },
    },
    {
      id: 'live unauthorized access served',
      expected: 'live-unauthorized-access-denied',
      options: { mutateLive: live => { live.alias_results[0].probes[0].status = 200; } },
    },
    {
      id: 'live unauthorized surface path omitted',
      expected: 'live-unauthorized-access-denied',
      options: { mutateLive: live => { live.alias_results[0].probes.pop(); } },
    },
    {
      id: 'live evidence omits atomic deployment alias',
      expected: 'live-probe-present-and-bound',
      options: { mutateLive: live => {
        const deploymentOrigin = live.aliases.find(alias =>
          alias.startsWith('https://fixture-deployment.'));
        live.aliases = live.aliases.filter(alias => alias !== deploymentOrigin);
        live.alias_results = live.alias_results.filter(result => result.alias !== deploymentOrigin);
      } },
    },
    {
      id: 'surface manifest hash drift',
      expected: 'surface-index-binding',
      options: { mutateIndexBeforeHash: index => {
        index.expected_public_surface_manifest_sha256 = '8'.repeat(64);
      } },
    },
  ];
  for (const test of failures) {
    const fixture = finalizeFixture(test.options, keys);
    const result = await evaluateFixture(fixture, keys, test.includeVerifier !== false);
    assert.equal(result.passed, false, test.id + ' unexpectedly passed');
    assert.ok(result.blockers.includes(test.expected),
      test.id + ' blocked for [' + result.blockers.join(', ') + '] rather than ' + test.expected);
  }
  assert.throws(() => parseArgs(['--level', 'invited_beta']), /usage:/);
  assert.throws(() => parseArgs([
    '--level', 'invited_beta', '--url', 'http://localhost:9443', '--evidence', '/fictional/index.json',
  ]), /usage:/);
  assert.deepEqual(parseArgs(['--self-test']), { selfTest: true });
  return {
    positive_cases: passes.length + collectedPasses.length + 3,
    fail_closed_cases: failures.length + 10 + ioFailClosedCases,
  };
}

function readRepoJson(relative) {
  const record = surface.inspectRegular(ROOT, relative);
  const bytes = record.bytes;
  let value;
  try { value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), relative); }
  catch (_) { throw new Error('required repository artifact is not valid JSON'); }
  return {
    value,
    text: bytes.toString('utf8'),
    raw_sha256: remote.hashBytes(bytes),
  };
}

function loadPolicyModule() {
  try {
    const policy = require('./lib/climate-public-beta-policy');
    return typeof policy.verifySignedEvidence === 'function' ? policy : null;
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND' &&
        String(error.message).includes('climate-public-beta-policy')) return null;
    throw error;
  }
}

function loadAuthorityArtifacts(pkg, policyModule) {
  const index = pkg.index.value;
  const expectedApprovalPath = policyModule.approvalPath(index.beta_release_id, index.publication_level);
  const expectedSignaturePath = policyModule.signatureBundlePath(index.beta_release_id, index.publication_level);
  if (index.approval_binding.approval_path !== expectedApprovalPath ||
      index.approval_binding.approval_signature_bundle_path !== expectedSignaturePath) {
    throw new Error('approval paths do not match the canonical level-specific policy paths');
  }
  const policyRecord = readRepoJson('data/climate/public-beta/governance/policy.json');
  const trustRecord = readRepoJson(policyModule.TRUST_REGISTRY_PATH);
  const approvalRecord = readRepoJson(expectedApprovalPath);
  const approvalSignatureRecord = readRepoJson(expectedSignaturePath);
  if (approvalRecord.raw_sha256 !== index.approval_binding.approval_sha256 ||
      approvalSignatureRecord.raw_sha256 !== index.approval_binding.approval_signature_bundle_sha256) {
    throw new Error('approval bytes do not match the private evidence index bindings');
  }
  return {
    policy: policyRecord.value,
    policy_text: policyRecord.text,
    policy_file_regular: true,
    trust_registry: trustRecord.value,
    trust_registry_text: trustRecord.text,
    trust_registry_file_regular: true,
    approval: approvalRecord.value,
    approval_text: approvalRecord.text,
    approval_file_regular: true,
    approval_signature_bundle: approvalSignatureRecord.value,
    approval_signature_bundle_text: approvalSignatureRecord.text,
    approval_signature_bundle_file_regular: true,
    verification_time: new Date().toISOString(),
  };
}

function makePolicyCallback(policyModule, authority) {
  if (!policyModule || !authority) return null;
  return context => {
    const requests = remote.buildPolicyRequests(context, authority);
    const policyReport = policyModule.validatePolicy(authority.policy);
    const approvalReport = policyModule.verifyApproval(requests.approval.input, requests.approval.expected);
    const evidenceReport = policyModule.verifySignedEvidence(requests.evidence.input, requests.evidence.expected);
    const index = context.evidence_index;
    const policy = authority.policy;
    const policyBindings = policyReport.status === 'pass' &&
      policy.approved_origins[index.publication_level] === index.approved_origin &&
      JSON.stringify(policy.approved_aliases[index.publication_level]) === JSON.stringify(index.approved_aliases);
    const approvalVerified = approvalReport.status === 'pass';
    const evidenceVerified = evidenceReport.status === 'pass';
    const verified = policyBindings && approvalVerified && evidenceVerified;
    return {
      status: verified ? 'pass' : 'blocked',
      approval_verified: approvalVerified,
      transition_authorized: verified,
      verified_release_state: index.release_state,
      publication_level: index.publication_level,
      approved_origin: policy.approved_origins[index.publication_level],
      approved_aliases: policy.approved_aliases[index.publication_level],
      deployment_alias_hostname_suffix: policy.hosting_project.deployment_alias_hostname_suffix,
      reviewed_commit_sha: index.reviewed_commit_sha,
      expected_public_surface_manifest_sha256: index.expected_public_surface_manifest_sha256,
      production_baseline_origin: policy.production_baseline_origin,
      production_baseline_inventory_sha256: policy.production_baseline_inventory_sha256,
      rollback_target: policy.rollback_target,
      evidence_signatures_verified: evidenceVerified,
      verified_remote_roles: evidenceVerified ? [...policyModule.REMOTE_EVIDENCE_ROLES] : [],
      frozen_thresholds: policy.frozen_thresholds,
      unauthorized_access_policy: policy.unauthorized_access_policy,
      approval_approved_at: authority.approval.approved_at,
      approval_valid_from: authority.approval.valid_from,
      approval_valid_until: authority.approval.valid_until,
      evidence_signed_at: context.evidence_signature_bundle.signed_at,
      verification_time: authority.verification_time,
      policy_report: policyReport,
      approval_report: approvalReport,
      evidence_report: evidenceReport,
    };
  };
}

function makeChainPolicyResolver(policyModule) {
  if (!policyModule) return null;
  return context => {
    const authority = context.package && context.package.selfTestAuthority
      ? context.package.selfTestAuthority
      : loadAuthorityArtifacts(context.package, policyModule);
    return makePolicyCallback(policyModule, authority)(context);
  };
}

function printReport(result) {
  const output = {
    status: result.status,
    publication_level: result.publication_level,
    release_state: result.release_state,
    passed: result.passed,
    blockers: result.blockers,
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 2;
    return;
  }
  if (args.selfTest) {
    const result = await runSelfTest();
    process.stdout.write('Climate Public Beta remote checker self-test: PASS (' +
      result.positive_cases + ' positive, ' + result.fail_closed_cases + ' fail-closed cases)\n');
    return;
  }

  let pkg;
  let manifest;
  try {
    pkg = remote.loadEvidencePackage(args.evidence);
  } catch (_) {
    printReport({
      status: 'blocked', publication_level: args.level, release_state: null,
      passed: false, blockers: ['remote-evidence-package-unavailable-or-invalid'],
    });
    process.exitCode = 1;
    return;
  }
  try {
    const manifestRecord = readRepoJson(surface.PUBLIC_SURFACE_MANIFEST_PATH);
    surface.validateExpectedManifest(manifestRecord.value, ROOT);
    manifest = manifestRecord;
  } catch (_) {
    printReport({
      status: 'blocked', publication_level: args.level,
      release_state: pkg.index.value.release_state || null,
      passed: false, blockers: ['expected-public-surface-unavailable-or-invalid'],
    });
    process.exitCode = 1;
    return;
  }

  const policyModule = loadPolicyModule();
  const chainResolver = makeChainPolicyResolver(policyModule);
  const chainReport = await remote.verifyPolicyChain({
    package: pkg,
    expectedSurfaceManifest: manifest,
    resolvePolicyVerification: chainResolver,
    requireCurrentFreshness: false,
  });
  if (chainReport.status !== 'pass') {
    printReport({
      status: 'blocked',
      publication_level: pkg.index.value.publication_level || null,
      release_state: pkg.index.value.release_state || null,
      passed: false,
      blockers: ['remote-evidence-chain-invalid'].concat(chainReport.failure_ids || []),
    });
    process.exitCode = 1;
    return;
  }
  const authority = policyModule ? loadAuthorityArtifacts(pkg, policyModule) : null;
  const callback = makePolicyCallback(policyModule, authority);
  const context = remote.policyCallbackContext(pkg, manifest, args.level, args.url);
  const policyVerification = await remote.verifyWithPolicy(callback, context);
  let preliminary = remote.evaluateRemoteEvidence({
    package: pkg,
    requestedLevel: args.level,
    requestedOrigin: args.url,
    expectedSurfaceManifest: manifest,
    policyVerification,
    liveResults: null,
  });
  const nonLiveBlockers = preliminary.blockers.filter(id => ![
    'live-probe-present-and-bound',
    'live-unauthorized-access-denied',
    'live-public-exact-surface-security-and-no-sw',
  ].includes(id));
  if (nonLiveBlockers.length > 0) {
    printReport({ ...preliminary, blockers: nonLiveBlockers });
    process.exitCode = 1;
    return;
  }

  let liveResults;
  try {
    liveResults = await remote.collectLiveResults({
      package: pkg,
      expectedSurfaceManifest: manifest,
    });
  } catch (_) {
    printReport({
      status: 'blocked', publication_level: args.level,
      release_state: pkg.index.value.release_state || null,
      passed: false, blockers: ['live-remote-probe-failed'],
    });
    process.exitCode = 1;
    return;
  }
  preliminary = remote.evaluateRemoteEvidence({
    package: pkg,
    requestedLevel: args.level,
    requestedOrigin: args.url,
    expectedSurfaceManifest: manifest,
    policyVerification,
    liveResults,
  });
  printReport(preliminary);
  process.exitCode = preliminary.passed ? 0 : 1;
}

if (require.main === module) {
  main().catch(error => {
    if (process.argv.slice(2).length === 1 && process.argv[2] === '--self-test') {
      process.stderr.write('Climate Public Beta remote checker self-test: FAIL\n' +
        String(error && error.stack || error) + '\n');
    } else {
      process.stderr.write(JSON.stringify({
        status: 'blocked',
        passed: false,
        blockers: ['remote-verifier-unexpected-failure'],
      }, null, 2) + '\n');
    }
    process.exitCode = 1;
  });
}

module.exports = {
  loadAuthorityArtifacts,
  makeChainPolicyResolver,
  makePolicyCallback,
  parseArgs,
  runSelfTest,
};
