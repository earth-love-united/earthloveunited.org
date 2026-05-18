# PHASE 4 — GAIA NODES ON EARTH
## Complete Implementation Plan v3.0
## Updated: 2026-05-18

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

### What Exists But Isn't Wired
- `js/gaia-nodes.js` (967 lines) — node state, XP, render functions for all 4 sites
- `js/globe-overlay.js` (214 lines) — tabbed content box
- `js/gaia-bubble.js` (245 lines) — presence, speak, idle nudge
- `js/gaia-engagement.js` (134 lines) — scoring, tiers, idle
- `js/gaia-voice.js` (187 lines) — 60+ voice lines
- `js/gaia-journal.js` (123 lines) — 16 quests, insights
- `dis/gaia-mind.js` (784 lines) — emotional AI, desires, silence, memory
- `dis/gaia-state-machine.js` (272 lines) — state machine
- `dis/gaia-voice-data.js` (364 lines) — 108+ voice lines, 35 pools

---

## 1. GAPS TO FILL (12 Total)

### Gap 1: Globe Click Not Routed Through GAIA_NODES
**Current:** globe.js line 28-31 opens Panel directly
**Needed:** Route through GAIA_NODES.onNodeClick() first
**Impact:** HIGH — this is the main user flow from globe to site content

### Gap 2: No Per-Site Engagement Tracking
**Current:** gaia-engagement.js only has global score
**Needed:** siteEngagement object with per-site XP, layers, scenarios, time
**Impact:** HIGH — required for node visual states, quest progress, personalization

### Gap 3: No Participant Model
**Current:** No archetype detection
**Needed:** Track analytical/intuitive/emotional/social scores, detect archetype
**Impact:** MEDIUM — enables GAIA to adapt tone and content to user type

### Gap 4: No Knowledge Model
**Current:** No tracking of what user understands
**Needed:** Track understanding of carbon cycle, biomes, fire, restoration, tipping points
**Impact:** MEDIUM — enables GAIA to avoid repeating known concepts

### Gap 5: No Emotional Voice Modulation
**Current:** All voice lines spoken the same way
**Needed:** rate/pitch/volume adjustments per tone (grief, excited, fierce, warm, etc.)
**Impact:** HIGH — GAIA feels dramatically more alive

