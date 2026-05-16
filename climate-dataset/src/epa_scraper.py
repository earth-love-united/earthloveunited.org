"""
Extract EPA Climate Explainers
Authoritative, plain-language climate science from the US EPA.
"""

import json
import time
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

# EPA Climate Change pages to extract
EPA_PAGES = [
    "https://www.epa.gov/climate-change",
    "https://www.epa.gov/climate-change-science",
    "https://www.epa.gov/climate-change-science/causes-climate-change",
    "https://www.epa.gov/climate-change-science/indicators-climate-change",
    "https://www.epa.gov/climate-change-science/future-climate-change",
    "https://www.epa.gov/climate-change-science/climate-change-impacts",
    "https://www.epa.gov/climate-change-science/adapting-climate-change",
    "https://www.epa.gov/climate-change-science/what-you-can-do",
    "https://www.epa.gov/ghgemissions",
    "https://www.epa.gov/ghgemissions/overview-greenhouse-gases",
    "https://www.epa.gov/ghgemissions/sources-greenhouse-gas-emissions",
    "https://www.epa.gov/ghgemissions/global-greenhouse-gas-emissions-data",
    "https://www.epa.gov/ghgemissions/us-greenhouse-gas-inventory",
    "https://www.epa.gov/energy/greenhouse-gases-equivalencies-calculator",
    "https://www.epa.gov/clean-air-act-overview",
    "https://www.epa.gov/renewable-energy",
    "https://www.epa.gov/energy-efficiency",
    "https://www.epa.gov/sustainability",
]


def scrape_epa_page(url: str) -> dict:
    """Scrape an EPA climate page."""
    try:
        r = requests.get(url, timeout=15, headers={'User-Agent': 'ELU/1.0'})
        if r.status_code != 200:
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Extract title
        title_elem = soup.find('h1') or soup.find('title')
        title = title_elem.text.strip() if title_elem else url.split('/')[-1].replace('-', ' ').title()

        # Extract main content
        content = soup.find('main') or soup.find('div', id='main-content') or soup.find('div', class_='region-content')

        if content:
            # Remove navigation, footers, etc
            for tag in content.find_all(['nav', 'footer', 'script', 'style']):
                tag.decompose()
            text = content.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)

        text = re.sub(r'\n{3,}', '\n\n', text)

        if len(text.split()) < 100:
            return None

        return {
            'title': title,
            'text': text,
            'url': url,
        }

    except Exception as e:
        print(f"  Error: {e}")
        return None


def scrape_all_epa() -> list:
    """Scrape all EPA climate pages."""
    pages = []

    for url in tqdm(EPA_PAGES, desc="EPA Climate"):
        result = scrape_epa_page(url)
        if result:
            pages.append(result)
        time.sleep(1)

    print(f"Extracted {len(pages)} EPA pages")
    return pages


if __name__ == "__main__":
    pages = scrape_all_epa()
    output_path = RAW_DIR / "epa_climate.json"
    with open(output_path, 'w') as f:
        json.dump(pages, f, indent=2)
    print(f"Saved to {output_path}")
