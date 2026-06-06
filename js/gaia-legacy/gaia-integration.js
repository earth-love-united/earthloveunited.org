// ═══════════════════════════════════════════════════════
// GAIA INTEGRATION v2.0
// Wires the DIS state machine into gaia.html's existing UI.
// This file is loaded AFTER all DIS files and BEFORE the inline script.
//
// Architecture:
//   User interaction → gaia-dom-adapter.js → GaiaState.handleEvent()
//     → State machine picks voice line → onSpeak callback → renders in chat
//     → Engagement score updates → mood shifts → idle detection
//
// The existing KB/inline script continues to work as the "response engine."
// The DIS state machine adds the "personality layer" — voice lines, moods,
// engagement tracking, quests, and the key gate.
// ═══════════════════════════════════════════════════════

window.GaiaIntegration = (() => {

  MODULE_CONTRACTS.register('GaiaIntegration', {
    provides: ['init', 'getScore', 'getTier', 'getMood', 'destroy', 'reset', 'getState'],
    requires: ['GAIA_JOURNAL'],
  });

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════

  function init() {
    if (_initialized) return;
    if (typeof GaiaState === 'undefined') {
      console.warn('[GaiaIntegration] GaiaState not loaded — DIS integration skipped');
      return;
    }
    if (typeof GaiaMind === 'undefined') {
      console.warn('[GaiaIntegration] GaiaMind not loaded — inner world disabled');
    }

    console.log('[GaiaIntegration] Initializing DIS into gaia.html...');

    // 0. Load voice library into state machine
    if (typeof GaiaVoiceLibrary !== 'undefined') {
      GaiaState.setVoiceLibrary(GaiaVoiceLibrary);
      const meta = typeof VoiceLibraryMeta !== 'undefined' ? VoiceLibraryMeta : null;
      console.log('[GaiaIntegration] Voice library loaded:', meta?.totalLines || 'unknown', 'lines');
    } else {
      console.warn('[GaiaIntegration] GaiaVoiceLibrary not found');
    }

    // 1. Register state machine callbacks to gaia.html's DOM
    _registerCallbacks();

    // 2. Start the state machine tick loop
    GaiaState.start();

    // 3. Trigger initial greeting
    GaiaState.handleEvent('session_start');

    // 3.5. Replay cross-page signals into GaiaMind
    // index.html modules write to GAIA_SIG. We drain and replay here.
    if (typeof GAIA_SIG !== 'undefined' && typeof GaiaMind !== 'undefined') {
      const signals = GAIA_SIG.drain();
      for (const s of signals) {
        GaiaMind.updateParticipantModel(s.e, s.p);
        GaiaState.addScore(s.e, s.p);
      }
      if (signals.length > 0) {
        console.log('[GaiaIntegration] Replayed', signals.length, 'cross-page signals');
      }
    }

    // 4. Set up periodic engagement save
    setInterval(() => {
      safeCall('GAIA_ENGAGEMENT', 'save');
      safeCall('GAIA_JOURNAL', 'save');
    }, 30000);

    _initialized = true;
    console.log('[GaiaIntegration] DIS active. State:', GaiaState.getState().state);
  }

  // ═══════════════════════════════════════
  // CALLBACK REGISTRATION
  // Connects state machine outputs to gaia.html's DOM
  // ═══════════════════════════════════════

  function _registerCallbacks() {
    GaiaState.registerCallbacks({

      // ── SPEAK → Render GAIA message in chat ──
      onSpeak: (text, emotion) => {
        _renderGaiaMessage(text, emotion);
        // Update engagement display whenever GAIA speaks
        if (typeof updateEngagementDisplay === 'function') updateEngagementDisplay();
        if (typeof updateQuestPanel === 'function') updateQuestPanel();
      },

      // ── REACT → Update avatar/visual state ──
      onReact: (emotion, intensity) => {
        _updateAvatarEmotion(emotion, intensity);
      },

      // ── STATE CHANGE → Log (debug) ──
      onStateChange: (oldState, newState) => {
        console.log(`[GaiaIntegration] ${oldState} → ${newState}`);
      },

      // ── MOOD CHANGE → Update UI mood indicator ──
      onMoodChange: (oldMood, newMood) => {
        _updateMoodIndicator(newMood);
      },

      // ── QUEST TRIGGER → Show quest completion ──
      onQuestTrigger: (questId, status) => {
        _handleQuestTrigger(questId, status);
      },

      // ── JOURNAL ADD → Add insight to journal ──
      onJournalAdd: (entry) => {
        _addJournalInsight(entry);
      },

      // ── OVERLAY SHOW → Display data overlay ──
      onOverlayShow: (type, data) => {
        _showOverlay(type, data);
      },

      // ── OVERLAY HIDE → Close overlay ──
      onOverlayHide: () => {
        _hideOverlay();
      },

      // ── GLOBE FLY → Animate globe camera ──
      onGlobeFly: (lat, lng, altitude) => {
        _flyGlobeTo(lat, lng, altitude);
      },

      // ── VOICE MODIFIERS → Apply to TTS ──
      onVoiceModifiers: (modifiers) => {
        _applyVoiceModifiers(modifiers);
      },
    });
  }

  // ═══════════════════════════════════════
  // RENDER: GAIA MESSAGE IN CHAT
  // Uses gaia.html's existing message format
  // ═══════════════════════════════════════

  function _renderGaiaMessage(text, emotion) {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    // Hide welcome screen on first GAIA message
    const welcome = document.getElementById('welcome');
    if (welcome && !welcome.classList.contains('hidden')) {
      welcome.classList.add('hidden');
      messagesEl.style.display = 'flex';
    }

    // Create message element matching gaia.html's existing format
    const msg = document.createElement('div');
    msg.className = 'msg gaia';
    msg.setAttribute('data-emotion', emotion || 'neutral');

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🌍';

    // Content wrapper
    const content = document.createElement('div');
    content.className = 'msg-content';

    // Bubble
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    // Meta (timestamp)
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = _formatTime(new Date());

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(avatar);
    msg.appendChild(content);
    messagesEl.appendChild(msg);

    // Scroll to bottom
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Speak via TTS if voice is enabled
    if (typeof GaiaVoice !== 'undefined' && GaiaVoice.enabled) {
      GaiaVoice.speak(text, { emotion: emotion || 'neutral' });
    }
  }

  // ═══════════════════════════════════════
  // DUAL RESPONSE: Voice line + KB response
  // When the state machine picks a voice line, we show it first,
  // then trigger the KB response as a follow-up message.
  // ═══════════════════════════════════════

  function renderDualResponse(voiceText, emotion, kbResponse) {
    // First: the voice line (personality)
    _renderGaiaMessage(voiceText, emotion);

    // Second: the KB response (information) — shown after a short delay
    if (kbResponse) {
      setTimeout(() => {
        const messagesEl = document.getElementById('messages');
        if (!messagesEl) return;

        const msg = document.createElement('div');
        msg.className = 'msg gaia';

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.textContent = '🌍';

        const content = document.createElement('div');
        content.className = 'msg-content';

        const bubble = document.createElement('div');
        bubble.className = 'msg-bubble';
        bubble.innerHTML = kbResponse;

        const meta = document.createElement('div');
        meta.className = 'msg-meta';
        meta.textContent = _formatTime(new Date());

        content.appendChild(bubble);
        content.appendChild(meta);
        msg.appendChild(avatar);
        msg.appendChild(content);
        messagesEl.appendChild(msg);
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 1500); // 1.5s delay so the voice line lands first
    }
  }

  // ═══════════════════════════════════════
  // RENDER: USER MESSAGE (for consistency)
  // ═══════════════════════════════════════

  function renderUserMessage(text) {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    const welcome = document.getElementById('welcome');
    if (welcome && !welcome.classList.contains('hidden')) {
      welcome.classList.add('hidden');
      messagesEl.style.display = 'flex';
    }

    const msg = document.createElement('div');
    msg.className = 'msg user';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = text;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = _formatTime(new Date());

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(content);
    messagesEl.appendChild(msg);

    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // ═══════════════════════════════════════
  // AVATAR EMOTION
  // ═══════════════════════════════════════

  function _updateAvatarEmotion(emotion, intensity) {
    // Update the welcome avatar
    const welcomeAvatar = document.querySelector('#welcome .gaia-avatar');
    if (welcomeAvatar) {
      welcomeAvatar.setAttribute('data-emotion', emotion || 'neutral');
      welcomeAvatar.setAttribute('data-intensity', intensity || 5);
    }

    // Update the chat area avatar (injected by adapter)
    const chatAvatar = document.getElementById('gaia-avatar');
    if (chatAvatar) {
      chatAvatar.style.opacity = '1';
      chatAvatar.setAttribute('data-emotion', emotion || 'neutral');

      // Pulse animation on emotion change
      chatAvatar.style.animation = 'none';
      chatAvatar.offsetHeight; // force reflow
      chatAvatar.style.animation = 'pulse-glow 2s ease-in-out';
    }

    // Update the header badge
    const headerBadge = document.querySelector('#header .gaia-badge');
    if (headerBadge) {
      const dot = headerBadge.querySelector('.dot');
      if (dot) {
        // Change dot color based on emotion
        const emotionColors = {
          curious: '#4ecdc4', excited: '#7be8d0', concerned: '#d4a574',
          proud: '#5bbf72', mysterious: '#8b7fc7', urgent: '#c45c4a',
          warm: '#7be8d0', fierce: '#c45c4a', playful: '#7be8d0',
          nurturing: '#5bbf72', grieving: '#8b7fc7',
        };
        dot.style.background = emotionColors[emotion] || '#5bbf72';
      }
    }
  }

  // ═══════════════════════════════════════
  // MOOD INDICATOR
  // ═══════════════════════════════════════

  function _updateMoodIndicator(mood) {
    // Could update a mood indicator in the UI
    // For now, just log it
    console.log(`[GaiaIntegration] Mood: ${mood}`);
  }

  // ═══════════════════════════════════════
  // QUEST HANDLING
  // ═══════════════════════════════════════

  function _handleQuestTrigger(questId, status) {
    if (status !== 'completed') return;

    // Get quest info from GAIA_JOURNAL
    if (typeof GAIA_JOURNAL === 'undefined') return;

    const quests = GAIA_JOURNAL.getQuests();
    const quest = quests.find(q => q.id === questId);
    if (!quest) return;

    // Show quest completion as a special GAIA message
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;

    const msg = document.createElement('div');
    msg.className = 'msg gaia';
    msg.setAttribute('data-emotion', 'proud');

    const avatar = document.createElement('div');
    avatar.className = 'msg-avatar';
    avatar.textContent = '🌍';

    const content = document.createElement('div');
    content.className = 'msg-content';

    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.innerHTML = `<strong>✓ Quest Complete: ${quest.title}</strong><br><br>${quest.desc}`;

    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent = _formatTime(new Date());

    content.appendChild(bubble);
    content.appendChild(meta);
    msg.appendChild(avatar);
    msg.appendChild(content);
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Speak the quest completion
    if (typeof GaiaVoice !== 'undefined' && GaiaVoice.enabled) {
      GaiaVoice.speak(`Quest complete: ${quest.title}. ${quest.desc}`, { emotion: 'proud' });
    }
  }

  // ═══════════════════════════════════════
  // JOURNAL
  // ═══════════════════════════════════════

  function _addJournalInsight(entry) {
    if (typeof GAIA_JOURNAL === 'undefined') return;
    GAIA_JOURNAL.addEntry(entry, null, null);

    // Also render in the journal panel if visible
    const journalEl = document.getElementById('gaia-journal');
    if (journalEl) {
      const entriesContainer = journalEl.querySelector('.journal-entries');
      if (entriesContainer) {
        const entryEl = document.createElement('div');
        entryEl.className = 'journal-entry';
        entryEl.textContent = entry;
        entriesContainer.prepend(entryEl);
      }
    }
  }

  // ═══════════════════════════════════════
  // OVERLAY
  // ═══════════════════════════════════════

  function _showOverlay(type, data) {
    const overlay = document.getElementById('gaia-overlay');
    if (!overlay) return;

    const content = document.getElementById('gaia-overlay-content');
    if (!content) return;

    // Render overlay content based on type
    content.innerHTML = _renderOverlayContent(type, data);
    overlay.style.display = 'flex';
    overlay.classList.add('open');
  }

  function _hideOverlay() {
    const overlay = document.getElementById('gaia-overlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.classList.remove('open');
  }

  function _renderOverlayContent(type, data) {
    switch (type) {
      case 'mystery_reveal':
        return `
          <div style="max-width:500px;text-align:center;padding:28px;">
            <div style="font-size:32px;margin-bottom:12px;">${data?.icon || '🔍'}</div>
            <h3 style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#7be8d0;margin-bottom:10px;">${data?.title || 'Discovery'}</h3>
            <p style="font-size:13px;color:#9a9590;line-height:1.7;">${data?.text || ''}</p>
            <button onclick="document.getElementById('gaia-overlay').classList.remove('open');document.getElementById('gaia-overlay').style.display='none';"
              style="margin-top:16px;padding:8px 20px;border:1px solid rgba(78,205,196,.2);border-radius:6px;background:rgba(78,205,196,.08);color:#4ecdc4;font-size:12px;cursor:pointer;">
              Continue Exploring
            </button>
          </div>`;

      case 'scenario_result':
        return `
          <div style="max-width:400px;text-align:center;padding:28px;">
            <h3 style="font-family:'Cormorant Garamond',serif;font-size:20px;color:#7be8d0;margin-bottom:10px;">Scenario Result</h3>
            <div style="font-size:28px;font-family:'JetBrains Mono',monospace;color:${data?.isPositive ? '#5bbf72' : '#c45c4a'};margin:12px 0;">
              ${data?.isPositive ? '+' : ''}${data?.cumulative?.toLocaleString() || 0} t CO₂
            </div>
            <p style="font-size:12px;color:#9a9590;line-height:1.6;">${data?.context || ''}</p>
            <button onclick="document.getElementById('gaia-overlay').classList.remove('open');document.getElementById('gaia-overlay').style.display='none';"
              style="margin-top:16px;padding:8px 20px;border:1px solid rgba(78,205,196,.2);border-radius:6px;background:rgba(78,205,196,.08);color:#4ecdc4;font-size:12px;cursor:pointer;">
              Close
            </button>
          </div>`;

      case 'key_prompt':
        // Trigger the key modal
        if (typeof GaiaKeyGate !== 'undefined') {
          setTimeout(() => GaiaKeyGate.openModal(), 500);
        }
        return '';

      default:
        return `<div style="padding:28px;color:#9a9590;font-size:13px;">${JSON.stringify(data)}</div>`;
    }
  }

  // ═══════════════════════════════════════
  // GLOBE CONTROL
  // ═══════════════════════════════════════

  function _flyGlobeTo(lat, lng, altitude) {
    // gaia.html uses globe.gl in the background
    if (typeof world !== 'undefined' && world.pointOfView) {
      world.pointOfView({ lat, lng, altitude: altitude || 1.5 }, 1000);
    }
  }

  // ═══════════════════════════════════════
  // VOICE MODIFIERS
  // ═══════════════════════════════════════

  function _applyVoiceModifiers(modifiers) {
    if (typeof GaiaVoice === 'undefined') return;
    if (modifiers.rate) GaiaVoice.setRate(0.85 + modifiers.rate);
    if (modifiers.pitch) GaiaVoice.setPitch(0.88 + modifiers.pitch);
    if (modifiers.volume) GaiaVoice.setVolume(Math.max(0, Math.min(1, 1.0 + modifiers.volume)));
  }

  // ═══════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════

  function _formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // Expose functions that the inline script can call
  // ═══════════════════════════════════════

  return {
    init,
    renderUserMessage,

    // Allow inline script to check if DIS is active
    isActive: () => _initialized,

    // Allow inline script to get engagement info
    getEngagement: () => {
      if (hasModule('GAIA_ENGAGEMENT')) {
        return {
          score: safeGet('GAIA_ENGAGEMENT', 'getScore', 0),
          tier: safeGet('GAIA_ENGAGEMENT', 'getTier', 'explorer'),
          mood: safeGet('GAIA_ENGAGEMENT', 'getMood', 'neutral'),
        };
      }
      return null;
    },

    // Allow inline script to manually trigger events
    triggerEvent: (eventType, payload) => {
      if (typeof GaiaState !== 'undefined') {
        GaiaState.handleEvent(eventType, payload);
      }
    },
  };
  return {
    init(config = {}) { console.debug(`[SML] GaiaIntegration.init`); return true; },
    reset() { console.debug(`[SML] GaiaIntegration.reset`); return true; },
    destroy() { console.debug(`[SML] GaiaIntegration.destroy`); return true; },
    getState() { return {
    getMood() {
      console.debug(`[Stub] Module.getMood`);
      return true;
    },
    getScore() {
      console.debug(`[Stub] Module.getScore`);
      return true;
    },
    getTier() {
      console.debug(`[Stub] Module.getTier`);
      return true;
    },
}; },
  };


})();

// ═══════════════════════════════════════
// AUTO-INIT
// Wait for all DIS files to load, then init
// ═══════════════════════════════════════

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all DIS scripts have loaded
    setTimeout(() => GaiaIntegration.init(), 100);
  });
} else {
  setTimeout(() => GaiaIntegration.init(), 100);
}
