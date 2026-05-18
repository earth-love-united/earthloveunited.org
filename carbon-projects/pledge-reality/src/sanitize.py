#!/usr/bin/env python3
"""
Sanitize the enriched dataset for HF publishing.
Ensures consistent types and no null conflicts.
"""
import pandas as pd
import numpy as np
import os

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'output')

def sanitize():
    print("Loading enriched dataset...")
    df = pd.read_parquet(os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.parquet'))
    print(f"Shape: {df.shape}")
    
    # Ensure all numeric columns have no NaN (fill with 0 or appropriate value)
    float_cols = df.select_dtypes(include=['float64']).columns
    for col in float_cols:
        df[col] = df[col].fillna(0.0)
    
    int_cols = df.select_dtypes(include=['int64']).columns
    for col in int_cols:
        df[col] = df[col].fillna(0)
    
    # String columns: fill NaN with empty string
    str_cols = df.select_dtypes(include=['object']).columns
    for col in str_cols:
        df[col] = df[col].fillna('')
    
    # Bool columns: ensure consistent
    bool_cols = df.select_dtypes(include=['bool']).columns
    for col in bool_cols:
        df[col] = df[col].fillna(False)
    
    # Save sanitized version
    parquet_path = os.path.join(OUT_DIR, 'pledge_vs_reality_sanitized.parquet')
    csv_path = os.path.join(OUT_DIR, 'pledge_vs_reality_sanitized.csv')
    
    df.to_parquet(parquet_path, index=False)
    df.to_csv(csv_path, index=False)
    
    print(f"\n=== Sanitized ===")
    print(f"Parquet: {round(os.path.getsize(parquet_path)/1024, 1)} KB")
    print(f"CSV: {round(os.path.getsize(csv_path)/1024, 1)} KB")
    
    # Verify no nulls in key columns
    key_cols = ['country', 'year', 'fossil_co2_mtCO2', 'cat_rating_score', 'globe_color']
    for col in key_cols:
        nulls = df[col].isna().sum()
        print(f"  {col}: {nulls} nulls")
    
    return df

if __name__ == '__main__':
    sanitize()
