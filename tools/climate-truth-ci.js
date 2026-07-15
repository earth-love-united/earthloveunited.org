#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const childProcess = require('child_process');
const { evaluateTruthPolicy, resolveRunStatus } = require('./lib/climate-truth-ci-policy');

const ROOT = path.resolve(__dirname, '..');
const STRICT = process.argv.includes('--strict') || process.argv.includes('--require-complete');
const ALLOW_INCOMPLETE = process.argv.includes('--allow-incomplete');
const COMPONENTS = Object.freeze([
  { id: 'CT-01', script: 'tools/check-climate-source-registry.js', required: true },
  { id: 'CT-02', script: 'tools/check-country-evidence.js', required: true },
  { id: 'CT-03', script: 'tools/validate-visual-truth-fixtures.js', required: true },
  { id: 'CT-04', script: 'tools/verify-legacy-country-exit.js', required: true },
  { id: 'CT-04-R', script: 'tools/check-legacy-country-exit-review.js', summary_prefix: 'CT-04-R', required: true },
  { id: 'CT-10', script: 'tools/check-country-emissions-evidence.js', required: true },
  { id: 'CT-10B', script: 'tools/check-primap-economy-wide.js', args: ['--committed-only'], required: true },
  { id: 'CT-10B-R', script: 'tools/check-primap-review-attestation.js', args: ['--committed-only'], summary_prefix: 'PRIMAP CT-10B-R', required: true },
  { id: 'CT-10C', script: 'tools/check-primap-factual-display-promotion.js', required: true },
  { id: 'CT-10C-R', script: 'tools/check-primap-factual-display-review.js', args: ['--committed-only'], summary_prefix: 'PRIMAP CT-10C-R', required: true },
  { id: 'CT-11', script: 'tools/check-major-emitter-ndc-evidence.js', required: true },
  { id: 'CT-12', script: 'tools/check-policy-finance-evidence.js', required: true },
  { id: 'CT-13', script: 'tools/check-country-coverage-gap-queue.js', required: true },
  { id: 'CT-14', script: 'tools/check-top20-primary-source-gap-queue.js', required: false },
  { id: 'CT-16', script: 'tools/check-source-routing-policy.js', required: true },
  { id: 'CT-20', script: 'tools/check-target-comparability.js', required: true },
  { id: 'CT-21', script: 'tools/check-country-delivery-engine.js', required: true },
  { id: 'CT-22', script: 'tools/check-country-profile-compiler.js', required: true },
  { id: 'CT-30', script: 'tools/check-country-view-model.js', required: true },
  { id: 'CT-31', script: 'tools/check-country-ranking.js', required: true },
  { id: 'CT-32', script: 'tools/check-country-card-evidence-model.js', required: true },
  { id: 'CT-33', script: 'tools/check-country-accessibility.js', required: true },
  { id: 'CT-42-DATA-R', script: 'tools/check-climate-factual-runtime-data-review.js', required: true },
  { id: 'CT-42-UI-R', script: 'tools/check-climate-factual-runtime-ui-review.js', required: true },
  { id: 'CT-43-FALLBACK', script: 'tools/check-globe-webgl-fallback.js', required: true },
  { id: 'CT-44-VENDOR', script: 'tools/check-globe-vendor-integrity.js', required: true },
  { id: 'CT-42-CT-40', script: 'tools/check-ct42-ct40-release-review-candidate.js', required: true },
  { id: 'CT-42-ROLLBACK', script: 'tools/check-ct42-runtime-rollback-proof.js', required: true },
  { id: 'CT-40', script: 'tools/check-climate-release-gate.js', required: true },
  { id: 'public-copy', script: 'tools/check-public-copy.js', required: true },
  { id: 'CT-11-generated', script: 'tools/build-major-emitter-ndc-release.js', args: ['--check'], required: false }
]);

function exists(relative) {
  return fs.existsSync(path.join(ROOT, relative));
}

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function fileSha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex');
}

function gitClimateStatus() {
  const run = childProcess.spawnSync('git', ['status', '--porcelain=v1', '--', 'data/climate'], { cwd: ROOT, encoding: 'utf8' });
  return run.status === 0 ? run.stdout.split('\n').filter(Boolean).sort() : [];
}

function runComponent(component) {
  if (!exists(component.script)) return { id: component.id, status: 'missing', required: component.required, script: component.script };
  const run = childProcess.spawnSync(process.execPath, [component.script, ...(component.args || [])], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', LC_ALL: 'C' }
  });
  const output = `${run.stdout || ''}${run.stderr || ''}`.trim();
  const outputLines = output.split('\n').filter(Boolean);
  return {
    id: component.id,
    status: run.status === 0 ? 'passed' : 'failed',
    required: component.required,
    script: component.script,
    exit_code: run.status,
    summary: (component.summary_prefix
      ? outputLines.find(line => line.startsWith(component.summary_prefix))
      : outputLines[0]) || ''
  };
}

function embeddedEnums() {
  const candidates = [
    ['CT-20', 'tools/lib/target-comparability.js'],
    ['CT-40', 'tools/lib/climate-release-gate.js']
  ];
  return candidates.filter(([, file]) => exists(file)).map(([id, file]) => {
    const exported = require(path.join(ROOT, file));
    return { id, values: exported.REASON_CODES };
  });
}

