'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const policyEngine = require('./climate-public-beta-policy');
const { parseJsonNoDuplicateKeys, same, validateJsonSchema } = require('./json-schema-lite');

const DOMAIN = 'ELU-CLIMATE-PUBLIC-BETA-ACCESS-BOOTSTRAP-V1';
const REPORT_FILENAME = 'access-bootstrap-report.json';
const SIGNATURE_FILENAME = 'access-bootstrap-report.signatures.json';
const LEVELS = Object.freeze(['invited_beta', 'public_beta']);
const SIGNER_ROLES = Object.freeze(['beta_release_operator', 'beta_rollback_reviewer']);
const POLICY_PATH = 'data/climate/public-beta/governance/policy.json';
const TRUST_PATH = 'data/climate/public-beta/governance/approval-trust.json';
const SHA256 = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const HOLDING_CANARY_PATHS = Object.freeze([
  '/__elu_access_canary__',
  '/data/climate/runtime/candidate-manifest.json',
  '/sw.js',
]);

const REPORT_KEYS = Object.freeze([
  'schema_version', 'report_id', 'repository', 'beta_release_id',
  'publication_level', 'policy_path', 'policy_sha256', 'trust_registry_path',
  'trust_registry_sha256', 'approval_path', 'approval_sha256',
  'approval_reviewed_commit_sha', 'canonical_scope_sha256',
  'expected_public_surface_manifest_sha256', 'hosting_project',
  'intended_origin', 'intended_aliases', 'holding_deployment', 'observation',
  'prior_bootstrap_report_sha256', 'result', 'assessed_production_authority',
  'calculation_hash',
]);
const HOSTING_KEYS = Object.freeze([
  'provider', 'project_id', 'production_branch', 'access_scope',
  'access_policy_reference', 'pages_dev_origin',
  'deployment_alias_hostname_suffix', 'holding_content_sha256',
  'deployment_replacement_lock_required',
]);
const HOLDING_KEYS = Object.freeze([
  'deployment_id', 'deployment_reference', 'deployment_origin', 'content_sha256',
  'source_file_count', 'source_files', 'source_inventory_sha256', 'contains_beta_release_bytes',
]);
const HOLDING_SOURCE_FILE_KEYS = Object.freeze(['path', 'sha256', 'bytes']);
const OBSERVATION_KEYS = Object.freeze([
  'observed_at', 'operator_identity', 'independent_reviewer_identity',
  'project_configuration_checked', 'project_wide_access_lock_active',
  'deployment_replacement_coverage_checked', 'unauthorized_probes',
  'authorized_holding_probes',
]);
const UNAUTHORIZED_KEYS = Object.freeze([
  'alias', 'request_url', 'status', 'redirect_origin', 'observed_at',
]);
const AUTHORIZED_KEYS = Object.freeze([
  'alias', 'request_url', 'destination_path', 'status', 'response_sha256',
  'matches_beta_release_bytes', 'observed_at',
]);
const BUNDLE_KEYS = Object.freeze([
  'schema_version', 'signature_bundle_id', 'domain', 'repository',
  'beta_release_id', 'publication_level', 'report_path', 'report_sha256',
  'policy_path', 'policy_sha256', 'trust_registry_path',
  'trust_registry_sha256', 'approval_path', 'approval_sha256', 'signed_at',
  'signatures',
]);
const SIGNATURE_KEYS = Object.freeze(['role', 'identity', 'key_id', 'signature_base64']);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function canonicalJson(value) {
  return JSON.stringify(stable(value));
}

function hashBytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hashJson(value) {
  return hashBytes(Buffer.from(canonicalJson(value), 'utf8'));
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert(same(Object.keys(value).sort(), expected.slice().sort()), `${label} has unexpected fields`);
}

function validTimestamp(value) {
  if (!policyEngine.validTimestamp(value)) return false;
  return new Date(value).toISOString() === value;
}