### Gap 6: No Silence Engine
**Current:** GAIA speaks on every event
**Needed:** Context-aware silence rules (fire year, Jean's story, carbon data)
**Impact:** HIGH — silence is powerful, makes speech more meaningful

### Gap 7: No Cross-Session Memory
**Current:** GAIA_MIND exists in dis/ but not loaded on main site
**Needed:** gaia-mind-main.js wrapper, load dis/gaia-mind.js on main site
**Impact:** HIGH — GAIA remembers who you are across visits

### Gap 8: No Node Visual States on Globe
**Current:** Globe markers are static
**Needed:** locked → available → explored → mastered visual states
**Impact:** MEDIUM — visual feedback for engagement progression

### Gap 9: No Quest Progress UI
**Current:** Quests track internally but no visual progress
**Needed:** renderQuestProgress() function in gaia-journal.js
**Impact:** LOW — quests work, just no visual indicator

### Gap 10: No Globe-to-Chat Bridge
**Current:** No way to go from globe exploration to full GAIA chat with context
**Needed:** "Open Full GAIA" button in bubble that passes site context to gaia.html
**Impact:** MEDIUM — connects the two pages

### Gap 11: GAIA_BUBBLE Not Node-Aware
**Current:** Bubble doesn't track which site user is interacting with
**Needed:** setCurrentSite(siteId) + visual indicator
**Impact:** LOW — nice for context awareness

### Gap 12: Welcome Back Lacks Emotional Memory
**Current:** Shows CO2 delta only
**Needed:** Integrate GAIA_MIND for emotional memory, significant moments, unresolved threads
**Impact:** MEDIUM — makes return visits feel personal

---

## 2. IMPLEMENTATION PLAN

### STEP 1: Wire GAIA_NODES to Globe (1 day)
**Priority:** CRITICAL — unblocks everything else

**Files:** `js/globe.js` (lines 28-31, 37-44, 46-53, 54-60)

**Changes:**
```javascript
// Replace all .onPointClick / .onLabelClick handlers:
.onPointClick(site => {
  if (typeof GAIA_NODES !== 'undefined') {
    GAIA_NODES.onNodeClick(site.id);
  } else if (typeof SITE_PANEL !== 'undefined') {
    SITE_PANEL.open(site);
  } else {
    Panel.open(site);
  }
})
// Same pattern for .onLabelClick

// Replace hover handlers:
.onPointHover(site => {
  if (site && typeof GAIA_NODES !== 'undefined') {
    GAIA_NODES.onNodeHover(site.id);
  } else if (site && typeof GAIA_PRESENCE !== 'undefined') {
    GAIA_PRESENCE.speak('SITE_TEASER', site.id);
    GAIA_ENGAGEMENT.interact();
  }
})
// Same pattern for .onLabelHover
```

**Test:** Click globe marker → GAIA speaks entry line → GAIA_NODES tracks XP → overlay opens

---

### STEP 2: Per-Site Engagement + Participant Model + Knowledge Model (1 day)
**Priority:** HIGH — required for personalization

**Files:** `js/gaia-engagement.js` (+60 lines)

**Changes:**
```javascript
// Add after existing state:
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

// Add functions:
function addSignal(signalType, siteId, context) {
  // Update global score (existing)
  // Update siteEngagement[siteId]
  // Update participantModel based on signalType
  // Update knowledgeModel based on context
}

function getArchetype() {
  // Return dominant archetype from participantModel
  // analyst | explorer | empath | skeptic | sharer
}

// Upgrade save()/load() to include new state
```

**Test:** Per-site XP accumulates, archetype detection works after ~5 interactions

---

### STEP 3: Emotional Voice + Silence Engine (1 day)
**Priority:** HIGH — GAIA feels alive

**Files:** `js/gaia-voice.js` (+80 lines)

**Changes:**
```javascript
// Add voice modifiers per tone:
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

// Add silence rules:
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

// Upgrade speak() to:
// 1. Check shouldBeSilent() first
// 2. Return voice modifiers alongside text/tone
```

**Test:** GAIA's voice changes with emotion, GAIA stays silent at powerful moments

---

### STEP 4: GAIA Mind Integration (2 days)
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
  // Wrap GAIA_MIND for main site context
  // Handle emotional decay across sessions
  // Manage participant model updates
  // Provide desire calculation
  // Manage cross-session memory
  
  function init() {
    if (typeof GAIA_MIND === 'undefined') return;
    // Load persisted mind state
    // Apply emotional decay based on time since last visit
  }
  
  function onSiteVisit(siteId) {
    // Update mind state for site visit
  }
  
  function onInteraction(signalType, context) {
    // Update participant model, knowledge model
  }
  
  function getWelcomeBackMessage() {
    // Return emotional memory message for returning users
  }
  
  return { init, onSiteVisit, onInteraction, getWelcomeBackMessage };
})();
```

`js/app.js` — upgrade welcome back (lines 54-69):
```javascript
// Replace CO2-only welcome with:
if (typeof GAIA_MIND_MAIN !== 'undefined') {
  const msg = GAIA_MIND_MAIN.getWelcomeBackMessage();
  if (msg) {
    setTimeout(() => {
      if (typeof GAIA_BUBBLE !== 'undefined') {
        GAIA_BUBBLE.speak(msg.text, msg.tone, 8000);
      }
    }, 1500);
  }
}
```

**Test:** GAIA remembers across sessions, emotional residue decays over time

---

### STEP 5: Node Visual States on Globe (1 day)
**Priority:** MEDIUM — visual feedback for engagement

**Files:** `js/globe.js` (+40 lines), `css/globe-overlay.css` (+30 lines)

**Changes:**

In `js/globe.js`, upgrade point rendering:
```javascript
// Add function to update point appearance based on engagement:
function updateNodeVisuals() {
  const states = typeof GAIA_ENGAGEMENT !== 'undefined' 
    ? GAIA_ENGAGEMENT.getSiteStates() 
    : {};
  
  this.world.pointColor(site => {
    const s = states[site.id];
    if (!s || s.state === 'locked') return 'rgba(78,205,196,0.3)';
    if (s.state === 'available') return 'rgba(78,205,196,0.6)';
    if (s.state === 'explored') return 'rgba(123,232,208,0.9)';
    if (s.state === 'mastered') return '#4ecdc4';
    return 'rgba(78,205,196,0.6)';
  });
  
  this.world.pointRadius(site => {
    const s = states[site.id];
    if (!s || s.state === 'locked') return 0.3;
    if (s.state === 'available') return 0.4;
    if (s.state === 'explored') return 0.5;
    if (s.state === 'mastered') return 0.6;
    return 0.4;
  });
}

