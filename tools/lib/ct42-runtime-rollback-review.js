'use strict';

const childProcess = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { stable, validateJsonSchema } = require('./json-schema-lite');
const { validateProofDocument } = require('./ct42-runtime-rollback-proof');

const SCHEMA_PATH = 'data/climate/schemas/ct42-runtime-rollback-review.schema.json';
const REVIEW_PATH = 'data/climate/reviews/ct42-runtime-rollback-review.json';
const PROOF_PATH = 'data/climate/reviews/ct42-candidate-rollback-rehearsal.json';
const CT40_RESULT_PATH = 'data/climate/reviews/ct42-ct40-release-review-result.json';
const CANDIDATE_MANIFEST_PATH = 'data/climate/runtime/candidate-manifest.json';
const RUNTIME_DATA_PATH = 'data/climate/runtime/country-factual-candidate.json';
const PUBLISHED_FACTS_PATH = 'data/climate/runtime/published-facts-candidate.json';
const ROLLBACK_PLAN_PATH = 'data/climate/runtime/rollback-plan.json';
const PATCH_PATH = 'data/climate/operations/ct42-runtime-rollback.patch.b64';
const RAW_EVIDENCE_PATH = 'data/climate/reviews/ct42-runtime-rollback-review-evidence.json';

const SUBJECT_PIN_PATHS = Object.freeze([
  PROOF_PATH,
  CT40_RESULT_PATH,
  CANDIDATE_MANIFEST_PATH,
  RUNTIME_DATA_PATH,
  PUBLISHED_FACTS_PATH,
  ROLLBACK_PLAN_PATH,
  PATCH_PATH,
  'tools/build-ct42-runtime-rollback-proof.js',
  'tools/check-ct42-runtime-rollback-proof.js',
  'tools/rehearse-ct42-runtime-rollback.js',
  'tools/lib/ct42-runtime-rollback-proof.js',
  SCHEMA_PATH,
  'data/climate/fixtures/ct42-runtime-rollback-review.json',
  'tools/lib/ct42-runtime-rollback-review.js',
  'tools/check-ct42-runtime-rollback-review.js',
]);

const EXPECTED_COUNTS = Object.freeze({
  countries: 249,
  reviewedFactualCountries: 206,
  sourceGapCountries: 43,
  facts: 2060,
  polygons: 173,
  smallStatePoints: 28,
  entities: 201,
  controls: 7,
  runtimeDependencies: 14,
  smokeTests: 18,
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function calculationHash(value) {
  const copy = structuredClone(value);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function isSafeRelative(relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\')) return false;
  const normalized = path.posix.normalize(relative);
  return normalized === relative && normalized !== '..' && !normalized.startsWith('../') && !path.posix.isAbsolute(normalized);
}

function regularNonSymlink(root, relative) {
  if (!isSafeRelative(relative)) return false;
  try {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return false;
    let current = root;
    for (const [index, part] of relative.split('/').entries()) {
      current = path.join(current, part);
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return false;
      if (index < relative.split('/').length - 1 && !stat.isDirectory()) return false;
      if (index === relative.split('/').length - 1 && !stat.isFile()) return false;
    }
    const rootReal = fs.realpathSync(root);
    const fileReal = fs.realpathSync(current);
    return fileReal.startsWith(rootReal + path.sep);
  } catch {
    return false;
  }
}

function readRegular(root, relative) {
  if (!regularNonSymlink(root, relative)) throw new Error(`regular non-symlink file required: ${relative}`);
  return fs.readFileSync(path.join(root, relative));
}

function parseJsonNoDuplicateKeys(source, label = 'JSON') {
  let index = 0;
  const fail = message => { throw new Error(`${label}: ${message} at byte ${index}`); };
  const skipWhitespace = () => { while ([' ', '\t', '\n', '\r'].includes(source[index])) index += 1; };
  const parseString = () => {
    const start = index;
    if (source[index] !== '"') fail('string expected');
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const character = source[index++];
      if (escaped) { escaped = false; continue; }
      if (character === '\\') { escaped = true; continue; }
      if (character === '"') {
        try { return JSON.parse(source.slice(start, index)); }
        catch { fail('invalid JSON string'); }
      }
      if (character < ' ') fail('unescaped control character');
    }
    fail('unterminated string');
  };
  const parseValue = () => {
    skipWhitespace();
    if (source[index] === '"') return parseString();
    if (source[index] === '{') {
      index += 1;
      skipWhitespace();
      const value = {};
      const keys = new Set();
      if (source[index] === '}') { index += 1; return value; }
      while (true) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) fail(`duplicate object key ${JSON.stringify(key)}`);
        keys.add(key);
        skipWhitespace();
        if (source[index++] !== ':') fail('object colon expected');
        value[key] = parseValue();
        skipWhitespace();
        if (source[index] === '}') { index += 1; return value; }
        if (source[index++] !== ',') fail('object comma expected');
      }
    }
    if (source[index] === '[') {
      index += 1;
      skipWhitespace();
      const value = [];
      if (source[index] === ']') { index += 1; return value; }
      while (true) {
        value.push(parseValue());
        skipWhitespace();
        if (source[index] === ']') { index += 1; return value; }
        if (source[index++] !== ',') fail('array comma expected');
      }
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(literal, index)) { index += literal.length; return value; }
    }
    const number = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!number) fail('JSON value expected');
    index += number[0].length;
    return Number(number[0]);
  };
  const value = parseValue();
  skipWhitespace();
  if (index !== source.length) fail('unexpected trailing input');
  return value;
}

