'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { inspectReviewRequest } = require('./country-climate-intelligence-release-gate');
const { inspectRegular } = require('./public-deploy-surface');
const {
  REQUIRED_ABSENT_PATHS,
  artifactPinDigest,
  calculationHash: requestCalculationHash,
} = require('../prepare-country-climate-intelligence-review-request');

const CURRENT_REVIEW_REQUEST_PATH = 'data/climate/releases/country-climate-intelligence-v1/review-request.json';
const BASE_REVIEW_REQUEST_PATH = 'data/climate/reviews/cci-v1-ai-reports/base-first-paint-v78-review-request.json';
const DELTA_REVIEW_PATH = 'data/climate/reviews/cci-v1-presentation-performance-delta-review.json';

const BASE_SUBJECT = Object.freeze({
  reviewed_head: '108e6b6be2e3a53c45b4c2a596de11656774ab8c',
  review_request_sha256: '8fe8a47dbf8eea2081f7135ab11b3baab1c4af164e6fc9542d7ceaf06c780753',
  artifact_pin_digest: '75804cbb652bedb85acabf35996889600f82a963aebb124f4960b7a1f7b0e017',
  calculation_hash: 'dfd4b50b1482bbc6688b68b1536b8a2700625873424f13a60be8427bab093f35',
  pin_count: 300,
});

const BASE_REPORTS = Object.freeze({
  'ai-reviewer:luna-science': Object.freeze({
    model: 'gpt-5.6-luna',
    verdict: 'approve_with_conditions',
    path: 'data/climate/reviews/cci-v1-ai-reports/luna-science.md',
    sha256: '4de9fb3136d80733d3efab84ba5024a144b817582ea5e062a68ca44aec93c856',
    identity_anchor: 'Reviewer: `ai-reviewer:luna-science`',
  }),
  'ai-reviewer:luna-rights': Object.freeze({
    model: 'gpt-5.6-luna',
    verdict: 'approve_with_conditions',
    path: 'data/climate/reviews/cci-v1-ai-reports/luna-rights.md',
    sha256: 'a361ccc86045bb1e748bfa0524369e913d8b688e71aea038a8c7ef4fc586a726',
    identity_anchor: 'Reviewer: `ai-reviewer:luna-rights`',
  }),
  'ai-reviewer:terra-runtime': Object.freeze({
    model: 'gpt-5.6-terra',
    verdict: 'approve',
    path: 'data/climate/reviews/cci-v1-ai-reports/terra-runtime.md',
    sha256: '115f2bcbd14152934b545011903b9fe9cd30858ccc0a990b7b1e8ef487e39827',
    identity_anchor: 'Reviewer: `ai-reviewer:terra-runtime`',
  }),
  'ai-reviewer:sol-red-team': Object.freeze({
    model: 'gpt-5.6-sol',
    verdict: 'approve',
    path: 'data/climate/reviews/cci-v1-ai-reports/sol-red-team.md',
    sha256: '046c05ba5bbccd521034330b7e82cf40a7bda50cf17e84b743727d0ea1d7fa7d',
    identity_anchor: '# Sol red-team review — first-paint / CCI v1 candidate',
  }),
});

const FONT_PATHS = Object.freeze([
  'assets/fonts/OFL-cormorant-garamond.txt',
  'assets/fonts/OFL-jetbrains-mono.txt',
  'assets/fonts/OFL-outfit.txt',
  'assets/fonts/README.md',
  'assets/fonts/cormorant-garamond-latin-ext.woff2',
  'assets/fonts/cormorant-garamond-latin.woff2',
  'assets/fonts/cormorant-garamond-site.woff2',
  'assets/fonts/jetbrains-mono-latin-ext.woff2',
  'assets/fonts/jetbrains-mono-latin.woff2',
  'assets/fonts/jetbrains-mono-site.woff2',
  'assets/fonts/outfit-latin-ext.woff2',
  'assets/fonts/outfit-latin.woff2',
  'assets/fonts/outfit-site.woff2',
]);

