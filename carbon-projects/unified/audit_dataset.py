#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd
import numpy as np
import json

PARQUET_FILE = "carbon-projects/unified/train.parquet"

def audit_dataset():
    df = pd.read_parquet(PARQUET_FILE)
    
    total_projects = len(df)
    
    print("=== 1. COMPLETENESS & USABILITY ===")
    fields_to_check = [
        'name', 'description', 'project_type_category', 'project_type_methodology', 
        'country', 'latitude', 'longitude', 'developer', 'crediting_period_start', 
        'estimated_annual_reduction_tco2', 'cross_registered'
    ]
    
    for f in fields_to_check:
        # Check empty strings, nulls, or 0.0 for coords
        if f in ['latitude', 'longitude']:
            missing = (df[f] == 0.0) | df[f].isna()
        elif df[f].dtype == 'object':
            missing = (df[f] == "") | df[f].isna()
        else:
            missing = df[f].isna()
            
        missing_count = missing.sum()
        fill_rate = 100 * (1 - missing_count / total_projects)
        print(f"Fill rate for {f:30}: {fill_rate:.1f}%")

    print("\n=== 2. TEXT QUALITY (For LLM/RAG) ===")
    df['desc_len'] = df['description'].fillna("").apply(lambda x: len(str(x).split()))
    desc_filled = df[df['desc_len'] > 0]
    print(f"Average description length (words): {desc_filled['desc_len'].mean():.1f}")
    print(f"Projects with >50 words description: {len(desc_filled[desc_filled['desc_len'] > 50])}")
    print(f"Projects with >200 words description: {len(desc_filled[desc_filled['desc_len'] > 200])}")

    print("\n=== 3. REGISTRY DIVERSITY & UNIQUE VALUE ===")
    # Count registries from 'data_sources'
    registry_counts = {}
    for idx, row in df.iterrows():
        try:
            sources = json.loads(row['data_sources'])
            for s in sources:
                reg = s.get('registry', 'unknown')
                registry_counts[reg] = registry_counts.get(reg, 0) + 1
        except:
            pass
            
    for reg, count in sorted(registry_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"{reg:20}: {count}")

    print("\n=== 4. CROSS-REGISTRATION (Deduplication) ===")
    cross_reg = df[df['cross_registered'] == True]
    print(f"Projects identified as cross-registered: {len(cross_reg)}")
    
    print("\n=== 5. FINANCIAL/CREDITING DATA ===")
    has_issuance = len(df[df['credits_issued'] > 0])
    has_retirement = len(df[df['credits_retired'] > 0])
    has_annual = len(df[df['estimated_annual_reduction_tco2'] > 0])
    
    print(f"Projects with Credits Issued data: {has_issuance} ({100*has_issuance/total_projects:.1f}%)")
    print(f"Projects with Credits Retired data: {has_retirement} ({100*has_retirement/total_projects:.1f}%)")
    print(f"Projects with Est. Annual Reduction: {has_annual} ({100*has_annual/total_projects:.1f}%)")

if __name__ == "__main__":
    audit_dataset()