function readJsonRegular(root, relative) {
  return parseJsonNoDuplicateKeys(readRegular(root, relative).toString('utf8'), relative);
}

function git(root, args, encoding = null) {
  return childProcess.spawnSync('git', args, { cwd: root, encoding, maxBuffer: 32 * 1024 * 1024 });
}

function gitFile(root, commit, relative) {
  const result = git(root, ['show', `${commit}:${relative}`]);
  if (result.status !== 0) throw new Error(`${commit} cannot read ${relative}`);
  return result.stdout;
}

function isAncestor(root, older, newer) {
  return git(root, ['merge-base', '--is-ancestor', older, newer], 'utf8').status === 0;
}

function validHumanIdentity(value, allowFixtureIdentities = false) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 &&
    (allowFixtureIdentities || !/(?:^|[\s@._-])(fake|self|invented|unknown|example|placeholder|test|fixture|tbd|todo)(?:$|[\s@._-])/i.test(value));
}

function validEnvironmentText(value, allowFixtureIdentities = false) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 &&
    (allowFixtureIdentities || !/(?:fake|invented|unknown|example|placeholder|test|fixture|tbd|todo)/i.test(value));
}

function add(errors, code, detail) {
  errors.push({ code, detail: String(detail) });
}

function pinByPath(review) {
  return new Map((review?.subject?.pins || []).map(pin => [pin?.path, pin]));
}

