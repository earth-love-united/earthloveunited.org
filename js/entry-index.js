// Earth Love United — Main Site Entry Point
// Tier 1.1: Bundled by Vite

// ═══════════════════════════════════════════
// Phase 0: Core Data Layer
// ═══════════════════════════════════════════
import './js/data.js';

// ═══════════════════════════════════════════
// Phase 1: Content Modules (load order matters)
// ═══════════════════════════════════════════
import './js/quiz.js';
import './js/cycle.js';
import './js/biomes.js';
import './js/counters.js';
import './js/scenario.js';
import './js/globe.js';

// ═══════════════════════════════════════════
// Phase 2: GAIA Foundation Layer
// ═══════════════════════════════════════════
import './js/gaia-legacy/gaia-data.js';
import './js/gaia-legacy/gaia-signals.js';
import './js/gaia-legacy/gaia-charts.js';
import './js/gaia-voice.js';

// ═══════════════════════════════════════════
// Phase 3: GAIA Intelligence Layer
// ═══════════════════════════════════════════
import '../dis/gaia-mind.js';
import './js/gaia-engagement.js';
import './js/gaia-journal.js';
import './js/gaia-bubble.js';
import './js/site-panel.js';
import './js/carbon-clock.js';
import './js/country-data.js';
import './js/delegation.js';
import './js/pledge-wall.js';

// ═══════════════════════════════════════════
// Phase 4: Globe Overlay System
// ═══════════════════════════════════════════
import './js/globe-overlay.js';
import './js/gaia-nodes.js';

// ═══════════════════════════════════════════
// Phase 5: Knowledge + Verification
// ═══════════════════════════════════════════
import './js/gaia-legacy/gaia-knowledge.js';
import './js/gaia-overlay-knowledge.js';
import './js/ndvi-verifier.js';
import './js/gaia-presence.js';
import './js/registry-check.js';

// ═══════════════════════════════════════════
// Phase 6: App Bootstrap (must be last)
// ═══════════════════════════════════════════
import './js/app.js';
