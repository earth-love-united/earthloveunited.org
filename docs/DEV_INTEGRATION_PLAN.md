# DEV INTEGRATION PLAN — DIS into Earth Love United
## Version 1.0 | May 2026
## Dev Agent Assessment

---

## 1. EXECUTIVE SUMMARY

The DIS (Distributed Isolate System) is architecturally complete on paper and in code — 12 files covering state machine, voice engine, quest system, key gate, Cloudflare Worker, and tool definitions. However, it exists as a **parallel universe** that has never been connected to either the main site (index.html) or the existing chat interface (gaia.html). The integration gap is significant but well-defined: the DIS has the brains but no body, and the existing site has the body but no state machine.

**Bottom line:** gaia.html can and should be evolved into the full DIS experience. It already has the chat UI, sidebar topics, carbon sandbox, data engine, and chart renderer. What it lacks is the state machine, engagement tracking, quest progression, key gate, voice engine, and WebSocket bridge to the Cloudflare Worker. The evolution path is to layer DIS components onto gaia.html incrementally, not to rebuild from scratch.

---

## 2. CURRENT STATE ASSESSMENT

### 2.1 What Exists Today

**index.html (Main Site) — READ-ONLY**
- 246 lines, globe.gl 3D globe, scrollable sections
- Carbon cycle widget, quiz widget, Keeling curve, project map
- Links to gaia.html via "Talk to GAIA" button in topbar
- Dark theme, teal/mint palette, Cormorant Garamond + Outfit + JetBrains Mono
- Uses CSS modules (base.css, layout.css, components.css, widgets.css, responsive.css)
- No DIS integration whatsoever

**gaia.html (Chat Interface) — 886 lines, self-contained**
- Full chat UI with sidebar topics, carbon sandbox, right panel
- Inline `<script>` with: BIOMES data, SITES data, carbon calculator, knowledge base (KB), intent matching, response generation
- Uses gaia-data.js (live data engine: NOAA CO2/CH4, Carbonmark prices/retirements)
- Uses gaia-charts.js (canvas chart renderer: sparklines, bar charts)
- **No DIS files loaded.** No state machine, no engagement scoring, no quests, no key gate, no voice
- Intent matching is regex-based pattern matching against a static KB object
- Responses are pre-written HTML strings selected by intent — not dynamic, not stateful

**DIS System (dis/ directory) — 12 files, ~3,500 lines of JS**
- gaia-state-machine.js: 915 lines, 10 states, 11 moods, scoring engine, line selection
- gaia-client.js: 866 lines, orchestrator, WebSocket bridge, tool execution, UI rendering
- gaia-key-gate.js: 353 lines, API key onboarding, tease escalation, preview system
- gaia-quest-system.js: 601 lines, 16 quests across 4 tiers, progress tracking
- gaia-voice-engine.js: 393 lines, Web Speech API, emotion-based voice modulation
- gaia-voice-data.js: 354 lines, ~108 pre-scripted lines in voice library pools
- worker.js: 819 lines, Cloudflare Worker + 3 Durable Objects, LLM runtime, 16 tools
- wrangler.toml: deployment config
- gaia-system-prompt.md: 252 lines, LLM personality definition
- gaia-voice-library.md: 302 lines, source of truth for voice lines
- gaia-engagement-algorithm.md: 314 lines, scoring weights, tier thresholds
- gaia-tool-definitions.md: 862 lines, 16 tool specs

### 2.2 The Integration Gap

| Component | DIS Has | gaia.html Has | Gap |
|-----------|---------|---------------|-----|
| State machine | Full (915 lines) | None | Not loaded |
| Engagement scoring | Full (signals, tiers, velocity) | None | Not loaded |
| Quest system | 16 quests, 4 tiers, progression | None | Not loaded |
| Key gate | Tease escalation, preview, modal | None | Not loaded |
| Voice engine | Web Speech API, emotion modulation | None | Not loaded |
| Voice library | 108 lines, 15+ pools | None | Not loaded |
| LLM bridge | WebSocket to Cloudflare Worker | None | Not loaded |
| Tool execution | 16 client-side tools | None | Not loaded |
| Chat UI | References DOM IDs not in gaia.html | Full chat UI | DOM ID mismatch |
| Intent matching | LLM-driven (post-unlock) | Regex-based KB | Dual system needed |
| Knowledge base | LLM system prompt (252 lines) | Static KB object (500 lines) | Needs merging |
| Carbon calculator | References window.BIOMES | Inline BIOMES + transitionCarbon() | Compatible |
| Live data | getGlobalStats() hardcoded | gaia-data.js with real APIs | DIS should use gaia-data.js |
| Charts | None | gaia-charts.js | DIS needs to integrate |

