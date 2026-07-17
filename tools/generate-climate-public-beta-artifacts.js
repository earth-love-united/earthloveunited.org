#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageEngine = require('./lib/climate-public-beta-package');
const policyEngine = require('./lib/climate-public-beta-policy');
const reviewedData = require('./lib/climate-public-beta-reviewed-data');
const surfaceEngine = require('./lib/climate-public-beta-surface');
const governanceEngine = require('./lib/climate-public-beta-governance-contracts');
const {
  parseJsonNoDuplicateKeys,
  stable,
  same,
  validateJsonSchema,
} = require('./lib/json-schema-lite');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const GIT_MODE = /^(?:100644|100755)$/;
const FEEDBACK_CONTRACT_PATH =
  'data/climate/public-beta/governance/feedback-privacy-contract.json';
const MODES = new Map([
  ['--runtime-manifest', 'runtime'],
  ['--surface-manifest', 'surface'],
  ['--release-diff', 'diff'],
  ['--rollback-proof', 'rollback'],
  ['--scope-manifest', 'scope'],
  ['--self-test', 'self-test'],
]);
const VALUE_OPTIONS = new Set([
  '--root',
  '--release-id',
  '--verification-time',
  '--feedback-contract',
  '--current-snapshot',
  '--previous-snapshot',
  '--previous-release-id',
  '--release-commit',
  '--baseline-commit',
  '--hosted-withdrawal-plan',
  '--work-dir',
  '--evidence-id',
  '--executed-at',
  '--proof-created-at',
  '--executor-identity',
  '--execution-subject-identity',
  '--release-builder-identity',
]);
const SCHEMAS = Object.freeze({
  runtime: 'data/climate/public-beta/schemas/climate-public-beta-runtime-manifest.schema.json',
  diff: 'data/climate/public-beta/schemas/climate-public-beta-release-diff.schema.json',
  rollback: 'data/climate/public-beta/schemas/climate-public-beta-rollback-proof.schema.json',
  scope: 'data/climate/public-beta/schemas/climate-public-beta-scope-manifest.schema.json',
});
const OUTPUTS = Object.freeze({
  runtime: () => 'data/climate/public-beta/runtime/runtime-manifest.json',
  surface: () => surfaceEngine.PUBLIC_SURFACE_MANIFEST_PATH,
  diff: releaseId => `data/climate/public-beta/governance/releases/${releaseId}/release-diff.json`,
  rollback: releaseId => `data/climate/public-beta/governance/releases/${releaseId}/rollback-proof.json`,
  scope: releaseId => packageEngine.scopeSelfPath(releaseId),
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert(same(Object.keys(value).sort(), [...expected].sort()), `${label} keys mismatch`);
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(stable(value), null, 2)}\n`, 'utf8');
}

function safeRelative(relative) {
  assert(typeof relative === 'string' && relative.length > 0 && !relative.includes('\0') &&
    !relative.includes('\\'), 'unsafe repository path');
  const normalized = path.posix.normalize(relative);
  assert(normalized === relative && normalized !== '..' && !normalized.startsWith('../') &&
    !path.posix.isAbsolute(normalized), `unsafe repository path: ${relative}`);
  return normalized;
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative));
}

function entryExists(filename) {
  try {
    fs.lstatSync(filename);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function realDirectory(directory, label) {
  assert(path.isAbsolute(directory), `${label} must be an absolute path`);
  const stat = fs.lstatSync(directory);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), `${label} must be a real non-symlink directory`);
  const real = fs.realpathSync(directory);
  assert(real === path.resolve(directory), `${label} path must not traverse a symbolic link`);
  return real;
}

function repositoryRoot(value) {
  if (value !== undefined) assert(path.isAbsolute(value), '--root must be an absolute path');
  const selected = path.resolve(value || DEFAULT_ROOT);
  return realDirectory(selected, 'repository root');
}

function assertPathComponents(root, absolute, label, includeLeaf = true) {
  const rootReal = fs.realpathSync(root);
  const target = path.resolve(absolute);
  assert(isInside(rootReal, target), `${label} escapes the repository root`);
  const parts = path.relative(rootReal, target).split(path.sep).filter(Boolean);
  let current = rootReal;
  parts.forEach((part, index) => {
    current = path.join(current, part);
    if (!includeLeaf && index === parts.length - 1) return;
    if (!entryExists(current)) return;
    const stat = fs.lstatSync(current);
    assert(!stat.isSymbolicLink(), `${label} path contains a symbolic link`);
    if (index < parts.length - 1) assert(stat.isDirectory(), `${label} has a non-directory ancestor`);
  });
}

function readRegularJson(filename, label, options = {}) {
  assert(path.isAbsolute(filename), `${label} must use an absolute path`);
  const stat = fs.lstatSync(filename);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular non-symlink file`);
  const real = fs.realpathSync(filename);
  assert(real === path.resolve(filename), `${label} path must not traverse a symbolic link`);
  if (options.outsideRoot) {
    assert(!isInside(options.outsideRoot, real), `${label} must remain outside the public repository`);
  }
  const bytes = fs.readFileSync(real);
  let value;
  try {
    value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), label);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  if (options.canonical) {
    assert(bytes.equals(canonicalBytes(value)),
      `${label} must use canonical recursively sorted two-space JSON with one trailing newline`);
  }
  return { filename: real, bytes, value, sha256: packageEngine.sha256Bytes(bytes) };
}

