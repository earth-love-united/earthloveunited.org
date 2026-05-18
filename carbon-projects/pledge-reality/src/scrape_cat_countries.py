#!/usr/bin/env python3
"""
Scrape ALL CAT country pages for detailed ratings and NDC target data.
Uses the browser to visit each country page and extract structured data.

Output: data/raw/cat_country_data.csv
"""
import pandas as pd
import json
import os
import time
import sys

# All CAT country URLs from the main page
CAT_COUNTRIES = [
    ("Argentina", "https://climateactiontracker.org/countries/argentina/"),
    ("Indonesia", "https://climateactiontracker.org/countries/indonesia/"),
    ("Iran", "https://climateactiontracker.org/countries/iran/"),
    ("Russia", "https://climateactiontracker.org/countries/russian-federation/"),
    ("Saudi Arabia", "https://climateactiontracker.org/countries/saudi-arabia/"),
    ("Thailand", "https://climateactiontracker.org/countries/thailand/"),
    ("Turkey", "https://climateactiontracker.org/countries/turkey/"),
    ("United States", "https://climateactiontracker.org/countries/usa/"),
    ("Vietnam", "https://climateactiontracker.org/countries/vietnam/"),
    ("Canada", "https://climateactiontracker.org/countries/canada/"),
    ("China", "https://climateactiontracker.org/countries/china/"),
    ("Egypt", "https://climateactiontracker.org/countries/egypt/"),
    ("India", "https://climateactiontracker.org/countries/india/"),
    ("Mexico", "https://climateactiontracker.org/countries/mexico/"),
    ("New Zealand", "https://climateactiontracker.org/countries/new-zealand/"),
    ("Singapore", "https://climateactiontracker.org/countries/singapore/"),
    ("Australia", "https://climateactiontracker.org/countries/australia/"),
    ("Brazil", "https://climateactiontracker.org/countries/brazil/"),
    ("Colombia", "https://climateactiontracker.org/countries/colombia/"),
    ("European Union", "https://climateactiontracker.org/countries/eu/"),
    ("Germany", "https://climateactiontracker.org/countries/germany/"),
    ("Japan", "https://climateactiontracker.org/countries/japan/"),
    ("Kazakhstan", "https://climateactiontracker.org/countries/kazakhstan/"),
    ("Peru", "https://climateactiontracker.org/countries/peru/"),
    ("South Africa", "https://climateactiontracker.org/countries/south-africa/"),
    ("South Korea", "https://climateactiontracker.org/countries/south-korea/"),
    ("Switzerland", "https://climateactiontracker.org/countries/switzerland/"),
    ("United Arab Emirates", "https://climateactiontracker.org/countries/uae/"),
    ("United Kingdom", "https://climateactiontracker.org/countries/uk/"),
    ("Bhutan", "https://climateactiontracker.org/countries/bhutan/"),
    ("Chile", "https://climateactiontracker.org/countries/chile/"),
    ("Costa Rica", "https://climateactiontracker.org/countries/costa-rica/"),
    ("Ethiopia", "https://climateactiontracker.org/countries/ethiopia/"),
    ("Kenya", "https://climateactiontracker.org/countries/kenya/"),
    ("Morocco", "https://climateactiontracker.org/countries/morocco/"),
    ("Nepal", "https://climateactiontracker.org/countries/nepal/"),
    ("Nigeria", "https://climateactiontracker.org/countries/nigeria/"),
    ("Norway", "https://climateactiontracker.org/countries/norway/"),
    ("Philippines", "https://climateactiontracker.org/countries/philippines/"),
    ("Gambia", "https://climateactiontracker.org/countries/gambia/"),
]

def extract_from_page(url):
    """Extract structured data from a CAT country page using requests + bs4"""
    import requests
    from bs4 import BeautifulSoup
    
    try:
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}, timeout=15)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, 'lxml')
    except Exception as e:
        return None
    
    data = {}
    
    # Extract all definition lists (CAT uses dl/dt/dd for ratings)
    dls = soup.find_all('dl')
    for dl in dls:
        dts = dl.find_all('dt')
        dds = dl.find_all('dd')
        for dt, dd in zip(dts, dds):
            key = dt.get_text(strip=True).lower().replace(' ', '_')
            val = dd.get_text(strip=True)
            if key and val:
                data[key] = val
    
    # Extract net zero target year
    nz_section = soup.find(string=lambda t: t and 'net zero' in t.lower())
    if nz_section:
        parent = nz_section.find_parent(['div', 'section', 'li'])
        if parent:
            nz_text = parent.get_text()
            import re
            year_match = re.search(r'(20\d{2})', nz_text)
            if year_match:
                data['net_zero_year'] = year_match.group(1)
    
    # Extract NDC target values from the page text
    text = soup.get_text()
    import re
    
    # Look for target emissions in MtCO2e
    target_patterns = [
        ('ndc_unconditional_mtco2e', r'unconditional.*?target.*?(\d[\d,]+\.?\d*)\s*MtCO2e'),
        ('ndc_conditional_mtco2e', r'conditional.*?target.*?(\d[\d,]+\.?\d*)\s*MtCO2e'),
        ('ndc_target_2030_mtco2e', r'2030.*?target.*?(\d[\d,]+\.?\d*)\s*MtCO2e'),
        ('bau_2030_mtco2e', r'BAU.*?(\d[\d,]+\.?\d*)\s*MtCO2e'),
        ('reduction_pct', r'(\d[\d.]*)\s*%\s*reduction'),
        ('baseline_year', r'baseline.*?(\d{4})'),
        ('target_year', r'target.*?year.*?(\d{4})'),
    ]
    
    for key, pattern in target_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            data[key] = match.group(1).replace(',', '')
    
    return data

def scrape_all():
    results = []
    total = len(CAT_COUNTRIES)
    
    for i, (country, url) in enumerate(CAT_COUNTRIES):
        print(f"[{i+1}/{total}] {country}...", end=' ', flush=True)
        data = extract_from_page(url)
        if data:
            data['country'] = country
            data['cat_url'] = url
            results.append(data)
            print(f"OK ({len(data)} fields)")
        else:
            print("FAILED")
        time.sleep(0.5)  # Be polite
    
    return results

if __name__ == '__main__':
    print(f"Scraping {len(CAT_COUNTRIES)} CAT country pages...")
    results = scrape_all()
    
    if not results:
        print("No data collected!")
        sys.exit(1)
    
    df = pd.DataFrame(results)
    
    # Reorder columns
    first_cols = ['country', 'cat_url', 'overall_rating', 'policies_and_action_against_modelled_domestic_pathways',
                  'ndc_target_against_modelled_domestic_pathways', 'ndc_target_against_fair_share',
                  'climate_finance', 'net_zero_year', 'land_use_&_forestry']
    first_cols = [c for c in first_cols if c in df.columns]
    other_cols = [c for c in df.columns if c not in first_cols]
    df = df[first_cols + other_cols]
    
    out_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw', 'cat_country_data.csv')
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    df.to_csv(out_path, index=False)
    
    print(f"\n=== Done ===")
    print(f"Countries scraped: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    print(f"Saved to: {out_path}")
    print(f"\nSample:")
    print(df[['country', 'overall_rating', 'ndc_target_against_modelled_domestic_pathways']].head(10).to_string(index=False))
