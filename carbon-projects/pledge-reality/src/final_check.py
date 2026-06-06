import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd
import numpy as np

path = 'carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet'
df = pd.read_parquet(path)

print('=== FINAL: pledge_vs_reality_enriched.parquet ===')
print('Shape:', df.shape, '(records x columns)')
print()

# Core coverage
print('=== CORE DATA ===')
for col in ['fossil_co2_mtCO2', 'total_co2_mtCO2', 'lulucf_co2_mtCO2', 'population', 'co2_per_capita_t']:
    n = df[col].notna().sum() if df[col].dtype in ['float64','int64'] else (df[col] != '').sum()
    countries = df[df[col].notna()]['country'].nunique() if df[col].dtype in ['float64','int64'] else df[df[col] != '']['country'].nunique()
    print(f'  {col:30s} records={n:5d}/{len(df)} ({n/len(df)*100:5.1f}%)  countries={countries:3d}')

print()
print('=== NDC PLEDGE DATA (Climate Watch) ===')
for col in ['cw_target_year', 'cw_reduction_pct', 'cw_baseline_year', 'cw_ghg_target', 'cw_target_type', 'cw_conditionality']:
    n = df[col].notna().sum() if df[col].dtype in ['float64','int64'] else (df[col] != '').sum()
    countries = df[df[col].notna()]['country'].nunique() if df[col].dtype in ['float64','int64'] else df[df[col] != '']['country'].nunique()
    print(f'  {col:30s} records={n:5d}/{len(df)} ({n/len(df)*100:5.1f}%)  countries={countries:3d}')

print()
print('=== CAT ASSESSMENTS ===')
for col in ['cat_overall_rating', 'cat_ndc_target_2030_mtco2e', 'cat_ndc_unconditional_mtco2e', 'cat_bau_2030_mtco2e']:
    n = df[col].notna().sum() if df[col].dtype in ['float64','int64'] else (df[col] != '').sum()
    countries = df[df[col].notna()]['country'].nunique() if df[col].dtype in ['float64','int64'] else df[df[col] != '']['country'].nunique()
    print(f'  {col:30s} records={n:5d}/{len(df)} ({n/len(df)*100:5.1f}%)  countries={countries:3d}')

print()
print('=== GAP ANALYSIS ===')
for col in ['implied_target_mtco2e', 'reality_gap_mtco2e', 'momentum_cagr_10yr_pct', 
            'years_to_target', 'target_cagr_required_pct', 'momentum_vs_target_divergence_pct', 'on_track']:
    if col == 'on_track':
        n = (df[col] != '').sum()
    else:
        n = df[col].notna().sum() if df[col].dtype in ['float64','int64'] else (df[col] != '').sum()
    countries = df[df[col].notna()]['country'].nunique() if df[col].dtype in ['float64','int64'] else df[df[col] != '']['country'].nunique()
    print(f'  {col:30s} records={n:5d}/{len(df)} ({n/len(df)*100:5.1f}%)  countries={countries:3d}')

print()
print('=== TOP 10 EMITTERS 2024: GAP SNAPSHOT ===')
df_2024 = df[df['year'] == 2024].sort_values('fossil_co2_mtCO2', ascending=False)
for _, r in df_2024.head(10).iterrows():
    c = r['country']
    co2 = r['fossil_co2_mtCO2']
    tyr = int(r['cw_target_year']) if r['cw_target_year'] > 0 else '?'
    red = r['cw_reduction_pct']
    imp = r['implied_target_mtco2e']
    gap = r['reality_gap_mtco2e']
    mom = r['momentum_cagr_10yr_pct']
    div = r['momentum_vs_target_divergence_pct']
    ot = r['on_track']
    
    s = c.ljust(28) + ' CO2=' + str(round(co2)).rjust(7)
    if tyr != '?': s += '  target=' + str(tyr)
    if red > 0: s += '  reduction=' + str(red) + '%'
    if imp > 0: s += '  implied=' + str(round(imp))
    if pd.notna(gap) and gap != 0: s += '  gap=' + str(round(gap))
    if pd.notna(mom) and mom != 0: s += '  momentum=' + str(round(mom, 2)) + '%'
    if pd.notna(div) and div != 0: s += '  divergence=' + str(round(div, 2)) + '%'
    s += '  on_track=' + str(ot)
    print(s)

print()
print('=== ON TRACK (2024) ===')
sub = df[df['year'] == 2024]
print('  on_track=true:', (sub['on_track'] == 'true').sum(), 'countries')
print('  on_track=false:', (sub['on_track'] == 'false').sum(), 'countries')
print('  on_track=empty:', (sub['on_track'] == '').sum(), 'countries')
on_track_countries = sub[sub['on_track'] == 'true']['country'].tolist()
off_track_countries = sub[sub['on_track'] == 'false']['country'].tolist()
print('  ON TRACK:', on_track_countries[:10])
print('  OFF TRACK:', off_track_countries[:10])
