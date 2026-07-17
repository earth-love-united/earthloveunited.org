#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TextDecoder, TextEncoder } = require('node:util');
const { webcrypto } = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const FILES = Object.freeze({
  html: 'climate-public-beta/index.html',
  css: 'climate-public-beta/css/beta.css',
  js: 'climate-public-beta/js/beta.js',
  notices: 'climate-public-beta/THIRD_PARTY_NOTICES.txt',
});
const DEPLOYMENT_FILES = Object.freeze({
  headers: 'climate-public-beta/_headers',
});
const PRODUCT_LABEL = 'Climate Public Beta';
const SHA = 'a'.repeat(64);
const INVALID_BETA_RELEASE_IDS = Object.freeze([
  'a1',
  'fixture_beta-1',
  'fixture..beta-1',
  `a${'b'.repeat(63)}1`,
]);

function readRegular(relative) {
  const absolute = path.join(ROOT, relative);
  const stat = fs.lstatSync(absolute);
  assert(stat.isFile() && !stat.isSymbolicLink(), `${relative} must be a regular non-symlink file`);
  return fs.readFileSync(absolute, 'utf8');
}

function readUi(options = {}) {
  const ui = Object.fromEntries(
    Object.entries(FILES).map(([key, relative]) => [key, readRegular(relative)]),
  );
  if (options.includeDeploymentControls === true) {
    Object.entries(DEPLOYMENT_FILES).forEach(([key, relative]) => {
      ui[key] = readRegular(relative);
    });
  }
  return ui;
}

function requireText(text, needle, message) {
  assert(text.includes(needle), message || `missing required text: ${needle}`);
}

function tagWithId(html, id) {
  const match = html.match(new RegExp(`<[^>]+\\bid=["']${id}["'][^>]*>`, 'i'));
  assert(match, `missing element #${id}`);
  return match[0];
}

