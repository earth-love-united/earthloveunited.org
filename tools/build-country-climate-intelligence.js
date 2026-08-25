#!/usr/bin/env node
'use strict';

const path = require('path');
const {
  ENTITY_COUNT,
  ROOT,
  assertEntityPartition,
  assertMetricRecord,
  fileSha256,
  gapMetric,
  loadCountryRegistry,
  option,
  readJson,
  round,
  scopeFingerprint,
  writeCompactJson,
} = require('./lib/country-climate-intelligence');

const COMPONENT_IDS = ['gcb', 'wpp', 'trace', 'ember', 'cckp'];
const COMPONENT_REVIEW_STATES = Object.freeze({
  cckp: 'normalized_factual_candidate_pending_source_revalidation',
  ember: 'normalized_factual_candidate_pending_source_revalidation',
  gcb: 'source_validated_factual_candidate',
  trace: 'normalized_factual_candidate_pending_source_revalidation',
  wpp: 'normalized_factual_candidate_pending_source_revalidation',
});
const PER_CAPITA_ID = 'emissions.fossil_co2.territorial_per_capita';
const REANALYSIS_METRIC_IDS = new Set([
  'climate.temperature.observed_trend',
  'climate.precipitation.observed_trend',
]);

function withRuntimeEvidenceKind(metric, metricId) {
  if (!REANALYSIS_METRIC_IDS.has(metricId)) return metric;
  return { ...metric, evidence_kind: 'reanalysis' };
}

function verifiedJson(receipt) {
  const file = path.join(ROOT, receipt.path);
  const actual = fileSha256(file);
  if (actual !== receipt.sha256) throw new Error(`Artifact checksum mismatch for ${receipt.path}: expected ${receipt.sha256}, received ${actual}`);
  return readJson(file);
}

function perCapitaMetric(country) {
  const territorial = country.metrics['emissions.fossil_co2.territorial'];
  const population = country.metrics['population.estimate'];
  if (territorial.value === null) {
    return gapMetric(
      PER_CAPITA_ID,
      'gcp-gcb-2025-v1.0',
      'territorial_numerator_missing',
      'Per-capita fossil CO2 is withheld because the exact 2024 territorial numerator is unavailable.'
    );
  }
  if (population.value === null) {
    const metric = gapMetric(
      PER_CAPITA_ID,
      'un-wpp-2024',
      'year_matched_population_missing',
      'Per-capita fossil CO2 is withheld because the year-matched 2024 WPP Medium population projection is unavailable.'
    );
    metric.source_ids = ['gcp-gcb-2025-v1.0', 'un-wpp-2024'];
    return metric;
  }
  const scope = {
    accounting_frame: 'territorial_per_resident',
    gases: ['CO2'],
    geography: 'registry_entity_territory_and_population',
    gwp: 'not_applicable_single_gas',
    lulucf_treatment: 'excluded',
    metric: PER_CAPITA_ID,
    period: '2024',
    sectors: ['fossil_fuel_combustion', 'industrial_processes', 'cement_carbonation_sink'],
    unit: 'tCO2/person',
  };
  return {
    context: {
      denominator_metric_id: 'population.estimate',
      denominator_evidence: 'WPP 2024 Medium projection',
      numerator_metric_id: 'emissions.fossil_co2.territorial',
      source_scope_delta_calculated: false,
    },
    fact_ids: [
      `derived:${country.iso_alpha3}:${PER_CAPITA_ID}:2024`,
      ...territorial.fact_ids,
      ...population.fact_ids,
    ],
    gap_reason: null,
    id: PER_CAPITA_ID,
    period: { end: 2024, label: '2024', start: 2024 },
    review_state: 'normalized_candidate_pending_source_revalidation',
    scope,
    scope_fingerprint: scopeFingerprint(scope),
    source_ids: ['gcp-gcb-2025-v1.0', 'un-wpp-2024'],
    status: 'modeled',
    transformation: 'MtCO2_times_1000000_divided_by_year_matched_WPP_Medium_projection',
    uncertainty: { kind: 'not_propagated_from_inputs', lower: null, upper: null },
    unit: 'tCO2/person',
    value: round((territorial.value * 1000000) / population.value),
  };
}

function officialContextByCountry(receipt) {
  const audit = verifiedJson(receipt);
  const byCountry = new Map();
  for (const document of audit.documents || []) {
    const record = {
      direct_url: document.direct_url,
      document_title: document.title,
      document_type: document.document_type,
      metadata_url: document.metadata_url,
      registry_page_url: document.registry_page_url,
      registry_status: document.registry_status,
      source_document_id: document.source_document_id,
      source_id: 'unfccc-ndc-registry-continuous-2026-07-15',
      submission_date: document.submission_date,
      submission_date_state: document.submission_date ? 'reported' : 'not_reported',
    };
    const records = byCountry.get(document.country_id) || [];
    records.push(record);
    byCountry.set(document.country_id, records);
  }
  return byCountry;
}

