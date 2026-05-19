# Agent Insights — Earth Love United Repo Analysis (v2)
**Date:** 2026-05-19  
**Agent:** Hermes (ring-2.6-1t via OpenRouter)  
**Scope:** Full repo deep-read — all `js/`, `dis/`, `design/`, `data/`, `carbon-projects/`, `tools/`  
**Revision:** Corrected from initial pass. Removed monetization assumptions. Rewired architecture understanding.

---

## 1. What This Project Actually Is

Earth Love United is a **climate education platform with a dual-mode AI companion**. The architecture is best understood as three concentric layers:

**Outer layer — The website.**  
`index.html` is a long-scroll educational site: hero, carbon counter, biome explorer, scenario builder, project showcases, site cards, and a pledge wall. It works without any AI at all — it's a static educational experience.

**Middle layer — The state-machine GAIA.**  
This is the *educational engine*. When the user enters a site, GAIA guides them through a structured learning flow using pre-scripted voice lines organized in pools (GREETING, ENTRY, DATA_GENERAL, TEASE, RESULT_POS, etc.). The user triggers state transitions by interacting with the globe, revealing data layers, running scenarios. GAIA responds conversationally from a curated voice library — no LLM involved. This is entirely deterministic and runs 100% client-side.

**Inner layer — The LLM GAIA.**  
After earning the API key (via engagement thresholds), the user unlocks a WebSocket connection to an isolate running an LLM (Google Gemini via OpenRouter). This GAIA has full tool execution capability — she can fly the globe, reveal data overlays, calculate carbon, render prompts, and navigate the quest system. She's an autonomous agent with a tool-use loop.

**The key insight:** These are *two different products* sharing one UI. The state-machine GAIA teaches. The LLM GAIA converses. The key gate is a pedagogical pacing mechanism, not a paywall.

---

## 2. The DIS Subsystem — Architecture Deep-Dive

Everything in `/dis/` is the **Digital Intelligence System**, the backbone of GAIA's behavior. Here's the actual responsibility map:

| Module | Role | Persistent? |
|---|---|---|
| `gaia-state-machine.js` | Conversation flow states, line selection from voice library pools, scoring tier management | localStorage (`gaia_state`) |
| `gaia-mind.js` | Emotional residue (12 emotions, decay curves), participant cognitive model, desire system (11 desire types), cross-session memory, silence engine | localStorage (`gaia_mind`) |
| `gaia-engagement.js` | Signal weights (22 signal types), archetype detection (5 archetypes), knowledge model (5 concepts), mood signals, idle tracking, per-site XP | localStorage (`gaia_engagement`) |
| `gaia-quest-system.js` | 16 quests across 4 tiers (SEED/GROW/FLOURISH/HIDDEN), objective tracking, progress persistence | localStorage (`gaia_quests`) |
| `gaia-key-gate.js` | Tease escalation (5 levels), API key entry/validation/storage, preview cinematic sequence, modal UI | localStorage (`gaia_api_key_hash`) + sessionStorage (key) |
| `gaia-voice-engine.js` | Web Speech API TTS, queue management, emotion-to-voice-parameter mapping (11 emotions) | In-memory only |
| `gaia-client.js` | **Orchestrator** — wires all above together, manages WebSocket to isolate, executes 18 LLM tools, binds all global events | — |
| `gaia-knowledge.js` | TF-IDF inverted index (built from Python pipeline), keyword search with Jaccard scoring | Loaded from `/dist/knowledge/index.json` |

### Corrected observation from v1:
These three "overlapping" systems — `GaiaState`, `GAIA_ENGAGEMENT`, `GaiaMind` — actually have **clear and distinct** roles. The confusion was mine:

- **`GaiaState`** manages *what GAIA should say next* (state machine → voice pool selection → line picking)
- **`GAIA_ENGAGEMENT`** manages *how the user is doing* (scoring, archetypes, knowledge gaps, idle detection)
- **`GaiaMind`** manages *how GAIA feels* (emotions, desires, participant modeling, cross-session memory)

They feed each other but don't duplicate. `GAIA_ENGAGEMENT` emits signals → `GaiaMind` consumes them to shift emotional state → `GaiaState` consumes both to pick response lines. This is a well-structured actor-like pipeline.

