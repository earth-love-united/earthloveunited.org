#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  INPUTS,
  STATUS,
  METRIC,
  opaqueFactId,
  hashBytes,
  calculationHash,
  serialize,
  loadPinnedInputs,
  compile,
} = require('./lib/climate-public-beta-data');
const { parseJsonNoDuplicateKeys, same, validateJsonSchema } = require('./lib/json-schema-lite');

const ROOT = path.resolve(__dirname, '..');
const FIXTURE_PATH = 'data/climate/fixtures/public-beta-data.json';
const SCHEMA_PATHS = Object.freeze({
  factual: 'data/climate/schemas/public-beta-country-factual.schema.json',
  identity: 'data/climate/schemas/public-beta-country-identity.schema.json',
  lineage: 'data/climate/schemas/public-beta-fact-lineage.schema.json',
});

const IDENTITY_KEYS = new Set([
  'country_id',
  'name',
  'official_name',
  'common_name',
  'iso',
  'iso_alpha2',
  'iso_alpha3',
  'iso_numeric',
  'flag',
  'flag_emoji',
  'source_entity_id',
  'source_fact_id',
  'promoted_fact_id',
]);

const ASSESSED_KEYS = new Set([
  'assessment',
  'score',
  'composite_score',
  'normative_score',
  'performance',
  'delivery',
  'target',
  'commitment',
  'ambition',
  'fairness',
  'impact',
  'impact_band',
  'rank',
  'ordinal',
  'leader',
  'laggard',
  'on_track',
]);

function json(relativePath) {
  return parseJsonNoDuplicateKeys(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), relativePath);
}

function clone(value) {
  return structuredClone(value);
}

function walk(value, visit, at = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${at}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    visit(key, child, `${at}.${key}`);
    walk(child, visit, `${at}.${key}`);
  }
}

function collectStrings(value, output = new Set()) {
  if (typeof value === 'string') output.add(value);
  else if (Array.isArray(value)) value.forEach(item => collectStrings(item, output));
  else if (value && typeof value === 'object') Object.values(value).forEach(item => collectStrings(item, output));
  return output;
}

function validateStatus(name, artifact) {
  assert(same(artifact.status, STATUS), `${name} authorization boundary crossed`);
}

function validateNoFactualIdentity(factual, inputs) {
  walk(factual, key => {
    assert(!IDENTITY_KEYS.has(key), `identity field leaked into factual artifact: ${key}`);
  });

  const factualStrings = collectStrings(factual);
  const forbidden = new Set();
  for (const entity of inputs.registry.value.entities) {
    [
      entity.country_id,
      entity.name,
      entity.official_name,
      entity.common_name,
      entity.iso_alpha2,
      entity.iso_alpha3,
      entity.iso_numeric,
      entity.flag_emoji,
    ].filter(Boolean).forEach(value => forbidden.add(value));
  }
  for (const series of inputs.promotion.value.series) {
    forbidden.add(series.country_id);
    forbidden.add(series.iso_alpha3);
    series.values.forEach(point => {
      forbidden.add(point.fact_id);
      forbidden.add(point.source_fact_id);
    });
  }
  for (const token of forbidden) {
    assert(!factualStrings.has(token), `identity value leaked into factual artifact: ${token}`);
  }
}

function validateNoAssessment(factual) {
  walk(factual, key => {
    assert(!ASSESSED_KEYS.has(key), `forbidden assessed field in factual artifact: ${key}`);
  });
}

function validateSchema(name, artifact, schema) {
  const errors = validateJsonSchema(artifact, schema);
  assert.equal(errors.length, 0, `${name} schema validation failed: ${errors.slice(0, 5).join('; ')}`);
}