function validReference(value) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 && value.length <= 512 &&
    !/[\u0000-\u001f\u007f]/.test(value) &&
    !/(?:^|[\s@._-])(fake|invented|unknown|example|placeholder|tbd|todo)(?:$|[\s@._-])/i.test(value);
}

function exactSortedStrings(values, expected, label) {
  assert(Array.isArray(values) && same(values, expected), `${label} must be the exact sorted set`);
}

function logicalReportPath(releaseId, level) {
  assert(policyEngine.validReleaseId(releaseId), 'invalid access-bootstrap release ID');
  assert(LEVELS.includes(level), 'invalid access-bootstrap level');
  return `private-evidence/climate-public-beta/${releaseId}/${level}/${REPORT_FILENAME}`;
}

function signatureMessage(bundle, signature) {
  return DOMAIN + '\n' + canonicalJson({
    repository: bundle.repository,
    beta_release_id: bundle.beta_release_id,
    publication_level: bundle.publication_level,
    report_path: bundle.report_path,
    report_sha256: bundle.report_sha256,
    policy_path: bundle.policy_path,
    policy_sha256: bundle.policy_sha256,
    trust_registry_path: bundle.trust_registry_path,
    trust_registry_sha256: bundle.trust_registry_sha256,
    approval_path: bundle.approval_path,
    approval_sha256: bundle.approval_sha256,
    signed_at: bundle.signed_at,
    role: signature.role,
    identity: signature.identity,
    key_id: signature.key_id,
  });
}

function calculationHash(report) {
  return hashJson({ ...report, calculation_hash: null });
}

function safeRelative(value) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= 512 &&
    !value.includes('\\') && !value.includes('\0') && !value.startsWith('/'),
  'holding source inventory path is unsafe');
  const segments = value.split('/');
  assert(segments.every(segment => segment && segment !== '.' && segment !== '..'),
    'holding source inventory path is unsafe');
  return value;
}

function requestPaths(surfaceManifest) {
  const files = Array.isArray(surfaceManifest?.files) ? surfaceManifest.files : [];
  const paths = ['/', ...HOLDING_CANARY_PATHS, ...files.map(file => '/' + file.destination_path)];
  return [...new Set(paths)].sort();
}

function expectedProbeRows(aliases, surfaceManifest) {
  const paths = requestPaths(surfaceManifest);
  return aliases.flatMap(alias => paths.map(destinationPath => ({
    alias,
    destination_path: destinationPath,
    request_url: new URL(destinationPath, alias).toString(),
  }))).sort((left, right) => {
    if (left.alias !== right.alias) return left.alias < right.alias ? -1 : 1;
    return left.destination_path < right.destination_path ? -1 : left.destination_path > right.destination_path ? 1 : 0;
  });
}

function deploymentOriginMatchesSuffix(origin, suffix) {
  if (!policyEngine.validOrigin(origin) || typeof suffix !== 'string') return false;
  const hostname = new URL(origin).hostname;
  if (!hostname.endsWith(suffix)) return false;
  const deploymentLabel = hostname.slice(0, -suffix.length);
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(deploymentLabel) &&
    !deploymentLabel.includes('.');
}

function operationalAliases(report) {
  return [...new Set([
    ...(Array.isArray(report?.intended_aliases) ? report.intended_aliases : []),
    report?.holding_deployment?.deployment_origin,
  ].filter(Boolean))].sort();
}

function betaHashByDestination(surfaceManifest) {
  return new Map((surfaceManifest.files || []).map(file => ['/' + file.destination_path, file.sha256]));
}

