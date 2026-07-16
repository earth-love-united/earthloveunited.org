#!/usr/bin/env node
// Deterministic CT-04 guard: the historical country payload is documentation-only.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const historicalPath = ['data', 'pledge-nodes.json'].join('/');

const RETIRED_IDENTIFIERS = [
  'pledgeNodes',
  'countryHexColors',
  'getPledgeNode',
  'getCountryHexData',
];

const RETIRED_CLIMATE_FIELDS = [
  'fossil_co2_mt',
  'lulucf_co2_mt',
  'total_co2_mt',
  'co2_per_capita',
  'cat_rating',
  'cat_score',
  'globe_color',
  'target_type',
  'reduction_pct',
  'reduction_pct_upper',
  'target_year',
  'baseline_year',
  'implied_target_mt',
  'reality_gap_mt',
  'momentum_cagr',
  'required_cagr',
  'on_track',
  'change_since_2015',
  'finance_total_bn',
  'ndc_summary',
  'divergence',
  'conditionality',
  'population',
];

// Compact semantic signatures catch exact strings and common computed-string
// bypasses such as ['Provisional fossil CO2', ' magnitude'].join('').
const PROHIBITED_PUBLIC_CLAIMS = [
  'provisionalfossilco2magnitude',
  'fossilco2magnitudelegacy',
  'provisionalmagnitudecontext',
  'legacymagnitude',
  'legacyunverified',
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function runtimeScripts(indexSource) {
  const scripts = [];
  const pattern = /<script\b[^>]*\bsrc=["']([^"']+\.js(?:\?[^"']*)?)["'][^>]*>/gi;
  for (const match of indexSource.matchAll(pattern)) {
    const relative = match[1].split('?')[0].replace(/^\//, '');
    if (!relative.startsWith('js/') || relative.includes('..')) continue;
    if (fs.existsSync(path.join(ROOT, relative))) scripts.push(relative);
  }
  return [...new Set(scripts)];
}

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function compact(source) {
  return stripComments(source)
    .normalize('NFKD')
    .replace(/₂/g, '2')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function usesRetiredClimateField(executable, field) {
  if (field.includes('_')) {
    return new RegExp(`(^|[^A-Za-z0-9_])${field}([^A-Za-z0-9_]|$)`).test(executable);
  }

  // Plain-language field names may legitimately occur in labels, prose, and
  // navigation CSS. Treat them as legacy data only when used as a JavaScript
  // property/key, rather than banning the word itself.
  const propertyPatterns = [
    new RegExp(`\\.${field}\\b`),
    new RegExp(`\\[\\s*['\"\\\`]${field}['\"\\\`]\\s*\\]`),
    new RegExp(`(^|[,{])\\s*['\"\\\`]?${field}['\"\\\`]?\\s*:`, 'm'),
  ];
  return propertyPatterns.some(pattern => pattern.test(executable));
}

function inspectLiveSource(relativePath, source) {
  const findings = [];
  const executable = stripComments(source);
  const compacted = compact(source);

  // This catches literal paths and lexical composition with quotes, +, arrays,
  // template fragments, or join(), because punctuation is removed first.
  if (compacted.includes('pledgenodesjson')) {
    findings.push(`${relativePath}: retired payload path or computed path`);
  }

  for (const identifier of RETIRED_IDENTIFIERS) {
    const token = identifier.toLowerCase();
    if (compacted.includes(token)) findings.push(`${relativePath}: retired runtime alias ${identifier}`);
  }

  for (const field of RETIRED_CLIMATE_FIELDS) {
    if (usesRetiredClimateField(executable, field)) findings.push(`${relativePath}: retired climate field ${field}`);
  }

  for (const signature of PROHIBITED_PUBLIC_CLAIMS) {
    if (compacted.includes(signature)) findings.push(`${relativePath}: prohibited public magnitude semantics ${signature}`);
  }

  return findings;
}

function assertMutationDetected(name, source, expectedText) {
  const findings = inspectLiveSource(`mutation/${name}`, source);
  if (!findings.some(finding => finding.includes(expectedText))) {
    failures.push(`guard self-test ${name}: mutation escaped (${findings.join('; ') || 'no findings'})`);
  }
}

function assertLegitimateUseAllowed(name, source) {
  const findings = inspectLiveSource(`allowed/${name}`, source);
  if (findings.length) failures.push(`guard self-test ${name}: legitimate use blocked (${findings.join('; ')})`);
}

// Adversarial regressions: these run on every invocation and prove the guard is
// testing semantics rather than only the current formatting of production files.
assertMutationDetected(
  'entered-globe-legend.html',
  '<div>Provisional fossil CO₂ magnitude · legacy, unverified</div>',
  'prohibited public magnitude semantics'
);
assertMutationDetected(
  'computed-path.js',
  "fetch(['data', 'pledge-' + 'nodes.json'].join('/'))",
  'retired payload path or computed path'
);
assertMutationDetected(
  'computed-alias.js',
  "const rows = Data['pledge' + 'Nodes'];",
  'retired runtime alias pledgeNodes'
);
assertMutationDetected(
  'computed-legend.js',
  "const label = ['Provisional fossil CO2', ' magnitude'].join('');",
  'prohibited public magnitude semantics'
);
assertMutationDetected(
  'retired-field.js',
  "const value = row['reality_gap_mt'];",
  'retired climate field reality_gap_mt'
);
assertMutationDetected(
  'computed-country-data-alias.js',
  "const country = Data['getCountry' + 'HexData']('USA');",
  'retired runtime alias getCountryHexData'
);
assertMutationDetected(
  'divergence-field.js',
  'const value = row.divergence;',
  'retired climate field divergence'
);
assertMutationDetected(
  'conditionality-field.js',
  "const value = row['conditionality'];",
  'retired climate field conditionality'
);
assertMutationDetected(
  'population-field.js',
  'const legacy = { population: 1234 };',
  'retired climate field population'
);
assertLegitimateUseAllowed(
  'identity-navigation-language.html',
  '<style>.tt-divergence{display:block}</style><p>Population label; conditionality is under review.</p>'
);

const index = read('index.html');
const runtimeFiles = [
  'index.html',
  'sw.js',
  ...runtimeScripts(index),
  'tools/smoke-test.js',
  'tools/impact-analyzer.js',
];

for (const relativePath of runtimeFiles) {
  failures.push(...inspectLiveSource(relativePath, read(relativePath)));
}

const dataSource = read('js/data.js');
if (/fetch\s*\([^)]*pledge/i.test(dataSource)) failures.push('js/data.js: legacy country fetch detected');

const serviceWorker = read('sw.js');
if (compact(serviceWorker).includes('pledgenodesjson')) failures.push('sw.js: legacy payload remains in cache behavior');

if (!index.includes('docs/LEGACY-COUNTRY-DATA-EXIT.md')) failures.push('index.html: public exit-ledger link missing');
const hasNeutralLegend = index.includes('Uniform neutral surface · country evidence withheld');
const hasCandidateLegend = index.includes('Emissions magnitude only—not a climate-performance score') &&
  index.includes('7 mapped source gaps · all 43 in browser') &&
  index.includes('Neutral pattern · source gap, visible and unranked') &&
  read('data/climate/runtime/candidate-manifest.json').includes('"release_eligible": false');
const candidateCache = serviceWorker.includes("const CACHE_NAME = 'elu-v27-ct42-candidate'") && hasCandidateLegend;
const localizedCandidateCache = (serviceWorker.includes("const CACHE_NAME = 'elu-v33-focus-trap'") ||
  serviceWorker.includes("const CACHE_NAME = 'elu-v34-truth-copy'")) &&
  serviceWorker.includes("'/assets/globe/runtime/manifest.json'") &&
  serviceWorker.includes("'/data/climate/runtime/country-factual-candidate.json?v=ct42candidate1'") && hasCandidateLegend;
if (!serviceWorker.includes("const CACHE_NAME = 'elu-v26'") && !candidateCache && !localizedCandidateCache) {
  failures.push('sw.js: cache version is neither legacy-exit v26, denied candidate v27, nor localized evidence cache v33/v34');
}
if (!hasNeutralLegend && !hasCandidateLegend) failures.push('index.html: fail-closed neutral or denied CT-42 candidate legend missing');
if (!index.includes("navigator.serviceWorker.register('/sw.js?v=26'") &&
    !index.includes("navigator.serviceWorker.register('/sw.js?v=27-ct42-candidate'") &&
    !index.includes("navigator.serviceWorker.register('/sw.js?v=33-focus-trap'") &&
    !index.includes("navigator.serviceWorker.register('/sw.js?v=34-truth-copy'")) {
  failures.push('index.html: service-worker registration is neither v26, candidate v27, nor localized evidence v33/v34');
}

const ledger = read('docs/LEGACY-COUNTRY-DATA-EXIT.md');
const payload = JSON.parse(read(historicalPath));
const rows = Array.isArray(payload.data) ? payload.data : payload;
const fields = [...new Set(rows.flatMap(row => Object.keys(row)))].sort();
if (fields.length !== 27) failures.push(`historical payload: expected 27 fields, found ${fields.length}`);
for (const field of fields) {
  if (!ledger.includes('`' + field + '`')) failures.push(`exit ledger: missing field ${field}`);
}
if (!ledger.includes('None of its fields may be used in public country cards')) {
  failures.push('exit ledger: explicit public-use prohibition missing');
}

if (failures.length) {
  failures.forEach(message => console.error('FAIL:', message));
  process.exit(1);
}

console.log(`legacy country exit: PASS (${fields.length} fields ledgered; ${runtimeFiles.length} live files clean; 9 mutation guards; 1 legitimate-use guard)`);
