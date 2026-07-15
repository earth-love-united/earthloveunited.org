/**
 * COUNTRY_RANKING_COMPILER — deterministic shared country ranking semantics.
 *
 * Pure compiler only. This module is intentionally not loaded by index.html
 * until CT-22 and the globe/card integration agree on the release shape.
 */
const COUNTRY_RANKING_COMPILER = (() => {
  'use strict';

  const VERSION = '0.1.0';
  const LENSES = new Set(['annual_emissions', 'pledge_overshoot']);
  const REASON_CODES = [
    'ranking_value_missing',
    'ranking_value_invalid',
    'ranking_metric_mismatch',
    'ranking_period_mismatch',
    'ranking_plane_mismatch',
    'ranking_accounting_frame_mismatch',
    'ranking_scope_mismatch',
    'ranking_unit_mismatch',
    'ranking_observation_not_reviewed',
    'ranking_evidence_gate_not_passed',
    'ranking_evidence_not_reviewed',
    'ranking_source_missing',
    'ranking_source_unavailable',
    'ranking_licence_blocked',
    'ranking_value_withheld',
    'ranking_evidence_stale',
    'ranking_evidence_conflicting',
    'ranking_target_not_comparable',
    'ranking_target_scope_not_matched',
    'ranking_condition_mismatch',
    'ranking_target_year_mismatch',
    'ranking_target_scope_mismatch',
    'ranking_target_unit_mismatch',
    'ranking_target_value_missing',
    'ranking_target_value_invalid',
    'ranking_target_not_reviewed',
    'ranking_target_evidence_gate_not_passed',
  ];
  const REASON_CODE_SET = new Set(REASON_CODES);
  const EVIDENCE_BLOCKERS = {
    climate_evidence_not_reviewed: 'ranking_evidence_not_reviewed',
    source_not_reviewed: 'ranking_evidence_not_reviewed',
    not_reviewed: 'ranking_evidence_not_reviewed',
    source_missing: 'ranking_source_missing',
    source_unavailable: 'ranking_source_unavailable',
    licence_not_approved: 'ranking_licence_blocked',
    value_withheld: 'ranking_value_withheld',
    stale_source: 'ranking_evidence_stale',
    stale: 'ranking_evidence_stale',
    unresolved_source_conflict: 'ranking_evidence_conflicting',
    conflicting: 'ranking_evidence_conflicting',
  };

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function unique(values) {
    return Array.from(new Set(values.filter(value => typeof value === 'string' && value.length > 0)));
  }

  function exactPeriod(period) {
    const value = asObject(period);
    return {
      start_year: Number.isInteger(value.start_year) ? value.start_year : null,
      end_year: Number.isInteger(value.end_year) ? value.end_year : null,
    };
  }

  function samePeriod(left, right) {
    const a = exactPeriod(left);
    const b = exactPeriod(right);
    return a.start_year === b.start_year && a.end_year === b.end_year;
  }

  function requiredString(value, name) {
    if (typeof value !== 'string' || value.length === 0) throw new TypeError(name + ' must be a non-empty string');
    return value;
  }

  function normalizeSelection(selectionInput) {
    const selection = asObject(selectionInput);
    const lens = requiredString(selection.lens, 'selection.lens');
    if (!LENSES.has(lens)) throw new TypeError('selection.lens is unsupported');

    const normalized = {
      lens,
      metric: requiredString(selection.metric, 'selection.metric'),
      period: exactPeriod(selection.period),
      plane: requiredString(selection.plane, 'selection.plane'),
      accounting_frame: requiredString(selection.accounting_frame, 'selection.accounting_frame'),
      scope: requiredString(selection.scope, 'selection.scope'),
      unit: requiredString(selection.unit, 'selection.unit'),
      condition: null,
      target_year: null,
    };

    if (normalized.period.start_year === null || normalized.period.end_year === null) {
      throw new TypeError('selection.period requires integer start_year and end_year');
    }
    if (lens === 'annual_emissions' && normalized.period.start_year !== normalized.period.end_year) {
      throw new TypeError('annual_emissions requires a single-year period');
    }
    if (lens === 'pledge_overshoot') {
      normalized.condition = requiredString(selection.condition, 'selection.condition');
      if (!Number.isInteger(selection.target_year)) throw new TypeError('selection.target_year must be an integer');
      normalized.target_year = selection.target_year;
    }
    return normalized;
  }

  function observationReasons(observationInput, selection) {
    const observation = asObject(observationInput);
    const reasons = [];
    if (!Object.prototype.hasOwnProperty.call(observation, 'value') || observation.value === null) reasons.push('ranking_value_missing');
    else if (typeof observation.value !== 'number' || !Number.isFinite(observation.value)) reasons.push('ranking_value_invalid');
    if (observation.metric !== selection.metric) reasons.push('ranking_metric_mismatch');
    if (!samePeriod(observation.period, selection.period)) reasons.push('ranking_period_mismatch');
    if (observation.plane !== selection.plane) reasons.push('ranking_plane_mismatch');
    if (observation.accounting_frame !== selection.accounting_frame) reasons.push('ranking_accounting_frame_mismatch');
    if (observation.scope !== selection.scope) reasons.push('ranking_scope_mismatch');
    if (observation.unit !== selection.unit) reasons.push('ranking_unit_mismatch');
    if (observation.review_state !== 'reviewed') reasons.push('ranking_observation_not_reviewed');
    if (observation.evidence_gate_passed !== true) reasons.push('ranking_evidence_gate_not_passed');
    unique(asArray(observation.evidence_flags)).forEach(flag => {
      if (EVIDENCE_BLOCKERS[flag]) reasons.push(EVIDENCE_BLOCKERS[flag]);
    });
    return unique(reasons);
  }

  function targetReasons(targetInput, selection) {
    const target = asObject(targetInput);
    const reasons = [];
    if (target.integrity !== 'comparable') reasons.push('ranking_target_not_comparable');
    if (target.scope_match !== true) reasons.push('ranking_target_scope_not_matched');
    if (target.condition !== selection.condition) reasons.push('ranking_condition_mismatch');
    if (target.year !== selection.target_year) reasons.push('ranking_target_year_mismatch');
    if (target.scope !== selection.scope) reasons.push('ranking_target_scope_mismatch');
    if (target.unit !== selection.unit) reasons.push('ranking_target_unit_mismatch');
    if (!Object.prototype.hasOwnProperty.call(target, 'value') || target.value === null) reasons.push('ranking_target_value_missing');
    else if (typeof target.value !== 'number' || !Number.isFinite(target.value)) reasons.push('ranking_target_value_invalid');
    if (target.review_state !== 'reviewed') reasons.push('ranking_target_not_reviewed');
    if (target.evidence_gate_passed !== true) reasons.push('ranking_target_evidence_gate_not_passed');
    unique(asArray(target.evidence_flags)).forEach(flag => {
      if (EVIDENCE_BLOCKERS[flag]) reasons.push(EVIDENCE_BLOCKERS[flag]);
    });
    return unique(reasons);
  }

  function publicIdentity(record, index) {
    const countryId = requiredString(record.country_id, 'records[' + index + '].country_id');
    return {
      country_id: countryId,
      label: typeof record.label === 'string' && record.label.length > 0 ? record.label : countryId,
    };
  }

  function evaluate(recordInput, index, selection) {
    const record = asObject(recordInput);
    const identity = publicIdentity(record, index);
    const observation = asObject(record.latest_observation);
    const reasons = observationReasons(observation, selection);
    unique(asArray(record.evidence_flags)).forEach(flag => {
      if (EVIDENCE_BLOCKERS[flag]) reasons.push(EVIDENCE_BLOCKERS[flag]);
    });

    if (selection.lens === 'pledge_overshoot') {
      reasons.push(...targetReasons(record.target, selection));
    }

    const reasonCodes = unique(reasons);
    if (reasonCodes.some(code => !REASON_CODE_SET.has(code))) {
      throw new Error('internal ranking reason code drift');
    }
    if (reasonCodes.length > 0) {
      return {
        eligible: false,
        unranked: Object.assign(identity, { ordinal: null, reason_codes: reasonCodes }),
      };
    }

    const value = selection.lens === 'annual_emissions'
      ? observation.value
      : observation.value - record.target.value;

    return {
      eligible: true,
      candidate: Object.assign(identity, {
        value,
        unit: selection.unit,
        observation_value: observation.value,
        observation_period: exactPeriod(observation.period),
        target_value: selection.lens === 'pledge_overshoot' ? record.target.value : null,
        target_year: selection.lens === 'pledge_overshoot' ? record.target.year : null,
        condition: selection.lens === 'pledge_overshoot' ? record.target.condition : null,
        delivery_inferred: false,
      }),
    };
  }

  function compareCandidates(left, right) {
    if (left.value > right.value) return -1;
    if (left.value < right.value) return 1;
    if (left.country_id < right.country_id) return -1;
    if (left.country_id > right.country_id) return 1;
    return 0;
  }

  function compareUnranked(left, right) {
    if (left.country_id < right.country_id) return -1;
    if (left.country_id > right.country_id) return 1;
    return 0;
  }

  function assignCompetitionRanks(candidates) {
    let previousValue = null;
    let previousRank = null;
    return candidates.map((candidate, index) => {
      const ordinal = index > 0 && candidate.value === previousValue ? previousRank : index + 1;
      previousValue = candidate.value;
      previousRank = ordinal;
      return Object.assign({ ordinal }, candidate);
    });
  }

  function validatedMetadata(options) {
    const releaseId = requiredString(options.release_id, 'options.release_id');
    const compiledAt = requiredString(options.compiled_at, 'options.compiled_at');
    const inputHash = requiredString(options.input_hash, 'options.input_hash');
    if (releaseId.trim().length === 0) throw new TypeError('options.release_id must contain a non-whitespace character');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(compiledAt) ||
        new Date(compiledAt).toISOString() !== compiledAt.replace('Z', '.000Z')) {
      throw new TypeError('options.compiled_at must be a valid UTC timestamp in YYYY-MM-DDTHH:mm:ssZ form');
    }
    if (!/^[a-f0-9]{64}$/.test(inputHash)) {
      throw new TypeError('options.input_hash must be 64 lowercase hexadecimal characters');
    }
    return { release_id: releaseId, compiled_at: compiledAt, input_hash: inputHash };
  }

  function canonicalJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }

  function utf8Bytes(value) {
    const bytes = [];
    for (let index = 0; index < value.length; index += 1) {
      let code = value.charCodeAt(index);
      if (code >= 0xD800 && code <= 0xDBFF && index + 1 < value.length) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xDC00 && next <= 0xDFFF) {
          code = 0x10000 + ((code - 0xD800) << 10) + (next - 0xDC00);
          index += 1;
        }
      }
      if (code < 0x80) bytes.push(code);
      else if (code < 0x800) bytes.push(0xC0 | (code >>> 6), 0x80 | (code & 0x3F));
      else if (code < 0x10000) bytes.push(0xE0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3F), 0x80 | (code & 0x3F));
      else bytes.push(0xF0 | (code >>> 18), 0x80 | ((code >>> 12) & 0x3F), 0x80 | ((code >>> 6) & 0x3F), 0x80 | (code & 0x3F));
    }
    return bytes;
  }

  function rotateRight(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  function sha256(value) {
    const constants = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ];
    const hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const bytes = utf8Bytes(value);
    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    const low = bitLength >>> 0;
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push((high >>> shift) & 0xFF);
    for (let shift = 24; shift >= 0; shift -= 8) bytes.push((low >>> shift) & 0xFF);

    for (let offset = 0; offset < bytes.length; offset += 64) {
      const words = new Array(64);
      for (let index = 0; index < 16; index += 1) {
        const start = offset + index * 4;
        words[index] = ((bytes[start] << 24) | (bytes[start + 1] << 16) | (bytes[start + 2] << 8) | bytes[start + 3]) | 0;
      }
      for (let index = 16; index < 64; index += 1) {
        const x = words[index - 15];
        const y = words[index - 2];
        const small0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
        const small1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
        words[index] = (words[index - 16] + small0 + words[index - 7] + small1) | 0;
      }

      let a = hash[0]; let b = hash[1]; let c = hash[2]; let d = hash[3];
      let e = hash[4]; let f = hash[5]; let g = hash[6]; let h = hash[7];
      for (let index = 0; index < 64; index += 1) {
        const big1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
        const choose = (e & f) ^ (~e & g);
        const temp1 = (h + big1 + choose + constants[index] + words[index]) | 0;
        const big0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (big0 + majority) | 0;
        h = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }
      hash[0] = (hash[0] + a) | 0; hash[1] = (hash[1] + b) | 0;
      hash[2] = (hash[2] + c) | 0; hash[3] = (hash[3] + d) | 0;
      hash[4] = (hash[4] + e) | 0; hash[5] = (hash[5] + f) | 0;
      hash[6] = (hash[6] + g) | 0; hash[7] = (hash[7] + h) | 0;
    }
    return hash.map(word => (word >>> 0).toString(16).padStart(8, '0')).join('');
  }

  function compile(recordsInput, selectionInput, optionsInput) {
    const records = asArray(recordsInput);
    const selection = normalizeSelection(selectionInput);
    const options = asObject(optionsInput);
    const metadata = validatedMetadata(options);
    const mappedRecords = records.filter(record => asObject(record).mapped !== false);
    const candidates = [];
    const unranked = [];
    const countryIds = new Set();

    mappedRecords.forEach((record, index) => {
      const countryId = requiredString(asObject(record).country_id, 'records[' + index + '].country_id');
      if (countryIds.has(countryId)) throw new TypeError('duplicate mapped country_id: ' + countryId);
      countryIds.add(countryId);
      const result = evaluate(record, index, selection);
      if (result.eligible) candidates.push(result.candidate);
      else unranked.push(result.unranked);
    });

    candidates.sort(compareCandidates);
    unranked.sort(compareUnranked);
    const ranked = assignCompetitionRanks(candidates);

    const release = {
      ranking_version: VERSION,
      release_id: metadata.release_id,
      compiled_at: metadata.compiled_at,
      input_hash: metadata.input_hash,
      selection,
      disclosure: {
        eligible_count: ranked.length,
        mapped_count: mappedRecords.length,
        unranked_count: unranked.length,
        metric: selection.metric,
        period: exactPeriod(selection.period),
        plane: selection.plane,
        accounting_frame: selection.accounting_frame,
        scope: selection.scope,
        unit: selection.unit,
        condition: selection.condition,
        target_year: selection.target_year,
      },
      ranked,
      unranked: {
        heading: 'Not ranked — evidence unavailable or incompatible',
        numbered: false,
        entries: unranked,
      },
      composite_score_used: false,
      project_data_used: false,
    };
    return Object.assign({ calculation_hash: sha256(canonicalJson(release)) }, release);
  }

  return { VERSION, REASON_CODES: REASON_CODES.slice(), normalizeSelection, compile };
})();

window.COUNTRY_RANKING_COMPILER = COUNTRY_RANKING_COMPILER;

if (hasModule('MODULE_CONTRACTS')) {
  safeCall('MODULE_CONTRACTS', 'register', 'COUNTRY_RANKING_COMPILER', {
    provides: ['VERSION', 'REASON_CODES', 'normalizeSelection', 'compile'],
    requires: [],
  });
}
