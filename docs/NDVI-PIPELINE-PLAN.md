# NDVI Data Pipeline: From Synthetic to Real

## Current State
- All NDVI values in sites.json are hand-crafted narrative constructs
- ndvi-countries.json explicitly marked "SYNTHETIC_TEST_DATA"
- No MODIS scene IDs, no processing pipeline, no source metadata

## Target State
- Real MODIS NDVI (MOD13Q1, 250m, 16-day composite) for all 4 site locations
- Documented processing chain: raw download → mosaic → zonal stats → JSON
- Source metadata in data files (scene IDs, processing date, version)

## Pipeline Design

### Step 1: Data Source
- Product: MODIS MOD13Q1 v6.1 (Vegetation Indices, 250m, 16-day)
- Coverage: global, free, no license restrictions
- Access: NASA Earthdata CMR API or Google Earth Engine
- Alternative: Copernicus Sentinel-2 (10m, 5-day) via Sentinel Hub (current NDVIVerifier already targets this)

### Step 2: Spatial Extraction
- For each site, define a bounding box or polygon:
  - Sri Lanka (Northern Province): ~9.5-10.0°N, 80.0-80.8°E
  - Antalya: ~36.7-37.0°N, 31.0-31.5°E
  - Benin (Ouidah): ~6.2-6.5°N, 2.0-2.3°E
  - Borneo (West Kalimantan): ~1.0-1.3°N, 110.2-110.5°E
- Buffer: 5km around centroid to capture surrounding land use

### Step 3: Temporal Extraction
- For each year in the narrative arc, extract the annual mean NDVI
- Filter: use only 16-day composites from growing season (or annual min/mean/max)
- Output: one NDVI value per year per site

### Step 4: Processing
Option A — Google Earth Engine (fastest):
```javascript
// Pseudocode
var collection = ee.ImageCollection('MODIS/061/MOD13Q1')
  .filterBounds(site_geometry)
  .filterDate('2000-01-01', '2024-12-31')
  .select('NDVI');

var annual = collection.map(function(img) {
  return img.multiply(0.0001).set('system:time_start', img.get('system:time_start'));
});

// Reduce to annual mean
var years = ee.List.sequence(2000, 2024);
var byYear = years.map(function(y) {
  return annual.filter(ee.Filter.calendarRange(y, y, 'year'))
    .mean()
    .set('year', y);
});
```

Option B — Sentinel Hub Statistical API (already partially wired in NDVIVerifier):
- Use Sentinel-2 L2A (10m resolution)
- NDVI = (B8A - B4) / (B8A + B4)
- Statistical API returns percentiles, mean, std per time range

### Step 5: Validation
- Cross-check against published literature for each site:
  - Antalya 2021 fire: known event, satellite-confirmed (EFFIS/EMSR)
  - Borneo peat clearing: documented in Hansen et al. Global Forest Watch
  - Benin mangrove: AfriCover/UNEP mapping exists
  - Sri Lanka conflict-era land cover: UNEP SL assessment

### Step 6: Integration
- Replace synthetic arrays in sites.json with real values
- Add metadata block per site:
```json
"ndvi_source": {
  "product": "MODIS MOD13Q1 v6.1",
  "resolution_m": 250,
  "temporal_composite": "16-day",
  "processing": "annual_mean",
  "scene_ids": ["h28v08_20200101", "..."],
  "downloaded": "2026-06-24",
  "pipeline_version": "1.0"
}
```

## Effort Estimate
- GEE script: 2 hours
- Data download + processing: 1 hour
- Validation against literature: 2 hours
- Integration into sites.json: 30 minutes
- Total: ~5-6 hours

## Blocker
- Requires NASA Earthdata login (free but needs registration)
- Or Google Earth Engine account (free for non-commercial)
- Both require human setup — I cannot authenticate on your behalf

## Alternative (lower effort)
- Use Global Forest Watch integrated deforestation data (already API-accessible in RegistryCheck)
- Use Copernicus Climate Data Store for Essential Climate Variables
- Both free, both need registration for API access