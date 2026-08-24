#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '../..');
const ENTITY_COUNT = 249;
const SCOPE_KEYS = [
  'metric',
  'accounting_frame',
  'gases',
  'sectors',
  'geography',
  'lulucf_treatment',
  'gwp',
  'unit',
  'period',
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  }
  return value;
}

function serialize(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

function serializeCompact(value) {
  return `${JSON.stringify(stable(value))}\n`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha256(file) {
  return sha256(fs.readFileSync(file));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serialize(value));
  return fileSha256(file);
}

function writeCompactJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, serializeCompact(value));
  return fileSha256(file);
}

function round(value, places = 6) {
  if (!Number.isFinite(value)) throw new Error(`Cannot round non-finite value: ${value}`);
  return Number(value.toFixed(places));
}

function mean(values) {
  if (!Array.isArray(values) || !values.length || values.some(value => !Number.isFinite(value))) {
    throw new Error('mean requires a non-empty array of finite numbers');
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function populationStdDev(values) {
  const centre = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - centre) ** 2), 0) / values.length);
}

function olsSlopePerDecade(series) {
  if (!Array.isArray(series) || series.length < 2) throw new Error('OLS trend requires at least two observations');
  const points = series.map(point => ({ year: Number(point.year), value: Number(point.value) }));
  if (points.some(point => !Number.isFinite(point.year) || !Number.isFinite(point.value))) {
    throw new Error('OLS trend observations must contain finite year and value fields');
  }
  const xMean = mean(points.map(point => point.year));
  const yMean = mean(points.map(point => point.value));
  const numerator = points.reduce((sum, point) => sum + ((point.year - xMean) * (point.value - yMean)), 0);
  const denominator = points.reduce((sum, point) => sum + ((point.year - xMean) ** 2), 0);
  if (denominator === 0) throw new Error('OLS trend requires distinct years');
  return round((numerator / denominator) * 10);
}

function scopeFingerprint(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) throw new Error('scope must be an object');
  return sha256(JSON.stringify(stable(scope)));
}

function scopesExactlyMatch(left, right) {
  if (!left || !right) return false;
  return SCOPE_KEYS.every(key => JSON.stringify(stable(left[key])) === JSON.stringify(stable(right[key])));
}

function loadCountryRegistry(file = path.join(ROOT, 'data/climate/country-registry.json')) {
  const registry = readJson(file);
  if (registry.entity_count !== ENTITY_COUNT || !Array.isArray(registry.entities) || registry.entities.length !== ENTITY_COUNT) {
    throw new Error(`Country registry must contain exactly ${ENTITY_COUNT} entities`);
  }
  const ids = registry.entities.map(entity => entity.country_id);
  if (ids.some(id => typeof id !== 'string') || new Set(ids).size !== ENTITY_COUNT) {
    throw new Error(`Country registry must contain ${ENTITY_COUNT} unique country_id values`);
  }
  return registry;
}

function countryIndex(registry = loadCountryRegistry()) {
  return new Map(registry.entities.map(entity => [entity.iso_alpha3, entity]));
}

function sourceById(sourceRegistry, id) {
  return sourceRegistry.sources.find(source => source.id === id);
}

function assertSourceApproved(sourceRegistry, id, selectedFields) {
  const source = sourceById(sourceRegistry, id);
  if (!source) throw new Error(`Source registry does not contain ${id}`);
  const gate = source.ingestion_gate;
  if (source.approval?.state !== 'approved' || source.licence?.status !== 'confirmed' ||
      source.redistribution?.status !== 'permitted' || source.redistribution?.normalized_values !== true ||
      !gate || gate.licence_reviewed !== true || gate.attribution_reviewed !== true ||
      gate.retrieval_receipt_required !== true || gate.exact_checksum_required !== true ||
      gate.normalized_value_redistribution_approved !== true) {
    throw new Error(`${id} is not approved through every fail-closed ingestion gate`);
  }
  const permitted = new Set(gate.field_permitlist || []);
  const denied = [...new Set(selectedFields || [])].filter(field => !permitted.has(field));
  if (denied.length) throw new Error(`${id} requested non-permitted fields: ${denied.join(', ')}`);
  return source;
}

