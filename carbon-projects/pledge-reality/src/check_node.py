import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
import json

with open('data/pledge-nodes.json') as f:
    nodes = json.load(f)

# Check a sample node has the right structure for the UI
sample = None
for n in nodes:
    if n.get('country') == 'United States':
        sample = n
        break

if not sample:
    sample = nodes[0]

print('=== SAMPLE NODE ===')
print(json.dumps(sample, indent=2))

print('\n=== FIELD TYPES ===')
for k, v in sample.items():
    print(f'  {k:30s} {type(v).__name__:10s} = {str(v)[:60]}')
