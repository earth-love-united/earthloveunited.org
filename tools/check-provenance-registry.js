#!/usr/bin/env node
/**
 * Validate data/provenance-registry.json.
 *
 * No dependencies. Structural errors exit nonzero. Missing local files and
 * weak link coverage are warnings so the registry can document planned or
 * external-only sources without blocking unrelated site work.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data/provenance-registry.json');
const PUBLIC_PAGES = [
  path.join(ROOT, 'index.html'),
  path.join(ROOT, 'gaia.html'),
];

const REQUIRED_TOP = ['schema_version', 'last_updated', 'readiness_labels', 'data_types', 'items'];
const REQUIRED_ITEM = [
  'id',
  'title',
  'short_description',
  'readiness_label',
  'data_type',
  'local_paths',
  'external_links',
  'source_families',
  'last_reviewed',
  'maintainer_note',
  'known_limits',
  'intended_use',
  'not_for',
  'gaia_prompt_hint',
];

const ALLOWED_READINESS = ['production', 'review-stage', 'experimental'];
const ALLOWED_TYPES = ['source', 'processed', 'derived-educational', 'demo', 'registry'];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`Cannot parse ${path.relative(ROOT, REGISTRY_PATH)}: ${err.message}`);
  }
}

function validateRegistry(registry) {
  const errors = [];
  const warnings = [];

  for (const field of REQUIRED_TOP) {
    if (!(field in registry)) errors.push(`Missing top-level field: ${field}`);
  }

  if (!Array.isArray(registry.items)) {
    errors.push('Top-level items must be an array.');
    return { errors, warnings };
  }

  const configuredReadiness = Array.isArray(registry.readiness_labels) ? registry.readiness_labels : [];
  const configuredTypes = Array.isArray(registry.data_types) ? registry.data_types : [];
  const missingReadiness = ALLOWED_READINESS.filter(label => !configuredReadiness.includes(label));
  const missingTypes = ALLOWED_TYPES.filter(type => !configuredTypes.includes(type));
  if (missingReadiness.length) errors.push(`readiness_labels missing allowed values: ${missingReadiness.join(', ')}`);
  if (missingTypes.length) errors.push(`data_types missing allowed values: ${missingTypes.join(', ')}`);

  const ids = new Set();
  const registryIds = new Set(registry.items.map(item => item && item.id).filter(Boolean));

  registry.items.forEach((item, index) => {
    const prefix = `items[${index}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${prefix} must be an object.`);
      return;
    }

    for (const field of REQUIRED_ITEM) {
      if (!(field in item)) errors.push(`${prefix} missing required field: ${field}`);
    }

    if (!isNonEmptyString(item.id)) {
      errors.push(`${prefix}.id must be a non-empty string.`);
    } else if (ids.has(item.id)) {
      errors.push(`Duplicate registry id: ${item.id}`);
    } else {
      ids.add(item.id);
    }

    if (!ALLOWED_READINESS.includes(item.readiness_label)) {
      errors.push(`${item.id || prefix}.readiness_label must be one of: ${ALLOWED_READINESS.join(', ')}`);
    }

    if (!ALLOWED_TYPES.includes(item.data_type)) {
      errors.push(`${item.id || prefix}.data_type must be one of: ${ALLOWED_TYPES.join(', ')}`);
    }

    for (const field of ['title', 'short_description', 'last_reviewed', 'maintainer_note', 'gaia_prompt_hint']) {
      if (field in item && !isNonEmptyString(item[field])) {
        errors.push(`${item.id || prefix}.${field} must be a non-empty string.`);
      }
    }

    for (const field of ['local_paths', 'source_families', 'known_limits', 'intended_use', 'not_for']) {
      if (field in item && !isStringArray(item[field])) {
        errors.push(`${item.id || prefix}.${field} must be a non-empty string array.`);
      }
    }

    if (Array.isArray(item.local_paths)) {
      item.local_paths.forEach(localPath => {
        if (!isNonEmptyString(localPath)) return;
        if (!fs.existsSync(path.join(ROOT, localPath))) {
          warnings.push(`${item.id}: local path does not exist: ${localPath}`);
        }
      });
    }

    if (!Array.isArray(item.external_links)) {
      errors.push(`${item.id || prefix}.external_links must be an array.`);
    } else {
      if (item.external_links.length === 0) {
        warnings.push(`${item.id}: no external_links listed.`);
      }
      item.external_links.forEach((link, linkIndex) => {
        if (!link || typeof link !== 'object') {
          errors.push(`${item.id || prefix}.external_links[${linkIndex}] must be an object.`);
          return;
        }
        if (!isNonEmptyString(link.label)) errors.push(`${item.id || prefix}.external_links[${linkIndex}].label is required.`);
        if (!isNonEmptyString(link.url)) errors.push(`${item.id || prefix}.external_links[${linkIndex}].url is required.`);
      });
    }

    if (item.data_type !== 'registry' && item.readiness_label === 'production' && !item.external_links?.some(link => /huggingface\.co|github\.com/.test(link.url || ''))) {
      warnings.push(`${item.id}: production item should link to a public source such as Hugging Face or GitHub.`);
    }
  });

  for (const page of PUBLIC_PAGES) {
    if (!fs.existsSync(page)) continue;
    const html = fs.readFileSync(page, 'utf8');
    const re = /data-provenance-id=["']([^"']+)["']/g;
    let match;
    while ((match = re.exec(html))) {
      if (!registryIds.has(match[1])) {
        errors.push(`${path.relative(ROOT, page)} references unknown data-provenance-id: ${match[1]}`);
      }
    }
  }

  return { errors, warnings };
}

function main() {
  let registry;
  try {
    registry = readRegistry();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }

  const { errors, warnings } = validateRegistry(registry);

  warnings.forEach(warning => console.warn(`Warning: ${warning}`));

  if (errors.length) {
    console.error('Provenance registry check failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Provenance registry check passed (${registry.items.length} entries, ${warnings.length} warnings).`);
}

main();
