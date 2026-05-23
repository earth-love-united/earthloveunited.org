#!/usr/bin/env python3
"""
Regenerate pledge-nodes.json with improved gap calculations.
Parses baseline years from NDC summaries and uses GCB historical emissions
to compute implied targets for countries missing cw_baseline_year.
"""
import pandas as pd
import numpy as np
import json
import os
import re

DATA_DIR = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data'
RAW_DIR = os.path.join(DATA_DIR, 'raw')
PROC_DIR = os.path.join(DATA_DIR, 'processed')
OUT_DIR = os.path.join(DATA_DIR, 'output')

# Load the enriched parquet (has all yearly data)
df = pd.read_parquet(os.path.join(OUT_DIR, 'pledge_vs_reality_enriched.parquet'))
print(f"Loaded enriched data: {len(df)} records, {df['country'].nunique()} countries")

# Get 2024 data for each country
df_2024 = df[df['year'] == 2024].copy()
print(f"2024 records: {len(df_2024)}")

# Load GCB historical emissions for baseline year lookups
gcb = pd.read_csv(os.path.join(PROC_DIR, 'gcb_emissions.csv'))
print(f"GCB records: {len(gcb)}")

# Build a lookup: (country, year) -> fossil_co2_mtCO2
gcb_lookup = gcb.set_index(['country', 'year'])['fossil_co2_mtCO2'].to_dict()

