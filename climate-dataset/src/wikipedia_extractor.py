"""
Wikipedia Climate Article Extractor
Extracts climate-related articles from Wikipedia.
Uses wikipedia-api for clean text extraction.
"""

import re
import json
import time
from pathlib import Path

import wikipediaapi
from tqdm import tqdm

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

# Seed articles — the core climate knowledge graph
SEED_ARTICLES = [
    # Core climate science
    "Climate change",
    "Global warming",
    "Greenhouse effect",
    "Greenhouse gas",
    "Carbon dioxide",
    "Carbon cycle",
    "Carbon sink",
    "Carbon budget",
    "Climate sensitivity",
    "Climate change mitigation",
    "Climate change adaptation",
    "Climate variability and change",
    "Radiative forcing",
    "Global temperature record",
    "Instrumental temperature record",
    "Proxy (climate)",
    "Paleoclimatology",
    "Ice core",
    "Keeling Curve",
    "Mauna Loa Observatory",

    # Impacts
    "Effects of climate change",
    "Sea level rise",
    "Ocean acidification",
    "Coral bleaching",
    "Arctic sea ice decline",
    "Retreat of glaciers since 1850",
    "Extreme weather",
    "Heat wave",
    "Drought",
    "Flood",
    "Wildfire",
    "Tropical cyclone",
    "Climate change and ecosystems",
    "Biodiversity loss",
    "Climate change and agriculture",
    "Climate change and health",
    "Climate migration",

    # Solutions
    "Renewable energy",
    "Solar energy",
    "Wind power",
    "Nuclear power",
    "Hydropower",
    "Geothermal energy",
    "Biomass",
    "Carbon capture and storage",
    "Carbon offset",
    "Carbon tax",
    "Emissions trading",
    "Carbon pricing",
    "Direct air capture",
    "Bioenergy with carbon capture and storage",
    "Reforestation",
    "Afforestation",
    "Nature-based solutions",
    "Climate change mitigation",
    "Energy transition",
    "Fossil fuel phase-out",
    "Electric vehicle",
    "Green hydrogen",
    "Battery storage",

    # Policy and politics
    "Paris Agreement",
    "United Nations Framework Convention on Climate Change",
    "Intergovernmental Panel on Climate Change",
    "Kyoto Protocol",
    "Montreal Protocol",
    "Climate justice",
    "Climate finance",
    "Loss and damage (climate change)",
    "Nationally determined contribution",
    "Climate target",
    "Net zero emissions",
    "Carbon neutrality",

    # Carbon and emissions
    "Carbon footprint",
    "Carbon emission trading",
    "Carbon credit",
    "Carbon offsetting",
    "Carbon accounting",
    "Life-cycle assessment",
    "Scope 1, 2, and 3 emissions",
    "Embedded carbon",
    "Carbon intensity",
    "List of countries by CO2 emissions",
    "List of countries by greenhouse gas emissions",

    # Earth systems
    "Atmosphere of Earth",
    "Ocean current",
    "Thermohaline circulation",
    "El Niño–Southern Oscillation",
    "Atlantic meridional overturning circulation",
    "Permafrost",
    "Tipping points in the climate system",
    "Ice sheet",
    "Greenland ice sheet",
    "Antarctic ice sheet",
    "Mountain glacier",
    "Deforestation",
    "Forest",
    "Rainforest",
    "Mangrove forest",
    "Peatland",
    "Wetland",
    "Soil carbon",
    "Ocean heat content",
    "Marine ecosystem",
    "Phytoplankton",

    # Energy
    "World energy supply and consumption",
    "Fossil fuel",
    "Coal",
    "Petroleum",
    "Natural gas",
    "Renewable energy commercialization",
    "Energy storage",
    "Smart grid",
    "Energy efficiency",
    "Building insulation",
    "Heat pump",
    "Solar cell",
    "Wind turbine",
    "Nuclear reactor",
    "Fusion power",

    # Specific topics
    "Climate change denial",
    "Climate communication",
    "Climate education",
    "Climate action",
    "Individual action on climate change",
    "Climate movement",
    "School Strike for Climate",
    "Extinction Rebellion",
    "Drawdown (book)",
    "Project Drawdown",
    "Climate TRACE",
    "Global Carbon Project",
    "Global Carbon Atlas",
    "Climate Action Tracker",
    "Climate Clock",
]


def extract_wikipedia_articles(max_articles: int = 500) -> list:
    """Extract climate articles from Wikipedia."""
    wiki = wikipediaapi.Wikipedia(
        user_agent='EarthLoveUnited/1.0 (climate education project)',
        language='en'
    )

    articles = []
    seen_titles = set()

    for title in tqdm(SEED_ARTICLES[:max_articles], desc="Extracting Wikipedia"):
        try:
            page = wiki.page(title)

            if not page.exists():
                continue

            # Get full text
            text = page.text

            # Skip if too short
            if len(text.split()) < 100:
                continue

            # Get categories
            categories = [cat.title for cat in page.categories.values()]

            # Get links (related articles)
            links = [link.title for link in page.links.values()]

            article = {
                'title': page.title,
                'text': text,
                'summary': page.summary,
                'url': page.fullurl,
                'page_id': page.pageid,
                'categories': categories[:20],  # Top 20 categories
                'links': links[:50],  # Top 50 links
                'last_modified': page.touched if hasattr(page, 'touched') else '',
            }

            articles.append(article)
            seen_titles.add(title)

            time.sleep(0.5)  # Be nice to Wikipedia

        except Exception as e:
            print(f"  Error extracting '{title}': {e}")
            continue

    print(f"\nExtracted {len(articles)} Wikipedia articles")
    return articles


def save_articles(articles: list):
    """Save articles to raw data directory."""
    output_path = RAW_DIR / "wikipedia_climate_articles.json"
    with open(output_path, 'w') as f:
        json.dump(articles, f, indent=2)
    print(f"Saved to {output_path}")
    return output_path


if __name__ == "__main__":
    articles = extract_wikipedia_articles(max_articles=500)
    save_articles(articles)
