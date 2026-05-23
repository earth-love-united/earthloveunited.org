#!/usr/bin/env python3
"""
Generate country-level NDVI averages from MODIS satellite data via Google Earth Engine.

Uses MODIS/061/MOD13A2 (16-day, 1km NDVI) and FAO GAUL level0 boundaries.
Processes countries in small batches to avoid Earth Engine computation timeouts.
Outputs to data/ndvi-countries.json

Attribution: NASA LP DAAC MODIS via Google Earth Engine.
             Data is public domain, used for educational/noncommercial purposes.

This is a one-time data generation tool. NOT part of the website.
"""

import ee
import json
import sys
import os
import time
from datetime import datetime, timezone

# ── Configuration ──
YEARS = [2000, 2005, 2010, 2015, 2020, 2024]
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'ndvi-countries.json')
MODIS_COLLECTION = 'MODIS/061/MOD13A2'
NDVI_BAND = 'NDVI'
NDVI_SCALE_FACTOR = 0.0001
SCALE_METERS = 100000  # 100km — very fast, good enough for country averages
GCP_PROJECT = 'egregore-488923'
COUNTRY_COLLECTION = 'FAO/GAUL/2015/level0'
BATCH_SIZE = 30  # Process this many countries per Earth Engine call


def authenticate():
    """Initialize Earth Engine."""
    try:
        ee.Initialize(project=GCP_PROJECT)
        print(f"✅ Earth Engine initialized (project: {GCP_PROJECT})")
        return True
    except Exception as e:
        print(f"❌ Init failed: {e}")
        return False


def get_annual_ndvi(year):
    """Get annual mean NDVI composite."""
    collection = (ee.ImageCollection(MODIS_COLLECTION)
                  .filterDate(f'{year}-01-01', f'{year}-12-31')
                  .select(NDVI_BAND))
    return collection.mean().multiply(NDVI_SCALE_FACTOR)


def process_batch(ndvi_image, batch_fc, year):
    """Process a batch of countries and return {code: {name, ndvi}} dict."""
    results = {}
    
    def compute_mean(feature):
        mean_val = ndvi_image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=feature.geometry(),
            scale=SCALE_METERS,
            maxPixels=1e8,
            bestEffort=True,
        )
        return feature.set('ndvi_mean', mean_val.get(NDVI_BAND))

    mapped = batch_fc.map(compute_mean, opt_dropNulls=False)
    features = mapped.getInfo()['features']
    
    for feat in features:
        props = feat['properties']
        name = props.get('ADM0_NAME', '')
        code = str(props.get('ADM0_CODE', 0))
        ndvi_val = props.get('ndvi_mean')
        if name and ndvi_val is not None:
            results[code] = {'name': name, 'ndvi': round(ndvi_val, 4)}
    
    return results


def main():
    print("=" * 60)
    print("NDVI Country Data Generator — MODIS (Batched)")
    print(f"  {len(YEARS)} years × ~250 countries @ {SCALE_METERS/1000:.0f}km")
    print("  Batch size:", BATCH_SIZE)
    print("=" * 60)

    if not authenticate():
        sys.exit(1)

    # Load country boundaries
    print("\n📍 Loading country boundaries...")
    countries_fc = ee.FeatureCollection(COUNTRY_COLLECTION)
    
    # Get country list to compute batch count
    country_list = countries_fc.aggregate_array('ADM0_CODE').getInfo()
    total_countries = len(country_list)
    print(f"   Found {total_countries} countries")
    
    all_data = {}  # { code: { year: ndvi } }
    name_map = {}  # { code: name }

    for year in YEARS:
        print(f"\n🛰️  Year {year}:", flush=True)
        ndvi_image = get_annual_ndvi(year)
        
        # Process in batches
        year_count = 0
        for batch_start in range(0, total_countries, BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, total_countries)
            batch_codes = country_list[batch_start:batch_end]
            
            batch_fc = countries_fc.filter(
                ee.Filter.inList('ADM0_CODE', batch_codes)
            )
            
            try:
                results = process_batch(ndvi_image, batch_fc, year)
                for code, info in results.items():
                    if code not in all_data:
                        all_data[code] = {}
                        name_map[code] = info['name']
                    all_data[code][str(year)] = info['ndvi']
                    year_count += 1
                
                print(f"   batch {batch_start//BATCH_SIZE + 1}/{(total_countries + BATCH_SIZE - 1)//BATCH_SIZE}: {len(results)} countries ✅", flush=True)
                
                # Brief pause to be nice to the API
                time.sleep(0.5)
                
            except Exception as e:
                err_msg = str(e)
                if 'timed out' in err_msg.lower():
                    print(f"   batch {batch_start//BATCH_SIZE + 1}: ⏱️  timeout, retrying with smaller batch...", flush=True)
                    # Retry individual countries in this batch
                    for code in batch_codes:
                        try:
                            single_fc = countries_fc.filter(ee.Filter.eq('ADM0_CODE', code))
                            results = process_batch(ndvi_image, single_fc, year)
                            for c, info in results.items():
                                if c not in all_data:
                                    all_data[c] = {}
                                    name_map[c] = info['name']
                                all_data[c][str(year)] = info['ndvi']
                                year_count += 1
                            time.sleep(0.2)
                        except Exception as e2:
                            pass  # Skip problematic country
                else:
                    print(f"   batch {batch_start//BATCH_SIZE + 1}: ❌ {err_msg[:80]}")
        
        print(f"   → {year_count} countries total for {year}")

    # Build output
    output = {
        "meta": {
            "source": MODIS_COLLECTION,
            "statistic": "mean_annual_ndvi",
            "scale_meters": SCALE_METERS,
            "years": YEARS,
            "countries": len(all_data),
            "generated": datetime.now(timezone.utc).isoformat(),
            "attribution": "NASA LP DAAC MODIS via Google Earth Engine. Public domain, educational use.",
        },
        "names": name_map,
        "data": all_data
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"✅ Wrote {len(all_data)} countries × {len(YEARS)} years")
    print(f"   File: {OUTPUT_PATH}")
    print(f"   Size: {os.path.getsize(OUTPUT_PATH) / 1024:.1f} KB")
    print(f"{'=' * 60}")
    
    # Samples
    for code in list(all_data.keys())[:5]:
        vals = all_data[code]
        name = name_map.get(code, '?')
        v_list = [str(vals.get(str(y), '?')) for y in YEARS]
        print(f"   {name}: {' → '.join(v_list)}")


if __name__ == '__main__':
    main()
