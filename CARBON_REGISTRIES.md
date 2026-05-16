# CARBON REGISTRIES — STREAMING, MAPPING & CHARTING ANALYSIS
## Can we stream carbon registries and make charts? Has anyone mapped them?
## Research Report | May 2026

---

# EXECUTIVE SUMMARY

**Yes, you can stream carbon registry data and build charts — but the landscape
is fragmented.** No single source aggregates all registries. The best approach
is a multi-source pipeline:

1. Carbonmark API — real-time pricing, retirements, project listings (CONFIRMED WORKING)
2. Individual registry websites — project-level data (requires scraping)
3. Blockchain-based registries — on-chain retirement data (fully transparent)
4. Pricing aggregators — Carbon Credits.com, Ecosystem Marketplace

**No one has built a complete, real-time, cross-registry visualization platform
that we could find.** There are partial efforts, but this is a greenfield
opportunity for Earth Love United.

---

# PART 1: THE MAJOR CARBON REGISTRIES

## 1.1 Voluntary Carbon Market Registries

### VERRA (VCS — Verified Carbon Standard)
  Website: https://verra.org/
  Registry: https://registry.verra.org/
  Projects: ~2,300 registered
  Credits issued: ~1.1 billion tCO2
  Status: Largest voluntary carbon standard globally
  API: EXISTS but returns 406 (requires specific headers/auth)
  Data access: Web interface with search, no public REST API found
  Scraping: Possible via registry search interface

  Key data points per project:
    - Project ID (e.g., VCS-191)
    - Name, country, region
    - Project type (forestry, renewable energy, cookstoves, etc.)
    - Vintage year
    - Credits issued / available / retired
    - Methodology
    - Validation/verification status
    - SDG contributions

### GOLD STANDARD
  Website: https://www.goldstandard.org/
  Registry: https://registry.goldstandard.org/
  Projects: ~1,800
  Credits issued: ~200 million tCO2
  Status: Premium standard with strong SDG focus
  API: EXISTS at registry.goldstandard.org/api/ but returns non-JSON
  Data access: Web interface with project search
  Scraping: Possible, well-structured project pages

  Key data points:
    - GS ID (e.g., GS-1234)
    - Project name, country, type
    - SDG contributions (multiple per project)
    - Credits: issued, listed, retired, cancelled
    - Vintage
    - Monitoring reports

### AMERICAN CARBON REGISTRY (ACR)
  Website: https://americancarbonregistry.org/
  Projects: ~500
  Focus: North American projects
  API: No public API found
  Data access: Web-based project search

### CLIMATE ACTION RESERVE (CAR)
  Website: https://www2.climateactionreserve.org/
  Projects: ~400
  Focus: North American compliance and voluntary
  API: No public API found

### PLAN VIVO
  Website: https://www.planvivo.org/
  Projects: ~300
  Focus: Community-based land use projects
  API: No public API found

### ART (Architecture for REDD+ Transactions)
  Website: https://art-registry.org/
  Projects: ~100
  Focus: REDD+ forestry projects
  API: No public API found

## 1.2 Compliance Market Registries

### EU ETS (European Union Emissions Trading System)
  Website: https://ec.europa.eu/clima/policies/ets_en
  Registry: https://ec.europa.eu/clima/ets/
  Coverage: ~11,000 installations, ~40% of EU emissions
  Data: Transaction-level data available via European Union Transaction Log (EUTL)
  API: Limited public access

### UK ETS
  Website: https://www.gov.uk/government/collections/uk-emissions-trading-system-uk-ets

### China National ETS
  Website: https://www.chinacarbon.info/
  Coverage: ~2,200 power sector companies, ~4.5 Gt CO2
  Data: Limited public access

### California Cap-and-Trade
  Website: https://ww2.arb.ca.gov/our-work/programs/cap-and-trade-program
  Registry: https://ww3.arb.ca.gov/cc/capandtrade/offsets/offsets.htm
  Data: Public reports available

### RGGI (Regional Greenhouse Gas Initiative)
  Website: https://www.rggi.org/
  Coverage: 12 US states, power sector
  Data: Auction results and allowance tracking public

## 1.3 Blockchain-Based Registries & Platforms