function exactPathSet(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function deriveResult(observations) {
  const materialization = observations?.materialization;
  const candidate = observations?.candidate;
  const runtime = observations?.neutral_runtime;
  const browser = observations?.browser;
  if (!materialization || !candidate || !runtime || !browser) return 'fail';
  const checks = [
    materialization.complete === true,
    materialization.regular_files_only === true,
    materialization.controls === EXPECTED_COUNTS.controls,
    materialization.runtime_dependencies === EXPECTED_COUNTS.runtimeDependencies,
    candidate.review_status === 'not_reviewed',
    candidate.decision === 'deny',
    candidate.release_eligible === false,
    candidate.production_runtime_release === false,
    candidate.countries === EXPECTED_COUNTS.countries,
    candidate.reviewed_factual_countries === EXPECTED_COUNTS.reviewedFactualCountries,
    candidate.source_gap_countries === EXPECTED_COUNTS.sourceGapCountries,
    candidate.facts === EXPECTED_COUNTS.facts,
    runtime.polygons === EXPECTED_COUNTS.polygons,
    runtime.small_state_points === EXPECTED_COUNTS.smallStatePoints,
    runtime.entities === EXPECTED_COUNTS.entities,
    runtime.climate_values === 0,
    runtime.evidence_state === 'withheld_for_all',
    runtime.surface === null,
    runtime.background === null,
    runtime.candidate_requests === 0,
    runtime.visual_asset_requests === 0,
    runtime.remote_runtime_requests === 0,
    browser.canvas_count === 1,
    browser.smoke_total === EXPECTED_COUNTS.smokeTests,
    browser.smoke_passed === EXPECTED_COUNTS.smokeTests,
    browser.smoke_failed === 0,
    browser.smoke_critical_failed === 0,
    browser.stack_lint_issues === 0,
    browser.horizontal_overflow_320px === 0,
    typeof browser.minimum_control_target_px === 'number' && browser.minimum_control_target_px >= 44,
    typeof browser.command === 'string' && browser.command.length >= 12,
  ];
  return checks.every(Boolean) ? 'pass' : 'fail';
}

function validateRawEvidence(root, review, errors) {
  const evidence = review?.observations?.raw_evidence;
  if (evidence?.path !== RAW_EVIDENCE_PATH || !/^[a-f0-9]{64}$/.test(evidence?.sha256 || '')) {
    add(errors, 'review_raw_evidence_pin_invalid', 'Raw evidence must use the canonical path and a SHA-256 digest.');
    return;
  }
  if (!regularNonSymlink(root, RAW_EVIDENCE_PATH)) {
    add(errors, 'review_raw_evidence_missing', RAW_EVIDENCE_PATH);
    return;
  }
  try {
    const bytes = readRegular(root, RAW_EVIDENCE_PATH);
    if (sha256(bytes) !== evidence.sha256) add(errors, 'review_raw_evidence_hash_mismatch', RAW_EVIDENCE_PATH);
    const parsed = parseJsonNoDuplicateKeys(bytes.toString('utf8'), RAW_EVIDENCE_PATH);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).length === 0) {
      add(errors, 'review_raw_evidence_invalid', 'Raw evidence must be a non-empty JSON object.');
    }
  } catch (error) {
    add(errors, 'review_raw_evidence_invalid', error.message);
  }
}

