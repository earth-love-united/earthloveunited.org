#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_SOURCE_SHA256 = 'f01b812b57fba9f31ff621bf33e7c7570a01964dbeb5be2167e94decf538c89f';
const EXPECTED_RECORD_COUNT = 249;
const EXPECTED_RETRIEVAL_DATE = '2026-07-15';
const SOURCE_REGISTRY_ID = 'debian-iso-codes-4.20.1-1-iso-3166-1';
const RETRIEVAL_URL = 'https://sources.debian.org/data/main/i/iso-codes/4.20.1-1/data/iso_3166-1.json';

const inputPath = process.argv[2];
const retrievalDate = process.argv[3];
const outputPath = process.argv[4] || path.join(__dirname, '..', 'data', 'climate', 'country-registry.json');

if (!inputPath || !/^\d{4}-\d{2}-\d{2}$/.test(retrievalDate || '')) {
  process.stderr.write('Usage: node tools/build-country-registry.js <debian-iso_3166-1.json> <YYYY-MM-DD> [output.json]\n');
  process.exit(2);
}
if (retrievalDate !== EXPECTED_RETRIEVAL_DATE) {
  throw new Error(`Pinned CT-01 source record requires retrieval date ${EXPECTED_RETRIEVAL_DATE}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function reviewedNull(reasonCode) {
  return { status: 'not_reviewed', value: null, reason_code: reasonCode, source_id: null };
}

const sourceBytes = fs.readFileSync(inputPath);
const sourceChecksum = sha256(sourceBytes);
if (sourceChecksum !== EXPECTED_SOURCE_SHA256) {
  throw new Error(`Pinned Debian iso-codes source checksum mismatch: ${sourceChecksum}`);
}

const sourceDocument = JSON.parse(sourceBytes.toString('utf8'));
const rows = sourceDocument['3166-1'];
if (!Array.isArray(rows) || rows.length !== EXPECTED_RECORD_COUNT) {
  throw new Error(`Expected ${EXPECTED_RECORD_COUNT} records at JSON path 3166-1`);
}

const noticePath = path.join(__dirname, '..', 'data', 'climate', 'IDENTITY-NOTICE.md');
const licencePath = path.join(__dirname, '..', 'data', 'climate', 'LGPL-2.1.txt');
if (!fs.existsSync(noticePath) || !fs.existsSync(licencePath)) {
  throw new Error('Identity notice and LGPL licence copy must exist before building the registry');
}

const entities = rows.map((row) => {
  if (!/^[A-Z]{2}$/.test(row.alpha_2 || '') || !/^[A-Z]{3}$/.test(row.alpha_3 || '') || !/^\d{3}$/.test(row.numeric || '') || !row.name) {
    throw new Error(`Invalid Debian iso-codes identity row: ${JSON.stringify(row)}`);
  }
  return {
    country_id: `iso3166-1:${row.alpha_3}`,
    kind: 'iso_3166_1_compatible_entry',
    name: row.name,
    official_name: row.official_name || null,
    common_name: row.common_name || null,
    iso_alpha2: row.alpha_2,
    iso_alpha3: row.alpha_3,
    iso_numeric: row.numeric,
    flag_emoji: row.flag || null,
    region: reviewedNull('region_not_reviewed'),
    subregion: reviewedNull('region_not_reviewed'),
    un_membership: reviewedNull('membership_not_reviewed'),
    unfccc_party: reviewedNull('party_status_not_reviewed'),
    groups: {
      ldc: reviewedNull('ldc_status_not_reviewed'),
      lldc: reviewedNull('lldc_status_not_reviewed'),
      sids: reviewedNull('sids_status_not_reviewed')
    },
    territory_status: reviewedNull('territory_status_not_reviewed'),
    geometry: reviewedNull('geometry_not_reviewed'),
    assessment_eligibility: {
      status: 'not_reviewed',
      eligible: null,
      reason_codes: ['assessment_eligibility_not_reviewed'],
      source_id: null,
      reviewed_at: null
    },
    onboarding: {
      state: 'identity_registered',
      evidence_state: 'not_reviewed',
      reason_codes: ['climate_evidence_not_reviewed'],
      reviewed_at: null
    }
  };
});

entities.sort((a, b) => a.iso_alpha3.localeCompare(b.iso_alpha3));

for (const field of ['country_id', 'iso_alpha2', 'iso_alpha3', 'iso_numeric']) {
  if (new Set(entities.map((entity) => entity[field])).size !== entities.length) {
    throw new Error(`Pinned Debian source contains duplicate ${field}`);
  }
}

const registry = {
  schema_version: '2.0.0',
  registry_version: '2.0.0',
  data_release_id: 'debian-iso-codes-4.20.1-1-2026-07-15',
  generated_at: `${retrievalDate}T00:00:00Z`,
  identity_basis: {
    description: 'ISO 3166-1-compatible identity data sourced from the Debian iso-codes package; not an official ISO publication or United Nations dataset.',
    normative_authorities: ['International Organization for Standardization', 'United Nations'],
    redistribution_source: 'Debian iso-codes maintainers',
    political_status_disclaimer: 'A code or name does not assert sovereignty, recognition, United Nations membership, UNFCCC Party status, or climate-assessment eligibility.'
  },
  source: {
    source_registry_id: SOURCE_REGISTRY_ID,
    publisher: 'Debian iso-codes maintainers',
    title: 'iso-codes data/iso_3166-1.json',
    version: '4.20.1-1',
    source_url: 'https://sources.debian.org/src/iso-codes/4.20.1-1/',
    retrieval_url: RETRIEVAL_URL,
    retrieved_at: retrievalDate,
    source_path: 'data/iso_3166-1.json',
    format: 'JSON',
    record_array_path: '3166-1',
    source_record_count: rows.length,
    checksum_sha256: sourceChecksum,
    normalized_rows_checksum_sha256: sha256(JSON.stringify(entities)),
    licence: {
      identifier: 'LGPL-2.1-or-later',
      review_status: 'confirmed_by_ct01',
      terms_url: 'https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html',
      evidence_url: 'https://sources.debian.org/src/iso-codes/4.20.1-1/REUSE.toml/',
      notice_file: 'data/climate/IDENTITY-NOTICE.md',
      notice_sha256: sha256(fs.readFileSync(noticePath)),
      licence_file: 'data/climate/LGPL-2.1.txt',
      licence_sha256: sha256(fs.readFileSync(licencePath)),
      attribution: 'iso-codes 4.20.1-1, data/iso_3166-1.json, copyright 2016 Dr. Tobias Quathamer <toddy@debian.org>, licensed LGPL-2.1-or-later.',
      no_warranty: true,
      legal_review_scope: 'CT-01 project source-registry approval only; not a general legal opinion or claim about official ISO or United Nations licensing.'
    },
    transformation: {
      tool: 'tools/build-country-registry.js',
      version: '2.0.0',
      performed_at: `${retrievalDate}T00:00:00Z`,
      changes: [
        'Renamed Debian row fields into explicit iso_alpha2, iso_alpha3, and iso_numeric fields.',
        'Generated stable country_id values from iso_alpha3.',
        'Sorted rows by iso_alpha3.',
        'Added null not_reviewed overlay and assessment-eligibility records; no membership, Party, development-group, territory, region, or geometry claims were inferred.'
      ],
      preferred_form_source_url: RETRIEVAL_URL
    }
  },
  separable_asset: {
    path: 'data/climate/country-registry.json',
    scope: 'identity_only',
    licence: 'LGPL-2.1-or-later',
    includes_climate_performance_evidence: false,
    source_access_url: RETRIEVAL_URL,
    transformation_source: 'tools/build-country-registry.js'
  },
  publication_gates: {
    identity_redistribution: {
      status: 'approved_with_obligations',
      release_eligible: true,
      source_registry_id: SOURCE_REGISTRY_ID,
      approval_state: 'approved',
      redistribution_status: 'permitted',
      normalized_values: true,
      reason_codes: [],
      obligations: [
        'Preserve the copyright notice, LGPL identifier, warranty disclaimer, and licence copy.',
        'Provide access to the pinned preferred-form source and transformation tool.',
        'Keep this identity asset separately identifiable under LGPL-2.1-or-later.',
        'Mark transformations and their date; re-review every upstream version change.'
      ]
    },
    assessment_overlays: {
      status: 'blocked_not_reviewed',
      release_eligible: false,
      reason_codes: ['assessment_eligibility_not_reviewed', 'membership_not_reviewed', 'party_status_not_reviewed'],
      rule: 'No entity may enter a climate comparison or public assessment universe until eligibility and required overlays are separately sourced and reviewed.'
    }
  },
  entity_count: entities.length,
  entities
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(registry, null, 2)}\n`);
process.stdout.write(`Wrote ${entities.length} Debian iso-codes identities to ${outputPath}\n`);