function readRepositoryJson(root, relative, label) {
  const normalized = safeRelative(relative);
  const absolute = path.join(root, normalized);
  assertPathComponents(root, absolute, label);
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular non-symlink file`);
  const bytes = fs.readFileSync(absolute);
  let value;
  try {
    value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), label);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
  return { bytes, value, sha256: packageEngine.sha256Bytes(bytes) };
}

function validateAgainstSchema(root, value, relative, label) {
  const schema = readRepositoryJson(root, relative, `${label} schema`).value;
  const errors = validateJsonSchema(value, schema);
  assert(errors.length === 0, `${label} schema validation failed: ${errors.slice(0, 8).join('; ')}`);
}

function prepareOutput(root, relative, label) {
  const normalized = safeRelative(relative);
  const absolute = path.join(root, normalized);
  assertPathComponents(root, absolute, label, false);
  const parent = path.dirname(absolute);
  const parentStat = fs.lstatSync(parent);
  assert(parentStat.isDirectory() && !parentStat.isSymbolicLink(), `${label} parent must already be a real directory`);
  assert(!entryExists(absolute), `${label} already exists; refusing to overwrite`);
  return { relative: normalized, absolute, parent };
}

function atomicCreateBytes(root, relative, bytes, label) {
  const output = prepareOutput(root, relative, label);
  const temporary = path.join(output.parent,
    `.${path.basename(output.absolute)}.create-${process.pid}-${crypto.randomBytes(8).toString('hex')}`);
  let descriptor = null;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o644);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.linkSync(temporary, output.absolute);
    fs.unlinkSync(temporary);
    const result = fs.lstatSync(output.absolute);
    assert(result.isFile() && !result.isSymbolicLink(), `${label} atomic output is not a regular file`);
    return output;
  } catch (error) {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (entryExists(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
}

function atomicCreateJson(root, relative, value, label) {
  return atomicCreateBytes(root, relative, canonicalBytes(value), label);
}

function validateFeedbackContract(root, record, suppliedPolicy) {
  const repositoryRecord = readRepositoryJson(root, FEEDBACK_CONTRACT_PATH,
    'canonical feedback/privacy contract');
  assert(record.filename === fs.realpathSync(path.join(root, FEEDBACK_CONTRACT_PATH)),
    `--feedback-contract must name the exact canonical in-repository ${FEEDBACK_CONTRACT_PATH}`);
  assert(record.bytes.equals(repositoryRecord.bytes),
    'feedback/privacy input differs from the exact canonical repository contract');
  const schemas = governanceEngine.loadSchemas(root);
  const report = governanceEngine.validateFeedbackPrivacyContract(record.value, {
    schema: schemas.feedbackPrivacy,
  });
  assert(report.status === 'pass' && report.feedback_privacy_contract_sha256 === record.sha256 &&
    report.human_authority === false &&
    report.publication_authority === false && report.assessed_production_authority === false,
  'feedback/privacy contract validation returned an invalid authority boundary');
  const policy = loadFrozenPolicy(root, suppliedPolicy);
  assert(policy.governance_contracts.feedback_privacy_contract_path === FEEDBACK_CONTRACT_PATH &&
    policy.governance_contracts.feedback_privacy_contract_sha256 === record.sha256,
  'frozen policy does not pin the exact canonical feedback/privacy contract bytes');
  return {
    feedback: {
      approved_feedback_url: record.value.feedback_url,
      privacy_notice_url: record.value.privacy_notice_url,
    },
    report,
  };
}

function runtimeManifestFromSealed(root, releaseId, feedback, verificationTime, validateSealed) {
  assert(policyEngine.validReleaseId(releaseId), 'invalid beta release ID');
  assert(policyEngine.validTimestamp(verificationTime),
    '--verification-time must be an explicit exact UTC timestamp');
  const sealed = validateSealed({ root, releaseId, verificationTime });
  assert(sealed?.status === 'pass' && sealed.beta_release_id === releaseId &&
    sealed.assessed_production_authority === false,
  'reviewed runtime is not sealed and valid for the selected beta release');
  const sealedPins = new Map((sealed.artifacts || []).map(pin => [pin.path, pin.sha256]));
  const releaseRoot = `data/climate/public-beta/runtime/releases/${releaseId}`;
  const files = {};
  Object.entries(packageEngine.RUNTIME_FILE_NAMES).forEach(([key, filename]) => {
    const relative = `${releaseRoot}/${filename}`;
    const actual = packageEngine.inspectRegular(root, relative);
    assert(sealedPins.get(relative) === actual.sha256,
      `sealed-runtime validation did not bind the exact runtime byte: ${relative}`);
    files[key] = { path: relative, sha256: actual.sha256, bytes: actual.bytes };
  });
  assert(sealedPins.size === Object.keys(packageEngine.RUNTIME_FILE_NAMES).length,
    'sealed-runtime validation returned an unexpected artifact set');
  return {
    schema_version: '1.0.0',
    manifest_id: `elu-climate-public-beta-runtime-${releaseId}`,
    beta_release_id: releaseId,
    product_tier: 'climate_public_beta',
    product_label: packageEngine.PRODUCT_LABEL,
    content_state: 'reviewed_beta_release',
    independent_review_state: 'reviewed',
    assessed_production_authority: false,
    official_inventory: false,
    climate_performance_assessment: false,
    scope: {
      source_id: 'primap-hist-2.6.1-final',
      source_version: '2.6.1 final, 13 March 2025',
      display_years: { start: 2014, end: 2023 },
      counts: { registry_entities: 249, factual_series: 206, source_gaps: 43, observations: 2060 },
      metric_id: 'annual_economy_wide_ghg_excluding_lulucf',
      unit: 'MtCO2e/yr',
      comparison_year: 2023,
    },
    feedback,
    files,
  };
}

function generateRuntime(options, dependencies = {}) {
  const root = options.root;
  const output = prepareOutput(root, OUTPUTS.runtime(), 'runtime manifest');
  const contractRecord = readRegularJson(options.feedbackContract, 'feedback/privacy contract', {
    canonical: true,
  });
  const contract = (dependencies.validateFeedbackContract || validateFeedbackContract)(
    root, contractRecord, dependencies.policy);
  const manifest = runtimeManifestFromSealed(root, options.releaseId, contract.feedback,
    options.verificationTime, dependencies.validateSealedRuntime || reviewedData.validateSealedRuntime);
  validateAgainstSchema(root, manifest, SCHEMAS.runtime, 'runtime manifest');
  packageEngine.validateRuntimeManifest(manifest, { root });
  atomicCreateJson(root, output.relative, manifest, 'runtime manifest');
  return {
    status: 'runtime_manifest_created',
    beta_release_id: options.releaseId,
    output: output.relative,
    feedback_privacy_contract_sha256: contractRecord.sha256,
    review_authority: false,
    publication_authority: false,
    assessed_production_authority: false,
  };
}

function generateSurface(options) {
  const root = options.root;
  const output = prepareOutput(root, OUTPUTS.surface(), 'public-surface manifest');
  const runtime = readRepositoryJson(root, OUTPUTS.runtime(), 'runtime manifest').value;
  assert(runtime.beta_release_id === options.releaseId,
    'runtime manifest belongs to a different beta release');
  validateAgainstSchema(root, runtime, SCHEMAS.runtime, 'runtime manifest');
  packageEngine.validateRuntimeManifest(runtime, { root });
  const manifest = surfaceEngine.buildExpectedManifest({ sourceRoot: root, betaReleaseId: options.releaseId });
  surfaceEngine.validateExpectedManifest(manifest, root);
  atomicCreateJson(root, output.relative, manifest, 'public-surface manifest');
  return {
    status: 'public_surface_manifest_created',
    beta_release_id: options.releaseId,
    output: output.relative,
    file_count: manifest.files.length,
    review_authority: false,
    publication_authority: false,
    assessed_production_authority: false,
  };
}

function validatePortableSurfaceManifest(value, expectedReleaseId, label) {
  exactKeys(value, surfaceEngine.MANIFEST_KEYS, label);
  assert(value.schema_version === '1.0.0' &&
    value.manifest_id === `elu-climate-public-beta-surface-${expectedReleaseId}` &&
    value.beta_release_id === expectedReleaseId && value.publication_channel === 'climate_public_beta' &&
    value.assessed_production_authority === false,
  `${label} boundary mismatch`);
  const hashInput = { ...value, calculation_hash: null };
  assert(surfaceEngine.hashJson(hashInput) === value.calculation_hash,
    `${label} calculation hash mismatch`);
  const mappings = surfaceEngine.requiredMappings(expectedReleaseId);
  assert(Array.isArray(value.files) && value.files.length === mappings.length,
    `${label} file count mismatch`);
  value.files.forEach((entry, index) => {
    exactKeys(entry, surfaceEngine.FILE_KEYS, `${label} file ${index}`);
    assert(/^[a-f0-9]{64}$/.test(entry.sha256 || '') &&
      entry.source_path === mappings[index].source_path &&
      entry.destination_path === mappings[index].destination_path,
    `${label} file mapping or hash mismatch`);
  });
  return packageEngine.surfaceSnapshotFromManifest(value);
}

function snapshotFromRecord(record, releaseId, label) {
  if (Array.isArray(record.value)) {
    return packageEngine.normalizeSurfaceSnapshot(record.value, releaseId, label);
  }
  return validatePortableSurfaceManifest(record.value, releaseId, label);
}

function generateDiff(options) {
  const root = options.root;
  const output = prepareOutput(root, OUTPUTS.diff(options.releaseId), 'release diff');
  const currentRecord = readRegularJson(options.currentSnapshot, 'current public-surface snapshot', {
    canonical: true,
  });
  const current = snapshotFromRecord(currentRecord, options.releaseId, 'current public-surface snapshot');
  const canonicalCurrent = readRepositoryJson(root, OUTPUTS.surface(), 'canonical current public-surface manifest');
  surfaceEngine.validateExpectedManifest(canonicalCurrent.value, root);
  assert(canonicalCurrent.value.beta_release_id === options.releaseId &&
    same(current, packageEngine.surfaceSnapshotFromManifest(canonicalCurrent.value)),
  'current snapshot differs from the exact validated repository public-surface manifest');

  let previous = [];
  let previousReleaseId = null;
  if (options.previousSnapshot !== undefined || options.previousReleaseId !== undefined) {
    assert(options.previousSnapshot && options.previousReleaseId,
      'later release diff requires both --previous-snapshot and --previous-release-id');
    const previousRecord = readRegularJson(options.previousSnapshot, 'previous public-surface snapshot', {
      canonical: true,
    });
    previousReleaseId = options.previousReleaseId;
    previous = snapshotFromRecord(previousRecord, previousReleaseId, 'previous public-surface snapshot');
  }
  const diff = packageEngine.computeReleaseDiff({
    betaReleaseId: options.releaseId,
    previousBetaReleaseId: previousReleaseId,
    currentFiles: current,
    previousFiles: previous,
  });
  validateAgainstSchema(root, diff, SCHEMAS.diff, 'release diff');
  packageEngine.evaluateReleaseDiff(diff, { currentFiles: current, previousFiles: previous });
  atomicCreateJson(root, output.relative, diff, 'release diff');
  return {
    status: 'release_diff_created',
    beta_release_id: options.releaseId,
    previous_beta_release_id: previousReleaseId,
    output: output.relative,
    change_count: diff.changes.length,
    review_authority: false,
    publication_authority: false,
    assessed_production_authority: false,
  };
}

function gitRun(root, args, options = {}) {
  const result = spawnSync('git', ['-C', root, ...args], {
    encoding: options.binary ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : result.stderr;
    throw new Error(`git ${args[0]} failed: ${String(stderr || '').trim()}`);
  }
  return result;
}

function gitText(root, args) {
  return String(gitRun(root, args).stdout).replace(/\n$/, '');
}

function resolveCommit(root, value, label) {
  assert(COMMIT_SHA.test(value || ''), `${label} must be an explicit lowercase 40-character commit SHA`);
  const resolved = gitText(root, ['rev-parse', '--verify', `${value}^{commit}`]);
  assert(resolved === value, `${label} did not resolve to the exact supplied commit`);
  return value;
}

function gitEntry(root, commit, relative, optional = false) {
  const normalized = safeRelative(relative);
  const result = gitRun(root, ['ls-tree', '-z', '--full-tree', commit, '--', normalized], {
    binary: true,
    allowFailure: optional,
  });
  if (result.status !== 0) {
    if (optional) return null;
    throw new Error(`cannot inspect Git entry ${commit}:${normalized}`);
  }
  const rows = result.stdout.toString('utf8').split('\0').filter(Boolean);
  if (rows.length === 0 && optional) return null;
  assert(rows.length === 1, `Git entry did not resolve to one exact blob: ${normalized}`);
  const tab = rows[0].indexOf('\t');
  assert(tab > 0, `malformed Git tree entry: ${normalized}`);
  const [mode, type] = rows[0].slice(0, tab).split(' ');
  const observedPath = rows[0].slice(tab + 1);
  assert(observedPath === normalized && type === 'blob' && GIT_MODE.test(mode || ''),
    `Git entry is not an exact regular non-submodule blob: ${normalized}`);
  const blob = gitRun(root, ['show', `${commit}:${normalized}`], { binary: true }).stdout;
  return {
    path: normalized,
    sha256: packageEngine.sha256Bytes(blob),
    git_mode: mode,
    bytes: blob,
  };
}

function assertGitRepository(root) {
  const top = fs.realpathSync(gitText(root, ['rev-parse', '--show-toplevel']));
  assert(top === fs.realpathSync(root), '--root must be the exact Git worktree root');
}

function assertCleanExactHead(root, releaseCommit) {
  assertGitRepository(root);
  const head = gitText(root, ['rev-parse', 'HEAD']);
  assert(head === releaseCommit, 'release commit must equal exact Git HEAD');
  const status = gitRun(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { binary: true }).stdout;
  assert(status.length === 0, 'rollback BP generation requires a completely clean exact Git HEAD worktree');
}

function assertAncestor(root, earlier, later, label) {
  const result = gitRun(root, ['merge-base', '--is-ancestor', earlier, later], { allowFailure: true });
  assert(result.status === 0, label);
}

function changedPaths(root, baselineCommit, releaseCommit) {
  const output = gitRun(root, [
    'diff', '--name-only', '-z', '--diff-filter=ACDMRTUXB', baselineCommit, releaseCommit, '--',
  ], { binary: true }).stdout;
  return output.toString('utf8').split('\0').filter(Boolean).map(safeRelative).sort(compareStrings);
}

function deriveGitProjection(root, releaseCommit, baselineCommit, targetPaths, options = {}) {
  const paths = [...targetPaths].map(safeRelative).sort(compareStrings);
  assert(paths.length > 0 && new Set(paths).size === paths.length,
    'canonical rollback target paths must be non-empty, unique, and sorted');
  const targetSet = new Set(paths);
  const changed = changedPaths(root, baselineCommit, releaseCommit);
  const outside = changed.filter(relative => !targetSet.has(relative));
  assert(outside.length === 0,
    `rollback commit range changes paths outside the complete canonical target: ${outside.join(', ')}`);
  const releaseFiles = paths.map(relative => {
    const entry = gitEntry(root, releaseCommit, relative);
    if (options.verifyWorking !== false) {
      const working = packageEngine.inspectRegular(root, relative);
      assert(working.sha256 === entry.sha256 && working.git_mode === entry.git_mode,
        `HEAD/working byte or Git-mode drift: ${relative}`);
    }
    return { path: relative, sha256: entry.sha256, git_mode: entry.git_mode };
  });
  const baselineFiles = paths.flatMap(relative => {
    const entry = gitEntry(root, baselineCommit, relative, true);
    return entry ? [{ path: relative, sha256: entry.sha256, git_mode: entry.git_mode }] : [];
  });
  return { releaseFiles, baselineFiles, changedPaths: changed };
}

function writeGitProjection(root, commit, pins, destination) {
  pins.forEach(pin => {
    const entry = gitEntry(root, commit, pin.path);
    assert(entry.sha256 === pin.sha256 && entry.git_mode === pin.git_mode,
      `Git projection pin drift: ${pin.path}`);
    const target = path.join(destination, pin.path);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const descriptor = fs.openSync(target, 'wx', entry.git_mode === '100755' ? 0o755 : 0o644);
    try {
      fs.writeFileSync(descriptor, entry.bytes);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.chmodSync(target, entry.git_mode === '100755' ? 0o755 : 0o644);
  });
}

function validateWorkDirectory(root, workDir) {
  const real = realDirectory(workDir, 'rollback isolated work directory');
  assert(!isInside(root, real), 'rollback isolated work directory must remain outside the public repository');
  assert(fs.readdirSync(real).length === 0,
    'rollback isolated work directory must be newly created and empty');
  return real;
}

function loadFrozenPolicy(root, supplied) {
  const policy = supplied || readRepositoryJson(root,
    'data/climate/public-beta/governance/policy.json', 'frozen beta policy').value;
  const report = policyEngine.validatePolicy(policy);
  assert(report.status === 'pass', `frozen beta policy is invalid: ${report.failure_ids.join(', ')}`);
  return policy;
}

function assertHostedPlanMatchesPolicy(plan, policy) {
  const levels = packageEngine.ROLLBACK_POLICY_LEVELS;
  assert(Array.isArray(plan.level_contracts) && plan.level_contracts.length === levels.length,
    'hosted withdrawal plan must cover both invited_beta and public_beta');
  levels.forEach((level, index) => {
    const contract = plan.level_contracts[index];
    assert(contract.publication_level === level &&
      contract.intended_origin === policy.approved_origins[level] &&
      same(contract.aliases, policy.approved_aliases[level]),
    `hosted withdrawal plan differs from frozen ${level} origin/aliases`);
  });
  assert(plan.target_kind === policy.rollback_target.type &&
    plan.rollback_target_reference === policy.rollback_target.reference &&
    plan.hosting_project.provider === policy.hosting_project.provider &&
    plan.hosting_project.project_id === policy.hosting_project.project_id &&
    plan.hosting_project.production_branch === policy.hosting_project.production_branch &&
    plan.hosting_project.access_scope === policy.hosting_project.access_scope &&
    plan.hosting_project.access_policy_reference === policy.hosting_project.access_policy_reference &&
    plan.hosting_project.pages_dev_origin === policy.hosting_project.pages_dev_origin &&
    plan.hosting_project.deployment_alias_hostname_suffix ===
      policy.hosting_project.deployment_alias_hostname_suffix &&
    same(plan.expected_unauthorized_statuses, policy.unauthorized_access_policy.allowed_statuses) &&
    same(plan.allowed_redirect_origins, policy.unauthorized_access_policy.allowed_redirect_origins) &&
    plan.rollback_response_target_seconds === policy.frozen_thresholds.rollback_response_target_seconds &&
    plan.production_baseline_origin === policy.production_baseline_origin &&
    plan.production_baseline_inventory_sha256 === policy.production_baseline_inventory_sha256,
  'hosted withdrawal plan differs from the frozen policy');
}

function generateRollback(options, dependencies = {}) {
  const root = options.root;
  const output = prepareOutput(root, OUTPUTS.rollback(options.releaseId), 'rollback proof');
  assert(!entryExists(path.join(root, packageEngine.scopeSelfPath(options.releaseId))),
    'rollback proof is the BP pre-scope operation; the BA scope must not exist yet');
  const workRoot = validateWorkDirectory(root, options.workDir);
  const planRecord = readRegularJson(options.hostedWithdrawalPlan, 'hosted withdrawal plan', {
    canonical: true,
    outsideRoot: root,
  });
  const policy = loadFrozenPolicy(root, dependencies.policy);
  const releaseCommit = resolveCommit(root, options.releaseCommit, 'release commit');
  const baselineCommit = resolveCommit(root, options.baselineCommit, 'frozen baseline commit');
  assert(releaseCommit !== baselineCommit, 'release and frozen baseline commits must differ');
  assertCleanExactHead(root, releaseCommit);
  assertAncestor(root, baselineCommit, releaseCommit,
    'frozen rollback baseline must be an ancestor of the exact BP release commit');
  const discover = dependencies.discoverRollbackTargetPaths || packageEngine.discoverRollbackTargetPaths;
  const targetPaths = discover(root, options.releaseId);
  const projection = deriveGitProjection(root, releaseCommit, baselineCommit, targetPaths);
  assert(packageEngine.computeRollbackOperations(projection.releaseFiles, projection.baselineFiles).length > 0,
    'rollback BP and frozen baseline projections are identical; executable rollback would have no operation');
  packageEngine.validateProductionIdentity(options.executorIdentity, 'rollback executor identity');
  packageEngine.validateProductionIdentity(options.executionSubjectIdentity,
    'rollback execution-subject identity');
  assert(typeof options.evidenceId === 'string' && options.evidenceId.length >= 5,
    'rollback execution requires an explicit evidence ID');
  assert(policyEngine.validTimestamp(options.executedAt) && policyEngine.validTimestamp(options.proofCreatedAt),
    'rollback execution and proof creation require explicit exact UTC timestamps');

  // This invokes the canonical hosted-plan validator before any rollback execution.
  packageEngine.buildRollbackProof({
    betaReleaseId: options.releaseId,
    releaseCommitSha: releaseCommit,
    baselineCommitSha: baselineCommit,
    releaseFiles: projection.releaseFiles,
    baselineFiles: projection.baselineFiles,
    execution: { executed_at: options.executedAt },
    hostedWithdrawal: planRecord.value,
    proofCreatedAt: options.proofCreatedAt,
  });
  assertHostedPlanMatchesPolicy(planRecord.value, policy);

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-beta-rollback-generate-'));
  try {
    const releaseRoot = path.join(temporary, 'release');
    const baselineRoot = path.join(temporary, 'baseline');
    fs.mkdirSync(releaseRoot, { mode: 0o700 });
    fs.mkdirSync(baselineRoot, { mode: 0o700 });
    writeGitProjection(root, releaseCommit, projection.releaseFiles, releaseRoot);
    writeGitProjection(root, baselineCommit, projection.baselineFiles, baselineRoot);
    const execution = packageEngine.buildRollbackExecution({
      betaReleaseId: options.releaseId,
      releaseCommitSha: releaseCommit,
      baselineCommitSha: baselineCommit,
      releaseFiles: projection.releaseFiles,
      baselineFiles: projection.baselineFiles,
      releaseRoot,
      baselineRoot,
      workRoot,
      evidenceId: options.evidenceId,
      executedAt: options.executedAt,
      executorIdentity: options.executorIdentity,
      executionSubjectIdentity: options.executionSubjectIdentity,
    });
    const proof = packageEngine.buildRollbackProof({
      betaReleaseId: options.releaseId,
      releaseCommitSha: releaseCommit,
      baselineCommitSha: baselineCommit,
      releaseFiles: projection.releaseFiles,
      baselineFiles: projection.baselineFiles,
      execution,
      hostedWithdrawal: planRecord.value,
      proofCreatedAt: options.proofCreatedAt,
    });
    validateAgainstSchema(root, proof, SCHEMAS.rollback, 'rollback proof');
    packageEngine.validateRollbackProof(proof);
    packageEngine.validateRollbackAgainstPolicy(proof, policy, 'both');
    packageEngine.validateRollbackUniverseProjection(proof, {
      releaseFiles: projection.releaseFiles,
      baselineFiles: projection.baselineFiles,
      requireGitModes: true,
    });
    atomicCreateJson(root, output.relative, proof, 'rollback proof');
    return {
      status: 'rollback_proof_created_pending_independent_review',
      beta_release_id: options.releaseId,
      output: output.relative,
      release_commit_sha: releaseCommit,
      baseline_commit_sha: baselineCommit,
      target_file_count: projection.releaseFiles.length,
      hosted_withdrawal_plan_sha256: planRecord.sha256,
      review_authority: false,
      publication_authority: false,
      assessed_production_authority: false,
      next_human_action: 'Obtain an independent signed beta_rollback_reviewer review of the exact rollback-proof bytes; this execution does not review or authorize publication.',
    };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function verifyScopeRollbackBindingBeforeWrite(root, scope, proof) {
  const postTarget = new Set(packageEngine.rollbackPostTargetPaths(proof.beta_release_id));
  const expected = scope.files.filter(pin => !postTarget.has(pin.path))
    .map(pin => ({ path: pin.path, sha256: pin.sha256 }))
    .sort((left, right) => compareStrings(left.path, right.path));
  const actual = proof.repository_rollback.release_files
    .map(pin => ({ path: pin.path, sha256: pin.sha256 }))
    .sort((left, right) => compareStrings(left.path, right.path));
  assert(same(expected, actual),
    'later BA scope does not preserve the exact BP pre-proof rollback target');
  const scopePaths = new Set(scope.files.map(pin => pin.path));
  packageEngine.rollbackPostTargetPaths(proof.beta_release_id).forEach(relative => {
    assert(scopePaths.has(relative), `BA scope omits post-target rollback proof/review path: ${relative}`);
  });
  const projection = deriveGitProjection(root, proof.repository_rollback.release_commit_sha,
    proof.repository_rollback.baseline_commit_sha,
    proof.repository_rollback.release_files.map(pin => pin.path));
  packageEngine.validateRollbackUniverseProjection(proof, {
    releaseFiles: projection.releaseFiles,
    baselineFiles: projection.baselineFiles,
    requireGitModes: true,
  });
}

function generateScope(options, dependencies = {}) {
  const root = options.root;
  const output = prepareOutput(root, OUTPUTS.scope(options.releaseId), 'BA scope manifest');
  assertGitRepository(root);
  const proofRecord = readRepositoryJson(root, OUTPUTS.rollback(options.releaseId), 'rollback proof');
  validateAgainstSchema(root, proofRecord.value, SCHEMAS.rollback, 'rollback proof');
  packageEngine.validateRollbackProof(proofRecord.value);
  assert(proofRecord.value.beta_release_id === options.releaseId,
    'rollback proof belongs to a different beta release');
  const policy = loadFrozenPolicy(root, dependencies.policy);
  packageEngine.validateRollbackAgainstPolicy(proofRecord.value, policy, 'both');
  const head = gitText(root, ['rev-parse', 'HEAD']);
  assert(head === proofRecord.value.repository_rollback.release_commit_sha,
    'BA scope must be generated while exact Git HEAD is the BP pre-proof release commit');
  assertAncestor(root, proofRecord.value.repository_rollback.baseline_commit_sha, head,
    'rollback baseline is not an ancestor of the BP release commit');
  const scope = packageEngine.buildScopeManifest({
    root,
    betaReleaseId: options.releaseId,
    releaseBuilderIdentity: options.releaseBuilderIdentity,
  });
  validateAgainstSchema(root, scope, SCHEMAS.scope, 'BA scope manifest');
  packageEngine.validateScopeManifest(scope, { root, requireSelfFile: false });
  verifyScopeRollbackBindingBeforeWrite(root, scope, proofRecord.value);
  atomicCreateJson(root, output.relative, scope, 'BA scope manifest');
  try {
    packageEngine.validateScopeManifest(scope, { root });
    packageEngine.validateRollbackAgainstScope(proofRecord.value, scope, { root });
  } catch (error) {
    fs.unlinkSync(output.absolute);
    throw error;
  }
  return {
    status: 'ba_scope_manifest_created_pending_commit_and_protected_package_pr',
    beta_release_id: options.releaseId,
    output: output.relative,
    file_count: scope.files.length,
    scope_hash: scope.scope_hash,
    review_authority: false,
    publication_authority: false,
    assessed_production_authority: false,
    next_human_action: 'Commit the exact completed BA package and submit the commit-preserving protected package PR; this scope does not review or authorize publication.',
  };
}

function parseArguments(argv) {
  if (argv.length === 1 && (argv[0] === '--help' || argv[0] === '-h')) return { help: true };
  const values = {};
  let mode = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (MODES.has(argument)) {
      assert(mode === null, 'choose exactly one generator mode');
      mode = MODES.get(argument);
      continue;
    }
    assert(VALUE_OPTIONS.has(argument), `unknown argument: ${argument}`);
    assert(!Object.hasOwn(values, argument), `duplicate option: ${argument}`);
    const value = argv[index + 1];
    assert(typeof value === 'string' && value.length > 0 && !value.startsWith('--'),
      `${argument} requires a value`);
    values[argument] = value;
    index += 1;
  }
  assert(mode !== null, 'choose exactly one generator mode; use --help for usage');
  return { mode, values };
}

function requireOptions(values, required, optional = []) {
  const allowed = new Set([...required, ...optional]);
  required.forEach(name => assert(Object.hasOwn(values, name), `${name} is required`));
  Object.keys(values).forEach(name => assert(allowed.has(name), `${name} is not valid for this mode`));
}

function modeOptions(parsed) {
  const values = parsed.values;
  if (parsed.mode === 'self-test') {
    requireOptions(values, [], ['--root']);
    return { root: repositoryRoot(values['--root']) };
  }
  const root = repositoryRoot(values['--root']);
  if (parsed.mode === 'runtime') {
    requireOptions(values, ['--release-id', '--verification-time', '--feedback-contract'], ['--root']);
    return {
      root,
      releaseId: values['--release-id'],
      verificationTime: values['--verification-time'],
      feedbackContract: values['--feedback-contract'],
    };
  }
  if (parsed.mode === 'surface') {
    requireOptions(values, ['--release-id'], ['--root']);
    return { root, releaseId: values['--release-id'] };
  }
  if (parsed.mode === 'diff') {
    requireOptions(values, ['--release-id', '--current-snapshot'],
      ['--root', '--previous-snapshot', '--previous-release-id']);
    return {
      root,
      releaseId: values['--release-id'],
      currentSnapshot: values['--current-snapshot'],
      previousSnapshot: values['--previous-snapshot'],
      previousReleaseId: values['--previous-release-id'],
    };
  }
  if (parsed.mode === 'rollback') {
    requireOptions(values, [
      '--release-id', '--release-commit', '--baseline-commit', '--hosted-withdrawal-plan',
      '--work-dir', '--evidence-id', '--executed-at', '--proof-created-at',
      '--executor-identity', '--execution-subject-identity',
    ], ['--root']);
    return {
      root,
      releaseId: values['--release-id'],
      releaseCommit: values['--release-commit'],
      baselineCommit: values['--baseline-commit'],
      hostedWithdrawalPlan: values['--hosted-withdrawal-plan'],
      workDir: values['--work-dir'],
      evidenceId: values['--evidence-id'],
      executedAt: values['--executed-at'],
      proofCreatedAt: values['--proof-created-at'],
      executorIdentity: values['--executor-identity'],
      executionSubjectIdentity: values['--execution-subject-identity'],
    };
  }
  requireOptions(values, ['--release-id', '--release-builder-identity'], ['--root']);
  return {
    root,
    releaseId: values['--release-id'],
    releaseBuilderIdentity: values['--release-builder-identity'],
  };
}

function helpText() {
  return `Climate Public Beta deterministic artifact generator\n\n` +
    `This tool creates deterministic artifacts only. It never signs, deploys, reviews, or grants publication authority.\n\n` +
    `Modes:\n` +
    `  --runtime-manifest --release-id ID --verification-time UTC --feedback-contract /absolute/repo/${FEEDBACK_CONTRACT_PATH} [--root /absolute/repo]\n` +
    `  --surface-manifest --release-id ID [--root /absolute/repo]\n` +
    `  --release-diff --release-id ID --current-snapshot /absolute/current.json [--previous-release-id ID --previous-snapshot /absolute/prior.json] [--root /absolute/repo]\n` +
    `  --rollback-proof --release-id ID --release-commit SHA --baseline-commit SHA --hosted-withdrawal-plan /absolute/plan.json --work-dir /absolute/new-empty-dir --evidence-id ID --executed-at UTC --proof-created-at UTC --executor-identity ID --execution-subject-identity ID [--root /absolute/repo]\n` +
    `  --scope-manifest --release-id ID --release-builder-identity ID [--root /absolute/repo]\n` +
    `  --self-test [--root /absolute/source-repo]\n\n` +
    `All JSON inputs and outputs are recursively key-sorted, two-space JSON with one trailing newline. Inputs that contain human decisions must be supplied by the responsible humans; this tool does not create them.\n`;
}

function writeSelfTestFile(root, relative, bytes, mode = 0o644) {
  const target = path.join(root, safeRelative(relative));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes, { mode });
}

function copySelfTestFile(sourceRoot, targetRoot, relative) {
  writeSelfTestFile(targetRoot, relative, fs.readFileSync(path.join(sourceRoot, relative)));
}

function feedbackFixture() {
  return {
    schema_version: '1.0.0',
    contract_id: governanceEngine.PRIVACY_CONTRACT_ID,
    status: 'frozen',
    repository: governanceEngine.REPOSITORY,
    product_tier: governanceEngine.PRODUCT_TIER,
    accountable_owner: {
      identity: 'urn:elu:self-test-only:feedback-owner',
      role: 'SELF-TEST ONLY feedback owner',
      contact_url: 'https://controller.self-test-only.invalid/contact',
    },
    controller: {
      legal_name: 'SELF-TEST ONLY controller',
      jurisdiction: 'Fixture jurisdiction',
      contact_url: 'https://controller.self-test-only.invalid/contact',
    },
    processors: [{
      processor_id: 'processor-self-test',
      provider_name: 'SELF-TEST ONLY provider',
      service_purpose: 'SELF-TEST ONLY processing of fixture beta feedback submissions.',
      privacy_url: 'https://processor.self-test-only.invalid/privacy',
      data_location: 'Fixture-only data location',
      subprocessor_reference: 'urn:elu:self-test-only:subprocessor-register',
    }],
    feedback_url: 'https://feedback.self-test-only.invalid/report',
    privacy_notice_url: 'https://feedback.self-test-only.invalid/privacy',
    feedback_collection: {
      collected_fields: [
        {
          field_id: 'field-description',
          purpose_id: 'purpose-beta-feedback',
          required: true,
          personal_data: false,
          public_display_allowed: false,
        },
        {
          field_id: 'field-issue-category',
          purpose_id: 'purpose-beta-feedback',
          required: true,
          personal_data: false,
          public_display_allowed: false,
        },
      ],
      allowed_purposes: [{
        purpose_id: 'purpose-beta-feedback',
        description: 'SELF-TEST ONLY collection of fixture feedback about factual beta presentation.',
      }],
      free_text_enabled: true,
      sensitive_data_prohibited: true,
      identity_collection_required: false,
    },
    anonymity: {
      anonymous_submission_available: true,
      identity_fields_optional: true,
      anonymous_submissions_unlinked: true,
      public_identity_disclosure_prohibited: true,
    },
    consent: {
      consent_model: 'no_personal_data',
      consent_text_reference: 'urn:elu:self-test-only:consent-notice',
      consent_withdrawal_url: 'https://controller.self-test-only.invalid/consent-withdrawal',
      consent_record_retained: false,
    },
    retention: {
      primary_retention_seconds: 86400,
      deletion_completion_target_seconds: 3600,
      backup_expiry_seconds: 7200,
      legal_hold_reference: 'urn:elu:self-test-only:legal-hold-rule',
    },
    data_subject_requests: {
      access_request_url: 'https://controller.self-test-only.invalid/access-request',
      deletion_request_url: 'https://controller.self-test-only.invalid/deletion-request',
      redaction_request_url: 'https://controller.self-test-only.invalid/redaction-request',
      acknowledgement_target_seconds: 3600,
      response_target_seconds: 86400,
    },
    abuse_and_privacy_requests: {
      abuse_report_url: 'https://controller.self-test-only.invalid/abuse-report',
      privacy_request_url: 'https://controller.self-test-only.invalid/privacy-request',
      triage_target_seconds: 3600,
      escalation_target_seconds: 7200,
    },
    security_route_reference: {
      route_url: 'https://security.self-test-only.invalid/private-report',
      public_safe_description: 'SELF-TEST ONLY private route for fixture security reports without sensitive public details.',
      sensitive_details_prohibited: true,
    },
    correction_and_withdrawal: {
      correction_request_url: 'https://feedback.self-test-only.invalid/correction-request',
      public_correction_log_url: 'https://feedback.self-test-only.invalid/corrections',
      withdrawal_request_url: 'https://feedback.self-test-only.invalid/withdrawal-request',
      immutable_release_for_corrections_required: true,
      public_correction_log_required: true,
      confirmed_harm_withdrawal_target_seconds: 300,
      correction_rule: 'SELF-TEST ONLY corrections require a new immutable fixture beta release.',
      withdrawal_rule: 'SELF-TEST ONLY confirmed fixture harm requires prompt withdrawal and verification.',
    },
    frozen_at: '2026-07-17T09:00:00.000Z',
    decision_reference: 'urn:elu:self-test-only:feedback-privacy-decision',
    assessed_production_authority: false,
  };
}

function policyFixture() {
  const pagesOrigin = 'https://self-test-beta-project.pages.dev';
  return {
    schema_version: '1.0.0',
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
      invited_beta: 'https://invited.self-test-only.invalid',
      public_beta: 'https://public.self-test-only.invalid',
    },
    approved_aliases: {
      invited_beta: [pagesOrigin, 'https://invited.self-test-only.invalid'].sort(compareStrings),
      public_beta: [pagesOrigin, 'https://public.self-test-only.invalid'].sort(compareStrings),
    },
    hosting_project: {
      provider: 'cloudflare_pages',
      project_id: 'self-test-beta-project',
      production_branch: 'main',
      access_scope: 'project_wide_all_deployments',
      access_policy_reference: 'urn:elu:self-test-only:access-policy-bundle',
      pages_dev_origin: pagesOrigin,
      deployment_alias_hostname_suffix: '.self-test-beta-project.pages.dev',
      holding_content_sha256: '1'.repeat(64),
      deployment_replacement_lock_required: true,
    },
    frozen_thresholds: {
      invited_reviewer_minimum: 1,
      invited_session_minimum: 1,
      accessibility_session_minimum: 1,
      monitoring_window_seconds: 600,
      remote_probe_interval_seconds: 60,
      rollback_response_target_seconds: 300,
      approval_validity_max_seconds: 3600,
      authorized_access_test_count: 1,
      unauthorized_access_test_count: 1,
    },
    unauthorized_access_policy: {
      allowed_statuses: [302, 401, 403, 404],
      allowed_redirect_origins: ['https://access.self-test-only.invalid'],
    },
    production_baseline_origin: 'https://production.self-test-only.invalid',
    production_baseline_inventory_sha256: '2'.repeat(64),
    rollback_target: {
      type: 'project_access_lock',
      reference: 'urn:elu:self-test-only:rollback-target',
    },
    governance_contracts: {
      review_protocol_path: 'data/climate/public-beta/governance/review-protocol.json',
      review_protocol_sha256: '3'.repeat(64),
      feedback_privacy_contract_path: FEEDBACK_CONTRACT_PATH,
      feedback_privacy_contract_sha256: '4'.repeat(64),
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
    decision_reference: 'urn:elu:self-test-only:frozen-policy-decision',
  };
}

function hostedPlanFixture(policy) {
  return {
    evidence_state: 'plan_only_pending_post_deployment_evidence',
    target_kind: policy.rollback_target.type,
    rollback_target_reference: policy.rollback_target.reference,
    hosting_project: {
      provider: policy.hosting_project.provider,
      project_id: policy.hosting_project.project_id,
      production_branch: policy.hosting_project.production_branch,
      access_scope: policy.hosting_project.access_scope,
      access_policy_reference: policy.hosting_project.access_policy_reference,
      pages_dev_origin: policy.hosting_project.pages_dev_origin,
      deployment_alias_hostname_suffix: policy.hosting_project.deployment_alias_hostname_suffix,
    },
    level_contracts: policyEngine.PUBLICATION_LEVELS.map(level => ({
      publication_level: level,
      intended_origin: policy.approved_origins[level],
      aliases: [...policy.approved_aliases[level]],
    })),
    deployment_id: null,
    credentialed_steps: [
      'SELF-TEST ONLY: authenticate to the fixture hosting control plane.',
      'SELF-TEST ONLY: apply the fixture project-wide access lock.',
    ],
    access_lock_or_withdraw_action: 'SELF-TEST ONLY: enable the fixture project-wide access lock.',
    cache_purge_action: 'SELF-TEST ONLY: purge the fixture beta cache after access lock.',
    expected_unauthorized_statuses: [...policy.unauthorized_access_policy.allowed_statuses],
    allowed_redirect_origins: [...policy.unauthorized_access_policy.allowed_redirect_origins],
    rollback_response_target_seconds: policy.frozen_thresholds.rollback_response_target_seconds,
    post_action_checks: [...packageEngine.POST_ACTION_CHECKS].sort(compareStrings),
    production_origin_unchanged_required: true,
    production_baseline_origin: policy.production_baseline_origin,
    production_baseline_inventory_sha256: policy.production_baseline_inventory_sha256,
    remote_execution_evidence: null,
  };
}

function gitSelfTest(root, args) {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  assert(!result.error && result.status === 0,
    `self-test git ${args[0]} failed: ${String(result.stderr || '').trim()}`);
  return result.stdout.trim();
}

function runSelfTest(sourceRoot) {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'elu-beta-artifact-generator-self-test-')));
  const failures = [];
  let positives = 0;
  function reject(id, callback, pattern = null) {
    let error = null;
    try {
      callback();
    } catch (caught) {
      error = caught;
    }
    assert(error, `self-test mutation escaped: ${id}`);
    if (pattern) assert(pattern.test(error.message),
      `self-test ${id} rejected for the wrong reason: ${error.message}`);
    failures.push(id);
  }
  try {
    const artifactRoot = path.join(parent, 'artifact-root');
    fs.mkdirSync(artifactRoot, { mode: 0o700 });
    const releaseId = 'self-test-beta-1';
    [SCHEMAS.runtime, SCHEMAS.diff, ...Object.values(governanceEngine.SCHEMA_PATHS)]
      .forEach(relative => copySelfTestFile(sourceRoot, artifactRoot, relative));
    Object.values(packageEngine.RUNTIME_FILE_NAMES).forEach(filename => {
      writeSelfTestFile(artifactRoot,
        `data/climate/public-beta/runtime/releases/${releaseId}/${filename}`,
        Buffer.from(`SELF-TEST ONLY — NO REVIEW OR PUBLICATION AUTHORITY — ${filename}\n`));
    });
    const feedback = feedbackFixture();
    const feedbackPath = path.join(artifactRoot, FEEDBACK_CONTRACT_PATH);
    writeSelfTestFile(artifactRoot, FEEDBACK_CONTRACT_PATH, canonicalBytes(feedback));
    const artifactPolicy = policyFixture();
    artifactPolicy.governance_contracts.feedback_privacy_contract_sha256 =
      packageEngine.sha256Bytes(canonicalBytes(feedback));
    writeSelfTestFile(artifactRoot, 'data/climate/public-beta/governance/policy.json',
      canonicalBytes(artifactPolicy));
    const sealedFixture = ({ root, releaseId: selected }) => ({
      status: 'pass',
      beta_release_id: selected,
      artifacts: Object.values(packageEngine.RUNTIME_FILE_NAMES).map(filename => {
        const record = packageEngine.inspectRegular(root,
          `data/climate/public-beta/runtime/releases/${selected}/${filename}`);
        return { path: record.path, sha256: record.sha256 };
      }).sort((left, right) => compareStrings(left.path, right.path)),
      assessed_production_authority: false,
    });
    generateRuntime({
      root: artifactRoot,
      releaseId,
      verificationTime: '2026-07-17T10:00:00.000Z',
      feedbackContract: feedbackPath,
    }, { validateSealedRuntime: sealedFixture });
    positives += 1;
    reject('overwrite', () => generateRuntime({
      root: artifactRoot,
      releaseId,
      verificationTime: '2026-07-17T10:00:00.000Z',
      feedbackContract: feedbackPath,
    }, { validateSealedRuntime: sealedFixture }), /refusing to overwrite/);

    const incomplete = feedbackFixture();
    delete incomplete.accountable_owner;
    reject('missing-human-input', () => governanceEngine.validateFeedbackPrivacyContract(incomplete, {
      schema: governanceEngine.loadSchemas(artifactRoot).feedbackPrivacy,
    }), /unexpected or missing|required/);
    reject('path-escape', () => atomicCreateJson(artifactRoot, '../escaped.json', {}, 'self-test escape'),
      /unsafe repository path|escapes/);
    const external = path.join(parent, 'external-output');
    fs.mkdirSync(external);
    fs.symlinkSync(external, path.join(artifactRoot, 'linked-output'));
    reject('symlink-output', () => atomicCreateJson(artifactRoot, 'linked-output/value.json', {},
      'self-test symlink output'), /symbolic link/);

    surfaceEngine.FIXED_MAPPINGS.forEach(mapping => {
      if (mapping.source_path === surfaceEngine.RUNTIME_MANIFEST_PATH) return;
      if (entryExists(path.join(artifactRoot, mapping.source_path))) return;
      writeSelfTestFile(artifactRoot, mapping.source_path,
        Buffer.from(`SELF-TEST ONLY — NO PUBLICATION AUTHORITY — ${mapping.source_path}\n`));
    });
    fs.mkdirSync(path.join(artifactRoot, 'data/climate/public-beta/governance'), { recursive: true });
    fs.mkdirSync(path.join(artifactRoot, `data/climate/public-beta/governance/releases/${releaseId}`),
      { recursive: true });
    generateSurface({ root: artifactRoot, releaseId });
    generateDiff({
      root: artifactRoot,
      releaseId,
      currentSnapshot: path.join(artifactRoot, OUTPUTS.surface()),
    });
    positives += 2;

    const gitRoot = path.join(parent, 'bp-git-root');
    fs.mkdirSync(gitRoot, { mode: 0o700 });
    gitSelfTest(gitRoot, ['init', '-q']);
    gitSelfTest(gitRoot, ['config', 'user.name', 'ELU fixture-only self-test']);
    gitSelfTest(gitRoot, ['config', 'user.email', 'fixture-only@invalid.local']);
    gitSelfTest(gitRoot, ['commit', '--allow-empty', '-q', '-m', 'fixture baseline']);
    const baselineCommit = gitSelfTest(gitRoot, ['rev-parse', 'HEAD']);
    const rollbackReleaseId = 'self-test-beta-rollback-1';
    const targetPaths = [...new Set([
      ...packageEngine.requiredRollbackTargetPaths(rollbackReleaseId),
      'tools/generate-climate-public-beta-artifacts.js',
    ])].sort(compareStrings);
    targetPaths.forEach(relative => writeSelfTestFile(gitRoot, relative,
      Buffer.from(`SELF-TEST ONLY — NO REVIEW OR PUBLICATION AUTHORITY — ${relative}\n`)));
    [SCHEMAS.rollback,
      'data/climate/public-beta/schemas/climate-public-beta-policy.schema.json'].forEach(relative =>
      copySelfTestFile(sourceRoot, gitRoot, relative));
    const policy = policyFixture();
    writeSelfTestFile(gitRoot, 'data/climate/public-beta/governance/policy.json', canonicalBytes(policy));
    gitSelfTest(gitRoot, ['add', '-A']);
    gitSelfTest(gitRoot, ['commit', '-q', '-m', 'fixture BP']);
    const releaseCommit = gitSelfTest(gitRoot, ['rev-parse', 'HEAD']);
    const planPath = path.join(parent, 'hosted-withdrawal-plan.json');
    fs.writeFileSync(planPath, canonicalBytes(hostedPlanFixture(policy)), { mode: 0o600 });
    const baseOptions = {
      root: fs.realpathSync(gitRoot),
      releaseId: rollbackReleaseId,
      releaseCommit,
      baselineCommit,
      hostedWithdrawalPlan: planPath,
      evidenceId: 'self-test-only-rollback-execution',
      executedAt: '2026-07-17T11:00:00.000Z',
      proofCreatedAt: '2026-07-17T11:01:00.000Z',
      executorIdentity: 'urn:elu:self-test-only:rollback-executor',
      executionSubjectIdentity: 'urn:elu:self-test-only:rollback-subject',
    };
    const discover = () => targetPaths;
    const headDriftWork = path.join(parent, 'head-drift-work');
    fs.mkdirSync(headDriftWork);
    reject('head-drift', () => generateRollback({
      ...baseOptions,
      releaseCommit: baselineCommit,
      workDir: fs.realpathSync(headDriftWork),
    }, { discoverRollbackTargetPaths: discover, policy }), /must differ|exact Git HEAD/);
    const dirtyPath = path.join(gitRoot, targetPaths[0]);
    const cleanBytes = fs.readFileSync(dirtyPath);
    fs.appendFileSync(dirtyPath, 'SELF-TEST DIRTY DRIFT\n');
    const dirtyWork = path.join(parent, 'dirty-work');
    fs.mkdirSync(dirtyWork);
    reject('dirty-working-tree', () => generateRollback({
      ...baseOptions,
      workDir: fs.realpathSync(dirtyWork),
    }, { discoverRollbackTargetPaths: discover, policy }), /completely clean/);
    fs.writeFileSync(dirtyPath, cleanBytes);
    const workRoot = path.join(parent, 'rollback-work');
    fs.mkdirSync(workRoot);
    const rollback = generateRollback({
      ...baseOptions,
      workDir: fs.realpathSync(workRoot),
    }, { discoverRollbackTargetPaths: discover, policy });
    assert(rollback.status === 'rollback_proof_created_pending_independent_review' &&
      !entryExists(path.join(gitRoot, packageEngine.scopeSelfPath(rollbackReleaseId))),
    'BP rollback proof unexpectedly required or created a BA scope');
    positives += 1;
    const overwriteWork = path.join(parent, 'rollback-overwrite-work');
    fs.mkdirSync(overwriteWork);
    reject('rollback-overwrite', () => generateRollback({
      ...baseOptions,
      workDir: fs.realpathSync(overwriteWork),
    }, { discoverRollbackTargetPaths: discover, policy }), /refusing to overwrite/);
    reject('missing-rollback-human-identity', () => packageEngine.validateProductionIdentity(undefined,
      'rollback executor identity'), /genuine|real, explicit/);

    return {
      status: 'pass',
      fixture_only: true,
      positive_cases: positives,
      fail_closed_cases: failures.length,
      fail_closed_ids: failures,
      bp_before_scope_proved: true,
      review_authority: false,
      publication_authority: false,
      assessed_production_authority: false,
      signing_performed: false,
      deployment_performed: false,
    };
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
}

function main(argv) {
  const parsed = parseArguments(argv);
  if (parsed.help) {
    process.stdout.write(helpText());
    return;
  }
  const options = modeOptions(parsed);
  let report;
  if (parsed.mode === 'runtime') report = generateRuntime(options);
  else if (parsed.mode === 'surface') report = generateSurface(options);
  else if (parsed.mode === 'diff') report = generateDiff(options);
  else if (parsed.mode === 'rollback') report = generateRollback(options);
  else if (parsed.mode === 'scope') report = generateScope(options);
  else report = runSelfTest(options.root);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`Climate Public Beta artifact generator: FAIL — ${error.message}\n`);
  process.exitCode = 1;
}