function validateProofSemantics(root, proof, pins, errors, ct40Commit, review) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
    add(errors, 'proof_invalid_json', 'Rollback proof must be an object.');
    return;
  }
  if (proof.status !== 'built_not_reviewed_browser_gate_required') add(errors, 'proof_status_not_not_reviewed', proof.status);
  if (proof.release_authority !== false || proof.deploy_authority !== false) add(errors, 'proof_authority_widened', 'Rollback proof must remain non-authorizing.');
  if (proof.review?.status !== 'not_reviewed' || proof.review?.reviewer_id !== null || proof.review?.reviewed_at !== null || proof.review?.independent_review_required !== true) {
    add(errors, 'proof_review_state_widened', 'Rollback proof must remain not_reviewed with no reviewer or timestamp.');
  }
  if (proof.execution?.browser_gate?.status !== 'external_required_not_recorded' ||
      proof.execution?.browser_gate?.release_authority !== false ||
      proof.execution?.browser_gate?.deploy_authority !== false) {
    add(errors, 'proof_browser_gate_widened', 'Proof browser gate must remain external and non-authorizing.');
  }
  const candidate = proof.candidate || {};
  if (candidate.decision !== 'deny' || candidate.decision_scope !== 'assessed_climate_release' ||
      candidate.release_eligible !== false || candidate.production_runtime_release !== false) {
    add(errors, 'proof_candidate_boundary_widened', 'CT-42 candidate must remain a denied assessed-climate release.');
  }
  if (candidate.review_chain_head !== ct40Commit || candidate.runtime_control_commit !== ct40Commit ||
      candidate.review_chain_late_bound !== false || candidate.review_chain_ct40_sha256 !== pins.get(CT40_RESULT_PATH)?.sha256) {
    add(errors, 'proof_review_chain_binding_invalid', 'Proof must bind its final CT-40 U commit and result hash directly, not a stale runtime coordinate.');
  }
  if (candidate.ct40_result?.path !== CT40_RESULT_PATH || candidate.ct40_result?.sha256 !== pins.get(CT40_RESULT_PATH)?.sha256) {
    add(errors, 'proof_ct40_pin_mismatch', 'Proof CT-40 result must match the reviewed subject pin.');
  }
  if (candidate.candidate_manifest?.path !== CANDIDATE_MANIFEST_PATH || candidate.candidate_manifest?.sha256 !== pins.get(CANDIDATE_MANIFEST_PATH)?.sha256 ||
      candidate.runtime_data?.path !== RUNTIME_DATA_PATH || candidate.runtime_data?.sha256 !== pins.get(RUNTIME_DATA_PATH)?.sha256 ||
      candidate.rollback_plan?.path !== ROLLBACK_PLAN_PATH || candidate.rollback_plan?.sha256 !== pins.get(ROLLBACK_PLAN_PATH)?.sha256) {
    add(errors, 'proof_candidate_pin_mismatch', 'Proof candidate inputs must match the reviewed subject pins.');
  }
  const boundary = proof.rollback?.entity_boundary;
  if (!boundary || boundary.total !== EXPECTED_COUNTS.entities ||
      boundary.retained_natural_earth_polygons !== EXPECTED_COUNTS.polygons ||
      boundary.approximate_small_state_points !== EXPECTED_COUNTS.smallStatePoints ||
      boundary.climate_values !== 0 || boundary.evidence_state !== 'withheld_for_all') {
    add(errors, 'proof_neutral_boundary_mismatch', 'Proof does not retain the exact 173 + 28 = 201 neutral boundary.');
  }
  if (!Array.isArray(proof.rollback?.controls) || proof.rollback.controls.length !== EXPECTED_COUNTS.controls ||
      !Array.isArray(proof.rollback?.runtime_dependency_closure) || proof.rollback.runtime_dependency_closure.length !== EXPECTED_COUNTS.runtimeDependencies) {
    add(errors, 'proof_rehearsal_closure_mismatch', 'Proof must retain exactly seven controls and fourteen runtime dependencies.');
  }
  const patchFiles = proof.rollback?.patch?.changed_files;
  if (!Array.isArray(patchFiles) || patchFiles.length !== 6 || new Set(patchFiles).size !== 6 || patchFiles.some(relative => !isSafeRelative(relative))) {
    add(errors, 'proof_patch_changed_file_set_invalid', 'Rollback proof must retain exactly six unique safe changed files.');
  }
  if (proof.rollback?.patch?.path !== PATCH_PATH || proof.rollback?.patch?.sha256 !== pins.get(PATCH_PATH)?.sha256) {
    add(errors, 'proof_patch_pin_mismatch', 'Proof patch must match the reviewed subject pin.');
  }
  let decodedPatch;
  try {
    const encodedPatch = readRegular(root, PATCH_PATH).toString('utf8').trim();
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encodedPatch)) throw new Error('canonical base64 required');
    decodedPatch = Buffer.from(encodedPatch, 'base64');
    if (decodedPatch.toString('base64') !== encodedPatch) throw new Error('non-canonical base64 encoding');
  } catch (error) {
    add(errors, 'proof_patch_decoding_invalid', error.message);
  }
  if (proof.rollback?.patch?.decoded_sha256 !== review.subject?.patch_decoded_sha256 ||
      (decodedPatch && sha256(decodedPatch) !== review.subject?.patch_decoded_sha256)) {
    add(errors, 'proof_patch_decoded_pin_mismatch', 'Proof decoded patch hash must match the independently reviewed subject binding.');
  }
  const dependencies = proof.rollback?.runtime_dependency_closure || [];
  const committedDependencies = dependencies.filter(dependency => dependency?.source_commit === ct40Commit);
  const vendorDependency = dependencies.filter(dependency => dependency?.path === 'js/vendor/globe.gl.js' && dependency?.source_commit === null);
  if (committedDependencies.length !== 13 || vendorDependency.length !== 1 ||
      dependencies.some(dependency => dependency?.source_commit !== ct40Commit && dependency?.path !== 'js/vendor/globe.gl.js')) {
    add(errors, 'proof_runtime_dependency_commit_binding_invalid', 'All thirteen committed runtime dependencies must be sourced from U; only the verified vendor dependency may be external.');
  }
  if (!/^[a-f0-9]{64}$/.test(proof.calculation_hash || '') || proof.calculation_hash !== calculationHash(proof)) {
    add(errors, 'proof_calculation_hash_mismatch', 'Rollback proof calculation hash is not canonical.');
  }
}

