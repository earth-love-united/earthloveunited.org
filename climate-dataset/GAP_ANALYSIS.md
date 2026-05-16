#!/usr/bin/env python3
"""
Research Gap Analysis & Enhancement Plan
Identifies what's missing from the current dataset and how to fill it.
"""

GAPS = {
    "climate_economics": {
        "priority": "HIGH",
        "current_coverage": "Minimal — a few Wikipedia mentions",
        "missing_topics": [
            "Carbon pricing and carbon tax",
            "Emissions trading systems (EU ETS, California, RGGI)",
            "Climate finance and green bonds",
            "Carbon border adjustment mechanism (CBAM)",
            "Loss and damage fund",
            "Nationally Determined Contributions (NDCs)",
            "COP decisions and Paris Agreement mechanisms",
            "Climate risk and financial disclosure (TCFD)",
            "Stranded assets and fossil fuel divestment",
            "Green taxonomy and sustainable finance",
        ],
        "sources": [
            "World Bank Climate Change Knowledge Portal",
            "UNFCCC NDC Registry",
            "European Commission CBAM documentation",
            "Carbon Pricing Leadership Coalition",
            "Climate Policy Initiative",
        ],
        "estimated_chunks": 500,
    },

    "regional_climate": {
        "priority": "HIGH",
        "current_coverage": "Minimal — no regional breakdown",
        "missing_topics": [
            "Turkey climate projections and vulnerability",
            "Mediterranean climate change impacts",
            "Sea level rise and coastal cities",
            "Regional temperature and precipitation changes",
            "Climate migration patterns",
            "Water scarcity and climate",
            "Urban heat islands",
            "Agricultural impacts by region",
        ],
        "sources": [
            "IPCC AR6 WGII Regional Chapters",
            "World Bank Climate Knowledge Portal (country pages)",
            "NASA NEO (regional satellite data)",
            "Copernicus Climate Change Service",
            "Turkish State Meteorological Service",
        ],
        "estimated_chunks": 800,
    },

    "biodiversity_nexus": {
        "priority": "HIGH",
        "current_coverage": "Minimal — basic Wikipedia articles only",
        "missing_topics": [
            "Ecosystem collapse and tipping points",
            "Coral reef bleaching and ocean warming",
            "Forest dieback and drought",
            "Species migration and range shifts",
            "Pollinator decline",
            "Ocean deoxygenation",
            "Mangrove and wetland loss",
            "Biodiversity-climate feedback loops",
            "Nature-based solutions and co-benefits",
            "Indigenous knowledge and biodiversity",
        ],
        "sources": [
            "IPBES Global Assessment",
            "IPCC AR6 WGII Chapter 2 (Ecosystems)",
            "IUCN Red List",
            "Global Forest Watch",
            "Coral Reef Alliance",
        ],
        "estimated_chunks": 600,
    },

    "climate_justice": {
        "priority": "HIGH",
        "current_coverage": "Minimal — mentioned in passing",
        "missing_topics": [
            "Historical emissions by country",
            "Climate equity and responsibility",
            "Frontline communities and environmental justice",
            "Climate migration and displacement",
            "Gender and climate change",
            "Intergenerational equity",
            "Climate litigation",
            "Just transition for workers",
            "Indigenous peoples and climate",
            "Loss and damage (beyond the fund)",
        ],
        "sources": [
            "Climate Justice Alliance",
            "UNFCCC Climate Finance reports",
            "Carbon Brief historical emissions data",
            "Climate Litigation Database",
            "IPCC AR6 WGIII Chapter 13 (International Cooperation)",
        ],
        "estimated_chunks": 400,
    },

    "solutions_deep_dive": {
        "priority": "MEDIUM",
        "current_coverage": "24 Drawdown solutions (good start)",
        "missing_topics": [
            "All 80+ Project Drawdown solutions",
            "Sector-by-sector mitigation pathways",
            "Technology readiness levels",
            "Cost curves for clean energy",
            "Grid-scale energy storage",
            "Green hydrogen economy",
            "Sustainable aviation fuels",
            "Building decarbonization",
            "Industrial decarbonization (steel, cement, chemicals)",
            "Food system transformation",
        ],
        "sources": [
            "Project Drawdown (full solutions library)",
            "IEA Net Zero by 2050 report",
            "IPCC AR6 WGIII mitigation pathways",
            "Bloomberg NEF",
            "Rocky Mountain Institute",
        ],
        "estimated_chunks": 1000,
    },

    "climate_science_deep": {
        "priority": "MEDIUM",
        "current_coverage": "Good — IPCC summaries, basic science",
        "missing_topics": [
            "Paleoclimate and deep time",
            "Carbon cycle feedbacks in detail",
            "Cloud feedbacks and uncertainty",
            "Ice sheet dynamics and sea level",
            "Ocean circulation changes",
            "Methane clathrates and permafrost carbon",
            "Solar radiation management research",
            "Carbon dioxide removal technologies (detailed)",
            "Climate modeling and projections",
            "Attribution science",
        ],
        "sources": [
            "IPCC AR6 WGI full report (not just SPM)",
            "RealClimate blog",
            "Carbon Brief explainers",
            "Skeptical Science (myth rebuttals)",
            "CMIP6 model documentation",
        ],
        "estimated_chunks": 800,
    },
}

print("=== RESEARCH GAP ANALYSIS ===\n")
total_new = 0
for domain, info in GAPS.items():
    print(f"\n{domain.upper().replace('_', ' ')}")
    print(f"  Priority: {info['priority']}")
    print(f"  Current: {info['current_coverage']}")
    print(f"  New chunks: ~{info['estimated_chunks']}")
    total_new += info['estimated_chunks']

print(f"\n{'='*50}")
print(f"Total new chunks needed: ~{total_new}")
print(f"Current dataset: 7,260 chunks")
print(f"Target dataset: ~{7260 + total_new:,} chunks")
print(f"\nRecommended approach:")
print(f"  Phase 1: Expand Wikipedia to 500+ articles (+3,000 chunks)")
print(f"  Phase 2: Add Project Drawdown full library (+800 chunks)")
print(f"  Phase 3: Add climate economics/policy content (+500 chunks)")
print(f"  Phase 4: Add regional climate data (+800 chunks)")
print(f"  Phase 5: Add biodiversity nexus (+600 chunks)")
print(f"  Phase 6: Add climate justice (+400 chunks)")
print(f"  Phase 7: Add climate science deep dives (+800 chunks)")
print(f"\n  Final target: ~14,000 chunks from 10+ sources")
