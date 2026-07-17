'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { parseJsonNoDuplicateKeys } = require('./json-schema-lite');
const { calculationHash: primapCalculationHash, canonicalJson } = require('./primap-hist-ingest');
const { same } = require('./json-schema-lite');

const PREPARATION_ID = 'climate-public-beta-data-preparation-v1';
const ALLOCATION_SCHEME = 'elu-opaque-allocation-v1';
const SOURCE_ID = 'primap-hist-2.6.1-final';

const INPUTS = Object.freeze({
  registry: Object.freeze({
    path: 'data/climate/country-registry.json',
    sha256: '51fb321661684a88e80254cd5721ee70d0f52d95587222727fb9e9722e86b075',
  }),
  promotion: Object.freeze({
    path: 'data/climate/releases/primap-hist-2.6.1-factual-display-2026-07-15.json',
    sha256: '129cc563cbad1fa5c71d6953430a8eba510f4c26106d4f6e76cb7cbd11a7e76d',
    calculation_hash: '1301ce57a7f8b9af28fefe9e8fd5507d131f35d689fb30d1da27f6265734decb',
  }),
  review: Object.freeze({
    path: 'data/climate/reviews/primap-hist-2.6.1-factual-display-ct10c-review.json',
    sha256: 'c2f233511db35ff98738a1d7df5b8a3b083009e03a128d9e406f6bd98678cfda',
    calculation_hash: '1993d3489117dc6a4385eeb33cff866c1ad550f5a1db51a87d5ef5180d1cfc5c',
  }),
  sourceRegistry: Object.freeze({
    path: 'data/climate/source-registry.json',
    sha256: 'ae32cc5799a96115d1b8568250638759020ff36cb1b6d1fa6aa032f56d07634d',
  }),
  allocations: Object.freeze({
    path: 'data/climate/fixtures/public-beta-id-allocations.json',
    sha256: '9c28c27e8b24a7fdde495e0f3e67540ee5ed1df68a823670cc740f4328f573ec',
  }),
});

const STATUS = Object.freeze({
  preparation_only: true,
  public_beta_source_rights_reviewed: false,
  public_beta_redistribution_authorized: false,
  independent_beta_data_reviewed: false,
  public_beta_release_authorized: false,
  production_runtime_release: false,
  assessed_production_authority: false,
});

const METRIC = Object.freeze({
  id: 'annual_economy_wide_ghg_excluding_lulucf',
  label: 'Harmonized estimate: economy-wide GHG excluding LULUCF (AR6 GWP100)',
  unit: 'MtCO2e/yr',
  plane: 'harmonized',
  evidence_class: 'harmonized_estimate',
  scenario: 'HISTTP',
  gas_basket: Object.freeze(['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3']),
  sectors: Object.freeze(['national_total_excluding_lulucf']),
  start_year: 2014,
  end_year: 2023,
  latest_year: 2023,
  gwp_convention: 'AR6GWP100',
  lulucf: 'excluded',
  international_bunkers: 'not_specified_for_selected_category',
  uncertainty_status: 'not_provided_in_selected_rows',
});

