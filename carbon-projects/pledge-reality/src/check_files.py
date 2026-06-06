import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd
df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')
print('enriched:', df.shape)
print('Has cat_ndc_target_2030:', 'cat_ndc_target_2030_mtco2e' in df.columns)
print('Has cat_policy_gap:', 'cat_policy_vs_ndc_gap_mtco2e' in df.columns)
print('Columns:', [c for c in df.columns if 'cat_' in c][:10])

df2 = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_v2.parquet')
print()
print('v2:', df2.shape)
print('Has cat_ndc_target_2030:', 'cat_ndc_target_2030_mtco2e' in df2.columns)
print('Has cat_policy_gap:', 'cat_policy_vs_ndc_gap_mtco2e' in df2.columns)
print('Columns:', [c for c in df2.columns if 'cat_' in c][:10])