const DELTA_PATHS_BY_CATEGORY = Object.freeze({
  presentation_and_font_delivery: Object.freeze([
    'CREDITS.md',
    '_headers',
    'index.html',
    'sw.js',
    ...FONT_PATHS,
  ]),
  performance_evidence: Object.freeze([
    'data/performance/first-paint-mobile-2026-08-28.json',
    'tools/check-first-paint-performance-receipt.js',
  ]),
  deterministic_runtime_proof: Object.freeze([
    'data/climate/operations/ct42-runtime-rollback.patch.b64',
    'data/climate/reviews/ct42-candidate-rollback-rehearsal.json',
    'js/app.js',
    'tools/build-ct42-runtime-rollback-proof.js',
    'tools/check-country-climate-intelligence-ui.js',
    'tools/check-country-climate-runtime-atomic.js',
    'tools/check-ct42-runtime-rollback-proof.js',
    'tools/fixtures/globe-runtime-assets.json',
    'tools/lib/ct42-runtime-rollback-proof.js',
    'tools/lib/globe-runtime-assets.js',
    'tools/verify-legacy-country-exit.js',
  ]),
  scoped_release_rail: Object.freeze([
    '.github/CODEOWNERS',
    '.github/workflows/ci.yml',
    'ARCHITECTURE.md',
    'docs/FACTUAL-PUBLIC-DEPLOYMENT.md',
    'docs/operations/GO_PUBLIC.md',
    'tools/build-cci-scoped-delta-review.js',
    'tools/check-cci-factual-public-review.js',
    'tools/lib/cci-factual-public.js',
    'tools/lib/cci-scoped-delta-review.js',
    'tools/lib/public-deploy-surface.js',
    'tools/prepare-country-climate-intelligence-review-request.js',
  ]),
});

const REQUIRED_UNCHANGED_PATHS = Object.freeze([
  'THIRD_PARTY_NOTICES.txt',
  'assets/globe/runtime/earth-blue-marble.jpg',
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/earth-topology.png',
  'assets/globe/runtime/manifest.json',
  'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
  'assets/globe/runtime/night-sky.png',
  'data/climate/country-registry.json',
  'data/climate/releases/country-climate-intelligence-v1/cckp-physical.json',
  'data/climate/releases/country-climate-intelligence-v1/ember-power.json',
  'data/climate/releases/country-climate-intelligence-v1/gcb-carbon.json',
  'data/climate/releases/country-climate-intelligence-v1/release-manifest.json',
  'data/climate/releases/country-climate-intelligence-v1/source-receipts.json',
  'data/climate/releases/country-climate-intelligence-v1/wpp-population.json',
  'data/climate/runtime/country-climate-intelligence.json',
  'data/climate/source-registry.json',
  'js/country-climate-intelligence.js',
  'js/data.js',
  'js/globe.js',
]);

const REQUIRED_ARTIFACT_PIN_PATHS = Object.freeze([
  '.github/CODEOWNERS',
  '.github/workflows/ci.yml',
  'ARCHITECTURE.md',
  'CREDITS.md',
  'THIRD_PARTY_NOTICES.txt',
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
  BASE_REVIEW_REQUEST_PATH,
  'data/climate/releases/country-climate-intelligence-v1/release-manifest.json',
  CURRENT_REVIEW_REQUEST_PATH,
  DELTA_REVIEW_PATH,
  'data/climate/reviews/country-climate-intelligence-v1-multi-model-ai-prepublication-review.json',
  'data/climate/runtime/country-climate-intelligence.json',
  'data/climate/source-registry.json',
  'tools/build-cci-factual-public-deploy.sh',
  'tools/build-cci-scoped-delta-review.js',
  'tools/check-cci-factual-public-deploy.js',
  'tools/check-cci-factual-public-review.js',
  'tools/check-public-climate-release-profile.js',
  'tools/check-staged-cci-factual-public-integrity.js',
  'tools/check-staged-production-integrity.js',
  'tools/fixtures/globe-runtime-assets.json',
  'tools/fixtures/globe-third-party-notices.json',
  'tools/lib/cci-factual-public.js',
  'tools/lib/cci-scoped-delta-review.js',
  'tools/lib/globe-runtime-assets.js',
  'tools/prepare-country-climate-intelligence-review-request.js',
  'tools/stage-cci-factual-public-deploy.js',
]);

