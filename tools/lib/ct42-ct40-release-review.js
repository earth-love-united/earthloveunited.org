'use strict';

const crypto = require('node:crypto');
const { evaluateRelease } = require('./climate-release-gate');

const ADAPTER_VERSION = '1.2.0';
const METHODOLOGY_VERSION = '0.1.0';
const EVALUATED_AT = '2026-07-15T13:00:00Z';
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const REQUIRED_DATA_REVIEW_PIN_PATHS = Object.freeze([
  'data/climate/country-registry.json',
  'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json',
  'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json',
  'data/climate/source-registry.json',
  'data/climate/runtime/country-factual-candidate.json',
  'data/climate/runtime/published-facts-candidate.json',
  'data/climate/runtime/ct10c-batch-attestation-wrapper.json',
  'data/climate/runtime/candidate-manifest.json',
  'data/climate/runtime/rollback-plan.json',
]);
const REQUIRED_UI_REVIEW_PIN_PATHS = Object.freeze([
  'index.html',
  'css/globe-system.css',
  'js/app.js',
  'js/globe.js',
  'js/data.js',
  'tools/smoke-test.js',
  'data/climate/runtime/country-factual-candidate.json',
  'data/climate/runtime/candidate-manifest.json',
  'data/small-nations.json',
  'sw.js',
  'assets/globe/runtime/manifest.json',
  'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/night-sky.png',
  'assets/globe/runtime/earth-blue-marble.jpg',
  'assets/globe/runtime/earth-topology.png',
]);
const ANCESTRY_BOUNDARY = 'This pure adapter does not inspect Git history. It accepts independent review commits only when every declared scoped file hash matches the assembled candidate; any ancestry assertion belongs in CI with explicitly fetched refs.';
const REQUIRED_REASON_CODES = Object.freeze([
  'climate_evidence_not_reviewed',
  'source_not_reviewed',
  'licence_not_approved',
  'evidence_insufficient',
  'independent_review_required',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSafePinPath(path, label) {
  assert(typeof path === 'string' && path.length > 0, `${label} path is absent`);
  assert(!path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'), `${label} path must remain repository-relative: ${path}`);
}

function validatePinMap(label, pins, requiredPaths) {
  assert(pins && typeof pins === 'object' && !Array.isArray(pins), `${label} pin map is absent`);
  const paths = Object.keys(pins);
  assert(paths.length > 0, `${label} pin map is empty`);
  for (const requiredPath of requiredPaths) {
    assert(Object.hasOwn(pins, requiredPath), `${label} required pin is absent: ${requiredPath}`);
  }
  for (const [path, digest] of Object.entries(pins)) {
    assertSafePinPath(path, label);
    assert(SHA256_PATTERN.test(digest), `${label} pin is not a SHA-256 digest: ${path}`);
  }
  return pins;
}

function uiPinMap(entries) {
  assert(Array.isArray(entries), 'CT-42 UI review pin list is absent');
  const pins = {};
  for (const entry of entries) {
    assert(entry && typeof entry === 'object', 'CT-42 UI review pin entry is invalid');
    assertSafePinPath(entry.path, 'CT-42 UI review');
    assert(!Object.hasOwn(pins, entry.path), `CT-42 UI review pin is duplicated: ${entry.path}`);
    pins[entry.path] = entry.sha256;
  }
  return pins;
}

function reviewPinMaps(dataReview, uiReview) {
  return {
    dataPins: validatePinMap('CT-42 data review', dataReview.reviewed_input_sha256, REQUIRED_DATA_REVIEW_PIN_PATHS),
    uiPins: validatePinMap('CT-42 UI review', uiPinMap(uiReview.reviewed_file_pins), REQUIRED_UI_REVIEW_PIN_PATHS),
  };
}

function reviewPinPaths(dataReview, uiReview) {
  const { dataPins, uiPins } = reviewPinMaps(dataReview, uiReview);
  return [...new Set([...Object.keys(dataPins), ...Object.keys(uiPins)])].sort();
}

function validateReviewScopes({ dataReview, uiReview, fileHashes }) {
  assert(COMMIT_SHA_PATTERN.test(dataReview.reviewed_commit_sha), 'CT-42 data review commit is not a full Git SHA');
  assert(COMMIT_SHA_PATTERN.test(uiReview.reviewed_commit), 'CT-42 UI review commit is not a full Git SHA');
  assert(fileHashes && typeof fileHashes === 'object' && !Array.isArray(fileHashes), 'assembled candidate file hashes are absent');
  const { dataPins, uiPins } = reviewPinMaps(dataReview, uiReview);

  for (const [path, expected] of Object.entries(dataPins)) {
    assert(fileHashes[path] === expected, `CT-42 data review pin mismatch: ${path}`);
  }
  for (const [path, expected] of Object.entries(uiPins)) {
    assert(fileHashes[path] === expected, `CT-42 UI review pin mismatch: ${path}`);
  }

  return {
    data_review: {
      review_id: dataReview.review_id,
      commit_sha: dataReview.reviewed_commit_sha,
      required_pin_paths: [...REQUIRED_DATA_REVIEW_PIN_PATHS],
      declared_pin_count: Object.keys(dataPins).length,
    },
    ui_review: {
      review_id: uiReview.review_id,
      commit_sha: uiReview.reviewed_commit,
      required_pin_paths: [...REQUIRED_UI_REVIEW_PIN_PATHS],
      declared_pin_count: Object.keys(uiPins).length,
    },
    commit_relationship: {
      common_commit_required: false,
      ancestry_evaluated: false,
      boundary: ANCESTRY_BOUNDARY,
    },
    authority: 'scoped_file_sha256',
  };
}

function validateInputs(input) {
  const { runtime, facts, sourceRegistry, candidateManifest, dataReview, uiReview, primarySourcePilot, fileHashes } = input;
  assert(runtime.review_status === 'not_reviewed' && runtime.production_runtime_release === false, 'CT-42 runtime must remain a denied candidate');
  assert(facts.review_status === 'not_reviewed' && facts.production_runtime_release === false, 'published facts must remain a denied candidate');
  assert(facts.fact_count === 2060 && facts.facts.length === 2060, 'CT-42 factual universe must contain 2,060 facts');
  assert(runtime.coverage.registry_entities === 249 && runtime.coverage.reviewed_series === 206 && runtime.coverage.source_gaps === 43, 'CT-42 coverage drift');
  assert(candidateManifest.decision === 'deny' && candidateManifest.release_eligible === false && candidateManifest.production_runtime_release === false, 'candidate manifest crossed its deny boundary');

  assert(dataReview.decision === 'pass' && dataReview.reviewer?.independent_of_builder === true, 'independent CT-42 data review is absent');
  assert(dataReview.reviewer.reviewer_id !== dataReview.reviewer.builder_id, 'CT-42 data review is self-reviewed');
  assert(dataReview.publication_boundary?.production_runtime_release_allowed === false && dataReview.publication_boundary?.ct40_allow_decision_required === true, 'CT-42 data review leaked release authority');
  assert(uiReview.decision === 'pass' && uiReview.independent === true && uiReview.reviewer_id !== uiReview.builder_id, 'independent CT-42 UI review is absent');
  assert(uiReview.publication_boundary?.ct40_allow_decision === false && uiReview.publication_boundary?.release_eligible === false && uiReview.publication_boundary?.production_runtime_release === false, 'CT-42 UI review leaked release authority');
  const reviewEvidence = validateReviewScopes({ dataReview, uiReview, fileHashes });

  assert(primarySourcePilot.publication_status === 'blocked', 'primary-source pilot unexpectedly changed publication state');
  assert(primarySourcePilot.release_gate?.normalized_values_allowed === false, 'primary-source pilot unexpectedly allows normalized values');
  assert(primarySourcePilot.review?.status !== 'reviewed' && primarySourcePilot.coverage?.release_eligible === 0, 'primary-source pilot unexpectedly claims completed review');

  const source = sourceRegistry.sources.find(item => item.id === 'primap-hist-2.6.1-final');
  assert(source, 'pinned PRIMAP source is absent');
  assert(source.artifact?.sha256 && facts.facts.every(fact => fact.source_checksum_sha256 === source.artifact.sha256), 'published facts do not match the pinned PRIMAP checksum');
  assert(!source.licence?.decision_id, 'CT-40 licence decision ID must not be inferred from the source registry');
  assert(source.licence?.redistribution_approved !== true && source.licence?.scoring_approved !== true, 'CT-40 approval booleans must not be inferred from the source registry');
  return { source, reviewEvidence };
}

function buildGateCandidate(input, source, reviewEvidence) {
  const top20 = input.runtime.ranking.ranked.slice(0, 20).map(entry => entry.country_id);
  const pilotCountries = input.primarySourcePilot.coverage?.countries || [];
  const facts = input.facts.facts.map(fact => ({
    fact_id: fact.fact_id,
    entity_id: fact.entity_id,
    metric: fact.metric,
    value: fact.value,
    unit: fact.unit,
    period: fact.period,
    plane: fact.plane,
    evidence_class: fact.evidence_class,
    evidence_state: 'not_reviewed',
    source_id: fact.source_id,
    source_checksum_sha256: fact.source_checksum_sha256,
    methodology_version: METHODOLOGY_VERSION,
    derivation: fact.derivation,
  }));

  return {
    evaluated_at: EVALUATED_AT,
    methodology_version: METHODOLOGY_VERSION,
    data_release_id: input.runtime.candidate_id,
    sources: [{
      source_id: source.id,
      checksum_sha256: source.artifact.sha256,
      licence: {
        decision_id: null,
        redistribution_approved: null,
        scoring_approved: null,
      },
    }],
    facts,
    fact_reviews: [],
    profiles: [],
    conflicts: [],
    review: {
      status: 'not_reviewed',
      builder_id: 'ct-42-ct-40-release-review-adapter',
      reviewer_ids: [],
      reviewed_at: null,
    },
    review_context: {
      data_attestation_id: input.dataReview.review_id,
      ui_attestation_id: input.uiReview.review_id,
      scoped_review_evidence: reviewEvidence,
      top20_primary_source_review: {
        required_country_ids: top20,
        pilot_country_ids: pilotCountries.filter(id => top20.includes(id)).sort(),
        independently_reviewed_country_ids: [],
        status: 'missing',
      },
      absent_release_evidence: [
        'explicit_ct40_licence_decision',
        'ct40_field_level_fact_reviews',
        'top20_primary_source_review',
        'independent_ct40_release_review',
        'reviewed_runtime_manifest',
        'reviewed_release_diff',
        'executable_rollback_proof',
      ],
      release_authority: false,
    },
  };
}

function summarizeGate(inputArtifact, gateOutput) {
  const factReasonGroups = new Map();
  for (const decision of gateOutput.fact_decisions) {
    const key = decision.reason_codes.join('|');
    factReasonGroups.set(key, (factReasonGroups.get(key) || 0) + 1);
  }
  const queueSubjects = gateOutput.review_queue.reduce((counts, item) => {
    counts[item.subject_type] = (counts[item.subject_type] || 0) + 1;
    return counts;
  }, {});
  return {
    schema_version: '1.0.0',
    review_candidate_id: 'ct-42-to-ct-40-real-release-review-2026-07-15',
    adapter_version: ADAPTER_VERSION,
    evaluated_input_sha256: hash(inputArtifact),
    ct40_gate_version: gateOutput.gate_version,
    ct40_manifest_calculation_hash: gateOutput.manifest.calculation_hash,
    full_gate_output_sha256: hash(gateOutput),
    review_commits: {
      data_review_commit_sha: inputArtifact.review_evidence.data_review.commit_sha,
      ui_review_commit_sha: inputArtifact.review_evidence.ui_review.commit_sha,
      common_commit_required: false,
      ancestry_evaluated: false,
    },
    decision: gateOutput.decision,
    eligible: gateOutput.eligible,
    reason_codes: gateOutput.reason_codes,
    counts: {
      facts_evaluated: gateOutput.fact_decisions.length,
      facts_eligible: gateOutput.fact_decisions.filter(item => item.eligible).length,
      profiles_evaluated: gateOutput.profile_decisions.length,
      review_queue_items: gateOutput.review_queue.length,
      review_queue_by_subject: queueSubjects,
    },
    fact_decision_groups: [...factReasonGroups.entries()].map(([key, count]) => ({
      count,
      reason_codes: key ? key.split('|') : [],
    })),
    blockers: [
      { gap: 'top20_primary_source_review', canonical_reason_codes: ['source_not_reviewed', 'climate_evidence_not_reviewed'], status: 'missing' },
      { gap: 'explicit_ct40_licence_decision', canonical_reason_codes: ['licence_not_approved'], status: 'missing' },
      { gap: 'ct40_field_level_fact_reviews', canonical_reason_codes: ['climate_evidence_not_reviewed', 'source_not_reviewed', 'evidence_insufficient', 'independent_review_required'], status: 'missing' },
      { gap: 'independent_ct40_release_review', canonical_reason_codes: ['climate_evidence_not_reviewed', 'independent_review_required'], status: 'missing' },
      { gap: 'reviewed_runtime_manifest_release_diff_and_rollback_proof', canonical_reason_codes: ['climate_evidence_not_reviewed'], status: 'missing' },
    ],
    prohibited_outputs_absent: [
      'data/climate/runtime-manifest.json',
      'data/climate/releases/reviewed-release-diff.json',
      'data/climate/releases/ct40-allow-manifest.json',
    ],
    release_authority: false,
  };
}

function compile(input) {
  const { source, reviewEvidence } = validateInputs(input);
  const gateCandidate = buildGateCandidate(input, source, reviewEvidence);
  const inputArtifact = {
    schema_version: '1.0.0',
    adapter_version: ADAPTER_VERSION,
    purpose: 'Evaluate the actual denied CT-42 factual runtime candidate through CT-40 without manufacturing missing release evidence.',
    input_files: Object.keys(input.fileHashes).sort().map(path => ({ path, sha256: input.fileHashes[path] })),
    review_evidence: reviewEvidence,
    adapter_rules: {
      preserve_candidate_not_reviewed_state: true,
      require_common_review_commit: false,
      require_scoped_review_file_hashes: true,
      evaluate_git_ancestry: false,
      infer_ct40_licence_approvals: false,
      infer_fact_reviews_from_batch_attestation: false,
      infer_primary_source_review: false,
      infer_release_review: false,
      create_production_artifacts: false,
    },
    ct40_candidate: gateCandidate,
  };
  const gateOutput = evaluateRelease(gateCandidate);
  assert(gateOutput.decision === 'deny' && gateOutput.eligible === false, 'real CT-42 release-review candidate must remain denied');
  assert(REQUIRED_REASON_CODES.every(code => gateOutput.reason_codes.includes(code)), 'CT-40 deny reasons do not expose every known release-evidence gap');
  return { inputArtifact, gateOutput, resultArtifact: summarizeGate(inputArtifact, gateOutput) };
}

module.exports = {
  ADAPTER_VERSION,
  ANCESTRY_BOUNDARY,
  EVALUATED_AT,
  METHODOLOGY_VERSION,
  REQUIRED_DATA_REVIEW_PIN_PATHS,
  REQUIRED_REASON_CODES,
  REQUIRED_UI_REVIEW_PIN_PATHS,
  compile,
  hash,
  reviewPinPaths,
  validateInputs,
  validateReviewScopes,
};
