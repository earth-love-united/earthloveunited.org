#!/usr/bin/env node
// Verify the country truth categories used by the globe UI.
// This stays data-only: no renderer, no browser, no network.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pledgePayload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/pledge-nodes.json'), 'utf8'));
const sitesPayload = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/sites.json'), 'utf8'));

const pledgeRows = Array.isArray(pledgePayload.data) ? pledgePayload.data : pledgePayload;
const sites = Array.isArray(sitesPayload.data) ? sitesPayload.data : sitesPayload;

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
values, and optionally country polygon coverage when a local GeoJSON is supplied.`);
  process.exit(0);
}
const geojsonFlagIndex = args.indexOf('--geojson');
const geojsonPath = geojsonFlagIndex >= 0 ? args[geojsonFlagIndex + 1] : null;
if (geojsonFlagIndex >= 0 && !geojsonPath) {
  fail('Missing path after --geojson');
}

const STATUS = {
  MISSING: 'missing',
  NO_TARGET: 'no-target',
  OVERSHOOTING: 'overshooting',
  ON_TRACK: 'on-track',
};

const LABELS = {
  [STATUS.MISSING]: 'No pledge data',
  [STATUS.NO_TARGET]: 'No target',
  [STATUS.OVERSHOOTING]: 'Overshooting',
  [STATUS.ON_TRACK]: 'On track',
};

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function statusKey(row) {
  if (!row) return STATUS.MISSING;
  if (!isFiniteNumber(row.reality_gap_mt)) return STATUS.NO_TARGET;
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
  [STATUS.NO_TARGET]: 0,
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

for (const key of [STATUS.NO_TARGET, STATUS.OVERSHOOTING, STATUS.ON_TRACK]) {
  if (!counts[key]) fail(`Expected at least one ${LABELS[key]} pledge row`);
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
let geojsonAudit = null;
if (geojsonPath) {
  if (!fs.existsSync(path.resolve(geojsonPath))) {
    fail(`GeoJSON file not found: ${geojsonPath}`);
  }
  const geojson = JSON.parse(fs.readFileSync(path.resolve(geojsonPath), 'utf8'));
  const features = (geojson.features || []).filter(feature => feature.properties?.ISO_A2 !== 'AQ');
  const featureCounts = {
    [STATUS.MISSING]: 0,
    [STATUS.NO_TARGET]: 0,
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
    const feature = site.countryIso
      ? features.find(candidate => resolveFeatureIso(candidate) === site.countryIso)
      : features.find(candidate => pointInFeature(site.lng, site.lat, candidate));
    const iso = feature ? resolveFeatureIso(feature) : null;
    const row = iso ? pledgeByIso[iso] : null;
    return {
      site: site.name,
      id: site.id,
      source: site.countryIso ? 'countryIso' : 'point-in-polygon',
      iso,
      country: row?.country || feature?.properties?.ADMIN || null,
      status: LABELS[statusKey(row)],
      emissionsClass: emissionsClass(row),
    };
  });

  const unmatchedSites = siteMatches.filter(match => !match.iso);
  if (unmatchedSites.length) {
    fail(`Restoration sites did not match any country polygon: ${unmatchedSites.map(s => s.id || s.site).join(', ')}`);
  }

  geojsonAudit = {
    countryFeatureCount: features.length,
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
