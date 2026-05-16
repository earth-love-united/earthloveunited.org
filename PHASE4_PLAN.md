# PHASE 4 — GAIA NODES ON EARTH
## Interactive Globe Gamification — Implementation Plan
## Version 2.0 | May 2026

---

## 1. EXECUTIVE SUMMARY

The main site (index.html) already has a working modular architecture with 18 JS modules. GAIA currently exists as a bubble (GAIA_BUBBLE) that shows text messages, an engagement engine (GAIA_ENGAGEMENT) with scoring/tiers/idle, a voice engine (GAIA_VOICE) with 60+ lines, and a journal/quest system (GAIA_JOURNAL) with 16 quests.

**Phase 4 upgrades this from a "site with GAIA bubble" to "GAIA lives on the globe."** The 4 static site markers become interactive GAIA nodes. The bubble becomes node-aware. The engagement engine adds per-site tracking. The voice engine adds emotional modulation. And GAIA's mind (from dis/gaia-mind.js) gets integrated for cross-session memory and desires.

**Key principle: UPGRADE existing modules, don't replace them.** The current code is solid — we're adding layers on top.

---

## 2. FILE-BY-FILE CHANGES

### 2.1 NEW FILE: `js/gaia-nodes.js`

**Purpose:** Creates and manages 4 interactive GAIA nodes on the globe.

**What it does:**
- Creates HTML overlay elements for each node (positioned over globe markers)
- Handles node click/hover/double-click
- Manages node visual states (locked → available → explored → mastered)
- Tracks per-site engagement (XP, layers revealed, time spent)
- Emits events that other modules listen to

**Key functions:**
```javascript
const GAIA_NODES = (() => {
  // Node state per site
  const nodeState = {
    sri_lanka:  { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
    antalya:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
    benin:      { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
    borneo:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, state: 'locked' },
  };

  // Create node overlays on the globe
  function createNodes() {
    // For each site in Data.sites:
    // 1. Create a div element positioned over the globe marker
    // 2. Add click handler → onNodeClick(siteId)
    // 3. Add hover handler → onNodeHover(siteId)
    // 4. Set initial visual state based on nodeState[siteId].state
    // 5. Append to #globeViz container
  }

  // Handle node click
  function onNodeClick(siteId) {
    // 1. Add XP: GAIA_ENGAGEMENT.addSignal('site_tap', siteId)
    // 2. Update node state: nodeState[siteId].xp += 10
    // 3. GAIA speaks site entry line: GAIA_VOICE.speak('SITE_ENTRY', siteId)
    // 4. GAIA_BUBBLE.speak(line.text, line.tone)
    // 5. Open site panel (existing SITE_PANEL.open)
    // 6. Check quest progress: GAIA_JOURNAL.checkQuestProgress('site_tap', siteId)
    // 7. Update node visual state
    // 8. Update GAIA mind: GAIA_MIND.recordInteraction('site_entered', { siteId })
  }

  // Handle node hover
  function onNodeHover(siteId) {
    // 1. GAIA speaks teaser line: GAIA_VOICE.speak('SITE_TEASER', siteId)
    // 2. Show tooltip with site name + engagement state
    // 3. Highlight node (glow animation)
  }

  // Update node visual state based on engagement
  function updateNodeVisual(siteId) {
    const state = nodeState[siteId];
    const el = document.getElementById(`gaia-node-${siteId}`);
    if (!el) return;

    // Determine visual state from XP
    if (state.xp >= 100) state.state = 'mastered';
    else if (state.xp >= 50) state.state = 'explored';
    else if (state.xp >= 10) state.state = 'available';
    else state.state = 'locked';

    // Apply CSS class
    el.className = `gaia-node gaia-node--${state.state}`;

    // Add data layer rings if layersRevealed > 0
    if (state.layersRevealed > 0) {
      el.setAttribute('data-layers', state.layersRevealed);
    }
  }

  // Get node state (for other modules)
  function getNodeState(siteId) { return nodeState[siteId]; }
  function getAllNodeState() { return { ...nodeState }; }

  return { createNodes, onNodeClick, onNodeHover, updateNodeVisual, getNodeState, getAllNodeState };
})();
```