---

## 3. INTEGRATION ARCHITECTURE

### 3.1 Target Architecture

```
Participant Browser
  ├── index.html (main site, READ-ONLY, globe + scroll sections)
  │     └── "Talk to GAIA" button → gaia.html
  │
  └── gaia.html (evolved into full DIS experience)
        ├── Existing: chat UI, sidebar, sandbox, data engine, charts
        ├── NEW: gaia-state-machine.js (behavioral engine)
        ├── NEW: gaia-voice-data.js (108 pre-scripted lines)
        ├── NEW: gaia-voice-engine.js (TTS)
        ├── NEW: gaia-quest-system.js (quest progression)
        ├── NEW: gaia-key-gate.js (API key onboarding)
        ├── NEW: gaia-client.js (orchestrator, WebSocket bridge)
        ├── MODIFIED: existing inline script (emit DIS events)
        │
        └── WebSocket ──→ Cloudflare Edge
                            ├── worker.js (routing, auth)
                            ├── GaiaSessionDurableObject (LLM context)
                            ├── WorldDurableObject (shared state)
                            └── ProfileDurableObject (journals, progress)
                                  └── OpenRouter API (LLM)
```

### 3.2 Key Design Decisions

**Decision 1: Evolve gaia.html, don't rebuild it.**
- gaia.html already has the chat UI, sidebar, sandbox, data engine, and charts
- The DIS client expects DOM IDs like `gaia-chat-messages`, `gaia-chat-input`, `gaia-overlay`, `gaia-key-modal` — these need to be added to gaia.html
- The existing intent-matching system becomes the "state machine mode" fallback
- Post-unlock, the LLM takes over from the regex KB

**Decision 2: Dual-mode operation (state machine → LLM).**
- Without API key: state machine drives GAIA using pre-scripted lines + existing KB
- With API key: LLM drives GAIA using system prompt + tools
- The transition is managed by gaia-client.js detecting the key and opening WebSocket

**Decision 3: index.html stays clean.**
- No DIS code in index.html (READ-ONLY constraint)
- The "Talk to GAIA" link is the only integration point
- Optionally: add a lightweight GAIA greeting overlay on index.html that uses just the state machine (no WebSocket needed) — but this is a Phase 2 enhancement

**Decision 4: Merge data sources.**
- gaia-data.js has real API connections (NOAA, Carbonmark)
- DIS worker.js has hardcoded getGlobalStats()
- The client-side tools should call gaia-data.js functions, not hardcoded values

---

## 4. CONCRETE INTEGRATION STEPS

### Phase 0: Foundation (Complexity: LOW — 1-2 days)

**Goal:** Make DIS files loadable in gaia.html without breaking anything.

**Files to modify:**
- `gaia.html` — Add `<script>` tags for DIS files

**Steps:**
1. Add script tags to gaia.html `<head>` (before the inline script):
   ```html
   <script src="dis/gaia-voice-data.js"></script>
   <script src="dis/gaia-state-machine.js"></script>
   <script src="dis/gaia-voice-engine.js"></script>
   <script src="dis/gaia-quest-system.js"></script>
   <script src="dis/gaia-key-gate.js"></script>
   <script src="dis/gaia-client.js"></script>
   ```
2. Verify no console errors on load
3. Verify existing chat still works (DIS should not interfere in pre-init state)

**Blockers:** None. Purely additive.

---

### Phase 1: DOM Bridge (Complexity: MEDIUM — 2-3 days)

**Goal:** Add the DOM elements that gaia-client.js expects but gaia.html doesn't have.

**Files to modify:**
- `gaia.html` — Add missing DOM elements and adjust existing IDs