function runtimeInput(missing) {
  const manifestPath = 'data/climate/runtime-manifest.json';
  if (!exists(manifestPath)) {
    missing.push('reviewed-runtime-manifest');
    missing.push('reviewed-release-diff');
    return null;
  }
  const manifest = readJson(manifestPath);
  const runtime = structuredClone(manifest.runtime || {});
  runtime.files = (runtime.file_paths || []).map((filePath) => {
    if (!isRelativePath(filePath) || !exists(filePath)) {
      missing.push(`runtime-file:${filePath}`);
      return { path: String(filePath), content: '' };
    }
    return { path: filePath, content: fs.readFileSync(path.join(ROOT, filePath), 'utf8') };
  });

  const releaseManifestPath = manifest.release_eligibility_manifest;
  const releaseDiffPath = manifest.release_diff;
  if (!isRelativeJson(releaseManifestPath) || !exists(releaseManifestPath)) missing.push('reviewed-release-manifest');
  if (!isRelativeJson(releaseDiffPath) || !exists(releaseDiffPath)) missing.push('reviewed-release-diff');

  const facts = [];
  for (const factPath of manifest.published_fact_files || []) {
    if (!isRelativeJson(factPath) || !exists(factPath)) {
      missing.push(`published-facts:${factPath}`);
      continue;
    }
    const payload = readJson(factPath);
    const payloadFacts = Array.isArray(payload) ? payload : Array.isArray(payload.facts) ? payload.facts : [];
    const artifactSha256 = fileSha256(factPath);
    facts.push(...payloadFacts.map((fact) => ({
      ...fact,
      _artifact_path: factPath,
      _artifact_sha256: artifactSha256
    })));
  }
  const batchAttestations = [];
  for (const attestationPath of manifest.batch_attestation_files || []) {
    if (!isRelativeJson(attestationPath) || !exists(attestationPath)) {
      missing.push(`batch-attestation:${attestationPath}`);
      continue;
    }
    const payload = readJson(attestationPath);
    batchAttestations.push({ ...payload, _path: attestationPath, _file_sha256: fileSha256(attestationPath) });
  }
  let sources = [];
  if (isRelativeJson(manifest.source_registry) && exists(manifest.source_registry)) {
    const registry = readJson(manifest.source_registry);
    sources = registry.sources || [];
  } else missing.push('reviewed-source-registry');

  return {
    methodology_version: manifest.methodology_version,
    runtime,
    release_manifest: isRelativeJson(releaseManifestPath) && exists(releaseManifestPath) ? readJson(releaseManifestPath) : null,
    release_diff: isRelativeJson(releaseDiffPath) && exists(releaseDiffPath) ? readJson(releaseDiffPath) : null,
    facts,
    batch_attestations: batchAttestations,
    sources,
    canonical_reason_codes: readJson('data/climate/schemas/enums.json').reason_codes,
    embedded_reason_enums: embeddedEnums(),
    generated_drift: false
  };
}

function isRelativeJson(value) {
  return isRelativePath(value) && value.endsWith('.json');
}

function isRelativePath(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.split('/').includes('..');
}

const before = gitClimateStatus();
const components = COMPONENTS.map(runComponent);
const after = gitClimateStatus();
const generatedDrift = JSON.stringify(before) !== JSON.stringify(after);
const missing = components.filter((item) => item.status === 'missing' && item.required).map((item) => item.id);
const input = runtimeInput(missing);
let policy = null;
if (input) {
  input.generated_drift = generatedDrift;
  policy = evaluateTruthPolicy(input);
}

const failedComponents = components.filter((item) => item.status === 'failed').map((item) => item.id);
const uniqueMissing = [...new Set(missing)].sort();
const hardFailure = failedComponents.length > 0 || generatedDrift || Boolean(policy && policy.status === 'fail');
const resolved = resolveRunStatus({ hardFailure, missingCount: uniqueMissing.length, strict: STRICT, allowIncomplete: ALLOW_INCOMPLETE, reviewedCandidate: Boolean(input) });
const report = {
  schema_version: '1.0.0',
  mode: STRICT ? 'strict' : ALLOW_INCOMPLETE ? 'allow-incomplete' : 'stack-aware',
  status: resolved.status,
  components,
  missing_required_components: uniqueMissing,
  generated_drift: generatedDrift,
  policy,
  calculation_hash: null
};
report.calculation_hash = hash(report);

for (const item of components) {
  const marker = item.status === 'passed' ? 'PASS' : item.status === 'missing' ? 'MISS' : 'FAIL';
  process.stdout.write(`[${marker}] ${item.id} — ${item.script}${item.summary ? ` — ${item.summary}` : ''}\n`);
}
if (uniqueMissing.length) process.stdout.write(`[INCOMPLETE] missing required stack components: ${uniqueMissing.join(', ')}\n`);
if (policy && policy.failures.length) policy.failures.forEach((item) => process.stdout.write(`[POLICY] ${item.code} — ${item.subject} — ${item.detail}\n`));
process.stdout.write(`[${report.status.toUpperCase()}] climate truth CI ${report.calculation_hash}\n`);
if (resolved.exit_code) process.exitCode = resolved.exit_code;

module.exports = { report };
