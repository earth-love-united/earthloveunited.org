# EARTH LOVE UNITED — CLIMATE AI DATA SOURCE COMPENDIUM
## The Definitive Guide to Climate Data Sources, APIs & Databases
## Version 1.0 | May 2026

---

# HOW TO USE THIS DOCUMENT

This is a ranked, evaluated catalog of the best climate and carbon data
sources available for building a climate AI system. Each source is rated
on: accessibility, data quality, coverage, update frequency, cost, and
AI-friendliness (how easy it is to feed into an LLM or agent system).

RATING SYSTEM:
  [★★★★★]  Essential — must-have for any climate AI
  [★★★★☆]  Highly recommended — fills important gaps
  [★★★☆☆]  Valuable — useful for specific use cases
  [★★☆☆☆]  Niche — specialized applications
  [★☆☆☆☆]  Reference — good to know, limited direct use

ACCESS TIERS:
  [FREE]       No authentication required
  [FREE+REG]   Free but requires registration/API key
  [PAID]       Commercial license required
  [RESTRICTED] Academic/government use only

---

# ═══ TIER 1: ESSENTIAL SOURCES (Start Here) ═══

## 1.1 NOAA Global Monitoring Laboratory (GML)
RATING: ★★★★★ | ACCESS: FREE | FORMAT: TXT/CSV

The single most important source for atmospheric greenhouse gas data.
This is where the Keeling Curve lives. Direct, no-auth CSV/TXT files.

ENDPOINTS (all confirmed working as of May 2026):
  CO2 monthly (Mauna Loa):
    https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt
    → 818 records, monthly, from 1958 to April 2026
    → Latest: 431.12 ppm (April 2026)

  CO2 annual (Mauna Loa):
    https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt

  CO2 global monthly mean:
    https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_gl.txt

  CH4 (methane) global monthly:
    https://gml.noaa.gov/webdata/ccgg/trends/ch4/ch4_mm_gl.txt
    → 511 records, latest: 1940.43 ppb (Jan 2026)

  N2O (nitrous oxide) global monthly:
    https://gml.noaa.gov/webdata/ccgg/trends/n2o/n2o_mm_gl.txt
    → 301 records, latest: 339.72 ppb (Jan 2026)

  SF6 global monthly:
    https://gml.noaa.gov/webdata/ccgg/trends/sf6/sf6_mm_gl.txt
    → 343 records, latest: 12.54 ppt (Jan 2026)

  CO2 growth rates:
    https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_gr_mlo.txt

AI USE CASES:
  - Real-time CO2 concentration tracking
  - "What's the CO2 level right now?" queries
  - Historical trend analysis
  - Growth rate calculations
  - GHG concentration comparisons

PROS: No auth, direct download, clean format, real-time, authoritative
CONS: Text format requires parsing, no JSON API
LATENCY: ~1-2 second download

---

## 1.2 Our World in Data (OWID) — CO2 Dataset
RATING: ★★★★★ | ACCESS: FREE | FORMAT: CSV

The most comprehensive country-level emissions dataset. 50,192 records,
79 columns, covers 200+ countries/territories from 1751 to 2023.

ENDPOINT:
  https://nyc3.digitaloceanspaces.com/owid-public/data/co2/owid-co2-data.csv

COLUMNS (key ones):
  country, year, iso_code, population, gdp, co2, co2_growth_abs,
  co2_growth_prct, co2_including_luc, co2_per_capita, coal_co2,
  oil_co2, gas_co2, cement_co2, cumulative_co2, cumulative_coal_co2,
  cumulative_oil_co2, cumulative_gas_co2, share_global_co2,
  temperature_change_from_co2, and 60+ more

AI USE CASES:
  - "What are the top CO2 emitting countries?"
  - "How has China's emissions changed over time?"
  - "What's the per-capita emissions of France?"
  - "Show me cumulative emissions by country"
  - Cross-country comparisons
  - Emissions per GDP analysis

PROS: Massive coverage, many derived metrics, no auth, single file
CONS: Annual only (no monthly), 2023 is latest year, large file (~15MB)
LATENCY: ~5 second download

---

## 1.3 Open-Meteo APIs
RATING: ★★★★★ | ACCESS: FREE | FORMAT: JSON

The best free weather and climate API available. No API key required
for non-commercial use. Multiple specialized endpoints.