// Call after globe init and on engagement changes
```

In `css/globe-overlay.css`:
```css
/* Node state animations */
@keyframes node-pulse-locked {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.5; }
}
@keyframes node-pulse-mastered {
  0%, 100% { box-shadow: 0 0 8px rgba(78,205,196,0.4); }
  50% { box-shadow: 0 0 20px rgba(78,205,196,0.8); }
}
```

**Test:** Node appearance changes as user engages (locked → available → explored → mastered)

---

### STEP 6: Quest Progress UI + Globe-to-Chat Bridge (1 day)
**Priority:** MEDIUM

**Files:** `js/gaia-journal.js` (+40 lines), `js/gaia-bubble.js` (+30 lines), `css/gaia-bubble.css` (+20 lines)

**Changes:**

`js/gaia-journal.js`:
```javascript
function renderQuestProgress(container) {
  const quests = getQuests(); // existing function
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
  // Pass context to gaia.html via URL params or localStorage
  if (siteId) {
    sessionStorage.setItem('gaia_context', JSON.stringify({
      siteId,
      timestamp: Date.now(),
    }));
  }
  window.open('gaia.html', '_blank');
}

// Add "Open Full GAIA" button to bubble expanded view
```

**Test:** Quest progress visible in journal tab, bridge to chat passes context

---

### STEP 7: Bubble Node Awareness (0.5 day)
**Priority:** LOW

**Files:** `js/gaia-bubble.js` (+20 lines)

**Changes:**
```javascript
let _currentSiteId = null;

function setCurrentSite(siteId) {
  _currentSiteId = siteId;
  // Update bubble visual to show current site
  const indicator = document.getElementById('bubble-site-indicator');
  if (indicator && siteId) {
    indicator.textContent = siteId.replace('_', ' ').toUpperCase();
    indicator.classList.add('active');
  }
}

