import json

with open('/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json') as f:
    nodes = json.load(f)

print(f'Total countries: {len(nodes)}')
print()

# Understand the data structure
print('=== SAMPLE NODE (USA) ===')
usa = next(n for n in nodes if n['iso'] == 'USA')
for k, v in usa.items():
    if v is not None and v != '':
        print(f'  {k}: {v}')

print()
print('=== SAMPLE NODE (China) ===')
chn = next(n for n in nodes if n['iso'] == 'CHN')
for k, v in chn.items():
    if v is not None and v != '':
        print(f'  {k}: {v}')

print()
print('=== SAMPLE NODE (Small emitter - Bhutan) ===')
btn = next((n for n in nodes if n['iso'] == 'BTN'), None)
if btn:
    for k, v in btn.items():
        if v is not None and v != '':
            print(f'  {k}: {v}')

# Understand target_type distribution
print()
print('=== TARGET TYPE DISTRIBUTION ===')
from collections import Counter
types = Counter(n.get('target_type', 'empty') for n in nodes)
for t, c in types.most_common():
    print(f'  {t:20s} {c:3d} countries')

# Understand what data is available for different visualizations
print()
print('=== VISUALIZATION DATA AVAILABILITY ===')

# For globe coloring
has_color = sum(1 for n in nodes if n.get('globe_color') and n['globe_color'] != '#95a5a6')
print(f'  Has CAT rating color: {has_color}/{len(nodes)} ({has_color/len(nodes)*100:.1f}%)')

# For extrusion height
has_emissions = sum(1 for n in nodes if n.get('fossil_co2_mt'))
print(f'  Has emissions data: {has_emissions}/{len(nodes)} ({has_emissions/len(nodes)*100:.1f}%)')

# For gap visualization
has_gap = sum(1 for n in nodes if n.get('reality_gap_mt') is not None)
print(f'  Has reality gap: {has_gap}/{len(nodes)} ({has_gap/len(nodes)*100:.1f}%)')

# For on_track
has_on_track = sum(1 for n in nodes if n.get('on_track') in ['true', 'false'])
print(f'  Has on_track status: {has_on_track}/{len(nodes)} ({has_on_track/len(nodes)*100:.1f}%)')

# For momentum
has_momentum = sum(1 for n in nodes if n.get('momentum_cagr') is not None)
print(f'  Has momentum CAGR: {has_momentum}/{len(nodes)} ({has_momentum/len(nodes)*100:.1f}%)')

# For target
has_target = sum(1 for n in nodes if n.get('reduction_pct') is not None and n.get('target_year') is not None)
print(f'  Has target (pct + year): {has_target}/{len(nodes)} ({has_target/len(nodes)*100:.1f}%)')

# For finance
has_finance = sum(1 for n in nodes if n.get('finance_total_bn') is not None)
print(f'  Has finance data: {has_finance}/{len(nodes)} ({has_finance/len(nodes)*100:.1f}%)')

# For LULUCF
has_lulucf = sum(1 for n in nodes if n.get('lulucf_co2_mt') is not None)
print(f'  Has LULUCF data: {has_lulucf}/{len(nodes)} ({has_lulucf/len(nodes)*100:.1f}%)')

# Countries with no data at all
no_data = [n for n in nodes if not n.get('fossil_co2_mt') and not n.get('target_type')]
print(f'\n  Countries with NO data: {len(no_data)}')
