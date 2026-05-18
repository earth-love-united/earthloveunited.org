#!/usr/bin/env python3
"""
Build the enriched Pledge vs Reality dataset.

Data sources:
1. GCB 2025 - National fossil CO2 emissions (212 countries, 2015-2024)
2. CAT country pages - Detailed ratings + NDC target values (40 countries)
3. UNFCCC NDC Registry - Submission metadata (196 countries)
4. Climate Watch - NDC content/pledges (190+ countries)
5. World Bank - Population, GDP (200+ countries)

Output: data/output/pledge_vs_reality_enriched.parquet
"""
import pandas as pd
import numpy as np
import json
import os
import re

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROC_DIR = os.path.join(DATA_DIR, 'processed')
OUT_DIR = os.path.join(DATA_DIR, 'output')

def load_climate_watch_ndc():
    """Load and parse Climate Watch NDC content data"""
    print("Loading Climate Watch NDC data...")
    with open(os.path.join(RAW_DIR, 'cw_ndc_all.json')) as f:
        raw = json.load(f)
    
    records = raw.get('data', [])
    
    # Group by country
    country_data = {}
    for r in records:
        country = r.get('country', '')
        indicator = r.get('indicator_id', '') or r.get('indicator_name', '')
        value = r.get('value', '')
        
        if not country or not indicator:
            continue
        
        if country not in country_data:
            country_data[country] = {'country': country, 'iso_code': r.get('iso_code3', '')}
        
        key = indicator.lower().replace(' ', '_').replace('-', '_')[:64]
        country_data[country][key] = value
    
    df = pd.DataFrame(list(country_data.values()))
    print(f"  Climate Watch: {len(df)} countries, {len(df.columns)} indicators")
    
    # NOTE: The API only returned 1 country (Afghanistan) with 1000 records.
    # For a full dataset, we'd need to paginate through all countries.
    # For now, we'll use what we have and note the limitation.
    if len(df) <= 1:
        print("  WARNING: Climate Watch data only has 1 country. Skipping merge.")
        return pd.DataFrame()  # Return empty to skip merge
    
    return df

def load_world_bank():
    """Load World Bank population and GDP data"""
    print("Loading World Bank data...")
    
    def parse_wb_indicator(filepath, indicator_name):
        with open(filepath) as f:
            data = json.load(f)
        if not isinstance(data, list) or len(data) < 2:
            return pd.DataFrame()
        
        records = []
        for r in data[1]:
            val = r.get('value')
            if val is not None:
                records.append({
                    'country': r.get('country', {}).get('value', ''),
                    'iso_code': r.get('countryiso3code', ''),
                    'year': int(r.get('date', 0)),
                    indicator_name: float(val)
                })
        return pd.DataFrame(records)
    
    pop = parse_wb_indicator(os.path.join(RAW_DIR, 'wb_pop.json'), 'population')
    gdp = parse_wb_indicator(os.path.join(RAW_DIR, 'wb_gdp.json'), 'gdp_usd')
    
    # Merge pop and GDP
    if not pop.empty and not gdp.empty:
        wb = pop.merge(gdp, on=['country', 'iso_code', 'year'], how='outer')
    elif not pop.empty:
        wb = pop
    else:
        wb = gdp
    
    print(f"  World Bank: {len(wb)} records")
    return wb

