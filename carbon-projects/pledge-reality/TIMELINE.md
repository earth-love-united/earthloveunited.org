# Climate Pledge vs Reality — Data Source Timeline

## Data Availability by Source

### 1. UNFCCC NDC Registry (Pledges)
- **URL**: https://unfccc.int/NDCREG
- **Records**: 337 NDC submissions from 190+ countries
- **Timeline**: 
  - INDCs (Intended NDCs): 2015 (pre-Paris)
  - First NDCs: 2016-2020
  - Updated NDCs: 2021-2025
  - Latest: April 2026 (India, Comoros, Georgia, etc.)
- **Fields**: Party, Title, Language, Version, Status, Submission Date
- **Format**: HTML table (needs scraping) + PDF documents
- **Update**: Continuous (countries submit at different times)

### 2. Global Carbon Budget (Actual Emissions)
- **URL**: https://globalcarbonbudget.org/
- **Records**: 190+ countries
- **Timeline**: 
  - Fossil CO2 emissions: 1959-2024 (annual)
  - Land use change emissions: 1959-2022
  - Latest: GCB 2025 (published Feb 2026)
- **Fields**: Country, Year, Fossil_CO2, LandUse_CO2, Total, PerCapita
- **Format**: Excel/CSV downloads from Zenodo
- **Update**: Annual (February each year)

### 3. Climate Action Tracker (Independent Ratings)
- **URL**: https://climateactiontracker.org/countries/
- **Records**: ~190 countries
- **Timeline**: Continuous updates since 2009
- **Ratings**: 
  - 1.5°C Paris Agreement Compatible
  - Almost Sufficient
  - Insufficient
  - Highly Insufficient
  - Critically Insufficient
- **Fields**: Country, Rating, NDC target, Policy assessment, Finance
- **Format**: HTML (needs scraping) + API
- **Update**: Quarterly

### 4. Climate Policy Database (Laws Passed)
- **URL**: https://climatepolicydatabase.org/
- **Records**: 190+ countries
- **Timeline**: 1990-present
- **Fields**: Country, Policy name, Year, Sector, Status
- **Format**: CSV download
- **Update**: Continuous

### 5. OECD Climate Finance (Finance Flows)
- **URL**: https://stats.oecd.org/
- **Records**: Donor and recipient countries
- **Timeline**: 2013-2024
- **Fields**: Donor, Recipient, Amount, Type, Year
- **Format**: CSV/Excel
- **Update**: Annual

## Recommended Timeline Scope

**Start year**: 2015 (Paris Agreement)
- First INDCs submitted
- Global Carbon Budget has full data
- Climate Action Tracker has ratings

**End year**: 2024 (latest complete year)
- GCB 2025 published Feb 2026
- Most recent NDCs submitted
- CAT ratings current

**Total years**: 10 (2015-2024)

## Data Gaps

1. **Small island states**: May not have historical emissions data pre-2015
2. **Countries with limited data**: Some African/Asian countries have sparse GCB data
3. **NDC content**: PDF documents need NLP extraction for quantitative targets
4. **Policy implementation**: Hard to quantify "did they pass the laws they promised"

## Scraping Priority

1. UNFCCC NDC Registry → country names, submission dates, NDC versions
2. Global Carbon Budget → actual emissions time series
3. Climate Action Tracker → ratings and assessments
4. Climate Policy Database → laws passed
5. OECD → climate finance flows
