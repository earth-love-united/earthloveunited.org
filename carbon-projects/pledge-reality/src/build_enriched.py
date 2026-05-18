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
    try:
        df = pd.read_csv(os.path.join(PROC_DIR, 'cw_ndc_parsed.csv'))
        print(f"  Climate Watch: {len(df)} countries")
        return df
    except Exception as e:
        print(f"  WARNING: Failed to load Climate Watch data: {e}")
        return pd.DataFrame()

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

def load_ndgain():
    """Load processed ND-GAIN index data"""
    print("Loading ND-GAIN data...")
    path = os.path.join(PROC_DIR, 'ndgain_index.csv')
    if os.path.exists(path):
        df = pd.read_csv(path)
        print(f"  ND-GAIN: {len(df)} records")
        return df
    return pd.DataFrame()

def load_lulucf():
    """Load processed LULUCF data"""
    print("Loading LULUCF data...")
    path = os.path.join(PROC_DIR, 'gcb_lulucf.csv')
    if os.path.exists(path):
        df = pd.read_csv(path)
        print(f"  LULUCF: {len(df)} records")
        return df
    return pd.DataFrame()

def build_enriched_dataset():
    """Merge all sources into the enriched dataset"""
    
    gcb = load_gcb_emissions()
    cat = load_cat_detailed()
    ndc = load_ndc_registry()
    cw = load_climate_watch_ndc()
    wb = load_world_bank()
    ndgain = load_ndgain()
    lulucf = load_lulucf()
    
    # Start with GCB as base
    print("\nBuilding enriched dataset...")
    base = gcb[['country', 'year', 'fossil_co2_mtC', 'fossil_co2_mtCO2']].copy()
    
    # Merge LULUCF data
    if not lulucf.empty:
        base = base.merge(lulucf, on=['country', 'year'], how='left')
        
        # Calculate Total CO2 (Fossil + LULUCF)
        # Some countries have negative LULUCF (sinks)
        base['total_co2_mtCO2'] = base['fossil_co2_mtCO2'].fillna(0) + base['lulucf_co2_mtCO2'].fillna(0)
    
    # Add robust iso_code mapping
    iso_map = pd.read_csv(os.path.join(PROC_DIR, 'country_iso_map.csv'))
    base = base.merge(iso_map, on='country', how='left')
    
    # Merge World Bank data (using iso_code)
    if not wb.empty and 'iso_code' in base.columns:
        wb_merge = wb[['iso_code', 'year', 'population', 'gdp_usd']].copy()
        # Drop duplicates just in case
        wb_merge = wb_merge.drop_duplicates(subset=['iso_code', 'year'])
        base = base.merge(wb_merge, on=['iso_code', 'year'], how='left')

    # Merge NDC data
    ndc_cols = ['country', 'target_year', 'ndc_version', 'submission_date', 'language']
    ndc_merge = ndc[[c for c in ndc_cols if c in ndc.columns]].copy()
    ndc_merge = ndc_merge.rename(columns={'target_year': 'ndc_target_year'})
    base = base.merge(ndc_merge, on='country', how='left')

    # Merge Climate Watch data
    if not cw.empty and 'iso_code' in base.columns:
        cw_merge = cw.drop(columns=['country_cw'], errors='ignore')
        base = base.merge(cw_merge, on='iso_code', how='left')
        
    # Merge ND-GAIN
    if not ndgain.empty and 'iso_code' in base.columns:
        ndgain_merge = ndgain.drop(columns=['country_ndgain'], errors='ignore')
        base = base.merge(ndgain_merge, on=['iso_code', 'year'], how='left')
    
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

    # Consolidate target year
    if 'cw_target_year' in base.columns:
        base['ndc_target_year'] = base['ndc_target_year'].fillna(base['cw_target_year'])
    
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
    
    # ---------------------------------------------------------
    # PHASE 1 & 2: Reality Gap Vector & Momentum Slope
    # ---------------------------------------------------------
    # Extract baseline emissions for cw_baseline_year
    base['cw_baseline_year_flt'] = pd.to_numeric(base.get('cw_baseline_year', pd.Series(dtype=str)), errors='coerce')
    
    # Create lookup map for base emissions
    base_emissions_map = base.dropna(subset=['fossil_co2_mtCO2']).set_index(['country', 'year'])['fossil_co2_mtCO2'].to_dict()
    
    def get_base_emission(row):
        if pd.notna(row['cw_baseline_year_flt']):
            return base_emissions_map.get((row['country'], int(row['cw_baseline_year_flt'])), np.nan)
        return np.nan

    base['baseline_emissions_mtco2e'] = base.apply(get_base_emission, axis=1)
    
    # Calculate implied target (MtCO2e)
    base['implied_target_mtco2e'] = np.nan
    
    # 1. Base year targets
    mask_base = (base.get('cw_target_type') == 'base_year') & base['baseline_emissions_mtco2e'].notna() & base.get('cw_reduction_pct').notna()
    base.loc[mask_base, 'implied_target_mtco2e'] = base.loc[mask_base, 'baseline_emissions_mtco2e'] * (1 - base.loc[mask_base, 'cw_reduction_pct'] / 100.0)
    
    # 2. Fixed level absolute targets
    if 'cw_target_mtco2e' in base.columns:
        mask_absolute = base['cw_target_mtco2e'].notna()
        base.loc[mask_absolute, 'implied_target_mtco2e'] = base.loc[mask_absolute, 'cw_target_mtco2e']
    
    # The Reality Gap: Current year emissions - Implied target
    # > 0 means overshooting the pledge (Deficit)
    base['reality_gap_mtco2e'] = np.where(
        base['implied_target_mtco2e'].notna(),
        base['fossil_co2_mtCO2'] - base['implied_target_mtco2e'],
        np.nan
    )
    
    # Calculate 10-Year Momentum Slope (CAGR 2015-2024)
    cagr_2015 = base[base['year'] == 2015].set_index('country')['fossil_co2_mtCO2']
    cagr_2024 = base[base['year'] == 2024].set_index('country')['fossil_co2_mtCO2']
    momentum_cagr = ((cagr_2024 / cagr_2015.replace(0, np.nan)).pow(1/9.0) - 1) * 100
    base['momentum_cagr_10yr_pct'] = base['country'].map(momentum_cagr).round(2)
    
    # Target slope: required annual change to hit target from current year
    base['years_to_target'] = np.where(
        base['ndc_target_year'].notna(),
        base['ndc_target_year'] - base['year'],
        np.nan
    )
    
    base['target_cagr_required_pct'] = np.where(
        (base['implied_target_mtco2e'].notna()) & (base['years_to_target'] > 0) & (base['fossil_co2_mtCO2'] > 0),
        ((base['implied_target_mtco2e'] / base['fossil_co2_mtCO2']).pow(1/base['years_to_target']) - 1) * 100,
        np.nan
    ).round(2)
    
    # Momentum vs Target slope divergence
    # > 0 means emissions are growing faster than target allows
    base['momentum_vs_target_divergence_pct'] = np.where(
        base['target_cagr_required_pct'].notna() & base['momentum_cagr_10yr_pct'].notna(),
        (base['momentum_cagr_10yr_pct'] - base['target_cagr_required_pct']).round(2),
        np.nan
    )
    
    base['on_track'] = np.where(
        base['momentum_vs_target_divergence_pct'].notna(),
        np.where(base['momentum_vs_target_divergence_pct'] <= 0, 'true', 'false'),
        ''
    )
    
    # Data quality flags
    base['has_cat_rating'] = base['cat_rating_score'] > 0
    base['has_ndc_target'] = base['ndc_target_year'].notna()
    base['has_per_capita'] = base['co2_per_capita_t'].notna()
    
    # Sort and clean
    base = base.sort_values(['country', 'year']).reset_index(drop=True)
    
    # Cast bool columns to nullable boolean to prevent parquet conversion errors
    bool_cols = [c for c in base.columns if base[c].dtype == bool or c.startswith('cw_has_') or c.startswith('cw_is_') or c.startswith('has_')]
    for col in bool_cols:
        if col in base.columns:
            base[col] = base[col].astype('boolean')
            
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
