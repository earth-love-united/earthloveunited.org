# EARTH LOVE UNITED — COMPREHENSIVE PRODUCTION GUIDE
## Deep Research Across All Categories
## Version 1.0 | May 2026

---

# ═══ PART 1: VISION & ARCHITECTURE ═══

## The Vision

Earth Love United's website should be the Brilliant.com of climate learning —
an interactive, globe-centered experience where visitors don't just read
about carbon, they EXPLORE it, PLAY with it, and UNDERSTAND it through
direct manipulation and discovery.

## Core Principles

1. **Learning by doing** — Every concept has an interactive element
2. **Visual first** — The globe is the interface, not decoration
3. **Data-driven** — Real-time data from authoritative sources
4. **Emotionally resonant** — Beautiful, inspiring, not preachy
5. **Scientifically rigorous** — Every number traceable to a source
6. **Action-oriented** — Every learning moment leads to a possible action

## Site Architecture

  HERO (full-screen globe, atmospheric entry)
    ↓
  SECTION 1: THE CARBON ATOM — Interactive carbon cycle
    ↓
  SECTION 2: THE KEELING CURVE — Live CO2 data, historical context
    ↓
  SECTION 3: THE CARBON BUDGET — How much is left? Interactive calculator
    ↓
  SECTION 4: THE PROJECT MAP — Restoration projects worldwide on the globe
    ↓
  SECTION 5: THE MARKET — Carbon credits, pricing, registries
    ↓
  SECTION 6: THE SOLUTIONS — Drawdown solutions explorer
    ↓
  SECTION 7: YOUR IMPACT — Personal carbon footprint + action planner
    ↓
  CLIMATE AI — Conversational interface for carbon questions

---

# ═══ PART 2: GLOBE VISUALIZATION DESIGN ═══

## Technology Stack

PRIMARY: globe.gl (already in your stack)
  - Built on Three.js/WebGL
  - 26 example visualizations available
  - Supports: points, arcs, heatmaps, hex polygons, HTML markers, custom layers
  - CDN: //cdn.jsdelivr.net/npm/globe.gl
  - React bindings available

SUPPORTING:
  - Three.js (underlying 3D engine)
  - D3.js (data visualization, charts)
  - Mapbox GL JS (2D map fallback, tile layers)
  - Chart.js or Recharts (dashboard charts)

## Globe Visualization Types (from globe.gl examples)

For Earth Love United, these are the most relevant:

1. **Points Data** — Plot restoration projects as dots on the globe
   - Size = credits issued or trees planted
   - Color = project type (forestry, energy, cookstoves, etc.)
   - Hover = project details

2. **Arc Links** — Show carbon credit flows
   - From project location → to buyer location
   - Animated arcs showing market activity

3. **Heatmap** — Show deforestation hotspots or emissions density
   - Global Forest Watch data → heatmap layer

4. **Hexed Country Polygons** — Show country-level data
   - Color = emissions per capita or total emissions
   - Click → drill down to country detail

5. **HTML Markers** — Rich interactive markers for key projects
   - Custom HTML popups with images, stats, links

6. **Ripple Rings** — Show real-time events
   - New carbon credit issuance
   - Deforestation alerts
   - Retirement events

7. **Choropleth** — Thematic mapping
   - Carbon intensity by country
   - Renewable energy share
   - Forest cover percentage

8. **Custom Layer** — For advanced visualizations
   - Atmospheric CO2 concentration as a glowing layer
   - Temperature anomaly as color gradient
   - Ocean acidification as texture

## Globe Design Specifications

