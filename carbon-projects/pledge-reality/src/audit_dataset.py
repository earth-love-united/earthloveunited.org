#!/usr/bin/env python3
"""
Comprehensive audit of the pledge_vs_reality_enriched dataset.
Checks: schema, duplicates, NaN coverage, mathematical correctness,
normalization traps, join integrity, and known-value spot checks.
"""
import pandas as pd
import numpy as np
import os, sys

OUT = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/output/pledge_vs_reality_enriched.parquet'

PASS = 0
FAIL = 0
WARN = 0

def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✅ {name}")
    else:
        FAIL += 1
        print(f"  ❌ {name}" + (f" — {detail}" if detail else ""))

def warn(name, detail=""):
    global WARN
    WARN += 1
    print(f"  ⚠️  {name}" + (f" — {detail}" if detail else ""))

df = pd.read_parquet(OUT)
print(f"Loaded {len(df)} rows × {len(df.columns)} columns\n")

# ═══════════════════════════════════════════════════════
print("═" * 60)
print("1. STRUCTURAL INTEGRITY")
print("═" * 60)

n_countries = df['country'].nunique()
check("Country count == 212", n_countries == 212, f"got {n_countries}")

years = sorted(df['year'].unique())
expected_years = [1990, 2000, 2005] + list(range(2015, 2025))
check("Year range includes historical + 2015-2024", set(expected_years).issubset(set(years)), f"got {years}")

# Duplicate check
dupes = df.duplicated(subset=['country', 'year']).sum()
check("No duplicate (country, year) pairs", dupes == 0, f"{dupes} duplicates found")

# Check for empty-string countries or NaN countries
bad_countries = df[df['country'].isna() | (df['country'] == '')].shape[0]
check("No empty/NaN country names", bad_countries == 0, f"{bad_countries} bad rows")

# Check year dtype
check("Year is integer-like", df['year'].dtype in [np.int64, np.int32, np.float64], f"dtype={df['year'].dtype}")

# ═══════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print("2. COVERAGE AUDIT (2024 slice)")
print("═" * 60)

df24 = df[df['year'] == 2024]
n24 = len(df24)
check("2024 has 212 records", n24 == 212, f"got {n24}")

def coverage(col, label):
    if col not in df24.columns:
        warn(f"{label}: column '{col}' missing")
        return
    valid = df24[col].notna()
    if df24[col].dtype == object:
        valid = valid & (df24[col] != '') & (df24[col] != 'unknown')
    n = valid.sum()
    pct = n / n24 * 100
    status = "✅" if pct >= 50 else ("⚠️ " if pct >= 20 else "❌")
    print(f"  {status} {label}: {n}/{n24} ({pct:.1f}%)")

coverage('fossil_co2_mtCO2', 'Fossil CO2')
coverage('lulucf_co2_mtCO2', 'LULUCF CO2')
coverage('total_co2_mtCO2', 'Total CO2 (Fossil+LULUCF)')
coverage('population', 'Population')
coverage('co2_per_capita_t', 'CO2 per capita')
coverage('iso_code', 'ISO code')
coverage('ndc_target_year', 'NDC target year')
coverage('cw_reduction_pct', 'CW reduction %')
coverage('cw_target_type', 'CW target type')
coverage('implied_target_mtco2e', 'Implied target MtCO2e')
coverage('reality_gap_mtco2e', 'Reality gap MtCO2e')
coverage('momentum_cagr_10yr_pct', 'Momentum CAGR 10yr')
coverage('target_cagr_required_pct', 'Target CAGR required')
coverage('cat_overall_rating', 'CAT rating')
coverage('cw_mitigation_finance_bn', 'Mitigation finance')
coverage('cw_total_finance_bn', 'Total finance')

# ═══════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print("3. MATHEMATICAL CORRECTNESS — SPOT CHECKS")
print("═" * 60)

