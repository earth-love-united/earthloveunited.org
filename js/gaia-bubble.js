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
  let isExpanded = false;

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

    // Start typing
    currentText = text;
    textEl.textContent = '';
    bubbleEl.classList.add('speaking');
    bubbleEl.classList.remove('thinking');

    // Typing effect
    let i = 0;
    const speed = Math.min(25, Math.max(12, 150 / text.length));
    function type() {
      if (currentText !== text) return;
      if (i < text.length) {
        textEl.textContent += text[i];
        i++;
        setTimeout(type, speed);
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
    GAIA_ENGAGEMENT.addSignal(signalName);

    // Check for quest completions
    const completed = GAIA_JOURNAL.checkQuestProgress(signalName, siteId);
    for (const quest of completed) {
      showQuestNotification(quest);
    }

    // Check for pledge prompt
    if (typeof PLEDGE_WALL !== 'undefined') {
      const score = GAIA_ENGAGEMENT.getScore();
      if (score >= 30 && !PLEDGE_WALL.hasPledged()) {
        // Don't show immediately — let the moment breathe
        setTimeout(() => {
          if (typeof PLEDGE_WALL !== 'undefined') {
            PLEDGE_WALL.showSmallPrompt(
              "You've been exploring. You've seen the data. What will you do with this?",
              'warm'
            );
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
    const level = GAIA_ENGAGEMENT.getIdleLevel();
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

  return {
    create, speak, showThinking, expand, collapse, toggleExpand,
    onSignal, idleNudge,
    isVisible, getBubble,
    colors: COLORS,
  };
})();
