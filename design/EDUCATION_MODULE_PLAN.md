# Education Module System — Implementation Plan

## Goal
Build a standalone educational content system for earthloveunited.org that applies Brilliant's pedagogical formula to climate science learning. The system will be developed separately from the main site and integrated when complete.

## Approach
Two-phase approach:
1. **Phase 1 (this plan):** Build the Module Player as a standalone system in `/design/modules/`
2. **Phase 2 (future):** Integrate into the main site via GLOBE_OVERLAY

## Architecture

### File Structure
```
design/modules/
├── test-harness.html          ← Standalone player (works in browser, no server needed)
├── player/
│   ├── module-player.js       ← Core engine: loads JSON, renders stages, manages state
│   ├── stage-renderers.js     ← Render functions for each stage type
│   ├── module-hub.js          ← Module listing, progress tracking, navigation
│   └── module-player.css      ← All player styles (self-contained)
├── data/
│   ├── module-index.json      ← Registry of all available modules
│   └── modules/               ← Module content JSONs (already exist: 01-08)
└── lib/
    └── gauge.js               ← Canvas-based gauge/meter component
```

### The Module Player Engine

```
┌─────────────────────────────────────────────────────────────┐
│                     MODULE PLAYER                            │
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Module   │───▶│  Stage       │───▶│  Stage           │  │
│  │  Loader   │    │  Manager     │    │  Renderers       │  │
│  │           │    │              │    │                  │  │
│  │ Loads     │    │ Tracks       │    │ text → HTML      │  │
│  │ JSON +    │    │ current      │    │ timeline → slider│  │
│  │ validates │    │ stage,       │    │ quiz → choices   │  │
│  │           │    │ progress,    │    │ slider → input   │  │
│  │           │    │ score        │    │ gauge → canvas   │  │
│  │           │    │              │    │ cardstack → grid │  │
│  │           │    │              │    │ branch → paths   │  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│                                                             │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  State    │    │  Progress    │    │  GAIA            │  │
│  │  Store    │    │  Tracker     │    │  Narration       │  │
│  │           │    │              │    │                  │  │
│  │ localStorage│  │ XP, streaks, │    │ Stage-specific   │  │
│  │ per-module│    │ completion   │    │ voice lines      │  │
│  │ progress  │    │ badges       │    │ (text-only in    │  │
│  │           │    │              │    │  Phase 1)        │  │
│  └──────────┘    └──────────────┘    └──────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### Step 1: Module Index + Data Schema Validation
**File:** `design/modules/data/module-index.json`
- Create a registry of all 8 modules with metadata
- Validate all existing module JSONs against a schema
- Fix any inconsistencies in the existing data

### Step 2: Core Module Player Engine
**File:** `design/modules/player/module-player.js`
- `ModulePlayer` class/object
- Methods: `load(moduleId)`, `nextStage()`, `prevStage()`, `goTo(stageId)`
- State management: current module, current stage, score, answers
- Event system: `onStageComplete`, `onModuleComplete`, `onAnswer`
- localStorage persistence of progress

### Step 3: Stage Renderers
**File:** `design/modules/player/stage-renderers.js`
- `renderText(stage)` — Narrative screen with callouts + action buttons
- `renderTimeline(stage)` — Interactive timeline scrubber with data points
- `renderSlider(stage)` — Parameter slider(s) with live result calculation
- `renderGauge(stage)` — Canvas gauge showing value vs thresholds
- `renderQuiz(stage)` — Multiple choice with immediate feedback + explanation
- `renderCardstack(stage)` — Filterable card grid with flip interaction
- `renderBranch(stage)` — Choose-your-path with consequence preview
- `renderComparison(stage)` — Side-by-side comparison table
- `renderDiscover(stage)` — Reveal-style content with callouts

### Step 4: Module Hub
**File:** `design/modules/player/module-hub.js`
- Module listing page with cards
- Progress indicators per module (0-100%)
- Lock/unlock logic (prerequisites)
- Difficulty badges, estimated time
- "Continue where you left off" feature

### Step 5: Styling
**File:** `design/modules/player/module-player.css`
- Self-contained CSS (no dependencies on site CSS)
- Dark theme matching ELU aesthetic
- Mobile-responsive
- Smooth transitions between stages
- Progress bar, XP indicators, completion badges

### Step 6: Test Harness
**File:** `design/modules/test-harness.html`
- Standalone HTML page that loads the player
- Works with `file://` protocol (no server needed)
- Module selector dropdown
- Debug panel showing current state
- Reset progress button

### Step 7: Content Refinement
- Review all 8 module JSONs for pedagogical flow
- Ensure each module follows the 7-step arc
- Add GAIA narration text to each stage
- Add "prediction" stages where learners commit to an answer before seeing data
- Add "reveal" stages with data visualization descriptions

## Stage Type Specifications

### Text Stage
```
┌─────────────────────────────────────────────┐
│  [Stage Title]                              │
│                                             │
│  [Body text, 2-4 paragraphs max]           │
│                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ Callout │ │ Callout │ │ Callout │      │
│  │  Label  │ │  Label  │ │  Label  │      │
│  │  Value  │ │  Value  │ │  Value  │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│                                             │
│  [Primary Action Button]  [Secondary]       │
└─────────────────────────────────────────────┘
```

### Timeline Stage
```
┌─────────────────────────────────────────────┐
│  [Title]                                    │
│  [Description]                              │
│                                             │
│  ○━━━━━━━━━━━━━━━━━━━━━━━━━━━○  2026      │
│  ↑                           ↑              │
│  2000                      slider           │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  [Data point display]               │   │
│  │  Value: 431.12 ppm                  │   │
│  │  Context: "Highest in 3M years"     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Continue →]                               │
└─────────────────────────────────────────────┘
```

