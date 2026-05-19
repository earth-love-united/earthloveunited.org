// Earth Love United — GAIA Chat Entry Point
// Tier 1.1: Bundled by Vite

// ═══════════════════════════════════════════
// Core Data Layer
// ═══════════════════════════════════════════
import './js/data.js';

// ═══════════════════════════════════════════
// GAIA Chat Interface
// ═══════════════════════════════════════════
import './js/gaia-legacy/gaia-data.js';
import './js/gaia-legacy/gaia-charts.js';
import './js/gaia-chat.js';

// ═══════════════════════════════════════════
// DIS Integration (loaded after gaia-chat so interceptors can wrap its functions)
// ═══════════════════════════════════════════
import './js/gaia-legacy/gaia-knowledge.js';
import './js/gaia-legacy/gaia-dom-adapter.js';
import '../dis/gaia-voice-data.js';
import '../dis/gaia-state-machine.js';
import '../dis/gaia-voice-engine.js';
import '../dis/gaia-quest-system.js';
import '../dis/gaia-key-gate.js';
import '../dis/gaia-mind.js';
import './js/gaia-legacy/gaia-integration.js';
