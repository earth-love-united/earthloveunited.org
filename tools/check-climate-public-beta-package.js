#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  BETA_PACKAGE_REVIEW_CONTROL_PATHS,
  BETA_REQUIRE_CLOSURE_ROOT_PATHS,
  BETA_TRANSITIVE_DEPENDENCY_PATHS,
  FOUNDATION_DEFERRED_CLOSURE_ROOT_PATHS,
  PACKAGE_SCHEMA_NAMES,
  POST_ACTION_CHECKS,
  PRODUCT_LABEL,
  REVIEWED_RUNTIME_SCHEMA_PATHS,
  REQUIRED_DEPLOYMENT_CONTROL_PATHS,
  REQUIRED_ENGINEERING_PATHS,
  RUNTIME_FILE_NAMES,
  buildRollbackExecution,
  buildRollbackProof,
  buildScopeManifest,
  betaRequireClosure,
  canonicalJson,
  computeReleaseDiff,
  discoverDeploymentControlPaths,
  discoverRollbackTargetPaths,
  evaluateReleaseDiff,
  expectedPublicSurfacePaths,
  inspectRegular,
  laterApprovalPaths,
  rehearseRollbackProof,
  requiredBaPaths,
  rollbackPostTargetPaths,
  runtimeReleasePaths,
  scopeSelfPath,
  sha256Bytes,
  sha256Canonical,
  validateReleaseDiff,
  validateRollbackAgainstPolicy,
  validateRollbackAgainstScope,
  validateRollbackChronology,
  validateRollbackProof,
  validateRollbackReviewRelationship,
  validateRollbackUniverseProjection,
  validateRuntimeManifest,
  validateScopeManifest,
} = require('./lib/climate-public-beta-package');
const {
  auditSchemaDefinition,
  canonicalJsonText,
  parseJsonNoDuplicateKeys,
  validateJsonSchema,
} = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');
const SCHEMAS = Object.freeze({
  runtime: 'data/climate/public-beta/schemas/climate-public-beta-runtime-manifest.schema.json',
  scope: 'data/climate/public-beta/schemas/climate-public-beta-scope-manifest.schema.json',
  diff: 'data/climate/public-beta/schemas/climate-public-beta-release-diff.schema.json',
  rollback: 'data/climate/public-beta/schemas/climate-public-beta-rollback-proof.schema.json',
});
const FIXTURES = 'data/climate/fixtures/climate-public-beta-package-adversarial-fixtures.json';
const FIXTURE_BUILDER_IDENTITY = 'fixture-only-release-builder';

function readJsonFile(filename) {
  const absolute = path.resolve(filename);
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile() && !stat.isSymbolicLink(), `JSON input must be a regular non-symlink file: ${filename}`);
  return parseJsonNoDuplicateKeys(fs.readFileSync(absolute, 'utf8'), filename);
}

function clone(value) {
  return structuredClone(value);
}

function writeFile(root, relative, bytes) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, bytes);
}

function writeIfMissing(root, relative, bytes) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) writeFile(root, relative, bytes);
}

function recalculate(value, field = 'calculation_hash') {
  const output = clone(value);
  output[field] = null;
  output[field] = sha256Canonical(output);
  return output;
}

function assertSchema(value, relative) {
  const schema = readJsonFile(path.join(ROOT, relative));
  const errors = validateJsonSchema(value, schema);
  assert.deepEqual(errors, [], `schema validation failed for ${relative}:\n${errors.join('\n')}`);
}

function assertJsonSchemaLiteSemantics() {
  let cases = 0;
  const schemaPaths = [
    ...PACKAGE_SCHEMA_NAMES.map(name =>
      'data/climate/public-beta/schemas/' + name),
    ...REVIEWED_RUNTIME_SCHEMA_PATHS,
    'data/climate/schemas/public-beta-country-factual.schema.json',
    'data/climate/schemas/public-beta-country-identity.schema.json',
    'data/climate/schemas/public-beta-fact-lineage.schema.json',
  ];
  schemaPaths.forEach(relative => {
    assert.deepEqual(auditSchemaDefinition(readJsonFile(path.join(ROOT, relative))), [],
      'unsupported or malformed schema definition: ' + relative);
  });
  cases += 1;

  const pass = (value, schema, label) => {
    assert.deepEqual(validateJsonSchema(value, schema), [], label);
    cases += 1;
  };
  const reject = (value, schema, pattern, label) => {
    assert.match(validateJsonSchema(value, schema).join('\n'), pattern, label);
    cases += 1;
  };

  pass(3, { oneOf: [{ const: 3 }, { const: 4 }] }, 'oneOf exact match must pass');
  reject(3, { oneOf: [{ type: 'number' }, { minimum: 0 }] }, /exactly one/,
    'overlapping oneOf matches must fail');
  pass('😀', { type: 'string', maxLength: 1 }, 'maxLength must count Unicode code points');
  reject('😀x', { type: 'string', maxLength: 1 }, /maxLength/,
    'maxLength overflow must fail');
  reject(6, { type: 'number', maximum: 5 }, /maximum/,
    'maximum overflow must fail');
  reject(['a', 'extra'], {
    type: 'array',
    prefixItems: [{ const: 'a' }],
    items: false,
  }, /disallowed/, 'items false must reject entries beyond prefixItems');
  pass('fallback', { if: false, then: { const: 'never' }, else: { const: 'fallback' } },
    'boolean-false if must execute else');
  reject('blocked', { not: true }, /forbidden/, 'not true must reject every instance');
  pass('allowed', { not: false }, 'not false must allow every instance');
  reject(6, {
    $defs: { bounded: { type: 'number', minimum: 0 } },
    $ref: '#/$defs/bounded',
    maximum: 5,
  }, /maximum/, '$ref siblings must also be enforced');
  reject({ a: 'wrong' }, {
    type: 'object',
    properties: {},
    additionalProperties: { type: 'number' },
  }, /expected number/, 'schema-valued additionalProperties must be enforced');
  reject({ forbidden: true }, {
    type: 'object',
    properties: { forbidden: false },
    additionalProperties: true,
  }, /disallowed/, 'boolean-false property schemas must be enforced');
  assert.match(auditSchemaDefinition({ type: 'string', silentlyIgnored: true }).join('\n'),
    /unsupported schema keyword/, 'unsupported keywords must fail schema audit');
  cases += 1;
  assert.match(auditSchemaDefinition({ type: 'string', format: 'uri' }).join('\n'),
    /unsupported schema format/, 'unsupported formats must fail schema audit');
  cases += 1;
  assert.throws(() => parseJsonNoDuplicateKeys('{"outer":{"x":1,"x":2}}', 'nested duplicate fixture'),
    /duplicate object member/, 'nested duplicate JSON keys must fail');
  cases += 1;
  assert.throws(() => parseJsonNoDuplicateKeys('{"a":1,"\\u0061":2}', 'escaped duplicate fixture'),
    /duplicate object member/, 'escape-equivalent duplicate JSON keys must fail');
  cases += 1;
  assert.equal(canonicalJsonText({ z: 1, a: { b: 2, a: 1 } }),
    '{\n  "a": {\n    "a": 1,\n    "b": 2\n  },\n  "z": 1\n}\n',
    'canonical JSON text must recursively sort keys and end with one newline');
  cases += 1;
  return cases;
}

