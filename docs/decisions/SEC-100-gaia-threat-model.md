# SEC-100: GAIA Threat Model & Credential/Data-Flow Decision

## Status: DECISION-READY (awaiting human approval)

## Date: 2026-06-24

## Scope

This decision record covers:
1. Threat model for the GAIA chat system (js/gaia-chat.js + DIS subsystem)
2. Credential storage and handling (API keys for OpenRouter, live APIs)
3. Data flow boundaries: what leaves the browser, what stays local
4. Trust boundaries: user input → LLM → response rendering

## Current Architecture (from code audit)

### Credential Flow
- OpenRouter API key handled by `GaiaKeyGate` module
- Two fallback paths in `_callOpenRouter()`:
  - Primary: `GaiaKeyGate.hasKey()` / `GaiaKeyGate.getStoredKey()`
  - Fallback: `sessionStorage.getItem('gaia_api_key')`
- Key sent as Bearer <REDACTED> header to `https://openrouter.ai/api/v1/chat/completions`
- Referer: `https://earthloveunited.org`
- X-Title: `GAIA - Earth Love United`

### Data Flow
- User message → `_buildGroundedTurn()` → system prompt assembled with:
  - GAIA system prompt (static, contains character/personality)
  - Base context (sites, biomes, climate facts — all public data)
  - SOURCES block (GaiaRetrieval BM25 results — curated public data)
  - STRUCTURED block (GaiaStructured — verified pledge/project/paleo rows)
- Full conversation history kept in `_conversationHistory` (max 20 messages, in-memory only, never persisted)
- welcome-back info stored via `GAIA_DATA.saveSessionInfo()` — timestamp + visitCount

### External Connections (from CSP header)
- `connect-src`: self, gml.noaa.gov, api.carbonmark.com, services.sentinel-hub.com,
  modis.ornl.gov, registry.vcsprogram.com, my.goldstandard.org, cdm.unfccc.int,
  production-api.globalforestwatch.org, cdn.jsdelivr.net, raw.githubusercontent.com,
  eonet.gsfc.nasa.gov, earthquake.usgs.gov
- `script-src`: self, unsafe-inline, cdn.jsdelivr.net, unpkg.com
- `img-src`: self, data:, cdn.jsdelivr.net, unpkg.com, *.tile.openstreetmap.org

## Threat Model

### T1 — API Key Exfiltration
**Risk:** An attacker obtains the user's OpenRouter API key.
**Current mitigations:**
- Key stored in `sessionStorage` (per-tab, cleared on tab close) — NOT localStorage
- Key transmitted only over HTTPS (openrouter.ai)
- CSP `connect-src` restricts origins but includes many third-party API domains
- No server-side logging of key (static site, no backend)

**Remaining risks:**
- `script-src: unsafe-inline` means any XSS payload can read `sessionStorage` and exfiltrate the key
- Third-party script injection via CDN compromise (cdn.jsdelivr.net, unpkg.com) could exfiltrate
- Key visible in DevTools Network tab for any user inspecting their own traffic

**Decision needed:** Should the key be scoped/limited per-user or is the current user-managed key acceptable?

### T2 — Prompt Injection / Data Poisoning
**Risk:** User-crafted input manipulates the LLM into leaking system prompt or producing harmful content.
**Current mitigations:**
- System prompt instructs the LLM to stay in character (GAIA) and cite sources
- Source-tagging system (`[S1]`, `[N1]`) with validation against known tags
- `_escapeHtml()` sanitizes user input before rendering
- Non-calculator queries go through LLM, but calculator uses dedicated `transitionCarbon()` engine (bypasses LLM)

**Remaining risks:**
- System prompt is assembled client-side and sent as a regular message — LLM does not distinguish from user intent
- `unsafe-inline` in CSP allows inline event handler injection
- Base context includes unverified data from pledge-nodes.json (27+ fields) — if upstream data is poisoned, GAIA will repeat it with authority

**Decision needed:** Should we add output-side guardrails (response filtering, citation check) before rendering?

### T3 — Third-Party Data Integrity
**Risk:** Live API responses (NOAA, Carbonmark, OWID) are tampered with or out of date.
**Current mitigations:**
- Fallback static data (`_FALLBACK_BIOMES`, `_FALLBACK_SITES`, `getLiveData()` fallbacks) ensure the UI renders even if APIs fail
- `await withTimeout()` with 1500-2500ms timeouts prevents hanging