function getCurrentSite() {
  return _currentSiteId;
}
```

**Test:** Bubble shows which site user is currently exploring

---

### STEP 8: Testing + Polish (1-2 days)
**Priority:** REQUIRED

**Test Protocol:**
1. **Rusher test** — Click through all sites quickly. GAIA should adapt, not spam.
2. **Deep Diver test** — Spend 5+ min on one site. GAIA should go deeper, not repeat.
3. **Sharer test** — Complete a site, check share card, check social preview.
4. **Return visit test** — Close tab, reopen. GAIA should remember.
5. **Mobile test** — All interactions work on phone viewport.
6. **Performance test** — JS heap < 100MB, no continuous timers, scroll is smooth.
7. **Cross-browser test** — Safari, Chrome, Firefox.

---

## 3. TOTAL ESTIMATE

| Step | Task | Days | Priority |
|------|------|------|----------|
| 1 | Wire GAIA_NODES to globe | 1 | CRITICAL |
| 2 | Per-site engagement + participant + knowledge model | 1 | HIGH |
| 3 | Emotional voice + silence engine | 1 | HIGH |
| 4 | GAIA mind integration | 2 | HIGH |
| 5 | Node visual states on globe | 1 | MEDIUM |
| 6 | Quest progress UI + globe-to-chat bridge | 1 | MEDIUM |
| 7 | Bubble node awareness | 0.5 | LOW |
| 8 | Testing + polish | 1-2 | REQUIRED |
| **TOTAL** | | **8.5-10 days** | |

---

## 4. COP31 MVP (4-5 days)

Minimum viable for COP31 booth:

| Step | Task | Days |
|------|------|------|
| 1 | Wire GAIA_NODES to globe | 1 |
| 2 | Per-site engagement + participant model | 1 |
| 3 | Emotional voice + silence engine | 1 |
| 5 | Node visual states | 1 |
| 8 | Testing + polish | 1-2 |
| **TOTAL** | | **4-5 days** |

**Skip for MVP (add post-COP31):**
- GAIA mind integration (complex, can be added later)
- Quest progress UI (quests work, just no visual)
- Bubble node awareness (nice to have)
- Globe-to-chat bridge (separate feature)

---

## 5. MARKETING QUEUE (Post-MVP)

From PROJECT_TRACKER.md — these are designed and queued:

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
| `js/globe.js` | Route clicks through GAIA_NODES, add node visual states | ~70 |
| `js/gaia-engagement.js` | Per-site engagement, participant model, knowledge model | ~80 |
| `js/gaia-voice.js` | Voice modifiers, silence engine | ~80 |
| `js/gaia-journal.js` | Quest progress UI | ~40 |
| `js/gaia-bubble.js` | Node awareness, globe-to-chat bridge | ~50 |
| `js/app.js` | Welcome back with GAIA_MIND | ~20 |
| `css/globe-overlay.css` | Node visual state styles | ~30 |
| `css/gaia-bubble.css` | Quest progress, expanded bubble styles | ~20 |
| `index.html` | Add gaia-mind.js + gaia-mind-main.js script tags | ~2 |

### New Files

| File | Purpose | Lines |
|------|---------|-------|
| `js/gaia-mind-main.js` | GAIA_MIND wrapper for main site | ~200 |

### Total New Code: ~600 lines

---

## 8. DEPENDENCY GRAPH

```
Step 1 (Wire GAIA_NODES) ──→ Step 5 (Node visual states)
                           ──→ Step 6 (Quest UI)
                           ──→ Step 7 (Bubble awareness)

Step 2 (Engagement model) ──→ Step 5 (Node visual states)
                           ──→ Step 4 (GAIA mind needs participant model)

Step 3 (Voice + Silence) ──→ Step 4 (GAIA mind uses silence engine)

Step 4 (GAIA mind) ──→ Step 6 (Welcome back with memory)

Steps 1-4 can be done in parallel by different agents
Steps 5-7 depend on Steps 1-4
Step 8 (Testing) depends on all
```

---

## 9. RISK REGISTER

| Risk | Impact | Mitigation |
|------|--------|------------|
| GAIA_MIND too heavy for main site | High memory on 8MB Mac | Lazy-load only after first interaction |
| globe.gl performance with visual states | Frame drops on low-end | Use CSS transforms, not JS animation |
| Cross-session memory bloat | localStorage quota | Cap at 50 entries, LRU eviction |
| Voice modulation not supported on all browsers | Silent fallback | Check SpeechSynthesis API support |
| Too many new globals | Namespace pollution | Keep IIFE pattern, single global per module |

---

## 10. SUCCESS CRITERIA

**COP31 MVP is ready when:**
- [ ] Clicking globe markers opens GAIA overlay with tabs
- [ ] Per-site XP tracks and persists
- [ ] GAIA's voice modulates with emotion (rate/pitch/volume)
- [ ] GAIA stays silent at powerful moments
- [ ] Node markers change appearance with engagement
- [ ] No console errors
- [ ] Scroll is smooth (no jank)
- [ ] Page loads in < 3s on 3G
- [ ] Works on Safari, Chrome, Firefox
- [ ] Works on phone viewport
- [ ] JS heap < 100MB
