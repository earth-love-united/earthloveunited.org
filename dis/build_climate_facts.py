#!/usr/bin/env python3
"""
Climate Facts Generator v1.0
Creates structured, sourced climate data entries.
Every fact must have: value, unit, source, year, confidence.
No opinions. No speculation. No "some researchers suggest."
Only peer-reviewed, institutional, or directly measured data.
"""

import json
from pathlib import Path
from datetime import datetime

OUTPUT_PATH = Path("/Users/ekmelozdemir/earthloveunited.org/dis/climate-facts.json")

# ═══════════════════════════════════════════════════════
# CLIMATE FACTS DATABASE
# Every entry: value, unit, source, year, confidence
# Sources: IPCC AR6, NOAA, NASA, Global Carbon Project, IEA, UNEP
# Confidence: very_high (multiple peer-reviewed), high (single study/institutional), medium (emerging)
# ═══════════════════════════════════════════════════════

FACTS = {

    # ═══ ATMOSPHERIC CONCENTRATIONS ═══
    "atmospheric_co2_current": {
        "value": 431.12,
        "unit": "ppm",
        "source": "NOAA GML Mauna Loa",
        "year": 2026,
        "confidence": "very_high",
        "note": "April 2026 monthly average"
    },
    "atmospheric_co2_preindustrial": {
        "value": 280,
        "unit": "ppm",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high",
        "note": "1750 baseline from ice cores"
    },
    "atmospheric_co2_annual_increase": {
        "value": 2.7,
        "unit": "ppm/year",
        "source": "NOAA GML",
        "year": 2025,
        "confidence": "very_high",
        "note": "10-year average"
    },
    "atmospheric_methane_current": {
        "value": 1940,
        "unit": "ppb",
        "source": "NOAA GML",
        "year": 2026,
        "confidence": "very_high",
        "note": "January 2026"
    },
    "atmospheric_methane_preindustrial": {
        "value": 722,
        "unit": "ppb",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "atmospheric_n2o_current": {
        "value": 339.7,
        "unit": "ppb",
        "source": "NOAA GML",
        "year": 2026,
        "confidence": "very_high"
    },

    # ═══ GLOBAL TEMPERATURE ═══
    "global_temp_anomaly_vs_preindustrial": {
        "value": 1.38,
        "unit": "°C",
        "source": "NASA GISS",
        "year": 2025,
        "confidence": "very_high",
        "note": "Relative to 1951-1980 baseline; ~1.3°C vs pre-industrial"
    },
    "global_temp_anomaly_vs_1850_1900": {
        "value": 1.2,
        "unit": "°C",
        "source": "IPCC AR6 WGI SPM",
        "year": 2021,
        "confidence": "very_high",
        "note": "Best estimate for 2011-2020 average"
    },
    "warming_rate_per_decade": {
        "value": 0.2,
        "unit": "°C/decade",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high",
        "note": "Rate since 1970"
    },
    "arctic_warming_multiplier": {
        "value": 3.5,
        "unit": "x global average",
        "source": "IPCC AR6 WGI Chapter 2",
        "year": 2021,
        "confidence": "very_high",
        "note": "Arctic warming 3-4x faster than global mean"
    },

    # ═══ CARBON BUDGET ═══
    "remaining_carbon_budget_1.5c_50pct": {
        "value": 250,
        "unit": "Gt CO2",
        "source": "IPCC AR6 WGIII / Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "high",
        "note": "From start of 2025, 50% probability"
    },
    "remaining_carbon_budget_2c_67pct": {
        "value": 1200,
        "unit": "Gt CO2",
        "source": "IPCC AR6 WGIII",
        "year": 2021,
        "confidence": "high",
        "note": "From start of 2020"
    },
    "annual_fossil_emissions_2023": {
        "value": 37.8,
        "unit": "Gt CO2/year",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high"
    },
    "annual_fossil_emissions_2025_projected": {
        "value": 38.2,
        "unit": "Gt CO2/year",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "high",
        "note": "Projected +1.1% vs 2023"
    },
    "annual_land_use_emissions": {
        "value": 3.6,
        "unit": "Gt CO2/year",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "high"
    },
    "ocean_carbon_sink_annual": {
        "value": 2.5,
        "unit": "GtC/year",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "high"
    },
    "land_carbon_sink_annual": {
        "value": 3.4,
        "unit": "GtC/year",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "high"
    },
    "airborne_fraction": {
        "value": 0.44,
        "unit": "ratio",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "high",
        "note": "44% of emissions remain in atmosphere"
    },

    # ═══ SEA LEVEL ═══
    "sea_level_rise_rate_current": {
        "value": 4.5,
        "unit": "mm/year",
        "source": "NASA / IPCC AR6 WGI",
        "year": 2023,
        "confidence": "very_high",
        "note": "Satellite altimetry 2014-2023 average"
    },
    "sea_level_rise_rate_1901_1971": {
        "value": 1.3,
        "unit": "mm/year",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "sea_level_rise_total_since_1900": {
        "value": 20,
        "unit": "cm",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "sea_level_projection_2100_ssp245": {
        "value": 0.5,
        "unit": "m",
        "source": "IPCC AR6 WGI SPM",
        "year": 2021,
        "confidence": "medium",
        "note": "Likely range 0.4-0.8m"
    },
    "sea_level_projection_2100_ssp585": {
        "value": 0.8,
        "unit": "m",
        "source": "IPCC AR6 WGI SPM",
        "year": 2021,
        "confidence": "medium",
        "note": "Likely range 0.6-1.0m"
    },
    "greenland_ice_sheet_mass_loss_annual": {
        "value": 270,
        "unit": "Gt/year",
        "source": "GRACE/GRACE-FO / IPCC AR6 WGI",
        "year": 2023,
        "confidence": "very_high",
        "note": "2002-2023 average"
    },
    "antarctic_ice_sheet_mass_loss_annual": {
        "value": 150,
        "unit": "Gt/year",
        "source": "GRACE/GRACE-FO / IPCC AR6 WGI",
        "year": 2023,
        "confidence": "very_high",
        "note": "2002-2023 average"
    },

    # ═══ CARBON POOLS ═══
    "atmosphere_carbon_pool": {
        "value": 870,
        "unit": "GtC",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "atmosphere_carbon_pool_preindustrial": {
        "value": 590,
        "unit": "GtC",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "ocean_surface_carbon_pool": {
        "value": 900,
        "unit": "GtC",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "ocean_deep_carbon_pool": {
        "value": 37100,
        "unit": "GtC",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "terrestrial_vegetation_carbon_pool": {
        "value": 550,
        "unit": "GtC",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "high",
        "note": "Range 450-650 GtC"
    },
    "soil_organic_carbon_pool": {
        "value": 1500,
        "unit": "GtC",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "high",
        "note": "Range 1500-2400 GtC, top 1m"
    },
    "permafrost_carbon_pool": {
        "value": 1700,
        "unit": "GtC",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "high",
        "note": "Range 1400-1700 GtC, top 3m"
    },
    "fossil_fuel_reserves_carbon": {
        "value": 4000,
        "unit": "GtC",
        "source": "IPCC AR6 WGIII",
        "year": 2021,
        "confidence": "high",
        "note": "Coal only. Total fossil reserves ~4,700+ GtC"
    },

    # ═══ ECOSYSTEM CARBON DATA ═══
    "mangrove_carbon_sequestration_rate": {
        "value": 6.3,
        "unit": "tCO2/ha/year",
        "source": "Donato et al. 2011, Nature Geoscience",
        "year": 2011,
        "confidence": "high",
        "note": "Average across tropical mangroves. Range 2-10."
    },
    "mangrove_global_area": {
        "value": 15,
        "unit": "million hectares",
        "source": "Global Mangrove Watch",
        "year": 2020,
        "confidence": "high"
    },
    "mangrove_total_carbon_stock": {
        "value": 6.5,
        "unit": "GtC",
        "source": "Donato et al. 2011",
        "year": 2011,
        "confidence": "high",
        "note": "Above and below ground biomass + soil"
    },
    "mangrove_global_loss_since_1980": {
        "value": 35,
        "unit": "%",
        "source": "Goldberg et al. 2020, Nature",
        "year": 2020,
        "confidence": "high"
    },
    "seagrass_carbon_burial_rate": {
        "value": 83,
        "unit": "gC/m2/year",
        "source": "Fourqurean et al. 2012, Nature Geoscience",
        "year": 2012,
        "confidence": "high",
        "note": "Global average. 35x faster than tropical forests per area."
    },
    "seagrass_global_area": {
        "value": 300000,
        "unit": "km2",
        "source": "UNEP",
        "year": 2020,
        "confidence": "medium",
        "note": "Highly uncertain, range 160,000-600,000 km2"
    },
    "seagrass_global_loss_rate": {
        "value": 7,
        "unit": "%/year",
        "source": "Waycott et al. 2009, PNAS",
        "year": 2009,
        "confidence": "medium",
        "note": "Rate has been accelerating"
    },
    "peatland_global_area": {
        "value": 400,
        "unit": "million hectares",
        "source": "Global Peatland Initiative / UNEP",
        "year": 2022,
        "confidence": "high"
    },
    "peatland_carbon_stock": {
        "value": 600,
        "unit": "GtC",
        "source": "IPCC AR6 WGI / Xu et al. 2018",
        "year": 2018,
        "confidence": "high",
        "note": "Twice the carbon of all forests combined"
    },
    "peatland_drained_fraction": {
        "value": 15,
        "unit": "%",
        "source": "UNEP Global Peatlands Assessment",
        "year": 2022,
        "confidence": "high"
    },
    "peatland_annual_emissions_drained": {
        "value": 1.9,
        "unit": "Gt CO2/year",
        "source": "UNEP Global Peatlands Assessment",
        "year": 2022,
        "confidence": "high",
        "note": "From drained peatlands alone"
    },
    "biochar_carbon_stability": {
        "value": 1000,
        "unit": "years",
        "source": "Lehmann et al. 2006, Nature Communications",
        "year": 2006,
        "confidence": "high",
        "note": "Mean residence time for most biochar"
    },
    "biochar_global_potential": {
        "value": 2,
        "unit": "Gt CO2/year",
        "source": "Project Drawdown / Woolf et al. 2010",
        "year": 2020,
        "confidence": "medium",
        "note": "Technical potential, limited by biomass availability"
    },
    "biochar_carbon_content": {
        "value": 70,
        "unit": "% of feedstock carbon retained",
        "source": "International Biochar Initiative",
        "year": 2020,
        "confidence": "high",
        "note": "Typical range 50-90% depending on pyrolysis temp"
    },
    "hemp_carbon_sequestration_rate": {
        "value": 1.5,
        "unit": "tCO2/ton dry biomass",
        "source": "Carus & Sarmento 2016, European Industrial Hemp Association",
        "year": 2016,
        "confidence": "high"
    },
    "hemp_growth_cycle": {
        "value": 120,
        "unit": "days",
        "source": "Amaducci et al. 2015, Industrial Crops and Products",
        "year": 2015,
        "confidence": "high",
        "note": "From seed to harvest"
    },
    "hemp_yield_dry_biomass": {
        "value": 10,
        "unit": "tonnes/ha/year",
        "source": "Carus & Sarmento 2016",
        "year": 2016,
        "confidence": "high",
        "note": "Range 5-15 depending on climate and variety"
    },
    "hempcrete_carbon_storage": {
        "value": 110,
        "unit": "kg CO2/m3",
        "source": "Arehart et al. 2020, Journal of Building Engineering",
        "year": 2020,
        "confidence": "high",
        "note": "Net carbon stored in hempcrete wall material"
    },
    "kelp_growth_rate": {
        "value": 0.5,
        "unit": "m/day",
        "source": "Mann 1973, Science / Buschmann et al. 2017",
        "year": 2017,
        "confidence": "high",
        "note": "Giant kelp (Macrocystis). Range 0.3-0.6 m/day."
    },
    "kelp_global_primary_production": {
        "value": 1.3,
        "unit": "GtC/year",
        "source": "Krause-Jensen & Duarte 2016, Nature Geoscience",
        "year": 2016,
        "confidence": "high"
    },
    "coral_reef_global_area": {
        "value": 284000,
        "unit": "km2",
        "source": "Global Coral Reef Monitoring Network",
        "year": 2021,
        "confidence": "high"
    },
    "coral_reef_species_supported": {
        "value": 25,
        "unit": "% of marine species",
        "source": "Fisher et al. 2015, Current Biology",
        "year": 2015,
        "confidence": "high",
        "note": "Despite covering <0.1% of ocean floor"
    },
    "coral_reef_bleaching_threshold": {
        "value": 1.5,
        "unit": "°C above normal max",
        "source": "Hughes et al. 2018, Science",
        "year": 2018,
        "confidence": "high",
        "note": "Sustained for 4+ weeks causes bleaching"
    },
    "coral_reef_economic_value_annual": {
        "value": 375,
        "unit": "USD billion/year",
        "source": "Spalding et al. 2017, Marine Policy",
        "year": 2017,
        "confidence": "medium",
        "note": "Tourism, fisheries, coastal protection"
    },
    "permafrost_area_global": {
        "value": 23,
        "unit": "million km2",
        "source": "NSIDC / IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high",
        "note": "Northern hemisphere only"
    },
    "permafrost_thaw_rate": {
        "value": 0.5,
        "unit": "°C increase in permafrost temp per decade",
        "source": "Biskaborn et al. 2019, Nature Communications",
        "year": 2019,
        "confidence": "high"
    },
    "permafrost_carbon_release_projection_2100": {
        "value": 130,
        "unit": "GtC",
        "source": "Schuur et al. 2015, Nature",
        "year": 2015,
        "confidence": "medium",
        "note": "Under RCP8.5. Range 50-200 GtC."
    },

    # ═══ SOLUTIONS — ENERGY ═══
    "solar_lcoe_2024": {
        "value": 49,
        "unit": "USD/MWh",
        "source": "IRENA Renewable Power Generation Costs 2024",
        "year": 2024,
        "confidence": "very_high",
        "note": "Utility-scale solar PV, global weighted average"
    },
    "wind_lcoe_2024": {
        "value": 42,
        "unit": "USD/MWh",
        "source": "IRENA Renewable Power Generation Costs 2024",
        "year": 2024,
        "confidence": "very_high",
        "note": "Onshore wind, global weighted average"
    },
    "coal_lcoe_2024": {
        "value": 117,
        "unit": "USD/MWh",
        "source": "IRENA / Lazard LCOE v17",
        "year": 2024,
        "confidence": "high",
        "note": "New coal plant, global average"
    },
    "solar_cost_reduction_since_2010": {
        "value": 89,
        "unit": "%",
        "source": "IRENA",
        "year": 2024,
        "confidence": "very_high",
        "note": "LCOE reduction from $0.381 to $0.049/kWh"
    },
    "wind_cost_reduction_since_2010": {
        "value": 70,
        "unit": "%",
        "source": "IRENA",
        "year": 2024,
        "confidence": "very_high"
    },
    "battery_cost_reduction_since_2010": {
        "value": 90,
        "unit": "%",
        "source": "Bloomberg NEF",
        "year": 2024,
        "confidence": "very_high",
        "note": "Lithium-ion battery pack prices"
    },
    "global_renewable_capacity_2024": {
        "value": 4200,
        "unit": "GW",
        "source": "IRENA",
        "year": 2024,
        "confidence": "very_high"
    },
    "ev_sales_share_global_2024": {
        "value": 22,
        "unit": "% of new car sales",
        "source": "IEA Global EV Outlook 2025",
        "year": 2025,
        "confidence": "very_high"
    },

    # ═══ SOLUTIONS — CARBON REMOVAL ═══
    "dac_current_global_capacity": {
        "value": 0.01,
        "unit": "Mt CO2/year",
        "source": "IEA Direct Air Capture Report 2024",
        "year": 2024,
        "confidence": "very_high",
        "note": "Operational capacity as of 2024"
    },
    "dac_cost_current": {
        "value": 600,
        "unit": "USD/tCO2",
        "source": "IEA / McQueen et al. 2021, Joule",
        "year": 2024,
        "confidence": "high",
        "note": "Range 250-1000 USD/tCO2 depending on technology"
    },
    "dac_cost_projected_2050": {
        "value": 100,
        "unit": "USD/tCO2",
        "source": "IEA Net Zero by 2050",
        "year": 2021,
        "confidence": "medium",
        "note": "Optimistic projection with scale-up"
    },
    "reforestation_potential": {
        "value": 3.6,
        "unit": "Gt CO2/year",
        "source": "Bastin et al. 2019, Science",
        "year": 2019,
        "confidence": "medium",
        "note": "Technical potential on 0.9 billion hectares"
    },
    "soil_carbon_sequestration_potential": {
        "value": 2.5,
        "unit": "Gt CO2/year",
        "source": "IPCC SRCCL / Paustian et al. 2016",
        "year": 2019,
        "confidence": "medium",
        "note": "Technical potential, 20 year timeframe"
    },
    "enhanced_weathering_potential": {
        "value": 2,
        "unit": "Gt CO2/year",
        "source": "Beerling et al. 2020, Nature",
        "year": 2020,
        "confidence": "medium",
        "note": "Technical potential on cropland"
    },

    # ═══ EMISSIONS BY SECTOR ═══
    "emissions_share_energy_electricity": {
        "value": 38,
        "unit": "% of global CO2",
        "source": "IPCC AR6 WGIII",
        "year": 2022,
        "confidence": "very_high"
    },
    "emissions_share_transport": {
        "value": 24,
        "unit": "% of global CO2",
        "source": "IPCC AR6 WGIII",
        "year": 2022,
        "confidence": "very_high"
    },
    "emissions_share_industry": {
        "value": 21,
        "unit": "% of global CO2",
        "source": "IPCC AR6 WGIII",
        "year": 2022,
        "confidence": "very_high"
    },
    "emissions_share_buildings": {
        "value": 9,
        "unit": "% of global CO2",
        "source": "IPCC AR6 WGIII",
        "year": 2022,
        "confidence": "very_high"
    },
    "emissions_share_agriculture": {
        "value": 10,
        "unit": "% of global CO2",
        "source": "IPCC AR6 WGIII",
        "year": 2022,
        "confidence": "very_high",
        "note": "Direct agricultural emissions only"
    },
    "emissions_share_land_use": {
        "value": 8,
        "unit": "% of global CO2",
        "source": "IPCC AR6 WGIII",
        "year": 2022,
        "confidence": "very_high",
        "note": "Deforestation, land use change"
    },

    # ═══ TOP EMITTERS 2023 ═══
    "china_annual_emissions": {
        "value": 11.9,
        "unit": "Gt CO2",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high",
        "note": "31.4% of global total"
    },
    "us_annual_emissions": {
        "value": 4.9,
        "unit": "Gt CO2",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high",
        "note": "13.0% of global total"
    },
    "india_annual_emissions": {
        "value": 3.1,
        "unit": "Gt CO2",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high",
        "note": "8.1% of global total"
    },
    "eu_annual_emissions": {
        "value": 2.7,
        "unit": "Gt CO2",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high",
        "note": "7.1% of global total"
    },
    "russia_annual_emissions": {
        "value": 1.8,
        "unit": "Gt CO2",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high",
        "note": "4.8% of global total"
    },
    "us_per_capita_emissions": {
        "value": 14.3,
        "unit": "t CO2/person",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high"
    },
    "china_per_capita_emissions": {
        "value": 8.4,
        "unit": "t CO2/person",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high"
    },
    "india_per_capita_emissions": {
        "value": 2.1,
        "unit": "t CO2/person",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high"
    },
    "global_per_capita_emissions": {
        "value": 4.7,
        "unit": "t CO2/person",
        "source": "Global Carbon Budget 2025",
        "year": 2025,
        "confidence": "very_high"
    },

    # ═══ CLIMATE SENSITIVITY ═══
    "equilibrium_climate_sensitivity_best_estimate": {
        "value": 3.0,
        "unit": "°C per 2xCO2",
        "source": "IPCC AR6 WGI SPM",
        "year": 2021,
        "confidence": "high",
        "note": "Likely range 2.5-4.0°C"
    },
    "transient_climate_response": {
        "value": 1.8,
        "unit": "°C per 2xCO2",
        "source": "IPCC AR6 WGI SPM",
        "year": 2021,
        "confidence": "high",
        "note": "Likely range 1.4-2.2°C"
    },
    "co2_doubling_warming": {
        "value": 1.1,
        "unit": "°C",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high",
        "note": "Direct warming from CO2 doubling alone (no feedbacks)"
    },

    # ═══ TIPPING POINTS ═══
    "greenland_ice_sheet_tipping_threshold": {
        "value": 1.5,
        "unit": "°C above pre-industrial",
        "source": "IPCC AR6 WGI / Robinson et al. 2012",
        "year": 2021,
        "confidence": "medium",
        "note": "Range 1.0-3.0°C. Irreversible over millennia."
    },
    "west_antarctic_ice_sheet_tipping_threshold": {
        "value": 1.5,
        "unit": "°C above pre-industrial",
        "source": "IPCC AR6 WGI / Armstrong McKay et al. 2022",
        "year": 2022,
        "confidence": "medium",
        "note": "Marine ice sheet instability may already be triggered"
    },
    "amazon_rainforest_tipping_threshold": {
        "value": 2.0,
        "unit": "°C above pre-industrial",
        "source": "Boulton et al. 2022, Nature Climate Change",
        "year": 2022,
        "confidence": "medium",
        "note": "Combined with deforestation. Range 2.0-3.5°C."
    },
    "amoc_tipping_threshold": {
        "value": 1.5,
        "unit": "°C above pre-industrial",
        "source": "Ditlevsen & Ditlevsen 2023, Nature Communications",
        "year": 2023,
        "confidence": "medium",
        "note": "Could collapse as early as 2025-2095"
    },
    "permafrost_tipping_threshold": {
        "value": 1.5,
        "unit": "°C above pre-industrial",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "medium",
        "note": "Widespread thaw begins. Range 1.0-2.3°C."
    },
    "coral_reef_tipping_threshold": {
        "value": 1.5,
        "unit": "°C above pre-industrial",
        "source": "IPCC AR6 WGII",
        "year": 2022,
        "confidence": "high",
        "note": "70-90% loss at 1.5°C, >99% at 2.0°C"
    },

    # ═══ OCEAN ═══
    "ocean_ph_current": {
        "value": 8.05,
        "unit": "pH",
        "source": "IPCC AR6 WGI / Doney et al. 2020",
        "year": 2020,
        "confidence": "very_high"
    },
    "ocean_ph_preindustrial": {
        "value": 8.21,
        "unit": "pH",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high"
    },
    "ocean_acidification_since_preindustrial": {
        "value": 30,
        "unit": "% increase in H+ ions",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high",
        "note": "pH drop from 8.21 to 8.05"
    },
    "ocean_heat_content_increase_rate": {
        "value": 0.9,
        "unit": "W/m2",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high",
        "note": "Ocean heat uptake rate, 2006-2018 average"
    },

    # ═══ ICE ═══
    "arctic_sea_ice_september_minimum_trend": {
        "value": 13,
        "unit": "% per decade",
        "source": "NSIDC / IPCC AR6 WGI",
        "year": 2021,
        "confidence": "very_high",
        "note": "Decline in September minimum extent since 1979"
    },
    "arctic_sea_ice_free_summer_projection": {
        "value": 2050,
        "unit": "year",
        "source": "IPCC AR6 WGI",
        "year": 2021,
        "confidence": "medium",
        "note": "First ice-free September likely before 2050 under all scenarios"
    },
    "mountain_glacier_mass_loss_rate": {
        "value": 267,
        "unit": "Gt/year",
        "source": "Hugonnet et al. 2021, Nature",
        "year": 2021,
        "confidence": "very_high",
        "note": "2000-2019 average, all mountain glaciers"
    },

    # ═══ CARBON PRICING ═══
    "eu_ets_price_2025": {
        "value": 70,
        "unit": "EUR/tCO2",
        "source": "European Energy Exchange",
        "year": 2025,
        "confidence": "very_high",
        "note": "Approximate average 2025 price"
    },
    "social_cost_of_carbon_us_estimate": {
        "value": 51,
        "unit": "USD/tCO2",
        "source": "US EPA 2023 estimate at 3% discount rate",
        "year": 2023,
        "confidence": "medium",
        "note": "Highly uncertain, range $15-$150+"
    },
    "global_carbon_pricing_coverage_2024": {
        "value": 23,
        "unit": "% of global emissions",
        "source": "World Bank Carbon Pricing Dashboard",
        "year": 2024,
        "confidence": "very_high"
    },

    # ═══ CLIMATE FINANCE ═══
    "climate_finance_annual_2023": {
        "value": 150,
        "unit": "USD billion",
        "source": "Climate Policy Initiative Global Landscape 2024",
        "year": 2024,
        "confidence": "high",
        "note": "Total climate finance, public and private"
    },
    "climate_finance_need_annual_2030": {
        "value": 1000,
        "unit": "USD billion",
        "source": "UNFCCC Standing Committee on Finance",
        "year": 2021,
        "confidence": "medium",
        "note": "Estimated need for developing countries alone"
    },
    "loss_and_damage_fund_pledged": {
        "value": 700,
        "unit": "USD million",
        "source": "UNFCCC COP28",
        "year": 2023,
        "confidence": "very_high",
        "note": "Initial pledges at COP28"
    },

    # ═══ POPULATION & DEVELOPMENT ═══
    "global_population_2025": {
        "value": 8.2,
        "unit": "billion",
        "source": "UN World Population Prospects 2024",
        "year": 2025,
        "confidence": "very_high"
    },
    "global_population_projection_2100": {
        "value": 10.4,
        "unit": "billion",
        "source": "UN World Population Prospects 2024",
        "year": 2024,
        "confidence": "medium",
        "note": "Median projection. Range 7-15 billion."
    },
    "urban_population_share_2025": {
        "value": 57,
        "unit": "%",
        "source": "UN World Urbanization Prospects",
        "year": 2025,
        "confidence": "very_high"
    },
    "urban_population_share_2050": {
        "value": 68,
        "unit": "%",
        "source": "UN World Urbanization Prospects",
        "year": 2024,
        "confidence": "high"
    },

    # ═══ FOOD SYSTEM ═══
    "food_system_emissions_share": {
        "value": 34,
        "unit": "% of global GHG",
        "source": "Crippa et al. 2021, Nature Food",
        "year": 2021,
        "confidence": "high",
        "note": "Full food system: production, processing, transport, waste"
    },
    "beef_carbon_intensity": {
        "value": 60,
        "unit": "kg CO2e/kg product",
        "source": "Poore & Nemecek 2018, Science",
        "year": 2018,
        "confidence": "high",
        "note": "Global average. Range 20-150 depending on production system."
    },
    "plant_based_protein_carbon_intensity": {
        "value": 3.5,
        "unit": "kg CO2e/kg product",
        "source": "Poore & Nemecek 2018, Science",
        "year": 2018,
        "confidence": "high",
        "note": "Average for legumes, tofu, plant-based proteins"
    },
    "food_waste_global": {
        "value": 1.3,
        "unit": "billion tonnes/year",
        "source": "UNEP Food Waste Index 2024",
        "year": 2024,
        "confidence": "high",
        "note": "Retail, food service, and household waste"
    },
    "food_waste_emissions_if_country": {
        "value": 8,
        "unit": "% of global GHG",
        "source": "UNEP",
        "year": 2024,
        "confidence": "high",
        "note": "If food waste were a country, it would be 3rd largest emitter"
    },

    # ═══ ENERGY ═══
    "global_primary_energy_2024": {
        "value": 14800,
        "unit": "Mtoe",
        "source": "IEA World Energy Outlook 2024",
        "year": 2024,
        "confidence": "very_high"
    },
    "fossil_fuel_share_primary_energy": {
        "value": 82,
        "unit": "%",
        "source": "IEA World Energy Outlook 2024",
        "year": 2024,
        "confidence": "very_high"
    },
    "renewable_share_electricity_2024": {
        "value": 30,
        "unit": "%",
        "source": "IEA Renewables 2024",
        "year": 2024,
        "confidence": "very_high"
    },
    "coal_share_electricity_2024": {
        "value": 35,
        "unit": "%",
        "source": "IEA Coal 2024",
        "year": 2024,
        "confidence": "very_high"
    },
}

# ─── Save ───
with open(OUTPUT_PATH, 'w') as f:
    json.dump(FACTS, f, indent=2, ensure_ascii=False)

size_kb = OUTPUT_PATH.stat().st_size / 1024
print(f"\nSaved {len(FACTS)} facts to {OUTPUT_PATH} ({size_kb:.0f} KB)")

# Stats
sources = set(f['source'] for f in FACTS.values())
confidence = {}
for f in FACTS.values():
    c = f['confidence']
    confidence[c] = confidence.get(c, 0) + 1

print(f"\nSources: {len(sources)}")
print(f"Confidence levels:")
for c, cnt in sorted(confidence.items(), key=lambda x: -x[1]):
    print(f"  {c}: {cnt}")

# Categorize
categories = {}
for key in FACTS:
    cat = key.split('_')[0]
    categories[cat] = categories.get(cat, 0) + 1

print(f"\nCategories:")
for cat, cnt in sorted(categories.items(), key=lambda x: -x[1]):
    print(f"  {cat}: {cnt}")
