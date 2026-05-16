#!/usr/bin/env python3
"""
Climate Economics & Policy Content Generator
Creates structured content about climate economics, policy, and finance.
Sources: Wikipedia articles + structured data from official sources.
"""

import json
from pathlib import Path

RAW_DIR = Path("/Users/ekmelozdemir/earthloveunited.org/climate-dataset/data/raw")

# ─── Climate Economics & Policy Articles to Extract ───
ARTICLES = [
    # Carbon Pricing
    "Carbon tax", "Carbon pricing", "Emissions trading",
    "European Union Emissions Trading System", "Carbon credit",
    "Carbon offset", "Carbon neutrality", "Net-zero emissions",
    "Carbon border adjustment mechanism",
    # Climate Finance
    "Climate finance", "Green bond", "Green Climate Fund",
    "Loss and damage (climate change)", "Adaptation fund",
    "Clean Development Mechanism", "Joint Implementation",
    # International Policy
    "Paris Agreement", "Kyoto Protocol", "Montreal Protocol",
    "United Nations Framework Convention on Climate Change",
    "Nationally determined contribution", "Common but differentiated responsibilities",
    "Climate change mitigation", "Climate change adaptation",
    # National Policies
    "Climate change legislation", "Climate change litigation",
    "Fossil fuel phase-out", "Coal phase-out",
    "Renewable portfolio standard", "Feed-in tariff",
    "Energy transition", "Decarbonization",
    # Economics
    "Social cost of carbon", "Carbon footprint",
    "Stranded asset", "Fossil fuel divestment",
    "Green economy", "Circular economy",
    "Sustainable Development Goals", "Climate risk",
    "Task Force on Climate-related Financial Disclosures",
    # Organizations
    "Intergovernmental Panel on Climate Change",
    "World Meteorological Organization",
    "International Energy Agency",
    "United Nations Environment Programme",
    "Green Climate Fund", "Global Environment Facility",
    "Climate Action Network", "Climate Action Tracker",
    # COP Conferences
    "COP26", "COP27", "COP28", "COP29", "COP30",
    "United Nations Climate Change conference",
    # Justice
    "Climate justice", "Environmental justice",
    "Just transition", "Energy poverty",
    "Climate migration", "Climate refugee",
]

print(f"Climate economics articles: {len(ARTICLES)}")

# Save the list for the Wikipedia extractor
import json
with open(RAW_DIR / "climate_economics_articles.json", 'w') as f:
    json.dump(ARTICLES, f, indent=2)
print(f"Saved article list to {RAW_DIR / 'climate_economics_articles.json'}")