### Quiz Stage
```
┌─────────────────────────────────────────────┐
│  [Question]                                 │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  A) Option 1                        │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │  B) Option 2                        │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │  C) Option 3                        │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ON CORRECT:                                │
│  ✓ "Correct! [Explanation]"                │
│  ON WRONG:                                  │
│  ✗ "Not quite. [Hint]. Try again."         │
└─────────────────────────────────────────────┘
```

### Slider Stage
```
┌─────────────────────────────────────────────┐
│  [Title]                                    │
│  [Description]                              │
│                                             │
│  Parameter 1: ━━━━━━━○━━━━━━  45 GtCO₂     │
│  Parameter 2: ━━━━○━━━━━━━━  12 GtCO₂     │
│  Parameter 3: ━━━━━━━━○━━━━  8 GtCO₂      │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  RESULT: 65 GtCO₂ total             │   │
│  │  [Context: "This exceeds budget     │   │
│  │   by 2.5x"]                         │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [Continue →]                               │
└─────────────────────────────────────────────┘
```

### Cardstack Stage
```
┌─────────────────────────────────────────────┐
│  [Title]           [Filter: All ▼]         │
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 🌴       │ │ 🍳       │ │ 🪸       │   │
│  │ Project  │ │ Project  │ │ Project  │   │
│  │ Title    │ │ Title    │ │ Title    │   │
│  │ Badge    │ │ Badge    │ │ Badge    │   │
│  │ [Stats]  │ │ [Stats]  │ │ [Stats]  │   │
│  └──────────┘ └──────────┘ └──────────┘   │
│                                             │
│  ON CARD CLICK:                             │
│  ┌─────────────────────────────────────┐   │
│  │  [Full detail text]                 │   │
│  │  [Key stats highlighted]            │   │
│  │  [Close]                            │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Branch Stage
```
┌─────────────────────────────────────────────┐
│  [Title]                                    │
│  [Description]                              │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  ⏳ Intergenerational Justice       │   │
│  │  "We're borrowing Earth from        │   │
│  │   future generations"               │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │  💰 Climate Reparations             │   │
│  │  "Should wealthy nations pay?"      │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │  ⚡ Energy Justice                   │   │
│  │  "1.2B people lack electricity"     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ON SELECT: Shows consequence preview       │
│  then continues to next stage               │
└─────────────────────────────────────────────┘
```

## Data Schema (Module JSON)

```json
{
  "id": "string",
  "title": "string",
  "description": "string",
  "estimated_minutes": number,
  "difficulty": "beginner|intermediate|advanced",
  "prerequisites": ["module_id"],
  "next_module": "module_id|null",
  "theme": { "accent": "#hex", "bg": "#hex" },
  "stages": [
    {
      "id": "string",
      "type": "text|timeline|slider|gauge|quiz|cardstack|branch|comparison|discover",
      "title": "string",
      "body": "string (HTML allowed)",
      "callouts": [{"label": "string", "value": "string"}],
      "actions": [{"id": "string", "label": "string", "type": "next|jump|complete", "style": "primary|secondary"}],
      // Type-specific fields:
      // timeline: "data": [{"label", "value", "display"}]
      // quiz: "questions": [{"question", "options", "correct", "explanation", "inputType", "hint"}]
      // slider: "sliders": [{"label", "min", "max", "step", "default", "unit"}], "resultTemplate", "calculate"
      // gauge: "min", "max", "unit", "getValue", "thresholds"
      // cardstack: "filters", "cards": [{"title", "subtitle", "icon", "badge", "category", "detail", "stats"}]
      // branch: "paths": [{"label", "description", "timescale", "icon"}]
      // comparison: "comparisonData": [{"category", "col1", "col2"}]
    }
  ]
}
```

## Technical Constraints

1. **No build step** — Pure HTML/CSS/JS, works with `file://`
2. **No dependencies** — No React, no jQuery, no frameworks
3. **No import/export** — All JS in IIFE pattern (matching site convention)
4. **Self-contained CSS** — All player styles in one file, no conflicts
5. **localStorage only** — No backend, progress saved locally
6. **Mobile-first** — Touch-friendly, responsive
7. **Accessibility** — Keyboard navigable, ARIA labels

## Verification Plan

1. **Load test** — Open test-harness.html in browser, load each module
2. **Navigation test** — Forward/back through all stages in each module
3. **State persistence test** — Close browser, reopen, verify progress saved
4. **Quiz test** — Answer correctly, answer incorrectly, verify feedback
5. **Slider test** — Adjust all sliders, verify result calculation
6. **Timeline test** — Scrub through timeline, verify data display
7. **Cardstack test** — Filter cards, click for detail, close
8. **Branch test** — Select each path, verify consequence display
9. **Completion test** — Complete a full module, verify completion state
10. **Mobile test** — Test on mobile viewport (375px wide)

## Timeline

| Step | Description | Estimated |
|------|-------------|-----------|
| 1 | Module index + schema validation | 30 min |
| 2 | Core player engine | 2 hours |
| 3 | Stage renderers (all 9 types) | 3 hours |
| 4 | Module hub | 1 hour |
| 5 | Styling | 2 hours |
| 6 | Test harness | 30 min |
| 7 | Content refinement | 2 hours |
| 8 | Testing + bug fixes | 1 hour |
| **Total** | | **~12 hours** |

## Next Steps After Phase 1

Once the standalone player works:
1. Adapt player.js to work within GLOBE_OVERLAY
2. Wire GAIA narration (text → GAIA_BUBBLE.speak)
3. Connect XP tracking to GAIA_ENGAGEMENT
4. Add globe interaction (click site → open module)
5. Add module completion badges to user profile
6. Integrate with existing site navigation
