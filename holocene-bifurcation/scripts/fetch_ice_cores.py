#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Phase 1: Fetch Ice Cores (GISP2 Temperature, EPICA Dome C CO2)
Downloads raw txt files from NOAA NCEI, parses the irregular headers, 
and outputs clean CSVs restricted to the Holocene (0 to 12,000 Years BP).
"""
import os
import pandas as pd
import requests

RAW_DIR = "holocene-bifurcation/data/raw"
os.makedirs(RAW_DIR, exist_ok=True)

# 1. GISP2 Temperature Proxy (Alley 2000)
GISP2_URL = "https://www.ncei.noaa.gov/pub/data/paleo/icecore/greenland/summit/gisp2/isotopes/gisp2_temp_accum_alley2000.txt"
GISP2_RAW = os.path.join(RAW_DIR, "gisp2_temp.txt")
GISP2_CSV = os.path.join(RAW_DIR, "gisp2_temp.csv")

# 2. Antarctic Ice Cores CO2 Composite (Bereiter 2015)
EPICA_URL = "https://www.ncei.noaa.gov/pub/data/paleo/icecore/antarctica/antarctica2015co2composite.txt"
EPICA_RAW = os.path.join(RAW_DIR, "antarctica2015co2composite.txt")
EPICA_CSV = os.path.join(RAW_DIR, "edc_co2.csv")

def download_file(url, path):
    if not os.path.exists(path):
        print(f"Downloading {url}...")
        response = requests.get(url)
        response.raise_for_status()
        with open(path, "w") as f:
            f.write(response.text)
        print(f"Saved {path}")

def process_gisp2():
    print("Processing GISP2 Temperature...")
    data = []
    with open(GISP2_RAW, "r") as f:
        for line in f:
            line = line.strip()
            # Skip header and empty lines
            if not line or line.startswith("Age") or line.startswith("-") or line.startswith("GISP") or line.startswith("NOAA") or line.startswith("CONTRIBUTOR") or line.startswith("SUGGESTED") or line.startswith("NAME"):
                continue
            
            parts = line.split()
            if len(parts) >= 2:
                try:
                    # Age is given in thousands of years before present (kyr BP)
                    age_kyr = float(parts[0])
                    temp = float(parts[1])
                    age_years = int(age_kyr * 1000)
                    
                    # Greenland ice core temperatures are never above -10C.
                    # Positive values indicate the parser has hit the "Accumulation" block.
                    if temp > -10:
                        continue
                    
                    if age_years <= 12500: # Slightly over 12k to allow interpolation boundary
                        data.append({"years_bp": age_years, "gisp2_temp_c": temp})
                except ValueError:
                    continue

    df = pd.DataFrame(data)
    df.sort_values("years_bp", inplace=True)
    df.to_csv(GISP2_CSV, index=False)
    print(f"Saved {len(df)} GISP2 records to {GISP2_CSV}")

def process_epica():
    print("Processing Antarctic Composite CO2 (Bereiter 2015)...")
    data = []
    with open(EPICA_RAW, "r") as f:
        for line in f:
            line = line.strip()
            # Skip header
            if line.startswith("#") or not line or line.startswith("age_gas_calBP"):
                continue
            
            parts = line.split()
            if len(parts) >= 2:
                try:
                    # Column 1 is age_gas_calBP
                    age_years = float(parts[0])
                    co2 = float(parts[1])
                    
                    if age_years <= 12500 and age_years >= 0:
                        data.append({"years_bp": int(age_years), "epica_co2_ppm": co2})
                except ValueError:
                    continue

    if data:
        df = pd.DataFrame(data)
        df.sort_values("years_bp", inplace=True)
        # Handle duplicates by taking the mean if multiple measurements exist for the same year
        df = df.groupby("years_bp").mean().reset_index()
        df.to_csv(EPICA_CSV, index=False)
        print(f"Saved {len(df)} CO2 records to {EPICA_CSV}")
    else:
        print("Error: No CO2 records found for the Holocene epoch.")

if __name__ == "__main__":
    download_file(GISP2_URL, GISP2_RAW)
    download_file(EPICA_URL, EPICA_RAW)
    process_gisp2()
    process_epica()
    print("Ice core processing complete.")
