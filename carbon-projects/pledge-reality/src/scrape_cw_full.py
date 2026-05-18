#!/usr/bin/env python3
"""
Paginate through ALL Climate Watch NDC content data.
Each country has ~366 indicators, API returns 500 records per page.
We need to iterate through all pages and collect per-country data.
"""
import requests
import json
import time
import os

OUTPUT = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/raw/cw_ndc_full.json'
BASE_URL = "https://www.climatewatchdata.org/api/v1/data/ndc_content"

def fetch_all():
    all_records = []
    page = 1
    max_pages = 200  # Safety limit
    
    while page <= max_pages:
        print(f"Fetching page {page}...", end=' ', flush=True)
        resp = requests.get(
            BASE_URL,
            params={'per_page': 500, 'page': page},
            headers={'User-Agent': 'Mozilla/5.0'},
            timeout=30
        )
        
        if resp.status_code != 200:
            print(f"ERROR {resp.status_code}")
            break
        
        data = resp.json()
        records = data.get('data', [])
        
        if not records:
            print("No more data")
            break
        
        all_records.extend(records)
        
        countries = set(r.get('country', '') for r in records)
        print(f"{len(records)} records, countries: {list(countries)[:3]}")
        
        # Check if we've wrapped around to Afghanistan again
        if page > 1 and any(r.get('country') == 'Afghanistan' for r in records):
            # We've gone through all countries
            print("Wrapped around to Afghanistan — done!")
            break
        
        page += 1
        time.sleep(0.3)  # Be polite
    
    # Save
    with open(OUTPUT, 'w') as f:
        json.dump({'data': all_records, 'meta': {'total_records': len(all_records), 'pages': page}}, f)
    
    # Summary
    countries = set(r.get('country', '') for r in all_records)
    indicators = set(r.get('indicator_id', '') for r in all_records)
    
    print(f"\n=== Complete ===")
    print(f"Total records: {len(all_records)}")
    print(f"Countries: {len(countries)}")
    print(f"Indicators: {len(indicators)}")
    print(f"Pages: {page}")
    print(f"Saved to: {OUTPUT}")
    
    return all_records

if __name__ == '__main__':
    fetch_all()
