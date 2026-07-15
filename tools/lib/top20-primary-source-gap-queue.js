'use strict';

const crypto = require('node:crypto');

const RELEASE_ID = 'ct-14-top20-primary-source-gap-queue-2026-07-15';
const CREATED_AT = '2026-07-15T00:00:00Z';
const METRIC = 'annual_economy_wide_ghg_excluding_lulucf';
const UNIT = 'MtCO2e/yr';
const SOURCE_IDS = Object.freeze({
  ndc: 'unfccc-ndc-registry-continuous-2026-07-15',
  inventory: [
    'unfccc-btr-continuous-2026-07-15',
    'unfccc-nir-crt-2026-cycle',
    'unfccc-ter-continuous-2026-07-15',
  ],
});
const GROUP_ORDER = Object.freeze(['scope', 'base_year', 'coverage', 'conditionality', 'methodology']);
const MISSING_STATES = new Set(['not_reported', 'not_reviewed', 'source_unavailable', 'non_comparable', 'stale', 'conflicting']);
const FIELD_REASON = Object.freeze({
  gases: 'gas_basket_missing', lulucf: 'lulucf_treatment_missing', sectors: 'sector_coverage_missing',
  geography: 'geographic_coverage_missing', reference_year: 'reference_year_missing',
  reference_value: 'reference_value_missing', bau_vintage: 'bau_vintage_missing',
  bau_target_value: 'bau_target_value_missing', gwp_convention: 'gwp_convention_missing',
  article6_treatment: 'article6_treatment_missing', trajectory: 'trajectory_missing',
  intensity_denominator: 'intensity_denominator_missing',
  intensity_denominator_projection: 'intensity_denominator_projection_missing',
  bau_scenario: 'bau_scenario_missing', condition: 'conditionality_missing',
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
}
function hashJson(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function assert(condition, message) { if (!condition) throw new Error(message); }
function reasons(values) { return [...new Set(values.filter(Boolean))].sort(); }
function requiredFields(component, group) {
  if (group === 'scope') return ['gases', 'lulucf'];
  if (group === 'coverage') return ['sectors', 'geography'];
  if (group === 'conditionality') return ['condition'];
  if (group === 'base_year') {
    if (component.target_type === 'bau') return ['bau_vintage', 'bau_target_value'];
    return ['reference_year', 'reference_value'];
  }
  const fields = ['gwp_convention', 'article6_treatment'];
  if (component.target_type === 'trajectory') fields.push('trajectory');
  if (component.target_type === 'intensity') fields.push('intensity_denominator', 'intensity_denominator_projection');
  if (component.target_type === 'bau') fields.push('bau_scenario');
  return fields;
}

function compileGroup(components, group) {
  if (!components.length) {
    const generic = group === 'scope' ? ['gases', 'lulucf']
      : group === 'base_year' ? ['reference_year', 'reference_value']
        : group === 'coverage' ? ['sectors', 'geography']
          : group === 'conditionality' ? ['condition']
            : ['gwp_convention', 'article6_treatment'];
    return { status: 'not_started', required_fields: generic, missing_fields: generic, withheld_fields: [], reason_codes: ['source_missing', 'source_not_reviewed'] };
  }
  const required = [];
  const missing = [];
  const withheld = [];
  const reasonCodes = [];
  for (const component of components) {
    for (const field of requiredFields(component, group)) {
      if (!required.includes(field)) required.push(field);
      if (field === 'condition') {
        if (component.condition === 'not_stated') {
          if (!missing.includes(field)) missing.push(field);
          reasonCodes.push(FIELD_REASON[field]);
        } else {
          if (!withheld.includes(field)) withheld.push(field);
          reasonCodes.push('licence_not_approved', 'value_withheld');
        }
        continue;
      }
      const audit = component.field_audit[field];
      if (!audit || MISSING_STATES.has(audit.evidence_state)) {
        if (!missing.includes(field)) missing.push(field);
        reasonCodes.push(...(audit?.reason_codes || [FIELD_REASON[field]]));
        continue;
      }
      if (audit.release_state === 'withheld') {
        if (!withheld.includes(field)) withheld.push(field);
        reasonCodes.push(...audit.reason_codes);
      }
    }
  }
  const orderedRequired = required.sort();
  const orderedMissing = missing.sort();
  const orderedWithheld = withheld.filter(field => !missing.includes(field)).sort();
  return {
    status: orderedMissing.length ? 'incomplete' : orderedWithheld.length ? 'present_but_withheld' : 'complete',
    required_fields: orderedRequired,
    missing_fields: orderedMissing,
    withheld_fields: orderedWithheld,
    reason_codes: reasons(reasonCodes),
  };
}

function requirement(role, status, sourceIds, sourceDocumentIds, reasonCodes) {
  const definitions = {
    official_inventory: {
      required_document: 'Latest official Party inventory submission with gas, sector, LULUCF, GWP, boundary, and methodology metadata for 2023 or the latest available year',
      source_owner: { primary: 'Party national inventory authority', registry: 'UNFCCC secretariat' },
    },
    active_ndc: {
      required_document: 'Latest active Party NDC submission and official registry metadata',
      source_owner: { primary: 'Submitting Party government', registry: 'UNFCCC secretariat' },
    },
    target_methodology: {
      required_document: 'Official Party target text and methodology sufficient to reproduce scope, baseline, coverage, conditionality, and accounting treatment',
      source_owner: { primary: 'Submitting Party government', registry: 'UNFCCC secretariat' },
    },
  };
  return {
    role, ...definitions[role], acceptable_source_registry_ids: sourceIds,
    evidence_status: status, source_document_ids: sourceDocumentIds.sort(), reason_codes: reasons(reasonCodes),
  };
}

function compile({ runtime, audit, sourceRegistry, inputPins }) {
  assert(runtime.ranking?.selection?.metric === METRIC, 'reviewed annual-emissions ranking required');
  assert(runtime.ranking?.selection?.period?.start_year === 2023 && runtime.ranking.selection.period.end_year === 2023, '2023 ranking required');
  assert(runtime.ranking?.ranked?.length >= 20, 'top-20 ranking unavailable');
  const knownSources = new Set(sourceRegistry.sources.map(source => source.id));
  [SOURCE_IDS.ndc, ...SOURCE_IDS.inventory].forEach(id => assert(knownSources.has(id), `source registry missing ${id}`));
  const auditDocuments = new Map(audit.documents.map(document => [document.source_document_id, document]));
  const entities = runtime.ranking.ranked.slice(0, 20).map((ranked, index) => {
    assert(ranked.ordinal === index + 1, 'top-20 must have unique sequential ranks');
    const country = runtime.countries.find(item => item.country_id === ranked.country_id);
    assert(country?.emissions?.status === 'reviewed_factual', `${ranked.country_id} factual evidence unavailable`);
    const documents = audit.documents.filter(document => document.country_id === ranked.country_id);
    const ndcs = documents.filter(document => document.document_type === 'ndc');
    const indcs = documents.filter(document => document.document_type === 'indc');
    const components = audit.target_components.filter(component => component.country_id === ranked.country_id);
    const ndcStatus = ndcs.length ? 'metadata_only_in_review' : indcs.length ? 'legacy_indc_only' : 'source_missing';
    const targetStatus = components.length ? 'field_presence_in_review' : 'source_missing';
    const missingGroups = Object.fromEntries(GROUP_ORDER.map(group => [group, compileGroup(components, group)]));
    const allReasons = reasons([
      ...Object.values(missingGroups).flatMap(group => group.reason_codes),
      ...(documents.length ? ['licence_not_approved', 'source_unavailable', 'independent_review_required', 'value_withheld'] : ['source_missing', 'source_not_reviewed']),
      ...(indcs.length && !ndcs.length ? ['target_not_found', 'party_status_not_reviewed'] : []),
    ]);
    return {
      priority: index + 1,
      country_id: ranked.country_id,
      iso_alpha3: country.iso_alpha3,
      name: country.name,
      reviewed_2023_factual_rank: ranked.ordinal,
      reviewed_2023_emissions: { value: country.emissions.latest.value, value_decimal: country.emissions.latest.value_decimal, unit: UNIT, fact_id: country.emissions.latest.fact_id },
      current_evidence_status: components.length ? 'metadata_only_in_review' : 'primary_source_audit_not_started',
      document_requirements: [
        requirement('official_inventory', 'source_missing', SOURCE_IDS.inventory, [], ['source_missing', 'source_not_reviewed', 'licence_not_approved']),
        requirement('active_ndc', ndcStatus, [SOURCE_IDS.ndc], ndcs.map(document => document.source_document_id), ndcs.length ? ['source_unavailable', 'licence_not_approved', 'independent_review_required', 'value_withheld'] : indcs.length ? ['target_not_found', 'party_status_not_reviewed', 'source_unavailable', 'independent_review_required'] : ['source_missing', 'source_not_reviewed', 'licence_not_approved']),
        requirement('target_methodology', targetStatus, [SOURCE_IDS.ndc], documents.map(document => document.source_document_id), components.length ? ['source_unavailable', 'licence_not_approved', 'independent_review_required', 'value_withheld'] : ['source_missing', 'source_not_reviewed', 'licence_not_approved']),
      ],
      field_completeness: missingGroups,
      fail_closed_reason_codes: allReasons,
      assessment_gate: {
        commitment_assessed: false, target_assessed: false, delivery_assessed: false,
        performance_assessed: false, score: null, release_eligible: false,
      },
      allowed_uses: { evidence_collection_prioritization: true, factual_emissions_context: true, target_claims: false, commitment_claims: false, performance_claims: false, scoring: false, production_runtime: false },
    };
  });
  const output = {
    schema_version: '1.0.0', queue_id: RELEASE_ID, created_at: CREATED_AT,
    review_status: 'not_reviewed', release_eligible: false, production_runtime_release: false,
    methodology: {
      ranking_basis: 'Reviewed 2023 harmonized economy-wide GHG excluding LULUCF (AR6 GWP100), descending magnitude with competition ties',
      queue_rule: 'First 20 ranked entities; evidence gaps are derived only from committed CT-11 metadata and CT-01 source decisions',
      no_network_acquisition: true, no_new_approvals: true, no_normalized_target_values: true,
    },
    inputs: inputPins,
    source_owners: {
      official_inventory: { source_registry_ids: SOURCE_IDS.inventory, primary: 'Party national inventory authority', registry: 'UNFCCC secretariat' },
      ndc_and_target: { source_registry_ids: [SOURCE_IDS.ndc], primary: 'Submitting Party government', registry: 'UNFCCC secretariat' },
    },
    coverage: {
      ranked_entities: 20,
      ct11_countries_with_metadata: entities.filter(entity => entity.current_evidence_status === 'metadata_only_in_review').length,
      countries_without_ct11_primary_source_audit: entities.filter(entity => entity.current_evidence_status === 'primary_source_audit_not_started').length,
      official_inventory_documents_available: 0,
      active_ndc_metadata_entities: entities.filter(entity => entity.document_requirements[1].evidence_status === 'metadata_only_in_review').length,
      legacy_indc_only_entities: entities.filter(entity => entity.document_requirements[1].evidence_status === 'legacy_indc_only').length,
      release_eligible_entities: 0,
    },
    entities,
    prohibited_outputs: ['normalized target values', 'commitment status', 'delivery status', 'performance status', 'impact bands', 'climate scores', 'production runtime facts'],
  };
  output.calculation_hash = hashJson(output);
  validate(output, { runtime, audit, sourceRegistry });
  return output;
}

function validate(output, { runtime, audit, sourceRegistry }) {
  assert(output.review_status === 'not_reviewed' && output.release_eligible === false && output.production_runtime_release === false, 'queue must remain unreleased');
  assert(output.methodology.no_network_acquisition === true && output.methodology.no_new_approvals === true && output.methodology.no_normalized_target_values === true, 'queue methodology boundary drift');
  assert(output.entities.length === 20 && output.coverage.ranked_entities === 20, 'exact top-20 coverage required');
  const knownSourceIds = new Set(sourceRegistry.sources.map(source => source.id));
  const knownDocumentIds = new Set(audit.documents.map(document => document.source_document_id));
  const roles = ['official_inventory', 'active_ndc', 'target_methodology'];
  output.entities.forEach((entity, index) => {
    const expected = runtime.ranking.ranked[index];
    assert(entity.priority === index + 1 && entity.reviewed_2023_factual_rank === expected.ordinal, `rank drift at ${index + 1}`);
    assert(entity.country_id === expected.country_id && entity.reviewed_2023_emissions.value === expected.value, `ranked fact drift at ${index + 1}`);
    assert(entity.reviewed_2023_emissions.fact_id.endsWith(':2023'), `${entity.country_id} latest fact must be 2023`);
    assert(entity.document_requirements.length === 3, `${entity.country_id} must have three document requirements`);
    assert(JSON.stringify(entity.document_requirements.map(item => item.role)) === JSON.stringify(roles), `${entity.country_id} document roles drift`);
    for (const requirementItem of entity.document_requirements) {
      assert(requirementItem.source_owner.primary && requirementItem.source_owner.registry, `${entity.country_id} source owner missing`);
      requirementItem.acceptable_source_registry_ids.forEach(id => assert(knownSourceIds.has(id), `${entity.country_id} unknown source registry ID`));
      requirementItem.source_document_ids.forEach(id => assert(knownDocumentIds.has(id), `${entity.country_id} unknown CT-11 document ID`));
      assert(requirementItem.reason_codes.length > 0, `${entity.country_id} requirement must fail closed`);
      if (requirementItem.role === 'official_inventory') assert(requirementItem.evidence_status === 'source_missing' && requirementItem.source_document_ids.length === 0, `${entity.country_id} inventory evidence invented`);
    }
    assert(JSON.stringify(Object.keys(entity.field_completeness)) === JSON.stringify(GROUP_ORDER), `${entity.country_id} field groups drift`);
    for (const group of Object.values(entity.field_completeness)) {
      assert(group.required_fields.length > 0 && group.reason_codes.length > 0, `${entity.country_id} field group must be explicit`);
      assert(group.missing_fields.every(field => group.required_fields.includes(field)), `${entity.country_id} missing field outside requirements`);
      assert(group.withheld_fields.every(field => group.required_fields.includes(field) && !group.missing_fields.includes(field)), `${entity.country_id} withheld field mismatch`);
    }
    assert(entity.fail_closed_reason_codes.length > 0, `${entity.country_id} fail-closed reasons required`);
    assert(Object.values(entity.assessment_gate).every(value => value === false || value === null), `${entity.country_id} assessment leak`);
    assert(entity.allowed_uses.evidence_collection_prioritization === true && entity.allowed_uses.factual_emissions_context === true, `${entity.country_id} allowed triage use missing`);
    ['target_claims', 'commitment_claims', 'performance_claims', 'scoring', 'production_runtime'].forEach(key => assert(entity.allowed_uses[key] === false, `${entity.country_id} prohibited use enabled`));
  });
  assert(new Set(output.entities.map(entity => entity.country_id)).size === 20, 'top-20 country IDs must be unique');
  assert(output.coverage.ct11_countries_with_metadata === 4, 'CT-11 metadata coverage must be four countries');
  assert(output.coverage.countries_without_ct11_primary_source_audit === 16, 'CT-11 gap coverage must be sixteen countries');
  assert(output.coverage.active_ndc_metadata_entities === 3 && output.coverage.legacy_indc_only_entities === 1, 'NDC/INDC coverage drift');
  assert(output.coverage.official_inventory_documents_available === 0 && output.coverage.release_eligible_entities === 0, 'unreviewed evidence must not become available');
  const forHash = JSON.parse(JSON.stringify(output)); delete forHash.calculation_hash;
  assert(hashJson(forHash) === output.calculation_hash, 'queue calculation hash drift');
  return true;
}

module.exports = { compile, validate, hashJson, stable, RELEASE_ID, SOURCE_IDS, GROUP_ORDER };