### 1.3a Historical Weather API (ERA5 Reanalysis)
  https://archive-api.open-meteo.com/v1/archive
  → 1940 to present, global coverage, 0.25° resolution
  → Variables: temperature, precipitation, humidity, wind, pressure,
     cloud cover, soil moisture, evapotranspiration, and 50+ more
  → Hourly and daily resolution
  → Confirmed: 31,412 records for London 1940-2025

  EXAMPLE:
  https://archive-api.open-meteo.com/v1/archive?latitude=51.5&longitude=-0.1&start_date=1940-01-01&end_date=2025-12-31&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto

### 1.3b Weather Forecast API
  https://api.open-meteo.com/v1/forecast
  → 16-day forecast, hourly resolution
  → Current conditions + forecast
  → Confirmed working: real-time NYC weather

### 1.3c Seasonal Forecast API
  https://seasonal-api.open-meteo.com/v1/seasonal
  → 90-day seasonal forecast
  → 50 ensemble members (uncertainty quantification)
  → Confirmed: 120 records with ensemble spread

### 1.3d Ensemble Models API
  https://ensemble-api.open-meteo.com/v1/ensemble
  → Multiple weather models (GFS, ECMWF, UKMO, etc.)
  → 30 ensemble members
  → Confirmed working

### 1.3e Flood API (GloFAS)
  https://flood-api.open-meteo.com/v1/flood
  → River discharge data from GloFAS
  → 122 records confirmed
  → Useful for flood risk assessment

### 1.3f Geocoding API
  https://geocoding-api.open-meteo.com/v1/search
  → City/location search with coordinates
  → Confirmed: Istanbul search returns coordinates + population

### 1.3g Elevation API
  https://api.open-meteo.com/v1/elevation
  → Elevation for any lat/lon
  → Confirmed: Istanbul = 36m

### 1.3h Satellite Radiation API
  https://api.open-meteo.com/v1/forecast (with radiation variables)
  → Shortwave radiation, UV index, evapotranspiration (ET0)
  → Confirmed working

AI USE CASES:
  - "What's the weather in [city] right now?"
  - "Show me temperature trends in London since 1940"
  - "What was the hottest day in Berlin last year?"
  - "Compare rainfall between Tokyo and Mumbai"
  - "What's the flood risk for this river?"
  - Location-based climate context for any point on Earth

PROS: No auth, JSON format, multiple endpoints, global coverage,
      historical + forecast, ensemble data, very fast (<1s)
CONS: Climate Change API (CMIP6) returned 400 — may need specific params
RATE LIMIT: 10,000 calls/day (non-commercial, no key)

---

## 1.4 IEA Data API
RATING: ★★★★★ | ACCESS: FREE+REG | FORMAT: JSON

The International Energy Agency's open data API. The authoritative source
for energy-related CO2 emissions, energy mix, and energy statistics.

ENDPOINT:
  https://api.iea.org/stats/indicator/[INDICATOR]?countries=[COUNTRY]

KEY INDICATORS:
  CO2BySector     → CO2 emissions by sector (confirmed: 49,572 records)
  CO2BySource     → CO2 by energy source
  ElectricityGen  → Electricity generation by source
  EnergyBalance   → Total energy supply/consumption
  RenewableShare  → Renewable energy share

EXAMPLE:
  https://api.iea.org/stats/indicator/CO2BySector?countries=World

AI USE CASES:
  - "What sector emits the most CO2?"
  - "How much CO2 does electricity production generate?"
  - "What's the energy mix of Germany?"
  - "How fast are renewables growing?"

PROS: Authoritative, sector-level detail, country-level, JSON
CONS: Some endpoints return 404, registration recommended for heavy use
RATE LIMIT: Generous for registered users

---

## 1.5 NASA POWER API
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: JSON

NASA's Prediction of Worldwide Energy Resources. Global solar and
meteorological data, 0.5° resolution, 1984 to present.

ENDPOINT:
  https://power.larc.nasa.gov/api/temporal/daily/point

PARAMETERS: T2M (temperature), PRECTOT (precipitation),
  ALLSKY_SFC_SW_DWN (solar radiation), RH2M (humidity),
  WS10M (wind speed), and 30+ more

EXAMPLE:
  https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,PRECTOT,ALLSKY_SFC_SW_DWN&community=RE&longitude=0&latitude=0&start=20240101&end=20241231&format=JSON

