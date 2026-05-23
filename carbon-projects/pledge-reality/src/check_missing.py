import json

with open('/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json') as f:
    nodes = json.load(f)

sorted_nodes = sorted(nodes, key=lambda n: n.get('fossil_co2_mt') or 0, reverse=True)

print('=== TOP 50 EMITTERS MISSING GAP DATA ===')
missing = [n for n in sorted_nodes[:50] if n.get('reality_gap_mt') is None]
print(f'Count: {len(missing)}\n')

for n in missing:
    summary = (n.get('ndc_summary') or '')[:200].replace('\n', ' ')
    target = f"{n.get('reduction_pct', '?')}% by {int(n.get('target_year', 0)) if n.get('target_year') else '?'}"
    print(f"  {n['country']:25s} {n.get('fossil_co2_mt', 0):8.0f} Mt  target: {target:20s} type: {n.get('target_type', 'N/A')}")
    print(f"    summary: {summary}")
    print()
