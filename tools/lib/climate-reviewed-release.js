'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateRelease } = require('./climate-release-gate');
const { same, stable, validateJsonSchema } = require('./json-schema-lite');
const {
  isSafeRelative,
  regularNonSymlink,
  validateReviewedRollbackProof,
} = require('./reviewed-runtime-rollback-proof');

const PATHS = Object.freeze({
  runtimeManifest: 'data/climate/runtime-manifest.json',
  releaseInput: 'data/climate/releases/ct40-reviewed-release-input.json',
  allowManifest: 'data/climate/releases/ct40-allow-manifest.json',
  releaseDiff: 'data/climate/releases/reviewed-release-diff.json',
  rollbackProof: 'data/climate/releases/reviewed-rollback-proof.json',
});

const SCHEMAS = Object.freeze({
  runtimeManifest: 'data/climate/schemas/reviewed-climate-runtime-manifest.schema.json',
  releaseInput: 'data/climate/schemas/ct40-reviewed-release-input.schema.json',
  allowManifest: 'data/climate/schemas/release-eligibility-result.schema.json',
  releaseDiff: 'data/climate/schemas/reviewed-release-diff.schema.json',
  rollbackProof: 'data/climate/schemas/reviewed-runtime-rollback-proof.schema.json',
});

const REQUIRED_TOP20_COUNTRY_IDS = Object.freeze([
  'iso3166-1:AUS', 'iso3166-1:BRA', 'iso3166-1:CAN', 'iso3166-1:CHN', 'iso3166-1:DEU',
  'iso3166-1:IDN', 'iso3166-1:IND', 'iso3166-1:IRN', 'iso3166-1:JPN', 'iso3166-1:KOR',
  'iso3166-1:MEX', 'iso3166-1:NGA', 'iso3166-1:PAK', 'iso3166-1:RUS', 'iso3166-1:SAU',
  'iso3166-1:THA', 'iso3166-1:TUR', 'iso3166-1:USA', 'iso3166-1:VNM', 'iso3166-1:ZAF',
]);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function releaseDiffCalculationHash(diff) {
  const copy = structuredClone(diff);
  copy.diff_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function factCalculationHash(fact) {
  if (!fact || typeof fact !== 'object' || Array.isArray(fact)) return null;
  const copy = structuredClone(fact);
  if (!copy.derivation || typeof copy.derivation !== 'object') return null;
  copy.derivation.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function profileCalculationHash(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return null;
  const copy = structuredClone(profile);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function top20ReviewCalculationHash(review) {
  if (!review || typeof review !== 'object' || Array.isArray(review)) return null;
  const copy = structuredClone(review);
  copy.review_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function sourceRightsDecisionCalculationHash(decision) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) return null;
  const copy = structuredClone(decision);
  copy.decision_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function entryPresent(root, relative) {
  try {
    fs.lstatSync(path.join(root, relative));
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

function pin(root, relative) {
  return { path: relative, sha256: sha256(fs.readFileSync(path.join(root, relative))) };
}

function add(errors, code, subject, detail) {
  errors.push({ code, subject, detail });
}

function validReviewIdentity(value, allowFixtureIdentities = false) {
  return typeof value === 'string' && value.trim() === value && value.length >= 5 &&
    (allowFixtureIdentities || !/(?:^|[\s@._-])(fake|self|invented|unknown|example|placeholder|test|fixture|tbd|todo)(?:$|[\s@._-])/i.test(value));
}

function sortedUnique(values) {
  return [...new Set(values)].sort();
}

function objectItems(value) {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object' && !Array.isArray(item)) : [];
}

function stringItems(value) {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
}

function exactSortedPaths(values) {
  return Array.isArray(values) && values.every(isSafeRelative) &&
    values.length === new Set(values).size && JSON.stringify(values) === JSON.stringify([...values].sort());
}

function validateSchema(root, id, value, errors) {
  try {
    if (!regularNonSymlink(root, SCHEMAS[id])) {
      add(errors, `${id}_schema_unavailable`, id, 'Schema must be a regular non-symlink file.');
      return;
    }
    const schema = readJson(root, SCHEMAS[id]);
    validateJsonSchema(value, schema).forEach(detail => add(errors, `${id}_schema_invalid`, id, detail));
  } catch (error) {
    add(errors, `${id}_schema_unavailable`, id, error.message);
  }
}

function exactPins(root, actual, expectedPaths, errors, code) {
  const canonicalPaths = sortedUnique(expectedPaths);
  if (canonicalPaths.length !== expectedPaths.length || !exactSortedPaths(canonicalPaths) ||
      !Array.isArray(actual) || actual.length !== canonicalPaths.length) {
    add(errors, code, 'artifact_pins', 'Artifact pin set is not the exact canonical path set.');
    return false;
  }
  let pass = true;
  for (let index = 0; index < canonicalPaths.length; index += 1) {
    const expectedPath = canonicalPaths[index];
    const item = actual[index];
    if (!item || Object.keys(item).sort().join(',') !== 'path,sha256' || item.path !== expectedPath ||
        !regularNonSymlink(root, expectedPath) || pin(root, expectedPath).sha256 !== item.sha256) {
      add(errors, code, expectedPath, 'Artifact is absent, non-regular, out of order, or hash-mismatched.');
      pass = false;
    }
  }
  return pass;
}

function extractRecords(payload, key) {
  if (Array.isArray(payload)) return payload;
  return payload && Array.isArray(payload[key]) ? payload[key] : [];
}

function recordIds(root, files, key, idKey, errors) {
  const ids = [];
  for (const relative of files || []) {
    try {
      const records = extractRecords(readJson(root, relative), key);
      if (!records.length) add(errors, `${key}_artifact_empty`, relative, `Published ${key} artifact has no records.`);
      records.forEach(record => ids.push(record && record[idKey]));
    } catch (error) {
      add(errors, `${key}_artifact_invalid`, relative, error.message);
    }
  }
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length) {
    add(errors, `${key}_ids_invalid`, key, `Published ${key} IDs are missing or duplicated.`);
  }
  return ids.filter(id => typeof id === 'string' && id).sort();
}

function inspectReviewedClimateRelease(root, options = {}) {
  const present = Object.fromEntries(Object.entries(PATHS).map(([id, relative]) => [id, entryPresent(root, relative)]));
  const presentCount = Object.values(present).filter(Boolean).length;
  if (presentCount === 0) {
    return {
      status: 'absent', pass: true, content_eligible: false, release_authority: false, errors: [], artifacts: present,
      canonical_output: null, approval_inventory: null, rollback_proof_passed: false,
      top20_primary_source_review_complete: false, licence_decisions_complete: false,
      field_level_fact_reviews_complete: false, independent_release_review_passed: false,
    };
  }

  const errors = [];
  for (const [id, relative] of Object.entries(PATHS)) {
    if (!present[id]) add(errors, 'release_artifact_missing', relative, 'A partial release package is forbidden.');
    else if (!regularNonSymlink(root, relative)) add(errors, 'release_artifact_not_regular', relative, 'Release artifact must be a regular non-symlink file under regular directories.');
  }
  if (errors.length) return failed(errors, present);

  const documents = {};
  for (const [id, relative] of Object.entries(PATHS)) {
    try { documents[id] = readJson(root, relative); }
    catch (error) { add(errors, 'release_artifact_json_invalid', relative, error.message); }
  }
  if (errors.length) return failed(errors, present);

  validateSchema(root, 'runtimeManifest', documents.runtimeManifest, errors);
  validateSchema(root, 'releaseInput', documents.releaseInput, errors);
  validateSchema(root, 'allowManifest', documents.allowManifest, errors);
  validateSchema(root, 'releaseDiff', documents.releaseDiff, errors);
  validateSchema(root, 'rollbackProof', documents.rollbackProof, errors);

  const runtime = documents.runtimeManifest && typeof documents.runtimeManifest === 'object' && !Array.isArray(documents.runtimeManifest)
    ? documents.runtimeManifest : {};
  const reviewedInput = documents.releaseInput && typeof documents.releaseInput === 'object' && !Array.isArray(documents.releaseInput)
    ? documents.releaseInput : {};
  const releaseDiff = documents.releaseDiff && typeof documents.releaseDiff === 'object' && !Array.isArray(documents.releaseDiff)
    ? documents.releaseDiff : {};
  const rollbackProof = documents.rollbackProof && typeof documents.rollbackProof === 'object' && !Array.isArray(documents.rollbackProof)
    ? documents.rollbackProof : {};
  const candidate = reviewedInput.candidate || {};
  const context = reviewedInput.review_context || {};
  const coreReviewIdentities = [
    candidate.review?.builder_id, ...stringItems(candidate.review?.reviewer_ids),
    runtime.runtime?.builder_id, runtime.runtime?.reviewer_id,
    releaseDiff.review?.builder_id, releaseDiff.review?.reviewer_id,
  ];
  if (coreReviewIdentities.some(identity => !validReviewIdentity(identity, options.allowFixtureIdentities))) {
    add(errors, 'review_identity_invalid', 'release_package', 'Core release/runtime/diff review identities must be non-placeholder identities.');
  }
  let canonicalOutput = null;
  try {
    canonicalOutput = evaluateRelease(candidate);
    if (!same(canonicalOutput, documents.allowManifest)) {
      add(errors, 'ct40_output_mismatch', PATHS.allowManifest, 'Committed ALLOW is not the exact canonical evaluator output for the reviewed input.');
    }
    if (canonicalOutput.decision !== 'allow' || canonicalOutput.eligible !== true || canonicalOutput.reason_codes.length ||
        canonicalOutput.review_queue.length || canonicalOutput.fact_decisions.some(item => !item.eligible) ||
        canonicalOutput.profile_decisions.some(item => !item.eligible)) {
      add(errors, 'ct40_not_allow', PATHS.allowManifest, 'Canonical CT-40 evaluation does not authorize this package.');
    }
  } catch (error) {
    add(errors, 'ct40_evaluation_failed', PATHS.releaseInput, error.message);
  }

  const facts = objectItems(candidate.facts);
  const profiles = objectItems(candidate.profiles);
  const referencedFactIds = new Set(profiles.flatMap(profile => Array.isArray(profile.input_fact_ids) ? profile.input_fact_ids : []));
  if (!facts.length) add(errors, 'release_facts_empty', PATHS.releaseInput, 'A release must contain reviewed facts.');
  if (!profiles.length) add(errors, 'release_profiles_empty', PATHS.releaseInput, 'A release must contain reviewed profiles.');
  if (facts.some(fact => !referencedFactIds.has(fact.fact_id))) {
    add(errors, 'release_fact_not_profiled', PATHS.releaseInput, 'Every released fact must be consumed by a reviewed profile.');
  }
  for (const fact of facts) {
    if ((fact.evidence_class === 'derived' || fact.evidence_class === 'modeled') &&
        fact.derivation?.calculation_hash !== factCalculationHash(fact)) {
      add(errors, 'fact_calculation_hash_mismatch', fact.fact_id || PATHS.releaseInput, 'Derived/modeled fact calculation hash is not canonical.');
    }
  }
  for (const profile of profiles) {
    if (profile.calculation_hash !== profileCalculationHash(profile)) {
      add(errors, 'profile_calculation_hash_mismatch', profile.profile_id || PATHS.releaseInput, 'Profile calculation hash is not canonical.');
    }
  }

  let registrySources = [];
  try {
    const registry = readJson(root, runtime.source_registry);
    registrySources = objectItems(registry.sources);
  } catch (error) {
    add(errors, 'source_registry_invalid', runtime.source_registry || PATHS.runtimeManifest, error.message);
  }
  const registryById = new Map(registrySources.map(source => [source.id || source.source_id, source]));
  if (registryById.size !== registrySources.length) {
    add(errors, 'source_registry_duplicate_id', runtime.source_registry || PATHS.runtimeManifest, 'Source registry IDs must be unique.');
  }
  const candidateSources = objectItems(candidate.sources);
  const factSourceIds = sortedUnique(facts.map(fact => fact && fact.source_id).filter(Boolean));
  const candidateSourceIds = candidateSources.map(source => source && source.source_id).filter(Boolean).sort();
  if (!same(factSourceIds, candidateSourceIds) || new Set(candidateSourceIds).size !== candidateSourceIds.length) {
    add(errors, 'source_set_mismatch', PATHS.releaseInput, 'CT-40 sources must exactly equal the sources used by released facts.');
  }
  const rightsDecisions = objectItems(reviewedInput.source_rights_decisions);
  const decisionsBySource = new Map(rightsDecisions.map(decision => [decision && decision.source_id, decision]));
  const decisionIds = rightsDecisions.map(decision => decision && decision.decision_id);
  if (decisionsBySource.size !== rightsDecisions.length || decisionsBySource.size !== candidateSources.length ||
      decisionIds.some(id => typeof id !== 'string' || !id) || new Set(decisionIds).size !== decisionIds.length) {
    add(errors, 'source_rights_decision_set_mismatch', PATHS.releaseInput, 'Every source must have exactly one reviewed rights/scoring decision.');
  }
  for (const source of candidateSources) {
    const decision = decisionsBySource.get(source.source_id);
    const registered = registryById.get(source.source_id);
    const registeredChecksum = registered?.artifact?.sha256 || registered?.checksum_sha256;
    const independent = decision && decision.decision_by !== decision.reviewer_id &&
      validReviewIdentity(decision.decision_by, options.allowFixtureIdentities) &&
      validReviewIdentity(decision.reviewer_id, options.allowFixtureIdentities);
    if (!decision || !registered || registered.version !== decision.source_version ||
        registeredChecksum !== source.checksum_sha256 || decision.source_checksum_sha256 !== source.checksum_sha256 ||
        decision.decision_id !== source.licence?.decision_id || decision.status !== 'reviewed' ||
        decision.redistribution_approved !== true || decision.scoring_approved !== true ||
        source.licence?.redistribution_approved !== true || source.licence?.scoring_approved !== true || !independent ||
        decision.decision_hash !== sourceRightsDecisionCalculationHash(decision)) {
      add(errors, 'source_rights_decision_invalid', source.source_id || PATHS.releaseInput,
        'Source registry pin, independent decision, redistribution approval, or scoring approval does not match CT-40.');
    }
  }

  const requiredTop20 = Array.isArray(context.required_country_ids) ? [...context.required_country_ids].sort() : [];
  const reviewedTop20 = Array.isArray(context.independently_reviewed_country_ids) ? [...context.independently_reviewed_country_ids].sort() : [];
  const top20Reviews = objectItems(context.top20_primary_source_reviews);
  const top20ReviewCountryIds = top20Reviews.map(review => review.country_id);
  const top20ReviewerIds = sortedUnique(top20Reviews.map(review => review.reviewer_id).filter(Boolean));
  if (!same(requiredTop20, REQUIRED_TOP20_COUNTRY_IDS) || !same(reviewedTop20, REQUIRED_TOP20_COUNTRY_IDS)) {
    add(errors, 'top20_review_incomplete', PATHS.releaseInput, 'Required and independently reviewed country sets must equal the frozen top-20 set.');
  }
  if (!same(top20ReviewCountryIds, REQUIRED_TOP20_COUNTRY_IDS) || new Set(top20ReviewCountryIds).size !== top20Reviews.length ||
      !same(top20ReviewerIds, sortedUnique(stringItems(context.reviewer_ids)))) {
    add(errors, 'top20_review_record_set_mismatch', PATHS.releaseInput, 'Top-20 review records and reviewer identities must be the exact canonical sets.');
  }
  for (const review of top20Reviews) {
    const documentLists = [review.official_inventory_document_ids, review.active_ndc_document_ids, review.target_methodology_document_ids];
    if (review.status !== 'reviewed' || review.extractor_id === review.reviewer_id ||
        !validReviewIdentity(review.extractor_id, options.allowFixtureIdentities) ||
        !validReviewIdentity(review.reviewer_id, options.allowFixtureIdentities) ||
        documentLists.some(items => !exactSortedPaths(items)) || review.review_hash !== top20ReviewCalculationHash(review)) {
      add(errors, 'top20_review_record_invalid', review.country_id || PATHS.releaseInput,
        'Top-20 primary-source review must be independent, document-pinned, sorted, and canonically hashed.');
    }
  }
  if ((context.reviewer_ids || []).includes(candidate.review?.builder_id)) {
    add(errors, 'top20_review_not_independent', PATHS.releaseInput, 'The release builder cannot be a top-20 reviewer.');
  }

  if (runtime.data_release_id !== candidate.data_release_id || runtime.methodology_version !== candidate.methodology_version ||
      releaseDiff.data_release_id !== candidate.data_release_id || rollbackProof.data_release_id !== candidate.data_release_id) {
    add(errors, 'release_identity_mismatch', 'release_package', 'Release ID or methodology version differs across package artifacts.');
  }
  if (runtime.runtime?.builder_id === runtime.runtime?.reviewer_id) {
    add(errors, 'runtime_self_review', PATHS.runtimeManifest, 'Runtime builder and reviewer must be independent.');
  }

  const runtimePaths = [
    ...stringItems(runtime.runtime?.file_paths), ...stringItems(runtime.runtime?.data_files),
    ...stringItems(runtime.published_fact_files), ...stringItems(runtime.published_profile_files),
    ...stringItems(runtime.batch_attestation_files), runtime.source_registry,
    PATHS.releaseInput, PATHS.allowManifest,
  ];
  if (!runtimePaths.every(isSafeRelative)) add(errors, 'runtime_path_invalid', PATHS.runtimeManifest, 'Runtime artifact paths must be normalized repository-relative paths.');
  exactPins(root, runtime.artifact_pins, runtimePaths, errors, 'runtime_artifact_pin_mismatch');

  const publishedFactIds = recordIds(root, stringItems(runtime.published_fact_files), 'facts', 'fact_id', errors);
  const publishedProfileIds = recordIds(root, stringItems(runtime.published_profile_files), 'profiles', 'profile_id', errors);
  const candidateFactIds = facts.map(item => item && item.fact_id).filter(Boolean).sort();
  const candidateProfileIds = profiles.map(item => item && item.profile_id).filter(Boolean).sort();
  if (!same(publishedFactIds, candidateFactIds)) add(errors, 'published_fact_set_mismatch', 'facts', 'Published and CT-40 fact IDs differ.');
  if (!same(publishedProfileIds, candidateProfileIds)) add(errors, 'published_profile_set_mismatch', 'profiles', 'Published and CT-40 profile IDs differ.');

  if (releaseDiff.initial_release === true ? releaseDiff.previous_release_id !== null :
      typeof releaseDiff.previous_release_id !== 'string' || releaseDiff.previous_release_id === releaseDiff.data_release_id) {
    add(errors, 'release_diff_lineage_invalid', PATHS.releaseDiff, 'Release lineage is inconsistent.');
  }
  if (releaseDiff.review?.builder_id === releaseDiff.review?.reviewer_id) {
    add(errors, 'release_diff_self_review', PATHS.releaseDiff, 'Release diff builder and reviewer must be independent.');
  }
  if (releaseDiff.diff_hash !== releaseDiffCalculationHash(releaseDiff)) {
    add(errors, 'release_diff_hash_mismatch', PATHS.releaseDiff, 'Release diff hash is not the canonical calculation.');
  }
  const expectedDiffPaths = [PATHS.runtimeManifest, PATHS.releaseInput, PATHS.allowManifest];
  exactPins(root, releaseDiff.artifact_pins, expectedDiffPaths, errors, 'release_diff_pin_mismatch');

  const expectedRollbackPins = [PATHS.runtimeManifest, PATHS.releaseInput, PATHS.allowManifest, PATHS.releaseDiff]
    .sort().map(relative => pin(root, relative));
  const rollback = validateReviewedRollbackProof(root, rollbackProof, {
    schema: readJson(root, SCHEMAS.rollbackProof),
    expectedPackagePins: expectedRollbackPins,
    allowedControlPaths: [...stringItems(runtime.runtime?.file_paths), ...stringItems(runtime.runtime?.data_files)],
    baselineReader: options.baselineReader,
    allowFixtureIdentities: options.allowFixtureIdentities,
  });
  rollback.errors.forEach(item => add(errors, item.code, PATHS.rollbackProof, item.detail));

  errors.sort((a, b) => a.code.localeCompare(b.code) || a.subject.localeCompare(b.subject) || a.detail.localeCompare(b.detail));
  const pass = errors.length === 0 && rollback.pass;
  return {
    status: pass ? 'validated' : 'invalid',
    pass,
    content_eligible: pass,
    release_authority: false,
    errors,
    artifacts: present,
    canonical_output: canonicalOutput,
    approval_inventory: pass ? {
      runtime_manifest: pin(root, PATHS.runtimeManifest),
      ct40_reviewed_release_input: pin(root, PATHS.releaseInput),
      ct40_allow_manifest: pin(root, PATHS.allowManifest),
      reviewed_release_diff: pin(root, PATHS.releaseDiff),
      reviewed_rollback_proof: pin(root, PATHS.rollbackProof),
    } : null,
    rollback_proof_passed: rollback.pass,
    top20_primary_source_review_complete: same(requiredTop20, REQUIRED_TOP20_COUNTRY_IDS) &&
      same(reviewedTop20, REQUIRED_TOP20_COUNTRY_IDS) && same(top20ReviewCountryIds, REQUIRED_TOP20_COUNTRY_IDS) &&
      !errors.some(item => item.code.startsWith('top20_review')),
    licence_decisions_complete: context.licence_decisions_complete === true &&
      rightsDecisions.length > 0 && !errors.some(item => item.code.startsWith('source_rights_decision')),
    field_level_fact_reviews_complete: context.field_level_fact_reviews_complete === true,
    independent_release_review_passed: candidate.review?.status === 'reviewed' &&
      Array.isArray(candidate.review?.reviewer_ids) && candidate.review.reviewer_ids.length > 0 &&
      !candidate.review.reviewer_ids.includes(candidate.review.builder_id),
    rehearsal: rollback.rehearsal,
  };
}

function failed(errors, artifacts) {
  errors.sort((a, b) => a.code.localeCompare(b.code) || a.subject.localeCompare(b.subject) || a.detail.localeCompare(b.detail));
  return {
    status: 'invalid', pass: false, content_eligible: false, release_authority: false, errors, artifacts,
    canonical_output: null, approval_inventory: null, rollback_proof_passed: false,
    top20_primary_source_review_complete: false, licence_decisions_complete: false,
    field_level_fact_reviews_complete: false, independent_release_review_passed: false,
  };
}

module.exports = {
  PATHS,
  REQUIRED_TOP20_COUNTRY_IDS,
  SCHEMAS,
  inspectReviewedClimateRelease,
  factCalculationHash,
  profileCalculationHash,
  top20ReviewCalculationHash,
  sourceRightsDecisionCalculationHash,
  releaseDiffCalculationHash,
  sha256,
  validReviewIdentity,
};
