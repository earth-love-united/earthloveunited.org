import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd

df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')

print('=== CLIMATE WATCH NDC DATA COVERAGE ===')
cw_cols = [c for c in df.columns if c.startswith('cw_')]
for col in cw_cols:
    if df[col].dtype == 'object':
        n = (df[col] != '').sum()
    else:
        n = (df[col] > 0).sum() if df[col].dtype in ['float64', 'int64'] else df[col].notna().sum()
    if n > 0:
        print(f'  {col:45s} {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')

print('\n=== KEY NDC TARGET COLUMNS ===')
# Check which columns have the actual NDC target values
for col in ['ndc_target_year', 'cw_target_year', 'cw_ghg_target', 'cw_reduction_pct', 
            'cw_target_mtco2e', 'cat_ndc_target_2030_mtco2e', 'cat_ndc_unconditional_mtco2e',
            'cat_ndc_conditional_mtco2e', 'cat_bau_2030_mtco2e']:
    if col in df.columns:
        if df[col].dtype == 'object':
            n = (df[col] != '').sum()
        else:
            n = (df[col] > 0).sum() if df[col].dtype in ['float64', 'int64'] else df[col].notna().sum()
        print(f'  {col:45s} {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')

print('\n=== COUNTRIES WITH ANY NDC TARGET ===')
# Countries with at least one NDC target value
has_ndc = (
    (df['ndc_target_year'] > 0) | 
    (df['cw_target_year'] > 0) | 
    (df['cw_ghg_target'] > 0) |
    (df['cat_ndc_target_2030_mtco2e'] > 0)
)
print(f'  Countries: {df[has_ndc]["country"].nunique()}')
print(f'  Records: {has_ndc.sum()}/{len(df)} ({has_ndc.sum()/len(df)*100:.1f}%)')

# Show which countries have what
print('\n=== NDC TARGET AVAILABILITY BY COUNTRY (2024) ===')
df_2024 = df[df['year'] == 2024].sort_values('fossil_co2_mtCO2', ascending=False)
for _, row in df_2024.head(20).iterrows():
    sources = []
    if row['ndc_target_year'] > 0: sources.append(f"NDC_year={int(row['ndc_target_year'])}")
    if row['cw_target_year'] > 0: sources.append(f"CW_year={int(row['cw_target_year'])}")
    if row['cw_ghg_target'] > 0: sources.append(f"CW_ghg={row['cw_ghg_target']}")
    if row['cat_ndc_target_2030_mtco2e'] > 0: sources.append(f"CAT_2030={row['cat_ndc_target_2030_mtco2e']:.0f}")
    src = ', '.join(sources) if sources else 'NONE'
    print(f'  {row["country"]:30s} {src}')