function validateCompiled(output, inputs, schemas) {
  const { factual, identity, lineage } = output;
  validateStatus('factual', factual);
  validateStatus('identity', identity);
  validateStatus('lineage', lineage);
  assert.equal(identity.identity_source.public_beta_rights_review_status, 'not_completed', 'identity authorization boundary crossed');
  assert.equal(identity.identity_source.public_beta_redistribution_authorized, false, 'identity authorization boundary crossed');
  assert.equal(lineage.source.public_beta_rights_review_status, 'not_completed', 'lineage authorization boundary crossed');
  assert.equal(lineage.source.public_beta_redistribution_authorized, false, 'lineage authorization boundary crossed');

  assert.equal(factual.entities.length, 249, 'factual entity count drift');
  const observationCount = factual.entities.reduce((sum, entity) => sum + entity.observations.length, 0);
  assert.equal(observationCount, 2060, 'factual observation count drift');
  assert.equal(identity.identities.length, 249, 'identity count drift');
  assert.equal(lineage.facts.length, 2060, 'lineage fact count drift');

  validateNoFactualIdentity(factual, inputs);
  validateNoAssessment(factual);

  const registry = inputs.registry.value;
  const promotion = inputs.promotion.value;
  const allocationByCountry = new Map(inputs.allocations.value.entity_allocations.map(item => [item.source_entity_id, item.entity_id]));
  const promotionByCountry = new Map(promotion.series.map(series => [series.country_id, series]));
  const lineageByFact = new Map(lineage.facts.map(fact => [fact.fact_id, fact]));
  assert.equal(lineageByFact.size, 2060, 'lineage fact IDs must be unique');
  assert.equal(new Set(factual.entities.map(entity => entity.entity_id)).size, 249, 'factual entity IDs must be unique');

  let factOrdinal = 0;
  registry.entities.forEach((registryEntity, entityOrdinal) => {
    const entity = factual.entities[entityOrdinal];
    const identityRow = identity.identities[entityOrdinal];
    const expectedEntityId = allocationByCountry.get(registryEntity.country_id);
    assert.equal(entity.entity_id, expectedEntityId, 'opaque entity allocation drift');
    assert.deepEqual(identityRow, {
      entity_id: expectedEntityId,
      source_entity_id: registryEntity.country_id,
      name: registryEntity.name,
      official_name: registryEntity.official_name,
      common_name: registryEntity.common_name,
      iso_alpha2: registryEntity.iso_alpha2,
      iso_alpha3: registryEntity.iso_alpha3,
      iso_numeric: registryEntity.iso_numeric,
    }, `identity mapping drift at entity ordinal ${entityOrdinal}`);

    const sourceSeries = promotionByCountry.get(registryEntity.country_id);
    if (!sourceSeries) {
      assert.equal(entity.evidence_state, 'source_gap', `gap state drift at entity ordinal ${entityOrdinal}`);
      assert.equal(entity.gap_reason, 'source_unavailable', `gap reason drift at entity ordinal ${entityOrdinal}`);
      assert.equal(entity.observations.length, 0, `gap observations drift at entity ordinal ${entityOrdinal}`);
      return;
    }

    assert.equal(entity.evidence_state, 'factual_series', `factual state drift at entity ordinal ${entityOrdinal}`);
    assert.equal(entity.gap_reason, null, `factual gap reason drift at entity ordinal ${entityOrdinal}`);
    assert.equal(entity.observations.length, 10, `factual series length drift at entity ordinal ${entityOrdinal}`);
    sourceSeries.values.forEach((sourcePoint, pointIndex) => {
      const observation = entity.observations[pointIndex];
      const expectedFactId = opaqueFactId(expectedEntityId, sourcePoint.year);
      assert.equal(observation.fact_id, expectedFactId, 'opaque fact allocation drift');
      assert.equal(observation.year, sourcePoint.year, 'factual year drift');
      assert.equal(observation.value_decimal, sourcePoint.normalized_value_decimal, 'factual value drift');

      const fact = lineageByFact.get(expectedFactId);
      assert(fact, `lineage missing for ${expectedFactId}`);
      assert.equal(fact.entity_id, expectedEntityId, 'lineage entity join drift');
      assert.equal(fact.source_id, 'primap-hist-2.6.1-final', 'lineage source drift');
      assert.equal(fact.source_entity_id, sourceSeries.country_id, 'lineage source entity drift');
      assert.equal(fact.source_iso_alpha3, sourceSeries.iso_alpha3, 'lineage source alpha-3 drift');
      assert.equal(fact.source_fact_id, sourcePoint.source_fact_id, 'lineage source fact drift');
      assert.equal(fact.promoted_fact_id, sourcePoint.fact_id, 'lineage promoted fact drift');
      assert.equal(fact.year, sourcePoint.year, 'lineage year drift');
      assert.equal(fact.normalized_value_decimal, sourcePoint.normalized_value_decimal, 'lineage value drift');
      assert.deepEqual(fact.source_locator, sourceSeries.source_locator, 'lineage source locator drift');
      assert.equal(fact.transformation.rounding, 'none; move the source decimal point three places left using source text and retain source digits, including trailing fractional zeros', 'lineage rounding drift');
      factOrdinal += 1;
    });
  });
  assert.equal(factOrdinal, 2060, 'cross-artifact fact count drift');

  assert.equal(factual.coverage.entities, 249, 'factual coverage entity drift');
  assert.equal(factual.coverage.factual_series, 206, 'factual coverage series drift');
  assert.equal(factual.coverage.source_gaps, 43, 'factual coverage gap drift');
  assert.equal(factual.coverage.observations, 2060, 'factual coverage observation drift');
  assert.deepEqual(factual.metric, METRIC, 'factual metric drift');

  assert.equal(factual.calculation_hash, calculationHash(factual), 'factual calculation hash drift');
  assert.equal(identity.calculation_hash, calculationHash(identity), 'identity calculation hash drift');
  assert.equal(lineage.calculation_hash, calculationHash(lineage), 'lineage calculation hash drift');

  validateSchema('factual', factual, schemas.factual);
  validateSchema('identity', identity, schemas.identity);
  validateSchema('lineage', lineage, schemas.lineage);
}

