# DEV TASK: DOM Adapter + DIS Integration (Phase 0-1)

## What You're Building

A DOM adapter that bridges the DIS system (dis/) into the existing gaia.html without modifying any of gaia.html's existing IDs or inline JavaScript.

## The Problem

The DIS system (gaia-state-machine.js, gaia-client.js, etc.) expects these DOM IDs that don't exist in gaia.html:
- `gaia-chat-messages` (gaia.html has `#messages`)
- `gaia-chat-input` (gaia.html has `#chat-input`)
- `gaia-overlay` (doesn't exist)
- `gaia-overlay-content` (doesn't exist)
- `gaia-key-modal` (doesn't exist)
- `gaia-key-form` (doesn't exist)
- `gaia-key-input` (doesn't exist)
- `gaia-key-error` (doesn't exist)
- `gaia-key-btn` (doesn't exist)
- `gaia-avatar` (exists as `.gaia-avatar` in welcome area, needs one in chat too)
- `gaia-journal` (doesn't exist)

Additionally, DIS renders messages with CSS class `chat-message gaia` but gaia.html uses `msg gaia`.

## The Constraint

**Do NOT rename or modify any existing IDs in gaia.html.** The inline script at line 279 of gaia.html references `#messages`, `#chat-input`, `#send-btn`, `#welcome`, `#sidebar`, `#right-panel`, `#sandbox-content`, `#demo-banner`. These must stay exactly as they are.

## What to Build

### File: `gaia-dom-adapter.js` (new, in root alongside gaia.html)

This file must:

1. **Create wrapper elements** for DIS-expected IDs that don't exist:
   ```html
   <div id="gaia-overlay">
     <div id="gaia-overlay-content"></div>
   </div>
   
   <div id="gaia-key-modal">
     <div class="key-modal-inner">
       <h2 class="key-modal-title"></h2>
       <p class="key-modal-gaia-line"></p>
       <form id="gaia-key-form">
         <input id="gaia-key-input" type="password" placeholder="sk-or-v1-..." />
         <button type="submit" class="key-modal-submit">Unlock</button>
       </form>
       <div id="gaia-key-error"></div>
     </div>
   </div>
   
   <div id="gaia-journal">
     <div class="journal-entries"></div>
   </div>
   ```

2. **Create non-destructive ID aliases** — For elements that exist under different IDs, add the DIS-expected ID as a `data-ref` or use a JavaScript proxy pattern so that `document.getElementById('gaia-chat-messages')` returns the `#messages` element. The cleanest approach: add a hidden wrapper div with the DIS-expected ID that contains/aliases the existing element.

   Actually, the simplest approach: just add `id="gaia-chat-messages"` as a SECOND id on the same element. HTML technically allows this (browsers return the first match). But this is fragile.

   **Better approach:** Override `document.getElementById` is too hacky.

   **Best approach:** Modify gaia-client.js's `_renderGaiaMessage` and other DOM-touching functions to use gaia.html's existing IDs instead of DIS-expected IDs. This is a ~20-line change in gaia-client.js, confined to the rendering functions only. The rest of gaia-client.js (state machine, scoring, etc.) doesn't touch the DOM.

   **Wait — actually the cleanest approach:** Add the missing elements to gaia.html as hidden divs, and for the ID conflicts, just add the DIS-expected IDs to the existing elements. HTML elements can have multiple IDs in the DOM (only one `id` attribute, but you can set it to the DIS-expected name and update the inline script references).

   **NO. The constraint is: don't modify gaia.html's existing IDs.**

   **Final approach — the adapter creates proxy elements:**
   - For `#gaia-chat-messages`: create a hidden div with this ID. When DIS calls `appendChild` on it, forward the call to `#messages`. This can be done with a lightweight Proxy on the element.
   - Simpler: just modify the 3-4 rendering functions in gaia-client.js to use gaia.html's IDs. This is a minimal, surgical change.

3. **Add `#gaia-key-btn` button** to the header actions area (in the adapter's init, inject it into `#header .header-actions`)

4. **Add `#gaia-avatar`** to the chat area (inject into `#chat-area` near the messages)

5. **Bridge CSS classes** — When DIS renders a message with class `chat-message gaia`, the adapter should either:
   - Add gaia.html's CSS classes (`msg gaia`) alongside the DIS classes, OR
   - Include a small CSS block in the adapter that makes `.chat-message.gaia` look identical to `.msg.gaia`

6. **Bridge events** — The adapter should listen for gaia.html's existing interaction patterns and dispatch DIS-compatible custom events:
   - When a sidebar topic button is clicked → dispatch `gaia:site-tap` with `{ siteId }`
   - When `lookupProject()` is called → dispatch `gaia:data-reveal` with `{ siteId, layer }`
   - When `runSandboxCalc()` is called → dispatch `gaia:scenario-run` with `{ from, to, hectares, result }`
   - When a chat message is sent → dispatch `gaia:chat-sent`
   - When the sandbox panel is toggled → dispatch `gaia:sandbox-open`

   The trick: gaia.html's inline script calls `askGaia()`, `lookupProject()`, `runSandboxCalc()` directly. The adapter can't modify these functions. Instead, use **event delegation** on the document level:
   - Sidebar buttons already have `onclick="askGaia('...')"` — the adapter can intercept these by listening for the `gaia:site-tap` event that the buttons' click handlers will fire (after we add `dispatchEvent` calls to the inline script... but we can't modify the inline script).

   **Alternative for event bridging without modifying gaia.html:** Use MutationObserver to detect when new messages appear in `#messages`, and infer the interaction type from the content. This is fragile.

   **Better alternative:** The adapter adds its own click listeners on the sidebar buttons and sandbox buttons BEFORE the inline script's onclick fires, captures the interaction, dispatches the DIS event, then lets the original handler proceed. This works because addEventListener runs before inline onclick.

   **For the sandbox:** The adapter can listen for the `#right-panel` toggling (MutationObserver on its `class` attribute) to detect sandbox open/close.

   **For chat messages:** The adapter can intercept the Enter key on `#chat-input` before the inline handler, dispatch `gaia:chat-sent`, then let the original handler proceed.

### File: Modified `dis/gaia-client.js` (minimal changes)

Only modify the rendering functions to use gaia.html's existing CSS classes:
- `_renderGaiaMessage()` — change `chat-message gaia` → `msg gaia`, change `chat-avatar` → `msg-avatar`, change `chat-bubble` → `msg-bubble`
- `_renderUserMessage()` — same class changes
- Any other DOM creation functions that use DIS-specific classes

### File: Modified `gaia.html` (minimal, additive-only changes)

Add script tags in the `<head>` (before the existing inline script at line 279):
```html
<script src="gaia-dom-adapter.js"></script>
<script src="dis/gaia-voice-data.js"></script>
<script src="dis/gaia-state-machine.js"></script>
<script src="dis/gaia-voice-engine.js"></script>
<script src="dis/gaia-quest-system.js"></script>
<script src="dis/gaia-key-gate.js"></script>
<script src="dis/gaia-client.js"></script>
```

That's it. No other changes to gaia.html.

## Success Criteria

1. gaia.html loads without console errors
2. Existing chat still works exactly as before (type message → get response)
3. State machine initializes and tracks engagement score
4. GAIA speaks a greeting line on first load (via TTS if voice enabled)
5. Clicking sidebar topics triggers state machine events and GAIA responses
6. Running sandbox calculations triggers engagement scoring
7. Quest system initializes (quests visible in sidebar or overlay)
8. Key gate initializes (tease system works, modal opens on button click)
9. All existing gaia.html functionality preserved: demo mode, sandbox, project lookup, live data, charts

## Files You'll Touch

**Create:**
- `gaia-dom-adapter.js` (~150-200 lines)

**Modify (minimally):**
- `dis/gaia-client.js` — CSS class names in rendering functions only (~10 lines changed)
- `gaia.html` — Add 7 `<script>` tags in `<head>` only (~7 lines added)

**Read-only (don't touch):**
- Everything else

## Context

- Project path: `./`
- gaia.html is at the root, DIS files are in `dis/` subdirectory
- The existing gaia.html inline script (line 279-886) has all the chat logic, data, and rendering
- The DIS system has state machine, engagement scoring, quest system, key gate, voice engine, and LLM bridge
- COP31 deadline: November 2026
- The goal is to make gaia.html a fully DIS-powered experience without breaking any existing functionality

## Report Back

When done, write a brief summary to `./DEV_STATUS.md` with:
- What was built/modified
- What works
- What's blocked
- What's next
