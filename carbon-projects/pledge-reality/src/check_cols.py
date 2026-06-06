import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd

df = pd.read_parquet('carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet')
print('Columns:', list(df.columns))
print()

# Check 2024 data
df24 = df[df['year'] == 2024]
print(f'2024 records: {len(df24)}')

# Check USA
usa = df24[df24['country'] == 'United States']
if len(usa) > 0:
    print('\n=== USA 2024 ===')
    for col in usa.columns:
        val = usa.iloc[0][col]
        if pd.notna(val) and val != '' and val != 0:
            print(f'  {col}: {val}')
