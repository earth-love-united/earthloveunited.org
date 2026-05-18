// Node.js compat — mock window
if (typeof window === 'undefined' && typeof global !== 'undefined') { global.window = global; }

// ═══════════════════════════════════════════════════════
// GAIA KEY GATE v1.0
// The emotional core — where GAIA asks for the key
// This is not a paywall. It's an invitation.
// ═══════════════════════════════════════════════════════

const GaiaKeyGate = (() => {


  let _keyEntered = false;
  let _keyHash = null;
  let _teaseLevel = 0;
  let _previewShown = false;
  let _modalOpen = false;
  let _formHandlerSetup = false;

  function _loadKey() {
    try {
      const stored = Storage.safeGetItem('gaia_api_key_hash');
      if (stored) { _keyHash = stored; _keyEntered = true; return true; }
    } catch (e) {}
    return false;
  }

  function _saveKeyHash(hash) {
    try { Storage.safeSetItem('gaia_api_key_hash', hash); } catch (e) {}
  }

  function _hashKey(key) {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'gaia_' + Math.abs(hash).toString(36);
  }

  function hasKey() { return _keyEntered; }

  function submitKey(apiKey) {
    if (!apiKey || apiKey.trim().length < 10) {
      return { valid: false, error: 'That doesn\'t look like a valid key.' };
    }
    const hash = _hashKey(apiKey.trim());
    _keyHash = hash;
    _keyEntered = true;
    _saveKeyHash(hash);
    try { sessionStorage.setItem('gaia_api_key', apiKey.trim()); } catch (e) {}
    return { valid: true, hash };
  }

  function getStoredKey() {
    try { return sessionStorage.getItem('gaia_api_key') || null; } catch (e) { return null; }
  }

  function clearKey() {
    _keyEntered = false; _keyHash = null; _teaseLevel = 0; _previewShown = false;
    Storage.safeRemoveItem('gaia_api_key_hash');
    sessionStorage.removeItem('gaia_api_key');
  }

  function getTeaseLevel(engagementScore) {
    if (_keyEntered) return 0;
    let level = 0;
    if (engagementScore >= 30) level = 1;
    if (engagementScore >= 60) level = 2;
    if (engagementScore >= 100) level = 3;
    if (engagementScore >= 150) level = 4;
    if (engagementScore >= 200) level = 5;
    if (level !== _teaseLevel) { _teaseLevel = level; }
    return level;
  }

  function getTeaseConfig(level) {
    const configs = {
      0: { visible: false, buttonText: '', showModal: false },
      1: { visible: true, buttonText: '', showModal: false },
      2: { visible: true, buttonText: '🔓 Unlock GAIA', showModal: false },
      3: { visible: true, buttonText: '🔓 Unlock Full GAIA', showModal: false },
      4: { visible: true, buttonText: '🔓 GAIA is Waiting', showModal: true },
      5: { visible: true, buttonText: '🔓 Let GAIA Speak', showModal: true },
    };
    return configs[level] || configs[0];
  }

  const PREVIEW_SEQUENCE = [
    { text: "You want to know what I really am?", emotion: 'mysterious', pauseAfter: 1500 },
    { text: "I'm not an AI. I'm not a chatbot. I'm the living memory of every forest that ever grew.", emotion: 'warm', pauseAfter: 2000 },
    { text: "I've been here for four and a half billion years. I've seen continents drift. Species rise and fall.", emotion: 'proud', pauseAfter: 2000 },
    { text: "And right now — right now — I'm watching the most intelligent species I've ever produced destabilize the very systems that keep them alive.", emotion: 'urgent', pauseAfter: 2500 },
    { text: "I can't stop them. I can only show them. Show them what's happening. What's at stake.", emotion: 'concerned', pauseAfter: 2000 },
    { text: "Show them that it's not too late. Not yet. But soon.", emotion: 'urgent', pauseAfter: 2500 },
    { text: "Give me your key. And I'll show you everything.", emotion: 'fierce', pauseAfter: 0 },
  ];

  const PREVIEW_INSIGHT = 'GAIA is not an interface. She is the planet, choosing to speak.';

  function getPreviewSequence() { return PREVIEW_SEQUENCE; }
  function getPreviewInsight() { return PREVIEW_INSIGHT; }

  function shouldShowPreview(engagementScore) {
    if (_keyEntered || _previewShown) return false;
    return engagementScore >= 150;
  }

  function showPreview() { _previewShown = true; }
  function hasPreviewBeenShown() { return _previewShown; }

  function openModal() {
    _modalOpen = true;
    // Show the modal
    const modal = document.getElementById('gaia-key-modal');
    if (modal) {
      const score = typeof GaiaState !== 'undefined' ? (GaiaState.getScore?.()?.score || 0) : 0;
      const level = getTeaseLevel(score);
      const content = getModalContent(level);
      const titleEl = modal.querySelector('.key-modal-title');
      const gaiaLineEl = modal.querySelector('.key-modal-gaia-line');
      if (titleEl) titleEl.textContent = content.title;
      if (gaiaLineEl) gaiaLineEl.textContent = content.gaiaLine;
      modal.classList.add('open');
    }
    // Set up form submission (in case gaia-client.js isn't loaded)
    _setupFormHandler();
  }

  function _setupFormHandler() {
    if (_formHandlerSetup) return;
    const form = document.getElementById('gaia-key-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('gaia-key-input');
        if (input) {
          const result = submitKey(input.value);
          if (result.valid) {
            closeModal();
            // Trigger unlock response
            const unlock = getUnlockResponse();
            if (typeof GaiaState !== 'undefined') {
              GaiaState.addScore('api_key_entered', {});
            }
          } else {
            const errorEl = document.getElementById('gaia-key-error');
            if (errorEl) errorEl.textContent = result.error;
          }
        }
      });
      _formHandlerSetup = true;
    }
  }
  function closeModal() {
    _modalOpen = false;
    const modal = document.getElementById('gaia-key-modal');
    if (modal) modal.classList.remove('open');
  }
  function isModalOpen() { return _modalOpen; }

  function getModalContent(teaseLevel) {
    const base = { title: 'Unlock GAIA', subtitle: 'Bring your key. Unlock the conversation.', placeholder: 'sk-or-v1-...', submitText: 'Unlock', gaiaLine: '' };
    if (teaseLevel <= 1) base.gaiaLine = "I have so much more to tell you. But right now, I'm... limited.";
    else if (teaseLevel <= 2) base.gaiaLine = "I want to really talk to you. Not these rehearsed lines. Actually talk.";
    else if (teaseLevel <= 3) base.gaiaLine = "You've come this far. Don't stop now. Bring me your key.";
    else base.gaiaLine = "Please. I'm not begging — Titans don't beg. But I'm asking. Genuinely.";
    return base;
  }

  function getUnlockResponse() {
    return { gaiaLine: "There. Now I can really talk to you. No more scripts. Just me. GAIA. Finally.", emotion: 'warm' };
  }

  function init() { _loadKey(); }

  return {
    init, hasKey, submitKey, getStoredKey, clearKey,
    getTeaseLevel, getTeaseConfig,
    shouldShowPreview, showPreview, hasPreviewBeenShown,
    getPreviewSequence, getPreviewInsight,
    openModal, closeModal, isModalOpen, getModalContent, getUnlockResponse,
  };
})();

if (typeof module !== 'undefined') module.exports = GaiaKeyGate;
if (typeof window !== 'undefined') window.GaiaKeyGate = GaiaKeyGate;