**CSS to add to `css/gaia-presence.css` (or new `css/gaia-nodes.css`):**
```css
.gaia-node {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  z-index: 10;
}

.gaia-node--locked {
  background: rgba(78, 205, 196, 0.15);
  border: 1px solid rgba(78, 205, 196, 0.2);
  animation: node-pulse-locked 3s infinite;
}

.gaia-node--available {
  background: rgba(78, 205, 196, 0.3);
  border: 1px solid rgba(78, 205, 196, 0.5);
  box-shadow: 0 0 12px rgba(78, 205, 196, 0.2);
  animation: node-pulse-available 2s infinite;
}

.gaia-node--explored {
  background: rgba(123, 232, 208, 0.4);
  border: 1px solid rgba(123, 232, 208, 0.7);
  box-shadow: 0 0 20px rgba(123, 232, 208, 0.3);
}

.gaia-node--mastered {
  background: rgba(91, 191, 114, 0.5);
  border: 2px solid rgba(91, 191, 114, 0.8);
  box-shadow: 0 0 30px rgba(91, 191, 114, 0.4);
  animation: node-glow-mastered 1.5s infinite;
}

/* Data layer rings */
.gaia-node[data-layers="1"]::after,
.gaia-node[data-layers="2"]::before,
.gaia-node[data-layers="3"]::after {
  /* Concentric rings showing data depth */
}

@keyframes node-pulse-locked {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.1); opacity: 0.8; }
}

@keyframes node-pulse-available {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

@keyframes node-glow-mastered {
  0%, 100% { box-shadow: 0 0 20px rgba(91, 191, 114, 0.4); }
  50% { box-shadow: 0 0 40px rgba(91, 191, 114, 0.6); }
}
```

---

### 2.2 UPGRADE: `js/globe.js` (204 lines → ~250 lines)

**Changes needed:**

1. **In `GlobeModule.init()`:** After creating the globe, call `GAIA_NODES.createNodes()`
2. **In point click handler:** Add `GAIA_NODES.onNodeClick(site)` before `SITE_PANEL.open(site)`
3. **In point hover handler:** Add `GAIA_NODES.onNodeHover(site)` before GAIA_PRESENCE.speak
4. **Add node position update on globe rotate:** Nodes need to track their position as the globe rotates

**Specific changes:**

```javascript
// In GlobeModule.init(), after globe setup:
if (typeof GAIA_NODES !== 'undefined') {
  GAIA_NODES.createNodes();
}

// In onPointClick:
.onPointClick(site => {
  if (typeof GAIA_NODES !== 'undefined') GAIA_NODES.onNodeClick(site.id);
  if (typeof SITE_PANEL !== 'undefined') SITE_PANEL.open(site);
  else Panel.open(site);
})

// In onPointHover:
.onPointHover(site => {
  if (site && typeof GAIA_NODES !== 'undefined') GAIA_NODES.onNodeHover(site.id);
  if (site && typeof GAIA_PRESENCE !== 'undefined') {
    GAIA_PRESENCE.speak('SITE_TEASER', site.id);
    GAIA_ENGAGEMENT.interact();
  }
})

// Add to GlobeModule:
function updateNodePositions() {
  if (typeof GAIA_NODES === 'undefined') return;
  // For each node, calculate screen position from lat/lng
  // and update the overlay element position
  Data.sites.forEach(site => {
    const pos = this.world.toScreenCoords(site.lat, site.lng);
    const el = document.getElementById(`gaia-node-${site.id}`);
    if (el && pos) {
      el.style.left = `${pos.x - 20}px`;
      el.style.top = `${pos.y - 20}px`;
      el.style.display = pos.z > 0 ? 'block' : 'none'; // Only show if facing camera
    }
  });
}

// Call updateNodePositions on every frame:
// In init(), add:
setInterval(() => this.updateNodePositions(), 100);
```

---

### 2.3 UPGRADE: `js/gaia-bubble.js` (245 lines → ~300 lines)

**Changes needed:**

1. **Make bubble node-aware:** Show which site node you're currently interacting with
2. **Add node state indicator:** Small icon showing engagement level for current site
3. **Add "Open Full GAIA" button:** When expanded, show a button to open gaia.html with context
4. **Add quest notification integration:** Show quest completion popups from GAIA_JOURNAL

