/**
 * PLEDGE WALL v2.0
 * Public commitment wall — fires after meaningful moments, not score thresholds
 * 
 * Triggers (in order of priority):
 * 1. After completing a site investigation (all layers revealed)
 * 2. After running a restoration scenario
 * 3. After collecting 3+ journal insights
 * 4. On departure (if score 20+ and hasn't pledged)
 * 
 * UX: GAIA speaks first → small prompt appears → user clicks → modal opens
 * Not a pop-up. A natural next step.
 */

const PLEDGE_WALL = (() => {
  // ── State ──
  let pledges = [];
  let modalEl = null;
  let wallEl = null;
  let promptEl = null;
  let hasPledged = false;
  let promptShown = false;
  let triggerSource = null; // 'site_complete' | 'scenario' | 'insights' | 'departure'

  // ── Persistence ──
  function save() {
    Storage.safeSetItem('gaia_pledges', JSON.stringify(pledges));
    Storage.safeSetItem('gaia_has_pledged', hasPledged ? '1' : '0');
  }

  function load() {
    try {
      const raw = Storage.safeGetItem('gaia_pledges');
      if (raw) pledges = JSON.parse(raw);
      hasPledged = Storage.safeGetItem('gaia_has_pledged') === '1';
    } catch { /* ignore */ }
  }

  // ── Check if we should show the small prompt (not the full modal yet) ──
  function shouldShowPrompt() {
    if (promptShown) return false;
    if (hasPledged) return false;
    if (modalEl) return false; // modal already open
    return true;
  }

  // ── Trigger: After completing a site investigation ──
  function onSiteComplete(siteId) {
    if (!shouldShowPrompt()) return;
    triggerSource = 'site_complete';
    showSmallPrompt(
      "You've seen " + getSiteName(siteId) + ". You've seen the data. What will you do with this knowledge?",
      'warm'
    );
  }

  // ── Trigger: After running a scenario ──
  function onScenarioRun(result) {
    if (!shouldShowPrompt()) return;
    if (!result || !result.cumulative_co2) return;
    
    const tons = Math.abs(result.cumulative_co2);
    const formatted = tons >= 1e6 ? (tons / 1e6).toFixed(1) + 'M' : (tons / 1e3).toFixed(0) + 'K';
    
    triggerSource = 'scenario';
    showSmallPrompt(
      "You just modeled restoring " + formatted + " tons of CO₂. That's real impact. What will you actually do?",
      'proud'
    );
  }

  // ── Trigger: After collecting 3+ insights ──
  function onInsightsCollected(count) {
    if (!shouldShowPrompt()) return;
    if (count < 3) return;
    
    triggerSource = 'insights';
    showSmallPrompt(
      count + " insights collected. You're building real understanding. Ready to turn knowledge into action?",
      'warm'
    );
  }

  // ── Trigger: On departure (if engaged but hasn't pledged) ──
  // NOTE: This is now handled by app.js via visibilitychange + beforeunload.
  // Kept as a no-op for backward compatibility in case other code calls it.
  function onDeparture() {
    // Deprecated — departure logic moved to app.js
  }

  // ── Show small prompt (not full modal yet) ──
  function showSmallPrompt(message, tone) {
    promptShown = true;

    // GAIA speaks
    if (hasModule('GAIA_BUBBLE')) {
      GAIA_BUBBLE.speak(message, tone, 8000);
    }

    // Show small prompt bar after GAIA finishes speaking
    setTimeout(() => {
      createSmallPrompt(message);
    }, 6000);
  }

  // ── Create small prompt bar (bottom of screen, non-intrusive) ──
  function createSmallPrompt(message) {
    if (promptEl) return;

    promptEl = document.createElement('div');
    promptEl.id = 'pledge-prompt';
    promptEl.innerHTML = `
      <div class="pledge-prompt-inner">
        <span class="pledge-prompt-text">${message.substring(0, 80)}...</span>
        <button class="pledge-prompt-btn" onclick="PLEDGE_WALL.openModal()">Make a Pledge</button>
        <button class="pledge-prompt-dismiss" onclick="PLEDGE_WALL.dismissPrompt()">✕</button>
      </div>
    `;

    document.body.appendChild(promptEl);

    // Animate in
    requestAnimationFrame(() => {
      promptEl.classList.add('visible');
    });

    // Auto-dismiss after 30 seconds if no interaction
    setTimeout(() => {
      if (promptEl) dismissPrompt();
    }, 30000);
  }

  // ── Dismiss small prompt ──
  function dismissPrompt() {
    if (promptEl) {
      promptEl.classList.remove('visible');
      setTimeout(() => {
        if (promptEl && promptEl.parentNode) {
          promptEl.parentNode.removeChild(promptEl);
        }
        promptEl = null;
      }, 300);
    }
  }

  // ── Open full pledge modal ──
  function openModal() {
    dismissPrompt();
    createModal();
  }

  // ── Create pledge modal ──
  function createModal() {
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'pledge-modal';
    modalEl.innerHTML = `
      <div class="pledge-modal-overlay" onclick="PLEDGE_WALL.closeModal()"></div>
      <div class="pledge-modal-card">
        <button class="pledge-modal-close" onclick="PLEDGE_WALL.closeModal()">✕</button>
        <div class="pledge-modal-icon">🤝</div>
        <h2 class="pledge-modal-title">Make Your Pledge</h2>
        <p class="pledge-modal-subtitle">You've seen the science. You've explored the data. Now — what will you do about it?</p>
        <textarea id="pledge-text" class="pledge-textarea" placeholder="I will..." maxlength="200" rows="3"></textarea>
        <div class="pledge-char-count"><span id="pledge-char-count">0</span>/200</div>
        <div class="pledge-options">
          <input type="text" id="pledge-name" class="pledge-input" placeholder="Your name (optional)" maxlength="50">
          <select id="pledge-type" class="pledge-select">
            <option value="personal">🌱 Personal Action</option>
            <option value="donation">💚 Donate</option>
            <option value="advocacy">📣 Spread the Word</option>
            <option value="career">💼 Career Change</option>
            <option value="other">✨ Other</option>
          </select>
        </div>
        <div class="pledge-actions">
          <button class="pledge-btn-primary" onclick="PLEDGE_WALL.submitPledge()">
            Add My Pledge to the Wall
          </button>
          <button class="pledge-btn-secondary" onclick="PLEDGE_WALL.closeModal()">
            Maybe Later
          </button>
        </div>
        <div class="pledge-privacy">Your pledge will be visible on the public wall. No email required.</div>
      </div>
    `;

    document.body.appendChild(modalEl);

    // Animate in
    requestAnimationFrame(() => {
      modalEl.classList.add('visible');
    });

    // Character counter
    const textarea = $('pledge-text');
    const counter = $('pledge-char-count');
    if (textarea && counter) {
      textarea.addEventListener('input', () => {
        counter.textContent = textarea.value.length;
      });
    }

    // Track engagement
    if (hasModule('GAIA_ENGAGEMENT')) {
      GAIA_ENGAGEMENT.addSignal('site_tap');
    }
  }

  // ── Submit pledge ──
  function submitPledge() {
    const text = $('pledge-text')?.value.trim();
    if (!text) {
      const ta = $('pledge-text');
      if (ta) {
        ta.style.animation = 'none';
        ta.offsetHeight;
        ta.style.animation = 'shake 0.4s ease-out';
      }
      return;
    }

    const name = $('pledge-name')?.value.trim() || 'Anonymous';
    const type = $('pledge-type')?.value || 'personal';

    const pledge = {
      id: Date.now().toString(36),
      text,
      name,
      type,
      triggerSource,
      timestamp: Date.now(),
      country: getDetectedCountry(),
    };

    pledges.unshift(pledge);
    hasPledged = true;
    save();

    closeModal();
    showWall();

    // GAIA reacts
    if (hasModule('GAIA_BUBBLE')) {
      const reactions = [
        "That's a start. The wall grows. Every pledge matters.",
        "Good. Now do it. The planet is watching.",
        "Pledged. Let's see if you follow through.",
        "One more voice. One more action. That's how it starts.",
      ];
      GAIA_BUBBLE.speak(reactions[Math.floor(Math.random() * reactions.length)], 'proud', 5000);
    }

    safeCall('GAIA_ENGAGEMENT', 'addSignal', 'pledge');
    safeCall('GAIA_ENGAGEMENT', 'save');
    safeCall('GAIA_SIG', 'emit', 'share', { type: 'pledge' });

    if (hasModule('GAIA_JOURNAL')) {
      GAIA_JOURNAL.checkQuestProgress('share', null);
    }
  }

  // ── Get detected country ──
  function getDetectedCountry() {
    if (hasModule('DELEGATION') && DELEGATION.getDetected()) {
      return DELEGATION.getDetected().code;
    }
    return null;
  }

  // ── Get site name from ID ──
  function getSiteName(siteId) {
    const names = {
      sri_lanka: 'Sri Lanka',
      antalya: 'Antalya',
      benin: 'Benin',
      borneo: 'Borneo',
    };
    return names[siteId] || 'this site';
  }

  // ── Close modal ──
  function closeModal() {
    if (modalEl) {
      modalEl.classList.remove('visible');
      setTimeout(() => {
        if (modalEl && modalEl.parentNode) {
          modalEl.parentNode.removeChild(modalEl);
        }
        modalEl = null;
      }, 300);
    }
  }

  // ── Show pledge wall ──
  function showWall() {
    if (wallEl) {
      wallEl.classList.add('visible');
      renderWall();
      return;
    }

    wallEl = document.createElement('div');
    wallEl.id = 'pledge-wall';
    wallEl.innerHTML = `
      <div class="pledge-wall-overlay" onclick="PLEDGE_WALL.hideWall()"></div>
      <div class="pledge-wall-card">
        <button class="pledge-wall-close" onclick="PLEDGE_WALL.hideWall()">✕</button>
        <div class="pledge-wall-header">
          <div class="pledge-wall-icon">🌍</div>
          <h2>The Pledge Wall</h2>
          <p>Commitments from people who've seen the data and decided to act.</p>
          <div class="pledge-wall-count">${pledges.length} pledge${pledges.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="pledge-wall-entries" id="pledge-wall-entries"></div>
      </div>
    `;

    document.body.appendChild(wallEl);

    requestAnimationFrame(() => {
      wallEl.classList.add('visible');
    });

    renderWall();
  }

  // ── Render wall entries ──
  function renderWall() {
    const container = $('pledge-wall-entries');
    if (!container) return;

    if (pledges.length === 0) {
      container.innerHTML = '<div class="pledge-wall-empty">No pledges yet. Be the first.</div>';
      return;
    }

    const typeIcons = {
      personal: '🌱', donation: '💚', advocacy: '📣', career: '💼', other: '✨',
    };

    container.innerHTML = pledges.slice(0, 50).map(p => {
      const icon = typeIcons[p.type] || '✨';
      const timeAgo = getTimeAgo(p.timestamp);
      const countryFlag = p.country ? getFlagEmoji(p.country) : '';
      return `
        <div class="pledge-entry">
          <div class="pledge-entry-icon">${icon}</div>
          <div class="pledge-entry-content">
            <div class="pledge-entry-text">"${escapeHtml(p.text)}"</div>
            <div class="pledge-entry-meta">
              <span class="pledge-entry-name">${escapeHtml(p.name)}${countryFlag ? ' ' + countryFlag : ''}</span>
              <span class="pledge-entry-time">${timeAgo}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ── Hide wall ──
  function hideWall() {
    if (wallEl) {
      wallEl.classList.remove('visible');
      setTimeout(() => {
        if (wallEl && wallEl.parentNode) {
          wallEl.parentNode.removeChild(wallEl);
        }
        wallEl = null;
      }, 300);
    }
  }

  // ── Helper: time ago ──
  function getTimeAgo(ts) {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    const days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  // ── Helper: flag emoji ──
  function getFlagEmoji(code) {
    if (!code) return '';
    // Country codes are ISO alpha-3 (3 chars). Flag emoji math only works with alpha-2.
    // Use COUNTRY_DATA's pre-baked flag if available, otherwise skip.
    if (hasModule('COUNTRY_DATA')) {
      const comparison = COUNTRY_DATA.getComparison(code);
      if (comparison && comparison.flag) return comparison.flag;
    }
    // Fallback: if code happens to be 2-letter alpha-2, compute it
    if (code.length === 2) {
      const codePoints = code.toUpperCase().split('').map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
      return String.fromCodePoint(...codePoints);
    }
    return '';
  }

  // ── Helper: escape HTML ──
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Generate share text ──
  function generateShareText(pledge) {
    return `"${pledge.text}" — ${pledge.name}, ${pledge.country || 'Earth'}. Join me: earthloveunited.org #GAIA #COP31`;
  }

  // ── Init ──
  function init() {
    load();
    // No automatic polling — triggers come from specific user actions
  }

  return {
    init, openModal, closeModal, submitPledge, dismissPrompt,
    showWall, hideWall,
    onSiteComplete, onScenarioRun, onInsightsCollected, onDeparture,
    getPledges: () => pledges,
    getPledgeCount: () => pledges.length,
    hasPledged: () => hasPledged,
    generateShareText,
  };
})();
window.PLEDGE_WALL = PLEDGE_WALL;