function validateUnauthorizedProbes(report, policy, approval, surfaceManifest) {
  const probes = report.observation.unauthorized_probes;
  const aliases = operationalAliases(report);
  const expected = expectedProbeRows(aliases, surfaceManifest);
  assert(Array.isArray(probes) && probes.length === expected.length,
    'access-bootstrap unauthorized probe inventory is incomplete');
  assert(probes.length >= policy.frozen_thresholds.unauthorized_access_test_count,
    'access-bootstrap unauthorized probe count is below the frozen minimum');
  probes.forEach((probe, index) => {
    exactKeys(probe, UNAUTHORIZED_KEYS, `unauthorized probe ${index}`);
    const wanted = expected[index];
    assert(probe.alias === wanted.alias && probe.request_url === wanted.request_url,
      'access-bootstrap unauthorized probe ordering/path drift');
    assert(policy.unauthorized_access_policy.allowed_statuses.includes(probe.status),
      'access-bootstrap unauthorized probe status is outside policy');
    const redirect = [301, 302, 303, 307, 308].includes(probe.status);
    if (redirect) {
      assert(policyEngine.validOrigin(probe.redirect_origin) &&
        policy.unauthorized_access_policy.allowed_redirect_origins.includes(probe.redirect_origin) &&
        !aliases.includes(probe.redirect_origin),
      'access-bootstrap redirect origin is not the frozen external Access origin');
    } else {
      assert(probe.redirect_origin === null, 'non-redirect access-bootstrap probe must not record a redirect origin');
    }
    assert(validTimestamp(probe.observed_at) &&
      new Date(probe.observed_at) >= new Date(approval.approved_at) &&
      new Date(probe.observed_at) >= new Date(approval.valid_from) &&
      new Date(probe.observed_at) <= new Date(report.observation.observed_at),
    'access-bootstrap unauthorized probe time is invalid or later than the observation');
    assert(new Date(report.observation.observed_at) - new Date(probe.observed_at) <=
      policy.frozen_thresholds.remote_probe_interval_seconds * 1000,
    'access-bootstrap unauthorized probe is older than the frozen remote-probe interval');
  });
}

function validateAuthorizedProbes(report, policy, approval, surfaceManifest) {
  const probes = report.observation.authorized_holding_probes;
  const expected = expectedProbeRows(operationalAliases(report), surfaceManifest);
  const betaHashes = new Set(betaHashByDestination(surfaceManifest).values());
  assert(Array.isArray(probes) && probes.length === expected.length,
    'access-bootstrap authorized holding probe inventory is incomplete');
  assert(probes.length >= policy.frozen_thresholds.authorized_access_test_count,
    'access-bootstrap authorized holding probe count is below the frozen minimum');
  probes.forEach((probe, index) => {
    exactKeys(probe, AUTHORIZED_KEYS, `authorized holding probe ${index}`);
    const wanted = expected[index];
    assert(probe.alias === wanted.alias && probe.request_url === wanted.request_url &&
      probe.destination_path === wanted.destination_path,
    'access-bootstrap authorized probe ordering/path drift');
    const successful = Number.isInteger(probe.status) && probe.status >= 200 && probe.status < 300;
    const absent = probe.status === 404;
    assert(successful || absent,
      'access-bootstrap authorized holding probe must return the holding page or a bound 404');
    assert(SHA256.test(probe.response_sha256 || ''),
      'successful access-bootstrap authorized probe must bind response bytes');
    assert(!betaHashes.has(probe.response_sha256),
      'access-bootstrap holding deployment already serves approved beta bytes');
    if (probe.destination_path === '/' || probe.destination_path === '/index.html') {
      assert(successful, 'access-bootstrap holding entry point must be reachable to an authorized reviewer');
      assert(probe.response_sha256 === report.hosting_project.holding_content_sha256,
        'access-bootstrap holding page bytes differ from frozen policy');
    } else if (successful) {
      assert(probe.response_sha256 === report.hosting_project.holding_content_sha256,
        'successful non-entry holding response must be the exact frozen holding page');
    }
    if (probe.destination_path === '/sw.js') {
      assert(probe.status === 404, 'access-bootstrap holding deployment must not serve a service worker');
    }
    assert(probe.matches_beta_release_bytes === false,
      'access-bootstrap authorized probe cannot match beta release bytes');
    assert(validTimestamp(probe.observed_at) &&
      new Date(probe.observed_at) >= new Date(approval.approved_at) &&
      new Date(probe.observed_at) >= new Date(approval.valid_from) &&
      new Date(probe.observed_at) <= new Date(report.observation.observed_at),
    'access-bootstrap authorized probe time is invalid or later than the observation');
    assert(new Date(report.observation.observed_at) - new Date(probe.observed_at) <=
      policy.frozen_thresholds.remote_probe_interval_seconds * 1000,
    'access-bootstrap authorized probe is older than the frozen remote-probe interval');
  });
}