function mergeCountries(registry, components, officialContext) {
  const componentMaps = components.map(({ id, artifact: component }) => {
    if (component.entity_count !== ENTITY_COUNT || component.review_state !== COMPONENT_REVIEW_STATES[id]) {
      throw new Error('Component artifact is not a complete reviewed factual candidate');
    }
    assertEntityPartition(component.countries);
    return new Map(component.countries.map(country => [country.country_id, country]));
  });
  return registry.entities.map(entity => {
    const metrics = {};
    for (const component of componentMaps) {
      const row = component.get(entity.country_id);
      if (!row || row.iso_alpha3 !== entity.iso_alpha3) throw new Error(`Component identity mismatch for ${entity.country_id}`);
      for (const [metricId, metric] of Object.entries(row.metrics)) {
        if (metrics[metricId]) throw new Error(`Duplicate normalized metric ${metricId} for ${entity.country_id}`);
        assertMetricRecord(metric, metricId);
        metrics[metricId] = withRuntimeEvidenceKind(metric, metricId);
      }
    }
    const country = {
      country_id: entity.country_id,
      flag_emoji: entity.flag_emoji,
      iso_alpha2: entity.iso_alpha2,
      iso_alpha3: entity.iso_alpha3,
      iso_numeric: entity.iso_numeric,
      metrics,
      name: entity.name,
      official_context: officialContext.get(entity.country_id) || [],
    };
    country.metrics[PER_CAPITA_ID] = perCapitaMetric(country);
    country.metrics = Object.fromEntries(Object.entries(country.metrics).sort(([left], [right]) => left.localeCompare(right)));
    return country;
  });
}

function buildCoverage(countries, definitions) {
  return Object.fromEntries(Object.keys(definitions).sort().map(metricId => {
    const available = countries.filter(country => Number.isFinite(country.metrics[metricId]?.value)).length;
    return [metricId, { available, gaps: ENTITY_COUNT - available }];
  }));
}

function buildLensOrders(countries, lensCatalog) {
  const orders = {};
  for (const lens of lensCatalog) {
    const eligible = [];
    const unranked = [];
    for (const country of countries) {
      const metric = country.metrics[lens.comparison_metric_id];
      const exact = metric && Number.isFinite(metric.value) && metric.period?.label === lens.period &&
        metric.status === lens.evidence_status && metric.scope?.metric === lens.comparison_metric_id &&
        metric.scope?.period === lens.period;
      if (exact) {
        eligible.push({ country, metric });
      } else {
        unranked.push({
          country_id: country.country_id,
          iso_alpha3: country.iso_alpha3,
          name: country.name,
          reason: metric?.gap_reason || {
            code: 'comparison_scope_mismatch',
            detail: `The ${lens.period} comparison metric is not available with the required evidence class and scope.`,
          },
        });
      }
    }
    eligible.sort((left, right) => (right.metric.value - left.metric.value) || left.country.name.localeCompare(right.country.name));
    unranked.sort((left, right) => left.name.localeCompare(right.name));
    orders[lens.id] = {
      comparison_class: lens.evidence_status === 'modeled' ? 'modeled_exploration_order' : 'source_homogeneous_metric_order',
      eligible_count: eligible.length,
      lens_id: lens.id,
      metric_id: lens.comparison_metric_id,
      ordered: eligible.map(({ country, metric }, index) => ({
        country_id: country.country_id,
        evidence_status: metric.status,
        iso_alpha3: country.iso_alpha3,
        name: country.name,
        ordinal: index + 1,
        period: metric.period.label,
        unit: metric.unit,
        value: metric.value,
      })),
      period: lens.period,
      rule: 'Only exact metric, scope, period, and evidence-status records enter this order. Gaps remain searchable and unnumbered.',
      unranked,
      unranked_count: unranked.length,
    };
  }
  return orders;
}

function build(manifest) {
  const registry = loadCountryRegistry();
  const components = COMPONENT_IDS.map(id => ({ id, artifact: verifiedJson(manifest.component_artifacts[id]) }));
  const officialContext = officialContextByCountry(manifest.official_context);
  const countries = mergeCountries(registry, components, officialContext);
  const metricIds = Object.keys(manifest.metric_definitions).sort();
  for (const country of countries) {
    const actual = Object.keys(country.metrics).sort();
    if (JSON.stringify(actual) !== JSON.stringify(metricIds)) throw new Error(`${country.country_id} does not contain the deterministic 18-metric contract`);
  }
  const inputArtifacts = Object.fromEntries(COMPONENT_IDS.map(id => [id, manifest.component_artifacts[id]]));
  inputArtifacts.official_context = manifest.official_context;
  return {
    boundaries: manifest.boundaries,
    countries,
    coverage: buildCoverage(countries, manifest.metric_definitions),
    lens_catalog: manifest.lens_catalog,
    lens_orders: buildLensOrders(countries, manifest.lens_catalog),
    metric_definitions: manifest.metric_definitions,
    release: {
      ...manifest.release,
      input_artifacts: inputArtifacts,
      prior_runtime_retained_for_rollback: manifest.prior_runtime_retained_for_rollback,
    },
    schema_ref: manifest.schema_ref,
    schema_version: manifest.schema_version,
    source_catalog: manifest.source_catalog,
  };
}

function main() {
  const args = process.argv.slice(2);
  const manifestPath = path.resolve(option(args, '--manifest', path.join(ROOT, 'data/climate/releases/country-climate-intelligence-v1/release-manifest.json')));
  const outputPath = path.resolve(option(args, '--output', path.join(ROOT, 'data/climate/runtime/country-climate-intelligence.json')));
  const manifest = readJson(manifestPath);
  const runtime = build(manifest);
  const digest = writeCompactJson(outputPath, runtime);
  console.log(`Built Country Climate Intelligence ${runtime.release.id}: ${runtime.countries.length} entities, ${Object.keys(runtime.metric_definitions).length} metrics.`);
  console.log(`Runtime SHA-256: ${digest}`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { build, buildCoverage, buildLensOrders, perCapitaMetric };