def spot(country, year, col, expected, tol=0.5):
    row = df[(df['country'] == country) & (df['year'] == year)]
    if row.empty:
        warn(f"{country} {year}: row not found")
        return
    actual = row[col].values[0]
    if pd.isna(actual):
        check(f"{country} {year} {col} ≈ {expected}", False, f"got NaN")
        return
    check(f"{country} {year} {col} ≈ {expected}", abs(actual - expected) < tol, f"got {actual:.3f}")

# Known fossil CO2 values (GCB 2025)
spot('China', 2024, 'fossil_co2_mtCO2', 12289.037, tol=1)
spot('United States', 2024, 'fossil_co2_mtCO2', 4904.120, tol=1)
spot('India', 2024, 'fossil_co2_mtCO2', 3193.478, tol=1)

# Per capita sanity (Saudi Arabia ~19.6, India ~2.2)
spot('Saudi Arabia', 2024, 'co2_per_capita_t', 19.61, tol=1)
spot('India', 2024, 'co2_per_capita_t', 2.20, tol=0.5)

# MtCO2 conversion factor: mtC * 3.664 = mtCO2
sample = df[(df['country'] == 'Germany') & (df['year'] == 2024)]
if not sample.empty:
    mtc = sample['fossil_co2_mtC'].values[0]
    mtco2 = sample['fossil_co2_mtCO2'].values[0]
    ratio = mtco2 / mtc if mtc > 0 else 0
    check(f"Germany 2024 MtCO2/MtC ratio ≈ 3.664", abs(ratio - 3.664) < 0.01, f"got {ratio:.4f}")

# USA reality gap math
usa24 = df[(df['country'] == 'United States') & (df['year'] == 2024)]
if not usa24.empty:
    implied = usa24['implied_target_mtco2e'].values[0]
    actual = usa24['fossil_co2_mtCO2'].values[0]
    gap = usa24['reality_gap_mtco2e'].values[0]
    if pd.notna(implied) and pd.notna(gap):
        check(f"USA reality_gap = actual - implied", abs(gap - (actual - implied)) < 0.01, 
              f"gap={gap:.2f}, actual-implied={actual-implied:.2f}")
    else:
        warn("USA reality gap: implied or gap is NaN")

# ═══════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print("4. NORMALIZATION TRAPS")
print("═" * 60)

# Check for countries that appear with multiple names
country_counts = df.groupby('country')['year'].count()
overcounted = country_counts[country_counts > 19]  # max 19 years (1990,2000,2005,2006,2008,2010,2012,2013,2014,2015-2024)
if len(overcounted) > 0:
    check("No country has more rows than expected years", False,
          f"{len(overcounted)} countries overcounted: {overcounted.index.tolist()[:5]}")
else:
    check("No country has more rows than expected years", True)

# Check for "USA" vs "United States" duplication
usa_variants = [c for c in df['country'].unique() if 'united states' in c.lower() or c == 'USA']
check("No USA/United States duplication", len(usa_variants) <= 1, f"found: {usa_variants}")

# Check for Turkey/Türkiye duplication
turkey_variants = [c for c in df['country'].unique() if c in ('Turkey', 'Türkiye')]
check("No Turkey/Türkiye duplication", len(turkey_variants) <= 1, f"found: {turkey_variants}")

# Check for Vietnam variants
vn_variants = [c for c in df['country'].unique() if 'viet' in c.lower() or 'vietnam' in c.lower()]
check("No Vietnam/Viet Nam duplication", len(vn_variants) <= 1, f"found: {vn_variants}")

# iso_code uniqueness per country
iso_per_country = df.dropna(subset=['iso_code']).groupby('country')['iso_code'].nunique()
multi_iso = iso_per_country[iso_per_country > 1]
check("Each country maps to exactly 1 ISO code", len(multi_iso) == 0,
      f"{len(multi_iso)} countries with multiple ISOs: {multi_iso.to_dict()}")

# ═══════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print("5. JOIN INTEGRITY")
print("═" * 60)

