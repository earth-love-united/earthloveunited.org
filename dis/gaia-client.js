// ═══════════════════════════════════════════════════════
// GAIA CLIENT ARCHITECTURE v1.0
// The bridge between the browser and the isolate
// Orchestrates: globe, state machine, voice, quests, key gate, LLM
// ═══════════════════════════════════════════════════════

window.GaiaClient = (() => {
  try {
  const CONFIG = {
    WS_URL: null,                    // WebSocket for real-time (derived from page URL)
    TICK_RATE: 1000,                // State machine tick rate (ms)
    GAIA_SPEAK_DELAY: 500,          // Delay before GAIA speaks after event (ms)
    AUTO_SAVE_INTERVAL: 30000,      // Auto-save state every 30s
    DEBUG: false
  };

  // ─── STATE ───
  let _initialized = false;
  let _unlocked = false;            // Has API key, using LLM
  let _ws = null;                   // WebSocket connection to isolate
  let _pendingTools = [];           // Tool calls waiting for LLM response
  let _eventBuffer = [];            // Buffered events for analytics

  // ═══════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════

  async function init() {
    if (_initialized) return;
    log('[GaiaClient] Initializing...');

    // 1. Restore persisted state
    GaiaKeyGate.init();
    GaiaQuests.init();
    GaiaState.restoreState();

    // 1b. Load voice library into state machine
    // GaiaVoiceLibrary is the data module; pass it to the state machine
    // so _pickLine() can find lines by pool name.
    if (typeof GaiaVoiceLibrary !== 'undefined') {
      GaiaState.setVoiceLibrary(GaiaVoiceLibrary);
      log('[GaiaClient] Voice library loaded:', VoiceLibraryMeta.totalLines, 'lines across', VoiceLibraryMeta.totalPools, 'pools');
    } else {
      console.warn('[GaiaClient] GaiaVoiceLibrary not found — gaia-voice-data.js must be loaded before gaia-client.js');
    }

    // 2. Check if API key exists
    _unlocked = GaiaKeyGate.hasKey();
    log('[GaiaClient] API key present:', _unlocked);

    // 3. Initialize voice engine
    GaiaVoice.init();
    GaiaVoice.setCallback('onStart', (text) => {
      GaiaState.handleEvent('gaia_speaking', { text });
    });
    GaiaVoice.setCallback('onEnd', (text) => {
      GaiaState.handleEvent('gaia_finished', { text });
    });

    // 3b. Initialize GAIA's inner world
    // GaiaMind is the consciousness layer — it persists across sessions
    // and drives emotional state, desires, participant modeling, and silence.
    if (typeof GaiaMind !== 'undefined') {
      const mindRestored = GaiaState.restoreState(); // This now also restores GaiaMind
      log('[GaiaClient] GAIA mind restored:', mindRestored);
    } else {
      console.warn('[GaiaClient] GaiaMind not found — gaia-mind.js must be loaded before gaia-client.js');
    }

    // 4. Register state machine callbacks
    GaiaState.registerCallbacks({
      onSpeak:      _onGaiaSpeak,
      onReact:      _onGaiaReact,
      onStateChange: _onStateChange,
      onMoodChange:  _onMoodChange,
      onQuestTrigger: _onQuestTrigger,
      onJournalAdd:   _onJournalAdd,
      onOverlayShow:  _onOverlayShow,
      onOverlayHide:  _onOverlayHide,
      onGlobeFly:     _onGlobeFly,
      onVoiceModifiers: _onVoiceModifiers,  // NEW: GAIA's voice changes with her inner state
    });

    // 5. Register key gate callbacks
    GaiaKeyGate.registerCallbacks({
      onKeyEntered:    _onKeyEntered,
      onKeyValidated:  _onKeyValidated,
      onTeaseEscalate: _onTeaseEscalate,
      onPreviewShow:   _onPreviewShow,
      onModalOpen:     _openKeyModal,
      onModalClose:    _closeKeyModal
    });

    // 6. Register quest event listener
    GaiaQuests.onQuestEvent(_onQuestEvent);

    // 7. Connect to isolate (WebSocket)
    _connectToIsolate();

    // 8. Start state machine
    GaiaState.start();

    // 9. Bind global event listeners
    _bindGlobalEvents();

    // 10. Emit session start
    const isReturn = GaiaState.getState().sessionCount > 0;
    GaiaState.handleEvent('session_start');
    if (isReturn) {
      GaiaState.handleEvent('return_visit');
    }

    // 11. Start auto-save
    setInterval(_autoSave, CONFIG.AUTO_SAVE_INTERVAL);

    _initialized = true;
    log('[GaiaClient] Initialized. Mode:', _unlocked ? 'FULL GAIA' : 'STATE MACHINE');
  }

  // ═══════════════════════════════════════
  // ISOLATE CONNECTION (WebSocket)
  // ═══════════════════════════════════════

  function _connectToIsolate() {
    if (!_unlocked) {
      log('[GaiaClient] No API key — running in state machine mode');
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/gaia`;

    try {
      _ws = new WebSocket(wsUrl);

      _ws.onopen = () => {
        log('[GaiaClient] Connected to isolate');
        // Send initial context to LLM
        _sendToIsolate({
          type: 'init',
          payload: {
            participantState: GaiaState.getState(),
            engagement: GaiaState.getScore(),
            mood: GaiaState.getMood(),
            quests: GaiaQuests.getActiveQuests(),
            apiKey: GaiaKeyGate.getStoredKey()
          }
        });
      };

      _ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        _handleIsolateMessage(msg);
      };

      _ws.onclose = () => {
        log('[GaiaClient] Isolate disconnected');
        _ws = null;
        // Fall back to state machine
        _unlocked = false;
      };

      _ws.onerror = (err) => {
        console.error('[GaiaClient] WebSocket error:', err);
        _ws = null;
        _unlocked = false;
      };
    } catch (e) {
      console.warn('[GaiaClient] WebSocket failed, using state machine:', e);
      _unlocked = false;
    }
  }

  function _sendToIsolate(msg) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify(msg));
    }
  }

  function _handleIsolateMessage(msg) {
    switch (msg.type) {
      case 'speak':
        _onGaiaSpeak(msg.text, msg.emotion);
        break;

      case 'tool_call':
        _executeToolCall(msg.tool, msg.args, msg.callId);
        break;

      case 'react':
        _onGaiaReact(msg.emotion, msg.intensity);
        break;

      case 'multi':
        // Batch of actions from LLM
        for (const action of msg.actions) {
          _handleIsolateMessage(action);
        }
        break;

      default:
        log('[GaiaClient] Unknown isolate message:', msg.type);
    }
  }

  // ═══════════════════════════════════════
  // TOOL EXECUTION
  // ═══════════════════════════════════════

  async function _executeToolCall(toolName, args, callId) {
    log('[GaiaClient] Tool call:', toolName, args);
    let result;

    try {
      switch (toolName) {
        case 'read_participant_state':
          result = {
            ...GaiaState.getState(),
            ...GaiaState.getScore(),
            ...GaiaQuests.getStats(),
            apiKeyEntered: GaiaKeyGate.hasKey()
          };
          break;

        case 'read_engagement_counters':
          result = GaiaState.getScore();
          break;

        case 'fly_globe_to':
          _onGlobeFly(args.lat, args.lng, args.altitude || 1.5);
          result = { success: true };
          break;

        case 'show_overlay':
          _onOverlayShow(args.type, args.data);
          result = { success: true, overlayId: 'overlay_' + Date.now() };
          break;

        case 'hide_overlay':
          _onOverlayHide();
          result = { success: true };
          break;

        case 'reveal_data_layer':
          _onDataReveal(args.site_id, args.layer);
          result = { success: true };
          break;

        case 'prompt_user':
          result = await _onPromptUser(args);
          break;

        case 'calculate_carbon':
          result = _calcCarbon(args.from_biome, args.to_biome, args.hectares, args.years);
          break;

        case 'update_journal':
          _onJournalAdd(args.entry);
          result = { success: true };
          break;

        case 'set_quest':
          GaiaQuests.updateProgress(args.quest_id, 'manual', { status: args.status });
          result = { success: true };
          break;

        case 'speak':
          _onGaiaSpeak(args.text, args.emotion);
          result = { success: true };
          break;

        case 'react':
          _onGaiaReact(args.emotion, args.intensity);
          result = { success: true };
          break;

        case 'wait_for_event':
          result = await _waitForEvent(args.event_type, args.timeout_seconds);
          break;

        case 'get_site_data':
          result = _getSiteData(args.site_id, args.fields);
          break;

        case 'get_biome_data':
          result = _getBiomeData(args.biome_id);
          break;

        case 'list_quests':
          result = GaiaQuests.getAvailableQuests();
          break;

        case 'share_prompt':
          _onSharePrompt(args);
          result = { success: true };
          break;

        case 'get_global_stats':
          result = _getGlobalStats();
          break;

        default:
          result = { error: 'Unknown tool: ' + toolName };
      }
    } catch (e) {
      result = { error: e.message };
    }

    // Send result back to isolate
    _sendToIsolate({
      type: 'tool_result',
      callId,
      result
    });
  }

  // ═══════════════════════════════════════
  // CALLBACK HANDLERS
  // ═══════════════════════════════════════

  function _onGaiaSpeak(text, emotion) {
    // Display in chat UI
    _renderGaiaMessage(text, emotion);

    // Apply voice modifiers before speaking (pauseBefore, rate, pitch, volume)
    _applyVoiceBeforeSpeak(text, emotion).then(resolvedText => {
      // Speak via TTS — voice is already modified by _onVoiceModifiers
      GaiaVoice.speak(resolvedText, { emotion });
    });

    // Track
    _eventBuffer.push({ type: 'gaia_speak', text, emotion, timestamp: Date.now() });
  }

  function _onGaiaReact(emotion, intensity) {
    const avatar = document.getElementById('gaia-avatar');
    if (avatar) {
      avatar.setAttribute('data-emotion', emotion);
      avatar.setAttribute('data-intensity', intensity);
    }
  }

  function _onStateChange(oldState, newState) {
    log('[GaiaClient] State:', oldState, '->', newState);
    _eventBuffer.push({ type: 'state_change', from: oldState, to: newState, timestamp: Date.now() });

    // Forward to isolate if connected
    if (_unlocked) {
      _sendToIsolate({
        type: 'state_change',
        payload: { from: oldState, to: newState, state: GaiaState.getState() }
      });
    }
  }

  function _onMoodChange(oldMood, newMood) {
    log('[GaiaClient] Mood:', oldMood, '->', newMood);
  }

  function _onQuestTrigger(questId, status) {
    const result = GaiaQuests.updateProgress(questId, 'trigger', { status });
    if (result.isComplete) {
      const quest = GaiaQuests.getQuest(questId);
      if (quest) {
        _onGaiaSpeak(quest.gaia_on_complete, quest.rewards.gaia_reaction);
        _onJournalAdd(quest.rewards.insight);
      }
    }
  }

  function _onJournalAdd(text) {
    const journal = document.getElementById('gaia-journal');
    if (journal) {
      const entry = document.createElement('div');
      entry.className = 'journal-entry';
      entry.textContent = text;
      journal.prepend(entry);
    }
    _eventBuffer.push({ type: 'journal_add', text, timestamp: Date.now() });
  }

  function _onOverlayShow(type, data) {
    const overlay = document.getElementById('gaia-overlay');
    if (overlay) {
      overlay.setAttribute('data-type', type);
      overlay.classList.add('open');
      // Render overlay content based on type
      _renderOverlay(type, data);
    }
  }

  // ═══════════════════════════════════════
  // VOICE MODIFIERS — GAIA's voice changes with her inner state
  // ═══════════════════════════════════════

  let _activeVoiceModifiers = null;

  function _onVoiceModifiers(modifiers) {
    _activeVoiceModifiers = modifiers;
    // Apply to the TTS engine immediately
    if (modifiers.rate) GaiaVoice.setRate(0.85 + modifiers.rate);  // base 0.85 + adjustment
    if (modifiers.pitch) GaiaVoice.setPitch(0.88 + modifiers.pitch); // base 0.88 + adjustment
    if (modifiers.volume) GaiaVoice.setVolume(1.0 + modifiers.volume); // base 1.0 + adjustment
  }

  function _applyVoiceBeforeSpeak(text, emotion) {
    // If we have active voice modifiers, apply the pauseBefore
    if (_activeVoiceModifiers?.pauseBefore > 0) {
      return new Promise(resolve => {
        setTimeout(() => resolve(text), _activeVoiceModifiers.pauseBefore);
      });
    }
    return Promise.resolve(text);
  }

  function _resetVoiceAfterSpeak() {
    // Gradually return to base voice (don't snap back instantly)
    if (_activeVoiceModifiers) {
      GaiaVoice.setRate(0.85);
      GaiaVoice.setPitch(0.88);
      GaiaVoice.setVolume(1.0);
      _activeVoiceModifiers = null;
    }
  }

  function _onOverlayHide() {
    const overlay = document.getElementById('gaia-overlay');
    if (overlay) {
      overlay.classList.remove('open');
    }
  }

  function _onGlobeFly(lat, lng, altitude) {
    if (window.world) {
      window.world.pointOfView({ lat, lng, lng: lng, altitude: altitude }, 1000);
    }
  }

  function _onDataReveal(siteId, layer) {
    // Trigger data layer reveal on the globe
    const event = new CustomEvent('gaia:reveal-layer', {
      detail: { siteId, layer }
    });
    document.dispatchEvent(event);
  }

  async function _onPromptUser(args) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('gaia-overlay');
      if (!overlay) {
        resolve({ answered: false, error: 'No overlay container' });
        return;
      }

      // Render prompt
      _renderPrompt(args, (response) => {
        resolve(response);
      });
    });
  }

  function _onKeyEntered(hash) {
    _unlocked = true;
    log('[GaiaClient] API key entered. Unlocking full GAIA...');

    // Record this significant moment in GAIA's memory
    if (typeof GaiaMind !== 'undefined') {
      GaiaMind.recordSignificantMoment({
        text: 'Participant unlocked full GAIA with their key.',
        emotion: 'proud',
        siteId: null,
      });
      GaiaMind.addEmotionalEvent('proud', 3, 'Key entered', null);
    }

    // Show unlock response
    const unlock = GaiaKeyGate.getUnlockResponse();
    _onGaiaSpeak(unlock.gaiaLine, unlock.emotion);

    // Connect to isolate
    setTimeout(() => {
      _connectToIsolate();
      setTimeout(() => {
        _onGaiaSpeak(unlock.followUp, unlock.followUpEmotion);
      }, 2000);
    }, 1000);
  }

  function _onKeyValidated(valid) {
    if (!valid) {
      _onGaiaSpeak("That key didn't work. Check it and try again.", 'concerned');
    }
  }

  function _onTeaseEscalate(level) {
    const config = GaiaKeyGate.getTeaseConfig(level);
    // Update UI to show key button if visible
    const keyBtn = document.getElementById('gaia-key-btn');
    if (keyBtn) {
      keyBtn.classList.toggle('visible', config.visible);
      if (config.buttonText) keyBtn.textContent = config.buttonText;
    }
  }

  function _onPreviewShow() {
    const sequence = GaiaKeyGate.getPreviewSequence();
    const insight = GaiaKeyGate.getPreviewInsight();

    // Play each beat only after the previous one's TTS has finished.
    // No fixed estimates — we wait for the actual onEnd callback.
    let currentIndex = 0;

    function playNext() {
      if (currentIndex >= sequence.length) {
        // Sequence complete — add the insight
        setTimeout(() => _onJournalAdd(insight), 1000);
        return;
      }

      const beat = sequence[currentIndex];
      currentIndex++;

      _onGaiaSpeak(beat.text, beat.emotion);

      // Set up a one-time listener for TTS end, then wait the pause
      const originalOnEnd = GaiaVoice._callbacks?.onEnd;
      GaiaVoice.setCallback('onEnd', (text) => {
        // Restore original callback
        if (originalOnEnd) GaiaVoice.setCallback('onEnd', originalOnEnd);

        // Wait the specified pause, then play next beat
        if (beat.pauseAfter > 0) {
          setTimeout(playNext, beat.pauseAfter);
        } else {
          playNext();
        }
      });
    }

    playNext();
  }

  function _onQuestEvent(event) {
    if (event.type === 'quest_complete') {
      _onGaiaSpeak(event.gaiaLine, event.gaiaEmotion);
      _onJournalAdd(event.insight);
    }
  }

  function _onSharePrompt(args) {
    // Show share UI
    const overlay = document.getElementById('gaia-overlay');
    if (overlay) {
      _renderSharePrompt(args);
    }
  }

  // ═══════════════════════════════════════
  // GLOBAL EVENT BINDING
  // ═══════════════════════════════════════

  function _bindGlobalEvents() {
    // Any user interaction resets idle
    const interactionEvents = ['click', 'touchstart', 'scroll', 'keydown', 'mousemove'];
    interactionEvents.forEach(evt => {
      document.addEventListener(evt, () => {
        GaiaState.handleEvent('interaction', { type: evt });
      }, { passive: true });
    });

    // Page visibility
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        GaiaState.handleEvent('page_hidden');
      } else {
        GaiaState.handleEvent('page_visible');
      }
    });

    // Before unload
    window.addEventListener('beforeunload', () => {
      GaiaState.handleEvent('session_end');
      _flushEvents();
    });

    // Custom events from globe
    document.addEventListener('gaia:site-tap', (e) => {
      GaiaState.handleEvent('site_entered', { siteId: e.detail.siteId });
    });

    document.addEventListener('gaia:data-reveal', (e) => {
      GaiaState.handleEvent('data_revealed', {
        siteId: e.detail.siteId,
        layerType: e.detail.layer
      });
    });

    document.addEventListener('gaia:scenario-run', (e) => {
      GaiaState.handleEvent('scenario_run', {
        siteId: e.detail.siteId,
        from: e.detail.fromBiome,
        to: e.detail.toBiome,
        hectares: e.detail.hectares,
        result: e.detail.result
      });
    });

    // Sandbox panel opened
    document.addEventListener('gaia:sandbox-open', (e) => {
      GaiaState.handleEvent('sandbox_opened', {
        siteId: GaiaState.getState().currentSite
      });
    });

    // Chat message sent — generate GAIA response in state machine mode
    document.addEventListener('gaia:chat-sent', (e) => {
      const text = e.detail.message;
      if (!text) return;
      // Track in state machine
      GaiaState.handleEvent('chat_sent', { message: text });
      // If NOT unlocked (state machine mode), GAIA responds with a voice line
      if (!_unlocked) {
        _generateStateMachineChatResponse(text);
      }
      // If unlocked, the WebSocket/LLM handles the response
    });

    // Chat input — use gaia.html's #chat-input (aliased via adapter)
    const chatInput = document.getElementById('chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const text = chatInput.value.trim();
          if (text) {
            _handleUserMessage(text);
            chatInput.value = '';
          }
        }
      });
    }

    // Key button
    const keyBtn = document.getElementById('gaia-key-btn');
    if (keyBtn) {
      keyBtn.addEventListener('click', () => {
        GaiaKeyGate.openModal();
      });
    }
  }

  // ═══════════════════════════════════════
  // USER MESSAGE HANDLING
  // ═══════════════════════════════════════

  function _handleUserMessage(text) {
    // Display user message
    _renderUserMessage(text);

    // Track
    GaiaState.handleEvent('chat_sent', { message: text });

    // Check for quest triggers (skeptic quest)
    GaiaQuests.checkAllQuests('chat_sent', { message: text });

    // Forward to LLM if unlocked
    if (_unlocked && _ws) {
      _sendToIsolate({
        type: 'user_message',
        payload: { text }
      });
    } else {
      // State machine mode: GAIA responds with pre-scripted lines
      _generateStateMachineChatResponse(text);
    }
  }

  // ═══════════════════════════════════════
  // STATE MACHINE CHAT RESPONSES
  // When no API key is present, GAIA responds to chat messages
  // with pre-scripted lines from the voice library.
  // This makes GAIA feel alive even without LLM.
  // ═══════════════════════════════════════

  function _generateStateMachineChatResponse(userText) {
    const lowerText = userText.toLowerCase();
    const state = GaiaState.getState();
    const score = GaiaState.getScore();

    // Determine which pool to pick from based on message content
    let pool = null;
    let siteId = state.currentSite;

    // Site-specific queries
    if (/sri lanka/.test(lowerText)) {
      siteId = 'sri_lanka';
      pool = 'ENTRY';
    } else if (/antalya|cop31|wildfire|turkey/.test(lowerText)) {
      siteId = 'antalya';
      pool = 'ENTRY';
    } else if (/benin|jean|mangrove.*benin/.test(lowerText)) {
      siteId = 'benin';
      pool = 'ENTRY';
    } else if (/borneo|peat|palm/.test(lowerText)) {
      siteId = 'borneo';
      pool = 'ENTRY';
    }
    // Topic-based queries
    else if (/carbon cycle|how.*carbon.*work|carbon.*move/.test(lowerText)) {
      pool = 'DATA_GENERAL';
    } else if (/co2|carbon dioxide|ppm|atmosphere/.test(lowerText)) {
      pool = 'DATA_GENERAL';
    } else if (/emission|how much.*emit|human.*emit/.test(lowerText)) {
      pool = 'DATA_GENERAL';
    } else if (/tipping point|threshold|irreversible/.test(lowerText)) {
      pool = 'DATA_GENERAL';
    } else if (/solution|removal|cdr|restore/.test(lowerText)) {
      pool = 'RESULT_POS';
    } else if (/who are you|what are you|about you|yourself/.test(lowerText)) {
      pool = 'GREETING';
    } else if (/hello|hi |hey |greetings/.test(lowerText)) {
      pool = 'GREETING';
    } else if (/thank|thanks|thx/.test(lowerText)) {
      pool = 'REACT_WARM';
    } else if (/project|site|location/.test(lowerText)) {
      pool = 'TEASE';
    }
    // Fallback: use current site context or generic
    else {
      if (siteId) {
        pool = 'ENTRY';
      } else {
        // Pick from general pools based on engagement tier
        const tier = score.tier || 'COLD';
        if (tier === 'COLD') pool = 'GREETING';
        else if (tier === 'WARM') pool = 'TEASE';
        else pool = 'DATA_GENERAL';
      }
    }

    // Pick a line from the voice library
    if (pool && typeof GaiaMind !== 'undefined' && typeof GaiaVoiceLibrary !== 'undefined') {
      const context = {
        siteId,
        currentSite: siteId,
        engagementScore: score.score,
        idleSeconds: 0,
        usedLines: {},
      };
      const result = GaiaMind.selectLine(pool, context, GaiaVoiceLibrary);
      if (result && result.line && result.line.text) {
        // Small delay for natural feel
        const delay = 400 + Math.random() * 600;
        setTimeout(() => {
          _onGaiaSpeak(result.line.text, result.line.mood || 'curious');
        }, delay);
        return;
      }
    }

    // Ultimate fallback: if voice library not available, use static responses
    const fallbacks = [
      "I hear you. Tell me more about what you're thinking.",
      "That's a good question. Let me think about that...",
      "I'm still learning how to talk about this. But I'm trying.",
      "You're asking the right questions. Keep going.",
      "I wish I could say more. Bring me your key and I'll tell you everything.",
    ];
    const fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    const delay = 400 + Math.random() * 600;
    setTimeout(() => {
      _onGaiaSpeak(fallback, 'curious');
    }, delay);
  }

  // ═══════════════════════════════════════
  // UI RENDERING
  // ═══════════════════════════════════════

  function _renderGaiaMessage(text, emotion) {
    // Use gaia.html's existing #messages element and CSS classes
    const chat = document.getElementById('messages');
    if (!chat) return;

    // Ensure #messages is visible (hide #welcome on first message)
    const welcome = document.getElementById('welcome');
    if (welcome && !welcome.classList.contains('hidden')) {
      welcome.classList.add('hidden');
      chat.style.display = 'flex';
    }

    const msg = document.createElement('div');
    msg.className = 'msg gaia';
    msg.setAttribute('data-emotion', emotion || 'neutral');

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🌍';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(avatar);
    msg.appendChild(content);
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  function _renderUserMessage(text) {
    // Use gaia.html's existing #messages element and CSS classes
    const chat = document.getElementById('messages');
    if (!chat) return;

    // Ensure #messages is visible (hide #welcome on first message)
    const welcome = document.getElementById('welcome');
    if (welcome && !welcome.classList.contains('hidden')) {
      welcome.classList.add('hidden');
      chat.style.display = 'flex';
    }

    const msg = document.createElement('div');
    msg.className = 'msg user';

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '👤';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.style.textAlign = 'right';
    meta.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(avatar);
    msg.appendChild(content);
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
  }

  function _renderOverlay(type, data) {
    const content = document.getElementById('gaia-overlay-content');
    if (!content) return;

    // Dispatch to specific renderers based on type
    const event = new CustomEvent('gaia:render-overlay', {
      detail: { type, data }
    });
    document.dispatchEvent(event);
  }

  function _renderPrompt(args, callback) {
    const content = document.getElementById('gaia-overlay-content');
    if (!content) return;

    const event = new CustomEvent('gaia:render-prompt', {
      detail: { args, callback }
    });
    document.dispatchEvent(event);
  }

  function _renderSharePrompt(args) {
    const content = document.getElementById('gaia-overlay-content');
    if (!content) return;

    const event = new CustomEvent('gaia:render-share', {
      detail: { args }
    });
    document.dispatchEvent(event);
  }

  // ═══════════════════════════════════════
  // KEY MODAL
  // ═══════════════════════════════════════

  function _openKeyModal() {
    const modal = document.getElementById('gaia-key-modal');
    if (!modal) return;

    const score = GaiaState.getScore();
    const level = GaiaKeyGate.getTeaseLevel(score.score);
    const content = GaiaKeyGate.getModalContent(level);

    // Populate modal
    const titleEl = modal.querySelector('.key-modal-title');
    const gaiaLineEl = modal.querySelector('.key-modal-gaia-line');
    if (titleEl) titleEl.textContent = content.title;
    if (gaiaLineEl) gaiaLineEl.textContent = content.gaiaLine;

    modal.classList.add('open');
  }

  function _closeKeyModal() {
    const modal = document.getElementById('gaia-key-modal');
    if (modal) modal.classList.remove('open');
  }

  // Handle key submission
  window.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('gaia-key-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('gaia-key-input');
        if (input) {
          const result = GaiaKeyGate.submitKey(input.value);
          if (result.valid) {
            _closeKeyModal();
          } else {
            const errorEl = document.getElementById('gaia-key-error');
            if (errorEl) errorEl.textContent = result.error;
          }
        }
      });
    }
  });

  // ═══════════════════════════════════════
  // UTILITY FUNCTIONS
  // ═══════════════════════════════════════

  function _calcCarbon(fromBiome, toBiome, hectares, years) {
    // Same calculation as the existing carbon engine
    const BIOMES = window.BIOMES || {};
    const f = BIOMES[fromBiome];
    const t = BIOMES[toBiome];
    if (!f || !t) return { error: 'Unknown biome' };

    const stockC = (t.density - f.density) * hectares;
    const fluxC = (t.seq - f.seq) * hectares;
    const cumC = stockC + fluxC * (years || 30);

    const stockCO2 = stockC * 3.67;
    const fluxCO2 = fluxC * 3.67;
    const cumCO2 = cumC * 3.67;

    return {
      stock_co2: stockCO2,
      flux_co2: fluxCO2,
      cumulative_co2: cumCO2,
      years: years || 30,
      hectares,
      context: {
        cars: Math.round(Math.abs(cumCO2) / 4.6),
        fraction_of_global: cumCO2 / 20e9
      }
    };
  }

  function _getSiteData(siteId, fields) {
    const SITES = window.SITES || [];
    const site = SITES.find(s => s.id === siteId);
    if (!site) return null;

    if (!fields || fields.includes('all')) return site;

    const result = { siteId };
    fields.forEach(f => { result[f] = site[f]; });
    return result;
  }

  function _getBiomeData(biomeId) {
    const BIOMES = window.BIOMES || {};
    return BIOMES[biomeId] || null;
  }

  function _getGlobalStats() {
    return {
      co2_ppm: 431.12,
      co2_ppm_date: '2026-04',
      temperature_anomaly: 1.38,
      temperature_baseline: '1951-1980',
      annual_emissions_gt: 143,
      annual_uptake_gt: 123,
      net_excess_gt: 20,
      carbon_budget_15c_gt: 250,
      carbon_budget_years_remaining: 6,
      cdr_current_gt: 2.1,
      cdr_needed_2050_gt: 8
    };
  }

  async function _waitForEvent(eventType, timeoutSeconds) {
    return new Promise((resolve) => {
      const handler = (e) => {
        document.removeEventListener(`gaia:${eventType}`, handler);
        resolve({ event_received: true, event_type: eventType, event_data: e.detail });
      };

      document.addEventListener(`gaia:${eventType}`, handler);

      if (timeoutSeconds && timeoutSeconds > 0) {
        setTimeout(() => {
          document.removeEventListener(`gaia:${eventType}`, handler);
          resolve({ event_received: false, timed_out: true });
        }, timeoutSeconds * 1000);
      }
    });
  }

  // ═══════════════════════════════════════
  // AUTO-SAVE & ANALYTICS
  // ═══════════════════════════════════════

  function _autoSave() {
    // State is already persisted by the state machine
    // This is for additional analytics sync
    if (_eventBuffer.length > 0 && _unlocked) {
      _flushEvents();
    }
  }

  function _flushEvents() {
    if (_eventBuffer.length === 0) return;

    if (_unlocked && _ws) {
      _sendToIsolate({
        type: 'analytics_batch',
        payload: { events: [..._eventBuffer] }
      });
    }

    _eventBuffer = [];
  }

  // ═══════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════

  function log(...args) {
    if (CONFIG.DEBUG) {
      console.log('[Gaia]', ...args);
    }
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    init,
    getState:     () => GaiaState.getState(),
    getScore:     () => GaiaState.getScore(),
    getMood:      () => GaiaState.getMood(),
    getQuests:    () => GaiaQuests.getActiveQuests(),
    hasKey:       () => GaiaKeyGate.hasKey,
    isUnlocked:   () => _unlocked,
    speak:        (text, emotion) => _onGaiaSpeak(text, emotion),
    submitKey:    (key) => GaiaKeyGate.submitKey(key),
    CONFIG
  };
} catch(e) { console.error('[GaiaClient] Init error:', e); }
})();

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GaiaClient.init());
} else {
  GaiaClient.init();
}

// Export
if (typeof module !== 'undefined') module.exports = GaiaClient;
