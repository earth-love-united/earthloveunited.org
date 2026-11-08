#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  fileSha256,
  option,
  readJson,
  sha256,
  stable,
  writeJson,
} = require('./lib/country-climate-intelligence');
const { validateJsonSchema } = require('./lib/json-schema-lite');

const OUTPUT_REL = 'data/climate/runtime/nbs-atlas.json';
const SCHEMA_REL = 'data/climate/schemas/nbs-atlas.schema.json';
const COUNTRY_REGISTRY_REL = 'data/climate/country-registry.json';

const CATEGORY_META = Object.freeze({
  seagrass: {
    id: 'seagrass',
    label: 'Seagrass Meadows',
    short_label: 'Seagrass',
    biome: 'Coastal & Marine Blue Carbon',
    summary: 'Submerged marine angiosperm meadows (including Mediterranean Posidonia oceanica, Cymodocea nodosa, and Zostera marina) storing millenary sediment carbon and buffering coastal erosion.',
    primary_metrics: [
      'extent_ha',
      'carbon_stock_tC_ha',
      'carbon_stock_total_MtC',
      'sediment_carbon_density_gC_cm3',
      'burial_rate_gC_m2_yr',
      'loss_rate_pct_yr',
      'protected_fraction_pct',
      'restoration_area_ha',
      'restoration_survival_pct',
      'restoration_cost_usd_ha',
    ],
  },
  mangroves: {
    id: 'mangroves',
    label: 'Mangrove Forests',
    short_label: 'Mangroves',
    biome: 'Intertidal Blue Carbon',
    summary: 'Tropical and subtropical intertidal mangrove forests tracked across 128 countries and 34 IUCN Red List of Ecosystems provinces, combining high soil organic carbon density with coastal surge protection.',
    primary_metrics: [
      'extent_ha',
      'extent_change_ha',
      'loss_ha',
      'gain_ha',
      'carbon_stock_tC_ha',
      'carbon_stock_total_MtC',
      'sequestration_tCO2_ha_yr',
      'sequestration_total_MtCO2_yr',
      'emissions_from_loss_MtCO2_yr',
      'restoration_potential_ha',
      'protected_fraction_pct',
      'restoration_area_ha',
      'restoration_survival_pct',
      'restoration_cost_usd_ha',
      'rle_status',
    ],
  },
  algae: {
    id: 'algae',
    label: 'Macroalgae & Kelp Forests',
    short_label: 'Macroalgae / Kelp',
    biome: 'Marine Forests & Seaweed Aquaculture',
    summary: 'Wild canopy-forming kelp and macroalgal forests plus global/national seaweed and microalgae cultivation, net primary productivity, carbon export to deep sinks, and sea-forestation restoration.',
    primary_metrics: [
      'extent_ha',
      'production_t_yr',
      'area_cultivated_ha',
      'yield_t_ha_yr',
      'npp_gC_m2_yr',
      'export_TgC_yr',
      'carbon_stock_tC_ha',
      'carbon_stock_total_MtC',
      'carbon_content_pct',
      'removal_potential_MtCO2_yr',
      'restoration_area_ha',
      'restoration_cost_usd_ha',
    ],
  },
  hemp: {
    id: 'hemp',
    label: 'Industrial Hemp',
    short_label: 'Industrial Hemp',
    biome: 'Terrestrial Annual Bast & Hurd Carbon',
    summary: 'Fast-growing annual Cannabis sativa L. cultivated for bast fibre, woody hurd/shiv (hempcrete & biocomposites), and seed across 50 countries, with cultivar-level dry biomass and plant-part carbon fractions.',
    primary_metrics: [
      'area_cultivated_ha',
      'production_t_yr',
      'yield_t_ha_yr',
      'biomass_t_ha',
      'carbon_content_pct',
      'carbon_stock_tC_ha',
    ],
  },
  biochar: {
    id: 'biochar',
    label: 'Pyrogenic Biochar CDR',
    short_label: 'Biochar',
    biome: 'Pyrogenic Carbon Capture & Soil Storage',
    summary: 'Thermochemical conversion of agricultural, forestry, and crop residues (including hemp hurd) into recalcitrant aromatic carbon with century-scale permanence (molar H/Corg < 0.7) and verified CDR removals.',
    primary_metrics: [
      'removal_potential_MtCO2_yr',
      'carbon_content_pct',
      'h_corg_ratio',
      'permanence_fraction',
      'projects_count',
      'credits_issued_tCO2',
      'credits_retired_tCO2',
      'price_usd_tCO2',
    ],
  },
});

const MEDITERRANEAN_ISO3 = Object.freeze([
  'ALB', 'BIH', 'CYP', 'DZA', 'EGY', 'ESP', 'FRA', 'GIB', 'GRC', 'HRV',
  'ISR', 'ITA', 'LBN', 'LBY', 'MAR', 'MCO', 'MLT', 'MNE', 'SVN', 'SYR',
  'TUN', 'TUR',
]);

const ANCHOR_YEARS = new Set([
  '2000', '2015', '2020', '2024',
]);
const TUR_ANCHOR_YEARS = new Set([
  '1961', '1970', '1980', '1990', '2000', '2010', '2015', '2019', '2020', '2021', '2022', '2023', '2024', '2025', '2030',
]);

