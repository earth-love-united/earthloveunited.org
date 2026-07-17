#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  CT40_RESULT_PATH,
  EXPECTED_COUNTS,
  PATCH_PATH,
  PROOF_PATH,
  RAW_EVIDENCE_PATH,
  REVIEW_PATH,
  SUBJECT_PIN_PATHS,
  calculationHash,
  parseJsonNoDuplicateKeys,
  regularNonSymlink,
  sha256,
  validateCt42RuntimeRollbackReview,
} = require('./lib/ct42-runtime-rollback-review');
const {
  calculationHash: proofCalculationHash,
  validateProofDocument,
} = require('./lib/ct42-runtime-rollback-proof');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = 'data/climate/fixtures/ct42-runtime-rollback-review.json';
const FIXTURE_SCHEMA_PATH = 'data/climate/schemas/ct42-runtime-rollback-review.schema.json';

function write(root, relative, value) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, Buffer.isBuffer(value) || typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(root, relative) {
  return parseJsonNoDuplicateKeys(fs.readFileSync(path.join(root, relative), 'utf8'), relative);
}

function set(target, dotted, value) {
  const parts = dotted.split('.');
  const key = parts.pop();
  const owner = parts.reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target);
  owner[key] = structuredClone(value);
}

function get(target, dotted) {
  return dotted.split('.').reduce((node, part) => node[Number.isInteger(Number(part)) ? Number(part) : part], target);
}

function git(root, args) {
  const result = childProcess.spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, `${args.join(' ')}: ${(result.stderr || result.stdout || '').trim()}`);
  return result.stdout.trim();
}

function commit(root, message) {
  git(root, ['add', '.']);
  git(root, ['-c', 'user.name=fixture-runner', '-c', 'user.email=fixture-runner@invalid.example', 'commit', '-qm', message]);
  return git(root, ['rev-parse', 'HEAD']);
}

function pin(root, relative) {
  return { path: relative, sha256: sha256(fs.readFileSync(path.join(root, relative))) };
}

function makeRuntimeCountries() {
  return Array.from({ length: EXPECTED_COUNTS.countries }, (_, index) => ({
    country_id: `fixture:${String(index).padStart(3, '0')}`,
    emissions: { status: index < EXPECTED_COUNTS.reviewedFactualCountries ? 'reviewed_factual' : 'source_gap' },
  }));
}

function makeFixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-ct42-rollback-review-fixture-'));
  git(root, ['init', '-q']);
  write(root, CT40_RESULT_PATH, {
    schema_version: '1.0.0', decision: 'deny', eligible: false, release_authority: false,
    publication_tiers: { factual_display: { status: 'eligible', eligible_count: 2060, blocked_count: 0 } },
  });
  const u = commit(root, 'fixture CT-40 input U');

  write(root, 'data/climate/runtime/candidate-manifest.json', {
    review_status: 'not_reviewed', decision: 'deny', release_eligible: false, production_runtime_release: false,
  });
  write(root, 'data/climate/runtime/country-factual-candidate.json', {
    review_status: 'not_reviewed', production_runtime_release: false, countries: makeRuntimeCountries(),
  });
  write(root, 'data/climate/runtime/published-facts-candidate.json', { fact_count: 2060 });
  write(root, 'data/climate/runtime/rollback-plan.json', { status: 'candidate_only' });
  write(root, PATCH_PATH, 'ZGlmZiAtLWdpdCBhL2ZpeHR1cmUgYi9maXh0dXJlCkBAIC0xICsxIEBACi1vbGQKbmV3Cg==\n');
  for (const relative of SUBJECT_PIN_PATHS.slice(7)) write(root, relative, `'use strict';\n// fixture rollback subject ${relative}\n`);
  const proof = {
    schema_version: '2.3.0', proof_id: 'fixture-neutral-runtime-rollback-proof',
    status: 'built_not_reviewed_browser_gate_required', release_authority: false, deploy_authority: false,
    review: { status: 'not_reviewed', builder_id: 'fixture-rollback-builder', reviewer_id: null, reviewed_at: null, independent_review_required: true },
    candidate: {
      runtime_control_commit: u, review_chain_head: u, review_chain_late_bound: false, review_chain_ct40_sha256: sha256(fs.readFileSync(path.join(root, CT40_RESULT_PATH))),
      candidate_id: 'fixture-ct42', decision: 'deny', decision_scope: 'assessed_climate_release', release_eligible: false, production_runtime_release: false,
      candidate_manifest: pin(root, 'data/climate/runtime/candidate-manifest.json'),
      runtime_data: pin(root, 'data/climate/runtime/country-factual-candidate.json'),
      ct40_result: pin(root, CT40_RESULT_PATH), rollback_plan: pin(root, 'data/climate/runtime/rollback-plan.json'),
    },
    rollback: {
      entity_boundary: { total: 201, retained_natural_earth_polygons: 173, approximate_small_state_points: 28, climate_values: 0, evidence_state: 'withheld_for_all' },
      controls: Array.from({ length: 7 }, (_, index) => ({ path: `fixture/control-${index}` })),
      runtime_dependency_closure: Array.from({ length: 14 }, (_, index) => ({
        path: index === 8 ? 'js/vendor/globe.gl.js' : `fixture/dependency-${index}`,
        source_commit: index === 8 ? null : u,
      })),
      patch: { ...pin(root, PATCH_PATH), decoded_sha256: '5ee3324b0b460543363dbe7b16f941da483058f4dbfe89ed7efe8d3fea704541', changed_files: [
        'index.html', 'css/globe-system.css', 'js/data.js', 'js/globe.js', 'sw.js', 'tools/smoke-test.js',
      ] },
    },
    execution: { browser_gate: { status: 'external_required_not_recorded', release_authority: false, deploy_authority: false } },
    calculation_hash: null,
  };
  proof.calculation_hash = calculationHash(proof);
  write(root, PROOF_PATH, proof);
  const p = commit(root, 'fixture rollback proof P');
  write(root, RAW_EVIDENCE_PATH, {
    schema_version: '1.0.0',
    command: 'fixture browser harness command',
    events: [{ type: 'browser_summary', smoke_passed: 18, smoke_total: 18, stack_lint_issues: 0 }],
  });
  write(root, 'fixture-current-head.txt', 'Review record is intentionally held in memory for the fixture.\n');
  commit(root, 'fixture current HEAD');

  const review = {
    schema_version: '1.0.0', review_id: 'fixture-ct42-rollback-review', status: 'reviewed', release_authority: false, deploy_authority: false,
    subject: {
      ct40_review_commit_sha: u,
      rollback_proof_commit_sha: p,
      proof_calculation_hash: proof.calculation_hash,
      patch_decoded_sha256: proof.rollback.patch.decoded_sha256,
      pins: SUBJECT_PIN_PATHS.map(relative => pin(root, relative)),
    },
      review: { builder_id: 'fixture-rollback-builder', reviewer_id: 'fixture-independent-reviewer', independent: true, reviewed_at: '2026-07-17T12:03:00Z' },
    environment: { origin: 'http://127.0.0.1:4173', browser: 'fixture-browser 1.0', operating_system: 'fixture-os 1.0', service_worker_state: 'fresh_profile', network_scope: 'same_origin_only', executed_at: '2026-07-17T12:01:00Z' },
    observations: {
      recorded_at: '2026-07-17T12:02:00Z',
      raw_evidence: pin(root, RAW_EVIDENCE_PATH),
      materialization: { complete: true, regular_files_only: true, controls: 7, runtime_dependencies: 14 },
      candidate: { review_status: 'not_reviewed', decision: 'deny', release_eligible: false, production_runtime_release: false, countries: 249, reviewed_factual_countries: 206, source_gap_countries: 43, facts: 2060 },
      neutral_runtime: { polygons: 173, small_state_points: 28, entities: 201, climate_values: 0, evidence_state: 'withheld_for_all', surface: null, background: null, candidate_requests: 0, visual_asset_requests: 0, remote_runtime_requests: 0 },
      browser: { canvas_count: 1, smoke_passed: 18, smoke_total: 18, smoke_failed: 0, smoke_critical_failed: 0, stack_lint_issues: 0, horizontal_overflow_320px: 0, minimum_control_target_px: 44, command: 'fixture browser harness command' },
    },
    outcome: { derived_from_observations: true, result: 'pass', release_authority: false, deploy_authority: false, required_next_gate: 'CT-40 allow decision remains separately required.' },
    calculation_hash: null,
  };
  review.calculation_hash = calculationHash(review);
  return { root, review };
}

