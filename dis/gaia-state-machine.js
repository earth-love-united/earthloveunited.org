// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA STATE MACHINE v1.0
// Pre-LLM behavioral engine
// Runs entirely client-side. No API key needed.
// ═══════════════════════════════════════════════════════

const GaiaState = (() => {


  const STATES = {
    GREETING:'GREETING', EXPLORING:'EXPLORING', SITE_ENTRY:'SITE_ENTRY',
    DATA_REVEAL:'DATA_REVEAL', SANDBOX:'SANDBOX', IDLE:'IDLE',
    QUEST:'QUEST', KEY_TEASE:'KEY_TEASE', DEPARTURE:'DEPARTURE', POST_UNLOCK:'POST_UNLOCK'
  };

  const TIERS = [
    { name:'COLD', min:0, max:30 }, { name:'WARM', min:30, max:60 },
    { name:'ENGAGED', min:60, max:100 }, { name:'HOOKED', min:100, max:150 },
    { name:'INVESTED', min:150, max:9999 },
  ];

  const IDLE_GENTLE = 10000, IDLE_MEDIUM = 20000, IDLE_STRONG = 40000;

  const SIGNAL_WEIGHTS = {
    site_tap:10, data_reveal:5, ndvi_explore:3, climate_view:4,
    sandbox_open:5, scenario_run:15, big_scenario:10, negative_scenario:5,
    insight:8, quest_done:25, site_complete:20, all_sites:30,
    share:30, return_visit:20, time_minute:3, chat_sent:5, chat_received:2,
    api_key:50, profile:15, prediction:7, correct_prediction:12, idle_penalty:-2,
  };

  let _state = STATES.GREETING, _mood = 'curious', _moodIntensity = 3;
  let _score = 0, _velocity = 0, _idleSince = null;
  let _lastInteraction = Date.now(), _lastGaiaUtterance = 0;
  let _lastNudgeLevel = null, _usedLines = {}, _sessionLines = [];
  let _siteAffinity = {}, _currentSite = null, _stateEnteredAt = Date.now();
  let _gaiaUtteranceCount = 0, _tickInterval = null;
  let _scoreHistory = [], _ndviContext = {}, _revealDepth = {};
  let _lastKeyTeaseTier = null, _lastTier = 'COLD';
  let _contextFlags = {};

  let _callbacks = {
    onSpeak: (t, e) => console.log('[GAIA]', t),
    onReact: () => {}, onStateChange: () => {}, onMoodChange: () => {},
    onQuestTrigger: () => {}, onJournalAdd: () => {},
    onOverlayShow: () => {}, onOverlayHide: () => {}, onGlobeFly: () => {},
    onVoiceModifiers: () => {},
  };

  let _voiceLibrary = {};

  // ─── SCORING ───
  function addScore(signal, ctx = {}) {
    const w = SIGNAL_WEIGHTS[signal] || 0;
    if (w === 0) return;
    _score += w;
    _scoreHistory.push({ score: _score, timestamp: Date.now() });
    const cutoff = Date.now() - 60000;
    _scoreHistory = _scoreHistory.filter(h => h.timestamp > cutoff);
    if (_scoreHistory.length >= 2) {
      const dt = (_scoreHistory[_scoreHistory.length-1].timestamp - _scoreHistory[0].timestamp) / 1000;
      _velocity = dt > 0 ? (_scoreHistory[_scoreHistory.length-1].score - _scoreHistory[0].score) / dt : 0;
    }
    _checkTierTransition();
  }

  function getScore() { return { score:_score, tier:getTier(), velocity:_velocity, idleSeconds:_idleSince?(Date.now()-_idleSince)/1000:0 }; }
  function getTier() { for (const t of TIERS) if (_score >= t.min && _score < t.max) return t.name; return 'COMMITTED'; }

  // ─── STATE ───
  async function transition(newState, ctx = {}) {
    if (newState === _state) return;
    const old = _state; _state = newState; _stateEnteredAt = Date.now();
    _callbacks.onStateChange(old, newState);
    _resetContextFlags();
    switch (newState) {
      case STATES.GREETING: _handleGreeting(); break;
      case STATES.SITE_ENTRY: _handleSiteEntry(ctx); break;
      case STATES.DATA_REVEAL: _handleDataReveal(ctx); break;
      case STATES.SANDBOX: _handleSandbox(ctx); break;
      case STATES.QUEST: _handleQuest(ctx); break;
      case STATES.KEY_TEASE: _handleKeyTease(); break;
      case STATES.DEPARTURE: _handleDeparture(); break;
      case STATES.POST_UNLOCK: _handlePostUnlock(); break;
    }
    await _persistState();

    // Emit state-change event via EventBus
    if (typeof window !== 'undefined' && window.EventBus) {
      window.EventBus.emit('state:change', { from: old, to: newState, ctx });
    }
  }

  function _handleGreeting() { _pickAndSpeak('GREETING', null); }
  function _handleSiteEntry(ctx) {
    if (ctx.siteId) {
      _currentSite = ctx.siteId;
      _siteAffinity[ctx.siteId] = _siteAffinity[ctx.siteId] || { visited:false, layers:0, scenarios:0, time:0 };
      _siteAffinity[ctx.siteId].visited = true;
    }
    _pickAndSpeak('ENTRY', ctx.siteId);
  }
  function _handleDataReveal(ctx) {
    if (ctx.siteId && _siteAffinity[ctx.siteId]) {
      _siteAffinity[ctx.siteId].layers += 1;
      _revealDepth[ctx.siteId] = (_revealDepth[ctx.siteId] || 0) + 1;
    }
    let pool = 'DATA_' + (ctx.layer ? ctx.layer.toUpperCase() : 'GENERAL');
    if (ctx.layer === 'ndvi' && ctx.siteId && _ndviContext[ctx.siteId]) {
      const trend = _ndviContext[ctx.siteId].trend;
      pool = 'DATA_NDVI_' + ctx.siteId.toUpperCase() + '_' + trend.toUpperCase();
    }
    if (ctx.layer === 'carbon' && ctx.siteId) pool = 'DATA_CARBON_' + ctx.siteId.toUpperCase();
    _pickAndSpeak(pool, ctx.siteId) || _pickAndSpeak('DATA_GENERAL', ctx.siteId);
  }
  function _handleSandbox(ctx) { _pickAndSpeak('SANDBOX', ctx.siteId); }
  function _handleQuest(ctx) { _pickAndSpeak('QUEST', null); _callbacks.onQuestTrigger(ctx.questId, 'completed'); }
  function _handleKeyTease() { _pickAndSpeak('KEY_HINT', null); }
  function _handleDeparture() { _pickAndSpeak('DEPARTURE', null); }
  function _handlePostUnlock() { _pickAndSpeak('KEY_UNLOCKED', null); }

  // ─── LINE SELECTION ───
  function _pickAndSpeak(pool, siteId) {
    if (typeof GaiaMind !== 'undefined') {
      const ctx = { siteId, currentSite:_currentSite, engagementScore:_score, idleSeconds:_idleSince?(Date.now()-_idleSince)/1000:0, usedLines:_usedLines, ..._contextFlags };
      const result = GaiaMind.selectLine(pool, ctx, _voiceLibrary);
      if (result.silence) return null;
      if (result.line) {
        _usedLines[result.line.id] = Date.now();
        _sessionLines.push(result.line.id);
        if (result.voiceModifiers) _callbacks.onVoiceModifiers(result.voiceModifiers);
        _speak(result.line.text, result.emotion || _mood);
        return result.line.text;
      }
    }
    // Fallback: simple random from pool
    const lines = (_voiceLibrary[pool] || []).filter(l => !l.site || !siteId || l.site === siteId);
    if (!lines.length) return null;
    const line = lines[Math.floor(Math.random() * lines.length)];
    _speak(line.text, line.tone || _mood);
    return line.text;
  }

  function _speak(text, emotion) {
    _lastGaiaUtterance = Date.now();
    _gaiaUtteranceCount++;
    _callbacks.onSpeak(text, emotion || _mood);
    addScore('chat_received');
  }

  // ─── EVENTS ───
  async function handleEvent(eventType, payload = {}) {
    _lastInteraction = Date.now();
    _idleSince = null; _lastNudgeLevel = null;
    _resetContextFlags();
    switch (eventType) {
      case 'session_start': await transition(STATES.GREETING); break;
      case 'site_entered': addScore('site_tap', payload); await transition(STATES.SITE_ENTRY, payload); break;
      case 'data_revealed': addScore('data_reveal', payload); _setContextFlag('layer', payload.layer); await transition(STATES.DATA_REVEAL, payload); break;
      case 'ndvi_scrolled': addScore('ndvi_explore', payload); _updateNdviContext(payload); break;
      case 'sandbox_opened': addScore('sandbox_open', payload); await transition(STATES.SANDBOX, payload); break;
      case 'scenario_run':
        addScore('scenario_run', payload);
        if (Math.abs(payload.result?.cumulative_co2 || 0) > 1000000) addScore('big_scenario', payload);
        if ((payload.result?.cumulative_co2 || 0) < 0) addScore('negative_scenario', payload);
        else _setContextFlag('justRanPositiveScenario', true);
        _handleScenarioResult(payload);
        _resetContextFlags();
        break;
      case 'quest_completed': addScore('quest_done', payload); _setContextFlag('justCompletedQuest', true); await transition(STATES.QUEST, payload); _resetContextFlags(); break;
      case 'share_action': addScore('share', payload); break;
      case 'api_key_entered': addScore('api_key', payload); await transition(STATES.POST_UNLOCK, payload); break;
      case 'return_visit': addScore('return_visit', payload); break;
      case 'session_end': await transition(STATES.DEPARTURE); await _persistState(); break;
    }
    await _checkKeyTease();
  }

  function _handleScenarioResult(payload) {
    const r = payload.result;
    if (!r) return;
    const pool = r.cumulative_co2 > 0 ? 'RESULT_POS' : 'RESULT_NEG';
    _pickAndSpeak(pool, payload.siteId);
  }

  function _updateNdviContext(payload) {
    const { siteId, year, value } = payload;
    if (!siteId || value === undefined) return;
    const prev = _ndviContext[siteId];
    _ndviContext[siteId] = {
      lastYear: year, lastValue: value,
      trend: prev ? (value > prev.lastValue ? 'up' : value < prev.lastValue ? 'down' : 'stable') : 'stable',
      delta: prev ? value - prev.lastValue : 0,
      scrollCount: (prev?.scrollCount || 0) + 1
    };
  }

  // ─── IDLE ───
  // Disabled: GAIA speaks when spoken to, not on idle timers.
  // The tick loop still runs for state persistence but no longer fires speech.
  function _checkIdle() {
    // No-op: idle nudges disabled
  }

  // ─── KEY TEASE ───
  async function _checkKeyTease() {
    const tier = getTier();
    if (tier !== _lastKeyTeaseTier) {
      _lastKeyTeaseTier = tier;
      if (tier === 'WARM' || tier === 'ENGAGED' || tier === 'HOOKED' || tier === 'INVESTED') {
        if (_state === STATES.EXPLORING || _state === STATES.IDLE) {
          _setContextFlag('shouldTeaseKey', true);
          await transition(STATES.KEY_TEASE);
          _resetContextFlags();
        }
      }
    }
  }

  function _checkTierTransition() {
    const tier = getTier();
    if (tier !== _lastTier) _lastTier = tier;
  }

  function _setContextFlag(flag, value = true) { _contextFlags[flag] = value; }
  function _resetContextFlags() { Object.keys(_contextFlags).forEach(k => _contextFlags[k] = false); }

  // ─── TICK ───
  function start() {
    if (_tickInterval) return;
    _tickInterval = setInterval(() => {
      if (Date.now() - _lastInteraction > IDLE_GENTLE) {
        if (_idleSince === null) _idleSince = Date.now();
        _checkIdle();
      }
    }, 1000);
  }

  function stop() { if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; } }

  // ─── PERSISTENCE ───
  async function _persistState() {
    const data = { score:_score, mood:_mood, moodIntensity:_moodIntensity, siteAffinity:_siteAffinity, usedLines:_usedLines, lastVisit:new Date().toISOString() };
    try { await Storage.safeSetItem('gaia_state', JSON.stringify(data)); } catch (e) {}
  }

  async function restoreState() {
    try {
      const raw = await Storage.safeGetItem('gaia_state');
      if (!raw) return {};
      const saved = JSON.parse(raw);
      if (saved) {
        _score = saved.score || 0; _mood = saved.mood || 'curious';
        _moodIntensity = saved.moodIntensity || 3;
        _siteAffinity = saved.siteAffinity || {}; _usedLines = saved.usedLines || {};
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ─── PUBLIC API ───
  return {
    start, stop, handleEvent, addScore, getScore, getTier, transition,
    getState: () => ({ state:_state, mood:_mood, moodIntensity:_moodIntensity, currentSite:_currentSite }),
    registerCallbacks: (cb) => Object.assign(_callbacks, cb),
    setVoiceLibrary: (lib) => { _voiceLibrary = lib; },
    restoreState, _persistState,
    STATES, MOODS: ['curious','excited','concerned','proud','mysterious','urgent','warm','fierce','playful','nurturing','disappointed'],

    init() {
      console.debug('[Stub] GaiaState.init');
      return true;
    },

    getState() {
      return { state:_state, mood:_mood, moodIntensity:_moodIntensity, currentSite:_currentSite };
    },

    setState(newState) {
      _state = newState;
    },

    getMood() {
      return _mood;
    },

    setMood(mood) {
      _mood = mood;
    },

    registerCallbacks(cb) {
      Object.assign(_callbacks, cb);
    },

    process(input) {
      console.debug('[Stub] GaiaState.process');
      return input;
    },

    // ── Standard Module Lifecycle (SML) ──
    init() {
      console.debug('[SML] GaiaState.init');

      // Listen for mind mood changes via EventBus
      if (typeof window !== 'undefined' && window.EventBus) {
        this._unsubMood = window.EventBus.on('mind:mood-change', (data) => {
          // Adjust state machine mood to match the mind's emotional state
          if (data.to && data.to !== _mood) {
            _mood = data.to;
            _moodIntensity = Math.min(10, _moodIntensity + 1);
          }
        });
      }

      return true;
    },

    reset() {
      console.debug('[SML] GaiaState.reset');
      _state = 'idle';
      _mood = 'curious';
      _moodIntensity = 3;
      _currentSite = null;
      return true;
    },

    destroy() {
      console.debug('[SML] GaiaState.destroy');

      // Unsubscribe from EventBus
      if (this._unsubMood) {
        this._unsubMood();
        this._unsubMood = null;
      }

      // Clear tick interval
      if (_tickInterval) {
        clearInterval(_tickInterval);
        _tickInterval = null;
      }

      // Nullify callbacks (prevents zombie event handlers)
      _callbacks = {};

      // Reset state
      _state = 'idle';
      _mood = 'curious';
      _moodIntensity = 3;
      _currentSite = null;

      return true;
    },
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaState;
if (typeof window !== 'undefined') window.GaiaState = GaiaState;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GaiaState', {
    provides: ['init', 'getState', 'setState', 'getMood', 'setMood', 'registerCallbacks', 'process', 'reset', 'destroy'],
    requires: [],
    emits: ['state:change'],
    listens: ['mind:mood-change'],
  });
}
