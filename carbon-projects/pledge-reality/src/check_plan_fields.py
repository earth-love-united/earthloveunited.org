import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import pandas as pd

path = 'carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet'
df = pd.read_parquet(path)

# Check fields referenced in implementation plan
plan_fields = [
    'country', 'fossil_co2_mt', 'reality_gap_mt', 'globe_color',
    'lulucf_co2_mt', 'momentum_cagr', 'required_cagr', 'divergence',
    'finance_total_bn', 'ndc_summary', 'target_type', 'reduction_pct',
    'target_year', 'cat_rating', 'on_track'
]

print('=== FIELDS REFERENCED IN IMPLEMENTATION PLAN ===')
for f in plan_fields:
    if f in df.columns:
        n = df[f].notna().sum() if df[f].dtype in ['float64','int64'] else (df[f] != '').sum()
        print(f'  {f:30s} OK — {n:5d}/{len(df)} ({n/len(df)*100:.1f}%)')
    else:
        print(f'  {f:30s} MISSING')

# Also check the pledge-nodes.json fields
import json
with open('data/pledge-nodes.json') as f:
    nodes = json.load(f)

print('\n=== PLEDGE-NODES.JSON FIELDS ===')
print('Countries:', len(nodes))
print('Fields:', list(nodes[0].keys()))

# Check coverage in pledge-nodes
for key in nodes[0].keys():
    non_null = sum(1 for n in nodes if n.get(key) is not None and n.get(key) != '')
    if non_null > 0:
        print(f'  {key:30s} {non_null:3d}/{len(nodes)} ({non_null/len(nodes)*100:.0f}%)')