**Specific changes:**

```javascript
// Add to GAIA_BUBBLE:
let currentSiteId = null;

// When a node is clicked/hovered, set current site
function setCurrentSite(siteId) {
  currentSiteId = siteId;
  updateSiteIndicator();
}

// Update the bubble to show current site engagement
function updateSiteIndicator() {
  if (!currentSiteId || !bubbleEl) return;
  const state = (typeof GAIA_NODES !== 'undefined') ? GAIA_NODES.getNodeState(currentSiteId) : null;
  if (state) {
    bubbleEl.setAttribute('data-site', currentSiteId);
    bubbleEl.setAttribute('data-tier', state.state);
  }
}

// When expanded, show "Open Full GAIA" button
function expand() {
  if (!bubbleEl) return;
  bubbleEl.classList.add('expanded');
  isExpanded = true;

  // Add site context if available
  if (currentSiteId) {
    const site = Data.getSite(currentSiteId);
    if (site) {
      // Show mini site info + "Open Full GAIA" button
      const expandedContent = bubbleEl.querySelector('.gaia-bubble-expanded') || createExpandedContent();
      expandedContent.innerHTML = `
        <div class="gaia-bubble-site-name">${site.name}</div>
        <div class="gaia-bubble-site-tier">${nodeState[currentSiteId].state}</div>
        <button class="gaia-bubble-full-btn" onclick="window.location.href='gaia.html?site=${currentSiteId}'">
          Open Full GAIA →
        </button>
      `;
    }
  }
}

// In onSignal, add node tracking:
function onSignal(signalName, siteId) {
  GAIA_ENGAGEMENT.addSignal(signalName);
  if (siteId) setCurrentSite(siteId);
  // ... rest of existing onSignal code
}

// Add to return:
return {
  create, speak, showThinking, expand, collapse, toggleExpand,
  onSignal, idleNudge, setCurrentSite,
  isVisible, getBubble, colors: COLORS,
};
```

---

### 2.4 UPGRADE: `js/gaia-engagement.js` (134 lines → ~200 lines)

**Changes needed:**

1. **Add per-site XP tracking:** `siteEngagement[siteId].xp += weight`
2. **Add site affinity tracking:** Which sites visited, layers revealed, time spent
3. **Add participant model:** Track archetype signals (analyst, explorer, empath, skeptic, sharer)
4. **Add knowledge model:** Track what GAIA thinks the participant understands
5. **Add cross-session persistence:** Save/load full engagement state

**Specific changes:**

