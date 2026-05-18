# PHASE 4 — GAIA NODES ON EARTH
## Audit & Implementation Plan v2.0
## May 2026

---

## 1. CURRENT STATE AUDIT

### What Already Exists (Built by Previous Devs)

**Core Architecture (index.html + 18 JS modules + 9 CSS modules):**

| Module | File | Lines | Status |
|--------|------|-------|--------|
| App entry | `js/app.js` | 203 | ✅ Wires all modules, GAIA_BUBBLE, GAIA_ENGAGEMENT, idle loop |
| Data engine | `js/data.js` | 48 | ✅ Loads biomes.json + sites.json, carbon calculator |
| Globe | `js/globe.js` | 204 | ✅ Globe.gl init, points/labels/rings, click → Panel.open |
| Site panel | `js/site-panel.js` | 332 | ✅ Side panel with NDVI slider, climate, sandbox |
| GAIA bubble | `js/gaia-bubble.js` | 245 | ✅ Bottom-right presence, speak(), idleNudge(), onSignal() |
| GAIA engagement | `js/gaia-engagement.js` | 134 | ✅ Scoring, tiers, idle detection, persistence |
| GAIA voice | `js/gaia-voice.js` | 187 | ✅ 60+ voice lines, selectLine(), anti-repetition |
| GAIA journal | `js/gaia-journal.js` | 123 | ✅ 16 quests, insights, share card |
| GAIA nodes | `js/gaia-nodes.js` | 967 | ✅ Node state, XP, per-site tracking, render functions for all 4 sites |
| GAIA presence | `js/gaia-presence.js` | 77 | ✅ Teaser tooltips on hover |
| GAIA chat | `js/gaia-chat.js` | 745 | ✅ Full chat interface (BIOMES, SITES, carbon engine, KB, intent matching) |
| Globe overlay | `js/globe-overlay.js` | 214 | ✅ Left-anchored content box, tabbed, scrollable |
| NDVI verifier | `js/ndvi-verifier.js` | 386 | ✅ Sentinel-2 satellite cross-reference |
| Registry check | `js/registry-check.js` | 267 | ✅ Carbon standard cross-reference (Verra, GS, ACR) |
| Carbon clock | `js/carbon-clock.js` | 169 | ✅ Live CO2 ticker |
| Counters | `js/counters.js` | 28 | ✅ Animated counters |
| Biomes | `js/biomes.js` | 75 | ✅ Biome comparison |
| Scenario | `js/scenario.js` | 67 | ✅ What-if scenarios |
| Quiz | `js/quiz.js` | 75 | ✅ Interactive quiz |
| Delegation | `js/delegation.js` | 190 | ✅ Country-specific greeting |
| Pledge wall | `js/pledge-wall.js` | 349 | ✅ Public commitment system |

**DIS System (dis/):**

| File | Lines | Status |
|------|-------|--------|
| `dis/gaia-mind.js` | 784 | ✅ Emotional AI, desires, silence, voice, memory, participant model |
| `dis/gaia-state-machine.js` | 272 | ✅ State machine, scoring, line selection |
| `dis/gaia-voice-data.js` | 364 | ✅ 108+ voice lines, 35 pools |
| `dis/gaia-voice-engine.js` | 393 | ✅ TTS wrapper, emotion modulation |
| `dis/gaia-quest-system.js` | 601 | ✅ 16 quests, 4 tiers, progression |
| `dis/gaia-key-gate.js` | 353 | ✅ API key onboarding, 6-level tease |
| `dis/gaia-client.js` | 1081 | ✅ Orchestrator, WebSocket bridge |
| `dis/gaia-knowledge.js` | ~200 | ✅ Knowledge base |
| `dis/worker.js` | 819 | ✅ Cloudflare Worker, 22 tools |
| `dis/ARCHITECTURE.md` | 182 | ✅ Knowledge architecture docs |
| `dis/behavioral-test-v2.md` | 541 | ✅ 3 participant archetypes, multi-session |
| `dis/turing-test-v2.md` | 240 | ✅ Full session simulation |

**CSS Modules (9 files):**
- `css/base.css`, `layout.css`, `components.css`, `widgets.css`, `responsive.css`
- `css/carbon-clock.css`, `css/delegation.css`, `css/gaia-bubble.css`, `css/gaia-presence.css`
- `css/globe-overlay.css`, `css/ndvi-verifier.css`, `css/registry-check.css`, `css/pledge-wall.css`

### What's Already Working

