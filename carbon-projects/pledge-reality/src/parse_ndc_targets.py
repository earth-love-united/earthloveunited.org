#!/usr/bin/env python3
"""
Parse structured NDC target data from Climate Watch indicator text.

Takes the raw ghg_target text like:
  "13.6% reduction in GHG emissions by 2030 compared to BAU"
  "26-28% below 2005 levels by 2025"
  "Net zero by 2050, 43% reduction by 2030 vs 2005"

And extracts:
  - reduction_pct (float)
  - reduction_pct_upper (float, if range)
  - baseline_year (int)
  - target_year (int)
  - target_mtco2e (float, if absolute target stated)
  - target_type (base_year / bau / intensity / fixed_level / net_zero)
  - is_conditional (bool)
  - is_unconditional (bool)
"""
import re
import json
import os
import pandas as pd
import numpy as np

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PLEDGE_DIR = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(PLEDGE_DIR, 'data', 'raw')
PROC_DIR = os.path.join(PLEDGE_DIR, 'data', 'processed')


def clean_html(text):
    """Strip HTML tags from CW values."""
    if not text:
        return ''
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'&[a-z]+;', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def extract_reduction_pct(text):
    """Extract reduction percentage from target text."""
    if not text:
        return None, None

    text = clean_html(text)

    # Range: "26-28%" or "26% to 28%"
    m = re.search(r'(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*%', text)
    if m:
        return float(m.group(1)), float(m.group(2))

    # Single: "reduce by X%" or "X% reduction" or "X% below"
    patterns = [
        r'(\d+(?:\.\d+)?)\s*%\s*(?:reduction|below|decrease|cut|less|lower|beneath)',
        r'(?:reduce|cut|decrease|lower)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*%',
        r'(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:BAU|baseline|base\s*year|business)',
        r'(\d+(?:\.\d+)?)\s*%',  # fallback: any percentage
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            pct = float(m.group(1))
            if pct > 0 and pct < 100:
                return pct, None

    return None, None


def extract_baseline_year(text):
    """Extract baseline/reference year."""
    if not text:
        return None

    text = clean_html(text)

    # "below YEAR levels" or "compared to FY 2005"
    patterns = [
        r'(?:below|compared\s+to|relative\s+to|vs\.?|against|from|based\s+on)\s+(?:FY\s*)?(\d{4})',
        r'(?:FY\s*)?(\d{4})\s+(?:levels?|baseline|base\s*year|emissions?)',
        r'base\s*(?:line\s+)?year[:\s]+(?:FY\s*)?(\d{4})',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            year = int(m.group(1))
            if 1990 <= year <= 2020:
                return year

    return None


def extract_target_year(text):
    """Extract target year from text."""
    if not text:
        return None

    text = clean_html(text)

    # "by YEAR" or "in YEAR" or "YEAR target"
    patterns = [
        r'by\s+(\d{4})',
        r'(?:by|in|for)\s+(?:the\s+year\s+)?(\d{4})',
        r'(\d{4})\s+target',
    ]
    for pat in patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            year = int(m.group(1))
            if 2025 <= year <= 2060:
                return year

    return None


def extract_target_mtco2e(text):
    """Extract absolute MtCO2e target if stated."""
    if not text:
        return None

    text = clean_html(text).replace('₂', '2')

    # 1. Billion (Gt) e.g. "1.042 billion t-CO2eq"
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:billion\s+t(?:onn?es?)?[- ]*CO2|Gt[- ]*CO2)', text, re.IGNORECASE)
    if m: return float(m.group(1).replace(',', '')) * 1000
    
    # 2. Million (Mt) e.g. "45 MtCO2e", "45 million tonnes of CO2"
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:million\s+t(?:onn?es?)?(?:\s+of)?\s*CO2|Mt[- ]*CO2)', text, re.IGNORECASE)
    if m: return float(m.group(1).replace(',', ''))
    
    # 3. Kilo (kt) e.g. "640 ktCO2e"
    m = re.search(r'(\d+(?:[.,]\d+)?)\s*(?:kt[- ]*CO2)', text, re.IGNORECASE)
    if m: return float(m.group(1).replace(',', '')) / 1000
    
    # 4. Raw tonnes (with comma) e.g. "1,700,000 tCO2e"
    m = re.search(r'(\d{1,3}(?:,\d{3})+)\s*(?:t[- ]*CO2)', text, re.IGNORECASE)
    if m: return float(m.group(1).replace(',', '')) / 1000000
    
    # 5. Raw tonnes (no comma) e.g. "1700000 tCO2e"
    m = re.search(r'(\d{5,})\s*(?:t[- ]*CO2)', text, re.IGNORECASE)
    if m: return float(m.group(1)) / 1000000

    return None