function recompute(artifact) {
  artifact.calculation_hash = calculationHash(artifact);
}

function applyMutation(operation, output, inputs) {
  const inputByteMutations = {
    change_registry_bytes: 'registry',
    change_promotion_bytes: 'promotion',
    change_review_bytes: 'review',
    change_source_registry_bytes: 'sourceRegistry',
    change_allocations_bytes: 'allocations',
  };
  if (inputByteMutations[operation]) {
    const inputName = inputByteMutations[operation];
    inputs[inputName].bytes = Buffer.concat([inputs[inputName].bytes, Buffer.from('\n')]);
    return;
  }
  if (operation === 'add_factual_identity_name') {
    output.factual.entities[0].name = output.identity.identities[0].name;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_entity_with_source_id') {
    output.factual.entities[0].entity_id = output.identity.identities[0].source_entity_id;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_entity_with_identity_hash') {
    const sourceId = output.identity.identities[0].source_entity_id;
    const derived = crypto.createHash('sha256').update(sourceId).digest('hex').slice(0, 16);
    output.factual.entities[0].entity_id = `elu-e-${derived}`;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_entity_with_name_hash') {
    const name = output.identity.identities[0].name;
    const derived = crypto.createHash('sha256').update(name).digest('hex').slice(0, 16);
    output.factual.entities[0].entity_id = `elu-e-${derived}`;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_entity_with_alpha_hash') {
    const alpha3 = output.identity.identities[0].iso_alpha3;
    const derived = crypto.createHash('sha256').update(alpha3).digest('hex').slice(0, 16);
    output.factual.entities[0].entity_id = `elu-e-${derived}`;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_entity_with_name_encoding') {
    const name = output.identity.identities[0].name;
    const encoded = Buffer.from(name).toString('hex').padEnd(16, '0').slice(0, 16);
    output.factual.entities[0].entity_id = `elu-e-${encoded}`;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_entity_with_alpha_encoding') {
    const alpha3 = output.identity.identities[0].iso_alpha3;
    const encoded = Buffer.from(alpha3).toString('hex').padEnd(16, '0').slice(0, 16);
    output.factual.entities[0].entity_id = `elu-e-${encoded}`;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_fact_with_source_fact_id') {
    const entity = output.factual.entities.find(item => item.observations.length > 0);
    entity.observations[0].fact_id = output.lineage.facts[0].source_fact_id;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_fact_with_source_fact_hash') {
    const entity = output.factual.entities.find(item => item.observations.length > 0);
    const derived = crypto.createHash('sha256').update(output.lineage.facts[0].source_fact_id).digest('hex').slice(0, 16);
    entity.observations[0].fact_id = `elu-f-${derived}`;
    recompute(output.factual);
  } else if (operation === 'replace_opaque_fact_with_source_fact_encoding') {
    const entity = output.factual.entities.find(item => item.observations.length > 0);
    const encoded = Buffer.from(output.lineage.facts[0].source_fact_id).toString('hex').slice(0, 16);
    entity.observations[0].fact_id = `elu-f-${encoded}`;
    recompute(output.factual);
  } else if (operation === 'remove_factual_entity') {
    output.factual.entities.pop();
    recompute(output.factual);
  } else if (operation === 'remove_factual_observation') {
    output.factual.entities.find(item => item.observations.length > 0).observations.pop();
    recompute(output.factual);
  } else if (operation === 'change_factual_value') {
    output.factual.entities.find(item => item.observations.length > 0).observations[0].value_decimal = '999999.0000';
    recompute(output.factual);
  } else if (operation === 'swap_identity_entity_ids') {
    const first = output.identity.identities[0].entity_id;
    output.identity.identities[0].entity_id = output.identity.identities[1].entity_id;
    output.identity.identities[1].entity_id = first;
    recompute(output.identity);
  } else if (operation === 'change_lineage_entity_join') {
    output.lineage.facts[0].entity_id = output.identity.identities[1].entity_id;
    recompute(output.lineage);
  } else if (operation === 'duplicate_lineage_fact_id') {
    output.lineage.facts[0].fact_id = output.lineage.facts[1].fact_id;
    recompute(output.lineage);
  } else if (operation === 'change_lineage_value') {
    output.lineage.facts[0].normalized_value_decimal = '999999.0000';
    recompute(output.lineage);
  } else if (operation === 'add_assessed_score') {
    output.factual.entities[0].score = 100;
    recompute(output.factual);
  } else if (operation === 'authorize_source_rights') {
    output.factual.status.public_beta_source_rights_reviewed = true;
    output.factual.status.public_beta_redistribution_authorized = true;
    recompute(output.factual);
  } else if (operation === 'change_factual_calculation_hash') {
    output.factual.calculation_hash = '0'.repeat(64);
  } else if (operation === 'change_identity_calculation_hash') {
    output.identity.calculation_hash = '0'.repeat(64);
  } else if (operation === 'change_lineage_calculation_hash') {
    output.lineage.calculation_hash = '0'.repeat(64);
  } else {
    throw new Error(`unknown fixture mutation: ${operation}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  assert(args.length === 0 || (args.length === 1 && args[0] === '--self-test'), 'usage: node tools/check-climate-public-beta-data.js [--self-test]');
  const fixture = json(FIXTURE_PATH);
  assert.equal(fixture.fixture_only, true, 'beta data fixture must remain fixture-only');
  assert.equal(fixture.publication_authority, false, 'beta data fixture must grant no publication authority');
  const schemas = Object.fromEntries(Object.entries(SCHEMA_PATHS).map(([name, file]) => [name, json(file)]));
  const inputs = loadPinnedInputs(ROOT);

  assert.equal(hashBytes(inputs.registry.bytes), fixture.expected.inputs.registry_sha256, 'fixture registry pin drift');
  assert.equal(hashBytes(inputs.promotion.bytes), fixture.expected.inputs.promotion_sha256, 'fixture promotion pin drift');
  assert.equal(hashBytes(inputs.review.bytes), fixture.expected.inputs.review_sha256, 'fixture review pin drift');
  assert.equal(hashBytes(inputs.sourceRegistry.bytes), fixture.expected.inputs.source_registry_sha256, 'fixture source-registry pin drift');
  assert.equal(hashBytes(inputs.allocations.bytes), fixture.expected.inputs.allocations_sha256, 'fixture allocations pin drift');
  assert.equal(fixture.expected.inputs.registry_sha256, INPUTS.registry.sha256, 'compiler/fixture registry pin disagreement');
  assert.equal(fixture.expected.inputs.promotion_sha256, INPUTS.promotion.sha256, 'compiler/fixture promotion pin disagreement');
  assert.equal(fixture.expected.inputs.review_sha256, INPUTS.review.sha256, 'compiler/fixture review pin disagreement');
  assert.equal(fixture.expected.inputs.source_registry_sha256, INPUTS.sourceRegistry.sha256, 'compiler/fixture source-registry pin disagreement');
  assert.equal(fixture.expected.inputs.allocations_sha256, INPUTS.allocations.sha256, 'compiler/fixture allocations pin disagreement');

  const output = compile(inputs);
  validateCompiled(output, inputs, schemas);
  const second = compile(loadPinnedInputs(ROOT));
  assert.deepEqual(second, output, 'public-beta data compile is not deterministic');

  for (const name of ['factual', 'identity', 'lineage']) {
    assert.equal(output[name].calculation_hash, fixture.expected.outputs[name].calculation_hash, `${name} golden calculation hash drift`);
    assert.equal(hashBytes(serialize(output[name])), fixture.expected.outputs[name].serialized_sha256, `${name} golden serialized hash drift`);
  }

  for (const mutation of fixture.mutations) {
    const changedInputs = loadPinnedInputs(ROOT);
    const changedOutput = clone(output);
    applyMutation(mutation.operation, changedOutput, changedInputs);
    const escaped = mutation.expected_error.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (mutation.operation.endsWith('_bytes')) {
      assert.throws(() => compile(changedInputs), new RegExp(escaped, 'i'), mutation.id);
    } else {
      assert.throws(() => validateCompiled(changedOutput, changedInputs, schemas), new RegExp(escaped, 'i'), mutation.id);
    }
  }

  console.log(`Climate Public Beta data preparation: PASS (249 opaque entities; 206 factual series; 43 explicit gaps; 2,060 opaque facts; 3 separated artifacts; ${fixture.mutations.length} adversarial mutations; rights/review/release authority remain false)`);
}

try {
  main();
} catch (error) {
  console.error(`Climate Public Beta data preparation: FAIL — ${error.message}`);
  process.exit(1);
}
