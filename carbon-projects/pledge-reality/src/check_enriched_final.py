import pandas as pd
import os

path = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet'
df = pd.read_parquet(path)

print('=== pledge_vs_reality_enriched.parquet ===')
print('Shape:', df.shape)
print('File size:', round(os.path.getsize(path)/1024, 1), 'KB')
print('Modified:', os.path.getmtime(path))

print('\n=== ALL COLUMNS ===')
for i, c in enumerate(df.columns):
    print(f'  {i+1:2d}. {c}')

print('\n=== COVERAGE ===')
key_cols = [
    'fossil_co2_mtCO2', 'co2_per_capita_t', 'population',
    'cw_target_year', 'cw_reduction_pct', 'cw_baseline_year', 'cw_ghg_target',
    'cat_overall_rating', 'cat_ndc_target_2030_mtco2e',
    'gap_required_annual_reduction_pct', 'gap_on_track', 'gap_years_remaining',
    'globe_color', 'on_track'
]
for col in key_cols:
    if col in df.columns:
        if df[col].dtype == 'object':
            n = (df[col] != '').sum()
        else:
            n = (df[col] > 0).sum() if df[col].dtype in ['float64', 'int64'] else df[col].notna().sum()
        pct = n / len(df) * 100
        print(f'  {col:45s} {n:5d}/{len(df)} ({pct:5.1f}%)')
    else:
        print(f'  {col:45s} MISSING')