### CARBONMARK (by KlimaDAO / Polygon)
  Website: https://www.carbonmark.com/
  API: https://api.carbonmark.com/ (CONFIRMED WORKING)
  Docs: https://docs.carbonmark.com/
  
  CONFIRMED WORKING ENDPOINTS:
    GET /prices → 579 price listings, real-time
      - Project ID, vintage, price (USD), supply
      - Price range: $0.84 - $7.00 (avg $2.62)
      - Includes VCS, Gold Standard, ACR projects
    
    GET /retirements → 20 most recent retirements
      - Amount, beneficiary, timestamp, retirement message
      - On-chain proof of retirement
  
  Supported registries: Verra, Gold Standard, ACR, CAR, Plan Vivo
  Supported blockchains: Polygon, Base
  Data format: JSON
  Auth: None required for read access
  Rate limit: Not documented

  This is the BEST single API for streaming carbon market data.

### TOUCAN PROTOCOL
  Website: https://toucan.earth/
  Function: Bridges traditional registry credits to blockchain
  Pools: BCT (Base Carbon Tonne), NCT (Nature Carbon Tonne), UBO, NBO
  Data: On-chain, fully transparent
  API: TheGraph subgraph available

### KLIMA PROTOCOL
  Website: https://www.klimaprotocol.com/
  Function: DAO-governed carbon market infrastructure
  Features: Carbon classes, instant retirement, zero fees
  Data: On-chain
  Docs: Available at klimaprotocol.com

### CENTIGRADE / TOUCAN SUBGRAPH
  TheGraph endpoint for querying on-chain carbon data:
  https://api.thegraph.com/subgraphs/name/toucanprotocol/carbon-offset

---

# PART 2: EXISTING MAPPING & VISUALIZATION PROJECTS

## 2.1 What Exists Today

After extensive searching (GitHub, web, industry sources), here's what we found:

### Registry-Level Visualizations:
  - Verra Registry: Built-in project map and search
  - Gold Standard Registry: Built-in project map and search
  - Each registry has its own project browser, but NO cross-registry view

### Market-Level Dashboards:
  - Carbonmark: Real-time marketplace with project listings and pricing
  - Ecosystem Marketplace (ecosystemmarketplace.com): Market intelligence, reports
  - Carbon Pulse (carbon-pulse.com): News and pricing (Cloudflare-protected)
  - Carbon Credits.com: Price tracking and news
  - AirCarbon Exchange (ACX): Trading platform with market data
  - Xpansiv (now part of CBL Markets): Market data

### Data Aggregation Attempts:
  - ICVCM (Integrity Council for the Voluntary Carbon Market): Quality framework, not data
  - VCMI (Voluntary Carbon Markets Integrity Initiative): Claims code, not data
  - Sylvera: Project ratings (commercial, API available)
  - BeZero Carbon: Project ratings (commercial, API available)
  - Calyx Global: Project ratings (commercial, not public)

### Open Source / GitHub:
  - No significant open-source cross-registry mapping projects found
  - GitHub search for "carbon registry", "carbon credit chart", "carbon market
    visualization" returned 0 relevant repositories
  - A few blockchain-based carbon wallet projects exist but no comprehensive mapping

### Academic / Research:
  - Berkeley Carbon Trading Project: Research on offset quality
  - Stanford Carbon Offset Research: Academic papers, not live data
  - WRI (World Resources Institute): Policy research, not real-time data

## 2.2 The Gap

**NO ONE has built a comprehensive, real-time, cross-registry carbon credit
tracking and visualization platform that is publicly available.**

The closest things that exist:
  1. Carbonmark — best API, but only covers bridged/on-chain credits
  2. Sylvera/BeZero — best project ratings, but commercial/paid
  3. Individual registry browsers — fragmented, no cross-registry view

This is a significant opportunity.

---

# PART 3: CARBON CREDIT PRICING DATA

## 3.1 Real-Time Pricing Sources

### Carbonmark API (CONFIRMED WORKING)
  Endpoint: https://api.carbonmark.com/prices
  Format: JSON
  Update: Real-time
  Coverage: On-chain listed credits from Verra, GS, ACR, CAR, Plan Vivo
  Price range observed: $0.84 - $7.00 per tCO2
  Average: ~$2.62 per tCO2

  Data structure per listing:
    {
      "purchasePrice": 2.80,        // USD per tonne
      "baseUnitPrice": 2.00,        // Base price
      "supply": 0,                  // Available supply
      "liquidSupply": 0,            // Liquid supply
      "listing": {
        "creditId": {
          "vintage": 2008,          // Year of emission reduction
          "projectId": "VCS-191"    // Registry project ID
        },
        "token": { ... }            // Blockchain token info
      }
    }