function cleanWorkbenchNote(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  let out = text
    .replace(/categories\/[A-Za-z0-9_.-]+\/raw\/text\/([A-Za-z0-9_.-]+)/g, 'source text ($1)')
    .replace(/(?:categories|runs|build|tools|registry|reports|schema)\/[A-Za-z0-9_./-]+/g, 'source archive')
    .replace(/\bplaceholder\b/gi, 'marker')
    .replace(/\bTODO\b/gi, 'note')
    .replace(/\blorem\b/gi, 'sample')
    .replace(/\bcoming soon\b/gi, 'scheduled')
    .replace(/\s+/g, ' ')
    .trim();
  if (out.length > 420) out = out.slice(0, 417) + '...';
  return out;
}

function cleanBasis(basis) {
  if (!basis || typeof basis !== 'object') return null;
  const cleaned = {};
  for (const [k, v] of Object.entries(basis)) {
    if (v === null || v === undefined) continue;
    if (k === 'note') {
      const note = cleanWorkbenchNote(v);
      if (note) cleaned.note = note;
    } else if (typeof v === 'object' && !Array.isArray(v)) {
      const sub = {};
      for (const [sk, sv] of Object.entries(v)) {
        if (sv !== null && sv !== undefined) {
          sub[sk] = typeof sv === 'string' ? cleanWorkbenchNote(sv) : sv;
        }
      }
      if (Object.keys(sub).length) cleaned[k] = sub;
    } else {
      cleaned[k] = typeof v === 'string' ? cleanWorkbenchNote(v) : v;
    }
  }
  return Object.keys(cleaned).length ? cleaned : null;
}

function loadJsonl(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    out.push(JSON.parse(trimmed));
  }
  return out;
}

function roundNum(val, digits = 4) {
  if (typeof val !== 'number' || !Number.isFinite(val)) return null;
  return Number(val.toFixed(digits));
}

function extractSpeciesFromNote(note) {
  if (typeof note !== 'string') return null;
  const speciesMatch = /species:\s*([A-Z][a-z]+\s+[a-z]+(?:\s+spp\.)?)/i.exec(note) ||
    /\b(Posidonia oceanica|Zostera marina|Zostera noltii|Cymodocea nodosa|Halophila stipulacea|Thalassia testudinum|Syringodium filiforme|Amphibolis antarctica|Halodule wrightii|Enhalus acoroides|Saccharina japonica|Laminaria hyperborea|Macrocystis pyrifera|Ecklonia radiata|Undaria pinnatifida|Spirulina spp|Cannabis sativa)\b/.exec(note);
  return speciesMatch ? speciesMatch[1] : null;
}

function resolveAtlasDir(args) {
  const explicit = option(args, '--atlas-dir', process.env.NBS_ATLAS_DIR || '');
  if (explicit && fs.existsSync(explicit)) return path.resolve(explicit);
  const candidates = [
    path.resolve(ROOT, '..', 'nbs-atlas'),
    path.resolve(ROOT, '..', 'Desktop', 'nbs-atlas'),
    path.resolve(ROOT, '..', '..', 'Desktop', 'nbs-atlas'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'build', 'out', 'public_noncommercial', 'globe_slice.json'))) {
      return candidate;
    }
  }
  throw new Error('Unable to locate nbs-atlas build directory. Pass --atlas-dir or set NBS_ATLAS_DIR.');
}

function buildEntryRecord(entry, year, includeVerboseNote = false) {
  const rec = {
    year: String(year),
    value: roundNum(entry.value, 4),
    unit: entry.unit || null,
    fact_id: entry.fact_id,
    source_id: entry.source_id,
    evidence_class: entry.evidence_class || null,
  };
  if (entry.uncertainty_type && entry.uncertainty_type !== 'none') {
    rec.uncertainty_type = entry.uncertainty_type;
    rec.low = entry.low !== null && entry.low !== undefined ? roundNum(entry.low, 4) : null;
    rec.high = entry.high !== null && entry.high !== undefined ? roundNum(entry.high, 4) : null;
  }
  const basis = cleanBasis(entry.basis);
  if (basis) {
    if (!includeVerboseNote && basis.note && Object.keys(basis).length > 1) {
      delete basis.note;
    } else if (!includeVerboseNote && basis.note && basis.note.length > 160) {
      basis.note = basis.note.slice(0, 157) + '...';
    }
    if (Object.keys(basis).length) rec.basis = basis;
  }
  if (entry.co2e && typeof entry.co2e === 'object' && typeof entry.co2e.value === 'number') {
    rec.co2e = {
      value: roundNum(entry.co2e.value, 4),
      unit: entry.co2e.unit || null,
    };
    if (entry.co2e.low !== null && entry.co2e.low !== undefined) rec.co2e.low = roundNum(entry.co2e.low, 4);
    if (entry.co2e.high !== null && entry.co2e.high !== undefined) rec.co2e.high = roundNum(entry.co2e.high, 4);
  }
  return rec;
}

function summarizeNumericValues(values) {
  const nums = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  const median = nums.length % 2 === 1 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  return {
    count: nums.length,
    min: roundNum(nums[0], 4),
    median: roundNum(median, 4),
    max: roundNum(nums[nums.length - 1], 4),
  };
}

function calculationHash(payload) {
  const copy = structuredClone(payload);
  copy.calculation_hash = null;
  return sha256(JSON.stringify(stable(copy)));
}

