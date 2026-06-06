#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Phase 1: Fetch Solar Activity (IntCal20 Delta 14C)
Downloads raw 14C data from intcal.org and outputs a clean CSV 
restricted to the Holocene (0 to 12,000 Years BP).
"""
import os
import pandas as pd
import requests

RAW_DIR = "holocene-bifurcation/data/raw"
os.makedirs(RAW_DIR, exist_ok=True)

# IntCal20 Carbon-14 Calibration Curve (Reimer et al. 2020)
INTCAL_URL = "https://intcal.org/curves/intcal20.14c"
INTCAL_RAW = os.path.join(RAW_DIR, "intcal20.14c")
SOLAR_CSV = os.path.join(RAW_DIR, "solar_14c.csv")

def download_file(url, path):
    if not os.path.exists(path):
        print(f"Downloading {url}...")
        response = requests.get(url)
        response.raise_for_status()
        with open(path, "w") as f:
            f.write(response.text)
        print(f"Saved {path}")

def process_solar():
    print("Processing IntCal20 Solar Activity (Delta 14C)...")
    data = []
    with open(INTCAL_RAW, "r") as f:
        for line in f:
            line = line.strip()
            # Skip header
            if line.startswith("#") or not line:
                continue
            
            parts = line.split(",")
            if len(parts) >= 4:
                try:
                    # Column 0 is CAL BP (Calendar Years Before Present)
                    # Column 3 is Delta 14C (proxy for solar magnetic activity / GCR flux)
                    age_years = int(parts[0])
                    delta_14c = float(parts[3])
                    
                    if age_years <= 12500 and age_years >= 0:
                        data.append({"years_bp": age_years, "solar_delta_14c": delta_14c})
                except ValueError:
                    continue

    if data:
        df = pd.DataFrame(data)
        df.sort_values("years_bp", inplace=True)
        # Handle duplicates if any
        df = df.groupby("years_bp").mean().reset_index()
        df.to_csv(SOLAR_CSV, index=False)
        print(f"Saved {len(df)} Solar records to {SOLAR_CSV}")
    else:
        print("Error: No solar records found.")

if __name__ == "__main__":
    download_file(INTCAL_URL, INTCAL_RAW)
    process_solar()
    print("Solar processing complete.")
