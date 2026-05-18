#!/usr/bin/env python3
"""
Main pipeline: Merge all data sources into Pledge vs Reality dataset

Output: Parquet file with ~1900 rows (190 countries x 10 years, 2015-2024)
Columns:
  - country, year
  - ndc_target_year, ndc_version, ndc_submission_date
  - fossil_co2_mtCO2, fossil_co2_mtC
  - cat_rating, cat_rating_score
  - policy_count (from CPD, if available)
  - climate_finance_usd (from OECD, if available)
  - pledge_reduction_pct (from NDC title parsing)
  - gap_metrics (computed)
"""
import pandas as pd
import numpy as np
import os
import json

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
PROC_DIR = os.path.join(DATA_DIR, 'processed')
OUT_DIR = os.path.join(DATA_DIR, 'output')

def load_processed():
    """Load all processed data sources"""
    sources = {}
    
    # NDC latest
    ndc_path = os.path.join(PROC_DIR, 'ndc_latest.csv')
    if os.path.exists(ndc_path):
        sources['ndc'] = pd.read_csv(ndc_path)
        print(f"NDC: {len(sources['ndc'])} countries")
    
    # GCB emissions
    gcb_path = os.path.join(PROC_DIR, 'gcb_emissions.csv')
    if os.path.exists(gcb_path):
        sources['gcb'] = pd.read_csv(gcb_path)
        print(f"GCB: {len(sources['gcb'])} records")
    
    # CAT ratings
    cat_path = os.path.join(PROC_DIR, 'cat_ratings.csv')
    if os.path.exists(cat_path):
        sources['cat'] = pd.read_csv(cat_path)
        print(f"CAT: {len(sources['cat'])} countries")
    
    return sources

def compute_gap_metrics(df):
    """
    Compute pledge vs reality gap metrics:
    - emissions_change_pct: % change from 2015 baseline
    - required_annual_reduction_pct: what's needed to hit NDC target
    - actual_annual_change_pct: actual average annual change
    - gap: difference between required and actual
    """
    results = []
    
    for country in df['country'].unique():
        cdf = df[df['country'] == country].sort_values('year')
        if len(cdf) < 2:
            continue
        
        # 2015 baseline emissions
        baseline = cdf[cdf['year'] == 2015]['fossil_co2_mtCO2'].values
        if len(baseline) == 0:
            continue
        baseline = baseline[0]
        
        # NDC target year
        target_year = cdf['ndc_target_year'].dropna().values
        target_year = int(target_year[0]) if len(target_year) > 0 else None
        
        # Pledge reduction %
        pledge_pct = cdf['pledge_reduction_pct'].dropna().values
        pledge_pct = pledge_pct[0] if len(pledge_pct) > 0 else None
        
        for _, row in cdf.iterrows():
            year = row['year']
            emissions = row['fossil_co2_mtCO2']
            
            # Emissions change from 2015 baseline
            if baseline > 0:
                emissions_change_pct = ((emissions - baseline) / baseline) * 100
            else:
                emissions_change_pct = 0.0
            
            # Required annual reduction to hit target
            required_annual_reduction = None
            if target_year and target_year > 2015 and pledge_pct:
                years_remaining = target_year - 2015
                if years_remaining > 0:
                    required_annual_reduction = pledge_pct / years_remaining
            
            # Actual annual change (year-over-year)
            prev_year = cdf[cdf['year'] == year - 1]['fossil_co2_mtCO2'].values
            if len(prev_year) > 0 and prev_year[0] > 0:
                actual_annual_change = ((emissions - prev_year[0]) / prev_year[0]) * 100
            else:
                actual_annual_change = 0.0
            
            # Gap: required vs actual (positive = falling behind)
            gap = None
            if required_annual_reduction is not None:
                gap = required_annual_reduction - (-actual_annual_change)
                # If actual is decreasing (negative change) and required is positive,
                # gap = required - |actual|
            
            results.append({
                'country': country,
                'year': year,
                'fossil_co2_mtCO2': emissions,
                'fossil_co2_mtC': row.get('fossil_co2_mtC', emissions / 3.664),
                'ndc_target_year': target_year,
                'ndc_version': row.get('ndc_version', None),
                'ndc_submission_date': row.get('ndc_submission_date', None),
                'pledge_reduction_pct': pledge_pct,
                'cat_rating': row.get('cat_rating', 'Not assessed'),
                'cat_rating_score': row.get('cat_rating_score', 0),
                'emissions_change_from_2015_pct': round(emissions_change_pct, 2),
                'required_annual_reduction_pct': round(required_annual_reduction, 2) if required_annual_reduction is not None else None,
                'actual_annual_change_pct': round(actual_annual_change, 2),
                'gap_pct': round(gap, 2) if gap is not None else None,
            })
    
    return pd.DataFrame(results)