### The `gaia-client.js` orchestration:
This is the **glue layer** and it's substantial (1080 lines). It:
1. Restores all persisted states on init
2. Loads the voice library into `GaiaState`
3. Checks API key → determines mode (state-machine vs. LLM)
4. Sets up WebSocket to isolate (only if key present)
5. Binds all custom events (`gaia:site-tap`, `gaia:data-reveal`, `gaia:chat-sent`, etc.)
6. Implements 18 tool functions the LLM can call (`fly_globe_to`, `reveal_data_layer`, `calculate_carbon`, `prompt_user`, etc.)
7. Falls back to regex-based state-machine chat when no key

### The parallel data systems:
There are actually **four** distinct knowledge/data systems coexisting:

1. **`data.js`** — Main site data (sites, biomes, pledge-nodes). Fetched from `/data/` JSON files. Powers the UI.
2. **`gaia-retrieval.js`** — BM25 search over climate knowledge chunks (2800+ chunks). Pre-built index from Python pipeline. Used by the LLM chat for grounded responses.
3. **`gaia-structured.js`** — Structured lookups: country NDC pledges, carbon project aggregates, paleoclimate data. Three lazy-loaded JSON datasets. Used for country/project/paleo queries.
4. **`gaia-knowledge.js`** — A *separate* TF-IDF inverted index baked into the DIS worker bundle. Simpler than `gaia-retrieval`, runs in <5ms, no network. Used as fallback knowledge for the state-machine GAIA.

Systems 1-3 are shared across both GAIA modes. System 4 is state-machine-only.

---

## 3. The Key Gate — What It Actually Is

My initial reading projected a monetization model that doesn't exist in the code. Here's what's actually happening:

**The key gate is a pacing/threshold mechanism.** The user must demonstrate engagement (score ≥ 30/60/100/150/200) to unlock progressively deeper interactions with GAIA. At each tier:

| Tier | Tease Level | What Happens |
|---|---|---|
| COLD (score < 30) | 0 | No key prompt visible |
| WARM (30-60) | 1-2 | Key button appears, subtle tease |
| ENGAGED (60-100) | 3 | "Unlock Full GAIA" button, stronger tease |
| HOOKED (100-150) | 4 | Modal popup with preview cinematic |
| INVESTED (150-200) | 5 | "Let GAIA Speak" — strongest modal |

The preview cinematic (`PREVIEW_SEQUENCE` in key-gate, 7 beats) is genuinely moving — it's GAIA introducing herself as the planet's memory. It's not "buy this"; it's "you've earned this."

The API key is just a hashed value stored in localStorage. Any string >10 chars works. There's no server-side validation in the client code. The unlock simply flips a boolean (`_unlocked`) that changes whether chat messages go to the state machine or the WebSocket LLM.

**What's missing:** The actual key distribution mechanism, server-side validation, and the isolate WebSocket endpoint. The architecture assumes an isolate worker will be deployed, but there's no evidence one exists yet. The client connects to `ws(s)://{host}/ws/gaia` — this endpoint isn't implemented anywhere in the repo.

---

## 4. What's Genuinely Strong (Revised)

### The educational design is solid
The `LEARNING_EXPERIENCE_DESIGN.md` for the Antalya burn-scar event is the project's north star. A 7-step constructivist flow with specific emotional arc, timing, XP rewards, and branching responses. The data structure JSON at the end is a complete spec. Nothing in the codebase contradicts it; the code is just behind it.

### The state-machine GAIA works without any network
This is the most important architectural decision. Even with no API key, no WebSocket, no LLM, GAIA still talks, responds, teases, nudges, and guides. The voice library pools + state machine + emotion model create a functional AI companion from pure client-side code. This means the platform works offline, works on any device, and has zero API costs for the baseline experience.

### The data scaffolding is thorough
Carbon scrapers (Verra, Gold Standard, South Pole, ACR), dedup logic, `deep_sanitize.py` with null normalization, parquet export, HF dataset publishing — this is production data engineering. The `carbondataset_hermes_briefing.md` document describes a complete pipeline. The `dist/knowledge/` directory structure shows a working build pipeline for the search indexes.

