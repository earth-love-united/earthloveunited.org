'use strict';

function compileObservation(artifact, series, value) {
  if (artifact.schema_ref !== 'data/climate/schemas/primap-batch-candidate.schema.json') {
    throw new Error('input is not a typed PRIMAP batch candidate artifact');
  }
  const available = value.value_mtco2e !== null;
  return {
    schema_version: '2.0.0',
    fact_id: value.fact_id,
    country_id: series.country_id,
    metric: 'annual_economy_wide_ghg_excluding_lulucf',
    value_type: 'number',
    value: value.value_mtco2e,
    unit: 'MtCO2e/yr',
    period: {
      start: `${value.year}-01-01`,
      end: `${value.year}-12-31`,
      precision: 'year',
    },
    scope: {
      plane: 'harmonized',
      accounting_frame: 'economy_wide_ghg',
      gases: artifact.selection.gas_basket.slice(),
      sectors: artifact.selection.sectors.slice(),
      geography: `PRIMAP area ${series.iso_alpha3}; exact CT-02 ISO alpha-3 identity match`,
      lulucf: 'excluded',
      gwp_convention: 'AR6GWP100',
    },
    source: {
      source_id: artifact.source.source_registry_id,
      publisher: artifact.source.publisher,
      title: artifact.source.title,
      version: artifact.source.version,
      url: artifact.source.doi_url,
      locator: JSON.stringify({
        source_locator: series.source_locator,
        source_fact_id: value.source_fact_id,
        source_value_text: value.source_value_text,
        normalized_value_decimal: value.normalized_value_decimal,
        formula: artifact.selection.formula,
      }),
      publication_date: '2025-03-13',
      retrieved_at: '2026-07-15',
      checksum_sha256: artifact.source.input_hash_sha256,
      licence_id: artifact.source.licence,
      attribution: artifact.source.attribution,
    },
    evidence: {
      class: 'harmonized_estimate',
      state: available ? 'estimated' : 'source_unavailable',
      reason_codes: available ? ['climate_evidence_not_reviewed', 'independent_review_required'] : ['source_missing'],
      uncertainty: null,
    },
    review: {
      status: 'not_reviewed',
      reviewer_id: null,
      reviewed_at: null,
      notes: 'Compiled from the typed CT-10B batch candidate; independent review and CT-40 release gating remain required.',
    },
    derivation: null,
  };
}

function compileAllObservations(artifact) {
  const observations = [];
  artifact.series.forEach(series => {
    series.values.forEach(value => observations.push(compileObservation(artifact, series, value)));
  });
  return observations;
}

module.exports = { compileObservation, compileAllObservations };
