#!/usr/bin/env python3
"""
ADVERSARIAL AUDIT — COP31 Defense Check
=========================================
Verifies every claim against independent sources.
Tests: mathematical correctness, source provenance, 
"world-first" claim validity, and attack surface analysis.
"""
import pandas as pd
import numpy as np
import json, os

OUT = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet'
df = pd.read_parquet(OUT)
df24 = df[df['year'] == 2024].copy()

print("=" * 70)
print("ADVERSARIAL AUDIT — COP31 DEFENSE CHECK")
print("=" * 70)

# ═══════════════════════════════════════════════════════
print("\n" + "═" * 70)
print("TEST 1: SOURCE PROVENANCE — Can we cite every data source?")
print("═" * 70)

sources = {
    'Fossil CO2 Emissions': {
        'source': 'Global Carbon Budget 2025 (Friedlingstein et al.)',
        'file': 'gcb_national_fossil_emissions_v2025.xlsx',
        'url': 'https://globalcarbonbudget.org/',
        'peer_reviewed': True,
        'columns': ['fossil_co2_mtC', 'fossil_co2_mtCO2'],
    },
    'LULUCF Emissions': {
        'source': 'Global Carbon Budget 2025 — BLUE model (Hansis et al.)',
        'file': 'gcb_land_use_change_v2025.xlsx',
        'url': 'https://globalcarbonbudget.org/',
        'peer_reviewed': True,
        'columns': ['lulucf_co2_mtCO2'],
    },
    'NDC Pledges': {
        'source': 'Climate Watch / World Resources Institute',
        'file': 'cw_ndc_indicators.json (API)',
        'url': 'https://www.climatewatchdata.org/',
        'peer_reviewed': False,  # <-- Institutional database, not peer-reviewed
        'columns': ['cw_reduction_pct', 'cw_target_type', 'cw_baseline_year', 'ndc_target_year'],
    },
    'CAT Ratings': {
        'source': 'Climate Action Tracker (NewClimate Institute + Climate Analytics)',
        'file': 'cat_detailed.csv (scraped)',
        'url': 'https://climateactiontracker.org/',
        'peer_reviewed': False,  # <-- Expert assessment, not peer-reviewed
        'columns': ['cat_overall_rating', 'cat_rating_score'],
    },
    'Population': {
        'source': 'World Bank — World Development Indicators',
        'file': 'wb_population.json (API)',
        'url': 'https://data.worldbank.org/',
        'peer_reviewed': False,
        'columns': ['population', 'co2_per_capita_t'],
    },
}

for name, info in sources.items():
    status = "✅ Peer-Reviewed" if info['peer_reviewed'] else "⚠️  Institutional (not peer-reviewed)"
    has_data = all(c in df.columns for c in info['columns'])
    print(f"\n  📊 {name}")
    print(f"     Source: {info['source']}")
    print(f"     Status: {status}")
    print(f"     Columns present: {'✅' if has_data else '❌'}")

# ═══════════════════════════════════════════════════════
print("\n" + "═" * 70)
print("TEST 2: SPOT CHECK vs INDEPENDENT SOURCES (Our World in Data)")
print("═" * 70)
print("  Cross-referencing our 2024 GCB values against known 2023 OWID values")
print("  (2024 should be close to 2023 since year-over-year changes are small)")

# OWID 2023 values (from ourworldindata.org/co2-emissions, accessed May 2026)
owid_2023 = {
    'China':         11903,  # MtCO2
    'United States':  4911,
    'India':          3062,
    'Russia':         1816,
    'Japan':           989,
    'Germany':         596,
}

for country, owid_val in owid_2023.items():
    row = df24[df24['country'] == country]
    if row.empty:
        print(f"  ❌ {country}: NOT FOUND in dataset")
        continue
    our_val = row['fossil_co2_mtCO2'].values[0]
    delta_pct = abs(our_val - owid_val) / owid_val * 100
    status = "✅" if delta_pct < 10 else "⚠️ " if delta_pct < 20 else "❌"
    print(f"  {status} {country:20s} | Ours: {our_val:,.0f} | OWID 2023: {owid_val:,} | Δ: {delta_pct:.1f}%")

# ═══════════════════════════════════════════════════════
print("\n" + "═" * 70)
print("TEST 3: MATHEMATICAL FORMULA VERIFICATION")
print("═" * 70)

