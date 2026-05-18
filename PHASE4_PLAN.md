# PHASE 4 — GAIA NODES ON EARTH
## Complete Implementation Plan v4.0
## Updated: 2026-05-18

---

## ARCHITECTURE OVERVIEW

### The Two Panel Systems

**SITE_PANEL** (js/site-panel.js, css/site-panel.css):
- Left popup panel with layered reveal: Story → Data → Mystery → Reveal → Insight
- Opens when clicking globe markers (via GAIA_NODES fallback)
- Has verification section (satellite NDVI + registry check)
- Has prediction questions and journal integration
- This is the PRIMARY interaction panel — keep it

**GLOBE_OVERLAY** (js/globe-overlay.js, css/globe-overlay.css):
- Left-anchored tabbed content box
- Registered by gaia-nodes.js with per-site tabs
- Opens via GAIA_NODES.onNodeClick() → GLOBE_OVERLAY.open()
- This is the SECONDARY overlay — used for richer tabbed content

### The GAIA Section (NEW)

A dedicated GAIA section within SITE_PANEL that:
- Shows GAIA's context-aware guidance for the current site
- Provides suggestions for what to explore next (on the globe and within the site)
- Adapts based on user's engagement state and participant model
- Speaks with emotional voice modulation
- Can be collapsed/expanded to not overwhelm the user

### Modular Globe Content Types

The globe will have many types of markers beyond the 4 project sites. Each type gets:
- Its own marker style (color, size, icon)
- Its own GAIA guidance context
- Its own panel content (registered via GLOBE_OVERLAY or SITE_PANEL)

Content types:
1. **Project Sites** (4 existing) — Sri Lanka, Antalya, Benin, Borneo
2. **Cities** (future) — COP31 venues, partner cities, impact cities
3. **Events** (future) — COP31, regional summits, restoration milestones
4. **Biomes** (future) — Interactive biome regions on the globe
5. **Data Points** (future) — Live sensor data, satellite passes, verification points

---

## 0. CURRENT STATE (What's Already Done)

### Performance (May 17-18)
- ✅ Removed `defer` from quiz/cycle/biomes/counters — restored baseline sync load order
- ✅ Scroll progress bar throttled with rAF — eliminated 60+ forced reflows/sec
- ✅ Killed ndvi-verifier 1s polling — replaced with one-shot DOMContentLoaded listener
- ✅ All 26 JS files pass `node --check`
- ✅ Page is snappy again — matches baseline performance

### DIS Integration (May 15-16)
- ✅ gaia-dom-adapter.js — bridges DIS ↔ gaia.html
- ✅ gaia-integration.js — wires DIS callbacks to chat UI
- ✅ State machine activated — GAIA speaks in chat, voice library loaded
- ✅ GAIA speaks greeting on page load
- ✅ Sidebar clicks → GAIA responds with contextual voice lines
- ✅ Sandbox calc → GAIA comments on results
- ✅ Idle nudges at 10s/20s/40s/60s
- ✅ Engagement score tracks per interaction
- ✅ Zero console errors

### Marketing Features (May 16)
- ✅ Carbon Clock — live ticking CO₂ counter
- ✅ Delegation — country-specific personalized entry
- ✅ Pledge Wall v2 — public commitments after meaningful moments

### What Exists But Isn't Fully Wired
- `js/gaia-nodes.js` (967 lines) — node state, XP, render functions for all 4 sites
- `js/globe-overlay.js` (214 lines) — tabbed content box, registry pattern
- `js/gaia-bubble.js` (245 lines) — presence, speak, idle nudge
- `js/gaia-engagement.js` (134 lines) — scoring, tiers, idle
- `js/gaia-voice.js` (187 lines) — 60+ voice lines
- `js/gaia-journal.js` (123 lines) — 16 quests, insights
- `dis/gaia-mind.js` (784 lines) — emotional AI, desires, silence, memory
- `dis/gaia-state-machine.js` (272 lines) — state machine
- `dis/gaia-voice-data.js` (364 lines) — 108+ voice lines, 35 pools

---

## 1. GAPS TO FILL (14 Total)

### Gap 1: No GAIA Section in SITE_PANEL
**Current:** SITE_PANEL has story/data/mystery/reveal/insight layers but no GAIA guidance
**Needed:** A collapsible GAIA section that provides context-aware suggestions
**Impact:** HIGH — this is the main way users interact with GAIA on the globe