function validateCurrentArtifacts(root, review, pins, errors, options = {}) {
  const proofCommit = review.subject?.rollback_proof_commit_sha;
  const ct40Commit = review.subject?.ct40_review_commit_sha;
  if (!/^[a-f0-9]{40}$/.test(proofCommit || '') || !/^[a-f0-9]{40}$/.test(ct40Commit || '')) {
    add(errors, 'subject_commit_invalid', 'Subject commits must be full Git SHAs.');
    return;
  }
  const head = git(root, ['rev-parse', 'HEAD'], 'utf8');
  if (head.status !== 0) {
    add(errors, 'subject_head_unavailable', 'Repository HEAD is unavailable.');
    return;
  }
  if (proofCommit === ct40Commit || !isAncestor(root, ct40Commit, proofCommit) || !isAncestor(root, proofCommit, head.stdout.trim())) {
    add(errors, 'subject_p_u_ancestry_invalid', 'CT-40 U must precede rollback-proof P, and P must be durable in current HEAD.');
  }
  for (const relative of SUBJECT_PIN_PATHS) {
    const pin = pins.get(relative);
    if (!pin || !/^[a-f0-9]{64}$/.test(pin.sha256 || '')) {
      add(errors, 'subject_pin_invalid', relative);
      continue;
    }
    if (!regularNonSymlink(root, relative)) {
      add(errors, 'subject_path_not_regular', relative);
      continue;
    }
    try {
      const current = readRegular(root, relative);
      const atProofCommit = gitFile(root, proofCommit, relative);
      if (sha256(current) !== pin.sha256 || sha256(atProofCommit) !== pin.sha256) add(errors, 'subject_current_p_pin_drift', relative);
      if (relative === CT40_RESULT_PATH) {
        const atCt40Commit = gitFile(root, ct40Commit, relative);
        if (sha256(atCt40Commit) !== pin.sha256) add(errors, 'subject_u_ct40_pin_drift', relative);
      }
    } catch (error) {
      add(errors, 'subject_commit_path_unavailable', `${relative}: ${error.message}`);
    }
  }
  try {
    const proof = readJsonRegular(root, PROOF_PATH);
    if (review.subject?.proof_calculation_hash !== proof.calculation_hash ||
        review.subject?.patch_decoded_sha256 !== proof.rollback?.patch?.decoded_sha256) {
      add(errors, 'subject_derived_proof_binding_mismatch', 'Subject must bind the proof calculation hash and decoded patch hash exactly.');
    }
    if (!options.allowFixtureIdentities) {
      try {
        validateProofDocument(root, proof, {
          expectedCalculationHash: review.subject?.proof_calculation_hash,
          expectedPatchSha256: pins.get(PATCH_PATH)?.sha256,
          allowMissingVendor: !regularNonSymlink(root, 'js/vendor/globe.gl.js'),
        });
      } catch (error) {
        add(errors, 'proof_authoritative_validation_failed', error.message);
      }
    }
    validateProofSemantics(root, proof, pins, errors, ct40Commit, review);
  } catch (error) {
    add(errors, 'proof_unavailable', error.message);
  }
}