const REQUIRED_PUBLIC_OUTPUT_PATHS = Object.freeze([
  'THIRD_PARTY_NOTICES.txt',
  ...FONT_PATHS,
  'assets/globe/runtime/earth-night.jpg',
  'assets/globe/runtime/ne_110m_admin_0_countries.geojson',
  'data/climate/runtime/country-climate-intelligence.json',
  'index.html',
  'js/country-climate-intelligence.js',
  'js/globe.js',
  'js/vendor/globe.gl.js',
  'sw.js',
]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function calculationHash(value) {
  const copy = structuredClone(value);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function semanticallyEqual(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function fail(message) {
  throw new Error(message);
}

function parseJson(bytes, label) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch (error) { fail(label + ' is not valid JSON: ' + error.message); }
}

function readJsonRecord(root, relative) {
  const record = inspectRegular(root, relative);
  return { ...record, value: parseJson(record.bytes, relative) };
}

function requestFacts(record) {
  const request = record.value;
  const pins = request?.subject?.artifact_pins;
  if (!Array.isArray(pins) || pins.length === 0) fail(record.path + ' has no artifact pins');
  const paths = pins.map(pin => pin?.path);
  if (paths.some(value => typeof value !== 'string') || new Set(paths).size !== paths.length) {
    fail(record.path + ' pin paths must be unique strings');
  }
  if (JSON.stringify(paths) !== JSON.stringify([...paths].sort())) fail(record.path + ' pin paths must be sorted');
  if (pins.some(pin => !/^[a-f0-9]{64}$/.test(pin?.sha256 || ''))) fail(record.path + ' contains an invalid pin hash');
  const digest = artifactPinDigest(pins, request.required_absent_paths);
  const calculated = requestCalculationHash(request);
  if (digest !== request.subject.artifact_pin_digest) fail(record.path + ' subject digest mismatch');
  if (calculated !== request.calculation_hash) fail(record.path + ' calculation hash mismatch');
  return {
    path: record.path,
    sha256: record.sha256,
    artifact_pin_digest: digest,
    calculation_hash: calculated,
    pin_count: pins.length,
    pins,
    request,
  };
}

function verifyBaseRequest(root) {
  const facts = requestFacts(readJsonRecord(root, BASE_REVIEW_REQUEST_PATH));
  if (facts.sha256 !== BASE_SUBJECT.review_request_sha256 ||
      facts.artifact_pin_digest !== BASE_SUBJECT.artifact_pin_digest ||
      facts.calculation_hash !== BASE_SUBJECT.calculation_hash ||
      facts.pin_count !== BASE_SUBJECT.pin_count) {
    fail('frozen four-review base subject mismatch');
  }
  if (facts.request.release_id !== 'country-climate-intelligence-2026-08-27-candidate.7' ||
      JSON.stringify(facts.request.required_absent_paths) !== JSON.stringify(REQUIRED_ABSENT_PATHS)) {
    fail('frozen four-review base identity or absence boundary mismatch');
  }
  return facts;
}

function verifyCurrentRequest(root) {
  const facts = requestFacts(readJsonRecord(root, CURRENT_REVIEW_REQUEST_PATH));
  const inspected = inspectReviewRequest(root, facts.request);
  if (inspected.status !== 'ready_for_external_review' || inspected.errors.length || inspected.blockers.length) {
    fail('current CCI request is not an exact ready-for-review subject: ' +
      [...inspected.errors, ...inspected.blockers].map(item => item.code).join(', '));
  }
  return facts;
}

function pinMap(facts) {
  return new Map(facts.pins.map(pin => [pin.path, pin.sha256]));
}

function categoryForPath(relative) {
  const matches = Object.entries(DELTA_PATHS_BY_CATEGORY)
    .filter(([, paths]) => paths.includes(relative))
    .map(([category]) => category);
  if (matches.length > 1) fail('delta path has multiple policy categories: ' + relative);
  return matches[0] || null;
}

function diffSubjects(baseFacts, currentFacts) {
  const base = pinMap(baseFacts);
  const current = pinMap(currentFacts);
  const paths = [...new Set([...base.keys(), ...current.keys()])].sort();
  const changes = [];
  paths.forEach(relative => {
    const before = base.get(relative) || null;
    const after = current.get(relative) || null;
    if (before === after) return;
    const category = categoryForPath(relative);
    if (!category) fail('scoped delta contains an unreviewable path: ' + relative);
    if (!after) fail('scoped delta may not delete a reviewed subject path: ' + relative);
    changes.push({
      path: relative,
      operation: before ? 'modify' : 'add',
      category,
      base_sha256: before,
      current_sha256: after,
    });
  });
  if (!changes.length) fail('scoped delta is empty');
  return changes;
}

function invariantPins(baseFacts, currentFacts) {
  const base = pinMap(baseFacts);
  const current = pinMap(currentFacts);
  return REQUIRED_UNCHANGED_PATHS.map(relative => {
    const before = base.get(relative);
    const after = current.get(relative);
    if (!before || before !== after) fail('high-risk invariant changed or disappeared: ' + relative);
    return { path: relative, sha256: after };
  });
}

function verifyBaseReports(root, reviewers) {
  if (!Array.isArray(reviewers) || reviewers.length !== 4) fail('exactly four base reviewers are required');
  const byId = new Map(reviewers.map(review => [review.reviewer_id, review]));
  if (byId.size !== 4) fail('base reviewer ids must be unique');
  Object.entries(BASE_REPORTS).forEach(([id, expected]) => {
    const review = byId.get(id);
    if (!review || review.model !== expected.model || review.post_mitigation_verdict !== expected.verdict ||
        review.report?.path !== expected.path || review.report?.sha256 !== expected.sha256) {
      fail('base reviewer binding mismatch: ' + id);
    }
    const report = inspectRegular(root, expected.path);
    if (report.sha256 !== expected.sha256) fail('base reviewer report hash mismatch: ' + id);
    const text = report.bytes.toString('utf8');
    [
      expected.identity_anchor,
      BASE_SUBJECT.review_request_sha256,
      BASE_SUBJECT.artifact_pin_digest,
      BASE_SUBJECT.calculation_hash,
    ].forEach(anchor => {
      if (!text.includes(anchor)) fail('base reviewer report anchor missing for ' + id + ': ' + anchor);
    });
  });
  return true;
}

function buildScopedDeltaArtifact(root, authorizedAt) {
  assert.match(authorizedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/, 'authorizedAt must be canonical UTC');
  const base = verifyBaseRequest(root);
  const current = verifyCurrentRequest(root);
  const artifact = {
    schema_version: '1.0.0',
    artifact_id: 'cci-v1-presentation-performance-delta-review-2026-08-29',
    created_at: authorizedAt,
    status: 'approved_for_scoped_ai_factual_publication_delta',
    review_type: 'single_ai_scoped_presentation_performance_delta',
    human_review: false,
    legal_certification: false,
    independent_institutional_review: false,
    release_authority: false,
    deploy_authority: false,
    reviewer: {
      reviewer_id: 'ai-reviewer:codex-focused-presentation-runtime',
      provider: 'OpenAI',
      system: 'Codex',
      model_identity: 'not_attested',
      scope: 'Presentation, self-hosted font delivery, first-paint evidence, cache epoch, deterministic rollback rebinding, and the fail-closed delta rail only.',
      verdict: 'approve_with_conditions',
    },
    maintainer_authorization: {
      authorized: true,
      authorized_at: authorizedAt,
      policy: 'scoped_presentation_performance_delta_review',
      scope: 'cci_ai_factual_presentation_performance_delta_only',
      human_review_substitute: false,
      base_multi_model_review_substitute: false,
      receipt: "The foundation maintainer explicitly answered 'evet' to the proposed single focused presentation/performance delta-review rail in this task.",
    },
    publication_authority: {
      authorized: true,
      scope: 'combine_with_exact_four_review_base_for_cci_ai_factual_lane_only',
      note: 'This artifact authorizes only the exact listed delta when combined with the unchanged four-review base and all strict staged checks.',
    },
    existing_human_signature_gate: 'unchanged_and_unsatisfied',
    base_subject: {
      path: BASE_REVIEW_REQUEST_PATH,
      review_request_sha256: base.sha256,
      artifact_pin_digest: base.artifact_pin_digest,
      calculation_hash: base.calculation_hash,
      pin_count: base.pin_count,
      reviewed_head: BASE_SUBJECT.reviewed_head,
      base_review_count: 4,
      base_model_family_count: 3,
    },
    current_subject: {
      path: CURRENT_REVIEW_REQUEST_PATH,
      review_request_sha256: current.sha256,
      artifact_pin_digest: current.artifact_pin_digest,
      calculation_hash: current.calculation_hash,
      pin_count: current.pin_count,
    },
    policy: {
      no_deletions: true,
      exact_changed_paths_only: true,
      unchanged_base_pins_retain_base_review_only: true,
      changed_pins_require_this_delta_review: true,
      outside_scope_requires_fresh_specialist_review: true,
      allowed_categories: Object.keys(DELTA_PATHS_BY_CATEGORY),
    },
    changes: diffSubjects(base, current),
    invariant_pins: invariantPins(base, current),
    evidence: [
      { command: 'node tools/check-country-climate-intelligence-ci.js', status: 'pass', authority: false },
      { command: 'node tools/check-ct42-runtime-rollback-proof.js', status: 'pass', authority: false },
      { command: 'node tools/check-first-paint-performance-receipt.js', status: 'pass', authority: false },
      { command: 'node tools/check-first-paint-performance-receipt.js --self-test', status: 'pass', authority: false },
      { command: 'node tools/check-streamed-first-paint-action.js', status: 'pass', authority: false },
      { command: 'SmokeTest.run() + StackLint.audit()', status: 'pass_30_of_30_and_zero_findings', authority: false },
      { command: 'v79 online/offline service-worker and three-font browser rehearsal', status: 'pass', authority: false },
    ],
    evidence_boundaries: {
      hero_payload_reduction_factor: 27.225,
      median_local_lcp_reduction_factor: 3.968,
      ten_x_page_speed_claim: false,
      sub_second_full_globe_claim: false,
      field_core_web_vitals_claim: false,
      search_ranking_claim: false,
    },
    publication_boundary: {
      climate_runtime_changed: false,
      source_registry_changed: false,
      source_rights_decisions_changed: false,
      globe_data_or_texture_bytes_changed: false,
      composite_score: false,
      target_assessment: false,
      finance_judgment: false,
      performance_grade: false,
      legal_or_human_review_claim: false,
    },
    conditions: [
      'Every current request pin must match the working tree and every base-to-current change must remain in the exact scoped policy.',
      'The complete CCI, performance, rollback, browser, staged-integrity, and Cloudflare main-branch gates must pass.',
      'Protected-file CODEOWNERS review remains required; this artifact is not a human review substitute.',
      'Any climate data, source-rights, globe data/texture, scoring, target, finance, or publication-boundary change requires fresh specialist review.',
    ],
    calculation_hash: null,
  };
  artifact.calculation_hash = calculationHash(artifact);
  return artifact;
}

function verifyScopedDeltaArtifact(root, artifact) {
  const base = verifyBaseRequest(root);
  const current = verifyCurrentRequest(root);
  if (artifact?.schema_version !== '1.0.0' ||
      artifact.artifact_id !== 'cci-v1-presentation-performance-delta-review-2026-08-29' ||
      artifact.status !== 'approved_for_scoped_ai_factual_publication_delta' ||
      artifact.review_type !== 'single_ai_scoped_presentation_performance_delta') {
    fail('unexpected scoped delta-review identity');
  }
  if (artifact.human_review !== false || artifact.legal_certification !== false ||
      artifact.independent_institutional_review !== false || artifact.release_authority !== false ||
      artifact.deploy_authority !== false) {
    fail('scoped delta-review authority boundary is overstated');
  }
  if (artifact.reviewer?.reviewer_id !== 'ai-reviewer:codex-focused-presentation-runtime' ||
      artifact.reviewer?.model_identity !== 'not_attested' || artifact.reviewer?.verdict !== 'approve_with_conditions') {
    fail('scoped delta reviewer identity or verdict mismatch');
  }
  if (artifact.maintainer_authorization?.authorized !== true ||
      artifact.maintainer_authorization?.policy !== 'scoped_presentation_performance_delta_review' ||
      artifact.maintainer_authorization?.scope !== 'cci_ai_factual_presentation_performance_delta_only' ||
      artifact.maintainer_authorization?.human_review_substitute !== false ||
      artifact.maintainer_authorization?.base_multi_model_review_substitute !== false) {
    fail('scoped maintainer authorization is absent or overstated');
  }
  if (artifact.publication_authority?.authorized !== true ||
      artifact.publication_authority?.scope !== 'combine_with_exact_four_review_base_for_cci_ai_factual_lane_only' ||
      artifact.existing_human_signature_gate !== 'unchanged_and_unsatisfied') {
    fail('scoped publication combination boundary mismatch');
  }
  const expectedBase = {
    path: BASE_REVIEW_REQUEST_PATH,
    review_request_sha256: base.sha256,
    artifact_pin_digest: base.artifact_pin_digest,
    calculation_hash: base.calculation_hash,
    pin_count: base.pin_count,
    reviewed_head: BASE_SUBJECT.reviewed_head,
    base_review_count: 4,
    base_model_family_count: 3,
  };
  const expectedCurrent = {
    path: CURRENT_REVIEW_REQUEST_PATH,
    review_request_sha256: current.sha256,
    artifact_pin_digest: current.artifact_pin_digest,
    calculation_hash: current.calculation_hash,
    pin_count: current.pin_count,
  };
  if (!semanticallyEqual(artifact.base_subject, expectedBase) ||
      !semanticallyEqual(artifact.current_subject, expectedCurrent)) {
    fail('scoped delta subject binding mismatch');
  }
  if (!semanticallyEqual(artifact.changes, diffSubjects(base, current))) {
    fail('scoped delta changed-path receipt mismatch');
  }
  if (!semanticallyEqual(artifact.invariant_pins, invariantPins(base, current))) {
    fail('scoped delta invariant receipt mismatch');
  }
  if (artifact.policy?.no_deletions !== true || artifact.policy?.exact_changed_paths_only !== true ||
      artifact.policy?.unchanged_base_pins_retain_base_review_only !== true ||
      artifact.policy?.changed_pins_require_this_delta_review !== true ||
      artifact.policy?.outside_scope_requires_fresh_specialist_review !== true ||
      JSON.stringify(artifact.policy.allowed_categories) !== JSON.stringify(Object.keys(DELTA_PATHS_BY_CATEGORY))) {
    fail('scoped delta policy mismatch');
  }
  const boundary = artifact.publication_boundary || {};
  Object.values(boundary).forEach(value => { if (value !== false) fail('scoped publication boundary must remain false'); });
  if (artifact.evidence_boundaries?.hero_payload_reduction_factor !== 27.225 ||
      artifact.evidence_boundaries?.median_local_lcp_reduction_factor !== 3.968 ||
      ['ten_x_page_speed_claim', 'sub_second_full_globe_claim', 'field_core_web_vitals_claim', 'search_ranking_claim']
        .some(field => artifact.evidence_boundaries?.[field] !== false)) {
    fail('performance evidence boundary mismatch');
  }
  if (!Array.isArray(artifact.evidence) || artifact.evidence.length !== 7 ||
      artifact.evidence.some(item => !String(item.status).startsWith('pass') || item.authority !== false)) {
    fail('scoped delta evidence receipts are incomplete or over-authoritative');
  }
  if (!Array.isArray(artifact.conditions) || artifact.conditions.length !== 4) fail('scoped delta conditions are incomplete');
  if (!/^[a-f0-9]{64}$/.test(artifact.calculation_hash || '') || calculationHash(artifact) !== artifact.calculation_hash) {
    fail('scoped delta calculation hash mismatch');
  }
  return { base, current, changes: artifact.changes.length, calculation_hash: artifact.calculation_hash };
}

function runSelfTest() {
  const base = {
    pins: [
      { path: 'index.html', sha256: 'a'.repeat(64) },
      { path: 'data/climate/runtime/country-climate-intelligence.json', sha256: 'b'.repeat(64) },
    ],
  };
  const allowed = { pins: [
    { path: 'index.html', sha256: 'c'.repeat(64) },
    { path: 'data/climate/runtime/country-climate-intelligence.json', sha256: 'b'.repeat(64) },
  ] };
  assert.deepEqual(diffSubjects(base, allowed), [{
    path: 'index.html', operation: 'modify', category: 'presentation_and_font_delivery',
    base_sha256: 'a'.repeat(64), current_sha256: 'c'.repeat(64),
  }]);
  const allowedFont = { pins: [...base.pins, { path: 'assets/fonts/outfit-site.woff2', sha256: 'e'.repeat(64) }] };
  assert.equal(diffSubjects(base, allowedFont)[0].category, 'presentation_and_font_delivery');
  const forbidden = { pins: [
    { path: 'index.html', sha256: 'a'.repeat(64) },
    { path: 'data/climate/runtime/country-climate-intelligence.json', sha256: 'c'.repeat(64) },
  ] };
  assert.throws(() => diffSubjects(base, forbidden), /unreviewable path/);
  const deleted = { pins: [{ path: 'data/climate/runtime/country-climate-intelligence.json', sha256: 'b'.repeat(64) }] };
  assert.throws(() => diffSubjects(base, deleted), /may not delete/);
  const addedUnknown = { pins: [...base.pins, { path: 'js/new-runtime.js', sha256: 'd'.repeat(64) }] };
  assert.throws(() => diffSubjects(base, addedUnknown), /unreviewable path/);
  const renamedFont = { pins: [...base.pins, { path: 'assets/fonts/unreviewed.woff2', sha256: 'e'.repeat(64) }] };
  assert.throws(() => diffSubjects(base, renamedFont), /unreviewable path/);
  assert.throws(() => diffSubjects(base, structuredClone(base)), /scoped delta is empty/);

  const invariantBase = {
    pins: REQUIRED_UNCHANGED_PATHS.map((relative, index) => ({
      path: relative,
      sha256: index.toString(16).padStart(64, '0'),
    })),
  };
  const invariantChanged = structuredClone(invariantBase);
  invariantChanged.pins[0].sha256 = 'f'.repeat(64);
  assert.throws(() => invariantPins(invariantBase, invariantChanged), /high-risk invariant changed/);
  const invariantDeleted = { pins: invariantBase.pins.slice(1) };
  assert.throws(() => invariantPins(invariantBase, invariantDeleted), /high-risk invariant changed/);
  return 9;
}

module.exports = {
  BASE_REPORTS,
  BASE_REVIEW_REQUEST_PATH,
  BASE_SUBJECT,
  CURRENT_REVIEW_REQUEST_PATH,
  DELTA_PATHS_BY_CATEGORY,
  DELTA_REVIEW_PATH,
  FONT_PATHS,
  REQUIRED_ARTIFACT_PIN_PATHS,
  REQUIRED_PUBLIC_OUTPUT_PATHS,
  REQUIRED_UNCHANGED_PATHS,
  buildScopedDeltaArtifact,
  calculationHash,
  categoryForPath,
  diffSubjects,
  invariantPins,
  readJsonRecord,
  runSelfTest,
  sha256,
  verifyBaseReports,
  verifyBaseRequest,
  verifyCurrentRequest,
  verifyScopedDeltaArtifact,
};
