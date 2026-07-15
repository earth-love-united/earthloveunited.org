#!/usr/bin/env node
/**
 * Fail-closed validator for data/climate/source-registry.json.
 *
 * This checks governance invariants, not network availability or legal truth.
 * A passing result means the registry records a complete, internally
 * consistent decision for every source; it does not turn a pending source
 * into an approved one.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data/climate/source-registry.json');
const ALLOWED_PLANES = new Set(['official', 'harmonized', 'independent', 'context']);
const ALLOWED_APPROVALS = new Set(['approved', 'pending', 'excluded']);
const ALLOWED_LICENCE_STATUS = new Set(['confirmed', 'uncertain']);
const ALLOWED_REDISTRIBUTION = new Set(['permitted', 'restricted', 'metadata_only', 'prohibited']);
const ALLOWED_RAW_STORAGE = new Set(['external_only', 'prohibited']);
const REQUIRED_DOMAINS = new Set([
  'identity',
  'ndc_target',
  'official_inventory',
  'official_progress',
  'policy_projection',
  'fossil_co2',
  'lulucf_co2',
  'economy_wide_ghg',
  'independent_ambition',
  'population',
  'economic_denominator',
  'climate_finance',
]);

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isString);
}

function isHttpsUrl(value) {
  if (!isString(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function isSha256(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot parse ${path.relative(ROOT, REGISTRY_PATH)}: ${error.message}`);
  }
}

function requireFields(object, fields, prefix, errors) {
  fields.forEach(field => {
    if (!(field in object)) errors.push(`${prefix} missing required field: ${field}`);
  });
}

function validateSource(source, index, configuredDomains, errors) {
  const prefix = `sources[${index}]`;
  if (!isObject(source)) {
    errors.push(`${prefix} must be an object.`);
    return;
  }

  requireFields(source, [
    'id', 'publisher', 'title', 'version', 'evidence_plane', 'domains',
    'primary', 'source_url', 'retrieval_url', 'cadence', 'licence',
    'redistribution', 'approval', 'storage',
  ], prefix, errors);

  ['id', 'publisher', 'title', 'version'].forEach(field => {
    if (!isString(source[field])) errors.push(`${prefix}.${field} must be a non-empty string.`);
  });
  if (isString(source.version) && /\b(latest|current)\b/i.test(source.version) && !/retrieved \d{4}-\d{2}-\d{2}/.test(source.version)) {
    errors.push(`${source.id || prefix}.version must be immutable or include a retrieval date.`);
  }
  if (!ALLOWED_PLANES.has(source.evidence_plane)) {
    errors.push(`${source.id || prefix}.evidence_plane is invalid.`);
  }
  if (typeof source.primary !== 'boolean') errors.push(`${source.id || prefix}.primary must be boolean.`);
  if (!isHttpsUrl(source.source_url)) errors.push(`${source.id || prefix}.source_url must be an HTTPS URL.`);
  if (!isHttpsUrl(source.retrieval_url)) errors.push(`${source.id || prefix}.retrieval_url must be an HTTPS URL.`);

  if (!isStringArray(source.domains)) {
    errors.push(`${source.id || prefix}.domains must be a non-empty string array.`);
  } else {
    source.domains.forEach(domain => {
      if (!configuredDomains.has(domain)) errors.push(`${source.id || prefix} uses unconfigured domain: ${domain}`);
    });
  }

  if (!isObject(source.cadence)) {
    errors.push(`${source.id || prefix}.cadence must be an object.`);
  } else {
    if (!isString(source.cadence.frequency)) errors.push(`${source.id || prefix}.cadence.frequency is required.`);
    if (!Number.isInteger(source.cadence.check_interval_days) || source.cadence.check_interval_days < 1) {
      errors.push(`${source.id || prefix}.cadence.check_interval_days must be a positive integer.`);
    }
  }

  if (!isObject(source.licence)) {
    errors.push(`${source.id || prefix}.licence must be an object.`);
  } else {
    requireFields(source.licence, ['identifier', 'status', 'terms_url', 'summary', 'attribution', 'restrictions'], `${source.id}.licence`, errors);
    ['identifier', 'summary', 'attribution'].forEach(field => {
      if (!isString(source.licence[field])) errors.push(`${source.id}.licence.${field} must be a non-empty string.`);
    });
    if (!ALLOWED_LICENCE_STATUS.has(source.licence.status)) errors.push(`${source.id}.licence.status is invalid.`);
    if (!isHttpsUrl(source.licence.terms_url)) errors.push(`${source.id}.licence.terms_url must be an HTTPS URL.`);
    if ('evidence_url' in source.licence && !isHttpsUrl(source.licence.evidence_url)) {
      errors.push(`${source.id}.licence.evidence_url must be an HTTPS URL.`);
    }
    if (!isStringArray(source.licence.restrictions)) errors.push(`${source.id}.licence.restrictions must be a non-empty string array.`);
  }

  if ('artifact' in source) {
    if (!isObject(source.artifact)) {
      errors.push(`${source.id}.artifact must be an object.`);
    } else {
      requireFields(source.artifact, ['format', 'sha256'], `${source.id}.artifact`, errors);
      if (!isString(source.artifact.format)) errors.push(`${source.id}.artifact.format is required.`);
      if (!isSha256(source.artifact.sha256)) errors.push(`${source.id}.artifact.sha256 must be a lowercase SHA-256 digest.`);
    }
  }

  if ('limitations' in source && !isStringArray(source.limitations)) {
    errors.push(`${source.id}.limitations must be a non-empty string array.`);
  }

  if (!isObject(source.redistribution)) {
    errors.push(`${source.id || prefix}.redistribution must be an object.`);
  } else {
    requireFields(source.redistribution, ['status', 'source_files', 'normalized_values', 'metadata_and_links'], `${source.id}.redistribution`, errors);
    if (!ALLOWED_REDISTRIBUTION.has(source.redistribution.status)) errors.push(`${source.id}.redistribution.status is invalid.`);
    ['source_files', 'normalized_values', 'metadata_and_links'].forEach(field => {
      if (typeof source.redistribution[field] !== 'boolean') errors.push(`${source.id}.redistribution.${field} must be boolean.`);
    });
  }

  if (!isObject(source.approval)) {
    errors.push(`${source.id || prefix}.approval must be an object.`);
  } else {
    requireFields(source.approval, ['state', 'decision', 'required_action'], `${source.id}.approval`, errors);
    if (!ALLOWED_APPROVALS.has(source.approval.state)) errors.push(`${source.id}.approval.state is invalid.`);
    if (!isString(source.approval.decision)) errors.push(`${source.id}.approval.decision is required.`);
    if (!isString(source.approval.required_action)) errors.push(`${source.id}.approval.required_action is required.`);
  }

  if (!isObject(source.storage)) {
    errors.push(`${source.id || prefix}.storage must be an object.`);
  } else {
    requireFields(source.storage, ['raw', 'checksum_required', 'snapshot_required'], `${source.id}.storage`, errors);
    if (!ALLOWED_RAW_STORAGE.has(source.storage.raw)) errors.push(`${source.id}.storage.raw is invalid.`);
    if (typeof source.storage.checksum_required !== 'boolean') errors.push(`${source.id}.storage.checksum_required must be boolean.`);
    if (typeof source.storage.snapshot_required !== 'boolean') errors.push(`${source.id}.storage.snapshot_required must be boolean.`);
  }

  if ('legacy_gate' in source) {
    if (!isObject(source.legacy_gate)) {
      errors.push(`${source.id}.legacy_gate must be an object.`);
    } else {
      requireFields(source.legacy_gate, [
        'dataset_path', 'state', 'field_lineage_required',
        'canonical_ingestion_allowed', 'scoring_allowed', 'public_claims_allowed',
        'blocked_field_families',
      ], `${source.id}.legacy_gate`, errors);
      if (!isString(source.legacy_gate.dataset_path)) errors.push(`${source.id}.legacy_gate.dataset_path is required.`);
      if (!isString(source.legacy_gate.state)) errors.push(`${source.id}.legacy_gate.state is required.`);
      if (!isStringArray(source.legacy_gate.blocked_field_families)) {
        errors.push(`${source.id}.legacy_gate.blocked_field_families must be a non-empty string array.`);
      }
      ['field_lineage_required', 'canonical_ingestion_allowed', 'scoring_allowed', 'public_claims_allowed'].forEach(field => {
        if (typeof source.legacy_gate[field] !== 'boolean') errors.push(`${source.id}.legacy_gate.${field} must be boolean.`);
      });
    }
  }

  // Fail closed: only fully approved, confirmed, permitted sources may export values.
  if (source.redistribution?.normalized_values === true) {
    if (source.approval?.state !== 'approved') errors.push(`${source.id} exports normalized values without approved state.`);
    if (source.licence?.status !== 'confirmed') errors.push(`${source.id} exports normalized values with an uncertain licence.`);
    if (source.redistribution?.status !== 'permitted') errors.push(`${source.id} exports normalized values without permitted redistribution.`);
    if (source.storage?.raw === 'prohibited') errors.push(`${source.id} exports normalized values while raw acquisition is prohibited.`);
  }
  if (source.approval?.state !== 'approved' && source.redistribution?.normalized_values !== false) {
    errors.push(`${source.id} is ${source.approval?.state} but normalized_values is not false.`);
  }
  if (source.approval?.state === 'approved' && source.redistribution?.normalized_values !== true) {
    errors.push(`${source.id} is approved but normalized_values is not true.`);
  }
  if (source.approval?.state === 'excluded' && source.redistribution?.status !== 'prohibited') {
    errors.push(`${source.id} is excluded but redistribution.status is not prohibited.`);
  }
  if (source.licence?.identifier.includes('-ND-') && source.redistribution?.normalized_values === true) {
    errors.push(`${source.id} has a no-derivatives licence but permits normalized values.`);
  }
  if (source.licence?.status === 'uncertain' && source.approval?.state === 'approved') {
    errors.push(`${source.id} has uncertain terms but is approved.`);
  }

  if (source.id === 'debian-iso-codes-4.20.1-1-iso-3166-1') {
    if (source.version !== '4.20.1-1') errors.push(`${source.id} must pin version 4.20.1-1.`);
    if (source.retrieval_url !== 'https://sources.debian.org/data/main/i/iso-codes/4.20.1-1/data/iso_3166-1.json') {
      errors.push(`${source.id} must pin the exact versioned Debian JSON URL.`);
    }
    if (source.licence?.identifier !== 'LGPL-2.1-or-later') errors.push(`${source.id} must retain LGPL-2.1-or-later.`);
    if (source.licence?.evidence_url !== 'https://sources.debian.org/src/iso-codes/4.20.1-1/REUSE.toml/') {
      errors.push(`${source.id} must retain the versioned Debian REUSE evidence URL.`);
    }
    if (source.artifact?.sha256 !== 'f01b812b57fba9f31ff621bf33e7c7570a01964dbeb5be2167e94decf538c89f') {
      errors.push(`${source.id} does not match the reviewed SHA-256.`);
    }
    if (source.artifact?.expected_record_count !== 249) errors.push(`${source.id} must require exactly 249 source rows.`);
    if (source.artifact?.record_array_path !== '3166-1') errors.push(`${source.id} must identify the 3166-1 record array.`);
    if (!isStringArray(source.artifact?.required_unique_fields)) {
      errors.push(`${source.id} must define unique identity fields.`);
    }
    ['notice_bundle_required', 'source_offer_required', 'transformation_log_required', 'separate_asset_required'].forEach(field => {
      if (source.storage?.[field] !== true) errors.push(`${source.id}.storage.${field} must remain true.`);
    });
    if (!isString(source.storage?.normalized_asset_rule)) errors.push(`${source.id} must define a separate normalized-asset rule.`);
    if (!isStringArray(source.limitations)) errors.push(`${source.id} must document identity and coverage limitations.`);
  }

  if (source.id === 'un-m49-continuous-2026-07-15') {
    if (source.approval?.state !== 'pending' || source.redistribution?.status !== 'metadata_only' || source.redistribution?.normalized_values !== false) {
      errors.push(`${source.id} must remain pending and metadata-only until reuse rights are confirmed.`);
    }
  }

  if (source.id === 'legacy-pledge-nodes-climate-watch-wri-family-2025-07-18') {
    if (source.approval?.state !== 'pending' || source.licence?.status !== 'uncertain') {
      errors.push(`${source.id} must remain pending with uncertain mixed-source terms.`);
    }
    if (source.legacy_gate?.dataset_path !== 'data/pledge-nodes.json' || source.legacy_gate?.state !== 'legacy_unverified') {
      errors.push(`${source.id} must identify the legacy pledge-node quarantine.`);
    }
    if (source.legacy_gate?.field_lineage_required !== true) errors.push(`${source.id} must require field-level lineage.`);
    ['canonical_ingestion_allowed', 'scoring_allowed', 'public_claims_allowed'].forEach(field => {
      if (source.legacy_gate?.[field] !== false) errors.push(`${source.id}.legacy_gate.${field} must remain false.`);
    });
  }
}

function validateRegistry(registry) {
  const errors = [];
  requireFields(registry, [
    'schema_version', 'registry_version', 'methodology_version', 'released_on',
    'reviewed_through', 'purpose', 'policy', 'evidence_planes', 'domains', 'sources',
  ], 'registry', errors);

  ['schema_version', 'registry_version', 'methodology_version'].forEach(field => {
    if (!/^\d+\.\d+\.\d+$/.test(registry[field] || '')) errors.push(`${field} must be semantic version x.y.z.`);
  });
  ['released_on', 'reviewed_through'].forEach(field => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(registry[field] || '')) errors.push(`${field} must be YYYY-MM-DD.`);
  });
  if (!isString(registry.purpose)) errors.push('purpose must be a non-empty string.');
  if (!isObject(registry.policy)) errors.push('policy must be an object.');
  if (!isStringArray(registry.evidence_planes)) errors.push('evidence_planes must be a non-empty string array.');
  if (!isStringArray(registry.domains)) errors.push('domains must be a non-empty string array.');
  if (!Array.isArray(registry.sources) || registry.sources.length === 0) errors.push('sources must be a non-empty array.');

  const configuredDomains = new Set(Array.isArray(registry.domains) ? registry.domains : []);
  REQUIRED_DOMAINS.forEach(domain => {
    if (!configuredDomains.has(domain)) errors.push(`Registry does not configure required domain: ${domain}`);
  });

  const ids = new Set();
  const coveredDomains = new Set();
  (registry.sources || []).forEach((source, index) => {
    validateSource(source, index, configuredDomains, errors);
    if (isString(source?.id)) {
      if (ids.has(source.id)) errors.push(`Duplicate source id: ${source.id}`);
      ids.add(source.id);
    }
    if (Array.isArray(source?.domains)) source.domains.forEach(domain => coveredDomains.add(domain));
  });
  REQUIRED_DOMAINS.forEach(domain => {
    if (!coveredDomains.has(domain)) errors.push(`No source covers required domain: ${domain}`);
  });
  if (!ids.has('debian-iso-codes-4.20.1-1-iso-3166-1')) {
    errors.push('Registry must include the approved Debian iso-codes identity seed.');
  }
  if (!ids.has('un-m49-continuous-2026-07-15')) {
    errors.push('Registry must retain UN M49 as pending normative metadata.');
  }
  if (!ids.has('legacy-pledge-nodes-climate-watch-wri-family-2025-07-18')) {
    errors.push('Registry must include the legacy Climate Watch/WRI field-lineage gate.');
  }

  return errors;
}

function main() {
  let registry;
  try {
    registry = readRegistry();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const errors = validateRegistry(registry);
  if (errors.length) {
    console.error('Climate source registry check failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  const counts = registry.sources.reduce((result, source) => {
    result[source.approval.state] += 1;
    return result;
  }, { approved: 0, pending: 0, excluded: 0 });
  console.log(
    `Climate source registry check passed (${registry.sources.length} sources: ` +
    `${counts.approved} approved, ${counts.pending} pending, ${counts.excluded} excluded).`
  );
}

if (require.main === module) main();

module.exports = { validateRegistry };