function validateCt42RuntimeRollbackReview(root, review, options = {}) {
  const errors = [];
  let schema;
  try {
    schema = options.schema || readJsonRegular(root, SCHEMA_PATH);
    validateJsonSchema(review, schema).forEach(detail => add(errors, 'review_schema_invalid', detail));
  } catch (error) {
    add(errors, 'review_schema_unavailable', error.message);
  }
  if (!review || typeof review !== 'object' || Array.isArray(review)) return { pass: false, errors, derived_result: 'fail' };
  if (review.calculation_hash !== calculationHash(review)) add(errors, 'review_calculation_hash_mismatch', 'Review hash is not canonical.');
  if (review.release_authority !== false || review.deploy_authority !== false || review.outcome?.release_authority !== false || review.outcome?.deploy_authority !== false) {
    add(errors, 'review_authority_widened', 'Review record must never authorize release or deployment.');
  }
  if (review.status !== 'reviewed' || review.review?.independent !== true || review.review?.builder_id === review.review?.reviewer_id ||
      !validHumanIdentity(review.review?.builder_id, options.allowFixtureIdentities) ||
      !validHumanIdentity(review.review?.reviewer_id, options.allowFixtureIdentities)) {
    add(errors, 'review_independence_invalid', 'Independent non-placeholder builder and reviewer identities are required.');
  }
  for (const field of ['origin', 'browser', 'operating_system']) {
    if (!validEnvironmentText(review.environment?.[field], options.allowFixtureIdentities)) add(errors, 'review_environment_invalid', field);
  }
  const timestamps = ['executed_at', 'recorded_at', 'reviewed_at'].map((field, index) => {
    const value = index === 0 ? review.environment?.[field] : index === 1 ? review.observations?.[field] : review.review?.[field];
    const parsed = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  });
  if (timestamps.some(value => value === null)) add(errors, 'review_timestamp_invalid', 'Execution, observation, and review timestamps must be valid UTC timestamps.');
  else if (timestamps[0] > timestamps[1] || timestamps[1] > timestamps[2]) add(errors, 'review_timestamp_order_invalid', 'Execution must precede observation, which must precede the independent review.');
  const pins = pinByPath(review);
  const pinPaths = Array.isArray(review.subject?.pins) ? review.subject.pins.map(pin => pin?.path) : [];
  if (!exactPathSet(pinPaths, SUBJECT_PIN_PATHS) || pins.size !== SUBJECT_PIN_PATHS.length) {
    add(errors, 'subject_pin_set_mismatch', 'Subject pins must be the exact canonical proof/tool/input path set in canonical order.');
  }
  validateRawEvidence(root, review, errors);
  validateCurrentArtifacts(root, review, pins, errors, options);
  let manifest;
  let runtime;
  let facts;
  let ct40;
  try {
    manifest = readJsonRegular(root, CANDIDATE_MANIFEST_PATH);
    runtime = readJsonRegular(root, RUNTIME_DATA_PATH);
    facts = readJsonRegular(root, PUBLISHED_FACTS_PATH);
    ct40 = readJsonRegular(root, CT40_RESULT_PATH);
    const factualCountries = runtime.countries.filter(country => country?.emissions?.status === 'reviewed_factual').length;
    const sourceGaps = runtime.countries.filter(country => country?.emissions?.status === 'source_gap').length;
    if (manifest.review_status !== 'not_reviewed' || manifest.decision !== 'deny' || manifest.release_eligible !== false || manifest.production_runtime_release !== false ||
        runtime.review_status !== 'not_reviewed' || runtime.production_runtime_release !== false || runtime.countries.length !== EXPECTED_COUNTS.countries ||
        factualCountries !== EXPECTED_COUNTS.reviewedFactualCountries || sourceGaps !== EXPECTED_COUNTS.sourceGapCountries || facts.fact_count !== EXPECTED_COUNTS.facts ||
        ct40.decision !== 'deny' || ct40.eligible !== false || ct40.release_authority !== false) {
      add(errors, 'ct42_current_boundary_invalid', 'Current candidate/CT-40 artifacts do not retain the exact denied 249/206/43/2060 boundary.');
    }
  } catch (error) {
    add(errors, 'ct42_subject_data_unavailable', error.message);
  }
  const derived = deriveResult(review.observations);
  if (review.outcome?.derived_from_observations !== true || review.outcome?.result !== derived) {
    add(errors, 'review_outcome_not_derived', `Stored=${review.outcome?.result}; derived=${derived}.`);
  }
  if (derived !== 'pass') add(errors, 'review_observations_failed', 'A failed rollback review must block this gate.');
  if (derived === 'pass' && (!manifest || !runtime || !facts || !ct40)) add(errors, 'review_outcome_evidence_missing', 'Pass cannot be derived without current CT-42 inputs.');
  errors.sort((left, right) => left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail));
  return { pass: errors.length === 0, errors, derived_result: derived };
}

module.exports = {
  CT40_RESULT_PATH,
  EXPECTED_COUNTS,
  PATCH_PATH,
  PROOF_PATH,
  RAW_EVIDENCE_PATH,
  REVIEW_PATH,
  SCHEMA_PATH,
  SUBJECT_PIN_PATHS,
  calculationHash,
  deriveResult,
  isSafeRelative,
  regularNonSymlink,
  parseJsonNoDuplicateKeys,
  sha256,
  validateCt42RuntimeRollbackReview,
};
