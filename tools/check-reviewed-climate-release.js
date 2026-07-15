#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { evaluateRelease } = require('./lib/climate-release-gate');
const {
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
} = require('./lib/climate-reviewed-release');
const { calculationHash: rollbackCalculationHash } = require('./lib/reviewed-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/reviewed-climate-release.json'), 'utf8'));
const GATE_FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/climate/fixtures/release-eligibility.json'), 'utf8'));

function write(root, relative, value) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.isBuffer(value) || typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function filePin(root, relative) {
  return { path: relative, sha256: sha256(fs.readFileSync(path.join(root, relative))) };
}

function canonicalBase64(bytes) {
  const encoded = bytes.toString('base64');
  return `${encoded.match(/.{1,76}/g).join('\n')}\n`;
}

function set(target, dotted, value) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const owner = parts.reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target);
  owner[key] = structuredClone(value);
}

function makeFixture(mutation = null) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-reviewed-release-fixture-'));
  const documents = {};
  for (const relative of Object.values(SCHEMAS)) write(root, relative, fs.readFileSync(path.join(ROOT, relative)));

  const candidate = structuredClone(GATE_FIXTURE.base_candidate);
  candidate.facts.forEach(fact => {
    if (fact.derivation) fact.derivation.calculation_hash = factCalculationHash(fact);
  });
  candidate.profiles.forEach(profile => { profile.calculation_hash = profileCalculationHash(profile); });
  const top20Reviews = REQUIRED_TOP20_COUNTRY_IDS.map(countryId => {
    const review = {
      country_id: countryId,
      status: 'reviewed',
      official_inventory_document_ids: [`fixture-inventory-${countryId}`],
      active_ndc_document_ids: [`fixture-ndc-${countryId}`],
      target_methodology_document_ids: [`fixture-method-${countryId}`],
      extractor_id: `fixture-extractor-${countryId}`,
      reviewer_id: 'fixture-top20-reviewer',
      reviewed_at: '2099-01-01T11:58:00Z',
      review_hash: null,
    };
    review.review_hash = top20ReviewCalculationHash(review);
    return review;
  });
  documents.releaseInput = {
    schema_version: '1.0.0',
    candidate,
    source_rights_decisions: candidate.sources.map(source => {
      const decision = {
        decision_id: source.licence.decision_id,
        source_id: source.source_id,
        source_version: 'fixture-source-v1',
        source_checksum_sha256: source.checksum_sha256,
        status: 'reviewed', redistribution_approved: true, scoring_approved: true,
        decision_by: `fixture-rights-decider-${source.source_id}`,
        reviewer_id: `fixture-rights-reviewer-${source.source_id}`,
        reviewed_at: '2099-01-01T11:56:00Z',
        decision_hash: null,
      };
      decision.decision_hash = sourceRightsDecisionCalculationHash(decision);
      return decision;
    }),
    review_context: {
      status: 'reviewed',
      required_country_ids: [...REQUIRED_TOP20_COUNTRY_IDS],
      independently_reviewed_country_ids: [...REQUIRED_TOP20_COUNTRY_IDS],
      top20_primary_source_reviews: top20Reviews,
      reviewer_ids: ['fixture-top20-reviewer'],
      reviewed_at: '2099-01-01T11:58:00Z',
      licence_decisions_complete: true,
      field_level_fact_reviews_complete: true,
    },
  };
  documents.allowManifest = evaluateRelease(candidate);

  write(root, 'js/fixture-runtime.js', "const runtimeState = 'release';\n");
  write(root, 'data/climate/runtime/fixture-runtime.json', { release: candidate.data_release_id });
  write(root, 'data/climate/releases/fixture-facts.json', { facts: candidate.facts });
  write(root, 'data/climate/releases/fixture-profiles.json', { profiles: candidate.profiles });
  write(root, 'data/climate/source-registry.json', { sources: candidate.sources.map(source => ({
    id: source.source_id,
    version: 'fixture-source-v1',
    artifact: { sha256: source.checksum_sha256 },
  })) });
  write(root, PATHS.releaseInput, documents.releaseInput);
  write(root, PATHS.allowManifest, documents.allowManifest);

  const runtimePaths = [
    'data/climate/releases/fixture-facts.json',
    'data/climate/releases/fixture-profiles.json',
    'data/climate/source-registry.json',
    'data/climate/runtime/fixture-runtime.json',
    PATHS.releaseInput,
    PATHS.allowManifest,
    'js/fixture-runtime.js',
  ].sort();
  documents.runtimeManifest = {
    schema_version: '1.0.0',
    manifest_id: 'fixture-reviewed-runtime-manifest',
    data_release_id: candidate.data_release_id,
    methodology_version: candidate.methodology_version,
    runtime: {
      review_status: 'reviewed',
      file_paths: ['js/fixture-runtime.js'],
      data_files: ['data/climate/runtime/fixture-runtime.json'],
      claims: {}, rankings: [],
      builder_id: 'fixture-runtime-builder', reviewer_id: 'fixture-runtime-reviewer', reviewed_at: '2099-01-01T11:57:00Z',
    },
    ct40_reviewed_release_input: PATHS.releaseInput,
    release_eligibility_manifest: PATHS.allowManifest,
    release_diff: PATHS.releaseDiff,
    rollback_proof: PATHS.rollbackProof,
    published_fact_files: ['data/climate/releases/fixture-facts.json'],
    published_profile_files: ['data/climate/releases/fixture-profiles.json'],
    batch_attestation_files: [],
    source_registry: 'data/climate/source-registry.json',
    artifact_pins: runtimePaths.map(relative => filePin(root, relative)),
  };
  write(root, PATHS.runtimeManifest, documents.runtimeManifest);

  documents.releaseDiff = {
    schema_version: '1.0.0', initial_release: true, data_release_id: candidate.data_release_id,
    previous_release_id: null,
    change_summary: 'Initial independently reviewed fictional climate release.',
    changed_entity_ids: ['iso3166-1:ZZZ'], source_revision_ids: ['fixture-source-v1'],
    artifact_pins: [PATHS.runtimeManifest, PATHS.releaseInput, PATHS.allowManifest].sort().map(relative => filePin(root, relative)),
    review: { status: 'reviewed', builder_id: 'fixture-diff-builder', reviewer_id: 'fixture-diff-reviewer', reviewed_at: '2099-01-01T11:59:00Z' },
    diff_hash: null,
  };
  documents.releaseDiff.diff_hash = releaseDiffCalculationHash(documents.releaseDiff);
  write(root, PATHS.releaseDiff, documents.releaseDiff);

  const releaseBytes = fs.readFileSync(path.join(root, 'js/fixture-runtime.js'));
  const baselineBytes = Buffer.from("const runtimeState = 'baseline';\n");
  let patchBytes = Buffer.from([
    'diff --git a/js/fixture-runtime.js b/js/fixture-runtime.js',
    '--- a/js/fixture-runtime.js',
    '+++ b/js/fixture-runtime.js',
    '@@ -1 +1 @@',
    "-const runtimeState = 'release';",
    "+const runtimeState = 'baseline';",
    '',
  ].join('\n'));
  if (mutation?.filesystem === 'patch_creates_extra_file') {
    patchBytes = Buffer.concat([patchBytes, Buffer.from([
      'diff --git a/js/unreviewed.js b/js/unreviewed.js',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/js/unreviewed.js',
      '@@ -0,0 +1 @@',
      "+const unreviewed = 'created';",
      '',
    ].join('\n'))]);
  }
  const patchPath = 'data/climate/operations/fixture-reviewed-rollback.patch.b64';
  write(root, patchPath, canonicalBase64(patchBytes));
  documents.rollbackProof = {
    schema_version: '1.0.0', proof_id: 'fixture-reviewed-runtime-rollback', data_release_id: candidate.data_release_id,
    status: 'reviewed', release_authority: false, deploy_authority: false,
    release_package_pins: [PATHS.runtimeManifest, PATHS.releaseInput, PATHS.allowManifest, PATHS.releaseDiff]
      .sort().map(relative => filePin(root, relative)),
    rollback: {
      strategy: 'restore_pinned_baseline', baseline_commit_sha: '1234567890abcdef1234567890abcdef12345678',
      patch: { path: patchPath, encoding: 'base64', sha256: filePin(root, patchPath).sha256, decoded_sha256: sha256(patchBytes), changed_files: ['js/fixture-runtime.js'] },
      controls: [{ path: 'js/fixture-runtime.js', release_sha256: sha256(releaseBytes), rollback_sha256: sha256(baselineBytes) }],
    },
    review: { status: 'reviewed', builder_id: 'fixture-rollback-builder', reviewer_id: 'fixture-rollback-reviewer', reviewed_at: '2099-01-01T12:00:00Z' },
    calculation_hash: null,
  };
  documents.rollbackProof.calculation_hash = rollbackCalculationHash(documents.rollbackProof);

  if (mutation && mutation.document) {
    if (mutation.path) set(documents[mutation.document], mutation.path, mutation.value);
    else documents[mutation.document] = structuredClone(mutation.value);
  }
  Object.entries(PATHS).forEach(([id, relative]) => write(root, relative, documents[id]));
  if (mutation?.filesystem === 'symlink_runtime_manifest') {
    fs.unlinkSync(path.join(root, PATHS.runtimeManifest));
    fs.symlinkSync(path.join(root, PATHS.releaseInput), path.join(root, PATHS.runtimeManifest));
  } else if (mutation?.filesystem === 'remove_allow_manifest') {
    fs.unlinkSync(path.join(root, PATHS.allowManifest));
  } else if (mutation?.filesystem === 'symlink_release_schema') {
    fs.unlinkSync(path.join(root, SCHEMAS.releaseInput));
    fs.symlinkSync(path.join(root, SCHEMAS.allowManifest), path.join(root, SCHEMAS.releaseInput));
  }
  return { root, baselineBytes };
}

