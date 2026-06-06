#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Project Drawdown Solutions Scraper v2
Extracts all 80+ solutions with full descriptions.
"""

import json
import time
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

RAW_DIR = Path("climate-dataset/data/raw")

# All Project Drawdown solutions
SOLUTIONS = [
    # Electricity
    "Onshore Wind Turbines", "Offshore Wind Turbines", "Solar PV - Rooftop",
    "Solar PV - Utility Scale", "Concentrated Solar Power", "Geothermal Power",
    "Nuclear Power", "Small Hydropower", "Microgrids", "Grid Flexibility",
    "Biomass Power", "Wave and Tidal Energy", "Solar Hot Water",
    "Hybrid Heat Pumps", "Efficient District Heating",
    # Transport
    "Electric Cars", "Electric Trucks", "Electric Bicycles",
    "Public Transit", "High-Speed Rail", "Shipping Improvements",
    "Aviation Biofuels", "Trucking Efficiency", "Efficient Aviation",
    # Buildings
    "Green and Cool Roofs", "Building Automation", "Heat Pumps",
    "Efficient Appliances", "Building Retrofits", "Insulation",
    "Net-Zero Buildings",
    # Industry
    "Efficient Industry", "Alternative Cements", "Refrigerant Management",
    "Alternative Refrigerants", "Waste Heat Recovery", "Industrial Symbiosis",
    # Land Use
    "Reduced Food Waste", "Plant-Rich Diet", "Regenerative Agriculture",
    "Farm Irrigation Efficiency", "Protection of Peatlands",
    "Protection of Forests", "Tropical Forest Restoration",
    "Temperate Forest Restoration", "Bamboo Production", "Indigenous Peoples' Forests",
    # Oceans
    "Seaweed Farming", "Ocean Power", "Improved Fisheries",
    "Improved Aquaculture", "Mangrove Protection", "Seagrass Protection",
    # Carbon Removal
    "Direct Air Capture", "Biochar", "Enhanced Weathering",
    "Soil Carbon Sequestration", "Tree Planting",
    # Social
    "Girls' Education", "Family Planning", "Health and Education",
    # Waste
    "Methane Capture", "Recycling", "Composting",
    "Landfill Methane", "Wastewater Treatment",
    # Finance
    "Green Finance", "Carbon Pricing",
]

def scrape_solution(name):
    """Scrape a Project Drawdown solution page."""
    url_name = name.lower().replace(' ', '-').replace("'", "").replace(',', '').replace('(', '').replace(')', '')
    url = f"https://drawdown.org/solutions/{url_name}"
    try:
        r = requests.get(url, timeout=15, headers={'User-Agent': 'ELU/1.0'})
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, 'html.parser')
        title_elem = soup.find('h1')
        title = title_elem.text.strip() if title_elem else name
        content = soup.find('main') or soup.find('article') or soup.find('div', class_='solution-content')
        if content:
            for tag in content.find_all(['script', 'style', 'nav', 'footer']):
                tag.decompose()
            text = content.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)
        text = re.sub(r'\n{3,}', '\n\n', text)
        if len(text.split()) < 100:
            return None
        return {'title': title, 'text': text, 'url': url, 'solution_name': name}
    except:
        return None

solutions = []
for name in tqdm(SOLUTIONS, desc="Drawdown v2"):
    result = scrape_solution(name)
    if result:
        solutions.append(result)
    time.sleep(0.5)

print(f"\nExtracted {len(solutions)} Drawdown solutions")
output_path = RAW_DIR / "drawdown_solutions_v2.json"
with open(output_path, 'w') as f:
    json.dump(solutions, f, indent=2)
print(f"Saved to {output_path}")