function fixtureRuntime(root, betaReleaseId) {
  const releaseRoot = `data/climate/public-beta/runtime/releases/${betaReleaseId}`;
  const files = {};
  Object.entries(RUNTIME_FILE_NAMES).forEach(([key, filename]) => {
    const relative = `${releaseRoot}/${filename}`;
    const bytes = Buffer.from(`FIXTURE ONLY — NO PUBLICATION AUTHORITY — ${key}\n`);
    writeFile(root, relative, bytes);
    files[key] = { path: relative, sha256: sha256Bytes(bytes), bytes: bytes.length };
  });
  return {
    schema_version: '1.0.0',
    manifest_id: `elu-climate-public-beta-runtime-${betaReleaseId}`,
    beta_release_id: betaReleaseId,
    product_tier: 'climate_public_beta',
    product_label: PRODUCT_LABEL,
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
    feedback: {
      approved_feedback_url: 'https://feedback.fixture-only.invalid/report',
      privacy_notice_url: 'https://feedback.fixture-only.invalid/privacy',
    },
    files,
  };
}

function fixtureSurface(betaReleaseId, salt) {
  return expectedPublicSurfacePaths(betaReleaseId).map(relative => ({
    path: relative,
    sha256: sha256Bytes(Buffer.from(`FIXTURE ONLY:${salt}:${relative}`)),
  }));
}