# Parse baseline year from NDC summary
def parse_baseline_year(ndc_summary):
    """Extract baseline year from NDC summary text."""
    if not ndc_summary or pd.isna(ndc_summary):
        return None
    
    text = str(ndc_summary).lower()
    
    # Common patterns:
    # "below 2005 levels", "from 1990 levels", "compared to 2010"
    # "relative to 1990", "below 2005", "from the 2005 level"
    patterns = [
        r'below\s+(\d{4})\s+level',
        r'from\s+(\d{4})\s+level',
        r'compared\s+to\s+(\d{4})',
        r'relative\s+to\s+(\d{4})',
        r'from\s+the\s+(\d{4})\s+level',
        r'(\d{4})\s+level',
        r'below\s+(\d{4})',
        r'from\s+(\d{4})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            year = int(match.group(1))
            if 1990 <= year <= 2024:
                return year
    
    return None

# For each country, try to compute implied target
results = []

for _, row in df_2024.iterrows():
    country = row['country']
    iso = row.get('iso', '')
    fossil_co2 = row['fossil_co2_mtCO2']
    lulucf_co2 = row.get('lulucf_co2_mtCO2', 0) or 0
    total_co2 = row.get('total_co2_mtCO2', fossil_co2)
    co2_per_capita = row.get('co2_per_capita_t', 0) or 0
    population = row.get('population', 0) or 0
    
    # Target info
    reduction_pct = row.get('cw_reduction_pct', np.nan)
    if pd.isna(reduction_pct):
        reduction_pct = row.get('reduction_pct', np.nan)
    
    target_year = row.get('ndc_target_year', np.nan)
    if pd.isna(target_year):
        target_year = row.get('cw_target_year', np.nan)
    
    target_type = row.get('cw_target_type', '')
    conditionality = row.get('cw_conditionality', '')
    ndc_summary = row.get('ndc_summary', '')
    cat_rating = row.get('cat_rating', '')
    cat_score = row.get('cat_rating_score', 0)
    globe_color = row.get('globe_color', '#95a5a6')
    
    # Finance
    finance_mitigation = row.get('cw_mitigation_finance_bn', np.nan)
    finance_adaptation = row.get('cw_adaptation_finance_bn', np.nan)
    finance_total = row.get('cw_total_finance_bn', np.nan)
    
    # Existing computed values
    implied_target = row.get('implied_target_mtco2e', np.nan)
    reality_gap = row.get('reality_gap_mtco2e', np.nan)
    momentum_cagr = row.get('momentum_cagr_10yr_pct', np.nan)
    required_cagr = row.get('target_cagr_required_pct', np.nan)
    divergence = row.get('momentum_vs_target_divergence_pct', np.nan)
    on_track = row.get('on_track', '')
    years_to_target = row.get('years_to_target', np.nan)
    change_since_2015 = row.get('emissions_change_from_2015_pct', np.nan)
    
    # If we don't have implied_target, try to compute it
    if pd.isna(implied_target) and not pd.isna(reduction_pct) and not pd.isna(target_year):
        # Try to get baseline year from NDC summary
        baseline_year = parse_baseline_year(ndc_summary)
        
        if baseline_year:
            # Look up GCB emissions for baseline year
            baseline_emissions = gcb_lookup.get((country, baseline_year), np.nan)
            
            if not pd.isna(baseline_emissions):
                if target_type == 'base_year':
                    implied_target = baseline_emissions * (1 - reduction_pct / 100.0)
                elif target_type == 'bau':
                    # For BAU, we'd need the BAU scenario value
                    # Skip for now
                    pass
                elif target_type == 'fixed_level':
                    # Already absolute
                    cw_target_mtco2e = row.get('cw_target_mtco2e', np.nan)
                    if not pd.isna(cw_target_mtco2e):
                        implied_target = cw_target_mtco2e
    
    # Compute reality gap if we have implied target
    if pd.isna(reality_gap) and not pd.isna(implied_target):
        reality_gap = fossil_co2 - implied_target
    
    # Compute required CAGR if we have implied target
    if pd.isna(required_cagr) and not pd.isna(implied_target) and not pd.isna(target_year):
        years_left = int(target_year) - 2024
        if years_left > 0 and fossil_co2 > 0:
            required_cagr = ((implied_target / fossil_co2) ** (1/years_left) - 1) * 100
    
    # Compute divergence
    if pd.isna(divergence) and not pd.isna(required_cagr) and not pd.isna(momentum_cagr):
        divergence = momentum_cagr - required_cagr
    
    # Compute on_track
    if not on_track and not pd.isna(divergence):
        on_track = 'true' if divergence <= 0 else 'false'
    
    # Get lat/lng from the data
    lat = row.get('lat', np.nan)
    lng = row.get('lng', np.nan)
    
    node = {
        'iso': iso,
        'country': country,
        'lat': lat,
        'lng': lng,
        'fossil_co2_mt': round(fossil_co2, 2) if not pd.isna(fossil_co2) else None,
        'lulucf_co2_mt': round(lulucf_co2, 2) if not pd.isna(lulucf_co2) else None,
        'total_co2_mt': round(total_co2, 2) if not pd.isna(total_co2) else None,
        'co2_per_capita': round(co2_per_capita, 2) if not pd.isna(co2_per_capita) else None,
        'population': int(population) if not pd.isna(population) else None,
        'cat_rating': cat_rating if cat_rating else '',
        'cat_score': int(cat_score) if not pd.isna(cat_score) else 0,
        'globe_color': globe_color,
        'target_type': target_type if target_type else '',
        'reduction_pct': round(reduction_pct, 2) if not pd.isna(reduction_pct) else None,
        'target_year': int(target_year) if not pd.isna(target_year) else None,
        'implied_target_mt': round(implied_target, 2) if not pd.isna(implied_target) else None,
        'reality_gap_mt': round(reality_gap, 2) if not pd.isna(reality_gap) else None,
        'momentum_cagr': round(momentum_cagr, 2) if not pd.isna(momentum_cagr) else None,
        'required_cagr': round(required_cagr, 2) if not pd.isna(required_cagr) else None,
        'divergence': round(divergence, 2) if not pd.isna(divergence) else None,
        'on_track': on_track if on_track else '',
        'change_since_2015': round(change_since_2015, 2) if not pd.isna(change_since_2015) else None,
        'finance_mitigation_bn': round(finance_mitigation, 2) if not pd.isna(finance_mitigation) else None,
        'finance_adaptation_bn': round(finance_adaptation, 2) if not pd.isna(finance_adaptation) else None,
        'finance_total_bn': round(finance_total, 2) if not pd.isna(finance_total) else None,
        'conditionality': conditionality if conditionality else '',
        'ndc_summary': ndc_summary if ndc_summary else '',
    }
    
    results.append(node)

# Save
output_path = '/Users/ekmelozdemir/earthloveunited.org/data/pledge-nodes.json'
with open(output_path, 'w') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print(f"\nSaved {len(results)} countries to {output_path}")

# Report coverage
import json
with open(output_path) as f:
    nodes = json.load(f)

print(f"\n=== COVERAGE REPORT ===")
for field in ['reality_gap_mt', 'implied_target_mt', 'required_cagr', 'divergence', 'on_track', 'finance_total_bn']:
    has = sum(1 for n in nodes if n.get(field) is not None and n.get(field) != '')
    pct = has / len(nodes) * 100
    print(f"  {field:25s} {has:3d}/{len(nodes)} ({pct:.1f}%)")

# Show top 20 emitters
print(f"\n=== TOP 20 EMITTERS ===")
sorted_nodes = sorted(nodes, key=lambda n: n.get('fossil_co2_mt') or 0, reverse=True)
for i, n in enumerate(sorted_nodes[:20]):
    gap = n.get('reality_gap_mt')
    gap_str = f"{gap:+.0f} Mt" if gap is not None else "N/A"
    target = f"{n.get('reduction_pct', '?')}% by {int(n.get('target_year', 0)) if n.get('target_year') else '?'}"
    print(f"  {(i+1):2d}. {n['country']:25s} {n['fossil_co2_mt']:8.0f} MtCO₂  target: {target:20s} gap: {gap_str}")
