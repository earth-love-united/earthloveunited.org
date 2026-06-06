#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Fetch ALL CAT country-emissions data from the data portal API.
7926 records across 41 regions, including NDC targets, current policy projections,
fair share boundaries, and modelled domestic pathways.
"""
import requests
import json
import time
import os

OUTPUT = 'carbon-projects/pledge-reality/data/raw/cat_emissions_full.json'
BASE_URL = "https://climateactiontracker.org/data-portal/api/country-emissions/records/"

def fetch_all():
    all_records = []
    url = BASE_URL
    page = 1
    
    while url:
        print(f"Fetching page {page}...", end=' ', flush=True)
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=30)
        
        if resp.status_code != 200:
            print(f"ERROR {resp.status_code}")
            break
        
        data = resp.json()
        records = data.get('results', [])
        all_records.extend(records)
        
        print(f"{len(records)} records (total: {len(all_records)}/{data.get('count', '?')})")
        
        url = data.get('next')
        page += 1
        time.sleep(0.3)
    
    return all_records

def process(records):
    """Extract key metrics per country"""
    print(f"\nProcessing {len(records)} records...")
    
    # Group by region (country ISO3 code)
    country_data = {}
    
    for r in records:
        region = r.get('region', '')
        if not region or len(region) != 3:
            continue
        
        if region not in country_data:
            country_data[region] = {
                'iso_code': region,
                'ndc_conditional_max': {},
                'ndc_conditional_min': {},
                'current_policy_max': {},
                'current_policy_min': {},
                'historical': {},
                'fair_share_15c': {},
                'fair_share_insufficient': {},
                'modelled_domestic_15c': {},
                'modelled_domestic_insufficient': {},
            }
        
        cd = country_data[region]
        year = r.get('year')
        value = r.get('value')
        variable = r.get('variable', '')
        scenario = r.get('scenario', '')
        
        if value is None or year is None:
            continue
        
        # Categorize by variable
        if 'conditional_ndc__max' in variable:
            cd['ndc_conditional_max'][year] = value
        elif 'conditional_ndc__min' in variable:
            cd['ndc_conditional_min'][year] = value
        elif 'current_policy__max' in variable:
            cd['current_policy_max'][year] = value
        elif 'current_policy__min' in variable:
            cd['current_policy_min'][year] = value
        elif variable == 'historic':
            cd['historical'][year] = value
        elif 'fair_share__15c' in variable:
            cd['fair_share_15c'][year] = value
        elif 'fair_share__insufficient' in variable:
            cd['fair_share_insufficient'][year] = value
        elif 'modelled_domestic_pathways__15c' in variable:
            cd['modelled_domestic_15c'][year] = value
        elif 'modelled_domestic_pathways__insufficient' in variable:
            cd['modelled_domestic_insufficient'][year] = value
    
    return country_data

def main():
    records = fetch_all()
    
    # Save raw
    with open(OUTPUT, 'w') as f:
        json.dump({'count': len(records), 'data': records}, f)
    print(f"\nSaved {len(records)} raw records to {OUTPUT}")
    
    # Process
    country_data = process(records)
    
    # Save processed
    processed_path = OUTPUT.replace('.json', '_processed.json')
    with open(processed_path, 'w') as f:
        json.dump(country_data, f, indent=2)
    
    print(f"\n=== Summary ===")
    print(f"Countries: {len(country_data)}")
    
    # Count countries with NDC data
    has_ndc = sum(1 for cd in country_data.values() if cd['ndc_conditional_max'] or cd['ndc_conditional_min'])
    has_hist = sum(1 for cd in country_data.values() if cd['historical'])
    has_fair = sum(1 for cd in country_data.values() if cd['fair_share_15c'])
    
    print(f"Countries with NDC targets: {has_ndc}")
    print(f"Countries with historical data: {has_hist}")
    print(f"Countries with fair share data: {has_fair}")
    
    # Sample
    print(f"\n=== Sample: NDC targets ===")
    for iso, cd in list(country_data.items())[:5]:
        ndc_max_2030 = cd['ndc_conditional_max'].get(2030, cd['ndc_conditional_max'].get(2025, '?'))
        ndc_min_2030 = cd['ndc_conditional_min'].get(2030, cd['ndc_conditional_min'].get(2025, '?'))
        hist_2020 = cd['historical'].get(2020, cd['historical'].get(2019, '?'))
        print(f"  {iso}: NDC 2030 max={ndc_max_2030}, min={ndc_min_2030}, hist 2020={hist_2020}")

if __name__ == '__main__':
    main()
