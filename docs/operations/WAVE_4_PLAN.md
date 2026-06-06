# Wave 4 Plan: App.js EventBus Integration

## Philosophy
app.js is the orchestrator. It MUST call modules directly to ensure correct init order.
The EventBus is for decoupled inter-module communication, not boot sequencing.

## Changes

### 1. Add `app:ready` event (after all inits complete)
Location: After line 77 (GLOBE_RESTORE.init())
Emits: `app:ready` with module count

### 2. Add `app:departure` event (visibilitychange/beforeunload)
Location: Lines 276-310
Emits: `app:departure` with pledge state

### 3. Replace safeCall GAIA_BUBBLE.speak → EventBus
Lines 107, 122, 130, 135, 141: Replace safeCall with EventBus emit + safeCall fallback

### 4. Replace safeCall GAIA_ENGAGEMENT.interact → EventBus
Lines 208, 218: Replace safeCall with EventBus emit + safeCall fallback

### 5. Update contract
Add emits: ['app:ready', 'app:departure']
Add listens: []

## What stays unchanged
- Data.init() — must be awaited
- All module init() calls — order matters
- hasModule() guards — safety checks
- Panel.close() — legacy direct reference
- Scroll observer, DOM event listeners
- safeGet for pledge score (read-only, not a call)
