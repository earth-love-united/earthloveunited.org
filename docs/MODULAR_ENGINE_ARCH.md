# MODULAR LEARNING ENGINE — Architecture Spec
## v1.0 | May 2026

---

## Vision

Instead of hand-coding 7 separate modules, we build **one engine** that reads **declarative module definitions** and renders the full Hook → Explore → Discover → Verify → Connect lifecycle. Adding a new module becomes writing a JSON file + optional custom component.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  index.html / gaia.html                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  ModuleEngine                                    │    │
│  │  ├── ModuleRegistry (loads definitions)          │    │
│  │  ├── StageRenderer (Hook/Explore/Discover/       │    │
│  │  │         Verify/Connect)                       │    │
│  │  ├── ComponentLibrary                            │    │
│  │  │  ├── HookRenderer                             │    │
│  │  │  ├── SliderInput  ◄─── reusable               │    │
│  │  │  ├── CardStack   ◄─── reusable               │    │
│  │  │  ├── TimelineChart ◄─── reusable             │    │
│  │  │  ├── BranchGraph  ◄─── reusable              │    │
│  │  │  ├── GaugeMeter   ◄─── reusable              │    │
│  │  │  └── QuizQuestion ◄─── reusable              │    │
│  │  └── StateManager (progress, score, localStorage)│   │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  data/modules/                                          │
│  ├── 01-carbon-atom.json        ◄── module definition  │
│  ├── 02-keeling-curve.json      ◄── module definition  │
│  ├── 03-carbon-budget.json      ◄── module definition  │
│  ├── 04-restoration-projects.json ◄── module definition│
│  ├── 05-carbon-market.json      ◄── module definition  │
│  ├── 06-drawdown-solutions.json ◄── module definition  │
│  └── 07-carbon-footprint.json   ◄── module definition  │
└─────────────────────────────────────────────────────────┘
```

---

## Core Engine (`js/modules/module-engine.js`)

### ModuleEngine class
```
- init(container, moduleId)
- loadDefinition(moduleId) → Promise<ModuleDef>
- renderStage(stageIndex) → HTMLElement
- transitionTo(stageIndex)
- handleInteraction(event, stage)
- saveProgress()
- getScore()
```

### StateMachine (per module session)
```
- currentStage: 0-4 (Hook/Explore/Discover/Verify/Connect)
- interactionLog: [{timestamp, action, data}]
- score: number
- completed: boolean
- startedAt: ISO timestamp
```

### Stage Types
Each definition stage has a `type` that maps to a renderer:

| Type | Renderer | Description |
|------|----------|-------------|
| `text` | TextRenderer | Rich text with inline data bindings |
| `chart` | ChartRenderer | Canvas/D3 chart from data array |
| `slider` | SliderRenderer | Interactive range slider(s) |
| `branch` | BranchRenderer | Clickable branching paths (Module 1) |
| `cardstack` | CardStackRenderer | Scrollable/filterable card set (Module 6) |
| `gauge` | GaugeRenderer | Animated gauge/meter (Module 3 budget) |
| `quiz` | QuizRenderer | Multiple choice / input question |
| `globe` | GlobeRenderer | globe.gl integration (Module 4) |
| `timeline` | TimelineRenderer | Scrubbable timeline (Module 2) |
| `comparison` | ComparisonRenderer | Side-by-side comparison (Module 5) |
| `calculator` | CalculatorRenderer | Formula-driven calculator (Module 7) |

---

## Module Definition Schema (`data/modules/*.json`)

```json
{
  "id": "01-carbon-atom",
  "title": "The Carbon Atom's Journey",
  "description": "Follow a single carbon atom through Earth's cycle",
  "estimated_minutes": 5,
  "difficulty": "beginner",
  "prerequisites": [],
  "next_module": "02-keeling-curve",
  "data_sources": [
    "data/climate-knowledge-curated.jsonl",
    "data/geological-memory.json"
  ],
  "tags": ["carbon cycle", "deep time", "interactive"],
  "stages": [
    {
      "type": "text",
      "template": "hook",
      "title": "A Carbon Atom's Journey",
      "body": "This carbon atom was inside a dinosaur 65 million years ago...",
      "media": "animation/carbon-atom-intro.gif",
      "interaction": {
        "type": "button",
        "label": "Begin the journey →"
      }
    },
    {
      "type": "branch",
      "title": "Choose Your Path",
      "description": "Where does the carbon atom go next?",
      "paths": [
        {
          "label": "Absorbed by a tree",
          "description": "Photosynthesis pulls CO₂ into a leaf",
          "timescale": "seconds",
          "next_stage_trigger": "explore_tree"
        },
        {
          "label": "Dissolved in the ocean",
          "description": "CO₂ dissolves into surface water",
          "timescale": "centuries",
          "next_stage_trigger": "ocean_path"
        },
        ...
      ]
    },
    {
      "type": "text",
      "template": "discover",
      "title": "The Deep Time Reveal",
      "body": "The path you chose took {{timescale}}...",
      "data_bindings": {
        "timescale": "selected_path.timescale"
      }
    },
    {
      "type": "quiz",
      "title": "Test Your Knowledge",
      "questions": [
        {
          "question": "Which path takes the longest?",
          "options": ["Tree absorption", "Ocean dissolution", "Fossilization"],
          "correct": 2,
          "explanation": "Fossilization takes millions of years..."
        }
      ]
    },
    {
      "type": "text",
      "template": "connect",
      "title": "What's Next?",
      "body": "Now see how billions of these atoms change our atmosphere →",
      "cta": {
        "label": "Explore the Keeling Curve →",
        "target_module": "02-keeling-curve"
      }
    }
  ]
}
```

---

## Component Library

Each component is a self-contained class with:
- `render(config, state)` → DOM Element
- `update(data)` — re-render with new data
- `destroy()` — cleanup event listeners
- `serialize()` → save state to JSON
- `load(state)` → restore from saved state

### Components to build:

1. **TextRenderer** — Markdown/HTML rendering with data binding ({{variable}})
2. **SliderInput** — Configurable range slider with label + value display
3. **GaugeMeter** — Animated circular/linear gauge with threshold coloring
4. **BranchGraph** — SVG directed graph for branching paths (Module 1)
5. **TimelineChart** — Scrubbable timeline with data points (Module 2)
6. **CardStack** — Filterable, flippable card grid (Module 4, 6)
7. **ComparisonTable** — Side-by-side comparison (Module 5)
8. **QuizRenderer** — Multiple choice with instant feedback
9. **Calculator** — Formula engine with input fields (Module 3, 7)
10. **GlobeLayer** — globe.gl marker/arc/heatmap wrapper (Module 4)

---

## CSS System

Design token approach with module-specific overrides:

```css
:root {
  /* Global tokens */
  --elu-bg: #030305;
  --elu-text: #e2dfd8;
  --elu-accent: #4ecdc4;
  --elu-warn: #c45c4a;
  --elu-radius: 12px;
}

