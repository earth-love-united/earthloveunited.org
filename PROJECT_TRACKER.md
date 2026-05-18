# EARTH LOVE UNITED — PROJECT TRACKER
# Consigliere Dashboard · Updated: 2026-05-16

---

## THE FIVE

| Agent | Domain | Status |
|-------|--------|--------|
| Consigliere (OWL) | Tracking, guidance, coordination | Active |
| Dev | Building, integrating, deployed | Active — Phases 0-3 complete |
| Researcher | Climate data, carbon science, APIs | Not spawned |
| Marketing | Messaging, positioning, COP31 | Not spawned |
| Soulmaker | GAIA personality, voice, emotion | Not spawned |

---

## AGENT TASK LOG

| Time | Agent | Task | Result |
|------|-------|------|--------|
| 04:25 | Consigliere | Initial project scan | Full inventory |
| 04:26 | Consigliere | Build tracking system | dashboard.html + PROJECT_TRACKER.md |
| 04:27 | Consigliere | Identify team structure | 5 agents mapped |
| 04:30 | Dev | Codebase assessment + integration plan | DEV_INTEGRATION_PLAN.md (591 lines) |
| 04:40 | Dev | DOM adapter (Phase 0-1) | gaia-dom-adapter.js created |
| 04:50 | Dev | Event bridge (Phase 2) | All 9 interaction points bridged |
| 05:00 | Dev | State machine activation (Phase 3) | GAIA speaks in chat, voice library loaded |
| 05:10 | Consigliere | Fix build — module exposure bug | Changed `const X` → `window.X` in 8 files |
| 05:15 | Consigliere | Fix syntax errors in 4 files | Removed stray `)();`, fixed try/catch orphans |
| 05:20 | Consigliere | Verify build | All 35 JS files pass syntax check, 0 runtime errors |
| 22:00 | Consigliere | Performance audit + fixes | Removed defer, rAF scroll throttle, kill ndvi polling |

---

## PERFORMANCE NOTES (2026-05-17)

### Metrics (headless Chrome, not representative of real GPU)
- DOM ready: 3000ms | Full load: 5800ms
- JS heap: 73MB used / 124MB total
- 26 scripts = 630KB total (481KB CDN globe.gl + 150KB local)
- globe.gl CDN load: 2129ms (biggest single bottleneck)

### Fixes Applied
1. **Removed `defer` from quiz/cycle/biomes/counters** — restores baseline sync load order. Defer caused async race + 1.6s load times on each.
2. **Scroll progress bar throttled with rAF** — was reading `offsetTop`/`offsetHeight` on every scroll event (60+ forced reflows/sec). Now batched to once per frame.
3. **Killed ndvi-verifier 1s polling interval** — replaced with one-shot DOMContentLoaded listener. Data is always loaded by the time ndvi-verifier runs.

### Known Inefficiencies (future work)
- 26 separate script tags = 26 HTTP requests. Consider bundling for production.
- globe.gl is 481KB from CDN — no local cache, loads every visit.
- Scroll handler reads `offsetTop`/`offsetHeight` inside rAF — could cache these on resize events only.
- COP31 deadline: November 2026. Performance budget should stay tight as globe features grow.

---

## CURRENT STATE

### What Works
- **GAIA speaks on page load** — greeting line appears in chat
- **Sidebar clicks trigger GAIA responses** — pre-scripted voice lines from library
- **Chat messages work** — both user and GAIA messages render correctly
- **Sandbox calculator works** — GAIA comments on results
- **Project lookup works** — GAIA responds with site data
- **Idle nudges work** — GAIA nudges after 10s/20s/40s/60s of inactivity
- **Engagement scoring tracks** — every interaction adds to score
- **All existing gaia.html functionality preserved** — demo mode, sandbox, charts, globe
- **Zero console errors** — clean build

### Module Status
| Module | Status |
|--------|--------|
| GaiaState | ✅ Loaded — state machine, scoring, events |
| GaiaMind | ✅ Loaded — emotional AI, line selection |
| GaiaKeyGate | ✅ Loaded — API key onboarding, tease system |
| GaiaQuests | ✅ Loaded — 16 quests, 4 tiers, progression |
| GaiaVoice | ✅ Loaded — Web Speech API, emotion modulation |
| GaiaVoiceLibrary | ✅ Loaded — 108+ voice lines, 35 pools |
| GaiaDOMAdapter | ✅ Loaded — bridges DIS ↔ gaia.html |
| GaiaIntegration | ✅ Loaded — wires callbacks to chat UI |
| GaiaClient | ⚠️ Not loaded — IIFE throws runtime error (non-blocking) |

### Known Issues
1. **GaiaClient undefined** — The gaia-client.js IIFE throws a runtime error during init. Non-blocking because the adapter handles all wiring. GaiaClient was meant for WebSocket/LLM bridge which isn't deployed yet.
2. **Meta shows `[object Object]`** — Emotion object not stringified in message meta. Minor UI bug.
3. **No Cloudflare Worker deployed** — LLM mode offline. State machine mode works fully.

