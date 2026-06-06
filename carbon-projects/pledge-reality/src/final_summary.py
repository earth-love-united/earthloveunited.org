import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd

df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_v3.parquet')

print('=== FINAL DATASET: pledge_vs_reality_v3.parquet ===')
print('Records:', len(df))
print('Countries:', df['country'].nunique())
print('Columns:', len(df.columns))
print('Years:', df['year'].min(), '-', df['year'].max())

print('')
print('=== DATA COMPLETENESS BY SOURCE ===')

sources = {
    'GCB Fossil CO2 emissions': ('fossil_co2_mtCO2', 'numeric'),
    'WB Population': ('population', 'numeric'),
    'WB Per-capita emissions': ('co2_per_capita_t', 'numeric'),
    'CW NDC target year': ('cw_target_year', 'numeric'),
    'CW NDC reduction %': ('cw_reduction_pct', 'numeric'),
    'CW NDC baseline year': ('cw_baseline_year', 'numeric'),
    'CW NDC target type': ('cw_target_type', 'string'),
    'CW NDC conditionality': ('cw_conditionality', 'string'),
    'CW NDC summary text': ('cw_summary', 'string'),
    'CAT overall rating': ('cat_overall_rating', 'string'),
    'CAT NDC target rating': ('cat_ndc_targetagainst_modelled_domestic_pathways', 'string'),
    'CAT policy rating': ('cat_policies_and_actionagainst_modelled_domestic_pathways', 'string'),
    'CAT fair share rating': ('cat_ndc_targetagainst_fair_share', 'string'),
    'CAT net zero target': ('cat_net_zero_target', 'string'),
    'CAT 2030 target MtCO2e': ('cat_ndc_target_2030_mtco2e', 'numeric'),
    'CAT BAU 2030 MtCO2e': ('cat_bau_2030_mtco2e', 'numeric'),
    'CAT reduction %': ('cat_reduction_pct', 'numeric'),
    'CAT baseline year': ('cat_baseline_year', 'numeric'),
    'Gap: required annual reduction': ('gap_required_annual_reduction_pct', 'numeric'),
    'Gap: actual annual reduction': ('gap_actual_annual_reduction_pct', 'numeric'),
    'Gap: annual reduction gap': ('gap_annual_reduction_gap_pct', 'numeric'),
    'Gap: on track': ('gap_on_track', 'string'),
    'Gap: years remaining': ('gap_years_remaining', 'numeric'),
    'Gap: total reduction still needed': ('gap_total_reduction_still_needed_pct', 'numeric'),
    'Globe color': ('globe_color', 'string'),
}

for label, (col, dtype) in sources.items():
    if col in df.columns:
        if dtype == 'string':
            n = (df[col] != '').sum()
        else:
            n = (df[col] > 0).sum() if df[col].dtype in ['float64', 'int64'] else df[col].notna().sum()
        pct = n / len(df) * 100
        bar = '#' * int(pct / 2) + '-' * (50 - int(pct / 2))
        print(f'  {label:45s} {bar} {pct:5.1f}%')

print('')
print('=== COUNTRY COVERAGE ===')
# How many countries have each data type
for label, (col, dtype) in sources.items():
    if col in df.columns:
        if dtype == 'string':
            n = df[df[col] != '']['country'].nunique()
        else:
            n = df[df[col] > 0]['country'].nunique()
        if n > 0:
            print(f'  {label:45s} {n:3d} countries')