function populateScopeRoot(root, betaReleaseId, manifest) {
  requiredBaPaths(betaReleaseId).forEach(relative => {
    writeIfMissing(root, relative, Buffer.from(`FIXTURE ONLY — NO PUBLICATION AUTHORITY — ${relative}\n`));
  });
  writeFile(root, 'data/climate/public-beta/runtime/runtime-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
}

function copyPins(sourceRoot, destinationRoot, pins) {
  pins.forEach(pin => {
    const source = inspectRegular(sourceRoot, pin.path);
    assert.equal(source.sha256, pin.sha256);
    writeFile(destinationRoot, pin.path, source.buffer);
  });
}

function hostedWithdrawalFixture() {
  return {
    evidence_state: 'plan_only_pending_post_deployment_evidence',
    target_kind: 'project_access_lock',
    rollback_target_reference: 'urn:elu:fixture-only:rollback-target',
    hosting_project: {
      provider: 'cloudflare_pages',
      project_id: 'fixture-only-beta-project',
      production_branch: 'main',
      access_scope: 'project_wide_all_deployments',
      access_policy_reference: 'urn:elu:fixture-only:access-policy-bundle',
      pages_dev_origin: 'https://fixture-only-beta-project.pages.dev',
      deployment_alias_hostname_suffix: '.fixture-only-beta-project.pages.dev',
    },
    level_contracts: [
      {
        publication_level: 'invited_beta',
        intended_origin: 'https://beta.fixture-only.invalid',
        aliases: [
          'https://beta-alias.fixture-only.invalid',
          'https://beta.fixture-only.invalid',
        ],
      },
      {
        publication_level: 'public_beta',
        intended_origin: 'https://public-beta.fixture-only.invalid',
        aliases: [
          'https://public-beta-alias.fixture-only.invalid',
          'https://public-beta.fixture-only.invalid',
        ],
      },
    ],
    deployment_id: null,
    credentialed_steps: [
      'FIXTURE ONLY: authenticate to the fictional beta project control plane.',
      'FIXTURE ONLY: apply the fictional project-wide access lock to every enumerated alias.',
    ],
    access_lock_or_withdraw_action: 'FIXTURE ONLY: enable the fictional project-wide access lock.',
    cache_purge_action: 'FIXTURE ONLY: purge the fictional beta project cache after locking access.',
    expected_unauthorized_statuses: [302, 401, 403],
    allowed_redirect_origins: ['https://access.fixture-only.invalid'],
    rollback_response_target_seconds: 300,
    post_action_checks: [...POST_ACTION_CHECKS],
    production_origin_unchanged_required: true,
    production_baseline_origin: 'https://production.fixture-only.invalid',
    production_baseline_inventory_sha256: sha256Bytes(Buffer.from('FIXTURE ONLY production baseline inventory')),
    remote_execution_evidence: null,
  };
}

function rollbackPolicyFixture() {
  return {
    approved_origins: {
      invited_beta: 'https://beta.fixture-only.invalid',
      public_beta: 'https://public-beta.fixture-only.invalid',
    },
    approved_aliases: {
      invited_beta: [
        'https://beta-alias.fixture-only.invalid',
        'https://beta.fixture-only.invalid',
      ],
      public_beta: [
        'https://public-beta-alias.fixture-only.invalid',
        'https://public-beta.fixture-only.invalid',
      ],
    },
    unauthorized_access_policy: {
      allowed_statuses: [302, 401, 403],
      allowed_redirect_origins: ['https://access.fixture-only.invalid'],
    },
    frozen_thresholds: { rollback_response_target_seconds: 300 },
    rollback_target: {
      type: 'project_access_lock',
      reference: 'urn:elu:fixture-only:rollback-target',
    },
    hosting_project: {
      provider: 'cloudflare_pages',
      project_id: 'fixture-only-beta-project',
      production_branch: 'main',
      access_scope: 'project_wide_all_deployments',
      access_policy_reference: 'urn:elu:fixture-only:access-policy-bundle',
      pages_dev_origin: 'https://fixture-only-beta-project.pages.dev',
      deployment_alias_hostname_suffix: '.fixture-only-beta-project.pages.dev',
    },
    production_baseline_origin: 'https://production.fixture-only.invalid',
    production_baseline_inventory_sha256: sha256Bytes(Buffer.from('FIXTURE ONLY production baseline inventory')),
  };
}

function selfTest() {
  const schemaSemanticsCases = assertJsonSchemaLiteSemantics();
  const fixtureDefinition = readJsonFile(path.join(ROOT, FIXTURES));
  assert.equal(fixtureDefinition.fixture_only, true);
  assert.equal(fixtureDefinition.publication_authority, false);
  assert.equal(fixtureDefinition.assessed_production_authority, false);
  assert(REQUIRED_ENGINEERING_PATHS.includes('tools/check-climate-public-beta-reviewed-data.js'),
    'BA engineering minimum must include the reviewed-data checker');
  assert(REQUIRED_ENGINEERING_PATHS.includes('tools/lib/climate-public-beta-reviewed-data.js'),
    'BA engineering minimum must include the reviewed-data library');
  BETA_TRANSITIVE_DEPENDENCY_PATHS.forEach(relative => {
    assert(REQUIRED_ENGINEERING_PATHS.includes(relative),
      `BA engineering minimum must include transitive dependency: ${relative}`);
  });
  assert.deepEqual(REVIEWED_RUNTIME_SCHEMA_PATHS, [
    'data/climate/schemas/public-beta-reviewed-correction-log.schema.json',
    'data/climate/schemas/public-beta-reviewed-country-factual.schema.json',
    'data/climate/schemas/public-beta-reviewed-country-identity-transform.schema.json',
    'data/climate/schemas/public-beta-reviewed-country-identity.schema.json',
    'data/climate/schemas/public-beta-reviewed-fact-lineage.schema.json',
    'data/climate/schemas/public-beta-reviewed-known-limitations.schema.json',
  ], 'BA schema minimum must include all reviewed runtime schemas');
  const release = fixtureDefinition.fictional_release_ids[0];
  const priorRelease = fixtureDefinition.fictional_release_ids[1];
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'elu-climate-public-beta-package-fixture-'));
  const negativeCases = new Set();
  let positiveCases = 0;

  function mustReject(id, action, pattern) {
    assert(fixtureDefinition.required_negative_case_ids.includes(id), `unregistered adversarial fixture case: ${id}`);
    assert.throws(action, pattern, `adversarial case did not fail closed: ${id}`);
    negativeCases.add(id);
  }

  try {
    const missingClosureRoots = BETA_REQUIRE_CLOSURE_ROOT_PATHS.filter(relative =>
      !fs.existsSync(path.join(ROOT, relative)));
    assert(
      missingClosureRoots.length === 0 ||
      JSON.stringify(missingClosureRoots) === JSON.stringify(FOUNDATION_DEFERRED_CLOSURE_ROOT_PATHS),
      'only the complete foundation-deferred deployment-control closure may be absent',
    );
    const presentClosureRoots = BETA_REQUIRE_CLOSURE_ROOT_PATHS.filter(relative =>
      !missingClosureRoots.includes(relative));
    const requireClosure = betaRequireClosure(ROOT, presentClosureRoots);
    const expectedPresentReviewControls = BETA_PACKAGE_REVIEW_CONTROL_PATHS.filter(relative =>
      fs.existsSync(path.join(ROOT, relative)));
    assert.deepEqual(requireClosure.files, expectedPresentReviewControls,
      'present package-review engineering subjects must equal the relative-require closure');
    BETA_TRANSITIVE_DEPENDENCY_PATHS.forEach(relative => {
      assert(requireClosure.files.includes(relative), `require closure omits transitive dependency: ${relative}`);
    });
    positiveCases += 1;

    const closureRoot = path.join(temp, 'require-closure-root');
    fs.mkdirSync(closureRoot);
    const dynamicRequirePath = 'tools/dynamic-climate-public-beta.js';
    writeFile(closureRoot, dynamicRequirePath,
      Buffer.from("const dependency = './local';\nrequire(dependency);\n"));
    mustReject('require-closure-dynamic-local-dependency', () =>
      betaRequireClosure(closureRoot, [dynamicRequirePath]), /dynamic require/);
    const unresolvedRequirePath = 'tools/unresolved-climate-public-beta.js';
    writeFile(closureRoot, unresolvedRequirePath, Buffer.from("require('./missing-local');\n"));
    mustReject('require-closure-unresolved-local-dependency', () =>
      betaRequireClosure(closureRoot, [unresolvedRequirePath]), /unresolved local dependency/);

    const packageRoot = path.join(temp, 'package-root');
    fs.mkdirSync(packageRoot);
    const runtime = fixtureRuntime(packageRoot, release);
    assertSchema(runtime, SCHEMAS.runtime);
    assert.equal(validateRuntimeManifest(runtime, { root: packageRoot }).file_count, 7);
    positiveCases += 1;

    [
      ['runtime-release-id-too-short', 'a1'],
      ['runtime-release-id-underscore', 'fixture_beta-1'],
      ['runtime-release-id-double-dot', 'fixture..beta-1'],
      ['runtime-release-id-too-long', `a${'b'.repeat(63)}1`],
    ].forEach(([id, invalidReleaseId]) => {
      const invalid = clone(runtime);
      invalid.beta_release_id = invalidReleaseId;
      mustReject(id, () => validateRuntimeManifest(invalid), /invalid beta release ID/);
    });

    const runtimeLevel = clone(runtime);
    runtimeLevel.publication_level = 'invited_beta';
    mustReject('runtime-additional-level-claim', () => validateRuntimeManifest(runtimeLevel), /keys mismatch/);
    const runtimeAuthority = clone(runtime);
    runtimeAuthority.assessed_production_authority = true;
    mustReject('runtime-assessed-authority', () => validateRuntimeManifest(runtimeAuthority), /grant no assessed/);
    const runtimeWithdrawn = clone(runtime);
    runtimeWithdrawn.content_state = 'withdrawn';
    mustReject('runtime-withdrawn-not-publication-eligible', () =>
      validateRuntimeManifest(runtimeWithdrawn), /not publication-eligible/);
    const runtimeSuperseded = clone(runtime);
    runtimeSuperseded.independent_review_state = 'superseded';
    mustReject('runtime-superseded-not-publication-eligible', () =>
      validateRuntimeManifest(runtimeSuperseded), /not publication-eligible/);
    const runtimePath = clone(runtime);
    runtimePath.files.country_factual.path = runtimePath.files.country_factual.path.replace('country-factual.json', 'fact-lineage.json');
    mustReject('runtime-file-path-drift', () => validateRuntimeManifest(runtimePath), /path mismatch/);
    const runtimeBytes = clone(runtime);
    runtimeBytes.files.country_factual.bytes += 1;
    mustReject('runtime-byte-count-drift', () => validateRuntimeManifest(runtimeBytes, { root: packageRoot }), /byte count mismatch/);
    const runtimeHash = clone(runtime);
    runtimeHash.files.country_factual.sha256 = '0'.repeat(64);
    mustReject('runtime-file-hash-drift', () => validateRuntimeManifest(runtimeHash, { root: packageRoot }), /hash mismatch/);
    const symlinkTarget = runtime.files.country_factual.path;
    const symlinkAbsolute = path.join(packageRoot, symlinkTarget);
    const savedBytes = fs.readFileSync(symlinkAbsolute);
    fs.unlinkSync(symlinkAbsolute);
    fs.symlinkSync(path.join(packageRoot, runtime.files.fact_lineage.path), symlinkAbsolute);
    mustReject('runtime-symlink', () => validateRuntimeManifest(runtime, { root: packageRoot }), /symlink/);
    fs.unlinkSync(symlinkAbsolute);
    fs.writeFileSync(symlinkAbsolute, savedBytes);

    populateScopeRoot(packageRoot, release, runtime);
    const scope = buildScopeManifest({
      root: packageRoot,
      betaReleaseId: release,
      releaseBuilderIdentity: FIXTURE_BUILDER_IDENTITY,
    });
    writeFile(packageRoot, scope.self_path, Buffer.from(`${JSON.stringify(scope, null, 2)}\n`));
    assertSchema(scope, SCHEMAS.scope);
    const scopeResult = validateScopeManifest(scope, { root: packageRoot });
    assert.equal(scopeResult.scope_hash, scope.scope_hash);
    assert(!scope.files.some(item => item.path === scope.self_path));
    const scopedPaths = scope.files.map(item => item.path);
    assert.deepEqual(
      REQUIRED_DEPLOYMENT_CONTROL_PATHS.filter(relative => !scopedPaths.includes(relative)),
      [],
      'canonical BA scope must pin every required deployment control',
    );
    assert.deepEqual(
      scopedPaths.filter(relative => relative.startsWith('.github/workflows/')),
      ['.github/workflows/auto-merge.yml', '.github/workflows/ci.yml'],
      'canonical BA scope must pin every repository workflow',
    );
    assert.deepEqual(
      requireClosure.files.filter(relative => !scopedPaths.includes(relative)),
      [],
      'canonical BA scope must pin the complete relative-require closure',
    );
    positiveCases += 1;

    const scopeBuilderPlaceholder = clone(scope);
    scopeBuilderPlaceholder.release_builder_identity = 'unknown';
    mustReject('scope-placeholder-builder-identity', () =>
      validateScopeManifest(recalculate(scopeBuilderPlaceholder, 'scope_hash')),
    /real, explicit, non-placeholder identity/);

    const scopeHash = clone(scope);
    scopeHash.scope_hash = '0'.repeat(64);
    mustReject('scope-hash-drift', () => validateScopeManifest(scopeHash), /scope_hash mismatch/);
    const deploymentControlOmission = clone(scope);
    deploymentControlOmission.files = deploymentControlOmission.files
      .filter(item => item.path !== 'tools/build-deploy.sh');
    mustReject('scope-deployment-control-omission', () => validateScopeManifest(
      recalculate(deploymentControlOmission, 'scope_hash'),
      { root: packageRoot, requireSelfFile: false },
    ), /exact repository bytes/);
    const scopeOmission = clone(scope);
    scopeOmission.files.pop();
    const recalculatedOmission = recalculate(scopeOmission, 'scope_hash');
    mustReject('scope-file-omission', () => validateScopeManifest(recalculatedOmission, { root: packageRoot, requireSelfFile: false }), /exact repository bytes/);
    const extraTool = 'tools/check-extra-climate-public-beta.js';
    writeFile(packageRoot, extraTool, Buffer.from('FIXTURE ONLY\n'));
    mustReject('scope-unexpected-ba-path', () => validateScopeManifest(scope, { root: packageRoot, requireSelfFile: false }), /exact repository bytes/);
    fs.unlinkSync(path.join(packageRoot, extraTool));
    const newDeploymentWorkflow = '.github/workflows/new-public-beta-deploy.yml';
    writeFile(packageRoot, newDeploymentWorkflow, Buffer.from('FIXTURE ONLY — NO DEPLOYMENT AUTHORITY\n'));
    mustReject('scope-new-deployment-workflow-unpinned', () =>
      validateScopeManifest(scope, { root: packageRoot, requireSelfFile: false }), /exact repository bytes/);
    assert(buildScopeManifest({
      root: packageRoot,
      betaReleaseId: release,
      releaseBuilderIdentity: FIXTURE_BUILDER_IDENTITY,
    }).files.some(item => item.path === newDeploymentWorkflow),
    'a newly added workflow must enter the canonical BA scope');
    assert(discoverDeploymentControlPaths(packageRoot).includes(newDeploymentWorkflow),
      'a newly added workflow must enter the independent package-review control inventory');
    fs.unlinkSync(path.join(packageRoot, newDeploymentWorkflow));
    const newDeploymentConfig = 'wrangler.toml';
    writeFile(packageRoot, newDeploymentConfig, Buffer.from('# FIXTURE ONLY — NO DEPLOYMENT AUTHORITY\n'));
    mustReject('scope-new-deployment-config-unpinned', () =>
      validateScopeManifest(scope, { root: packageRoot, requireSelfFile: false }), /exact repository bytes/);
    assert(buildScopeManifest({
      root: packageRoot,
      betaReleaseId: release,
      releaseBuilderIdentity: FIXTURE_BUILDER_IDENTITY,
    }).files.some(item => item.path === newDeploymentConfig),
    'a newly added deployment config must enter the canonical BA scope');
    fs.unlinkSync(path.join(packageRoot, newDeploymentConfig));
    const candidateFixture = 'data/climate/fixtures/public-beta-candidate.json';
    writeFile(packageRoot, candidateFixture, Buffer.from('FIXTURE ONLY\n'));
    mustReject('scope-candidate-path', () => validateScopeManifest(scope, { root: packageRoot, requireSelfFile: false }), /candidate path/);
    fs.unlinkSync(path.join(packageRoot, candidateFixture));
    const scopeSymlink = 'data/climate/fixtures/public-beta-symlink.json';
    fs.symlinkSync(path.join(packageRoot, FIXTURES), path.join(packageRoot, scopeSymlink));
    mustReject('scope-symlink', () => validateScopeManifest(scope, { root: packageRoot, requireSelfFile: false }), /not a regular file/);
    fs.unlinkSync(path.join(packageRoot, scopeSymlink));

    [
      ['scope-reviewed-data-checker-omission', 'tools/check-climate-public-beta-reviewed-data.js'],
      ['scope-reviewed-data-library-omission', 'tools/lib/climate-public-beta-reviewed-data.js'],
      ['scope-reviewed-schema-omission', REVIEWED_RUNTIME_SCHEMA_PATHS[0]],
      ['scope-access-bootstrap-checker-omission', 'tools/check-climate-public-beta-access-bootstrap.js'],
      ['scope-access-bootstrap-library-omission', 'tools/lib/climate-public-beta-access-bootstrap.js'],
      ['scope-access-bootstrap-schema-omission', 'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap.schema.json'],
      ['scope-access-bootstrap-signature-schema-omission', 'data/climate/public-beta/schemas/climate-public-beta-access-bootstrap-signatures.schema.json'],
    ].forEach(([id, relative]) => {
      const absolute = path.join(packageRoot, relative);
      const bytes = fs.readFileSync(absolute);
      fs.unlinkSync(absolute);
      mustReject(id, () => validateScopeManifest(scope, { root: packageRoot, requireSelfFile: false }));
      writeFile(packageRoot, relative, bytes);
    });

    laterApprovalPaths(release).forEach(relative => writeFile(packageRoot, relative, Buffer.from('FIXTURE ONLY LATER AUTHORITY — EXCLUDED\n')));
    writeFile(packageRoot, scope.self_path, Buffer.from(`\n${JSON.stringify(scope, null, 4)}\n`));
    assert.equal(validateScopeManifest(scope, { root: packageRoot }).scope_hash, scope.scope_hash);
    positiveCases += 1;

    const currentSurface = fixtureSurface(release, 'current');
    const priorSurface = fixtureSurface(priorRelease, 'prior');
    const initialDiff = computeReleaseDiff({ betaReleaseId: release, currentFiles: currentSurface });
    assertSchema(initialDiff, SCHEMAS.diff);
    assert.equal(validateReleaseDiff(initialDiff).change_count, 14);
    assert.equal(evaluateReleaseDiff(initialDiff, { currentFiles: currentSurface }).status, 'pass');
    positiveCases += 1;
    const laterDiff = computeReleaseDiff({
      betaReleaseId: release,
      previousBetaReleaseId: priorRelease,
      currentFiles: currentSurface,
      previousFiles: priorSurface,
    });
    assertSchema(laterDiff, SCHEMAS.diff);
    assert.equal(evaluateReleaseDiff(laterDiff, { currentFiles: currentSurface, previousFiles: priorSurface }).status, 'pass');
    positiveCases += 1;

    const diffHash = clone(initialDiff);
    diffHash.calculation_hash = '0'.repeat(64);
    mustReject('diff-hash-drift', () => validateReleaseDiff(diffHash), /calculation_hash mismatch/);
    const diffUnsorted = clone(initialDiff);
    [diffUnsorted.changes[0], diffUnsorted.changes[1]] = [diffUnsorted.changes[1], diffUnsorted.changes[0]];
    mustReject('diff-unsorted', () => validateReleaseDiff(recalculate(diffUnsorted)), /strictly sorted/);
    const initialPrior = clone(initialDiff);
    initialPrior.previous_beta_release_id = priorRelease;
    mustReject('diff-initial-has-prior', () => validateReleaseDiff(recalculate(initialPrior)), /no-prior-beta/);
    const reused = clone(laterDiff);
    reused.previous_beta_release_id = release;
    mustReject('diff-later-reuses-release-id', () => validateReleaseDiff(recalculate(reused)), /cannot reuse/);
    const immutableModified = clone(laterDiff);
    const immutableEntry = immutableModified.changes.find(item => runtimeReleasePaths(release).includes(item.path));
    immutableEntry.change = 'modified';
    immutableEntry.before_sha256 = sha256Bytes(Buffer.from('FIXTURE ONLY prior immutable byte'));
    mustReject('diff-immutable-path-modified', () => validateReleaseDiff(recalculate(immutableModified)), /immutable beta release path/);
    const driftedSurface = clone(currentSurface);
    driftedSurface[0].sha256 = sha256Bytes(Buffer.from('FIXTURE ONLY drifted surface byte'));
    mustReject('diff-snapshot-hash-drift', () => evaluateReleaseDiff(laterDiff, { currentFiles: driftedSurface, previousFiles: priorSurface }), /does not match/);

    const rollbackReleaseRoot = path.join(temp, 'rollback-release');
    const rollbackBaselineRoot = path.join(temp, 'rollback-baseline');
    const firstWorkRoot = path.join(temp, 'rollback-work-first');
    fs.mkdirSync(rollbackReleaseRoot);
    fs.mkdirSync(rollbackBaselineRoot);
    fs.mkdirSync(firstWorkRoot);
    const postTarget = new Set(rollbackPostTargetPaths(release));
    const rollbackReleasePins = scope.files
      .filter(item => !postTarget.has(item.path))
      .map(item => ({ path: item.path, sha256: item.sha256, git_mode: '100644' }));
    copyPins(packageRoot, rollbackReleaseRoot, rollbackReleasePins);
    assert.deepEqual(discoverRollbackTargetPaths(rollbackReleaseRoot, release),
      rollbackReleasePins.map(item => item.path),
      'pre-proof target discovery must reproduce the exact rollback release pin set');
    writeFile(rollbackBaselineRoot, '.github/CODEOWNERS', Buffer.from('FIXTURE ONLY PRIOR CODEOWNERS\n'));
    fs.chmodSync(path.join(rollbackBaselineRoot, '.github/CODEOWNERS'), 0o755);
    const baselinePin = inspectRegular(rollbackBaselineRoot, '.github/CODEOWNERS');
    const rollbackBaselinePins = [{ path: baselinePin.path, sha256: baselinePin.sha256, git_mode: baselinePin.git_mode }];
    const releaseCommitSha = 'f'.repeat(40);
    const baselineCommitSha = 'e'.repeat(40);
    const execution = buildRollbackExecution({
      betaReleaseId: release,
      releaseCommitSha,
      baselineCommitSha,
      releaseFiles: rollbackReleasePins,
      baselineFiles: rollbackBaselinePins,
      releaseRoot: rollbackReleaseRoot,
      baselineRoot: rollbackBaselineRoot,
      workRoot: firstWorkRoot,
      evidenceId: 'fixture-only-local-rehearsal',
      executedAt: '2000-01-01T00:00:00.000Z',
      executorIdentity: 'fixture-only-rollback-executor',
      executionSubjectIdentity: FIXTURE_BUILDER_IDENTITY,
    });
    const rollback = buildRollbackProof({
      betaReleaseId: release,
      releaseCommitSha,
      baselineCommitSha,
      releaseFiles: rollbackReleasePins,
      baselineFiles: rollbackBaselinePins,
      execution,
      hostedWithdrawal: hostedWithdrawalFixture(),
      proofCreatedAt: '2000-01-01T00:00:01.000Z',
    });
    const rollbackPath = `data/climate/public-beta/governance/releases/${release}/rollback-proof.json`;
    writeFile(packageRoot, rollbackPath, Buffer.from(`${JSON.stringify(rollback, null, 2)}\n`));
    const finalScope = buildScopeManifest({
      root: packageRoot,
      betaReleaseId: release,
      releaseBuilderIdentity: FIXTURE_BUILDER_IDENTITY,
    });
    writeFile(packageRoot, finalScope.self_path, Buffer.from(`${JSON.stringify(finalScope, null, 2)}\n`));
    assertSchema(rollback, SCHEMAS.rollback);
    assert.equal(validateRollbackProof(rollback).status, 'pass');
    assert.equal(validateRollbackUniverseProjection(rollback, {
      releaseFiles: rollbackReleasePins,
      baselineFiles: rollbackBaselinePins,
      requireGitModes: true,
    }).status, 'pass');
    assert.equal(validateRollbackAgainstPolicy(rollback, rollbackPolicyFixture(), 'both').status, 'pass');
    const invitedOnlyRollback = clone(rollback);
    invitedOnlyRollback.hosted_withdrawal.level_contracts =
      invitedOnlyRollback.hosted_withdrawal.level_contracts.filter(item => item.publication_level === 'invited_beta');
    assert.equal(validateRollbackAgainstPolicy(recalculate(invitedOnlyRollback),
      rollbackPolicyFixture(), 'invited_beta').status, 'pass');
    const publicOnlyRollback = clone(rollback);
    publicOnlyRollback.hosted_withdrawal.level_contracts =
      publicOnlyRollback.hosted_withdrawal.level_contracts.filter(item => item.publication_level === 'public_beta');
    assert.equal(validateRollbackAgainstPolicy(recalculate(publicOnlyRollback),
      rollbackPolicyFixture(), 'public_beta').status, 'pass');
    assert.equal(validateRollbackChronology(rollback, {
      reviewObservedAt: '2000-01-01T00:00:02.000Z',
      approvalTimestamps: ['2000-01-01T00:00:03.000Z', '2000-01-01T00:00:04.000Z'],
    }).status, 'pass');
    assert.equal(validateRollbackReviewRelationship(rollback, {
      producer_identity: FIXTURE_BUILDER_IDENTITY,
      reviewer_identity: 'fixture-only-independent-rollback-reviewer',
      reviewer_role: 'beta_rollback_reviewer',
      observed_at: '2000-01-01T00:00:02.000Z',
    }).status, 'pass');
    assert.equal(validateRollbackAgainstScope(rollback, finalScope, { root: packageRoot }).status, 'pass');
    const replayWorkRoot = path.join(temp, 'rollback-work-replay');
    fs.mkdirSync(replayWorkRoot);
    assert.equal(rehearseRollbackProof(rollback, {
      releaseRoot: rollbackReleaseRoot,
      baselineRoot: rollbackBaselineRoot,
      workRoot: replayWorkRoot,
    }).status, 'pass');
    positiveCases += 1;

    const rollbackHash = clone(rollback);
    rollbackHash.calculation_hash = '0'.repeat(64);
    mustReject('rollback-calculation-hash-drift', () => validateRollbackProof(rollbackHash), /calculation_hash mismatch/);
    const executionHash = clone(rollback);
    executionHash.repository_rollback.execution.evidence_sha256 = '0'.repeat(64);
    mustReject('rollback-execution-hash-drift', () => validateRollbackProof(recalculate(executionHash)), /evidence hash mismatch/);
    const restoredDrift = clone(rollback);
    restoredDrift.repository_rollback.execution.restored_tree_hash = '0'.repeat(64);
    mustReject('rollback-restored-tree-drift', () => validateRollbackProof(recalculate(restoredDrift)), /restore the exact baseline/);
    const reviewClaim = clone(rollback);
    reviewClaim.review = { status: 'reviewed' };
    mustReject('rollback-unexpected-review-claim', () => validateRollbackProof(recalculate(reviewClaim)), /keys mismatch/);
    const deploymentEvidence = clone(rollback);
    deploymentEvidence.hosted_withdrawal.deployment_id = 'fixture-deployment-id';
    mustReject('rollback-deployment-evidence-in-plan', () => validateRollbackProof(recalculate(deploymentEvidence)), /must not invent/);
    const aliasOmission = clone(rollback);
    aliasOmission.hosted_withdrawal.level_contracts[0].aliases = ['https://different.fixture-only.invalid'];
    mustReject('rollback-alias-omission', () => validateRollbackProof(recalculate(aliasOmission)), /include.*intended origin/);
    const legacyTargetDefinition = clone(rollback);
    legacyTargetDefinition.repository_rollback.target_definition = 'canonical_beta_commit_a_pre_rollback_proof_tree_v1';
    mustReject('rollback-target-definition-legacy-drift', () =>
      validateRollbackProof(recalculate(legacyTargetDefinition)), /target definition is invalid/);

    writeFile(rollbackBaselineRoot, 'prior-baseline-only.txt', Buffer.from('FIXTURE ONLY prior baseline file'));
    const priorBaselineOnly = inspectRegular(rollbackBaselineRoot, 'prior-baseline-only.txt');
    const completeBaselineProjection = [...rollbackBaselinePins, {
      path: priorBaselineOnly.path,
      sha256: priorBaselineOnly.sha256,
      git_mode: priorBaselineOnly.git_mode,
    }];
    mustReject('rollback-baseline-existing-path-omitted', () => validateRollbackUniverseProjection(rollback, {
      releaseFiles: rollbackReleasePins,
      baselineFiles: completeBaselineProjection,
      requireGitModes: true,
    }), /exact complete baseline projection/);
    fs.unlinkSync(path.join(rollbackBaselineRoot, 'prior-baseline-only.txt'));
    const baselineModeDrift = clone(rollbackBaselinePins);
    baselineModeDrift[0].git_mode = baselineModeDrift[0].git_mode === '100755' ? '100644' : '100755';
    mustReject('rollback-baseline-git-mode-drift', () => validateRollbackUniverseProjection(rollback, {
      releaseFiles: rollbackReleasePins,
      baselineFiles: baselineModeDrift,
      requireGitModes: true,
    }), /exact complete baseline projection/);
    const baselineHashDrift = clone(rollbackBaselinePins);
    baselineHashDrift[0].sha256 = '0'.repeat(64);
    mustReject('rollback-baseline-projection-hash-drift', () => validateRollbackUniverseProjection(rollback, {
      releaseFiles: rollbackReleasePins,
      baselineFiles: baselineHashDrift,
      requireGitModes: true,
    }), /exact complete baseline projection/);

    const targetEnumDrift = rollbackPolicyFixture();
    targetEnumDrift.rollback_target.type = 'project_wide_access_lock';
    mustReject('rollback-policy-target-enum-drift', () =>
      validateRollbackAgainstPolicy(rollback, targetEnumDrift, 'both'), /not canonical/);
    const targetReferenceDrift = rollbackPolicyFixture();
    targetReferenceDrift.rollback_target.reference = 'urn:elu:fixture-only:different-target';
    mustReject('rollback-policy-target-reference-drift', () =>
      validateRollbackAgainstPolicy(rollback, targetReferenceDrift, 'both'), /target reference differs/);
    const hostingProjectIdDrift = rollbackPolicyFixture();
    hostingProjectIdDrift.hosting_project.project_id = 'different-beta-project';
    hostingProjectIdDrift.hosting_project.pages_dev_origin = 'https://different-beta-project.pages.dev';
    hostingProjectIdDrift.hosting_project.deployment_alias_hostname_suffix = '.different-beta-project.pages.dev';
    mustReject('rollback-policy-hosting-project-id-drift', () =>
      validateRollbackAgainstPolicy(rollback, hostingProjectIdDrift, 'both'), /hosting project ID differs/);
    const hostingProviderDrift = rollbackPolicyFixture();
    hostingProviderDrift.hosting_project.provider = 'other_provider';
    mustReject('rollback-policy-hosting-provider-drift', () =>
      validateRollbackAgainstPolicy(rollback, hostingProviderDrift, 'both'), /provider must be Cloudflare Pages/);
    const productionBranchDrift = rollbackPolicyFixture();
    productionBranchDrift.hosting_project.production_branch = 'other';
    mustReject('rollback-policy-hosting-production-branch-drift', () =>
      validateRollbackAgainstPolicy(rollback, productionBranchDrift, 'both'), /production branch must be main/);
    const accessScopeDrift = rollbackPolicyFixture();
    accessScopeDrift.hosting_project.access_scope = 'single_deployment';
    mustReject('rollback-policy-hosting-access-scope-drift', () =>
      validateRollbackAgainstPolicy(rollback, accessScopeDrift, 'both'), /access scope must cover/);
    const pagesDevOriginDrift = rollbackPolicyFixture();
    pagesDevOriginDrift.hosting_project.pages_dev_origin = 'https://other-project.pages.dev';
    mustReject('rollback-policy-pages-dev-origin-drift', () =>
      validateRollbackAgainstPolicy(rollback, pagesDevOriginDrift, 'both'), /pages.dev origin must bind/);
    const accessPolicyReferenceDrift = rollbackPolicyFixture();
    accessPolicyReferenceDrift.hosting_project.access_policy_reference = 'urn:elu:fixture-only:different-access-policy-bundle';
    mustReject('rollback-policy-access-reference-drift', () =>
      validateRollbackAgainstPolicy(rollback, accessPolicyReferenceDrift, 'both'), /access policy reference differs/);
    const deploymentAliasSuffixDrift = rollbackPolicyFixture();
    deploymentAliasSuffixDrift.hosting_project.deployment_alias_hostname_suffix = '.different-beta-project.pages.dev';
    mustReject('rollback-policy-deployment-alias-suffix-drift', () =>
      validateRollbackAgainstPolicy(rollback, deploymentAliasSuffixDrift, 'both'), /hostname suffix must bind/);
    const originDrift = rollbackPolicyFixture();
    originDrift.approved_origins.invited_beta = 'https://different-beta.fixture-only.invalid';
    mustReject('rollback-policy-origin-drift', () =>
      validateRollbackAgainstPolicy(rollback, originDrift, 'both'), /origin differs/);
    const policyAliasDrift = rollbackPolicyFixture();
    policyAliasDrift.approved_aliases.invited_beta = ['https://beta.fixture-only.invalid'];
    mustReject('rollback-policy-alias-drift', () =>
      validateRollbackAgainstPolicy(rollback, policyAliasDrift, 'both'), /aliases differ/);
    const l2Omission = clone(rollback);
    l2Omission.hosted_withdrawal.level_contracts.pop();
    mustReject('rollback-policy-l2-contract-omitted', () =>
      validateRollbackAgainstPolicy(recalculate(l2Omission), rollbackPolicyFixture(), 'both'), /coverage differs/);
    const denialDrift = rollbackPolicyFixture();
    denialDrift.unauthorized_access_policy.allowed_statuses = [401, 403];
    mustReject('rollback-policy-denial-status-drift', () =>
      validateRollbackAgainstPolicy(rollback, denialDrift, 'both'), /denial statuses differ/);
    const redirectDrift = rollbackPolicyFixture();
    redirectDrift.unauthorized_access_policy.allowed_redirect_origins = [];
    mustReject('rollback-policy-redirect-drift', () =>
      validateRollbackAgainstPolicy(rollback, redirectDrift, 'both'), /redirect policy differs/);
    const responseDrift = rollbackPolicyFixture();
    responseDrift.frozen_thresholds.rollback_response_target_seconds = 301;
    mustReject('rollback-policy-response-target-drift', () =>
      validateRollbackAgainstPolicy(rollback, responseDrift, 'both'), /response target differs/);
    const productionOriginDrift = rollbackPolicyFixture();
    productionOriginDrift.production_baseline_origin = 'https://different-production.fixture-only.invalid';
    mustReject('rollback-policy-production-origin-drift', () =>
      validateRollbackAgainstPolicy(rollback, productionOriginDrift, 'both'), /baseline origin differs/);
    const productionHashDrift = rollbackPolicyFixture();
    productionHashDrift.production_baseline_inventory_sha256 = '0'.repeat(64);
    mustReject('rollback-policy-production-hash-drift', () =>
      validateRollbackAgainstPolicy(rollback, productionHashDrift, 'both'), /inventory hash differs/);

    const placeholderExecutor = clone(rollback);
    placeholderExecutor.repository_rollback.execution.executor_identity = 'unknown';
    mustReject('rollback-placeholder-executor-identity', () =>
      validateRollbackProof(recalculate(placeholderExecutor)), /executor identity.*real, explicit/);
    const placeholderSubject = clone(rollback);
    placeholderSubject.repository_rollback.execution.execution_subject_identity = 'placeholder';
    mustReject('rollback-placeholder-subject-identity', () =>
      validateRollbackProof(recalculate(placeholderSubject)), /subject identity.*real, explicit/);
    const proofBeforeExecution = clone(rollback);
    proofBeforeExecution.created_at = '1999-12-31T23:59:59.000Z';
    mustReject('rollback-proof-before-execution', () =>
      validateRollbackProof(recalculate(proofBeforeExecution)), /must not occur after/);
    mustReject('rollback-review-before-proof', () => validateRollbackChronology(rollback, {
      reviewObservedAt: '2000-01-01T00:00:00.500Z',
    }), /after proof creation/);
    mustReject('rollback-approval-before-review', () => validateRollbackChronology(rollback, {
      reviewObservedAt: '2000-01-01T00:00:02.000Z',
      approvalTimestamps: ['2000-01-01T00:00:01.500Z'],
    }), /must not predate/);
    mustReject('rollback-reviewer-not-independent', () => validateRollbackReviewRelationship(rollback, {
      producer_identity: FIXTURE_BUILDER_IDENTITY,
      reviewer_identity: FIXTURE_BUILDER_IDENTITY,
      reviewer_role: 'beta_rollback_reviewer',
      observed_at: '2000-01-01T00:00:02.000Z',
    }), /must be independent/);

    const candidateRollback = clone(rollback);
    candidateRollback.repository_rollback.release_files[0].path = 'data/climate/runtime/country-factual-candidate.json';
    mustReject('rollback-candidate-path', () => validateRollbackProof(recalculate(candidateRollback)), /candidate path/);
    const scopePinDrift = clone(finalScope);
    scopePinDrift.files.find(item => item.path === rollbackPath).sha256 = '0'.repeat(64);
    const recalculatedScopePinDrift = recalculate(scopePinDrift, 'scope_hash');
    mustReject('rollback-external-scope-pin-drift', () =>
      validateRollbackAgainstScope(rollback, recalculatedScopePinDrift, { root: packageRoot }),
    /exact repository bytes|rollback-proof bytes/);
    const alternateProof = clone(rollback);
    alternateProof.hosted_withdrawal.cache_purge_action += ' Alternate valid-looking instruction.';
    const recalculatedAlternateProof = recalculate(alternateProof);
    mustReject('rollback-scope-pinned-proof-substitution', () =>
      validateRollbackAgainstScope(recalculatedAlternateProof, finalScope, { root: packageRoot }),
    /differs from the exact scope-pinned/);
    const releaseMutationPath = rollbackReleasePins[0].path;
    const releaseMutationBytes = fs.readFileSync(path.join(rollbackReleaseRoot, releaseMutationPath));
    fs.appendFileSync(path.join(rollbackReleaseRoot, releaseMutationPath), Buffer.from('FIXTURE ONLY MUTATION\n'));
    const mutationWork = path.join(temp, 'rollback-work-mutation');
    fs.mkdirSync(mutationWork);
    mustReject('rollback-release-tree-byte-drift', () => rehearseRollbackProof(rollback, {
      releaseRoot: rollbackReleaseRoot,
      baselineRoot: rollbackBaselineRoot,
      workRoot: mutationWork,
    }), /hash mismatch/);
    fs.writeFileSync(path.join(rollbackReleaseRoot, releaseMutationPath), releaseMutationBytes);

    const symlinkBaselineRoot = path.join(temp, 'rollback-baseline-symlink');
    fs.mkdirSync(path.join(symlinkBaselineRoot, '.github'), { recursive: true });
    fs.symlinkSync(path.join(rollbackReleaseRoot, '.github/CODEOWNERS'), path.join(symlinkBaselineRoot, '.github/CODEOWNERS'));
    const symlinkWork = path.join(temp, 'rollback-work-symlink');
    fs.mkdirSync(symlinkWork);
    mustReject('rollback-baseline-symlink', () => rehearseRollbackProof(rollback, {
      releaseRoot: rollbackReleaseRoot,
      baselineRoot: symlinkBaselineRoot,
      workRoot: symlinkWork,
    }), /symlink/);

    assert.deepEqual([...negativeCases].sort(), [...fixtureDefinition.required_negative_case_ids].sort(),
      'adversarial fixture declaration and executed cases drifted');
    return {
      status: 'pass',
      fixture_only: true,
      publication_authority: false,
      positive_cases: positiveCases,
      fail_closed_cases: negativeCases.size,
      schema_semantics_cases: schemaSemanticsCases,
      components: ['runtime_manifest', 'ba_scope', 'release_diff', 'repository_rollback', 'hosted_withdrawal_plan'],
    };
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function parseArgs(argv) {
  const values = { mode: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--self-test') {
      assert(values.mode === null, 'choose exactly one package-check mode');
      values.mode = 'self-test';
      continue;
    }
    const modes = {
      '--runtime-manifest': 'runtime',
      '--scope-manifest': 'scope',
      '--release-diff': 'diff',
      '--rollback-proof': 'rollback',
      '--rehearse-rollback': 'rehearse',
    };
    if (modes[arg]) {
      assert(values.mode === null, 'choose exactly one package-check mode');
      values.mode = modes[arg];
      values.input = argv[++index];
      assert(values.input, `${arg} requires a path`);
      continue;
    }
    const options = {
      '--root': 'root',
      '--current-snapshot': 'currentSnapshot',
      '--previous-snapshot': 'previousSnapshot',
      '--release-root': 'releaseRoot',
      '--baseline-root': 'baselineRoot',
      '--work-root': 'workRoot',
      '--bound-scope-manifest': 'boundScopeManifest',
    };
    assert(options[arg], `unknown argument: ${arg}`);
    values[options[arg]] = argv[++index];
    assert(values[options[arg]], `${arg} requires a path`);
  }
  assert(values.mode, 'usage: check-climate-public-beta-package.js --self-test | --runtime-manifest <file> --root <repo> | --scope-manifest <file> --root <repo> | --release-diff <file> --current-snapshot <file> [--previous-snapshot <file>] | --rollback-proof <file> --bound-scope-manifest <file> --root <repo> | --rehearse-rollback <file> --bound-scope-manifest <file> --root <repo> --release-root <dir> --baseline-root <dir> --work-root <empty-dir>');
  return values;
}

