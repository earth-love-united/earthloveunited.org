#!/usr/bin/env python3
"""
Merge CAT emissions API data into the enriched dataset.
This adds NDC targets, current policy projections, fair share boundaries,
and modelled domestic pathways for 40 countries.
"""
import pandas as pd
import numpy as np
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
OUT_DIR = os.path.join(DATA_DIR, 'output')

# ISO3 to country name mapping (CAT uses ISO3 codes)
# Maps to the country names used in our dataset
ISO3_TO_NAME = {
    'AFG': 'Afghanistan', 'ALB': 'Albania', 'DZA': 'Algeria', 'ARG': 'Argentina',
    'ARM': 'Armenia', 'AUS': 'Australia', 'AUT': 'Austria', 'AZE': 'Azerbaijan',
    'BGD': 'Bangladesh', 'BLR': 'Belarus', 'BEL': 'Belgium', 'BEN': 'Benin',
    'BOL': 'Bolivia', 'BRA': 'Brazil', 'BGR': 'Bulgaria', 'BFA': 'Burkina Faso',
    'KHM': 'Cambodia', 'CMR': 'Cameroon', 'CAN': 'Canada', 'CAF': 'Central African Republic',
    'TCD': 'Chad', 'CHL': 'Chile', 'CHN': 'China', 'COL': 'Colombia', 'COD': 'DR Congo',
    'COG': 'Republic of the Congo', 'CRI': 'Costa Rica', 'CIV': "Cote d'Ivoire",
    'HRV': 'Croatia', 'CUB': 'Cuba', 'CYP': 'Cyprus', 'CZE': 'Czech Republic',
    'DNK': 'Denmark', 'DOM': 'Dominican Republic', 'ECU': 'Ecuador', 'EGY': 'Egypt',
    'SLV': 'El Salvador', 'ERI': 'Eritrea', 'EST': 'Estonia', 'SWZ': 'Eswatini',
    'ETH': 'Ethiopia', 'FIN': 'Finland', 'FRA': 'France', 'GAB': 'Gabon',
    'GEO': 'Georgia', 'DEU': 'Germany', 'GHA': 'Ghana', 'GRC': 'Greece',
    'GTM': 'Guatemala', 'HTI': 'Haiti', 'HND': 'Honduras', 'HUN': 'Hungary',
    'ISL': 'Iceland', 'IND': 'India', 'IDN': 'Indonesia', 'IRN': 'Iran',
    'IRQ': 'Iraq', 'IRL': 'Ireland', 'ISR': 'Israel', 'ITA': 'Italy',
    'JAM': 'Jamaica', 'JPN': 'Japan', 'JOR': 'Jordan', 'KAZ': 'Kazakhstan',
    'KEN': 'Kenya', 'PRK': 'North Korea', 'KOR': 'South Korea', 'KWT': 'Kuwait',
    'KGZ': 'Kyrgyzstan', 'LAO': 'Laos', 'LVA': 'Latvia', 'LBN': 'Lebanon',
    'LBY': 'Libya', 'LIE': 'Liechtenstein', 'LTU': 'Lithuania', 'LUX': 'Luxembourg',
    'MDG': 'Madagascar', 'MWI': 'Malawi', 'MYS': 'Malaysia', 'MDV': 'Maldives',
    'MLI': 'Mali', 'MLT': 'Malta', 'MRT': 'Mauritania', 'MUS': 'Mauritius',
    'MEX': 'Mexico', 'MDA': 'Moldova', 'MNG': 'Mongolia', 'MNE': 'Montenegro',
    'MAR': 'Morocco', 'MOZ': 'Mozambique', 'MMR': 'Myanmar', 'NAM': 'Namibia',
    'NPL': 'Nepal', 'NLD': 'Netherlands', 'NZL': 'New Zealand', 'NIC': 'Nicaragua',
    'NER': 'Niger', 'NGA': 'Nigeria', 'NOR': 'Norway', 'OMN': 'Oman',
    'PAK': 'Pakistan', 'PAN': 'Panama', 'PNG': 'Papua New Guinea', 'PRY': 'Paraguay',
    'PER': 'Peru', 'PHL': 'Philippines', 'POL': 'Poland', 'PRT': 'Portugal',
    'QAT': 'Qatar', 'ROU': 'Romania', 'RUS': 'Russia', 'RWA': 'Rwanda',
    'SAU': 'Saudi Arabia', 'SEN': 'Senegal', 'SRB': 'Serbia', 'SLE': 'Sierra Leone',
    'SGP': 'Singapore', 'SVK': 'Slovakia', 'SVN': 'Slovenia', 'ZAF': 'South Africa',
    'ESP': 'Spain', 'LKA': 'Sri Lanka', 'SDN': 'Sudan', 'SUR': 'Suriname',
    'SWE': 'Sweden', 'CHE': 'Switzerland', 'SYR': 'Syria', 'TWN': 'Taiwan',
    'TJK': 'Tajikistan', 'TZA': 'Tanzania', 'THA': 'Thailand', 'TGO': 'Togo',
    'TTO': 'Trinidad and Tobago', 'TUN': 'Tunisia', 'TUR': 'Turkey', 'TKM': 'Turkmenistan',
    'UGA': 'Uganda', 'UKR': 'Ukraine', 'ARE': 'United Arab Emirates', 'GBR': 'United Kingdom',
    'USA': 'USA', 'URY': 'Uruguay', 'UZB': 'Uzbekistan', 'VEN': 'Venezuela',
    'VNM': 'Vietnam', 'YEM': 'Yemen', 'ZMB': 'Zambia', 'ZWE': 'Zimbabwe',
    'EUU': 'European Union', 'GMB': 'Gambia',
}