1. **GAIA Nodes on globe** — `js/gaia-nodes.js` (967 lines) has per-site XP, node states, render functions for all 4 sites
2. **Globe overlay** — `js/globe-overlay.js` (214 lines) has tabbed content box
3. **GAIA bubble** — `js/gaia-bubble.js` (245 lines) has speak(), idleNudge(), onSignal(), quest notifications
4. **Engagement engine** — `js/gaia-engagement.js` (134 lines) has scoring, tiers, idle detection, persistence
5. **Voice engine** — `js/gaia-voice.js` (187 lines) has 60+ lines, selectLine(), anti-repetition
6. **Journal/Quests** — `js/gaia-journal.js` (123 lines) has 16 quests, insights, share card
7. **GAIA Mind** — `dis/gaia-mind.js` (784 lines) has emotional AI, desires, silence engine, voice evolution, participant model, cross-session memory
8. **State machine** — `dis/gaia-state-machine.js` (272 lines) has states, scoring, line selection
9. **Voice data** — `dis/gaia-voice-data.js` (364 lines) has 108+ lines, 35 pools
10. **NDVI verifier** — `js/ndvi-verifier.js` (386 lines) has Sentinel-2 cross-reference
11. **Registry check** — `js/registry-check.js` (267 lines) has carbon standard cross-reference

### What's Missing (Gaps to Fill)

1. **GAIA nodes not connected to globe markers** — `gaia-nodes.js` has the state and render functions, but the globe click still goes to `Panel.open()` not `GAIA_NODES.onNodeClick()`
2. **No emotional voice modulation** — Voice lines are selected but no rate/pitch/volume adjustments
3. **No silence engine** — GAIA always speaks, never chooses silence
4. **No cross-session memory** — GAIA_MIND exists in dis/ but not integrated into main site
5. **No per-site engagement in GAIA_ENGAGEMENT** — Only global score, no per-site tracking
6. **No participant model** — No archetype detection (analyst, explorer, empath, skeptic, sharer)
7. **No knowledge model** — No tracking of what user understands
8. **No desire system** — No contextual desire calculation (reveal, challenge, comfort, etc.)
9. **No voice evolution** — Voice doesn't change with session depth
10. **No node visual states on globe** — Markers are static, don't change with engagement
11. **No quest progress UI** — Quests track but no visual progress bars
12. **No "Open Full GAIA" bridge** — No way to go from globe to gaia.html with context
13. **GAIA_BUBBLE not node-aware** — Doesn't show which site you're interacting with
14. **No welcome back with memory** — Welcome back shows CO2 delta but not emotional memory

---

## 2. DETAILED GAP ANALYSIS

### Gap 1: Globe → Node Connection

**Current:** `js/globe.js` line 28-31:
```javascript
.onPointClick(site => {
  if (typeof SITE_PANEL !== 'undefined') SITE_PANEL.open(site);
  else Panel.open(site);
})
```

**Needed:** Route through GAIA_NODES first:
```javascript
.onPointClick(site => {
  if (typeof GAIA_NODES !== 'undefined') {
    GAIA_NODES.onNodeClick(site.id);
  } else if (typeof SITE_PANEL !== 'undefined') {
    SITE_PANEL.open(site);
  } else {
    Panel.open(site);
  }
})
```

**File:** `js/globe.js`, lines 28-31

---

### Gap 2: Per-Site Engagement Tracking

**Current:** `js/gaia-engagement.js` only has global `score`.

**Needed:** Add `siteEngagement` object:
```javascript
const siteEngagement = {
  sri_lanka:  { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  antalya:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  benin:      { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  borneo:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
};
```

**File:** `js/gaia-engagement.js`, after line 33

---

### Gap 3: Participant Model

**Current:** No participant model exists in main site.

**Needed:** Add to `js/gaia-engagement.js`:
```javascript
const participantModel = {
  analytical: 0, intuitive: 0, emotional: 0, social: 0,
  isSkeptic: false, isExplorer: false, isDeepDiver: false,
  isReturner: false, isSharer: false,
  asksQuestions: 0, makesPredictions: 0, correctPredictions: 0,
};
```

**File:** `js/gaia-engagement.js`, after `siteEngagement`

---

### Gap 4: Knowledge Model

**Current:** No knowledge tracking.

**Needed:** Add to `js/gaia-engagement.js`:
```javascript
const knowledgeModel = {
  understandsCarbonCycle: 0,
  understandsBiomes: 0,
  understandsFire: 0,
  understandsRestoration: 0,
  understandsTippingPoints: 0,
};
```

**File:** `js/gaia-engagement.js`, after `participantModel`

---

### Gap 5: Emotional Voice Modulation

**Current:** `js/gaia-voice.js` `speak()` returns `{ text, tone }` only.

