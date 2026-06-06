#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Phase 1: Fetch Global Sea Level Data (Spratt & Lisiecki 2016)
Downloads raw global sea level stack from NOAA NCEI and outputs a clean CSV 
restricted to the Holocene (0 to 12,000 Years BP).
"""
import os
import pandas as pd
import requests

RAW_DIR = "holocene-bifurcation/data/raw"
os.makedirs(RAW_DIR, exist_ok=True)

# Spratt & Lisiecki 2016 Global Sea Level Stack
SEALEVEL_URL = "https://www.ncei.noaa.gov/pub/data/paleo/contributions_by_author/spratt2016/spratt2016-noaa.txt"
SEALEVEL_RAW = os.path.join(RAW_DIR, "spratt2016-noaa.txt")
SEALEVEL_CSV = os.path.join(RAW_DIR, "global_sea_level.csv")

def download_file(url, path):
    if not os.path.exists(path):
        print(f"Downloading {url}...")
        response = requests.get(url)
        response.raise_for_status()
        with open(path, "w") as f:
            f.write(response.text)
        print(f"Saved {path}")

def process_sea_level():
    print("Processing Spratt & Lisiecki 2016 Global Sea Level...")
    data = []
    with open(SEALEVEL_RAW, "r") as f:
        for line in f:
            line = line.strip()
            # Skip header
            if line.startswith("#") or not line or line.startswith("age_calkaBP"):
                continue
            
            parts = line.split()
            if len(parts) >= 6:
                try:
                    # Column 0 is age_calkaBP (thousands of years BP)
                    # Column 5 is SeaLev_longPC1 (meters)
                    age_kyr = float(parts[0])
                    sea_level = float(parts[5])
                    
                    age_years = int(age_kyr * 1000)
                    
                    if age_years <= 12500 and age_years >= 0:
                        data.append({"years_bp": age_years, "global_sea_level_anomaly_m": sea_level})
                except ValueError:
                    continue

    if data:
        df = pd.DataFrame(data)
        df.sort_values("years_bp", inplace=True)
        # Handle duplicates if any
        df = df.groupby("years_bp").mean().reset_index()
        df.to_csv(SEALEVEL_CSV, index=False)
        print(f"Saved {len(df)} Sea Level records to {SEALEVEL_CSV}")
    else:
        print("Error: No sea level records found.")

if __name__ == "__main__":
    download_file(SEALEVEL_URL, SEALEVEL_RAW)
    process_sea_level()
    print("Sea Level processing complete.")
