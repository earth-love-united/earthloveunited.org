'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {
  INPUTS,
  METRIC,
  LIMITATIONS,
  opaqueFactId,
  hashBytes,
  calculationHash,
  serialize,
  loadPinnedInputs,
  compile,
} = require('./climate-public-beta-data');
const {
  CONFIG: PRIMAP_CONFIG,
  assertPinnedSource,
  readSelectedRows,
  buildArtifact: buildPrimapArtifact,
  calculationHash: primapCalculationHash,
} = require('./primap-hist-ingest');
const policyEngine = require('./climate-public-beta-policy');
const {
  canonicalJsonText,
  parseJsonNoDuplicateKeys,
  same,
  validateJsonSchema,
} = require('./json-schema-lite');
const { fixtureReviewedNotices, validateReviewedNotices } = require('../check-climate-public-beta-ui');

const FIXED_RAW_BUILD_TIME = '2026-07-15T00:00:00Z';
const PINNED_RAW_CANDIDATE_PATH = 'data/climate/evidence/primap-hist-2.6.1-histtp-m0el-2014-2023.json';
const PINNED_RAW_CANDIDATE_SHA256 = 'e242e5a49ba963eaeafe472c8c6702a193e79f60cf6762083f4ba72e9aa239b6';
const PINNED_RAW_CALCULATION_HASH = '8182081d7ef30e24731aac43e28f5f2b1b1316dd4721100bb8c069972cd1be49';
const RAW_SOURCE_LOGICAL_PATH = 'external-sources/PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv';
const CANONICAL_LGPL_SHA256 = '20e50fe7aae3e56378ebf0417d9de904f55a0e61e4df315333e632a4d3555d95';

const SCHEMA_PATHS = Object.freeze({
  factual: 'data/climate/schemas/public-beta-reviewed-country-factual.schema.json',
  identity: 'data/climate/schemas/public-beta-reviewed-country-identity.schema.json',
  identityTransform: 'data/climate/schemas/public-beta-reviewed-country-identity-transform.schema.json',
  lineage: 'data/climate/schemas/public-beta-reviewed-fact-lineage.schema.json',
  knownLimitations: 'data/climate/schemas/public-beta-reviewed-known-limitations.schema.json',
  correctionLog: 'data/climate/schemas/public-beta-reviewed-correction-log.schema.json',
});
const RUNTIME_FILES = Object.freeze({
  factual: 'country-factual.json',
  identity: 'country-identity.json',
  identitySource: 'country-identity.SOURCE.md',
  identityTransform: 'country-identity-transform.json',
  lineage: 'fact-lineage.json',
  knownLimitations: 'known-limitations.json',
  correctionLog: 'correction-log.json',
});
const RIGHTS_REVIEW_PATHS = Object.freeze([
  'climate-public-beta/THIRD_PARTY_NOTICES.txt',
  'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt',
  'data/climate/source-registry.json',
].sort());
const TRUST_REGISTRY_PATH = 'data/climate/public-beta/governance/approval-trust.json';
const REVIEW_STEMS = Object.freeze({
  data_review: 'independent-data-review',
  rights_review: 'source-rights-review',
});
const PROPOSAL_FILE = 'review-proposal.json';
const PRIOR_CORRECTION_PROPOSAL_FILE = 'prior-corrections.review-input.json';
const MAX_PRIOR_CORRECTION_INPUT_BYTES = 1048576;
const CORRECTION_SCOPE = 'Corrections to source identity, source locators, transformations, values, limitations, or display wording require a new immutable beta release ID and renewed exact-byte reviews.';
const CORRECTION_CATEGORIES = new Set([
  'source_identity', 'source_locator', 'transformation', 'value', 'limitation', 'display_wording',
]);
const SELF_TEST_TOKEN = Symbol('climate-public-beta-reviewed-data-self-test');
const FINAL_STATUS = Object.freeze({
  content_state: 'reviewed_beta_release',
  public_beta_source_rights_reviewed: true,
  public_beta_redistribution_authorized: true,
  independent_review_state: 'reviewed',
  beta_runtime_release_eligible: true,
  assessed_production_authority: false,
});
const ASSESSED_KEYS = new Set([
  'assessment', 'score', 'composite_score', 'normative_score', 'performance',
  'delivery', 'target', 'commitment', 'ambition', 'fairness', 'impact',
  'impact_band', 'rank', 'ordinal', 'leader', 'laggard', 'on_track',
]);
const FACTUAL_IDENTITY_KEYS = new Set([
  'country_id', 'name', 'official_name', 'common_name', 'iso', 'iso_alpha2',
  'iso_alpha3', 'iso_numeric', 'flag', 'flag_emoji', 'source_entity_id',
  'source_fact_id', 'promoted_fact_id',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function clone(value) { return structuredClone(value); }

function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert(same(Object.keys(value).sort(), expected.slice().sort()), `${label} has unexpected fields`);
}

function isInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function canonicalRoot(root) {
  const stat = fs.lstatSync(root);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'repository root must be a regular non-symlink directory');
  return fs.realpathSync(root);
}

function assertSafeRepositoryPath(root, target, label) {
  const rootAbsolute = path.resolve(root);
  const rootReal = canonicalRoot(root);
  const absolute = path.resolve(target);
  assert(isInside(rootAbsolute, absolute), `${label} must remain inside the repository root`);
  const relative = path.relative(rootAbsolute, absolute);
  let current = rootReal;
  for (const component of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    if (!fs.existsSync(current)) break;
    const stat = fs.lstatSync(current);
    assert(!stat.isSymbolicLink(), `${label} path contains a symbolic link`);
    if (current !== absolute) assert(stat.isDirectory(), `${label} path contains a non-directory ancestor`);
  }
}