**Needed:** Add voice modifier calculation:
```javascript
function getVoiceModifiers(tone, sessionCount) {
  const mods = {
    grief:     { rate: -0.10, pitch: -0.05, volume: 0,    pauseBefore: 800 },
    concerned: { rate: -0.08, pitch: -0.03, volume: 0,    pauseBefore: 500 },
    excited:   { rate: +0.05, pitch: 0,     volume: +0.1, pauseBefore: 0 },
    proud:     { rate: +0.05, pitch: 0,     volume: +0.1, pauseBefore: 0 },
    fierce:    { rate: +0.10, pitch: -0.08, volume: +0.15,pauseBefore: 0 },
    warm:      { rate: -0.08, pitch: +0.03, volume: -0.05,pauseBefore: 500 },
    mysterious:{ rate: -0.12, pitch: -0.05, volume: -0.1, pauseBefore: 1200 },
    nurturing: { rate: -0.08, pitch: +0.03, volume: -0.05,pauseBefore: 500 },
    urgent:    { rate: +0.08, pitch: -0.05, volume: +0.1, pauseBefore: 200 },
    playful:   { rate: +0.03, pitch: +0.05, volume: 0,    pauseBefore: 300 },
  };
  let m = mods[tone] || {};
  // Session depth adjustment
  if (sessionCount > 3) m.rate = (m.rate || 0) + 0.03;
  if (sessionCount > 10) { m.rate = (m.rate || 0) + 0.02; m.pitch = (m.pitch || 0) + 0.02; }
  return m;
}
```

**File:** `js/gaia-voice.js`, after line 108

---

### Gap 6: Silence Engine

**Current:** GAIA always speaks on every event.

**Needed:** Add silence check before speaking:
```javascript
function shouldBeSilent(state, siteId, context) {
  // Site-specific silence rules
  if (siteId === 'borneo' && state === 'DATA_REVEAL' && context?.layer === 'carbon') {
    return { silent: true, reason: 'The carbon data speaks for itself' };
  }
  if (siteId === 'antalya' && state === 'DATA_REVEAL' && context?.year === 2021) {
    return { silent: true, reason: 'The fire year needs silence' };
  }
  if (siteId === 'benin' && state === 'DATA_REVEAL' && context?.layer === 'narrative') {
    return { silent: true, reason: 'Let Jean\'s story breathe' };
  }
  // Check GAIA_MIND if available
  if (typeof GAIA_MIND !== 'undefined') {
    return GAIA_MIND.shouldGaiaSpeak({ state, siteId, ...context });
  }
  return { silent: false };
}
```

**File:** `js/gaia-voice.js`, after `getVoiceModifiers()`

---

### Gap 7: Cross-Session Memory (GAIA Mind Integration)

**Current:** `dis/gaia-mind.js` exists but is not loaded on main site.

**Needed:** Create `js/gaia-mind-main.js` that:
1. Loads `dis/gaia-mind.js` functions
2. Wraps them for main site context
3. Handles emotional decay across sessions
4. Manages participant model updates
5. Provides desire calculation
6. Manages cross-session memory

**New file:** `js/gaia-mind-main.js` (~200 lines)

---

### Gap 8: Node Visual States on Globe

**Current:** Globe markers are static points with fixed color/size.

**Needed:** Add visual state changes based on engagement:
- Locked: dim outline, subtle pulse
- Available: soft glow, gentle pulse
- Explored: bright, warm, data rings visible
- Mastered: radiant, all layers visible

**File:** `js/globe.js` — upgrade point rendering

---

### Gap 9: Quest Progress UI

**Current:** Quests track progress but no visual UI.

**Needed:** Add quest progress panel to globe overlay or bubble.

**File:** `js/gaia-journal.js` — add `renderQuestProgress()` function

---

### Gap 10: Node-to-Chat Bridge

**Current:** No way to go from globe exploration to full GAIA chat.

**Needed:** Add "Open Full GAIA" button that passes context to gaia.html.

**File:** `js/gaia-bubble.js` — add bridge function

---

### Gap 11: Welcome Back with Memory

**Current:** `js/app.js` lines 54-69 show CO2 delta on return.

**Needed:** Integrate GAIA_MIND for emotional memory, significant moments, unresolved threads.

**File:** `js/app.js` — upgrade welcome back system

---

### Gap 12: GAIA_BUBBLE Node Awareness

**Current:** Bubble shows messages but doesn't track which site.

**Needed:** Add `setCurrentSite(siteId)` and visual indicator.

**File:** `js/gaia-bubble.js`

---

## 3. IMPLEMENTATION PLAN

### Step 1: Wire Existing GAIA_NODES to Globe (1 day)

**Files to modify:**
- `js/globe.js` (lines 28-31, 32-35, 42-47)

