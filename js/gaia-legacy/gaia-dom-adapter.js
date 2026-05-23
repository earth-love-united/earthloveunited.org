// ═══════════════════════════════════════════════════════
// GAIA DOM ADAPTER v1.1
// Bridges the DIS system (dis/) into gaia.html
// without modifying any existing IDs or inline JavaScript.
//
// v1.1 changes: All bridged events now also call
// GaiaState.handleEvent() directly so the DIS state
// machine advances as the user interacts with gaia.html.
// ═══════════════════════════════════════════════════════

window.GaiaDOMAdapter = (() => {

  // ─── CONFIG ───
  const CONFIG = {
    DEBUG: false
  };

  // ─── STATE ───
  let _initialized = false;

  // ═══════════════════════════════════════
  // HELPPER: check if state machine is loaded
  // ═══════════════════════════════════════

  function _gaiaStateReady() {
    return typeof window.GaiaState !== 'undefined' && typeof window.GaiaState.handleEvent === 'function';
  }

  // ═══════════════════════════════════════
  // HELPER: dispatch to state machine
  // Calls GaiaState.handleEvent(type, payload) if available.
  // ═══════════════════════════════════════

  function _sm(eventType, payload) {
    if (_gaiaStateReady()) {
      try {
        window.GaiaState.handleEvent(eventType, payload);
      } catch (err) {
        warn('[GaiaDOMAdapter] GaiaState.handleEvent error:', err);
      }
    }
  }

  // ═══════════════════════════════════════
  // SITE ID RESOLVER
  // Maps a query string to a site ID.
  // ═══════════════════════════════════════

  function _resolveSiteId(text) {
    const lower = (text || '').toLowerCase();
    if (/sri lanka/.test(lower)) return 'sri_lanka';
    if (/antalya|cop31|wildfire/.test(lower)) return 'antalya';
    if (/benin|jean/.test(lower)) return 'benin';
    if (/borneo|peat/.test(lower)) return 'borneo';
    return null;
  }

  // ═══════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════

  function init() {
    if (_initialized) return;
    log('[GaiaDOMAdapter] Initializing...');

    _injectGaiaMind();
    _createMissingElements();
    _createIdAliases();
    _injectKeyButton();
    _injectChatAvatar();
    _injectCSSOverrides();
    _bridgeEvents();
    _installInlineInterceptors();

    _initialized = true;
    log('[GaiaDOMAdapter] Initialized.');

    // Defer activation to let gaia-client.js auto-init run first,
    // then verify the state machine is fully wired up.
    _activateStateMachine();
  }

  // ═══════════════════════════════════════
  // INJECT GAIA-MIND.JS
  // The state machine's _pickLine() calls GaiaMind.selectLine(),
  // but gaia.html doesn't load gaia-mind.js. We inject it here
  // so it's available before the state machine first runs.
  // ═══════════════════════════════════════

  function _injectGaiaMind() {
    if (typeof window.GaiaMind !== 'undefined') return; // already loaded
    const existing = document.querySelector('script[src*="gaia-mind"]');
    if (existing) return; // script tag already in DOM

    const script = document.createElement('script');
    script.src = 'dis/gaia-mind.js';
    // Insert BEFORE gaia-state-machine.js so it's parsed first
    const smScript = document.querySelector('script[src*="gaia-state-machine"]');
    if (smScript && smScript.parentNode) {
      smScript.parentNode.insertBefore(script, smScript);
    } else {
      // Fallback: append to head
      document.head.appendChild(script);
    }
    log('[GaiaDOMAdapter] Injected gaia-mind.js');
  }

  // ═══════════════════════════════════════
  // ACTIVATE STATE MACHINE
  // Ensures callbacks are registered, voice library is loaded,
  // tick loop is started, and the initial greeting fires —
  // with onSpeak connected to gaia.html's addMessage().
  // ═══════════════════════════════════════

  function _activateStateMachine() {
    // Wait for gaia-client.js auto-init to finish (it also hooks DOMContentLoaded).
    // We run after a short delay so all DIS scripts have had their init() called.
    const tryActivate = () => {
      if (!_gaiaStateReady()) {
        log('[GaiaDOMAdapter] State machine not ready, retrying in 200ms...');
        setTimeout(tryActivate, 200);
        return;
      }

      // GaiaMind must be available for _pickLine() to work.
      // It's injected dynamically by _injectGaiaMind() but may still be loading.
      if (typeof window.GaiaMind === 'undefined') {
        log('[GaiaDOMAdapter] GaiaMind not ready, retrying in 200ms...');
        setTimeout(tryActivate, 200);
        return;
      }

      // Check if GaiaClient already registered the onSpeak callback
      // (gaia-client.js does this in its init()).
      const score = GaiaState.getScore();
      log('[GaiaDOMAdapter] State machine ready. Score:', score.score, 'Tier:', score.tier);

      // Register our own onSpeak that renders to gaia.html's chat UI.
      // We wrap any existing callback so both TTS and chat rendering work.
      GaiaState.registerCallbacks({
        onSpeak: _onGaiaSpeak,
        onReact: _onGaiaReact,
        onStateChange: _onStateChange,
        onMoodChange: _onMoodChange,
        onQuestTrigger: _onQuestTrigger,
        onJournalAdd: _onJournalAdd,
        onOverlayShow: _onOverlayShow,
        onGlobeFly: _onGlobeFly,
      });

      // Ensure voice library is loaded (GaiaClient does this, but be safe)
      if (typeof window.GaiaVoiceLibrary !== 'undefined') {
        GaiaState.setVoiceLibrary(window.GaiaVoiceLibrary);
        log('[GaiaDOMAdapter] Voice library set:', Object.keys(window.GaiaVoiceLibrary).length, 'pools');
      } else {
        warn('[GaiaDOMAdapter] GaiaVoiceLibrary not found — gaia-voice-data.js may not be loaded yet');
      }

      // Start the tick loop (handles idle nudges, time-based scoring)
      GaiaState.start();
      log('[GaiaDOMAdapter] Tick loop started');

      // Trigger the initial greeting if state is still GREETING (first visit)
      const st = GaiaState.getState();
      if (st.state === 'GREETING') {
        GaiaState.handleEvent('session_start');
        log('[GaiaDOMAdapter] Greeting triggered');
      }
    };

    // Start activation attempt after letting gaia-client.js init run first
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(tryActivate, 150));
    } else {
      setTimeout(tryActivate, 150);
    }
  }

  // ═══════════════════════════════════════
  // CALLBACK HANDLERS — bridge DIS → gaia.html UI
  // ═══════════════════════════════════════

  function _onGaiaSpeak(text, emotion) {
    // State machine voice lines are logged but NOT rendered into the LLM chat.
    // The chat is exclusively for user ↔ GAIA LLM conversation.
    log('[GaiaDOMAdapter] GAIA voice (suppressed from chat):', text.substring(0, 60) + '...');
  }

  function _onGaiaReact(emotion, intensity) {
    log('[GaiaDOMAdapter] GAIA reacts:', emotion, 'intensity:', intensity);
    // Visual feedback via the avatar element injected by the adapter
    const avatar = document.getElementById('gaia-avatar');
    if (avatar) {
      avatar.style.opacity = '1';
      avatar.setAttribute('data-emotion', emotion || '');
      // Pulse animation
      avatar.style.transition = 'transform 0.3s, opacity 0.3s';
      avatar.style.transform = 'scale(1.2)';
      setTimeout(() => { avatar.style.transform = 'scale(1)'; }, 300);
    }
  }

  function _onStateChange(oldState, newState) {
    log('[GaiaDOMAdapter] State:', oldState, '→', newState);
  }

  function _onMoodChange(oldMood, newMood) {
    log('[GaiaDOMAdapter] Mood:', oldMood, '→', newMood);
  }

  function _onQuestTrigger(questId, status) {
    log('[GaiaDOMAdapter] Quest:', questId, status);
  }

  function _onJournalAdd(entry) {
    log('[GaiaDOMAdapter] Journal entry:', entry);
    // Add to the journal panel if it exists
    const journal = document.getElementById('gaia-journal');
    if (journal) {
      const journalEntries = journal.querySelector('.journal-entries') || journal;
      const div = document.createElement('div');
      div.className = 'journal-entry';
      div.textContent = entry;
      journalEntries.prepend(div);
      // Show journal when it has entries
      journal.style.display = 'block';
    }
  }

  function _onOverlayShow(type, data) {
    log('[GaiaDOMAdapter] Overlay show:', type);
    const overlay = document.getElementById('gaia-overlay');
    if (overlay) {
      overlay.classList.add('open');
      const content = document.getElementById('gaia-overlay-content');
      if (content && data && data.title) {
        content.innerHTML = `<h2 style="font-family:'Cormorant Garamond',serif;color:#7be8d0;margin-bottom:12px;">${data.title}</h2>`;
        if (data.body) {
          content.innerHTML += `<p style="color:#9a9590;font-size:13px;line-height:1.6;">${data.body}</p>`;
        }
      }
    }
  }

  function _onGlobeFly(lat, lng, alt) {
    log('[GaiaDOMAdapter] Globe fly:', lat, lng, alt);
    // If globe.gl is available, fly to the location
    if (window.world && typeof window.world.pointOfView === 'function') {
      try {
        window.world.pointOfView({ lat, lng, altitude: alt || 1.5 }, 1000);
      } catch (e) {
        warn('[GaiaDOMAdapter] Globe fly failed:', e);
      }
    }
  }
  // Elements that DIS expects but gaia.html doesn't have.
  // ═══════════════════════════════════════

  function _createMissingElements() {
    // --- OVERLAY ---
    if (!document.getElementById('gaia-overlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'gaia-overlay';
      overlay.innerHTML = '<div id="gaia-overlay-content"></div>';
      overlay.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:1000;background:rgba(3,3,7,0.85);align-items:center;justify-content:center;backdrop-filter:blur(4px);';
      document.body.appendChild(overlay);
    }

    // --- KEY MODAL ---
    if (!document.getElementById('gaia-key-modal')) {
      const modal = document.createElement('div');
      modal.id = 'gaia-key-modal';
      modal.style.cssText = 'display:none;position:fixed;top:0;left:0;width:100%;height:100%;z-index:1001;align-items:center;justify-content:center;background:rgba(3,3,7,0.9);backdrop-filter:blur(6px);';
      modal.innerHTML = `
        <div class="key-modal-inner" style="background:#080a10;border:1px solid rgba(78,205,196,.15);border-radius:14px;padding:32px 28px;max-width:420px;width:90%;text-align:center;animation:fadeUp .3s ease-out;">
          <h2 class="key-modal-title" style="font-family:'Cormorant Garamond',serif;font-size:22px;color:#7be8d0;margin-bottom:8px;letter-spacing:1px;"></h2>
          <p class="key-modal-gaia-line" style="font-family:'Outfit',sans-serif;font-size:13px;color:#9a9590;margin-bottom:18px;line-height:1.6;font-style:italic;"></p>
          <form id="gaia-key-form" style="display:flex;flex-direction:column;gap:8px;">
            <input id="gaia-key-input" type="password" placeholder="sk-or-v1-..."
              style="width:100%;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(78,205,196,.15);border-radius:8px;color:#e2dfd8;font-family:'JetBrains Mono',monospace;font-size:12px;outline:none;box-sizing:border-box;"
              onfocus="this.style.borderColor='rgba(78,205,196,.35)'"
              onblur="this.style.borderColor='rgba(78,205,196,.15)'" />
            <button type="submit" class="key-modal-submit" style="width:100%;padding:10px;background:rgba(78,205,196,.1);border:1px solid rgba(78,205,196,.2);border-radius:8px;color:#4ecdc4;font-family:'JetBrains Mono',monospace;font-size:12px;cursor:pointer;transition:all .2s;" onmouseover="this.style.background='rgba(78,205,196,.15)'" onmouseout="this.style.background='rgba(78,205,196,.1)'">Unlock</button>
          </form>
          <div id="gaia-key-error" style="margin-top:8px;font-size:11px;color:#c45c4a;min-height:16px;"></div>
        </div>
      `;
      document.body.appendChild(modal);
    }

    // --- JOURNAL ---
    if (!document.getElementById('gaia-journal')) {
      const journal = document.createElement('div');
      journal.id = 'gaia-journal';
      journal.innerHTML = '<div class="journal-entries"></div>';
      journal.style.cssText = 'position:fixed;bottom:0;left:0;width:240px;max-height:300px;overflow-y:auto;z-index:5;background:rgba(8,10,16,.95);border-top:1px solid rgba(78,205,196,.08);border-right:1px solid rgba(78,205,196,.08);display:none;';
      document.body.appendChild(journal);
    }

    log('[GaiaDOMAdapter] Missing elements created.');
  }

  // ═══════════════════════════════════════
  // 2. CREATE ID ALIASES
  // For elements that exist under different IDs in gaia.html,
  // add hidden proxy containers so DIS getElementById calls work.
  //
  // gaia.html uses #messages; DIS expects #gaia-chat-messages
  // gaia.html uses #chat-input; DIS expects #gaia-chat-input
  // ═══════════════════════════════════════

  function _createIdAliases() {
    // We use a lightweight proxy pattern: override getElementById
    // for the specific DIS-expected IDs to return the
    // gaia.html equivalents. Clean, no hidden DOM elements needed.

    const idMap = {
      'gaia-chat-messages': 'messages',
      'gaia-chat-input': 'chat-input',
    };

    const originalGetElementById = document.getElementById.bind(document);

    document.getElementById = function(id) {
      const mappedId = idMap[id];
      if (mappedId) {
        const el = originalGetElementById(mappedId);
        if (el) return el;
      }
      return originalGetElementById(id);
    };

    // Also handle querySelector for the same IDs
    const originalQuerySelector = document.querySelector.bind(document);

    document.querySelector = function(selector) {
      if (selector === '#gaia-chat-messages') return originalQuerySelector('#messages');
      if (selector === '#gaia-chat-input') return originalQuerySelector('#chat-input');
      return originalQuerySelector(selector);
    };

    log('[GaiaDOMAdapter] ID aliases installed.');
  }

  // ═══════════════════════════════════════
  // 3. INJECT KEY BUTTON
  // Add #gaia-key-btn into #header .header-actions
  // ═══════════════════════════════════════

  function _injectKeyButton() {
    // Disabled: #api-key-btn already exists in gaia.html header.
    // No dynamic injection needed.
    log('[GaiaDOMAdapter] Key button injection skipped (already in HTML).');
  }

  // ═══════════════════════════════════════
  // 4. INJECT CHAT AVATAR
  // Add #gaia-avatar to the chat area for DIS callback use
  // ═══════════════════════════════════════

  function _injectChatAvatar() {
    if (document.getElementById('gaia-avatar')) return;

    const chatArea = document.getElementById('chat-area');
    if (!chatArea) {
      warn('[GaiaDOMAdapter] #chat-area not found, deferring avatar injection');
      return;
    }

    const avatar = document.createElement('div');
    avatar.id = 'gaia-avatar';
    avatar.style.cssText = 'position:absolute;bottom:70px;right:16px;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,rgba(78,205,196,.1),rgba(91,191,114,.07));border:1px solid rgba(78,205,196,.15);display:flex;align-items:center;justify-content:center;font-size:14px;opacity:0;transition:opacity .5s;pointer-events:none;z-index:2;';
    avatar.textContent = '🌍';
    chatArea.appendChild(avatar);

    log('[GaiaDOMAdapter] Chat avatar injected.');
  }

  // ═══════════════════════════════════════
  // 5. CSS OVERRIDES
  // Make DIS-rendered elements use gaia.html's styling
  // ═══════════════════════════════════════

  function _injectCSSOverrides() {
    const style = document.createElement('style');
    style.textContent = `
      /* DIS message elements styled to match gaia.html */
      #gaia-chat-messages { display: flex; flex-direction: column; }

      .msg.gaia .msg-avatar {
        background: linear-gradient(135deg,rgba(78,205,196,.15),rgba(91,191,114,.1)) !important;
        border: 1px solid rgba(78,205,196,.2) !important;
        color: inherit !important;
        font-size: 11px;
      }

      .msg.user .msg-avatar {
        background: rgba(139,127,199,.15) !important;
        border: 1px solid rgba(139,127,199,.25) !important;
      }

      .msg.gaia .msg-bubble {
        background: rgba(255,255,255,.03) !important;
        border: 1px solid rgba(78,205,196,.08) !important;
        border-top-left-radius: 3px !important;
        color: #e2dfd8 !important;
      }

      .msg.user .msg-bubble {
        background: rgba(139,127,199,.1) !important;
        border: 1px solid rgba(139,127,199,.15) !important;
        border-top-right-radius: 3px !important;
      }

      /* Overlay display fix */
      #gaia-overlay.open {
        display: flex !important;
      }

      /* Key modal display fix */
      #gaia-key-modal.open {
        display: flex !important;
      }

      /* Journal entry styling */
      .journal-entry {
        padding: 8px 12px;
        border-bottom: 1px solid rgba(255,255,255,.03);
        font-size: 10px;
        color: #9a9590;
        font-family: "JetBrains Mono", monospace;
      }

      .journal-entry:last-child {
        border-bottom: none;
      }

      /* Key modal input focus */
      #gaia-key-input:focus {
        border-color: rgba(78,205,196,.35) !important;
      }

      /* Badge visible state for key button */
      #gaia-key-btn.visible {
        opacity: 1 !important;
      }
    `;
    document.head.appendChild(style);

    log('[GaiaDOMAdapter] CSS overrides injected.');
  }

  // ═══════════════════════════════════════
  // 6. EVENT BRIDGING
  // Listen for gaia.html's existing interaction patterns
  // and dispatch to the DIS state machine via GaiaState.handleEvent().
  //
  // Strategy: addEventListener runs BEFORE inline onclick,
  // so we capture the interaction first, dispatch the DIS event,
  // then let the original handler proceed.
  // ═══════════════════════════════════════

  function _bridgeEvents() {
    // --- SIDEBAR TOPIC BUTTONS ---
    // These have onclick="askGaia('...')" — we intercept the click
    // to dispatch site_entered to the state machine before askGaia runs.
    document.addEventListener('click', (e) => {
      const topicBtn = e.target.closest('.topic-btn');
      if (!topicBtn) return;

      // Extract the site/topic from the onclick attribute
      const onclickAttr = topicBtn.getAttribute('onclick') || '';
      const textMatch = onclickAttr.match(/askGaia\('([^']+)'\)/);
      const query = textMatch ? textMatch[1] : '';

      // Map queries to site IDs for the state machine
      const siteId = _resolveSiteId(query);

      // Dispatch to state machine
      _sm('site_entered', { siteId, query, source: 'sidebar' });

      // Also dispatch data-reveal for project-specific queries
      if (siteId) {
        _sm('data_revealed', { siteId, layer: 'narrative', query });
      }

      // Also dispatch custom event (for any other listeners)
      document.dispatchEvent(new CustomEvent('gaia:site-tap', {
        detail: { siteId, query, source: 'sidebar' }
      }));
      if (siteId) {
        document.dispatchEvent(new CustomEvent('gaia:data-reveal', {
          detail: { siteId, layer: 'narrative', query }
        }));
      }
    }, true); // capture phase — fires before inline onclick

    // --- SUGGESTION CARDS (welcome area) ---
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.suggestion-card');
      if (!card) return;

      const onclickAttr = card.getAttribute('onclick') || '';
      const textMatch = onclickAttr.match(/askGaia\('([^']+)'\)/);
      const query = textMatch ? textMatch[1] : '';
      const siteId = _resolveSiteId(query);

      _sm('site_entered', { siteId, query, source: 'suggestion-card' });
      if (siteId) {
        _sm('data_revealed', { siteId, layer: 'narrative', query });
      }

      document.dispatchEvent(new CustomEvent('gaia:site-tap', {
        detail: { siteId, query, source: 'suggestion-card' }
      }));
      if (siteId) {
        document.dispatchEvent(new CustomEvent('gaia:data-reveal', {
          detail: { siteId, layer: 'narrative', query }
        }));
      }
    }, true);

    // --- HINT CHIPS (input area) ---
    document.addEventListener('click', (e) => {
      const chip = e.target.closest('.hint-chip');
      if (!chip) return;

      const onclickAttr = chip.getAttribute('onclick') || '';
      const textMatch = onclickAttr.match(/askGaia\('([^']+)'\)/);
      const query = textMatch ? textMatch[1] : '';
      const siteId = _resolveSiteId(query);

      _sm('site_entered', { siteId, query, source: 'hint-chip' });

      document.dispatchEvent(new CustomEvent('gaia:site-tap', {
        detail: { siteId, query, source: 'hint-chip' }
      }));
    }, true);

    // --- CHAT INPUT (Enter key) ---
    // Intercept Enter on #chat-input to dispatch chat_sent
    // before the inline handleKeyDown fires.
    document.addEventListener('keydown', (e) => {
      if (e.target.id === 'chat-input' && e.key === 'Enter' && !e.shiftKey) {
        const text = e.target.value.trim();
        if (text) {
          _sm('chat_sent', { message: text, source: 'chat-input' });

          document.dispatchEvent(new CustomEvent('gaia:chat-sent', {
            detail: { message: text, source: 'chat-input' }
          }));
        }
      }
    }, true);

    // --- SANDBOX PANEL TOGGLE ---
    // Watch #right-panel for class changes to detect open/close
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mut) => {
          if (mut.type === 'attributes' && mut.attributeName === 'class') {
            const isOpen = !rightPanel.classList.contains('collapsed');
            if (isOpen) {
              _sm('sandbox_opened', { source: 'toggle' });

              document.dispatchEvent(new CustomEvent('gaia:sandbox-open', {
                detail: { source: 'toggle' }
              }));
            }
          }
        });
      });
      observer.observe(rightPanel, { attributes: true });
    }

    // --- SANDBOX CALCULATE BUTTON ---
    // Intercept clicks on the sandbox calculate button
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.qb-btn');
      if (!btn) return;

      const onclickAttr = btn.getAttribute('onclick') || '';

      if (/runSandboxCalc/.test(onclickAttr)) {
        // The inline handler will run after us; we dispatch the event
        // The state machine can pick this up for scoring
        setTimeout(() => {
          try {
            const from = document.getElementById('qb-from')?.value;
            const to = document.getElementById('qb-to')?.value;
            const ha = parseInt(document.getElementById('qb-area')?.value) || 100;
            const yrs = parseInt(document.getElementById('qb-years')?.value) || 30;

            // Try to get the result from the existing engine
            let result = null;
            if (typeof transitionCarbon === 'function') {
              result = transitionCarbon(from, to, ha, yrs);
            }

            _sm('scenario_run', { fromBiome: from, toBiome: to, hectares: ha, years: yrs, result });

            document.dispatchEvent(new CustomEvent('gaia:scenario-run', {
              detail: { fromBiome: from, toBiome: to, hectares: ha, years: yrs, result }
            }));
          } catch (err) {
            // Silently fail — the inline handler still works
          }
        }, 50); // small delay to let inline handler compute first
      }

      if (/lookupProject/.test(onclickAttr)) {
        setTimeout(() => {
          try {
            const siteId = document.getElementById('qb-site')?.value;
            if (siteId) {
              _sm('data_revealed', { siteId, layer: 'project-data' });

              document.dispatchEvent(new CustomEvent('gaia:data-reveal', {
                detail: { siteId, layer: 'project-data' }
              }));
            }
          } catch (err) { /* silently fail */ }
        }, 50);
      }
    }, true);

    log('[GaiaDOMAdapter] Event bridges installed.');
  }

  // ═══════════════════════════════════════
  // 7. INLINE SCRIPT INTERCEPTION
  // Override askGaia() and sendMessage() in the inline script
  // so that when the DIS state machine is active, GAIA responds
  // with voice lines instead of the static KB.
  //
  // We wait for DOMContentLoaded so the inline script defines
  // its functions first, then we wrap them.
  // ═══════════════════════════════════════

  function _installInlineInterceptors() {
    // Wait for inline script to define its functions
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _doInstallInterceptors);
    } else {
      // DOM already loaded, install after a short delay to ensure
      // inline script has executed
      setTimeout(_doInstallInterceptors, 100);
    }
  }

  function _doInstallInterceptors() {
    // --- INTERCEPT askGaia() ---
    // We dispatch events to the DIS state machine for engagement tracking,
    // then let the original askGaia() run to produce the KB response.
    // This gives us the best of both worlds: DIS personality + KB knowledge.
    if (typeof window.askGaia === 'function') {
      const originalAskGaia = window.askGaia;
      window.askGaia = function(text) {
        // Dispatch chat event so state machine tracks engagement
        _sm('chat_sent', { message: text, source: 'askGaia-interceptor' });
        document.dispatchEvent(new CustomEvent('gaia:chat-sent', {
          detail: { message: text, source: 'askGaia-interceptor' }
        }));
        // Also dispatch site-tap for topic-specific queries
        const siteId = _resolveSiteId(text);
        if (siteId) {
          _sm('site_entered', { siteId, query: text, source: 'askGaia-interceptor' });
          document.dispatchEvent(new CustomEvent('gaia:site-tap', {
            detail: { siteId, query: text, source: 'askGaia-interceptor' }
          }));
        }
        // Let the original askGaia run — it shows user message + KB response
        originalAskGaia(text);
      };
      log('[GaiaDOMAdapter] askGaia() intercepted (dual mode).');
    }

    // --- INTERCEPT sendMessage() ---
    // Dispatch events to state machine, then let original sendMessage() run
    // to produce the KB response with live data, charts, and calculations.
    if (typeof window.sendMessage === 'function') {
      const originalSendMessage = window.sendMessage;
      window.sendMessage = function() {
        const input = document.getElementById('chat-input');
        const text = input ? input.value.trim() : '';
        if (!text) return;
        // Dispatch to state machine for engagement tracking
        _sm('chat_sent', { message: text, source: 'sendMessage-interceptor' });
        document.dispatchEvent(new CustomEvent('gaia:chat-sent', {
          detail: { message: text, source: 'sendMessage-interceptor' }
        }));
        // Call original sendMessage FIRST (it reads input.value to display user message)
        originalSendMessage();
        // Then clear input after original has processed it
        if (input) {
          input.value = '';
          if (typeof window.autoResize === 'function') window.autoResize(input);
        }
      };
      log('[GaiaDOMAdapter] sendMessage() intercepted (dual mode).');
    }

    // --- INTERCEPT handleKeyDown() for chat input ---
    // The inline handleKeyDown catches Enter and calls sendMessage().
    // Our keydown listener in _bridgeEvents already fires in capture phase,
    // but we also need to prevent the inline handler from double-processing.
    if (typeof window.handleKeyDown === 'function') {
      const originalHandleKeyDown = window.handleKeyDown;
      window.handleKeyDown = function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          e.stopImmediatePropagation();
          // Our capture-phase listener already dispatched gaia:chat-sent.
          // Just call our intercepted sendMessage to be safe.
          window.sendMessage();
          return;
        }
        // For non-Enter keys, pass through to original
        return originalHandleKeyDown(e);
      };
      log('[GaiaDOMAdapter] handleKeyDown() intercepted.');
    }

    // --- INTERCEPT runSandboxCalc() ---
    // The inline runSandboxCalc() computes the result and updates the DOM.
    // We wrap it to also dispatch scenario_run to the state machine.
    if (typeof window.runSandboxCalc === 'function') {
      const originalRunSandboxCalc = window.runSandboxCalc;
      window.runSandboxCalc = function() {
        // Call original first so the DOM is updated
        originalRunSandboxCalc();
        // Then dispatch to state machine
        setTimeout(() => {
          try {
            const from = document.getElementById('qb-from')?.value;
            const to = document.getElementById('qb-to')?.value;
            const ha = parseInt(document.getElementById('qb-area')?.value) || 100;
            const yrs = parseInt(document.getElementById('qb-years')?.value) || 30;
            let result = null;
            if (typeof transitionCarbon === 'function') {
              result = transitionCarbon(from, to, ha, yrs);
            }
            _sm('scenario_run', { fromBiome: from, toBiome: to, hectares: ha, years: yrs, result });
          } catch (err) { /* silently fail */ }
        }, 50);
      };
      log('[GaiaDOMAdapter] runSandboxCalc() intercepted.');
    }

    // --- INTERCEPT lookupProject() ---
    // The inline lookupProject() finds the site and updates the DOM.
    // We wrap it to also dispatch data_revealed to the state machine.
    if (typeof window.lookupProject === 'function') {
      const originalLookupProject = window.lookupProject;
      window.lookupProject = function() {
        // Get the siteId before the original runs (it reads from the select)
        const siteId = document.getElementById('qb-site')?.value;
        originalLookupProject();
        if (siteId) {
          _sm('data_revealed', { siteId, layer: 'project-data' });
        }
      };
      log('[GaiaDOMAdapter] lookupProject() intercepted.');
    }

    log('[GaiaDOMAdapter] Inline interceptors installed.');
  }

  // ═══════════════════════════════════════
  // LOGGING
  // ═══════════════════════════════════════

  function log(...args) {
    if (CONFIG.DEBUG) console.log('[GaiaDOMAdapter]', ...args);
  }

  function warn(...args) {
    console.warn('[GaiaDOMAdapter]', ...args);
  }

  // ═══════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════

  return {
    init,
    CONFIG
  };

})();

// ─── AUTO-INIT ───
// Run as early as possible so elements exist when DIS scripts load.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => GaiaDOMAdapter.init());
} else {
  GaiaDOMAdapter.init();
}
