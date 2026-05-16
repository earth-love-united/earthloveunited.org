"""
Extract Project Drawdown Solutions
The world's most comprehensive catalog of climate solutions.
"""

import json
import time
import re
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

# Project Drawdown solutions to extract
DRAWDOWN_SOLUTIONS = [
    # Energy
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
    # Industry
    "Efficient Industry", "Alternative Cements", "Refrigerant Management",
    "Alternative Refrigerants", "Reduce Food Waste", "Plant-Rich Diet",
    # Land Use
    "Reduced Food Waste", "Plant-Rich Diet", "Regenerative Agriculture",
    "Farm Irrigation Efficiency", "Protection of Peatlands",
    "Protection of Forests", "Tropical Forest Restoration",
    "Temperate Forest Restoration", "Bamboo Production",
    # Oceans
    "Seaweed Farming", "Ocean Power", "Improved Fisheries",
    "Improved Aquaculture", "Mangrove Protection", "Seagrass Protection",
    # Carbon Removal
    "Direct Air Capture", "Biochar", "Enhanced Weathering",
    "Peatland Protection", "Forest Restoration", "Soil Carbon Sequestration",
    "Tree Planting", "Tropical Forest Restoration",
    # Social
    "Girls' Education", "Family Planning", "Health and Education",
    # Waste
    "Methane Capture", "Recycling", "Composting",
    "Landfill Methane", "Wastewater Treatment",
]


def scrape_drawdown_solution(solution_name: str) -> dict:
    """Scrape a Project Drawdown solution page."""
    # Convert URL name
    url_name = solution_name.lower().replace(' ', '-').replace("'", "").replace(',', '')
    url = f"https://drawdown.org/solutions/{url_name}"

    try:
        r = requests.get(url, timeout=15, headers={'User-Agent': 'ELU/1.0'})
        if r.status_code != 200:
            return None

        soup = BeautifulSoup(r.text, 'html.parser')

        # Extract title
        title_elem = soup.find('h1')
        title = title_elem.text.strip() if title_elem else solution_name

        # Extract main content
        content_div = soup.find('div', class_='solution-content') or soup.find('main') or soup.find('article')
        if content_div:
            text = content_div.get_text(separator='\n', strip=True)
        else:
            text = soup.get_text(separator='\n', strip=True)

        # Clean up
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Extract key stats if available
        stats = {}
        stat_items = soup.find_all('div', class_='stat')
        for item in stat_items:
            label = item.find('span', class_='stat-label')
            value = item.find('span', class_='stat-value')
            if label and value:
                stats[label.text.strip()] = value.text.strip()

        return {
            'title': title,
            'text': text,
            'url': url,
            'solution_name': solution_name,
            'stats': stats,
        }

    except Exception as e:
        print(f"  Error scraping {solution_name}: {e}")
        return None


def scrape_all_drawdown(max_solutions: int = 80) -> list:
    """Scrape all Project Drawdown solutions."""
    solutions = []

    for name in tqdm(DRAWDOWN_SOLUTIONS[:max_solutions], desc="Project Drawdown"):
        result = scrape_drawdown_solution(name)
        if result and len(result['text'].split()) > 100:
            solutions.append(result)
        time.sleep(1)

    print(f"Extracted {len(solutions)} Drawdown solutions")
    return solutions


if __name__ == "__main__":
    solutions = scrape_all_dumpdown(max_solutions=80)
    output_path = RAW_DIR / "drawdown_solutions.json"
    with open(output_path, 'w') as f:
        json.dump(solutions, f, indent=2)
    print(f"Saved to {output_path}")