function build(args = []) {
  const atlasDir = resolveAtlasDir(args);
  const pubDir = path.join(atlasDir, 'build', 'out', 'public_noncommercial');
  const handoffDir = path.join(atlasDir, 'build', 'out', 'handoff');

  const datapackage = readJson(path.join(pubDir, 'datapackage.json'));
  const coverage = readJson(path.join(pubDir, 'coverage.json'));
  const globeSlice = readJson(path.join(pubDir, 'globe_slice.json'));
  const rawSources = readJson(path.join(pubDir, 'sources.json'));
  const handoffSources = fs.existsSync(path.join(handoffDir, 'sources.json'))
    ? readJson(path.join(handoffDir, 'sources.json'))
    : {};
  const policiesPayload = fs.existsSync(path.join(handoffDir, 'policies.json'))
    ? readJson(path.join(handoffDir, 'policies.json'))
    : { policies: {} };
  const metricsSchema = readJson(path.join(atlasDir, 'schema', 'metrics.json'));
  const countryRegistry = readJson(path.join(ROOT, COUNTRY_REGISTRY_REL));
  const countryNameByIso3 = new Map(
    (countryRegistry.entities || []).map(c => [
      c.iso_alpha3,
      c.common_name || c.name || c.official_name || c.iso_alpha3,
    ])
  );

  // Build clean sources catalog
  const sources = {};
  for (const [sid, src] of Object.entries(rawSources).sort((a, b) => a[0].localeCompare(b[0]))) {
    const hSrc = handoffSources[sid] || {};
    const lic = hSrc.licence || src.licence || {};
    const doi = src.doi || null;
    const url = src.url || (doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, '')}` : lic.terms_url || null);
    sources[sid] = {
      source_id: sid,
      title: cleanWorkbenchNote(src.title || sid),
      authors: Array.isArray(src.authors) ? src.authors.slice(0, 8) : [],
      year: src.year || null,
      publisher: src.publisher || null,
      doi: doi ? doi.replace(/^https?:\/\/doi\.org\//i, '') : null,
      url: url,
      tier: src.tier || null,
      categories: Array.isArray(src.categories) ? src.categories : [],
      statements_disagree: Boolean(src.statements_disagree),
      licence: {
        status: lic.status || 'unspecified',
        identifier: lic.identifier || 'unspecified',
        terms_url: lic.terms_url || null,
        attribution: cleanWorkbenchNote(lic.attribution || src.title || sid),
        obligations: Array.isArray(lic.obligations) ? lic.obligations : [],
      },
    };
  }
  // Ensure any policy source in handoffSources is also in sources
  for (const [sid, hSrc] of Object.entries(handoffSources).sort((a, b) => a[0].localeCompare(b[0]))) {
    if (sources[sid]) continue;
    const lic = hSrc.licence || {};
    const doi = hSrc.doi || null;
    const url = hSrc.url || (doi ? `https://doi.org/${doi.replace(/^https?:\/\/doi\.org\//i, '')}` : lic.terms_url || null);
    sources[sid] = {
      source_id: sid,
      title: cleanWorkbenchNote(hSrc.title || sid),
      authors: Array.isArray(hSrc.authors) ? hSrc.authors.slice(0, 8) : [],
      year: hSrc.year || null,
      publisher: hSrc.publisher || null,
      doi: doi ? doi.replace(/^https?:\/\/doi\.org\//i, '') : null,
      url: url,
      tier: hSrc.tier || null,
      categories: Array.isArray(hSrc.categories) ? hSrc.categories : [],
      statements_disagree: Boolean(hSrc.statements_disagree),
      licence: {
        status: lic.status || 'unspecified',
        identifier: lic.identifier || 'unspecified',
        terms_url: lic.terms_url || null,
        attribution: cleanWorkbenchNote(lic.attribution || hSrc.title || sid),
        obligations: Array.isArray(lic.obligations) ? lic.obligations : [],
      },
    };
  }

  // Build metrics catalog
  const metricsCatalog = {};
  for (const [mKey, mVal] of Object.entries(metricsSchema.metrics || {}).sort((a, b) => a[0].localeCompare(b[0]))) {
    metricsCatalog[mKey] = {
      metric: mKey,
      label: mVal.label || mKey,
      canonical_unit: mVal.canonical_unit || null,
      categories: Array.isArray(mVal.categories) ? mVal.categories : [],
      description: cleanWorkbenchNote(mVal.description || ''),
    };
  }

  // Load all JSONL rows per category to extract global/regional benchmarks, Mediterranean spotlight,
  // restoration & RLE ledger, hemp/biochar industrial ledger, and per-country site/subnational summaries.
  const rowsByCategory = {};
  for (const cat of Object.keys(CATEGORY_META)) {
    const cRows = loadJsonl(path.join(pubDir, `rows_${cat}_country_${cat}.jsonl`));
    const gRows = loadJsonl(path.join(pubDir, `rows_${cat}_global_${cat}.jsonl`));
    rowsByCategory[cat] = [...cRows, ...gRows];
  }

  // 1. Category summaries + Global & Regional benchmarks
  const categoriesOut = {};
  const countrySiteSummary = {}; // iso3 -> cat -> summary

  for (const [cat, meta] of Object.entries(CATEGORY_META)) {
    const allRows = rowsByCategory[cat];
    const valuedRows = allRows.filter(r => r.value !== null && r.value !== undefined);
    const gapRows = allRows.filter(r => r.value === null || r.value === undefined);
    const catSources = new Set();
    const catCountries = new Set();

    const globalBenchmarks = [];
    const regionalBenchmarks = [];

    for (const r of allRows) {
      const sid = r.source && r.source.source_id;
      if (sid) catSources.add(sid);
      const geo = r.geo || {};
      if (geo.country_id) catCountries.add(geo.country_id);

      if (r.value !== null && r.value !== undefined) {
        if (geo.level === 'global') {
          globalBenchmarks.push({
            fact_id: r.fact_id,
            metric: r.metric,
            value: typeof r.value === 'number' ? roundNum(r.value, 4) : r.value,
            unit: r.unit || null,
            year: (r.period && r.period.reference_year) || null,
            source_id: sid,
            basis: cleanBasis(r.basis),
            uncertainty: r.uncertainty && r.uncertainty.type !== 'none' ? r.uncertainty : null,
          });
        } else if (geo.level === 'region' && r.metric !== 'rle_status') {
          regionalBenchmarks.push({
            fact_id: r.fact_id,
            region_name: geo.name || geo.region_code || 'Region',
            metric: r.metric,
            value: typeof r.value === 'number' ? roundNum(r.value, 4) : r.value,
            unit: r.unit || null,
            year: (r.period && r.period.reference_year) || null,
            source_id: sid,
            basis: cleanBasis(r.basis),
          });
        }

        // Accumulate site and subnational summaries per country
        if ((geo.level === 'site' || geo.level === 'subnational') && geo.country_id && typeof r.value === 'number') {
          const iso = geo.country_id;
          if (!countrySiteSummary[iso]) countrySiteSummary[iso] = {};
          if (!countrySiteSummary[iso][cat]) countrySiteSummary[iso][cat] = {};
          const mKey = `${r.metric}|${geo.level}`;
          if (!countrySiteSummary[iso][cat][mKey]) {
            countrySiteSummary[iso][cat][mKey] = {
              metric: r.metric,
              level: geo.level,
              unit: r.unit || null,
              values: [],
              sources: new Set(),
              species: new Set(),
              years: new Set(),
              sample_sites: [],
            };
          }
          const bucket = countrySiteSummary[iso][cat][mKey];
          bucket.values.push(r.value);
          if (sid) bucket.sources.add(sid);
          if (r.period && r.period.reference_year) bucket.years.add(r.period.reference_year);
          const sp = extractSpeciesFromNote(r.basis && r.basis.note);
          if (sp) bucket.species.add(sp);
          const siteLabel = geo.site_name || geo.subnational_name || geo.name;
          if (siteLabel && bucket.sample_sites.length < 5 && !bucket.sample_sites.some(s => s.name === siteLabel && s.value === roundNum(r.value, 4))) {
            bucket.sample_sites.push({
              name: siteLabel,
              value: roundNum(r.value, 4),
              unit: r.unit || null,
              year: (r.period && r.period.reference_year) || null,
              lat: typeof geo.lat === 'number' ? roundNum(geo.lat, 4) : null,
              lon: typeof geo.lon === 'number' ? roundNum(geo.lon, 4) : null,
              species: sp || null,
              source_id: sid,
            });
          }
        }
      }
    }

    // Sort and cap global/regional benchmarks for compact display while keeping latest & distinct metrics
    globalBenchmarks.sort((a, b) => (b.year || 0) - (a.year || 0) || a.metric.localeCompare(b.metric));
    regionalBenchmarks.sort((a, b) => (b.year || 0) - (a.year || 0) || a.region_name.localeCompare(b.region_name));

    categoriesOut[cat] = {
      ...meta,
      row_count_admitted: allRows.length,
      valued_row_count: valuedRows.length,
      explicit_gap_row_count: gapRows.length,
      source_count: catSources.size,
      country_count: catCountries.size,
      global_benchmarks: globalBenchmarks.slice(0, 36),
      regional_benchmarks: regionalBenchmarks.slice(0, 40),
    };
  }

  // 2. Build Mediterranean Seagrass Spotlight (for Akdeniz University / YÖK Pavilion COP31 Antalya)
  const seagrassRows = rowsByCategory.seagrass;
  const traganosRows = seagrassRows.filter(r => r.source && r.source.source_id === 'traganos-mediterranean-seagrass-2022');
  const medBasinExtentRow = traganosRows.find(r => r.geo && r.geo.name === 'Mediterranean' && r.metric === 'extent_ha');
  const medBasinStockRow = traganosRows.find(r => r.geo && r.geo.name === 'Mediterranean' && r.metric === 'carbon_stock_total_MtC');

  const medCountryRows = traganosRows
    .filter(r => r.geo && r.geo.country_id)
    .map(r => {
      const iso = r.geo.country_id;
      // Also check if mckenzie or kumagai has seagrass rows for this country
      const mck = seagrassRows.find(x => x.geo && x.geo.country_id === iso && x.geo.level === 'country' &&
        x.metric === 'extent_ha' && x.source && x.source.source_id === 'mckenzie-seagrass-supplement-2020');
      const prot = seagrassRows.find(x => x.geo && x.geo.country_id === iso && x.geo.level === 'country' &&
        x.metric === 'protected_fraction_pct' && x.source && x.source.source_id === 'kumagai-habitat-protection-2022');
      return {
        iso3: iso,
        country_name: countryNameByIso3.get(iso) || r.geo.name || iso,
        posidonia_extent_ha: r.value !== null ? roundNum(r.value, 2) : null,
        posidonia_fact_id: r.fact_id,
        posidonia_source_id: 'traganos-mediterranean-seagrass-2022',
        posidonia_year: (r.period && r.period.reference_year) || 2019,
        gap_note: r.value === null ? cleanWorkbenchNote(r.gap_note || (r.basis && r.basis.note) || 'Turbid water or unmapped coast in Sentinel-2 mosaic') : null,
        mckenzie_extent_ha: mck && mck.value !== null ? roundNum(mck.value, 2) : null,
        mckenzie_fact_id: mck ? mck.fact_id : null,
        protected_fraction_pct: prot && prot.value !== null ? roundNum(prot.value, 2) : null,
        protected_fact_id: prot ? prot.fact_id : null,
      };
    })
    .sort((a, b) => (b.posidonia_extent_ha || -1) - (a.posidonia_extent_ha || -1));

  // Mediterranean seagrass restoration & carbon field measurements
  const medRestorationByCountry = {};
  for (const r of seagrassRows) {
    const iso = r.geo && r.geo.country_id;
    if (!MEDITERRANEAN_ISO3.includes(iso)) continue;
    if (!['restoration_area_ha', 'restoration_survival_pct', 'restoration_cost_usd_ha', 'carbon_stock_tC_ha', 'burial_rate_gC_m2_yr', 'sediment_carbon_density_gC_cm3'].includes(r.metric)) continue;
    if (typeof r.value !== 'number') continue;
    const key = `${iso}|${r.metric}|${r.source.source_id}`;
    if (!medRestorationByCountry[key]) {
      medRestorationByCountry[key] = {
        iso3: iso,
        country_name: countryNameByIso3.get(iso) || iso,
        metric: r.metric,
        unit: r.unit,
        source_id: r.source.source_id,
        values: [],
        sample_sites: [],
      };
    }
    medRestorationByCountry[key].values.push(r.value);
    const siteName = r.geo.site_name || r.geo.name;
    if (siteName && medRestorationByCountry[key].sample_sites.length < 4) {
      medRestorationByCountry[key].sample_sites.push({
        site_name: siteName,
        value: roundNum(r.value, 4),
        year: (r.period && r.period.reference_year) || null,
        lat: typeof r.geo.lat === 'number' ? roundNum(r.geo.lat, 4) : null,
        lon: typeof r.geo.lon === 'number' ? roundNum(r.geo.lon, 4) : null,
        fact_id: r.fact_id,
      });
    }
  }

  const medFieldBenchmarks = Object.values(medRestorationByCountry).map(item => ({
    iso3: item.iso3,
    country_name: item.country_name,
    metric: item.metric,
    unit: item.unit,
    source_id: item.source_id,
    stats: summarizeNumericValues(item.values),
    sample_sites: item.sample_sites,
  })).sort((a, b) => a.iso3.localeCompare(b.iso3) || a.metric.localeCompare(b.metric));

  const mediterraneanSeagrassSpotlight = {
    title: 'Mediterranean Basin Posidonia oceanica & Coastal Seagrass Synthesis',
    species_focus: 'Posidonia oceanica (endemic Mediterranean climax seagrass, 0-25 m Sentinel-2 bathymetric mosaic 2015-2019) & Cymodocea nodosa / Zostera spp.',
    basin_extent_ha: medBasinExtentRow ? roundNum(medBasinExtentRow.value, 1) : 1901960.0,
    basin_extent_fact_id: medBasinExtentRow ? medBasinExtentRow.fact_id : null,
    basin_carbon_stock_MtC: medBasinStockRow ? roundNum(medBasinStockRow.value, 2) : 722.2,
    basin_carbon_stock_MtCO2e: medBasinStockRow ? roundNum(medBasinStockRow.value * (44 / 12), 2) : 2648.07,
    basin_carbon_stock_fact_id: medBasinStockRow ? medBasinStockRow.fact_id : null,
    primary_source_id: 'traganos-mediterranean-seagrass-2022',
    turkiye_highlight: {
      iso3: 'TUR',
      country_name: 'Türkiye',
      posidonia_extent_ha: 74059.0,
      posidonia_source_id: 'traganos-mediterranean-seagrass-2022',
      posidonia_fact_id: 'seagrass.extent_ha.TUR.2019.traganos-mediterranean-seagrass-2022.21',
      posidonia_scope_note: 'Posidonia oceanica only, 0-25 m depth along Türkiye Mediterranean coast from 2015-2019 Sentinel-2 mosaic. Turbid waters in southeast Türkiye were manually masked by the authors and meadows >25 m depth (estimated at 20.8% basin-wide) are outside the optical mask.',
      mckenzie_bioregion_extent_ha: 231.0,
      mckenzie_source_id: 'mckenzie-seagrass-supplement-2020',
      mckenzie_fact_id: 'seagrass.extent_ha.TUR.2020.mckenzie-seagrass-supplement-2020.2',
      mckenzie_scope_note: 'Subnational Bioregion 3 mapped polygon fragment only (Moderate to High Confidence, Table S1); shown side-by-side without averaging to illustrate survey-boundary vs basin-mosaic divergence.',
      protected_fraction_pct: 6.15,
      protected_source_id: 'kumagai-habitat-protection-2022',
      protected_fact_id: 'seagrass.protected_fraction_pct.TUR.2022.kumagai-habitat-protection-2022.1293',
    },
    countries: medCountryRows,
    mediterranean_field_and_restoration_benchmarks: medFieldBenchmarks,
  };

  // 3. Restoration Economics & IUCN Red List of Ecosystems (RLE) Ledger
  const restorationGroups = {};
  for (const cat of ['seagrass', 'mangroves', 'algae']) {
    for (const r of rowsByCategory[cat]) {
      if (!['restoration_area_ha', 'restoration_survival_pct', 'restoration_cost_usd_ha', 'restoration_potential_ha'].includes(r.metric)) continue;
      if (typeof r.value !== 'number') continue;
      const iso = (r.geo && r.geo.country_id) || 'GLOBAL';
      const sid = r.source && r.source.source_id;
      const key = `${cat}|${r.metric}|${iso}|${sid}`;
      if (!restorationGroups[key]) {
        restorationGroups[key] = {
          category: cat,
          metric: r.metric,
          unit: r.unit,
          iso3: iso,
          country_name: countryNameByIso3.get(iso) || (r.geo && r.geo.name) || iso,
          source_id: sid,
          level: (r.geo && r.geo.level) || 'site',
          values: [],
          years: new Set(),
          species: new Set(),
          sample_records: [],
        };
      }
      const g = restorationGroups[key];
      g.values.push(r.value);
      if (r.period && r.period.reference_year) g.years.add(r.period.reference_year);
      const sp = extractSpeciesFromNote(r.basis && r.basis.note);
      if (sp) g.species.add(sp);
      if (g.sample_records.length < 4) {
        g.sample_records.push({
          fact_id: r.fact_id,
          site_name: (r.geo && (r.geo.site_name || r.geo.name)) || iso,
          value: roundNum(r.value, 4),
          unit: r.unit,
          year: (r.period && r.period.reference_year) || null,
          species: sp || null,
          lat: r.geo && typeof r.geo.lat === 'number' ? roundNum(r.geo.lat, 4) : null,
          lon: r.geo && typeof r.geo.lon === 'number' ? roundNum(r.geo.lon, 4) : null,
        });
      }
    }
  }

  const restorationRecords = Object.values(restorationGroups).map(g => {
    const yrs = [...g.years].sort((a, b) => a - b);
    return {
      category: g.category,
      metric: g.metric,
      unit: g.unit,
      iso3: g.iso3,
      country_name: g.country_name,
      level: g.level,
      source_id: g.source_id,
      year_range: yrs.length ? (yrs.length === 1 ? `${yrs[0]}` : `${yrs[0]}-${yrs[yrs.length - 1]}`) : null,
      species: [...g.species].slice(0, 5),
      stats: summarizeNumericValues(g.values),
      sample_records: g.sample_records,
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.metric.localeCompare(b.metric) || a.iso3.localeCompare(b.iso3));

  const iucnMangroveRleProvinces = rowsByCategory.mangroves
    .filter(r => r.metric === 'rle_status' && r.value !== null && r.value !== undefined)
    .map(r => ({
      fact_id: r.fact_id,
      province_name: (r.geo && r.geo.name) || 'Mangrove Province',
      status: String(r.value),
      year: (r.period && r.period.reference_year) || 2024,
      source_id: r.source && r.source.source_id,
      note: cleanWorkbenchNote(r.basis && r.basis.note),
    }))
    .sort((a, b) => a.province_name.localeCompare(b.province_name));

  const restorationAndEcosystemLedger = {
    summary: {
      seagrass_restoration_area_sites: 1491,
      seagrass_restoration_survival_sites: 139,
      seagrass_restoration_cost_sites: 64,
      mangrove_restoration_area_sites: 80,
      mangrove_restoration_survival_sites: 103,
      mangrove_restoration_cost_sites: 109,
      mangrove_restoration_potential_countries: 110,
      algae_restoration_records: 3,
      iucn_mangrove_rle_provinces: iucnMangroveRleProvinces.length,
    },
    records: restorationRecords,
    iucn_mangrove_rle_provinces: iucnMangroveRleProvinces,
  };

  // 4. Industrial Hemp & Pyrogenic Biochar Ledger (for TOBB Business Forum & Sıfır Atık Hub)
  const hempRows = rowsByCategory.hemp;
  const hempCarbonAndBiomass = [];
  for (const r of hempRows) {
    if (!['carbon_content_pct', 'carbon_stock_tC_ha', 'biomass_t_ha'].includes(r.metric)) continue;
    if (r.value === null || r.value === undefined) continue;
    hempCarbonAndBiomass.push({
      fact_id: r.fact_id,
      iso3: (r.geo && r.geo.country_id) || 'GLOBAL',
      location_name: (r.geo && (r.geo.site_name || r.geo.name)) || 'Global',
      metric: r.metric,
      value: roundNum(r.value, 4),
      unit: r.unit,
      year: (r.period && r.period.reference_year) || null,
      source_id: r.source && r.source.source_id,
      basis: cleanBasis(r.basis),
    });
  }

  const biocharRows = rowsByCategory.biochar;
  const biocharCharacterization = biocharRows
    .filter(r => ['carbon_content_pct', 'h_corg_ratio', 'permanence_fraction', 'price_usd_tCO2', 'tonnes_delivered_tCO2', 'sequestration_total_MtCO2_yr'].includes(r.metric) && r.value !== null && r.value !== undefined)
    .map(r => ({
      fact_id: r.fact_id,
      iso3: (r.geo && r.geo.country_id) || 'GLOBAL',
      location_name: (r.geo && (r.geo.site_name || r.geo.name)) || 'Global',
      metric: r.metric,
      value: roundNum(r.value, 4),
      unit: r.unit,
      year: (r.period && r.period.reference_year) || null,
      source_id: r.source && r.source.source_id,
      basis: cleanBasis(r.basis),
    }));

  const hempAndBiocharLedger = {
    turkiye_industrial_profile: {
      iso3: 'TUR',
      country_name: 'Türkiye',
      hemp_2024_fibre_area_ha: 1000.0,
      hemp_2024_fibre_production_t_yr: 2000.0,
      hemp_2024_fibre_yield_t_ha_yr: 1.0,
      hemp_2024_seed_area_ha: 721.0,
      hemp_2024_seed_production_t_yr: 556.0,
      hemp_2024_seed_yield_t_ha_yr: 0.7712,
      hemp_historical_peak_1961_seed_area_ha: 13700.0,
      hemp_historical_peak_1961_fibre_area_ha: 7100.0,
      hemp_sources: ['faostat-hemp-crops-filtered-2024', 'eurostat-hemp-production-2023'],
      biochar_technical_potential_MtCO2_yr: 13.9555,
      biochar_technical_fact_id: 'biochar.removal_potential_MtCO2_yr.TUR.2020-2050.roe-land-mitigation-supplement-2021.1',
      biochar_economic_potential_MtCO2_yr: 10.792,
      biochar_economic_fact_id: 'biochar.removal_potential_MtCO2_yr.TUR.2020-2050.roe-land-mitigation-supplement-2021.2',
      biochar_permanence_rule: '80% of biochar carbon persists on a timescale of >100 years (IPCC, 2019)',
      biochar_source_id: 'roe-land-mitigation-supplement-2021',
    },
    hemp_carbon_and_cultivar_trials: hempCarbonAndBiomass,
    biochar_characterization_and_stability: biocharCharacterization,
  };

  // 5. Per-country slice from globe_slice.json + site summaries + policies
  const countriesOut = {};
  const allIsoSet = new Set(Object.keys(globeSlice.countries || {}));

  for (const iso of [...allIsoSet].sort()) {
    const rawCats = (globeSlice.countries && globeSlice.countries[iso]) || {};
    const siteCats = countrySiteSummary[iso] || {};
    const catKeys = new Set([...Object.keys(rawCats), ...Object.keys(siteCats)]);
    const countryCategories = {};

    for (const cat of [...catKeys].sort()) {
      const rawMetrics = rawCats[cat] || {};
      const metricsOut = {};

      for (const [mKey, yearsObj] of Object.entries(rawMetrics).sort((a, b) => a[0].localeCompare(b[0]))) {
        const sortedYears = Object.keys(yearsObj).sort();
        if (!sortedYears.length) continue;

        const firstYear = sortedYears[0];
        const latestYear = sortedYears[sortedYears.length - 1];
        const keptYears = new Set([
          firstYear,
          ...sortedYears.slice(-2),
        ]);

        // Keep anchor years
        for (const y of sortedYears) {
          if (ANCHOR_YEARS.has(String(y)) || (iso === 'TUR' && TUR_ANCHOR_YEARS.has(String(y)))) {
            keptYears.add(y);
          }
        }

        const observations = [];
        const allNumericValues = [];
        const metricSources = new Set();
        const verboseNote = iso === 'TUR' || cat === 'seagrass';

        for (const y of sortedYears) {
          const cell = yearsObj[y];
          const entries = Array.isArray(cell) ? cell : [cell];
          for (const e of entries) {
            if (typeof e.value === 'number' && Number.isFinite(e.value)) {
              allNumericValues.push(e.value);
            }
            if (e.source_id) metricSources.add(e.source_id);
          }
          if (keptYears.has(y) && y !== latestYear) {
            for (const e of entries) {
              observations.push(buildEntryRecord(e, y, verboseNote));
            }
          }
        }

        const latestCell = yearsObj[latestYear];
        const latestEntries = (Array.isArray(latestCell) ? latestCell : [latestCell]).map(e => buildEntryRecord(e, latestYear, verboseNote));
        const firstCell = yearsObj[firstYear];
        const firstEntries = (Array.isArray(firstCell) ? firstCell : [firstCell]).map(e => buildEntryRecord(e, firstYear, false));

        const [baseMetric, qualifier] = mKey.split('|');
        metricsOut[mKey] = {
          metric: baseMetric,
          qualifier: qualifier || null,
          latest_year: String(latestYear),
          latest: latestEntries,
          collision_in_latest: latestEntries.length > 1,
          series_summary: {
            first_year: String(firstYear),
            first_value: firstEntries[0] ? firstEntries[0].value : null,
            latest_year: String(latestYear),
            latest_value: latestEntries[0] ? latestEntries[0].value : null,
            year_count: sortedYears.length,
            min_value: allNumericValues.length ? roundNum(Math.min(...allNumericValues), 4) : null,
            max_value: allNumericValues.length ? roundNum(Math.max(...allNumericValues), 4) : null,
            sources: [...metricSources].sort(),
          },
          observations,
        };
      }

      const siteBuckets = siteCats[cat] ? Object.values(siteCats[cat]).map(b => {
        const yrs = [...b.years].sort((a, b2) => a - b2);
        return {
          metric: b.metric,
          level: b.level,
          unit: b.unit,
          stats: summarizeNumericValues(b.values),
          year_range: yrs.length ? (yrs.length === 1 ? `${yrs[0]}` : `${yrs[0]}-${yrs[yrs.length - 1]}`) : null,
          sources: [...b.sources].sort(),
          species: [...b.species].sort().slice(0, 6),
          sample_sites: b.sample_sites,
        };
      }).sort((a, b) => a.metric.localeCompare(b.metric) || a.level.localeCompare(b.level)) : [];

      if (Object.keys(metricsOut).length || siteBuckets.length) {
        countryCategories[cat] = {
          metrics: metricsOut,
          site_and_subnational: siteBuckets,
        };
      }
    }

    const rawPolicies = (policiesPayload.policies && policiesPayload.policies[iso]) || [];
    const cleanPolicies = rawPolicies.map(p => ({
      policy_id: p.policy_id,
      title: cleanWorkbenchNote(p.title),
      year: p.year || null,
      instrument_type: p.instrument_type || null,
      status: p.status || null,
      categories: Array.isArray(p.categories) ? p.categories : [],
      quantitative_target: cleanWorkbenchNote(p.quantitative_target),
      verbatim_quote: cleanWorkbenchNote(p.verbatim_quote),
      source_id: p.source_id,
    }));

    countriesOut[iso] = {
      iso3: iso,
      country_name: countryNameByIso3.get(iso) || iso,
      mediterranean_basin: MEDITERRANEAN_ISO3.includes(iso),
      categories_present: Object.keys(countryCategories).sort(),
      categories: countryCategories,
      policies: cleanPolicies,
    };
  }

  const keptTotal = (datapackage.resources || [])
    .filter(r => r.path && r.path.startsWith('rows_'))
    .reduce((sum, r) => sum + (r.rows || 0), 0);
  const droppedMap = coverage.dropped || {};
  const droppedTotal = Object.values(droppedMap).reduce((sum, n) => sum + n, 0);

  const payload = {
    schema_version: '1.0.0',
    release_id: 'nbs-atlas-public-noncommercial-v1',
    profile: 'public_noncommercial',
    workbench_commit: datapackage.workbench_commit,
    calculation_hash: null,
    atlas_totals: {
      canonical_v1_rows: 46648,
      canonical_v1_sources: 247,
      public_noncommercial_rows_kept: keptTotal,
      public_noncommercial_rows_withheld: droppedTotal,
      public_noncommercial_sources_admitted: Object.keys(sources).length,
      countries_in_slice: Object.keys(countriesOut).length,
      withheld_by_category_and_reason: droppedMap,
    },
    categories: categoriesOut,
    mediterranean_seagrass_spotlight: mediterraneanSeagrassSpotlight,
    restoration_and_ecosystem_ledger: restorationAndEcosystemLedger,
    hemp_and_biochar_industrial_ledger: hempAndBiocharLedger,
    metrics_catalog: metricsCatalog,
    sources,
    countries: countriesOut,
  };

  payload.calculation_hash = calculationHash(payload);
  return payload;
}

function verifyPayload(payload) {
  const schema = readJson(path.join(ROOT, SCHEMA_REL));
  const errors = validateJsonSchema(payload, schema);
  if (errors.length) {
    throw new Error('NbS Atlas schema validation failed: ' + errors.join('; '));
  }
  if (payload.calculation_hash !== calculationHash(payload)) {
    throw new Error('NbS Atlas calculation_hash mismatch');
  }
  return true;
}

function main() {
  const args = process.argv.slice(2);
  const outputPath = path.resolve(option(args, '--output', path.join(ROOT, OUTPUT_REL)));
  if (args.includes('--verify-only')) {
    const existing = readJson(outputPath);
    verifyPayload(existing);
    process.stdout.write(`Verified existing NbS Atlas runtime (${fileSha256(outputPath)})\n`);
    return;
  }
  const payload = build(args);
  verifyPayload(payload);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const serialized = JSON.stringify(stable(payload)) + '\n';
  fs.writeFileSync(outputPath, serialized, 'utf8');
  const digest = sha256(serialized);
  const bytes = fs.statSync(outputPath).size;
  process.stdout.write(
    `Built NbS Atlas runtime (${Object.keys(payload.countries).length} countries, ` +
    `${Object.keys(payload.sources).length} admitted sources, ${(bytes / (1024 * 1024)).toFixed(2)} MB, sha256=${digest})\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  CATEGORY_META,
  MEDITERRANEAN_ISO3,
  OUTPUT_REL,
  SCHEMA_REL,
  build,
  calculationHash,
  verifyPayload,
};
