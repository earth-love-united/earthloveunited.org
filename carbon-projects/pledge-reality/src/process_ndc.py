#!/usr/bin/env python3
"""
Process UNFCCC NDC Registry data:
- Extract latest NDC per country
- Parse target year and reduction % from titles
- Normalize country names
"""
import pandas as pd
import re
import json
import sys
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROC_DIR = os.path.join(DATA_DIR, 'processed')

def load_ndc():
    df = pd.read_csv(os.path.join(RAW_DIR, 'ndc_registry.csv'))
    return df

def parse_target_year(title):
    """Extract target year from NDC title like 'India NDC (2031 - 2035)'"""
    m = re.search(r'\(?(\d{4})\s*[-–]\s*(\d{4})\)?', title)
    if m:
        return int(m.group(2))  # end year
    m = re.search(r'(\d{4})', title)
    if m:
        return int(m.group(1))
    return None

def parse_reduction_pct(title):
    """Try to extract reduction percentage from title"""
    m = re.search(r'(\d+(?:\.\d+)?)\s*%', title)
    if m:
        return float(m.group(1))
    return None

def normalize_country(name):
    """Normalize country names to standard forms"""
    name = name.strip()
    # Remove asterisks
    name = name.replace(' (*)', '').strip()
    
    # Common normalizations
    mapping = {
        'United States of America': 'United States',
        'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
        'Republic of Korea': 'South Korea',
        "Democratic People's Republic of Korea": 'North Korea',
        'Republic of Moldova': 'Moldova',
        'Lao People\'s Democratic Republic': 'Laos',
        'Viet Nam': 'Vietnam',
        'Cabo Verde': 'Cape Verde',
        'Côte d\'Ivoire': 'Ivory Coast',
        'Türkiye': 'Turkey',
        'Czechia': 'Czech Republic',
        'North Macedonia': 'Macedonia',
        'Eswatini': 'Swaziland',
        'United Republic of Tanzania': 'Tanzania',
        'Democratic Republic of the Congo': 'DR Congo',
        'Congo': 'Republic of the Congo',
        'Micronesia (Federated States of)': 'Micronesia',
        'Bolivia (Plurinational State of)': 'Bolivia',
        'Venezuela (Bolivarian Republic of)': 'Venezuela',
        'Iran (Islamic Republic of)': 'Iran',
        'Syrian Arab Republic': 'Syria',
        'Russian Federation': 'Russia',
        'Brunei Darussalam': 'Brunei',
        'Holy See': 'Vatican',
        'State of Palestine': 'Palestine',
        'European Union (EU)': 'European Union',
    }
    return mapping.get(name, name)

def process():
    df = load_ndc()
    
    # Normalize country names
    df['country'] = df['party'].apply(normalize_country)
    
    # Parse submission date
    df['submission_date_parsed'] = pd.to_datetime(df['submission_date'], format='%d/%m/%Y', errors='coerce')
    
    # Parse target year from title
    df['target_year'] = df['title'].apply(parse_target_year)
    df['reduction_pct'] = df['title'].apply(parse_reduction_pct)
    
    # Extract NDC version number
    df['ndc_version'] = df['title'].apply(lambda t: (
        float(m.group(1)) if (m := re.search(r'NDC\s*(\d+(?:\.\d+)?)', t)) else None
    ))
    
    # Sort by submission date descending, take latest per country
    df = df.sort_values('submission_date_parsed', ascending=False)
    latest = df.drop_duplicates(subset='country', keep='first').copy()
    
    # Select relevant columns
    result = latest[[
        'country', 'title', 'target_year', 'reduction_pct', 
        'ndc_version', 'submission_date', 'language', 'version'
    ]].copy()
    
    result = result.sort_values('country').reset_index(drop=True)
    
    # Save
    os.makedirs(PROC_DIR, exist_ok=True)
    result.to_csv(os.path.join(PROC_DIR, 'ndc_latest.csv'), index=False)
    
    print(f"Processed {len(df)} NDC entries → {len(result)} unique countries")
    print(f"Countries with target year: {result['target_year'].notna().sum()}")
    print(f"Countries with reduction %: {result['reduction_pct'].notna().sum()}")
    print(f"\nSample:")
    print(result[['country', 'target_year', 'reduction_pct', 'ndc_version']].head(20).to_string(index=False))
    
    return result

if __name__ == '__main__':
    process()