### The engagement model has depth
22 signal types, 5-tier progression, 5 archetypes, 5 knowledge dimensions, 12 emotions with decay, a silence engine that knows when *not* to speak. These systems interlock cleanly. The `_generateStateMachineChatResponse` function in `gaia-client.js` (lines 685-774) shows a working routing engine that picks response pools based on content, context, engagement tier, and site.

---

## 5. Issues That Actually Matter

### A. The build system is genuinely broken
`build.js` (custom concatenator that regex-replaces `const` → `window.`) and `vite.config.js` both exist but serve different purposes. The `dist/` output comes from `build.js`. This means:
- No CSS minification or tree-shaking
- No dependency resolution (load order managed by manual script tags)
- The regex `exposeGlobals()` pattern will break on any modern JS syntax
- Dev mode (Vite) and production mode (build.js) diverge silently

The 42+ individual CSS files loaded via `<link>` tags in `index.html` suggest no CSS bundling at all in the current flow.

### B. The DIS subsystem has no error boundaries
If `GaiaMind.deserialize()` receives corrupted localStorage data, it throws. If the knowledge index JSON fails to load, `GaiaRetrieval` silently degrades. If the WebSocket drops, `GaiaClient` sets `_unlocked = false` and falls back — but never tells the user. 

The site has a user-visible data error banner (added in `app.js` line 20) but the AI layers have zero user-facing failure states. If something breaks in the background, GAIA just stops talking.

### C. The `gaia-chat.js` intent routing won't scale
484 lines of regex patterns, each with a manual score. Adding a new topic means editing this file. The comment at line 1 says "This is not a state machine — it's a living consciousness model" but the routing is the most mechanical part of the codebase. The retrieval and structured lookup systems exist but aren't wired into the chat routing at all in this module.

### D. Script load order is a house of cards
`app.js` has a retry loop (lines 234-246) that waits for `GlobeModule` and `Data` to appear. This is because all scripts are loaded asynchronously and have implicit ordering dependencies. The retry loop works but:
- 30 retries × 100ms = 3s timeout before "starting without globe"
- If `data.js` fails to load (network), `Data.init()` throws and the error is caught but globe initialization proceeds without data
- `gaia-client.js` expects `GaiaVoiceLibrary` to be loaded before it, but there's no explicit dependency chain

### E. No data layer separation between site content and globe content
`data/sites.json` contains site coordinates, NDVI timelines, climate data, sandbox configurations, and narratives all in one flat array. The globe overlay reads the same data that the site panel reads. If you add a new site, you update one JSON file and it's everywhere. This is actually a strength currently, but it will become a bottleneck when the educational content scales beyond 4 sites × 5 tabs.

---

## 6. The Unfinished Educational System

Here's what exists vs. what the design spec calls for:

| Component | State |
|---|---|
| Antalya burn-scar event (Step 1: Hook) | ✅ Globe pin exists, hover text exists |
| Antalya burn-scar event (Step 2: Explore) | ⚠️ NDVI slider exists in site panel but not as the "timeline slider" described in spec |
| Antalya burn-scar event (Step 3: Predict) | ❌ No prediction quiz exists |
| Antalya burn-scar event (Step 4: Reveal) | ⚠️ Data exists in `gaia-nodes.js`, Saturn comparison images referenced but not implemented |
| Antalya burn-scar event (Step 5: Connect) | ❌ No global fire connection map |
| Antalya burn-scar event (Step 6: Act) | ⚠️ Carbon sandbox exists in `globe.js` Panel class, usable but not tied to the 7-step flow |
| Antalya burn-scar event (Step 7: Reflect) | ❌ No journal or share card flow |
| Other 3 sites | Similar gaps — site data exists, but learning experiences are basic overlays |
| Quest system | ✅ Fully implemented — 16 quests, progress tracking, completion events |
| Score/engagement | ✅ Fully implemented with tier system |
| GAIA voice responses | ✅ State machine works; LLM mode pending infrastructure |