[data-module="01-carbon-atom"] {
  --module-accent: #7be8d0;
  --module-bg: rgba(42,143,163,0.08);
}

[data-module="03-carbon-budget"] {
  --module-accent: #f5876a;
  --module-bg: rgba(245,135,106,0.06);
}

.module-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem;
}

.stage-transition {
  animation: stageIn 0.6s cubic-bezier(0.77, 0, 0.175, 1);
}

@keyframes stageIn {
  from { opacity: 0; transform: translateX(30px); }
  to   { opacity: 1; transform: translateX(0); }
}
```

---

## Module Registry (`js/modules/registry.js`)

```javascript
const ModuleRegistry = {
  modules: new Map(),
  
  async register(id, definition) {
    // Validate definition against schema
    this.modules.set(id, definition);
  },
  
  async load(id) {
    if (!this.modules.has(id)) {
      const def = await fetch(`/data/modules/${id}.json`).then(r => r.json());
      await this.validate(def);
      this.modules.set(id, def);
    }
    return this.modules.get(id);
  },
  
  async validate(def) {
    // Check required fields, stage types, data bindings
    const required = ['id', 'title', 'stages'];
    for (const field of required) {
      if (!def[field]) throw new Error(`Missing required field: ${field}`);
    }
    const validTypes = ['text', 'chart', 'slider', 'branch', 'cardstack', 'gauge', 'quiz', 'globe', 'timeline', 'comparison', 'calculator'];
    for (const stage of def.stages) {
      if (!validTypes.includes(stage.type)) throw new Error(`Unknown stage type: ${stage.type}`);
    }
  },
  
  list() {
    return Array.from(this.modules.values());
  },
  
  getModuleIds() {
    return [...this.modules.keys()];
  }
};
```

---

## Execution Plan

### Sprint 1: Engine Core (Days 1–3)
- [ ] ModuleEngine class with init/load/render/transition lifecycle
- [ ] Stage type registry (map type → renderer function)
- [ ] Base TextRenderer component
- [ ] QuizRenderer component (universal across modules)
- [ ] Module definition JSON schema + validator
- [ ] ModuleRegistry lazy-loading system
- [ ] CSS design tokens + base `.module-container` styles

### Sprint 2: Component Library (Days 4–7)
- [ ] SliderInput component (used by Modules 3, 7)
- [ ] GaugeMeter component (used by Module 3)
- [ ] BranchGraph component (used by Module 1)
- [ ] TimelineChart component (used by Module 2)
- [ ] CardStack component (used by Modules 4, 6)
- [ ] ComparisonTable component (used by Module 5)
- [ ] Calculator component (used by Module 3, 7)

### Sprint 3: Module Definitions (Days 8–10)
- [ ] Define all 7 modules in JSON
- [ ] Wire data sources to each definition
- [ ] Add CTAs and cross-module navigation
- [ ] Validate all definitions against schema

### Sprint 4: Integration + Polish (Days 11–14)
- [ ] Render all 7 modules through the engine
- [ ] Cross-module navigation flow
- [ ] State persistence (localStorage)
- [ ] GAIA integration (DIS event dispatch on completion)
- [ ] Mobile responsiveness
- [ ] Turkish string extraction
- [ ] Performance audit

---

## Success Criteria

- Adding a new module = creating a JSON definition file (≤ 1 hour)
- All modules share consistent UX patterns
- Engine handles transitions, state, scoring, and persistence
- Components are reusable and composable
- Total code for 7 modules through engine < 50% of hand-coding each separately