### Gap 2: No "What to Explore Next" Suggestions
**Current:** After completing a site, user has no guidance on where to go
**Needed:** GAIA suggests next sites/events based on engagement state and participant model
**Impact:** HIGH — drives exploration of the full globe

### Gap 3: No Per-Site Engagement Tracking
**Current:** gaia-engagement.js only has global score
**Needed:** siteEngagement object with per-site XP, layers, scenarios, time
**Impact:** HIGH — required for node visual states, quest progress, personalization

### Gap 4: No Participant Model
**Current:** No archetype detection
**Needed:** Track analytical/intuitive/emotional/social scores, detect archetype
**Impact:** MEDIUM — enables GAIA to adapt tone and content to user type

### Gap 5: No Knowledge Model
**Current:** No tracking of what user understands
**Needed:** Track understanding of carbon cycle, biomes, fire, restoration, tipping points
**Impact:** MEDIUM — enables GAIA to avoid repeating known concepts

### Gap 6: No Emotional Voice Modulation
**Current:** All voice lines spoken the same way
**Needed:** rate/pitch/volume adjustments per tone (grief, excited, fierce, warm, etc.)
**Impact:** HIGH — GAIA feels dramatically more alive

### Gap 7: No Silence Engine
**Current:** GAIA speaks on every event
**Needed:** Context-aware silence rules (fire year, Jean's story, carbon data)
**Impact:** HIGH — silence is powerful, makes speech more meaningful

### Gap 8: No Cross-Session Memory
**Current:** GAIA_MIND exists in dis/ but not loaded on main site
**Needed:** gaia-mind-main.js wrapper, load dis/gaia-mind.js on main site
**Impact:** HIGH — GAIA remembers who you are across visits

### Gap 9: No Node Visual States on Globe
**Current:** Globe markers are static
**Needed:** locked → available → explored → mastered visual states
**Impact:** MEDIUM — visual feedback for engagement progression

### Gap 10: No Quest Progress UI
**Current:** Quests track internally but no visual progress
**Needed:** renderQuestProgress() function in gaia-journal.js
**Impact:** LOW — quests work, just no visual indicator

### Gap 11: No Globe-to-Chat Bridge
**Current:** No way to go from globe exploration to full GAIA chat with context
**Needed:** "Open Full GAIA" button in bubble that passes site context to gaia.html
**Impact:** MEDIUM — connects the two pages

### Gap 12: GAIA_BUBBLE Not Node-Aware
**Current:** Bubble doesn't track which site user is interacting with
**Needed:** setCurrentSite(siteId) + visual indicator
**Impact:** LOW — nice for context awareness

### Gap 13: Welcome Back Lacks Emotional Memory
**Current:** Shows CO2 delta only
**Needed:** Integrate GAIA_MIND for emotional memory, significant moments, unresolved threads
**Impact:** MEDIUM — makes return visits feel personal

### Gap 14: No Modular Content Registry for Future Globe Types
**Current:** Only 4 project sites registered
**Needed:** Extensible registry pattern for cities, events, biomes, data points
**Impact:** MEDIUM — future-proofs the globe for COP31 content

---

## 2. IMPLEMENTATION PLAN

### STEP 1: GAIA Section in SITE_PANEL (1.5 days)
**Priority:** CRITICAL — this is the core user-facing feature

**Files:** `js/site-panel.js` (+60 lines), `css/site-panel.css` (+40 lines), `js/gaia-voice.js` (+20 lines)

**Design:**
The GAIA section is a collapsible panel at the top of SITE_PANEL that:
- Shows GAIA's current context (which site, what layer user is on)
- Provides 1-2 suggestion chips for what to do next
- Has a compact voice line display (text only, no bubble)
- Collapses to a thin bar when not actively guiding

**Layout within SITE_PANEL:**
```
┌─────────────────────────────────┐
│ ✕  Site Name                    │  ← existing header
├─────────────────────────────────┤
│ 🌍 GAIA                         │  ← NEW: GAIA section (collapsible)
│ "This land was degraded for     │
│  decades. Look at the NDVI      │
│  data — what do you see?"       │
│ [Explore Data] [Why this site?] │  ← suggestion chips
├─────────────────────────────────┤
│ Story layer...                  │  ← existing layers
│ Data layer...                   │
│ ...                             │
└─────────────────────────────────┘
```

**Code changes:**

In `js/site-panel.js`, add to renderLayer():
```javascript
// Add GAIA section after header, before layers:
function renderGAIAsection(site, layer) {
  const gaiaContext = getGAIAContext(site, layer);
  return `
    <div class="site-panel-gaia" id="site-panel-gaia">
      <div class="gaia-section-header" onclick="SITE_PANEL.toggleGAIA()">
        <span class="gaia-section-icon">🌍</span>
        <span class="gaia-section-title">GAIA</span>
        <span class="gaia-section-toggle" id="gaia-toggle-icon">▼</span>
      </div>
      <div class="gaia-section-body" id="gaia-section-body">
        <div class="gaia-guidance">${gaiaContext.guidance}</div>
        <div class="gaia-suggestions">
          ${gaiaContext.suggestions.map(s => `
            <button class="gaia-suggestion-chip" onclick="${s.action}">${s.label}</button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function getGAIAContext(site, layer) {
  // Return context-aware guidance based on:
  // - current site
  // - current layer (story/data/mystery/reveal/insight)
  // - user's engagement state (from GAIA_ENGAGEMENT)
  // - user's participant model (analyst/explorer/empath/etc.)
  // - what the user has already seen
  
  const contexts = {
    sri_lanka: {
      story: {
        guidance: "This land was degraded for decades. The Northern Province saw conflict, displacement, and ecological collapse. But restoration is possible — and it's happening.",
        suggestions: [
          { label: "Read the full story", action: "SITE_PANEL.scrollToLayer('story')" },
          { label: "Why Sri Lanka?", action: "GAIA_VOICE.speak('SRI_LANKA_WHY')" },
        ],
      },
      data: {
        guidance: "Look at the NDVI sparkline. See that flat line? That's decades of bare soil. Now look at the right edge — that's the restoration kicking in.",
        suggestions: [
          { label: "Show me the data", action: "SITE_PANEL.scrollToLayer('data')" },
          { label: "Verify with satellite", action: "SITE_PANEL.verifyCurrentSite()" },
        ],
      },
      // ... more layers
    },
    // ... more sites
  };
  
  return contexts[site.id]?.[layer] || {
    guidance: `Exploring ${site.name}. ${site.narrative.substring(0, 100)}...`,
    suggestions: [
      { label: "What happened here?", action: "SITE_PANEL.nextLayer()" },
    ],
  };
}

function toggleGAIA() {
  const body = document.getElementById('gaia-section-body');
  const icon = document.getElementById('gaia-toggle-icon');
  if (body) body.classList.toggle('collapsed');
  if (icon) icon.textContent = body?.classList.contains('collapsed') ? '▶' : '▼';
}
```

In `css/site-panel.css`:
```css
/* GAIA Section in Site Panel */
.site-panel-gaia {
  margin: 8px 0 12px 0;
  background: rgba(78, 205, 196, 0.03);
  border: 1px solid rgba(78, 205, 196, 0.1);
  border-radius: 8px;
  overflow: hidden;
}

.gaia-section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
}

.gaia-section-header:hover {
  background: rgba(78, 205, 196, 0.05);
}

.gaia-section-icon { font-size: 14px; }
.gaia-section-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--teal);
  flex: 1;
}
.gaia-section-toggle {
  font-size: 8px;
  color: var(--text3);
  transition: transform 0.2s;
}

.gaia-section-body {
  padding: 0 12px 12px 12px;
  transition: max-height 0.3s ease, padding 0.3s ease;
  max-height: 200px;
  overflow: hidden;
}
.gaia-section-body.collapsed {
  max-height: 0;
  padding: 0 12px;
}

.gaia-guidance {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text2);
  margin-bottom: 8px;
}

.gaia-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.gaia-suggestion-chip {
  padding: 4px 10px;
  border: 1px solid rgba(78, 205, 196, 0.15);
  border-radius: 12px;
  background: rgba(78, 205, 196, 0.04);
  color: var(--teal);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.gaia-suggestion-chip:hover {
  background: rgba(78, 205, 196, 0.1);
  border-color: rgba(78, 205, 196, 0.3);
}
```

**Test:** Open a site panel → GAIA section appears with context → suggestion chips work → collapse/expand works

---

### STEP 2: "What to Explore Next" Suggestions (1 day)
**Priority:** HIGH — drives globe exploration

**Files:** `js/gaia-nodes.js` (+80 lines), `js/gaia-engagement.js` (+20 lines)

**Design:**
After completing a site (all layers revealed), GAIA suggests what to explore next.
Suggestions appear in:
1. The GAIA section of the completed site's panel
2. The GAIA bubble (as a persistent suggestion)
3. The globe itself (highlighted markers for suggested next sites)

**Logic:**
```javascript
function getNextSuggestions(siteId, engagementState) {
  const allSites = ['sri_lanka', 'antalya', 'benin', 'borneo'];
  const visited = Object.keys(engagementState.siteEngagement)
    .filter(id => engagementState.siteEngagement[id].visited);
  const unvisited = allSites.filter(id => !visited.includes(id));
  
  // Priority: unvisited sites first
  if (unvisited.length > 0) {
    return unvisited.map(id => ({
      type: 'site',
      id,
      label: getSiteLabel(id),
      reason: getSuggestionReason(id, engagementState),
      action: `flyToSite('${id}')`,
      priority: 'high',
    }));
  }
  
  // All visited: suggest deeper exploration
  const partiallyExplored = allSites.filter(id => {
    const s = engagementState.siteEngagement[id];
    return s && s.layersRevealed < 5;
  });
  
  if (partiallyExplored.length > 0) {
    return partiallyExplored.map(id => ({
      type: 'site',
      id,
      label: `Revisit ${getSiteLabel(id)}`,
      reason: 'You haven\'t seen all the data yet',
      action: `flyToSite('${id}')`,
      priority: 'medium',
    }));
  }
  
  // All fully explored: suggest GAIA chat
  return [{
    type: 'chat',
    id: 'gaia',
    label: 'Talk to GAIA',
    reason: 'You\'ve seen the data. Now let\'s talk about what it means.',
    action: 'openFullGAIA()',
    priority: 'high',
  }];
}

function getSuggestionReason(siteId, engagementState) {
  const archetype = engagementState.archetype;
  const reasons = {
    sri_lanka: {
      analyst: 'The carbon density data is remarkable — from 10 to 180 tC/ha',
      explorer: 'This is where restoration meets conflict recovery',
      empath: 'The human story here is as powerful as the carbon data',
      skeptic: 'The satellite verification is solid — see for yourself',
      sharer: 'This is the most shareable restoration story we have',
    },
    antalya: {
      analyst: 'The 2021 wildfire NDVI crash is a textbook case',
      explorer: 'COP31 host site — the fire year data is stark',
      empath: '60,000 hectares burned in days. The recovery is slow.',
      skeptic: 'Cross-reference the satellite data with registry records',
      sharer: 'This is the climate story Turkey needs to tell',
    },
    benin: {
      analyst: 'Mangrove carbon density is 950 tC/ha — highest of any biome',
      explorer: "Jean's homeland. The mangrove story is personal.",
      empath: 'When mangroves are destroyed, centuries of carbon go up in smoke',
      skeptic: 'The NDVI drop matches the carbon loss — verify it',
      sharer: "Jean's letter is the emotional anchor of this project",
    },
    borneo: {
      analyst: 'NDVI 0.65 but only 50 tC/ha — the greenest lie on Earth',
      explorer: 'Peat swamp vs oil palm — see the carbon difference',
      empath: '1,400 tC/ha reduced to 50. That\'s a 96% loss.',
      skeptic: 'The satellite sees through the green. Look at the data.',
      sharer: 'This is the most important carbon story most people don\'t know',
    },
  };
  return reasons[siteId]?.[archetype] || reasons[siteId]?.explorer || 'Worth exploring';
}
```

**Globe marker highlighting for suggestions:**
```javascript
// In globe.js, add suggestion highlighting:
function highlightSuggestedMarkers(suggestionIds) {
  GlobeModule.world.pointColor(site => {
    if (suggestionIds.includes(site.id)) return '#ffd700'; // gold for suggested
    const state = typeof GAIA_NODES !== 'undefined' 
      ? GAIA_NODES.getNodeState(site.id) 
      : null;
    if (!state || state.state === 'locked') return 'rgba(78,205,196,0.3)';
    if (state.state === 'available') return 'rgba(78,205,196,0.6)';
    if (state.state === 'explored') return 'rgba(123,232,208,0.9)';
    if (state.state === 'mastered') return '#4ecdc4';
    return 'rgba(78,205,196,0.6)';
  });
}
```

**Test:** Complete a site → GAIA suggests next site → suggestion chip flies to site → globe markers highlight suggested sites

---

### STEP 3: Per-Site Engagement + Participant Model + Knowledge Model (1 day)
**Priority:** HIGH — required for personalization

**Files:** `js/gaia-engagement.js` (+80 lines)

**Changes:**
```javascript
// Add to existing state:
const siteEngagement = {
  sri_lanka: { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  antalya:   { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  benin:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  borneo:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
};

const participantModel = {
  analytical: 0, intuitive: 0, emotional: 0, social: 0,
  isSkeptic: false, isExplorer: false, isDeepDiver: false,
  isReturner: false, isSharer: false,
  asksQuestions: 0, makesPredictions: 0, correctPredictions: 0,
};

const knowledgeModel = {
  understandsCarbonCycle: 0,
  understandsBiomes: 0,
  understandsFire: 0,
  understandsRestoration: 0,
  understandsTippingPoints: 0,
};

// Functions:
function addSignal(signalType, siteId, context) {
  // Update global score (existing)
  // Update siteEngagement[siteId]
  // Update participantModel based on signalType
  // Update knowledgeModel based on context
}

function getArchetype() {
  // Return dominant archetype: analyst | explorer | empath | skeptic | sharer
  const p = participantModel;
  const scores = {
    analyst: p.analytical + p.asksQuestions + p.makesPredictions,
    explorer: p.intuitive + p.isExplorer + p.isDeepDiver,
    empath: p.emotional,
    social: p.social + p.isSharer,
    skeptic: p.isSkeptic + (p.makesPredictions > 0 ? p.correctPredictions / p.makesPredictions : 0),
  };
  return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}

function getSiteStates() {
  // Return site states for globe marker rendering
  return Object.fromEntries(
    Object.entries(siteEngagement).map(([id, s]) => [id, {
      state: s.xp >= 100 ? 'mastered' : s.xp >= 50 ? 'explored' : s.xp >= 10 ? 'available' : 'locked',
      xp: s.xp,
      visited: s.visited,
    }])
  );
}

// Upgrade save()/load() to include new state
```

**Test:** Per-site XP accumulates, archetype detection works after ~5 interactions

---

### STEP 4: Emotional Voice + Silence Engine (1 day)
**Priority:** HIGH — GAIA feels alive

**Files:** `js/gaia-voice.js` (+80 lines)

**Changes:**
```javascript
const VOICE_MODIFIERS = {
  grief:      { rate: -0.10, pitch: -0.05, volume: 0,    pauseBefore: 800 },
  concerned:  { rate: -0.08, pitch: -0.03, volume: 0,    pauseBefore: 500 },
  excited:    { rate: +0.05, pitch: 0,     volume: +0.1, pauseBefore: 0 },
  proud:      { rate: +0.05, pitch: 0,     volume: +0.1, pauseBefore: 0 },
  fierce:     { rate: +0.10, pitch: -0.08, volume: +0.15,pauseBefore: 0 },
  warm:       { rate: -0.08, pitch: +0.03, volume: -0.05,pauseBefore: 500 },
  mysterious: { rate: -0.12, pitch: -0.05, volume: -0.1, pauseBefore: 1200 },
  nurturing:  { rate: -0.08, pitch: +0.03, volume: -0.05,pauseBefore: 500 },
  urgent:     { rate: +0.08, pitch: -0.05, volume: +0.1, pauseBefore: 200 },
  playful:    { rate: +0.03, pitch: +0.05, volume: 0,    pauseBefore: 300 },
};

function shouldBeSilent(state, siteId, context) {
  if (siteId === 'borneo' && state === 'DATA_REVEAL' && context?.layer === 'carbon') {
    return { silent: true, reason: 'The carbon data speaks for itself' };
  }
  if (siteId === 'antalya' && state === 'DATA_REVEAL' && context?.year === 2021) {
    return { silent: true, reason: 'The fire year needs silence' };
  }
  if (siteId === 'benin' && state === 'DATA_REVEAL' && context?.layer === 'narrative') {
    return { silent: true, reason: "Let Jean's story breathe" };
  }
  if (typeof GAIA_MIND !== 'undefined') {
    return GAIA_MIND.shouldGaiaSpeak({ state, siteId, ...context });
  }
  return { silent: false };
}

// Upgrade speak() to check silence first and return voice modifiers
```

**Test:** GAIA's voice changes with emotion, GAIA stays silent at powerful moments

---

### STEP 5: GAIA Mind Integration (2 days)
**Priority:** HIGH — cross-session memory

**New file:** `js/gaia-mind-main.js` (~200 lines)
**Files to modify:** `index.html` (+1 script tag), `js/app.js` (+20 lines)

**Changes:**

`index.html` — add before app.js:
```html
<script src="dis/gaia-mind.js"></script>
<script src="js/gaia-mind-main.js"></script>
```

`js/gaia-mind-main.js`:
```javascript
const GAIA_MIND_MAIN = (() => {
  function init() {
    if (typeof GAIA_MIND === 'undefined') return;
    // Load persisted mind state
    // Apply emotional decay based on time since last visit
  }
  
  function onSiteVisit(siteId) { /* Update mind state */ }
  function onInteraction(signalType, context) { /* Update models */ }
  function getWelcomeBackMessage() { /* Return emotional memory message */ }
  function getGAIAContext(siteId, layer, engagementState) {
    // Return context-aware guidance based on:
    // - site and layer
    // - user's history with this site
    // - participant model
    // - knowledge model
    // - emotional memory
  }
  
  return { init, onSiteVisit, onInteraction, getWelcomeBackMessage, getGAIAContext };
})();
```

**Test:** GAIA remembers across sessions, emotional residue decays over time

---

### STEP 6: Node Visual States on Globe (1 day)
**Priority:** MEDIUM — visual feedback for engagement

**Files:** `js/globe.js` (+40 lines), `css/globe-overlay.css` (+30 lines)

**Changes:**

In `js/globe.js`:
```javascript
function updateNodeVisuals() {
  const states = typeof GAIA_ENGAGEMENT !== 'undefined' 
    ? GAIA_ENGAGEMENT.getSiteStates() 
    : {};
  
  this.world.pointColor(site => {
    if (states[site.id]?.suggested) return '#ffd700'; // gold for suggested next
    const s = states[site.id];
    if (!s || s.state === 'locked') return 'rgba(78,205,196,0.3)';
    if (s.state === 'available') return 'rgba(78,205,196,0.6)';
    if (s.state === 'explored') return 'rgba(123,232,208,0.9)';
    if (s.state === 'mastered') return '#4ecdc4';
    return 'rgba(78,205,196,0.6)';
  });
  
  this.world.pointRadius(site => {
    if (states[site.id]?.suggested) return 0.7; // larger for suggested
    const s = states[site.id];
    if (!s || s.state === 'locked') return 0.3;
    if (s.state === 'available') return 0.4;
    if (s.state === 'explored') return 0.5;
    if (s.state === 'mastered') return 0.6;
    return 0.4;
  });
}
```

**Test:** Node appearance changes with engagement, suggested nodes glow gold

---

### STEP 7: Quest Progress UI + Globe-to-Chat Bridge (1 day)
**Priority:** MEDIUM

**Files:** `js/gaia-journal.js` (+40 lines), `js/gaia-bubble.js` (+30 lines), `css/gaia-bubble.css` (+20 lines)

**Changes:**

`js/gaia-journal.js`:
```javascript
function renderQuestProgress(container) {
  const quests = getQuests();
  container.innerHTML = quests.map(q => `
    <div class="quest-item ${q.completed ? 'completed' : ''}">
      <div class="quest-icon">${q.icon}</div>
      <div class="quest-info">
        <div class="quest-name">${q.name}</div>
        <div class="quest-progress-bar">
          <div class="quest-progress-fill" style="width:${q.progress}%"></div>
        </div>
      </div>
      <div class="quest-xp">+${q.xp} XP</div>
    </div>
  `).join('');
}
```

`js/gaia-bubble.js`:
```javascript
function openFullGAIA(siteId) {
  if (siteId) {
    sessionStorage.setItem('gaia_context', JSON.stringify({
      siteId,
      timestamp: Date.now(),
    }));
  }
  window.open('gaia.html', '_blank');
}
```

**Test:** Quest progress visible, bridge to chat passes context

---

### STEP 8: Bubble Node Awareness (0.5 day)
**Priority:** LOW

**Files:** `js/gaia-bubble.js` (+20 lines)

**Changes:**
```javascript
let _currentSiteId = null;

function setCurrentSite(siteId) {
  _currentSiteId = siteId;
  const indicator = document.getElementById('bubble-site-indicator');
  if (indicator && siteId) {
    indicator.textContent = siteId.replace('_', ' ').toUpperCase();
    indicator.classList.add('active');
  }
}

function getCurrentSite() { return _currentSiteId; }
```

**Test:** Bubble shows which site user is currently exploring

---

### STEP 9: Modular Content Registry (0.5 day)
**Priority:** MEDIUM — future-proofs for COP31

**Files:** `js/gaia-nodes.js` (+60 lines)

**Design:**
```javascript
// Content type definitions for future globe markers:
const CONTENT_TYPES = {
  site: {
    marker: { color: '#4ecdc4', size: 0.4, pulse: true },
    panel: 'site-panel',
    gaiaContext: true,
  },
  city: {
    marker: { color: '#ffd700', size: 0.3, pulse: false },
    panel: 'city-panel',  // future
    gaiaContext: true,
  },
  event: {
    marker: { color: '#ff6b6b', size: 0.5, pulse: true },
    panel: 'event-panel',  // future
    gaiaContext: true,
  },
  biome: {
    marker: { color: '#2a8a3a', size: 0.6, pulse: false },
    panel: 'biome-panel',  // future
    gaiaContext: false,
  },
  data: {
    marker: { color: '#9b59b6', size: 0.2, pulse: false },
    panel: 'data-panel',  // future
    gaiaContext: false,
  },
};

// Generic register function:
function registerContent(config) {
  const type = CONTENT_TYPES[config.type] || CONTENT_TYPES.site;
  GLOBE_OVERLAY.registerSite({
    ...config,
    markerStyle: type.marker,
    hasGAIA: type.gaiaContext,
  });
}

// Future: batch register from JSON:
function registerFromJSON(url) {
  fetch(url)
    .then(r => r.json())
    .then(data => data.forEach(config => registerContent(config)));
}
```

**Test:** New content types can be registered without modifying core code

---

### STEP 10: Testing + Polish (1-2 days)
**Priority:** REQUIRED

**Test Protocol:**
1. **Rusher test** — Click through all sites quickly. GAIA should adapt, not spam.
2. **Deep Diver test** — Spend 5+ min on one site. GAIA should go deeper, not repeat.
3. **Sharer test** — Complete a site, check share card, check social preview.
4. **Return visit test** — Close tab, reopen. GAIA should remember.
5. **Suggestion flow test** — Complete a site → get suggestion → fly to next site → repeat.
6. **Mobile test** — All interactions work on phone viewport.
7. **Performance test** — JS heap < 100MB, no continuous timers, scroll is smooth.
8. **Cross-browser test** — Safari, Chrome, Firefox.

---

## 3. TOTAL ESTIMATE

| Step | Task | Days | Priority |
|------|------|------|----------|
| 1 | GAIA section in SITE_PANEL | 1.5 | CRITICAL |
| 2 | "What to Explore Next" suggestions | 1 | HIGH |
| 3 | Per-site engagement + participant + knowledge model | 1 | HIGH |
| 4 | Emotional voice + silence engine | 1 | HIGH |
| 5 | GAIA mind integration | 2 | HIGH |
| 6 | Node visual states on globe | 1 | MEDIUM |
| 7 | Quest progress UI + globe-to-chat bridge | 1 | MEDIUM |
| 8 | Bubble node awareness | 0.5 | LOW |
| 9 | Modular content registry | 0.5 | MEDIUM |
| 10 | Testing + polish | 1-2 | REQUIRED |
| **TOTAL** | | **10.5-12 days** | |

---

## 4. COP31 MVP (5-6 days)

Minimum viable for COP31 booth:

| Step | Task | Days |
|------|------|------|
| 1 | GAIA section in SITE_PANEL | 1.5 |
| 2 | "What to Explore Next" suggestions | 1 |
| 3 | Per-site engagement + participant model | 1 |
| 4 | Emotional voice + silence engine | 1 |
| 6 | Node visual states | 1 |
| 10 | Testing + polish | 1-2 |
| **TOTAL** | | **5.5-7 days** |

**Skip for MVP (add post-COP31):**
- GAIA mind integration (complex, can be added later)
- Quest progress UI (quests work, just no visual)
- Bubble node awareness (nice to have)
- Modular content registry (not needed until new content types)

---

## 5. MARKETING QUEUE (Post-MVP)

| # | Feature | Description | Est. Days |
|---|---------|-------------|-----------|
| 1 | Share Your Impact | Pre-built social cards with user's results | 1 |
| 2 | The Antalya Connection | Local COP31 narrative, Turkey focus | 1 |
| 3 | GAIA's Field Notes | Daily blog from GAIA's perspective | 2 |
| 4 | Green Lie Detector | Interactive greenwashing detection tool | 2 |
| 5 | Partner With GAIA | Corporate onboarding flow | 2 |
| 6 | 170-Day Countdown | Pre-COP31 campaign timer | 0.5 |
| 7 | Jean's Letter | Emotional anchor story (Benin site) | 1 |

**Total marketing queue: ~9.5 days**

---

## 6. PRODUCTION HARDENING (Post-MVP)

| Task | Description | Est. Days |
|------|-------------|-----------|
| Bundle scripts | 26 → 1-2 requests (esbuild or concat) | 1 |
| Cache globe.gl locally | Download 481KB lib, serve from server | 0.5 |
| Cloudflare Worker deployment | Deploy dis/worker.js, configure KV | 1 |
| Voice engine integration | Wire dis/gaia-voice-engine.js to main site | 1 |
| Service worker | Offline cache for repeat visits | 1 |
| Performance audit | Real browser testing on M3 Mac, low-end Windows | 0.5 |

**Total production hardening: ~5 days**

---

## 7. COMPLETE FILE LIST

### Files to Modify

| File | Change | Lines Added |
|------|--------|-------------|
| `js/site-panel.js` | GAIA section, suggestion rendering | ~80 |
| `js/gaia-nodes.js` | Next-suggestion logic, modular registry | ~100 |
| `js/gaia-engagement.js` | Per-site engagement, participant model, knowledge model | ~80 |
| `js/gaia-voice.js` | Voice modifiers, silence engine | ~80 |
| `js/globe.js` | Node visual states, suggestion highlighting | ~50 |
| `js/gaia-journal.js` | Quest progress UI | ~40 |
| `js/gaia-bubble.js` | Node awareness, globe-to-chat bridge | ~50 |
| `js/app.js` | Welcome back with GAIA_MIND | ~20 |
| `css/site-panel.css` | GAIA section styles, suggestion chips | ~50 |
| `css/globe-overlay.css` | Node visual state styles | ~30 |
| `css/gaia-bubble.css` | Quest progress, expanded bubble styles | ~20 |
| `index.html` | Add gaia-mind.js + gaia-mind-main.js script tags | ~2 |

### New Files

| File | Purpose | Lines |
|------|---------|-------|
| `js/gaia-mind-main.js` | GAIA_MIND wrapper for main site | ~200 |

### Total New Code: ~800 lines

---

## 8. DEPENDENCY GRAPH

```
Step 3 (Engagement model) ──→ Step 2 (Suggestions need engagement state)
                           ──→ Step 6 (Node visual states)
                           ──→ Step 5 (GAIA mind needs participant model)

Step 1 (GAIA section) ──→ Step 2 (Suggestions appear in GAIA section)

Step 4 (Voice + Silence) ──→ Step 5 (GAIA mind uses silence engine)

Step 5 (GAIA mind) ──→ Step 1 (GAIA section uses mind for context)

Steps 1, 3, 4 can be done in parallel
Step 2 depends on Steps 1, 3
Step 5 depends on Step 3
Step 6 depends on Step 3
Steps 7-9 are independent
Step 10 (Testing) depends on all
```

---

## 9. RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| GAIA_MIND too heavy for main site | High memory on 8GB Mac | Lazy-load only after first interaction |
| globe.gl performance with visual states | Frame drops on low-end | Use CSS transforms, not JS animation |
| Cross-session memory bloat | localStorage quota | Cap at 50 entries, LRU eviction |
| Voice modulation not supported on all browsers | Silent fallback | Check SpeechSynthesis API support |
| Too many new globals | Namespace pollution | Keep IIFE pattern, single global per module |
| Suggestion system feels pushy | User annoyance | Max 2 suggestions, dismissible, respect silence |

---

## 10. SUCCESS CRITERIA

**COP31 MVP is ready when:**
- [ ] GAIA section appears in site panel with context-aware guidance
- [ ] Suggestion chips guide users to next sites/events
- [ ] Per-site XP tracks and persists
- [ ] GAIA's voice modulates with emotion (rate/pitch/volume)
- [ ] GAIA stays silent at powerful moments
- [ ] Node markers change appearance with engagement
- [ ] Suggested next sites glow gold on the globe
- [ ] No console errors
- [ ] Scroll is smooth (no jank)
- [ ] Works on Safari, Chrome, Firefox
- [ ] Works on phone viewport
- [ ] JS heap < 100MB