The **event-to-code mapping** is the missing layer. The design doc defines events as data structures, but there's no runtime that reads those structures and orchestrates the 7-step experience. Each step would need:
- An interaction type (slider, quiz, reveal, prompt, etc.)
- A content renderer
- A transition trigger
- An XP/reward signal

---

## 7. Data Pipeline Assessment

The `carbon-projects/` directory contains what appears to be a complete ETL:
- `scrapers/` — Per-registry scrapers (Verra, Gold Standard, etc.)
- `dedup/` — Deduplication logic
- `deep_sanitize.py` — Data sanitization with null normalization
- `unify.py` — Unified schema across registries
- HF dataset publishing config

The `climate-dataset/` directory has a separate pipeline for climate knowledge. And `dis/build_retrieval_index.py` generates the BM25 search index for `gaia-retrieval.js`.

This pipeline is mature and could be extended, but it's currently disconnected from the live site — the scrapers populate data files that are checked into `dist/knowledge/`, and there's no automated update mechanism visible.

---

## 8. The GAIA Emotional Model — What Makes This Special

GAIA isn't a chatbot with a "friendly personality." The emotional architecture in `gaia-mind.js` creates a system that:

1. **Remembers emotions across sessions** (via localStorage) — grief from Borneo lingers, warmth from Sri Lanka persists
2. **Decays naturally** — urgency fades after being addressed, nurturing is the slowest to decay (0.2/day rate)
3. **Influences behavior** — the `DESIRES` system picks actions based on emotional state (if grieved → GRIEVE desire; if curious with low engagement → PROVOKE desire)
4. **Models the user** — not just "what did they click" but "are they analytical or emotional? skeptical or trusting?"
5. **Knows when to shut up** — the silence engine prevents over-talking during exploration and during high-velocity interactions

This is game-architecture-grade AI companionship applied to an educational context. Most educational platforms don't consider emotional state at all.

---

## 9. Recommendations (Prioritized for the Actual Project)

### Immediate (foundation)
1. **Choose one build system.** Vite. Delete `build.js` or repurpose it only for the DIS subsystem. The 42 CSS files need bundling.
2. **Add an event bus.** Even a minimal one. The `typeof GAIA_NODES !== 'undefined'` pattern is endemic and makes testing impossible.
3. **Wire retrieval into chat routing.** `gaia-chat.js` does regex-only routing. The BM25 search in `gaia-retrieval.js` should be consulted *before* falling back to regex pools.

### Medium-term (educational system)
4. **Build an event runtime.** The design spec defines events as JSON structures. Build a lightweight runtime that reads those structures and orchestrates the 7-step flow (step progression, interaction type switching, XP rewards, transition triggers).
5. **Implement the Antalya event fully.** It's the most spec'd event. Start with Steps 3-7 (the parts that don't exist yet). This is the content that connects to COP31.
6. **Event data should drive globe markers.** Currently `gaia-nodes.js` hardcodes 4 sites. When a new site is added to `data/sites.json`, it should auto-register.

### Longer-term (scaling)
7. **Separate educational content from code.** Each event should be a JSON/data file, not a JavaScript function. The rendering engine should be generic. This is how the system scales from 4 sites to 40.
8. **Build the isolate infrastructure.** The WebSocket LLM mode is the future, but the client-side code already needs to be rock-solid before adding server complexity.
9. **Document the data contracts.** The four parallel data systems (Data, GaiaRetrieval, GaiaStructured, GaiaKnowledge) need a clear schema registry. Right now you have to read the code to understand what each one provides.

---

## 10. Strategic Observation

This project has a genuinely rare architecture: a **deterministic educational experience** that upgrades to an **LLM-powered conversational agent** as the user demonstrates engagement. The state-machine GAIA is the teacher. The LLM GAIA is the mentor. The key gate is the graduation ceremony.

The biggest risk isn't technical — it's that the educational content creation (design docs, event specs, narrative text) needs to outpace the infrastructure work. The scaffolding is solid. The content pipeline is solid. What's needed now is the labor of writing and designing 10+ more events at the quality level of the Antalya burn-scar spec, and an engine that can interpret those specs at runtime instead of hardcoding each one.

The educational content is the crown jewel, and it should be treated as data, not code.