function validateReport(report, context) {
  exactKeys(report, REPORT_KEYS, 'access-bootstrap report');
  const schemaErrors = context.schema ? validateJsonSchema(report, context.schema) : [];
  assert(schemaErrors.length === 0, `access-bootstrap report schema failure: ${schemaErrors[0]}`);
  const level = context.level;
  const releaseId = context.betaReleaseId;
  const policy = context.policy;
  const approval = context.approval;
  const surfaceManifest = context.surfaceManifest;
  assert(report.schema_version === '1.0.0' && report.repository === policyEngine.REPOSITORY &&
    report.beta_release_id === releaseId && report.publication_level === level &&
    report.report_id === `elu-climate-public-beta-${releaseId}-${level}-access-bootstrap-v1`,
  'access-bootstrap report identity mismatch');
  assert(report.result === 'pass' && report.assessed_production_authority === false,
    'access-bootstrap report cannot grant assessed or release authority');
  assert(report.calculation_hash === calculationHash(report),
    'access-bootstrap report calculation hash mismatch');
  assert(report.policy_path === POLICY_PATH && report.policy_sha256 === context.policySha256 &&
    report.trust_registry_path === TRUST_PATH && report.trust_registry_sha256 === context.trustSha256,
  'access-bootstrap policy/trust byte binding mismatch');
  assert(report.approval_path === context.approvalPath && report.approval_sha256 === context.approvalSha256 &&
    report.approval_reviewed_commit_sha === approval.reviewed_commit_sha &&
    COMMIT.test(report.approval_reviewed_commit_sha || ''),
  'access-bootstrap approval binding mismatch');
  assert(report.canonical_scope_sha256 === approval.canonical_scope_sha256 &&
    report.expected_public_surface_manifest_sha256 === approval.expected_public_surface_manifest_sha256 &&
    report.expected_public_surface_manifest_sha256 === context.surfaceSha256,
  'access-bootstrap scope/surface binding mismatch');
  exactKeys(report.hosting_project, HOSTING_KEYS, 'access-bootstrap hosting project');
  assert(same(report.hosting_project, policy.hosting_project),
    'access-bootstrap hosting project differs from frozen policy');
  assert(report.intended_origin === policy.approved_origins[level] &&
    same(report.intended_aliases, policy.approved_aliases[level]),
  'access-bootstrap level origin/alias binding mismatch');
  exactKeys(report.holding_deployment, HOLDING_KEYS, 'access-bootstrap holding deployment');
  const sourceFiles = report.holding_deployment.source_files;
  assert(Array.isArray(sourceFiles) && sourceFiles.length > 0 &&
    report.holding_deployment.source_file_count === sourceFiles.length,
  'access-bootstrap holding source inventory count is invalid');
  let priorSourcePath = null;
  const betaHashes = new Set(betaHashByDestination(surfaceManifest).values());
  sourceFiles.forEach((file, index) => {
    exactKeys(file, HOLDING_SOURCE_FILE_KEYS, `holding source file ${index}`);
    safeRelative(file.path);
    assert(priorSourcePath === null || file.path > priorSourcePath,
      'access-bootstrap holding source inventory must be strictly path-sorted');
    assert(SHA256.test(file.sha256 || '') && Number.isInteger(file.bytes) && file.bytes >= 0 &&
      !betaHashes.has(file.sha256),
    'access-bootstrap holding source inventory contains invalid or beta-release bytes');
    priorSourcePath = file.path;
  });
  const holdingIndex = sourceFiles.find(file => file.path === 'index.html');
  assert(holdingIndex && holdingIndex.sha256 === policy.hosting_project.holding_content_sha256 &&
    report.holding_deployment.source_inventory_sha256 === hashJson(sourceFiles),
  'access-bootstrap holding source inventory is incomplete or hash-drifted');
  assert(validReference(report.holding_deployment.deployment_id) &&
    validReference(report.holding_deployment.deployment_reference) &&
    deploymentOriginMatchesSuffix(report.holding_deployment.deployment_origin,
      policy.hosting_project.deployment_alias_hostname_suffix) &&
    !report.intended_aliases.includes(report.holding_deployment.deployment_origin) &&
    report.holding_deployment.content_sha256 === policy.hosting_project.holding_content_sha256 &&
    report.holding_deployment.contains_beta_release_bytes === false,
  'access-bootstrap holding deployment is not the frozen beta-free target');
  exactKeys(report.observation, OBSERVATION_KEYS, 'access-bootstrap observation');
  assert(validTimestamp(report.observation.observed_at) &&
    new Date(report.observation.observed_at) <= new Date(context.verificationTime),
  'access-bootstrap observation time is invalid or in the future');
  assert(validTimestamp(approval.approved_at) && validTimestamp(approval.valid_from) &&
    validTimestamp(approval.valid_until) &&
    new Date(report.observation.observed_at) >= new Date(approval.approved_at) &&
    new Date(report.observation.observed_at) >= new Date(approval.valid_from) &&
    new Date(report.observation.observed_at) < new Date(approval.valid_until),
  'access-bootstrap observation does not follow the exact valid approval');
  if (context.currentFreshnessRequired === true) {
    const observationAgeMs = new Date(context.verificationTime) - new Date(report.observation.observed_at);
    assert(observationAgeMs >= 0 &&
      observationAgeMs <= policy.frozen_thresholds.remote_probe_interval_seconds * 1000,
    'current access-bootstrap observation is older than the frozen remote-probe interval');
  }
  assert(policyEngine.validIdentity(report.observation.operator_identity) &&
    policyEngine.validIdentity(report.observation.independent_reviewer_identity) &&
    report.observation.operator_identity !== report.observation.independent_reviewer_identity,
  'access-bootstrap operator/reviewer identities are invalid or not independent');
  assert(report.observation.project_configuration_checked === true &&
    report.observation.project_wide_access_lock_active === true &&
    report.observation.deployment_replacement_coverage_checked === true,
  'access-bootstrap project-wide replacement-safe lock was not observed');
  validateUnauthorizedProbes(report, policy, approval, surfaceManifest);
  validateAuthorizedProbes(report, policy, approval, surfaceManifest);
  if (level === 'invited_beta') {
    assert(report.prior_bootstrap_report_sha256 === null,
      'invited access-bootstrap report cannot claim a prior bootstrap');
  } else {
    assert(context.priorReportSha256 && report.prior_bootstrap_report_sha256 === context.priorReportSha256,
      'public access-bootstrap report does not bind the exact invited bootstrap');
  }
  return report;
}

