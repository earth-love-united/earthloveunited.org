import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd

# Check the enriched file (the one you pointed to)
df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')

print('=== ENRICHED FILE ===')
print(f'Shape: {df.shape}')
print(f'Columns: {len(df.columns)}')

print('\n=== COVERAGE ===')
for col in df.columns:
    if col.startswith('cat_') or col.startswith('ndc_') or col in ['fossil_co2_mtCO2', 'co2_per_capita_t', 'population', 'globe_color', 'on_track']:
        if df[col].dtype == 'object':
            n = (df[col] != '').sum()
        else:
            n = (df[col] > 0).sum() if df[col].dtype in ['float64', 'int64'] else df[col].notna().sum()
        if n > 0:
            print(f'  {col:50s} {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')

print('\n=== ALL COLUMNS ===')
for i, c in enumerate(df.columns):
    print(f'  {i+1:2d}. {c}')
