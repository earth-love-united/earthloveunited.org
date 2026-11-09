/**
 * DATA SCHEMA — JSON validation for Earth Love United data files
 *
 * Validates data/*.json files against expected schemas at load time.
 * Reports errors via reportError() so they appear in dev-mode error banner.
 * Zero dependencies, bare-metal IIFE pattern.
 */
const DATA_SCHEMA = (() => {
  'use strict';

  // ── Schema definitions ──
  const SCHEMAS = {
    biomes: {
      type: 'object',
      required: true,
      validate(value) {
        // value is the parsed JSON object (keyed by biome ID)
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return 'biomes.json must be an object keyed by biome ID';
        }
        const errors = [];
 for (const [id, biome] of Object.entries(value)) {
   if (id.startsWith('_')) continue; // skip metadata keys
   if (!biome || typeof biome !== 'object') continue;
   if (!biome.name) errors.push(`biome "${id}": missing "name"`);
   if (typeof biome.density !== 'number') errors.push(`biome "${id}": "density" must be a number`);
   if (typeof biome.seq !== 'number') errors.push(`biome "${id}": "seq" must be a number`);
 }
        return errors.length ? errors : null;
      },
    },
    sites: {
      type: 'array',
      required: true,
      validate(value) {
        if (!Array.isArray(value)) return 'sites.json must be an array';
        const errors = [];
        for (let i = 0; i < value.length; i++) {
          const site = value[i];
          if (!site.id) errors.push(`site[${i}]: missing "id"`);
          if (!site.name) errors.push(`site[${i}]: missing "name"`);
          if (typeof site.lat !== 'number') errors.push(`site "${site.id || i}": "lat" must be a number`);
          if (typeof site.lng !== 'number') errors.push(`site "${site.id || i}": "lng" must be a number`);
          if (!site.countryIso) errors.push(`site "${site.id || i}": missing "countryIso"`);
          if (site.countryIso && !/^[A-Z]{3}$/.test(site.countryIso)) errors.push(`site "${site.id || i}": "countryIso" must be an ISO alpha-3 code`);
          if (!site.primaryBiome) errors.push(`site "${site.id || i}": missing "primaryBiome"`);
        }
        return errors.length ? errors : null;
      },
    },
    countryClimateIntelligence: {
      type: 'object',
      required: true,
      validate(value) {
        const errors = [];
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return 'country-climate-intelligence.json must be an object';
        }
        if (value.schema_version !== '1.0.0') errors.push('schema_version must be 1.0.0');
        if (value.release?.entity_count !== 249) errors.push('release.entity_count must be 249');
        if (value.release?.comparison_baseline_year !== 2024) errors.push('comparison baseline must be 2024');
        if (!Array.isArray(value.source_catalog) || !value.source_catalog.length) errors.push('source_catalog must be a non-empty array');
        if (!value.metric_definitions || typeof value.metric_definitions !== 'object') errors.push('metric_definitions must be an object');
        if (!Array.isArray(value.lens_catalog) || value.lens_catalog.length !== 3) errors.push('lens_catalog must contain three lenses');
        if (!value.coverage || typeof value.coverage !== 'object') errors.push('coverage must be an object');
        if (!value.lens_orders || typeof value.lens_orders !== 'object') errors.push('lens_orders must be an object');
        if (!Array.isArray(value.countries) || value.countries.length !== 249) errors.push('countries must contain exactly 249 records');
        if (errors.length) return errors;

        const metricIds = Object.keys(value.metric_definitions).sort();
        const countryIds = new Set();
        const isoCodes = new Set();
        const available = Object.fromEntries(metricIds.map(id => [id, 0]));
        value.countries.forEach((country, index) => {
          if (!/^iso3166-1:[A-Z]{3}$/.test(country?.country_id || '')) errors.push(`country[${index}]: invalid country_id`);
          if (!/^[A-Z]{3}$/.test(country?.iso_alpha3 || '')) errors.push(`country[${index}]: invalid iso_alpha3`);
          if (countryIds.has(country?.country_id)) errors.push(`country[${index}]: duplicate country_id`);
          if (isoCodes.has(country?.iso_alpha3)) errors.push(`country[${index}]: duplicate iso_alpha3`);
          countryIds.add(country?.country_id);
          isoCodes.add(country?.iso_alpha3);
          if (!country?.metrics || typeof country.metrics !== 'object') {
            errors.push(`country[${index}]: metrics must be an object`);
            return;
          }
          const recordIds = Object.keys(country.metrics).sort();
          if (recordIds.join('|') !== metricIds.join('|')) errors.push(`country[${index}]: metric set differs from definitions`);
          metricIds.forEach(id => {
            const metric = country.metrics[id];
            if (!metric || metric.id !== id) {
              errors.push(`country[${index}]: invalid metric record ${id}`);
              return;
            }
            const hasValue = typeof metric.value === 'number' && Number.isFinite(metric.value);
            if (hasValue) {
              available[id]++;
              if (!['actual', 'estimated', 'modeled'].includes(metric.status)) errors.push(`country[${index}]: invalid evidence status for ${id}`);
              if (!metric.unit || !metric.period?.label || !metric.scope_fingerprint || !Array.isArray(metric.fact_ids) || !metric.fact_ids.length || !Array.isArray(metric.source_ids) || !metric.source_ids.length || !metric.review_state) {
                errors.push(`country[${index}]: incomplete available record ${id}`);
              }
            } else if (!metric.gap_reason?.code || !metric.gap_reason?.detail || metric.value !== null) {
              errors.push(`country[${index}]: missing explicit gap for ${id}`);
            }
          });
        });

        metricIds.forEach(id => {
          const coverage = value.coverage[id];
          if (!coverage || coverage.available !== available[id] || coverage.gaps !== 249 - available[id]) {
            errors.push(`coverage differs from country records for ${id}`);
          }
        });

        const lenses = new Set();
        value.lens_catalog.forEach(lens => {
          if (!['carbon', 'power', 'physical'].includes(lens?.id) || lenses.has(lens.id)) errors.push('lens IDs must be unique carbon, power, and physical');
          lenses.add(lens?.id);
          const order = value.lens_orders[lens?.id];
          if (!order || !Array.isArray(order.ordered) || !Array.isArray(order.unranked)) {
            errors.push(`lens order missing for ${lens?.id || 'unknown'}`);
            return;
          }
          const orderedIds = order.ordered.map(entry => entry.country_id);
          const unrankedIds = order.unranked.map(entry => entry.country_id);
          const partition = orderedIds.concat(unrankedIds);
          if (partition.length !== 249 || new Set(partition).size !== 249 || partition.some(id => !countryIds.has(id))) errors.push(`lens ${lens.id} does not partition all 249 entities`);
          if (order.eligible_count !== orderedIds.length || order.unranked_count !== unrankedIds.length) errors.push(`lens ${lens.id} coverage counts differ`);
          order.ordered.forEach((entry, index) => {
            const country = value.countries.find(item => item.country_id === entry.country_id);
            const metric = country?.metrics?.[lens.comparison_metric_id];
            if (entry.ordinal !== index + 1 || metric?.value !== entry.value || metric?.unit !== entry.unit || metric?.period?.label !== lens.period || metric?.status !== lens.evidence_status) {
              errors.push(`lens ${lens.id} contains an ineligible ordered entry`);
            }
            if (index > 0 && order.ordered[index - 1].value < entry.value) errors.push(`lens ${lens.id} is not descending`);
          });
          order.unranked.forEach(entry => {
            if (!entry.reason?.code || !entry.reason?.detail) errors.push(`lens ${lens.id} has an unexplained gap`);
          });
        });

        const primap = value.source_catalog.find(source => source.id === 'primap-hist-2.6.1-final');
        if (!primap || primap.public_role !== 'citation_only' || primap.values_in_release !== false) errors.push('PRIMAP v2.6.1 must remain citation-only');
        return errors.length ? errors : null;
      },
    },
  };

  // ── Validate a parsed JSON value against its schema ──
  function validate(fileName, data) {
    // Map filename to schema key
    const key = fileName.replace('.json', '').replace('data/', '');
    const schema = SCHEMAS[key];
    if (!schema) return { ok: true, errors: [] }; // no schema for this file, skip

    const errors = schema.validate(data);
    if (errors) {
      const msg = Array.isArray(errors) ? errors.join('; ') : errors;
      if (typeof reportError === 'function') {
        reportError('DATA_SCHEMA', new Error(`${fileName}: ${msg}`));
      }
      console.error(`[DATA_SCHEMA] ${fileName}: ${msg}`);
      return { ok: false, errors: Array.isArray(errors) ? errors : [errors] };
    } else {
      console.log(`[DATA_SCHEMA] ${fileName}: valid`);
      return { ok: true, errors: [] };
    }
  }

  function validateClimateIntelligence(data) {
    const errors = SCHEMAS.countryClimateIntelligence.validate(data);
    if (!errors) return { ok: true, errors: [] };
    return { ok: false, errors: Array.isArray(errors) ? errors : [errors] };
  }

  return { validate, validateClimateIntelligence };
})();

window.DATA_SCHEMA = DATA_SCHEMA;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('DATA_SCHEMA', {
    provides: ['validate', 'validateClimateIntelligence'],
    requires: [],
  });
}