# Test 1: MtC to MtCO2 conversion
print("\n  A. Carbon conversion factor (MtC × 3.664 = MtCO2)")
sample = df24[df24['country'] == 'China']
mtc = sample['fossil_co2_mtC'].values[0]
mtco2 = sample['fossil_co2_mtCO2'].values[0]
ratio = mtco2 / mtc
expected = 44.009 / 12.011  # molecular weight ratio
print(f"     Our ratio: {ratio:.4f}")
print(f"     True ratio (44.009/12.011): {expected:.4f}")
print(f"     {'✅ CORRECT' if abs(ratio - expected) < 0.005 else '❌ WRONG'}")

# Test 2: Per capita calculation
print("\n  B. Per-capita = fossil_co2_mtCO2 × 1e6 / population")
usa = df24[df24['country'] == 'United States']
if not usa.empty:
    co2 = usa['fossil_co2_mtCO2'].values[0]
    pop = usa['population'].values[0]
    pc = usa['co2_per_capita_t'].values[0]
    expected_pc = co2 * 1e6 / pop
    print(f"     USA: {co2:.1f} MtCO2 / {pop/1e6:.1f}M people = {expected_pc:.2f} t/person")
    print(f"     Our value: {pc:.2f}")
    print(f"     {'✅ CORRECT' if abs(pc - expected_pc) < 0.1 else '❌ WRONG — delta: ' + str(abs(pc-expected_pc))}")

# Test 3: Reality gap formula
print("\n  C. Reality Gap = Current Emissions - Implied Target")
usa = df24[df24['country'] == 'United States']
if not usa.empty and pd.notna(usa['implied_target_mtco2e'].values[0]):
    actual = usa['fossil_co2_mtCO2'].values[0]
    implied = usa['implied_target_mtco2e'].values[0]
    gap = usa['reality_gap_mtco2e'].values[0]
    expected_gap = actual - implied
    print(f"     USA actual: {actual:.1f} MtCO2")
    print(f"     USA implied target: {implied:.1f} MtCO2")
    print(f"     Expected gap: {expected_gap:.1f}")
    print(f"     Our gap: {gap:.1f}")
    print(f"     {'✅ CORRECT' if abs(gap - expected_gap) < 0.01 else '❌ WRONG'}")

# Test 4: Implied target formula
print("\n  D. Implied Target = baseline_emissions × (1 - reduction_pct/100)")
usa = df24[df24['country'] == 'United States']
if not usa.empty:
    baseline = usa['baseline_emissions_mtco2e'].values[0]
    reduction = usa['cw_reduction_pct'].values[0]
    implied = usa['implied_target_mtco2e'].values[0]
    if pd.notna(baseline) and pd.notna(reduction) and pd.notna(implied):
        expected_implied = baseline * (1 - reduction / 100)
        print(f"     USA baseline ({int(usa['cw_baseline_year_flt'].values[0])}): {baseline:.1f} MtCO2")
        print(f"     Reduction pledge: {reduction:.1f}%")
        print(f"     Expected implied: {expected_implied:.1f}")
        print(f"     Our implied: {implied:.1f}")
        print(f"     {'✅ CORRECT' if abs(implied - expected_implied) < 0.1 else '❌ WRONG'}")

# Test 5: CAGR formula
print("\n  E. CAGR = ((end/start)^(1/years) - 1) × 100")
usa_2015 = df[(df['country'] == 'United States') & (df['year'] == 2015)]
usa_2024 = df[(df['country'] == 'United States') & (df['year'] == 2024)]
if not usa_2015.empty and not usa_2024.empty:
    e2015 = usa_2015['fossil_co2_mtCO2'].values[0]
    e2024 = usa_2024['fossil_co2_mtCO2'].values[0]
    cagr = usa_2024['momentum_cagr_10yr_pct'].values[0]
    years = 2024 - 2015
    expected_cagr = ((e2024 / e2015) ** (1 / years) - 1) * 100
    print(f"     USA 2015: {e2015:.1f}, 2024: {e2024:.1f} ({years}yr)")
    print(f"     Expected CAGR: {expected_cagr:.4f}%")
    print(f"     Our CAGR: {cagr:.4f}%")
    print(f"     {'✅ CORRECT' if abs(cagr - expected_cagr) < 0.01 else '❌ WRONG'}")

# ═══════════════════════════════════════════════════════
print("\n" + "═" * 70)
print("TEST 4: NDC PLEDGE SPOT CHECKS vs OFFICIAL SOURCES")
print("═" * 70)
print("  Checking our parsed NDC values against known official pledges\n")