```javascript
// Add after existing state variables:
const siteEngagement = {
  sri_lanka:  { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  antalya:    { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  benin:      { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
  borneo:     { xp: 0, layersRevealed: 0, scenariosRun: 0, timeSpent: 0, visited: false },
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

// Upgrade addSignal to accept siteId:
function addSignal(signalName, siteId = null) {
  const weight = SIGNALS[signalName] || 0;
  score = Math.max(0, score + weight);
  velocityWindow.push({ ts: Date.now(), score });
  const cutoff = Date.now() - 60000;
  velocityWindow = velocityWindow.filter(v => v.ts > cutoff);
  lastInteraction = Date.now();
  idleNudgeFired = { GENTLE: false, MEDIUM: false, STRONG: false };

  // Per-site tracking
  if (siteId && siteEngagement[siteId]) {
    siteEngagement[siteId].xp += weight;
    if (signalName === 'site_tap') siteEngagement[siteId].visited = true;
    if (signalName === 'data_reveal') siteEngagement[siteId].layersRevealed++;
    if (signalName === 'scenario_run') siteEngagement[siteId].scenariosRun++;
  }

  // Participant model updates
  updateParticipantModel(signalName);

  // Knowledge model updates
  if (signalName === 'data_reveal') {
    if (siteId === 'borneo') knowledgeModel.understandsBiomes += 0.15;
    if (siteId === 'antalya') knowledgeModel.understandsFire += 0.15;
    knowledgeModel.understandsCarbonCycle += 0.05;
  }
  if (signalName === 'scenario_run') {
    knowledgeModel.understandsRestoration += 0.1;
  }
}

function updateParticipantModel(signal) {
  switch (signal) {
    case 'data_reveal': participantModel.analytical += 0.3; break;
    case 'site_tap': participantModel.intuitive += 0.2; break;
    case 'narrative_read': participantModel.emotional += 0.4; break;
    case 'share_action': participantModel.social += 1; participantModel.isSharer = true; break;
    case 'all_sites_visited': participantModel.isExplorer = true; break;
    case 'return_visit': participantModel.isReturner = true; break;
  }
}

function getArchetype() {
  const m = participantModel;
  if (m.analytical > m.intuitive && m.analytical > m.emotional) return 'analyst';
  if (m.intuitive > m.analytical && m.intuitive > m.emotional) return 'explorer';
  if (m.emotional > m.analytical && m.emotional > m.intuitive) return 'empath';
  if (m.isSkeptic) return 'skeptic';
  if (m.isSharer) return 'sharer';
  return 'newcomer';
}

// Upgrade save/load to include new state:
function save() {
  try {
    localStorage.setItem('gaia_engagement', JSON.stringify({
      score, moodSignals, lastInteraction,
      siteEngagement, participantModel, knowledgeModel,
      savedAt: Date.now(),
    }));
  } catch { /* ignore */ }
}

function load() {
  try {
    const raw = localStorage.getItem('gaia_engagement');
    if (!raw) return;
    const data = JSON.parse(raw);
    score = data.score || 0;
    moodSignals = data.moodSignals || moodSignals;
    siteEngagement = { ...siteEngagement, ...(data.siteEngagement || {}) };
    participantModel = { ...participantModel, ...(data.participantModel || {}) };
    knowledgeModel = { ...knowledgeModel, ...(data.knowledgeModel || {}) };
  } catch { /* ignore */ }
}

// Upgrade return to include new functions:
return {
  addSignal, addMoodSignal,
  getScore: () => score, getTier, getVelocity,
  getMood, getMoodIntensity,
  getIdleLevel, shouldFireIdleNudge,
  interact: () => { lastInteraction = Date.now(); },
  // NEW:
  getSiteEngagement: (id) => siteEngagement[id],
  getAllSiteEngagement: () => ({ ...siteEngagement }),
  getArchetype,
  getKnowledgeModel: () => ({ ...knowledgeModel }),
  getParticipantModel: () => ({ ...participantModel }),
  save, load,
};
```

---

### 2.5 UPGRADE: `js/gaia-voice.js` (187 lines → ~250 lines)

**Changes needed:**

1. **Add emotional voice modifiers:** rate/pitch/volume/pause adjustments based on emotion
2. **Add silence engine:** Check if GAIA should speak before speaking
3. **Add session-depth awareness:** Voice changes with return visits
4. **Integrate with GAIA_MIND.selectLine() when available**

**Specific changes:**

```javascript
// Add voice modifier system:
const VOICE_MODIFIERS = {
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

// Silence rules:
const SILENCE_RULES = [
  { site: 'borneo', layer: 'carbon', reason: 'The carbon data speaks for itself' },
  { site: 'antalya', year: 2021, reason: 'The fire year needs silence' },
  { site: 'benin', layer: 'narrative', reason: 'Let Jean\'s story breathe' },
];

// Upgrade speak function:
function speak(state, site, preferredTone) {
  // Check silence first
  if (shouldBeSilent(state, site)) {
    return { text: null, silent: true, reason: getSilenceReason(state, site) };
  }

  const line = selectLine(state, site, preferredTone);
  currentState = state;
  if (line) currentMood = line.tone;

  // Get voice modifiers
  const modifiers = VOICE_MODIFIERS[line?.tone] || {};

  return {
    text: line?.text,
    tone: line?.tone,
    silent: false,
    voiceModifiers: modifiers,
    lineId: line?.id,
  };
}

function shouldBeSilent(state, site) {
  // Check GAIA_MIND silence engine if available
  if (typeof GAIA_MIND !== 'undefined') {
    return GAIA_MIND.shouldSpeak({ state, site }).silent;
  }
  // Fallback: check SILENCE_RULES
  return SILENCE_RULES.some(r => {
    if (r.site && r.site !== site) return false;
    if (r.layer && state !== 'DATA_REVEAL') return false;
    return true;
  });
}

// Upgrade return:
return {
  speak, getLine, interact, getIdleLevel,
  getState: () => currentState,
  getMood: () => currentMood,
  getAllLines: () => LINES,
  // NEW:
  getVoiceModifiers: (tone) => VOICE_MODIFIERS[tone] || {},
  shouldBeSilent,
};
```