function canonicalSignature(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) return null;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 64 && bytes.toString('base64') === value ? bytes : null;
}

function authorityFor(registry, signature, signedAt) {
  const authority = Array.isArray(registry?.authorities) ? registry.authorities.find(item =>
    item.role === signature.role && item.identity === signature.identity && item.key_id === signature.key_id) : null;
  if (!authority || authority.status !== 'active' || authority.revoked_at !== null ||
      !validTimestamp(signedAt) || new Date(signedAt) < new Date(authority.valid_from) ||
      new Date(signedAt) >= new Date(authority.valid_until)) return null;
  const parsed = policyEngine.publicKeyRecord(authority);
  return parsed.ok ? parsed.key : null;
}

function validateSignatureBundle(bundle, reportRecord, context) {
  exactKeys(bundle, BUNDLE_KEYS, 'access-bootstrap signature bundle');
  const schemaErrors = context.signatureSchema
    ? validateJsonSchema(bundle, context.signatureSchema)
    : [];
  assert(schemaErrors.length === 0, `access-bootstrap signature schema failure: ${schemaErrors[0]}`);
  const report = reportRecord.value;
  assert(bundle.schema_version === '1.0.0' && bundle.domain === DOMAIN &&
    bundle.repository === policyEngine.REPOSITORY &&
    bundle.signature_bundle_id === `elu-climate-public-beta-${report.beta_release_id}-${report.publication_level}-access-bootstrap-signatures-v1` &&
    bundle.beta_release_id === report.beta_release_id && bundle.publication_level === report.publication_level,
  'access-bootstrap signature-bundle identity mismatch');
  assert(bundle.report_path === logicalReportPath(report.beta_release_id, report.publication_level) &&
    bundle.report_sha256 === reportRecord.sha256 && bundle.policy_path === POLICY_PATH &&
    bundle.policy_sha256 === context.policySha256 && bundle.trust_registry_path === TRUST_PATH &&
    bundle.trust_registry_sha256 === context.trustSha256 &&
    bundle.approval_path === context.approvalPath && bundle.approval_sha256 === context.approvalSha256,
  'access-bootstrap signature-bundle byte bindings mismatch');
  assert(validTimestamp(bundle.signed_at) && new Date(bundle.signed_at) >= new Date(report.observation.observed_at) &&
    new Date(bundle.signed_at) >= new Date(context.approval.approved_at) &&
    new Date(bundle.signed_at) < new Date(context.approval.valid_until) &&
    new Date(bundle.signed_at) <= new Date(context.verificationTime),
  'access-bootstrap signatures are not chronologically valid');
  assert(new Date(bundle.signed_at) - new Date(report.observation.observed_at) <=
    context.policy.frozen_thresholds.remote_probe_interval_seconds * 1000,
  'access-bootstrap report was not signed within the frozen remote-probe interval');
  assert(Array.isArray(bundle.signatures) && bundle.signatures.length === 2,
    'access-bootstrap requires exactly two detached signatures');
  const identities = [report.observation.operator_identity, report.observation.independent_reviewer_identity];
  bundle.signatures.forEach((signature, index) => {
    exactKeys(signature, SIGNATURE_KEYS, `access-bootstrap signature ${index}`);
    assert(signature.role === SIGNER_ROLES[index] && signature.identity === identities[index],
      'access-bootstrap signature role/identity set mismatch');
    const key = authorityFor(context.trustRegistry, signature, bundle.signed_at);
    const bytes = canonicalSignature(signature.signature_base64);
    let verified = false;
    try {
      verified = Boolean(key && bytes && crypto.verify(
        null,
        Buffer.from(signatureMessage(bundle, signature), 'utf8'),
        key,
        bytes,
      ));
    } catch (_) { verified = false; }
    assert(verified, `access-bootstrap detached signature failed: ${signature.role}`);
  });
  assert(new Set(bundle.signatures.map(item => item.key_id)).size === 2,
    'access-bootstrap operator and reviewer must use distinct provisioned keys');
  return bundle;
}

