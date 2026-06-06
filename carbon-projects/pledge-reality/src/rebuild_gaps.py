import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd
import numpy as np

df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')

print('=== REBUILDING GAP ANALYSIS WITH CW DATA ===')
print('Shape:', df.shape)

# We have cw_reduction_pct and cw_target_year for ~72% of countries
# Use these to compute gap metrics

# Required annual reduction from 2015 baseline to target year
df['gap_required_annual_reduction_pct'] = np.where(
    (df['cw_target_year'] > 0) & (df['cw_reduction_pct'] > 0),
    (df['cw_reduction_pct'] / (df['cw_target_year'] - 2015)).round(2),
    0
)

# For 2024 rows, compute how much reduction has actually happened since 2015
df['gap_actual_reduction_from_2015_pct'] = np.where(
    (df['baseline_2015_co2'] > 0),
    ((df['baseline_2015_co2'] - df['fossil_co2_mtCO2']) / df['baseline_2015_co2'] * 100).round(2),
    0
)

# Annualized actual reduction
df['gap_actual_annual_reduction_pct'] = np.where(
    (df['year'] > 2015),
    (df['gap_actual_reduction_from_2015_pct'] / (df['year'] - 2015)).round(2),
    0
)

# Gap: required vs actual (positive = falling behind)
df['gap_annual_reduction_gap_pct'] = np.where(
    (df['gap_required_annual_reduction_pct'] > 0),
    (df['gap_required_annual_reduction_pct'] - df['gap_actual_annual_reduction_pct']).round(2),
    0
)

# On track: actual annual reduction >= required
df['gap_on_track'] = np.where(
    (df['gap_required_annual_reduction_pct'] > 0) & (df['year'] > 2015),
    np.where(df['gap_actual_annual_reduction_pct'] >= df['gap_required_annual_reduction_pct'], 'true', 'false'),
    ''
)

# Years remaining to target
df['gap_years_remaining'] = np.where(
    (df['cw_target_year'] > 0),
    np.where(df['cw_target_year'] > df['year'], (df['cw_target_year'] - df['year']).round(0), 0),
    0
)

# Total reduction still needed
df['gap_total_reduction_still_needed_pct'] = np.where(
    (df['cw_target_year'] > 0) & (df['year'] <= df['cw_target_year']),
    np.maximum(0, df['cw_reduction_pct'] - df['gap_actual_reduction_from_2015_pct']).round(2),
    0
)

# Save
df.to_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_v3.parquet', index=False)
df.to_csv('carbon-projects/pledge-reality/data/output/pledge_vs_reality_v3.csv', index=False)

import os
print('Saved v3:', round(os.path.getsize('carbon-projects/pledge-reality/data/output/pledge_vs_reality_v3.parquet')/1024, 1), 'KB')

# Coverage
print('')
print('=== GAP ANALYSIS COVERAGE ===')
for col in ['gap_required_annual_reduction_pct', 'gap_actual_reduction_from_2015_pct', 
            'gap_actual_annual_reduction_pct', 'gap_annual_reduction_gap_pct', 
            'gap_on_track', 'gap_years_remaining', 'gap_total_reduction_still_needed_pct']:
    if col == 'gap_on_track':
        n = (df[col] != '').sum()
    else:
        n = (df[col] > 0).sum()
    print(f'  {col:45s} {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')

# Top emitters
print('')
print('=== TOP 15 EMITTERS 2024: GAP ANALYSIS ===')
df_2024 = df[df['year'] == 2024].sort_values('fossil_co2_mtCO2', ascending=False)
for _, row in df_2024.head(15).iterrows():
    country = row['country']
    co2 = row['fossil_co2_mtCO2']
    target_yr = int(row['cw_target_year']) if row['cw_target_year'] > 0 else '?'
    reduction = row['cw_reduction_pct']
    baseline = int(row['cw_baseline_year']) if row['cw_baseline_year'] > 0 else '?'
    req_annual = row['gap_required_annual_reduction_pct']
    actual_annual = row['gap_actual_annual_reduction_pct']
    gap = row['gap_annual_reduction_gap_pct']
    on_track = row['gap_on_track']
    
    if row['cw_target_year'] > 0 and row['cw_reduction_pct'] > 0:
        print(f'  {country:30s} CO2={co2:8.1f}  target={target_yr}  reduction={reduction}%  baseline={baseline}  req_annual={req_annual}%  actual_annual={actual_annual}%  gap={gap}%  on_track={on_track}')
    else:
        print(f'  {country:30s} CO2={co2:8.1f}  NO NDC TARGET')