VISUAL STYLE (matching your existing dark theme):
  Background: #050509 (deep space black)
  Globe texture: Dark marble / NASA Blue Marble (dark variant)
  Atmosphere: Subtle teal glow (#4ecdc4 at 10% opacity)
  Land masses: Dark with subtle borders
  Water: Very dark, subtle specular highlights
  Data points: Bright teal/mint/amber based on category
  Arcs: Animated, gradient from source color to target color

INTERACTION:
  - Auto-rotate slowly (0.5 deg/sec) when idle
  - Click point → fly to location + show detail panel
  - Scroll to zoom
  - Touch-friendly for mobile
  - Keyboard navigation support

PERFORMANCE:
  - Target: 60fps on mid-range devices
  - Max 10,000 point elements on globe
  - LOD (Level of Detail) for distant elements
  - WebGL fallback to Canvas 2D for older browsers

---

# ═══ PART 3: INTERACTIVE LEARNING MODULES ═══

## Design Pattern (Brilliant.com Style)

Each module follows this structure:

  1. HOOK — A surprising question or fact
     "If all the CO2 in the atmosphere were compressed to liquid,
      it would fill 2.5 TRILLION bathtubs."

  2. EXPLORE — Interactive element where user manipulates variables
     Slider: "Adjust global emissions and see what happens to temperature"

  3. DISCOVER — User arrives at understanding through exploration
     "You discovered: Every 1,000 Gt of CO2 causes ~0.45°C of warming"

  4. VERIFY — Quick quiz to confirm understanding
     "What happens if we double emissions? Test your prediction."

  5. CONNECT — Link to next module or real-world action
     "Now let's see where that CO2 comes from..."

## Module Specifications

### Module 1: The Carbon Atom's Journey
FORMAT: Interactive animation on the globe
DURATION: 3-5 minutes

User follows a single carbon atom through the cycle:
  - Starts in the atmosphere (CO2)
  - Absorbed by a tree in Brazil (photosynthesis)
  - Tree is cut down, burned (back to atmosphere)
  - OR: Tree dies, buried, becomes fossil fuel over millions of years
  - Fossil fuel extracted, burned in a power plant
  - CO2 enters atmosphere
  - Some dissolves in the ocean
  - Some is absorbed by a new tree

INTERACTIVE ELEMENTS:
  - User chooses the path at each stage
  - Timer shows how long each step takes (seconds to millions of years)
  - Globe shows the physical location of each step

DATA SOURCES:
  - Carbon cycle fluxes from Global Carbon Budget
  - Pool sizes from IPCC AR6

### Module 2: The Keeling Curve Explorer
FORMAT: Interactive timeline + live data
DURATION: 5-7 minutes

User explores the Keeling Curve:
  - Scrub through 68 years of CO2 data (1958-2026)
  - See seasonal oscillations (breathing of the Northern Hemisphere)
  - See the accelerating upward trend
  - Overlay historical events (Paris Agreement, COVID, etc.)
  - Compare to ice core data going back 800,000 years

INTERACTIVE ELEMENTS:
  - Timeline scrubber
  - Zoom into specific periods
  - Toggle: seasonal cycle, trend line, projections
  - "What if" slider: adjust future emissions, see projected CO2

DATA SOURCES:
  - NOAA GML (real-time, monthly)
  - Ice core data (Law Dome, Vostok)

### Module 3: The Carbon Budget Game
FORMAT: Interactive calculator + globe visualization
DURATION: 7-10 minutes

User is given the remaining carbon budget and must allocate it:
  - "You have 250 Gt CO2 left for 1.5°C. How do you spend it?"
  - Sliders for: energy, transport, industry, food, buildings
  - Real-time feedback on temperature impact
  - See which countries are using the most budget

INTERACTIVE ELEMENTS:
  - Budget allocation sliders
  - Real-time temperature projection
  - Country comparison tool
  - "Can you stay under 1.5°C?" challenge

DATA SOURCES:
  - IPCC AR6 carbon budget
  - OWID country emissions data
  - Global Carbon Budget 2025

### Module 4: Restoration Project Explorer
FORMAT: Globe-based project map
DURATION: 10-15 minutes (open-ended)

User explores restoration projects worldwide:
  - Each project shown as a point on the globe
  - Filter by: type, country, registry, vintage, price
  - Click project → detail panel with:
    - Location, size, tree species
    - Carbon impact (tonnes CO2)
    - Co-benefits (biodiversity, water, livelihoods)
    - Registry and verification status
    - Photos, videos, project documents
    - "Support this project" CTA

INTERACTIVE ELEMENTS:
  - Globe rotation and zoom
  - Filter panel (type, country, price range)
  - Search by project name or location
  - "Compare" mode: select 2-3 projects, compare side-by-side
  - "Impact calculator": "How many trees to offset your flight?"

DATA SOURCES:
  - Verra registry (scraped)
  - Gold Standard registry (scraped)
  - Global Forest Watch (deforestation alerts)
  - Carbonmark API (pricing)
  - Plant-for-the-Planet (tree counter)
  - Reforestation World (project partners)

### Module 5: Carbon Market Dashboard
FORMAT: Real-time charts + globe
DURATION: 5-7 minutes

User explores the carbon market:
  - Live price feed from Carbonmark
  - Price history charts by project type
  - Registry comparison (Verra vs Gold Standard vs ACR)
  - Supply/demand metrics
  - Retirement counter ("X tonnes retired today")

INTERACTIVE ELEMENTS:
  - Time range selector (1 day, 1 week, 1 month, 1 year, all time)
  - Project type filter
  - Price alert simulator
  - "Buy and retire" simulation (educational, not real transactions)

DATA SOURCES:
  - Carbonmark API (real-time prices, retirements)
  - Ecosystem Marketplace (market reports)
  - EU ETS (compliance market prices)

### Module 6: Drawdown Solutions Explorer
FORMAT: Interactive cards + impact charts
DURATION: 10-15 minutes

User explores Project Drawdown's solutions:
  - 80+ solutions ranked by impact
  - Filter by: sector, cost, impact, readiness
  - Each solution card shows:
    - Description
    - CO2 reduction potential (Gt)
    - Cost/savings
    - Co-benefits
    - "How you can help"
  - User builds their own "solution portfolio"

INTERACTIVE ELEMENTS:
  - Solution cards with flip animation
  - Drag-and-drop portfolio builder
  - Impact calculator: "If all of America adopted this solution..."
  - Comparison tool: "Solar vs Wind vs Nuclear"

DATA SOURCES:
  - Project Drawdown (solutions database)
  - IEA (energy data)
  - IPCC AR6 (mitigation pathways)

### Module 7: Your Carbon Footprint
FORMAT: Interactive calculator + action planner
DURATION: 5-10 minutes

User calculates their personal footprint:
  - Step-by-step questionnaire (home, transport, food, goods)
  - Real-time calculation with visual feedback
  - Compare to national and global averages
  - Personalized action plan with impact estimates
  - "Offset your footprint" → links to verified projects

INTERACTIVE ELEMENTS:
  - Slider-based questionnaire
  - Animated footprint visualization (growing/shrinking footprint)
  - Action cards: "Switch to LED bulbs: -50 kg CO2/year"
  - Progress tracker: "You've reduced your footprint by X%"

DATA SOURCES:
  - EPA emission factors
  - OWID per-capita emissions
  - Carbonmark API (offset pricing)

---

# ═══ PART 4: CLIMATE AI ARCHITECTURE ═══

## AI System Design

The Climate AI is a conversational interface that can answer any question
about carbon, climate, and solutions. It's powered by:

  1. LLM backbone (GPT-4 / Claude / custom fine-tune)
  2. RAG (Retrieval-Augmented Generation) over our knowledge base
  3. Real-time data APIs for live information
  4. Structured data sources for factual grounding

## Knowledge Base Structure

TIER 1 — Always in context (system prompt):
  - Core carbon science facts
  - Key statistics (CO2 levels, temperature, budgets)
  - Site navigation and module descriptions

TIER 2 — Retrieved on demand (RAG vector store):
  - Full RESEARCH.md content (carbon science)
  - Full DATA_SOURCES.md content (data provenance)
  - Full CARBON_REGISTRIES.md content (market data)
  - IPCC AR6 summary for policymakers
  - Project Drawdown solutions database
  - Registry project data (Verra, Gold Standard, etc.)

TIER 3 — Real-time API calls (function calling):
  - NOAA GML → current CO2, CH4, N2O levels
  - Carbonmark → current carbon credit prices
  - Open-Meteo → weather/climate data for any location
  - OWID → country emissions data
  - Global Forest Watch → deforestation alerts

## AI Capabilities

The AI should be able to answer:

BASIC FACTS:
  "What is the current CO2 level?" → NOAA API
  "What is the Keeling Curve?" → Knowledge base
  "How much carbon budget is left?" → IPCC data

COMPARISONS:
  "How do China's emissions compare to the US?" → OWID data
  "What's the difference between Verra and Gold Standard?" → Registry data
  "Which is more effective: solar or wind?" → Drawdown data

CALCULATIONS:
  "What's my carbon footprint if I fly NYC to London?" → Emission factors
  "How many trees to offset my car?" → Carbon sequestration data
  "What would happen if everyone went vegan?" → Research data

EXPLORATIONS:
  "Show me restoration projects in Brazil" → Registry data + globe
  "What are the top 5 climate solutions?" → Drawdown data
  "Explain the carbon cycle" → Knowledge base + interactive animation

ACTIONS:
  "How can I offset my emissions?" → Carbonmark projects
  "What can I do today?" → Personalized action plan
  "Show me projects near me" → Geolocation + registry data

## AI Technical Implementation

ARCHITECTURE:
  Frontend: Chat interface (floating widget or dedicated page)
  Backend: FastAPI + LangChain / LlamaIndex
  Vector DB: Pinecone / Weaviate / ChromaDB
  LLM: GPT-4o or Claude 3.5 Sonnet
  APIs: NOAA, Carbonmark, Open-Meteo, OWID

PROMPT STRUCTURE:
  System: "You are the Earth Love United Climate AI. You are an expert in
  carbon science, climate solutions, and carbon markets. You provide accurate,
  sourced, actionable information. Always cite your sources. When discussing
  numbers, provide context and comparisons."

  Context: [Retrieved relevant documents from vector store]

  User question: [User input]

  Available functions:
    - get_current_ghg_levels()
    - get_country_emissions(country)
    - get_carbon_prices()
    - get_restoration_projects(country, type)
    - get_weather_data(lat, lon)
    - search_knowledge_base(query)

RESPONSE FORMAT:
  - Clear, concise answer
  - Key number(s) highlighted
  - Source citation
  - Suggested follow-up questions
  - Link to relevant module on the site

---

# ═══ PART 5: DATA PIPELINE ═══

## Real-Time Data Streams

UPDATE FREQUENCY: Every 5 minutes
SOURCES:
  - NOAA GML CO2 → current atmospheric CO2
  - Carbonmark prices → carbon credit market prices
  - Carbonmark retirements → retirement events

UPDATE FREQUENCY: Daily
SOURCES:
  - Open-Meteo → weather data for project locations
  - Global Forest Watch → deforestation alerts
  - Carbon Monitor → daily emissions estimates

UPDATE FREQUENCY: Weekly
SOURCES:
  - Registry scraping → new projects, credit issuances
  - Ecosystem Marketplace → market reports

UPDATE FREQUENCY: Monthly
SOURCES:
  - OWID → updated country emissions
  - IEA → energy data
  - FAO → agriculture and land use data

UPDATE FREQUENCY: Annually
SOURCES:
  - Global Carbon Budget → comprehensive carbon accounting
  - IPCC → assessment reports
  - Project Drawdown → solutions database update

## Data Storage

DATABASE: PostgreSQL + PostGIS
  - Projects table (restoration projects with geolocation)
  - Credits table (carbon credit issuances, retirements)
  - Prices table (historical carbon credit prices)
  - Emissions table (country-level emissions time series)
  - Content table (learning module content)
  - User progress table (learning module completion)

CACHE: Redis
  - Real-time data cache (5-min TTL)
  - API response cache (1-hour TTL)
  - Session data

VECTOR DB: ChromaDB (local) or Pinecone (cloud)
  - Knowledge base embeddings
  - Project descriptions
  - Registry documents

---

# ═══ PART 6: USER ENGAGEMENT & GAMIFICATION ═══

## Engagement Patterns (from Duolingo, Brilliant, Khan Academy)

1. **Streak system** — "You've learned about carbon for 7 days straight!"
2. **Progress tracking** — "You've completed 3 of 7 modules"
3. **Achievement badges** — "Carbon Cycle Expert", "Budget Master", etc.
4. **Knowledge points** — Earn points for completing modules and quizzes
5. **Leaderboard** — Optional social comparison
6. **Daily challenges** — "Today's challenge: Calculate your flight's carbon footprint"
7. **Personalized recommendations** — "Based on your interests, try Module 4"

## Gamification Elements for Earth Love United

BADGES:
  🌱 Seedling — Completed first module
  🌳 Tree — Completed 3 modules
  🌲 Forest — Completed all 7 modules
  🌍 Planet — Used the Climate AI 10 times
  💎 Carbon Neutral — Calculated and offset your footprint
  🔬 Scientist — Answered 10 quiz questions correctly
  🌐 Explorer — Viewed projects on 5 continents
  💰 Market Maker — Explored the carbon market dashboard

PROGRESS SYSTEM:
  - Each module has 5 stages: Discover → Explore → Understand → Verify → Act
  - Completing a stage unlocks the next
  - Completing all stages in a module earns a badge
  - Overall progress shown as a "forest growing" animation

SOCIAL FEATURES (Phase 2):
  - Share your carbon footprint reduction
  - Compete with friends on learning progress
  - Join a "carbon club" with collective goals
  - Leaderboard: "Top learners this month"

---

# ═══ PART 7: RESTORATION PROJECTS DATABASE ═══

## Project Data Schema

Each restoration project in the database:

  {
    id: "VCS-191",
    name: "Yucatán Restoration Project",
    registry: "VCS",
    country: "Mexico",
    region: "Yucatán Peninsula",
    lat: 20.6,
    lng: -89.1,
    type: "REDD+" | "ARR" | "IFM" | "Mangrove" | "Peatland" | "Biochar",
    status: "Registered" | "Under Validation",
    start_year: 2015,
    area_ha: 50000,
    trees_planted: 12000000,
    credits_issued: 500000,
    credits_available: 200000,
    credits_retired: 300000,
    price_usd: 2.80,
    co_benefits: ["biodiversity", "water", "livelihoods", "indigenous_rights"],
    sdgs: [1, 6, 13, 15],
    validator: "SCS Global Services",
    description: "Protecting and regrowing the Mayan forests...",
    images: ["url1", "url2"],
    website: "https://...",
    last_updated: "2025-01-15"
  }

## Data Sources for Projects

PRIMARY REGISTRIES (scrape):
  - Verra: ~2,300 projects
  - Gold Standard: ~1,800 projects
  - ACR: ~500 projects
  - CAR: ~400 projects
  - Plan Vivo: ~300 projects
  - ART: ~100 projects

RESTORATION ORGANIZATIONS:
  - Plant-for-the-Planet: 36M+ trees, 3 countries
  - Reforestation World: 44K trees, 20 countries
  - One Tree Planted: 100M+ trees, 80+ countries
  - Eden Reforestation: 500M+ trees, 8 countries
  - Trees for the Future: 300M+ trees, 6 countries

MONITORING DATA:
  - Global Forest Watch: Tree cover loss/gain
  - NASA FIRMS: Fire alerts
  - Sentinel-2: Satellite imagery for verification

---

# ═══ PART 8: PRODUCTION ROADMAP ═══

## Phase 1: Foundation (Weeks 1-4)
  ☐ Set up data pipeline (NOAA, Carbonmark, Open-Meteo APIs)
  ☐ Build globe.gl base with dark theme
  ☐ Create Module 1: Carbon Atom Journey (basic animation)
  ☐ Create Module 2: Keeling Curve Explorer
  ☐ Implement live CO2 ticker
  ☐ Set up PostgreSQL database

## Phase 2: Core Learning (Weeks 5-8)
  ☐ Build Module 3: Carbon Budget Game
  ☐ Build Module 6: Drawdown Solutions Explorer
  ☐ Build Module 7: Carbon Footprint Calculator
  ☐ Implement progress tracking and badges
  ☐ Add quiz widgets to all modules

## Phase 3: Globe & Market (Weeks 9-12)
  ☐ Scrape Verra and Gold Standard registries
  ☐ Build Module 4: Restoration Project Explorer on globe
  ☐ Build Module 5: Carbon Market Dashboard
  ☐ Implement real-time price charts
  ☐ Add arc visualizations for carbon credit flows

## Phase 4: AI & Polish (Weeks 13-16)
  ☐ Build Climate AI chat interface
  ☐ Set up RAG pipeline over knowledge base
  ☐ Implement function calling for real-time data
  ☐ Add gamification (badges, streaks, leaderboard)
  ☐ Performance optimization (60fps target)
  ☐ Mobile responsiveness
  ☐ Accessibility audit

## Phase 5: Launch & Iterate (Weeks 17-20)
  ☐ Beta testing with 100 users
  ☐ Analytics integration
  ☐ SEO optimization
  ☐ Social sharing features
  ☐ Launch campaign
  ☐ Iterate based on user feedback

---

# ═══ PART 9: TECHNICAL SPECIFICATIONS ═══

## Frontend Stack
  - HTML5 / CSS3 (dark theme, CSS variables)
  - JavaScript (ES2022+)
  - globe.gl (3D globe)
  - Three.js (underlying 3D)
  - D3.js (charts and data viz)
  - Chart.js (dashboard charts)
  - GSAP (animations)
  - Webpack / Vite (bundling)

## Backend Stack
  - Python 3.11+
  - FastAPI (API server)
  - Celery (background tasks)
  - PostgreSQL 15 + PostGIS
  - Redis (caching)
  - ChromaDB (vector store)
  - LangChain (AI orchestration)

## Infrastructure
  - Vercel / Netlify (frontend hosting)
  - Railway / Render / AWS (backend)
  - GitHub Actions (CI/CD)
  - Sentry (error tracking)
  - Plausible / Fathom (analytics, privacy-focused)

## Performance Budgets
  - First Contentful Paint: < 1.5s
  - Time to Interactive: < 3s
  - Globe render: < 2s
  - API response: < 200ms
  - Total page weight: < 5MB (initial load)
  - Lighthouse score: > 90

---

# ═══ PART 10: CONTENT GUIDELINES ═══

## Writing Style
  - Conversational but authoritative
  - "You" not "users"
  - Short sentences, active voice
  - Every number has a source citation
  - Comparisons make numbers relatable
  - No jargon without explanation
  - Inspiring, not preachy

## Visual Guidelines
  - Dark background (#050509)
  - Teal accent (#4ecdc4)
  - Mint highlights (#7be8d0)
  - Amber for warnings/data (#d4a574)
  - Cormorant Garamond for headings
  - Outfit for body text
  - JetBrains Mono for numbers/data
  - Consistent 8px grid system
  - Smooth animations (300ms ease-out)

## Accessibility
  - WCAG 2.1 AA compliance
  - Keyboard navigation for all interactions
  - Screen reader support
  - Color contrast ratio > 4.5:1
  - Reduced motion support
  - Alt text for all images
  - Focus indicators on interactive elements

---

This guide represents the complete production blueprint for Earth Love United.
Every module, every data source, every interaction pattern has been researched
and specified. The next step is to begin building.

Prepared for Earth Love United Foundation
May 2026