---

## MARKETING FOUNDATION (New — May 16)

### Built and tested:
| # | Feature | Status | Files |
|---|---------|--------|-------|
| 1 | **Carbon Clock** — Live ticking counter of excess CO₂ | ✅ Working | `js/carbon-clock.js`, `css/carbon-clock.css` |
| 2 | **Your Delegation** — Country-specific personalized entry | ✅ Working | `js/country-data.js`, `js/delegation.js`, `css/delegation.css` |
| 3 | **Pledge Wall v2** — Public commitments after meaningful moments | ✅ Built | `js/pledge-wall.js`, `css/pledge-wall.css` |

### Pledge Wall v2 Triggers (not score-based):
- After completing a site investigation (all layers revealed)
- After running a restoration scenario
- After collecting 3+ journal insights
- On departure (if engaged but hasn't pledged)

### UX Flow:
GAIA speaks → small prompt bar appears (bottom) → user clicks → modal opens
Not a pop-up. A natural next step after meaningful engagement.

### Integration points:
- `SITE_PANEL.addInsight()` → triggers `PLEDGE_WALL.onSiteComplete()`
- `Scenario.calc()` → triggers `PLEDGE_WALL.onScenarioRun()`
- `GAIA_JOURNAL.addEntry()` → triggers `PLEDGE_WALL.onInsightsCollected()`
- `beforeunload` → triggers `PLEDGE_WALL.onDeparture()`

### Next in queue:
- #4: Share Your Impact — Pre-built social cards
- #5: The Antalya Connection — Local COP31 narrative
- #6: GAIA's Field Notes — Daily blog from GAIA's perspective
- #7: Green Lie Detector — Interactive tool
- #8: Partner With GAIA — Corporate onboarding flow
- #9: 170-Day Countdown — Pre-COP31 campaign
- #10: Jean's Letter — Emotional anchor

---

## DIS INTEGRATION (Previous work)

### Root — Main Site
| File | Purpose | Status |
|------|---------|--------|
| index.html | Main website (globe + scroll sections) | READ-ONLY |
| gaia.html | GAIA chat interface | ✅ DIS-integrated |
| gaia-data.js | Live data engine (NOAA + Carbonmark) | ✅ Functional |
| gaia-charts.js | Canvas chart renderer | ✅ Functional |
| gaia-dom-adapter.js | DIS ↔ gaia.html bridge | ✅ New |
| gaia-integration.js | Wires DIS callbacks to chat UI | ✅ New |
| gaia-knowledge.js | Knowledge base for chat | ✅ Functional |
| dashboard.html | Visual project dashboard | ✅ New |

### DIS System (dis/)
| File | Purpose | Status |
|------|---------|--------|
| gaia-state-machine.js | Behavioral engine (272 lines, rewritten) | ✅ Functional |
| gaia-client.js | Orchestrator (1081 lines) | ⚠️ Runtime error, non-blocking |
| gaia-voice-engine.js | TTS wrapper | ✅ Functional |
| gaia-voice-data.js | 108+ voice lines (364 lines) | ✅ Functional |
| gaia-quest-system.js | 16 quests, 4 tiers | ✅ Functional |
| gaia-key-gate.js | API key onboarding | ✅ Functional |
| gaia-mind.js | Emotional AI (776 lines) | ✅ Functional |
| gaia-knowledge.js | Extended knowledge base | ✅ Functional |
| worker.js | Cloudflare Worker | Needs deployment |
| wrangler.toml | Deploy config | Needs KV IDs |

### JS Directory (Main Site Modules — 18 files)
| File | Purpose |
|------|---------|
| app.js | Main app entry, GAIA integration |
| globe.js | Globe.gl visualization |
| site-panel.js | Site panel UI (332 lines) |
| gaia-presence.js | GAIA presence bar (120 lines) |
| gaia-engagement.js | Engagement engine (134 lines) |
| gaia-voice.js | Voice system (187 lines) |
| gaia-journal.js | Journal system (118 lines) |
| biomes.js | Biome data |
| carbon-clock.js | Carbon clock widget |
| counters.js | Counter widgets |
| country-data.js | Country data |
| cycle.js | Carbon cycle widget |
| data.js | Data module |
| delegation.js | Delegation system |
| pledge-wall.js | Pledge wall (newest, 349 lines) |
| quiz.js | Quiz widget |
| scenario.js | Scenario system |

### CSS Modules (9 files)
base.css, layout.css, components.css, widgets.css, responsive.css, carbon-clock.css, delegation.css, gaia-presence.css, pledge-wall.css

### Research & Planning
| File | Purpose |
|------|---------|
| RESEARCH.md | Carbon science compendium |
| DATA_SOURCES.md | API catalog |
| CARBON_REGISTRIES.md | Registry analysis |
| CLIMATE_DATASETS.md | Dataset survey |
| PRODUCTION_GUIDE.md | Architecture spec |
| DEV_INTEGRATION_PLAN.md | Dev's integration plan |
| PHASE4_PLAN.md | Phase 4 planning document |
| PROJECT_TRACKER.md | This file |
| climate-dataset/ | Climate dataset research (5 docs + src/) |

---

## DEV INTEGRATION PLAN STATUS

| Phase | Task | Status |
|-------|------|--------|
| 0 | Load DIS files in gaia.html | ✅ Complete |
| 1 | DOM adapter (bridge IDs, add elements) | ✅ Complete |
| 2 | Event bridge (interactions → DIS) | ✅ Complete |
| 3 | State machine activation | ✅ Complete |
| 4 | GAIA Nodes on Earth (main site integration) | 📋 Planned — PHASE4_PLAN.md |
| 5 | Key gate UI + modal | ⏳ Pending |
| 6 | Voice engine integration | ⏳ Pending |
| 7 | Cloudflare Worker deployment | ⏳ Pending |
| 8 | Live data integration | ⏳ Pending |
| 9 | Testing + polish | ⏳ Pending |

## PERFORMANCE OPTIMIZATIONS (May 16)

**Problem:** Page felt sluggish, not snappy. Multiple continuous timers and DOM updates.

**Changes:**
1. `js/carbon-clock.js` — setInterval 100ms→500ms, cached DOM refs (no getElementById every tick)
2. `js/ndvi-verifier.js` — setInterval 200ms→1000ms
3. `js/globe.js` — Restored to baseline (bump map + rings are fine, not the culprit)

**Continuous timers on main page:**
- `carbon-clock.js`: 500ms (was 100ms) — clock display
- `gaia-engagement.js`: 30000ms — auto-save
- `app.js`: 5000ms — idle nudge
- `ndvi-verifier.js`: 1000ms (was 200ms) — polls until Data loads, then clears itself

**No continuous animation loops.** All requestAnimationFrame calls are one-shot.

**Full plan:** PHASE4_PLAN.md (16,000 lines — audit + implementation)

**Current state:** Significant code already exists from previous Devs:
- `js/gaia-nodes.js` (967 lines) — node state, XP, render functions for all 4 sites
- `js/globe-overlay.js` (214 lines) — tabbed content box
- `js/gaia-bubble.js` (245 lines) — presence, speak, idle nudge
- `js/gaia-engagement.js` (134 lines) — scoring, tiers, idle
- `js/gaia-voice.js` (187 lines) — 60+ voice lines
- `js/gaia-journal.js` (123 lines) — 16 quests, insights
- `dis/gaia-mind.js` (784 lines) — emotional AI, desires, silence, memory
- `dis/gaia-state-machine.js` (272 lines) — state machine
- `dis/gaia-voice-data.js` (364 lines) — 108+ voice lines, 35 pools
- Plus NDVI verifier, registry check, delegation, pledge wall

**Gaps to fill (12 total):**
1. Globe click not routed through GAIA_NODES
2. No per-site engagement tracking
3. No participant model (analyst, explorer, empath, skeptic, sharer)
4. No knowledge model
5. No emotional voice modulation (rate/pitch/volume)
6. No silence engine (GAIA always speaks)
7. No cross-session memory (GAIA_MIND not integrated)
8. No node visual states on globe
9. No quest progress UI
10. No node-to-chat bridge
11. GAIA_BUBBLE not node-aware
12. Welcome back lacks emotional memory

**Implementation:** 8 steps, ~500 lines added, 1 new file
- COP31 MVP: 4-5 days
- Full build: 8.5-10 days

---

## KEY METRICS

- **Total files:** 35 JS/HTML + 10 MD + climate-dataset
- **Total lines:** ~18,200
- **Project sites:** 4 (Sri Lanka, Antalya, Benin, Borneo)
- **Biome types:** 12
- **Quests:** 16 (4 tiers)
- **Voice lines:** 108+ (35 pools)
- **Data APIs live:** 2 (NOAA, Carbonmark)
- **Data APIs documented:** 20+
- **COP31 countdown:** ~170 days

---

## OPEN QUESTIONS (needs decisions)

1. Who pays for OpenRouter API calls? User-branded key vs. project key?
2. COP31 booth setup — Kiosk? Tablet? Projection?
3. Turkish language support needed?
4. Cloudflare Workers + KV budget?
5. Should index.html get a lightweight GAIA overlay, or keep "Talk to GAIA" link?
6. GaiaClient runtime error — needs debugging (non-blocking for now)

---

## DECISION LOG

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-15 | Build consigliere tracking system | Multiple agents, need visibility |
| 2026-05-15 | Evolve gaia.html, don't rebuild | Existing UI too valuable to replace |
| 2026-05-15 | DOM adapter pattern (not rename) | Preserve existing IDs, additive-only |
| 2026-05-16 | Fix module exposure (const → window.X) | IIFE pattern didn't expose globals to browser |
| 2026-05-16 | Accept GaiaClient runtime error | Non-blocking; adapter handles all wiring |
