# CLIMATE FACTS v1.0 — The Tongue of the Earth
## Cold, sourced, verifiable data. No opinions. No agenda.

---

# DESIGN PRINCIPLES

1. **Every fact has a source.** No "scientists say" or "studies suggest."
   Every value traces to a specific institution, paper, or dataset.

2. **Confidence levels are explicit.**
   - `very_high`: Multiple peer-reviewed studies, institutional consensus (IPCC, NOAA, NASA)
   - `high`: Single peer-reviewed study or institutional report
   - `emerging`: Preliminary research, wide uncertainty ranges

3. **No speculation.** If the data is uncertain, the fact says so.
   Ranges are given when available. "Likely range" and "best estimate" are distinguished.

4. **Structured for machine reading.** Every fact has:
   - `value`: The number
   - `unit`: What it's measured in
   - `source`: Who measured/published it
   - `year`: When it was measured/published
   - `confidence`: How certain we are
   - `note` (optional): Context, caveats, ranges

5. **Covers what GAIA needs to answer questions about:**
   - Current state of the planet (CO2, temperature, sea level)
   - Carbon cycle fluxes and pools
   - Ecosystem-specific data (mangroves, seagrasses, peatlands, etc.)
   - Solutions and their metrics (costs, potentials, rates)
   - Tipping points and thresholds
   - Emissions by sector and country
   - Climate finance and policy

---

# DATA COVERAGE

| Category | Facts | Key Sources |
|----------|-------|-------------|
| Atmospheric concentrations | 6 | NOAA GML, IPCC AR6 |
| Global temperature | 4 | NASA GISS, IPCC AR6 |
| Carbon budget | 7 | Global Carbon Budget 2025, IPCC AR6 |
| Sea level | 6 | NASA, IPCC AR6 |
| Carbon pools | 7 | IPCC AR6 WGI |
| Ecosystem carbon data | 28 | Peer-reviewed literature |
| Solutions — energy | 7 | IRENA, IEA, Bloomberg NEF |
| Solutions — carbon removal | 5 | IEA, Project Drawdown, Nature papers |
| Emissions by sector | 6 | IPCC AR6 WGIII |
| Top emitters | 8 | Global Carbon Budget 2025 |
| Climate sensitivity | 3 | IPCC AR6 WGI |
| Tipping points | 6 | IPCC AR6, Nature papers |
| Ocean | 4 | IPCC AR6 WGI |
| Ice | 3 | NSIDC, IPCC AR6, Nature |
| Carbon pricing | 3 | World Bank, EU ETS |
| Climate finance | 3 | CPI, UNFCCC |
| Population & development | 4 | UN |
| Food system | 4 | Poore & Nemecek 2018, UNEP |
| Energy | 4 | IEA |

**Total: 124 facts from 69 unique sources**

---

# SOURCE HIERARCHY

Tier 1 (very_high confidence):
- IPCC AR6 (WGI, WGII, WGIII)
- NOAA Global Monitoring Laboratory
- NASA GISS / NSIDC
- Global Carbon Project / Global Carbon Budget
- IEA World Energy Outlook

Tier 2 (high confidence):
- IRENA Renewable Energy Statistics
- World Bank Carbon Pricing Dashboard
- UNEP reports
- Single peer-reviewed studies in Nature, Science, PNAS

Tier 3 (emerging / medium confidence):
- Pre-print studies
- Industry reports
- Projections with wide uncertainty ranges

---

# USAGE IN GAIA

When a user asks a factual question:
1. GAIA calls `get_climate_fact(topic)` with the relevant topic
2. Worker returns the fact(s) with value, unit, source, year, confidence
3. GAIA speaks the fact with attribution

Example:
User: "How much CO2 is in the atmosphere right now?"
→ get_climate_fact("co2")
→ "As of April 2026, atmospheric CO2 is 431.12 ppm (NOAA GML Mauna Loa). That's 54% higher than pre-industrial levels of 280 ppm."

User: "How much carbon can mangroves store?"
→ get_climate_fact("mangrove")
→ "Mangroves sequester an average of 6.3 tonnes of CO2 per hectare per year (Donato et al. 2011, Nature Geoscience). Global mangrove forests store approximately 6.5 GtC total. However, 35% of global mangrove area has been lost since 1980."

---

# FILES

- `dis/climate-facts.json` — 25 KB, 124 facts
- `dis/dist/climate-facts.json` — copied for worker deployment
- `dis/build_climate_facts.py` — generator script

---

# NEXT EXPANSIONS

v1.1 — Add more ecosystem data:
- Kelp/seaweed carbon sequestration
- Mycorrhizal networks and soil carbon
- Boreal forest carbon dynamics
- Savanna and grassland carbon
- Deep ocean carbon storage

v1.2 — Add country-level data:
- Per-capita emissions for top 50 countries
- Renewable energy share by country
- Climate vulnerability indices
- NDC commitments and progress

v1.3 — Add temporal data:
- Historical CO2 levels (ice core data)
- Temperature record by decade
- Sea level reconstruction
- Emissions trajectory since 1850

v2.0 — Add uncertainty quantification:
- Confidence intervals for all projections
- Scenario-dependent values (SSP1-1.9 through SSP5-8.5)
- Probability distributions where available