function readRegularJson(absolute, label) {
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular non-symlink file`);
  const bytes = fs.readFileSync(absolute);
  assert(bytes.length > 0 && bytes.length <= 32 * 1024 * 1024, `${label} byte size is invalid`);
  let value;
  try { value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), label); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
  return { absolute, bytes, text: bytes.toString('utf8'), value, sha256: hashBytes(bytes) };
}

function assertSafeRoot(root) {
  assert(path.isAbsolute(root), 'access-bootstrap evidence root must be absolute');
  const stat = fs.lstatSync(root);
  assert(stat.isDirectory() && !stat.isSymbolicLink(),
    'access-bootstrap evidence root must be a regular non-symlink directory');
  return fs.realpathSync(root);
}

function readLevel(root, level) {
  assert(LEVELS.includes(level), 'invalid access-bootstrap level');
  const canonicalRoot = assertSafeRoot(root);
  const directory = path.join(canonicalRoot, level);
  const stat = fs.lstatSync(directory);
  assert(stat.isDirectory() && !stat.isSymbolicLink(),
    `access-bootstrap ${level} directory must be regular and non-symlink`);
  const names = fs.readdirSync(directory).sort();
  assert(same(names, [REPORT_FILENAME, SIGNATURE_FILENAME].sort()),
    `access-bootstrap ${level} directory must contain only the exact report/signature pair`);
  return {
    report: readRegularJson(path.join(directory, REPORT_FILENAME), `${level} access-bootstrap report`),
    signatures: readRegularJson(path.join(directory, SIGNATURE_FILENAME), `${level} access-bootstrap signatures`),
  };
}

function validateChain({ root, requestedLevel, contextForLevel, requireCurrentFreshness }) {
  assert(LEVELS.includes(requestedLevel), 'invalid requested access-bootstrap level');
  assert(typeof requireCurrentFreshness === 'boolean',
    'access-bootstrap caller must explicitly select current-time freshness semantics');
  const levels = requestedLevel === 'public_beta' ? LEVELS : ['invited_beta'];
  const canonicalRoot = assertSafeRoot(root);
  const rootNames = fs.readdirSync(canonicalRoot).sort();
  assert(rootNames.length >= 1 && rootNames.every(name => LEVELS.includes(name)),
    'access-bootstrap evidence root may contain only publication-level directories');
  rootNames.forEach(name => {
    const stat = fs.lstatSync(path.join(canonicalRoot, name));
    assert(stat.isDirectory() && !stat.isSymbolicLink(),
      `access-bootstrap ${name} root entry must be a regular non-symlink directory`);
  });
  assert(levels.every(level => rootNames.includes(level)),
    'access-bootstrap evidence root is missing a required publication-level directory');
  const reports = {};
  let priorReportSha256 = null;
  levels.forEach(level => {
    const records = readLevel(root, level);
    const context = contextForLevel(level, priorReportSha256);
    assert(context && context.level === level, 'access-bootstrap context adapter returned the wrong level');
    const trust = policyEngine.evaluateTrustRegistry(context.trustRegistry);
    assert(trust.status === 'pass' && trust.derived_status === 'provisioned',
      'access-bootstrap trust registry is not genuinely provisioned');
    validateReport(records.report.value, {
      ...context,
      priorReportSha256,
      currentFreshnessRequired: requireCurrentFreshness && level === requestedLevel,
    });
    validateSignatureBundle(records.signatures.value, records.report, context);
    if (level === 'public_beta') {
      assert(new Date(records.report.value.observation.observed_at) >=
        new Date(reports.invited_beta.signed_at),
      'public access-bootstrap observation predates the signed invited bootstrap');
    }
    reports[level] = {
      report_sha256: records.report.sha256,
      signature_bundle_sha256: records.signatures.sha256,
      observed_at: records.report.value.observation.observed_at,
      signed_at: records.signatures.value.signed_at,
    };
    priorReportSha256 = records.report.sha256;
  });
  return {
    status: 'pass',
    requested_level: requestedLevel,
    levels,
    reports,
    assessed_production_authority: false,
    deployment_or_publication_authority: false,
  };
}

module.exports = {
  DOMAIN,
  HOLDING_CANARY_PATHS,
  LEVELS,
  POLICY_PATH,
  REPORT_FILENAME,
  SIGNATURE_FILENAME,
  SIGNER_ROLES,
  TRUST_PATH,
  calculationHash,
  canonicalJson,
  expectedProbeRows,
  hashBytes,
  hashJson,
  logicalReportPath,
  operationalAliases,
  readLevel,
  signatureMessage,
  validateChain,
  validateReport,
  validateSignatureBundle,
};