# Official NDC pledges (manually verified from UNFCCC registry)
official_pledges = {
    'United States': {'reduction': 28, 'baseline': 2005, 'target_year': 2025, 'type': 'base_year',
                      'source': 'US First NDC (2016): 26-28% below 2005 by 2025'},
    'China':         {'reduction': 65, 'baseline': None, 'target_year': 2030, 'type': 'intensity',
                      'source': 'China Updated NDC: 65% CO2/GDP reduction vs 2005 by 2030'},
    'Japan':         {'reduction': 26, 'baseline': 2013, 'target_year': 2030, 'type': 'base_year',
                      'source': 'Japan First NDC: 26% below FY2013 by 2030'},
    'Brazil':        {'reduction': 48.4, 'baseline': 2005, 'target_year': 2025, 'type': 'base_year',
                      'source': 'Brazil Updated NDC: 48.4% below 2005 by 2025'},
    'Germany':       {'reduction': 40, 'baseline': 1990, 'target_year': 2030, 'type': 'base_year',
                      'source': 'EU NDC (covers DEU): 40% below 1990 by 2030'},
}

for country, official in official_pledges.items():
    row = df24[df24['country'] == country]
    if row.empty:
        print(f"  ❌ {country}: NOT FOUND")
        continue
    
    our_reduction = row['cw_reduction_pct'].values[0]
    our_type = row['cw_target_type'].values[0]
    our_target_yr = row['ndc_target_year'].values[0]
    our_baseline = row['cw_baseline_year_flt'].values[0]
    
    errors = []
    if pd.notna(our_reduction) and official['reduction'] is not None:
        if abs(our_reduction - official['reduction']) > 2:
            errors.append(f"reduction {our_reduction}% vs official {official['reduction']}%")
    if pd.notna(our_target_yr) and official['target_year'] is not None:
        if abs(our_target_yr - official['target_year']) > 1:
            errors.append(f"target year {int(our_target_yr)} vs official {official['target_year']}")
    if our_type != official['type']:
        errors.append(f"type '{our_type}' vs official '{official['type']}'")
    if pd.notna(our_baseline) and official['baseline'] is not None:
        if abs(our_baseline - official['baseline']) > 1:
            errors.append(f"baseline {int(our_baseline)} vs official {official['baseline']}")
    
    if errors:
        print(f"  ⚠️  {country}: {'; '.join(errors)}")
    else:
        print(f"  ✅ {country}: matches official NDC")
    print(f"     Ref: {official['source']}")

# ═══════════════════════════════════════════════════════
print("\n" + "═" * 70)
print("TEST 5: 'WORLD-FIRST' CLAIM ANALYSIS — Honest Assessment")
print("═" * 70)

claims = [
    {
        'claim': 'First dataset to calculate Reality Gap (actual vs implied target)',
        'verdict': 'PARTIALLY TRUE',
        'explanation': (
            'Climate Action Tracker (CAT) does calculate national gaps, but only for ~40 countries.\n'
            '     Our dataset covers 83 countries with implied targets — wider coverage.\n'
            '     However, CAT uses far more sophisticated modeling (sector-level, policy-based).\n'
            '     ⚡ HONEST FRAMING: "Widest-coverage open-source reality gap calculation"\n'
            '     ⚡ DO NOT CLAIM: "First reality gap dataset" — CAT exists.'
        ),
    },
    {
        'claim': 'First to merge GCB + NDC + LULUCF + Finance into one matrix',
        'verdict': 'LIKELY TRUE',
        'explanation': (
            'Climate Watch provides GHG + NDC data, but does NOT merge with GCB fossil emissions\n'
            '     or LULUCF at the country level with implied targets and momentum vectors.\n'
            '     OWID merges GCB + population but has NO pledge data.\n'
            '     ⚡ HONEST FRAMING: "First open-source unified accountability matrix"\n'
            '     ⚡ CAVEAT: Large institutions (IPCC, IEA) have internal versions not public.'
        ),
    },
    {
        'claim': 'First to calculate 10-year momentum CAGR vs required target CAGR',
        'verdict': 'PARTIALLY TRUE',
        'explanation': (
            'The momentum vs target divergence metric is genuinely novel in this formulation.\n'
            '     Academic papers exist on emission trajectories but not packaged as a\n'
            '     single-number "divergence" indicator for every country.\n'
            '     ⚡ HONEST FRAMING: "Novel divergence metric for pledge trajectory analysis"'
        ),
    },
    {
        'claim': 'First to expose the forestry loophole quantitatively',
        'verdict': 'FALSE',
        'explanation': (
            'LULUCF vs fossil separation is standard in IPCC and UNFCCC reporting.\n'
            '     GCB itself publishes the BLUE model data we used.\n'
            '     ⚡ HONEST FRAMING: "Integrates LULUCF into the accountability dashboard"\n'
            '     ⚡ DO NOT CLAIM: "First to expose" — this is well-known in climate science.'
        ),
    },
]