function verifySnapshot(file, receipt) {
  if (!file || !fs.existsSync(file)) throw new Error(`Snapshot not found: ${file || '(missing path)'}`);
  if (!receipt || !/^[a-f0-9]{64}$/.test(receipt.sha256 || '') || !Number.isInteger(receipt.bytes)) {
    throw new Error('Snapshot receipt must pin bytes and a lowercase SHA-256 digest');
  }
  const bytes = fs.statSync(file).size;
  const digest = fileSha256(file);
  if (bytes !== receipt.bytes || digest !== receipt.sha256) {
    throw new Error(`Snapshot mismatch for ${path.basename(file)}: expected ${receipt.bytes}/${receipt.sha256}, received ${bytes}/${digest}`);
  }
  return { bytes, sha256: digest };
}

function gapMetric(id, sourceId, code, detail) {
  return {
    fact_ids: [],
    gap_reason: { code, detail },
    id,
    period: null,
    review_state: 'gap_reviewed',
    scope: null,
    scope_fingerprint: null,
    source_ids: [sourceId],
    status: null,
    transformation: null,
    uncertainty: null,
    unit: null,
    value: null,
  };
}

function assertMetricRecord(metric, expectedId) {
  if (!metric || metric.id !== expectedId) throw new Error(`Expected metric ${expectedId}`);
  if (metric.value === null) {
    if (!metric.gap_reason?.code || metric.period !== null || metric.status !== null) {
      throw new Error(`${expectedId} gap must have an explicit reason and no period/status`);
    }
    return;
  }
  if (!Number.isFinite(metric.value) || typeof metric.unit !== 'string' || !metric.period?.label ||
      !['actual', 'estimated', 'modeled'].includes(metric.status) || !metric.scope ||
      metric.scope_fingerprint !== scopeFingerprint(metric.scope) || !metric.fact_ids?.length || !metric.source_ids?.length) {
    throw new Error(`${expectedId} is not a complete normalized metric record`);
  }
}

function assertEntityPartition(rows, upstreamMappings = []) {
  if (!Array.isArray(rows) || rows.length !== ENTITY_COUNT) throw new Error(`Artifact must contain exactly ${ENTITY_COUNT} country rows`);
  const ids = rows.map(row => row.country_id);
  if (new Set(ids).size !== ENTITY_COUNT) throw new Error('Artifact country rows contain duplicate country_id values');
  const upstreamIds = new Set();
  for (const mapping of upstreamMappings) {
    if (!mapping.upstream_id || upstreamIds.has(mapping.upstream_id)) {
      throw new Error(`Upstream mapping ledger requires unique non-empty upstream_id values: ${mapping.upstream_id || '(missing)'}`);
    }
    upstreamIds.add(mapping.upstream_id);
    const dispositions = ['country_id', 'aggregate_exception', 'territory_exception', 'unmapped_exception']
      .filter(field => mapping[field] !== null && mapping[field] !== undefined);
    if (dispositions.length !== 1) throw new Error(`Upstream row ${mapping.upstream_id || '(unknown)'} must map exactly once or have exactly one exception`);
    if (mapping.country_id && !ids.includes(mapping.country_id)) throw new Error(`Upstream row maps to unknown country_id ${mapping.country_id}`);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''));
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field');
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    if (row.some(cell => cell !== '')) rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows[0];
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate headers');
  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) throw new Error(`CSV row ${rowIndex + 2} has ${cells.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, columnIndex) => [header, cells[columnIndex]]));
  });
}

function readCsvSnapshot(file) {
  const bytes = fs.readFileSync(file);
  const text = file.endsWith('.gz') ? zlib.gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  return parseCsv(text.replace(/^\uFEFF/, ''));
}

function requireHeaders(rows, required, permitlist) {
  if (!rows.length) throw new Error('Snapshot contains no rows');
  const headers = Object.keys(rows[0]);
  const missing = required.filter(field => !headers.includes(field));
  if (missing.length) throw new Error(`Snapshot is missing required fields: ${missing.join(', ')}`);
  const denied = headers.filter(field => !permitlist.includes(field));
  if (denied.length) throw new Error(`Snapshot contains non-permitted fields: ${denied.join(', ')}`);
}

function option(args, name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`${name} requires a value`);
  return args[index + 1];
}

module.exports = {
  ENTITY_COUNT,
  ROOT,
  SCOPE_KEYS,
  assertEntityPartition,
  assertMetricRecord,
  assertSourceApproved,
  countryIndex,
  fileSha256,
  gapMetric,
  loadCountryRegistry,
  mean,
  olsSlopePerDecade,
  option,
  parseCsv,
  populationStdDev,
  readCsvSnapshot,
  readJson,
  requireHeaders,
  round,
  scopeFingerprint,
  scopesExactlyMatch,
  serialize,
  serializeCompact,
  sha256,
  stable,
  verifySnapshot,
  writeCompactJson,
  writeJson,
};