def classify_target_type(ghg_target_type_raw, ghg_target_text):
    """Classify the NDC target type."""
    if not ghg_target_type_raw and not ghg_target_text:
        return 'unknown'

    combined = f"{ghg_target_type_raw or ''} {ghg_target_text or ''}".lower()

    if 'base year' in combined or 'base_year' in combined:
        return 'base_year'
    if 'baseline' in combined or 'bau' in combined or 'business as usual' in combined:
        return 'bau'
    if 'intensity' in combined:
        return 'intensity'
    if 'fixed level' in combined or 'fixed_level' in combined:
        return 'fixed_level'
    if 'trajectory' in combined:
        return 'trajectory'
    if 'net zero' in combined or 'net-zero' in combined or 'carbon neutral' in combined:
        return 'net_zero'

    return 'other'


def parse_conditionality(cond_raw):
    """Parse conditionality field."""
    if not cond_raw:
        return False, False

    cond = cond_raw.lower()
    is_conditional = 'conditional' in cond
    is_unconditional = 'unconditional' in cond

    # "Both" or "Conditional and unconditional"
    if 'both' in cond or ('conditional' in cond and 'unconditional' in cond):
        return True, True

    if 'unconditional' in cond:
        return False, True

    if 'conditional' in cond:
        return True, False

    return False, False


def parse_finance(text):
    """Parse absolute financial requirements (USD Billions)."""
    if not text or "No " in text or "Not Specified" in text:
        return None
    try:
        # Extract the first float found
        m = re.search(r'(\d+(?:\.\d+)?)', text.replace(',', ''))
        if m:
            return float(m.group(1))
    except Exception:
        pass
    return None


