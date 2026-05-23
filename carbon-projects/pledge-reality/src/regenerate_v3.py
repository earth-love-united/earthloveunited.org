#!/usr/bin/env python3
"""
Regenerate pledge-nodes.json v3 - with proper handling of intensity targets.
For intensity targets, we report the reduction % but don't compute absolute gap.
For bau targets without BAU data, we use recent GCB emissions as proxy.
"""
import pandas as pd
import numpy as np
import json
import os
import re

DATA_DIR = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data'
PROC_DIR = os.path.join(DATA_DIR, 'processed')
OUT_DIR = os.path.join(DATA_DIR, 'output')

df = pd.read_parquet(os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.parquet'))
df_2024 = df[df['year'] == 2024].copy()

gcb = pd.read_csv(os.path.join(PROC_DIR, 'gcb_emissions.csv'))
gcb_map = gcb.set_index(['country', 'year'])['fossil_co2_mtCO2'].to_dict()

# Load existing coords
with open('/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json') as f:
    existing = json.load(f)
coord_map = {n['iso']: (n['lat'], n['lng']) for n in existing if n.get('lat') and n.get('lng')}

results = []

for _, row in df_2024.iterrows():
    country = row['country']
    iso = row.get('iso_code', '')
    lat, lng = coord_map.get(iso, (None, None))
    
    fossil = row['fossil_co2_mtCO2']
    lulucf = row.get('lulucf_co2_mtCO2', 0) or 0
    total = row.get('total_co2_mtCO2', fossil)
    pop = row.get('population', 0) or 0
    per_capita = row.get('co2_per_capita_t', 0) or 0
    
    reduction_pct = row.get('cw_reduction_pct')
    target_year = row.get('cw_target_year')
    if pd.isna(target_year):
        target_year = row.get('ndc_target_year')
    target_type = row.get('cw_target_type', '')
    baseline_year = row.get('cw_baseline_year')
    conditionality = row.get('cw_conditionality', '')
    ndc_summary = row.get('cw_summary', '')
    
    cat_rating = row.get('cat_overall_rating', '')
    cat_score = row.get('cat_rating_score', 0)
    globe_color = row.get('globe_color', '#95a5a6')
    
    fin_mit = row.get('cw_mitigation_finance_bn')
    fin_adapt = row.get('cw_adaptation_finance_bn')
    fin_total = row.get('cw_total_finance_bn')
    
    # Start with pre-computed values from enriched parquet
    implied = row.get('implied_target_mtco2e')
    gap = row.get('reality_gap_mtco2e')
    momentum = row.get('momentum_cagr_10yr_pct')
    required_cagr = row.get('target_cagr_required_pct')
    divergence = row.get('momentum_vs_target_divergence_pct')
    on_track = row.get('on_track', '')
    change_2015 = row.get('emissions_change_from_2015_pct')
    
    # Skip gap computation for intensity targets (need GDP data)
    is_intensity = target_type == 'intensity'
    
    # For non-intensity targets without gap, try to compute
    if pd.isna(gap) and not pd.isna(reduction_pct) and not pd.isna(target_year) and not is_intensity:
        baseline_emissions = None
        
        # Try 1: cw_baseline_year with GCB data
        if not pd.isna(baseline_year):
            baseline_emissions = gcb_map.get((country, int(baseline_year)))
        
        # Try 2: Parse from ndc_summary
        if pd.isna(baseline_emissions) and ndc_summary:
            for pat in [r'below\s+(\d{4})\s+level', r'from\s+(\d{4})\s+level',
                        r'compared\s+to\s+(\d{4})', r'relative\s+to\s+(\d{4})',
                        r'(\d{4})\s+baseline', r'from\s+the\s+(\d{4})']:
                m = re.search(pat, str(ndc_summary).lower())
                if m:
                    by = int(m.group(1))
                    if 1990 <= by <= 2024:
                        val = gcb_map.get((country, by))
                        if not pd.isna(val):
                            baseline_emissions = val
                            break
        
        # Try 3: For bau targets, use recent GCB as BAU proxy
        if pd.isna(baseline_emissions) and target_type == 'bau':
            for by in [2024, 2023, 2022, 2021, 2020, 2019]:
                val = gcb_map.get((country, by))
                if not pd.isna(val):
                    baseline_emissions = val
                    break
        
        # Compute
        if not pd.isna(baseline_emissions):
            implied = baseline_emissions * (1 - reduction_pct / 100.0)
            gap = fossil - implied
            
            years_left = int(float(target_year)) - 2024
            if years_left > 0 and fossil > 0:
                required_cagr = ((implied / fossil) ** (1/years_left) - 1) * 100
                if not pd.isna(momentum):
                    divergence = momentum - required_cagr
                    on_track = 'true' if divergence <= 0 else 'false'
    
    # For intensity targets, compute a "relative gap" based on emissions trend
    if is_intensity and not pd.isna(momentum):
        # If emissions are decreasing (negative momentum), they're moving in right direction
        # This is a proxy — true intensity gap requires GDP data
        if momentum > 0:
            on_track = 'false'  # Emissions growing = bad for intensity target
        else:
            on_track = 'true'  # Emissions declining = good direction
    
    node = {
        'iso': iso,
        'country': country,
        'lat': lat,
        'lng': lng,
        'fossil_co2_mt': round(fossil, 2) if not pd.isna(fossil) else None,
        'lulucf_co2_mt': round(lulucf, 2) if not pd.isna(lulucf) else None,
        'total_co2_mt': round(total, 2) if not pd.isna(total) else None,
        'co2_per_capita': round(per_capita, 2) if not pd.isna(per_capita) else None,
        'population': int(pop) if not pd.isna(pop) else None,
        'cat_rating': cat_rating if cat_rating else '',
        'cat_score': int(cat_score) if not pd.isna(cat_score) else 0,
        'globe_color': globe_color,
        'target_type': target_type if target_type else '',
        'reduction_pct': round(float(reduction_pct), 2) if not pd.isna(reduction_pct) else None,
        'target_year': int(float(target_year)) if not pd.isna(target_year) else None,
        'implied_target_mt': round(float(implied), 2) if not pd.isna(implied) else None,
        'reality_gap_mt': round(float(gap), 2) if not pd.isna(gap) else None,
        'momentum_cagr': round(float(momentum), 2) if not pd.isna(momentum) else None,
        'required_cagr': round(float(required_cagr), 2) if not pd.isna(required_cagr) else None,
        'divergence': round(float(divergence), 2) if not pd.isna(divergence) else None,
        'on_track': on_track if on_track else '',
        'change_since_2015': round(float(change_2015), 2) if not pd.isna(change_2015) else None,
        'finance_mitigation_bn': round(float(fin_mit), 2) if not pd.isna(fin_mit) else None,
        'finance_adaptation_bn': round(float(fin_adapt), 2) if not pd.isna(fin_adapt) else None,
        'finance_total_bn': round(float(fin_total), 2) if not pd.isna(fin_total) else None,
        'conditionality': conditionality if conditionality else '',
        'ndc_summary': ndc_summary if ndc_summary else '',
    }
    results.append(node)

output_path = '/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json'
with open(output_path, 'w') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"Saved {len(results)} countries")

# Coverage
print(f"\n=== COVERAGE ===")
for field in ['reality_gap_mt', 'implied_target_mt', 'required_cagr', 'divergence', 'on_track', 'finance_total_bn', 'ndc_summary']:
    has = sum(1 for n in results if n.get(field) is not None and n.get(field) != '')
    print(f"  {field:25s} {has:3d}/{len(results)} ({has/len(results)*100:.1f}%)")

# Top 20
print(f"\n=== TOP 20 EMITTERS ===")
sorted_n = sorted(results, key=lambda n: n.get('fossil_co2_mt') or 0, reverse=True)
for i, n in enumerate(sorted_n[:20]):
    gap = n.get('reality_gap_mt')
    gap_str = f"{gap:+.0f} Mt" if gap is not None else "N/A"
    target = f"{n.get('reduction_pct', '?')}% by {int(n.get('target_year', 0)) if n.get('target_year') else '?'}"
    on = n.get('on_track', '')
    on_str = '✓' if on == 'true' else ('✗' if on == 'false' else '-')
    print(f"  {(i+1):2d}. {n['country']:25s} {n.get('fossil_co2_mt',0):8.0f} Mt  {target:20s} gap: {gap_str:>12s} {on_str}")
