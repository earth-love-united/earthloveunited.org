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
 if (id === '_meta') continue; // schema metadata, not a biome
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
          if (!site.primaryBiome) errors.push(`site "${site.id || i}": missing "primaryBiome"`);
        }
        return errors.length ? errors : null;
      },
    },
    'pledge-nodes': {
      type: 'array',
      required: true,
      validate(value) {
        if (!Array.isArray(value)) return 'pledge-nodes.json must be an array';
        const errors = [];
        for (let i = 0; i < value.length; i++) {
          const node = value[i];
          if (!node.iso) errors.push(`pledge-node[${i}]: missing "iso"`);
          if (!node.country) errors.push(`pledge-node[${i}]: missing "country"`);
        }
        return errors.length ? errors : null;
      },
    },
  };

  // ── Validate a parsed JSON value against its schema ──
  function validate(fileName, data) {
    // Map filename to schema key
    const key = fileName.replace('.json', '').replace('data/', '');
    const schema = SCHEMAS[key];
    if (!schema) return; // no schema for this file, skip

    const errors = schema.validate(data);
    if (errors) {
      const msg = Array.isArray(errors) ? errors.join('; ') : errors;
      if (typeof reportError === 'function') {
        reportError('DATA_SCHEMA', new Error(`${fileName}: ${msg}`));
      }
      console.error(`[DATA_SCHEMA] ${fileName}: ${msg}`);
    } else {
      console.log(`[DATA_SCHEMA] ${fileName}: valid`);
    }
  }

  return { validate };
})();

window.DATA_SCHEMA = DATA_SCHEMA;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('DATA_SCHEMA', {
    provides: ['validate'],
    requires: [],
  });
}