---

### 2.6 UPGRADE: `js/gaia-journal.js` (123 lines → ~180 lines)

**Changes needed:**

1. **Add per-site insight tracking:** Insights tagged by site
2. **Add quest progress UI:** Show progress bars for active quests
3. **Add quest completion celebration:** GAIA speaks + visual feedback
4. **Add share card generation:** For sharing progress

**Specific changes:**

```javascript
// Add quest progress UI:
function renderQuestProgress() {
  const quests = getQuests();
  const active = quests.filter(q => !q.completed).slice(0, 3); // Show top 3 active
  const container = document.getElementById('gaia-quest-progress');
  if (!container) return;

  container.innerHTML = active.map(q => `
    <div class="gaia-quest-item ${q.completed ? 'completed' : ''}">
      <div class="gaia-quest-title">${q.title}</div>
      <div class="gaia-quest-bar">
        <div class="gaia-quest-fill" style="width: ${(q.progress / q.target) * 100}%"></div>
      </div>
      <div class="gaia-quest-progress-text">${q.progress}/${q.target}</div>
    </div>
  `).join('');
}

// Upgrade checkQuestProgress to trigger GAIA speech:
function checkQuestProgress(signalName, siteId) {
  const newlyCompleted = [];
  for (const quest of QUESTS) {
    if (completedQuests.includes(quest.id)) continue;
    if (quest.signal !== signalName) continue;
    if (quest.site && quest.site !== siteId) continue;

    questProgress[quest.id] = (questProgress[quest.id] || 0) + 1;

    if (questProgress[quest.id] >= quest.target) {
      completedQuests.push(quest.id);
      newlyCompleted.push(quest);

      // GAIA speaks quest completion
      if (typeof GAIA_VOICE !== 'undefined') {
        const line = GAIA_VOICE.speak('QUEST', siteId, 'proud');
        if (line && typeof GAIA_BUBBLE !== 'undefined') {
          GAIA_BUBBLE.speak(line.text, 'proud', 8000);
        }
      }

      // Show visual notification
      showQuestNotification(quest);
    }
  }
  if (newlyCompleted.length > 0) save();
  return newlyCompleted;
}

// Add to return:
return {
  addEntry, getEntries, getEntryCount,
  checkQuestProgress, getQuests, getCompletedCount, getTotalCount,
  generateShareCard, renderQuestProgress,
  save, load,
};
```

---

### 2.7 NEW FILE: `js/gaia-mind-main.js`

**Purpose:** Adapts `dis/gaia-mind.js` for main site use. This is the cross-session memory and emotional AI.

**What it does:**
- Wraps `dis/gaia-mind.js` functions for main site context
- Handles emotional decay across sessions
- Manages participant model updates
- Provides desire calculation for the current context
- Manages cross-session memory (significant moments, unresolved threads)