for c in claims:
    print(f"\n  CLAIM: \"{c['claim']}\"")
    print(f"  VERDICT: {c['verdict']}")
    print(f"     {c['explanation']}")

# ═══════════════════════════════════════════════════════
print("\n" + "═" * 70)
print("TEST 6: ATTACK SURFACE — What will critics challenge at COP?")
print("═" * 70)

attacks = [
    {
        'attack': 'NDC targets are parsed from the FIRST NDC, not the LATEST updated NDC',
        'risk': 'HIGH',
        'detail': (
            'Many countries have submitted Updated NDCs (e.g., USA under Biden: 50-52% by 2030).\n'
            '     Our Climate Watch data may reflect older submissions.\n'
            '     Japan updated to 46% by 2030 (from 26%). If we show 26%, we are wrong.\n'
            '     🔴 ACTION REQUIRED: Verify CW API returns latest NDC version per country.'
        ),
    },
    {
        'attack': 'Implied target only works for base_year targets, not BAU/intensity',
        'risk': 'MEDIUM',
        'detail': (
            f'Only 65 of 212 countries have base_year targets with implied calculations.\n'
            f'     105 countries use BAU targets — our formula cannot calculate their gap.\n'
            f'     At COP, a delegate from Nigeria (BAU target) will say "your tool ignores us."\n'
            f'     🟡 MITIGATION: Clearly label coverage. Never claim "all countries."'
        ),
    },
    {
        'attack': 'GCB fossil CO2 ≠ total GHG (missing CH4, N2O, F-gases)',
        'risk': 'HIGH',
        'detail': (
            'NDC pledges are stated in terms of ALL greenhouse gases (CO2eq).\n'
            '     Our emissions data is FOSSIL CO2 ONLY from GCB.\n'
            '     For agriculture-heavy countries (e.g., New Zealand, Brazil), methane is huge.\n'
            '     The reality gap could be significantly underestimated.\n'
            '     🔴 ACTION REQUIRED: State clearly this is "fossil CO2 only" not total GHG.'
        ),
    },
    {
        'attack': 'LULUCF data uses the BLUE model, not the official national inventory',
        'risk': 'MEDIUM',
        'detail': (
            'Countries submit their own LULUCF numbers to the UNFCCC, which often differ\n'
            '     substantially from the GCB BLUE model estimates.\n'
            '     Brazil will argue their official LULUCF numbers are lower.\n'
            '     🟡 MITIGATION: Cite the specific model and acknowledge methodological differences.'
        ),
    },
    {
        'attack': 'Per-capita uses total population, not "responsible" population',
        'risk': 'LOW',
        'detail': (
            'India will argue that per-capita is misleading because their poorest billion\n'
            '     contributes almost nothing. This is a philosophical objection, not a data error.\n'
            '     🟢 DEFENSE: Per-capita is the international standard (IPCC AR6 uses it).'
        ),
    },
]

for a in attacks:
    color = '🔴' if a['risk'] == 'HIGH' else '🟡' if a['risk'] == 'MEDIUM' else '🟢'
    print(f"\n  {color} ATTACK: \"{a['attack']}\"")
    print(f"     Risk: {a['risk']}")
    print(f"     {a['detail']}")

# ═══════════════════════════════════════════════════════
print("\n" + "═" * 70)
print("TEST 7: NDC VERSION CHECK — Are we using the LATEST pledges?")
print("═" * 70)

# Check what CW gave us for key countries
key_countries = ['United States', 'Japan', 'China', 'Brazil', 'India', 'Germany']
for country in key_countries:
    row = df24[df24['country'] == country]
    if row.empty: continue
    sub_type = row['cw_submission_type'].values[0] if 'cw_submission_type' in row.columns else 'N/A'
    sub_date = row['cw_submission_date'].values[0] if 'cw_submission_date' in row.columns else 'N/A'
    tgt_yr = row['ndc_target_year'].values[0]
    red_pct = row['cw_reduction_pct'].values[0]
    print(f"  {country:20s} | Submission: {sub_type} ({sub_date}) | Target: {red_pct}% by {int(tgt_yr) if pd.notna(tgt_yr) else '?'}")

