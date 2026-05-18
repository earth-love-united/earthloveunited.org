import pandas as pd
import numpy as np
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PLEDGE_DIR, 'data')
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROC_DIR = os.path.join(DATA_DIR, 'processed')

# Reuse the same mapping from process_gcb.py
import sys
sys.path.append(SCRIPT_DIR)
from process_gcb import GCB_COUNTRY_MAP

def process():
    print("Loading GCB LULUCF Emissions (BLUE model)...")
    df = pd.read_excel(
        os.path.join(RAW_DIR, 'gcb_land_use_change_v2025.xlsx'),
        sheet_name='BLUE',
        header=None
    )
    
    header_row = 7
    data_start_row = 8
    
    years = df.iloc[data_start_row:, 0].values
    country_names = df.iloc[header_row, 1:].values
    
    records = []
    for col_idx in range(1, len(country_names) + 1):
        gcb_name = country_names[col_idx - 1]
        if pd.isna(gcb_name):
            continue
            
        gcb_name = str(gcb_name).strip()
        country = GCB_COUNTRY_MAP.get(gcb_name, gcb_name)
        
        # Skip regions
        if any(skip in gcb_name for skip in ['KP Annex', 'Non KP', 'OECD', 'Non-OECD', 'EU27',
                                             'Africa', 'Asia', 'Central America', 'Europe',
                                             'Middle East', 'North America', 'Oceania', 'South America',
                                             'International', 'Statistical', 'World']):
            continue
            
        emissions = df.iloc[data_start_row:, col_idx].values
        
        for i, year in enumerate(years):
            if pd.isna(year) or pd.isna(emissions[i]):
                continue
            year = int(year)
            # Match the years we track
            if year < 2015 and year not in [1990, 2000, 2005]:
                continue
            if year > 2024:
                continue
                
            val = float(emissions[i])
            
            records.append({
                'country': country,
                'year': year,
                'lulucf_co2_mtCO2': round(val * 3.664, 3) # Convert MtC to MtCO2
            })
            
    result = pd.DataFrame(records)
    result = result.sort_values(['country', 'year']).reset_index(drop=True)
    
    os.makedirs(PROC_DIR, exist_ok=True)
    result.to_csv(os.path.join(PROC_DIR, 'gcb_lulucf.csv'), index=False)
    
    print(f"Processed {len(result)} LULUCF records")
    return result

if __name__ == '__main__':
    process()
