'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const readline = require('node:readline');

const CONFIG = Object.freeze({
  source_id: 'primap-hist-2.6.1-final',
  source_release: 'PRIMAP-hist_v2.6.1_final',
  scenario: 'HISTTP',
  entity: 'KYOTOGHG (AR6GWP100)',
  category: 'M.0.EL',
  source_unit: 'CO2 * gigagram / yr',
  output_unit: 'MtCO2e/yr',
  start_year: 2014,
  end_year: 2023,
  source_size: 74692621,
  source_md5: '09b9c61629f87e16012222e5b303bc36',
  source_sha256: '7607f2b7c5b00d3ddbb19e5c7b100ff7bd8c2d8c2bfc8959c40f41d2cfecf4d9',
  source_row_count: 215,
  source_2023_nonempty: 215,
});

const AGGREGATE_CODES = new Set(['ANNEXI', 'AOSIS', 'BASIC', 'EARTH', 'EU27BX', 'LDC', 'NONANNEXI', 'UMBRELLA']);
const OBSOLETE_CODES = new Set(['ANT']);

function parseCsvLine(line) {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('unterminated quoted CSV field');
  fields.push(field);
  return fields;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
}

function fileHashes(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    size: bytes.length,
    md5: crypto.createHash('md5').update(bytes).digest('hex'),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

function assertPinnedSource(filePath) {
  const hashes = fileHashes(filePath);
  if (hashes.size !== CONFIG.source_size) throw new Error(`source size mismatch: ${hashes.size}`);
  if (hashes.md5 !== CONFIG.source_md5) throw new Error(`source MD5 mismatch: ${hashes.md5}`);
  if (hashes.sha256 !== CONFIG.source_sha256) throw new Error(`source SHA-256 mismatch: ${hashes.sha256}`);
  return hashes;
}

function sourceRowMatches(row) {
  return row.source === CONFIG.source_release &&
    row['scenario (PRIMAP-hist)'] === CONFIG.scenario &&
    row.entity === CONFIG.entity &&
    row.unit === CONFIG.source_unit &&
    row['category (IPCC2006_PRIMAP)'] === CONFIG.category;
}

function parseSourceNumber(value, label) {
  if (value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is not a finite number`);
  return number;
}

function gigagramToMegatonne(value) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('gigagram value must be finite or null');
  return Number(gigagramTextToMegatonneDecimal(String(value)));
}

function gigagramTextToMegatonneDecimal(valueText) {
  if (typeof valueText !== 'string' || valueText.length === 0) throw new TypeError('gigagram decimal text is required');
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(valueText);
  if (!match) throw new TypeError(`invalid gigagram decimal text: ${valueText}`);
  const sign = match[1] === '-' ? '-' : '';
  const integer = match[2];
  const fraction = match[3] || '';
  const exponent = Number(match[4] || 0);
  const digits = integer + fraction;
  const decimalIndex = integer.length + exponent - 3;
  let shifted;
  if (decimalIndex <= 0) shifted = '0.' + '0'.repeat(-decimalIndex) + digits;
  else if (decimalIndex >= digits.length) shifted = digits + '0'.repeat(decimalIndex - digits.length);
  else shifted = digits.slice(0, decimalIndex) + '.' + digits.slice(decimalIndex);
  const parts = shifted.split('.');
  parts[0] = parts[0].replace(/^0+(?=\d)/, '') || '0';
  shifted = parts.join('.');
  return /^0(?:\.0*)?$/.test(shifted) ? shifted : sign + shifted;
}

function classifyArea(area, registryIso3) {
  if (registryIso3.has(area)) return 'mapped_country';
  if (AGGREGATE_CODES.has(area)) return 'aggregate';
  if (OBSOLETE_CODES.has(area)) return 'obsolete';
  return 'unmapped';
}

async function readSelectedRows(filePath) {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let headers = null;
  let csvRow = 0;
  const selected = [];

  for await (const line of lines) {
    csvRow += 1;
    if (headers === null) {
      headers = parseCsvLine(line);
      continue;
    }
    const fields = parseCsvLine(line);
    if (fields.length !== headers.length) throw new Error(`CSV row ${csvRow} has ${fields.length} fields; expected ${headers.length}`);
    const row = {};
    headers.forEach((header, index) => { row[header] = fields[index]; });
    if (sourceRowMatches(row)) selected.push({ csv_row: csvRow, row });
  }
  return { headers, selected };
}

function rowKey(row) {
  return {
    source: row.source,
    scenario: row['scenario (PRIMAP-hist)'],
    provenance: row.provenance,
    area: row['area (ISO3)'],
    entity: row.entity,
    unit: row.unit,
    category: row['category (IPCC2006_PRIMAP)'],
  };
}

function sourceLocator(csvRow, row) {
  return {
    file: 'PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv',
    csv_row: csvRow,
    row_key: rowKey(row),
  };
}

function buildCoverage(registryEntities, seriesByCountry) {
  return registryEntities.map(entity => {
    const series = seriesByCountry.get(entity.country_id);
    return series ? {
      country_id: entity.country_id,
      iso_alpha3: entity.iso_alpha3,
      state: 'not_reviewed',
      series_id: series.series_id,
      reason_codes: ['climate_evidence_not_reviewed', 'independent_review_required'],
      release_eligible: false,
      scoring_eligible: false,
    } : {
      country_id: entity.country_id,
      iso_alpha3: entity.iso_alpha3,
      state: 'source_unavailable',
      series_id: null,
      reason_codes: ['source_missing'],
      release_eligible: false,
      scoring_eligible: false,
    };
  });
}

function calculationHash(value) {
  const copy = structuredClone(value);
  delete copy.calculation_hash;
  return sha256(canonicalJson(copy));
}

function validUtc(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value) &&
    new Date(value).toISOString() === value.replace('Z', '.000Z');
}

function buildArtifact(registry, selectedRows, createdAt) {
  if (!validUtc(createdAt)) throw new Error('created_at must be an explicit valid UTC second timestamp');
  if (selectedRows.length !== CONFIG.source_row_count) throw new Error(`selected source row count must be ${CONFIG.source_row_count}`);
  const registryIso3 = new Set(registry.entities.map(entity => entity.iso_alpha3));
  const series = [];
  const exclusions = { aggregates: [], obsolete: [], unmapped: [] };
  let nonempty2023 = 0;

  selectedRows.forEach(({ csv_row: csvRow, row }) => {
    if (row['2023'] !== '') nonempty2023 += 1;
    const area = row['area (ISO3)'];
    const classification = classifyArea(area, registryIso3);
    if (classification !== 'mapped_country') {
      const excluded = { area, classification, locator: sourceLocator(csvRow, row) };
      if (classification === 'aggregate') exclusions.aggregates.push(excluded);
      else if (classification === 'obsolete') exclusions.obsolete.push(excluded);
      else exclusions.unmapped.push(excluded);
      return;
    }

    const values = [];
    for (let year = CONFIG.start_year; year <= CONFIG.end_year; year += 1) {
      const sourceValue = parseSourceNumber(row[String(year)], `${area} ${year}`);
      const normalizedDecimal = sourceValue === null ? null : gigagramTextToMegatonneDecimal(row[String(year)]);
      const sourceFactId = `fact:primap-hist-2.6.1:source:histtp:m0el:${area.toLowerCase()}:${year}`;
      values.push({
        year,
        source_value_text: row[String(year)] === '' ? null : row[String(year)],
        source_value_ggco2e: sourceValue,
        normalized_value_decimal: normalizedDecimal,
        value_mtco2e: normalizedDecimal === null ? null : Number(normalizedDecimal),
        source_fact_id: sourceFactId,
        fact_id: `fact:primap-hist-2.6.1:normalized:histtp:m0el:${area.toLowerCase()}:${year}`,
        input_fact_ids: [sourceFactId],
      });
    }
    series.push({
      series_id: `series:primap-hist-2.6.1:histtp:m0el:${area.toLowerCase()}`,
      country_id: `iso3166-1:${area}`,
      iso_alpha3: area,
      source_locator: sourceLocator(csvRow, row),
      review_status: 'not_reviewed',
      release_eligible: false,
      scoring_eligible: false,
      reason_codes: ['climate_evidence_not_reviewed', 'independent_review_required'],
      values,
    });
  });

  if (nonempty2023 !== CONFIG.source_2023_nonempty) throw new Error(`2023 nonempty count must be ${CONFIG.source_2023_nonempty}`);
  series.sort((left, right) => left.iso_alpha3 < right.iso_alpha3 ? -1 : left.iso_alpha3 > right.iso_alpha3 ? 1 : 0);
  Object.values(exclusions).forEach(items => items.sort((left, right) => left.area < right.area ? -1 : left.area > right.area ? 1 : 0));
  const seriesByCountry = new Map(series.map(item => [item.country_id, item]));
  const registryCoverage = buildCoverage(registry.entities, seriesByCountry);

  const artifact = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/primap-batch-candidate.schema.json',
    artifact_id: 'primap-hist-2.6.1-histtp-m0el-2014-2023-candidates',
    created_at: createdAt,
    calculation_hash: null,
    source: {
      source_registry_id: CONFIG.source_id,
      source_decision_introducing_commit_sha: 'd49b7d062e3805fd50c158bfa3b8f31a0115ff2f',
      source_registry_reviewed_state_commit_sha: '8b99e70829ea5d6182fc1c05ec6d8c6ffa3eb8f2',
      source_approval_state: 'approved',
      publisher: 'Potsdam Institute for Climate Impact Research / PRIMAP team',
      title: 'The PRIMAP-hist national historical emissions time series (1750–2023)',
      version: '2.6.1 final, 13 March 2025',
      doi_url: 'https://doi.org/10.5281/zenodo.15016289',
      retrieval_url: 'https://zenodo.org/records/15016289/files/Guetschow_et_al_2025-PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv?download=1',
      input_file: 'PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv',
      input_size: CONFIG.source_size,
      input_md5: CONFIG.source_md5,
      input_hash_sha256: CONFIG.source_sha256,
      licence: 'CC-BY-4.0',
      licence_url: 'https://creativecommons.org/licenses/by/4.0/',
      attribution: 'Gütschow, Busch and Pflüger (2025), PRIMAP-hist v2.6.1 final, https://doi.org/10.5281/zenodo.15016289, retrieved 2026-07-15. Earth Love United selected HISTTP, KYOTOGHG (AR6GWP100), M.0.EL and converted gigagrams CO2 equivalent per year to megatonnes CO2 equivalent per year.',
    },
    selection: {
      scenario: CONFIG.scenario,
      evidence_plane: 'harmonized',
      evidence_class: 'harmonized_estimate',
      entity: CONFIG.entity,
      gas_basket: ['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3'],
      gwp_convention: 'AR6GWP100',
      category: CONFIG.category,
      sectors: ['national_total_excluding_lulucf'],
      lulucf: 'excluded',
      geographic_boundary: 'PRIMAP area code mapped only through exact CT-02 ISO alpha-3 identity',
      international_bunkers: 'not_specified_for_selected_category',
      accounting_frame: 'economy_wide_ghg',
      source_unit: 'gigagram CO2e/yr',
      output_unit: CONFIG.output_unit,
      period: { start_year: CONFIG.start_year, end_year: CONFIG.end_year },
      formula: 'value_mtco2e = source_value_ggco2e / 1000',
      decimal_conversion: 'Move the source decimal point three places left using source text; no binary arithmetic and no rounding.',
      rounding: 'none',
      source_precision: 'source_value_text and normalized_value_decimal retain the source digits, including trailing fractional zeros',
      formula_version: '1.0.0',
      methodology_version: '0.1.0',
      official_plane_claimed: false,
      histcr_included: false,
      uncertainty: {
        status: 'not_provided_in_selected_rows',
        lower: null,
        upper: null,
        confidence: null,
        method: null,
      },
      limitations: [
        'International-bunker treatment is not asserted from the selected CSV rows; verify the PRIMAP category definition before comparison with a frame that includes or excludes bunker memo items.',
        'The selected CSV rows do not provide uncertainty bounds; normalized values must not be presented as uncertainty-free.',
      ],
    },
    review: {
      status: 'not_reviewed',
      builder_id: 'ct-10b-ingestion',
      reviewer_id: null,
      reviewed_at: null,
      independent_review_required: true,
    },
    publication_gates: {
      candidate_redistribution: {
        allowed: true,
        status: 'approved_source_licence_unreviewed_normalization',
        licence: 'CC-BY-4.0',
        reviewed_site_release: false,
        description: 'Redistributable evidence candidates for independent review; not a reviewed public assessment release.',
      },
      assessed_use: { allowed: false, status: 'denied_not_reviewed', reason_codes: ['climate_evidence_not_reviewed', 'independent_review_required'] },
      scoring: { allowed: false, status: 'denied_not_reviewed', reason_codes: ['climate_evidence_not_reviewed', 'independent_review_required'] },
    },
    source_row_audit: {
      selected_rows: selectedRows.length,
      nonempty_2023: nonempty2023,
      mapped_country_rows: series.length,
      aggregate_rows: exclusions.aggregates.length,
      obsolete_rows: exclusions.obsolete.length,
      unmapped_rows: exclusions.unmapped.length,
    },
    excluded_source_rows: exclusions,
    registry_coverage: registryCoverage,
    series,
    forbidden_outputs: {
      performance_assigned: false,
      impact_band_assigned: false,
      score_assigned: false,
      rank_assigned: false,
      target_assigned: false,
    },
  };
  artifact.calculation_hash = calculationHash(artifact);
  return artifact;
}

module.exports = {
  CONFIG,
  AGGREGATE_CODES,
  OBSOLETE_CODES,
  parseCsvLine,
  gigagramToMegatonne,
  gigagramTextToMegatonneDecimal,
  classifyArea,
  buildCoverage,
  fileHashes,
  assertPinnedSource,
  readSelectedRows,
  buildArtifact,
  calculationHash,
  canonicalJson,
  sha256,
};
