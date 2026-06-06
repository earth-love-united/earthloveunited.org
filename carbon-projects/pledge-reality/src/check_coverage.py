import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd

df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_v2.parquet')
print('Records:', len(df), 'Countries:', df['country'].nunique(), 'Columns:', len(df.columns))
print()
print('=== COVERAGE ===')
for col in ['fossil_co2_mtCO2','co2_per_capita_t','population','cat_overall_rating','cat_ndc_target_2030_mtco2e','cat_current_policy_2030_mtco2e','cat_fair_share_15c_2030_mtco2e','cat_policy_vs_ndc_gap_mtco2e','cat_fair_share_gap_mtco2e','ndc_target_year']:
    if col in df.columns:
        if df[col].dtype == 'object':
            n = (df[col] != '').sum()
        else:
            n = (df[col] > 0).sum()
        print(f'  {col:45s} {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')
print()
print('=== CAT COUNTRIES WITH EMISSIONS DATA ===')
for c in sorted(df[df['cat_ndc_target_2030_mtco2e'] > 0]['country'].unique()):
    r = df[(df['country']==c) & (df['year']==2024)].iloc[0]
    print(f'  {c:30s} NDC={r["cat_ndc_target_2030_mtco2e"]:8.1f}  CP={r["cat_current_policy_2030_mtco2e"]:8.1f}  Gap={r["cat_policy_vs_ndc_gap_mtco2e"]:8.1f}')
