#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const access = require('./lib/climate-public-beta-access-bootstrap');
const policyEngine = require('./lib/climate-public-beta-policy');
const { canonicalJsonText, parseJsonNoDuplicateKeys } = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_ID = 'elu-beta-access-fixture-v1';
const ANCHOR_MS = Date.UTC(2040, 0, 2, 12, 0, 0, 0);
const REPORT_SCHEMA_PATH = path.join(ROOT,
  'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap.schema.json');
const SIGNATURE_SCHEMA_PATH = path.join(ROOT,
  'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap-signatures.schema.json');

function usage() {
  return 'usage: node tools/check-climate-public-beta-access-bootstrap.js --self-test';
}

function at(seconds) {
  return new Date(ANCHOR_MS + seconds * 1000).toISOString();
}

function clone(value) {
  return structuredClone(value);
}

function jsonText(value) {
  return canonicalJsonText(value);
}

function readJson(absolute) {
  return parseJsonNoDuplicateKeys(fs.readFileSync(absolute, 'utf8'), absolute);
}

function writeJson(absolute, value) {
  fs.writeFileSync(absolute, jsonText(value));
}

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
      invited_beta: 'https://invited-access.invalid',
      public_beta: 'https://public-access.invalid',
    },
    approved_aliases: {
      invited_beta: [
        'https://elu-beta-access-self-test.pages.dev',
        'https://invited-access-alias.invalid',
        'https://invited-access.invalid',
      ],
      public_beta: [
        'https://elu-beta-access-self-test.pages.dev',
        'https://public-access-alias.invalid',
        'https://public-access.invalid',
      ],
    },
    hosting_project: {
      provider: 'cloudflare_pages',
      project_id: 'elu-beta-access-self-test',
      production_branch: 'main',
      access_scope: 'project_wide_all_deployments',
      access_policy_reference: 'urn:elu:ephemeral:project-wide-access-policy',
      pages_dev_origin: 'https://elu-beta-access-self-test.pages.dev',
      deployment_alias_hostname_suffix: '.elu-beta-access-self-test.pages.dev',
      holding_content_sha256: access.hashBytes(Buffer.from('ephemeral access-locked holding page', 'utf8')),
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
      allowed_redirect_origins: ['https://access-gate.invalid'],
    },
    production_baseline_origin: 'https://production-baseline.invalid',
    production_baseline_inventory_sha256: access.hashBytes(Buffer.from('ephemeral production baseline', 'utf8')),
    rollback_target: {
      type: 'project_access_lock',
      reference: 'urn:elu:ephemeral:access-bootstrap-rollback-target',
    },
    governance_contracts: {
      review_protocol_path: 'data/climate/public-beta/governance/review-protocol.json',
      review_protocol_sha256: access.hashBytes(Buffer.from('ephemeral review protocol', 'utf8')),
      feedback_privacy_contract_path: 'data/climate/public-beta/governance/feedback-privacy-contract.json',
      feedback_privacy_contract_sha256: access.hashBytes(Buffer.from('ephemeral feedback privacy contract', 'utf8')),
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
    decision_reference: 'urn:elu:ephemeral:access-bootstrap-policy-decision',
  };
}