**Changes:**
1. Route point click through `GAIA_NODES.onNodeClick(site.id)`
2. Route point hover through `GAIA_NODES.onNodeHover(site.id)`
3. Add `updateNodePositions()` for tracking marker positions

**Test:** Click globe marker → GAIA speaks entry line, GAIA_NODES tracks XP

---

### Step 2: Per-Site Engagement + Participant Model (1 day)

**Files to modify:**
- `js/gaia-engagement.js` (add ~60 lines)

**Changes:**
1. Add `siteEngagement` object
2. Add `participantModel` object
3. Add `knowledgeModel` object
4. Upgrade `addSignal()` to accept `siteId` parameter
5. Add `updateParticipantModel()` function
6. Add `getArchetype()` function
7. Upgrade `save()`/`load()` to include new state

**Test:** Per-site XP accumulates, archetype detection works

---

### Step 3: Emotional Voice + Silence Engine (1 day)

**Files to modify:**
- `js/gaia-voice.js` (add ~50 lines)

**Changes:**
1. Add `VOICE_MODIFIERS` constant
2. Add `getVoiceModifiers(tone, sessionCount)` function
3. Add `SILENCE_RULES` constant
4. Add `shouldBeSilent(state, siteId, context)` function
5. Upgrade `speak()` to check silence first and return voice modifiers

**Test:** GAIA's voice changes with emotion, GAIA stays silent at powerful moments

---

### Step 4: GAIA Mind Integration (2 days)

**New file:**
- `js/gaia-mind-main.js` (~200 lines)

**Changes:**
1. Load `dis/gaia-mind.js` (add script tag to index.html)
2. Create wrapper functions for main site
3. Handle emotional decay across sessions
4. Manage participant model updates
5. Provide desire calculation
6. Manage cross-session memory

**Files to modify:**
- `index.html` (add script tag)
- `js/app.js` (integrate welcome back)

**Test:** GAIA remembers across sessions, emotional residue decays

---

### Step 5: Node Visual States (1 day)

**Files to modify:**
- `js/globe.js` (upgrade point rendering)
- `css/globe-overlay.css` (add node state styles)

**Changes:**
1. Add point color/size based on engagement state
2. Add data layer rings
3. Add breathing/pulsing animations

**Test:** Node appearance changes with engagement

---

### Step 6: Quest Progress UI + Bridge (1 day)

**Files to modify:**
- `js/gaia-journal.js` (add `renderQuestProgress()`)
- `js/gaia-bubble.js` (add "Open Full GAIA" button)
- `css/gaia-bubble.css` (add expanded styles)

**Test:** Quest progress visible, bridge to chat works

---

### Step 7: Bubble Node Awareness (0.5 day)

**Files to modify:**
- `js/gaia-bubble.js` (add `setCurrentSite()`, visual indicator)

**Test:** Bubble shows current site context

---

### Step 8: Testing + Polish (1-2 days)

- Full behavioral test (Rusher, Deep Diver, Sharer)
- Cross-session memory test
- Mobile responsive test
- Performance test

---

## 4. TOTAL ESTIMATE

| Step | Days |
|------|------|
| 1. Wire GAIA_NODES to globe | 1 |
| 2. Per-site engagement + participant model | 1 |
| 3. Emotional voice + silence engine | 1 |
| 4. GAIA mind integration | 2 |
| 5. Node visual states | 1 |
| 6. Quest progress UI + bridge | 1 |
| 7. Bubble node awareness | 0.5 |
| 8. Testing + polish | 1-2 |
| **TOTAL** | **8.5-10 days** |

---

## 5. FILES TO MODIFY (Summary)

| File | Change Type | Lines Added |
|------|------------|-------------|
| `js/globe.js` | Modify | ~30 |
| `js/gaia-engagement.js` | Modify | ~60 |
| `js/gaia-voice.js` | Modify | ~50 |
| `js/gaia-journal.js` | Modify | ~40 |
| `js/gaia-bubble.js` | Modify | ~40 |
| `js/app.js` | Modify | ~20 |
| `css/globe-overlay.css` | Modify | ~30 |
| `css/gaia-bubble.css` | Modify | ~20 |
| `index.html` | Add script tags | ~3 |
| `js/gaia-mind-main.js` | **NEW** | ~200 |
| **TOTAL** | | **~500 lines** |

---

## 6. COP31 MVP (4-5 days)

Minimum viable for COP31:
1. Wire GAIA_NODES to globe (Step 1)
2. Per-site engagement (Step 2)
3. Emotional voice (Step 3)
4. Node visual states (Step 5)
5. Testing (Step 8)

Skip for MVP:
- GAIA mind integration (complex, can be added later)
- Quest progress UI (quests work, just no UI)
- Bubble node awareness (nice to have)