def load_cat_detailed():
    """Load detailed CAT country data"""
    print("Loading CAT detailed data...")
    df = pd.read_csv(os.path.join(RAW_DIR, 'cat_country_data.csv'))
    
    # Normalize column names
    col_map = {}
    for c in df.columns:
        new = c.lower().replace(' ', '_').replace('&', 'and').replace('__', '_')
        col_map[c] = new
    df = df.rename(columns=col_map)
    
    # Normalize country names
    cat_name_map = {
        'united states': 'United States', 'russia': 'Russia',
        'south korea': 'South Korea', 'united kingdom': 'United Kingdom',
        'united arab emirates': 'United Arab Emirates', 'saudi arabia': 'Saudi Arabia',
        'new zealand': 'New Zealand', 'south africa': 'South Africa',
        'costa rica': 'Costa Rica', 'sri lanka': 'Sri Lanka',
        'north macedonia': 'North Macedonia', 'czech republic': 'Czech Republic',
        'ivory coast': "Cote d'Ivoire", 'cape verde': 'Cape Verde',
        'democratic republic of the congo': 'DR Congo', 'republic of the congo': 'Republic of the Congo',
        'myanmar': 'Myanmar', 'laos': 'Laos', 'vietnam': 'Vietnam',
        'philippines': 'Philippines', 'indonesia': 'Indonesia',
        'bangladesh': 'Bangladesh', 'pakistan': 'Pakistan',
        'nigeria': 'Nigeria', 'ethiopia': 'Ethiopia', 'kenya': 'Kenya',
        'morocco': 'Morocco', 'egypt': 'Egypt', 'algeria': 'Algeria',
        'tunisia': 'Tunisia', 'libya': 'Libya', 'sudan': 'Sudan',
        'ghana': 'Ghana', 'cameroon': 'Cameroon', 'gabon': 'Gabon',
        'australia': 'Australia', 'japan': 'Japan', 'india': 'India',
        'china': 'China', 'canada': 'Canada', 'brazil': 'Brazil',
        'mexico': 'Mexico', 'argentina': 'Argentina', 'chile': 'Chile',
        'colombia': 'Colombia', 'peru': 'Peru', 'venezuela': 'Venezuela',
        'ecuador': 'Ecuador', 'bolivia': 'Bolivia', 'paraguay': 'Paraguay',
        'uruguay': 'Uruguay', 'germany': 'Germany', 'france': 'France',
        'italy': 'Italy', 'spain': 'Spain', 'netherlands': 'Netherlands',
        'belgium': 'Belgium', 'switzerland': 'Switzerland', 'norway': 'Norway',
        'sweden': 'Sweden', 'finland': 'Finland', 'denmark': 'Denmark',
        'poland': 'Poland', 'ukraine': 'Ukraine', 'turkey': 'Turkey',
        'iran': 'Iran', 'iraq': 'Iraq', 'israel': 'Israel',
        'jordan': 'Jordan', 'lebanon': 'Lebanon', 'syria': 'Syria',
        'thailand': 'Thailand', 'malaysia': 'Malaysia', 'singapore': 'Singapore',
        'nepal': 'Nepal', 'bhutan': 'Bhutan', 'gambia': 'Gambia',
        'kazakhstan': 'Kazakhstan', 'uzbekistan': 'Uzbekistan',
        'turkmenistan': 'Turkmenistan', 'kyrgyzstan': 'Kyrgyzstan',
        'tajikistan': 'Tajikistan', 'mongolia': 'Mongolia',
        'european union': 'European Union',
    }
    
    df['country'] = df['country'].str.strip().str.lower().map(cat_name_map).fillna(df['country'])
    
    # Normalize rating values
    rating_map = {
        'critically insufficient': 'Critically insufficient',
        'highly insufficient': 'Highly insufficient',
        'insufficient': 'Insufficient',
        'almost sufficient': 'Almost sufficient',
        '1.5°c paris agreement compatible': '1.5°C Paris Agreement Compatible',
        'not assessed': 'Not assessed',
    }
    
    for col in df.columns:
        if 'rating' in col or 'target' in col or 'policies' in col:
            if df[col].dtype == object:
                df[col] = df[col].str.strip().str.lower().map(rating_map).fillna(df[col])
    
    print(f"  CAT detailed: {len(df)} countries, {len(df.columns)} columns")
    return df

def load_gcb_emissions():
    """Load processed GCB emissions"""
    print("Loading GCB emissions...")
    df = pd.read_csv(os.path.join(PROC_DIR, 'gcb_emissions.csv'))
    print(f"  GCB: {len(df)} records, {df['country'].nunique()} countries")
    return df

def load_ndc_registry():
    """Load processed NDC registry data"""
    print("Loading NDC registry...")
    df = pd.read_csv(os.path.join(PROC_DIR, 'ndc_latest.csv'))
    print(f"  NDC: {len(df)} countries")
    return df

