#!/usr/bin/env python3
"""
Fix World Bank data integration and rebuild.
"""
import pandas as pd
import numpy as np
import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROC_DIR = os.path.join(DATA_DIR, 'processed')
OUT_DIR = os.path.join(DATA_DIR, 'output')

# Comprehensive WB country name -> standard name mapping
WB_COUNTRY_MAP = {
    'Bahamas, The': 'Bahamas', 'Brunei Darussalam': 'Brunei',
    'Cabo Verde': 'Cape Verde', 'Congo, Dem. Rep.': 'DR Congo',
    'Congo, Rep.': 'Republic of the Congo', 'Czech Republic': 'Czech Republic',
    "Cote d'Ivoire": "Cote d'Ivoire", 'Egypt, Arab Rep.': 'Egypt',
    'Gambia, The': 'Gambia', 'Hong Kong SAR, China': 'Hong Kong',
    'Iran, Islamic Rep.': 'Iran', 'Korea, Dem. People\'s Rep.': 'North Korea',
    'Korea, Rep.': 'South Korea', 'Kyrgyz Republic': 'Kyrgyzstan',
    'Lao PDR': 'Laos', 'Macao SAR, China': 'Macau',
    'Macedonia, FYR': 'North Macedonia', 'Moldova': 'Moldova',
    'Myanmar': 'Myanmar', 'Russian Federation': 'Russia',
    'Slovak Republic': 'Slovakia', 'St. Kitts and Nevis': 'Saint Kitts and Nevis',
    'St. Lucia': 'Saint Lucia', 'St. Martin (French part)': 'Saint Martin',
    'St. Vincent and the Grenadines': 'Saint Vincent and the Grenadines',
    'Syrian Arab Republic': 'Syria', 'Tanzania': 'Tanzania',
    'Timor-Leste': 'Timor-Leste', 'Turkiye': 'Turkey',
    'United Kingdom': 'United Kingdom', 'United States': 'United States',
    'Venezuela, RB': 'Venezuela', 'Vietnam': 'Vietnam',
    'Yemen, Rep.': 'Yemen', 'West Bank and Gaza': 'Palestine',
    'Kosovo': 'Kosovo', 'Channel Islands': 'Channel Islands',
    'Sao Tome and Principe': 'Sao Tome and Principe',
    'Micronesia, Fed. Sts.': 'Micronesia', 'Marshall Islands': 'Marshall Islands',
    'Solomon Islands': 'Solomon Islands', 'Tuvalu': 'Tuvalu',
    'Vanuatu': 'Vanuatu', 'Tonga': 'Tonga', 'Samoa': 'Samoa',
    'Kiribati': 'Kiribati', 'Palau': 'Palau', 'Nauru': 'Nauru',
    'Eswatini': 'Eswatini', 'Lesotho': 'Lesotho', 'Botswana': 'Botswana',
    'Namibia': 'Namibia', 'Zimbabwe': 'Zimbabwe', 'Zambia': 'Zambia',
    'Malawi': 'Malawi', 'Mozambique': 'Mozambique', 'Madagascar': 'Madagascar',
    'Mauritius': 'Mauritius', 'Seychelles': 'Seychelles', 'Comoros': 'Comoros',
    'Djibouti': 'Djibouti', 'Eritrea': 'Eritrea', 'Ethiopia': 'Ethiopia',
    'Somalia': 'Somalia', 'Sudan': 'Sudan', 'South Sudan': 'South Sudan',
    'Uganda': 'Uganda', 'Rwanda': 'Rwanda', 'Burundi': 'Burundi',
    'Kenya': 'Kenya', 'Tunisia': 'Tunisia', 'Algeria': 'Algeria',
    'Morocco': 'Morocco', 'Libya': 'Libya', 'Nigeria': 'Nigeria',
    'Ghana': 'Ghana', 'Senegal': 'Senegal', 'Mali': 'Mali',
    'Burkina Faso': 'Burkina Faso', 'Niger': 'Niger', 'Chad': 'Chad',
    'Cameroon': 'Cameroon', 'Gabon': 'Gabon', 'Equatorial Guinea': 'Equatorial Guinea',
    'Central African Republic': 'Central African Republic', 'Sierra Leone': 'Sierra Leone',
    'Liberia': 'Liberia', 'Guinea': 'Guinea', 'Guinea-Bissau': 'Guinea-Bissau',
    'Gambia': 'Gambia', 'Mauritania': 'Mauritania', 'Benin': 'Benin',
    'Togo': 'Togo', 'Congo': 'Republic of the Congo', 'Angola': 'Angola',
    'Papua New Guinea': 'Papua New Guinea', 'Fiji': 'Fiji',
    'New Zealand': 'New Zealand', 'Australia': 'Australia',
    'Indonesia': 'Indonesia', 'Malaysia': 'Malaysia', 'Philippines': 'Philippines',
    'Thailand': 'Thailand', 'Singapore': 'Singapore', 'Cambodia': 'Cambodia',
    'Laos': 'Laos', 'Vietnam': 'Vietnam', 'China': 'China',
    'Japan': 'Japan', 'India': 'India', 'Pakistan': 'Pakistan',
    'Bangladesh': 'Bangladesh', 'Sri Lanka': 'Sri Lanka', 'Nepal': 'Nepal',
    'Bhutan': 'Bhutan', 'Mongolia': 'Mongolia', 'Kazakhstan': 'Kazakhstan',
    'Uzbekistan': 'Uzbekistan', 'Turkmenistan': 'Turkmenistan',
    'Afghanistan': 'Afghanistan', 'Tajikistan': 'Tajikistan',
    'Georgia': 'Georgia', 'Armenia': 'Armenia', 'Azerbaijan': 'Azerbaijan',
    'Turkey': 'Turkey', 'Iran': 'Iran', 'Iraq': 'Iraq',
    'Saudi Arabia': 'Saudi Arabia', 'United Arab Emirates': 'United Arab Emirates',
    'Qatar': 'Qatar', 'Kuwait': 'Kuwait', 'Bahrain': 'Bahrain',
    'Oman': 'Oman', 'Yemen': 'Yemen', 'Jordan': 'Jordan',
    'Lebanon': 'Lebanon', 'Israel': 'Israel', 'Syria': 'Syria',
    'Canada': 'Canada', 'United States': 'United States', 'Mexico': 'Mexico',
    'Guatemala': 'Guatemala', 'Belize': 'Belize', 'Honduras': 'Honduras',
    'El Salvador': 'El Salvador', 'Nicaragua': 'Nicaragua', 'Costa Rica': 'Costa Rica',
    'Panama': 'Panama', 'Cuba': 'Cuba', 'Jamaica': 'Jamaica',
    'Haiti': 'Haiti', 'Dominican Republic': 'Dominican Republic',
    'Trinidad and Tobago': 'Trinidad and Tobago', 'Barbados': 'Barbados',
    'Colombia': 'Colombia', 'Venezuela': 'Venezuela', 'Guyana': 'Guyana',
    'Suriname': 'Suriname', 'Ecuador': 'Ecuador', 'Peru': 'Peru',
    'Brazil': 'Brazil', 'Bolivia': 'Bolivia', 'Paraguay': 'Paraguay',
    'Uruguay': 'Uruguay', 'Chile': 'Chile', 'Argentina': 'Argentina',
    'Germany': 'Germany', 'France': 'France', 'United Kingdom': 'United Kingdom',
    'Italy': 'Italy', 'Spain': 'Spain', 'Portugal': 'Portugal',
    'Netherlands': 'Netherlands', 'Belgium': 'Belgium', 'Luxembourg': 'Luxembourg',
    'Switzerland': 'Switzerland', 'Austria': 'Austria', 'Poland': 'Poland',
    'Czech Republic': 'Czech Republic', 'Slovakia': 'Slovakia', 'Hungary': 'Hungary',
    'Romania': 'Romania', 'Bulgaria': 'Bulgaria', 'Greece': 'Greece',
    'Sweden': 'Sweden', 'Norway': 'Norway', 'Denmark': 'Denmark',
    'Finland': 'Finland', 'Iceland': 'Iceland', 'Ireland': 'Ireland',
    'Croatia': 'Croatia', 'Serbia': 'Serbia', 'Bosnia and Herzegovina': 'Bosnia and Herzegovina',
    'North Macedonia': 'North Macedonia', 'Albania': 'Albania',
    'Montenegro': 'Montenegro', 'Slovenia': 'Slovenia',
    'Ukraine': 'Ukraine', 'Belarus': 'Belarus', 'Moldova': 'Moldova',
    'Lithuania': 'Lithuania', 'Latvia': 'Latvia', 'Estonia': 'Estonia',
    'Russia': 'Russia', 'United States': 'USA',
}

