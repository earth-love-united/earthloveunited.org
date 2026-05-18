#!/usr/bin/env python3
"""
Scrape NDC target data from Wikipedia.
Most countries have a "Nationally Determined Contributions" section on their climate change page.
Also scrape from the main NDC list page.
"""
import requests
from bs4 import BeautifulSoup
import json
import time
import os
import re

OUTPUT = '/Users/ekmelozdemir/earthloveunited.org/carbon-projects/pledge-reality/data/raw/ndc_wikipedia.json'

# Wikipedia pages with NDC data
NDC_PAGES = [
    # Main NDC overview page
    ("NDC Overview", "https://en.wikipedia.org/wiki/Nationally_determined_contribution"),
    # Country-specific climate change pages
    ("United States", "https://en.wikipedia.org/wiki/Climate_change_in_the_United_States"),
    ("China", "https://en.wikipedia.org/wiki/Climate_change_in_China"),
    ("India", "https://en.wikipedia.org/wiki/Climate_change_in_India"),
    ("Russia", "https://en.wikipedia.org/wiki/Climate_change_in_Russia"),
    ("Japan", "https://en.wikipedia.org/wiki/Climate_change_in_Japan"),
    ("Germany", "https://en.wikipedia.org/wiki/Climate_change_in_Germany"),
    ("Brazil", "https://en.wikipedia.org/wiki/Climate_change_in_Brazil"),
    ("Indonesia", "https://en.wikipedia.org/wiki/Climate_change_in_Indonesia"),
    ("Mexico", "https://en.wikipedia.org/wiki/Climate_change_in_Mexico"),
    ("Australia", "https://en.wikipedia.org/wiki/Climate_change_in_Australia"),
    ("Canada", "https://en.wikipedia.org/wiki/Climate_change_in_Canada"),
    ("United Kingdom", "https://en.wikipedia.org/wiki/Climate_change_in_the_United_Kingdom"),
    ("France", "https://en.wikipedia.org/wiki/Climate_change_in_France"),
    ("South Korea", "https://en.wikipedia.org/wiki/Climate_change_in_South_Korea"),
    ("Saudi Arabia", "https://en.wikipedia.org/wiki/Climate_change_in_Saudi_Arabia"),
    ("Turkey", "https://en.wikipedia.org/wiki/Climate_change_in_Turkey"),
    ("Iran", "https://en.wikipedia.org/wiki/Climate_change_in_Iran"),
    ("South Africa", "https://en.wikipedia.org/wiki/Climate_change_in_South_Africa"),
    ("Thailand", "https://en.wikipedia.org/wiki/Climate_change_in_Thailand"),
    ("Vietnam", "https://en.wikipedia.org/wiki/Climate_change_in_Vietnam"),
    ("Argentina", "https://en.wikipedia.org/wiki/Climate_change_in_Argentina"),
    ("Colombia", "https://en.wikipedia.org/wiki/Climate_change_in_Colombia"),
    ("Peru", "https://en.wikipedia.org/wiki/Climate_change_in_Peru"),
    ("Chile", "https://en.wikipedia.org/wiki/Climate_change_in_Chile"),
    ("Egypt", "https://en.wikipedia.org/wiki/Climate_change_in_Egypt"),
    ("Nigeria", "https://en.wikipedia.org/wiki/Climate_change_in_Nigeria"),
    ("Kenya", "https://en.wikipedia.org/wiki/Climate_change_in_Kenya"),
    ("Morocco", "https://en.wikipedia.org/wiki/Climate_change_in_Morocco"),
    ("Ukraine", "https://en.wikipedia.org/wiki/Climate_change_in_Ukraine"),
    ("Poland", "https://en.wikipedia.org/wiki/Climate_change_in_Poland"),
    ("Italy", "https://en.wikipedia.org/wiki/Climate_change_in_Italy"),
    ("Spain", "https://en.wikipedia.org/wiki/Climate_change_in_Spain"),
    ("Netherlands", "https://en.wikipedia.org/wiki/Climate_change_in_the_Netherlands"),
    ("Sweden", "https://en.wikipedia.org/wiki/Climate_change_in_Sweden"),
    ("Norway", "https://en.wikipedia.org/wiki/Climate_change_in_Norway"),
    ("Switzerland", "https://en.wikipedia.org/wiki/Climate_change_in_Switzerland"),
    ("Pakistan", "https://en.wikipedia.org/wiki/Climate_change_in_Pakistan"),
    ("Bangladesh", "https://en.wikipedia.org/wiki/Climate_change_in_Bangladesh"),
    ("Philippines", "https://en.wikipedia.org/wiki/Climate_change_in_the_Philippines"),
    ("Malaysia", "https://en.wikipedia.org/wiki/Climate_change_in_Malaysia"),
    ("Singapore", "https://en.wikipedia.org/wiki/Climate_change_in_Singapore"),
    ("New Zealand", "https://en.wikipedia.org/wiki/Climate_change_in_New_Zealand"),
    ("United Arab Emirates", "https://en.wikipedia.org/wiki/Climate_change_in_the_United_Arab_Emirates"),
    ("Israel", "https://en.wikipedia.org/wiki/Climate_change_in_Israel"),
    ("Kazakhstan", "https://en.wikipedia.org/wiki/Climate_change_in_Kazakhstan"),
]