**Missing DOM elements (referenced by gaia-client.js but not in gaia.html):**

| DIS Expected ID | gaia.html Has | Action |
|----------------|---------------|--------|
| `gaia-chat-messages` | `#messages` | Add alias wrapper or rename |
| `gaia-chat-input` | `#chat-input` | Add alias or rename |
| `gaia-overlay` | None | Add overlay div |
| `gaia-overlay-content` | None | Add overlay content div |
| `gaia-key-modal` | None | Add key gate modal |
| `gaia-key-form` | None | Add key form |
| `gaia-key-input` | None | Add key input |
| `gaia-key-error` | None | Add error display |
| `gaia-key-btn` | None | Add key button (in header) |
| `gaia-avatar` | `.gaia-avatar` (welcome only) | Add to chat area |
| `gaia-journal` | None | Add journal panel |

**Steps:**
1. Rename `#messages` → `#gaia-chat-messages` (or add `id="gaia-chat-messages"` alongside)
2. Rename `#chat-input` → `#gaia-chat-input`
3. Add overlay container:
   ```html
   <div id="gaia-overlay">
     <div id="gaia-overlay-content"></div>
   </div>
   ```
4. Add key gate modal (full modal HTML with title, GAIA line, input, submit button, error display)
5. Add `#gaia-key-btn` button to header actions
6. Add `#gaia-journal` panel (can be in sidebar or as overlay tab)
7. Add `#gaia-avatar` element to chat area for emotion display

**Blockers:** None. Purely additive HTML.

---

### Phase 2: Event Bridge (Complexity: MEDIUM — 3-4 days)

**Goal:** Make gaia.html's existing interactions emit DIS events so the state machine can track engagement.

**Files to modify:**
- `gaia.html` inline script — Add event dispatchers at key interaction points

**Events to emit (mapped to state machine signals):**

| User Action | Custom Event | DIS Signal | Score |
|-------------|-------------|------------|-------|
| Tap sidebar topic | `gaia:site-tap` | site_tap | +10 |
| Load project data | `gaia:data-reveal` | data_reveal | +5 |
| Run sandbox calc | `gaia:scenario-run` | scenario_run | +15 |
| View NDVI timeline | `gaia:ndvi-scroll` | ndvi_explore | +3 |
| Send chat message | (existing Enter handler) | chat_sent | +5 |
| Open sandbox panel | (existing toggle) | sandbox_open | +5 |

**Steps:**
1. In `askGaia()` function: dispatch `gaia:site-top` with site ID before processing
2. In `lookupProject()`: dispatch `gaia:data-reveal` with site ID and layer type
3. In `runSandboxCalc()`: dispatch `gaia:scenario-run` with from/to biomes, hectares, result
4. In chat send handler: dispatch event for `chat_sent`
5. In sidebar topic click handlers: dispatch `gaia:site-tap` with topic metadata
6. Wire these events to also call `GaiaState.handleEvent()` directly as fallback

**Blockers:** None. Additive event dispatching.

---

### Phase 3: State Machine Activation (Complexity: MEDIUM — 2-3 days)

**Goal:** Initialize the state machine and make GAIA speak pre-scripted lines on interactions.

**Files to modify:**
- `gaia-client.js` — Adapt init sequence for gaia.html's DOM
- `gaia-state-machine.js` — Verify line selection works with voice data

**Steps:**
1. GaiaClient.init() runs on DOMContentLoaded (already auto-inits)
2. State machine starts in GREETING state, picks a line from GREETING pool
3. GAIA's greeting is displayed in chat and spoken via TTS
4. Each user interaction triggers state transition + GAIA response
5. Engagement score accumulates in localStorage

**Key adaptation needed:**
- gaia-client.js `_renderGaiaMessage()` creates DOM elements with class `chat-message gaia` — gaia.html uses class `msg gaia`. Need to align CSS classes or make the renderer use gaia.html's existing classes.
- **Fix:** Override `_renderGaiaMessage` to use gaia.html's existing message format (`.msg.gaia`, `.msg-avatar`, `.msg-bubble`)

**Blockers:** CSS class mismatch between DIS and gaia.html. Fixable with a small adapter function.