def load_cat_emissions():
    """Load processed CAT emissions data"""
    print("Loading CAT emissions data...")
    with open(os.path.join(RAW_DIR, 'cat_emissions_full_processed.json')) as f:
        data = json.load(f)
    print(f"  {len(data)} countries")
    return data

def merge():
    # Load existing dataset
    print("Loading existing dataset...")
    df = pd.read_parquet(os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.parquet'))
    print(f"  {len(df)} records")
    
    # Load CAT emissions data
    cat_data = load_cat_emissions()
    
    # For each country, extract key values and merge
    print("\nMerging CAT emissions data...")
    
    # Create new columns
    new_cols = {
        'cat_ndc_target_2030_mtco2e': [],
        'cat_ndc_target_2050_mtco2e': [],
        'cat_current_policy_2030_mtco2e': [],
        'cat_fair_share_15c_2030_mtco2e': [],
        'cat_fair_share_insufficient_2030_mtco2e': [],
        'cat_historical_2019_mtco2e': [],
        'cat_historical_2020_mtco2e': [],
        'cat_historical_2021_mtco2e': [],
    }
    
    # Build lookup by country name
    cat_by_name = {}
    for iso, cd in cat_data.items():
        name = ISO3_TO_NAME.get(iso, iso)
        cat_by_name[name] = cd
    
    # For each row in our dataset, look up CAT data
    for _, row in df.iterrows():
        country = row['country']
        cd = cat_by_name.get(country, {})
        
        # NDC target 2030
        ndc_2030 = cd.get('ndc_conditional_max', {}).get('2030', 
                    cd.get('ndc_conditional_min', {}).get('2030', 0))
        new_cols['cat_ndc_target_2030_mtco2e'].append(ndc_2030 if ndc_2030 else 0)
        
        # NDC target 2050
        ndc_2050 = cd.get('ndc_conditional_max', {}).get('2050',
                    cd.get('ndc_conditional_min', {}).get('2050', 0))
        new_cols['cat_ndc_target_2050_mtco2e'].append(ndc_2050 if ndc_2050 else 0)
        
        # Current policy 2030
        cp_2030 = cd.get('current_policy_max', {}).get('2030',
                   cd.get('current_policy_min', {}).get('2030', 0))
        new_cols['cat_current_policy_2030_mtco2e'].append(cp_2030 if cp_2030 else 0)
        
        # Fair share 15C 2030
        fs_15c = cd.get('fair_share_15c', {}).get('2030', 0)
        new_cols['cat_fair_share_15c_2030_mtco2e'].append(fs_15c if fs_15c else 0)
        
        # Fair share insufficient 2030
        fs_ins = cd.get('fair_share_insufficient', {}).get('2030', 0)
        new_cols['cat_fair_share_insufficient_2030_mtco2e'].append(fs_ins if fs_ins else 0)
        
        # Historical
        hist_2019 = cd.get('historical', {}).get('2019', 0)
        hist_2020 = cd.get('historical', {}).get('2020', 0)
        hist_2021 = cd.get('historical', {}).get('2021', 0)
        new_cols['cat_historical_2019_mtco2e'].append(hist_2019 if hist_2019 else 0)
        new_cols['cat_historical_2020_mtco2e'].append(hist_2020 if hist_2020 else 0)
        new_cols['cat_historical_2021_mtco2e'].append(hist_2021 if hist_2021 else 0)
    
    # Add new columns
    for col, values in new_cols.items():
        df[col] = values
    
    # Compute gap metrics using CAT NDC targets
    print("Computing gap metrics...")
    
    # NDC reduction from historical baseline
    df['cat_ndc_reduction_from_historical_pct'] = np.where(
        (df['cat_historical_2020_mtco2e'] > 0) & (df['cat_ndc_target_2030_mtco2e'] > 0),
        ((df['cat_ndc_target_2030_mtco2e'] - df['cat_historical_2020_mtco2e']) / df['cat_historical_2020_mtco2e'] * 100).round(1),
        0
    )
    
    # Current policy vs NDC gap
    df['cat_policy_vs_ndc_gap_mtco2e'] = np.where(
        (df['cat_current_policy_2030_mtco2e'] > 0) & (df['cat_ndc_target_2030_mtco2e'] > 0),
        (df['cat_current_policy_2030_mtco2e'] - df['cat_ndc_target_2030_mtco2e']).round(1),
        0
    )
    
    # Fair share gap (how far current policy is from 1.5°C fair share)
    df['cat_fair_share_gap_mtco2e'] = np.where(
        (df['cat_current_policy_2030_mtco2e'] > 0) & (df['cat_fair_share_15c_2030_mtco2e'] > 0),
        (df['cat_current_policy_2030_mtco2e'] - df['cat_fair_share_15c_2030_mtco2e']).round(1),
        0
    )
    
    # Required annual reduction (from 2020 to 2030)
    df['cat_required_annual_reduction_mtco2e'] = np.where(
        (df['cat_ndc_target_2030_mtco2e'] > 0) & (df['cat_historical_2020_mtco2e'] > 0),
        ((df['cat_historical_2020_mtco2e'] - df['cat_ndc_target_2030_mtco2e']) / 10).round(1),
        0
    )
    
    # Save
    parquet_path = os.path.join(OUT_DIR, 'pledge_vs_reality_v2.parquet')
    csv_path = os.path.join(OUT_DIR, 'pledge_vs_reality_v2.csv')
    
    df.to_parquet(parquet_path, index=False)
    df.to_csv(csv_path, index=False)
    
    print(f"\n=== v2 Dataset Complete ===")
    print(f"Records: {len(df)}")
    print(f"Columns: {len(df.columns)}")
    print(f"Parquet: {round(os.path.getsize(parquet_path)/1024, 1)} KB")
    
    # Coverage
    has_ndc = (df['cat_ndc_target_2030_mtco2e'] > 0).sum()
    has_policy = (df['cat_current_policy_2030_mtco2e'] > 0).sum()
    has_fair = (df['cat_fair_share_15c_2030_mtco2e'] > 0).sum()
    print(f"\nNDC target 2030 coverage: {has_ndc}/{len(df)} ({has_ndc/len(df)*100:.1f}%)")
    print(f"Current policy coverage: {has_policy}/{len(df)} ({has_policy/len(df)*100:.1f}%)")
    print(f"Fair share coverage: {has_fair}/{len(df)} ({has_fair/len(df)*100:.1f}%)")
    
    # Sample
    print(f"\n=== Top 10 Emitters 2024 (with CAT data) ===")
    top = df[df['year'] == 2024].nlargest(10, 'fossil_co2_mtCO2')
    display = ['country', 'fossil_co2_mtCO2', 'cat_ndc_target_2030_mtco2e', 
               'cat_current_policy_2030_mtco2e', 'cat_policy_vs_ndc_gap_mtco2e',
               'cat_fair_share_gap_mtco2e', 'cat_overall_rating']
    display = [c for c in display if c in top.columns]
    print(top[display].to_string(index=False))
    
    return df

if __name__ == '__main__':
    merge()