function makeTrust() {
  const generated = policyEngine.REQUIRED_ROLES.map(role => {
    const pair = crypto.generateKeyPairSync('ed25519');
    const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
    const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
    return {
      role,
      identity: `urn:elu:ephemeral:${role}:access-bootstrap-self-test`,
      privateKey: pair.privateKey,
      authority: {
        algorithm: 'Ed25519',
        identity: `urn:elu:ephemeral:${role}:access-bootstrap-self-test`,
        key_id: 'ed25519:' + access.hashBytes(publicDer),
        public_key_spki_pem: publicPem,
        revoked_at: null,
        role,
        status: 'active',
        valid_from: at(-86400),
        valid_until: at(86400),
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

function keyFor(state, role) {
  return state.generated.find(item => item.role === role);
}

function makeSurfaceManifest() {
  const files = [
    ['_headers', 'ephemeral beta security headers'],
    ['index.html', 'ephemeral beta document'],
    ['js/beta.js', 'ephemeral beta bootstrap script'],
  ].map(([destinationPath, contents]) => ({
    destination_path: destinationPath,
    sha256: access.hashBytes(Buffer.from(contents, 'utf8')),
  }));
  return {
    schema_version: '1.0.0',
    manifest_id: `elu-climate-public-beta-surface-${RELEASE_ID}`,
    beta_release_id: RELEASE_ID,
    publication_channel: 'climate_public_beta',
    assessed_production_authority: false,
    files,
  };
}

function makeApproval(state, level) {
  const approvedAt = level === 'invited_beta' ? at(5) : at(15);
  const validFrom = level === 'invited_beta' ? at(4) : at(14);
  return {
    beta_release_id: RELEASE_ID,
    publication_level: level,
    reviewed_commit_sha: level === 'invited_beta' ? '1'.repeat(40) : '2'.repeat(40),
    canonical_scope_sha256: state.scopeSha,
    expected_public_surface_manifest_sha256: state.surfaceSha,
    approved_at: approvedAt,
    valid_from: validFrom,
    valid_until: at(100),
    assessed_production_authority: false,
  };
}

function makeState() {
  const policy = makePolicy();
  assert.equal(policyEngine.validatePolicy(policy).status, 'pass',
    'fixture policy must conform before access-bootstrap tests run');
  const trust = makeTrust();
  assert.equal(policyEngine.evaluateTrustRegistry(trust.registry).status, 'pass',
    'ephemeral fixture registry must conform before access-bootstrap tests run');
  const surfaceManifest = makeSurfaceManifest();
  const state = {
    policy,
    generated: trust.generated,
    registry: trust.registry,
    reportSchema: readJson(REPORT_SCHEMA_PATH),
    signatureSchema: readJson(SIGNATURE_SCHEMA_PATH),
    surfaceManifest,
    surfaceSha: access.hashJson(surfaceManifest),
    scopeSha: access.hashBytes(Buffer.from('ephemeral canonical scope', 'utf8')),
    policySha: access.hashBytes(Buffer.from(jsonText(policy), 'utf8')),
    trustSha: access.hashBytes(Buffer.from(jsonText(trust.registry), 'utf8')),
    verificationTime: at(30),
    approvals: {},
  };
  access.LEVELS.forEach(level => {
    const approval = makeApproval(state, level);
    state.approvals[level] = {
      value: approval,
      path: policyEngine.approvalPath(RELEASE_ID, level),
      sha256: access.hashBytes(Buffer.from(jsonText(approval), 'utf8')),
    };
  });
  return state;
}

function makeReport(state, level, priorReportSha256) {
  const observedAt = level === 'invited_beta' ? at(10) : at(20);
  const probeAt = level === 'invited_beta' ? at(9) : at(19);
  const aliases = state.policy.approved_aliases[level];
  const deploymentOrigin = `https://holding-${level.replace('_', '-')}${state.policy.hosting_project.deployment_alias_hostname_suffix}`;
  const expected = access.expectedProbeRows([...aliases, deploymentOrigin].sort(), state.surfaceManifest);
  const operator = keyFor(state, 'beta_release_operator');
  const reviewer = keyFor(state, 'beta_rollback_reviewer');
  const approval = state.approvals[level];
  const holdingPage = Buffer.from('ephemeral access-locked holding page', 'utf8');
  const holdingHeaders = Buffer.from('ephemeral access-locked holding headers', 'utf8');
  const holdingSourceFiles = [
    { path: '_headers', sha256: access.hashBytes(holdingHeaders), bytes: holdingHeaders.length },
    { path: 'index.html', sha256: access.hashBytes(holdingPage), bytes: holdingPage.length },
  ];
  const report = {
    schema_version: '1.0.0',
    report_id: `elu-climate-public-beta-${RELEASE_ID}-${level}-access-bootstrap-v1`,
    repository: policyEngine.REPOSITORY,
    beta_release_id: RELEASE_ID,
    publication_level: level,
    policy_path: access.POLICY_PATH,
    policy_sha256: state.policySha,
    trust_registry_path: access.TRUST_PATH,
    trust_registry_sha256: state.trustSha,
    approval_path: approval.path,
    approval_sha256: approval.sha256,
    approval_reviewed_commit_sha: approval.value.reviewed_commit_sha,
    canonical_scope_sha256: approval.value.canonical_scope_sha256,
    expected_public_surface_manifest_sha256: state.surfaceSha,
    hosting_project: clone(state.policy.hosting_project),
    intended_origin: state.policy.approved_origins[level],
    intended_aliases: [...aliases],
    holding_deployment: {
      deployment_id: `urn:elu:ephemeral:${level}:holding-deployment`,
      deployment_reference: `urn:elu:ephemeral:${level}:holding-deployment-reference`,
      deployment_origin: deploymentOrigin,
      content_sha256: state.policy.hosting_project.holding_content_sha256,
      source_file_count: holdingSourceFiles.length,
      source_files: holdingSourceFiles,
      source_inventory_sha256: access.hashJson(holdingSourceFiles),
      contains_beta_release_bytes: false,
    },
    observation: {
      observed_at: observedAt,
      operator_identity: operator.identity,
      independent_reviewer_identity: reviewer.identity,
      project_configuration_checked: true,
      project_wide_access_lock_active: true,
      deployment_replacement_coverage_checked: true,
      unauthorized_probes: expected.map((row, index) => ({
        alias: row.alias,
        request_url: row.request_url,
        status: index === 0 ? 302 : 403,
        redirect_origin: index === 0 ? state.policy.unauthorized_access_policy.allowed_redirect_origins[0] : null,
        observed_at: probeAt,
      })),
      authorized_holding_probes: expected.map(row => ({
        alias: row.alias,
        request_url: row.request_url,
        destination_path: row.destination_path,
        status: row.destination_path === '/' || row.destination_path === '/index.html' ? 200 : 404,
        response_sha256: row.destination_path === '/' || row.destination_path === '/index.html'
          ? state.policy.hosting_project.holding_content_sha256
          : access.hashBytes(Buffer.from(`ephemeral holding 404:${level}:${row.destination_path}`, 'utf8')),
        matches_beta_release_bytes: false,
        observed_at: probeAt,
      })),
    },
    prior_bootstrap_report_sha256: level === 'invited_beta' ? null : priorReportSha256,
    result: 'pass',
    assessed_production_authority: false,
    calculation_hash: null,
  };
  report.calculation_hash = access.calculationHash(report);
  return report;
}

function signBundle(state, bundle) {
  bundle.signatures.forEach(signature => {
    const signer = keyFor(state, signature.role) || keyFor(state, 'beta_release_operator');
    signature.signature_base64 = crypto.sign(
      null,
      Buffer.from(access.signatureMessage(bundle, signature), 'utf8'),
      signer.privateKey,
    ).toString('base64');
  });
  return bundle;
}

function makeSignatureBundle(state, report, reportSha256) {
  const operator = keyFor(state, 'beta_release_operator');
  const reviewer = keyFor(state, 'beta_rollback_reviewer');
  const approval = state.approvals[report.publication_level];
  const bundle = {
    schema_version: '1.0.0',
    signature_bundle_id: `elu-climate-public-beta-${RELEASE_ID}-${report.publication_level}-access-bootstrap-signatures-v1`,
    domain: access.DOMAIN,
    repository: policyEngine.REPOSITORY,
    beta_release_id: RELEASE_ID,
    publication_level: report.publication_level,
    report_path: access.logicalReportPath(RELEASE_ID, report.publication_level),
    report_sha256: reportSha256,
    policy_path: access.POLICY_PATH,
    policy_sha256: state.policySha,
    trust_registry_path: access.TRUST_PATH,
    trust_registry_sha256: state.trustSha,
    approval_path: approval.path,
    approval_sha256: approval.sha256,
    signed_at: report.publication_level === 'invited_beta' ? at(11) : at(21),
    signatures: [operator, reviewer].map(item => ({
      role: item.role,
      identity: item.identity,
      key_id: item.authority.key_id,
      signature_base64: null,
    })),
  };
  return signBundle(state, bundle);
}

function levelDirectory(root, level) {
  return path.join(root, level);
}

function reportPath(root, level) {
  return path.join(levelDirectory(root, level), access.REPORT_FILENAME);
}

function signaturePath(root, level) {
  return path.join(levelDirectory(root, level), access.SIGNATURE_FILENAME);
}

function writeLevel(root, state, level, priorReportSha256) {
  const directory = levelDirectory(root, level);
  fs.mkdirSync(directory, { recursive: true });
  const report = makeReport(state, level, priorReportSha256);
  const reportText = jsonText(report);
  const reportSha256 = access.hashBytes(Buffer.from(reportText, 'utf8'));
  const bundle = makeSignatureBundle(state, report, reportSha256);
  fs.writeFileSync(reportPath(root, level), reportText);
  writeJson(signaturePath(root, level), bundle);
  return reportSha256;
}

function writeChain(parent, state, name) {
  const root = path.join(parent, name);
  fs.mkdirSync(root);
  const invitedSha = writeLevel(root, state, 'invited_beta', null);
  writeLevel(root, state, 'public_beta', invitedSha);
  return root;
}

function contextAdapter(state, mutate) {
  return level => {
    const approval = state.approvals[level];
    const context = {
      level,
      betaReleaseId: RELEASE_ID,
      policy: state.policy,
      policySha256: state.policySha,
      trustRegistry: state.registry,
      trustSha256: state.trustSha,
      approval: approval.value,
      approvalPath: approval.path,
      approvalSha256: approval.sha256,
      surfaceManifest: state.surfaceManifest,
      surfaceSha256: state.surfaceSha,
      verificationTime: state.verificationTime,
      schema: state.reportSchema,
      signatureSchema: state.signatureSchema,
    };
    if (mutate) mutate(context, level);
    return context;
  };
}

function updateReport(root, state, level, mutate, options = {}) {
  const absolute = reportPath(root, level);
  const report = readJson(absolute);
  mutate(report);
  if (options.recalculate !== false) report.calculation_hash = access.calculationHash(report);
  writeJson(absolute, report);
  if (options.resign === false) return;
  const bundle = readJson(signaturePath(root, level));
  bundle.report_sha256 = access.hashBytes(fs.readFileSync(absolute));
  signBundle(state, bundle);
  writeJson(signaturePath(root, level), bundle);
}

function updateBundle(root, state, level, mutate, options = {}) {
  const absolute = signaturePath(root, level);
  const bundle = readJson(absolute);
  mutate(bundle);
  if (options.resign !== false) signBundle(state, bundle);
  writeJson(absolute, bundle);
}

function selfTest() {
  const state = makeState();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-beta-access-bootstrap-self-test-'));
  const negativeCases = [];
  let positiveCases = 0;
  let caseNumber = 0;

  function makeHarness(requestedLevel = 'public_beta', requireCurrentFreshness = true) {
    caseNumber += 1;
    const root = writeChain(temp, state, `case-${caseNumber}`);
    const harness = {
      root,
      requestedLevel,
      adapter: contextAdapter(state),
      validate() {
        return access.validateChain({
          root: harness.root,
          requestedLevel: harness.requestedLevel,
          contextForLevel: harness.adapter,
          requireCurrentFreshness,
        });
      },
    };
    return harness;
  }

  function mustReject(id, mutate, requestedLevel = 'public_beta') {
    const harness = makeHarness(requestedLevel);
    mutate(harness);
    assert.throws(() => harness.validate(), Error,
      `access-bootstrap adversarial fixture did not fail closed: ${id}`);
    negativeCases.push(id);
  }

  try {
    const invited = makeHarness('invited_beta').validate();
    assert.equal(invited.status, 'pass');
    assert.deepEqual(invited.levels, ['invited_beta']);
    assert.equal(invited.assessed_production_authority, false);
    assert.equal(invited.deployment_or_publication_authority, false);
    positiveCases += 1;

    const publicChain = makeHarness('public_beta').validate();
    assert.equal(publicChain.status, 'pass');
    assert.deepEqual(publicChain.levels, ['invited_beta', 'public_beta']);
    assert.equal(publicChain.assessed_production_authority, false);
    assert.equal(publicChain.deployment_or_publication_authority, false);
    positiveCases += 1;

    const historicalInvited = makeHarness('public_beta');
    historicalInvited.adapter = contextAdapter(state, context => { context.verificationTime = at(315); });
    assert.equal(historicalInvited.validate().status, 'pass');
    positiveCases += 1;

    const publicationHistory = makeHarness('public_beta', false);
    publicationHistory.adapter = contextAdapter(state, context => { context.verificationTime = at(1000); });
    assert.equal(publicationHistory.validate().status, 'pass');
    positiveCases += 1;

    const readHarness = makeHarness('invited_beta');
    const records = access.readLevel(readHarness.root, 'invited_beta');
    assert.equal(records.report.value.result, 'pass');
    assert.equal(records.signatures.value.signatures.length, 2);
    positiveCases += 1;

    const operational = access.operationalAliases(records.report.value);
    assert.deepEqual(operational, [
      'https://elu-beta-access-self-test.pages.dev',
      'https://holding-invited-beta.elu-beta-access-self-test.pages.dev',
      'https://invited-access-alias.invalid',
      'https://invited-access.invalid',
    ]);
    assert.equal(access.expectedProbeRows(operational, state.surfaceManifest).length, 28);
    positiveCases += 1;

    mustReject('unauthorized-inventory-missing', h =>
      updateReport(h.root, state, 'invited_beta', report => report.observation.unauthorized_probes.pop()), 'invited_beta');
    mustReject('unauthorized-inventory-extra', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes.push(clone(report.observation.unauthorized_probes[0]))), 'invited_beta');
    mustReject('unauthorized-order-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        [report.observation.unauthorized_probes[0], report.observation.unauthorized_probes[1]] =
          [report.observation.unauthorized_probes[1], report.observation.unauthorized_probes[0]]), 'invited_beta');
    mustReject('unauthorized-alias-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].alias = report.intended_aliases[1]), 'invited_beta');
    mustReject('unauthorized-path-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].request_url += 'drift'), 'invited_beta');
    mustReject('authorized-inventory-missing', h =>
      updateReport(h.root, state, 'invited_beta', report => report.observation.authorized_holding_probes.pop()), 'invited_beta');
    mustReject('authorized-order-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        [report.observation.authorized_holding_probes[0], report.observation.authorized_holding_probes[1]] =
          [report.observation.authorized_holding_probes[1], report.observation.authorized_holding_probes[0]]), 'invited_beta');
    mustReject('authorized-destination-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes[0].destination_path = '/drift'), 'invited_beta');
    mustReject('intended-alias-order-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.intended_aliases.reverse()), 'invited_beta');

    mustReject('unauthorized-status-outside-policy', h =>
      updateReport(h.root, state, 'invited_beta', report => report.observation.unauthorized_probes[1].status = 404), 'invited_beta');
    mustReject('redirect-origin-missing', h =>
      updateReport(h.root, state, 'invited_beta', report => report.observation.unauthorized_probes[0].redirect_origin = null), 'invited_beta');
    mustReject('redirect-origin-is-beta-alias', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].redirect_origin = report.intended_aliases[0]), 'invited_beta');
    mustReject('redirect-origin-outside-policy', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].redirect_origin = 'https://outside-access.invalid'), 'invited_beta');
    mustReject('redirect-origin-is-deployment-origin', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].redirect_origin =
          report.holding_deployment.deployment_origin), 'invited_beta');
    mustReject('nonredirect-claims-redirect-origin', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[1].redirect_origin = 'https://access-gate.invalid'), 'invited_beta');
    mustReject('authorized-server-error', h =>
      updateReport(h.root, state, 'invited_beta', report => report.observation.authorized_holding_probes[1].status = 500), 'invited_beta');
    mustReject('authorized-response-hash-missing', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes[1].response_sha256 = null), 'invited_beta');

    mustReject('hosting-holding-hash-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.hosting_project.holding_content_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('holding-deployment-hash-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.holding_deployment.content_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('holding-deployment-contains-beta', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.holding_deployment.contains_beta_release_bytes = true), 'invited_beta');
    mustReject('holding-source-inventory-count-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.holding_deployment.source_file_count += 1), 'invited_beta');
    mustReject('holding-source-inventory-hash-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.holding_deployment.source_inventory_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('holding-source-inventory-omits-entry', h =>
      updateReport(h.root, state, 'invited_beta', report => {
        report.holding_deployment.source_files = report.holding_deployment.source_files
          .filter(file => file.path !== 'index.html');
        report.holding_deployment.source_file_count = report.holding_deployment.source_files.length;
        report.holding_deployment.source_inventory_sha256 =
          access.hashJson(report.holding_deployment.source_files);
      }), 'invited_beta');
    mustReject('holding-source-inventory-contains-beta-bytes', h =>
      updateReport(h.root, state, 'invited_beta', report => {
        report.holding_deployment.source_files[0].sha256 = state.surfaceManifest.files[0].sha256;
        report.holding_deployment.source_inventory_sha256 =
          access.hashJson(report.holding_deployment.source_files);
      }), 'invited_beta');
    mustReject('holding-service-worker-present', h =>
      updateReport(h.root, state, 'invited_beta', report => {
        const probe = report.observation.authorized_holding_probes
          .find(item => item.destination_path === '/sw.js');
        probe.status = 200;
        probe.response_sha256 = report.hosting_project.holding_content_sha256;
      }), 'invited_beta');
    mustReject('holding-service-worker-probe-omitted', h =>
      updateReport(h.root, state, 'invited_beta', report => {
        report.observation.authorized_holding_probes = report.observation.authorized_holding_probes
          .filter(item => item.destination_path !== '/sw.js');
      }), 'invited_beta');
    mustReject('holding-root-bytes-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes.find(item => item.destination_path === '/').response_sha256 =
          'a'.repeat(64)), 'invited_beta');
    mustReject('holding-matches-beta-same-path', h =>
      updateReport(h.root, state, 'invited_beta', report => {
        const probe = report.observation.authorized_holding_probes.find(item => item.destination_path === '/js/beta.js');
        probe.response_sha256 = state.surfaceManifest.files.find(item => item.destination_path === 'js/beta.js').sha256;
      }), 'invited_beta');
    mustReject('holding-matches-beta-cross-path', h =>
      updateReport(h.root, state, 'invited_beta', report => {
        const probe = report.observation.authorized_holding_probes.find(item => item.destination_path === '/js/beta.js');
        probe.response_sha256 = state.surfaceManifest.files.find(item => item.destination_path === 'index.html').sha256;
      }), 'invited_beta');
    mustReject('holding-match-claim-true', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes[1].matches_beta_release_bytes = true), 'invited_beta');

    mustReject('hosting-project-id-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.hosting_project.project_id += ':drift'), 'invited_beta');
    mustReject('hosting-pages-origin-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.hosting_project.pages_dev_origin = 'https://other-project.pages.dev'), 'invited_beta');
    mustReject('hosting-deployment-suffix-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.hosting_project.deployment_alias_hostname_suffix = '.other-project.pages.dev'), 'invited_beta');
    mustReject('hosting-provider-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.hosting_project.provider = 'other_provider'), 'invited_beta');
    mustReject('hosting-access-scope-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.hosting_project.access_scope = 'single_deployment'), 'invited_beta');
    mustReject('policy-binding-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.policy_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('trust-binding-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.trust_registry_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('approval-path-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.approval_path += '.drift'), 'invited_beta');
    mustReject('approval-hash-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.approval_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('approval-commit-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.approval_reviewed_commit_sha = '3'.repeat(40)), 'invited_beta');
    mustReject('canonical-scope-binding-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.canonical_scope_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('surface-binding-drift', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.expected_public_surface_manifest_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('holding-deployment-origin-outside-project', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.holding_deployment.deployment_origin = 'https://holding.other-project.pages.dev'), 'invited_beta');
    mustReject('holding-deployment-origin-is-stable-alias', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.holding_deployment.deployment_origin = report.intended_aliases[0]), 'invited_beta');
    mustReject('holding-deployment-unauthorized-probes-omitted', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes = report.observation.unauthorized_probes.filter(probe =>
          probe.alias !== report.holding_deployment.deployment_origin)), 'invited_beta');
    mustReject('holding-deployment-authorized-probes-omitted', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes = report.observation.authorized_holding_probes.filter(probe =>
          probe.alias !== report.holding_deployment.deployment_origin)), 'invited_beta');
    mustReject('intended-origin-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.intended_origin = 'https://other-origin.invalid'), 'invited_beta');

    mustReject('observation-in-future', h =>
      updateReport(h.root, state, 'invited_beta', report => report.observation.observed_at = at(31)), 'invited_beta');
    mustReject('observation-before-bound-approval', h => {
      h.adapter = contextAdapter(state, context => { context.approval = { ...context.approval, approved_at: at(11) }; });
    }, 'invited_beta');
    mustReject('observation-after-approval-validity', h => {
      h.adapter = contextAdapter(state, context => { context.approval = { ...context.approval, valid_until: at(10) }; });
    }, 'invited_beta');
    mustReject('observation-stale-at-verification', h => {
      h.adapter = contextAdapter(state, context => { context.verificationTime = at(311); });
    }, 'invited_beta');
    mustReject('signature-at-approval-expiry', h => {
      h.adapter = contextAdapter(state, context => { context.approval = { ...context.approval, valid_until: at(11) }; });
    }, 'invited_beta');
    mustReject('unauthorized-probe-after-observation', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].observed_at = at(12)), 'invited_beta');
    mustReject('unauthorized-probe-before-approval', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].observed_at = at(4)), 'invited_beta');
    mustReject('unauthorized-probe-stale-at-observation', h => {
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.unauthorized_probes[0].observed_at = at(-291));
      h.adapter = contextAdapter(state, context => {
        context.approval = { ...context.approval, approved_at: at(-400), valid_from: at(-400) };
      });
    }, 'invited_beta');
    mustReject('authorized-probe-after-observation', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes[0].observed_at = at(12)), 'invited_beta');
    mustReject('authorized-probe-before-approval', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes[0].observed_at = at(4)), 'invited_beta');
    mustReject('authorized-probe-stale-at-observation', h => {
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.authorized_holding_probes[0].observed_at = at(-291));
      h.adapter = contextAdapter(state, context => {
        context.approval = { ...context.approval, approved_at: at(-400), valid_from: at(-400) };
      });
    }, 'invited_beta');
    mustReject('operator-reviewer-not-independent', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.independent_reviewer_identity = report.observation.operator_identity), 'invited_beta');
    mustReject('invalid-reviewer-identity', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.independent_reviewer_identity = 'placeholder reviewer'), 'invited_beta');
    mustReject('signature-before-observation', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => bundle.signed_at = at(9)), 'invited_beta');
    mustReject('signature-in-future', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => bundle.signed_at = at(31)), 'invited_beta');
    mustReject('public-observation-predates-signed-invited', h =>
      updateReport(h.root, state, 'public_beta', report => {
        report.observation.observed_at = at(10);
        report.observation.unauthorized_probes.forEach(item => { item.observed_at = at(9); });
        report.observation.authorized_holding_probes.forEach(item => { item.observed_at = at(9); });
      }));
    mustReject('invited-prior-bootstrap-claimed', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.prior_bootstrap_report_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('public-prior-bootstrap-drift', h =>
      updateReport(h.root, state, 'public_beta', report =>
        report.prior_bootstrap_report_sha256 = 'a'.repeat(64)));

    mustReject('report-calculation-hash-drift', h =>
      updateReport(h.root, state, 'invited_beta', report => report.calculation_hash = 'a'.repeat(64),
        { recalculate: false }), 'invited_beta');
    mustReject('report-extra-field', h =>
      updateReport(h.root, state, 'invited_beta', report => { report.extra = true; }), 'invited_beta');
    mustReject('report-raw-bytes-changed-after-signing', h =>
      fs.appendFileSync(reportPath(h.root, 'invited_beta'), ' '), 'invited_beta');
    mustReject('report-assessed-authority-claimed', h =>
      updateReport(h.root, state, 'invited_beta', report => report.assessed_production_authority = true), 'invited_beta');
    mustReject('report-result-not-pass', h =>
      updateReport(h.root, state, 'invited_beta', report => report.result = 'fail'), 'invited_beta');
    mustReject('project-lock-not-observed', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.observation.project_wide_access_lock_active = false), 'invited_beta');
    mustReject('deployment-reference-placeholder', h =>
      updateReport(h.root, state, 'invited_beta', report =>
        report.holding_deployment.deployment_reference = 'placeholder deployment'), 'invited_beta');

    mustReject('bundle-report-hash-drift', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => bundle.report_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('bundle-report-path-drift', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => bundle.report_path += '.drift'), 'invited_beta');
    mustReject('bundle-approval-binding-drift', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => bundle.approval_sha256 = 'a'.repeat(64)), 'invited_beta');
    mustReject('bundle-extra-field', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => { bundle.extra = true; }), 'invited_beta');
    mustReject('operator-signature-bitflip', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => {
        bundle.signatures[0].signature_base64 = signatureBitflip(bundle.signatures[0].signature_base64);
      }, { resign: false }), 'invited_beta');
    mustReject('signature-missing', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => bundle.signatures.pop(), { resign: false }), 'invited_beta');
    mustReject('signature-order-drift', h =>
      updateBundle(h.root, state, 'invited_beta', bundle => bundle.signatures.reverse(), { resign: false }), 'invited_beta');
    mustReject('signature-identity-drift', h =>
      updateBundle(h.root, state, 'invited_beta', bundle =>
        bundle.signatures[0].identity = 'urn:elu:ephemeral:other-operator'), 'invited_beta');
    mustReject('signature-role-drift', h =>
      updateBundle(h.root, state, 'invited_beta', bundle =>
        bundle.signatures[0].role = 'beta_data_reviewer'), 'invited_beta');
    mustReject('wrong-provisioned-key', h =>
      updateBundle(h.root, state, 'invited_beta', bundle =>
        bundle.signatures[0].key_id = keyFor(state, 'beta_rollback_reviewer').authority.key_id), 'invited_beta');
    mustReject('unprovisioned-key', h =>
      updateBundle(h.root, state, 'invited_beta', bundle =>
        bundle.signatures[0].key_id = 'ed25519:' + 'a'.repeat(64)), 'invited_beta');
    mustReject('trust-role-missing', h => {
      const registry = clone(state.registry);
      registry.authorities.pop();
      registry.status = 'incomplete';
      h.adapter = contextAdapter(state, context => { context.trustRegistry = registry; });
    }, 'invited_beta');
    mustReject('trust-key-revoked', h => {
      const registry = clone(state.registry);
      const authority = registry.authorities.find(item => item.role === 'beta_release_operator');
      authority.status = 'revoked';
      authority.revoked_at = at(5);
      h.adapter = contextAdapter(state, context => { context.trustRegistry = registry; });
    }, 'invited_beta');

    mustReject('relative-evidence-root', h => {
      h.root = path.relative(process.cwd(), h.root);
    }, 'invited_beta');
    mustReject('symlink-evidence-root', h => {
      const link = path.join(temp, `root-link-${caseNumber}`);
      fs.symlinkSync(h.root, link, 'dir');
      h.root = link;
    }, 'invited_beta');
    mustReject('extra-root-entry', h => fs.writeFileSync(path.join(h.root, 'unexpected.txt'), 'ephemeral'), 'invited_beta');
    mustReject('symlink-level-directory', h => {
      const original = levelDirectory(h.root, 'invited_beta');
      const moved = path.join(temp, `moved-level-${caseNumber}`);
      fs.renameSync(original, moved);
      fs.symlinkSync(moved, original, 'dir');
    }, 'invited_beta');
    mustReject('symlink-report-file', h => {
      const original = reportPath(h.root, 'invited_beta');
      const target = path.join(temp, `report-target-${caseNumber}.json`);
      fs.copyFileSync(original, target);
      fs.unlinkSync(original);
      fs.symlinkSync(target, original, 'file');
    }, 'invited_beta');
    mustReject('symlink-signature-file', h => {
      const original = signaturePath(h.root, 'invited_beta');
      const target = path.join(temp, `signature-target-${caseNumber}.json`);
      fs.copyFileSync(original, target);
      fs.unlinkSync(original);
      fs.symlinkSync(target, original, 'file');
    }, 'invited_beta');
    mustReject('extra-level-file', h =>
      fs.writeFileSync(path.join(levelDirectory(h.root, 'invited_beta'), 'unexpected.txt'), 'ephemeral'), 'invited_beta');
    mustReject('missing-signature-file', h => fs.unlinkSync(signaturePath(h.root, 'invited_beta')), 'invited_beta');
    mustReject('missing-public-level', h =>
      fs.rmSync(levelDirectory(h.root, 'public_beta'), { recursive: true }));
    mustReject('context-adapter-level-drift', h => {
      h.adapter = () => ({ ...contextAdapter(state)('invited_beta'), level: 'public_beta' });
    }, 'invited_beta');

    assert.equal(new Set(negativeCases).size, negativeCases.length, 'adversarial case IDs must be unique');
    const result = {
      status: 'pass',
      checker: 'climate_public_beta_access_bootstrap',
      fixture_only: true,
      ephemeral_ed25519_keys: true,
      real_identity_or_authority: false,
      deployment_or_publication_authority: false,
      assessed_production_authority: false,
      positive_cases: positiveCases,
      fail_closed_cases: negativeCases.length,
      fail_closed_case_ids: negativeCases,
    };
    process.stdout.write(jsonText(result));
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length !== 1 || argv[0] !== '--self-test') throw new Error(usage());
  selfTest();
}

try {
  main();
} catch (error) {
  process.stderr.write(`climate public beta access-bootstrap check failed: ${error.message}\n`);
  process.exitCode = 1;
}
