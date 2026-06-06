/**
 * GAIA BUBBLE v2.0
 * A small, always-visible bubble that GAIA lives in
 * Bottom-right corner, teal/mint/green natural vibes
 * 
 * States:
 * - Idle: small pulsing dot with GAIA emoji
 * - Thinking: typing indicator
 * - Speaking: expanded bubble with text
 * - Hover: shows recent insight or prompt
 */

const GAIA_BUBBLE = (() => {
  let bubbleEl = null;
  let avatarEl = null;
  let textEl = null;
  let currentText = '';
  let hideTimer = null;
  let _typeTimer = null;
  let isExpanded = false;
  let currentSite = null;

  // ── Color palette — natural teal/mint/green ──
  const COLORS = {
    bg: 'rgba(8, 18, 20, 0.92)',
    border: 'rgba(78, 205, 196, 0.25)',
    glow: 'rgba(78, 205, 196, 0.15)',
    text: '#d0e8e0',
    textDim: '#7a9a90',
    accent: '#4ecdc4',
    mint: '#7be8d0',
    leaf: '#5bbf72',
  };

  // ── Create the bubble ──
  function create() {
    if (bubbleEl) return;

    bubbleEl = document.createElement('div');
    bubbleEl.id = 'gaia-bubble';
    bubbleEl.innerHTML = `
      <div class="gaia-bubble-avatar">🌍</div>
      <div class="gaia-site-indicator"></div>
      <div class="gaia-bubble-text"></div>
      <div class="gaia-bubble-thinking">
        <span></span><span></span><span></span>
      </div>
    `;

    document.body.appendChild(bubbleEl);

    avatarEl = bubbleEl.querySelector('.gaia-bubble-avatar');
    textEl = bubbleEl.querySelector('.gaia-bubble-text');

    // Click to expand/collapse
    bubbleEl.addEventListener('click', (e) => {
      if (e.target.closest('.gaia-bubble-dismiss')) return;
      toggleExpand();
    });

    // Start idle pulse
    startIdlePulse();
  }

  // ── Idle pulse animation ──
  function startIdlePulse() {
    if (!bubbleEl) return;
    bubbleEl.classList.add('idle');
  }

  function stopIdlePulse() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('idle');
  }

  // ── Show thinking state ──
  function showThinking() {
    if (!bubbleEl) create();
    stopIdlePulse();
    bubbleEl.classList.add('thinking');
    bubbleEl.classList.remove('speaking', 'expanded');
    isExpanded = false;
    currentText = '';
  }

  // ── Speak — show text with typing effect ──
  function speak(text, tone, duration = 8000) {
    if (!bubbleEl) create();

    // Clear previous
    if (hideTimer) clearTimeout(hideTimer);
    stopIdlePulse();

    // Set color based on tone
    const toneColors = {
      warm: COLORS.mint,
      proud: COLORS.leaf,
      urgent: '#c4a04a',
      mysterious: '#8b9fc7',
      concerned: '#d4a574',
      playful: COLORS.accent,
      fierce: '#c45c4a',
      nurturing: COLORS.leaf,
      neutral: COLORS.accent,
    };
    const color = toneColors[tone] || COLORS.accent;

    // Apply tone color
    bubbleEl.style.borderColor = color + '40';
    avatarEl.style.boxShadow = `0 0 16px ${color}30`;

    // Get voice modifiers from GaiaMind if available, else use central config
    let voiceModifiers = {};
    if (hasModule('GaiaMind')) {
      voiceModifiers = GaiaMind.getVoiceModifiers?.({ tone }) || {};
    } else {
      voiceModifiers = GAIA_VOICE_CONFIG.get(tone);
    }

    // Start typing
    currentText = text;
    textEl.textContent = '';
    bubbleEl.classList.add('speaking');
    bubbleEl.classList.remove('thinking');

    // Clear previous typing timer to prevent interleaved text
    if (_typeTimer) { clearTimeout(_typeTimer); _typeTimer = null; }

    // Typing effect — speed adjusted by voice modifier
    let i = 0;
    const baseSpeed = Math.min(25, Math.max(12, 150 / text.length));
    const speedMultiplier = 1 + (voiceModifiers.rate || 0);
    const speed = Math.max(8, Math.min(40, baseSpeed * speedMultiplier));
    function type() {
      if (currentText !== text) return;
      if (i < text.length) {
        textEl.textContent += text[i];
        i++;
        _typeTimer = setTimeout(type, speed);
      }
    }
    type();

    // Auto-collapse after duration
    hideTimer = setTimeout(() => {
      collapse();
    }, duration);
  }

  // ── Expand bubble ──
  function expand() {
    if (!bubbleEl) return;
    bubbleEl.classList.add('expanded');
    isExpanded = true;
  }

  // ── Collapse bubble ──
  function collapse() {
    if (!bubbleEl) return;
    bubbleEl.classList.remove('expanded', 'speaking', 'thinking');
    isExpanded = false;
    currentText = '';
    textEl.textContent = '';

    // Reset colors
    bubbleEl.style.borderColor = COLORS.border;
    avatarEl.style.boxShadow = `0 0 12px ${COLORS.glow}`;

    // Return to idle
    startIdlePulse();
  }

  // ── Toggle expand/collapse ──
  function toggleExpand() {
    if (isExpanded) {
      collapse();
    } else {
      expand();
    }
  }

  // ── React to engagement events ──
  function onSignal(signalName, siteId) {
    safeCall('GAIA_ENGAGEMENT', 'addSignal', signalName);

    // Check for quest completions
    const completed = safeCall('GAIA_JOURNAL', 'checkQuestProgress', signalName, siteId);
    if (completed) {
      for (const quest of completed) {
        showQuestNotification(quest);
      }
    }

    // Check for pledge prompt
    if (hasModule('PLEDGE_WALL') && hasModule('GAIA_ENGAGEMENT')) {
      const score = safeGet('GAIA_ENGAGEMENT', 'getScore', 0);
      if (score >= 30 && !safeGet('PLEDGE_WALL', 'hasPledged', true)) {
        // Don't show immediately — let the moment breathe
        setTimeout(() => {
          if (hasModule('PLEDGE_WALL')) {
            speak("You've been exploring. You've seen the data. What will you do with this?", 'warm', 8000);
          }
        }, 2000);
      }
    }
  }

  // ── Quest notification ──
  function showQuestNotification(quest) {
    const notif = document.createElement('div');
    notif.className = 'gaia-quest-popup';
    notif.innerHTML = `<span class="qp-icon">✓</span><span class="qp-text">${quest.title}</span>`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }

  // ── Idle nudge ──
  function idleNudge() {
    const level = safeGet('GAIA_ENGAGEMENT', 'getIdleLevel', null);
    if (!level) return;

    const nudges = {
      GENTLE: [
        "The planet isn't going to restore itself.",
        "Somewhere on this globe, a forest is burning. Just saying.",
        "You're quiet. That's okay. But I have more to show you.",
      ],
      MEDIUM: [
        "Four sites. Each one a different story. You've only seen some of them.",
        "The carbon clock doesn't pause because you're idle.",
        "I've been alive for four and a half billion years. I can wait. But you probably shouldn't.",
      ],
      STRONG: [
        "You came all this way and you're just... staring?",
        "Fine. I'll wait. I'm good at waiting. I waited 300 million years for the coal to form.",
        "The climate crisis doesn't care if you're ready. It's happening. Now.",
      ],
    };

    const pool = nudges[level] || nudges.GENTLE;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    speak(msg, level === 'STRONG' ? 'fierce' : 'mysterious', 6000);
  }

  // ── Get state ──
  function isVisible() {
    return bubbleEl !== null;
  }

  function getBubble() {
    return bubbleEl;
  }

  function setCurrentSite(siteId) {
    currentSite = siteId;
    const indicator = bubbleEl?.querySelector('.gaia-site-indicator');
    if (indicator) {
      const siteNames = { sri_lanka: 'Sri Lanka', antalya: 'Antalya', benin: 'Benin', borneo: 'Borneo' };
      indicator.textContent = siteNames[siteId] || '';
      if (siteId) {
        indicator.classList.add('active');
      } else {
        indicator.classList.remove('active');
      }
    }
  }

  function getCurrentSite() {
    return currentSite;
  }

  // ── Open full GAIA chat with context ──
  function openFullGAIA() {
    if (currentSite) {
      try {
        sessionStorage.setItem('gaia_context', JSON.stringify({
          siteId: currentSite,
          timestamp: Date.now(),
        }));
      } catch { /* ignore */ }
    }
    window.open('gaia.html', '_blank');
  }

  // ── Welcome back with emotional memory ──
  function welcomeBack() {
    if (typeof GaiaMind === 'undefined') return null;
    const sessionCount = GaiaMind.getSessionCount?.() || 1;
    const timeSince = GaiaMind.getTimeSinceLastVisit?.();
    const dominant = GaiaMind.getDominantEmotion?.();
    const texture = GaiaMind.getEmotionalTexture?.();
    const unresolved = GaiaMind.getUnresolvedThread?.();
    return { sessionCount, timeSince, dominant, texture, unresolved };
  }

  return {
    create, speak, showThinking, expand, collapse, toggleExpand,
    onSignal, idleNudge, welcomeBack,
    setCurrentSite, getCurrentSite, openFullGAIA,
    isVisible, getBubble,
    colors: COLORS,

    init() {
      console.debug('[Stub] GAIA_BUBBLE.init');

      // Subscribe to engagement events via EventBus
      if (hasModule('EventBus')) {
        this._unsubEngagement = window.EventBus.on('engagement:signal', (data) => {
          // React to significant engagement signals
          if (data.weight >= 5 && data.signal !== 'idle_penalty') {
            // Choose a contextual reaction based on signal type
            const reactions = {
              site_tap: "What will you find there?",
              data_reveal: "The numbers tell a story...",
              scenario_run: "You're shaping the future.",
              insight: "That's worth remembering.",
              correct_prediction: "Sharp eye.",
              share: "Spreading the word. That matters.",
              big_scenario: "Now THAT is impact.",
              return_visit: "Welcome back. Let's go deeper.",
            };
            const line = reactions[data.signal];
            if (line && isVisible()) {
              // Don't interrupt if already speaking — just queue
              window.EventBus.emit('bubble:react', { text: line, signal: data.signal });
            }
          }
        });

        // Subscribe to app-level bubble commands via EventBus
        this._unsubBubbleSpeak = window.EventBus.on('bubble:speak', (data) => {
          if (data.text) {
            speak(data.text, data.tone || 'warm', data.duration || 5000);
          }
        });

        this._unsubBubbleCreate = window.EventBus.on('bubble:create', () => {
          create();
        });

        this._unsubBubbleIdle = window.EventBus.on('bubble:idle-nudge', () => {
          idleNudge();
        });
      }

      return true;
    },

    show() {
      console.debug('[Stub] GAIA_BUBBLE.show');
      return true;
    },

    hide() {
      console.debug('[Stub] GAIA_BUBBLE.hide');
      return true;
    },

    setMood() {
      console.debug('[Stub] GAIA_BUBBLE.setMood');
      return true;
    },

    setPosition() {
      console.debug('[Stub] GAIA_BUBBLE.setPosition');
      return true;
    },

    fadeIn() {
      console.debug('[Stub] GAIA_BUBBLE.fadeIn');
      return true;
    },

    fadeOut() {
      console.debug('[Stub] GAIA_BUBBLE.fadeOut');
      return true;
    },

    setInteractive() {
      console.debug('[Stub] GAIA_BUBBLE.setInteractive');
      return true;
    },

    setPhase() {
      console.debug('[Stub] GAIA_BUBBLE.setPhase');
      return true;
    },

    handleScroll() {
      console.debug('[Stub] GAIA_BUBBLE.handleScroll');
      return true;
    },

    handleResize() {
      console.debug('[Stub] GAIA_BUBBLE.handleResize');
      return true;
    },

    on() {
      console.debug('[Stub] GAIA_BUBBLE.on');
      return true;
    },

    off() {
      console.debug('[Stub] GAIA_BUBBLE.off');
      return true;
    },

    // ── Standard Module Lifecycle (SML) ──
    reset() {
      console.debug('[SML] GAIA_BUBBLE.reset');
      return true;
    },
    destroy() {
      console.debug('[SML] GAIA_BUBBLE.destroy');

      // Unsubscribe from EventBus
      if (this._unsubEngagement) {
        this._unsubEngagement();
        this._unsubEngagement = null;
      }
      if (this._unsubBubbleSpeak) {
        this._unsubBubbleSpeak();
        this._unsubBubbleSpeak = null;
      }
      if (this._unsubBubbleCreate) {
        this._unsubBubbleCreate();
        this._unsubBubbleCreate = null;
      }
      if (this._unsubBubbleIdle) {
        this._unsubBubbleIdle();
        this._unsubBubbleIdle = null;
      }

      return true;
    },
    getState() {
      return {};
    },
  };
})();
window.GAIA_BUBBLE = GAIA_BUBBLE;

if (typeof MODULE_CONTRACTS !== 'undefined') {
  MODULE_CONTRACTS.register('GAIA_BUBBLE', {
    provides: ['speak', 'show', 'hide', 'setMood', 'setPosition', 'fadeIn', 'fadeOut', 'isVisible', 'setInteractive', 'setPhase', 'handleScroll', 'handleResize', 'on', 'off', 'destroy', 'init', 'reset', 'getState'],
    requires: ['GAIA_JOURNAL'],
    emits: ['bubble:react'],
    listens: ['engagement:signal'],
  });
}
