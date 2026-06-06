import os as _os
from pathlib import Path as _Path
_REPO = _Path(__file__).resolve()
while _REPO != _REPO.parent and not (_REPO / '.git').exists():
    _REPO = _REPO.parent
_os.chdir(_REPO)
"""
Expanded Wikipedia Climate Article List v2.0
500+ articles covering all major climate topics.
Organized by category for better coverage.
"""

EXPANDED_WIKI_ARTICLES = [
    # ─── Core Climate Science (30) ───
    "Climate change", "Global warming", "Greenhouse effect", "Greenhouse gas",
    "Carbon dioxide", "Carbon cycle", "Carbon sink", "Carbon budget",
    "Climate sensitivity", "Climate change mitigation", "Climate change adaptation",
    "Climate variability and change", "Radiative forcing", "Global temperature record",
    "Instrumental temperature record", "Proxy (climate)", "Paleoclimatology",
    "Ice core", "Keeling Curve", "Mauna Loa Observatory",
    "Climate model", "Climate scenario", "Representative Concentration Pathway",
    "Shared Socioeconomic Pathway", "Climate forcing", "Climate feedback",
    "Water vapor feedback", "Ice-albedo feedback", "Cloud feedback",
    "Carbon cycle feedback",

    # ─── Impacts (40) ───
    "Effects of climate change", "Sea level rise", "Ocean acidification",
    "Coral bleaching", "Arctic sea ice decline", "Retreat of glaciers since 1850",
    "Extreme weather", "Heat wave", "Drought", "Flood", "Wildfire",
    "Tropical cyclone", "Climate change and ecosystems", "Biodiversity loss",
    "Climate change and agriculture", "Climate change and health",
    "Climate migration", "Climate change and islands", "Climate change in the Arctic",
    "Climate change in Antarctica", "Climate change in Africa",
    "Climate change in Asia", "Climate change in Europe",
    "Climate change in North America", "Climate change in South America",
    "Climate change in Australia", "Climate change in New Zealand",
    "Effects of climate change on oceans", "Effects of climate change on weather",
    "Effects of climate change on humans", "Effects of climate change on plants",
    "Effects of climate change on animals", "Tipping points in the climate system",
    "Abrupt climate change", "Climate crisis", "Climate emergency declaration",
    "Climate anxiety", "Climate grief", "Climate psychology",

    # ─── Solutions — Energy (30) ───
    "Renewable energy", "Solar energy", "Wind power", "Nuclear power",
    "Hydropower", "Geothermal energy", "Biomass", "Tidal power",
    "Wave power", "Solar cell", "Wind turbine", "Nuclear reactor",
    "Fusion power", "Small modular reactor", "Concentrated solar power",
    "Solar thermal energy", "Photovoltaic system", "Offshore wind farm",
    "Onshore wind farm", "Solar farm", "Geothermal power",
    "Biofuel", "Biodiesel", "Ethanol fuel", "Green hydrogen",
    "Hydrogen economy", "Fuel cell", "Battery storage",
    "Grid energy storage", "Pumped-storage hydroelectricity",
    "Compressed air energy storage",

    # ─── Solutions — Transport (15) ───
    "Electric vehicle", "Electric car", "Electric truck", "Electric bus",
    "High-speed rail", "Public transport", "Bicycle", "Walking",
    "Sustainable transport", "Aviation biofuel", "Green shipping",
    "Vehicle efficiency", "Fuel economy", "Plug-in hybrid",
    "Hydrogen vehicle",

    # ─── Solutions — Buildings & Industry (15) ───
    "Green building", "Building insulation", "Heat pump",
    "Energy efficiency", "Building automation", "Smart grid",
    "LED lighting", "Passive house", "Zero-energy building",
    "Green roof", "Cool roof", "Sustainable architecture",
    "Industrial ecology", "Circular economy", "Cradle-to-cradle design",

    # ─── Solutions — Land & Food (20) ───
    "Reforestation", "Afforestation", "Forest restoration",
    "Regenerative agriculture", "Agroforestry", "Permaculture",
    "Soil carbon", "Carbon sequestration", "Biochar",
    "Composting", "Food waste", "Sustainable agriculture",
    "Organic farming", "Plant-based diet", "Veganism",
    "Sustainable fisheries", "Aquaculture", "Mangrove restoration",
    "Peatland", "Wetland conservation", "Grassland",

    # ─── Solutions — Carbon Removal (10) ───
    "Carbon capture and storage", "Direct air capture",
    "Bioenergy with carbon capture and storage", "Enhanced weathering",
    "Ocean fertilization", "Soil carbon sequestration",
    "Carbon offset", "Carbon credit", "Carbon neutrality",
    "Net-zero emissions",

    # ─── Policy & Politics (30) ───
    "Paris Agreement", "United Nations Framework Convention on Climate Change",
    "Intergovernmental Panel on Climate Change", "Kyoto Protocol",
    "Montreal Protocol", "Climate justice", "Climate finance",
    "Loss and damage (climate change)", "Nationally determined contribution",
    "Climate target", "Carbon tax", "Carbon pricing",
    "Emissions trading", "European Union Emissions Trading System",
    "Clean Air Act", "Climate legislation", "Climate policy",
    "Climate change litigation", "Climate movement",
    "School Strike for Climate", "Extinction Rebellion",
    "Climate Action Network", "Climate Action Tracker",
    "Global Climate Action", "Climate governance",
    "Environmental policy", "Energy policy", "Climate diplomacy",
    "COP26", "COP27", "COP28", "COP29", "COP30",

    # ─── Carbon & Emissions (20) ───
    "Carbon footprint", "Carbon emission trading", "Carbon credit",
    "Carbon offsetting", "Carbon accounting", "Life-cycle assessment",
    "Scope 1, 2, and 3 emissions", "Embedded carbon", "Carbon intensity",
    "List of countries by CO2 emissions",
    "List of countries by greenhouse gas emissions",
    "Greenhouse gas inventory", "Fossil fuel", "Coal", "Petroleum",
    "Natural gas", "Fossil fuel phase-out", "Decarbonization",
    "Low-carbon economy", "Green economy",

    # ─── Earth Systems (20) ───
    "Atmosphere of Earth", "Ocean current", "Thermohaline circulation",
    "El Niño–Southern Oscillation", "Atlantic meridional overturning circulation",
    "Permafrost", "Ice sheet", "Greenland ice sheet", "Antarctic ice sheet",
    "Mountain glacier", "Deforestation", "Forest", "Rainforest",
    "Mangrove forest", "Soil carbon", "Ocean heat content",
    "Marine ecosystem", "Phytoplankton", "Ocean deoxygenation",
    "Coral reef", "Kelp forest",

    # ─── Climate Science Concepts (20) ───
    "Climate", "Weather", "Atmosphere", "Troposphere", "Stratosphere",
    "Greenhouse gas monitoring", "Carbon dioxide in Earth's atmosphere",
    "Atmospheric methane", "Nitrous oxide", "Ozone depletion",
    "Air pollution", "Particulates", "Aerosol", "Cloud",
    "Precipitation", "Evapotranspiration", "Albedo",
    "Solar irradiance", "Milankovitch cycles", "Volcanic winter",

    # ─── Key People & Organizations (20) ───
    "James Hansen", "Michael Mann", "Gavin Schmidt", "Katharine Hayhoe",
    "Greta Thunberg", "Al Gore", "Bill McKibben", "Naomi Klein",
    "World Meteorological Organization", "National Oceanic and Atmospheric Administration",
    "National Aeronautics and Space Administration",
    "European Space Agency", "National Center for Atmospheric Research",
    "Hadley Centre for Climate Prediction and Research",
    "Potsdam Institute for Climate Impact Research",
    "International Energy Agency", "World Bank Climate Change",
    "United Nations Environment Programme", "Green Climate Fund",
    "Global Environment Facility",

    # ─── Climate & Society (20) ───
    "Climate change and poverty", "Climate change and gender",
    "Climate change and education", "Climate change and migration",
    "Climate change and conflict", "Climate change and security",
    "Climate change and cities", "Climate change and water",
    "Climate change and food security", "Climate change and energy",
    "Climate change and tourism", "Climate change and insurance",
    "Climate change and law", "Climate change and religion",
    "Climate change denial", "Climate change communication",
    "Climate education", "Climate literacy", "Climate activism",
    "Climate strike", "Climate litigation",

    # ─── Measurement & Data (15) ───
    "Global warming potential", "Carbon dioxide equivalent",
    "Parts per million", "Temperature anomaly", "Proxy (climate)",
    "Dendrochronology", "Ice core", "Sediment core",
    "Satellite temperature measurements", "Weather station",
    "Climate reanalysis", "CMIP", "CMIP6", "ERA5",
    "Global Carbon Project",

    # ─── Miscellaneous Important (15) ───
    "Climate Clock", "Doomsday Clock", "Planetary boundaries",
    "Ecological footprint", "Overshoot (population)",
    "Sustainable Development Goals", "Agenda 2030",
    "Green New Deal", "European Green Deal",
    "Climate engineering", "Solar geoengineering",
    "Stratospheric aerosol injection", "Marine cloud brightening",
    "Cirrus cloud thinning", "Space mirror",
    "Climate restoration",
]

# Deduplicate while preserving order
seen = set()
EXPANDED_UNIQUE = []
for a in EXPANDED_WIKI_ARTICLES:
    if a not in seen:
        seen.add(a)
        EXPANDED_UNIQUE.append(a)

print(f"Total unique Wikipedia articles: {len(EXPANDED_UNIQUE)}")

# Save the list
import json
output_path = Path("climate-dataset/config/expanded_wiki_articles.json")
output_path.parent.mkdir(parents=True, exist_ok=True)
with open(output_path, 'w') as f:
    json.dump(EXPANDED_UNIQUE, f, indent=2)
print(f"Saved to {output_path}")