**Remaining risks:**
- All third-party data treated as authoritative in UI (live CO₂, carbon market prices)
- No signature/checksum verification of fetched data
- No freshness indicator shown to user (just "Updated today")

**Decision needed:** Is the current trust-on-first-fetch model acceptable, or do we need data provenance badges or staleness warnings?

### T4 — Session Replay / Conversation Leakage
**Risk:** Sensitive user queries (e.g., about carbon footprint of specific activities) are stored longer than necessary.
**Current mitigations:**
- `_conversationHistory` is in-memory JS array, cleared on page refresh
- Max 20 messages (old messages spliced)
- No server-side storage of conversation
- No cookies or persistent identifiers beyond session

**Remaining risks:**
- `sessionStorage` for API key survives tab restore (browser-dependent)
- Welcome-back message includes CO₂ delta since last visit — implies tracking
- GaiaState engagement score persists across page loads via `GAIA_DATA.saveSessionInfo()`

**Decision needed:** Is the current 20-message cap + in-memory-only acceptable for the trust layer we're targeting (public education site, no PII collection)?

### T5 — Donation/Commitment Data
**Risk:** If the public wall or pledge features collect user-submitted commitments, what data is stored and displayed?
**Current state:**
- `pledge-wall.js` exists in codebase but public-wall functionality is educational/display
- No user-generated content stored in the current codebase
- "Volunteer / Partner" CTAs go to `mailto:` links only
- Donation amounts/displayed commitments not currently implemented in visible UI

**Decision needed (feeds TRU-100):** Should the site accept user-submitted public commitments? If yes, what moderation and data model?

## Credential Decision Options

### Option A: Keep User-Managed Key (Current)
- User provides their own OpenRouter key via the 🔑 API Key button
- Key stored in sessionStorage, never persisted
- Pros management for the site, no server costs, user controls limits
- Cons: Friction for non-technical users, key visible in browser, no abuse prevention

### Option B: Proxy via Serverless Function
- Site routes OpenRouter calls through a thin Cloudflare Worker / Vercel function
- API key stored as environment variable, never exposed to browser
- Pros: Key protection, rate limiting possible, can cache common queries
- Cons: Server cost (~$5-20/mo), adds latency, introduces server dependency (breaks bare-metal principle)

### Option C: Hybrid — Key Gate + Optional Proxy
- User-managed key for advanced users (current flow)
- Optional demo mode with site-provided proxy for first-time visitors
- Pros: Best of both worlds, maintains bare-metal default while reducing friction
- Cons: Two code paths to maintain, proxy has cost

## Data Flow Decision Options

### Option 1: Current (All Client-Side)
- All data fetching from browser directly
- Pros: Simple, offline-capable, no server
- Cons: CORS issues (need permissive CSP), rate limiting per-user (IP-based limits less effective)

### Option 2: Static Pre-Bake at Build Time
- Use the existing `build.py` / `serve.py` pattern to pre-fetch data at deploy
- Pros: Faster UX, reduces API calls, reduces real-time leakage
- Cons: Data is as fresh as last deploy, not truly live

### Option 3: CORS Proxy + Static Fallback
- Route third-party API calls through same-origin proxy with caching
- Pros: Reduces CORS complexity, can add rate limiting
- Cons: Server dependency

## Decision-Ready Questions for Human Approval

Q1: **Credential model for OpenRouter key** — which option (A/B/C)?
Q2: **Input/output guardrails** — should we add response citation verification?
Q3: **Donation/public-wall features** — proceed to TRU-100 after SEC-100 resolves scope?
Q4: **Data freshness** — is "no live data, curated education layer" acceptable?

## Files Reviewed
- `js/gaia-chat.js` (lines 1-1279) — full threat surface
- `index.html` (lines 33 — CSP headerENTS.md` (excerpt) — architecture constraints

## Constraint Notes
- js/gaia-chat.js is protected while SEC-001/REL-001 work is active
- This document is analysis only — no code changes proposed
- PR #2 (pending) may affect credential handling — re-eval after merge