---

### Phase 4: Quest System UI (Complexity: MEDIUM — 3-4 days)

**Goal:** Render quest cards, progress indicators, and completion celebrations.

**Files to create:**
- `gaia-quest-ui.js` — Quest UI renderer (new file)

**Files to modify:**
- `gaia.html` — Add quest panel (sidebar section or overlay tab)

**Quest UI components:**
1. **Quest card** — Icon, title, description, progress bar, GAIA's reaction on complete
2. **Quest notification** — Toast/popup when quest completes ("You took your first step...")
3. **Tier progress** — SEED → GROW → FLOURISH → LEGACY progress indicator
4. **Hidden quest reveal** — Special animation when hidden quest is discovered

**Steps:**
1. Add quest panel to sidebar (new section below "About")
2. Create `gaia-quest-ui.js` that listens to `GaiaQuests.onQuestEvent()` and renders cards
3. On quest complete: show GAIA's reaction line + add insight to journal
4. Add quest completion celebration (globe pulse + GAIA speaks)

**Blockers:** None. The quest system backend is complete; only UI rendering is needed.

---

### Phase 5: Key Gate UI (Complexity: MEDIUM — 2-3 days)

**Goal:** Add the API key onboarding flow with emotional tease escalation.

**Files to create:**
- `gaia-key-ui.js` — Key modal renderer (new file, lightweight)

**Files to modify:**
- `gaia.html` — Add key modal HTML (if not done in Phase 1)

**Key gate flow:**
1. Engagement score 30+: GAIA whispers about having more to say
2. Engagement score 60+: "Unlock GAIA" button appears in header
3. Engagement score 100+: Button text changes to "Unlock Full GAIA"
4. Engagement score 150+: Preview sequence plays (7 beats with TTS pauses)
5. User clicks button → modal opens with GAIA's emotional request
6. User enters OpenRouter key → WebSocket connects → full GAIA unlocks

**Steps:**
1. Create modal HTML with: title, GAIA's line, input field (placeholder "sk-or-v1-..."), submit button, error display
2. Wire `GaiaKeyGate.openModal()` to populate modal content based on tease level
3. On submit: validate key, store hash in localStorage, connect WebSocket
4. On unlock: play unlock response sequence, transition to POST_UNLOCK state

**Blockers:** None. Key gate backend is complete; only UI wiring is needed.

---

### Phase 6: Voice Engine Integration (Complexity: LOW — 1-2 days)

**Goal:** Make GAIA speak via Web Speech API with emotion modulation.

**Files to modify:**
- `gaia-client.js` — Ensure `_onGaiaSpeak` calls `GaiaVoice.speak()`
- `gaia.html` — Add voice toggle button in header

**Steps:**
1. Voice engine already initialized in `GaiaClient.init()`
2. Each GAIA message triggers TTS with emotion-based rate/pitch/volume
3. Add mute/unmute toggle in header
4. Add voice selector dropdown (if multiple voices available)

**Blockers:** Web Speech API requires user interaction before playing. The `click` listener in `_initAudioContext()` handles this. May need a "Enable Voice" button on first load.

---

### Phase 7: Cloudflare Worker Deployment (Complexity: MEDIUM — 3-5 days)

**Goal:** Deploy the worker and connect gaia.html to the LLM runtime.

**Files to create/modify:**
- `dis/worker.js` — Already complete, needs deployment
- `dis/wrangler.toml` — Needs KV namespace IDs
- `dis/durable/gaia-session.js` — Needs to be created (referenced but not in repo)
- `dis/durable/world.js` — Needs to be created
- `dis/durable/profile.js` — Needs to be created