**Key functions:**
```javascript
const GAIA_MIND_MAIN = (() => {
  // Load persisted mind state
  function loadMind() {
    try {
      const raw = localStorage.getItem('gaia_mind');
      if (raw && typeof GAIA_MIND !== 'undefined') {
        GAIA_MIND.deserialize(raw);
      }
    } catch { /* ignore */ }
  }

  function saveMind() {
    try {
      if (typeof GAIA_MIND !== 'undefined') {
        localStorage.setItem('gaia_mind', GAIA_MIND.serialize());
      }
    } catch { /* ignore */ }
  }

  // Record interaction and update models
  function recordInteraction(eventType, context) {
    if (typeof GAIA_MIND === 'undefined') return;

    // Update participant model
    GAIA_MIND.updateParticipantModel(eventType, context);

    // Add emotional events based on content
    if (context.siteId === 'borneo' && context.layer === 'carbon') {
      GAIA_MIND.addEmotionalEvent('grief', 2, 'Saw Borneo carbon data', 'borneo');
    }
    if (context.siteId === 'antalya' && context.year === 2021) {
      GAIA_MIND.addEmotionalEvent('grief', 3, 'Saw Antalya fire year', 'antalya');
    }
    if (context.siteId === 'sri_lanka') {
      GAIA_MIND.addEmotionalEvent('hope', 2, 'Saw restoration working', 'sri_lanka');
    }

    saveMind();
  }

  // Get welcome back message for returning visitors
  function getWelcomeBackMessage() {
    if (typeof GAIA_MIND === 'undefined') return null;

    const sessionCount = GAIA_MIND.getSessionCount();
    const archetype = GAIA_MIND.getParticipantArchetype();
    const dominantEmotion = GAIA_MIND.getDominantEmotion();
    const unresolvedThread = GAIA_MIND.getUnresolvedThread();

    let message = '';
    if (sessionCount === 0) {
      message = "I've been waiting. Pick somewhere that calls to you.";
    } else if (archetype.includes('sharer')) {
      message = `Welcome back. You've been spreading the word. That matters.`;
    } else if (archetype.includes('skeptic')) {
      message = `You came back. Last time you challenged me. I liked that. Ready for more?`;
    } else if (archetype.includes('deep_diver')) {
      message = `Welcome back. You went deep last time. Ready to go deeper?`;
    } else {
      message = "You came back. I noticed. I always notice.";
    }

    if (unresolvedThread) {
      message += ` Last time you asked about ${unresolvedThread.topic}. Want to explore that?`;
    }

    return { message, emotion: dominantEmotion.emotion };
  }

  // Check if GAIA should speak (silence engine)
  function shouldSpeak(context) {
    if (typeof GAIA_MIND === 'undefined') return { speak: true };
    return GAIA_MIND.shouldGaiaSpeak(context);
  }

  // Get voice modifiers for current context
  function getVoiceModifiers(context) {
    if (typeof GAIA_MIND === 'undefined') return {};
    return GAIA_MIND.getVoiceModifiers(context);
  }

  // Init
  loadMind();

  return {
    loadMind, saveMind,
    recordInteraction,
    getWelcomeBackMessage,
    shouldSpeak,
    getVoiceModifiers,
    getArchetype: () => typeof GAIA_MIND !== 'undefined' ? GAIA_MIND.getParticipantArchetype() : ['newcomer'],
    getDominantEmotion: () => typeof GAIA_MIND !== 'undefined' ? GAIA_MIND.getDominantEmotion() : { emotion: 'curious' },
  };
})();
```

---

### 2.8 UPGRADE: `js/app.js` (178 lines → ~220 lines)

**Changes needed:**

1. **Initialize GAIA_NODES** after globe creation
2. **Initialize GAIA_MIND_MAIN** for cross-session memory
3. **Wire node events to bubble/voice/engagement**
4. **Add welcome back system** using GAIA_MIND
5. **Add idle nudge loop** (already exists, upgrade to use GAIA_VOICE silence engine)

**Specific changes:**

```javascript
// In App.init(), after existing init:

// ── GAIA Nodes on Globe ──
if (typeof GAIA_NODES !== 'undefined') {
  GAIA_NODES.createNodes();
}

// ── GAIA Mind (cross-session memory) ──
if (typeof GAIA_MIND_MAIN !== 'undefined') {
  GAIA_MIND_MAIN.loadMind();

  // Welcome back message
  const welcomeBack = GAIA_MIND_MAIN.getWelcomeBackMessage();
  if (welcomeBack) {
    setTimeout(() => {
      if (typeof GAIA_BUBBLE !== 'undefined') {
        GAIA_BUBBLE.speak(welcomeBack.message, welcomeBack.emotion, 8000);
      }
    }, 2000);
  }
}

