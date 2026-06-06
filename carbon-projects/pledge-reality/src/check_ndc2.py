import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd

df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')

print('=== NDC TARGET COVERAGE ===')
for col in ['cw_ghg_target', 'cw_target_type', 'cw_conditionality', 'cw_summary', 'cw_submission_type']:
    n = (df[col] != '').sum()
    print(f'  {col:45s} {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')

for col in ['ndc_target_year', 'cw_target_year', 'cw_baseline_year', 'cw_reduction_pct', 
            'cw_target_mtco2e', 'cat_ndc_target_2030_mtco2e']:
    n = (df[col] > 0).sum() if df[col].dtype in ['float64', 'int64'] else df[col].notna().sum()
    print(f'  {col:45s} {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')

print('')
print('=== TOP 20 EMITTERS 2024: NDC DATA ===')
df_2024 = df[df['year'] == 2024].sort_values('fossil_co2_mtCO2', ascending=False)
for _, row in df_2024.head(20).iterrows():
    parts = []
    if row['cw_target_year'] > 0:
        parts.append('target_year=' + str(int(row['cw_target_year'])))
    if row['cw_reduction_pct'] > 0:
        parts.append('reduction=' + str(row['cw_reduction_pct']) + '%')
    if row['cw_ghg_target'] != '':
        parts.append('ghg=' + str(row['cw_ghg_target']))
    if row['cw_target_mtco2e'] > 0:
        parts.append('mtco2e=' + str(round(row['cw_target_mtco2e'])))
    if row['cat_ndc_target_2030_mtco2e'] > 0:
        parts.append('cat_2030=' + str(round(row['cat_ndc_target_2030_mtco2e'])))
    src = ', '.join(parts) if parts else 'NO NDC TARGET'
    co2 = row['fossil_co2_mtCO2']
    print('  ' + row['country'].ljust(30) + ' CO2=' + str(round(co2, 1)).rjust(8) + '  ' + src)

print('')
cw_yr = df[df['cw_target_year'] > 0]['country'].nunique()
cw_pct = df[df['cw_reduction_pct'] > 0]['country'].nunique()
cat_ndc = df[df['cat_ndc_target_2030_mtco2e'] > 0]['country'].nunique()
any_ndc = df[(df['cw_target_year'] > 0) | (df['cat_ndc_target_2030_mtco2e'] > 0)]['country'].nunique()
print('=== SUMMARY ===')
print('Countries with CW NDC target year: ' + str(cw_yr))
print('Countries with CW reduction %: ' + str(cw_pct))
print('Countries with CAT 2030 target: ' + str(cat_ndc))
print('Countries with ANY NDC target: ' + str(any_ndc))