const LIMITATIONS = Object.freeze([
  'Harmonized estimates are not official Party inventories.',
  'LULUCF is excluded.',
  'Uncertainty bounds are not included.',
  'International-bunker treatment is not asserted from the selected rows.',
  'This factual preparation does not assess commitments, targets, delivery, performance, impact, fairness, or scores.',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashBytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function calculationHash(value) {
  const copy = structuredClone(value);
  delete copy.calculation_hash;
  return hashBytes(canonicalJson(copy));
}

function serialize(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function opaqueFactId(entityId, year) {
  assert(/^elu-e-[a-f0-9]{16}$/.test(entityId), 'opaque entity ID required for fact allocation');
  assert(Number.isInteger(year) && year >= METRIC.start_year && year <= METRIC.end_year, 'fact allocation year outside metric period');
  const domain = `earth-love-united:${ALLOCATION_SCHEME}:fact:${METRIC.id}:${entityId}:${year}`;
  return `elu-f-${hashBytes(domain).slice(0, 16)}`;
}

function readInput(root, descriptor) {
  const bytes = fs.readFileSync(path.join(root, descriptor.path));
  return {
    bytes,
    value: parseJsonNoDuplicateKeys(bytes.toString('utf8'), descriptor.path),
  };
}

function loadPinnedInputs(root) {
  return {
    registry: readInput(root, INPUTS.registry),
    promotion: readInput(root, INPUTS.promotion),
    review: readInput(root, INPUTS.review),
    sourceRegistry: readInput(root, INPUTS.sourceRegistry),
    allocations: readInput(root, INPUTS.allocations),
  };
}

function normalizeInput(bundle, name) {
  const descriptor = INPUTS[name];
  const entry = bundle[name];
  assert(entry && Buffer.isBuffer(entry.bytes), `${name} bytes are required`);
  assert(entry.value && typeof entry.value === 'object', `${name} parsed JSON is required`);
  assert(hashBytes(entry.bytes) === descriptor.sha256, `${name} byte hash mismatch`);
  let parsed;
  try {
    parsed = parseJsonNoDuplicateKeys(entry.bytes.toString('utf8'), entry.path);
  } catch (error) {
    throw new Error(`${name} bytes are not JSON: ${error.message}`);
  }
  assert(same(entry.value, parsed), `${name} parsed value does not match pinned bytes`);
  return parsed;
}

function assertInputSemantics(registry, promotion, review, sourceRegistry, allocations) {
  assert(registry.schema_version === '2.0.0', 'registry schema version drift');
  assert(registry.entity_count === 249 && registry.entities.length === 249, 'registry must contain exactly 249 entities');
  assert(new Set(registry.entities.map(item => item.country_id)).size === 249, 'registry country IDs must be unique');

  assert(promotion.promotion_id === 'ct-10c:primap-hist-2.6.1:economy-wide:2014-2023', 'CT-10C promotion ID drift');
  assert(promotion.calculation_hash === INPUTS.promotion.calculation_hash, 'CT-10C promotion calculation pin mismatch');
  assert(primapCalculationHash(promotion) === INPUTS.promotion.calculation_hash, 'CT-10C promotion calculation hash drift');
  assert(promotion.coverage?.registry_entities === 249, 'CT-10C registry coverage drift');
  assert(promotion.coverage?.promoted_country_series === 206, 'CT-10C series count drift');
  assert(promotion.coverage?.source_unavailable === 43, 'CT-10C gap count drift');
  assert(promotion.coverage?.promoted_observations === 2060, 'CT-10C observation count drift');
  assert(Array.isArray(promotion.series) && promotion.series.length === 206, 'CT-10C must contain 206 series');
  assert(promotion.series.every(series => Array.isArray(series.values) && series.values.length === 10), 'CT-10C series must contain exactly ten observations');
  assert(promotion.release_use_flags?.production_runtime_release === false, 'CT-10C must not grant production runtime release');
  assert(promotion.release_use_flags?.target_or_commitment_assessment === false, 'CT-10C target assessment boundary crossed');
  assert(promotion.release_use_flags?.delivery_assessment === false, 'CT-10C delivery assessment boundary crossed');
  assert(promotion.release_use_flags?.performance_assessment === false, 'CT-10C performance assessment boundary crossed');
  assert(promotion.release_use_flags?.composite_score === false, 'CT-10C composite score boundary crossed');
  assert(promotion.release_use_flags?.normative_climate_score === false, 'CT-10C normative score boundary crossed');

  assert(review.calculation_hash === INPUTS.review.calculation_hash, 'CT-10C review calculation pin mismatch');
  assert(primapCalculationHash(review) === INPUTS.review.calculation_hash, 'CT-10C review calculation hash drift');
  assert(review.decision === 'pass', 'CT-10C review must pass the factual boundary');
  assert(review.reviewer?.independent_of_builder === true, 'CT-10C review independence must be asserted');
  assert(review.reviewer?.reviewer_id !== review.reviewer?.builder_id, 'CT-10C reviewer and builder must differ');
  assert(review.reviewed_inputs?.promotion_sha256 === INPUTS.promotion.sha256, 'CT-10C review does not pin promotion bytes');
  assert(review.reviewed_inputs?.promotion_calculation_hash === INPUTS.promotion.calculation_hash, 'CT-10C review does not pin promotion calculation');
  assert(review.publication_boundary?.factual_display_review_passed === true, 'CT-10C factual display boundary not passed');
  assert(review.publication_boundary?.production_runtime_release_allowed === false, 'CT-10C review crossed production runtime boundary');
  assert(review.publication_boundary?.target_or_commitment_assessment_allowed === false, 'CT-10C review crossed target boundary');
  assert(review.publication_boundary?.delivery_assessment_allowed === false, 'CT-10C review crossed delivery boundary');
  assert(review.publication_boundary?.performance_assessment_allowed === false, 'CT-10C review crossed performance boundary');
  assert(review.publication_boundary?.composite_or_normative_score_allowed === false, 'CT-10C review crossed scoring boundary');

  const source = sourceRegistry.sources?.find(item => item.id === SOURCE_ID);
  assert(source, 'pinned PRIMAP source registry entry missing');
  assert(source.version === '2.6.1 final, 13 March 2025', 'PRIMAP source version drift');
  assert(source.artifact?.sha256 === '7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9', 'PRIMAP raw source hash drift');
  assert(source.licence?.identifier === 'CC-BY-4.0', 'PRIMAP licence identifier drift');
  assert(source.version.includes('13 March 2025'), 'PRIMAP publication date evidence drift');
  assert(source.licence.attribution.includes('retrieved 2026-07-15'), 'PRIMAP retrieval date evidence drift');

  assert(allocations.schema_version === '1.0.0', 'opaque allocation schema version drift');
  assert(allocations.fixture_only === true, 'opaque allocations must remain a preparation fixture');
  assert(allocations.publication_authority === false, 'opaque allocations must grant no publication authority');
  assert(allocations.scheme === ALLOCATION_SCHEME, 'opaque allocation scheme drift');
  assert(Array.isArray(allocations.entity_allocations) && allocations.entity_allocations.length === 249, 'opaque allocation table must contain 249 entities');
  assert(new Set(allocations.entity_allocations.map(item => item.source_entity_id)).size === 249, 'opaque allocation source IDs must be unique');
  assert(new Set(allocations.entity_allocations.map(item => item.entity_id)).size === 249, 'opaque allocated entity IDs must be unique');
  const allocationBySource = new Map(allocations.entity_allocations.map(item => [item.source_entity_id, item.entity_id]));
  for (const entity of registry.entities) {
    assert(/^elu-e-[a-f0-9]{16}$/.test(allocationBySource.get(entity.country_id) || ''), `opaque entity allocation missing: ${entity.country_id}`);
  }
  return source;
}

function pinList(names) {
  return names.map(name => ({
    path: INPUTS[name].path,
    sha256: INPUTS[name].sha256,
  }));
}

function compile(bundle) {
  const registry = normalizeInput(bundle, 'registry');
  const promotion = normalizeInput(bundle, 'promotion');
  const review = normalizeInput(bundle, 'review');
  const sourceRegistry = normalizeInput(bundle, 'sourceRegistry');
  const allocations = normalizeInput(bundle, 'allocations');
  const source = assertInputSemantics(registry, promotion, review, sourceRegistry, allocations);

  const promotionByCountry = new Map(promotion.series.map(series => [series.country_id, series]));
  const allocationByCountry = new Map(allocations.entity_allocations.map(item => [item.source_entity_id, item.entity_id]));
  assert(promotionByCountry.size === 206, 'CT-10C country series IDs must be unique');
  for (const series of promotion.series) {
    const entity = registry.entities.find(item => item.country_id === series.country_id);
    assert(entity, `CT-10C series is outside registry: ${series.country_id}`);
    assert(entity.iso_alpha3 === series.iso_alpha3, `CT-10C identity mismatch: ${series.country_id}`);
  }

  const factualEntities = [];
  const identities = [];
  const lineageFacts = [];
  let factCount = 0;

  registry.entities.forEach(entity => {
    const entityId = allocationByCountry.get(entity.country_id);
    const sourceSeries = promotionByCountry.get(entity.country_id);
    const values = [];

    if (sourceSeries) {
      sourceSeries.values.forEach((point, pointIndex) => {
        const expectedYear = METRIC.start_year + pointIndex;
        assert(point.year === expectedYear, `CT-10C year sequence drift: ${entity.country_id}`);
        assert(typeof point.normalized_value_decimal === 'string', `CT-10C normalized decimal missing: ${point.fact_id}`);
        assert(Number(point.normalized_value_decimal) === point.value_mtco2e, `CT-10C number/decimal drift: ${point.fact_id}`);
        const factId = opaqueFactId(entityId, point.year);
        values.push({
          fact_id: factId,
          year: point.year,
          value_decimal: point.normalized_value_decimal,
        });
        lineageFacts.push({
          fact_id: factId,
          entity_id: entityId,
          source_id: SOURCE_ID,
          source_entity_id: sourceSeries.country_id,
          source_iso_alpha3: sourceSeries.iso_alpha3,
          source_fact_id: point.source_fact_id,
          promoted_fact_id: point.fact_id,
          year: point.year,
          normalized_value_decimal: point.normalized_value_decimal,
          source_locator: structuredClone(sourceSeries.source_locator),
          transformation: {
            input_unit: sourceSeries.source_locator.row_key.unit,
            output_unit: METRIC.unit,
            operation: 'Convert gigagrams to megatonnes by exact decimal division by 1000; retain the pinned CT-10C normalized decimal.',
            rounding: 'none; move the source decimal point three places left using source text and retain source digits, including trailing fractional zeros',
          },
        });
        factCount += 1;
      });
    }

    factualEntities.push({
      entity_id: entityId,
      evidence_state: sourceSeries ? 'factual_series' : 'source_gap',
      gap_reason: sourceSeries ? null : 'source_unavailable',
      observations: values,
    });

    identities.push({
      entity_id: entityId,
      source_entity_id: entity.country_id,
      name: entity.name,
      official_name: entity.official_name,
      common_name: entity.common_name,
      iso_alpha2: entity.iso_alpha2,
      iso_alpha3: entity.iso_alpha3,
      iso_numeric: entity.iso_numeric,
    });
  });

  assert(factCount === 2060, 'compiled fact count must be 2,060');

  const factual = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/public-beta-country-factual.schema.json',
    artifact_kind: 'public_beta_country_factual_preparation',
    preparation_id: PREPARATION_ID,
    status: structuredClone(STATUS),
    input_pins: pinList(['registry', 'promotion', 'review', 'allocations']),
    allocation_scheme: ALLOCATION_SCHEME,
    metric: structuredClone(METRIC),
    limitations: Array.from(LIMITATIONS),
    coverage: {
      entities: 249,
      factual_series: 206,
      source_gaps: 43,
      observations: 2060,
    },
    entities: factualEntities,
    calculation_hash: null,
  };
  factual.calculation_hash = calculationHash(factual);

  const identity = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/public-beta-country-identity.schema.json',
    artifact_kind: 'public_beta_country_identity_preparation',
    preparation_id: PREPARATION_ID,
    status: structuredClone(STATUS),
    input_pins: pinList(['registry', 'allocations']),
    allocation: {
      scheme: ALLOCATION_SCHEME,
      statement: 'Opaque project IDs come from the frozen project allocation table; they are not names, codes, source identifiers, or hashes of those values.',
    },
    identity_source: {
      source_registry_id: registry.source.source_registry_id,
      publisher: registry.source.publisher,
      title: registry.source.title,
      version: registry.source.version,
      source_url: registry.source.source_url,
      retrieval_url: registry.source.retrieval_url,
      source_checksum_sha256: registry.source.checksum_sha256,
      licence_identifier: registry.source.licence.identifier,
      licence_terms_url: registry.source.licence.terms_url,
      attribution: registry.source.licence.attribution,
      no_warranty: registry.source.licence.no_warranty,
      existing_project_review_status: registry.source.licence.review_status,
      public_beta_rights_review_status: 'not_completed',
      public_beta_redistribution_authorized: false,
    },
    coverage: { identities: 249 },
    identities,
    calculation_hash: null,
  };
  identity.calculation_hash = calculationHash(identity);

  const lineage = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/public-beta-fact-lineage.schema.json',
    artifact_kind: 'public_beta_fact_lineage_preparation',
    preparation_id: PREPARATION_ID,
    status: structuredClone(STATUS),
    input_pins: pinList(['promotion', 'review', 'sourceRegistry', 'allocations']),
    promotion_evidence: {
      promotion_id: promotion.promotion_id,
      promotion_calculation_hash: promotion.calculation_hash,
      factual_review_id: review.review_id,
      factual_review_calculation_hash: review.calculation_hash,
      factual_display_review_passed: true,
      production_runtime_release_allowed: false,
    },
    source: {
      source_id: source.id,
      publisher: source.publisher,
      title: source.title,
      version: source.version,
      publication_date: '2025-03-13',
      retrieval_date: '2026-07-15',
      source_url: source.source_url,
      retrieval_url: source.retrieval_url,
      raw_source_sha256: source.artifact.sha256,
      licence_identifier: source.licence.identifier,
      licence_terms_url: source.licence.terms_url,
      attribution: source.licence.attribution,
      transformation_notice: 'Earth Love United selected HISTTP, KYOTOGHG (AR6GWP100), M.0.EL, 2014–2023; converted CO2 gigagrams per year to MtCO2e per year; and separated identity from factual data.',
      existing_project_registry_state: source.approval.state,
      public_beta_rights_review_status: 'not_completed',
      public_beta_redistribution_authorized: false,
    },
    coverage: { facts: 2060 },
    facts: lineageFacts,
    calculation_hash: null,
  };
  lineage.calculation_hash = calculationHash(lineage);

  return { factual, identity, lineage };
}

module.exports = {
  PREPARATION_ID,
  ALLOCATION_SCHEME,
  INPUTS,
  STATUS,
  METRIC,
  LIMITATIONS,
  opaqueFactId,
  hashBytes,
  calculationHash,
  serialize,
  loadPinnedInputs,
  compile,
};