def build_enriched_dataset():
    """Merge all sources into the enriched dataset"""
    
    gcb = load_gcb_emissions()
    cat = load_cat_detailed()
    ndc = load_ndc_registry()
    cw = load_climate_watch_ndc()
    wb = load_world_bank()
    
    # Start with GCB as base
    print("\nBuilding enriched dataset...")
    base = gcb[['country', 'year', 'fossil_co2_mtC', 'fossil_co2_mtCO2']].copy()
    
    # Merge NDC data
    ndc_cols = ['country', 'target_year', 'ndc_version', 'submission_date', 'language']
    ndc_merge = ndc[[c for c in ndc_cols if c in ndc.columns]].copy()
    ndc_merge = ndc_merge.rename(columns={'target_year': 'ndc_target_year'})
    base = base.merge(ndc_merge, on='country', how='left')
    
    # Merge CAT detailed data (static per country)
    cat_static_cols = [c for c in cat.columns if c not in ['cat_url']]
    cat_merge = cat[cat_static_cols].copy()
    
    # Rename CAT columns to avoid conflicts
    cat_rename = {}
    for c in cat_merge.columns:
        if c != 'country':
            cat_rename[c] = f'cat_{c}'
    cat_merge = cat_merge.rename(columns=cat_rename)
    
    base = base.merge(cat_merge, on='country', how='left')
    
    # Merge World Bank data (per country per year)
    if not wb.empty:
        # Normalize WB country names
        wb_country_map = {
            'United States': 'United States', 'Russia': 'Russia',
            'South Korea': 'South Korea', 'United Kingdom': 'United Kingdom',
            'Czech Republic': 'Czech Republic', 'Congo, Dem. Rep.': 'DR Congo',
            'Congo, Rep.': 'Republic of the Congo', 'Egypt, Arab Rep.': 'Egypt',
            'Iran, Islamic Rep.': 'Iran', 'Korea, Rep.': 'South Korea',
            'Lao PDR': 'Laos', 'Syrian Arab Republic': 'Syria',
            'Turkiye': 'Turkey', 'Venezuela, RB': 'Venezuela',
            'Yemen, Rep.': 'Yemen', 'Gambia, The': 'Gambia',
            'Cabo Verde': 'Cape Verde', "Cote d'Ivoire": "Cote d'Ivoire",
            'Slovak Republic': 'Slovakia', 'Macedonia, FYR': 'North Macedonia',
            'Kyrgyz Republic': 'Kyrgyzstan', 'Hong Kong SAR, China': 'Hong Kong',
            'Macao SAR, China': 'Macau',
        }
        wb['country'] = wb['country'].map(wb_country_map).fillna(wb['country'])
        base = base.merge(wb[['country', 'year', 'population', 'gdp_usd']], 
                         on=['country', 'year'], how='left')
    
    # Compute derived metrics
    print("Computing derived metrics...")
    
    # Per-capita emissions (tCO2 per person)
    base['co2_per_capita_t'] = np.where(
        base['population'].notna() & (base['population'] > 0),
        (base['fossil_co2_mtCO2'] * 1e6) / base['population'],
        np.nan
    ).round(2)
    
    # Emissions intensity (kg CO2 per USD GDP)
    base['co2_intensity_kg_per_usd'] = np.where(
        base['gdp_usd'].notna() & (base['gdp_usd'] > 0),
        (base['fossil_co2_mtCO2'] * 1e9) / base['gdp_usd'],
        np.nan
    ).round(4)
    
    # Emissions change from 2015 baseline
    baseline_2015 = base[base['year'] == 2015][['country', 'fossil_co2_mtCO2']].rename(
        columns={'fossil_co2_mtCO2': 'baseline_2015_co2'}
    )
    base = base.merge(baseline_2015, on='country', how='left')
    base['emissions_change_from_2015_pct'] = np.where(
        base['baseline_2015_co2'].notna() & (base['baseline_2015_co2'] > 0),
        ((base['fossil_co2_mtCO2'] - base['baseline_2015_co2']) / base['baseline_2015_co2'] * 100).round(2),
        np.nan
    )
    
    # Year-over-year change
    base = base.sort_values(['country', 'year'])
    base['yoy_change_pct'] = base.groupby('country')['fossil_co2_mtCO2'].pct_change() * 100
    base['yoy_change_pct'] = base['yoy_change_pct'].round(2)
    
    # Cumulative emissions (running total per country from 2015)
    base['cumulative_co2_mtCO2'] = base.groupby('country')['fossil_co2_mtCO2'].cumsum().round(2)
    
    # CAT rating score (numeric)
    rating_scores = {
        '1.5°C Paris Agreement Compatible': 5,
        'Almost sufficient': 4,
        'Insufficient': 3,
        'Highly insufficient': 2,
        'Critically insufficient': 1,
    }
    base['cat_rating_score'] = base.get('cat_overall_rating', pd.Series(dtype=str)).map(rating_scores).fillna(0).astype(int)
    
    # Globe color
    color_map = {
        '1.5°C Paris Agreement Compatible': '#27ae60',
        'Almost sufficient': '#2ecc71',
        'Insufficient': '#f39c12',
        'Highly insufficient': '#e74c3c',
        'Critically insufficient': '#c0392b',
    }
    base['globe_color'] = base.get('cat_overall_rating', pd.Series(dtype=str)).map(color_map).fillna('#95a5a6')
    
    # Gap analysis (for countries with NDC target year)
    base['years_to_target'] = np.where(
        base['ndc_target_year'].notna(),
        base['ndc_target_year'] - base['year'],
        np.nan
    )
    
    # Required annual reduction rate to hit target (simplified)
    # Assumes linear reduction from 2015 baseline to target year
    base['required_annual_reduction_pct'] = np.where(
        (base['ndc_target_year'].notna()) & (base['ndc_target_year'] > 2015) & (base['year'] == 2015),
        (base['emissions_change_from_2015_pct'] / (base['ndc_target_year'] - 2015)).round(2),
        np.nan
    )
    # Forward-fill the required rate
    base['required_annual_reduction_pct'] = base.groupby('country')['required_annual_reduction_pct'].ffill()
    
    # Gap: required vs actual annual change
    base['gap_pct'] = np.where(
        base['required_annual_reduction_pct'].notna(),
        (base['required_annual_reduction_pct'] - base['yoy_change_pct']).round(2),
        np.nan
    )
    
    # On track flag (as string for Parquet compatibility)
    base['on_track'] = np.where(
        base['gap_pct'].notna(),
        np.where(base['gap_pct'] <= 0, 'true', 'false'),
        ''
    )
    
    # Data quality flags
    base['has_cat_rating'] = base['cat_rating_score'] > 0
    base['has_ndc_target'] = base['ndc_target_year'].notna()
    base['has_per_capita'] = base['co2_per_capita_t'].notna()
    
    # Sort and clean
    base = base.sort_values(['country', 'year']).reset_index(drop=True)
    
    # Fill NaN for consistent types (HF Parquet requirement)
    string_cols = base.select_dtypes(include=['object']).columns
    for col in string_cols:
        base[col] = base[col].fillna('')
    
    # Save
    os.makedirs(OUT_DIR, exist_ok=True)
    
    # Parquet
    parquet_path = os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.parquet')
    base.to_parquet(parquet_path, index=False)
    
    # CSV
    csv_path = os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.csv')
    base.to_csv(csv_path, index=False)
    
    # Summary
    summary = {
        'total_countries': int(base['country'].nunique()),
        'total_records': len(base),
        'year_range': [int(base['year'].min()), int(base['year'].max())],
        'cat_coverage': int(base[base['has_cat_rating']]['country'].nunique()),
        'ndc_coverage': int(base[base['has_ndc_target']]['country'].nunique()),
        'per_capita_coverage': int(base[base['has_per_capita']]['country'].nunique()),
        'columns': list(base.columns),
        'column_count': len(base.columns),
        'parquet_size_kb': round(os.path.getsize(parquet_path) / 1024, 1),
        'csv_size_kb': round(os.path.getsize(csv_path) / 1024, 1),
    }
    
    with open(os.path.join(OUT_DIR, 'summary_enriched.json'), 'w') as f:
        json.dump(summary, f, indent=2, default=str)
    
    print(f"\n=== Enriched Dataset Complete ===")
    print(f"Records: {len(base)}")
    print(f"Countries: {summary['total_countries']}")
    print(f"Columns: {summary['column_count']}")
    print(f"CAT coverage: {summary['cat_coverage']} countries")
    print(f"NDC target coverage: {summary['ndc_coverage']} countries")
    print(f"Per-capita coverage: {summary['per_capita_coverage']} countries")
    print(f"Parquet: {summary['parquet_size_kb']} KB")
    print(f"CSV: {summary['csv_size_kb']} KB")
    
    print(f"\n=== Top 10 Emitters 2024 ===")
    top = base[base['year'] == 2024].nlargest(10, 'fossil_co2_mtCO2')
    display_cols = ['country', 'fossil_co2_mtCO2', 'co2_per_capita_t', 'cat_overall_rating', 'ndc_target_year', 'emissions_change_from_2015_pct']
    display_cols = [c for c in display_cols if c in top.columns]
    print(top[display_cols].to_string(index=False))
    
    print(f"\n=== CAT Rating Distribution ===")
    if 'cat_overall_rating' in base.columns:
        print(base[base['has_cat_rating']]['cat_overall_rating'].value_counts().to_string())
    
    return base

if __name__ == '__main__':
    build_enriched_dataset()
