// ═══════════════════════════════════════════════════════
// GAIA VOICE ENGINE v1.0
// Client-side TTS using Web Speech API
// Bare metal. No API key. No network. Just speech.
// ═══════════════════════════════════════════════════════

const GaiaVoice = (() => {

  let _voices = [];
  let _selectedVoice = null;
  let _ready = false;
  let _queue = [];
  let _speaking = false;
  let _enabled = false;  // Start disabled — matches UI default (🔇)
  let _rate = 0.85;
  let _pitch = 0.88;
  let _volume = 1.0;

  let _callbacks = {
    onStart:  (text) => {},
    onEnd:    (text) => {},
    onError:  (err)  => {},
    onReady:  ()     => {}
  };

  function init() {
    if (!('speechSynthesis' in window)) {
      console.warn('[GaiaVoice] Web Speech API not supported');
      return false;
    }
    _loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = _loadVoices;
    }
    return true;
  }

  function _loadVoices() {
    _voices = speechSynthesis.getVoices();
    if (_voices.length > 0) {
      _selectBestVoice();
      _ready = true;
      _callbacks.onReady();
      // Drain any queued utterances now that voices are available
      _processQueue();
    }
  }

  function _selectBestVoice() {
    if (_voices.length === 0) return;
    const priorities = [
      v => v.name.includes('Google') && v.name.includes('US') && v.name.includes('English'),
      v => v.name.includes('Samantha'),
      v => v.name.includes('Google') && v.name.includes('UK') && v.name.includes('Female'),
      v => v.name.includes('Google') && v.name.includes('English'),
      v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'),
      v => v.lang.startsWith('en'),
      v => true
    ];
    for (const predicate of priorities) {
      const match = _voices.find(predicate);
      if (match) {
        _selectedVoice = match;
        console.log('[GaiaVoice] Selected voice:', match.name);
        return;
      }
    }
  }

  function speak(text, options = {}) {
    if (!_enabled || !text) return Promise.resolve();
    return new Promise((resolve, reject) => {
      if (!_ready) {
        _queue.push({ text, options, resolve, reject });
        return;
      }
      _doSpeak(text, options, resolve, reject);
    });
  }

  function _doSpeak(text, options, resolve, reject) {
    if (options.interrupt) stop();
    if (_speaking && !options.interrupt) {
      _queue.push({ text, options, resolve, reject });
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = _selectedVoice;
    utterance.rate = options.rate || _rate;
    utterance.pitch = options.pitch || _pitch;
    utterance.volume = options.volume || _volume;

    if (options.emotion) _applyEmotion(utterance, options.emotion);

    utterance.onstart = () => { _speaking = true; _callbacks.onStart(text); };
    utterance.onend = () => { _speaking = false; _callbacks.onEnd(text); resolve(); _processQueue(); };
    utterance.onerror = (e) => { _speaking = false; _callbacks.onError(e); reject(e); _processQueue(); };

    speechSynthesis.speak(utterance);
  }

  function _processQueue() {
    if (_queue.length > 0 && !_speaking) {
      const next = _queue.shift();
      _doSpeak(next.text, next.options, next.resolve, next.reject);
    }
  }

  function _applyEmotion(utterance, emotion) {
    // Use central voice config if available (loaded from gaia-utils.js)
    if (typeof GAIA_VOICE_CONFIG !== 'undefined') {
      const mod = GAIA_VOICE_CONFIG.get(emotion);
      const mult = GAIA_VOICE_CONFIG.toMultiplier(mod);
      utterance.rate  *= mult.rate;
      utterance.pitch *= mult.pitch;
      utterance.volume = Math.min(1, utterance.volume * mult.volume);
      return;
    }
    // Fallback for environments where gaia-utils.js isn't loaded
    switch (emotion) {
      case 'curious':     utterance.rate *= 0.95; utterance.pitch *= 1.05; break;
      case 'excited':     utterance.rate *= 1.1;  utterance.pitch *= 1.1;  utterance.volume = Math.min(1, utterance.volume * 1.1); break;
      case 'concerned':   utterance.rate *= 0.85; utterance.pitch *= 0.95; break;
      case 'proud':       utterance.rate *= 0.9;  utterance.volume = Math.min(1, utterance.volume * 1.05); break;
      case 'mysterious':  utterance.rate *= 0.8;  utterance.pitch *= 0.9;  utterance.volume *= 0.9; break;
      case 'urgent':      utterance.rate *= 1.15; utterance.pitch *= 1.05; utterance.volume = Math.min(1, utterance.volume * 1.1); break;
      case 'warm':        utterance.rate *= 0.88; utterance.pitch *= 0.95; break;
      case 'fierce':      utterance.rate *= 0.95; utterance.pitch *= 0.85; utterance.volume = Math.min(1, utterance.volume * 1.15); break;
      case 'playful':     utterance.rate *= 1.05; utterance.pitch *= 1.1;  break;
      case 'nurturing':   utterance.rate *= 0.82; utterance.pitch *= 0.92; utterance.volume *= 0.95; break;
      case 'disappointed':utterance.rate *= 0.78; utterance.pitch *= 0.88; utterance.volume *= 0.85; break;
    }
  }

  function pause() { speechSynthesis.pause(); }
  function resume() { speechSynthesis.resume(); }
  function stop() { speechSynthesis.cancel(); _speaking = false; _queue = []; }
  function isSpeaking() { return _speaking; }
  function isPaused() { return speechSynthesis.paused; }

  function setRate(rate) { _rate = Math.max(0.1, Math.min(2, rate)); }
  function setPitch(pitch) { _pitch = Math.max(0, Math.min(2, pitch)); }
  function setVolume(volume) { _volume = Math.max(0, Math.min(1, volume)); }
  function setEnabled(enabled) { _enabled = enabled; if (!enabled) stop(); }
  function setVoice(voiceName) { const v = _voices.find(v => v.name === voiceName); if (v) _selectedVoice = v; }
  function getVoices() { return _voices.map(v => ({ name: v.name, lang: v.lang })); }
  function getSelectedVoice() { return _selectedVoice?.name || null; }
  function setCallback(name, fn) { if (_callbacks.hasOwnProperty(name)) _callbacks[name] = fn; }

  return {
    init, speak, pause, resume, stop, isSpeaking, isPaused,
    setRate, setPitch, setVolume, setEnabled, setVoice, setCallback,
    getVoices, getSelectedVoice,
    get ready() { return _ready; },
    get enabled() { return _enabled; },
  };

})();

if (typeof module !== 'undefined') module.exports = GaiaVoice;
if (typeof window !== 'undefined') {
  window.GaiaVoice = GaiaVoice;

  MODULE_CONTRACTS.register('GaiaVoice', {
    provides: ['init', 'speak', 'setLibrary', 'getLibrary', 'destroy'],
    requires: [],
  });
  // Auto-init on load so voices are ready when user enables
  // (speechSynthesis.getVoices() is async in Chrome — needs early init)
  GaiaVoice.init();
}