function snapshotValue(filename) {
  const value = readJsonFile(filename);
  return Array.isArray(value) ? value : value.files;
}

function main(argv) {
  const options = parseArgs(argv);
  if (options.mode === 'self-test') return selfTest();
  const value = readJsonFile(options.input);
  if (options.mode === 'runtime') {
    assert(options.root, '--runtime-manifest requires --root');
    assertSchema(value, SCHEMAS.runtime);
    return validateRuntimeManifest(value, { root: options.root });
  }
  if (options.mode === 'scope') {
    assert(options.root, '--scope-manifest requires --root');
    assertSchema(value, SCHEMAS.scope);
    return validateScopeManifest(value, { root: options.root });
  }
  if (options.mode === 'diff') {
    assert(options.currentSnapshot, '--release-diff requires --current-snapshot');
    assertSchema(value, SCHEMAS.diff);
    return evaluateReleaseDiff(value, {
      currentFiles: snapshotValue(options.currentSnapshot),
      previousFiles: options.previousSnapshot ? snapshotValue(options.previousSnapshot) : [],
    });
  }
  if (options.mode === 'rollback') {
    assert(options.boundScopeManifest && options.root, '--rollback-proof requires --bound-scope-manifest and --root');
    assertSchema(value, SCHEMAS.rollback);
    const scope = readJsonFile(options.boundScopeManifest);
    assertSchema(scope, SCHEMAS.scope);
    validateRollbackProof(value);
    return validateRollbackAgainstScope(value, scope, { root: options.root });
  }
  assert(options.boundScopeManifest && options.root && options.releaseRoot && options.baselineRoot && options.workRoot,
    '--rehearse-rollback requires --bound-scope-manifest, --root, --release-root, --baseline-root, and --work-root');
  assertSchema(value, SCHEMAS.rollback);
  const scope = readJsonFile(options.boundScopeManifest);
  assertSchema(scope, SCHEMAS.scope);
  validateRollbackAgainstScope(value, scope, { root: options.root });
  return rehearseRollbackProof(value, {
    releaseRoot: options.releaseRoot,
    baselineRoot: options.baselineRoot,
    workRoot: options.workRoot,
  });
}

if (require.main === module) {
  try {
    const result = main(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`Climate Public Beta package check failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs, selfTest };