let rejected = 0;
{
  const fixture = makeFixture();
  try {
    const report = inspectReviewedClimateRelease(fixture.root, { baselineReader: () => fixture.baselineBytes, allowFixtureIdentities: true });
    assert.equal(report.status, 'validated', report.errors.map(item => item.code).join(', '));
    assert.equal(report.content_eligible, true);
    assert.equal(report.release_authority, false, 'content validation must not mint release authority');
    assert.equal(report.rollback_proof_passed, true);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
}

for (const testCase of FIXTURE.cases) {
  const fixture = makeFixture(testCase);
  try {
    const report = inspectReviewedClimateRelease(fixture.root, {
      baselineReader: () => fixture.baselineBytes,
      allowFixtureIdentities: testCase.id !== 'placeholder-release-reviewer',
    });
    assert.equal(report.pass, false, `${testCase.id}: adversarial package passed`);
    assert(report.errors.some(item => item.code === testCase.expected_code),
      `${testCase.id}: missing ${testCase.expected_code}; got ${report.errors.map(item => item.code).join(', ')}`);
    rejected += 1;
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
}

const real = inspectReviewedClimateRelease(ROOT);
if (!real.pass) {
  real.errors.forEach(item => process.stderr.write(`[BLOCK] ${item.code} — ${item.subject} — ${item.detail}\n`));
  process.exitCode = 1;
} else if (real.status === 'absent') {
  process.stdout.write(`Reviewed climate release package: PASS (candidate artifacts absent; ${rejected} adversarial fixtures rejected)\n`);
} else {
  process.stdout.write(`Reviewed climate release package: PASS (canonical ALLOW + executable rollback; ${rejected} adversarial fixtures rejected)\n`);
}

module.exports = { report: real };