def build_dataset():
    sources = load_processed()
    
    # Start with GCB emissions as the base (has country + year)
    if 'gcb' not in sources:
        print("ERROR: GCB emissions data required")
        return
    
    base = sources['gcb'][['country', 'year', 'fossil_co2_mtC', 'fossil_co2_mtCO2']].copy()
    
    # Merge NDC data (one row per country, same for all years)
    if 'ndc' in sources:
        ndc = sources['ndc'][['country', 'target_year', 'reduction_pct', 'ndc_version', 'submission_date']].copy()
        ndc = ndc.rename(columns={
            'target_year': 'ndc_target_year',
            'reduction_pct': 'pledge_reduction_pct',
            'submission_date': 'ndc_submission_date'
        })
        base = base.merge(ndc, on='country', how='left')
    
    # Merge CAT ratings (one row per country)
    if 'cat' in sources:
        cat = sources['cat'][['country', 'rating', 'rating_score']].copy()
        cat = cat.rename(columns={'rating': 'cat_rating', 'rating_score': 'cat_rating_score'})
        base = base.merge(cat, on='country', how='left')
    
    # Fill missing CAT ratings
    base['cat_rating'] = base['cat_rating'].fillna('Not assessed')
    base['cat_rating_score'] = base['cat_rating_score'].fillna(0).astype(int)
    
    # Compute gap metrics
    print("\nComputing gap metrics...")
    result = compute_gap_metrics(base)
    
    # Add on_track flag based on gap
    result['on_track'] = result.apply(lambda r: (
        True if r['gap_pct'] is not None and r['gap_pct'] <= 0 else
        (False if r['gap_pct'] is not None else None)
    ), axis=1)
    
    # Globe color: map CAT rating to color
    COLOR_MAP = {
        '1.5°C Paris Agreement Compatible': '#2ecc71',  # green
        'Almost sufficient': '#27ae60',  # dark green
        'Insufficient': '#f39c12',  # orange
        'Highly insufficient': '#e74c3c',  # red
        'Critically insufficient': '#c0392b',  # dark red
        'Not assessed': '#95a5a6',  # gray
    }
    result['globe_color'] = result['cat_rating'].map(COLOR_MAP).fillna('#95a5a6')
    
    # Sort
    result = result.sort_values(['country', 'year']).reset_index(drop=True)
    
    # Save
    os.makedirs(OUT_DIR, exist_ok=True)
    
    # Save as CSV
    result.to_csv(os.path.join(OUT_DIR, 'pledge_vs_reality.csv'), index=False)
    
    # Save as Parquet
    result.to_parquet(os.path.join(OUT_DIR, 'pledge_vs_reality.parquet'), index=False)
    
    # Save summary JSON for web integration
    summary = {
        'total_countries': int(result['country'].nunique()),
        'total_records': len(result),
        'year_range': [int(result['year'].min()), int(result['year'].max())],
        'cat_coverage': int(result[result['cat_rating'] != 'Not assessed']['country'].nunique()),
        'ndc_coverage': int(result[result['ndc_target_year'].notna()]['country'].nunique()),
        'columns': list(result.columns),
    }
    with open(os.path.join(OUT_DIR, 'summary.json'), 'w') as f:
        json.dump(summary, f, indent=2, default=str)
    
    print(f"\n=== Dataset Complete ===")
    print(f"Records: {len(result)}")
    print(f"Countries: {result['country'].nunique()}")
    print(f"Years: {result['year'].min()} - {result['year'].max()}")
    print(f"CAT coverage: {summary['cat_coverage']} countries")
    print(f"NDC target year coverage: {summary['ndc_coverage']} countries")
    print(f"\nColumns: {list(result.columns)}")
    print(f"\nOutput files:")
    print(f"  CSV: {os.path.join(OUT_DIR, 'pledge_vs_reality.csv')}")
    print(f"  Parquet: {os.path.join(OUT_DIR, 'pledge_vs_reality.parquet')}")
    print(f"  Summary: {os.path.join(OUT_DIR, 'summary.json')}")
    
    # Print sample
    print(f"\n=== Sample: Top emitters 2024 ===")
    top = result[result['year'] == 2024].nlargest(10, 'fossil_co2_mtCO2')
    print(top[['country', 'fossil_co2_mtCO2', 'ndc_target_year', 'cat_rating', 'gap_pct']].to_string(index=False))
    
    return result

if __name__ == '__main__':
    build_dataset()
