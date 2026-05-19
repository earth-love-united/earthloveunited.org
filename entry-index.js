// Earth Love United — Main Site Entry Point
// Tier 1.1: Bundled by Vite

// ═══════════════════════════════════════════
// Phase 0: Core Data Layer
// ═══════════════════════════════════════════
import './data.js';

// ═══════════════════════════════════════════
// Phase 1: Content Modules (load order matters)
// ═══════════════════════════════════════════
import './quiz.js';
import './cycle.js';
import './biomes.js';
import './counters.js';
import './scenario.js';
import './globe.js';

// ═══════════════════════════════════════════
// Phase 2: GAIA Foundation Layer
// ═══════════════════════════════════════════
import './gaia-legacy/gaia-data.js';
import './gaia-legacy/gaia-signals.js';
import './gaia-legacy/gaia-charts.js';
import './gaia-voice.js';

// ═══════════════════════════════════════════
// Phase 3: GAIA Intelligence Layer
// ═══════════════════════════════════════════
import '../dis/gaia-mind.js';
import './gaia-engagement.js';
import './gaia-journal.js';
import './gaia-bubble.js';
import './site-panel.js';
import './carbon-clock.js';
import './country-data.js';
import './delegation.js';
import './pledge-wall.js';

// ═══════════════════════════════════════════
// Phase 4: Globe Overlay System
// ═══════════════════════════════════════════
import './globe-overlay.js';
import './gaia-nodes.js';

// ═══════════════════════════════════════════
// Phase 5: Knowledge + Verification
// ═══════════════════════════════════════════
import './gaia-legacy/gaia-knowledge.js';
import './gaia-overlay-knowledge.js';
import './ndvi-verifier.js';
import './gaia-presence.js';
import './registry-check.js';

// ═══════════════════════════════════════════
// Phase 6: App Bootstrap (must be last)
// ═══════════════════════════════════════════
import './app.js';