function readRegular(filePath, label) {
  const stat = fs.lstatSync(filePath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${label} must be a regular non-symlink file`);
  return fs.readFileSync(filePath);
}

function readRegularJson(filePath, label) {
  const bytes = readRegular(filePath, label);
  let value;
  try { value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), label); }
  catch (error) { throw new Error(`${label} is not valid JSON: ${error.message}`); }
  return { bytes, text: bytes.toString('utf8'), value };
}

function writeExclusive(filePath, bytes) {
  const descriptor = fs.openSync(filePath, 'wx', 0o600);
  try { fs.writeFileSync(descriptor, bytes); }
  finally { fs.closeSync(descriptor); }
}

function loadSchemas(root) {
  return Object.fromEntries(Object.entries(SCHEMA_PATHS).map(([name, relative]) => [
    name,
    readRegularJson(path.join(root, relative), `${name} reviewed schema`).value,
  ]));
}

function proposalLogicalPath(releaseId) {
  return `private-review/climate-public-beta/${releaseId}/${PROPOSAL_FILE}`;
}

function priorCorrectionLogicalPath(releaseId) {
  assert(policyEngine.validReleaseId(releaseId), 'invalid beta release ID');
  return `private-review/climate-public-beta/${releaseId}/${PRIOR_CORRECTION_PROPOSAL_FILE}`;
}

function correctionStatement(count) {
  assert(Number.isInteger(count) && count >= 0 && count <= 100, 'invalid correction count');
  if (count === 0) return 'No corrections are recorded for this immutable release.';
  return `This immutable release records ${count} privacy-safe correction${count === 1 ? '' : 's'} to superseded beta releases.`;
}

function assertPrivacySafeCorrectionText(value) {
  assert(typeof value === 'string' && value === value.trim() && value.length >= 20 && value.length <= 500,
    'correction description must be a concise public summary between 20 and 500 characters');
  assert(!/[\u0000-\u001f\u007f]/.test(value), 'correction description contains control characters');
  assert(!/(?:https?:\/\/|mailto:|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\/Users\/|\/home\/|[A-Za-z]:\\|\b(?:reporter|submitter|contact|email|phone|telephone)\b|\b\d{7,}\b)/i.test(value),
    'correction description contains contact, identity, private-path, URL, or long-number material');
  assert(!/(?:^|[\s._-])(?:fake|invented|unknown|example|placeholder|tbd|todo)(?:$|[\s._-])/i.test(value),
    'correction description contains a placeholder marker');
}

function validateCorrectionEntries(root, releaseId, entries) {
  assert(Array.isArray(entries) && entries.length >= 1 && entries.length <= 100,
    'later-release correction input must contain 1 to 100 entries');
  const ids = new Set();
  entries.forEach((entry, index) => {
    exactKeys(entry, [
      'correction_id', 'superseded_release_id', 'corrected_in_release_id',
      'recorded_at', 'category', 'description', 'affected_artifacts',
      'decision_reference',
    ], `correction entry ${index}`);
    assert(/^corr-[a-f0-9]{16,64}$/.test(entry.correction_id || ''),
      `correction entry ${index} has an invalid correction ID`);
    assert(!ids.has(entry.correction_id), `correction ID duplicated: ${entry.correction_id}`);
    ids.add(entry.correction_id);
    assert(policyEngine.validReleaseId(entry.superseded_release_id),
      `correction entry ${entry.correction_id} has an invalid superseded release ID`);
    assert(entry.superseded_release_id !== releaseId,
      `correction entry ${entry.correction_id} cannot supersede the current release`);
    assert(entry.corrected_in_release_id === releaseId,
      `correction entry ${entry.correction_id} must bind corrected_in_release_id to the current release`);
    assert(policyEngine.validTimestamp(entry.recorded_at),
      `correction entry ${entry.correction_id} requires a real, exact UTC recorded_at value supplied by the reviewer`);
    assert(CORRECTION_CATEGORIES.has(entry.category),
      `correction entry ${entry.correction_id} has an invalid category`);
    assertPrivacySafeCorrectionText(entry.description);
    assert(/^elu-correction-decision:[a-f0-9]{16,64}$/.test(entry.decision_reference || ''),
      `correction entry ${entry.correction_id} requires an opaque correction decision reference`);
    assert(Array.isArray(entry.affected_artifacts) && entry.affected_artifacts.length >= 1,
      `correction entry ${entry.correction_id} must pin at least one affected artifact`);
    const paths = [];
    const expectedRoot = `data/climate/public-beta/runtime/releases/${entry.superseded_release_id}/`;
    const allowedFiles = new Set(Object.values(RUNTIME_FILES));
    entry.affected_artifacts.forEach((pin, pinIndex) => {
      exactKeys(pin, ['path', 'sha256'], `correction entry ${entry.correction_id} artifact pin ${pinIndex}`);
      assert(typeof pin.path === 'string' && pin.path.startsWith(expectedRoot) &&
        allowedFiles.has(pin.path.slice(expectedRoot.length)) && !pin.path.includes('\\') &&
        !pin.path.split('/').includes('..'),
      `correction entry ${entry.correction_id} must pin an exact immutable artifact from its superseded release`);
      assert(/^[a-f0-9]{64}$/.test(pin.sha256 || ''),
        `correction entry ${entry.correction_id} artifact pin is missing an exact SHA-256`);
      const affectedBytes = readRegular(path.join(root, pin.path),
        `correction entry ${entry.correction_id} affected artifact ${pin.path}`);
      assert(hashBytes(affectedBytes) === pin.sha256,
        `correction entry ${entry.correction_id} affected artifact bytes do not match the supplied pin`);
      paths.push(pin.path);
    });
    assert(new Set(paths).size === paths.length && same(paths, paths.slice().sort()),
      `correction entry ${entry.correction_id} affected artifact pins must be unique and sorted`);
  });
  const order = entries.map(entry => `${entry.recorded_at}\0${entry.correction_id}`);
  assert(same(order, order.slice().sort()), 'correction entries must be sorted by recorded_at then correction_id');
  return clone(entries);
}

function validatePriorCorrectionInputBytes(root, releaseId, bytes, expectedPin = null) {
  assert(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= MAX_PRIOR_CORRECTION_INPUT_BYTES,
    'private prior-correction input has an invalid byte size');
  let value;
  try {
    value = parseJsonNoDuplicateKeys(bytes.toString('utf8'), 'private prior-correction input');
  }
  catch (error) { throw new Error(`private prior-correction input is not valid JSON: ${error.message}`); }
  assert(bytes.equals(serialize(value)),
    'private prior-correction input must use the exact canonical two-space JSON plus trailing newline form');
  const correctionSchema = loadSchemas(root).correctionLog;
  const errors = validateJsonSchema(value, correctionSchema.$defs.priorCorrectionInput, correctionSchema);
  assert(errors.length === 0,
    `private prior-correction input schema validation failed: ${errors.slice(0, 5).join('; ')}`);
  assert(value.beta_release_id === releaseId,
    'private prior-correction input belongs to a different beta release');
  const entries = validateCorrectionEntries(root, releaseId, value.entries);
  const pin = { path: priorCorrectionLogicalPath(releaseId), sha256: hashBytes(bytes) };
  if (expectedPin) assert(same(pin, expectedPin), 'private prior-correction input bytes differ from the exact proposal pin');
  return { bytes, value, entries, pin };
}

function readPrivatePriorCorrectionInput(root, releaseId, inputPath) {
  assert(path.isAbsolute(inputPath), '--prior-corrections must be an absolute path');
  const real = fs.realpathSync(inputPath);
  assert(!isInside(canonicalRoot(root), real),
    'private prior-correction input must remain outside the public repository');
  return validatePriorCorrectionInputBytes(root, releaseId,
    readRegular(inputPath, 'private prior-correction input'));
}

function existingRuntimeReleaseIds(root) {
  const releases = path.join(root, 'data/climate/public-beta/runtime/releases');
  if (!fs.existsSync(releases)) return [];
  const stat = fs.lstatSync(releases);
  assert(stat.isDirectory() && !stat.isSymbolicLink(), 'runtime releases root must be a regular non-symlink directory');
  return fs.readdirSync(releases, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), `runtime releases root contains a symbolic link: ${entry.name}`);
    if (!entry.isDirectory()) return [];
    assert(policyEngine.validReleaseId(entry.name),
      `runtime releases root contains an invalid release directory: ${entry.name}`);
    return [entry.name];
  }).sort();
}

function correctionContextForPreparation(root, releaseId, inputPath) {
  const existing = existingRuntimeReleaseIds(root);
  const earlier = existing.filter(item => item !== releaseId);
  assert(!existing.includes(releaseId),
    'the selected beta release ID already has a runtime release directory');
  if (earlier.length === 0) {
    assert(!inputPath, 'the first immutable beta release must use the deterministic empty correction log');
    return null;
  }
  assert(inputPath, 'a later beta release requires --prior-corrections with an exact private reviewed input');
  const context = readPrivatePriorCorrectionInput(root, releaseId, inputPath);
  const superseded = new Set(context.entries.map(entry => entry.superseded_release_id));
  superseded.forEach(id => assert(earlier.includes(id),
    `private prior-correction input references an unavailable superseded release: ${id}`));
  return context;
}

function canonicalRawSeries(series) {
  return series.map(item => ({
    country_id: item.country_id,
    iso_alpha3: item.iso_alpha3,
    source_locator: item.source_locator,
    values: item.values.map(point => ({
      year: point.year,
      value_mtco2e: point.value_mtco2e,
      normalized_value_decimal: point.normalized_value_decimal,
      fact_id: point.fact_id,
      source_fact_id: point.source_fact_id,
    })),
  }));
}

function validateRawRebuild(root, rebuilt, inputs) {
  const candidateBytes = readRegular(path.join(root, PINNED_RAW_CANDIDATE_PATH), 'pinned PRIMAP raw-rebuild candidate');
  assert(hashBytes(candidateBytes) === PINNED_RAW_CANDIDATE_SHA256, 'pinned raw-rebuild candidate byte hash mismatch');
  const candidate = parseJsonNoDuplicateKeys(
    candidateBytes.toString('utf8'), 'pinned PRIMAP raw-rebuild candidate');
  assert(rebuilt?.schema_version === '1.0.0' && rebuilt?.created_at === FIXED_RAW_BUILD_TIME,
    'raw rebuild envelope drift');
  assert(rebuilt?.source?.input_hash_sha256 === PRIMAP_CONFIG.source_sha256,
    'raw rebuild source SHA-256 drift');
  assert(primapCalculationHash(rebuilt) === PINNED_RAW_CALCULATION_HASH &&
    rebuilt.calculation_hash === PINNED_RAW_CALCULATION_HASH, 'raw rebuild calculation hash drift');
  assert(same(rebuilt, candidate), 'fresh raw rebuild differs from the exact pinned candidate');
  assert(hashBytes(serialize(rebuilt)) === PINNED_RAW_CANDIDATE_SHA256,
    'fresh raw rebuild serialized bytes drift');
  assert(same(canonicalRawSeries(rebuilt.series), inputs.promotion.value.series),
    'fresh raw rebuild differs from the pinned CT-10C factual series');
  assert(Array.isArray(rebuilt.series) && rebuilt.series.length === 206, 'raw rebuild series count drift');
  assert(rebuilt.series.reduce((count, item) => count + item.values.length, 0) === 2060,
    'raw rebuild observation count drift');
  assert(Array.isArray(rebuilt.registry_coverage) && rebuilt.registry_coverage.length === 249,
    'raw rebuild registry coverage drift');
  assert(rebuilt.registry_coverage.filter(item => item.state === 'source_unavailable').length === 43,
    'raw rebuild source-gap count drift');
  return candidate;
}

async function rebuildPinnedRaw(root, rawSourcePath) {
  assert(path.isAbsolute(rawSourcePath), '--source must be an absolute path');
  const bytesStat = fs.lstatSync(rawSourcePath);
  assert(bytesStat.isFile() && !bytesStat.isSymbolicLink(), '--source must be a regular non-symlink file');
  const sourceHashes = assertPinnedSource(rawSourcePath);
  const inputs = loadPinnedInputs(root);
  const selected = await readSelectedRows(rawSourcePath);
  const rebuilt = buildPrimapArtifact(inputs.registry.value, selected.selected, FIXED_RAW_BUILD_TIME);
  validateRawRebuild(root, rebuilt, inputs);
  return { rebuilt, inputs, source_hashes: sourceHashes };
}

function runtimeReleaseRoot(releaseId) {
  assert(policyEngine.validReleaseId(releaseId), 'invalid beta release ID');
  return `data/climate/public-beta/runtime/releases/${releaseId}`;
}

function runtimeArtifactPins(releaseId, artifactBytes) {
  const releaseRoot = runtimeReleaseRoot(releaseId);
  return Object.entries(RUNTIME_FILES).map(([name, file]) => ({
    path: `${releaseRoot}/${file}`,
    sha256: hashBytes(artifactBytes[name]),
  })).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

function rightsArtifactPins(root, releaseId) {
  assert(policyEngine.validReleaseId(releaseId), 'rights-review pins require the exact beta release ID');
  const noticeBytes = readRegular(path.join(root, RIGHTS_REVIEW_PATHS[0]), 'completed beta third-party notices');
  validateReviewedNotices(noticeBytes.toString('utf8'), { betaReleaseId: releaseId });
  const licensePath = 'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt';
  const licenseBytes = readRegular(path.join(root, licensePath), 'canonical beta LGPL licence');
  assert(hashBytes(licenseBytes) === CANONICAL_LGPL_SHA256,
    'beta LGPL licence bytes differ from the exact verified 501-line canonical copy');
  const sourceRegistryBytes = readRegular(path.join(root, INPUTS.sourceRegistry.path), 'pinned climate source registry');
  assert(hashBytes(sourceRegistryBytes) === INPUTS.sourceRegistry.sha256, 'climate source-registry byte hash mismatch');
  return RIGHTS_REVIEW_PATHS.map(relative => ({
    path: relative,
    sha256: hashBytes(readRegular(path.join(root, relative), `rights-review artifact ${relative}`)),
  }));
}

function rawSourcePin() {
  return { path: RAW_SOURCE_LOGICAL_PATH, sha256: PRIMAP_CONFIG.source_sha256 };
}

function rawRebuildCandidatePin() {
  return { path: PINNED_RAW_CANDIDATE_PATH, sha256: PINNED_RAW_CANDIDATE_SHA256 };
}

function sortPins(pins) {
  const sorted = pins.slice().sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  assert(new Set(sorted.map(pin => pin.path)).size === sorted.length, 'reviewed artifact pin path duplicated');
  return sorted;
}

function baseReviewArtifactPins(root, releaseId, bytes, correctionPin = null) {
  const runtime = runtimeArtifactPins(releaseId, bytes);
  if (correctionPin) {
    assert(same(correctionPin, {
      path: priorCorrectionLogicalPath(releaseId),
      sha256: correctionPin.sha256,
    }) && /^[a-f0-9]{64}$/.test(correctionPin.sha256),
    'data-review prior-correction pin is invalid');
  }
  return {
    data_review: sortPins(runtime.concat([rawSourcePin(), rawRebuildCandidatePin()], correctionPin ? [correctionPin] : [])),
    rights_review: sortPins(runtime.concat(rightsArtifactPins(root, releaseId), [rawSourcePin()])),
  };
}

function expectedReviewArtifactPins(root, releaseId, bytes, descriptorBytes, correctionPin = null) {
  const base = baseReviewArtifactPins(root, releaseId, bytes, correctionPin);
  const descriptorPin = { path: proposalLogicalPath(releaseId), sha256: hashBytes(descriptorBytes) };
  return {
    data_review: sortPins(base.data_review.concat([descriptorPin])),
    rights_review: sortPins(base.rights_review.concat([descriptorPin])),
  };
}

function reviewedInputPins() {
  const raw = { path: RAW_SOURCE_LOGICAL_PATH, sha256: PRIMAP_CONFIG.source_sha256 };
  return {
    factual: [
      { path: INPUTS.registry.path, sha256: INPUTS.registry.sha256 },
      { path: INPUTS.allocations.path, sha256: INPUTS.allocations.sha256 },
      raw,
    ].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    identity: [{ path: INPUTS.registry.path, sha256: INPUTS.registry.sha256 }],
    lineage: [
      { path: INPUTS.promotion.path, sha256: INPUTS.promotion.sha256 },
      { path: INPUTS.review.path, sha256: INPUTS.review.sha256 },
      raw,
    ].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
  };
}

function buildReviewedArtifacts(root, releaseId, rawRebuild, suppliedInputs, correctionContext = null) {
  assert(policyEngine.validReleaseId(releaseId), 'invalid beta release ID');
  const inputs = suppliedInputs || loadPinnedInputs(root);
  const preparation = compile(inputs);
  validateRawRebuild(root, rawRebuild, inputs);

  const rawByCountry = new Map(rawRebuild.series.map(series => [series.country_id, series]));
  assert(rawByCountry.size === 206, 'raw source country series IDs must be unique');
  const identitiesBySource = new Map(preparation.identity.identities.map(item => [item.source_entity_id, item]));
  assert(identitiesBySource.size === 249, 'identity source IDs must be unique');
  const factualEntities = [];
  const lineageFacts = [];

  inputs.registry.value.entities.forEach(registryEntity => {
    const identity = identitiesBySource.get(registryEntity.country_id);
    assert(identity, `identity missing for ${registryEntity.country_id}`);
    const series = rawByCountry.get(registryEntity.country_id);
    const observations = [];
    if (series) {
      assert(series.iso_alpha3 === registryEntity.iso_alpha3, `raw identity mismatch: ${registryEntity.country_id}`);
      assert(series.values.length === 10, `raw year boundary drift: ${registryEntity.country_id}`);
      series.values.forEach((point, index) => {
        const expectedYear = METRIC.start_year + index;
        assert(point.year === expectedYear && typeof point.normalized_value_decimal === 'string',
          `raw observation drift: ${registryEntity.country_id}`);
        const factId = opaqueFactId(identity.entity_id, point.year);
        observations.push({ fact_id: factId, year: point.year, value_decimal: point.normalized_value_decimal });
        lineageFacts.push({
          fact_id: factId,
          entity_id: identity.entity_id,
          source_id: 'primap-hist-2.6.1-final',
          source_entity_id: series.country_id,
          source_iso_alpha3: series.iso_alpha3,
          source_fact_id: point.source_fact_id,
          promoted_fact_id: point.fact_id,
          year: point.year,
          normalized_value_decimal: point.normalized_value_decimal,
          source_locator: clone(series.source_locator),
          transformation: {
            input_unit: series.source_locator.row_key.unit,
            output_unit: METRIC.unit,
            operation: 'Convert gigagrams to megatonnes by exact decimal division by 1000 using the pinned raw source text.',
            rounding: 'none; move the source decimal point three places left using source text and retain source digits, including trailing fractional zeros',
          },
        });
      });
    }
    factualEntities.push({
      entity_id: identity.entity_id,
      evidence_state: series ? 'factual_series' : 'source_gap',
      gap_reason: series ? null : 'source_unavailable',
      observations,
    });
  });
  assert(lineageFacts.length === 2060, 'reviewed lineage must contain exactly 2,060 facts');

  const pins = reviewedInputPins();
  const factual = {
    schema_version: '1.0.0',
    schema_ref: SCHEMA_PATHS.factual,
    artifact_kind: 'public_beta_country_factual',
    beta_release_id: releaseId,
    status: clone(FINAL_STATUS),
    input_pins: pins.factual,
    allocation_scheme: 'elu-opaque-allocation-v1',
    metric: clone(METRIC),
    limitations: Array.from(LIMITATIONS),
    coverage: { entities: 249, factual_series: 206, source_gaps: 43, observations: 2060 },
    entities: factualEntities,
    calculation_hash: null,
  };
  factual.calculation_hash = calculationHash(factual);

  const identity = {
    schema_version: '1.0.0',
    schema_ref: SCHEMA_PATHS.identity,
    artifact_kind: 'public_beta_country_identity',
    beta_release_id: releaseId,
    status: clone(FINAL_STATUS),
    input_pins: pins.identity,
    allocation: clone(preparation.identity.allocation),
    identity_source: Object.assign(clone(preparation.identity.identity_source), {
      public_beta_rights_review_status: 'completed',
      public_beta_redistribution_authorized: true,
    }),
    coverage: { identities: 249 },
    identities: clone(preparation.identity.identities),
    calculation_hash: null,
  };
  identity.calculation_hash = calculationHash(identity);

  const identitySource = [
    '# Earth Love United Climate Public Beta — identity source access',
    '',
    `Beta release: ${releaseId}`,
    '',
    `Source: ${identity.identity_source.title}`,
    `Publisher: ${identity.identity_source.publisher}`,
    `Version: ${identity.identity_source.version}`,
    `Canonical source: ${identity.identity_source.source_url}`,
    `Source access: ${identity.identity_source.retrieval_url}`,
    `Exact source SHA-256: ${identity.identity_source.source_checksum_sha256}`,
    `Licence: ${identity.identity_source.licence_identifier}`,
    `Licence terms: ${identity.identity_source.licence_terms_url}`,
    '',
    identity.identity_source.attribution,
    '',
    'Earth Love United renamed source fields, joined them to frozen opaque project identifiers, and kept names and codes in the separate country-identity.json artifact. The factual country-factual.json artifact contains no country names or ISO codes. Exact transformation details are in country-identity-transform.json.',
    '',
    'No warranty is provided. These names and codes are not an official ISO, United Nations, or UNFCCC publication and do not establish sovereignty, Party status, eligibility, climate performance, or any assessed conclusion.',
    '',
    'This source-access notice does not itself grant redistribution or publication authority. The exact seven-file runtime release and this notice must be covered by authenticated public-beta rights and independent data reviews.',
    '',
  ].join('\n');

  const identityTransform = {
    schema_version: '1.0.0',
    schema_ref: SCHEMA_PATHS.identityTransform,
    artifact_kind: 'public_beta_country_identity_transform',
    beta_release_id: releaseId,
    content_state: 'reviewed_beta_release',
    input_pins: [
      { path: INPUTS.registry.path, sha256: INPUTS.registry.sha256 },
      { path: INPUTS.allocations.path, sha256: INPUTS.allocations.sha256 },
    ],
    allocation_scheme: 'elu-opaque-allocation-v1',
    operations: [
      'Read the exact 249 reviewed Debian iso-codes registry rows in frozen registry order.',
      'Join each source_entity_id to its preallocated opaque ELU entity_id from the frozen allocation table.',
      'Copy the reviewed display name, optional official/common names, and ISO alpha-2, alpha-3, and numeric codes only into country-identity.json.',
      'Keep all identity names and codes out of country-factual.json; join factual observations only through opaque entity_id values.',
    ],
    output_files: ['country-factual.json', 'country-identity.json', 'fact-lineage.json'],
    assessed_production_authority: false,
    calculation_hash: null,
  };
  identityTransform.calculation_hash = calculationHash(identityTransform);

  const lineage = {
    schema_version: '1.0.0',
    schema_ref: SCHEMA_PATHS.lineage,
    artifact_kind: 'public_beta_fact_lineage',
    beta_release_id: releaseId,
    status: clone(FINAL_STATUS),
    input_pins: pins.lineage,
    promotion_evidence: clone(preparation.lineage.promotion_evidence),
    source: Object.assign(clone(preparation.lineage.source), {
      public_beta_rights_review_status: 'completed',
      public_beta_redistribution_authorized: true,
    }),
    coverage: { facts: 2060 },
    facts: lineageFacts,
    calculation_hash: null,
  };
  lineage.calculation_hash = calculationHash(lineage);

  const knownLimitations = {
    schema_version: '1.0.0',
    schema_ref: SCHEMA_PATHS.knownLimitations,
    artifact_kind: 'public_beta_known_limitations',
    beta_release_id: releaseId,
    content_state: 'reviewed_beta_release',
    limitations: Array.from(LIMITATIONS),
    no_assessment_statement: 'This release presents harmonized factual emissions evidence only. It does not assess commitments, targets, delivery, performance, impact, fairness, or scores.',
    assessed_production_authority: false,
    calculation_hash: null,
  };
  knownLimitations.calculation_hash = calculationHash(knownLimitations);

  const correctionEntries = correctionContext
    ? validateCorrectionEntries(root, releaseId, correctionContext.entries)
    : [];
  const correctionInputPin = correctionContext ? clone(correctionContext.pin) : null;
  if (correctionContext) {
    assert(same(correctionInputPin, {
      path: priorCorrectionLogicalPath(releaseId),
      sha256: correctionContext.pin.sha256,
    }) && /^[a-f0-9]{64}$/.test(correctionContext.pin.sha256),
    'prior-correction context has an invalid logical exact-byte pin');
  }

  const correctionLog = {
    schema_version: '1.0.0',
    schema_ref: SCHEMA_PATHS.correctionLog,
    artifact_kind: 'public_beta_correction_log',
    beta_release_id: releaseId,
    content_state: 'reviewed_beta_release',
    review_input_pin: correctionInputPin,
    policy: {
      scope: CORRECTION_SCOPE,
      current_release_statement: correctionStatement(correctionEntries.length),
    },
    entries: correctionEntries,
    assessed_production_authority: false,
    calculation_hash: null,
  };
  correctionLog.calculation_hash = calculationHash(correctionLog);
  return { factual, identity, identitySource, identityTransform, lineage, knownLimitations, correctionLog };
}

function walk(value, visit, at = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${at}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value).forEach(([key, child]) => {
    visit(key, child, `${at}.${key}`);
    walk(child, visit, `${at}.${key}`);
  });
}

function collectStrings(value, output = new Set()) {
  if (typeof value === 'string') output.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, output));
  return output;
}

function validateReviewedArtifacts(root, releaseId, artifacts, rawRebuild, suppliedInputs, correctionContext = null) {
  const inputs = suppliedInputs || loadPinnedInputs(root);
  validateRawRebuild(root, rawRebuild, inputs);
  const schemas = loadSchemas(root);
  const pins = reviewedInputPins();
  exactKeys(artifacts, ['factual', 'identity', 'identitySource', 'identityTransform', 'lineage', 'knownLimitations', 'correctionLog'],
    'reviewed runtime artifact set');
  const { factual, identity, identitySource, identityTransform, lineage, knownLimitations, correctionLog } = artifacts;
  for (const [name, artifact] of Object.entries({ factual, identity, lineage })) {
    assert(same(artifact.status, FINAL_STATUS), `${name} final review status drift`);
    assert(artifact.beta_release_id === releaseId, `${name} release ID drift`);
    assert(artifact.calculation_hash === calculationHash(artifact), `${name} calculation hash drift`);
    const errors = validateJsonSchema(artifact, schemas[name]);
    assert(errors.length === 0, `${name} reviewed schema validation failed: ${errors.slice(0, 5).join('; ')}`);
    walk(artifact, key => {
      if (key !== 'assessed_production_authority') assert(!ASSESSED_KEYS.has(key), `${name} contains assessed field: ${key}`);
    });
  }
  for (const [name, artifact] of Object.entries({ identityTransform, knownLimitations, correctionLog })) {
    assert(artifact.beta_release_id === releaseId && artifact.content_state === 'reviewed_beta_release' &&
      artifact.assessed_production_authority === false, `${name} beta boundary drift`);
    assert(artifact.calculation_hash === calculationHash(artifact), `${name} calculation hash drift`);
    const errors = validateJsonSchema(artifact, schemas[name]);
    assert(errors.length === 0, `${name} reviewed schema validation failed: ${errors.slice(0, 5).join('; ')}`);
    walk(artifact, key => {
      if (key !== 'assessed_production_authority') assert(!ASSESSED_KEYS.has(key), `${name} contains assessed field: ${key}`);
    });
  }
  const expectedSupport = buildReviewedArtifacts(root, releaseId, rawRebuild, inputs, correctionContext);
  assert(typeof identitySource === 'string' && identitySource === expectedSupport.identitySource,
    'identity source-access notice differs from deterministic source facts');
  assert(!/\bINCOMPLETE\b|\[UNASSIGNED\]|\[HUMAN REVIEW REQUIRED\]/i.test(identitySource),
    'identity source-access notice contains unresolved review markers');
  assert(same(identityTransform, expectedSupport.identityTransform) &&
    same(knownLimitations, expectedSupport.knownLimitations) &&
    same(correctionLog, expectedSupport.correctionLog), 'deterministic support artifact drift');
  assert(correctionLog.policy.scope === CORRECTION_SCOPE &&
    correctionLog.policy.current_release_statement === correctionStatement(correctionLog.entries.length),
  'correction-log public statement drift');
  if (correctionContext) {
    assert(same(correctionLog.review_input_pin, correctionContext.pin) &&
      same(correctionLog.entries, correctionContext.entries),
    'correction log differs from the exact private reviewed correction input');
  } else {
    assert(correctionLog.review_input_pin === null && correctionLog.entries.length === 0,
      'first beta release must retain a deterministic empty correction log');
  }
  assert(same(factual.input_pins, pins.factual) && same(identity.input_pins, pins.identity) &&
    same(lineage.input_pins, pins.lineage), 'reviewed input-pin boundary drift');
  assert(factual.artifact_kind === 'public_beta_country_factual' &&
    identity.artifact_kind === 'public_beta_country_identity' &&
    lineage.artifact_kind === 'public_beta_fact_lineage', 'reviewed artifact kind drift');
  assert(same(factual.metric, METRIC) && same(factual.limitations, LIMITATIONS), 'factual metric or limitations drift');
  assert(factual.entities.length === 249 && identity.identities.length === 249 && lineage.facts.length === 2060,
    'reviewed artifact count drift');
  assert(lineage.source.raw_source_sha256 === PRIMAP_CONFIG.source_sha256,
    'reviewed lineage raw-source hash drift');
  assert(identity.identity_source.public_beta_rights_review_status === 'completed' &&
    identity.identity_source.public_beta_redistribution_authorized === true &&
    lineage.source.public_beta_rights_review_status === 'completed' &&
    lineage.source.public_beta_redistribution_authorized === true,
  'reviewed source-rights state drift');

  walk(factual, key => assert(!FACTUAL_IDENTITY_KEYS.has(key), `identity field leaked into factual artifact: ${key}`));
  const factualStrings = collectStrings(factual);
  inputs.registry.value.entities.forEach(entity => {
    [entity.country_id, entity.name, entity.official_name, entity.common_name,
      entity.iso_alpha2, entity.iso_alpha3, entity.iso_numeric, entity.flag_emoji]
      .filter(Boolean).forEach(value => assert(!factualStrings.has(value), `identity value leaked into factual artifact: ${value}`));
  });

  const allocationBySource = new Map(inputs.allocations.value.entity_allocations.map(item => [item.source_entity_id, item.entity_id]));
  const rawByCountry = new Map(rawRebuild.series.map(series => [series.country_id, series]));
  const factualByEntity = new Map(factual.entities.map(entity => [entity.entity_id, entity]));
  const identityByEntity = new Map(identity.identities.map(item => [item.entity_id, item]));
  const lineageByFact = new Map(lineage.facts.map(fact => [fact.fact_id, fact]));
  assert(factualByEntity.size === 249 && identityByEntity.size === 249 && lineageByFact.size === 2060,
    'opaque IDs must be unique');
  let seriesCount = 0;
  let gapCount = 0;
  let observationCount = 0;
  inputs.registry.value.entities.forEach(registryEntity => {
    const expectedEntityId = allocationBySource.get(registryEntity.country_id);
    assert(/^elu-e-[a-f0-9]{16}$/.test(expectedEntityId || ''), `opaque allocation missing: ${registryEntity.country_id}`);
    const factualEntity = factualByEntity.get(expectedEntityId);
    const identityRow = identityByEntity.get(expectedEntityId);
    assert(factualEntity && identityRow, `opaque identity join missing: ${expectedEntityId}`);
    assert(same(identityRow, {
      entity_id: expectedEntityId,
      source_entity_id: registryEntity.country_id,
      name: registryEntity.name,
      official_name: registryEntity.official_name,
      common_name: registryEntity.common_name,
      iso_alpha2: registryEntity.iso_alpha2,
      iso_alpha3: registryEntity.iso_alpha3,
      iso_numeric: registryEntity.iso_numeric,
    }), `separate identity mapping drift: ${registryEntity.country_id}`);
    const rawSeries = rawByCountry.get(registryEntity.country_id);
    if (!rawSeries) {
      gapCount += 1;
      assert(factualEntity.evidence_state === 'source_gap' && factualEntity.gap_reason === 'source_unavailable' &&
        factualEntity.observations.length === 0, `source gap drift: ${registryEntity.country_id}`);
      return;
    }
    seriesCount += 1;
    assert(factualEntity.evidence_state === 'factual_series' && factualEntity.gap_reason === null &&
      factualEntity.observations.length === 10, `factual series shape drift: ${registryEntity.country_id}`);
    rawSeries.values.forEach((point, index) => {
      const expectedFactId = opaqueFactId(expectedEntityId, point.year);
      const observation = factualEntity.observations[index];
      assert(same(observation, {
        fact_id: expectedFactId,
        year: point.year,
        value_decimal: point.normalized_value_decimal,
      }), `factual observation differs from raw rebuild: ${registryEntity.country_id}:${point.year}`);
      const fact = lineageByFact.get(expectedFactId);
      assert(fact && fact.entity_id === expectedEntityId && fact.source_entity_id === rawSeries.country_id &&
        fact.source_iso_alpha3 === rawSeries.iso_alpha3 && fact.source_fact_id === point.source_fact_id &&
        fact.promoted_fact_id === point.fact_id && fact.year === point.year &&
        fact.normalized_value_decimal === point.normalized_value_decimal &&
        same(fact.source_locator, rawSeries.source_locator),
      `exact lineage drift: ${registryEntity.country_id}:${point.year}`);
      assert(fact.transformation.input_unit === 'CO2 * gigagram / yr' &&
        fact.transformation.output_unit === 'MtCO2e/yr' &&
        fact.transformation.operation === 'Convert gigagrams to megatonnes by exact decimal division by 1000 using the pinned raw source text.' &&
        fact.transformation.rounding === 'none; move the source decimal point three places left using source text and retain source digits, including trailing fractional zeros',
      `lineage transformation drift: ${registryEntity.country_id}:${point.year}`);
      observationCount += 1;
    });
  });
  assert(seriesCount === 206 && gapCount === 43 && observationCount === 2060,
    'reviewed coverage totals drift');
  assert(same(factual.coverage, { entities: 249, factual_series: 206, source_gaps: 43, observations: 2060 }) &&
    same(identity.coverage, { identities: 249 }) && same(lineage.coverage, { facts: 2060 }),
  'reviewed declared coverage drift');
  validateUiContract(root, releaseId, artifacts, artifactBytes(artifacts));
  return { status: 'pass', entities: 249, factual_series: 206, source_gaps: 43, facts: 2060 };
}

function artifactBytes(artifacts) {
  return Object.fromEntries(Object.entries(artifacts).map(([name, value]) => [
    name,
    typeof value === 'string' ? Buffer.from(value, 'utf8') : serialize(value),
  ]));
}

function validateUiContract(root, releaseId, artifacts, bytes) {
  const jsPath = path.join(root, 'climate-public-beta/js/beta.js');
  const js = readRegular(jsPath, 'Climate Public Beta runtime').toString('utf8');
  const context = vm.createContext({
    window: {
      location: { origin: 'https://beta.invalid' },
      crypto: crypto.webcrypto,
      fetch: async () => { throw new Error('unexpected reviewed-data fixture fetch'); },
    },
    document: { readyState: 'loading', addEventListener() {} },
    URL,
    TextDecoder,
    TextEncoder,
    Intl,
    Map,
    Set,
    Object,
    Array,
    JSON,
    String,
    Number,
    RegExp,
    Error,
    Promise,
  });
  new vm.Script(js, { filename: jsPath }).runInContext(context);
  assert(context.window.CLIMATE_PUBLIC_BETA, 'Climate Public Beta runtime export missing');
  const releaseRoot = `${runtimeReleaseRoot(releaseId)}/`;
  const manifestFiles = {
    country_factual: ['factual', RUNTIME_FILES.factual],
    country_identity: ['identity', RUNTIME_FILES.identity],
    country_identity_source: ['identitySource', RUNTIME_FILES.identitySource],
    country_identity_transform: ['identityTransform', RUNTIME_FILES.identityTransform],
    fact_lineage: ['lineage', RUNTIME_FILES.lineage],
    known_limitations: ['knownLimitations', RUNTIME_FILES.knownLimitations],
    correction_log: ['correctionLog', RUNTIME_FILES.correctionLog],
  };
  const manifest = {
    schema_version: '1.0.0',
    manifest_id: `elu-climate-public-beta-runtime-${releaseId}`,
    beta_release_id: releaseId,
    product_tier: 'climate_public_beta',
    product_label: 'Climate Public Beta — harmonized factual emissions evidence, not a climate-performance assessment.',
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
      metric_id: METRIC.id,
      unit: METRIC.unit,
      comparison_year: 2023,
    },
    feedback: {
      approved_feedback_url: 'https://feedback.invalid/report',
      privacy_notice_url: 'https://feedback.invalid/privacy',
    },
    files: Object.fromEntries(Object.entries(manifestFiles).map(([key, [name, file]]) => [key, {
      path: releaseRoot + file,
      sha256: hashBytes(bytes[name]),
      bytes: bytes[name].length,
    }])),
  };
  const bundle = {
    manifest,
    factual: artifacts.factual,
    identity: artifacts.identity,
    lineage: artifacts.lineage,
    identitySourceText: artifacts.identitySource,
    identityTransform: artifacts.identityTransform,
    knownLimitations: artifacts.knownLimitations,
    correctionLog: artifacts.correctionLog,
  };
  context.__bundle = JSON.stringify(bundle);
  const result = vm.runInContext('window.CLIMATE_PUBLIC_BETA.validateBundle(JSON.parse(__bundle))', context);
  assert(result.records.length === 249, 'Climate Public Beta UI contract rejected reviewed runtime artifacts');
  return { status: 'pass', records: result.records.length };
}

function validProductionIdentity(identity) {
  return policyEngine.validIdentity(identity) && !/(?:^|[:/._-])(ephemeral|fixture|test)(?:$|[:/._-])/i.test(identity);
}

function proposalDescriptor(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity, bytes, testOnly,
  correctionPin = null) {
  assert((testOnly ? policyEngine.validIdentity : validProductionIdentity)(dataBuilderIdentity),
    'an explicit genuine data-builder identity is required');
  assert((testOnly ? policyEngine.validIdentity : validProductionIdentity)(rightsPreparerIdentity),
    'an explicit genuine rights-preparer identity is required');
  const baseReviewPins = baseReviewArtifactPins(root, releaseId, bytes, correctionPin);
  return {
    schema_version: '1.0.0',
    proposal_kind: 'climate_public_beta_exact_final_bytes',
    beta_release_id: releaseId,
    data_builder_identity: dataBuilderIdentity,
    rights_preparer_identity: rightsPreparerIdentity,
    private_review_only: true,
    publication_authority: false,
    assessed_production_authority: false,
    raw_source: {
      path: RAW_SOURCE_LOGICAL_PATH,
      bytes: PRIMAP_CONFIG.source_size,
      sha256: PRIMAP_CONFIG.source_sha256,
    },
    raw_rebuild: {
      pinned_candidate_path: PINNED_RAW_CANDIDATE_PATH,
      pinned_candidate_sha256: PINNED_RAW_CANDIDATE_SHA256,
      calculation_hash: PINNED_RAW_CALCULATION_HASH,
      factual_series: 206,
      source_gaps: 43,
      observations: 2060,
    },
    prior_correction_input: correctionPin ? clone(correctionPin) : null,
    runtime_artifacts: runtimeArtifactPins(releaseId, bytes),
    required_signed_reviews: {
      data_review: {
        evidence_kind: 'data_review',
        reviewed_artifacts_before_proposal_binding: baseReviewPins.data_review,
      },
      rights_review: {
        evidence_kind: 'rights_review',
        reviewed_artifacts_before_proposal_binding: baseReviewPins.rights_review,
      },
    },
    proposal_binding: {
      path: proposalLogicalPath(releaseId),
      instruction: 'Append this exact review-proposal.json byte hash to both reviewed_artifacts arrays before signing.',
    },
  };
}

function validateProposalDescriptor(root, descriptor, releaseId, dataBuilderIdentity, rightsPreparerIdentity, bytes,
  testOnly, correctionPin = null) {
  exactKeys(descriptor, [
    'schema_version', 'proposal_kind', 'beta_release_id', 'data_builder_identity', 'rights_preparer_identity',
    'private_review_only', 'publication_authority', 'assessed_production_authority',
    'raw_source', 'raw_rebuild', 'prior_correction_input', 'runtime_artifacts',
    'required_signed_reviews', 'proposal_binding',
  ], 'review proposal');
  const expected = proposalDescriptor(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity, bytes,
    testOnly, correctionPin);
  assert(same(descriptor, expected), 'review proposal descriptor differs from deterministic final-byte pins');
}

function createProposalDirectory(root, requestedPath) {
  let destination;
  if (requestedPath) {
    assert(path.isAbsolute(requestedPath), '--proposal-dir must be an absolute path');
    destination = path.resolve(requestedPath);
    const parentReal = fs.realpathSync(path.dirname(destination));
    assert(!isInside(canonicalRoot(root), path.join(parentReal, path.basename(destination))),
      'private review proposal must remain outside the public repository');
    assert(!fs.existsSync(destination), '--proposal-dir must not already exist');
    fs.mkdirSync(destination, { mode: 0o700 });
  } else {
    destination = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-climate-beta-private-review-'));
    fs.chmodSync(destination, 0o700);
  }
  assert(!isInside(root, destination), 'private review proposal must remain outside the public repository');
  return destination;
}

function writeProposal(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity, artifacts, requestedPath,
  testOnly = false, correctionContext = null) {
  validateReviewedArtifacts(root, releaseId, artifacts,
    readRegularJson(path.join(root, PINNED_RAW_CANDIDATE_PATH), 'pinned raw candidate').value,
    undefined, correctionContext);
  const bytes = artifactBytes(artifacts);
  const correctionPin = correctionContext ? correctionContext.pin : null;
  if (correctionContext) {
    assert(Buffer.isBuffer(correctionContext.bytes),
      'later-release proposal requires the exact private prior-correction input bytes');
    const checkedCorrection = validatePriorCorrectionInputBytes(root, releaseId,
      correctionContext.bytes, correctionPin);
    assert(same(checkedCorrection.entries, correctionContext.entries),
      'later-release proposal correction entries differ from the exact private input bytes');
  }
  const descriptor = proposalDescriptor(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity, bytes,
    testOnly, correctionPin);
  const descriptorBytes = serialize(descriptor);
  const reviewPins = expectedReviewArtifactPins(root, releaseId, bytes, descriptorBytes, correctionPin);
  const destination = createProposalDirectory(root, requestedPath);
  try {
    Object.entries(RUNTIME_FILES).forEach(([name, file]) => writeExclusive(path.join(destination, file), bytes[name]));
    if (correctionContext) writeExclusive(path.join(destination, PRIOR_CORRECTION_PROPOSAL_FILE), correctionContext.bytes);
    writeExclusive(path.join(destination, PROPOSAL_FILE), descriptorBytes);
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
  return {
    proposal_dir: destination,
    descriptor,
    descriptor_sha256: hashBytes(descriptorBytes),
    review_pins: reviewPins,
    artifacts,
    bytes,
  };
}

async function prepareProposal({
  root, rawSourcePath, releaseId, dataBuilderIdentity, rightsPreparerIdentity, proposalDir,
  priorCorrectionsPath,
}) {
  assert(validProductionIdentity(dataBuilderIdentity), 'an explicit genuine data-builder identity is required');
  assert(validProductionIdentity(rightsPreparerIdentity), 'an explicit genuine rights-preparer identity is required');
  const rebuilt = await rebuildPinnedRaw(root, rawSourcePath);
  const correctionContext = correctionContextForPreparation(root, releaseId, priorCorrectionsPath);
  const artifacts = buildReviewedArtifacts(root, releaseId, rebuilt.rebuilt, rebuilt.inputs, correctionContext);
  validateReviewedArtifacts(root, releaseId, artifacts, rebuilt.rebuilt, rebuilt.inputs, correctionContext);
  return writeProposal(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity, artifacts, proposalDir,
    false, correctionContext);
}

function readProposal(root, releaseId, proposalDir, testOnly = false) {
  assert(path.isAbsolute(proposalDir), '--proposal-dir must be an absolute path');
  const proposalStat = fs.lstatSync(proposalDir);
  assert(proposalStat.isDirectory() && !proposalStat.isSymbolicLink(), '--proposal-dir must be a regular non-symlink directory');
  assert(!isInside(canonicalRoot(root), fs.realpathSync(proposalDir)),
    'private review proposal must remain outside the public repository');
  const descriptorRecord = readRegularJson(path.join(proposalDir, PROPOSAL_FILE), 'review proposal descriptor');
  const declaredCorrectionPin = descriptorRecord.value?.prior_correction_input;
  assert(declaredCorrectionPin === null || (declaredCorrectionPin &&
    declaredCorrectionPin.path === priorCorrectionLogicalPath(releaseId) &&
    /^[a-f0-9]{64}$/.test(declaredCorrectionPin.sha256 || '') &&
    same(Object.keys(declaredCorrectionPin).sort(), ['path', 'sha256'])),
  'review proposal has an invalid prior-correction input declaration');
  const expectedNames = new Set([
    ...Object.values(RUNTIME_FILES),
    PROPOSAL_FILE,
    ...(declaredCorrectionPin ? [PRIOR_CORRECTION_PROPOSAL_FILE] : []),
  ]);
  const proposalEntries = fs.readdirSync(proposalDir, { withFileTypes: true });
  assert(proposalEntries.length === expectedNames.size && proposalEntries.every(entry =>
    expectedNames.has(entry.name) && entry.isFile() && !entry.isSymbolicLink()),
  'private review proposal contains missing, extra, or non-regular files');
  const correctionContext = declaredCorrectionPin
    ? validatePriorCorrectionInputBytes(root, releaseId,
      readRegular(path.join(proposalDir, PRIOR_CORRECTION_PROPOSAL_FILE), 'proposal prior-correction input'),
      declaredCorrectionPin)
    : null;
  const dataBuilderIdentity = descriptorRecord.value?.data_builder_identity;
  const rightsPreparerIdentity = descriptorRecord.value?.rights_preparer_identity;
  assert((testOnly ? policyEngine.validIdentity : validProductionIdentity)(dataBuilderIdentity),
    'review proposal data-builder identity is not acceptable');
  assert((testOnly ? policyEngine.validIdentity : validProductionIdentity)(rightsPreparerIdentity),
    'review proposal rights-preparer identity is not acceptable');
  const records = {};
  const artifacts = {};
  Object.entries(RUNTIME_FILES).forEach(([name, file]) => {
    if (name === 'identitySource') {
      const bytes = readRegular(path.join(proposalDir, file), `proposal ${file}`);
      records[name] = { bytes, text: bytes.toString('utf8'), value: bytes.toString('utf8') };
    } else {
      records[name] = readRegularJson(path.join(proposalDir, file), `proposal ${file}`);
    }
    artifacts[name] = records[name].value;
  });
  const expectedRaw = readRegularJson(path.join(root, PINNED_RAW_CANDIDATE_PATH), 'pinned raw candidate').value;
  const expectedArtifacts = buildReviewedArtifacts(root, releaseId, expectedRaw, undefined, correctionContext);
  validateReviewedArtifacts(root, releaseId, artifacts, expectedRaw, undefined, correctionContext);
  const expectedBytes = artifactBytes(expectedArtifacts);
  Object.keys(RUNTIME_FILES).forEach(name => {
    assert(records[name].bytes.equals(expectedBytes[name]), `proposal ${RUNTIME_FILES[name]} is not the deterministic final byte sequence`);
  });
  validateProposalDescriptor(root, descriptorRecord.value, releaseId, dataBuilderIdentity,
    rightsPreparerIdentity, expectedBytes, testOnly, declaredCorrectionPin);
  return {
    descriptor: descriptorRecord.value,
    descriptor_record: descriptorRecord,
    records,
    artifacts,
    bytes: expectedBytes,
    correction_context: correctionContext,
  };
}

function governanceReviewPaths(releaseId, kind) {
  const stem = REVIEW_STEMS[kind];
  assert(stem, `unknown signed review kind: ${kind}`);
  const prefix = `data/climate/public-beta/governance/releases/${releaseId}`;
  return { evidence: `${prefix}/${stem}.json`, signatures: `${prefix}/${stem}.signatures.json` };
}

function verifyCanonicalReview(root, releaseId, kind, expectedPins, verificationTime) {
  const trust = readRegularJson(path.join(root, TRUST_REGISTRY_PATH), 'public-beta trust registry');
  const paths = governanceReviewPaths(releaseId, kind);
  const evidence = readRegularJson(path.join(root, paths.evidence), `${kind} evidence`);
  const signatures = readRegularJson(path.join(root, paths.signatures), `${kind} signature bundle`);
  const report = policyEngine.verifySignedEvidence({
    evidence: evidence.value,
    evidence_text: evidence.text,
    evidence_file_regular: true,
    signature_bundle: signatures.value,
    signature_bundle_text: signatures.text,
    signature_bundle_file_regular: true,
    trust_registry: trust.value,
    trust_registry_text: trust.text,
    trust_registry_file_regular: true,
    verification_time: verificationTime,
  }, {
    evidence_kind: kind,
    beta_release_id: releaseId,
    intended_origin: null,
    intended_aliases: null,
    production_baseline_origin: null,
    production_baseline_inventory_sha256: null,
    reviewed_commit_sha: null,
    canonical_scope_sha256: null,
    expected_public_surface_manifest_sha256: null,
    approval_sha256: null,
    prior_evidence_sha256: null,
    reviewed_artifacts: expectedPins,
    remote_index_sha256: null,
    rollback_subset_sha256: null,
    trust_registry_sha256: hashBytes(trust.bytes),
  });
  assert(report.status === 'pass', `${kind} detached evidence failed: ${report.failure_ids.join(', ')}`);
  return { report, evidence: evidence.value, signature_bundle: signatures.value };
}

function readCanonicalEvidence(root, releaseId, kind) {
  const relative = governanceReviewPaths(releaseId, kind).evidence;
  return readRegularJson(path.join(root, relative), `${kind} evidence`);
}

function verifyRequiredReviews(root, releaseId, bytes, verificationTime, proposalRecord, selfTestToken,
  correctionPin = null) {
  const testOnly = selfTestToken === SELF_TEST_TOKEN;
  const effectiveTime = verificationTime || new Date().toISOString();
  assert(policyEngine.validTimestamp(effectiveTime), 'verification time must be an exact ISO-8601 timestamp');
  const preliminaryData = readCanonicalEvidence(root, releaseId, 'data_review').value;
  const preliminaryRights = readCanonicalEvidence(root, releaseId, 'rights_review').value;
  const dataBuilderIdentity = preliminaryData?.producer_identity;
  const rightsPreparerIdentity = preliminaryRights?.producer_identity;
  assert((testOnly ? policyEngine.validIdentity : validProductionIdentity)(dataBuilderIdentity),
    'signed data review does not record a genuine data-builder identity');
  assert((testOnly ? policyEngine.validIdentity : validProductionIdentity)(rightsPreparerIdentity),
    'signed rights review does not record a genuine rights-preparer identity');
  const descriptor = proposalDescriptor(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity, bytes,
    testOnly, correctionPin);
  const descriptorBytes = serialize(descriptor);
  if (proposalRecord) {
    assert(proposalRecord.bytes.equals(descriptorBytes) && same(proposalRecord.value, descriptor),
      'signed review producer identities do not match the exact review proposal');
  }
  const expectedPins = expectedReviewArtifactPins(root, releaseId, bytes, descriptorBytes, correctionPin);
  const dataPins = expectedPins.data_review;
  const rightsPins = expectedPins.rights_review;
  const rights = verifyCanonicalReview(root, releaseId, 'rights_review', rightsPins, effectiveTime);
  const data = verifyCanonicalReview(root, releaseId, 'data_review', dataPins, effectiveTime);
  assert(data.evidence.producer_identity === dataBuilderIdentity,
    'signed data review producer identity changed during verification');
  assert(rights.evidence.producer_identity === rightsPreparerIdentity,
    'signed rights review producer identity changed during verification');
  return {
    rights,
    data,
    data_pins: dataPins,
    rights_pins: rightsPins,
    proposal_descriptor: descriptor,
    proposal_descriptor_sha256: hashBytes(descriptorBytes),
    verification_time: effectiveTime,
  };
}

function expectedRuntimeDirectory(root, releaseId) {
  return path.join(root, runtimeReleaseRoot(releaseId));
}

function _sealProposal({ root, releaseId, proposalDir, outputDir, verificationTime }, selfTestToken) {
  const testOnly = selfTestToken === SELF_TEST_TOKEN;
  const expectedOutput = expectedRuntimeDirectory(root, releaseId);
  assert(path.resolve(outputDir) === path.resolve(expectedOutput),
    '--output must be the exact immutable runtime release directory for --release-id');
  assert(!fs.existsSync(outputDir), 'runtime release output already exists; refusing to overwrite reviewed bytes');
  const proposal = readProposal(root, releaseId, proposalDir, testOnly);
  const reviews = verifyRequiredReviews(root, releaseId, proposal.bytes, verificationTime,
    proposal.descriptor_record, selfTestToken,
    proposal.correction_context ? proposal.correction_context.pin : null);
  assert(reviews.data.evidence.producer_identity === proposal.descriptor.data_builder_identity &&
    reviews.rights.evidence.producer_identity === proposal.descriptor.rights_preparer_identity,
  'signed reviews do not identify the exact proposal preparers');

  const parent = path.dirname(outputDir);
  assertSafeRepositoryPath(root, parent, 'runtime release output');
  fs.mkdirSync(parent, { recursive: true });
  assertSafeRepositoryPath(root, parent, 'runtime release output');
  const staging = fs.mkdtempSync(path.join(parent, `.seal-${releaseId}-`));
  try {
    Object.entries(RUNTIME_FILES).forEach(([name, file]) => writeExclusive(path.join(staging, file), proposal.bytes[name]));
    fs.renameSync(staging, outputDir);
  } catch (error) {
    fs.rmSync(staging, { recursive: true, force: true });
    throw error;
  }
  return { status: 'sealed', output_dir: outputDir, pins: reviews.data_pins, reviews };
}

function sealProposal(options) {
  return _sealProposal(options, null);
}

function _validateSealedRuntime({ root, releaseId, verificationTime }, selfTestToken) {
  const expectedRaw = readRegularJson(path.join(root, PINNED_RAW_CANDIDATE_PATH), 'pinned raw candidate').value;
  const releaseDir = expectedRuntimeDirectory(root, releaseId);
  const correctionRecord = readRegularJson(path.join(releaseDir, RUNTIME_FILES.correctionLog),
    `sealed runtime ${RUNTIME_FILES.correctionLog}`);
  const correctionPin = correctionRecord.value?.review_input_pin;
  let correctionContext = null;
  if (correctionPin !== null) {
    assert(correctionPin && same(Object.keys(correctionPin).sort(), ['path', 'sha256']) &&
      correctionPin.path === priorCorrectionLogicalPath(releaseId) &&
      /^[a-f0-9]{64}$/.test(correctionPin.sha256 || ''),
    'sealed correction log has an invalid private review-input pin');
    correctionContext = {
      pin: clone(correctionPin),
      entries: validateCorrectionEntries(root, releaseId, correctionRecord.value.entries),
    };
  }
  const expectedArtifacts = buildReviewedArtifacts(root, releaseId, expectedRaw, undefined, correctionContext);
  const expectedBytes = artifactBytes(expectedArtifacts);
  const actualArtifacts = {};
  Object.entries(RUNTIME_FILES).forEach(([name, file]) => {
    let record;
    if (name === 'correctionLog') {
      record = correctionRecord;
    } else if (name === 'identitySource') {
      const bytes = readRegular(path.join(releaseDir, file), `sealed runtime ${file}`);
      record = { bytes, value: bytes.toString('utf8') };
    } else {
      record = readRegularJson(path.join(releaseDir, file), `sealed runtime ${file}`);
    }
    assert(record.bytes.equals(expectedBytes[name]), `sealed runtime ${file} differs from deterministic reviewed bytes`);
    actualArtifacts[name] = record.value;
  });
  validateReviewedArtifacts(root, releaseId, actualArtifacts, expectedRaw, undefined, correctionContext);
  const reviews = verifyRequiredReviews(root, releaseId, expectedBytes, verificationTime,
    null, selfTestToken, correctionPin);
  return {
    status: 'pass',
    beta_release_id: releaseId,
    artifacts: runtimeArtifactPins(releaseId, expectedBytes),
    data_review_pins: reviews.data_pins,
    rights_review_pins: reviews.rights_pins,
    data_builder_identity: reviews.data.evidence.producer_identity,
    rights_preparer_identity: reviews.rights.evidence.producer_identity,
    proposal_descriptor_sha256: reviews.proposal_descriptor_sha256,
    rights_review_sha256: reviews.rights.report.evidence_sha256,
    data_review_sha256: reviews.data.report.evidence_sha256,
    assessed_production_authority: false,
  };
}

function validateSealedRuntime(options) {
  return _validateSealedRuntime(options, null);
}

function jsonBytes(value) { return Buffer.from(canonicalJsonText(value)); }

function selfTestWrite(root, relative, bytes) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes, { mode: 0o600 });
}

function selfTestCopy(sourceRoot, targetRoot, relative) {
  selfTestWrite(targetRoot, relative, readRegular(path.join(sourceRoot, relative), `self-test source ${relative}`));
}

function makeEphemeralTrust(observedAt) {
  const start = new Date(new Date(observedAt).getTime() - 86400000).toISOString();
  const end = new Date(new Date(observedAt).getTime() + 86400000).toISOString();
  const signers = policyEngine.REQUIRED_ROLES.map(role => {
    const pair = crypto.generateKeyPairSync('ed25519');
    const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' });
    const publicDer = pair.publicKey.export({ type: 'spki', format: 'der' });
    const identity = `urn:elu:ephemeral:${role}`;
    return {
      role,
      identity,
      privateKey: pair.privateKey,
      authority: {
        algorithm: 'Ed25519',
        identity,
        key_id: `ed25519:${policyEngine.sha256(publicDer)}`,
        public_key_spki_pem: publicPem,
        revoked_at: null,
        role,
        status: 'active',
        valid_from: start,
        valid_until: end,
      },
    };
  });
  return {
    signers,
    registry: {
      schema_version: policyEngine.POLICY_VERSION,
      registry_id: 'elu-climate-public-beta-trust-v1',
      status: 'provisioned',
      repository: policyEngine.REPOSITORY,
      required_roles: Array.from(policyEngine.REQUIRED_ROLES),
      authorities: signers.map(item => item.authority),
    },
  };
}

function signedSelfTestEvidence(trust, releaseId, kind, producerIdentity, reviewedArtifacts, observedAt) {
  const config = policyEngine.EVIDENCE_CONFIG[kind];
  const signer = trust.signers.find(item => item.role === config.roles[0]);
  const evidence = {
    schema_version: policyEngine.POLICY_VERSION,
    evidence_id: `elu-reviewed-data-ephemeral-${kind}`,
    evidence_kind: kind,
    repository: policyEngine.REPOSITORY,
    beta_release_id: releaseId,
    publication_level: 'package',
    intended_origin: null,
    intended_aliases: null,
    reviewed_commit_sha: null,
    canonical_scope_sha256: null,
    expected_public_surface_manifest_sha256: null,
    approval_sha256: null,
    prior_evidence_sha256: null,
    observed_at: observedAt,
    observation: 'review_complete',
    result: 'pass',
    producer_identity: producerIdentity,
    reviewer_identity: signer.identity,
    reviewed_artifacts: reviewedArtifacts,
    remote_index_sha256: null,
    rollback_subset_sha256: null,
    assessed_production_authority: false,
    production_baseline_origin: null,
    production_baseline_inventory_sha256: null,
  };
  const evidenceText = jsonBytes(evidence).toString('utf8');
  const evidenceSha = policyEngine.sha256(evidenceText);
  const signedAt = observedAt;
  const message = policyEngine.evidenceSignatureMessage({
    repository: policyEngine.REPOSITORY,
    beta_release_id: releaseId,
    evidence_id: evidence.evidence_id,
    evidence_kind: kind,
    evidence_sha256: evidenceSha,
    signed_at: signedAt,
    role: signer.role,
    identity: signer.identity,
    key_id: signer.authority.key_id,
  });
  const bundle = {
    schema_version: policyEngine.POLICY_VERSION,
    signature_bundle_id: `elu-climate-public-beta-${evidence.evidence_id}-signatures-v1`,
    domain: policyEngine.EVIDENCE_SIGNATURE_DOMAIN,
    repository: policyEngine.REPOSITORY,
    beta_release_id: releaseId,
    evidence_id: evidence.evidence_id,
    evidence_kind: kind,
    evidence_sha256: evidenceSha,
    signed_at: signedAt,
    signatures: [{
      role: signer.role,
      identity: signer.identity,
      key_id: signer.authority.key_id,
      signature_base64: crypto.sign(null, Buffer.from(message, 'utf8'), signer.privateKey).toString('base64'),
    }],
  };
  return { evidence, bundle };
}

function writeSelfTestReview(root, releaseId, kind, wrapper) {
  const paths = governanceReviewPaths(releaseId, kind);
  selfTestWrite(root, paths.evidence, jsonBytes(wrapper.evidence));
  selfTestWrite(root, paths.signatures, jsonBytes(wrapper.bundle));
}

function snapshotTree(root) {
  const output = [];
  function visit(directory) {
    fs.readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach(entry => {
        const absolute = path.join(directory, entry.name);
        const relative = path.relative(root, absolute);
        if (entry.isDirectory()) visit(absolute);
        else if (entry.isFile()) output.push({ path: relative, sha256: hashBytes(fs.readFileSync(absolute)) });
        else output.push({ path: relative, kind: 'non-regular' });
      });
  }
  visit(root);
  return output;
}

async function runSelfTest(sourceRoot) {
  const releaseId = 'ephemeral-beta-2026.07.17';
  const observedAt = '2026-07-17T12:00:00.000Z';
  const dataBuilderIdentity = 'urn:elu:ephemeral:data-builder';
  const rightsPreparerIdentity = 'urn:elu:ephemeral:rights-preparer';
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-reviewed-data-self-test-'));
  const root = path.join(tempParent, 'repository');
  fs.mkdirSync(root, { mode: 0o700 });
  let proposalDir = null;
  const extraProposalDirs = [];
  let positiveChecks = 0;
  let failClosedMutations = 0;
  const reject = (label, fn) => {
    let rejected = false;
    try { fn(); } catch (_) { rejected = true; }
    assert(rejected, `self-test mutation escaped: ${label}`);
    failClosedMutations += 1;
  };
  const rejectAsync = async (label, fn) => {
    let rejected = false;
    try { await fn(); } catch (_) { rejected = true; }
    assert(rejected, `self-test mutation escaped: ${label}`);
    failClosedMutations += 1;
  };

  try {
    const copied = new Set([
      ...Object.values(INPUTS).map(item => item.path),
      ...Object.values(SCHEMA_PATHS),
      PINNED_RAW_CANDIDATE_PATH,
      'climate-public-beta/js/beta.js',
    ]);
    copied.forEach(relative => selfTestCopy(sourceRoot, root, relative));
    selfTestWrite(root, 'climate-public-beta/THIRD_PARTY_NOTICES.txt',
      Buffer.from(fixtureReviewedNotices(releaseId)));
    selfTestCopy(sourceRoot, root, 'data/climate/LGPL-2.1.txt');
    selfTestWrite(root, 'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt',
      readRegular(path.join(root, 'data/climate/LGPL-2.1.txt'), 'self-test canonical LGPL source'));

    const raw = readRegularJson(path.join(root, PINNED_RAW_CANDIDATE_PATH), 'self-test raw candidate').value;
    const artifacts = buildReviewedArtifacts(root, releaseId, raw);
    validateReviewedArtifacts(root, releaseId, artifacts, raw);
    const second = buildReviewedArtifacts(root, releaseId, raw);
    assert(same(artifacts, second), 'reviewed-data compiler is not deterministic');
    positiveChecks += 2;

    const bytes = artifactBytes(artifacts);
    const proposal = writeProposal(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity,
      artifacts, null, true);
    proposalDir = proposal.proposal_dir;
    assert(!isInside(root, proposalDir), 'self-test proposal entered repository');
    const descriptorBytes = readRegular(path.join(proposalDir, PROPOSAL_FILE), 'self-test proposal');
    const expectedPins = expectedReviewArtifactPins(root, releaseId, bytes, descriptorBytes);
    positiveChecks += 1;

    const trust = makeEphemeralTrust(observedAt);
    selfTestWrite(root, TRUST_REGISTRY_PATH, jsonBytes(trust.registry));
    const goodData = signedSelfTestEvidence(trust, releaseId, 'data_review', dataBuilderIdentity,
      expectedPins.data_review, observedAt);
    const goodRights = signedSelfTestEvidence(trust, releaseId, 'rights_review', rightsPreparerIdentity,
      expectedPins.rights_review, observedAt);
    writeSelfTestReview(root, releaseId, 'data_review', goodData);
    writeSelfTestReview(root, releaseId, 'rights_review', goodRights);

    const changedRawHash = clone(raw);
    changedRawHash.source.input_hash_sha256 = '0'.repeat(64);
    reject('raw source hash', () => validateRawRebuild(root, changedRawHash, loadPinnedInputs(root)));
    const changedRawValue = clone(raw);
    changedRawValue.series[0].values[0].normalized_value_decimal = '0';
    reject('raw rebuilt value', () => validateRawRebuild(root, changedRawValue, loadPinnedInputs(root)));

    function mutateArtifact(label, mutate) {
      const changed = clone(artifacts);
      mutate(changed);
      reject(label, () => validateReviewedArtifacts(root, releaseId, changed, raw));
    }
    mutateArtifact('factual value', value => {
      value.factual.entities.find(item => item.observations.length).observations[0].value_decimal = '999';
      value.factual.calculation_hash = calculationHash(value.factual);
    });
    mutateArtifact('identity join', value => {
      const first = value.identity.identities[0].entity_id;
      value.identity.identities[0].entity_id = value.identity.identities[1].entity_id;
      value.identity.identities[1].entity_id = first;
      value.identity.calculation_hash = calculationHash(value.identity);
    });
    mutateArtifact('identity value', value => {
      value.identity.identities[0].name += ' drift';
      value.identity.calculation_hash = calculationHash(value.identity);
    });
    mutateArtifact('lineage locator', value => {
      value.lineage.facts[0].source_locator.csv_row += 1;
      value.lineage.calculation_hash = calculationHash(value.lineage);
    });
    mutateArtifact('lineage raw hash', value => {
      value.lineage.source.raw_source_sha256 = '0'.repeat(64);
      value.lineage.calculation_hash = calculationHash(value.lineage);
    });
    mutateArtifact('assessed claim', value => {
      value.factual.entities[0].score = 100;
      value.factual.calculation_hash = calculationHash(value.factual);
    });
    mutateArtifact('identity leak', value => {
      value.factual.entities[0].name = value.identity.identities[0].name;
      value.factual.calculation_hash = calculationHash(value.factual);
    });
    mutateArtifact('entity count', value => {
      value.factual.entities.pop();
      value.factual.calculation_hash = calculationHash(value.factual);
    });
    mutateArtifact('identity transform', value => {
      value.identityTransform.operations[0] += ' drift';
      value.identityTransform.calculation_hash = calculationHash(value.identityTransform);
    });
    mutateArtifact('known limitation', value => {
      value.knownLimitations.limitations[0] += ' drift';
      value.knownLimitations.calculation_hash = calculationHash(value.knownLimitations);
    });
    mutateArtifact('correction log', value => {
      value.correctionLog.entries.push({ invented: true });
      value.correctionLog.calculation_hash = calculationHash(value.correctionLog);
    });
    mutateArtifact('source notice marker', value => { value.identitySource += '[HUMAN REVIEW REQUIRED]\n'; });

    const insideProposal = path.join(root, 'candidate-review');
    reject('proposal inside repository', () => writeProposal(root, releaseId, dataBuilderIdentity,
      rightsPreparerIdentity, artifacts, insideProposal, true));
    assert(!fs.existsSync(insideProposal), 'inside-repository proposal rejection left files behind');
    positiveChecks += 1;

    const badRaw = path.join(tempParent, 'wrong-source.csv');
    fs.writeFileSync(badRaw, 'not the pinned raw source\n');
    await rejectAsync('unpinned raw CSV', () => rebuildPinnedRaw(root, badRaw));

    const outputDir = expectedRuntimeDirectory(root, releaseId);
    reject('wrong output directory', () => _sealProposal({
      root, releaseId, proposalDir, outputDir: path.join(root, 'wrong-output'), verificationTime: observedAt,
    }, SELF_TEST_TOKEN));

    const noticePath = path.join(root, 'climate-public-beta/THIRD_PARTY_NOTICES.txt');
    const licensePath = path.join(root, 'data/climate/public-beta/runtime/licenses/LGPL-2.1.txt');
    const noticeOriginal = readRegular(noticePath, 'self-test completed notices');
    const licenseOriginal = readRegular(licensePath, 'self-test canonical LGPL');
    fs.appendFileSync(noticePath, '\nSTATUS: INCOMPLETE\n');
    reject('incomplete third-party notices', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));
    fs.writeFileSync(noticePath, noticeOriginal);
    fs.appendFileSync(licensePath, '\nchanged\n');
    reject('changed canonical LGPL bytes', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));
    fs.writeFileSync(licensePath, licenseOriginal);

    const dataPaths = governanceReviewPaths(releaseId, 'data_review');
    const rightsPaths = governanceReviewPaths(releaseId, 'rights_review');
    const trustOriginal = readRegular(path.join(root, TRUST_REGISTRY_PATH), 'self-test trust');
    const dataEvidenceOriginal = readRegular(path.join(root, dataPaths.evidence), 'self-test data evidence');
    const dataBundleOriginal = readRegular(path.join(root, dataPaths.signatures), 'self-test data bundle');
    const rightsEvidenceOriginal = readRegular(path.join(root, rightsPaths.evidence), 'self-test rights evidence');
    const rightsBundleOriginal = readRegular(path.join(root, rightsPaths.signatures), 'self-test rights bundle');

    const wrongDataPins = clone(expectedPins.data_review);
    wrongDataPins[0].sha256 = '0'.repeat(64);
    writeSelfTestReview(root, releaseId, 'data_review', signedSelfTestEvidence(trust, releaseId,
      'data_review', dataBuilderIdentity, wrongDataPins, observedAt));
    reject('genuinely signed wrong data pins', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));
    selfTestWrite(root, dataPaths.evidence, dataEvidenceOriginal);
    selfTestWrite(root, dataPaths.signatures, dataBundleOriginal);

    const wrongRightsPins = clone(expectedPins.rights_review);
    wrongRightsPins.pop();
    writeSelfTestReview(root, releaseId, 'rights_review', signedSelfTestEvidence(trust, releaseId,
      'rights_review', rightsPreparerIdentity, wrongRightsPins, observedAt));
    reject('genuinely signed incomplete rights pins', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));
    selfTestWrite(root, rightsPaths.evidence, rightsEvidenceOriginal);
    selfTestWrite(root, rightsPaths.signatures, rightsBundleOriginal);

    const badBundle = JSON.parse(dataBundleOriginal);
    const signature = badBundle.signatures[0].signature_base64;
    badBundle.signatures[0].signature_base64 = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
    selfTestWrite(root, dataPaths.signatures, jsonBytes(badBundle));
    reject('detached signature', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));
    selfTestWrite(root, dataPaths.signatures, dataBundleOriginal);

    const incompleteTrust = JSON.parse(trustOriginal);
    incompleteTrust.authorities.pop();
    incompleteTrust.status = 'incomplete';
    selfTestWrite(root, TRUST_REGISTRY_PATH, jsonBytes(incompleteTrust));
    reject('incomplete trust registry', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));
    selfTestWrite(root, TRUST_REGISTRY_PATH, trustOriginal);

    const badProducer = 'urn:elu:ephemeral:different-data-builder';
    writeSelfTestReview(root, releaseId, 'data_review', signedSelfTestEvidence(trust, releaseId,
      'data_review', badProducer, expectedPins.data_review, observedAt));
    reject('data builder identity substitution', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));
    selfTestWrite(root, dataPaths.evidence, dataEvidenceOriginal);
    selfTestWrite(root, dataPaths.signatures, dataBundleOriginal);

    const tamperedProposal = writeProposal(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity,
      artifacts, null, true);
    const tamperedFile = path.join(tamperedProposal.proposal_dir, RUNTIME_FILES.factual);
    fs.appendFileSync(tamperedFile, ' ');
    reject('proposal byte substitution', () => readProposal(root, releaseId, tamperedProposal.proposal_dir, true));
    fs.rmSync(tamperedProposal.proposal_dir, { recursive: true, force: true });

    const symlinkProposal = writeProposal(root, releaseId, dataBuilderIdentity, rightsPreparerIdentity,
      artifacts, null, true);
    const symlinkFile = path.join(symlinkProposal.proposal_dir, RUNTIME_FILES.identity);
    fs.unlinkSync(symlinkFile);
    fs.symlinkSync(path.join(proposalDir, RUNTIME_FILES.identity), symlinkFile);
    reject('proposal symlink', () => readProposal(root, releaseId, symlinkProposal.proposal_dir, true));
    fs.rmSync(symlinkProposal.proposal_dir, { recursive: true, force: true });

    const restoredData = readCanonicalEvidence(root, releaseId, 'data_review').value;
    const restoredRights = readCanonicalEvidence(root, releaseId, 'rights_review').value;
    const restoredDescriptor = proposalDescriptor(root, releaseId, restoredData.producer_identity,
      restoredRights.producer_identity, bytes, true);
    const restoredPins = expectedReviewArtifactPins(root, releaseId, bytes, serialize(restoredDescriptor));
    assert(same(restoredData.reviewed_artifacts, restoredPins.data_review),
      'self-test data review restoration drift');
    assert(same(restoredRights.reviewed_artifacts, restoredPins.rights_review),
      'self-test rights review restoration drift');
    positiveChecks += 1;

    const sealed = _sealProposal({ root, releaseId, proposalDir, outputDir, verificationTime: observedAt }, SELF_TEST_TOKEN);
    assert(sealed.status === 'sealed' && sealed.pins.length === expectedPins.data_review.length,
      'ephemeral positive seal failed');
    Object.entries(RUNTIME_FILES).forEach(([name, file]) => {
      assert(readRegular(path.join(outputDir, file), `sealed ${file}`).equals(bytes[name]),
        `sealed ${file} changed after review`);
    });
    positiveChecks += 2;

    const before = snapshotTree(root);
    const checked = _validateSealedRuntime({ root, releaseId, verificationTime: observedAt }, SELF_TEST_TOKEN);
    const after = snapshotTree(root);
    assert(checked.status === 'pass' && same(before, after), '--check contract is not read-only');
    positiveChecks += 1;
    reject('sealed output overwrite', () => _sealProposal({
      root, releaseId, proposalDir, outputDir, verificationTime: observedAt,
    }, SELF_TEST_TOKEN));

    const laterReleaseId = 'ephemeral-beta-2026.07.18';
    const affectedPath = `${runtimeReleaseRoot(releaseId)}/${RUNTIME_FILES.factual}`;
    const laterInput = {
      schema_version: '1.0.0',
      artifact_kind: 'public_beta_prior_correction_review_input',
      beta_release_id: laterReleaseId,
      private_review_only: true,
      publication_authority: false,
      assessed_production_authority: false,
      entries: [{
        correction_id: `corr-${'c'.repeat(16)}`,
        superseded_release_id: releaseId,
        corrected_in_release_id: laterReleaseId,
        recorded_at: '2026-07-17T13:00:00.000Z',
        category: 'source_locator',
        description: 'Corrected the affected source locator after exact independent review.',
        affected_artifacts: [{
          path: affectedPath,
          sha256: hashBytes(readRegular(path.join(root, affectedPath), 'self-test superseded factual artifact')),
        }],
        decision_reference: `elu-correction-decision:${'d'.repeat(16)}`,
      }],
    };
    const laterInputPath = path.join(tempParent, PRIOR_CORRECTION_PROPOSAL_FILE);
    fs.writeFileSync(laterInputPath, serialize(laterInput), { mode: 0o600 });
    const laterContext = correctionContextForPreparation(root, laterReleaseId, laterInputPath);
    const laterArtifacts = buildReviewedArtifacts(root, laterReleaseId, raw, undefined, laterContext);
    validateReviewedArtifacts(root, laterReleaseId, laterArtifacts, raw, undefined, laterContext);
    assert(laterArtifacts.correctionLog.entries.length === 1 &&
      same(laterArtifacts.correctionLog.review_input_pin, laterContext.pin) &&
      laterArtifacts.correctionLog.entries[0].corrected_in_release_id === laterReleaseId &&
      laterArtifacts.correctionLog.entries[0].superseded_release_id !== laterReleaseId,
    'later-release correction history did not compile from the exact private input');
    validateUiContract(root, laterReleaseId, laterArtifacts, artifactBytes(laterArtifacts));
    selfTestWrite(root, 'climate-public-beta/THIRD_PARTY_NOTICES.txt',
      Buffer.from(fixtureReviewedNotices(laterReleaseId)));
    const laterProposal = writeProposal(root, laterReleaseId, dataBuilderIdentity, rightsPreparerIdentity,
      laterArtifacts, null, true, laterContext);
    extraProposalDirs.push(laterProposal.proposal_dir);
    const laterDescriptorBytes = readRegular(path.join(laterProposal.proposal_dir, PROPOSAL_FILE),
      'later-release proposal descriptor');
    const laterPins = expectedReviewArtifactPins(root, laterReleaseId, laterProposal.bytes,
      laterDescriptorBytes, laterContext.pin);
    assert(same(laterProposal.descriptor.prior_correction_input, laterContext.pin) &&
      laterPins.data_review.some(pin => same(pin, laterContext.pin)) &&
      !laterPins.rights_review.some(pin => pin.path === laterContext.pin.path),
    'private correction input is not pinned to the exact data/UI review boundary');
    readProposal(root, laterReleaseId, laterProposal.proposal_dir, true);
    positiveChecks += 5;

    reject('later release missing prior-correction input', () =>
      correctionContextForPreparation(root, laterReleaseId, null));
    reject('relative prior-correction input path', () =>
      readPrivatePriorCorrectionInput(root, laterReleaseId, PRIOR_CORRECTION_PROPOSAL_FILE));
    const insideCorrectionPath = path.join(root, 'private-prior-corrections.json');
    fs.writeFileSync(insideCorrectionPath, serialize(laterInput), { mode: 0o600 });
    reject('prior-correction input inside repository', () =>
      readPrivatePriorCorrectionInput(root, laterReleaseId, insideCorrectionPath));
    fs.unlinkSync(insideCorrectionPath);

    function rejectCorrectionInput(label, mutate, customBytes) {
      const changed = clone(laterInput);
      if (mutate) mutate(changed);
      const changedPath = path.join(tempParent, `rejected-${failClosedMutations}.json`);
      fs.writeFileSync(changedPath, customBytes ? customBytes(changed) : serialize(changed), { mode: 0o600 });
      reject(label, () => readPrivatePriorCorrectionInput(root, laterReleaseId, changedPath));
      fs.unlinkSync(changedPath);
    }
    rejectCorrectionInput('noncanonical prior-correction bytes', null,
      changed => Buffer.concat([serialize(changed), Buffer.from('\n')]));
    rejectCorrectionInput('private reporter field', value => {
      value.entries[0].reporter_identity = 'private person';
    });
    rejectCorrectionInput('non-opaque correction ID', value => {
      value.entries[0].correction_id = 'corr-person-name';
    });
    rejectCorrectionInput('private reporter contact in description', value => {
      value.entries[0].description = 'Reporter email person@private.invalid supplied the corrected locator.';
    });
    rejectCorrectionInput('correction bound to another current release', value => {
      value.entries[0].corrected_in_release_id = releaseId;
    });
    rejectCorrectionInput('correction supersedes itself', value => {
      value.entries[0].superseded_release_id = laterReleaseId;
    });
    rejectCorrectionInput('invented correction timestamp shape', value => {
      value.entries[0].recorded_at = '2026-07-17T13:00:00Z';
    });
    rejectCorrectionInput('affected artifact hash mismatch', value => {
      value.entries[0].affected_artifacts[0].sha256 = '0'.repeat(64);
    });
    rejectCorrectionInput('affected artifact path outside immutable release', value => {
      value.entries[0].affected_artifacts[0].path = 'climate-public-beta/index.html';
    });
    rejectCorrectionInput('free-form correction decision reference', value => {
      value.entries[0].decision_reference = 'reviewed by someone';
    });
    rejectCorrectionInput('empty later-release correction input', value => { value.entries = []; });

    fs.writeFileSync(path.join(laterProposal.proposal_dir, 'unreviewed-extra.txt'), 'private data\n');
    reject('unreviewed extra proposal file', () =>
      readProposal(root, laterReleaseId, laterProposal.proposal_dir, true));
    fs.unlinkSync(path.join(laterProposal.proposal_dir, 'unreviewed-extra.txt'));
    fs.appendFileSync(path.join(laterProposal.proposal_dir, PRIOR_CORRECTION_PROPOSAL_FILE), '\n');
    reject('proposal prior-correction byte substitution', () =>
      readProposal(root, laterReleaseId, laterProposal.proposal_dir, true));

    return {
      status: 'pass',
      positive_checks: positiveChecks,
      fail_closed_mutations: failClosedMutations,
      runtime_files: Object.keys(RUNTIME_FILES).length,
      data_review_pins: expectedPins.data_review.length,
      rights_review_pins: expectedPins.rights_review.length,
      later_release_data_review_pins: laterPins.data_review.length,
      correction_history_modes: 2,
      assessed_production_authority: false,
    };
  } finally {
    if (proposalDir && fs.existsSync(proposalDir)) fs.rmSync(proposalDir, { recursive: true, force: true });
    extraProposalDirs.forEach(directory => {
      if (fs.existsSync(directory)) fs.rmSync(directory, { recursive: true, force: true });
    });
    fs.rmSync(tempParent, { recursive: true, force: true });
  }
}

module.exports = {
  FINAL_STATUS,
  FIXED_RAW_BUILD_TIME,
  PINNED_RAW_CANDIDATE_PATH,
  PINNED_RAW_CANDIDATE_SHA256,
  PINNED_RAW_CALCULATION_HASH,
  PRIOR_CORRECTION_PROPOSAL_FILE,
  RAW_SOURCE_LOGICAL_PATH,
  REVIEW_STEMS,
  RIGHTS_REVIEW_PATHS,
  RUNTIME_FILES,
  SCHEMA_PATHS,
  TRUST_REGISTRY_PATH,
  artifactBytes,
  baseReviewArtifactPins,
  buildReviewedArtifacts,
  correctionContextForPreparation,
  expectedReviewArtifactPins,
  expectedRuntimeDirectory,
  governanceReviewPaths,
  prepareProposal,
  priorCorrectionLogicalPath,
  proposalDescriptor,
  proposalLogicalPath,
  rebuildPinnedRaw,
  readPrivatePriorCorrectionInput,
  rightsArtifactPins,
  runSelfTest,
  runtimeArtifactPins,
  sealProposal,
  validateRawRebuild,
  validateReviewedArtifacts,
  validateSealedRuntime,
  validateUiContract,
  verifyRequiredReviews,
};