**Deployment steps:**
1. `cd dis && npm install`
2. `wrangler secret put OPENROUTER_API_KEY`
3. `wrangler kv:namespace create WORLD_KV`
4. `wrangler kv:namespace create ANALYTICS`
5. `wrangler kv:namespace create PROFILE_KV`
6. Update wrangler.toml with KV namespace IDs
7. Create the 3 Durable Object class files (or inline them in worker.js — they're already there)
8. `wrangler deploy`
9. Update `gaia-client.js` CONFIG.ISOLATE_URL and WS_URL to point to deployed worker

**CRITICAL BLOCKER:** The Durable Object classes are defined inline in worker.js (GaiaSessionDurableObject, WorldDurableObject, ProfileDurableObject) but the wrangler.toml doesn't have migration definitions for them. Need to add:
```toml
[[migrations]]
tag = "v1"
new_classes = ["GaiaSessionDurableObject", "WorldDurableObject", "ProfileDurableObject"]
```

**Blockers:**
- KV namespaces must be created before deployment
- OPENROUTER_API_KEY must be set as a secret
- The worker.js references `env.ASSETS` for static asset fallback but the assets directory (`./dist`) doesn't exist — either create it or remove the fallback

---

### Phase 8: Data Integration (Complexity: LOW — 1-2 days)

**Goal:** Replace hardcoded stats in DIS with live data from gaia-data.js.

**Files to modify:**
- `gaia-client.js` — Replace `_getGlobalStats()` with call to `GAIA_DATA.getSnapshot()`
- `dis/worker.js` — Replace hardcoded stats with KV lookups

**Steps:**
1. `_getGlobalStats()` currently returns hardcoded values (co2_ppm: 431.12, etc.)
2. Replace with: `GAIA_DATA.getSnapshot()` which fetches real NOAA data
3. Cache the snapshot to avoid repeated API calls
4. Update every 5 minutes

**Blockers:** None. gaia-data.js is already loaded and functional.

---

### Phase 9: Testing & Polish (Complexity: MEDIUM — 3-5 days)

**Goal:** End-to-end testing, edge cases, performance.

**Test matrix:**
1. First visit: GAIA greeting plays, engagement score starts at 0
2. Tap site → GAIA speaks site entry line, score +10
3. Reveal data → GAIA reacts, score +5
4. Run scenario → GAIA comments on result, score +15
5. Complete quest → Celebration + journal entry
6. Score 30+: Key tease appears
7. Score 150+: Preview sequence plays
8. Enter key → WebSocket connects → LLM responds
9. Return visit: GAIA remembers, score persists
10. Idle 10s/20s/40s/60s: Escalating nudge lines
11. Voice on/off: TTS respects toggle
12. Mobile: Touch events, responsive layout

**Performance:**
- State machine tick: 1s interval, minimal DOM work
- WebSocket: Only active post-unlock
- TTS: Non-blocking, queued
- localStorage: < 5KB per session

---

## 5. FILE CREATION/MODIFICATION SUMMARY

### Files to CREATE (new):

| File | Purpose | Lines (est.) |
|------|---------|-------------|
| `gaia-quest-ui.js` | Quest card renderer, progress UI, completion celebrations | ~200 |
| `gaia-key-ui.js` | Key modal population, tease level UI updates | ~100 |
| `gaia-dom-adapter.js` | Bridge between DIS DOM expectations and gaia.html's actual DOM | ~150 |
| `dis/durable/gaia-session.js` | Durable Object for session state (if extracted from worker.js) | (in worker.js) |
| `dis/durable/world.js` | Durable Object for world state | (in worker.js) |
| `dis/durable/profile.js` | Durable Object for profiles | (in worker.js) |

### Files to MODIFY:

| File | Changes | Complexity |
|------|---------|-----------|
| `gaia.html` | Add DIS script tags, add missing DOM elements (overlay, modal, quest panel, journal), rename IDs to match DIS expectations, add event dispatchers | MEDIUM |
| `gaia-client.js` | Adapt `_renderGaiaMessage` to use gaia.html's CSS classes, replace `_getGlobalStats` with gaia-data.js call, fix DOM ID references | MEDIUM |
| `dis/worker.js` | Add Durable Object migration config, fix ASSETS fallback, add KV namespace IDs | LOW |
| `dis/wrangler.toml` | Add migration section, update KV IDs after creation | LOW |

### Files READ-ONLY (never modify):

| File | Reason |
|------|--------|
| `index.html` | READ-ONLY constraint |
| `dis/gaia-state-machine.js` | Complete, works as-is |
| `dis/gaia-voice-engine.js` | Complete, works as-is |
| `dis/gaia-voice-data.js` | Complete, works as-is |
| `dis/gaia-quest-system.js` | Complete, works as-is |
| `dis/gaia-key-gate.js` | Complete, works as-is |
| `gaia-data.js` | Complete, works as-is |
| `gaia-charts.js` | Complete, works as-is |

---

## 6. COMPLEXITY ESTIMATES

| Phase | Task | Complexity | Time |
|-------|------|-----------|------|
| 0 | Load DIS files in gaia.html | LOW | 1-2 days |
| 1 | Add missing DOM elements | MEDIUM | 2-3 days |
| 2 | Emit DIS events from interactions | MEDIUM | 3-4 days |
| 3 | Activate state machine + line selection | MEDIUM | 2-3 days |
| 4 | Quest system UI | MEDIUM | 3-4 days |
| 5 | Key gate UI + modal | MEDIUM | 2-3 days |
| 6 | Voice engine integration | LOW | 1-2 days |
| 7 | Cloudflare Worker deployment | MEDIUM | 3-5 days |
| 8 | Live data integration | LOW | 1-2 days |
| 9 | Testing + polish | MEDIUM | 3-5 days |
| **TOTAL** | | | **21-33 days** |

---

## 7. BLOCKERS & DECISIONS NEEDED

### Blockers:

1. **Durable Object migrations missing** — wrangler.toml needs migration config for the 3 DO classes. Fix: add `[[migrations]]` section.

2. **ASSETS fallback in worker.js** — `env.ASSETS.fetch(request)` will fail if `./dist` directory doesn't exist. Fix: create empty `./dist/` or remove fallback.

3. **DOM ID mismatch** — gaia-client.js expects `#gaia-chat-messages`, `#gaia-overlay`, `#gaia-key-modal`, etc. gaia.html uses `#messages`, no overlay, no modal. Fix: Phase 1 adds these elements.

4. **CSS class mismatch** — DIS renders messages with class `chat-message gaia`, gaia.html uses `msg gaia`. Fix: gaia-dom-adapter.js or modify renderer.

5. **KV namespaces not created** — wrangler.toml has placeholder IDs. Fix: `wrangler kv:namespace create` x3.

6. **OPENROUTER_API_KEY not set** — Required for LLM runtime. Fix: `wrangler secret put OPENROUTER_API_KEY`.

### Decisions Needed:

1. **Should index.html get a lightweight GAIA overlay?** — Even without going to gaia.html, the main site could have a small GAIA greeting that uses just the state machine (no WebSocket). This would require loading DIS files in index.html, which violates the READ-ONLY constraint. **Recommendation:** Don't modify index.html. The "Talk to GAIA" link is sufficient.

2. **Should the existing regex KB be preserved post-unlock?** — Post-unlock, the LLM handles all responses. The regex KB becomes a fallback only. **Recommendation:** Keep it as fallback for when WebSocket disconnects.

3. **Deployment target: subdomain or path?** — Worker can deploy to `gaia.earthloveunited.org` (subdomain) or `earthloveunited.org/api/gaia/*` (path). **Recommendation:** Path-based (`/api/gaia/*`) to avoid CORS issues and keep everything on one domain.

4. **Voice: opt-in or opt-out?** — Web Speech API requires user gesture. **Recommendation:** Opt-in. Show "Enable Voice" button on first GAIA message. Store preference in localStorage.

---

## 8. COP31 READINESS ASSESSMENT

**Deadline: November 2026 (~6 months)**

**Minimum viable integration for COP31:**
- Phases 0-3: State machine active with pre-scripted lines (no LLM needed)
- Phase 4: Quest system visible
- Phase 5: Key gate functional
- Phase 6: Voice working
- **Total: ~12-19 days of work**

**Full integration (with LLM):**
- All phases 0-9: ~21-33 days
- Buffer for unexpected issues: +2 weeks
- **Total: ~6-8 weeks**

**Recommendation:** Ship phases 0-6 for COP31 (state machine + quests + key gate + voice). The LLM runtime (phases 7-8) can be deployed as a post-COP31 enhancement. The state machine with 108 pre-scripted lines is compelling enough for a demo.

---

## 9. gaia.html EVOLUTION ASSESSMENT

**Question: Can gaia.html be evolved into the full DIS experience, or does it need to be rebuilt?**

**Answer: Evolve it. Do not rebuild.**

**Reasons:**
1. gaia.html already has the complete chat UI (messages, input, sidebar, sandbox, charts) — rebuilding this would be 400+ lines of redundant work
2. The carbon data engine (gaia-data.js) and chart renderer (gaia-charts.js) are production-quality and DIS has no equivalent
3. The BIOMES and SITES data structures are already defined and used by both the sandbox and the DIS tools
4. The intent-matching system, while primitive, is a functional fallback for when the LLM is unavailable
5. The CSS is comprehensive (886 lines) with animations, responsive design, and the exact visual identity DIS needs

**What needs to change in gaia.html:**
- Add ~10 DOM elements (overlay, modal, quest panel, journal)
- Add ~6 script tags for DIS files
- Add ~20 event dispatchers at interaction points
- Rename ~3 IDs to match DIS expectations
- Add ~1 adapter file for CSS class alignment

**What stays the same:**
- All CSS (visual identity, animations, responsive)
- Chat UI structure (messages, input, sidebar, sandbox)
- Data engine (gaia-data.js)
- Chart renderer (gaia-charts.js)
- Carbon calculator (BIOMES, SITES, transitionCarbon)
- Knowledge base (KB object, as fallback)

**The result:** gaia.html becomes the DIS frontend. The state machine drives pre-LLM behavior. The LLM drives post-unlock behavior. Both use the same DOM, the same data, the same visual identity.

---

## 10. RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| WebSocket connection fails in some networks | MEDIUM | HIGH | Fall back to state machine mode gracefully |
| Web Speech API not supported (some browsers) | LOW | MEDIUM | Detect support, hide voice toggle if unavailable |
| OpenRouter API rate limits | MEDIUM | MEDIUM | Cache responses, implement backoff |
| localStorage quota exceeded | LOW | LOW | Wrap all writes in try/catch |
| Durable Object cold start latency | MEDIUM | LOW | Use WebSocket hibernation API (already in worker.js) |
| KV eventual consistency | LOW | LOW | Acceptable for analytics data |
| COP31 demo network issues | MEDIUM | HIGH | State machine works fully offline — no network needed for core experience |

---

## APPENDIX A: Script Loading Order

The correct loading order for gaia.html `<head>`:

```html
<!-- 1. External libraries -->
<script src="https://cdn.jsdelivr.net/npm/globe.gl"></script>

<!-- 2. Data engine (no dependencies) -->
<script src="gaia-data.js"></script>

<!-- 3. Charts (no dependencies) -->
<script src="gaia-charts.js"></script>

<!-- 4. DIS: Voice data (must load before state machine) -->
<script src="dis/gaia-voice-data.js"></script>

<!-- 5. DIS: Core modules (no interdependencies) -->
<script src="dis/gaia-state-machine.js"></script>
<script src="dis/gaia-voice-engine.js"></script>
<script src="dis/gaia-quest-system.js"></script>
<script src="dis/gaia-key-gate.js"></script>

<!-- 6. DIS: DOM adapter (bridges DIS to gaia.html) -->
<script src="gaia-dom-adapter.js"></script>

<!-- 7. DIS: Orchestrator (depends on all above) -->
<script src="dis/gaia-client.js"></script>

<!-- 8. Quest UI (depends on quest system) -->
<script src="gaia-quest-ui.js"></script>
```

## APPENDIX B: Environment Variables Needed

| Variable | Where | How to Set |
|----------|-------|-----------|
| `OPENROUTER_API_KEY` | Cloudflare Worker secret | `wrangler secret put OPENROUTER_API_KEY` |
| `WORLD_KV` ID | wrangler.toml | `wrangler kv:namespace create WORLD_KV` |
| `ANALYTICS` ID | wrangler.toml | `wrangler kv:namespace create ANALYTICS` |
| `PROFILE_KV` ID | wrangler.toml | `wrangler kv:namespace create PROFILE_KV` |

---

*End of Dev Integration Plan v1.0*
*Prepared by: Dev Agent, Earth Love United*
*Date: May 2026*
*Status: Ready for Consigliere review*
