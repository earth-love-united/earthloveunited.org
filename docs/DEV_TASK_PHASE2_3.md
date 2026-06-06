# DEV TASK: Phase 2-3 — Event Bridge + State Machine Activation

## Context
Phase 0-1 is complete. The DOM adapter (gaia-dom-adapter.js) bridges DIS into gaia.html. DIS files are loaded. The state machine initializes but isn't yet receiving events from gaia.html's interactions.

## Your Task
Activate the event bridge and state machine so GAIA responds to user interactions with pre-scripted lines.

## What to Build

### Phase 2: Event Bridge
The adapter already creates the DOM elements and injects the key button. Now make gaia.html's interactions actually trigger DIS events:

1. **Sidebar topic clicks** — The adapter's event listeners should call `GaiaState.handleEvent('site_entered', { siteId })` so the state machine tracks engagement and GAIA speaks.

2. **Sandbox interactions** — When the sandbox panel opens or a calculation runs, dispatch events to the state machine.

3. **Chat messages** — When the user sends a message, the state machine should track it and GAIA should respond with pre-scripted lines from the voice library (not just the static KB).

4. **Project lookup** — When `lookupProject()` runs, trigger a data_reveal event.

### Phase 3: State Machine Activation
1. Verify the state machine starts in GREETING state on page load
2. GAIA speaks a greeting line (displayed in chat, optionally spoken via TTS)
3. Each user interaction triggers a state transition and GAIA response
4. Engagement score accumulates in localStorage
5. Mood shifts based on interaction patterns
6. Idle detection works (GAIA nudges after 10s/20s/40s/60s)

## Key Files
- `./gaia-dom-adapter.js` — The adapter (read it, understand the current event bridging)
- `./dis/gaia-state-machine.js` — State machine (read it, understand states/moods/scoring)
- `./dis/gaia-client.js` — Orchestrator (already modified for CSS)
- `./dis/gaia-voice-data.js` — Voice line pools
- `./gaia.html` — The target (additive-only changes)

## Constraints
- Don't modify index.html (READ-ONLY)
- Don't rename existing IDs in gaia.html
- Don't modify gaia.html's inline script (line 287+)
- All changes additive: modify gaia-dom-adapter.js, or add new files

## Success Criteria
1. Open gaia.html → GAIA speaks a greeting line
2. Click a sidebar topic → GAIA responds with a relevant pre-scripted line
3. Send a chat message → GAIA responds (from voice library, not just static KB)
4. Run a sandbox calculation → GAIA comments on the result
5. Stay idle 20s → GAIA nudges
6. Engagement score visible in console or UI
7. All existing gaia.html functionality still works

## Report Back
Write status to `./DEV_STATUS.md` (overwrite previous).