AI USE CASES:
  - Solar energy potential for any location
  - Agricultural climate analysis
  - Renewable energy planning
  - Temperature/precipitation history

PROS: Global, long time series, solar-specific, JSON, no auth
CONS: 0.5° resolution (coarser than ERA5), daily only
LATENCY: ~2-3 seconds

---

# ═══ TIER 2: HIGHLY RECOMMENDED ═══

## 2.1 Global Carbon Budget (GCB)
RATING: ★★★★★ | ACCESS: FREE | FORMAT: PDF/CSV/Website

The definitive annual accounting of global carbon emissions and sinks.
Published each year at COP. Led by Prof. Pierre Friedlingstein (Exeter).

SOURCE: https://globalcarbonbudget.org/
DATA: https://globalcarbonbudget.org/gcb-2025/

KEY DATA (GCB 2025):
  - Global fossil CO2 emissions: 37.8 Gt CO2 (2023), projected +1.1% in 2025
  - Land use change emissions: ~3.6 Gt CO2
  - Ocean sink: ~2.5 GtC/year
  - Land sink: ~3.4 GtC/year
  - Airborne fraction: ~4.5 GtC/year

AI USE CASES:
  - "What's the latest global carbon budget?"
  - "How much CO2 do oceans absorb?"
  - "Are emissions still rising?"

PROS: Most authoritative carbon budget, peer-reviewed, annual update
CONS: Annual only, data extraction from PDF/website needed
NOTE: Direct CSV download links change yearly; scrape from website

---

## 2.2 EDGAR (Emissions Database for Global Atmospheric Research)
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: CSV/NetCDF

The EU Joint Research Centre's comprehensive GHG emissions database.
Covers CO2, CH4, N2O, and F-gases by sector and country.

SOURCE: https://edgar.jrc.ec.europa.eu/
LATEST VERSION: EDGAR v7.0 (covers 1970-2022)

DATA INCLUDES:
  - Country-level emissions by sector
  - Gridded global emissions (0.1° × 0.1°)
  - Monthly profiles (2000-2022)
  - All major GHGs

AI USE CASES:
  - "What are the emissions from cement production in India?"
  - "Show me methane emissions from agriculture by country"
  - Sector-level emissions breakdowns

PROS: Comprehensive, gridded data, sector detail, all GHGs
CONS: Complex download process, large files, 2022 is latest
NOTE: Website requires navigation; direct download links available

---

## 2.3 Global Forest Watch (GFW)
RATING: ★★★★☆ | ACCESS: FREE+REG | FORMAT: API/GeoJSON

The world's most comprehensive forest monitoring platform. Real-time
tree cover loss alerts, forest carbon data, and biodiversity indicators.

SOURCE: https://www.globalforestwatch.org/
API: https://data-api.globalforestwatch.org/

DATASETS:
  - Tree cover loss (2001-2025, annual, 30m resolution)
  - Tree cover gain (2000-2020)
  - Integrated deforestation alerts (near real-time)
  - Forest carbon stocks and emissions
  - Biodiversity areas
  - Fire alerts (VIIRS, near real-time)

AI USE CASES:
  - "How much forest was lost in Brazil last year?"
  - "Show me deforestation hotspots"
  - "What's the carbon impact of forest loss in Indonesia?"
  - Real-time fire monitoring

PROS: Near real-time, high resolution, multiple data layers, map-ready
CONS: API requires registration, some endpoints need auth
NOTE: API returned 403 in testing — registration required

---

## 2.4 Copernicus Climate Data Store (CDS)
RATING: ★★★★☆ | ACCESS: FREE+REG | FORMAT: NetCDF/GRIB/CSV

The European Union's massive climate data repository. ERA5 reanalysis
(the gold standard for historical climate data), seasonal forecasts,
climate projections.

SOURCE: https://cds.climate.copernicus.eu/
API: https://cds.climate.copernicus.eu/api/v2

KEY DATASETS:
  - ERA5 reanalysis (1940-present, 0.25°, hourly)
  - ERA5-Land (land surface, 0.1°, hourly)
  - Seasonal forecasts (monthly, 6-month lead)
  - CMIP6 climate projections (multiple scenarios)
  - CAMS atmospheric composition (aerosols, GHGs, air quality)
  - Fire danger indices
  - River discharge (GloFAS)
  - Ocean reanalysis (ORAS5)

