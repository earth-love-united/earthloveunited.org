#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Query Climate Watch NDC content for specific countries by ISO code.
This bypasses the pagination issue.
"""
import requests
import json
import time
import os

OUTPUT = 'carbon-projects/pledge-reality/data/raw/cw_ndc_by_country.json'
BASE_URL = "https://www.climatewatchdata.org/api/v1/data/ndc_content"

# All ISO3 codes for countries in our dataset
# Start with the ones we know have NDC data
ISO_CODES = [
    'AFG', 'ALB', 'DZA', 'AND', 'AGO', 'ATG', 'ARG', 'ARM', 'AUS', 'AUT',
    'AZE', 'BHS', 'BHR', 'BGD', 'BRB', 'BLR', 'BEL', 'BLZ', 'BEN', 'BTN',
    'BOL', 'BIH', 'BWA', 'BRA', 'BRN', 'BGR', 'BFA', 'BDI', 'CPV', 'KHM',
    'CMR', 'CAN', 'CAF', 'TCD', 'CHL', 'CHN', 'COL', 'COM', 'COG', 'COD',
    'CRI', 'CIV', 'HRV', 'CUB', 'CYP', 'CZE', 'DNK', 'DJI', 'DMA', 'DOM',
    'ECU', 'EGY', 'SLV', 'GNQ', 'ERI', 'EST', 'SWZ', 'ETH', 'FJI', 'FIN',
    'FRA', 'GAB', 'GMB', 'GEO', 'DEU', 'GHA', 'GRC', 'GRD', 'GTM', 'GIN',
    'GNB', 'GUY', 'HTI', 'HND', 'HUN', 'ISL', 'IND', 'IDN', 'IRN', 'IRQ',
    'IRL', 'ISR', 'ITA', 'JAM', 'JPN', 'JOR', 'KAZ', 'KEN', 'KIR', 'PRK',
    'KOR', 'KWT', 'KGZ', 'LAO', 'LVA', 'LBN', 'LSO', 'LBR', 'LBY', 'LIE',
    'LTU', 'LUX', 'MDG', 'MWI', 'MYS', 'MDV', 'MLI', 'MLT', 'MHL', 'MRT',
    'MUS', 'MEX', 'FSM', 'MDA', 'MCO', 'MNG', 'MNE', 'MAR', 'MOZ', 'MMR',
    'NAM', 'NRU', 'NPL', 'NLD', 'NZL', 'NIC', 'NER', 'NGA', 'NOR', 'OMN',
    'PAK', 'PLW', 'PAN', 'PNG', 'PRY', 'PER', 'PHL', 'POL', 'PRT', 'QAT',
    'ROU', 'RUS', 'RWA', 'KNA', 'LCA', 'VCT', 'WSM', 'SMR', 'STP', 'SAU',
    'SEN', 'SRB', 'SYC', 'SLE', 'SGP', 'SVK', 'SVN', 'SLB', 'SOM', 'ZAF',
    'SSD', 'ESP', 'LKA', 'SDN', 'SUR', 'SWE', 'CHE', 'SYR', 'TJK', 'TZA',
    'THA', 'TLS', 'TGO', 'TON', 'TTO', 'TUN', 'TUR', 'TKM', 'TUV', 'UGA',
    'UKR', 'ARE', 'GBR', 'USA', 'URY', 'UZB', 'VUT', 'VEN', 'VNM', 'YEM',
    'ZMB', 'ZWE', 'EUU',  # EUU = European Union
]

def fetch_by_country():
    all_records = []
    total = len(ISO_CODES)
    
    for i, code in enumerate(ISO_CODES):
        print(f"[{i+1}/{total}] {code}...", end=' ', flush=True)
        
        # Try different query parameters
        for param_name in ['code', 'iso_code3', 'iso', 'country_code', 'id']:
            try:
                resp = requests.get(
                    BASE_URL,
                    params={param_name: code, 'per_page': 500},
                    headers={'User-Agent': 'Mozilla/5.0'},
                    timeout=15
                )
                if resp.status_code == 200:
                    data = resp.json()
                    records = data.get('data', [])
                    if records and any(r.get('country', '').upper().startswith(code[:2]) or 
                                      code in r.get('iso_code3', '') for r in records[:5]):
                        all_records.extend(records)
                        print(f"OK ({len(records)} records via {param_name})")
                        break
            except Exception as e:
                pass
        else:
            # Try filtering by country name in the value field
            try:
                resp = requests.get(
                    BASE_URL,
                    params={'per_page': 500},
                    headers={'User-Agent': 'Mozilla/5.0'},
                    timeout=15
                )
                if resp.status_code == 200:
                    data = resp.json()
                    records = data.get('data', [])
                    # Filter for this country
                    country_records = [r for r in records if r.get('iso_code3') == code]
                    if country_records:
                        all_records.extend(country_records)
                        print(f"OK ({len(country_records)} records via filter)")
                    else:
                        print("no data")
            except Exception as e:
                print(f"error: {e}")
        
        time.sleep(0.2)
    
    return all_records

def fetch_all_pages():
    """Alternative: fetch all pages and deduplicate"""
    print("\nAlternative approach: fetching all pages...")
    all_records = []
    seen_ids = set()
    
    for page in range(1, 200):
        print(f"Page {page}...", end=' ', flush=True)
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
        
        # Deduplicate by ID
        new_records = []
        for r in records:
            rid = r.get('id')
            if rid not in seen_ids:
                seen_ids.add(rid)
                new_records.append(r)
        
        all_records.extend(new_records)
        countries = set(r.get('country', '') for r in new_records)
        print(f"{len(new_records)} new records, countries: {list(countries)[:3]}")
        
        # Stop if no new records
        if not new_records:
            print("No new records — done!")
            break
        
        time.sleep(0.3)
    
    return all_records

if __name__ == '__main__':
    print(f"Approach 1: Query by ISO code ({len(ISO_CODES)} countries)")
    records = fetch_by_country()
    
    if len(records) < 100:
        print("\nApproach 2: Full pagination with dedup")
        records = fetch_all_pages()
    
    # Save
    with open(OUTPUT, 'w') as f:
        json.dump({'data': records}, f)
    
    countries = set(r.get('country', '') for r in records)
    indicators = set(r.get('indicator_id', '') for r in records)
    
    print(f"\n=== Complete ===")
    print(f"Total records: {len(records)}")
    print(f"Countries: {len(countries)}")
    print(f"Indicators: {len(indicators)}")
    print(f"Saved to: {OUTPUT}")