def load_wb_full():
    """Load full World Bank data with proper country mapping"""
    print("Loading World Bank data (full)...")
    
    with open(os.path.join(RAW_DIR, 'wb_pop_full.json')) as f:
        data = json.load(f)
    
    records = []
    for r in data[1]:
        val = r.get('value')
        if val is None:
            continue
        country_name = r.get('country', {}).get('value', '')
        # Map to standard name
        std_name = WB_COUNTRY_MAP.get(country_name, country_name)
        records.append({
            'country': std_name,
            'year': int(r.get('date', 0)),
            'population': float(val)
        })
    
    df = pd.DataFrame(records)
    print(f"  WB population: {len(df)} records, {df['country'].nunique()} countries")
    return df

def rebuild():
    """Rebuild the enriched dataset with fixed WB data"""
    print("Loading existing enriched dataset...")
    base = pd.read_parquet(os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.parquet'))
    
    # Remove old WB columns
    for col in ['population', 'gdp_usd', 'co2_per_capita_t', 'co2_intensity_kg_per_usd']:
        if col in base.columns:
            del base[col]
    
    # Load and merge WB population
    wb = load_wb_full()
    base = base.merge(wb, on=['country', 'year'], how='left')
    
    # Recompute per-capita
    base['co2_per_capita_t'] = np.where(
        base['population'].notna() & (base['population'] > 0),
        (base['fossil_co2_mtCO2'] * 1e6) / base['population'],
        np.nan
    ).round(2)
    
    base['has_per_capita'] = base['co2_per_capita_t'].notna()
    
    # Fill NaN for Parquet
    base['population'] = base['population'].fillna(0.0)
    base['co2_per_capita_t'] = base['co2_per_capita_t'].fillna(0.0)
    
    # Save
    parquet_path = os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.parquet')
    csv_path = os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.csv')
    base.to_parquet(parquet_path, index=False)
    base.to_csv(csv_path, index=False)
    
    print(f"\n=== Rebuilt ===")
    print(f"Records: {len(base)}")
    print(f"Population coverage: {base[base['population'] > 0]['country'].nunique()} countries")
    print(f"Per-capita coverage: {base[base['co2_per_capita_t'] > 0]['country'].nunique()} countries")
    print(f"Parquet: {round(os.path.getsize(parquet_path)/1024, 1)} KB")
    
    # Sample
    print(f"\n=== Top 10 Emitters 2024 (with per-capita) ===")
    top = base[base['year'] == 2024].nlargest(10, 'fossil_co2_mtCO2')
    print(top[['country', 'fossil_co2_mtCO2', 'co2_per_capita_t', 'cat_overall_rating']].to_string(index=False))

if __name__ == '__main__':
    rebuild()