AI USE CASES:
  - "What was the temperature in Paris on July 15, 2023?"
  - "Show me climate projections for 2050 under SSP2-4.5"
  - "What's the air quality forecast for London?"
  - Historical weather reconstruction for any point on Earth

PROS: Most comprehensive climate reanalysis, global, high resolution,
      multiple variables, projections included
CONS: Registration required, API has learning curve, large data volumes,
      NetCDF format requires specialized libraries
NOTE: Free registration, ~20GB/month download limit

---

## 2.5 World Bank Climate & Development Data
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: JSON/CSV

Comprehensive country-level climate, development, and emissions indicators.

API: https://api.worldbank.org/v2/

KEY INDICATORS:
  EN.ATM.CO2E.KT     → CO2 emissions (kt)
  EN.ATM.CO2E.PC      → CO2 per capita
  EN.ATM.GHGT.KT.CE   → Total GHG emissions
  EN.CLC.MDAT.ZS      → Climate risk index
  EG.ELC.RNEW.ZS      → Renewable electricity (%)
  EG.FEC.RNEW.ZS      → Renewable energy consumption (%)
  NY.GDP.MKTP.CD      → GDP (for emissions intensity)
  SP.POP.TOTL         → Population

EXAMPLE:
  https://api.worldbank.org/v2/country/all/indicator/EN.ATM.CO2E.KT?format=json&per_page=100&date=2020

AI USE CASES:
  - "What's the CO2 per capita of Nigeria?"
  - "How does GDP correlate with emissions?"
  - "Which countries have the highest renewable energy share?"
  - Development-climate nexus analysis

PROS: Country-level, long time series, many indicators, JSON API
CONS: API can be slow, some endpoints unreliable, data has gaps
NOTE: Climate Data API (climatedataapi.worldbank.org) appears deprecated;
      use main World Bank API instead

---

## 2.6 Global Carbon Atlas
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: Web/CSV

Interactive platform for exploring carbon fluxes. Country-level emissions
data with excellent visualization.

SOURCE: https://globalcarbonatlas.org/

DATA AVAILABLE:
  - Fossil CO2 emissions by country (1959-2023)
  - Land use change emissions
  - Per-capita emissions
  - Emissions by fuel type
  - Trade-adjusted emissions

AI USE CASES:
  - Country emissions comparisons
  - "How does my country compare?"
  - Historical emissions trends

PROS: Clean data, country-level, includes trade-adjusted emissions
CONS: Web-based (scraping needed), no direct API found
NOTE: Data can be extracted from the interactive charts

---

# ═══ TIER 3: VALUABLE SPECIALIZED SOURCES ═══

## 3.1 Berkeley Earth Temperature Data
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: CSV

Independent temperature dataset. Good cross-reference for NASA GISS
and Hadley Centre.

SOURCE: http://berkeleyearth.org/data/
GLOBAL: http://berkeleyearth.lbl.gov/auto/Global/Complete_TAVG_latest.txt

PROS: Independent verification, long time series, city-level data
CONS: Timed out in testing (may need retry), text format

---

## 3.2 Met Office Hadley Centre — HadCRUT5
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: CSV

One of the three major global temperature datasets (alongside NASA GISS
and NOAA NCEI).

SOURCE: https://www.metoffice.gov.uk/hadobs/hadcrut5/
DATA: https://www.metoffice.gov.uk/hadobs/hadcrut5/data/current/non-combined/

PROS: One of the three gold-standard temperature records
CONS: URL structure changed (404 in testing), check website for current links

---

## 3.3 NOAA National Centers for Environmental Information (NCEI)
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: CSV/JSON

Massive archive of climate and weather data. Global Historical
Climatology Network (GHCN), storm events, ocean data.

SOURCE: https://www.ncei.noaa.gov/
API: https://www.ncei.noaa.gov/access/services/data/v1

DATASETS:
  - GHCN-Daily: daily weather from 100,000+ stations worldwide
  - GHCN-Monthly: monthly summaries
  - Storm Events Database
  - Ocean temperature (OISST)
  - Sea level (tide gauges)
  - Paleoclimate data

AI USE CASES:
  - "What was the weather in Chicago on [date]?"
  - "Show me extreme weather events in Florida"
  - Historical weather station data

