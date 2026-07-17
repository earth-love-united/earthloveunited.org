'use strict';

const CLIMATE_PUBLIC_BETA = (() => {
  const MANIFEST_PATH = '/data/climate/public-beta/runtime/runtime-manifest.json';
  const PRODUCT_LABEL = 'Climate Public Beta — harmonized factual emissions evidence, not a climate-performance assessment.';
  const MAX_MANIFEST_BYTES = 262144;
  const MAX_ARTIFACT_BYTES = 26214400;
  const ENTITY_ID = /^elu-e-[a-f0-9]{16}$/;
  const FACT_ID = /^elu-f-[a-f0-9]{16}$/;
  const SHA256 = /^[a-f0-9]{64}$/;
  const BETA_RELEASE_ID = /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/;
  const DECIMAL = /^-?[0-9]+(?:\.[0-9]+)?$/;
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const CORRECTION_ID = /^corr-[a-f0-9]{16,64}$/;
  const CORRECTION_DECISION = /^elu-correction-decision:[a-f0-9]{16,64}$/;
  const CORRECTION_SCOPE = 'Corrections to source identity, source locators, transformations, values, limitations, or display wording require a new immutable beta release ID and renewed exact-byte reviews.';
  const CORRECTION_CATEGORIES = Object.freeze([
    'source_identity', 'source_locator', 'transformation', 'value', 'limitation', 'display_wording',
  ]);
  const YEARS = Object.freeze([2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]);
  const FILE_NAMES = Object.freeze({
    country_factual: 'country-factual.json',
    country_identity: 'country-identity.json',
    country_identity_source: 'country-identity.SOURCE.md',
    country_identity_transform: 'country-identity-transform.json',
    fact_lineage: 'fact-lineage.json',
    known_limitations: 'known-limitations.json',
    correction_log: 'correction-log.json',
  });
  const MANIFEST_KEYS = Object.freeze([
    'schema_version',
    'manifest_id',
    'beta_release_id',
    'product_tier',
    'product_label',
    'content_state',
    'independent_review_state',
    'assessed_production_authority',
    'official_inventory',
    'climate_performance_assessment',
    'scope',
    'feedback',
    'files',
  ]);
  const FINAL_STATUS = Object.freeze({
    content_state: 'reviewed_beta_release',
    public_beta_source_rights_reviewed: true,
    public_beta_redistribution_authorized: true,
    independent_review_state: 'reviewed',
    beta_runtime_release_eligible: true,
    assessed_production_authority: false,
  });
  const METRIC = Object.freeze({
    id: 'annual_economy_wide_ghg_excluding_lulucf',
    label: 'Harmonized estimate: economy-wide GHG excluding LULUCF (AR6 GWP100)',
    unit: 'MtCO2e/yr',
    plane: 'harmonized',
    evidence_class: 'harmonized_estimate',
    scenario: 'HISTTP',
    gas_basket: Object.freeze(['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3']),
    sectors: Object.freeze(['national_total_excluding_lulucf']),
    start_year: 2014,
    end_year: 2023,
    latest_year: 2023,
    gwp_convention: 'AR6GWP100',
    lulucf: 'excluded',
    international_bunkers: 'not_specified_for_selected_category',
    uncertainty_status: 'not_provided_in_selected_rows',
  });
  const SCHEMAS = Object.freeze({
    country_factual: 'data/climate/schemas/public-beta-reviewed-country-factual.schema.json',
    country_identity: 'data/climate/schemas/public-beta-reviewed-country-identity.schema.json',
    fact_lineage: 'data/climate/schemas/public-beta-reviewed-fact-lineage.schema.json',
    correction_log: 'data/climate/schemas/public-beta-reviewed-correction-log.schema.json',
  });

  let appState = {
    status: 'idle',
    manifest: null,
    records: [],
    recordsById: new Map(),
    source: null,
    identitySource: null,
    metric: null,
    limitations: [],
    correctionLog: null,
    lastDialogTrigger: null,
  };

  class BetaVerificationError extends Error {
    constructor(code, safeMessage) {
      super(safeMessage);
      this.name = 'BetaVerificationError';
      this.code = code;
      this.safeMessage = safeMessage;
    }
  }

  function reject(code, safeMessage) {
    throw new BetaVerificationError(code, safeMessage);
  }

  function ensure(condition, code, safeMessage) {
    if (!condition) reject(code, safeMessage);
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }

  function exactKeys(value, keys, code) {
    ensure(isPlainObject(value), code, 'A required beta record has an invalid structure.');
    const actual = Object.keys(value).sort();
    const expected = Array.from(keys).sort();
    ensure(JSON.stringify(actual) === JSON.stringify(expected), code, 'A required beta record has an unexpected structure.');
  }

  function exactValue(actual, expected, code, safeMessage) {
    ensure(JSON.stringify(actual) === JSON.stringify(expected), code, safeMessage);
  }

  function nonEmptyString(value, code, safeMessage) {
    ensure(typeof value === 'string' && value.trim().length > 0, code, safeMessage);
    return value;
  }

  function safeHttpsUrl(value, code) {
    nonEmptyString(value, code, 'A reviewed external reference is missing.');
    let parsed;
    try {
      parsed = new URL(value);
    } catch (_) {
      reject(code, 'A reviewed external reference is invalid.');
    }
    ensure(parsed.protocol === 'https:' && !parsed.username && !parsed.password, code, 'A reviewed external reference is not a safe HTTPS URL.');
    return parsed.href;
  }

  function canonicalJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonicalJson(value[key])).join(',') + '}';
  }

  function bytesToHex(bytes) {
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function sha256Hex(bytes) {
    ensure(window.crypto && window.crypto.subtle, 'webcrypto-unavailable', 'This browser cannot verify the beta’s exact artifact hashes, so no climate values are displayed.');
    return bytesToHex(await window.crypto.subtle.digest('SHA-256', bytes));
  }

  function sameOriginUrl(pathname) {
    ensure(typeof pathname === 'string' && pathname.startsWith('/') &&
      !pathname.includes('\\') && !pathname.includes('\0') &&
      !pathname.includes('?') && !pathname.includes('#') &&
      !pathname.split('/').includes('..'), 'unsafe-runtime-path', 'The beta manifest contains an unsafe artifact path.');
    let url;
    try {
      url = new URL(pathname, window.location.origin);
    } catch (_) {
      reject('runtime-origin-unavailable', 'The beta must be loaded from its approved HTTPS or local test origin before hashes can be verified.');
    }
    ensure(url.origin === window.location.origin, 'cross-origin-runtime', 'The beta refused a cross-origin runtime artifact.');
    return url;
  }

  async function responseBytes(response, maximum) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maximum) {
      reject('artifact-too-large', 'A beta artifact exceeds the reviewed size boundary.');
    }
    if (!response.body || typeof response.body.getReader !== 'function') {
      const fallback = new Uint8Array(await response.arrayBuffer());
      ensure(fallback.byteLength <= maximum, 'artifact-too-large', 'A beta artifact exceeds the reviewed size boundary.');
      return fallback;
    }
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        reject('artifact-too-large', 'A beta artifact exceeds the reviewed size boundary.');
      }
      chunks.push(item.value);
    }
    const joined = new Uint8Array(total);
    let offset = 0;
    chunks.forEach(chunk => {
      joined.set(chunk, offset);
      offset += chunk.byteLength;
    });
    return joined;
  }

  async function fetchBytes(pathname, expectedBytes) {
    const url = sameOriginUrl(pathname);
    let response;
    try {
      response = await window.fetch(url.href, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'application/json, text/plain;q=0.9' },
      });
    } catch (_) {
      reject('artifact-fetch-failed', 'A required beta artifact could not be loaded from this origin.');
    }
    ensure(response.ok, 'artifact-fetch-failed', 'A required beta artifact is unavailable on this origin.');
    ensure(!response.redirected && response.url === url.href, 'artifact-redirected', 'A required beta artifact was redirected and could not be verified.');
    const bytes = await responseBytes(response, expectedBytes || MAX_MANIFEST_BYTES);
    if (Number.isInteger(expectedBytes)) {
      ensure(bytes.byteLength === expectedBytes, 'artifact-size-mismatch', 'A beta artifact does not match its reviewed byte size.');
    }
    return bytes;
  }

  function decodeUtf8(bytes, code) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (_) {
      reject(code, 'A required beta artifact is not valid UTF-8.');
    }
  }

  function parseJsonBytes(bytes, code) {
    try {
      return JSON.parse(decodeUtf8(bytes, code));
    } catch (error) {
      if (error instanceof BetaVerificationError) throw error;
      reject(code, 'A required beta artifact is not valid JSON.');
    }
  }

  function validateManifest(manifest) {
    exactKeys(manifest, MANIFEST_KEYS, 'manifest-structure');
    ensure(manifest.schema_version === '1.0.0', 'manifest-schema', 'The beta runtime manifest uses an unsupported schema.');
    ensure(typeof manifest.beta_release_id === 'string' && BETA_RELEASE_ID.test(manifest.beta_release_id), 'manifest-release-id', 'The beta runtime manifest has an invalid release identifier.');
    ensure(manifest.manifest_id === 'elu-climate-public-beta-runtime-' + manifest.beta_release_id, 'manifest-id', 'The beta runtime manifest identity does not match its release.');
    ensure(manifest.product_tier === 'climate_public_beta' && manifest.product_label === PRODUCT_LABEL, 'manifest-product-tier', 'The runtime artifact is not the narrowly labeled Climate Public Beta.');
    ensure(['reviewed_beta_release', 'withheld', 'withdrawn'].includes(manifest.content_state), 'manifest-content-state', 'The beta runtime manifest has an unknown content state.');
    ensure(['reviewed', 'superseded'].includes(manifest.independent_review_state), 'manifest-review-state', 'The beta runtime manifest has an unknown independent-review state.');
    ensure(manifest.assessed_production_authority === false && manifest.official_inventory === false &&
      manifest.climate_performance_assessment === false, 'manifest-truth-boundary', 'The beta runtime manifest crosses the factual-only product boundary.');

    exactKeys(manifest.scope, ['source_id', 'source_version', 'display_years', 'counts', 'metric_id', 'unit', 'comparison_year'], 'manifest-scope');
    ensure(manifest.scope.source_id === 'primap-hist-2.6.1-final' &&
      manifest.scope.source_version === '2.6.1 final, 13 March 2025', 'manifest-source', 'The beta source family or frozen version has changed.');
    exactValue(manifest.scope.display_years, { start: 2014, end: 2023 }, 'manifest-years', 'The beta display-year boundary has changed.');
    exactValue(manifest.scope.counts, {
      registry_entities: 249,
      factual_series: 206,
      source_gaps: 43,
      observations: 2060,
    }, 'manifest-counts', 'The beta coverage boundary does not match the reviewed factual scope.');
    ensure(manifest.scope.metric_id === METRIC.id && manifest.scope.unit === METRIC.unit &&
      manifest.scope.comparison_year === 2023, 'manifest-metric', 'The beta metric or magnitude-comparison boundary has changed.');

    exactKeys(manifest.feedback, ['approved_feedback_url', 'privacy_notice_url'], 'manifest-feedback');
    [manifest.feedback.approved_feedback_url, manifest.feedback.privacy_notice_url].forEach(value => {
      ensure(value === null || typeof value === 'string', 'manifest-feedback', 'The beta feedback route has an invalid structure.');
      if (typeof value === 'string') safeHttpsUrl(value, 'manifest-feedback');
    });

    exactKeys(manifest.files, Object.keys(FILE_NAMES), 'manifest-files');
    const releaseRoot = 'data/climate/public-beta/runtime/releases/' + manifest.beta_release_id + '/';
    Object.entries(FILE_NAMES).forEach(([key, filename]) => {
      const entry = manifest.files[key];
      exactKeys(entry, ['path', 'sha256', 'bytes'], 'manifest-file-entry');
      ensure(entry.path === releaseRoot + filename, 'manifest-file-path', 'A beta artifact path is outside the exact immutable release directory.');
      ensure(typeof entry.sha256 === 'string' && SHA256.test(entry.sha256), 'manifest-file-hash', 'A beta artifact is missing its exact SHA-256.');
      ensure(Number.isInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= MAX_ARTIFACT_BYTES, 'manifest-file-size', 'A beta artifact has an invalid reviewed byte size.');
    });

    if (manifest.content_state === 'withheld') {
      reject('release-withheld', 'This beta release is withheld. No climate values are displayed.');
    }
    if (manifest.content_state === 'withdrawn') {
      reject('release-withdrawn', 'This beta release has been withdrawn. No climate values are displayed.');
    }
    ensure(manifest.independent_review_state === 'reviewed', 'release-superseded', 'This beta release’s independent review has been superseded. No climate values are displayed.');
    ensure(typeof manifest.feedback.approved_feedback_url === 'string' &&
      typeof manifest.feedback.privacy_notice_url === 'string', 'feedback-not-approved', 'The reviewed feedback and privacy route is not active, so this beta release remains unavailable.');
    return manifest;
  }

  async function loadManifest() {
    const bytes = await fetchBytes(MANIFEST_PATH, null);
    ensure(bytes.byteLength <= MAX_MANIFEST_BYTES, 'manifest-too-large', 'The beta runtime manifest exceeds its size boundary.');
    return validateManifest(parseJsonBytes(bytes, 'manifest-json'));
  }

  async function loadReleaseFiles(manifest) {
    const loaded = {};
    await Promise.all(Object.entries(manifest.files).map(async ([key, entry]) => {
      const bytes = await fetchBytes('/' + entry.path, entry.bytes);
      const digest = await sha256Hex(bytes);
      ensure(digest === entry.sha256, 'artifact-hash-mismatch', 'A beta artifact does not match its reviewed SHA-256. No climate values are displayed.');
      loaded[key] = { bytes, text: decodeUtf8(bytes, 'artifact-utf8') };
    }));
    return loaded;
  }

  async function verifyCalculationHash(artifact, label) {
    ensure(isPlainObject(artifact) && typeof artifact.calculation_hash === 'string' &&
      SHA256.test(artifact.calculation_hash), 'calculation-hash-missing', label + ' is missing its internal calculation hash.');
    const hashInput = { ...artifact };
    delete hashInput.calculation_hash;
    const calculated = await sha256Hex(new TextEncoder().encode(canonicalJson(hashInput)));
    ensure(calculated === artifact.calculation_hash, 'calculation-hash-mismatch', label + ' does not match its internal calculation hash.');
  }

  function validateFinalStatus(status, code) {
    exactKeys(status, Object.keys(FINAL_STATUS), code);
    exactValue(status, FINAL_STATUS, code, 'A beta data artifact is not an independently reviewed, rights-cleared beta runtime artifact.');
  }

  function validateInputPins(pins, expectedCount, code) {
    ensure(Array.isArray(pins) && pins.length === expectedCount, code, 'A beta data artifact has an unexpected input-pin boundary.');
    const paths = new Set();
    pins.forEach(pin => {
      exactKeys(pin, ['path', 'sha256'], code);
      nonEmptyString(pin.path, code, 'A beta input pin is missing its source path.');
      ensure(!pin.path.includes('\\') && !pin.path.includes('\0') && !pin.path.split('/').includes('..'), code, 'A beta input pin contains an unsafe path.');
      ensure(SHA256.test(pin.sha256), code, 'A beta input pin is missing its exact SHA-256.');
      ensure(!paths.has(pin.path), code, 'A beta input pin is duplicated.');
      paths.add(pin.path);
    });
  }

  function validateMetric(metric) {
    exactKeys(metric, Object.keys(METRIC), 'factual-metric');
    exactValue(metric, METRIC, 'factual-metric', 'The factual artifact’s metric, accounting, or time boundary has changed.');
  }

  function validateFactual(factual, manifest) {
    exactKeys(factual, [
      'schema_version', 'schema_ref', 'artifact_kind', 'beta_release_id', 'status',
      'input_pins', 'allocation_scheme', 'metric', 'limitations', 'coverage',
      'entities', 'calculation_hash',
    ], 'factual-structure');
    ensure(factual.schema_version === '1.0.0' && factual.schema_ref === SCHEMAS.country_factual &&
      factual.artifact_kind === 'public_beta_country_factual' &&
      factual.beta_release_id === manifest.beta_release_id, 'factual-envelope', 'The factual artifact is not the exact reviewed beta release.');
    validateFinalStatus(factual.status, 'factual-status');
    validateInputPins(factual.input_pins, 3, 'factual-input-pins');
    ensure(factual.allocation_scheme === 'elu-opaque-allocation-v1', 'factual-allocation', 'The opaque factual identifier allocation has changed.');
    validateMetric(factual.metric);
    ensure(Array.isArray(factual.limitations) && factual.limitations.length === 5 &&
      factual.limitations.every(item => typeof item === 'string' && item.trim()), 'factual-limitations', 'The factual artifact does not carry its complete reviewed limitations.');
    exactValue(factual.coverage, {
      entities: 249,
      factual_series: 206,
      source_gaps: 43,
      observations: 2060,
    }, 'factual-coverage', 'The factual artifact coverage has changed.');
    ensure(Array.isArray(factual.entities) && factual.entities.length === 249, 'factual-entities', 'The factual artifact must contain exactly 249 registry entities.');

    const entityIds = new Set();
    const factIds = new Set();
    let factualSeries = 0;
    let sourceGaps = 0;
    let observationCount = 0;
    factual.entities.forEach(entity => {
      exactKeys(entity, ['entity_id', 'evidence_state', 'gap_reason', 'observations'], 'factual-entity');
      ensure(ENTITY_ID.test(entity.entity_id) && !entityIds.has(entity.entity_id), 'factual-entity-id', 'The factual artifact contains an invalid or duplicate opaque entity ID.');
      entityIds.add(entity.entity_id);
      ensure(entity.evidence_state === 'factual_series' || entity.evidence_state === 'source_gap', 'factual-evidence-state', 'The factual artifact contains an unknown evidence state.');
      ensure(Array.isArray(entity.observations), 'factual-observations', 'A factual entity has an invalid observation list.');
      if (entity.evidence_state === 'factual_series') {
        factualSeries += 1;
        ensure(entity.gap_reason === null && entity.observations.length === 10, 'factual-series-shape', 'A factual series does not contain the exact 2014–2023 observation boundary.');
      } else {
        sourceGaps += 1;
        ensure(entity.gap_reason === 'source_unavailable' && entity.observations.length === 0, 'factual-gap-shape', 'An explicit source gap contains a value or an unknown reason.');
      }
      entity.observations.forEach((observation, index) => {
        exactKeys(observation, ['fact_id', 'year', 'value_decimal'], 'factual-observation');
        ensure(FACT_ID.test(observation.fact_id) && !factIds.has(observation.fact_id), 'factual-fact-id', 'The factual artifact contains an invalid or duplicate opaque fact ID.');
        ensure(observation.year === YEARS[index], 'factual-year-sequence', 'A factual series does not contain the exact 2014–2023 year sequence.');
        ensure(typeof observation.value_decimal === 'string' && DECIMAL.test(observation.value_decimal), 'factual-decimal', 'A factual observation is not an exact decimal string.');
        factIds.add(observation.fact_id);
        observationCount += 1;
      });
    });
    ensure(factualSeries === 206 && sourceGaps === 43 && observationCount === 2060, 'factual-counts', 'The factual series, source-gap, or observation count has changed.');
    return { entityIds, factIds };
  }

  function optionalIdentityName(value, code) {
    ensure(value === null || (typeof value === 'string' && value.trim()), code, 'An identity name field is invalid.');
  }

  function validateIdentitySource(source) {
    const required = [
      'source_registry_id', 'publisher', 'title', 'version', 'source_url',
      'retrieval_url', 'source_checksum_sha256', 'licence_identifier',
      'licence_terms_url', 'attribution', 'no_warranty',
      'existing_project_review_status', 'public_beta_rights_review_status',
      'public_beta_redistribution_authorized',
    ];
    exactKeys(source, required, 'identity-source');
    ensure(source.source_registry_id === 'debian-iso-codes-4.20.1-1-iso-3166-1' &&
      source.version === '4.20.1-1' && source.licence_identifier === 'LGPL-2.1-or-later',
    'identity-source-version', 'The separately licensed identity source or version has changed.');
    ['publisher', 'title', 'attribution'].forEach(key => nonEmptyString(source[key], 'identity-source', 'The identity source is missing reviewed attribution.'));
    safeHttpsUrl(source.source_url, 'identity-source-url');
    safeHttpsUrl(source.retrieval_url, 'identity-source-url');
    safeHttpsUrl(source.licence_terms_url, 'identity-source-url');
    ensure(SHA256.test(source.source_checksum_sha256) && source.no_warranty === true,
      'identity-source-integrity', 'The identity source checksum or warranty notice is incomplete.');
    ensure(source.public_beta_rights_review_status === 'completed' &&
      source.public_beta_redistribution_authorized === true,
    'identity-source-rights', 'The separately licensed identity artifact does not carry its completed beta rights state.');
  }

  function validateIdentity(identity, manifest, factualEntityIds) {
    exactKeys(identity, [
      'schema_version', 'schema_ref', 'artifact_kind', 'beta_release_id', 'status',
      'input_pins', 'allocation', 'identity_source', 'coverage', 'identities',
      'calculation_hash',
    ], 'identity-structure');
    ensure(identity.schema_version === '1.0.0' && identity.schema_ref === SCHEMAS.country_identity &&
      identity.artifact_kind === 'public_beta_country_identity' &&
      identity.beta_release_id === manifest.beta_release_id, 'identity-envelope', 'The identity artifact is not the exact reviewed beta release.');
    validateFinalStatus(identity.status, 'identity-status');
    validateInputPins(identity.input_pins, 1, 'identity-input-pins');
    exactKeys(identity.allocation, ['scheme', 'statement'], 'identity-allocation');
    ensure(identity.allocation.scheme === 'elu-opaque-allocation-v1', 'identity-allocation', 'The opaque identity allocation has changed.');
    nonEmptyString(identity.allocation.statement, 'identity-allocation', 'The opaque identity allocation statement is missing.');
    validateIdentitySource(identity.identity_source);
    exactValue(identity.coverage, { identities: 249 }, 'identity-coverage', 'The identity artifact coverage has changed.');
    ensure(Array.isArray(identity.identities) && identity.identities.length === 249, 'identity-count', 'The identity artifact must contain exactly 249 identities.');

    const identitiesById = new Map();
    const sourceIds = new Set();
    const alpha2s = new Set();
    const alpha3s = new Set();
    const numericCodes = new Set();
    identity.identities.forEach(item => {
      exactKeys(item, [
        'entity_id', 'source_entity_id', 'name', 'official_name', 'common_name',
        'iso_alpha2', 'iso_alpha3', 'iso_numeric',
      ], 'identity-entry');
      ensure(ENTITY_ID.test(item.entity_id) && factualEntityIds.has(item.entity_id) &&
        !identitiesById.has(item.entity_id), 'identity-join', 'An identity does not join exactly once to an opaque factual entity.');
      ensure(/^iso3166-1:[A-Z]{3}$/.test(item.source_entity_id) &&
        item.source_entity_id === 'iso3166-1:' + item.iso_alpha3,
      'identity-source-id', 'An identity source code does not match its separately licensed identity record.');
      ensure(typeof item.name === 'string' && item.name.trim(), 'identity-name', 'An identity record is missing its display name.');
      optionalIdentityName(item.official_name, 'identity-name');
      optionalIdentityName(item.common_name, 'identity-name');
      ensure(/^[A-Z]{2}$/.test(item.iso_alpha2) && /^[A-Z]{3}$/.test(item.iso_alpha3) &&
        /^[0-9]{3}$/.test(item.iso_numeric), 'identity-code', 'An identity code is invalid.');
      ensure(!sourceIds.has(item.source_entity_id) && !alpha2s.has(item.iso_alpha2) &&
        !alpha3s.has(item.iso_alpha3) && !numericCodes.has(item.iso_numeric),
      'identity-duplicate', 'The identity artifact contains a duplicate code.');
      sourceIds.add(item.source_entity_id);
      alpha2s.add(item.iso_alpha2);
      alpha3s.add(item.iso_alpha3);
      numericCodes.add(item.iso_numeric);
      identitiesById.set(item.entity_id, item);
    });
    ensure(identitiesById.size === factualEntityIds.size, 'identity-coverage-join', 'The identity and factual entity universes do not match.');
    return identitiesById;
  }

  function validatePromotionEvidence(evidence) {
    exactKeys(evidence, [
      'promotion_id', 'promotion_calculation_hash', 'factual_review_id',
      'factual_review_calculation_hash', 'factual_display_review_passed',
      'production_runtime_release_allowed',
    ], 'lineage-promotion-evidence');
    ensure(evidence.promotion_id === 'ct-10c:primap-hist-2.6.1:economy-wide:2014-2023' &&
      typeof evidence.factual_review_id === 'string' && evidence.factual_review_id.trim() &&
      SHA256.test(evidence.promotion_calculation_hash) &&
      SHA256.test(evidence.factual_review_calculation_hash) &&
      evidence.factual_display_review_passed === true &&
      evidence.production_runtime_release_allowed === false,
    'lineage-promotion-evidence', 'The lineage no longer matches the frozen factual-display evidence boundary.');
  }

  function validatePrimapSource(source) {
    exactKeys(source, [
      'source_id', 'publisher', 'title', 'version', 'publication_date',
      'retrieval_date', 'source_url', 'retrieval_url', 'raw_source_sha256',
      'licence_identifier', 'licence_terms_url', 'attribution',
      'transformation_notice', 'existing_project_registry_state',
      'public_beta_rights_review_status', 'public_beta_redistribution_authorized',
    ], 'lineage-source');
    ensure(source.source_id === 'primap-hist-2.6.1-final' &&
      source.version === '2.6.1 final, 13 March 2025' &&
      source.publication_date === '2025-03-13' && ISO_DATE.test(source.retrieval_date) &&
      source.licence_identifier === 'CC-BY-4.0',
    'lineage-source-version', 'The lineage source, version, dates, or licence identifier has changed.');
    ['publisher', 'title', 'attribution', 'transformation_notice'].forEach(key => {
      nonEmptyString(source[key], 'lineage-source', 'The factual source is missing reviewed evidence detail.');
    });
    safeHttpsUrl(source.source_url, 'lineage-source-url');
    safeHttpsUrl(source.retrieval_url, 'lineage-source-url');
    safeHttpsUrl(source.licence_terms_url, 'lineage-source-url');
    ensure(SHA256.test(source.raw_source_sha256), 'lineage-source-hash', 'The factual source is missing its exact source hash.');
    ensure(source.existing_project_registry_state === 'approved' &&
      source.public_beta_rights_review_status === 'completed' &&
      source.public_beta_redistribution_authorized === true,
    'lineage-source-rights', 'The factual source does not carry its completed beta rights state.');
  }

  function validateSourceLocator(locator, identity) {
    exactKeys(locator, ['file', 'csv_row', 'row_key'], 'lineage-source-locator');
    ensure(locator.file === 'PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv' &&
      Number.isInteger(locator.csv_row) && locator.csv_row >= 2,
    'lineage-source-locator', 'A fact has an invalid frozen-source locator.');
    exactKeys(locator.row_key, ['source', 'scenario', 'provenance', 'area', 'entity', 'unit', 'category'], 'lineage-row-key');
    ensure(locator.row_key.source === 'PRIMAP-hist_v2.6.1_final' &&
      locator.row_key.scenario === 'HISTTP' &&
      typeof locator.row_key.provenance === 'string' && locator.row_key.provenance.trim() &&
      locator.row_key.area === identity.iso_alpha3 &&
      locator.row_key.entity === 'KYOTOGHG (AR6GWP100)' &&
      locator.row_key.unit === 'CO2 * gigagram / yr' &&
      locator.row_key.category === 'M.0.EL',
    'lineage-row-key', 'A fact’s source locator no longer matches the reviewed PRIMAP row boundary.');
  }

  function validateTransformation(transformation) {
    exactKeys(transformation, ['input_unit', 'output_unit', 'operation', 'rounding'], 'lineage-transformation');
    ensure(transformation.input_unit === 'CO2 * gigagram / yr' &&
      transformation.output_unit === METRIC.unit &&
      typeof transformation.operation === 'string' && transformation.operation.trim() &&
      transformation.rounding === 'none; move the source decimal point three places left using source text and retain source digits, including trailing fractional zeros',
    'lineage-transformation', 'A fact’s transformation or rounding rule has changed.');
  }

  function factualObservationMap(factual) {
    const observations = new Map();
    factual.entities.forEach(entity => entity.observations.forEach(observation => {
      observations.set(observation.fact_id, { ...observation, entity_id: entity.entity_id });
    }));
    return observations;
  }

  function validateLineage(lineage, manifest, factual, identitiesById, factualFactIds) {
    exactKeys(lineage, [
      'schema_version', 'schema_ref', 'artifact_kind', 'beta_release_id', 'status',
      'input_pins', 'promotion_evidence', 'source', 'coverage', 'facts',
      'calculation_hash',
    ], 'lineage-structure');
    ensure(lineage.schema_version === '1.0.0' && lineage.schema_ref === SCHEMAS.fact_lineage &&
      lineage.artifact_kind === 'public_beta_fact_lineage' &&
      lineage.beta_release_id === manifest.beta_release_id, 'lineage-envelope', 'The lineage artifact is not the exact reviewed beta release.');
    validateFinalStatus(lineage.status, 'lineage-status');
    validateInputPins(lineage.input_pins, 3, 'lineage-input-pins');
    validatePromotionEvidence(lineage.promotion_evidence);
    validatePrimapSource(lineage.source);
    exactValue(lineage.coverage, { facts: 2060 }, 'lineage-coverage', 'The lineage fact coverage has changed.');
    ensure(Array.isArray(lineage.facts) && lineage.facts.length === 2060, 'lineage-count', 'The lineage artifact must contain exactly 2,060 facts.');

    const factualObservations = factualObservationMap(factual);
    const factsById = new Map();
    lineage.facts.forEach(fact => {
      exactKeys(fact, [
        'fact_id', 'entity_id', 'source_id', 'source_entity_id',
        'source_iso_alpha3', 'source_fact_id', 'promoted_fact_id', 'year',
        'normalized_value_decimal', 'source_locator', 'transformation',
      ], 'lineage-fact');
      ensure(FACT_ID.test(fact.fact_id) && factualFactIds.has(fact.fact_id) &&
        !factsById.has(fact.fact_id), 'lineage-fact-id', 'A lineage fact does not join exactly once to an opaque factual fact.');
      const observation = factualObservations.get(fact.fact_id);
      const identity = identitiesById.get(fact.entity_id);
      ensure(observation && identity && observation.entity_id === fact.entity_id &&
        observation.year === fact.year && observation.value_decimal === fact.normalized_value_decimal,
      'lineage-factual-join', 'A lineage fact does not exactly reconstruct its factual observation.');
      ensure(fact.source_id === 'primap-hist-2.6.1-final' &&
        fact.source_entity_id === identity.source_entity_id &&
        fact.source_iso_alpha3 === identity.iso_alpha3 &&
        /^fact:primap-hist-2\.6\.1:source:/.test(fact.source_fact_id) &&
        /^fact:primap-hist-2\.6\.1:normalized:/.test(fact.promoted_fact_id),
      'lineage-source-join', 'A lineage fact does not exactly join to its frozen source identity.');
      validateSourceLocator(fact.source_locator, identity);
      validateTransformation(fact.transformation);
      factsById.set(fact.fact_id, fact);
    });
    ensure(factsById.size === factualFactIds.size, 'lineage-coverage-join', 'The lineage and factual fact universes do not match.');
    return factsById;
  }

  function validateAuxiliaryJson(value, manifest, label) {
    ensure(isPlainObject(value), 'auxiliary-json', label + ' is not a JSON object.');
    if (Object.prototype.hasOwnProperty.call(value, 'beta_release_id')) {
      ensure(value.beta_release_id === manifest.beta_release_id, 'auxiliary-release-id', label + ' belongs to a different beta release.');
    }
    ensure(value.assessed_production_authority !== true &&
      value.content_state !== 'withheld' && value.content_state !== 'withdrawn',
    'auxiliary-truth-boundary', label + ' says the release is not eligible for factual beta display.');
  }

  function correctionStatement(count) {
    return count === 0
      ? 'No corrections are recorded for this immutable release.'
      : 'This immutable release records ' + count + ' privacy-safe correction' +
        (count === 1 ? '' : 's') + ' to superseded beta releases.';
  }

  function exactUtcTimestamp(value) {
    if (typeof value !== 'string') return false;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
  }

  function validatePublicCorrectionDescription(value) {
    ensure(typeof value === 'string' && value === value.trim() && value.length >= 20 && value.length <= 500,
      'correction-description', 'A correction does not contain a concise privacy-safe public summary.');
    ensure(!/[\u0000-\u001f\u007f]/.test(value) &&
      !/(?:https?:\/\/|mailto:|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\/Users\/|\/home\/|[A-Za-z]:\\|\b(?:reporter|submitter|contact|email|phone|telephone)\b|\b\d{7,}\b)/i.test(value) &&
      !/(?:^|[\s._-])(?:fake|invented|unknown|example|placeholder|tbd|todo)(?:$|[\s._-])/i.test(value),
    'correction-privacy', 'A correction contains private, contact, path, URL, or placeholder material and cannot be displayed.');
  }

  function validateCorrectionLog(correctionLog, manifest) {
    exactKeys(correctionLog, [
      'schema_version', 'schema_ref', 'artifact_kind', 'beta_release_id',
      'content_state', 'review_input_pin', 'policy', 'entries',
      'assessed_production_authority', 'calculation_hash',
    ], 'correction-log-structure');
    ensure(correctionLog.schema_version === '1.0.0' &&
      correctionLog.schema_ref === SCHEMAS.correction_log &&
      correctionLog.artifact_kind === 'public_beta_correction_log' &&
      correctionLog.beta_release_id === manifest.beta_release_id &&
      correctionLog.content_state === 'reviewed_beta_release' &&
      correctionLog.assessed_production_authority === false &&
      typeof correctionLog.calculation_hash === 'string' && SHA256.test(correctionLog.calculation_hash),
    'correction-log-envelope', 'The correction history is not the exact reviewed factual-beta release record.');
    exactKeys(correctionLog.policy, ['scope', 'current_release_statement'], 'correction-log-policy');
    ensure(correctionLog.policy.scope === CORRECTION_SCOPE,
      'correction-log-policy', 'The immutable correction policy has changed.');
    ensure(Array.isArray(correctionLog.entries) && correctionLog.entries.length <= 100,
      'correction-log-entries', 'The correction history has an invalid entry boundary.');
    ensure(correctionLog.policy.current_release_statement === correctionStatement(correctionLog.entries.length),
      'correction-log-statement', 'The visible correction statement does not match this release.');

    if (correctionLog.entries.length === 0) {
      ensure(correctionLog.review_input_pin === null,
        'correction-log-input-pin', 'An empty first-release correction history cannot cite an unneeded private input.');
    } else {
      exactKeys(correctionLog.review_input_pin, ['path', 'sha256'], 'correction-log-input-pin');
      ensure(correctionLog.review_input_pin.path ===
        'private-review/climate-public-beta/' + manifest.beta_release_id + '/prior-corrections.review-input.json' &&
        SHA256.test(correctionLog.review_input_pin.sha256),
      'correction-log-input-pin', 'The correction history is not bound to its exact private reviewed input.');
    }

    const ids = new Set();
    const order = [];
    const allowedFiles = new Set(Object.values(FILE_NAMES));
    correctionLog.entries.forEach(entry => {
      exactKeys(entry, [
        'correction_id', 'superseded_release_id', 'corrected_in_release_id',
        'recorded_at', 'category', 'description', 'affected_artifacts',
        'decision_reference',
      ], 'correction-entry');
      ensure(CORRECTION_ID.test(entry.correction_id) && !ids.has(entry.correction_id),
        'correction-entry-id', 'The correction history contains an invalid or duplicate correction ID.');
      ids.add(entry.correction_id);
      ensure(BETA_RELEASE_ID.test(entry.superseded_release_id) &&
        entry.superseded_release_id !== manifest.beta_release_id &&
        entry.corrected_in_release_id === manifest.beta_release_id,
      'correction-entry-release', 'A correction does not bind a different superseded release to the current release.');
      ensure(exactUtcTimestamp(entry.recorded_at),
        'correction-entry-time', 'A correction is missing its exact recorded UTC timestamp.');
      ensure(CORRECTION_CATEGORIES.includes(entry.category),
        'correction-entry-category', 'A correction uses an unsupported public category.');
      validatePublicCorrectionDescription(entry.description);
      ensure(CORRECTION_DECISION.test(entry.decision_reference),
        'correction-entry-decision', 'A correction is missing its opaque reviewed decision reference.');
      ensure(Array.isArray(entry.affected_artifacts) && entry.affected_artifacts.length >= 1,
        'correction-entry-artifacts', 'A correction does not pin an affected immutable artifact.');
      const expectedRoot = 'data/climate/public-beta/runtime/releases/' + entry.superseded_release_id + '/';
      const paths = [];
      entry.affected_artifacts.forEach(pin => {
        exactKeys(pin, ['path', 'sha256'], 'correction-entry-artifact');
        ensure(pin.path.startsWith(expectedRoot) && allowedFiles.has(pin.path.slice(expectedRoot.length)) &&
          !pin.path.includes('\\') && !pin.path.split('/').includes('..') && SHA256.test(pin.sha256),
        'correction-entry-artifact', 'A correction does not carry an exact immutable affected-artifact pin.');
        paths.push(pin.path);
      });
      ensure(new Set(paths).size === paths.length &&
        JSON.stringify(paths) === JSON.stringify(paths.slice().sort()),
      'correction-entry-artifact-order', 'Correction artifact pins must be unique and sorted.');
      order.push(entry.recorded_at + '\0' + entry.correction_id);
    });
    ensure(JSON.stringify(order) === JSON.stringify(order.slice().sort()),
      'correction-entry-order', 'Corrections must be ordered by recorded time and correction ID.');
    return correctionLog;
  }

  function normalizedDecimal(value) {
    ensure(typeof value === 'string' && DECIMAL.test(value), 'decimal-compare', 'An emissions value is not an exact decimal string.');
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const parts = unsigned.split('.');
    const integer = parts[0].replace(/^0+(?=\d)/, '');
    const fraction = (parts[1] || '').replace(/0+$/, '');
    const zero = /^0+$/.test(integer) && fraction.length === 0;
    return { negative: zero ? false : negative, integer, fraction };
  }

  function compareUnsignedDecimal(left, right) {
    if (left.integer.length !== right.integer.length) return left.integer.length > right.integer.length ? 1 : -1;
    if (left.integer !== right.integer) return left.integer > right.integer ? 1 : -1;
    const width = Math.max(left.fraction.length, right.fraction.length);
    const leftFraction = left.fraction.padEnd(width, '0');
    const rightFraction = right.fraction.padEnd(width, '0');
    if (leftFraction === rightFraction) return 0;
    return leftFraction > rightFraction ? 1 : -1;
  }

  function compareDecimals(leftValue, rightValue) {
    const left = normalizedDecimal(leftValue);
    const right = normalizedDecimal(rightValue);
    if (left.negative !== right.negative) return left.negative ? -1 : 1;
    const unsigned = compareUnsignedDecimal(left, right);
    return left.negative ? -unsigned : unsigned;
  }

  function buildRanks(factual) {
    const factualEntities = factual.entities
      .filter(entity => entity.evidence_state === 'factual_series')
      .map(entity => ({
        entity_id: entity.entity_id,
        value: entity.observations[entity.observations.length - 1].value_decimal,
      }))
      .sort((left, right) => {
        const magnitude = compareDecimals(right.value, left.value);
        return magnitude || left.entity_id.localeCompare(right.entity_id);
      });
    const tieCounts = new Map();
    factualEntities.forEach(entry => {
      const normalized = normalizedDecimal(entry.value);
      const key = (normalized.negative ? '-' : '+') + normalized.integer + '.' + normalized.fraction;
      tieCounts.set(key, (tieCounts.get(key) || 0) + 1);
    });
    const ranks = new Map();
    let lastValue = null;
    let rank = 0;
    factualEntities.forEach((entry, index) => {
      if (lastValue === null || compareDecimals(entry.value, lastValue) !== 0) rank = index + 1;
      const normalized = normalizedDecimal(entry.value);
      const key = (normalized.negative ? '-' : '+') + normalized.integer + '.' + normalized.fraction;
      ranks.set(entry.entity_id, {
        rank,
        denominator: factualEntities.length,
        tied: tieCounts.get(key) > 1,
      });
      lastValue = entry.value;
    });
    return ranks;
  }

  function validateBundle(bundle) {
    const manifest = bundle.manifest;
    const factualBoundary = validateFactual(bundle.factual, manifest);
    const identitiesById = validateIdentity(bundle.identity, manifest, factualBoundary.entityIds);
    const factsById = validateLineage(bundle.lineage, manifest, bundle.factual, identitiesById, factualBoundary.factIds);
    validateAuxiliaryJson(bundle.identityTransform, manifest, 'The identity transformation record');
    validateAuxiliaryJson(bundle.knownLimitations, manifest, 'The known-limitations artifact');
    const correctionLog = validateCorrectionLog(bundle.correctionLog, manifest);
    ensure(typeof bundle.identitySourceText === 'string' && bundle.identitySourceText.trim().length > 0 &&
      !/\bINCOMPLETE\b|\[UNASSIGNED\]|\[HUMAN REVIEW REQUIRED\]/i.test(bundle.identitySourceText),
    'identity-source-notice', 'The identity source-access notice is incomplete.');

    const ranks = buildRanks(bundle.factual);
    const records = bundle.factual.entities.map(entity => ({
      entity,
      identity: identitiesById.get(entity.entity_id),
      facts: entity.observations.map(observation => factsById.get(observation.fact_id)),
      rank: ranks.get(entity.entity_id) || null,
    }));
    return {
      records,
      recordsById: new Map(records.map(record => [record.entity.entity_id, record])),
      source: bundle.lineage.source,
      identitySource: bundle.identity.identity_source,
      metric: bundle.factual.metric,
      limitations: Array.from(bundle.factual.limitations),
      correctionLog,
      hashes: {
        factual_calculation: bundle.factual.calculation_hash,
        identity_calculation: bundle.identity.calculation_hash,
        lineage_calculation: bundle.lineage.calculation_hash,
        identity_transform_file: manifest.files.country_identity_transform.sha256,
      },
    };
  }

  function element(id) {
    const node = document.getElementById(id);
    ensure(node, 'ui-contract', 'The Climate Public Beta interface is incomplete, so no climate values are displayed.');
    return node;
  }

  function setText(id, value) {
    element(id).textContent = String(value);
  }

  function setHidden(id, hidden) {
    element(id).hidden = Boolean(hidden);
  }

  function resetCounts() {
    ['entity-count', 'factual-count', 'gap-count', 'observation-count'].forEach(id => {
      const node = element(id);
      node.textContent = '—';
      node.setAttribute('aria-label', 'Count unavailable');
    });
    setText('footer-release-id', 'Not loaded');
  }

  function disableLink(id, buttonStyle) {
    const link = element(id);
    link.removeAttribute('href');
    link.removeAttribute('rel');
    link.setAttribute('aria-disabled', 'true');
    link.tabIndex = -1;
    link.classList.add(buttonStyle ? 'button--disabled' : 'text-link--disabled');
  }

  function disableFeedback() {
    disableLink('methodology-feedback', false);
    disableLink('methodology-feedback-privacy', false);
    disableLink('detail-feedback', true);
    disableLink('detail-feedback-privacy', false);
    disableLink('footer-feedback', false);
    setText('methodology-feedback-note', 'Feedback route pending human approval.');
    setText('detail-feedback-note', 'Feedback route pending human approval.');
  }

  function activateLink(id, href, buttonStyle) {
    const link = element(id);
    link.href = href;
    link.rel = 'external noopener';
    link.setAttribute('aria-disabled', 'false');
    link.tabIndex = 0;
    link.classList.remove(buttonStyle ? 'button--disabled' : 'text-link--disabled');
  }

  function enableFeedback(feedback) {
    const feedbackUrl = safeHttpsUrl(feedback.approved_feedback_url, 'feedback-url');
    const privacyUrl = safeHttpsUrl(feedback.privacy_notice_url, 'feedback-privacy-url');
    activateLink('methodology-feedback', feedbackUrl, false);
    activateLink('detail-feedback', feedbackUrl, true);
    activateLink('footer-feedback', feedbackUrl, false);
    activateLink('methodology-feedback-privacy', privacyUrl, false);
    activateLink('detail-feedback-privacy', privacyUrl, false);
    setText('methodology-feedback-note', 'This reviewed route opens outside the beta. Read the feedback privacy notice before submitting.');
    setText('detail-feedback-note', 'Include this data release, entity ID, and fact ID in your report. Read the privacy notice first.');
  }

  function failClosed(error) {
    const safeMessage = error instanceof BetaVerificationError ? error.safeMessage :
      'The exact beta release could not be verified. No climate values are displayed.';
    appState = {
      status: 'failed',
      failure_code: error instanceof BetaVerificationError ? error.code : 'unexpected-verification-failure',
      manifest: null,
      records: [],
      recordsById: new Map(),
      source: null,
      identitySource: null,
      metric: null,
      limitations: [],
      correctionLog: null,
      lastDialogTrigger: null,
    };
    resetCounts();
    disableFeedback();
    element('evidence-rows').replaceChildren();
    element('correction-history-list').replaceChildren();
    setHidden('evidence-browser', true);
    setHidden('release-history', true);
    setHidden('release-loading', true);
    setText('release-error-message', safeMessage);
    const errorPanel = element('release-error');
    errorPanel.hidden = false;
    errorPanel.tabIndex = -1;
    const dialog = element('evidence-dialog');
    if (dialog.open) dialog.close();
    errorPanel.focus({ preventScroll: false });
  }

  function parseLoadedBundle(manifest, loaded) {
    return {
      manifest,
      factual: parseJsonBytes(loaded.country_factual.bytes, 'factual-json'),
      identity: parseJsonBytes(loaded.country_identity.bytes, 'identity-json'),
      lineage: parseJsonBytes(loaded.fact_lineage.bytes, 'lineage-json'),
      identitySourceText: loaded.country_identity_source.text,
      identityTransform: parseJsonBytes(loaded.country_identity_transform.bytes, 'identity-transform-json'),
      knownLimitations: parseJsonBytes(loaded.known_limitations.bytes, 'known-limitations-json'),
      correctionLog: parseJsonBytes(loaded.correction_log.bytes, 'correction-log-json'),
    };
  }

  let eventsBound = false;

  function bindEvents() {
    if (eventsBound) return;
    eventsBound = true;
    const filters = element('evidence-filters');
    filters.addEventListener('submit', event => {
      event.preventDefault();
      renderRows();
    });
    element('entity-search').addEventListener('input', renderRows);
    element('evidence-status').addEventListener('change', renderRows);
    element('evidence-order').addEventListener('change', renderRows);
    element('evidence-rows').addEventListener('click', event => {
      const button = event.target.closest('button[data-entity-id]');
      if (!button) return;
      openDetails(button.dataset.entityId, button);
    });
    element('detail-close').addEventListener('click', () => element('evidence-dialog').close());
    element('evidence-dialog').addEventListener('click', event => {
      if (event.target === element('evidence-dialog')) element('evidence-dialog').close();
    });
    element('evidence-dialog').addEventListener('close', () => {
      const trigger = appState.lastDialogTrigger;
      appState.lastDialogTrigger = null;
      if (trigger && trigger.isConnected) trigger.focus();
    });
  }

  function formatCount(value) {
    return new Intl.NumberFormat('en').format(value);
  }

  function correctionCategoryLabel(value) {
    return value.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  }

  function renderCorrectionHistory(manifest, correctionLog) {
    setText('release-history-meta', 'Current immutable data release · ' + manifest.beta_release_id);
    setText('correction-current-statement', correctionLog.policy.current_release_statement);
    const list = element('correction-history-list');
    list.replaceChildren();
    if (correctionLog.entries.length === 0) {
      setHidden('correction-history-empty', false);
      list.hidden = true;
    } else {
      setHidden('correction-history-empty', true);
      list.hidden = false;
      const fragment = document.createDocumentFragment();
      correctionLog.entries.forEach(entry => {
        const item = document.createElement('li');
        const title = document.createElement('h3');
        title.textContent = 'Correction ' + entry.correction_id;
        const meta = document.createElement('p');
        meta.className = 'correction-entry__meta';
        [
          correctionCategoryLabel(entry.category),
          'Recorded ' + entry.recorded_at,
          'Supersedes ' + entry.superseded_release_id,
          'Corrected in ' + entry.corrected_in_release_id,
          'Decision ' + entry.decision_reference,
        ].forEach(value => {
          const part = document.createElement('span');
          part.textContent = value;
          meta.append(part);
        });
        const description = document.createElement('p');
        description.className = 'correction-entry__description';
        description.textContent = entry.description;
        const affectedLabel = document.createElement('p');
        affectedLabel.textContent = 'Exact affected artifacts';
        const artifacts = document.createElement('ul');
        artifacts.className = 'correction-entry__artifacts';
        entry.affected_artifacts.forEach(pin => {
          const pinItem = document.createElement('li');
          pinItem.textContent = pin.path + ' · SHA-256 ' + pin.sha256;
          artifacts.append(pinItem);
        });
        item.append(title, meta, description, affectedLabel, artifacts);
        fragment.append(item);
      });
      list.append(fragment);
    }
    setHidden('release-history', false);
  }

  function renderReady(manifest, verified) {
    appState = {
      status: 'ready',
      manifest,
      records: verified.records,
      recordsById: verified.recordsById,
      source: verified.source,
      identitySource: verified.identitySource,
      metric: verified.metric,
      limitations: verified.limitations,
      correctionLog: verified.correctionLog,
      hashes: verified.hashes,
      lastDialogTrigger: null,
    };
    const counts = manifest.scope.counts;
    [
      ['entity-count', counts.registry_entities, 'registry entities'],
      ['factual-count', counts.factual_series, 'factual series'],
      ['gap-count', counts.source_gaps, 'visible source gaps'],
      ['observation-count', counts.observations, 'annual observations'],
    ].forEach(([id, value, label]) => {
      const node = element(id);
      node.textContent = formatCount(value);
      node.setAttribute('aria-label', formatCount(value) + ' ' + label);
    });
    setText('release-meta', 'Data release ' + manifest.beta_release_id + ' · PRIMAP-hist v2.6.1 final · 2014–2023 · ' + manifest.scope.unit);
    setText('footer-release-id', manifest.beta_release_id);
    enableFeedback(manifest.feedback);
    renderCorrectionHistory(manifest, verified.correctionLog);
    bindEvents();
    renderRows();
    setHidden('release-error', true);
    setHidden('release-loading', true);
    const browser = element('evidence-browser');
    browser.hidden = false;
    browser.setAttribute('aria-busy', 'false');
  }

  async function init() {
    if (appState.status === 'loading' || appState.status === 'ready') return;
    appState.status = 'loading';
    resetCounts();
    disableFeedback();
    setHidden('release-error', true);
    setHidden('evidence-browser', true);
    setHidden('release-history', true);
    setHidden('release-loading', false);
    try {
      ensure(typeof window.fetch === 'function', 'fetch-unavailable', 'This browser cannot load and verify the beta artifacts.');
      ensure(typeof TextDecoder === 'function' && typeof TextEncoder === 'function', 'text-codec-unavailable', 'This browser cannot verify the beta artifact encoding.');
      ensure(typeof element('evidence-dialog').showModal === 'function', 'dialog-unavailable', 'This browser cannot provide the accessible evidence-detail view.');
      const manifest = await loadManifest();
      const loaded = await loadReleaseFiles(manifest);
      const bundle = parseLoadedBundle(manifest, loaded);
      await Promise.all([
        verifyCalculationHash(bundle.factual, 'The factual artifact'),
        verifyCalculationHash(bundle.identity, 'The identity artifact'),
        verifyCalculationHash(bundle.lineage, 'The lineage artifact'),
        verifyCalculationHash(bundle.correctionLog, 'The correction-log artifact'),
      ]);
      const verified = validateBundle(bundle);
      renderReady(manifest, verified);
    } catch (error) {
      failClosed(error);
    }
  }

  function getState() {
    return Object.freeze({
      status: appState.status,
      failure_code: appState.failure_code || null,
      beta_release_id: appState.manifest ? appState.manifest.beta_release_id : null,
      record_count: appState.records.length,
      correction_count: appState.correctionLog ? appState.correctionLog.entries.length : 0,
    });
  }

  function searchText(record) {
    return [
      record.identity.name,
      record.identity.official_name,
      record.identity.common_name,
      record.identity.iso_alpha2,
      record.identity.iso_alpha3,
      record.identity.iso_numeric,
    ].filter(Boolean).join(' ').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');
  }

  function formatExactDecimal(value) {
    ensure(typeof value === 'string' && DECIMAL.test(value), 'format-decimal', 'An emissions value is not an exact decimal string.');
    const negative = value.startsWith('-');
    const unsigned = negative ? value.slice(1) : value;
    const pieces = unsigned.split('.');
    const grouped = pieces[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (negative ? '−' : '') + grouped + (pieces.length === 2 ? '.' + pieces[1] : '');
  }

  function recordNameOrder(left, right) {
    return left.identity.name.localeCompare(right.identity.name, 'en', { sensitivity: 'base', numeric: true });
  }

  function recordMagnitudeOrder(left, right) {
    if (left.entity.evidence_state !== right.entity.evidence_state) {
      return left.entity.evidence_state === 'factual_series' ? -1 : 1;
    }
    if (left.entity.evidence_state === 'source_gap') return recordNameOrder(left, right);
    const leftValue = left.entity.observations[left.entity.observations.length - 1].value_decimal;
    const rightValue = right.entity.observations[right.entity.observations.length - 1].value_decimal;
    return compareDecimals(rightValue, leftValue) || recordNameOrder(left, right);
  }

  function tableCell(label) {
    const cell = document.createElement('td');
    cell.dataset.label = label;
    return cell;
  }

  function statusLabel(record) {
    const wrapper = document.createElement('span');
    wrapper.className = 'evidence-status' + (record.entity.evidence_state === 'source_gap' ? ' evidence-status--gap' : '');
    const icon = document.createElement('span');
    icon.className = 'evidence-status__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = record.entity.evidence_state === 'source_gap' ? 'G' : 'F';
    const label = document.createElement('span');
    label.textContent = record.entity.evidence_state === 'source_gap' ? 'Source gap' : 'Factual series';
    wrapper.append(icon, label);
    return wrapper;
  }

  function estimateCell(record, observation, label) {
    const cell = tableCell(label);
    if (record.entity.evidence_state === 'source_gap') {
      const gap = document.createElement('span');
      gap.className = 'gap-value';
      gap.textContent = 'No value';
      cell.append(gap);
      return cell;
    }
    const value = document.createElement('span');
    value.className = 'numeric';
    value.textContent = formatExactDecimal(observation.value_decimal) + ' ' + appState.metric.unit;
    cell.append(value);
    return cell;
  }

  function createEvidenceRow(record) {
    const row = document.createElement('tr');
    const identityCell = tableCell('Entity');
    const name = document.createElement('span');
    name.className = 'entity-name';
    name.textContent = record.identity.name;
    const code = document.createElement('span');
    code.className = 'entity-code';
    code.textContent = record.identity.iso_alpha3 + ' · ' + record.entity.entity_id;
    identityCell.append(name, code);

    const statusCell = tableCell('Evidence status');
    statusCell.append(statusLabel(record));
    const first = record.entity.observations[0] || null;
    const latest = record.entity.observations[record.entity.observations.length - 1] || null;
    const orderCell = tableCell('2023 magnitude order');
    if (record.rank) {
      const order = document.createElement('span');
      order.className = 'numeric';
      order.textContent = '#' + record.rank.rank + ' of ' + record.rank.denominator;
      orderCell.append(order);
      const note = document.createElement('span');
      note.className = 'rank-note';
      note.textContent = record.rank.tied ? 'Competition tie · magnitude only' : 'Magnitude only · not performance';
      orderCell.append(note);
    } else {
      const unranked = document.createElement('span');
      unranked.className = 'gap-value';
      unranked.textContent = 'Unranked source gap';
      orderCell.append(unranked);
    }

    const actionCell = tableCell('Evidence details');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'row-action';
    button.dataset.entityId = record.entity.entity_id;
    button.textContent = 'View evidence';
    button.setAttribute('aria-label', 'View complete evidence for ' + record.identity.name);
    actionCell.append(button);
    row.append(
      identityCell,
      statusCell,
      estimateCell(record, first, '2014 estimate'),
      estimateCell(record, latest, '2023 estimate'),
      orderCell,
      actionCell,
    );
    return row;
  }

  function renderRows() {
    if (appState.status !== 'ready') return;
    const query = element('entity-search').value.normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('en');
    const status = element('evidence-status').value;
    const order = element('evidence-order').value;
    const records = appState.records.filter(record => {
      const queryMatches = !query || searchText(record).includes(query);
      const statusMatches = status === 'all' ||
        (status === 'factual' && record.entity.evidence_state === 'factual_series') ||
        (status === 'gap' && record.entity.evidence_state === 'source_gap');
      return queryMatches && statusMatches;
    }).sort(order === 'magnitude' ? recordMagnitudeOrder : recordNameOrder);

    const fragment = document.createDocumentFragment();
    records.forEach(record => fragment.append(createEvidenceRow(record)));
    element('evidence-rows').replaceChildren(fragment);
    const factualCount = records.filter(record => record.entity.evidence_state === 'factual_series').length;
    const gapCount = records.length - factualCount;
    setText('results-summary', formatCount(records.length) + ' of ' + formatCount(appState.records.length) +
      ' entities · ' + formatCount(factualCount) + ' factual series · ' + formatCount(gapCount) + ' gaps');
    setHidden('no-results', records.length !== 0);
  }

  function appendDefinition(list, termText, value, options) {
    const term = document.createElement('dt');
    term.textContent = termText;
    const detail = document.createElement('dd');
    if (options && options.url) {
      const link = document.createElement('a');
      link.href = safeHttpsUrl(options.url, 'detail-url');
      link.rel = 'external noopener';
      link.textContent = String(value);
      detail.append(link);
    } else if (options && options.code) {
      const code = document.createElement('code');
      code.textContent = String(value);
      detail.append(code);
    } else {
      detail.textContent = String(value);
    }
    list.append(term, detail);
  }

  function gapReasonText(reason) {
    if (reason === 'source_unavailable') {
      return 'The frozen PRIMAP-hist v2.6.1 factual source does not provide an eligible series for this registry entity.';
    }
    return 'No eligible value is available in this release.';
  }

  function renderObservationDetails(record) {
    const body = element('detail-observations');
    body.replaceChildren();
    const fragment = document.createDocumentFragment();
    record.entity.observations.forEach(observation => {
      const row = document.createElement('tr');
      const year = document.createElement('th');
      year.scope = 'row';
      year.textContent = String(observation.year);
      const value = document.createElement('td');
      value.className = 'numeric';
      value.textContent = formatExactDecimal(observation.value_decimal) + ' ' + appState.metric.unit;
      const fact = document.createElement('td');
      const code = document.createElement('code');
      code.className = 'fact-id';
      code.textContent = observation.fact_id;
      fact.append(code);
      row.append(year, value, fact);
      fragment.append(row);
    });
    body.append(fragment);
  }

  function renderLineageDetails(record) {
    const list = element('detail-lineage');
    list.replaceChildren();
    const source = appState.source;
    const identitySource = appState.identitySource;
    const metric = appState.metric;
    const firstFact = record.facts[0] || null;
    appendDefinition(list, 'Beta data release ID', appState.manifest.beta_release_id, { code: true });
    appendDefinition(list, 'Opaque entity ID', record.entity.entity_id, { code: true });
    appendDefinition(list, 'Entity name source', identitySource.title + ' ' + identitySource.version + ' (' + identitySource.licence_identifier + ')');
    appendDefinition(list, 'Identity source checksum', identitySource.source_checksum_sha256, { code: true });
    appendDefinition(list, 'Source publisher', source.publisher);
    appendDefinition(list, 'Source title and version', source.title + ' — ' + source.version, { url: source.source_url });
    appendDefinition(list, 'Publication date', source.publication_date);
    appendDefinition(list, 'Retrieval date', source.retrieval_date);
    appendDefinition(list, 'Raw source SHA-256', source.raw_source_sha256, { code: true });
    appendDefinition(list, 'Factual transformation hash', appState.hashes.factual_calculation, { code: true });
    appendDefinition(list, 'Fact-lineage hash', appState.hashes.lineage_calculation, { code: true });
    appendDefinition(list, 'Identity transformation file SHA-256', appState.hashes.identity_transform_file, { code: true });
    appendDefinition(list, 'Metric', metric.label);
    appendDefinition(list, 'Unit and years', metric.unit + ' · ' + metric.start_year + '–' + metric.end_year);
    appendDefinition(list, 'Gases', metric.gas_basket.join(', '));
    appendDefinition(list, 'Sectors', metric.sectors.join(', '));
    appendDefinition(list, 'Scenario and GWP convention', metric.scenario + ' · ' + metric.gwp_convention);
    appendDefinition(list, 'LULUCF treatment', 'Excluded');
    appendDefinition(list, 'International bunkers', 'Not specified for the selected source category');
    appendDefinition(list, 'Uncertainty', 'Bounds are not provided in the selected rows');
    appendDefinition(list, 'Evidence plane and review state', 'Harmonized factual estimate · Independently reviewed beta data · Not assessed production');
    appendDefinition(list, 'Attribution', source.attribution);
    appendDefinition(list, 'Licence', source.licence_identifier, { url: source.licence_terms_url });
    appendDefinition(list, 'Modification notice', source.transformation_notice);
    if (firstFact) {
      appendDefinition(list, 'Transformation', firstFact.transformation.operation);
      appendDefinition(list, 'Rounding', firstFact.transformation.rounding);
      appendDefinition(list, 'Frozen source locator', firstFact.source_locator.file + ' · CSV row ' + firstFact.source_locator.csv_row, { code: true });
      appendDefinition(list, 'Opaque beta fact IDs', record.entity.observations.map(item => item.fact_id).join(', '), { code: true });
    } else {
      appendDefinition(list, 'Known source gap', gapReasonText(record.entity.gap_reason));
      appendDefinition(list, 'Opaque beta fact IDs', 'None in this release');
    }
  }

  function renderLimitations(record) {
    const list = element('detail-limitations');
    list.replaceChildren();
    const limitations = Array.from(appState.limitations);
    if (record.entity.evidence_state === 'source_gap') {
      limitations.push('No value available in this release; this entity remains visible and unranked.');
      limitations.push('Missing evidence does not indicate better climate performance.');
    }
    const fragment = document.createDocumentFragment();
    Array.from(new Set(limitations)).forEach(textValue => {
      const item = document.createElement('li');
      item.textContent = textValue;
      fragment.append(item);
    });
    list.append(fragment);
  }

  function openDetails(entityId, trigger) {
    if (appState.status !== 'ready') return;
    const record = appState.recordsById.get(entityId);
    if (!record) {
      failClosed(new BetaVerificationError('detail-record-missing', 'The selected evidence record is unavailable. No climate values are displayed.'));
      return;
    }
    appState.lastDialogTrigger = trigger;
    setText('detail-title', record.identity.name);
    setText('detail-summary', record.identity.iso_alpha3 + ' · ' +
      (record.entity.evidence_state === 'factual_series' ? 'Factual series' : 'Explicit source gap') +
      ' · Data release ' + appState.manifest.beta_release_id);
    if (record.entity.evidence_state === 'factual_series') {
      const rank = record.rank;
      element('detail-truth').textContent = '2023 emissions magnitude order: #' + rank.rank + ' of ' +
        rank.denominator + (rank.tied ? ' (competition tie).' : '.') +
        ' This compares entities using the same harmonized metric; it is not a performance, ambition, fairness, or delivery score.';
      setHidden('detail-observations-section', false);
      setHidden('detail-gap-section', true);
      setText('observations-unit', appState.metric.unit + ' · exact stored decimal values');
      renderObservationDetails(record);
    } else {
      element('detail-truth').textContent = 'No value available in this release; visible and unranked. Missing evidence does not indicate better climate performance.';
      setHidden('detail-observations-section', true);
      setHidden('detail-gap-section', false);
      setText('detail-gap-reason', gapReasonText(record.entity.gap_reason));
      element('detail-observations').replaceChildren();
    }
    renderLineageDetails(record);
    renderLimitations(record);
    element('detail-feedback').setAttribute('aria-label', 'Report a data or attribution issue for ' + record.identity.name);
    const dialog = element('evidence-dialog');
    dialog.showModal();
    const shell = dialog.querySelector('.dialog-shell');
    if (shell) shell.scrollTop = 0;
    element('detail-close').focus();
  }

  return {
    init,
    getState,
    validateManifest,
    validateBundle,
    validateCorrectionLog,
    renderCorrectionHistory,
    compareDecimals,
  };
})();

window.CLIMATE_PUBLIC_BETA = CLIMATE_PUBLIC_BETA;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CLIMATE_PUBLIC_BETA.init(), { once: true });
} else {
  CLIMATE_PUBLIC_BETA.init();
}
