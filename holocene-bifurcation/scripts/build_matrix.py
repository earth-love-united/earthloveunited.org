#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Phase 3: The Decadal Matrix (Interpolation)
Splicing 5 completely different geological archives (Ice Cores, Tree Rings, Coral Reefs)
into a perfectly synchronized 10-year resolution timeline spanning the Holocene.
"""
import os
import pandas as pd
import numpy as np
from scipy.interpolate import pchip_interpolate

RAW_DIR = "holocene-bifurcation/data/raw"
OUT_DIR = "holocene-bifurcation/data/processed"
os.makedirs(OUT_DIR, exist_ok=True)

# Input files
GISP2_CSV = os.path.join(RAW_DIR, "gisp2_temp.csv")
EPICA_CSV = os.path.join(RAW_DIR, "edc_co2.csv")
SOLAR_CSV = os.path.join(RAW_DIR, "solar_14c.csv")
MAG_CSV = os.path.join(RAW_DIR, "geomagnetic_intensity.csv")
SEALEV_CSV = os.path.join(RAW_DIR, "global_sea_level.csv")

# Output files
FINAL_PARQUET = os.path.join(OUT_DIR, "holocene_bifurcation_base.parquet")
FINAL_CSV = os.path.join(OUT_DIR, "holocene_bifurcation_base.csv")

def load_and_clean(csv_path):
    if not os.path.exists(csv_path):
        print(f"Warning: {csv_path} not found. Skipping.")
        return None
    df = pd.read_csv(csv_path)
    df.dropna(inplace=True)
    df.sort_values("years_bp", inplace=True)
    # Ensure strict monotonicity for interpolation
    df = df.drop_duplicates(subset=["years_bp"])
    return df

def build_matrix():
    print("Building the Decadal Master Matrix (0 to 12,000 BP)...")
    
    # Master Index: Decadal resolution (10-year steps) from 0 to 12500 BP
    master_years = np.arange(0, 12510, 10)
    master_df = pd.DataFrame({"years_bp": master_years})
    
    datasets = {
        "gisp2_temp_c": load_and_clean(GISP2_CSV),
        "epica_co2_ppm": load_and_clean(EPICA_CSV),
        "solar_delta_14c": load_and_clean(SOLAR_CSV),
        "geomagnetic_vadm": load_and_clean(MAG_CSV),
        "global_sea_level_anomaly_m": load_and_clean(SEALEV_CSV)
    }
    
    for col_name, df in datasets.items():
        if df is None or df.empty:
            continue
            
        # The x (years) and y (values) arrays from the raw dataset
        x_raw = df["years_bp"].values
        # Get the value column name (which is the one that is not 'years_bp')
        val_col = [c for c in df.columns if c != "years_bp"][0]
        y_raw = df[val_col].values
        
        # Use PCHIP for sparse data (Sea Level, n=13) to retain geological curves
        # Use Linear Interpolation for dense noisy data (Ice Cores, Solar) to prevent wild polynomial oscillation artifacts
        if len(x_raw) < 50:
            y_interp = pchip_interpolate(x_raw, y_raw, master_years)
        else:
            y_interp = np.interp(master_years, x_raw, y_raw)
            
        master_df[val_col] = y_interp
        print(f"Interpolated {val_col} (raw points: {len(x_raw)}) -> {len(master_years)} decadal points")

    # Serialize
    master_df.to_parquet(FINAL_PARQUET, index=False)
    master_df.to_csv(FINAL_CSV, index=False)
    
    print("\n================ MATRIX BUILT ================")
    print(f"Dimensions: {master_df.shape}")
    print(f"Time Range: {master_df['years_bp'].min()} to {master_df['years_bp'].max()} BP")
    print(f"Saved Parquet: {FINAL_PARQUET}")
    print(f"Saved CSV: {FINAL_CSV}")
    
    # Print a preview of the "Noah Flood" anchor (11,000 - 12,000 BP)
    print("\nPreview of the 'OG Bifu' Anchor (11,500 - 12,000 BP):")
    bifu_preview = master_df[(master_df['years_bp'] >= 11500) & (master_df['years_bp'] <= 12000)].tail(10)
    print(bifu_preview)

if __name__ == "__main__":
    build_matrix()
