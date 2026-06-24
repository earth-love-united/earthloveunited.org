#!/usr/bin/env node
// Verify the country truth categories used by the globe UI.
// This stays data-only: no renderer, no browser, no network.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pledgePayload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pledge-nodes.json'), 'utf8'));
const sitesPayload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sites.json'), 'utf8'));
const countryMarkersPayload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/country-markers.json'), 'utf8'));
const globeSource = fs.readFileSync(path.join(ROOT, 'js/globe.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const countryPanelSource = fs.readFileSync(path.join(ROOT, 'js/site-panel.js'), 'utf8');

const pledgeRows = Array.isArray(pledgePayload.data) ? pledgePayload.data : pledgePayload;
const sites = Array.isArray(sitesPayload.data) ? sitesPayload.data : sitesPayload;
const countryMarkers = Array.isArray(countryMarkersPayload.data) ? countryMarkersPayload.data : countryMarkersPayload;

function fail(message) {
  console.error('FAIL:', message);
  process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage:
  node tools/verify-globe-country-truth.js
  node tools/verify-globe-country-truth.js --geojson /path/to/ne_110m_admin_0_countries.geojson

Checks pledge status mappings, emissions classes, restoration site countryIso
values, small-country markers, and optionally combined polygon/marker coverage.`);
  process.exit(0);
}
const geojsonFlagIndex = args.indexOf('--geojson');
const geojsonPath = geojsonFlagIndex >= 0 ? args[geojsonFlagIndex + 1] : null;
if (geojsonFlagIndex >= 0 && !geojsonPath) {
  fail('Missing path after --geojson');
}

const STATUS = {
  MISSING: 'missing',
  GAP_UNAVAILABLE: 'gap-unavailable',
  OVERSHOOTING: 'overshooting',
  ON_TRACK: 'on-track',
};

const MIN_BASE_COUNTRY_FEATURE_COUNT = 170;
const REQUIRED_SMALL_COUNTRY_ISOS = {
  MDV: 'Maldives',
};

const LABELS = {
  [STATUS.MISSING]: 'No pledge data',
  [STATUS.GAP_UNAVAILABLE]: 'Gap unavailable',
  [STATUS.OVERSHOOTING]: 'Overshooting',
  [STATUS.ON_TRACK]: 'On track',
};

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function statusKey(row) {
  if (!row) return STATUS.MISSING;
  if (!isFiniteNumber(row.reality_gap_mt)) return STATUS.GAP_UNAVAILABLE;
  return row.reality_gap_mt > 0 ? STATUS.OVERSHOOTING : STATUS.ON_TRACK;
}

function emissionsClass(row) {
  if (!row || !isFiniteNumber(row.co2_per_capita)) return 'No emissions class';
  if (row.co2_per_capita < 2) return 'Low emissions';
  if (row.co2_per_capita < 6) return 'Moderate emissions';
  if (row.co2_per_capita < 12) return 'High emissions';
  return 'Very high emissions';
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(lng, lat, feature) {
  const geom = feature.geometry;
  if (!geom || !geom.coordinates) return false;
  if (geom.type === 'Polygon') {
    if (!pointInRing(lng, lat, geom.coordinates[0])) return false;
    for (let h = 1; h < geom.coordinates.length; h++) {
      if (pointInRing(lng, lat, geom.coordinates[h])) return false;
    }
    return true;
  }
  if (geom.type === 'MultiPolygon') {
    for (const polygon of geom.coordinates) {
      if (!pointInRing(lng, lat, polygon[0])) continue;
      let inHole = false;
      for (let h = 1; h < polygon.length; h++) {
        if (pointInRing(lng, lat, polygon[h])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

const COUNTRY_ISO_FALLBACKS = {
  France: 'FRA',
  Norway: 'NOR',
  Kosovo: 'XKX',
  'N. Cyprus': 'CYP',
  'Northern Cyprus': 'CYP',
  Somaliland: 'SOM',
};

function resolveFeatureIso(feature) {
  const props = feature?.properties || {};
  if (props.ISO_A3 && props.ISO_A3 !== '-99') return props.ISO_A3;
  for (const name of [props.ADMIN, props.NAME, props.name].filter(Boolean)) {
    if (COUNTRY_ISO_FALLBACKS[name]) return COUNTRY_ISO_FALLBACKS[name];
  }
  return props.ISO_A3 || props.ISO_A2 || 'UNK';
}

const counts = {
  [STATUS.MISSING]: 0,
  [STATUS.GAP_UNAVAILABLE]: 0,
  [STATUS.OVERSHOOTING]: 0,
  [STATUS.ON_TRACK]: 0,
};
const classCounts = {};
const lowAndOvershooting = [];
const samples = {};
const seenPledgeIso = new Set();

for (const row of pledgeRows) {
  if (!row.iso || !/^[A-Z]{3}$/.test(row.iso)) {
    fail(`Pledge row has invalid ISO alpha-3 code: ${row.country || '<unknown>'}=${row.iso}`);
    continue;
  }
  if (seenPledgeIso.has(row.iso)) {
    fail(`Duplicate pledge ISO alpha-3 code: ${row.iso}`);
  }
  seenPledgeIso.add(row.iso);

  const key = statusKey(row);
  counts[key] += 1;
  samples[key] = samples[key] || row;

  const klass = emissionsClass(row);
  classCounts[klass] = (classCounts[klass] || 0) + 1;

  if (key === STATUS.OVERSHOOTING && klass === 'Low emissions') {
    lowAndOvershooting.push(row);
  }
}

for (const key of [STATUS.GAP_UNAVAILABLE, STATUS.OVERSHOOTING, STATUS.ON_TRACK]) {
  if (!counts[key]) fail(`Expected at least one ${LABELS[key]} pledge row`);
}

const GLOBE_STATUS_NAMES = {
  [STATUS.MISSING]: 'MISSING',
  [STATUS.GAP_UNAVAILABLE]: 'GAP_UNAVAILABLE',
  [STATUS.OVERSHOOTING]: 'OVERSHOOTING',
  [STATUS.ON_TRACK]: 'ON_TRACK',
};
for (const [key, label] of Object.entries(LABELS)) {
  const mapping = `[COUNTRY_STATUS.${GLOBE_STATUS_NAMES[key]}]: '${label}'`;
  if (!globeSource.includes(mapping)) {
    fail(`Globe country status mapping is missing: ${key}=${label}`);
  }
}

const legendStart = indexSource.indexOf('<div class="hex-legend" id="hex-legend">');
const legendEnd = indexSource.indexOf('<!-- ═══ EVENTS FILTER', legendStart);
const legendBlock = legendStart >= 0 && legendEnd > legendStart
  ? indexSource.slice(legendStart, legendEnd)
  : '';
const legendLabels = [...legendBlock.matchAll(/<div class="hex-legend-row">[\s\S]*?<\/span>\s*([^<]+)<\/div>/g)]
  .map(match => match[1].trim());
if (JSON.stringify(legendLabels) !== JSON.stringify(Object.values(LABELS))) {
  fail(`Countries-mode legend labels differ from status mapping: ${legendLabels.join(', ')}`);
}
if (!countryPanelSource.includes('const onTrack = hasGap ? gap <= 0 : null;')) {
  fail('Country panel status must derive from the same finite reality-gap rule as the globe');
}
if (!countryPanelSource.includes('Reality gap unavailable')) {
  fail('Country panel is missing the Gap unavailable explanation');
}
if (!globeSource.includes('ne_110m_admin_0_countries.geojson')) {
  fail('Globe country geometry source must use the performant 110m base layer');
}
if (!globeSource.includes('country-marker')) {
  fail('Globe is missing the small-country marker layer');
}

if (!lowAndOvershooting.length) {
  fail('Expected at least one country that is Low emissions and Overshooting');
}

const badSites = sites.filter(site => !isFiniteNumber(site.lat) || !isFiniteNumber(site.lng));
if (badSites.length) {
  fail(`Restoration sites missing numeric coordinates: ${badSites.map(s => s.id || s.name).join(', ')}`);
}
const missingSiteIso = sites.filter(site => !site.countryIso);
if (missingSiteIso.length) {
  fail(`Restoration sites missing countryIso: ${missingSiteIso.map(s => s.id || s.name).join(', ')}`);
}
const badSiteIso = sites.filter(site => site.countryIso && !/^[A-Z]{3}$/.test(site.countryIso));
if (badSiteIso.length) {
  fail(`Restoration sites have invalid countryIso values: ${badSiteIso.map(s => `${s.id || s.name}=${s.countryIso}`).join(', ')}`);
}

const pledgeByIso = Object.fromEntries(pledgeRows.map(row => [row.iso, row]));
const siteIsoWithoutPledge = sites.filter(site => site.countryIso && !pledgeByIso[site.countryIso]);
if (siteIsoWithoutPledge.length) {
  fail(`Restoration site countryIso values missing from pledge data: ${siteIsoWithoutPledge.map(s => `${s.id || s.name}=${s.countryIso}`).join(', ')}`);
}
const markerIso = new Set();
for (const marker of countryMarkers) {
  if (!marker.iso || !/^[A-Z]{3}$/.test(marker.iso)) {
    fail(`Small-country marker has invalid ISO alpha-3 code: ${marker.name || '<unknown>'}=${marker.iso}`);
  }
  if (!isFiniteNumber(marker.lat) || !isFiniteNumber(marker.lng)) {
    fail(`Small-country marker has invalid coordinates: ${marker.iso || marker.name}`);
  }
  if (markerIso.has(marker.iso)) fail(`Duplicate small-country marker ISO: ${marker.iso}`);
  markerIso.add(marker.iso);
}
for (const [iso, name] of Object.entries(REQUIRED_SMALL_COUNTRY_ISOS)) {
  if (!markerIso.has(iso)) fail(`Required small-country marker missing: ${name} (${iso})`);
}
let geojsonAudit = null;
if (geojsonPath) {
  if (!fs.existsSync(path.resolve(geojsonPath))) {
    fail(`GeoJSON file not found: ${geojsonPath}`);
  }
  const geojson = JSON.parse(fs.readFileSync(path.resolve(geojsonPath), 'utf8'));
  const features = (geojson.features || []).filter(feature => feature.properties?.ISO_A2 !== 'AQ');
  if (features.length < MIN_BASE_COUNTRY_FEATURE_COUNT) {
    fail(`Country base geometry is incomplete: expected at least ${MIN_BASE_COUNTRY_FEATURE_COUNT} non-Antarctic features, found ${features.length}`);
  }
  const featureIsoSet = new Set(features.map(resolveFeatureIso));
  const duplicateMarkerIso = [...markerIso].filter(iso => featureIsoSet.has(iso));
  if (duplicateMarkerIso.length) {
    fail(`Small-country markers duplicate base geometry: ${duplicateMarkerIso.join(', ')}`);
  }
  const combinedCountryIso = new Set([...featureIsoSet, ...markerIso]);
  const pledgeCountriesMissingCoverage = [...seenPledgeIso].filter(iso => !combinedCountryIso.has(iso));
  if (pledgeCountriesMissingCoverage.length) {
    fail(`Pledge countries missing from combined country coverage: ${pledgeCountriesMissingCoverage.join(', ')}`);
  }
  const requiredSmallCountriesMissing = Object.entries(REQUIRED_SMALL_COUNTRY_ISOS)
    .filter(([iso]) => !combinedCountryIso.has(iso));
  if (requiredSmallCountriesMissing.length) {
    fail(`Required small-country geometry missing: ${requiredSmallCountriesMissing.map(([iso, name]) => `${name} (${iso})`).join(', ')}`);
  }
  const featureCounts = {
    [STATUS.MISSING]: 0,
    [STATUS.GAP_UNAVAILABLE]: 0,
    [STATUS.OVERSHOOTING]: 0,
    [STATUS.ON_TRACK]: 0,
  };
  const missing = [];

  for (const feature of features) {
    const iso = resolveFeatureIso(feature);
    const row = pledgeByIso[iso];
    const key = statusKey(row);
    featureCounts[key] += 1;
    if (!row) {
      missing.push({
        name: feature.properties?.ADMIN || feature.properties?.NAME || iso,
        iso,
      });
    }
  }

  const siteMatches = sites.map(site => {
    const declaredFeature = features.find(candidate => resolveFeatureIso(candidate) === site.countryIso);
    const coordinateFeature = features.find(candidate => pointInFeature(site.lng, site.lat, candidate));
    const coordinateIso = coordinateFeature ? resolveFeatureIso(coordinateFeature) : null;
    const row = coordinateIso ? pledgeByIso[coordinateIso] : null;
    return {
      site: site.name,
      id: site.id,
      declaredIso: site.countryIso,
      declaredFeatureFound: !!declaredFeature,
      coordinateIso,
      country: row?.country || coordinateFeature?.properties?.ADMIN || null,
      matches: !!coordinateIso && coordinateIso === site.countryIso,
      status: LABELS[statusKey(row)],
      emissionsClass: emissionsClass(row),
    };
  });

  const unmatchedSites = siteMatches.filter(match => !match.coordinateIso);
  if (unmatchedSites.length) {
    fail(`Restoration sites did not match any country polygon: ${unmatchedSites.map(s => s.id || s.site).join(', ')}`);
  }
  const missingDeclaredFeatures = siteMatches.filter(match => !match.declaredFeatureFound);
  if (missingDeclaredFeatures.length) {
    fail(`Restoration site countryIso values did not match a country polygon: ${missingDeclaredFeatures.map(s => `${s.id}=${s.declaredIso}`).join(', ')}`);
  }
  const mismatchedSites = siteMatches.filter(match => match.coordinateIso && !match.matches);
  if (mismatchedSites.length) {
    fail(`Restoration site coordinates disagree with countryIso: ${mismatchedSites.map(s => `${s.id}=${s.declaredIso}, coordinates=${s.coordinateIso}`).join('; ')}`);
  }

  geojsonAudit = {
    countryFeatureCount: features.length,
    countryMarkerCount: countryMarkers.length,
    combinedCountryCount: combinedCountryIso.size,
    pledgeCountriesMissingCoverage,
    requiredSmallCountryCoverage: Object.fromEntries(
      Object.entries(REQUIRED_SMALL_COUNTRY_ISOS).map(([iso, name]) => [name, combinedCountryIso.has(iso)])
    ),
    featureStatusCounts: Object.fromEntries(
      Object.entries(featureCounts).map(([key, count]) => [LABELS[key], count])
    ),
    missingPledgeDataSamples: missing.slice(0, 12),
    restorationSiteMatches: siteMatches,
  };
}

const report = {
  pledgeRows: pledgeRows.length,
  statusLabels: LABELS,
  statusCounts: counts,
  emissionsClassCounts: classCounts,
  lowEmissionsAndOvershootingSamples: lowAndOvershooting.slice(0, 5).map(row => ({
    country: row.country,
    iso: row.iso,
    perCapita: row.co2_per_capita,
    gapMt: row.reality_gap_mt,
    status: LABELS[statusKey(row)],
    emissionsClass: emissionsClass(row),
  })),
  restorationSiteCoordinateCount: sites.length - badSites.length,
  geojsonAudit,
  sampledRows: Object.fromEntries(
    Object.entries(samples).map(([key, row]) => [LABELS[key], {
      country: row.country,
      iso: row.iso,
      perCapita: row.co2_per_capita,
      gapMt: row.reality_gap_mt,
      emissionsClass: emissionsClass(row),
    }])
  ),
};

console.log(JSON.stringify(report, null, 2));
