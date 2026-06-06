#!/usr/bin/env python3
import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Wikipedia Climate Article Extractor v3 — Comprehensive
Extracts 500+ climate-related articles covering all major domains:
- Core climate science
- Impacts and adaptation
- Mitigation and solutions
- Climate economics and policy
- Biodiversity and ecosystems
- Climate justice
- Regional climate
- Energy transition
"""

import json
import time
import re
from pathlib import Path

import wikipediaapi
from tqdm import tqdm

RAW_DIR = Path("climate-dataset/data/raw")

# ─── Comprehensive article list (500+ articles) ───
ARTICLES = [
    # ═══ CORE CLIMATE SCIENCE (40) ═══
    "Climate change", "Global warming", "Greenhouse effect", "Greenhouse gas",
    "Carbon dioxide", "Carbon cycle", "Carbon sink", "Carbon budget",
    "Climate sensitivity", "Climate change mitigation", "Climate change adaptation",
    "Radiative forcing", "Global temperature record", "Paleoclimatology",
    "Ice core", "Keeling Curve", "Climate model", "Climate scenario",
    "Representative Concentration Pathway", "Shared Socioeconomic Pathway",
    "Climate forcing", "Climate feedback", "Water vapor feedback",
    "Ice-albedo feedback", "Cloud feedback", "Carbon cycle feedback",
    "El Niño–Southern Oscillation", "Atlantic meridional overturning circulation",
    "Thermohaline circulation", "Polar amplification", "Arctic sea ice decline",
    "Retreat of glaciers since 1850", "Sea level rise", "Ocean acidification",
    "Ocean heat content", "Stratospheric ozone depletion", "Aerosol",
    "Cloud condensation nuclei", "Black carbon", "Methane emissions",

    # ═══ IMPACTS (40) ═══
    "Effects of climate change", "Effects of climate change on oceans",
    "Effects of climate change on weather", "Effects of climate change on humans",
    "Effects of climate change on agriculture", "Effects of climate change on health",
    "Climate migration", "Climate change and islands", "Climate change in the Arctic",
    "Climate change in Antarctica", "Climate change in Africa",
    "Climate change in Asia", "Climate change in Europe",
    "Climate change in North America", "Climate change in South America",
    "Climate change in Australia", "Climate change in the Middle East",
    "Climate change in Turkey", "Climate change in the Mediterranean",
    "Extreme weather", "Heat wave", "Drought", "Flood", "Wildfire",
    "Tropical cyclone intensity", "Storm surge", "Coastal erosion",
    "Water scarcity", "Food security", "Climate and infectious diseases",
    "Mental health and climate change", "Climate anxiety",
    "Biodiversity loss", "Coral bleaching", "Deforestation",
    "Desertification", "Ocean deoxygenation", "Soil degradation",
    "Permafrost", "Methane clathrate",

    # ═══ MITIGATION & SOLUTIONS (40) ═══
    "Renewable energy", "Solar energy", "Wind power", "Nuclear power",
    "Hydropower", "Geothermal energy", "Biomass", "Tidal power",
    "Solar cell", "Wind turbine", "Nuclear reactor", "Fusion power",
    "Small modular reactor", "Concentrated solar power", "Photovoltaic system",
    "Offshore wind farm", "Onshore wind farm", "Solar farm",
    "Carbon capture and storage", "Direct air capture",
    "Bioenergy with carbon capture and storage", "Enhanced weathering",
    "Green hydrogen", "Hydrogen economy", "Fuel cell",
    "Electric vehicle", "Electric car", "Electric truck", "Electric bus",
    "High-speed rail", "Public transport", "Bicycle", "Sustainable transport",
    "Green building", "Building insulation", "Heat pump", "Energy efficiency",
    "Smart grid", "Grid energy storage", "Pumped-storage hydroelectricity",
    "Passive house", "Zero-energy building", "Green roof",

    # ═══ CLIMATE ECONOMICS & POLICY (40) ═══
    "Carbon tax", "Carbon pricing", "Emissions trading",
    "European Union Emissions Trading System", "Carbon credit",
    "Carbon offset", "Carbon neutrality", "Net-zero emissions",
    "Paris Agreement", "Kyoto Protocol", "Montreal Protocol",
    "United Nations Framework Convention on Climate Change",
    "Intergovernmental Panel on Climate Change", "Climate finance",
    "Loss and damage (climate change)", "Nationally determined contribution",
    "Climate target", "Fossil fuel phase-out", "Coal phase-out",
    "Renewable energy commercialization", "Energy transition",
    "Decarbonization", "Low-carbon economy", "Green economy",
    "Circular economy", "Green bond", "Climate risk",
    "Task Force on Climate-related Financial Disclosures",
    "Stranded asset", "Fossil fuel divestment", "Carbon border adjustment",
    "Climate legislation", "Climate change litigation", "Climate movement",
    "School Strike for Climate", "Extinction Rebellion",
    "Climate Action Network", "Climate Action Tracker",
    "COP26", "COP27", "COP28", "COP29", "COP30",

    # ═══ BIODIVERSITY & ECOSYSTEMS (30) ═══
    "Biodiversity", "Ecosystem", "Ecosystem services", "Habitat destruction",
    "Species extinction", "Mass extinction event", "Biodiversity hotspot",
    "Coral reef", "Mangrove forest", "Wetland", "Peatland", "Rainforest",
    "Tropical rainforest", "Temperate forest", "Boreal forest", "Grassland",
    "Tundra", "Marine ecosystem", "Freshwater ecosystem", "Soil biology",
    "Pollinator decline", "Deforestation", "Afforestation", "Reforestation",
    "Forest restoration", "Nature-based solutions", "Rewilding",
    "Invasive species", "Coral bleaching", "Kelp forest", "Seagrass meadow",

    # ═══ CLIMATE JUSTICE (25) ═══
    "Climate justice", "Environmental justice", "Climate equity",
    "Climate migration", "Climate refugee", "Environmental migrant",
    "Climate change and poverty", "Climate change and gender",
    "Climate change and education", "Climate change and indigenous peoples",
    "Just transition", "Energy poverty", "Food justice",
    "Water justice", "Environmental racism", "Climate debt",
    "Common but differentiated responsibilities", "Historical emissions",
    "Carbon footprint", "Individual action on climate change",
    "Climate communication", "Climate education", "Climate literacy",
    "Climate psychology", "Climate activism",

    # ═══ ENERGY TRANSITION (30) ═══
    "Energy transition", "Renewable energy", "Fossil fuel",
    "Coal", "Petroleum", "Natural gas", "Oil shale", "Tar sands",
    "Nuclear power", "Solar power", "Wind power", "Hydropower",
    "Geothermal energy", "Biomass", "Biofuel", "Biodiesel", "Ethanol fuel",
    "Electricity generation", "Power grid", "Energy storage",
    "Battery technology", "Lithium-ion battery", "Solid-state battery",
    "Vehicle-to-grid", "Demand response", "Microgrid",
    "Distributed generation", "Feed-in tariff", "Renewable portfolio standard",
    "Levelized cost of electricity",

    # ═══ REGIONAL CLIMATE (30) ═══
    "Climate change in Turkey", "Climate change in the Mediterranean",
    "Climate change in the Middle East", "Climate change in Europe",
    "Climate change in Africa", "Climate change in Asia",
    "Climate change in North America", "Climate change in South America",
    "Climate change in Australia", "Climate change in the Arctic",
    "Climate change in Antarctica", "Climate change in small island states",
    "Climate change in the United States", "Climate change in China",
    "Climate change in India", "Climate change in Brazil",
    "Climate change in the United Kingdom", "Climate change in Germany",
    "Climate change in France", "Climate change in Japan",
    "Climate change in Russia", "Climate change in Canada",
    "Climate change in Mexico", "Climate change in Indonesia",
    "Climate change in Bangladesh", "Climate change in Pakistan",
    "Climate change in Nigeria", "Climate change in Egypt",
    "Climate change in Saudi Arabia", "Climate change in Iran",

    # ═══ KEY ORGANIZATIONS & PEOPLE (25) ═══
    "Intergovernmental Panel on Climate Change", "World Meteorological Organization",
    "National Oceanic and Atmospheric Administration", "NASA",
    "European Space Agency", "International Energy Agency",
    "World Bank Climate Change", "United Nations Environment Programme",
    "Green Climate Fund", "Global Environment Facility",
    "Project Drawdown", "Climate TRACE", "Global Carbon Project",
    "James Hansen", "Michael Mann", "Gavin Schmidt", "Katharine Hayhoe",
    "Greta Thunberg", "Al Gore", "Bill McKibben", "Naomi Klein",
    "Christiana Figueres", "John Kerry", "António Guterres",

    # ═══ MEASUREMENT & DATA (20) ═══
    "Carbon footprint", "Carbon dioxide equivalent", "Global warming potential",
    "Parts per million", "Temperature anomaly", "Climate reanalysis",
    "CMIP", "CMIP6", "ERA5", "Global Carbon Project", "Climate TRACE",
    "Keeling Curve", "Proxy (climate)", "Dendrochronology", "Ice core",
    "Satellite temperature measurements", "Weather station",
    "Climate model", "General circulation model", "Earth system model",
    "Paleoclimatology",
]

# Deduplicate
seen = set()
UNIQUE_ARTICLES = []
for a in ARTICLES:
    if a.lower() not in seen:
        seen.add(a.lower())
        UNIQUE_ARTICLES.append(a)

print(f"Total unique articles: {len(UNIQUE_ARTICLES)}")

# ─── Extract ───
wiki = wikipediaapi.Wikipedia(
    user_agent="EarthLoveUnited/1.0 (climate education project)",
    language="en"
)

articles = []
seen_titles = set()
errors = 0

for title in tqdm(UNIQUE_ARTICLES, desc="Wikipedia v3"):
    if title.lower() in seen_titles:
        continue
    seen_titles.add(title.lower())

    try:
        page = wiki.page(title)
        if not page.exists():
            errors += 1
            continue
        text = page.text
        if len(text.split()) < 100:
            continue
        articles.append({
            "title": page.title,
            "text": text,
            "summary": page.summary,
            "url": page.fullurl,
            "page_id": page.pageid,
            "categories": [c.title for c in page.categories.values()][:20],
        })
        time.sleep(0.3)
    except:
        errors += 1
        continue

print(f"\nExtracted {len(articles)} articles ({errors} errors/skipped)")

# Save
output_path = RAW_DIR / "wikipedia_climate_v3.json"
with open(output_path, "w") as f:
    json.dump(articles, f, indent=2)
print(f"Saved to {output_path}")

total_words = sum(len(a["text"].split()) for a in articles)
print(f"Total words: {total_words:,}")
print(f"Average words/article: {total_words // len(articles):,}")