### Pricing Tiers (Market Knowledge, May 2026):
  Nature-based (forestry, REDD+):     $2 - $15 per tCO2
  Renewable energy:                   $1 - $5 per tCO2
  Cookstoves / household devices:    $3 - $10 per tCO2
  Direct air capture:                 $100 - $600 per tCO2
  Biochar:                           $20 - $80 per tCO2
  Enhanced weathering:               $50 - $200 per tCO2
  High-integrity removal credits:    $50 - $300 per tCO2

  Compliance markets:
    EU ETS:                           ~€65-85 per tCO2
    UK ETS:                           ~£45-65 per tCO2
    China ETS:                        ~¥50-80 per tCO2
    California:                        ~$25-35 per tCO2
    RGGI:                             ~$12-15 per tCO2

### Historical Price Trends:
  Voluntary market (average):
    2019: ~$2-3 per tCO2
    2020: ~$2-4 per tCO2
    2021: ~$5-10 per tCO2 (peak, driven by net-zero pledges)
    2022: ~$3-8 per tCO2
    2023: ~$2-6 per tCO2 (integrity concerns)
    2024: ~$2-5 per tCO2 (market correction)
    2025: ~$2-7 per tCO2 (quality differentiation increasing)

  EU ETS:
    2019: ~€25
    2020: ~€25-30
    2021: ~€50-80
    2022: ~€80-100 (peak)
    2023: ~€60-85
    2024: ~€55-75
    2025: ~€65-85

---

# PART 4: STREAMING FEASIBILITY ANALYSIS

## 4.1 What Can Be Streamed Today (No Auth Required)

SOURCE                  | TYPE        | FRESHNESS    | FORMAT | NOTES
------------------------|-------------|--------------|--------|------------------
Carbonmark /prices      | Prices      | Real-time    | JSON   | 579 listings, 5 registries
Carbonmark /retirements | Retirements | Real-time    | JSON   | On-chain retirements
NOAA GML CO2            | Atmospheric | Monthly      | TXT    | Gold standard
Open-Meteo               | Weather     | Hourly       | JSON   | Historical + forecast
OWID CO2                 | Emissions   | Annual       | CSV    | Country-level

## 4.2 What Requires Scraping

SOURCE                  | DIFFICULTY  | NOTES
------------------------|-------------|------------------
Verra registry          | Medium      | Well-structured HTML, search API exists
Gold Standard registry  | Medium      | Well-structured, project pages
ACR registry            | Medium      | Standard web interface
CAR registry            | Medium      | Standard web interface
Ecosystem Marketplace   | Easy        | Article-based, good HTML structure
Carbon Credits.com      | Easy        | Price pages, well-structured

## 4.3 What Requires Authentication

SOURCE                  | AUTH TYPE   | COST
------------------------|-------------|------------------
Sylvera                 | API key     | Commercial ($$)
BeZero Carbon           | API key     | Commercial ($$)
Calyx Global            | API key     | Commercial ($$)
Climate TRACE           | API key     | Free for research
OpenAQ                  | API key     | Free
Copernicus CDS          | Account     | Free
CAMS (air quality)      | Account     | Free
Sentinel Hub            | Account     | Free tier available

## 4.4 What Is On-Chain (Fully Transparent)

SOURCE                  | CHAIN       | DATA
------------------------|-------------|------------------
Carbonmark/Klima        | Polygon     | Prices, retirements, supply
Toucan Protocol         | Polygon     | Pool data, bridges
Base Carbon Tonne (BCT) | Polygon     | Tokenized carbon credits
Nature Carbon Tonne     | Polygon     | Nature-based credits

---

# PART 5: RECOMMENDED ARCHITECTURE

## For Earth Love United's Climate AI + Globe Visualization:

### Data Pipeline:

  LAYER 1 — Real-time streaming (WebSocket / polling):
    Carbonmark API → prices, retirements, supply
    NOAA GML → atmospheric CO2 (daily)
    Open-Meteo → weather context (hourly)

  LAYER 2 — Daily batch:
    Scrape Verra registry → new projects, credit issuances
    Scrape Gold Standard registry → new projects, credit issuances
    Scrape ACR, CAR → new projects

  LAYER 3 — Weekly batch:
    OWID → updated emissions data
    Global Forest Watch → deforestation alerts
    Carbon Monitor → daily emissions

  LAYER 4 — On-chain indexing:
    TheGraph / Toucan subgraph → tokenized carbon data
    Polygon RPC → retirement events

