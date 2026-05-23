import json

with open('/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json') as f:
    nodes = json.load(f)

# Sort by emissions
sorted_n = sorted(nodes, key=lambda n: n.get('fossil_co2_mt') or 0, reverse=True)

print('=== DATA VISUALIZATION REASONING ===')
print()
print('UNIVERSAL DATA (100% of countries):')
print('  - fossil_co2_mt: How much CO₂ the country emits')
print('  - momentum_cagr: Whether emissions are going up or down')
print('  - change_since_2015: Progress since Paris Agreement')
print('  - co2_per_capita: Emissions per person')
print('  - population: Country size')
print()
print('PLEDGE DATA (70% of countries):')
print('  - reduction_pct + target_year: What they promised')
print('  - reality_gap_mt: Whether they are on track')
print('  - on_track: Simple true/false')
print()
print('EXPERT ASSESSMENT (18% of countries):')
print('  - cat_rating: Climate Action Tracker rating')
print('  - globe_color: Color code for rating')
print()
print('FINANCE DATA (28% of countries):')
print('  - finance_total_bn: How much money they need')
print()

print('=== TOP 30 EMITTERS - WHAT WE CAN SHOW ===')
for i, n in enumerate(sorted_n[:30]):
    country = n['country']
    co2 = n.get('fossil_co2_mt', 0)
    mom = n.get('momentum_cagr')
    chg = n.get('change_since_2015')
    target = f"{n.get('reduction_pct', '?')}% by {int(n.get('target_year', 0)) if n.get('target_year') else '?'}" if n.get('reduction_pct') else 'NO PLEDGE'
    gap = n.get('reality_gap_mt')
    gap_str = f"{gap:+.0f} Mt" if gap is not None else 'N/A'
    on_track = n.get('on_track', '')
    on_str = '✓' if on_track == 'true' else ('✗' if on_track == 'false' else '-')
    cat = n.get('cat_rating', 'N/A')
    
    # What can we show?
    can_show = []
    can_show.append(f"emissions={co2:.0f}Mt")
    can_show.append(f"momentum={mom:+.1f}%/yr" if mom else "momentum=N/A")
    can_show.append(f"change={chg:+.1f}%" if chg else "change=N/A")
    if n.get('reduction_pct'):
        can_show.append(f"pledge={target}")
    if gap is not None:
        can_show.append(f"gap={gap_str}")
    if on_track in ['true', 'false']:
        can_show.append(f"on_track={on_str}")
    if cat and cat != 'N/A':
        can_show.append(f"CAT={cat}")
    
    print(f'  {(i+1):2d}. {country:25s} | {" | ".join(can_show)}')

print()
print('=== KEY INSIGHTS FOR VISUALIZATION ===')
print()
print('1. GLOBE COLOR: Use momentum_cagr (universal)')
print('   - Green = emissions decreasing (good direction)')
print('   - Red = emissions increasing (bad direction)')
print('   - This works for ALL 212 countries')
print()
print('2. GLOBE HEIGHT: Use fossil_co2_mt (universal)')
print('   - Bigger emitter = taller bar')
print('   - China towers, Bhutan is tiny')
print()
print('3. HOVER TOOLTIP: Show the story')
print('   - Country name + emissions + momentum')
print('   - If pledge exists: show target')
print('   - If gap exists: show gap + on_track')
print()
print('4. CLICK PANEL: Full dashboard')
print('   - Pledge section (if available)')
print('   - Reality gap section (if available)')
print('   - Momentum section (always available)')
print('   - Finance section (if available)')
print()
print('5. FOR COUNTRIES WITHOUT PLEDGE:')
print('   - Show emissions + momentum + change_since_2015')
print('   - "This country has not submitted a pledge"')
print('   - Still show if emissions are going up or down')