PROS: Enormous archive, station-level data, many variables
CONS: Complex API, large data volumes, requires careful querying

---

## 3.4 Global Biodiversity Information Facility (GBIF)
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: JSON

The world's largest biodiversity database. 2.9+ billion species
occurrence records. Essential for biodiversity-climate intersection.

API: https://api.gbif.org/v1/
EXAMPLE: https://api.gbif.org/v1/occurrence/search?limit=3&hasCoordinate=true

AI USE CASES:
  - "What species are found in this region?"
  - Biodiversity impact assessment
  - Species range shift analysis
  - Ecosystem health indicators

PROS: Massive dataset, global, JSON API, no auth for basic use
CONS: Not climate-specific, requires ecological expertise
NOTE: Confirmed working — 292M+ occurrences

---

## 3.5 FAO — Food and Agriculture Data
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: JSON/CSV

The UN Food and Agriculture Organization. Essential for agricultural
emissions, land use, food systems, and deforestation data.

SOURCE: https://www.fao.org/faostat/
API: https://fenixservices.fao.org/faostat/api/v1/

DATASETS:
  - GT: Greenhouse Gas Emissions from Agriculture
  - GF: Forestry Production and Trade
  - RL: Land Use
  - BC: Food Balance Sheets
  - QCL: Crops and Livestock Products

AI USE CASES:
  - "What are the emissions from rice production?"
  - "How much methane does livestock produce?"
  - "What's the deforestation rate in the Amazon?"
  - Food system emissions analysis

PROS: Authoritative, sector-specific, country-level
CONS: API can be slow, complex data structure

---

## 3.6 Climate Action Tracker
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: Web/JSON

Independent scientific analysis of government climate action. Tracks
whether countries are on track for Paris Agreement goals.

SOURCE: https://climateactiontracker.org/

DATA:
  - Country-by-country warming projections
  - Policy assessments
  - Emissions gap analysis
  - Net-zero tracker

AI USE CASES:
  - "Is Germany on track for 1.5°C?"
  - "What's the emissions gap?"
  - "Which countries have net-zero targets?"

PROS: Policy-relevant, country-level, regularly updated
CONS: No direct API (web scraping needed), 404 on API endpoint

---

## 3.7 Carbon Monitor
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: CSV

Near-real-time daily CO2 emissions data. Tracks emissions by country
and sector at daily resolution.

SOURCE: https://carbonmonitor.org/

DATA:
  - Daily CO2 emissions by country
  - Sector breakdown (power, industry, transport, aviation)
  - Near real-time (lagged by ~1 month)

AI USE CASES:
  - "How did COVID affect daily emissions?"
  - "What are today's emissions compared to 2019?"
  - Near-real-time emissions tracking

PROS: Daily resolution, near real-time, sector breakdown
CONS: Limited historical data (2019-present), website-based access

---

## 3.8 Resource Watch (World Resources Institute)
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: JSON

WRI's data platform for environmental and development indicators.

API: https://api.resourcewatch.org/v1/

DATASETS:
  - Climate risk indices
  - Water stress
  - Air quality
  - Forest cover
  - Social vulnerability

AI USE CASES:
  - Multi-indicator environmental analysis
  - Climate vulnerability assessment
  - Water-food-energy nexus

PROS: Multiple indicators, JSON API, curated datasets
CONS: Smaller catalog than other sources

---

## 3.9 OpenAQ — Air Quality Data
RATING: ★★★☆☆ | ACCESS: FREE+REG | FORMAT: JSON

Open air quality data from 100+ countries. Real-time and historical
PM2.5, PM10, O3, NO2, SO2, CO measurements.

API: https://api.openaq.org/v3/
NOTE: Requires API key (free registration)

AI USE CASES:
  - "What's the air quality in Delhi right now?"
  - "Compare air pollution between cities"
  - Health impact assessment

PROS: Real-time, global, many pollutants
CONS: Requires auth, coverage varies by region

---

## 3.10 Sentinel Hub / Copernicus Open Access Hub
RATING: ★★★☆☆ | ACCESS: FREE+REG | FORMAT: GeoTIFF/NetCDF

ESA's satellite imagery platform. Sentinel-1 (radar), Sentinel-2 (optical),
Sentinel-3 (ocean/land), Sentinel-5P (atmosphere).

SOURCE: https://scihub.copernicus.eu/
API: https://services.sentinel-hub.com/