function contrastRatio(foreground, background) {
  function luminance(hex) {
    const channels = hex.match(/[a-f0-9]{2}/gi).map(channel => parseInt(channel, 16) / 255)
      .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  const left = luminance(foreground.replace('#', ''));
  const right = luminance(background.replace('#', ''));
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

function validateHtml(html) {
  requireText(html, '<html lang="en">', 'beta HTML must declare its language');
  requireText(html, 'name="viewport" content="width=device-width, initial-scale=1"', 'beta HTML must support narrow and zoomed viewports');
  assert((html.match(/<h1\b/gi) || []).length === 1, 'beta HTML must contain exactly one h1');
  assert((html.match(/<main\b/gi) || []).length === 1, 'beta HTML must contain exactly one main landmark');
  requireText(html, 'class="skip-link" href="#main-content"', 'beta HTML must provide a skip link');
  requireText(html, 'role="alert" hidden', 'beta HTML must provide a hidden fail-closed alert');
  requireText(html, 'aria-live="polite" aria-atomic="true"', 'beta HTML must announce release and filter status');
  requireText(html, '<dialog id="evidence-dialog"', 'beta HTML must provide a semantic evidence dialog');
  assert(/<section\s+id="release-history"[^>]*\bhidden\b/.test(html),
    'release/correction history must remain hidden until exact release verification succeeds');
  requireText(html, 'id="correction-current-statement"', 'beta HTML must provide the verified current-release statement');
  requireText(html, 'id="correction-history-list"', 'beta HTML must provide the privacy-safe correction-history list');
  requireText(html, 'aria-labelledby="detail-title" aria-describedby="detail-summary"', 'evidence dialog must have an accessible name and description');
  requireText(html, '<caption class="sr-only">', 'data tables must have captions');
  requireText(html, '<noscript>', 'beta HTML must fail closed without JavaScript');
  assert((html.match(/Climate Public Beta/g) || []).length >= 5, 'beta label must remain persistent across the surface');
  [
    'Harmonized factual emissions evidence, not a climate-performance assessment.',
    'PRIMAP-hist v2.6.1 final',
    'not official Party inventory values',
    'exclude LULUCF',
    'do not include uncertainty bounds',
    'Climate performance: Not assessed.',
    'Commitments and targets are not included in this beta.',
    'No value available in this release; visible and unranked.',
    'Missing evidence does not indicate better climate performance.',
    'not an official ISO or UN M49 publication',
  ].forEach(copy => requireText(html, copy, `missing required beta truth copy: ${copy}`));

  ['entity-search', 'evidence-status', 'evidence-order'].forEach(id => {
    requireText(html, `for="${id}"`, `missing explicit label for #${id}`);
    tagWithId(html, id);
  });
  ['methodology-feedback', 'methodology-feedback-privacy', 'detail-feedback',
    'detail-feedback-privacy', 'footer-feedback'].forEach(id => {
    const tag = tagWithId(html, id);
    assert(!/\bhref\s*=/.test(tag), `#${id} must not have an href before manifest approval`);
    assert(/aria-disabled=["']true["']/.test(tag) && /tabindex=["']-1["']/.test(tag),
      `#${id} must be inaccessible before manifest approval`);
  });
  assert(!/<(?:script|style)\b[^>]*>\s*[^<\s]/i.test(html), 'beta HTML must not contain inline executable code or style');
  assert(!/\son[a-z]+\s*=/i.test(html), 'beta HTML must not contain inline event handlers');
  assert(!/<(?:img|picture|svg|canvas)\b/i.test(html), 'first beta must not contain image, model SVG, canvas, or globe surfaces');
  assert(!/<script\b[^>]*\btype=["']module["']/i.test(html), 'beta scripts must remain classic scripts');
  assert(!/<(?:script|link|img|source)\b[^>]*(?:src|href|srcset)=["']https?:/i.test(html),
    'beta must not automatically load external scripts, styles, images, or sources');
}

function validateCss(css) {
  requireText(css, 'min-width: 20rem', 'beta CSS must preserve a 320px layout floor');
  requireText(css, ':focus-visible', 'beta CSS must expose keyboard focus');
  requireText(css, '@media (prefers-reduced-motion: reduce)', 'beta CSS must honor reduced motion');
  requireText(css, '@media (forced-colors: active)', 'beta CSS must support forced colors');
  requireText(css, '.beta-masthead', 'beta CSS must style the persistent label');
  requireText(css, 'position: sticky', 'beta label must remain persistent');
  requireText(css, '.table-wrap td::before', 'narrow table rows must retain visible column labels');
  requireText(css, '.correction-history-list', 'beta CSS must style the visible correction history');
  requireText(css, '[hidden]', 'hidden UI must have an explicit non-interactive state');
  assert(!/opacity\s*:\s*0(?:\D|$)/i.test(css), 'beta CSS must not create invisible click interceptors');
  assert(!/(?:@import\s+|url\(\s*["']?)https?:/i.test(css), 'beta CSS must not load external resources');
  [
    ['#f4faf6', '#06110d'],
    ['#c6d7cf', '#06110d'],
    ['#9fb4aa', '#06110d'],
    ['#03110a', '#8ce7bd'],
  ].forEach(([foreground, background]) => {
    assert(contrastRatio(foreground, background) >= 4.5,
      `key color pair ${foreground}/${background} must meet WCAG AA normal-text contrast`);
  });
}

function validateJs(js) {
  new vm.Script(js, { filename: FILES.js });
  requireText(js, "const MANIFEST_PATH = '/data/climate/public-beta/runtime/runtime-manifest.json';",
    'beta runtime must load only its dedicated manifest');
  requireText(js, "window.crypto.subtle.digest('SHA-256', bytes)", 'beta runtime must hash fetched artifacts with WebCrypto');
  requireText(js, 'digest === entry.sha256', 'beta runtime must compare each fetched digest to its manifest pin');
  requireText(js, 'bytes.byteLength === expectedBytes', 'beta runtime must compare exact artifact byte sizes');
  requireText(js, 'url.origin === window.location.origin', 'beta runtime must enforce same-origin artifact delivery');
  requireText(js, "redirect: 'error'", 'beta runtime must reject redirects');
  requireText(js, 'response.url === url.href', 'beta runtime must verify the final response URL');
  requireText(js, "content_state: 'reviewed_beta_release'", 'beta runtime must require reviewed content eligibility');
  requireText(js, 'public_beta_source_rights_reviewed: true', 'beta runtime must require completed source-rights review');
  requireText(js, 'public_beta_redistribution_authorized: true', 'beta runtime must require exact beta redistribution eligibility');
  requireText(js, 'independent_review_state: \'reviewed\'', 'beta runtime must require independent data review');
  requireText(js, 'assessed_production_authority: false', 'beta runtime must preserve the non-assessed boundary');
  requireText(js, "if (manifest.content_state === 'withheld')", 'beta runtime must reject withheld releases');
  requireText(js, "if (manifest.content_state === 'withdrawn')", 'beta runtime must reject withdrawn releases');
  requireText(js, "'feedback-not-approved'", 'reviewed releases must fail closed without feedback and privacy decisions');
  requireText(js, 'element(\'evidence-rows\').replaceChildren();', 'fail-closed state must remove any displayed rows');
  requireText(js, "setHidden('evidence-browser', true);", 'fail-closed state must hide the evidence browser');
  requireText(js, "setHidden('release-history', true);", 'fail-closed state must hide correction history');
  requireText(js, 'renderCorrectionHistory(manifest, verified.correctionLog);',
    'verified runtime must visibly render its exact correction history');
  requireText(js, "verifyCalculationHash(bundle.correctionLog, 'The correction-log artifact')",
    'correction history must pass its exact internal calculation-hash check before display');
  requireText(js, 'failClosed(error);', 'initialization errors must enter the visible fail-closed state');
  requireText(js, 'window.CLIMATE_PUBLIC_BETA = CLIMATE_PUBLIC_BETA;', 'classic beta module must have an explicit window export');
  assert(!/navigator\.serviceWorker|serviceWorker\.register/i.test(js), 'beta runtime must not register or reference a service worker');
  assert(!/\bfetch\s*\(\s*["']https?:/i.test(js), 'beta runtime must not automatically fetch an external URL');
  assert(!/\b(?:import|export)\s+(?:\{|default|const|function|class|\*)/m.test(js), 'beta runtime must remain a classic script');
  assert(!/\.innerHTML\s*=/.test(js), 'beta runtime must not inject artifact text as HTML');
}

function validateHeaders(headers) {
  requireText(headers, "default-src 'none'", 'beta CSP must default deny');
  requireText(headers, "script-src 'self'", 'beta CSP must allow only same-origin scripts');
  requireText(headers, "style-src 'self'", 'beta CSP must allow only same-origin styles');
  requireText(headers, "connect-src 'self'", 'beta CSP must allow only same-origin data requests');
  requireText(headers, "frame-ancestors 'none'", 'beta CSP must prevent framing');
  requireText(headers, 'X-Content-Type-Options: nosniff', 'beta headers must prevent MIME sniffing');
  requireText(headers, 'Referrer-Policy: no-referrer', 'beta headers must not leak evidence locations');
  requireText(headers, 'Cache-Control: no-store', 'beta headers must support immediate withdrawal');
  assert(!/connect-src[^\n;]*https?:/i.test(headers), 'beta CSP must not permit external automatic connections');
}

function fixtureHeaders() {
  return [
    '/*',
    '  Cache-Control: no-store',
    "  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'",
    '  Referrer-Policy: no-referrer',
    '  X-Content-Type-Options: nosniff',
    '',
  ].join('\n');
}

function validateNoticeTemplate(notices) {
  requireText(notices, 'STATUS: INCOMPLETE — NOT FOR STAGING, SHARING, OR PUBLICATION',
    'notice template must be unmistakably incomplete');
  requireText(notices, 'PUBLICATION AUTHORITY: NONE', 'notice template must grant no publication authority');
  requireText(notices, 'RIGHTS APPROVAL: NONE', 'notice template must grant no rights approval');
  requireText(notices, 'PRIMAP-hist', 'notice template must reserve the PRIMAP notice section');
  requireText(notices, 'Debian iso-codes', 'notice template must reserve the identity notice section');
  requireText(notices, 'release-readiness and\nstaging controls must reject this template',
    'notice template must state its own release-readiness and staging rejection boundary');
}

function validateReviewedNotices(notices, options = {}) {
  const betaReleaseId = options.betaReleaseId;
  assert(typeof betaReleaseId === 'string' && /^(?!.*\.\.)[a-z0-9][a-z0-9.-]{1,62}[a-z0-9]$/.test(betaReleaseId),
    'reviewed notice validation requires the exact beta release ID');
  requireText(notices, 'STATUS: COMPLETE — REVIEWED FOR CLIMATE PUBLIC BETA',
    'reviewed notice must have an explicit completed status');
  requireText(notices, 'PUBLICATION AUTHORITY: EXTERNAL SIGNED BETA APPROVAL REQUIRED',
    'reviewed notice must not claim publication authority for itself');
  requireText(notices, 'RIGHTS REVIEW: COMPLETED; SEE SIGNED SOURCE-RIGHTS REVIEW',
    'reviewed notice must point to the separately authenticated rights review');
  requireText(notices, `Beta release ID: ${betaReleaseId}`,
    'reviewed notice must bind the selected beta release ID');
  [
    'PRIMAP-hist',
    'CC BY 4.0',
    'Required attribution wording:',
    'Modification/transformation notice:',
    'Source SHA-256:',
    'Debian iso-codes',
    'LGPL-2.1-or-later',
    'Copyright notice:',
    'Complete corresponding-source information:',
    'No-warranty disclaimer:',
    'Public-beta rights decision reference:',
  ].forEach(needle => requireText(notices, needle, `reviewed notice is missing: ${needle}`));
  const sourceHashes = notices.match(/Source SHA-256:\s*[a-f0-9]{64}/g) || [];
  assert(sourceHashes.length === 2, 'reviewed notice must contain exactly two lowercase source SHA-256 values');
  const urls = notices.match(/https:\/\/[^\s<>]+/g) || [];
  assert(urls.length >= 4, 'reviewed notice must include exact HTTPS source and licence routes');
  assert(!/(?:\[HUMAN|\[UNASSIGNED|\[UNCOMPUTED|STATUS:\s*INCOMPLETE|RIGHTS APPROVAL:\s*NONE|PUBLICATION AUTHORITY:\s*NONE)/i.test(notices),
    'reviewed notice contains an unresolved template marker');
  requireText(notices, 'does not contain its own hash',
    'reviewed notice must preserve the acyclic external-hash statement');
  return { status: 'pass', beta_release_id: betaReleaseId };
}

function validateUi(ui, options = {}) {
  validateHtml(ui.html);
  validateCss(ui.css);
  validateJs(ui.js);
  if (typeof ui.headers === 'string') validateHeaders(ui.headers);
  else assert(options.requireHeaders !== true,
    'reviewed/release UI validation requires the deployment header control');
  if (options.noticeMode === 'reviewed') {
    validateReviewedNotices(ui.notices, { betaReleaseId: options.betaReleaseId });
  } else {
    assert(!options.noticeMode || options.noticeMode === 'template', 'unknown beta notice validation mode');
    validateNoticeTemplate(ui.notices);
  }
  return { status: 'pass' };
}

function fixtureReviewedNotices(betaReleaseId = 'fixture-beta-1') {
  return `EARTH LOVE UNITED — CLIMATE PUBLIC BETA
STATUS: COMPLETE — REVIEWED FOR CLIMATE PUBLIC BETA
PUBLICATION AUTHORITY: EXTERNAL SIGNED BETA APPROVAL REQUIRED
RIGHTS REVIEW: COMPLETED; SEE SIGNED SOURCE-RIGHTS REVIEW

PRIMAP-hist
Licence: CC BY 4.0
Canonical source: https://source.fixture.invalid/primap
Licence terms: https://licence.fixture.invalid/cc-by-4.0
Source SHA-256: ${'a'.repeat(64)}
Required attribution wording: Fixture-only reviewed wording.
Modification/transformation notice: Fixture-only transformation wording.
No-warranty disclaimer: Fixture-only no-warranty wording.

Debian iso-codes
Licence: LGPL-2.1-or-later
Upstream source: https://source.fixture.invalid/iso-codes
Licence terms: https://licence.fixture.invalid/lgpl-2.1
Source SHA-256: ${'b'.repeat(64)}
Copyright notice: Fixture-only reviewed copyright wording.
Modification/transformation notice: Fixture-only identity transformation wording.
Complete corresponding-source information: https://source.fixture.invalid/iso-codes-source
No-warranty disclaimer: Fixture-only no-warranty wording.

Beta release ID: ${betaReleaseId}
Public-beta rights decision reference: fixture-rights-decision-reference
This notice does not contain its own hash; later governance artifacts bind it externally.
`;
}

function loadRuntimeContract(js) {
  const context = vm.createContext({
    window: {
      location: { origin: 'https://beta.example.invalid' },
      crypto: webcrypto,
      fetch: async () => { throw new Error('unexpected fixture fetch'); },
    },
    document: { readyState: 'loading', addEventListener() {} },
    URL,
    TextDecoder,
    TextEncoder,
    Intl,
    Map,
    Set,
    Object,
    Array,
    JSON,
    String,
    Number,
    RegExp,
    Error,
    Promise,
  });
  new vm.Script(js, { filename: FILES.js }).runInContext(context);
  assert(context.window.CLIMATE_PUBLIC_BETA, 'beta runtime window export missing after evaluation');
  return context;
}

function fixtureManifest() {
  const betaReleaseId = 'fixture-beta-1';
  const releaseRoot = `data/climate/public-beta/runtime/releases/${betaReleaseId}/`;
  const names = {
    country_factual: 'country-factual.json',
    country_identity: 'country-identity.json',
    country_identity_source: 'country-identity.SOURCE.md',
    country_identity_transform: 'country-identity-transform.json',
    fact_lineage: 'fact-lineage.json',
    known_limitations: 'known-limitations.json',
    correction_log: 'correction-log.json',
  };
  return {
    schema_version: '1.0.0',
    manifest_id: `elu-climate-public-beta-runtime-${betaReleaseId}`,
    beta_release_id: betaReleaseId,
    product_tier: 'climate_public_beta',
    product_label: 'Climate Public Beta — harmonized factual emissions evidence, not a climate-performance assessment.',
    content_state: 'reviewed_beta_release',
    independent_review_state: 'reviewed',
    assessed_production_authority: false,
    official_inventory: false,
    climate_performance_assessment: false,
    scope: {
      source_id: 'primap-hist-2.6.1-final',
      source_version: '2.6.1 final, 13 March 2025',
      display_years: { start: 2014, end: 2023 },
      counts: { registry_entities: 249, factual_series: 206, source_gaps: 43, observations: 2060 },
      metric_id: 'annual_economy_wide_ghg_excluding_lulucf',
      unit: 'MtCO2e/yr',
      comparison_year: 2023,
    },
    feedback: {
      approved_feedback_url: 'https://feedback.example.invalid/report',
      privacy_notice_url: 'https://feedback.example.invalid/privacy',
    },
    files: Object.fromEntries(Object.entries(names).map(([key, filename]) => [key, {
      path: releaseRoot + filename,
      sha256: SHA,
      bytes: 100,
    }])),
  };
}

function validateManifestInContext(context, manifest) {
  context.__manifest = JSON.stringify(manifest);
  return vm.runInContext('window.CLIMATE_PUBLIC_BETA.validateManifest(JSON.parse(__manifest))', context);
}

function reviewedStatus() {
  return {
    content_state: 'reviewed_beta_release',
    public_beta_source_rights_reviewed: true,
    public_beta_redistribution_authorized: true,
    independent_review_state: 'reviewed',
    beta_runtime_release_eligible: true,
    assessed_production_authority: false,
  };
}

function letters(index, width) {
  let value = index;
  let output = '';
  for (let position = 0; position < width; position += 1) {
    output = String.fromCharCode(65 + (value % 26)) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

function fixtureCorrectionEntry(manifest) {
  const supersededReleaseId = 'fixture-beta-0';
  return {
    correction_id: `corr-${'c'.repeat(16)}`,
    superseded_release_id: supersededReleaseId,
    corrected_in_release_id: manifest.beta_release_id,
    recorded_at: '2026-07-17T12:00:00.000Z',
    category: 'source_locator',
    description: 'Corrected the affected source locator after exact independent review.',
    affected_artifacts: [{
      path: `data/climate/public-beta/runtime/releases/${supersededReleaseId}/fact-lineage.json`,
      sha256: 'c'.repeat(64),
    }],
    decision_reference: `elu-correction-decision:${'d'.repeat(16)}`,
  };
}

function fixtureCorrectionLog(manifest, entries = []) {
  return {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/public-beta-reviewed-correction-log.schema.json',
    artifact_kind: 'public_beta_correction_log',
    beta_release_id: manifest.beta_release_id,
    content_state: 'reviewed_beta_release',
    review_input_pin: entries.length ? {
      path: `private-review/climate-public-beta/${manifest.beta_release_id}/prior-corrections.review-input.json`,
      sha256: 'b'.repeat(64),
    } : null,
    policy: {
      scope: 'Corrections to source identity, source locators, transformations, values, limitations, or display wording require a new immutable beta release ID and renewed exact-byte reviews.',
      current_release_statement: entries.length
        ? `This immutable release records ${entries.length} privacy-safe correction${entries.length === 1 ? '' : 's'} to superseded beta releases.`
        : 'No corrections are recorded for this immutable release.',
    },
    entries,
    assessed_production_authority: false,
    calculation_hash: SHA,
  };
}

function fixtureBundle() {
  const manifest = fixtureManifest();
  const identities = [];
  const entities = [];
  const facts = [];
  let factOrdinal = 0;
  for (let entityOrdinal = 0; entityOrdinal < 249; entityOrdinal += 1) {
    const entityId = `elu-e-${entityOrdinal.toString(16).padStart(16, '0')}`;
    const alpha2 = letters(entityOrdinal, 2);
    const alpha3 = letters(entityOrdinal, 3);
    const sourceEntityId = `iso3166-1:${alpha3}`;
    const observations = [];
    if (entityOrdinal < 206) {
      for (let yearOffset = 0; yearOffset < 10; yearOffset += 1) {
        const factId = `elu-f-${factOrdinal.toString(16).padStart(16, '0')}`;
        const year = 2014 + yearOffset;
        const value = `${(entityOrdinal + 1) * 100 + yearOffset}.000`;
        observations.push({ fact_id: factId, year, value_decimal: value });
        facts.push({
          fact_id: factId,
          entity_id: entityId,
          source_id: 'primap-hist-2.6.1-final',
          source_entity_id: sourceEntityId,
          source_iso_alpha3: alpha3,
          source_fact_id: `fact:primap-hist-2.6.1:source:${factOrdinal}`,
          promoted_fact_id: `fact:primap-hist-2.6.1:normalized:${factOrdinal}`,
          year,
          normalized_value_decimal: value,
          source_locator: {
            file: 'PRIMAP-hist_v2.6.1_final_13-Mar-2025.csv',
            csv_row: entityOrdinal + 2,
            row_key: {
              source: 'PRIMAP-hist_v2.6.1_final',
              scenario: 'HISTTP',
              provenance: 'fixture provenance',
              area: alpha3,
              entity: 'KYOTOGHG (AR6GWP100)',
              unit: 'CO2 * gigagram / yr',
              category: 'M.0.EL',
            },
          },
          transformation: {
            input_unit: 'CO2 * gigagram / yr',
            output_unit: 'MtCO2e/yr',
            operation: 'Exact fixture decimal shift.',
            rounding: 'none; move the source decimal point three places left using source text and retain source digits, including trailing fractional zeros',
          },
        });
        factOrdinal += 1;
      }
    }
    entities.push({
      entity_id: entityId,
      evidence_state: entityOrdinal < 206 ? 'factual_series' : 'source_gap',
      gap_reason: entityOrdinal < 206 ? null : 'source_unavailable',
      observations,
    });
    identities.push({
      entity_id: entityId,
      source_entity_id: sourceEntityId,
      name: `Fixture Entity ${entityOrdinal + 1}`,
      official_name: null,
      common_name: null,
      iso_alpha2: alpha2,
      iso_alpha3: alpha3,
      iso_numeric: String(entityOrdinal).padStart(3, '0'),
    });
  }
  assert.equal(facts.length, 2060);
  const metric = {
    id: 'annual_economy_wide_ghg_excluding_lulucf',
    label: 'Harmonized estimate: economy-wide GHG excluding LULUCF (AR6 GWP100)',
    unit: 'MtCO2e/yr',
    plane: 'harmonized',
    evidence_class: 'harmonized_estimate',
    scenario: 'HISTTP',
    gas_basket: ['CO2', 'CH4', 'N2O', 'HFCs', 'PFCs', 'SF6', 'NF3'],
    sectors: ['national_total_excluding_lulucf'],
    start_year: 2014,
    end_year: 2023,
    latest_year: 2023,
    gwp_convention: 'AR6GWP100',
    lulucf: 'excluded',
    international_bunkers: 'not_specified_for_selected_category',
    uncertainty_status: 'not_provided_in_selected_rows',
  };
  const pin = pathValue => ({ path: pathValue, sha256: SHA });
  const factual = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/public-beta-reviewed-country-factual.schema.json',
    artifact_kind: 'public_beta_country_factual',
    beta_release_id: manifest.beta_release_id,
    status: reviewedStatus(),
    input_pins: [pin('inputs/registry.json'), pin('inputs/promotion.json'), pin('inputs/review.json')],
    allocation_scheme: 'elu-opaque-allocation-v1',
    metric,
    limitations: ['Not official.', 'LULUCF excluded.', 'No uncertainty bounds.', 'Bunkers not asserted.', 'No assessment.'],
    coverage: { entities: 249, factual_series: 206, source_gaps: 43, observations: 2060 },
    entities,
    calculation_hash: SHA,
  };
  const identity = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/public-beta-reviewed-country-identity.schema.json',
    artifact_kind: 'public_beta_country_identity',
    beta_release_id: manifest.beta_release_id,
    status: reviewedStatus(),
    input_pins: [pin('inputs/registry.json')],
    allocation: { scheme: 'elu-opaque-allocation-v1', statement: 'Opaque fixture allocation.' },
    identity_source: {
      source_registry_id: 'debian-iso-codes-4.20.1-1-iso-3166-1',
      publisher: 'Fixture publisher',
      title: 'Fixture identity source',
      version: '4.20.1-1',
      source_url: 'https://identity.example.invalid/source',
      retrieval_url: 'https://identity.example.invalid/retrieval',
      source_checksum_sha256: SHA,
      licence_identifier: 'LGPL-2.1-or-later',
      licence_terms_url: 'https://identity.example.invalid/licence',
      attribution: 'Fixture attribution',
      no_warranty: true,
      existing_project_review_status: 'confirmed_by_ct01',
      public_beta_rights_review_status: 'completed',
      public_beta_redistribution_authorized: true,
    },
    coverage: { identities: 249 },
    identities,
    calculation_hash: SHA,
  };
  const lineage = {
    schema_version: '1.0.0',
    schema_ref: 'data/climate/schemas/public-beta-reviewed-fact-lineage.schema.json',
    artifact_kind: 'public_beta_fact_lineage',
    beta_release_id: manifest.beta_release_id,
    status: reviewedStatus(),
    input_pins: [pin('inputs/promotion.json'), pin('inputs/review.json'), pin('inputs/source-registry.json')],
    promotion_evidence: {
      promotion_id: 'ct-10c:primap-hist-2.6.1:economy-wide:2014-2023',
      promotion_calculation_hash: SHA,
      factual_review_id: 'fixture-independent-review',
      factual_review_calculation_hash: SHA,
      factual_display_review_passed: true,
      production_runtime_release_allowed: false,
    },
    source: {
      source_id: 'primap-hist-2.6.1-final',
      publisher: 'Fixture publisher',
      title: 'Fixture PRIMAP source',
      version: '2.6.1 final, 13 March 2025',
      publication_date: '2025-03-13',
      retrieval_date: '2026-07-15',
      source_url: 'https://source.example.invalid/canonical',
      retrieval_url: 'https://source.example.invalid/retrieval',
      raw_source_sha256: SHA,
      licence_identifier: 'CC-BY-4.0',
      licence_terms_url: 'https://source.example.invalid/licence',
      attribution: 'Fixture source attribution',
      transformation_notice: 'Fixture transformation notice',
      existing_project_registry_state: 'approved',
      public_beta_rights_review_status: 'completed',
      public_beta_redistribution_authorized: true,
    },
    coverage: { facts: 2060 },
    facts,
    calculation_hash: SHA,
  };
  return {
    manifest,
    factual,
    identity,
    lineage,
    identitySourceText: 'Completed reviewed identity source-access notice.',
    identityTransform: { beta_release_id: manifest.beta_release_id, assessed_production_authority: false },
    knownLimitations: { beta_release_id: manifest.beta_release_id, assessed_production_authority: false },
    correctionLog: fixtureCorrectionLog(manifest),
  };
}

function validateBundleInContext(context, bundle) {
  context.__bundle = JSON.stringify(bundle);
  return vm.runInContext('window.CLIMATE_PUBLIC_BETA.validateBundle(JSON.parse(__bundle))', context);
}

function renderCorrectionHistoryInContext(context, manifest, correctionLog) {
  function node(tagName = '') {
    return {
      tagName,
      textContent: '',
      hidden: true,
      className: '',
      children: [],
      append(...items) {
        items.forEach(item => {
          if (item && item.isFragment) this.children.push(...item.children);
          else this.children.push(item);
        });
      },
      replaceChildren(...items) {
        this.children = [];
        this.append(...items);
      },
    };
  }
  const nodes = Object.fromEntries([
    'release-history-meta', 'correction-current-statement', 'correction-history-list',
    'correction-history-empty', 'release-history',
  ].map(id => [id, node(id)]));
  context.document = {
    getElementById(id) { return nodes[id] || null; },
    createElement(tagName) { return node(tagName); },
    createDocumentFragment() {
      const fragment = node('#fragment');
      fragment.isFragment = true;
      return fragment;
    },
  };
  context.__historyManifest = JSON.stringify(manifest);
  context.__historyLog = JSON.stringify(correctionLog);
  vm.runInContext(
    'window.CLIMATE_PUBLIC_BETA.renderCorrectionHistory(JSON.parse(__historyManifest), JSON.parse(__historyLog))',
    context,
  );
  return nodes;
}

function rejectedManifest(context, id, mutate) {
  const manifest = fixtureManifest();
  mutate(manifest);
  assert.throws(() => validateManifestInContext(context, manifest), undefined, id);
}

function runSelfTest() {
  const foundationUi = readUi();
  validateUi(foundationUi, { noticeMode: 'template', requireHeaders: false });
  const ui = { ...foundationUi, headers: fixtureHeaders() };
  validateUi(ui, { noticeMode: 'template', requireHeaders: true });
  let cases = 1;
  assert.equal(validateReviewedNotices(fixtureReviewedNotices(), { betaReleaseId: 'fixture-beta-1' }).status, 'pass'); cases += 1;
  assert.throws(() => validateReviewedNotices(ui.notices, { betaReleaseId: 'fixture-beta-1' }),
    /completed status|unresolved template marker/); cases += 1;
  assert.throws(() => validateReviewedNotices(fixtureReviewedNotices('other-beta'), { betaReleaseId: 'fixture-beta-1' }),
    /selected beta release ID/); cases += 1;
  INVALID_BETA_RELEASE_IDS.forEach(invalidReleaseId => {
    assert.throws(() => validateReviewedNotices(fixtureReviewedNotices(invalidReleaseId), {
      betaReleaseId: invalidReleaseId,
    }), /exact beta release ID/);
    cases += 1;
  });
  const context = loadRuntimeContract(ui.js);
  assert.equal(validateManifestInContext(context, fixtureManifest()).content_state, 'reviewed_beta_release'); cases += 1;
  assert.equal(context.window.CLIMATE_PUBLIC_BETA.compareDecimals('1.000', '1'), 0); cases += 1;
  assert.equal(context.window.CLIMATE_PUBLIC_BETA.compareDecimals('100000000000000000000.1', '99999999999999999999.9'), 1); cases += 1;
  assert.equal(context.window.CLIMATE_PUBLIC_BETA.compareDecimals('-0.01', '0'), -1); cases += 1;

  const bundle = fixtureBundle();
  const initialVerified = validateBundleInContext(context, bundle);
  assert.equal(initialVerified.records.length, 249);
  assert.equal(initialVerified.correctionLog.entries.length, 0);
  assert.equal(initialVerified.correctionLog.policy.current_release_statement,
    'No corrections are recorded for this immutable release.');
  cases += 1;
  const laterBundle = JSON.parse(JSON.stringify(bundle));
  laterBundle.correctionLog = fixtureCorrectionLog(laterBundle.manifest,
    [fixtureCorrectionEntry(laterBundle.manifest)]);
  const laterVerified = validateBundleInContext(context, laterBundle);
  assert.equal(laterVerified.correctionLog.entries.length, 1);
  assert.equal(laterVerified.correctionLog.entries[0].corrected_in_release_id,
    laterBundle.manifest.beta_release_id);
  cases += 1;
  const initialHistoryNodes = renderCorrectionHistoryInContext(context, bundle.manifest, bundle.correctionLog);
  assert.equal(initialHistoryNodes['release-history'].hidden, false);
  assert.equal(initialHistoryNodes['correction-history-empty'].hidden, false);
  assert.equal(initialHistoryNodes['correction-history-list'].hidden, true);
  assert.equal(initialHistoryNodes['correction-current-statement'].textContent,
    'No corrections are recorded for this immutable release.');
  cases += 1;
  const laterHistoryNodes = renderCorrectionHistoryInContext(context, laterBundle.manifest, laterBundle.correctionLog);
  assert.equal(laterHistoryNodes['release-history'].hidden, false);
  assert.equal(laterHistoryNodes['correction-history-empty'].hidden, true);
  assert.equal(laterHistoryNodes['correction-history-list'].hidden, false);
  assert.equal(laterHistoryNodes['correction-history-list'].children.length, 1);
  assert.equal(laterHistoryNodes['correction-history-list'].children[0].children[2].textContent,
    laterBundle.correctionLog.entries[0].description);
  cases += 1;
  const rejectedCorrection = (id, mutate) => {
    const changed = JSON.parse(JSON.stringify(laterBundle));
    mutate(changed.correctionLog, changed.manifest);
    assert.throws(() => validateBundleInContext(context, changed), undefined, id);
    cases += 1;
  };
  rejectedCorrection('correction input-pin tampering', log => { log.review_input_pin.sha256 = '0'.repeat(63); });
  rejectedCorrection('non-opaque correction ID', log => { log.entries[0].correction_id = 'corr-person-name'; });
  rejectedCorrection('correction current-release mismatch', log => { log.entries[0].corrected_in_release_id = 'fixture-beta-2'; });
  rejectedCorrection('correction cannot supersede current release', (log, manifest) => {
    log.entries[0].superseded_release_id = manifest.beta_release_id;
    log.entries[0].affected_artifacts[0].path =
      `data/climate/public-beta/runtime/releases/${manifest.beta_release_id}/fact-lineage.json`;
  });
  rejectedCorrection('correction affected-artifact hash tampering', log => {
    log.entries[0].affected_artifacts[0].sha256 = '0'.repeat(63);
  });
  rejectedCorrection('correction affected-artifact scope escape', log => {
    log.entries[0].affected_artifacts[0].path = 'climate-public-beta/index.html';
  });
  rejectedCorrection('correction reporter contact disclosure', log => {
    log.entries[0].description = 'Reporter email person@private.invalid supplied this corrected source locator.';
  });
  rejectedCorrection('correction arbitrary reporter field', log => {
    log.entries[0].reporter_identity = 'private person';
  });
  rejectedCorrection('correction recorded timestamp drift', log => {
    log.entries[0].recorded_at = '2026-07-17T12:00:00Z';
  });
  rejectedCorrection('correction public statement mismatch', log => {
    log.policy.current_release_statement = 'Corrections exist.';
  });
  const preparedStatus = JSON.parse(JSON.stringify(bundle));
  preparedStatus.factual.status = {
    preparation_only: true,
    public_beta_source_rights_reviewed: false,
    public_beta_redistribution_authorized: false,
    independent_beta_data_reviewed: false,
    public_beta_release_authorized: false,
    production_runtime_release: false,
    assessed_production_authority: false,
  };
  assert.throws(() => validateBundleInContext(context, preparedStatus), undefined, 'preparation artifact must be rejected'); cases += 1;
  const identityDrift = JSON.parse(JSON.stringify(bundle));
  identityDrift.identity.identities[0].iso_alpha3 = 'ZZZ';
  assert.throws(() => validateBundleInContext(context, identityDrift), undefined, 'identity join drift'); cases += 1;
  const lineageDrift = JSON.parse(JSON.stringify(bundle));
  lineageDrift.lineage.facts[0].normalized_value_decimal = '999.000';
  assert.throws(() => validateBundleInContext(context, lineageDrift), undefined, 'lineage value drift'); cases += 1;
  const leakedIdentity = JSON.parse(JSON.stringify(bundle));
  leakedIdentity.factual.entities[0].name = 'Identity leaked into factual data';
  assert.throws(() => validateBundleInContext(context, leakedIdentity), undefined, 'identity field in factual artifact'); cases += 1;
  const gapValue = JSON.parse(JSON.stringify(bundle));
  gapValue.factual.entities[248].observations.push({ fact_id: 'elu-f-ffffffffffffffff', year: 2014, value_decimal: '0' });
  assert.throws(() => validateBundleInContext(context, gapValue), undefined, 'value inserted into source gap'); cases += 1;

  rejectedManifest(context, 'extra manifest field', manifest => { manifest.unreviewed = true; }); cases += 1;
  rejectedManifest(context, 'assessed authority', manifest => { manifest.assessed_production_authority = true; }); cases += 1;
  rejectedManifest(context, 'withheld content', manifest => { manifest.content_state = 'withheld'; }); cases += 1;
  rejectedManifest(context, 'withdrawn content', manifest => { manifest.content_state = 'withdrawn'; }); cases += 1;
  rejectedManifest(context, 'superseded review', manifest => { manifest.independent_review_state = 'superseded'; }); cases += 1;
  rejectedManifest(context, 'missing feedback decision', manifest => { manifest.feedback.approved_feedback_url = null; }); cases += 1;
  rejectedManifest(context, 'missing privacy decision', manifest => { manifest.feedback.privacy_notice_url = null; }); cases += 1;
  rejectedManifest(context, 'cross-origin artifact path', manifest => { manifest.files.country_factual.path = 'https://example.invalid/data.json'; }); cases += 1;
  rejectedManifest(context, 'artifact traversal', manifest => { manifest.files.country_factual.path = '../country-factual.json'; }); cases += 1;
  rejectedManifest(context, 'invalid artifact hash', manifest => { manifest.files.fact_lineage.sha256 = '0'.repeat(63); }); cases += 1;
  rejectedManifest(context, 'missing artifact', manifest => { delete manifest.files.correction_log; }); cases += 1;
  rejectedManifest(context, 'coverage drift', manifest => { manifest.scope.counts.observations = 2059; }); cases += 1;
  rejectedManifest(context, 'metric drift', manifest => { manifest.scope.unit = 'tCO2e'; }); cases += 1;
  rejectedManifest(context, 'product-label drift', manifest => { manifest.product_label = 'Climate rankings'; }); cases += 1;
  INVALID_BETA_RELEASE_IDS.forEach(invalidReleaseId => {
    rejectedManifest(context, `invalid release identifier: ${invalidReleaseId}`, manifest => {
      manifest.beta_release_id = invalidReleaseId;
      manifest.manifest_id = `elu-climate-public-beta-runtime-${invalidReleaseId}`;
    });
    cases += 1;
  });

  const mutations = [
    ['removed digest comparison', { ...ui, js: ui.js.replace('digest === entry.sha256', 'true') }],
    ['removed same-origin comparison', { ...ui, js: ui.js.replace('url.origin === window.location.origin', 'true') }],
    ['removed fail-closed dispatch', { ...ui, js: ui.js.replace('failClosed(error);', 'void error;') }],
    ['removed displayed-row cleanup', { ...ui, js: ui.js.replace("element('evidence-rows').replaceChildren();", 'void 0;') }],
    ['removed reduced-motion support', { ...ui, css: ui.css.replace('@media (prefers-reduced-motion: reduce)', '@media (min-width: 1px)') }],
    ['pre-enabled feedback link', { ...ui, html: ui.html.replace('id="footer-feedback" class="text-link--disabled"', 'id="footer-feedback" href="https://example.invalid" class="text-link--disabled"') }],
    ['external CSP connection', { ...ui, headers: ui.headers.replace("connect-src 'self'", "connect-src 'self' https://example.invalid") }],
    ['notice authority ambiguity', { ...ui, notices: ui.notices.replace('PUBLICATION AUTHORITY: NONE', 'PUBLICATION AUTHORITY: YES') }],
  ];
  mutations.forEach(([id, mutated]) => {
    assert.throws(() => validateUi(mutated), undefined, id);
    cases += 1;
  });
  process.stdout.write(`Climate public-beta UI: PASS (${cases} contract and fail-closed cases; notice remains an incomplete non-publication template)\n`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') return runSelfTest();
  if (args.length === 3 && args[0] === '--notice-mode' && args[1] === 'reviewed' && args[2]) {
    validateUi(readUi({ includeDeploymentControls: true }), {
      noticeMode: 'reviewed', betaReleaseId: args[2], requireHeaders: true,
    });
    process.stdout.write(`Climate public-beta UI: PASS (reviewed notice contract; ${args[2]}; authority remains external)\n`);
    return;
  }
  if (args.length !== 0) throw new Error(
    'usage: node tools/check-climate-public-beta-ui.js [--self-test | --notice-mode reviewed <beta-release-id>]');
  validateUi(readUi(), { noticeMode: 'template', requireHeaders: false });
  process.stdout.write('Climate public-beta UI: PASS (engineering surface only; no publication authority)\n');
}

if (require.main === module) main();

module.exports = {
  DEPLOYMENT_FILES,
  FILES,
  fixtureBundle,
  fixtureManifest,
  fixtureReviewedNotices,
  readUi,
  runSelfTest,
  validateNoticeTemplate,
  validateReviewedNotices,
  validateUi,
};