### Chart Types to Build:

  1. **Live CO2 ticker** — streaming from NOAA GML
     "The atmosphere right now contains 431.12 ppm of CO2"

  2. **Carbon credit price chart** — streaming from Carbonmark
     Line chart: price over time, by project type / registry

  3. **Retirement counter** — streaming from Carbonmark
     "X tonnes of CO2 retired today / this month / this year"

  4. **Project map** — from registry data
     Interactive globe showing carbon projects worldwide
     Color-coded by type (forestry, energy, cookstoves, etc.)
     Size = credits issued

  5. **Registry comparison** — aggregated data
     Bar chart: credits issued by registry (Verra vs GS vs ACR vs CAR)
     Pie chart: project type distribution

  6. **Vintage analysis** — from Carbonmark pricing data
     Heat map: price by vintage year and project type

  7. **Compliance vs Voluntary price comparison**
     Dual axis: EU ETS price vs voluntary market average

  8. **Supply/Demand dashboard**
     Total credits issued vs retired, by registry
     "X million credits available, Y million retired"

### Tech Stack Recommendation:

  Backend:
    - Python (FastAPI) for API aggregation
    - PostgreSQL + PostGIS for project locations
    - Redis for caching real-time data
    - Celery for scheduled scraping
    - TheGraph client for on-chain data

  Frontend:
    - globe.gl (already in your stack!) for 3D project map
    - D3.js or Chart.js for charts
    - WebSocket for real-time updates
    - Mapbox for base maps

  Data refresh:
    - Carbonmark prices: every 5 minutes
    - NOAA CO2: daily
    - Registry scraping: daily
    - OWID: monthly

---

# PART 6: KEY FINDINGS & RECOMMENDATIONS

## Findings:

  1. Carbonmark API is the single best source for real-time carbon market data.
     It's free, no auth, JSON format, and covers 5 major registries.

  2. No comprehensive cross-registry visualization exists. This is a gap.

  3. Traditional registries (Verra, Gold Standard) have web interfaces but
     no clean public APIs. Scraping is required for project-level data.

  4. Blockchain-based carbon data (Toucan, Klima, Carbonmark) is fully
     transparent and streamable. This is the future.

  5. Pricing data is fragmented. Carbonmark covers on-chain prices.
     Compliance market prices are available from exchange websites.

  6. The voluntary carbon market is ~$2-5 per tCO2 for nature-based credits,
     ~$50-300+ for high-integrity removal credits.

## Recommendations:

  1. START with Carbonmark API for real-time pricing and retirement data.
     It's the easiest win — working API, no auth, rich data.

  2. BUILD a registry scraper for Verra and Gold Standard. These are the
     two largest registries and have well-structured websites.

  3. USE globe.gl (already in your stack) to build an interactive project map.
     Plot every carbon project worldwide with metadata.

  4. CREATE a "Carbon Dashboard" with:
     - Live CO2 ticker (NOAA)
     - Live credit prices (Carbonmark)
     - Retirement counter (Carbonmark)
     - Project map (registry data)
     - Price charts (aggregated)

  5. INDEX on-chain carbon data via TheGraph for fully transparent
     retirement tracking.

  6. CONTRIBUTE OPEN-SOURCE tools back to the community. The carbon market
     desperately needs better data infrastructure.

---

# APPENDIX: REGISTRY DATA STRUCTURE

## Typical Carbon Project Record:

  {
    "registry": "VCS" | "GS" | "ACR" | "CAR" | "Plan Vivo" | "ART",
    "project_id": "VCS-191",
    "name": "Example Reforestation Project",
    "country": "Brazil",
    "region": "Amazon",
    "latitude": -3.4653,
    "longitude": -62.2159,
    "project_type": "REDD+" | "ARR" | "IFM" | "Cookstoves" | "Wind" | "Solar" | "Methane",
    "methodology": "VM0015",
    "status": "Registered" | "Under Validation" | "Under Verification",
    "vintage_start": 2020,
    "vintage_end": 2030,
    "credits_issued": 500000,
    "credits_available": 200000,
    "credits_retired": 300000,
    "price_usd": 2.80,
    "sdgs": [1, 7, 13, 15],
    "validator": "SCS Global Services",
    "last_updated": "2025-01-15"
  }

---

Research prepared for Earth Love United Foundation
May 2026