// ── Idle nudge loop (upgrade existing) ──
setInterval(() => {
  const nudge = GAIA_ENGAGEMENT.shouldFireIdleNudge();
  if (nudge) {
    const line = GAIA_VOICE.speak('IDLE', null, null);
    if (line && line.text && typeof GAIA_BUBBLE !== 'undefined') {
      GAIA_BUBBLE.speak(line.text, line.tone || 'mysterious', 6000);
    }
  }
}, 5000);

// ── Wire node events ──
// (This is done via GAIA_NODES.onNodeClick → GAIA_ENGAGEMENT.addSignal → GAIA_BUBBLE.speak)
// No additional wiring needed if GAIA_NODES is properly connected
```

---

### 2.9 UPGRADE: `index.html` (READ-ONLY — add script tags only)

**Changes needed:**

Add new script tags before the closing `</body>` tag:

```html
<!-- GAIA Phase 4 — Nodes on Earth -->
<script src="js/gaia-nodes.js"></script>
<script src="js/gaia-mind-main.js"></script>

<!-- DIS integration (adapted for main site) -->
<script src="dis/gaia-mind.js"></script>
```

**Do NOT modify any existing content.**

---

## 3. IMPLEMENTATION ORDER

### Day 1-2: Foundation
1. Create `js/gaia-nodes.js` with createNodes(), onNodeClick(), onNodeHover()
2. Add CSS for node states to `css/gaia-presence.css`
3. Upgrade `js/globe.js` — add node position tracking, wire click/hover
4. Test: 4 nodes visible on globe, clickable, trigger site panel

### Day 3-4: Engagement Upgrade
1. Upgrade `js/gaia-engagement.js` — per-site XP, participant model, knowledge model
2. Upgrade `js/gaia-journal.js` — quest progress UI, completion celebrations
3. Test: XP accumulates per site, quests complete, GAIA speaks on completion

### Day 5-6: Voice & Silence
1. Upgrade `js/gaia-voice.js` — voice modifiers, silence engine
2. Create `js/gaia-mind-main.js` — adapt gaia-mind.js for main site
3. Test: GAIA's voice changes with emotion, GAIA stays silent at powerful moments

### Day 7-8: Bubble & Presence
1. Upgrade `js/gaia-bubble.js` — node-aware, site indicator, "Open Full GAIA" button
2. Upgrade `js/app.js` — wire everything together, welcome back system
3. Test: Bubble shows site context, welcome back works, idle nudges work

### Day 9-10: Visual Polish
1. Node visual states (locked → available → explored → mastered)
2. Data layer rings on nodes
3. Breathing/pulsing animations
4. Quest notification popups
5. Test: Visual feedback matches engagement state

### Day 11-12: Bridge & Testing
1. Node-to-chat bridge (click → open gaia.html with context)
2. Full behavioral test (simulate Rusher, Deep Diver, Sharer)
3. Cross-session memory test
4. Mobile responsive test
5. Performance test

---

## 4. SUCCESS CRITERIA

- [ ] 4 GAIA nodes visible on globe, visually distinct by state
- [ ] Click node → GAIA speaks site entry line
- [ ] Hover node → GAIA speaks teaser line
- [ ] Per-site XP tracking works
- [ ] Node appearance changes with engagement (locked → available → explored → mastered)
- [ ] Quest progress UI shows active quests
- [ ] Quest completion triggers GAIA speech + visual notification
- [ ] GAIA's voice changes with emotion (grief = slower, urgent = faster)
- [ ] Silence engine works (Borneo carbon, Antalya fire year)
- [ ] Cross-session memory works (GAIA remembers return visitors)
- [ ] Welcome back message references previous sessions
- [ ] Bubble shows current site context
- [ ] "Open Full GAIA" button works
- [ ] All existing functionality preserved
- [ ] Zero console errors

---

## 5. COP31 MVP (5-7 days)

Minimum viable for COP31:
1. 4 GAIA nodes on globe (visual, clickable)
2. Click → GAIA speaks site-specific line
3. Per-site XP tracking
4. Basic level system (COLD → WARM → ENGAGED)
5. Node appearance changes with state
6. Cross-session memory (GAIA remembers return visitors)

Skip for MVP:
- Voice modifiers (use default voice)
- Silence engine (always speak)
- Quest progress UI (quests work but no UI)
- "Open Full GAIA" button
- Data layer rings