def extract_ndc_from_page(name, url):
    """Extract NDC target data from a Wikipedia page"""
    try:
        resp = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=15)
        if resp.status_code != 200:
            return None
        soup = BeautifulSoup(resp.text, 'lxml')
    except:
        return None
    
    text = soup.get_text()
    data = {'country': name, 'source_url': url}
    
    # Extract NDC target patterns
    patterns = [
        ('ndc_target_year', r'(?:NDC|ndc|nationally determined contribution).*?(?:target|by)\s*(\d{4})', re.IGNORECASE | re.DOTALL),
        ('reduction_pct', r'(?:reduce|reduction|cut).*?(\d[\d.]*)\s*%', re.IGNORECASE | re.DOTALL),
        ('baseline_year', r'(?:baseline|compared to|relative to|from)\s*(\d{4})', re.IGNORECASE | re.DOTALL),
        ('target_mtco2e', r'(\d[\d,]*\.?\d*)\s*(?:MtCO2e|million tonnes? CO2)', re.IGNORECASE),
        ('bau_mtco2e', r'BAU.*?(\d[\d,]*\.?\d*)\s*(?:MtCO2e|million tonnes?)', re.IGNORECASE | re.DOTALL),
        ('conditional_target', r'conditional.*?(\d[\d,]*\.?\d*)\s*(?:MtCO2e|million tonnes?)', re.IGNORECASE | re.DOTALL),
        ('unconditional_target', r'unconditional.*?(\d[\d,]*\.?\d*)\s*(?:MtCO2e|million tonnes?)', re.IGNORECASE | re.DOTALL),
        ('net_zero_year', r'net zero.*?(\d{4})', re.IGNORECASE | re.DOTALL),
        ('renewable_target', r'renewable.*?(\d[\d.]*)\s*%', re.IGNORECASE | re.DOTALL),
    ]
    
    for key, pattern, flags in patterns:
        match = re.search(pattern, text, flags)
        if match:
            data[key] = match.group(1).replace(',', '')
    
    # Also look for structured data in tables
    tables = soup.find_all('table', {'class': 'wikitable'})
    for table in tables:
        table_text = table.get_text().lower()
        if 'ndc' in table_text or 'emission' in table_text or 'target' in table_text:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    header = cells[0].get_text(strip=True).lower()
                    value = cells[1].get_text(strip=True)
                    if 'target' in header and 'year' in header:
                        year_match = re.search(r'(\d{4})', value)
                        if year_match:
                            data['ndc_target_year'] = year_match.group(1)
                    elif 'reduction' in header or '%' in header:
                        pct_match = re.search(r'(\d[\d.]*)\s*%', value)
                        if pct_match:
                            data['reduction_pct'] = pct_match.group(1)
    
    return data if len(data) > 2 else None

def scrape_all():
    results = []
    total = len(NDC_PAGES)
    
    for i, (name, url) in enumerate(NDC_PAGES):
        print(f"[{i+1}/{total}] {name}...", end=' ', flush=True)
        data = extract_ndc_from_page(name, url)
        if data and len(data) > 2:
            results.append(data)
            print(f"OK ({len(data)-2} fields)")
        else:
            print("no data")
        time.sleep(0.5)
    
    return results

if __name__ == '__main__':
    print(f"Scraping {len(NDC_PAGES)} Wikipedia pages for NDC data...")
    results = scrape_all()
    
    with open(OUTPUT, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n=== Complete ===")
    print(f"Pages with NDC data: {len(results)}/{len(NDC_PAGES)}")
    
    # Summary
    has_target_year = sum(1 for r in results if 'ndc_target_year' in r)
    has_reduction = sum(1 for r in results if 'reduction_pct' in r)
    has_baseline = sum(1 for r in results if 'baseline_year' in r)
    print(f"  Target year: {has_target_year}")
    print(f"  Reduction %: {has_reduction}")
    print(f"  Baseline year: {has_baseline}")
    
    print(f"\nSample:")
    for r in results[:5]:
        print(f"  {r['country']}: target={r.get('ndc_target_year','?')}, reduction={r.get('reduction_pct','?')}%, baseline={r.get('baseline_year','?')}")