function verifyFixture() {
  const fixture = readJson(ROOT, FIXTURE_PATH);
  const schema = readJson(ROOT, FIXTURE_SCHEMA_PATH);
  assert.equal(fixture.schema_version, '1.0.0');
  assert.ok(Array.isArray(fixture.mutations) && fixture.mutations.length >= 10, 'fixture must contain adversarial mutations');
  let rejected = 0;
  for (const mutation of fixture.mutations) {
    const context = makeFixtureRoot();
    try {
      const review = structuredClone(context.review);
      if (mutation.phase === 'proof') {
        const proof = readJson(context.root, PROOF_PATH);
        set(proof, mutation.path, mutation.value);
        proof.calculation_hash = calculationHash(proof);
        write(context.root, PROOF_PATH, proof);
        review.subject.pins[0].sha256 = sha256(fs.readFileSync(path.join(context.root, PROOF_PATH)));
      } else {
        set(review, mutation.path, mutation.from ? get(review, mutation.from) : mutation.value);
        if (mutation.after) set(review, mutation.after.path, mutation.after.value);
      }
      review.calculation_hash = calculationHash(review);
      const result = validateCt42RuntimeRollbackReview(context.root, review, { allowFixtureIdentities: true, schema });
      assert.equal(result.pass, false, `${mutation.id}: invalid review was accepted`);
      if (mutation.id === 'review-truthful-failed-observation-still-blocks-gate') {
        assert.ok(result.errors.some(error => error.code === 'review_observations_failed'), 'truthful failed review did not explicitly block the gate');
      }
      rejected += 1;
    } finally {
      fs.rmSync(context.root, { recursive: true, force: true });
    }
  }
  const context = makeFixtureRoot();
  try {
    const baseline = validateCt42RuntimeRollbackReview(context.root, context.review, { allowFixtureIdentities: true, schema });
    assert.equal(baseline.pass, true, `fixture baseline must pass: ${JSON.stringify(baseline.errors)}`);
    const toolPath = path.join(context.root, 'tools', 'rehearse-ct42-runtime-rollback.js');
    fs.renameSync(toolPath, toolPath + '.target');
    fs.symlinkSync(path.basename(toolPath) + '.target', toolPath);
    const symlinkResult = validateCt42RuntimeRollbackReview(context.root, context.review, { allowFixtureIdentities: true, schema });
    assert.equal(symlinkResult.pass, false, 'symlink-substituted subject tool was accepted');
    assert.ok(symlinkResult.errors.some(error => error.code === 'subject_path_not_regular'), 'symlink rejection reason missing');
  } finally {
    fs.rmSync(context.root, { recursive: true, force: true });
  }
  const realProof = readJson(ROOT, PROOF_PATH);
  const proofOptions = {
    expectedPatchSha256: realProof.rollback.patch.sha256,
    allowMissingVendor: !regularNonSymlink(ROOT, 'js/vendor/globe.gl.js'),
  };
  assert.doesNotThrow(() => validateProofDocument(ROOT, realProof, proofOptions),
    'authoritative validator rejected the committed rollback proof');
  const widenedProof = structuredClone(realProof);
  widenedProof.rollback.runtime_resources.surface = 'https://invalid.example/remote-texture.jpg';
  widenedProof.calculation_hash = proofCalculationHash(widenedProof);
  assert.throws(() => validateProofDocument(ROOT, widenedProof, proofOptions),
    'authoritative validator accepted a remote texture semantic widening');
  return rejected;
}

if (process.argv.includes('--self-test')) {
  const rejected = verifyFixture();
  process.stdout.write(`CT-42 rollback review contract self-test: PASS (${rejected} adversarial mutations, a symlink substitution, and an authoritative proof-semantic widening rejected; fixture-only; no review authority)\n`);
} else {
  if (!regularNonSymlink(ROOT, REVIEW_PATH)) {
    process.stderr.write(`CT-42 rollback review: FAIL (required independent review artifact is absent or unsafe: ${REVIEW_PATH}; fail closed)\n`);
    process.exitCode = 1;
  } else {
    try {
      const review = readJson(ROOT, REVIEW_PATH);
      const result = validateCt42RuntimeRollbackReview(ROOT, review);
      if (!result.pass) {
        process.stderr.write(`CT-42 rollback review: FAIL\n${result.errors.map(error => `  ${error.code}: ${error.detail}`).join('\n')}\n`);
        process.exitCode = 1;
      } else {
        process.stdout.write('CT-42 rollback review: PASS (independent review evidence recorded; rollback proof remains non-authorizing)\n');
      }
    } catch (error) {
      process.stderr.write(`CT-42 rollback review: FAIL (review JSON is invalid or unsafe: ${error.message}; fail closed)\n`);
      process.exitCode = 1;
    }
  }
}