def process_all():
    """Load CW indicator data and parse NDC targets into structured CSV."""
    # Load harvested data
    raw_path = os.path.join(RAW_DIR, 'cw_ndc_indicators.json')
    if not os.path.exists(raw_path):
        print(f"ERROR: {raw_path} not found. Run harvest_cw_indicators.py first.")
        return None

    with open(raw_path) as f:
        raw = json.load(f)

    country_data = raw.get('data', {})
    print(f"Loaded {len(country_data)} countries from CW indicators")

    # Parse each country
    rows = []
    for iso, cd in country_data.items():
        ghg_target = cd.get('ghg_target', '')
        ghg_target_type = cd.get('ghg_target_type', '')
        time_target_year = cd.get('time_target_year', '')
        conditionality = cd.get('conditionality', '')
        summary = cd.get('indc_summary', '')
        contribution_type = cd.get('mitigation_contribution_type', '')

        # Parse reduction percentage
        reduction_pct, reduction_pct_upper = extract_reduction_pct(ghg_target)

        # Parse baseline year
        baseline_year = extract_baseline_year(ghg_target)

        # Parse target year — prefer the structured field, fallback to text
        target_year = None
        if time_target_year and time_target_year not in ('Not Specified', ''):
            try:
                # Extract first 4-digit sequence that looks like a valid year
                for m in __import__('re').finditer(r'\d{4}', str(time_target_year)):
                    candidate = int(m.group())
                    if 2020 <= candidate <= 2060:
                        target_year = candidate
                        break
            except (ValueError, AttributeError):
                pass
        if not target_year:
            target_year = extract_target_year(ghg_target)
        if not target_year:
            target_year = extract_target_year(summary)

        # Parse absolute MtCO2e target
        target_mtco2e = extract_target_mtco2e(ghg_target)

        # Classify target type
        target_type = classify_target_type(ghg_target_type, ghg_target)

        # Parse conditionality
        is_conditional, is_unconditional = parse_conditionality(conditionality)

        # Determine if we have usable pledge data
        has_ghg_target = bool(ghg_target and ghg_target != 'Not Specified')
        has_quantified_target = reduction_pct is not None or target_mtco2e is not None

        rows.append({
            'iso_code': iso,
            'country_cw': cd.get('country', ''),
            'cw_ghg_target': clean_html(ghg_target)[:500],
            'cw_ghg_target_type': ghg_target_type,
            'cw_target_year': target_year,
            'cw_baseline_year': baseline_year,
            'cw_reduction_pct': reduction_pct,
            'cw_reduction_pct_upper': reduction_pct_upper,
            'cw_target_mtco2e': target_mtco2e,
            'cw_target_type': target_type,
            'cw_is_conditional': is_conditional,
            'cw_is_unconditional': is_unconditional,
            'cw_conditionality': conditionality,
            'cw_contribution_type': contribution_type,
            'cw_summary': clean_html(summary)[:500],
            'cw_has_ghg_target': has_ghg_target,
            'cw_has_quantified_target': has_quantified_target,
            'cw_submission_type': cd.get('submission_type', ''),
            'cw_submission_date': cd.get('submission_date', ''),
            'cw_pa_ratified': cd.get('pa_ratified', ''),
            'cw_pa_status': cd.get('pa_status', ''),
            'cw_mitigation_finance_bn': parse_finance(cd.get('mitigation_total_financial_requirements', '')),
            'cw_adaptation_finance_bn': parse_finance(cd.get('adaptation_total_financial_requirements', '')),
            'cw_total_finance_bn': parse_finance(cd.get('identified_total_financial_requirements', '')),
        })

    df = pd.DataFrame(rows)

    # Sort
    df = df.sort_values('iso_code').reset_index(drop=True)

    # Save
    os.makedirs(PROC_DIR, exist_ok=True)
    out_path = os.path.join(PROC_DIR, 'cw_ndc_parsed.csv')
    df.to_csv(out_path, index=False)

    # Stats
    print(f"\n{'='*60}")
    print(f"Parsed NDC targets for {len(df)} countries")
    print(f"  With GHG target text:     {df['cw_has_ghg_target'].sum()}")
    print(f"  With quantified target:   {df['cw_has_quantified_target'].sum()}")
    print(f"  With target year:         {df['cw_target_year'].notna().sum()}")
    print(f"  With baseline year:       {df['cw_baseline_year'].notna().sum()}")
    print(f"  With reduction %:         {df['cw_reduction_pct'].notna().sum()}")
    print(f"  With absolute MtCO2e:     {df['cw_target_mtco2e'].notna().sum()}")
    print(f"\nTarget type distribution:")
    print(df['cw_target_type'].value_counts().to_string())
    print(f"\nConditionality:")
    print(f"  Conditional:    {df['cw_is_conditional'].sum()}")
    print(f"  Unconditional:  {df['cw_is_unconditional'].sum()}")
    print(f"\nSaved to: {out_path}")

    # Sample
    print(f"\n=== Sample ===")
    sample_cols = ['iso_code', 'cw_target_year', 'cw_reduction_pct',
                   'cw_target_type', 'cw_conditionality']
    sample_isos = ['USA', 'CHN', 'IND', 'BRA', 'DEU', 'NGA', 'KEN',
                   'FJI', 'GBR', 'JPN', 'ZAF', 'MEX', 'IDN', 'EGY']
    sample = df[df['iso_code'].isin(sample_isos)][sample_cols]
    print(sample.to_string(index=False))

    return df


if __name__ == '__main__':
    process_all()