# Check that CW merge didn't explode rows
check("CW merge preserved row count (4021)", len(df) == 4021, f"got {len(df)}")

# Check ISO coverage
iso_coverage = df[df['year']==2024]['iso_code'].notna().sum()
check("ISO code coverage >= 200/212 in 2024", iso_coverage >= 200, f"got {iso_coverage}/212")

# Check that WB population merge worked
pop_coverage = df[(df['year']==2024) & (df['population'] > 0)].shape[0]
check("Population coverage >= 180/212 in 2024", pop_coverage >= 180, f"got {pop_coverage}/212")

# Check LULUCF merge
lulucf_coverage = df[(df['year']==2024) & df['lulucf_co2_mtCO2'].notna()].shape[0]
check("LULUCF coverage >= 150/212 in 2024", lulucf_coverage >= 150, f"got {lulucf_coverage}/212")

# ═══════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print("6. EDGE CASE CHECKS")
print("═" * 60)

# Negative fossil CO2 should not exist
neg_fossil = (df['fossil_co2_mtCO2'] < 0).sum()
check("No negative fossil CO2 values", neg_fossil == 0, f"{neg_fossil} negative values")

# Per capita sanity: should be 0-100 range for all
if 'co2_per_capita_t' in df.columns:
    pc = df[df['co2_per_capita_t'] > 0]['co2_per_capita_t']
    check("Per capita in sane range (0, 100)", pc.max() < 100 and pc.min() > 0, 
          f"range [{pc.min():.2f}, {pc.max():.2f}]")

# Reality gap should be NaN where implied_target is NaN
gap_without_target = df[df['implied_target_mtco2e'].isna() & df['reality_gap_mtco2e'].notna()].shape[0]
check("No reality gap without implied target", gap_without_target == 0, f"{gap_without_target} orphan gaps")

# CAGR sanity: should be in (-20, +20) range
if 'momentum_cagr_10yr_pct' in df.columns:
    cagr = df['momentum_cagr_10yr_pct'].dropna()
    check("Momentum CAGR in sane range (-20%, +20%)", cagr.min() > -20 and cagr.max() < 20,
          f"range [{cagr.min():.2f}%, {cagr.max():.2f}%]")

# Target year sanity
if 'ndc_target_year' in df.columns:
    ty = df['ndc_target_year'].dropna()
    check("Target years in sane range (2020-2060)", ty.min() >= 2020 and ty.max() <= 2060,
          f"range [{ty.min():.0f}, {ty.max():.0f}]")

# ═══════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print("7. PARQUET TYPE SAFETY")
print("═" * 60)

bool_cols = [c for c in df.columns if df[c].dtype == 'boolean' or df[c].dtype == bool]
obj_cols = df.select_dtypes(include=['object']).columns.tolist()
float_cols = df.select_dtypes(include=['float64']).columns.tolist()
int_cols = df.select_dtypes(include=['int64']).columns.tolist()

print(f"  Boolean columns ({len(bool_cols)}): {bool_cols}")
print(f"  Object/string columns ({len(obj_cols)}): {obj_cols[:10]}{'...' if len(obj_cols) > 10 else ''}")
print(f"  Float columns ({len(float_cols)}): {len(float_cols)}")
print(f"  Int columns ({len(int_cols)}): {len(int_cols)}")

# Check no mixed types in object columns
for col in obj_cols:
    types = df[col].dropna().apply(type).unique()
    if len(types) > 1:
        check(f"Column '{col}' has uniform type", False, f"mixed types: {types}")

# ═══════════════════════════════════════════════════════
print(f"\n{'═' * 60}")
print("AUDIT SUMMARY")
print("═" * 60)
print(f"  ✅ PASSED: {PASS}")
print(f"  ❌ FAILED: {FAIL}")
print(f"  ⚠️  WARNINGS: {WARN}")
print(f"  GRADE: {'S-TIER 🏆' if FAIL == 0 else 'NEEDS FIXES 🔧'}")