DATA:
  - Land use/land cover change
  - Deforestation detection
  - Urban expansion
  - Water body monitoring
  - Air quality (Sentinel-5P: NO2, CO, O3, SO2, CH4)
  - Sea surface temperature
  - Ice sheet monitoring

AI USE CASES:
  - Satellite-based deforestation monitoring
  - Urban heat island analysis
  - Air quality from space
  - Land use change detection

PROS: High resolution (10m for Sentinel-2), global, multiple sensors
CONS: Requires registration, large data volumes, specialized processing

---

# ═══ TIER 4: SPECIALIZED & REFERENCE ═══

## 4.1 ICOS — Integrated Carbon Observation System
RATING: ★★★☆☆ | ACCESS: FREE+REG | FORMAT: CSV/NetCDF

European network of GHG measurement stations. High-precision atmospheric
CO2, CH4, and N2O measurements.

SOURCE: https://www.icos-cp.eu/
DATA: https://data.icos-cp.eu/portal/

---

## 4.2 Global Methane Budget (GCP)
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: PDF/CSV

The definitive global methane budget. Updated every ~4 years.
Latest: 2024 (covers 2000-2020).

SOURCE: https://www.globalcarbonproject.org/methanebudget/

KEY NUMBERS (2024):
  - Total emissions: ~580 Mt CH4/year
  - Agriculture: ~145 Mt CH4/year
  - Fossil fuels: ~125 Mt CH4/year
  - Wetlands: ~150 Mt CH4/year
  - Waste: ~70 Mt CH4/year

---

## 4.3 State of Carbon Dioxide Removal
RATING: ★★★★☆ | ACCESS: FREE | FORMAT: PDF/Web

The first independent global assessment of CDR. Essential for
understanding the carbon removal landscape.

SOURCE: https://www.stateofcdr.org/

KEY NUMBERS (2nd Edition, 2025):
  - Current CDR: ~2.1 Gt CO2/year (mostly conventional)
  - Required by 2050: 7-9 Gt CO2/year
  - Novel CDR: ~0.01 Gt CO2/year
  - Gap: ~700-900x scale-up needed

---

## 4.4 NASA Earth Observations (NEO)
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: JPEG/PNG/CSV

NASA's satellite imagery archive. Visualizations of key Earth indicators.

SOURCE: https://neo.gsfc.nasa.gov/

DATASETS:
  - Sea surface temperature
  - Chlorophyll concentration
  - Vegetation index (NDVI)
  - Snow cover
  - Ice sheet extent
  - Aerosol optical depth
  - Carbon monoxide

---

## 4.5 Global Surface Water Explorer (JRC/Google)
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: GeoTIFF

30+ years of global surface water mapping using satellite imagery.

SOURCE: https://global-surface-water.appspot.com/

---

## 4.6 Argo Float Program
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: NetCDF

Global network of 4,000+ autonomous ocean floats measuring temperature
and salinity to 2,000m depth.

SOURCE: https://argo.ucsd.edu/
DATA: https://data-argo.ifremer.fr/

---

## 4.7 Global Fishing Watch
RATING: ★★☆☆☆ | ACCESS: FREE+REG | FORMAT: API

Tracks global fishing activity using AIS satellite data.

SOURCE: https://globalfishingwatch.org/
NOTE: Requires API key

---

## 4.8 Climate TRACE
RATING: ★★★☆☆ | ACCESS: FREE+REG | FORMAT: Web/API

Tracks greenhouse gas emissions from every major source worldwide
using satellite data and AI.

SOURCE: https://climatetrace.org/
NOTE: API access requires registration

---

## 4.9 IPCC Data Distribution Centre
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: Various

The IPCC's official data repository. Climate projections, observed
climate data, and scenario data.

SOURCE: https://www.ipcc-data.org/
CDS: https://cds.climate.copernicus.eu/

---

## 4.10 UNFCCC — National GHG Inventories
RATING: ★★★☆☆ | ACCESS: FREE | FORMAT: CSV/PDF

Official national GHG inventories submitted under the UNFCCC.
The official record of country emissions.

SOURCE: https://di.unfccc.int/
NOTE: Data portal exists but requires navigation

---

# ═══ RECOMMENDED DATA ARCHITECTURE ═══

## For a Climate AI System, we recommend this data pipeline:

### LAYER 1: Real-time / Near Real-time (updated daily to monthly)
  1. NOAA GML — atmospheric CO2, CH4, N2O (monthly)
  2. Open-Meteo — weather, forecasts, historical (daily)
  3. Carbon Monitor — daily emissions (monthly lag)
  4. Global Forest Watch — deforestation alerts (weekly)
  5. OpenAQ — air quality (hourly, with auth)

### LAYER 2: Annual / Periodic (updated yearly)
  1. OWID CO2 — country emissions (annual)
  2. Global Carbon Budget — global carbon accounting (annual)
  3. IEA — energy & emissions by sector (annual)
  4. EDGAR — gridded emissions by sector (annual)
  5. FAO — agriculture & land use (annual)
  6. World Bank — development indicators (annual)

### LAYER 3: Static / Reference (updated rarely)
  1. Copernicus CDS — ERA5 reanalysis (1940-present)
  2. NASA POWER — solar & meteorological (1984-present)
  3. GBIF — biodiversity (continuous but slow updates)
  4. HadCRUT5 / NASA GISS / Berkeley Earth — temperature records
  5. State of CDR — carbon removal assessment (biennial)

### LAYER 4: Projections & Scenarios
  1. Copernicus CDS — CMIP6 climate projections
  2. IPCC AR6 — scenario data
  3. Climate Action Tracker — policy assessments

---

# ═══ API COMPARISON MATRIX ═══

Source              | Auth | Format | Resolution  | History  | Update  | Rate Limit
--------------------|------|--------|-------------|----------|---------|------------------
NOAA GML            | None | TXT    | Station     | 1958+    | Monthly | Unlimited
OWID CO2            | None | CSV    | Country     | 1751+    | Annual  | Unlimited
Open-Meteo Weather  | None | JSON   | 0.25°/point | 1940+    | Daily   | 10K/day
Open-Meteo Seasonal | None | JSON   | 0.5°/point | N/A      | Daily   | 10K/day
IEA                 | Free | JSON   | Country     | 1990+    | Annual  | Generous
NASA POWER          | None | JSON   | 0.5°/point | 1984+    | Daily   | Unlimited
World Bank          | None | JSON   | Country     | 1960+    | Annual  | Unlimited
GBIF                | None | JSON   | Point       | 1700+    | Daily   | 1000/hr
Copernicus CDS      | Free | NetCDF | 0.25°      | 1940+    | Monthly | 20GB/mo
GFW                 | Free | API    | 30m        | 2001+    | Weekly  | Varies
EDGAR               | None | CSV    | 0.1°/cntry  | 1970+    | Annual  | Unlimited
Berkeley Earth      | None | TXT    | Global/stn  | 1750+    | Monthly | Unlimited
Carbon Monitor      | None | CSV    | Country     | 2019+    | Monthly | Unlimited
FAO                 | Free | JSON   | Country     | 1961+    | Annual  | Generous
OpenAQ              | Free | JSON   | Station     | 2013+    | Hourly  | Varies
Sentinel Hub        | Free | GeoTIFF| 10m        | 2015+    | 5-day   | Varies

---

# ═══ IMPLEMENTATION NOTES ═══

## Caching Strategy
- NOAA GML: Cache for 24 hours (updates monthly)
- OWID: Cache for 30 days (updates annually)
- Open-Meteo: Cache historical for 30 days, forecasts for 6 hours
- IEA: Cache for 30 days
- World Bank: Cache for 30 days

## Data Freshness Requirements
For a climate AI, users expect:
  - CO2 levels: within 1 month
  - Temperature: within 1 month
  - Emissions: within 1 year (annual data)
  - Weather: real-time
  - Forecasts: daily updates

## Recommended Tech Stack
  - Python requests / httpx for API calls
  - pandas for CSV processing
  - xarray for NetCDF (ERA5, CMIP6)
  - geopandas for spatial data
  - redis for caching
  - PostgreSQL + PostGIS for storage
  - FastAPI for serving

## Data Quality Flags
Always check for:
  - Missing values (NOAA uses -9.99 or -99.99)
  - Unit conversions (ppm vs ppb, GtC vs Gt CO2)
  - Baseline differences (temperature anomalies use different baselines)
  - Revision history (data gets updated retroactively)

---

Document prepared for Earth Love United Foundation
Climate AI Data Architecture — May 2026
